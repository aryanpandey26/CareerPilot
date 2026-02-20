import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Briefcase, GraduationCap } from "lucide-react";
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-secondary text-white py-8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl md:text-4xl font-heading font-bold tracking-tight uppercase">
            INTERVIEW SETUP
          </h1>
          <p className="text-slate-300 mt-2">
            Customize your mock interview experience
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <Card className="p-8">
            <div className="mb-8">
              <h2 className="text-2xl font-semibold text-secondary mb-2">
                Tell us about the role
              </h2>
              <p className="text-slate-600">
                We'll generate personalized interview questions based on your input
              </p>
            </div>

            <div className="space-y-6">
              {/* Job Title */}
              <div>
                <Label htmlFor="job-title" className="text-slate-700 font-medium mb-2 flex items-center gap-2">
                  <Briefcase className="h-4 w-4" />
                  Job Title
                </Label>
                <Input
                  data-testid="job-title-input"
                  id="job-title"
                  placeholder="e.g., Senior Software Engineer"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  className="mt-2"
                />
              </div>

              {/* Experience Level */}
              <div>
                <Label htmlFor="experience" className="text-slate-700 font-medium mb-2 flex items-center gap-2">
                  <GraduationCap className="h-4 w-4" />
                  Experience Level
                </Label>
                <Select value={experienceLevel} onValueChange={setExperienceLevel}>
                  <SelectTrigger data-testid="experience-level-select" className="mt-2">
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
                <div className="bg-slate-50 rounded-lg p-6 border border-slate-200">
                  <h3 className="font-semibold text-secondary mb-3">
                    Your Resume Analysis Summary
                  </h3>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-primary">{analysisResult.ats_score}%</p>
                      <p className="text-sm text-slate-600">ATS Score</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-accent">{analysisResult.matching_skills?.length || 0}</p>
                      <p className="text-sm text-slate-600">Matching Skills</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-destructive">{analysisResult.missing_skills?.length || 0}</p>
                      <p className="text-sm text-slate-600">Missing Skills</p>
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
                className="flex-1 py-6 text-lg"
              >
                Back
              </Button>
              <Button
                data-testid="start-interview-btn"
                onClick={handleStartInterview}
                disabled={loading}
                className="flex-1 bg-primary hover:bg-primary/90 text-white font-medium py-6 rounded-md text-lg"
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
