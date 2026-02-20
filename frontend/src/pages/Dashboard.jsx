import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus, Target, Brain, Award, BarChart3 } from "lucide-react";
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
    if (trend === "Improving") return <TrendingUp className="h-5 w-5 text-accent" />;
    if (trend === "Declining") return <TrendingDown className="h-5 w-5 text-destructive" />;
    return <Minus className="h-5 w-5 text-slate-400" />;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-lg">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-secondary text-white py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl md:text-4xl font-heading font-bold tracking-tight uppercase">
            PERFORMANCE DASHBOARD
          </h1>
          <p className="text-slate-300 mt-2">
            Track your progress and improve your interview skills
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Bento Grid - Stats */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-12">
          {/* Average Score - Large */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="md:col-span-4"
          >
            <Card className="p-8 h-full bg-gradient-to-br from-indigo-600 to-violet-600 text-white">
              <BarChart3 className="h-8 w-8 mb-4 opacity-80" />
              <p className="text-sm uppercase tracking-wider mb-2 opacity-90">
                Average Score
              </p>
              <div className="text-5xl font-heading font-bold mb-2">
                {Math.round(analytics?.average_score || 0)}%
              </div>
              <p className="text-sm opacity-90">Across all interviews</p>
            </Card>
          </motion.div>

          {/* Improvement Trend */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="md:col-span-4"
          >
            <Card className="p-8 h-full">
              <div className="flex items-center justify-between mb-4">
                <Target className="h-8 w-8 text-primary" />
                {getTrendIcon(analytics?.improvement_trend || "Stable")}
              </div>
              <p className="text-sm uppercase tracking-wider text-slate-600 mb-2">
                Trend
              </p>
              <div className="text-3xl font-heading font-bold text-secondary">
                {analytics?.improvement_trend || "No data"}
              </div>
            </Card>
          </motion.div>

          {/* Total Interviews */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="md:col-span-4"
          >
            <Card className="p-8 h-full">
              <Brain className="h-8 w-8 text-violet-600 mb-4" />
              <p className="text-sm uppercase tracking-wider text-slate-600 mb-2">
                Total Interviews
              </p>
              <div className="text-3xl font-heading font-bold text-secondary">
                {history.length}
              </div>
            </Card>
          </motion.div>
        </div>

        {/* Strong & Weak Areas */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {/* Strong Areas */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Card className="p-8">
              <div className="flex items-center gap-2 mb-6">
                <Award className="h-6 w-6 text-accent" />
                <h2 className="text-2xl font-semibold text-secondary">
                  Strong Areas
                </h2>
              </div>
              {analytics?.strong_areas && analytics.strong_areas.length > 0 ? (
                <div className="space-y-3">
                  {analytics.strong_areas.map((area, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2 p-3 bg-accent/10 rounded-lg"
                    >
                      <span className="text-accent font-bold">✓</span>
                      <span className="text-slate-700 flex-1">{area}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500">Complete interviews to see your strengths</p>
              )}
            </Card>
          </motion.div>

          {/* Weak Areas */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Card className="p-8">
              <div className="flex items-center gap-2 mb-6">
                <Target className="h-6 w-6 text-destructive" />
                <h2 className="text-2xl font-semibold text-secondary">
                  Areas to Improve
                </h2>
              </div>
              {analytics?.weak_areas && analytics.weak_areas.length > 0 ? (
                <div className="space-y-3">
                  {analytics.weak_areas.map((area, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2 p-3 bg-destructive/10 rounded-lg"
                    >
                      <span className="text-destructive font-bold">•</span>
                      <span className="text-slate-700 flex-1">{area}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500">Complete interviews to identify improvement areas</p>
              )}
            </Card>
          </motion.div>
        </div>

        {/* Recommended Focus Topics */}
        {analytics?.recommended_focus_topics && analytics.recommended_focus_topics.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mb-12"
          >
            <Card className="p-8">
              <h2 className="text-2xl font-semibold text-secondary mb-6">
                Recommended Focus Topics
              </h2>
              <div className="flex flex-wrap gap-3">
                {analytics.recommended_focus_topics.map((topic, idx) => (
                  <span
                    key={idx}
                    className="px-4 py-2 bg-primary/10 text-primary rounded-lg font-medium"
                  >
                    {topic}
                  </span>
                ))}
              </div>
            </Card>
          </motion.div>
        )}

        {/* Interview History */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <Card className="p-8">
            <h2 className="text-2xl font-semibold text-secondary mb-6">
              Interview History
            </h2>
            {history.length > 0 ? (
              <div className="space-y-4">
                {history.slice(0, 10).map((session, idx) => {
                  const answers = session.answers || [];
                  const avgScore = answers.length > 0
                    ? Math.round(answers.reduce((sum, a) => sum + (a.evaluation?.overall_score || 0), 0) / answers.length)
                    : 0;

                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                      onClick={() => navigate(`/results/${session.id}`)}
                    >
                      <div className="flex-1">
                        <h3 className="font-semibold text-secondary">
                          {session.job_title}
                        </h3>
                        <p className="text-sm text-slate-600">
                          {session.experience_level} • {answers.length} questions answered
                        </p>
                      </div>
                      <div className="text-right">
                        <div className={`text-2xl font-bold ${
                          avgScore >= 80 ? 'text-accent' :
                          avgScore >= 60 ? 'text-orange-500' :
                          'text-destructive'
                        }`}>
                          {avgScore}%
                        </div>
                        <p className="text-xs text-slate-500">
                          {new Date(session.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <Brain className="h-16 w-16 mx-auto text-slate-300 mb-4" />
                <p className="text-slate-500 mb-4">No interview history yet</p>
                <Button
                  data-testid="start-first-interview-btn"
                  onClick={() => navigate("/analyze")}
                  className="bg-primary hover:bg-primary/90 text-white"
                >
                  Start Your First Interview
                </Button>
              </div>
            )}
          </Card>
        </motion.div>

        {/* Action Button */}
        {history.length > 0 && (
          <div className="mt-8 text-center">
            <Button
              data-testid="new-interview-btn"
              onClick={() => navigate("/analyze")}
              className="bg-primary hover:bg-primary/90 text-white px-8 py-6 text-lg"
            >
              Start New Interview
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
