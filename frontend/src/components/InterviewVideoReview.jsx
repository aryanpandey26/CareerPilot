import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Video, AlertTriangle, CheckCircle, Play } from "lucide-react";
import { motion } from "framer-motion";

export default function InterviewVideoReview({ videoRecordings, cheatingAnalysis }) {
  if (!videoRecordings || videoRecordings.length === 0) {
    return (
      <Card className="p-8 bg-white/80 backdrop-blur-sm border-0 shadow-lg text-center">
        <Video className="h-16 w-16 mx-auto text-slate-300 mb-4" />
        <p className="text-slate-600">No video recordings available for this interview</p>
      </Card>
    );
  }

  const getRiskColor = (level) => {
    switch(level) {
      case 'high': return 'text-red-600';
      case 'medium': return 'text-orange-600';
      default: return 'text-green-600';
    }
  };

  const getRiskBgColor = (level) => {
    switch(level) {
      case 'high': return 'from-red-50 to-orange-50 border-red-200';
      case 'medium': return 'from-orange-50 to-yellow-50 border-orange-200';
      default: return 'from-green-50 to-emerald-50 border-green-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Cheating Analysis Summary */}
      {cheatingAnalysis && (
        <Card className={`p-6 bg-gradient-to-r ${getRiskBgColor(cheatingAnalysis.risk_level)} border-2`}>
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-xl ${cheatingAnalysis.risk_level === 'low' ? 'bg-green-100' : 'bg-red-100'}`}>
              {cheatingAnalysis.risk_level === 'low' ? (
                <CheckCircle className="h-6 w-6 text-green-600" />
              ) : (
                <AlertTriangle className="h-6 w-6 text-red-600" />
              )}
            </div>
            <div className="flex-1">
              <h3 className={`text-lg font-bold mb-2 ${getRiskColor(cheatingAnalysis.risk_level)}`} style={{ fontFamily: 'Poppins, sans-serif' }}>
                Integrity Analysis: {cheatingAnalysis.risk_level.toUpperCase()} Risk
              </h3>
              <p className="text-slate-700 mb-3">
                {cheatingAnalysis.total_warnings === 0 
                  ? "No suspicious activity detected. Great job maintaining interview integrity!"
                  : `${cheatingAnalysis.total_warnings} warning(s) detected during the interview.`}
              </p>
              
              {cheatingAnalysis.cheating_events && cheatingAnalysis.cheating_events.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-semibold text-slate-700 mb-2">Detected Events:</p>
                  <div className="space-y-2">
                    {cheatingAnalysis.cheating_events.map((event, idx) => (
                      <div
                        key={`ce-${idx}-${event.timestamp || event.type}`}
                        className="flex items-start gap-2 text-sm"
                      >
                        <span className="text-orange-600">•</span>
                        <div>
                          <span className="font-semibold">{event.type}</span>
                          <span className="text-slate-600"> - Question {event.questionIndex + 1}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Video Recordings */}
      <Card className="p-8 bg-white/80 backdrop-blur-sm border-0 shadow-lg">
        <h3 className="text-2xl font-bold text-slate-800 mb-6" style={{ fontFamily: 'Poppins, sans-serif' }}>
          Interview Recordings ({videoRecordings.length} videos)
        </h3>
        
        <div className="grid md:grid-cols-2 gap-6">
          {videoRecordings.map((recording, idx) => (
            <motion.div
              key={`rec-${recording.timestamp || idx}-q${recording.questionIndex}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
              className="group"
            >
              <div className="relative aspect-video bg-slate-900 rounded-xl overflow-hidden border-2 border-slate-200 group-hover:border-purple-400 transition-colors">
                <video
                  src={recording.url}
                  controls
                  className="w-full h-full object-cover"
                  preload="metadata"
                >
                  Your browser does not support video playback.
                </video>
                <div className="absolute top-3 left-3 px-3 py-1 bg-black/70 backdrop-blur-sm text-white text-sm rounded-full font-semibold">
                  Question {recording.questionIndex + 1}
                </div>
              </div>
              <p className="mt-2 text-sm text-slate-600">
                Recorded: {new Date(recording.timestamp).toLocaleString()}
              </p>
            </motion.div>
          ))}
        </div>

        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm text-slate-700">
            <strong>💡 Tip:</strong> Review your recordings to improve body language, eye contact, and speaking confidence.
          </p>
        </div>
      </Card>
    </div>
  );
}
