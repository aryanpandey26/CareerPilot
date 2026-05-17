import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Mic, MicOff, ArrowRight, CheckCircle, Video, AlertTriangle, Eye, EyeOff, Loader2, Sparkles, Brain, ShieldCheck } from "lucide-react";
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

  // Refs to avoid stale-closure issues in window/document event handlers
  const sessionRef = useRef(null);
  const warningsRef = useRef(0);
  const cheatingCancelledRef = useRef(false);
  const currentQuestionIndexRef = useRef(0);

  // Audio-only recording (for Whisper STT)
  const audioStreamRef = useRef(null);
  const audioRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const [isAudioRecording, setIsAudioRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  // Final-submit overlay
  const [submitting, setSubmitting] = useState(false);
  const [submitStage, setSubmitStage] = useState("");

  // Track in-flight video uploads so we can await them before navigating
  const pendingUploadsRef = useRef([]);

  useEffect(() => {
    loadSession();
    return () => {
      if (faceDetectionIntervalRef.current) {
        clearInterval(faceDetectionIntervalRef.current);
      }
    };
  }, [sessionId]);

  // Mirror state into refs so global listeners always see fresh values
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    warningsRef.current = cheatingWarnings;
  }, [cheatingWarnings]);

  useEffect(() => {
    currentQuestionIndexRef.current = currentQuestionIndex;
  }, [currentQuestionIndex]);

  // Bind global tab/focus listeners only after the session has loaded
  useEffect(() => {
    if (!session) return;

    const triggerWarning = (type, description, suffix) => {
      if (cheatingCancelledRef.current) return;
      const newCount = warningsRef.current + 1;
      warningsRef.current = newCount;
      setCheatingWarnings(newCount);
      setCheatingEvents((prev) => [
        ...prev,
        {
          type,
          description,
          timestamp: new Date().toISOString(),
          questionIndex: currentQuestionIndexRef.current,
        },
      ]);

      if (newCount >= 3) {
        cheatingCancelledRef.current = true;
        setWarningMessage(
          "Interview Cancelled! You have exceeded the maximum number of warnings (3/3)."
        );
        setShowWarningModal(true);
        setTimeout(() => {
          toast.error("Interview cancelled due to repeated violations");
          navigate("/dashboard");
        }, 2000);
      } else {
        const remaining = 3 - newCount;
        setWarningMessage(
          `Warning ${newCount}/3: ${suffix} ${
            remaining === 1
              ? "One more violation will cancel your interview."
              : `${remaining} more violations will cancel your interview.`
          }`
        );
        setShowWarningModal(true);
      }
    };

    const onVisibility = () => {
      if (document.hidden) {
        triggerWarning(
          "Tab Switch Detected",
          "User switched to another tab or window",
          "Tab Switch Detected! Please stay on this page during the interview."
        );
        setIsTabActive(false);
      } else {
        setIsTabActive(true);
      }
    };

    const onBlur = () => {
      if (!document.hidden) {
        triggerWarning(
          "Window Focus Lost",
          "User clicked outside the interview window",
          "Focus Lost! Please keep the interview window active."
        );
      }
    };

    const onFocus = () => setIsTabActive(true);

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
    };
  }, [session, navigate]);

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

  const startVideoRecording = (retry = 0) => {
    try {
      const stream = webcamRef.current && webcamRef.current.stream;
      if (!stream) {
        // Stream not ready yet — try again shortly (max ~3 seconds)
        if (retry < 15) {
          setTimeout(() => startVideoRecording(retry + 1), 200);
        }
        return;
      }
      // Already recording? skip.
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state === "recording"
      ) {
        return;
      }
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
        const recIdx = currentQuestionIndex;

        setVideoRecordings((prev) => [
          ...prev,
          {
            questionIndex: recIdx,
            url: videoUrl,
            blob: blob,
            timestamp: new Date().toISOString(),
          },
        ]);

        // Track upload promise so we can await it before final navigate
        const uploadPromise = (async () => {
          try {
            const fd = new FormData();
            fd.append("video", blob, `q${recIdx}.webm`);
            fd.append("session_id", sessionId);
            fd.append("question_index", String(recIdx));
            await axios.post(`${API}/upload-video`, fd, {
              headers: { "Content-Type": "multipart/form-data" },
              timeout: 120000,
            });
          } catch (err) {
            console.error("Video upload failed:", err);
          }
        })();
        pendingUploadsRef.current.push(uploadPromise);
      };

      mediaRecorder.start();
      setCurrentRecording(mediaRecorder);
    } catch (error) {
      console.error("Error starting video recording:", error);
    }
  };

  const stopVideoRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  };

  // ---- Audio (microphone) recording with Whisper STT ----
  const startAudioRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      audioChunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      audioRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        // Release mic
        if (audioStreamRef.current) {
          audioStreamRef.current.getTracks().forEach((t) => t.stop());
          audioStreamRef.current = null;
        }
        await transcribeAndAppend(blob);
      };

      recorder.start();
      setIsAudioRecording(true);
      toast.success("Recording... speak your answer.");
    } catch (err) {
      console.error("Mic error:", err);
      toast.error("Microphone permission denied or unavailable.");
    }
  };

  const stopAudioRecording = () => {
    if (audioRecorderRef.current && audioRecorderRef.current.state === "recording") {
      audioRecorderRef.current.stop();
      setIsAudioRecording(false);
    }
  };

  const transcribeAndAppend = async (blob) => {
    try {
      setIsTranscribing(true);
      const fd = new FormData();
      fd.append("audio", blob, "answer.webm");
      fd.append("session_id", sessionId);
      fd.append("question_index", String(currentQuestionIndex));

      const res = await axios.post(`${API}/transcribe-audio`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 60000,
      });
      const transcript = res?.data?.transcript || "";
      if (transcript) {
        setCurrentAnswer((prev) => (prev ? prev + " " + transcript : transcript));
        toast.success("Transcription added to your answer.");
      } else {
        toast.message("No speech detected.");
      }
    } catch (err) {
      console.error("Transcription error:", err);
      toast.error("Transcription failed. Please type your answer.");
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleNextQuestion = () => {
    // Allow empty answers for skipped questions
    const answerText = currentAnswer.trim() || "[No answer provided]";

    // Stop current video recording
    stopVideoRecording();

    // Store answer
    const newAnswer = {
      questionIndex: currentQuestionIndex,
      question: session.questions[currentQuestionIndex].text,
      answer: answerText,
      timestamp: new Date().toISOString(),
    };

    const updatedAnswers = [...answers, newAnswer];
    setAnswers(updatedAnswers);
    setCurrentAnswer("");

    // Move to next question or finish
    if (currentQuestionIndex < session.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      toast.success("Answer saved! Moving to next question...");
    } else {
      submitInterview(updatedAnswers);
    }
  };

  const submitInterview = async (finalAnswers) => {
    setSubmitting(true);
    try {
      const answersToSubmit = finalAnswers || answers;

      // Stage 0: Make sure the last video clip has been recorded & uploaded
      setSubmitStage("Uploading your last video clip...");
      // Stop any in-progress recording so its onstop fires & pushes an upload promise
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      // Give the onstop event one tick to register its upload promise
      await new Promise((r) => setTimeout(r, 200));
      if (pendingUploadsRef.current.length > 0) {
        await Promise.allSettled(pendingUploadsRef.current);
        pendingUploadsRef.current = [];
      }

      // Stage 1: Batch evaluation
      setSubmitStage("Evaluating your answers with AI...");
      try {
        await axios.post(`${API}/evaluate-interview-batch`, {
          session_id: sessionId,
          answers: answersToSubmit.map((a) => ({
            question_index: a.questionIndex,
            answer: a.answer,
          })),
        });
      } catch (error) {
        console.error("Batch evaluation error:", error);
        toast.error("Evaluation partially failed, but results saved.");
      }

      // Stage 2: Save tab-switch / focus events
      setSubmitStage("Saving proctoring data...");
      try {
        await axios.post(`${API}/save-cheating-analysis`, {
          session_id: sessionId,
          cheating_events: cheatingEvents,
          total_warnings: cheatingWarnings,
          video_count: videoRecordings.length,
        });
      } catch (error) {
        console.error("Error saving cheating analysis:", error);
      }

      // Stage 3: Deep cheating analysis
      setSubmitStage("Running deep proctoring analysis...");
      try {
        await axios.post(`${API}/analyze-cheating-deep`, { session_id: sessionId });
      } catch (error) {
        console.error("Deep cheating analysis failed:", error);
      }

      setSubmitStage("All done! Loading your report...");
      toast.success("Interview completed!");
      setTimeout(() => {
        navigate(`/results/${sessionId}`);
      }, 800);
    } catch (error) {
      console.error("Error submitting interview:", error);
      toast.error("Failed to submit interview. Please try again.");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-lg">Loading interview...</div>
      </div>
    );
  }

  // Full-screen evaluating overlay shown during final submission
  if (submitting) {
    const stages = [
      { label: "Uploading your last video clip...", icon: Video },
      { label: "Evaluating your answers with AI...", icon: Brain },
      { label: "Saving proctoring data...", icon: ShieldCheck },
      { label: "Running deep proctoring analysis...", icon: Sparkles },
      { label: "All done! Loading your report...", icon: CheckCircle },
    ];
    const activeIdx = Math.max(0, stages.findIndex((s) => s.label === submitStage));

    return (
      <div
        data-testid="evaluating-overlay"
        className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center px-4"
      >
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-pink-500/20 rounded-full blur-3xl animate-pulse" />
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="relative max-w-lg w-full"
        >
          <Card className="bg-slate-900/70 backdrop-blur-xl border-purple-500/30 p-8 sm:p-10 text-center shadow-2xl shadow-purple-500/20">
            <div className="flex justify-center mb-6">
              <div className="relative">
                <Loader2 className="h-16 w-16 text-purple-300 animate-spin" />
                <Sparkles className="absolute inset-0 m-auto h-8 w-8 text-pink-300 animate-pulse" />
              </div>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">
              Evaluating your{" "}
              <span className="bg-gradient-to-r from-purple-300 via-pink-300 to-purple-400 bg-clip-text text-transparent">
                interview
              </span>
            </h2>
            <p className="text-slate-300 mb-8">
              Hang tight — our AI is grading every answer and analyzing your session.
            </p>

            <div className="space-y-3 text-left">
              {stages.map((s, i) => {
                const done = i < activeIdx;
                const active = i === activeIdx;
                const Icon = s.icon;
                return (
                  <div
                    key={i}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors ${
                      active
                        ? "bg-purple-500/15 border-purple-400/40"
                        : done
                        ? "bg-emerald-500/10 border-emerald-400/30"
                        : "bg-slate-800/40 border-slate-700/50"
                    }`}
                  >
                    {done ? (
                      <CheckCircle className="h-5 w-5 text-emerald-300 shrink-0" />
                    ) : active ? (
                      <Loader2 className="h-5 w-5 text-purple-300 animate-spin shrink-0" />
                    ) : (
                      <Icon className="h-5 w-5 text-slate-500 shrink-0" />
                    )}
                    <span
                      className={`text-sm ${
                        active
                          ? "text-white font-medium"
                          : done
                          ? "text-emerald-200"
                          : "text-slate-400"
                      }`}
                    >
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
        </motion.div>
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
              <div className="mt-4 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <span className="text-slate-400 text-sm">
                    {currentAnswer.split(' ').filter(w => w).length} words
                  </span>
                  <Button
                    type="button"
                    data-testid="mic-record-btn"
                    onClick={isAudioRecording ? stopAudioRecording : startAudioRecording}
                    disabled={isTranscribing}
                    className={`${
                      isAudioRecording
                        ? "bg-red-600 hover:bg-red-700 animate-pulse"
                        : "bg-slate-700 hover:bg-slate-600"
                    } text-white font-medium px-4 py-2 rounded-lg`}
                  >
                    {isAudioRecording ? (
                      <>
                        <MicOff className="mr-2 h-4 w-4" /> Stop & Transcribe
                      </>
                    ) : isTranscribing ? (
                      <>
                        <Mic className="mr-2 h-4 w-4 animate-pulse" /> Transcribing...
                      </>
                    ) : (
                      <>
                        <Mic className="mr-2 h-4 w-4" /> Record Answer
                      </>
                    )}
                  </Button>
                </div>
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
                    audio={true}
                    mirrored
                    className="w-full h-full object-cover"
                    onUserMedia={() => {
                      // Stream is finally ready — start recording the CURRENT question
                      // if a recorder isn't already running. This fixes the race where
                      // Q1's recording was skipped because the stream wasn't ready yet.
                      if (
                        !mediaRecorderRef.current ||
                        mediaRecorderRef.current.state !== "recording"
                      ) {
                        startVideoRecording();
                      }
                    }}
                    onUserMediaError={(err) => {
                      console.error("Webcam getUserMedia error:", err);
                      toast.error("Camera/mic access was denied. Recording disabled.");
                    }}
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
                    {cheatingWarnings}/3
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
              Warning {cheatingWarnings}/3
            </DialogTitle>
            <DialogDescription className="text-slate-300 text-base mt-4">
              {warningMessage}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-6">
            <p className="text-sm text-slate-400 mb-4">
              {cheatingWarnings >= 3
                ? "Your interview will be cancelled due to multiple violations."
                : cheatingWarnings === 2
                ? "One more warning will result in interview cancellation."
                : "You will receive one more warning before the interview is cancelled."}
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
