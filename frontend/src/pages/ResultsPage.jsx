import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Trophy, TrendingUp, Home, BarChart3 } from "lucide-react";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function ResultsPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadResults();
  }, [sessionId]);

  const loadResults = async () => {
    try {
      const response = await axios.get(`${API}/interview-session/${sessionId}`);
      setSession(response.data);
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
          <Card className="p-12 text-center">
            <p className="text-sm font-medium text-slate-600 uppercase tracking-wider mb-2">
              Overall Performance
            </p>
            <div className={`text-7xl font-heading font-bold ${getScoreColor(averageScore)} mb-4`}>
              {Math.round(averageScore)}%
            </div>
            <p className="text-slate-600">
              Based on {answers.length} questions answered
            </p>
          </Card>
        </motion.div>

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
                <Card className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-lg font-semibold text-secondary flex-1">
                      Question {answer.question_index + 1}
                    </h3>
                    <div className={`text-2xl font-bold ${getScoreColor(evaluation.overall_score || 0)}`}>
                      {Math.round(evaluation.overall_score || 0)}%
                    </div>
                  </div>

                  {/* Scoring Breakdown */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Technical</p>
                      <div className="flex items-center">
                        <div className="flex-1 bg-slate-200 rounded-full h-2 mr-2">
                          <div
                            className="bg-primary h-2 rounded-full transition-all"
                            style={{ width: `${(evaluation.technical_accuracy || 0) * 10}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium">{evaluation.technical_accuracy || 0}/10</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Depth</p>
                      <div className="flex items-center">
                        <div className="flex-1 bg-slate-200 rounded-full h-2 mr-2">
                          <div
                            className="bg-violet-600 h-2 rounded-full transition-all"
                            style={{ width: `${(evaluation.depth || 0) * 10}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium">{evaluation.depth || 0}/10</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Clarity</p>
                      <div className="flex items-center">
                        <div className="flex-1 bg-slate-200 rounded-full h-2 mr-2">
                          <div
                            className="bg-accent h-2 rounded-full transition-all"
                            style={{ width: `${(evaluation.clarity || 0) * 10}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium">{evaluation.clarity || 0}/10</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Confidence</p>
                      <div className="flex items-center">
                        <div className="flex-1 bg-slate-200 rounded-full h-2 mr-2">
                          <div
                            className="bg-orange-500 h-2 rounded-full transition-all"
                            style={{ width: `${(evaluation.confidence || 0) * 10}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium">{evaluation.confidence || 0}/10</span>
                      </div>
                    </div>
                  </div>

                  {/* Strengths & Weaknesses */}
                  {evaluation.strengths && evaluation.strengths.length > 0 && (
                    <div className="mb-3">
                      <p className="text-sm font-semibold text-accent mb-1">Strengths:</p>
                      <ul className="text-sm text-slate-600 space-y-1">
                        {evaluation.strengths.map((s, i) => (
                          <li key={i} className="flex items-start gap-1">
                            <span className="text-accent">✓</span>
                            <span>{s}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {evaluation.weaknesses && evaluation.weaknesses.length > 0 && (
                    <div className="mb-3">
                      <p className="text-sm font-semibold text-destructive mb-1">Areas to Improve:</p>
                      <ul className="text-sm text-slate-600 space-y-1">
                        {evaluation.weaknesses.map((w, i) => (
                          <li key={i} className="flex items-start gap-1">
                            <span className="text-destructive">•</span>
                            <span>{w}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Model Answer */}
                  {evaluation.model_answer && (
                    <div className="bg-slate-50 rounded-lg p-4 mt-4">
                      <p className="text-sm font-semibold text-slate-700 mb-2">Model Answer:</p>
                      <p className="text-sm text-slate-600">{evaluation.model_answer}</p>
                    </div>
                  )}
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
            className="px-8 py-6 text-lg"
          >
            <Home className="mr-2 h-5 w-5" />
            Go Home
          </Button>
          <Button
            data-testid="dashboard-btn"
            onClick={() => navigate("/dashboard")}
            className="bg-primary hover:bg-primary/90 text-white px-8 py-6 text-lg"
          >
            <BarChart3 className="mr-2 h-5 w-5" />
            View Analytics
          </Button>
          <Button
            data-testid="new-interview-btn"
            onClick={() => navigate("/analyze")}
            className="bg-accent hover:bg-accent/90 text-white px-8 py-6 text-lg"
          >
            <TrendingUp className="mr-2 h-5 w-5" />
            Start New Interview
          </Button>
        </div>
      </div>
    </div>
  );
}
