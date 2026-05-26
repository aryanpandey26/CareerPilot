"""Authentication router: email/password JWT + Emergent Google OAuth.

Endpoints (all under /api/auth):
  POST /register   email+password+name -> JWT
  POST /login      email+password      -> JWT
  POST /google-session  { session_id } -> sets cookie, creates user if needed
  GET  /me         (cookie OR Bearer)  -> current user
  POST /logout                          -> clears cookie + session
"""
from fastapi import APIRouter, HTTPException, Request, Response, Depends
from fastapi.security.utils import get_authorization_scheme_param
from pydantic import BaseModel, EmailStr, Field
from datetime import datetime, timedelta, timezone
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path
import os
import uuid
import bcrypt
import jwt
import httpx
import logging

load_dotenv(Path(__file__).parent / ".env")
JWT_SECRET = os.environ.get("JWT_SECRET", "change-me-before-production")
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.environ.get("GOOGLE_REDIRECT_URI", "")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_DAYS = 7
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"

router = APIRouter(prefix="/api/auth", tags=["auth"])

# DB handle (injected from main app)
_db = None
def set_db(db):
    global _db
    _db = db


# ---------------- Models ----------------
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    name: str = Field(min_length=1, max_length=120)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class GoogleSessionRequest(BaseModel):
    session_id: str


class PublicUser(BaseModel):
    user_id: str
    email: str
    name: str
    picture: str = ""
    auth_provider: str = "password"


# ---------------- Helpers ----------------
def _hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception as e:  # malformed hash, encoding issue, etc.
        logging.warning(f"bcrypt verify error: {e}")
        return False


def _issue_jwt(user_id: str) -> str:
    payload = {
        "user_id": user_id,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRY_DAYS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def _decode_jwt(token: str) -> dict | None:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError:
        return None


async def _get_user(user_id: str):
    return await _db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})


async def get_current_user(request: Request) -> dict:
    """Resolve current user from either session cookie or Bearer token."""
    if _db is None:
        raise HTTPException(status_code=500, detail="Auth not initialised")

    # 1) Try session cookie (Google flow)
    session_token = request.cookies.get("session_token")
    if session_token:
        sess = await _db.user_sessions.find_one(
            {"session_token": session_token}, {"_id": 0}
        )
        if sess:
            expires_at = sess.get("expires_at")
            if isinstance(expires_at, str):
                expires_at = datetime.fromisoformat(expires_at)
            if expires_at is None or (
                expires_at.tzinfo is None
                and expires_at.replace(tzinfo=timezone.utc) > datetime.now(timezone.utc)
            ) or (expires_at.tzinfo is not None and expires_at > datetime.now(timezone.utc)):
                user = await _get_user(sess["user_id"])
                if user:
                    return user

    # 2) Try Authorization: Bearer (email/password flow)
    auth_header = request.headers.get("Authorization", "")
    scheme, token = get_authorization_scheme_param(auth_header)
    if scheme.lower() == "bearer" and token:
        payload = _decode_jwt(token)
        if payload and "user_id" in payload:
            user = await _get_user(payload["user_id"])
            if user:
                return user

    raise HTTPException(status_code=401, detail="Not authenticated")


# ---------------- Routes ----------------
@router.post("/register")
async def register(req: RegisterRequest):
    existing = await _db.users.find_one({"email": req.email.lower()}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    user_id = f"user_{uuid.uuid4().hex[:12]}"
    doc = {
        "user_id": user_id,
        "email": req.email.lower(),
        "name": req.name.strip(),
        "picture": "",
        "auth_provider": "password",
        "password_hash": _hash_password(req.password),
        "created_at": datetime.now(timezone.utc),
    }
    await _db.users.insert_one(doc)

    token = _issue_jwt(user_id)
    return {
        "token": token,
        "user": PublicUser(
            user_id=user_id,
            email=doc["email"],
            name=doc["name"],
            picture="",
            auth_provider="password",
        ).model_dump(),
    }


@router.post("/login")
async def login(req: LoginRequest):
    user = await _db.users.find_one({"email": req.email.lower()})
    if not user or not user.get("password_hash"):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not _verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = _issue_jwt(user["user_id"])
    return {
        "token": token,
        "user": PublicUser(
            user_id=user["user_id"],
            email=user["email"],
            name=user["name"],
            picture=user.get("picture", ""),
            auth_provider=user.get("auth_provider", "password"),
        ).model_dump(),
    }


@router.get("/google/login")
async def google_login():
    """Kick off the direct Google OAuth2 flow."""
    import urllib.parse
    state = uuid.uuid4().hex
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "online",
        "prompt": "select_account",
        "state": state,
    }
    # Persist state for CSRF protection (10 min TTL)
    await _db.oauth_states.insert_one({
        "state": state,
        "created_at": datetime.now(timezone.utc),
    })
    url = f"{GOOGLE_AUTH_URL}?{urllib.parse.urlencode(params)}"
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url=url, status_code=302)


@router.get("/google/callback")
async def google_callback(code: str = "", state: str = "", error: str = ""):
    """Handle Google's redirect: exchange code → fetch profile → set cookie → forward to FE."""
    from fastapi.responses import RedirectResponse

    if error or not code or not state:
        return RedirectResponse(
            url=f"{FRONTEND_URL}/login?error=google_auth_failed",
            status_code=302,
        )

    # Verify state (CSRF + replay)
    state_doc = await _db.oauth_states.find_one_and_delete({"state": state})
    if not state_doc:
        return RedirectResponse(
            url=f"{FRONTEND_URL}/login?error=invalid_state",
            status_code=302,
        )

    # 1) Exchange code for tokens
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            token_resp = await client.post(
                GOOGLE_TOKEN_URL,
                data={
                    "code": code,
                    "client_id": GOOGLE_CLIENT_ID,
                    "client_secret": GOOGLE_CLIENT_SECRET,
                    "redirect_uri": GOOGLE_REDIRECT_URI,
                    "grant_type": "authorization_code",
                },
                headers={"Accept": "application/json"},
            )
        if token_resp.status_code != 200:
            logging.error(f"Google token exchange failed: {token_resp.text}")
            return RedirectResponse(
                url=f"{FRONTEND_URL}/login?error=token_exchange_failed",
                status_code=302,
            )
        tokens = token_resp.json()
        access_token = tokens.get("access_token")

        # 2) Fetch user profile
        async with httpx.AsyncClient(timeout=15) as client:
            user_resp = await client.get(
                GOOGLE_USERINFO_URL,
                headers={"Authorization": f"Bearer {access_token}"},
            )
        if user_resp.status_code != 200:
            return RedirectResponse(
                url=f"{FRONTEND_URL}/login?error=profile_fetch_failed",
                status_code=302,
            )
        profile = user_resp.json()
    except Exception as e:
        logging.error(f"Google OAuth error: {e}")
        return RedirectResponse(
            url=f"{FRONTEND_URL}/login?error=oauth_exception",
            status_code=302,
        )

    email = (profile.get("email") or "").lower()
    if not email:
        return RedirectResponse(
            url=f"{FRONTEND_URL}/login?error=no_email",
            status_code=302,
        )

    # 3) Upsert user
    existing = await _db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await _db.users.update_one(
            {"user_id": user_id},
            {"$set": {
                "name": profile.get("name", existing.get("name", "")),
                "picture": profile.get("picture", existing.get("picture", "")),
                "auth_provider": "google",
            }},
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await _db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": profile.get("name", email.split("@")[0]),
            "picture": profile.get("picture", ""),
            "auth_provider": "google",
            "created_at": datetime.now(timezone.utc),
        })

    # 4) Create internal session
    session_token = uuid.uuid4().hex
    expires_at = datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRY_DAYS)
    await _db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at,
        "created_at": datetime.now(timezone.utc),
    })

    # 5) Redirect to FE with cookie set
    response = RedirectResponse(url=f"{FRONTEND_URL}/home", status_code=302)
    response.set_cookie(
        key="session_token",
        value=session_token,
        max_age=JWT_EXPIRY_DAYS * 24 * 60 * 60,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
    )
    return response


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return PublicUser(
        user_id=user["user_id"],
        email=user["email"],
        name=user.get("name", ""),
        picture=user.get("picture", ""),
        auth_provider=user.get("auth_provider", "password"),
    ).model_dump()


@router.post("/logout")
async def logout(request: Request, response: Response):
    session_token = request.cookies.get("session_token")
    if session_token and _db is not None:
        await _db.user_sessions.delete_one({"session_token": session_token})
    response.delete_cookie("session_token", path="/")
    return {"success": True}
