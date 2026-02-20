import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Mic, MicOff, ArrowRight, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function InterviewRoom() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  
  const [session, setSession] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSession();
  }, [sessionId]);

  const loadSession = async () => {
    try {
      const response = await axios.get(`${API}/interview-session/${sessionId}`);
      setSession(response.data);
      setLoading(false);
    } catch (error) {
      console.error("Error loading session:", error);
      toast.error("Failed to load interview session");
      navigate("/setup");
    }
  };

  const handleSubmitAnswer = async () => {
    if (!answer.trim()) {
      toast.error("Please provide an answer");
      return;
    }

    setSubmitting(true);
    try {
      const currentQuestion = session.questions[currentQuestionIndex];
      
      await axios.post(`${API}/evaluate-answer`, {
        session_id: sessionId,
        question_index: currentQuestionIndex,
        answer: answer,
        skill_tag: currentQuestion.type,
      });

      toast.success("Answer submitted!");
      setAnswer("");

      // Move to next question or finish
      if (currentQuestionIndex < session.questions.length - 1) {
        setCurrentQuestionIndex(currentQuestionIndex + 1);
      } else {
        toast.success("Interview completed!");
        navigate(`/results/${sessionId}`);
      }
    } catch (error) {
      console.error("Error submitting answer:", error);
      toast.error("Failed to submit answer. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleRecording = () => {
    setIsRecording(!isRecording);
    if (!isRecording) {
      toast.info("Voice recording simulation - type your answer below");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background-dark flex items-center justify-center">
        <div className="text-white text-lg">Loading interview...</div>
      </div>
    );
  }

  const currentQuestion = session?.questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / session?.questions.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Progress Bar */}
      <div className="bg-slate-800/50 h-1.5">
        <div
          className="bg-gradient-to-r from-purple-500 to-pink-500 h-full transition-all duration-500 shadow-lg shadow-purple-500/50"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <p className="text-purple-300 text-sm font-medium tracking-wide mb-3">
            Question {currentQuestionIndex + 1} of {session?.questions.length}
          </p>
          <div className="inline-block px-4 py-2 bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-400/30 text-purple-200 rounded-full text-sm font-semibold">
            {currentQuestion?.type}
          </div>
        </div>

        {/* Question Card */}
        <motion.div
          key={currentQuestionIndex}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-sm border-purple-500/20 text-white p-8 mb-8 shadow-xl">
            <h2 className="text-xl md:text-2xl font-semibold mb-4 leading-relaxed text-slate-100">
              {currentQuestion?.text}
            </h2>
          </Card>
        </motion.div>

        {/* Waveform Animation */}
        <div className="flex justify-center items-center gap-2 h-20 mb-6">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className={`wave-bar w-2 bg-gradient-to-t from-purple-500 to-pink-500 rounded-full transition-all ${
                isRecording ? 'opacity-100' : 'opacity-30'
              }`}
              style={{ height: isRecording ? '60px' : '20px' }}
            />
          ))}
        </div>

        {/* Recording Control */}
        <div className="flex justify-center mb-6">
          <Button
            data-testid="mic-toggle-btn"
            onClick={toggleRecording}
            className={`rounded-full h-20 w-20 ${
              isRecording
                ? 'bg-gradient-to-br from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700'
                : 'bg-gradient-to-br from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700'
            } shadow-xl hover:shadow-2xl transition-all hover:scale-105`}
          >
            {isRecording ? <MicOff className="h-8 w-8" /> : <Mic className="h-8 w-8" />}
          </Button>
        </div>

        {/* Answer Input */}
        <Card className="bg-slate-800/50 backdrop-blur-sm border-purple-500/20 p-6 mb-6 shadow-lg">
          <Textarea
            data-testid="answer-input"
            placeholder="Type your answer here or use voice recording..."
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            rows={6}
            className="bg-slate-900/50 border-purple-500/30 text-white placeholder:text-slate-400 text-base focus:border-purple-400 transition-colors"
          />
        </Card>

        {/* Submit Button */}
        <div className="flex justify-end mb-6">
          <Button
            data-testid="submit-answer-btn"
            onClick={handleSubmitAnswer}
            disabled={submitting}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold px-8 py-6 rounded-lg text-base shadow-lg hover:shadow-xl transition-all"
          >
            {submitting ? (
              <>
                <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full mr-2" />
                Submitting...
              </>
            ) : currentQuestionIndex < session?.questions.length - 1 ? (
              <>
                Next Question
                <ArrowRight className="ml-2 h-5 w-5" />
              </>
            ) : (
              <>
                Complete Interview
                <CheckCircle className="ml-2 h-5 w-5" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
