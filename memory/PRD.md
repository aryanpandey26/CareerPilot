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
- [Feb 14] **Batch evaluation endpoint** `/api/evaluate-interview-batch` — replaces per-question `/api/evaluate-answer` calls. Eliminates recurring 404 cascade.
- [Feb 14] **Whisper STT endpoint** `/api/transcribe-audio` (multipart upload, webm/mp3/wav/m4a). Frontend mic button "Record Answer" appends transcript to answer textarea.
- [Feb 14] **Cheating-analysis endpoint fix** — `/api/save-cheating-analysis` now accepts Pydantic JSON body (was form-style, causing 422).
- [Feb 14] **Dashboard purple/pink gradient redesign** to match Landing / Resume Analyzer / Interview Room.
- [Feb 14] **Results page header** aligned with gradient theme.
- [Feb 14] Removed obsolete `/app/frontend/src/pages/InterviewRoom.jsx` (replaced by `InterviewRoomWithVideo.jsx`).

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
- **P2** — LLM-driven deeper cheating analysis (facial focus, multiple voices) beyond tab-switching.
- **P2** — Upload + store video blobs to backend (currently only kept client-side as object URLs).
- **P3** — Deprecate or remove legacy `/api/evaluate-answer` endpoint.
- **P3** — Add idempotency guard so re-submitting an interview does not wipe prior answers.
- **P3** — Use functional `setCheatingWarnings(prev => …)` to avoid stale-closure double-warns.

## Test Status
- Backend: 100% (8/8) — pytest at `/app/backend/tests/test_interview_engine.py`
- Frontend: 100% critical flows verified (analyze → setup → interview → batch submit → results)
- Latest report: `/app/test_reports/iteration_2.json`

## Critical Notes For Future Agents
- **Mongo only** — do not migrate to PostgreSQL.
- **Emergent LLM Key** — `EMERGENT_LLM_KEY` already in `/app/backend/.env`. All LLM/STT must go through `emergentintegrations`.
- **Error overlay suppression** — keep `craco.config.js` and `public/suppress-errors.js`.
- **Evaluation timing** — never re-introduce per-question evaluation; user explicitly requested batch on final submit.
