import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import LandingPage from "@/pages/LandingPage";
import ResumeAnalyzer from "@/pages/ResumeAnalyzer";
import InterviewSetup from "@/pages/InterviewSetup";
import InterviewRoom from "@/pages/InterviewRoom";
import ResultsPage from "@/pages/ResultsPage";
import Dashboard from "@/pages/Dashboard";
import { Toaster } from "@/components/ui/sonner";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/analyze" element={<ResumeAnalyzer />} />
          <Route path="/setup" element={<InterviewSetup />} />
          <Route path="/interview/:sessionId" element={<InterviewRoom />} />
          <Route path="/results/:sessionId" element={<ResultsPage />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </BrowserRouter>
      <Toaster />
    </div>
  );
}

export default App;
