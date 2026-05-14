import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Briefcase, GraduationCap, Sparkles } from "lucide-react";
import { toast } from "sonner";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function InterviewSetup() {
  const navigate = useNavigate();
  const location = useLocation();
  const analysisResult = location.state?.analysisResult;

  const [jobTitle, setJobTitle] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("");
  const [loading, setLoading] = useState(false);

  const handleStartInterview = async () => {
    if (!jobTitle || !experienceLevel) {
      toast.error("Please fill all fields");
      return;
    }

    if (!analysisResult) {
      toast.error("Please complete resume analysis first");
      navigate("/analyze");
      return;
    }

    setLoading(true);
    try {
      // Generate questions
      const questionsResponse = await axios.post(`${API}/generate-questions`, {
        extracted_skills: analysisResult.matching_skills || [],
        missing_skills: analysisResult.missing_skills || [],
        job_title: jobTitle,
        experience_level: experienceLevel,
      });

      // Create interview session
      const sessionResponse = await axios.post(`${API}/interview-session`, {
        job_title: jobTitle,
        experience_level: experienceLevel,
        questions: questionsResponse.data,
      });

      toast.success("Interview session created!");
      navigate(`/interview/${sessionResponse.data.id}`);
    } catch (error) {
      console.error("Error setting up interview:", error);
      toast.error("Failed to setup interview. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-pink-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 text-white py-16 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
        
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full mb-4">
              <Sparkles className="h-4 w-4" />
              <span className="text-sm font-semibold">Personalized Interview</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-3" style={{ fontFamily: 'Poppins, sans-serif' }}>
              Interview Setup
            </h1>
            <p className="text-xl text-white/90">
              Customize your mock interview experience
            </p>
          </motion.div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <Card className="p-8 bg-white/80 backdrop-blur-sm shadow-xl border-0">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-slate-800 mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
                Tell us about the role
              </h2>
              <p className="text-slate-600">
                We'll generate personalized interview questions based on your input
              </p>
            </div>

            <div className="space-y-6">
              {/* Job Title */}
              <div>
                <Label htmlFor="job-title" className="text-slate-700 font-semibold mb-3 flex items-center gap-2">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Briefcase className="h-4 w-4 text-purple-600" />
                  </div>
                  Job Title
                </Label>
                <Input
                  data-testid="job-title-input"
                  id="job-title"
                  placeholder="e.g., Senior Software Engineer"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  className="mt-2 border-2 border-slate-200 focus:border-purple-400 rounded-xl py-6 text-base"
                />
              </div>

              {/* Experience Level */}
              <div>
                <Label htmlFor="experience" className="text-slate-700 font-semibold mb-3 flex items-center gap-2">
                  <div className="p-2 bg-pink-100 rounded-lg">
                    <GraduationCap className="h-4 w-4 text-pink-600" />
                  </div>
                  Experience Level
                </Label>
                <Select value={experienceLevel} onValueChange={setExperienceLevel}>
                  <SelectTrigger data-testid="experience-level-select" className="mt-2 border-2 border-slate-200 focus:border-purple-400 rounded-xl py-6 text-base">
                    <SelectValue placeholder="Select your experience level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fresher">Fresher (0-1 years)</SelectItem>
                    <SelectItem value="intermediate">Intermediate (2-5 years)</SelectItem>
                    <SelectItem value="experienced">Experienced (5+ years)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* ATS Summary */}
              {analysisResult && (
                <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border-2 border-purple-200">
                  <h3 className="font-bold text-slate-800 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
                    Your Resume Analysis Summary
                  </h3>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-3xl font-bold text-purple-600" style={{ fontFamily: 'Poppins, sans-serif' }}>{analysisResult.ats_score}%</p>
                      <p className="text-sm text-slate-600 mt-1">ATS Score</p>
                    </div>
                    <div>
                      <p className="text-3xl font-bold text-green-600" style={{ fontFamily: 'Poppins, sans-serif' }}>{analysisResult.matching_skills?.length || 0}</p>
                      <p className="text-sm text-slate-600 mt-1">Matching Skills</p>
                    </div>
                    <div>
                      <p className="text-3xl font-bold text-red-600" style={{ fontFamily: 'Poppins, sans-serif' }}>{analysisResult.missing_skills?.length || 0}</p>
                      <p className="text-sm text-slate-600 mt-1">Missing Skills</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-8 flex gap-4">
              <Button
                data-testid="back-btn"
                onClick={() => navigate("/analyze")}
                variant="outline"
                className="flex-1 py-6 text-lg border-2 rounded-xl"
              >
                Back
              </Button>
              <Button
                data-testid="start-interview-btn"
                onClick={handleStartInterview}
                disabled={loading}
                className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-6 rounded-xl text-lg shadow-lg hover:shadow-xl transition-all"
              >
                {loading ? (
                  <>
                    <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full mr-2" />
                    Setting up...
                  </>
                ) : (
                  "Start Interview"
                )}
              </Button>
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
