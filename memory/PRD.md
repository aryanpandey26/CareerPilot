# AI Interview Engine — Product Requirements

## Original Problem Statement
Build an AI-powered mock interview platform with:
1. **ATS Resume Analyzer** (PDF + text) — score, matching/missing skills, suggestions.
2. **Dynamic Question Generator** — technical / scenario / HR questions tailored to resume gaps and role.
3. **Audio/Video Interview Room** — webcam, mic, cheating detection (tab-switch / focus loss with 2-strike rule), Whisper STT transcription.
4. **Answer Evaluator** — batch evaluation on final submit (per-question evaluation removed by user request).
5. **Performance Dashboard** — average score, trend, strong/weak areas, history.

## Tech Stack
- Frontend: React (CRA + craco) + TailwindCSS + Shadcn UI + framer-motion + react-webcam
- Backend: FastAPI + Motor (MongoDB) + emergentintegrations (LLM + Whisper)
- LLM: OpenAI GPT-5.2 via Emergent LLM Key
- STT: OpenAI Whisper-1 via Emergent LLM Key
- DB: MongoDB (NOT PostgreSQL — environment mandate)

## Implemented (Feb 2026 — current fork)
- [Feb 14] **Video upload + persistence** — `POST /api/upload-video`, `GET /api/interview-videos/{sid}`, static mount at `/api/videos`. Frontend auto-uploads each recorded clip on `mediaRecorder.onstop`.
- [Feb 14] **Deep LLM cheating analysis** — `POST /api/analyze-cheating-deep` + `GET /api/analyze-cheating-deep/{sid}`. Combines tab-switch events + audio transcripts + answer text; outputs risk score, multi-voice / gaze-drift / scripted-answer indicators, and recommendations. Shown on Results page.
- [Feb 14] **Legacy `/api/evaluate-answer` deprecated** — returns HTTP 410 Gone.
- [Feb 14] **Idempotency guard on batch evaluation** — re-submitting returns `cached=true` from DB without re-calling the LLM. `force=true` bypasses.
- [Feb 14] **Batch evaluation endpoint** `/api/evaluate-interview-batch` — primary evaluation path.
- [Feb 14] **Whisper STT endpoint** `/api/transcribe-audio` + "Record Answer" mic in the interview room.
- [Feb 14] **Cheating-analysis 422 bug fixed** (Pydantic JSON body).
- [Feb 14] **Dashboard & Results header** redesigned with purple/pink gradient theme.
- [Feb 14] Removed obsolete `/app/frontend/src/pages/InterviewRoom.jsx`.

## Previously implemented (prior forks)
- Landing page redesign with modern gradient theme.
- Resume Analyzer with ATS scoring, PDF + text upload, missing/matching skills, improvement suggestions.
- Interview setup, dynamic question generation.
- Video recording + 2-strike cheating detection (tab-switch / window blur).
- Navigation bar, error boundaries, craco overlay suppression.

## Key API Endpoints
- `POST /api/analyze-resume` (PDF) and `/api/analyze-resume-text` (text)
- `POST /api/generate-questions`
- `POST /api/interview-session` / `GET /api/interview-session/{id}`
- `POST /api/evaluate-interview-batch` ✅ (use this — primary)
- `POST /api/evaluate-answer` ⚠️ (legacy, frontend no longer calls)
- `POST /api/transcribe-audio` (Whisper)
- `POST /api/save-cheating-analysis` / `GET /api/cheating-analysis/{id}`
- `GET /api/analytics/performance` / `GET /api/analytics/history`

## Data Models (MongoDB)
- `interview_sessions` { id, job_title, experience_level, questions[], answers[], evaluated_at, has_cheating_concerns, cheating_warnings }
- `ats_analyses` { id, ats_score, matching_skills, missing_skills, partial_matches, improvement_suggestions, created_at }
- `cheating_analyses` { session_id, cheating_events[], total_warnings, video_count, timestamp, risk_level }
- `audio_transcripts` { id, session_id, question_index, transcript, timestamp }

## Roadmap / Backlog
- **P2** — Hash-based idempotency for batch eval (currently uses answer count; same count + different text returns cached).
- **P2** — Signed URLs / session-ownership check for `/api/videos/*` (currently public if you know sid+vid).
- **P2** — Run `analyze-cheating-deep` as a background task with polling, to avoid blocking the final-submit chain.
- **P3** — More forgiving JSON parser for LLM outputs (regex-extract first `{…}` block).
- **P3** — Split `server.py` (~895 lines) into routers: sessions / evaluation / proctoring / media.
- **P3** — Move `/app/backend/uploads/videos` to a persistent volume or object storage for production.

## Test Status
- Backend: 100% (8/8) — pytest at `/app/backend/tests/test_interview_engine.py`
- Frontend: 100% critical flows verified (analyze → setup → interview → batch submit → results)
- Latest report: `/app/test_reports/iteration_2.json`

## Critical Notes For Future Agents
- **Mongo only** — do not migrate to PostgreSQL.
- **Emergent LLM Key** — `EMERGENT_LLM_KEY` already in `/app/backend/.env`. All LLM/STT must go through `emergentintegrations`.
- **Error overlay suppression** — keep `craco.config.js` and `public/suppress-errors.js`.
- **Evaluation timing** — never re-introduce per-question evaluation; user explicitly requested batch on final submit.
