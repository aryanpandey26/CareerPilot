import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Upload, FileText, TrendingUp, CheckCircle2, AlertCircle, ArrowRight, Sparkles } from "lucide-react";
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
    if (inputMode === "pdf") {
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
    } else {
      // Text mode
      if (!resumeText.trim() || !jobDescription.trim()) {
        toast.error("Please enter both resume text and job description");
        return;
      }

      setAnalyzing(true);
      try {
        const response = await axios.post(`${API}/analyze-resume-text`, {
          resume_text: resumeText,
          job_description: jobDescription,
        });

        setResult(response.data);
        toast.success("Analysis complete!");
      } catch (error) {
        console.error("Error analyzing resume:", error);
        toast.error("Failed to analyze resume. Please try again.");
      } finally {
        setAnalyzing(false);
      }
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-pink-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 text-white py-16 relative overflow-hidden">
        {/* Animated background circles */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full mb-4">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm font-semibold">Powered by AI</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-3" style={{ fontFamily: 'Poppins, sans-serif' }}>
              ATS Resume Analyzer
            </h1>
            <p className="text-xl text-white/90">
              Optimize your resume for Applicant Tracking Systems
            </p>
          </motion.div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left: Input Section */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="w-full"
          >
            <Card className="p-8 bg-white/80 backdrop-blur-sm shadow-xl border-0">
              <h2 className="text-2xl font-bold text-slate-800 mb-6" style={{ fontFamily: 'Poppins, sans-serif' }}>
                Upload Your Details
              </h2>

              {/* Input Mode Toggle */}
              <div className="mb-6 flex gap-3">
                <Button
                  data-testid="text-mode-btn"
                  onClick={() => setInputMode("text")}
                  className={`flex-1 rounded-xl py-6 text-base font-semibold transition-all ${
                    inputMode === "text"
                      ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  <FileText className="mr-2 h-5 w-5" />
                  Paste Text
                </Button>
                <Button
                  data-testid="pdf-mode-btn"
                  onClick={() => setInputMode("pdf")}
                  className={`flex-1 rounded-xl py-6 text-base font-semibold transition-all ${
                    inputMode === "pdf"
                      ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  <Upload className="mr-2 h-5 w-5" />
                  Upload PDF
                </Button>
              </div>

              {/* Resume Input - Text or PDF */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-slate-700 mb-3">
                  {inputMode === "pdf" ? "Resume (PDF)" : "Resume Text"}
                </label>
                {inputMode === "pdf" ? (
                  <div className="border-2 border-dashed border-purple-300 rounded-xl p-8 text-center hover:border-purple-400 transition-colors cursor-pointer bg-purple-50/50">
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
                        <div className="text-purple-600">
                          <FileText className="h-12 w-12 mx-auto mb-3" />
                          <p className="font-semibold text-lg">{resumeFile.name}</p>
                          <p className="text-sm text-slate-500 mt-1">Click to change</p>
                        </div>
                      ) : (
                        <div className="text-slate-500">
                          <Upload className="h-12 w-12 mx-auto mb-3 text-purple-400" />
                          <p className="font-semibold text-slate-700">Click to upload resume</p>
                          <p className="text-sm mt-1">PDF format only</p>
                        </div>
                      )}
                    </label>
                  </div>
                ) : (
                  <Textarea
                    data-testid="resume-text-input"
                    placeholder="Paste your resume text here...

Example:
John Doe
Full Stack Developer

Skills: Python, JavaScript, React, Node.js, FastAPI, MongoDB

Experience:
- Senior Developer at Tech Corp (2020-2024)
- Built scalable web applications"
                    value={resumeText}
                    onChange={(e) => setResumeText(e.target.value)}
                    rows={12}
                    className="w-full font-mono text-sm border-2 border-slate-200 focus:border-purple-400 rounded-xl"
                  />
                )}
              </div>

              {/* Job Description */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-slate-700 mb-3">
                  Job Description
                </label>
                <Textarea
                  data-testid="job-description-input"
                  placeholder="Paste the job description here..."
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  rows={10}
                  className="w-full border-2 border-slate-200 focus:border-purple-400 rounded-xl"
                />
              </div>

              <Button
                data-testid="analyze-btn"
                onClick={handleAnalyze}
                disabled={analyzing}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-6 rounded-xl text-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-[1.02]"
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
            className="w-full"
          >
            {result ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-6">
                  {/* ATS Score */}
                  <Card className="p-8 bg-gradient-to-br from-purple-50 to-pink-50 border-0 shadow-xl">
                    <div className="text-center">
                      <p className="text-sm font-semibold text-purple-600 uppercase tracking-wider mb-3">
                        ATS Match Score
                      </p>
                      <div className={`text-7xl font-bold mb-3 ${getScoreColor(result.ats_score)}`} style={{ fontFamily: 'Poppins, sans-serif' }}>
                        {result.ats_score}%
                      </div>
                      <p className={`text-lg font-semibold ${getScoreColor(result.ats_score)}`}>
                        {getScoreLabel(result.ats_score)}
                      </p>
                    </div>
                  </Card>

                  {/* Skills Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Matching Skills */}
                    {result.matching_skills.length > 0 && (
                      <Card className="p-6 bg-white/80 backdrop-blur-sm shadow-lg border-0">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="p-2 bg-green-100 rounded-lg">
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                          </div>
                          <h3 className="text-lg font-bold text-slate-800" style={{ fontFamily: 'Poppins, sans-serif' }}>
                            Matching Skills
                          </h3>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {result.matching_skills.map((skill, idx) => (
                            <span
                              key={idx}
                              className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-full text-sm font-semibold shadow-md"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      </Card>
                    )}

                    {/* Missing Skills */}
                    {result.missing_skills.length > 0 && (
                      <Card className="p-6 bg-white/80 backdrop-blur-sm shadow-lg border-0">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="p-2 bg-red-100 rounded-lg">
                            <AlertCircle className="h-5 w-5 text-red-600" />
                          </div>
                          <h3 className="text-lg font-bold text-slate-800" style={{ fontFamily: 'Poppins, sans-serif' }}>
                            Missing Skills
                          </h3>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {result.missing_skills.map((skill, idx) => (
                            <span
                              key={idx}
                              className="px-4 py-2 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-full text-sm font-semibold shadow-md"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      </Card>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <Card className="p-12 text-center bg-white/80 backdrop-blur-sm shadow-xl border-0">
                <div className="mb-6">
                  <div className="inline-flex p-4 bg-gradient-to-br from-purple-100 to-pink-100 rounded-2xl">
                    <TrendingUp className="h-16 w-16 text-purple-600" />
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-slate-800 mb-3" style={{ fontFamily: 'Poppins, sans-serif' }}>
                  Results will appear here
                </h3>
                <p className="text-slate-600 text-lg">
                  Upload your resume and job description to get started
                </p>
              </Card>
            )}
          </motion.div>
        </div>

        {/* Improvement Suggestions — full-width, expanded layout */}
        {result && result.improvement_suggestions?.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-10 w-full"
          >
            <Card
              data-testid="improvement-suggestions"
              className="p-8 md:p-12 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 border border-purple-500/30 shadow-2xl shadow-purple-500/20 w-full overflow-hidden relative"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-pink-500/20 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl shadow-lg">
                    <TrendingUp className="h-6 w-6 text-white" />
                  </div>
                  <h3
                    className="text-3xl sm:text-4xl font-bold text-white"
                    style={{ fontFamily: 'Poppins, sans-serif' }}
                  >
                    Improvement Suggestions
                  </h3>
                </div>
                <p className="text-slate-300 text-base mb-8 max-w-2xl">
                  Actionable, high-impact changes to lift your ATS match score and land more interviews.
                </p>

                <div className="space-y-4 w-full">
                  {result.improvement_suggestions.map((suggestion, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.4, delay: idx * 0.08 }}
                      className="group relative flex items-start gap-5 px-6 py-5 sm:px-8 sm:py-6 rounded-2xl border border-purple-400/30 bg-gradient-to-r from-purple-500/10 via-purple-500/5 to-pink-500/10 hover:from-purple-500/20 hover:to-pink-500/20 hover:border-purple-300/50 transition-all duration-300 w-full"
                    >
                      <div
                        className="flex-shrink-0 w-11 h-11 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center text-white font-bold text-base shadow-lg group-hover:scale-110 transition-transform"
                        style={{ fontFamily: 'Poppins, sans-serif' }}
                      >
                        {idx + 1}
                      </div>
                      <p className="text-slate-100 text-base sm:text-lg leading-relaxed flex-1 pt-1">
                        {suggestion}
                      </p>
                    </motion.div>
                  ))}
                </div>

                <div className="mt-8 px-6 py-5 rounded-2xl border border-purple-400/30 bg-gradient-to-r from-purple-500/15 to-pink-500/15">
                  <div className="flex items-start gap-4">
                    <Sparkles className="h-6 w-6 text-pink-300 shrink-0 mt-1" />
                    <div>
                      <p className="text-sm font-bold text-pink-200 mb-1 uppercase tracking-wider">
                        Pro Tip
                      </p>
                      <p className="text-slate-200 text-sm sm:text-base">
                        Applying these changes can raise your ATS score by{" "}
                        <span className="font-bold text-pink-300">15–25%</span>{" "}
                        and noticeably improve callback rates.
                      </p>
                    </div>
                  </div>
                </div>

                <Button
                  data-testid="proceed-to-interview-btn"
                  onClick={() => navigate("/setup", { state: { analysisResult: result } })}
                  className="mt-8 w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-6 rounded-xl text-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-[1.01]"
                >
                  Proceed to Interview Setup
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </div>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
}
