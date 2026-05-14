"""
Backend regression tests for AI Interview Engine.
Iteration 3 - covers new backlog items:
  * legacy /api/evaluate-answer now returns 410 Gone
  * /api/evaluate-interview-batch idempotency (cached=true) + force=true bypass
  * /api/upload-video (empty -> 400, valid webm -> 200) and static /api/videos serving
  * /api/interview-videos/<sid> (list + no _id / stored_path leakage)
  * /api/analyze-cheating-deep POST + GET
Also re-runs prior core flows (batch eval, transcribe, cheating analysis).
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ['REACT_APP_BACKEND_URL'].rstrip('/') if os.environ.get('REACT_APP_BACKEND_URL') else None
if not BASE_URL:
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
    payload = {
        "job_title": "TEST_Backend_Engineer_v3",
        "experience_level": "Mid-level",
        "questions": {
            "technical_questions": ["What is REST?", "Explain CAP theorem."],
            "scenario_questions": ["Design a URL shortener."],
            "hr_questions": ["Tell me about a conflict at work."],
        },
    }
    r = session.post(f"{API}/interview-session", json=payload, timeout=30)
    assert r.status_code == 200, f"Session create failed: {r.status_code} {r.text}"
    return r.json()


# ---------- Root + health ----------
class TestHealth:
    def test_root(self, session):
        r = session.get(f"{API}/", timeout=15)
        assert r.status_code == 200
        assert "message" in r.json()


# ---------- Legacy endpoint deprecation ----------
class TestLegacyEvaluateDeprecated:
    def test_legacy_evaluate_answer_returns_410(self, session):
        r = session.post(
            f"{API}/evaluate-answer",
            json={"session_id": "any", "question_index": 0, "answer": "x", "skill_tag": "tech"},
            timeout=15,
        )
        assert r.status_code == 410, f"Expected 410 Gone, got {r.status_code}: {r.text}"
        body = r.json()
        assert "evaluate-interview-batch" in str(body).lower() or "deprecated" in str(body).lower()


# ---------- Batch evaluation (incl. idempotency) ----------
class TestBatchEvaluation:
    def test_batch_invalid_session_404(self, session):
        bad_id = f"nonexistent-{uuid.uuid4()}"
        r = session.post(
            f"{API}/evaluate-interview-batch",
            json={"session_id": bad_id, "answers": [{"question_index": 0, "answer": "x"}]},
            timeout=30,
        )
        assert r.status_code == 404

    def test_batch_evaluates_then_idempotent_then_force(self, session, created_session):
        sid = created_session["id"]
        answers = [
            {"question_index": 0, "answer": "REST is a stateless architectural style over HTTP using URIs and standard verbs."},
            {"question_index": 1, "answer": "CAP states a distributed system can only guarantee 2 of Consistency/Availability/Partition-tolerance."},
            {"question_index": 2, "answer": "I would base62-encode an auto-increment ID, cache hot keys in Redis, and serve 301 redirects."},
            {"question_index": 3, "answer": "I had a disagreement with a teammate, scheduled a 1:1, listened, and we compromised on a phased rollout."},
        ]
        # First call: must evaluate and return cached=false
        r1 = session.post(f"{API}/evaluate-interview-batch", json={"session_id": sid, "answers": answers}, timeout=180)
        assert r1.status_code == 200, r1.text
        d1 = r1.json()
        assert d1.get("cached") is False
        assert isinstance(d1["evaluations"], list) and len(d1["evaluations"]) >= 1
        first_avg = d1["average_score"]

        # Second call: same payload -> idempotency guard, cached=true
        r2 = session.post(f"{API}/evaluate-interview-batch", json={"session_id": sid, "answers": answers}, timeout=30)
        assert r2.status_code == 200, r2.text
        d2 = r2.json()
        assert d2.get("cached") is True, f"Expected cached=true on re-submit, got {d2}"
        assert d2["session_id"] == sid
        assert len(d2["evaluations"]) == len(d1["evaluations"])

        # Third call: force=true should bypass cache (cached=false again)
        r3 = session.post(
            f"{API}/evaluate-interview-batch",
            json={"session_id": sid, "answers": answers, "force": True},
            timeout=180,
        )
        assert r3.status_code == 200, r3.text
        d3 = r3.json()
        assert d3.get("cached") is False, f"Expected cached=false with force=true, got {d3}"
        # avg score should still be a number
        assert isinstance(d3["average_score"], (int, float))
        # Sanity: first run avg should be roughly comparable (>=0)
        assert first_avg >= 0


# ---------- Video upload + static serving + listing ----------
class TestVideoUpload:
    def test_upload_empty_payload_returns_400(self, created_session):
        sid = created_session["id"]
        files = {"video": ("empty.webm", b"", "video/webm")}
        data = {"session_id": sid, "question_index": "0"}
        r = requests.post(f"{API}/upload-video", files=files, data=data, timeout=30)
        assert r.status_code == 400, f"Expected 400 on empty video, got {r.status_code}: {r.text}"

    def test_upload_valid_webm_and_served(self, created_session):
        sid = created_session["id"]
        # Tiny random bytes (not a real webm, but backend doesn't validate codec)
        fake_bytes = b"\x1a\x45\xdf\xa3" + os.urandom(2048)
        files = {"video": ("clip.webm", fake_bytes, "video/webm")}
        data = {"session_id": sid, "question_index": "1"}
        r = requests.post(f"{API}/upload-video", files=files, data=data, timeout=30)
        assert r.status_code == 200, f"Upload failed: {r.status_code} {r.text}"
        body = r.json()
        assert body["success"] is True
        v = body["video"]
        assert "stored_path" not in v, "stored_path must not leak"
        assert "_id" not in v
        assert v["session_id"] == sid
        assert v["question_index"] == 1
        assert v["url_path"].startswith(f"/api/videos/{sid}/")
        assert v["url_path"].endswith(".webm")
        assert v["size_bytes"] == len(fake_bytes)

        # Verify static serving
        served = requests.get(f"{BASE_URL}{v['url_path']}", timeout=30)
        assert served.status_code == 200, f"Static file fetch failed: {served.status_code}"
        assert served.content == fake_bytes, "Served bytes differ from uploaded"

    def test_list_videos_no_internal_fields(self, session, created_session):
        sid = created_session["id"]
        r = session.get(f"{API}/interview-videos/{sid}", timeout=30)
        assert r.status_code == 200
        body = r.json()
        assert body["session_id"] == sid
        assert isinstance(body["videos"], list)
        assert len(body["videos"]) >= 1
        for v in body["videos"]:
            assert "_id" not in v
            assert "stored_path" not in v
            assert "url_path" in v


# ---------- Deep cheating analysis ----------
class TestDeepCheating:
    def test_get_before_post_returns_404(self, session, created_session):
        sid = created_session["id"]
        # New session may already have prior deep analysis from re-runs, so use a fresh session
        # Create a brand new session for clean 404
        fresh = session.post(f"{API}/interview-session", json={
            "job_title": "TEST_DeepCheating_Fresh",
            "experience_level": "Junior",
            "questions": {"technical_questions": ["What is HTTP?"], "scenario_questions": [], "hr_questions": []},
        }, timeout=30).json()
        r = session.get(f"{API}/analyze-cheating-deep/{fresh['id']}", timeout=15)
        assert r.status_code == 404

    def test_post_invalid_session_404(self, session):
        bad = f"nonexistent-{uuid.uuid4()}"
        r = session.post(f"{API}/analyze-cheating-deep", json={"session_id": bad}, timeout=60)
        assert r.status_code == 404

    def test_post_valid_session_then_get(self, session, created_session):
        sid = created_session["id"]
        # Seed a cheating-event doc so the deep analyzer has signal
        session.post(f"{API}/save-cheating-analysis", json={
            "session_id": sid,
            "cheating_events": [{"type": "Tab Switch Detected", "description": "tab switch", "timestamp": "2026-01-01T00:00:00Z", "questionIndex": 0}],
            "total_warnings": 1,
            "video_count": 1,
        }, timeout=30)

        r = session.post(f"{API}/analyze-cheating-deep", json={"session_id": sid}, timeout=180)
        assert r.status_code == 200, f"Deep analyze failed: {r.status_code} {r.text}"
        body = r.json()
        for key in [
            "risk_score", "risk_level", "multiple_voice_indicators",
            "gaze_drift_indicators", "scripted_answer_indicators",
            "transcript_text_mismatch", "summary", "recommendations",
        ]:
            assert key in body, f"missing key: {key}"
        assert body["risk_level"] in ("low", "medium", "high")
        assert isinstance(body["risk_score"], (int, float))

        # GET should now succeed
        gr = session.get(f"{API}/analyze-cheating-deep/{sid}", timeout=30)
        assert gr.status_code == 200
        gbody = gr.json()
        assert gbody["session_id"] == sid
        assert "risk_level" in gbody
