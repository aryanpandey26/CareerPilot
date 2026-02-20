import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Upload, FileText, TrendingUp, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function ResumeAnalyzer() {
  const navigate = useNavigate();
  const [resumeFile, setResumeFile] = useState(null);
  const [resumeText, setResumeText] = useState("");
  const [inputMode, setInputMode] = useState("text"); // "text" or "pdf"
  const [jobDescription, setJobDescription] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type === "application/pdf") {
      setResumeFile(file);
      toast.success("Resume uploaded successfully");
    } else {
      toast.error("Please upload a PDF file");
    }
  };

  const handleAnalyze = async () => {
    if (!resumeFile || !jobDescription.trim()) {
      toast.error("Please upload resume and enter job description");
      return;
    }

    setAnalyzing(true);
    try {
      const formData = new FormData();
      formData.append("resume", resumeFile);
      formData.append("job_description", jobDescription);

      const response = await axios.post(`${API}/analyze-resume`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setResult(response.data);
      toast.success("Analysis complete!");
    } catch (error) {
      console.error("Error analyzing resume:", error);
      toast.error("Failed to analyze resume. Please try again.");
    } finally {
      setAnalyzing(false);
    }
  };

  const getScoreColor = (score) => {
    if (score >= 80) return "text-accent";
    if (score >= 60) return "text-orange-500";
    return "text-destructive";
  };

  const getScoreLabel = (score) => {
    if (score >= 80) return "Excellent";
    if (score >= 60) return "Good";
    return "Needs Improvement";
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-secondary text-white py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl md:text-4xl font-heading font-bold tracking-tight uppercase">
            ATS RESUME ANALYZER
          </h1>
          <p className="text-slate-300 mt-2">
            Optimize your resume for Applicant Tracking Systems
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left: Input Section */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Card className="p-8">
              <h2 className="text-2xl font-semibold text-secondary mb-6">
                Upload Your Details
              </h2>

              {/* Resume Upload */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Resume (PDF)
                </label>
                <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer">
                  <input
                    data-testid="resume-upload-input"
                    type="file"
                    accept=".pdf"
                    onChange={handleFileChange}
                    className="hidden"
                    id="resume-upload"
                  />
                  <label htmlFor="resume-upload" className="cursor-pointer">
                    {resumeFile ? (
                      <div className="text-primary">
                        <FileText className="h-12 w-12 mx-auto mb-2" />
                        <p className="font-medium">{resumeFile.name}</p>
                        <p className="text-sm text-slate-500">Click to change</p>
                      </div>
                    ) : (
                      <div className="text-slate-500">
                        <Upload className="h-12 w-12 mx-auto mb-2" />
                        <p className="font-medium">Click to upload resume</p>
                        <p className="text-sm">PDF format only</p>
                      </div>
                    )}
                  </label>
                </div>
              </div>

              {/* Job Description */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Job Description
                </label>
                <Textarea
                  data-testid="job-description-input"
                  placeholder="Paste the job description here..."
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  rows={10}
                  className="w-full"
                />
              </div>

              <Button
                data-testid="analyze-btn"
                onClick={handleAnalyze}
                disabled={analyzing}
                className="w-full bg-primary hover:bg-primary/90 text-white font-medium py-6 rounded-md text-lg"
              >
                {analyzing ? (
                  <>
                    <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full mr-2" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <TrendingUp className="mr-2 h-5 w-5" />
                    Analyze Resume
                  </>
                )}
              </Button>
            </Card>
          </motion.div>

          {/* Right: Results Section */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            {result ? (
              <div className="space-y-6">
                {/* ATS Score */}
                <Card className="p-8">
                  <div className="text-center">
                    <p className="text-sm font-medium text-slate-600 uppercase tracking-wider mb-2">
                      ATS Match Score
                    </p>
                    <div className={`text-6xl font-heading font-bold ${getScoreColor(result.ats_score)} mb-2`}>
                      {result.ats_score}%
                    </div>
                    <p className={`text-lg font-medium ${getScoreColor(result.ats_score)}`}>
                      {getScoreLabel(result.ats_score)}
                    </p>
                  </div>
                </Card>

                {/* Matching Skills */}
                {result.matching_skills.length > 0 && (
                  <Card className="p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <CheckCircle2 className="h-5 w-5 text-accent" />
                      <h3 className="text-lg font-semibold text-secondary">
                        Matching Skills
                      </h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {result.matching_skills.map((skill, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1 bg-accent/10 text-accent rounded-full text-sm font-medium"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </Card>
                )}

                {/* Missing Skills */}
                {result.missing_skills.length > 0 && (
                  <Card className="p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <AlertCircle className="h-5 w-5 text-destructive" />
                      <h3 className="text-lg font-semibold text-secondary">
                        Missing Skills
                      </h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {result.missing_skills.map((skill, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1 bg-destructive/10 text-destructive rounded-full text-sm font-medium"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </Card>
                )}

                {/* Improvement Suggestions */}
                {result.improvement_suggestions.length > 0 && (
                  <Card className="p-6">
                    <h3 className="text-lg font-semibold text-secondary mb-4">
                      Improvement Suggestions
                    </h3>
                    <ul className="space-y-2">
                      {result.improvement_suggestions.map((suggestion, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-primary mt-1">•</span>
                          <span className="text-slate-600">{suggestion}</span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                )}

                {/* Next Step */}
                <Button
                  data-testid="proceed-to-interview-btn"
                  onClick={() => navigate("/setup", { state: { analysisResult: result } })}
                  className="w-full bg-primary hover:bg-primary/90 text-white font-medium py-6 rounded-md text-lg"
                >
                  Proceed to Interview Setup
                </Button>
              </div>
            ) : (
              <Card className="p-12 text-center">
                <TrendingUp className="h-16 w-16 mx-auto text-slate-300 mb-4" />
                <h3 className="text-xl font-semibold text-slate-600 mb-2">
                  Results will appear here
                </h3>
                <p className="text-slate-500">
                  Upload your resume and job description to get started
                </p>
              </Card>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
