import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, ArrowRight, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const next = location.state?.from || "/home";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Show toast if backend redirected here with ?error=...
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const err = params.get("error");
    if (err) {
      const map = {
        google_auth_failed: "Google sign-in was cancelled or failed.",
        invalid_state: "Session expired. Please try signing in again.",
        token_exchange_failed: "Couldn't verify with Google. Try again.",
        profile_fetch_failed: "Couldn't fetch your Google profile.",
        no_email: "Google didn't share an email with us.",
        oauth_exception: "Unexpected sign-in error. Try again.",
        google_oauth_not_configured: "Google sign-in is not configured on the backend.",
      };
      toast.error(map[err] || "Sign-in error.");
      // Clean the URL so reload doesn't re-toast
      navigate("/login", { replace: true });
    }
  }, [location.search, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await login(email, password);
      toast.success("Welcome back!");
      navigate(next, { replace: true });
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 px-4">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-pink-500/20 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative w-full max-w-md"
      >
        <Card
          data-testid="login-card"
          className="p-8 sm:p-10 bg-slate-900/70 backdrop-blur-xl border-purple-500/30 shadow-2xl shadow-purple-500/10"
        >
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/15 border border-purple-400/30 text-purple-200 text-xs font-semibold tracking-wide uppercase mb-4">
              <Sparkles className="h-3.5 w-3.5" />
              Welcome back
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white">
              Sign in to{" "}
              <span className="bg-gradient-to-r from-purple-300 via-pink-300 to-purple-400 bg-clip-text text-transparent">
                CareerPilot
              </span>
            </h1>
            <p className="text-slate-400 text-sm mt-2">Continue your interview prep journey.</p>
          </div>

          <Button
            type="button"
            data-testid="google-signin-btn"
            onClick={loginWithGoogle}
            className="w-full bg-white hover:bg-slate-100 text-slate-800 font-semibold py-6 rounded-lg shadow"
          >
            <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" aria-hidden>
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.77.43 3.45 1.18 4.94l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z"/>
            </svg>
            Continue with Google
          </Button>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-purple-500/20" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-slate-900 px-3 text-slate-400">or sign in with email</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email" className="text-slate-300">Email</Label>
              <div className="relative mt-1.5">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <Input
                  id="email"
                  data-testid="login-email-input"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 bg-slate-800/60 border-purple-500/20 text-white placeholder:text-slate-500 focus:border-purple-400"
                  placeholder="you@example.com"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="password" className="text-slate-300">Password</Label>
              <div className="relative mt-1.5">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <Input
                  id="password"
                  data-testid="login-password-input"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 bg-slate-800/60 border-purple-500/20 text-white placeholder:text-slate-500 focus:border-purple-400"
                  placeholder="••••••••"
                />
              </div>
            </div>
            <Button
              type="submit"
              data-testid="login-submit-btn"
              disabled={submitting}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold py-6 rounded-lg shadow-lg"
            >
              {submitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  Sign in
                  <ArrowRight className="ml-2 h-5 w-5" />
                </>
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-slate-400 mt-6">
            New here?{" "}
            <Link to="/signup" data-testid="goto-signup-link" className="text-purple-300 hover:text-purple-200 font-medium">
              Create an account
            </Link>
          </p>
        </Card>
      </motion.div>
    </div>
  );
}
