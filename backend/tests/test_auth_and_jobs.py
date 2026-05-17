"""
Iteration 7 — Backend tests for new auth + job-recommendation layer.

Covers:
  * /api/auth/register, /api/auth/login, /api/auth/me
  * Cross-user isolation on /api/analytics/history
  * user_id stamping on /api/interview-session when authenticated
  * /api/jobs/recommend → current_match + stretch with apply_links
"""
import os
import time
import uuid
import pytest
import requests
from pathlib import Path

# Resolve BASE_URL from frontend/.env (REACT_APP_BACKEND_URL is public ingress URL)
BASE_URL = None
env_file = Path('/app/frontend/.env').read_text()
for line in env_file.splitlines():
    if line.startswith('REACT_APP_BACKEND_URL='):
        BASE_URL = line.split('=', 1)[1].strip().rstrip('/')
assert BASE_URL, "REACT_APP_BACKEND_URL missing"
API = f"{BASE_URL}/api"


# ---------- Helpers / Fixtures ----------
@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


@pytest.fixture(scope="module")
def user_a(s):
    """Register a fresh user A and return {token, user}."""
    email = f"TEST_a_{uuid.uuid4().hex[:8]}@example.com"
    r = s.post(f"{API}/auth/register",
               json={"email": email, "password": "Pass@1234", "name": "User A"},
               timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()
    assert "token" in body and "user" in body
    # Backend lowercases emails — assert case-insensitive equality
    assert body["user"]["email"] == email.lower()
    return body


@pytest.fixture(scope="module")
def user_b(s):
    """Register a fresh user B."""
    email = f"TEST_b_{uuid.uuid4().hex[:8]}@example.com"
    r = s.post(f"{API}/auth/register",
               json={"email": email, "password": "Pass@1234", "name": "User B"},
               timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


def auth_headers(bundle):
    return {"Authorization": f"Bearer {bundle['token']}",
            "Content-Type": "application/json"}


# ---------- /api/auth/register ----------
class TestRegister:
    def test_register_returns_token_and_user(self, user_a):
        assert isinstance(user_a["token"], str) and len(user_a["token"]) > 20
        assert user_a["user"]["user_id"].startswith("user_")
        assert user_a["user"]["auth_provider"] == "password"

    def test_register_duplicate_email_409(self, s, user_a):
        r = s.post(f"{API}/auth/register",
                   json={"email": user_a["user"]["email"], "password": "Pass@1234", "name": "Dupe"},
                   timeout=30)
        assert r.status_code == 409


# ---------- /api/auth/login ----------
class TestLogin:
    def test_login_demo_user(self, s):
        r = s.post(f"{API}/auth/login",
                   json={"email": "demo@example.com", "password": "Demo@1234"},
                   timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["user"]["email"] == "demo@example.com"
        assert body["user"]["user_id"] == "user_9724c5cf51a5"
        assert "token" in body

    def test_login_wrong_password_401(self, s):
        r = s.post(f"{API}/auth/login",
                   json={"email": "demo@example.com", "password": "wrongpw!"},
                   timeout=30)
        assert r.status_code == 401

    def test_login_unknown_email_401(self, s):
        r = s.post(f"{API}/auth/login",
                   json={"email": f"nobody_{uuid.uuid4().hex[:6]}@nope.io", "password": "Whatever1"},
                   timeout=30)
        assert r.status_code == 401


# ---------- /api/auth/me ----------
class TestMe:
    def test_me_without_auth_401(self, s):
        r = requests.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 401

    def test_me_with_bearer(self, user_a):
        r = requests.get(f"{API}/auth/me", headers=auth_headers(user_a), timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert body["user_id"] == user_a["user"]["user_id"]
        assert body["email"] == user_a["user"]["email"]


# ---------- Cross-user analytics isolation ----------
class TestAnalyticsHistoryIsolation:
    def test_history_anonymous_returns_empty_list(self):
        r = requests.get(f"{API}/analytics/history", timeout=20)
        assert r.status_code == 200
        assert r.json() == []

    def test_session_stamped_with_user_and_isolated(self, user_a, user_b):
        # Create a session AS user A
        payload = {
            "job_title": f"TEST_Iso_{uuid.uuid4().hex[:6]}",
            "experience_level": "Mid-level",
            "questions": {
                "technical_questions": ["What is HTTP?"],
                "scenario_questions": [],
                "hr_questions": [],
            },
        }
        r = requests.post(f"{API}/interview-session",
                          json=payload, headers=auth_headers(user_a), timeout=30)
        assert r.status_code == 200, r.text
        sid = r.json()["id"]

        # User A should see this session in history
        ra = requests.get(f"{API}/analytics/history",
                          headers=auth_headers(user_a), timeout=30)
        assert ra.status_code == 200
        a_ids = [d["id"] for d in ra.json()]
        assert sid in a_ids, f"Session {sid} missing from user A's history"
        # All user-A history docs must belong to user A
        for d in ra.json():
            assert d.get("user_id") == user_a["user"]["user_id"]

        # User B must NOT see user A's session
        rb = requests.get(f"{API}/analytics/history",
                          headers=auth_headers(user_b), timeout=30)
        assert rb.status_code == 200
        b_ids = [d["id"] for d in rb.json()]
        assert sid not in b_ids
        for d in rb.json():
            assert d.get("user_id") == user_b["user"]["user_id"]

    def test_anonymous_session_does_not_leak_to_logged_in_user(self, user_a):
        # Create a session WITHOUT auth → should have no user_id
        r = requests.post(f"{API}/interview-session",
                          json={
                              "job_title": f"TEST_Anon_{uuid.uuid4().hex[:6]}",
                              "experience_level": "Junior",
                              "questions": {"technical_questions": ["q?"],
                                            "scenario_questions": [],
                                            "hr_questions": []},
                          }, timeout=30)
        assert r.status_code == 200
        anon_sid = r.json()["id"]

        # user A's history must not contain this anonymous session
        ra = requests.get(f"{API}/analytics/history",
                          headers=auth_headers(user_a), timeout=30)
        assert ra.status_code == 200
        assert anon_sid not in [d["id"] for d in ra.json()]


# ---------- /api/jobs/recommend ----------
class TestJobsRecommend:
    def test_recommend_two_buckets_with_apply_links(self, s):
        payload = {
            "matching_skills": ["React", "TypeScript", "Node.js", "REST APIs"],
            "missing_skills": ["Kubernetes", "AWS", "System Design"],
            "job_title": "Full-Stack Engineer",
            "experience_level": "Mid-level",
            "location": "Bengaluru",
        }
        # LLM call can take 30-90s — treat 200 as success regardless of latency.
        r = s.post(f"{API}/jobs/recommend", json=payload, timeout=180)
        assert r.status_code == 200, r.text
        body = r.json()
        for bucket in ("current_match", "stretch"):
            assert bucket in body, f"Missing bucket: {bucket}"
            assert isinstance(body[bucket], list)
            assert len(body[bucket]) == 5, f"{bucket} expected 5 items, got {len(body[bucket])}"
            for item in body[bucket]:
                for key in ("role", "company", "location", "match_score", "apply_links"):
                    assert key in item, f"{bucket} item missing {key}: {item}"
                links = item["apply_links"]
                for src in ("naukri", "linkedin", "indeed", "unstop"):
                    assert src in links and links[src].startswith("http"), \
                        f"Bad {src} link in {bucket}: {links}"
                assert isinstance(item["match_score"], (int, float))
