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
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_DAYS = 7
EMERGENT_SESSION_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"

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
    except Exception:
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


@router.post("/google-session")
async def google_session(req: GoogleSessionRequest, response: Response):
    """Exchange the Emergent OAuth session_id for an internal session."""
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(
                EMERGENT_SESSION_URL,
                headers={"X-Session-ID": req.session_id},
            )
        if r.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid OAuth session")
        data = r.json()
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Google session exchange failed: {e}")
        raise HTTPException(status_code=500, detail="OAuth exchange failed")

    email = (data.get("email") or "").lower()
    if not email:
        raise HTTPException(status_code=400, detail="No email in OAuth response")

    existing = await _db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        # Refresh name/picture
        await _db.users.update_one(
            {"user_id": user_id},
            {"$set": {
                "name": data.get("name", existing.get("name", "")),
                "picture": data.get("picture", existing.get("picture", "")),
                "auth_provider": "google",
            }},
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await _db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": data.get("name", email.split("@")[0]),
            "picture": data.get("picture", ""),
            "auth_provider": "google",
            "created_at": datetime.now(timezone.utc),
        })

    session_token = data["session_token"]
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await _db.user_sessions.update_one(
        {"session_token": session_token},
        {"$set": {
            "user_id": user_id,
            "session_token": session_token,
            "expires_at": expires_at,
            "created_at": datetime.now(timezone.utc),
        }},
        upsert=True,
    )

    response.set_cookie(
        key="session_token",
        value=session_token,
        max_age=7 * 24 * 60 * 60,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
    )

    return {
        "user": PublicUser(
            user_id=user_id,
            email=email,
            name=data.get("name", ""),
            picture=data.get("picture", ""),
            auth_provider="google",
        ).model_dump()
    }


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
