import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";

import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Profile from "./pages/Profile";
import Resume from "./pages/Resume";
import Jobs from "./pages/Jobs";
import JobDetails from "./pages/JobDetails";
import RecommendedJobs from "./pages/RecommendedJobs";
import Applications from "./pages/Applications";
import SavedJobs from "./pages/SavedJobs";

function AppLayout({ children }) {
  return (
    <>
      <Navbar />

      <div className="app-layout">
        <Sidebar />

        <main className="main-content">
          {children}
        </main>
      </div>
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* Authentication */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Candidate */}
        <Route
          path="/dashboard"
          element={
            <AppLayout>
              <Dashboard />
            </AppLayout>
          }
        />

        <Route
          path="/profile"
          element={
            <AppLayout>
              <Profile />
            </AppLayout>
          }
        />

        <Route
          path="/resume"
          element={
            <AppLayout>
              <Resume />
            </AppLayout>
          }
        />

        <Route
          path="/jobs"
          element={
            <AppLayout>
              <Jobs />
            </AppLayout>
          }
        />

        <Route
          path="/jobs/:jobId"
          element={
            <AppLayout>
              <JobDetails />
            </AppLayout>
          }
        />

        <Route
          path="/recommended-jobs"
          element={
            <AppLayout>
              <RecommendedJobs />
            </AppLayout>
          }
        />

        <Route
          path="/applications"
          element={
            <AppLayout>
              <Applications />
            </AppLayout>
          }
        />

        <Route
          path="/saved-jobs"
          element={
            <AppLayout>
              <SavedJobs />
            </AppLayout>
          }
        />

        {/* Default */}
        <Route
          path="*"
          element={<Navigate to="/login" replace />}
        />

      </Routes>
    </BrowserRouter>
  );
}

export default App;