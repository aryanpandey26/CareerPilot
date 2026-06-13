import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Home, FileText, BarChart3, LogOut, LogIn, UserPlus } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

export const Navigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const isActive = (path) => location.pathname === path;

  const handleLogout = async () => {
    await logout();
    toast.success("Signed out");
    navigate("/login");
  };

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo/Brand */}
          <div
            className="flex items-center cursor-pointer"
            onClick={() => navigate("/home")}
          >
            <div
              className="text-2xl font-bold text-primary"
              style={{ fontFamily: "Poppins, sans-serif" }}
            >
              CareerPilot
            </div>
          </div>

          {/* Navigation Links */}
          <div className="flex items-center gap-2">
            <Button
              data-testid="nav-home-btn"
              onClick={() => navigate("/home")}
              variant={isActive("/") || isActive("/home") ? "default" : "ghost"}
              className="gap-2 font-medium"
              style={{ fontFamily: "Inter, sans-serif" }}
            >
              <Home className="h-4 w-4" />
              <span className="hidden sm:inline">Home</span>
            </Button>

            <Button
              data-testid="nav-analyze-btn"
              onClick={() => navigate("/analyze")}
              variant={isActive("/analyze") ? "default" : "ghost"}
              className="gap-2 font-medium"
              style={{ fontFamily: "Inter, sans-serif" }}
            >
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Analyze</span>
            </Button>

            <Button
              data-testid="nav-dashboard-btn"
              onClick={() => navigate("/dashboard")}
              variant={isActive("/dashboard") ? "default" : "ghost"}
              className="gap-2 font-medium"
              style={{ fontFamily: "Inter, sans-serif" }}
            >
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </Button>

            <div className="w-px h-6 bg-slate-200 mx-1" />

            {user ? (
              <>
                <span
                  data-testid="nav-user-label"
                  className="hidden sm:inline text-sm text-slate-600 px-2"
                  title={user.email}
                >
                  Hi, {user.name?.split(" ")[0] || "there"}
                </span>
                <Button
                  data-testid="nav-logout-btn"
                  onClick={handleLogout}
                  variant="ghost"
                  className="gap-2 font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Sign out</span>
                </Button>
              </>
            ) : (
              <>
                <Button
                  data-testid="nav-login-btn"
                  onClick={() => navigate("/login")}
                  variant="ghost"
                  className="gap-2 font-medium"
                >
                  <LogIn className="h-4 w-4" />
                  <span className="hidden sm:inline">Sign in</span>
                </Button>
                <Button
                  data-testid="nav-signup-btn"
                  onClick={() => navigate("/signup")}
                  className="gap-2 font-medium bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
                >
                  <UserPlus className="h-4 w-4" />
                  <span className="hidden sm:inline">Sign up</span>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};
