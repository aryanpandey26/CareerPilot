import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import LandingPage from "@/pages/LandingPage";
import ResumeAnalyzer from "@/pages/ResumeAnalyzer";
import InterviewSetup from "@/pages/InterviewSetup";
import InterviewRoomWithVideo from "@/pages/InterviewRoomWithVideo";
import ResultsPage from "@/pages/ResultsPage";
import Dashboard from "@/pages/Dashboard";
import LoginPage from "@/pages/LoginPage";
import SignupPage from "@/pages/SignupPage";
import AuthCallback from "@/pages/AuthCallback";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Navigation } from "@/components/Navigation";
import { Toaster } from "@/components/ui/sonner";
import ErrorBoundary from "@/components/ErrorBoundary";
import { AuthProvider } from "@/context/AuthContext";

function AppContent() {
  const location = useLocation();

  // Don't show navigation on landing/auth/interview pages (immersive)
  const hideNavPaths = ["/", "/login", "/signup", "/auth/callback"];
  const showNavigation =
    !hideNavPaths.includes(location.pathname) &&
    !location.pathname.startsWith("/interview/");

  return (
    <>
      {showNavigation && <Navigation />}
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/auth/callback" element={<AuthCallback />} />

        {/* Public so anonymous users can try the analyzer */}
        <Route path="/analyze" element={<ResumeAnalyzer />} />

        {/* Protected */}
        <Route
          path="/setup"
          element={
            <ProtectedRoute>
              <InterviewSetup />
            </ProtectedRoute>
          }
        />
        <Route
          path="/interview/:sessionId"
          element={
            <ProtectedRoute>
              <InterviewRoomWithVideo />
            </ProtectedRoute>
          }
        />
        <Route
          path="/results/:sessionId"
          element={
            <ProtectedRoute>
              <ResultsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/home"
          element={
            <ProtectedRoute>
              <LandingPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <div className="App">
        <BrowserRouter>
          <AuthProvider>
            <AppContent />
            <Toaster
              position="top-right"
              toastOptions={{
                style: {
                  background: "#1e293b",
                  color: "#fff",
                  border: "1px solid #334155",
                },
              }}
            />
          </AuthProvider>
        </BrowserRouter>
      </div>
    </ErrorBoundary>
  );
}

export default App;
