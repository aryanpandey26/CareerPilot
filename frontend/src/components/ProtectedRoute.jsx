import { Navigate, useLocation } from "react-router-dom";
import { Loader2, Sparkles } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
        <div className="text-center">
          <div className="relative inline-block">
            <Loader2 className="h-12 w-12 text-purple-300 animate-spin" />
            <Sparkles className="absolute inset-0 m-auto h-6 w-6 text-pink-300 animate-pulse" />
          </div>
          <p className="mt-4 text-sm text-slate-400">Loading…</p>
        </div>
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return children;
}
