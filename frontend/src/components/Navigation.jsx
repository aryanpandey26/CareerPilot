import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Home, FileText, BarChart3, LogOut } from "lucide-react";

export const Navigation = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo/Brand */}
          <div 
            className="flex items-center cursor-pointer"
            onClick={() => navigate("/")}
          >
            <div className="text-2xl font-bold text-primary" style={{ fontFamily: 'Poppins, sans-serif' }}>
              Interview AI
            </div>
          </div>

          {/* Navigation Links */}
          <div className="flex items-center gap-2">
            <Button
              data-testid="nav-home-btn"
              onClick={() => navigate("/")}
              variant={isActive("/") ? "default" : "ghost"}
              className="gap-2 font-medium"
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              <Home className="h-4 w-4" />
              <span className="hidden sm:inline">Home</span>
            </Button>

            <Button
              data-testid="nav-analyze-btn"
              onClick={() => navigate("/analyze")}
              variant={isActive("/analyze") ? "default" : "ghost"}
              className="gap-2 font-medium"
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Analyze</span>
            </Button>

            <Button
              data-testid="nav-dashboard-btn"
              onClick={() => navigate("/dashboard")}
              variant={isActive("/dashboard") ? "default" : "ghost"}
              className="gap-2 font-medium"
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
};
