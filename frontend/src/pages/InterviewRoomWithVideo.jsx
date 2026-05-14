import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Mic, MicOff, ArrowRight, CheckCircle, Video, AlertTriangle, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import axios from "axios";
import Webcam from "react-webcam";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function InterviewRoomWithVideo() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  
  const [session, setSession] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Video recording state
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [videoRecordings, setVideoRecordings] = useState([]);
  const [currentRecording, setCurrentRecording] = useState(null);
  
  // Cheating detection state
  const [cheatingWarnings, setCheatingWarnings] = useState(0);
  const [cheatingEvents, setCheatingEvents] = useState([]);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [warningMessage, setWarningMessage] = useState("");
  const [isTabActive, setIsTabActive] = useState(true);
  
  const webcamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const faceDetectionIntervalRef = useRef(null);

  useEffect(() => {
    loadSession();
    setupCheatingDetection();
    
    return () => {
      if (faceDetectionIntervalRef.current) {
        clearInterval(faceDetectionIntervalRef.current);
      }
    };
  }, [sessionId]);

  useEffect(() => {
    if (isCameraOn && webcamRef.current) {
      startVideoRecording();
    }
  }, [isCameraOn, currentQuestionIndex]);

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

  const setupCheatingDetection = () => {
    // Tab visibility detection
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("focus", handleWindowFocus);
    
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
      window.removeEventListener("focus", handleWindowFocus);
    };
  };

  const handleVisibilityChange = () => {
    if (document.hidden) {
      logCheatingEvent("Tab Switch Detected", "User switched to another tab or window");
      showCheatingWarning("Tab Switch Detected! Please stay on this page during the interview.");
    }
    setIsTabActive(!document.hidden);
  };

  const handleWindowBlur = () => {
    logCheatingEvent("Window Blur", "User clicked outside the interview window");
  };

  const handleWindowFocus = () => {
    setIsTabActive(true);
  };

  const logCheatingEvent = (type, description) => {
    const event = {
      type,
      description,
      timestamp: new Date().toISOString(),
      questionIndex: currentQuestionIndex,
    };
    setCheatingEvents(prev => [...prev, event]);
  };

  const showCheatingWarning = (message) => {
    const newWarningCount = cheatingWarnings + 1;
    setCheatingWarnings(newWarningCount);
    setWarningMessage(message);
    setShowWarningModal(true);

    if (newWarningCount >= 2) {
      setTimeout(() => {
        toast.error("Interview cancelled due to suspicious activity");
        navigate("/");
      }, 3000);
    }
  };

  const startVideoRecording = () => {
    try {
      if (webcamRef.current && webcamRef.current.stream) {
        const stream = webcamRef.current.stream;
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: "video/webm",
        });

        mediaRecorderRef.current = mediaRecorder;
        recordedChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            recordedChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = () => {
          const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
          const videoUrl = URL.createObjectURL(blob);
          
          setVideoRecordings(prev => [
            ...prev,
            {
              questionIndex: currentQuestionIndex,
              url: videoUrl,
              blob: blob,
              timestamp: new Date().toISOString(),
            }
          ]);
        };

        mediaRecorder.start();
        setCurrentRecording(mediaRecorder);
      }
    } catch (error) {
      console.error("Error starting video recording:", error);
    }
  };

  const stopVideoRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  };

  const handleNextQuestion = () => {
    if (!currentAnswer.trim()) {
      toast.error("Please provide an answer");
      return;
    }

    // Stop current video recording
    stopVideoRecording();

    // Store answer
    const newAnswer = {
      questionIndex: currentQuestionIndex,
      question: session.questions[currentQuestionIndex].text,
      answer: currentAnswer,
      timestamp: new Date().toISOString(),
    };

    setAnswers(prev => [...prev, newAnswer]);
    setCurrentAnswer("");

    // Move to next question or finish
    if (currentQuestionIndex < session.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      submitInterview();
    }
  };

  const submitInterview = async () => {
    toast.info("Submitting interview and evaluating all answers...");
    
    try {
      // Evaluate all answers
      const evaluations = [];
      for (let i = 0; i < answers.length; i++) {
        const answer = answers[i];
        const response = await axios.post(`${API}/evaluate-answer`, {
          session_id: sessionId,
          question_index: answer.questionIndex,
          answer: answer.answer,
          skill_tag: session.questions[answer.questionIndex].type,
        });
        evaluations.push(response.data);
      }

      // Save cheating analysis
      await axios.post(`${API}/save-cheating-analysis`, {
        session_id: sessionId,
        cheating_events: cheatingEvents,
        total_warnings: cheatingWarnings,
        video_count: videoRecordings.length,
      });

      toast.success("Interview completed! Redirecting to results...");
      navigate(`/results/${sessionId}`);
    } catch (error) {
      console.error("Error submitting interview:", error);
      toast.error("Failed to submit interview");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-4 gap-6">
          {/* Main Interview Area - 3/4 */}
          <div className="lg:col-span-3">
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

            {/* Answer Input */}
            <Card className="bg-slate-800/50 backdrop-blur-sm border-purple-500/20 p-6 mb-6 shadow-lg">
              <Textarea
                data-testid="answer-input"
                placeholder="Type your answer here..."
                value={currentAnswer}
                onChange={(e) => setCurrentAnswer(e.target.value)}
                rows={6}
                className="bg-slate-900/50 border-purple-500/30 text-white placeholder:text-slate-400 text-base focus:border-purple-400 transition-colors"
              />
              <div className="mt-4 flex items-center justify-between">
                <span className="text-slate-400 text-sm">
                  {currentAnswer.split(' ').filter(w => w).length} words
                </span>
                <Button
                  data-testid="next-question-btn"
                  onClick={handleNextQuestion}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold px-8 py-3 rounded-lg shadow-lg"
                >
                  {currentQuestionIndex < session?.questions.length - 1 ? (
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
            </Card>
          </div>

          {/* Video & Monitoring - 1/4 */}
          <div className="lg:col-span-1">
            <Card className="bg-slate-800/50 backdrop-blur-sm border-purple-500/20 p-6 shadow-lg sticky top-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold">Video Recording</h3>
                <Button
                  onClick={() => setIsCameraOn(!isCameraOn)}
                  variant="ghost"
                  size="sm"
                  className={`${isCameraOn ? 'text-green-400' : 'text-slate-400'}`}
                >
                  {isCameraOn ? <Video className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
                </Button>
              </div>

              {isCameraOn ? (
                <div className="aspect-video bg-slate-900 rounded-lg overflow-hidden border border-purple-500/30">
                  <Webcam
                    ref={webcamRef}
                    audio={false}
                    mirrored
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="aspect-video bg-slate-900 rounded-lg flex items-center justify-center border border-purple-500/30">
                  <div className="text-center text-slate-400">
                    <EyeOff className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Camera Off</p>
                    <Button
                      onClick={() => setIsCameraOn(true)}
                      size="sm"
                      className="mt-3 bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      Enable Camera
                    </Button>
                  </div>
                </div>
              )}

              {/* Status */}
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Recording Status:</span>
                  <span className={`font-semibold ${isCameraOn ? 'text-green-400' : 'text-slate-500'}`}>
                    {isCameraOn ? 'Recording' : 'Stopped'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Videos Recorded:</span>
                  <span className="text-purple-300 font-semibold">{videoRecordings.length}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Warnings:</span>
                  <span className={`font-semibold ${cheatingWarnings > 0 ? 'text-red-400' : 'text-green-400'}`}>
                    {cheatingWarnings}/2
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Warning Modal */}
      <Dialog open={showWarningModal} onOpenChange={setShowWarningModal}>
        <DialogContent className="bg-slate-900 border-red-500/50 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="h-6 w-6" />
              Warning {cheatingWarnings}/2
            </DialogTitle>
            <DialogDescription className="text-slate-300 text-base mt-4">
              {warningMessage}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-6">
            <p className="text-sm text-slate-400 mb-4">
              {cheatingWarnings >= 2 
                ? "Your interview will be cancelled due to multiple violations."
                : "One more warning will result in interview cancellation."}
            </p>
            <Button
              onClick={() => setShowWarningModal(false)}
              className="w-full bg-red-600 hover:bg-red-700 text-white"
            >
              I Understand
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
