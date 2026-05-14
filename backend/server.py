from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException, Form
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone
import PyPDF2
import io
from emergentintegrations.llm.chat import LlmChat, UserMessage
from emergentintegrations.llm.openai import OpenAISpeechToText
import json
import base64

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
LLM_API_KEY = os.environ.get('EMERGENT_LLM_KEY')

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

# Helper Functions
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
    try:
        chat = LlmChat(
            api_key=LLM_API_KEY,
            session_id=str(uuid.uuid4()),
            system_message=system_message
        ).with_model("openai", "gpt-5.2")
        
        user_message = UserMessage(text=prompt)
        response = await chat.send_message(user_message)
        return response
    except Exception as e:
        logging.error(f"Error calling LLM: {e}")
        raise HTTPException(status_code=500, detail=f"LLM call failed: {str(e)}")

# API Routes
@api_router.get("/")
async def root():
    return {"message": "AI Interview Engine API"}

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
            
    except Exception as e:
        logging.error(f"Error in analyze_resume: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/analyze-resume-text", response_model=ATSAnalysisResult)
async def analyze_resume_text(request: ResumeAnalysisRequest):
    """Analyze resume against job description (text-based)"""
    try:
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
            
            # Store in database
            doc = analysis.model_dump()
            await db.ats_analyses.insert_one(doc)
            
            return analysis
        except json.JSONDecodeError as e:
            logging.error(f"Failed to parse LLM response: {response}")
            raise HTTPException(status_code=500, detail="Failed to parse analysis results")
            
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
        logging.error(f"Error generating questions: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/evaluate-answer", response_model=EvaluationResult)
async def evaluate_answer(submission: AnswerSubmission):
    """Evaluate candidate's answer"""
    try:
        # Get question from session
        session = await db.interview_sessions.find_one({"id": submission.session_id}, {"_id": 0})
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        question = session["questions"][submission.question_index]["text"]
        
        prompt = f"""Evaluate the candidate's answer.

Question: {question}
Expected Skill: {submission.skill_tag}
User Answer: {submission.answer}

Assess on:
- Technical Accuracy (0-10)
- Depth of Explanation (0-10)
- Clarity & Structure (0-10)
- Confidence (0-10, inferred from language certainty)

Provide:
- Strengths
- Weaknesses
- Model Answer
- Improvement Suggestions
- Final Score (0-100)

Return strictly in JSON:
{{
  "technical_accuracy": number,
  "depth": number,
  "clarity": number,
  "confidence": number,
  "overall_score": number,
  "strengths": [],
  "weaknesses": [],
  "model_answer": "",
  "improvement_suggestions": []
}}

Scoring Logic:
Overall Score = Weighted average:
- Technical Accuracy: 40%
- Depth: 25%
- Clarity: 20%
- Confidence: 15%"""
        
        system_message = "You are a professional technical interviewer. Evaluate answers objectively and provide constructive feedback."
        response = await call_llm(prompt, system_message)
        
        # Parse JSON response
        response_clean = response.strip()
        if response_clean.startswith("```"):
            response_clean = response_clean.split("```")[1]
            if response_clean.startswith("json"):
                response_clean = response_clean[4:]
        response_clean = response_clean.strip()
        
        result_data = json.loads(response_clean)
        evaluation = EvaluationResult(**result_data)
        
        # Store answer and evaluation in session
        answer_data = {
            "question_index": submission.question_index,
            "answer": submission.answer,
            "evaluation": result_data,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        await db.interview_sessions.update_one(
            {"id": submission.session_id},
            {"$push": {"answers": answer_data}}
        )
        
        return evaluation
        
    except Exception as e:
        logging.error(f"Error evaluating answer: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/interview-session", response_model=InterviewSession)
async def create_interview_session(request: InterviewSessionRequest):
    """Create a new interview session"""
    try:
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
        
        # Store in database
        doc = session.model_dump()
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
        
        # Collect all scores
        all_scores = []
        for session in sessions:
            for answer in session.get("answers", []):
                if "evaluation" in answer:
                    all_scores.append(answer["evaluation"]["overall_score"])
        
        if not all_scores:
            return PerformanceAnalytics(
                average_score=0,
                strong_areas=[],
                weak_areas=[],
                improvement_trend="No data",
                recommended_focus_topics=[]
            )
        
        # Prepare prompt for analytics
        prompt = f"""Analyze interview performance trends.

Interview History:
{json.dumps(sessions[:10], indent=2)}

Return:
{{
  "average_score": number,
  "strong_areas": [],
  "weak_areas": [],
  "improvement_trend": "Improving / Stable / Declining",
  "recommended_focus_topics": []
}}

Rules:
- Identify lowest scoring skill category
- Detect improvement pattern over time
- Recommend learning roadmap"""
        
        system_message = "You are a performance analytics expert. Analyze interview data and provide actionable insights."
        response = await call_llm(prompt, system_message)
        
        # Parse JSON response
        response_clean = response.strip()
        if response_clean.startswith("```"):
            response_clean = response_clean.split("```")[1]
            if response_clean.startswith("json"):
                response_clean = response_clean[4:]
        response_clean = response_clean.strip()
        
        result_data = json.loads(response_clean)
        return PerformanceAnalytics(**result_data)
        
    except Exception as e:
        logging.error(f"Error getting analytics: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/analytics/history")
async def get_interview_history():
    """Get all interview sessions"""
    sessions = await db.interview_sessions.find({}, {"_id": 0}).to_list(100)
    return sessions

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

class BatchEvaluationResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    session_id: str
    evaluations: List[Dict[str, Any]]
    average_score: float

@api_router.post("/evaluate-interview-batch", response_model=BatchEvaluationResponse)
async def evaluate_interview_batch(request: BatchEvaluationRequest):
    """Evaluate ALL interview answers at once on final submit"""
    try:
        session = await db.interview_sessions.find_one({"id": request.session_id}, {"_id": 0})
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

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
    """Transcribe an uploaded audio blob using OpenAI Whisper via Emergent LLM key."""
    try:
        if not LLM_API_KEY:
            raise HTTPException(status_code=500, detail="EMERGENT_LLM_KEY missing on server")

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

        stt = OpenAISpeechToText(api_key=LLM_API_KEY)
        with open(tmp_path, "rb") as audio_file:
            response = await stt.transcribe(
                file=audio_file,
                model="whisper-1",
                response_format="json",
                language="en",
            )

        try:
            tmp_path.unlink(missing_ok=True)
        except Exception:
            pass

        transcript = getattr(response, "text", None) or str(response)

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


# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
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