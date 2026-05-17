import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Trophy, TrendingUp, Home, BarChart3, ShieldAlert, ShieldCheck, Shield } from "lucide-react";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function ResultsPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [deepCheat, setDeepCheat] = useState(null);
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadResults();
  }, [sessionId]);

  const loadResults = async () => {
    try {
      const [sessRes, deepRes, vidRes] = await Promise.allSettled([
        axios.get(`${API}/interview-session/${sessionId}`),
        axios.get(`${API}/analyze-cheating-deep/${sessionId}`),
        axios.get(`${API}/interview-videos/${sessionId}`),
      ]);
      if (sessRes.status === "fulfilled") setSession(sessRes.value.data);
      if (deepRes.status === "fulfilled") setDeepCheat(deepRes.value.data);
      if (vidRes.status === "fulfilled") setVideos(vidRes.value.data?.videos || []);
      setLoading(false);
    } catch (error) {
      console.error("Error loading results:", error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-lg">Loading results...</div>
      </div>
    );
  }

  const answers = session?.answers || [];
  const averageScore = answers.length > 0
    ? answers.reduce((sum, a) => sum + (a.evaluation?.overall_score || 0), 0) / answers.length
    : 0;

  const getScoreColor = (score) => {
    if (score >= 80) return "text-accent";
    if (score >= 60) return "text-orange-500";
    return "text-destructive";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <div className="relative border-b border-purple-500/20 py-12 overflow-hidden">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-pink-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
          >
            <Trophy className="h-16 w-16 mx-auto mb-4 text-yellow-400" />
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-white mb-4">
              Interview{" "}
              <span className="bg-gradient-to-r from-purple-300 via-pink-300 to-purple-400 bg-clip-text text-transparent">
                Complete!
              </span>
            </h1>
            <p className="text-lg text-slate-300">
              Here's how you performed
            </p>
          </motion.div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Overall Score */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <Card className="p-12 text-center bg-slate-800/60 backdrop-blur-sm border-purple-500/20 text-white">
            <p className="text-sm font-medium text-purple-200 uppercase tracking-wider mb-2">
              Overall Performance
            </p>
            <div className={`text-7xl font-heading font-bold ${getScoreColor(averageScore)} mb-4`}>
              {Math.round(averageScore)}%
            </div>
            <p className="text-slate-300">
              Based on {answers.length} questions answered
            </p>
          </Card>
        </motion.div>

        {/* Proctoring / Cheating Analysis */}
        {deepCheat && (
          <motion.div
            data-testid="deep-cheating-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-12"
          >
            <Card
              className={`p-8 border-2 bg-slate-800/60 backdrop-blur-sm ${
                deepCheat.risk_level === "high"
                  ? "border-rose-400/50"
                  : deepCheat.risk_level === "medium"
                  ? "border-amber-400/50"
                  : "border-emerald-400/50"
              }`}
            >
              <div className="flex items-start gap-4">
                <div
                  className={`shrink-0 p-3 rounded-xl ${
                    deepCheat.risk_level === "high"
                      ? "bg-rose-500/15 text-rose-300"
                      : deepCheat.risk_level === "medium"
                      ? "bg-amber-500/15 text-amber-300"
                      : "bg-emerald-500/15 text-emerald-300"
                  }`}
                >
                  {deepCheat.risk_level === "high" ? (
                    <ShieldAlert className="h-7 w-7" />
                  ) : deepCheat.risk_level === "medium" ? (
                    <Shield className="h-7 w-7" />
                  ) : (
                    <ShieldCheck className="h-7 w-7" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h3 className="text-xl font-semibold text-white">
                      Proctoring Analysis —{" "}
                      <span className="capitalize">{deepCheat.risk_level}</span> Risk
                    </h3>
                    <span className="text-2xl font-bold text-white">
                      {deepCheat.risk_score}/100
                    </span>
                  </div>
                  <p className="text-slate-300 mt-2">{deepCheat.summary}</p>

                  <div className="grid md:grid-cols-2 gap-4 mt-5">
                    {deepCheat.multiple_voice_indicators?.length > 0 && (
                      <div>
                        <p className="text-sm font-semibold text-purple-200 mb-1">
                          Multi-voice indicators
                        </p>
                        <ul className="text-sm text-slate-300 list-disc pl-5 space-y-1">
                          {deepCheat.multiple_voice_indicators.map((m, i) => (
                            <li key={i}>{m}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {deepCheat.gaze_drift_indicators?.length > 0 && (
                      <div>
                        <p className="text-sm font-semibold text-purple-200 mb-1">
                          Gaze / focus drift
                        </p>
                        <ul className="text-sm text-slate-300 list-disc pl-5 space-y-1">
                          {deepCheat.gaze_drift_indicators.map((m, i) => (
                            <li key={i}>{m}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {deepCheat.scripted_answer_indicators?.length > 0 && (
                      <div>
                        <p className="text-sm font-semibold text-purple-200 mb-1">
                          Scripted-answer signals
                        </p>
                        <ul className="text-sm text-slate-300 list-disc pl-5 space-y-1">
                          {deepCheat.scripted_answer_indicators.map((m, i) => (
                            <li key={i}>{m}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {deepCheat.transcript_text_mismatch?.length > 0 && (
                      <div>
                        <p className="text-sm font-semibold text-purple-200 mb-1">
                          Transcript / text mismatches
                        </p>
                        <ul className="text-sm text-slate-300 list-disc pl-5 space-y-1">
                          {deepCheat.transcript_text_mismatch.map((m, i) => (
                            <li key={i}>{m}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {deepCheat.recommendations?.length > 0 && (
                    <div className="mt-5 pt-4 border-t border-purple-500/20">
                      <p className="text-sm font-semibold text-purple-200 mb-2">
                        Recommendations
                      </p>
                      <ul className="text-sm text-slate-300 list-disc pl-5 space-y-1">
                        {deepCheat.recommendations.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Recorded Video Clips */}
        {videos.length > 0 && (
          <motion.div
            data-testid="recorded-videos"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-12"
          >
            <Card className="p-8 bg-slate-800/60 backdrop-blur-sm border-purple-500/20 text-white">
              <h3 className="text-xl font-semibold mb-4">
                Recorded Clips ({videos.length})
              </h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {videos.map((v) => (
                  <div key={v.id} className="rounded-lg overflow-hidden border border-purple-500/20 bg-slate-900/60">
                    <video
                      controls
                      preload="metadata"
                      className="w-full aspect-video bg-black"
                      src={`${BACKEND_URL}${v.url_path}`}
                    />
                    <div className="p-3 text-xs text-slate-300 flex items-center justify-between">
                      <span>Question {v.question_index + 1}</span>
                      <span>{(v.size_bytes / 1024).toFixed(1)} KB</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>
        )}

        {/* Detailed Results */}
        <div className="grid lg:grid-cols-2 gap-8 mb-12">
          {answers.map((answer, idx) => {
            const evaluation = answer.evaluation || {};
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: idx * 0.1 }}
              >
                <Card className="p-6 bg-slate-800/60 backdrop-blur-sm border-purple-500/20 text-white">
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white flex-1">
                      Question {answer.question_index + 1}
                    </h3>
                    <div className={`text-2xl font-bold ${getScoreColor(evaluation.overall_score || 0)}`}>
                      {Math.round(evaluation.overall_score || 0)}%
                    </div>
                  </div>

                  {/* Scoring Breakdown */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Technical</p>
                      <div className="flex items-center">
                        <div className="flex-1 bg-slate-700/60 rounded-full h-2 mr-2">
                          <div
                            className="bg-purple-500 h-2 rounded-full transition-all"
                            style={{ width: `${(evaluation.technical_accuracy || 0) * 10}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium text-slate-200">{evaluation.technical_accuracy || 0}/10</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Depth</p>
                      <div className="flex items-center">
                        <div className="flex-1 bg-slate-700/60 rounded-full h-2 mr-2">
                          <div
                            className="bg-violet-500 h-2 rounded-full transition-all"
                            style={{ width: `${(evaluation.depth || 0) * 10}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium text-slate-200">{evaluation.depth || 0}/10</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Clarity</p>
                      <div className="flex items-center">
                        <div className="flex-1 bg-slate-700/60 rounded-full h-2 mr-2">
                          <div
                            className="bg-emerald-400 h-2 rounded-full transition-all"
                            style={{ width: `${(evaluation.clarity || 0) * 10}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium text-slate-200">{evaluation.clarity || 0}/10</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Confidence</p>
                      <div className="flex items-center">
                        <div className="flex-1 bg-slate-700/60 rounded-full h-2 mr-2">
                          <div
                            className="bg-orange-400 h-2 rounded-full transition-all"
                            style={{ width: `${(evaluation.confidence || 0) * 10}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium text-slate-200">{evaluation.confidence || 0}/10</span>
                      </div>
                    </div>
                  </div>

                  {/* Strengths & Weaknesses */}
                  {evaluation.strengths && evaluation.strengths.length > 0 && (
                    <div className="mb-3">
                      <p className="text-sm font-semibold text-emerald-300 mb-1">Strengths:</p>
                      <ul className="text-sm text-slate-300 space-y-1">
                        {evaluation.strengths.map((s, i) => (
                          <li key={i} className="flex items-start gap-1">
                            <span className="text-emerald-300">✓</span>
                            <span>{s}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {evaluation.weaknesses && evaluation.weaknesses.length > 0 && (
                    <div className="mb-3">
                      <p className="text-sm font-semibold text-rose-300 mb-1">Areas to Improve:</p>
                      <ul className="text-sm text-slate-300 space-y-1">
                        {evaluation.weaknesses.map((w, i) => (
                          <li key={i} className="flex items-start gap-1">
                            <span className="text-rose-300">•</span>
                            <span>{w}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Model answer hidden per product spec */}
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-4 justify-center">
          <Button
            data-testid="home-btn"
            onClick={() => navigate("/")}
            variant="outline"
            className="px-8 py-6 text-lg bg-slate-800/60 border-purple-500/30 text-white hover:bg-slate-700"
          >
            <Home className="mr-2 h-5 w-5" />
            Go Home
          </Button>
          <Button
            data-testid="dashboard-btn"
            onClick={() => navigate("/dashboard")}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-8 py-6 text-lg shadow-lg"
          >
            <BarChart3 className="mr-2 h-5 w-5" />
            View Analytics
          </Button>
          <Button
            data-testid="new-interview-btn"
            onClick={() => navigate("/analyze")}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-6 text-lg shadow-lg"
          >
            <TrendingUp className="mr-2 h-5 w-5" />
            Start New Interview
          </Button>
        </div>
      </div>
    </div>
  );
}
