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

@api_router.post("/analyze-resume", response_model=ATSAnalysisResult)
async def analyze_resume(
    resume: UploadFile = File(...),
    job_description: str = Form(...)
):
    """Analyze resume against job description"""
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

Return output strictly in JSON format:
{{
  "ats_score": number,
  "matching_skills": [],
  "missing_skills": [],
  "partial_matches": [],
  "improvement_suggestions": []
}}

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
        for q in questions.technical_questions:
            all_questions.append({"type": "technical", "text": q})
        for q in questions.scenario_questions:
            all_questions.append({"type": "scenario", "text": q})
        for q in questions.hr_questions:
            all_questions.append({"type": "hr", "text": q})
        
        session = InterviewSession(
            job_title=job_title,
            experience_level=experience_level,
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