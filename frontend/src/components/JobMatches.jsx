import { useState } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Briefcase,
  Sparkles,
  TrendingUp,
  ExternalLink,
  Loader2,
  Target,
  Rocket,
} from "lucide-react";
import axios from "axios";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function JobMatches({ analysis, jobTitle = "", experienceLevel = "", location = "India" }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("current");

  const fetchJobs = async () => {
    if (!analysis) {
      toast.error("Run a resume analysis first.");
      return;
    }
    setLoading(true);
    try {
      const res = await axios.post(`${API}/jobs/recommend`, {
        matching_skills: analysis.matching_skills || [],
        missing_skills: analysis.missing_skills || [],
        job_title: jobTitle,
        experience_level: experienceLevel,
        location,
      });
      setData(res.data);
    } catch (err) {
      console.error("Job-recommend error:", err);
      const status = err?.response?.status;
      if (status === 401) {
        toast.error("Please sign in to see job matches.");
      } else if (status === 429) {
        toast.error(
          err?.response?.data?.detail ||
            "You're going fast — try again in a bit (limit: 5/hour)."
        );
      } else {
        toast.error("Couldn't fetch job recommendations. Try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (!data && !loading) {
    return (
      <Card
        data-testid="job-matches-cta"
        className="p-8 sm:p-10 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 border border-purple-500/30 shadow-2xl shadow-purple-500/20 relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-pink-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl shadow-lg shrink-0">
              <Briefcase className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3
                className="text-2xl sm:text-3xl font-bold text-white"
                style={{ fontFamily: "Poppins, sans-serif" }}
              >
                Find jobs that match your resume
              </h3>
              <p className="text-slate-300 text-sm sm:text-base mt-2 max-w-2xl">
                Get two curated buckets: roles you can apply for{" "}
                <span className="text-purple-200 font-semibold">today</span>, and roles unlocked
                if you fill the <span className="text-pink-200 font-semibold">missing skills</span>.
              </p>
            </div>
          </div>
          <Button
            data-testid="fetch-jobs-btn"
            onClick={fetchJobs}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold px-6 py-6 rounded-xl shadow-lg"
          >
            <Sparkles className="mr-2 h-5 w-5" />
            Show me matches
          </Button>
        </div>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="p-12 bg-slate-900/70 border-purple-500/30 text-center">
        <div className="relative inline-block">
          <Loader2 className="h-12 w-12 text-purple-300 animate-spin" />
          <Sparkles className="absolute inset-0 m-auto h-6 w-6 text-pink-300 animate-pulse" />
        </div>
        <p className="mt-4 text-slate-200 font-medium">Curating job matches…</p>
        <p className="text-slate-400 text-sm">Scoring openings against your resume.</p>
      </Card>
    );
  }

  const list = tab === "current" ? data?.current_match || [] : data?.stretch || [];

  return (
    <div data-testid="job-matches-results" className="space-y-6">
      {/* Tabs */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="inline-flex bg-slate-800/60 border border-purple-500/20 rounded-xl p-1">
          <button
            type="button"
            data-testid="jobs-tab-current"
            onClick={() => setTab("current")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${
              tab === "current"
                ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow"
                : "text-slate-300 hover:text-white"
            }`}
          >
            <Target className="h-4 w-4" />
            Apply today ({data?.current_match?.length || 0})
          </button>
          <button
            type="button"
            data-testid="jobs-tab-stretch"
            onClick={() => setTab("stretch")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${
              tab === "stretch"
                ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow"
                : "text-slate-300 hover:text-white"
            }`}
          >
            <Rocket className="h-4 w-4" />
            Unlock with skills ({data?.stretch?.length || 0})
          </button>
        </div>
        <Button
          variant="ghost"
          data-testid="refresh-jobs-btn"
          onClick={fetchJobs}
          className="text-purple-300 hover:text-purple-200 hover:bg-purple-500/10"
        >
          <Sparkles className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Tab description */}
      <div className="p-4 rounded-xl border border-purple-500/20 bg-slate-900/40">
        {tab === "current" ? (
          <p className="text-sm text-slate-300">
            <span className="font-semibold text-purple-200">Roles you can apply for today.</span>{" "}
            Each listing is matched against the skills already on your resume.
          </p>
        ) : (
          <p className="text-sm text-slate-300">
            <span className="font-semibold text-pink-200">Stretch roles unlocked by filling gaps.</span>{" "}
            Add the listed missing skills and your match score jumps significantly.
          </p>
        )}
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {list.map((job, idx) => {
          const score = Math.round(job.match_score || 0);
          const scoreColor =
            score >= 80
              ? "from-emerald-400 to-green-500"
              : score >= 60
              ? "from-amber-400 to-orange-500"
              : "from-rose-400 to-red-500";

          return (
            <motion.div
              key={`${tab}-${idx}`}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: idx * 0.05 }}
              data-testid={`job-card-${tab}-${idx}`}
            >
              <Card className="p-6 h-full bg-slate-800/60 backdrop-blur-sm border-purple-500/20 hover:border-purple-400/50 transition-colors">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <h4 className="text-lg font-bold text-white leading-tight">{job.role}</h4>
                    <p className="text-sm text-purple-200 font-medium">{job.company}</p>
                  </div>
                  <div className="text-right">
                    <div
                      className={`text-2xl font-bold bg-gradient-to-r ${scoreColor} bg-clip-text text-transparent`}
                    >
                      {score}%
                    </div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400">Match</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 text-xs text-slate-300 mb-4">
                  <span className="px-2 py-1 rounded-md bg-slate-900/60 border border-purple-500/15">
                    📍 {job.location || "Remote"}
                  </span>
                  {job.experience && (
                    <span className="px-2 py-1 rounded-md bg-slate-900/60 border border-purple-500/15">
                      🧑‍💼 {job.experience}
                    </span>
                  )}
                  {job.salary_range && (
                    <span className="px-2 py-1 rounded-md bg-slate-900/60 border border-purple-500/15">
                      💰 {job.salary_range}
                    </span>
                  )}
                </div>

                <p className="text-sm text-slate-300 mb-4">
                  {tab === "current" ? job.why_match : job.why_stretch}
                </p>

                {tab === "stretch" && job.missing_skills_needed?.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-pink-200 mb-2">
                      Skills you'd need to add
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {job.missing_skills_needed.map((s, i) => (
                        <span
                          key={`miss-${i}-${s}`}
                          className="px-2.5 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-pink-500/20 to-purple-500/20 border border-pink-400/30 text-pink-100"
                        >
                          + {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {job.key_skills_used?.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-purple-200 mb-2">
                      Key skills used
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {job.key_skills_used.slice(0, 6).map((s, i) => (
                        <span
                          key={`used-${i}-${s}`}
                          className="px-2.5 py-1 rounded-full text-xs font-medium bg-purple-500/15 border border-purple-400/30 text-purple-100"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-3 border-t border-purple-500/15">
                  {job.apply_links?.naukri && (
                    <a
                      href={job.apply_links.naukri}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid={`apply-naukri-${tab}-${idx}`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-purple-200 hover:text-white"
                    >
                      Naukri <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  {job.apply_links?.linkedin && (
                    <a
                      href={job.apply_links.linkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid={`apply-linkedin-${tab}-${idx}`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-purple-200 hover:text-white"
                    >
                      LinkedIn <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  {job.apply_links?.indeed && (
                    <a
                      href={job.apply_links.indeed}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid={`apply-indeed-${tab}-${idx}`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-purple-200 hover:text-white"
                    >
                      Indeed <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  {job.apply_links?.unstop && (
                    <a
                      href={job.apply_links.unstop}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid={`apply-unstop-${tab}-${idx}`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-purple-200 hover:text-white"
                    >
                      Unstop <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <div className="text-xs text-slate-500 italic">
        <TrendingUp className="inline h-3 w-3 mr-1" />
        Listings are AI-curated and link to a pre-filled search on each job board. Verify before applying.
      </div>
    </div>
  );
}
