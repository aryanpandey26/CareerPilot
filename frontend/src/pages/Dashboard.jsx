import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Target,
  Brain,
  Award,
  BarChart3,
  Sparkles,
  Flame,
  Trophy,
} from "lucide-react";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Dashboard() {
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [analyticsRes, historyRes] = await Promise.all([
        axios.get(`${API}/analytics/performance`),
        axios.get(`${API}/analytics/history`),
      ]);
      setAnalytics(analyticsRes.data);
      setHistory(historyRes.data);
      setLoading(false);
    } catch (error) {
      console.error("Error loading dashboard data:", error);
      setLoading(false);
    }
  };

  const getTrendIcon = (trend) => {
    if (trend === "Improving") return <TrendingUp className="h-5 w-5 text-emerald-400" />;
    if (trend === "Declining") return <TrendingDown className="h-5 w-5 text-rose-400" />;
    return <Minus className="h-5 w-5 text-slate-300" />;
  };

  const getScoreGradient = (score) => {
    if (score >= 80) return "from-emerald-400 to-green-500";
    if (score >= 60) return "from-amber-400 to-orange-500";
    return "from-rose-400 to-red-500";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-lg flex items-center gap-3">
          <Sparkles className="h-6 w-6 animate-pulse text-purple-300" />
          Loading dashboard...
        </div>
      </div>
    );
  }

  const avgScore = (() => {
    // Compute from user's own completed sessions
    let scores = [];
    try {
      const ids = JSON.parse(localStorage.getItem("interviewSessionIds") || "[]");
      for (const s of history || []) {
        if (!ids.includes(s.id)) continue;
        for (const a of s.answers || []) {
          if (typeof a?.evaluation?.overall_score === "number") {
            scores.push(a.evaluation.overall_score);
          }
        }
      }
    } catch (e) {}
    if (scores.length === 0) return 0;
    return Math.round(scores.reduce((s, x) => s + x, 0) / scores.length);
  })();
  let mySessionIds = [];
  try {
    mySessionIds = JSON.parse(localStorage.getItem("interviewSessionIds") || "[]");
  } catch (e) {
    mySessionIds = [];
  }
  const completedHistory = (history || []).filter(
    (s) =>
      mySessionIds.includes(s.id) &&
      (s.answers || []).length > 0 &&
      s.evaluated_at
  );

  return (
    <div
      data-testid="dashboard-page"
      className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900"
    >
      {/* Decorative glow blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -right-32 w-96 h-96 bg-pink-500/20 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <div className="relative border-b border-purple-500/20 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/15 border border-purple-400/30 text-purple-200 text-xs font-semibold tracking-wide uppercase">
              <Sparkles className="h-3.5 w-3.5" />
              Performance Insights
            </div>
            <h1 className="mt-4 text-4xl sm:text-5xl lg:text-6xl font-bold text-white tracking-tight">
              Your{" "}
              <span className="bg-gradient-to-r from-purple-300 via-pink-300 to-purple-400 bg-clip-text text-transparent">
                Interview Dashboard
              </span>
            </h1>
            <p className="text-slate-300 mt-3 text-base sm:text-lg max-w-2xl">
              Track progress, spot weak areas, and turn every mock into measurable growth.
            </p>
          </motion.div>
        </div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Bento Stats */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-12">
          {/* Average Score */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="md:col-span-5"
          >
            <Card
              data-testid="avg-score-card"
              className="relative overflow-hidden p-8 h-full border-purple-500/30 bg-gradient-to-br from-purple-600/30 via-pink-600/20 to-slate-900/60 backdrop-blur-sm text-white shadow-2xl shadow-purple-500/20"
            >
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-pink-500/20 rounded-full blur-2xl" />
              <div className="relative">
                <BarChart3 className="h-8 w-8 mb-4 text-purple-200" />
                <p className="text-xs uppercase tracking-[0.2em] mb-2 text-purple-200/90">
                  Average Score
                </p>
                <div
                  className={`text-6xl sm:text-7xl font-bold mb-2 bg-gradient-to-r ${getScoreGradient(
                    avgScore
                  )} bg-clip-text text-transparent`}
                >
                  {avgScore}%
                </div>
                <p className="text-sm text-slate-300">Across all interviews</p>
              </div>
            </Card>
          </motion.div>

          {/* Trend */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08 }}
            className="md:col-span-4"
          >
            <Card className="p-8 h-full border-purple-500/20 bg-slate-800/60 backdrop-blur-sm text-white">
              <div className="flex items-center justify-between mb-4">
                <Target className="h-8 w-8 text-purple-300" />
                {getTrendIcon(analytics?.improvement_trend || "Stable")}
              </div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400 mb-2">
                Trend
              </p>
              <div className="text-3xl font-bold text-white">
                {analytics?.improvement_trend || "No data"}
              </div>
            </Card>
          </motion.div>

          {/* Total Interviews */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.16 }}
            className="md:col-span-3"
          >
            <Card className="p-8 h-full border-purple-500/20 bg-slate-800/60 backdrop-blur-sm text-white">
              <Brain className="h-8 w-8 text-pink-300 mb-4" />
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400 mb-2">
                Interviews
              </p>
              <div className="text-3xl font-bold text-white">{completedHistory.length}</div>
            </Card>
          </motion.div>
        </div>

        {/* Strong & Weak (only after user has completed at least one interview) */}
        {completedHistory.length > 0 && (
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Card className="p-8 border-emerald-500/20 bg-slate-800/60 backdrop-blur-sm text-white">
              <div className="flex items-center gap-2 mb-6">
                <Trophy className="h-6 w-6 text-emerald-300" />
                <h2 className="text-2xl font-semibold">Strong Areas</h2>
              </div>
              {analytics?.strong_areas && analytics.strong_areas.length > 0 ? (
                <div className="space-y-3">
                  {analytics.strong_areas.map((area, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg"
                    >
                      <span className="text-emerald-300 font-bold">✓</span>
                      <span className="text-slate-200 flex-1">{area}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-400">Complete interviews to surface your strengths.</p>
              )}
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Card className="p-8 border-rose-500/20 bg-slate-800/60 backdrop-blur-sm text-white">
              <div className="flex items-center gap-2 mb-6">
                <Flame className="h-6 w-6 text-rose-300" />
                <h2 className="text-2xl font-semibold">Areas to Improve</h2>
              </div>
              {analytics?.weak_areas && analytics.weak_areas.length > 0 ? (
                <div className="space-y-3">
                  {analytics.weak_areas.map((area, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg"
                    >
                      <span className="text-rose-300 font-bold">•</span>
                      <span className="text-slate-200 flex-1">{area}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-400">Complete interviews to identify improvement areas.</p>
              )}
            </Card>
          </motion.div>
        </div>
        )}

        {/* Recommended Focus */}
        {completedHistory.length > 0 && analytics?.recommended_focus_topics && analytics.recommended_focus_topics.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-12"
          >
            <Card className="p-8 border-purple-500/20 bg-slate-800/60 backdrop-blur-sm text-white">
              <div className="flex items-center gap-2 mb-6">
                <Award className="h-6 w-6 text-purple-300" />
                <h2 className="text-2xl font-semibold">Recommended Focus Topics</h2>
              </div>
              <div className="flex flex-wrap gap-3">
                {analytics.recommended_focus_topics.map((topic, idx) => (
                  <span
                    key={idx}
                    className="px-4 py-2 bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-400/30 text-purple-100 rounded-lg font-medium"
                  >
                    {topic}
                  </span>
                ))}
              </div>
            </Card>
          </motion.div>
        )}

        {/* History */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="p-8 border-purple-500/20 bg-slate-800/60 backdrop-blur-sm text-white">
            <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-purple-300" />
              Interview History
            </h2>
            {(() => {
              const completed = (history || []).filter(
                (s) => (s.answers || []).length > 0 && s.evaluated_at
              );
              if (completed.length === 0) {
                return (
                  <div className="text-center py-12">
                    <Brain className="h-16 w-16 mx-auto text-purple-300/50 mb-4" />
                    <p className="text-slate-400 mb-4">No completed interviews yet.</p>
                    <Button
                      data-testid="start-first-interview-btn"
                      onClick={() => navigate("/analyze")}
                      className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
                    >
                      Start Your First Interview
                    </Button>
                  </div>
                );
              }
              return (
                <div className="space-y-4">
                  {completed.slice(0, 10).map((session, idx) => {
                    const answers = session.answers || [];
                    const avg =
                      answers.length > 0
                        ? Math.round(
                            answers.reduce(
                              (sum, a) => sum + (a.evaluation?.overall_score || 0),
                              0
                            ) / answers.length
                          )
                        : 0;

                    return (
                      <div
                        key={session.id || idx}
                        data-testid={`history-row-${idx}`}
                        className="flex items-center justify-between p-4 bg-slate-900/60 border border-purple-500/10 rounded-lg hover:border-purple-400/40 transition-colors cursor-pointer"
                        onClick={() => navigate(`/results/${session.id}`)}
                      >
                        <div className="flex-1">
                          <h3 className="font-semibold text-white">{session.job_title}</h3>
                          <p className="text-sm text-slate-400">
                            {session.experience_level} • {answers.length} questions answered
                          </p>
                        </div>
                        <div className="text-right">
                          <div
                            className={`text-2xl font-bold bg-gradient-to-r ${getScoreGradient(
                              avg
                            )} bg-clip-text text-transparent`}
                          >
                            {avg}%
                          </div>
                          <p className="text-xs text-slate-500">
                            {new Date(session.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </Card>
        </motion.div>

        {completedHistory.length > 0 && (
          <div className="mt-8 text-center">
            <Button
              data-testid="new-interview-btn"
              onClick={() => navigate("/analyze")}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-8 py-6 text-lg shadow-lg shadow-purple-500/30"
            >
              Start New Interview
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
