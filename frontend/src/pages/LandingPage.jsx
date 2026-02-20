import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Target, TrendingUp, Award, Brain } from "lucide-react";

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-r from-slate-900 to-slate-800 py-24 md:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Left: Text Content */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-white z-10"
            >
              <h1 className="text-5xl md:text-6xl font-heading font-bold tracking-tight uppercase mb-6">
                ACE YOUR NEXT
                <span className="block text-transparent bg-clip-text bg-gradient-to-br from-indigo-400 to-violet-400">
                  INTERVIEW
                </span>
              </h1>
              <p className="text-lg leading-relaxed text-slate-300 mb-8 max-w-xl">
                AI-powered mock interviews that analyze your resume, generate personalized questions, and provide real-time feedback to help you land your dream job.
              </p>
              <div className="flex gap-4">
                <Button
                  data-testid="get-started-btn"
                  onClick={() => navigate("/analyze")}
                  className="bg-primary hover:bg-primary/90 text-white font-medium px-8 py-6 rounded-md text-lg shadow-lg hover:shadow-xl active:scale-95 transition-all"
                >
                  Get Started
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button
                  data-testid="view-dashboard-btn"
                  onClick={() => navigate("/dashboard")}
                  variant="outline"
                  className="border-2 border-white/20 bg-white/10 hover:bg-white/20 text-white font-medium px-8 py-6 rounded-md text-lg backdrop-blur-sm transition-all"
                >
                  View Dashboard
                </Button>
              </div>
            </motion.div>

            {/* Right: Image */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative"
            >
              <div className="glass rounded-xl overflow-hidden shadow-2xl">
                <img
                  src="https://images.unsplash.com/photo-1765005204058-10418f5123c5?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxODl8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBqb2IlMjBpbnRlcnZpZXclMjBzdWNjZXNzJTIwY29uZmlkZW50fGVufDB8fHx8MTc3MTU5NzY2NHww&ixlib=rb-4.1.0&q=85"
                  alt="Professional confident woman ready for interview"
                  className="w-full h-auto"
                />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-background-subtle">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-heading font-bold tracking-tight uppercase text-secondary mb-4">
              PERFORMANCE PRO FEATURES
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Our AI-powered platform provides everything you need to excel in your next interview.
            </p>
          </motion.div>

          {/* Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: <Target className="h-8 w-8" />,
                title: "ATS Resume Analysis",
                description: "Get instant compatibility scores and identify skill gaps in your resume.",
                color: "text-primary"
              },
              {
                icon: <Brain className="h-8 w-8" />,
                title: "AI Question Generation",
                description: "Dynamic questions tailored to your skills and experience level.",
                color: "text-violet-600"
              },
              {
                icon: <Award className="h-8 w-8" />,
                title: "Real-time Evaluation",
                description: "Detailed scoring on accuracy, depth, clarity, and confidence.",
                color: "text-accent"
              },
              {
                icon: <TrendingUp className="h-8 w-8" />,
                title: "Performance Analytics",
                description: "Track your progress and identify areas for improvement over time.",
                color: "text-orange-600"
              },
            ].map((feature, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: idx * 0.1 }}
                className="bg-white rounded-lg border border-slate-200 p-8 shadow-sm hover:shadow-md transition-all duration-300"
              >
                <div className={`${feature.color} mb-4`}>
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold text-secondary mb-3">
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

      {/* CTA Section */}
      <section className="py-24 bg-secondary text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl md:text-4xl font-heading font-bold tracking-tight uppercase mb-6">
              READY TO LEVEL UP YOUR INTERVIEW SKILLS?
            </h2>
            <p className="text-lg text-slate-300 mb-8">
              Start your personalized mock interview journey today and gain the confidence to succeed.
            </p>
            <Button
              data-testid="cta-start-btn"
              onClick={() => navigate("/analyze")}
              className="bg-primary hover:bg-primary/90 text-white font-medium px-10 py-6 rounded-md text-lg shadow-lg hover:shadow-xl active:scale-95 transition-all"
            >
              Start Your First Interview
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
