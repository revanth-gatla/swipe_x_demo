import { Navigate, Route, Routes, useNavigate } from "react-router-dom";

import Applications from "./pages/Applications";
import SavedJobs from "./pages/SavedJobs";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Profile from "./pages/Profile";
import Resume from "./pages/Resume";
import AIJobMatching from "./pages/AIJobMatching";

import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";

import "./App.css";

function Dashboard() {
  const navigate = useNavigate();

  const options = [
    {
      title: "Profile",
      description: "Manage your candidate profile",
      icon: "👤",
      path: "/profile",
    },
    {
      title: "Resume & ATS",
      description: "Analyze and improve your resume",
      icon: "📄",
      path: "/resume",
    },
    {
      title: "AI Matches",
      description: "Find jobs matched to your profile",
      icon: "✨",
      path: "/ai-matches",
    },
    {
      title: "Applications",
      description: "Track your job applications",
      icon: "📨",
      path: "/applications",
    },
    {
      title: "Saved Jobs",
      description: "View jobs saved for later",
      icon: "🔖",
      path: "/saved-jobs",
    },
    
      
    
  ];

  const username =
    localStorage.getItem("username") ||
    localStorage.getItem("name") ||
    "Candidate";

  return (
    <div className="dashboard-page">

      <div className="dashboard-header">
        <p className="page-label">
          SWIPE X
        </p>

        <h1>
          Welcome, {username} 👋
        </h1>

        <p className="page-description">
          Your personalized candidate workspace.
        </p>
      </div>

      <div className="dashboard-grid">

        {options.map((option) => (
          <button
            className="dashboard-card"
            key={option.path}
            onClick={() => navigate(option.path)}
          >
            <div className="dashboard-card-icon">
              {option.icon}
            </div>

            <div className="dashboard-card-content">
              <h2>
                {option.title}
              </h2>

              <p>
                {option.description}
              </p>
            </div>

            <span className="dashboard-card-arrow">
              →
            </span>
          </button>
        ))}

      </div>

    </div>
  );
}

function App() {
  return (
    <Routes>

      <Route
        path="/"
        element={
          <Navigate
            to="/login"
            replace
          />
        }
      />

      <Route
        path="/login"
        element={<Login />}
      />

      <Route
        path="/register"
        element={<Register />}
      />

      <Route element={<ProtectedRoute />}>

        <Route element={<Layout />}>

          <Route
            path="/dashboard"
            element={<Dashboard />}
          />

          <Route
            path="/profile"
            element={<Profile />}
          />

          <Route
            path="/resume"
            element={<Resume />}
          />

          <Route
            path="/ai-matches"
            element={<AIJobMatching />}
          />

          <Route
            path="/applications"
            element={<Applications />}
          />

          <Route
            path="/saved-jobs"
            element={<SavedJobs />}
          />

        </Route>

      </Route>

    </Routes>
  );
}

export default App;