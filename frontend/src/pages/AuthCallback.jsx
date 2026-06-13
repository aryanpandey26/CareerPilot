import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Sparkles } from "lucide-react";
import axios from "axios";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function AuthCallback() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    const hash = window.location.hash || "";
    const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
    const sessionId = params.get("session_id");
    if (!sessionId) {
      navigate("/login", { replace: true });
      return;
    }

    (async () => {
      try {
        await axios.post(
          `${API}/auth/google-session`,
          { session_id: sessionId },
          { withCredentials: true }
        );
        // Wipe any stale JWT from a prior email/password session
        try {
          localStorage.removeItem("authToken");
          delete axios.defaults.headers.common["Authorization"];
        } catch (e) {
          // eslint-disable-next-line no-console
          if (process.env.NODE_ENV !== "production") {
            console.warn("Could not clear stale auth header:", e);
          }
        }
        // IMPORTANT: strip the #session_id=... fragment BEFORE refreshing so
        // the AuthContext.checkAuth() early-skip doesn't bail out.
        window.history.replaceState({}, "", window.location.pathname);
        await refresh();
        toast.success("Signed in with Google");
        navigate("/home", { replace: true });
      } catch (err) {
        console.error("Google session exchange failed:", err);
        toast.error("Google sign-in failed. Please try again.");
        navigate("/login", { replace: true });
      }
    })();
  }, [navigate, refresh]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
      <div className="text-center">
        <div className="relative inline-block">
          <Loader2 className="h-16 w-16 text-purple-300 animate-spin" />
          <Sparkles className="absolute inset-0 m-auto h-8 w-8 text-pink-300 animate-pulse" />
        </div>
        <p className="mt-6 text-lg">Finishing sign-in…</p>
      </div>
    </div>
  );
}
