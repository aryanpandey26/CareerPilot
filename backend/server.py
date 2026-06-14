from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException, Form, Request, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import PyPDF2
import io
try:
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    from emergentintegrations.llm.openai import OpenAISpeechToText
except ImportError as e:
    EMERGENT_IMPORT_ERROR = str(e)
    LlmChat = None
    UserMessage = None
    OpenAISpeechToText = None
else:
    EMERGENT_IMPORT_ERROR = None
import json
import base64
import httpx
from auth import router as auth_router, set_db as set_auth_db, get_current_user

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# LLM Configuration
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY')
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')
LLM_API_KEY = OPENAI_API_KEY or EMERGENT_LLM_KEY
LLM_MODEL = os.environ.get('OPENAI_MODEL', 'gpt-4o-mini')

# Pydantic Models
class ATSAnalysisResult(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    ats_score: float
    matching_skills: List[str]
    missing_skills: List[str]
    partial_matches: List[str]
    improvement_suggestions: List[str]
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class QuestionSet(BaseModel):
    model_config = ConfigDict(extra="ignore")
    technical_questions: List[str]
    scenario_questions: List[str]
    hr_questions: List[str]

class QuestionGenerationRequest(BaseModel):
    extracted_skills: List[str]
    missing_skills: List[str]
    job_title: str
    experience_level: str

class EvaluationResult(BaseModel):
    model_config = ConfigDict(extra="ignore")
    technical_accuracy: float
    depth: float
    clarity: float
    confidence: float
    overall_score: float
    strengths: List[str]
    weaknesses: List[str]
    model_answer: str
    improvement_suggestions: List[str]

class InterviewSessionRequest(BaseModel):
    job_title: str
    experience_level: str
    questions: QuestionSet

class InterviewSession(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    job_title: str
    experience_level: str
    questions: List[Dict[str, Any]]
    answers: List[Dict[str, Any]] = []
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class AnswerSubmission(BaseModel):
    session_id: str
    question_index: int
    answer: str
    skill_tag: str

class PerformanceAnalytics(BaseModel):
    model_config = ConfigDict(extra="ignore")
    average_score: float
    strong_areas: List[str]
    weak_areas: List[str]
    improvement_trend: str
    recommended_focus_topics: List[str]

class TTSRequest(BaseModel):
    text: str

class STTRequest(BaseModel):
    audio_base64: str

class HistoryByIdsRequest(BaseModel):
    session_ids: List[str]

# Helper Functions
def build_fallback_questions(request: QuestionGenerationRequest) -> QuestionSet:
    """Create usable interview questions when the AI provider is unavailable."""
    skills = [skill for skill in (request.extracted_skills + request.missing_skills) if skill]
    primary_skill = skills[0] if skills else request.job_title
    secondary_skill = skills[1] if len(skills) > 1 else primary_skill

    return QuestionSet(
        technical_questions=[
            f"What core skills are required for a {request.job_title}, and how have you used {primary_skill} in practice?",
            f"Explain a project where you solved a technical problem related to {secondary_skill}.",
            f"How would you debug a production issue in a {request.job_title} role?",
            f"What trade-offs would you consider when designing a scalable solution for this role?",
            f"Describe how you would learn and apply a missing skill quickly in a real project.",
        ],
        scenario_questions=[
            "You are assigned a task with unclear requirements and a tight deadline. How would you proceed?",
            "A feature you shipped causes an unexpected issue for users. What steps would you take?",
        ],
        hr_questions=[
            "Tell me about yourself and why you are interested in this role.",
            "Describe a time you received feedback and how you acted on it.",
        ],
    )


def build_fallback_evaluations(qa_pairs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Create basic persisted evaluations when the AI evaluator is unavailable."""
    evaluations = []
    for item in qa_pairs:
        answer = (item.get("answer") or "").strip()
        word_count = len(answer.split())
        if word_count >= 80:
            score = 72
        elif word_count >= 35:
            score = 62
        elif word_count >= 12:
            score = 48
        else:
            score = 30

        evaluations.append({
            "question_index": item["question_index"],
            "technical_accuracy": max(1, min(10, round(score / 10))),
            "depth": max(1, min(10, round((score - 5) / 10))),
            "clarity": max(1, min(10, round((score + 5) / 10))),
            "confidence": max(1, min(10, round(score / 10))),
            "overall_score": score,
            "strengths": ["Answer submitted successfully."],
            "weaknesses": ["AI evaluation was unavailable, so this is a basic completion score."],
            "model_answer": "AI model answer unavailable for this attempt.",
            "improvement_suggestions": [
                "Add more concrete examples, implementation details, and trade-offs.",
                "Structure the answer with situation, approach, result, and lessons learned.",
            ],
        })
    return evaluations


def build_basic_performance_analytics(sessions: List[Dict[str, Any]]) -> PerformanceAnalytics:
    """Compute dashboard analytics without requiring an AI provider."""
    scores = []
    strengths = []
    weaknesses = []
    focus_topics = []

    for session in sessions:
        for answer in session.get("answers", []):
            evaluation = answer.get("evaluation") or {}
            score = evaluation.get("overall_score")
            if isinstance(score, (int, float)):
                scores.append(float(score))
            strengths.extend(evaluation.get("strengths") or [])
            weaknesses.extend(evaluation.get("weaknesses") or [])
            focus_topics.extend(evaluation.get("improvement_suggestions") or [])

    if not scores:
        return PerformanceAnalytics(
            average_score=0,
            strong_areas=[],
            weak_areas=[],
            improvement_trend="No data",
            recommended_focus_topics=[],
        )

    trend = "Stable"
    if len(scores) >= 2:
        trend = "Improving" if scores[-1] > scores[0] else "Declining" if scores[-1] < scores[0] else "Stable"

    return PerformanceAnalytics(
        average_score=round(sum(scores) / len(scores), 2),
        strong_areas=list(dict.fromkeys(strengths))[:5],
        weak_areas=list(dict.fromkeys(weaknesses))[:5],
        improvement_trend=trend,
        recommended_focus_topics=list(dict.fromkeys(focus_topics))[:5],
    )


def extract_text_from_pdf(file_content: bytes) -> str:
    """Extract text from PDF file"""
    try:
        pdf_reader = PyPDF2.PdfReader(io.BytesIO(file_content))
        text = ""
        for page in pdf_reader.pages:
            text += page.extract_text()
        return text
    except Exception as e:
        logging.error(f"Error extracting PDF text: {e}")
        raise HTTPException(status_code=400, detail="Failed to parse PDF file")

async def call_llm(prompt: str, system_message: str = "You are a professional AI assistant.") -> str:
    """Call LLM with given prompt"""
    if not LLM_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="AI features are not configured. Set OPENAI_API_KEY or EMERGENT_LLM_KEY in Vercel."
        )

    if EMERGENT_LLM_KEY and not OPENAI_API_KEY:
        if LlmChat is None or UserMessage is None:
            raise HTTPException(
                status_code=503,
                detail=f"Emergent LLM integration failed to load: {EMERGENT_IMPORT_ERROR}"
            )

        try:
            chat = LlmChat(
                api_key=EMERGENT_LLM_KEY,
                session_id=str(uuid.uuid4()),
                system_message=system_message,
            ).with_model("openai", LLM_MODEL)
            response = await chat.send_message(UserMessage(text=prompt))
            return (
                response
                if isinstance(response, str)
                else getattr(response, "content", None)
                or getattr(response, "text", None)
                or str(response)
            )
        except HTTPException:
            raise
        except Exception as e:
            logging.error(f"Emergent LLM error: {e}")
            raise HTTPException(status_code=502, detail=f"Emergent LLM request failed: {str(e)}")

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {OPENAI_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": LLM_MODEL,
                    "messages": [
                        {"role": "system", "content": system_message},
                        {"role": "user", "content": prompt},
                    ],
                },
            )
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"]
    except httpx.HTTPStatusError as e:
        logging.error(f"OpenAI API error: {e.response.text}")
        raise HTTPException(status_code=502, detail="AI provider request failed")
    except Exception as e:
        logging.error(f"Error calling LLM: {e}")
        raise HTTPException(status_code=500, detail=f"LLM call failed: {str(e)}")

# API Routes
@app.get("/")
async def app_root():
    return {"message": "CareerPilot API"}

@api_router.get("/")
async def root():
    return {"message": "CareerPilot API"}

@api_router.get("/health/db")
async def database_health():
    try:
        await client.admin.command("ping")
        return {"database": "connected", "db_name": os.environ.get("DB_NAME")}
    except Exception as e:
        logging.error(f"Database health check failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Database connection failed: {type(e).__name__}"
        )

class ResumeAnalysisRequest(BaseModel):
    resume_text: str
    job_description: str

@api_router.post("/analyze-resume", response_model=ATSAnalysisResult)
async def analyze_resume(
    resume: UploadFile = File(...),
    job_description: str = Form(...)
):
    """Analyze resume against job description (PDF upload)"""
    try:
        # Extract text from resume
        resume_content = await resume.read()
        resume_text = extract_text_from_pdf(resume_content)
        
        # Create prompt for ATS analysis
        prompt = f"""Analyze the resume against the job description.

Resume Text:
{resume_text}

Job Description:
{job_description}

Tasks:
1. Extract technical skills from resume
2. Extract required skills from JD
3. Calculate ATS Match Score (0-100%)
4. Identify missing keywords, matching skills, and partially matching skills
5. Suggest resume improvements

Return output strictly in JSON format with arrays of STRINGS only:
{{
  "ats_score": 75,
  "matching_skills": ["Python", "JavaScript", "React"],
  "missing_skills": ["Docker", "Kubernetes"],
  "partial_matches": ["Frontend Development", "APIs"],
  "improvement_suggestions": ["Add more quantifiable achievements", "Include specific technologies used"]
}}

IMPORTANT: All arrays must contain simple strings, not objects. For partial_matches, just list the skill names as strings.

Scoring Logic:
- Exact skill match = high weight
- Related technology = medium weight
- No match = zero
- Soft skills count lower than technical skills"""
        
        system_message = "You are an expert ATS Resume Analyzer. You must be professional, unbiased, and return structured JSON output only."
        response = await call_llm(prompt, system_message)
        
        # Parse JSON response
        try:
            # Remove markdown code blocks if present
            response_clean = response.strip()
            if response_clean.startswith("```"):
                response_clean = response_clean.split("```")[1]
                if response_clean.startswith("json"):
                    response_clean = response_clean[4:]
            response_clean = response_clean.strip()
            
            result_data = json.loads(response_clean)
            analysis = ATSAnalysisResult(**result_data)
            
            # Store in database
            doc = analysis.model_dump()
            await db.ats_analyses.insert_one(doc)
            
            return analysis
        except json.JSONDecodeError as e:
            logging.error(f"Failed to parse LLM response: {response}")
            raise HTTPException(status_code=500, detail="Failed to parse analysis results")

    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error in analyze_resume: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/analyze-resume-text", response_model=ATSAnalysisResult)
async def analyze_resume_text(request: ResumeAnalysisRequest, user_request: Request):
    """Analyze resume against job description (text-based)"""
    try:
        # Optional user binding (analyses are still allowed for anonymous users)
        current_user_id = None
        try:
            user = await get_current_user(user_request)
            current_user_id = user["user_id"]
        except HTTPException:
            current_user_id = None
        except Exception as e:
            logging.warning(f"Could not resolve current user for interview session: {e}")
            current_user_id = None

        resume_text = request.resume_text
        job_description = request.job_description
        
        # Create prompt for ATS analysis
        prompt = f"""Analyze the resume against the job description.

Resume Text:
{resume_text}

Job Description:
{job_description}

Tasks:
1. Extract technical skills from resume
2. Extract required skills from JD
3. Calculate ATS Match Score (0-100%)
4. Identify missing keywords, matching skills, and partially matching skills
5. Suggest resume improvements

Return output strictly in JSON format with arrays of STRINGS only:
{{
  "ats_score": 75,
  "matching_skills": ["Python", "JavaScript", "React"],
  "missing_skills": ["Docker", "Kubernetes"],
  "partial_matches": ["Frontend Development", "APIs"],
  "improvement_suggestions": ["Add more quantifiable achievements", "Include specific technologies used"]
}}

IMPORTANT: All arrays must contain simple strings, not objects. For partial_matches, just list the skill names as strings.

Scoring Logic:
- Exact skill match = high weight
- Related technology = medium weight
- No match = zero
- Soft skills count lower than technical skills"""
        
        system_message = "You are an expert ATS Resume Analyzer. You must be professional, unbiased, and return structured JSON output only."
        response = await call_llm(prompt, system_message)
        
        # Parse JSON response
        try:
            # Remove markdown code blocks if present
            response_clean = response.strip()
            if response_clean.startswith("```"):
                response_clean = response_clean.split("```")[1]
                if response_clean.startswith("json"):
                    response_clean = response_clean[4:]
            response_clean = response_clean.strip()
            
            result_data = json.loads(response_clean)
            analysis = ATSAnalysisResult(**result_data)
            
            # Store in database (with user binding when available)
            doc = analysis.model_dump()
            if current_user_id:
                doc["user_id"] = current_user_id
            await db.ats_analyses.insert_one(doc)
            doc.pop("_id", None)
            
            return analysis
        except json.JSONDecodeError as e:
            logging.error(f"Failed to parse LLM response: {response}")
            raise HTTPException(status_code=500, detail="Failed to parse analysis results")

    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error in analyze_resume_text: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class QuestionGenerationRequest(BaseModel):
    extracted_skills: List[str]
    missing_skills: List[str]
    job_title: str
    experience_level: str

@api_router.post("/generate-questions", response_model=QuestionSet)
async def generate_questions(request: QuestionGenerationRequest):
    """Generate dynamic interview questions"""
    try:
        prompt = f"""Generate interview questions tailored to:

User's existing skills: {', '.join(request.extracted_skills)}
Missing skills from JD: {', '.join(request.missing_skills)}
Job Role: {request.job_title}
Experience Level: {request.experience_level}

Generate:
- 5 Technical Questions
- 2 Scenario-Based Questions  
- 2 HR/Behavioral Questions

Return in JSON:
{{
  "technical_questions": [],
  "scenario_questions": [],
  "hr_questions": []
}}

Rules:
- Questions must progressively increase in difficulty
- Include at least one deep technical conceptual question
- Include one real-world problem-solving question"""
        
        system_message = "You are an expert technical interviewer. Generate challenging, relevant interview questions."
        try:
            response = await call_llm(prompt, system_message)

            # Parse JSON response
            response_clean = response.strip()
            if response_clean.startswith("```"):
                response_clean = response_clean.split("```")[1]
                if response_clean.startswith("json"):
                    response_clean = response_clean[4:]
            response_clean = response_clean.strip()

            result_data = json.loads(response_clean)
            return QuestionSet(**result_data)
        except Exception as e:
            logging.error(f"Question generation AI fallback triggered: {e}")
            return build_fallback_questions(request)

    except Exception as e:
        logging.error(f"Error generating questions: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/evaluate-answer", deprecated=True)
async def evaluate_answer(submission: AnswerSubmission):
    """DEPRECATED: Use /api/evaluate-interview-batch instead.
    
    Per-question evaluation is no longer supported. All answers must be
    submitted in a single batch at the end of the interview.
    """
    raise HTTPException(
        status_code=410,
        detail="Endpoint deprecated. Use POST /api/evaluate-interview-batch to evaluate all answers at the end of the interview."
    )

@api_router.post("/interview-session", response_model=InterviewSession)
async def create_interview_session(request: InterviewSessionRequest, user_request: Request):
    """Create a new interview session, tagged with current user if authenticated."""
    try:
        current_user_id = None
        try:
            user = await get_current_user(user_request)
            current_user_id = user["user_id"]
        except HTTPException:
            current_user_id = None

        # Format questions
        all_questions = []
        for q in request.questions.technical_questions:
            all_questions.append({"type": "technical", "text": q})
        for q in request.questions.scenario_questions:
            all_questions.append({"type": "scenario", "text": q})
        for q in request.questions.hr_questions:
            all_questions.append({"type": "hr", "text": q})
        
        session = InterviewSession(
            job_title=request.job_title,
            experience_level=request.experience_level,
            questions=all_questions
        )
        
        # Store in database (with user binding when available)
        doc = session.model_dump()
        if current_user_id:
            doc["user_id"] = current_user_id
        await db.interview_sessions.insert_one(doc)
        
        return session
        
    except Exception as e:
        logging.error(f"Error creating session: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/interview-session/{session_id}", response_model=InterviewSession)
async def get_interview_session(session_id: str):
    """Get interview session by ID"""
    session = await db.interview_sessions.find_one({"id": session_id}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return InterviewSession(**session)

@api_router.get("/analytics/performance", response_model=PerformanceAnalytics)
async def get_performance_analytics():
    """Get performance analytics across all interviews"""
    try:
        # Get all sessions with answers
        sessions = await db.interview_sessions.find(
            {"answers": {"$exists": True, "$ne": []}},
            {"_id": 0}
        ).to_list(100)
        
        if not sessions:
            return PerformanceAnalytics(
                average_score=0,
                strong_areas=[],
                weak_areas=[],
                improvement_trend="No data",
                recommended_focus_topics=[]
            )

        return build_basic_performance_analytics(sessions)

    except Exception as e:
        logging.error(f"Error getting analytics: {e}")
        return PerformanceAnalytics(
            average_score=0,
            strong_areas=[],
            weak_areas=[],
            improvement_trend="No data",
            recommended_focus_topics=[],
        )

@api_router.get("/analytics/history")
async def get_interview_history(user_request: Request):
    """Get interview sessions — filtered by current user if authenticated."""
    query = {}
    try:
        user = await get_current_user(user_request)
        query["user_id"] = user["user_id"]
    except HTTPException:
        query = {"answers": {"$exists": True, "$ne": []}}
    sessions = await db.interview_sessions.find(query, {"_id": 0}).to_list(200)
    return sessions

@api_router.post("/analytics/history/by-ids")
async def get_interview_history_by_ids(request: HistoryByIdsRequest):
    """Get browser-owned interview sessions by explicit session id list."""
    session_ids = list(dict.fromkeys([sid for sid in request.session_ids if sid]))[:100]
    if not session_ids:
        return []
    sessions = await db.interview_sessions.find(
        {"id": {"$in": session_ids}},
        {"_id": 0}
    ).to_list(100)
    order = {sid: idx for idx, sid in enumerate(session_ids)}
    return sorted(sessions, key=lambda item: order.get(item.get("id"), len(order)))

class CheatingAnalysisRequest(BaseModel):
    session_id: str
    cheating_events: List[Dict[str, Any]]
    total_warnings: int
    video_count: int

@api_router.post("/save-cheating-analysis")
async def save_cheating_analysis(payload: CheatingAnalysisRequest):
    """Save cheating detection analysis"""
    try:
        analysis = {
            "session_id": payload.session_id,
            "cheating_events": payload.cheating_events,
            "total_warnings": payload.total_warnings,
            "video_count": payload.video_count,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "risk_level": "high" if payload.total_warnings >= 2 else "medium" if payload.total_warnings == 1 else "low"
        }
        
        await db.cheating_analyses.insert_one(analysis)
        # Strip Mongo _id before returning
        analysis.pop("_id", None)
        
        # Update session with cheating flag
        await db.interview_sessions.update_one(
            {"id": payload.session_id},
            {"$set": {"has_cheating_concerns": payload.total_warnings > 0, "cheating_warnings": payload.total_warnings}}
        )
        
        return {"success": True, "analysis": analysis}
    except Exception as e:
        logging.error(f"Error saving cheating analysis: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/cheating-analysis/{session_id}")
async def get_cheating_analysis(session_id: str):
    """Get cheating analysis for a session"""
    analysis = await db.cheating_analyses.find_one({"session_id": session_id}, {"_id": 0})
    if not analysis:
        return {"session_id": session_id, "cheating_events": [], "total_warnings": 0, "risk_level": "low"}
    return analysis

class BatchAnswerItem(BaseModel):
    question_index: int
    answer: str

class BatchEvaluationRequest(BaseModel):
    session_id: str
    answers: List[BatchAnswerItem]
    force: bool = False  # bypass idempotency guard if True

class BatchEvaluationResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    session_id: str
    evaluations: List[Dict[str, Any]]
    average_score: float
    cached: bool = False

@api_router.post("/evaluate-interview-batch", response_model=BatchEvaluationResponse)
async def evaluate_interview_batch(request: BatchEvaluationRequest):
    """Evaluate ALL interview answers at once on final submit.
    
    Idempotency: if the session has already been evaluated (`evaluated_at` set)
    and the same number of answers were stored, return cached evaluations.
    Pass `force=True` to re-evaluate.
    """
    try:
        session = await db.interview_sessions.find_one({"id": request.session_id}, {"_id": 0})
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        # Idempotency guard
        if (not request.force
                and session.get("evaluated_at")
                and session.get("answers")
                and len(session["answers"]) == len(request.answers)):
            cached_evals = [a.get("evaluation", {}) for a in session["answers"]]
            scores = [float(e.get("overall_score", 0)) for e in cached_evals
                      if isinstance(e.get("overall_score"), (int, float))]
            return BatchEvaluationResponse(
                session_id=request.session_id,
                evaluations=cached_evals,
                average_score=round(sum(scores) / len(scores), 2) if scores else 0.0,
                cached=True,
            )

        # Build a single batched prompt: model returns evaluations as JSON array
        qa_pairs = []
        for item in request.answers:
            if item.question_index >= len(session["questions"]):
                continue
            q = session["questions"][item.question_index]
            qa_pairs.append({
                "question_index": item.question_index,
                "question": q["text"],
                "skill_tag": q.get("type", "general"),
                "answer": item.answer,
            })

        prompt = f"""Evaluate the following interview answers. Return a STRICT JSON array (no markdown).

Each evaluation must contain:
- question_index (int, matches input)
- technical_accuracy (0-10)
- depth (0-10)
- clarity (0-10)
- confidence (0-10)
- overall_score (0-100, weighted: 40% technical, 25% depth, 20% clarity, 15% confidence)
- strengths (array of strings)
- weaknesses (array of strings)
- model_answer (string)
- improvement_suggestions (array of strings)

Input answers:
{json.dumps(qa_pairs, indent=2)}

Return ONLY a JSON array like: [{{"question_index": 0, ...}}, ...]"""

        system_message = "You are a professional technical interviewer. Evaluate each answer objectively, returning a structured JSON array."
        try:
            response = await call_llm(prompt, system_message)

            # Parse JSON response
            response_clean = response.strip()
            if response_clean.startswith("```"):
                response_clean = response_clean.split("```")[1]
                if response_clean.startswith("json"):
                    response_clean = response_clean[4:]
            response_clean = response_clean.strip()

            evaluations_list = json.loads(response_clean)
            if not isinstance(evaluations_list, list):
                raise ValueError("LLM did not return a JSON array")
        except Exception as e:
            logging.error(f"Batch evaluation AI fallback triggered: {e}")
            evaluations_list = build_fallback_evaluations(qa_pairs)

        # Save each answer + evaluation back into the session
        answers_to_persist = []
        scores = []
        for idx, ev in enumerate(evaluations_list):
            q_idx = ev.get("question_index", idx)
            input_item = next((p for p in qa_pairs if p["question_index"] == q_idx), None)
            if input_item is None:
                continue
            answers_to_persist.append({
                "question_index": q_idx,
                "answer": input_item["answer"],
                "evaluation": ev,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })
            if isinstance(ev.get("overall_score"), (int, float)):
                scores.append(float(ev["overall_score"]))

        # Replace any existing answers for these question indices
        await db.interview_sessions.update_one(
            {"id": request.session_id},
            {"$set": {"answers": answers_to_persist,
                      "evaluated_at": datetime.now(timezone.utc).isoformat()}}
        )

        avg = sum(scores) / len(scores) if scores else 0.0
        return BatchEvaluationResponse(
            session_id=request.session_id,
            evaluations=evaluations_list,
            average_score=round(avg, 2),
        )

    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error in batch evaluation: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ---------- Audio Transcription (Whisper STT) ----------
@api_router.post("/transcribe-audio")
async def transcribe_audio(
    audio: UploadFile = File(...),
    session_id: Optional[str] = Form(None),
    question_index: Optional[int] = Form(None),
):
    """Transcribe an uploaded audio blob using OpenAI Whisper."""
    try:
        if not LLM_API_KEY:
            raise HTTPException(status_code=500, detail="OPENAI_API_KEY or EMERGENT_LLM_KEY missing on server")

        content = await audio.read()
        if not content:
            raise HTTPException(status_code=400, detail="Empty audio payload")

        # Persist temp file (whisper requires a file-like with name extension)
        ext = ".webm"
        filename = audio.filename or "audio.webm"
        if "." in filename:
            ext = "." + filename.rsplit(".", 1)[-1].lower()
            if ext not in {".mp3", ".mp4", ".mpeg", ".mpga", ".m4a", ".wav", ".webm"}:
                ext = ".webm"

        tmp_path = Path(f"/tmp/{uuid.uuid4().hex}{ext}")
        tmp_path.write_bytes(content)

        # Use try/finally to ensure cleanup
        try:
            if OPENAI_API_KEY:
                async with httpx.AsyncClient(timeout=60) as client:
                    with open(tmp_path, "rb") as audio_file:
                        response = await client.post(
                            "https://api.openai.com/v1/audio/transcriptions",
                            headers={"Authorization": f"Bearer {OPENAI_API_KEY}"},
                            files={"file": (tmp_path.name, audio_file, audio.content_type or "audio/webm")},
                            data={"model": "whisper-1", "response_format": "json", "language": "en"},
                        )
                response.raise_for_status()
                transcript = response.json().get("text", "")
            else:
                if OpenAISpeechToText is None:
                    raise HTTPException(
                        status_code=503,
                        detail=f"Speech-to-text integration failed to load: {EMERGENT_IMPORT_ERROR}"
                    )
                stt = OpenAISpeechToText(api_key=LLM_API_KEY)
                with open(tmp_path, "rb") as audio_file:
                    response = await stt.transcribe(
                        file=audio_file,
                        model="whisper-1",
                        response_format="json",
                        language="en",
                    )
                transcript = getattr(response, "text", None) or str(response)
        finally:
            try:
                tmp_path.unlink(missing_ok=True)
            except Exception:
                pass

        # Optionally store transcript on the session
        if session_id and question_index is not None:
            await db.audio_transcripts.insert_one({
                "id": str(uuid.uuid4()),
                "session_id": session_id,
                "question_index": question_index,
                "transcript": transcript,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })

        return {"transcript": transcript, "success": True}

    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error transcribing audio: {e}")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")


# ---------- Video Upload & Persistence ----------
VIDEO_UPLOAD_DIR = Path(os.environ.get("VIDEO_UPLOAD_DIR", "/tmp/careerpilot/videos"))
VIDEO_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
MAX_VIDEO_MB = 50

@api_router.post("/upload-video")
async def upload_video(
    video: UploadFile = File(...),
    session_id: str = Form(...),
    question_index: int = Form(...),
):
    """Persist an interview video clip to disk and record metadata in MongoDB."""
    try:
        content = await video.read()
        size_mb = len(content) / (1024 * 1024)
        if not content:
            raise HTTPException(status_code=400, detail="Empty video payload")
        if size_mb > MAX_VIDEO_MB:
            raise HTTPException(status_code=413, detail=f"Video exceeds {MAX_VIDEO_MB}MB limit")

        # Sanitize extension
        ext = ".webm"
        if video.filename and "." in video.filename:
            cand = "." + video.filename.rsplit(".", 1)[-1].lower()
            if cand in {".webm", ".mp4", ".mov", ".mkv"}:
                ext = cand

        video_id = str(uuid.uuid4())
        rel_path = f"{session_id}/{video_id}{ext}"
        abs_path = VIDEO_UPLOAD_DIR / rel_path
        abs_path.parent.mkdir(parents=True, exist_ok=True)
        abs_path.write_bytes(content)

        meta = {
            "id": video_id,
            "session_id": session_id,
            "question_index": question_index,
            "filename": video.filename,
            "stored_path": str(abs_path),
            "url_path": f"/api/videos/{session_id}/{video_id}{ext}",
            "size_bytes": len(content),
            "content_type": video.content_type or "video/webm",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        await db.interview_videos.insert_one(meta)
        meta.pop("_id", None)
        meta.pop("stored_path", None)  # do not leak server path
        return {"success": True, "video": meta}

    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error uploading video: {e}")
        raise HTTPException(status_code=500, detail=f"Video upload failed: {str(e)}")


@api_router.get("/interview-videos/{session_id}")
async def list_session_videos(session_id: str):
    """List all video metadata for a session."""
    items = await db.interview_videos.find(
        {"session_id": session_id}, {"_id": 0, "stored_path": 0}
    ).sort("question_index", 1).to_list(200)
    return {"session_id": session_id, "videos": items}


# ---------- Deep LLM-based Cheating Analysis ----------
class DeepCheatingRequest(BaseModel):
    session_id: str

@api_router.post("/analyze-cheating-deep")
async def analyze_cheating_deep(req: DeepCheatingRequest):
    """Run an LLM-driven deep cheating analysis combining:
    - Tab-switch / focus-loss events
    - Audio transcript characteristics (multiple voices, scripted answers)
    - Answer timing patterns (proxy for gaze/attention drift)
    """
    try:
        session = await db.interview_sessions.find_one({"id": req.session_id}, {"_id": 0})
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        cheating_doc = await db.cheating_analyses.find_one(
            {"session_id": req.session_id}, {"_id": 0}
        ) or {}

        transcripts = await db.audio_transcripts.find(
            {"session_id": req.session_id}, {"_id": 0}
        ).sort("question_index", 1).to_list(100)

        videos = await db.interview_videos.find(
            {"session_id": req.session_id}, {"_id": 0, "stored_path": 0}
        ).to_list(100)

        prompt = f"""You are a proctoring AI. Analyze this interview for cheating signals.

Tab-switch / focus events (gaze-drift proxy):
{json.dumps(cheating_doc.get("cheating_events", []), indent=2)}
Total warnings: {cheating_doc.get("total_warnings", 0)}

Audio transcripts per question (look for multi-voice indicators, scripted reading, abrupt topic shifts):
{json.dumps(transcripts[:20], indent=2)}

Submitted text answers (compare with transcripts for inconsistencies):
{json.dumps([{"q": a.get("question_index"), "a": a.get("answer", "")[:500]} for a in session.get("answers", [])], indent=2)}

Recorded video clip count: {len(videos)}

Return STRICT JSON (no markdown):
{{
  "risk_score": 0-100,
  "risk_level": "low" | "medium" | "high",
  "multiple_voice_indicators": [string, ...],
  "gaze_drift_indicators": [string, ...],
  "scripted_answer_indicators": [string, ...],
  "transcript_text_mismatch": [string, ...],
  "summary": "1-2 sentence verdict",
  "recommendations": [string, ...]
}}

Scoring rubric:
- 0-25 low: minor or no concerns
- 26-60 medium: at least 1 strong signal (e.g., 2 tab switches OR scripted tone)
- 61-100 high: multiple converging signals OR transcript clearly indicates external help"""

        system = "You are a strict but fair proctoring analyst. Return JSON only."
        response = await call_llm(prompt, system)

        clean = response.strip()
        if clean.startswith("```"):
            clean = clean.split("```")[1]
            if clean.startswith("json"):
                clean = clean[4:]
        clean = clean.strip()
        result = json.loads(clean)
        result["session_id"] = req.session_id
        result["generated_at"] = datetime.now(timezone.utc).isoformat()

        # Persist (overwrite per session)
        await db.deep_cheating_analyses.update_one(
            {"session_id": req.session_id},
            {"$set": result},
            upsert=True,
        )
        # Update flag on session
        await db.interview_sessions.update_one(
            {"id": req.session_id},
            {"$set": {"deep_risk_level": result.get("risk_level", "low"),
                      "deep_risk_score": result.get("risk_score", 0)}}
        )
        return result

    except HTTPException:
        raise
    except json.JSONDecodeError as e:
        logging.error(f"Deep cheating JSON parse error: {e}")
        raise HTTPException(status_code=500, detail="Could not parse cheating analysis output")
    except Exception as e:
        logging.error(f"Deep cheating analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/analyze-cheating-deep/{session_id}")
async def get_deep_cheating(session_id: str):
    """Retrieve the latest deep cheating analysis for a session."""
    doc = await db.deep_cheating_analyses.find_one({"session_id": session_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="No deep analysis available for this session")
    return doc


# ---------- Job Recommendations ----------
class JobRecommendationRequest(BaseModel):
    matching_skills: List[str] = []
    missing_skills: List[str] = []
    job_title: str = ""
    experience_level: str = ""
    location: str = "India"


def _build_search_url(query: str, location: str, source: str) -> str:
    import urllib.parse
    q = urllib.parse.quote_plus(query)
    loc = urllib.parse.quote_plus(location or "India")
    if source == "naukri":
        return f"https://www.naukri.com/{q.replace('+', '-')}-jobs-in-{loc.replace('+', '-')}"
    if source == "linkedin":
        return f"https://www.linkedin.com/jobs/search/?keywords={q}&location={loc}"
    if source == "unstop":
        return f"https://unstop.com/jobs?search={q}"
    if source == "indeed":
        return f"https://www.indeed.com/jobs?q={q}&l={loc}"
    return f"https://www.google.com/search?q={q}+jobs+{loc}"


@api_router.post("/jobs/recommend")
async def recommend_jobs(req: JobRecommendationRequest, current_user: dict = Depends(get_current_user)):
    """Generate two buckets of job recommendations using the LLM.

    Auth required (prevents anonymous LLM abuse).
    Rate limit: 5 requests / user / hour.
    1) 'current_match' — roles the candidate can apply for today.
    2) 'stretch'       — roles unlocked if they add the listed missing skills.
    """
    # ---- Rate limit (5/h per user) ----
    one_hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
    recent_count = await db.jobs_recommend_calls.count_documents({
        "user_id": current_user["user_id"],
        "created_at": {"$gte": one_hour_ago},
    })
    if recent_count >= 5:
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded: 5 job-recommendation requests per hour. Try again later.",
        )
    await db.jobs_recommend_calls.insert_one({
        "user_id": current_user["user_id"],
        "created_at": datetime.now(timezone.utc),
    })

    try:
        prompt = f"""You are a senior tech recruiter for the Indian and global markets.

CANDIDATE PROFILE:
- Target role: {req.job_title or 'Unspecified'}
- Experience level: {req.experience_level or 'Unspecified'}
- Preferred location: {req.location}
- Skills the candidate ALREADY HAS: {', '.join(req.matching_skills) or 'None provided'}
- Skills the candidate is MISSING for their target role: {', '.join(req.missing_skills) or 'None provided'}

Return STRICT JSON (no markdown) with exactly this shape:
{{
  "current_match": [
    {{
      "role": "Frontend Engineer",
      "company": "Plausible-sounding Indian/global company name",
      "location": "City, Country",
      "experience": "0-2 yrs | 2-4 yrs | 4-7 yrs | 7+ yrs",
      "salary_range": "INR 6–10 LPA or USD 80–120k",
      "match_score": 0-100,
      "why_match": "1-2 sentence reason tied to the candidate's existing skills",
      "key_skills_used": ["React", "TypeScript", ...]
    }}
  ],
  "stretch": [
    {{
      "role": "Senior Full-Stack Engineer",
      "company": "...",
      "location": "...",
      "experience": "...",
      "salary_range": "...",
      "match_score": 0-100,
      "missing_skills_needed": ["Docker", "Kubernetes"],
      "why_stretch": "1-2 sentence reason explaining what adding those skills unlocks",
      "key_skills_used": [...]
    }}
  ]
}}

Rules:
- Exactly 5 entries in current_match and exactly 5 in stretch.
- Use realistic Indian companies (Razorpay, Zomato, Swiggy, Flipkart, Freshworks, CRED, Postman, Atlan, Hasura, Groww, etc.) plus 1-2 global names (Microsoft, Google, Atlassian) where appropriate.
- match_score must be honest: current_match should be 70-95; stretch should be 35-70 reflecting the missing skills.
- DO NOT fabricate job IDs or URLs — we'll add search links separately.
- Vary role seniority appropriately for the experience level.
- For current_match, key_skills_used should overlap heavily with the matching_skills list.
- For stretch, missing_skills_needed MUST be a subset of the input missing_skills."""

        system = "You are an expert tech recruiter. Output ONLY a JSON object — no prose, no markdown fences."
        response = await call_llm(prompt, system)

        clean = response.strip()
        if clean.startswith("```"):
            clean = clean.split("```")[1]
            if clean.startswith("json"):
                clean = clean[4:]
        clean = clean.strip()

        data = json.loads(clean)
        # Attach search URLs to each item
        for bucket in ("current_match", "stretch"):
            for item in data.get(bucket, []):
                query = f"{item.get('role', req.job_title)} {item.get('company', '')}".strip()
                item["apply_links"] = {
                    "naukri": _build_search_url(query, req.location, "naukri"),
                    "linkedin": _build_search_url(query, req.location, "linkedin"),
                    "indeed": _build_search_url(query, req.location, "indeed"),
                    "unstop": _build_search_url(query, req.location, "unstop"),
                }
        return data

    except HTTPException:
        raise
    except json.JSONDecodeError as e:
        logging.error(f"Job-recommend JSON parse error: {e}")
        raise HTTPException(status_code=500, detail="Could not parse job recommendations")
    except Exception as e:
        logging.error(f"Job-recommend error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Static video serving (after router so /api/videos is matched first)
from fastapi.staticfiles import StaticFiles
app.mount("/api/videos", StaticFiles(directory=str(VIDEO_UPLOAD_DIR)), name="videos")


# Include the router in the main app
set_auth_db(db)
app.include_router(auth_router)
app.include_router(api_router)

DEFAULT_CORS_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:3001",
    "https://career-pilot-flax.vercel.app",
]

env_cors_origins = [
    origin.strip()
    for origin in os.environ.get("CORS_ORIGINS", "").split(",")
    if origin.strip()
]
CORS_ORIGINS = list(dict.fromkeys(DEFAULT_CORS_ORIGINS + env_cors_origins))

@app.on_event("startup")
async def _ensure_indexes():
    """TTL indexes to auto-prune ephemeral records."""
    try:
        await db.jobs_recommend_calls.create_index(
            "created_at", expireAfterSeconds=3600
        )
        await db.oauth_states.create_index(
            "created_at", expireAfterSeconds=600
        )
    except Exception as e:
        logging.warning(f"Could not create TTL index: {e}")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
