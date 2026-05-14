"""
Backend regression tests for AI Interview Engine.
Covers: batch evaluation, transcribe-audio, save-cheating-analysis,
plus core session creation flow used by them.
"""
import os
import io
import uuid
import pytest
import requests

BASE_URL = os.environ['REACT_APP_BACKEND_URL'].rstrip('/') if os.environ.get('REACT_APP_BACKEND_URL') else None
if not BASE_URL:
    # Fall back to frontend .env file
    from pathlib import Path
    env = Path('/app/frontend/.env').read_text()
    for line in env.splitlines():
        if line.startswith('REACT_APP_BACKEND_URL='):
            BASE_URL = line.split('=', 1)[1].strip().rstrip('/')

API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def created_session(session):
    """Create a real interview session for downstream tests."""
    payload = {
        "job_title": "TEST_Backend_Engineer",
        "experience_level": "Mid-level",
        "questions": {
            "technical_questions": ["What is REST?", "Explain CAP theorem."],
            "scenario_questions": ["Design a URL shortener."],
            "hr_questions": ["Tell me about a conflict at work."],
        },
    }
    r = session.post(f"{API}/interview-session", json=payload, timeout=30)
    assert r.status_code == 200, f"Session create failed: {r.status_code} {r.text}"
    data = r.json()
    assert "id" in data
    assert len(data["questions"]) == 4
    return data


# ---------- Root + health ----------
class TestHealth:
    def test_root(self, session):
        r = session.get(f"{API}/", timeout=15)
        assert r.status_code == 200
        assert "message" in r.json()


# ---------- Batch evaluation ----------
class TestBatchEvaluation:
    def test_batch_invalid_session_returns_404(self, session):
        bad_id = f"nonexistent-{uuid.uuid4()}"
        r = session.post(
            f"{API}/evaluate-interview-batch",
            json={"session_id": bad_id, "answers": [{"question_index": 0, "answer": "x"}]},
            timeout=30,
        )
        assert r.status_code == 404, f"Expected 404, got {r.status_code}: {r.text}"

    def test_batch_valid_session_evaluates_and_persists(self, session, created_session):
        sid = created_session["id"]
        answers = [
            {"question_index": 0, "answer": "REST is an architectural style using stateless HTTP verbs (GET, POST, PUT, DELETE) on resources identified by URIs. It returns JSON typically and emphasizes cacheability."},
            {"question_index": 1, "answer": "CAP theorem says in a distributed system you can pick 2 of Consistency, Availability, Partition tolerance. Most modern systems are AP or CP."},
            {"question_index": 2, "answer": "I would use a base62 encoder over an auto-increment ID, cache hot keys in Redis, store mapping in a key-value store, and use 301 redirects."},
            {"question_index": 3, "answer": "I once disagreed with a teammate on architecture. I scheduled a 1:1, listened to their concerns, and we compromised on a phased rollout."},
        ]
        r = session.post(
            f"{API}/evaluate-interview-batch",
            json={"session_id": sid, "answers": answers},
            timeout=180,
        )
        assert r.status_code == 200, f"Batch eval failed: {r.status_code} {r.text}"
        data = r.json()
        assert data["session_id"] == sid
        assert isinstance(data["evaluations"], list)
        assert len(data["evaluations"]) >= 1
        assert isinstance(data["average_score"], (int, float))

        # Verify session persisted answers + evaluations
        gr = session.get(f"{API}/interview-session/{sid}", timeout=30)
        assert gr.status_code == 200
        s_data = gr.json()
        assert len(s_data.get("answers", [])) >= 1
        # Each persisted answer must have an evaluation dict
        for a in s_data["answers"]:
            assert "evaluation" in a
            assert "overall_score" in a["evaluation"]


# ---------- Audio transcription ----------
class TestTranscribeAudio:
    def test_transcribe_empty_payload_returns_400(self, session):
        # Send an empty multipart audio field; backend should reject with 400
        files = {"audio": ("empty.webm", b"", "audio/webm")}
        r = requests.post(f"{API}/transcribe-audio", files=files, timeout=30)
        assert r.status_code == 400, f"Expected 400 for empty audio, got {r.status_code}: {r.text}"

    def test_transcribe_missing_file_returns_422(self, session):
        # No file field at all -> FastAPI should 422
        r = requests.post(f"{API}/transcribe-audio", data={}, timeout=30)
        assert r.status_code in (400, 422), f"Got {r.status_code}: {r.text}"


# ---------- Cheating analysis ----------
class TestCheatingAnalysis:
    def test_save_cheating_success(self, session, created_session):
        sid = created_session["id"]
        payload = {
            "session_id": sid,
            "cheating_events": [
                {"type": "Tab Switch Detected", "description": "x", "timestamp": "2026-01-01T00:00:00Z", "questionIndex": 0}
            ],
            "total_warnings": 1,
            "video_count": 2,
        }
        r = session.post(f"{API}/save-cheating-analysis", json=payload, timeout=30)
        assert r.status_code == 200, f"Got {r.status_code}: {r.text}"
        data = r.json()
        assert data["success"] is True
        assert "analysis" in data
        assert "_id" not in data["analysis"], "MongoDB _id should be stripped"
        assert data["analysis"]["risk_level"] == "medium"

        # Verify via GET endpoint
        gr = session.get(f"{API}/cheating-analysis/{sid}", timeout=30)
        assert gr.status_code == 200
        gdata = gr.json()
        assert gdata["total_warnings"] == 1

    def test_save_cheating_invalid_body_422(self, session):
        # Missing required fields
        r = session.post(f"{API}/save-cheating-analysis", json={"session_id": "x"}, timeout=15)
        assert r.status_code == 422


# ---------- Analytics ----------
class TestAnalytics:
    def test_history_endpoint(self, session):
        r = session.get(f"{API}/analytics/history", timeout=30)
        assert r.status_code == 200
        assert isinstance(r.json(), list)
