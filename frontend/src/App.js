import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import LandingPage from "@/pages/LandingPage";
import ResumeAnalyzer from "@/pages/ResumeAnalyzer";
import InterviewSetup from "@/pages/InterviewSetup";
import InterviewRoom from "@/pages/InterviewRoom";
import ResultsPage from "@/pages/ResultsPage";
import Dashboard from "@/pages/Dashboard";
import { Navigation } from "@/components/Navigation";
import { Toaster } from "@/components/ui/sonner";
import ErrorBoundary from "@/components/ErrorBoundary";

function AppContent() {
  const location = useLocation();
  
  // Don't show navigation on landing page and interview room (for immersive experience)
  const showNavigation = !["/", "/interview"].some(path => 
    location.pathname === path || location.pathname.startsWith("/interview/")
  );

  return (
    <>
      {showNavigation && <Navigation />}
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/analyze" element={<ResumeAnalyzer />} />
        <Route path="/setup" element={<InterviewSetup />} />
        <Route path="/interview/:sessionId" element={<InterviewRoom />} />
        <Route path="/results/:sessionId" element={<ResultsPage />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <div className="App">
        <BrowserRouter>
          <AppContent />
          <Toaster 
            position="top-right" 
            toastOptions={{
              style: {
                background: '#1e293b',
                color: '#fff',
                border: '1px solid #334155',
              },
            }}
          />
        </BrowserRouter>
      </div>
    </ErrorBoundary>
  );
}

export default App;
