import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Target, TrendingUp, Award, Brain, Sparkles, Zap, CheckCircle, LogIn, UserPlus, LogOut } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

export default function LandingPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    toast.success("Signed out");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-pink-50">
      {/* Top header — auth controls */}
      <header className="absolute top-0 left-0 right-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex items-center justify-between">
          <div
            data-testid="landing-brand"
            className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent cursor-pointer"
            style={{ fontFamily: "Poppins, sans-serif" }}
            onClick={() => navigate("/")}
          >
            Interview AI
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {user ? (
              <>
                <span
                  data-testid="landing-user-label"
                  className="hidden sm:inline text-sm font-medium text-slate-700 px-3 py-1 rounded-full bg-white/70 backdrop-blur-sm border border-purple-200"
                  title={user.email}
                >
                  Hi, {user.name?.split(" ")[0] || "there"}
                </span>
                <Button
                  data-testid="landing-dashboard-btn"
                  onClick={() => navigate("/dashboard")}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold rounded-full px-5 shadow-md"
                >
                  Dashboard
                </Button>
                <Button
                  data-testid="landing-logout-btn"
                  onClick={handleLogout}
                  variant="ghost"
                  className="text-slate-700 hover:text-rose-600 hover:bg-white/60 rounded-full"
                >
                  <LogOut className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Sign out</span>
                </Button>
              </>
            ) : (
              <>
                <Button
                  data-testid="landing-login-btn"
                  onClick={() => navigate("/login")}
                  variant="ghost"
                  className="text-slate-700 hover:text-purple-700 hover:bg-white/60 font-semibold rounded-full"
                >
                  <LogIn className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Sign in</span>
                </Button>
                <Button
                  data-testid="landing-signup-btn"
                  onClick={() => navigate("/signup")}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold rounded-full px-5 shadow-md"
                >
                  <UserPlus className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Sign up</span>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 md:py-32">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-20 left-10 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob"></div>
          <div className="absolute top-40 right-10 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-8 left-1/2 w-72 h-72 bg-blue-300 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-4000"></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center">
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm rounded-full border border-purple-200 shadow-lg mb-8"
            >
              <Sparkles className="h-4 w-4 text-purple-600" />
              <span className="text-sm font-semibold text-purple-900">AI-Powered Interview Mastery</span>
            </motion.div>

            {/* Main Heading */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-5xl md:text-7xl font-bold tracking-tight mb-6"
              style={{ fontFamily: 'Poppins, sans-serif' }}
            >
              <span className="bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent">
                Ace Every Interview
              </span>
              <br />
              <span className="text-slate-800">With Confidence</span>
            </motion.h1>

            {/* Subheading */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-xl md:text-2xl text-slate-600 mb-12 max-w-3xl mx-auto leading-relaxed"
            >
              Transform your interview skills with AI-powered analysis, personalized questions, and real-time feedback that adapts to your career goals.
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-4 justify-center items-center"
            >
              <Button
                data-testid="hero-get-started-btn"
                onClick={() => navigate("/analyze")}
                className="group bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold px-8 py-6 rounded-full text-lg shadow-xl hover:shadow-2xl transition-all transform hover:scale-105"
              >
                Start Free Analysis
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button
                data-testid="hero-dashboard-btn"
                onClick={() => navigate("/dashboard")}
                variant="outline"
                className="border-2 border-slate-300 bg-white/50 backdrop-blur-sm hover:bg-white text-slate-700 font-semibold px-8 py-6 rounded-full text-lg transition-all"
              >
                View Dashboard
              </Button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section - Bento Grid */}
      <section className="py-24 bg-white/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-slate-800 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
              Everything You Need to Succeed
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Our AI-powered platform gives you the tools, insights, and confidence to land your dream job
            </p>
          </motion.div>

          {/* Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: <Target className="h-8 w-8" />,
                title: "Smart ATS Analysis",
                description: "Get instant compatibility scores and identify exactly what recruiters are looking for in your resume",
                color: "from-purple-500 to-purple-600",
                bgColor: "bg-purple-50",
              },
              {
                icon: <Brain className="h-8 w-8" />,
                title: "AI-Generated Questions",
                description: "Practice with tailored questions that match your experience level and target role perfectly",
                color: "from-pink-500 to-pink-600",
                bgColor: "bg-pink-50",
              },
              {
                icon: <Zap className="h-8 w-8" />,
                title: "Real-Time Feedback",
                description: "Get detailed scoring on accuracy, depth, clarity, and confidence with every answer",
                color: "from-blue-500 to-blue-600",
                bgColor: "bg-blue-50",
              },
              {
                icon: <Award className="h-8 w-8" />,
                title: "Performance Tracking",
                description: "Track your progress over time and see exactly where you're improving",
                color: "from-green-500 to-green-600",
                bgColor: "bg-green-50",
              },
              {
                icon: <TrendingUp className="h-8 w-8" />,
                title: "Skill Gap Analysis",
                description: "Discover missing skills and get personalized recommendations to strengthen your profile",
                color: "from-orange-500 to-orange-600",
                bgColor: "bg-orange-50",
              },
              {
                icon: <CheckCircle className="h-8 w-8" />,
                title: "Interview Ready",
                description: "Build unshakeable confidence with unlimited practice sessions anytime, anywhere",
                color: "from-teal-500 to-teal-600",
                bgColor: "bg-teal-50",
              },
            ].map((feature, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: idx * 0.1 }}
                className={`${feature.bgColor} rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border border-slate-200`}
              >
                <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${feature.color} text-white mb-4 shadow-md`}>
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-3" style={{ fontFamily: 'Poppins, sans-serif' }}>
                  {feature.title}
                </h3>
                <p className="text-slate-600 leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-24 bg-gradient-to-br from-purple-600 via-pink-600 to-blue-600 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-6" style={{ fontFamily: 'Poppins, sans-serif' }}>
              Ready to Transform Your Career?
            </h2>
            <p className="text-xl text-white/90 mb-8 leading-relaxed">
              Join thousands of successful candidates who've landed their dream jobs with our AI-powered interview preparation
            </p>
            <Button
              data-testid="cta-final-btn"
              onClick={() => navigate("/analyze")}
              className="bg-white text-purple-600 hover:bg-slate-100 font-bold px-10 py-6 rounded-full text-lg shadow-2xl hover:shadow-3xl transition-all transform hover:scale-105"
            >
              Start Your Journey Now
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Add custom animations */}
      <style>{`
        @keyframes blob {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          25% {
            transform: translate(20px, -50px) scale(1.1);
          }
          50% {
            transform: translate(-20px, 20px) scale(0.9);
          }
          75% {
            transform: translate(50px, 50px) scale(1.05);
          }
        }
        
        .animate-blob {
          animation: blob 7s infinite;
        }
        
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
}
