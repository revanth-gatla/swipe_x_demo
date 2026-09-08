import { Navigate, Route, Routes } from "react-router-dom";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Profile from "./pages/Profile";
import Resume from "./pages/Resume";
import RecommendedJobs from "./pages/RecommendedJobs";
import SwipeHistory from "./pages/SwipeHistory";
import DiscoverJobs from "./pages/DiscoverJobs";

import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";

import "./App.css";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/recommended-jobs" replace />} />

      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/profile" element={<Profile />} />
          <Route path="/resume" element={<Resume />} />
          <Route path="/recommended-jobs" element={<RecommendedJobs />} />
          <Route path="/swipe-history" element={<SwipeHistory />} />
          <Route path="/discover-jobs" element={<DiscoverJobs />} />

          {/* Backward compatibility redirects */}
          <Route
            path="/dashboard"
            element={<Navigate to="/recommended-jobs" replace />}
          />
          <Route
            path="/ai-matches"
            element={<Navigate to="/recommended-jobs" replace />}
          />
          <Route
            path="/saved-jobs"
            element={<Navigate to="/swipe-history" replace />}
          />
          <Route
            path="/applications"
            element={<Navigate to="/swipe-history" replace />}
          />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/recommended-jobs" replace />} />
    </Routes>
  );
}

export default App;