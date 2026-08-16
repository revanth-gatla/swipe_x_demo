import { Link } from "react-router-dom";

function Dashboard() {
  return (
    <div className="dashboard">

      <section className="dashboard-hero">
        <span className="hero-badge">AI-POWERED JOB DISCOVERY</span>

        <h1>
          Welcome to <span>SWIPE X</span>
        </h1>

        <p>
          Find the right job with AI-powered matching.
        </p>
      </section>

      <section className="dashboard-grid">

        <div className="dashboard-card">
          <div className="card-icon">👤</div>
          <h2>Profile</h2>
          <p>Complete and manage your candidate profile.</p>
          <Link to="/profile">View Profile →</Link>
        </div>

        <div className="dashboard-card">
          <div className="card-icon">📄</div>
          <h2>Resume & ATS</h2>
          <p>Upload your resume and check your ATS score.</p>
          <Link to="/resume">Manage Resume →</Link>
        </div>

        <div className="dashboard-card">
          <div className="card-icon">💼</div>
          <h2>Jobs</h2>
          <p>Explore jobs that match your skills and interests.</p>
          <Link to="/jobs">Explore Jobs →</Link>
        </div>

        <div className="dashboard-card">
          <div className="card-icon">🤖</div>
          <h2>AI Recommendations</h2>
          <p>Get personalized job recommendations from our AI engine.</p>
          <Link to="/recommended-jobs">View Recommendations →</Link>
        </div>

        <div className="dashboard-card">
          <div className="card-icon">📋</div>
          <h2>My Applications</h2>
          <p>Track all your job applications in one place.</p>
          <Link to="/applications">Track Applications →</Link>
        </div>

        <div className="dashboard-card">
          <div className="card-icon">⭐</div>
          <h2>Saved Jobs</h2>
          <p>View the jobs you've saved for later.</p>
          <Link to="/saved-jobs">View Saved Jobs →</Link>
        </div>

      </section>

    </div>
  );
}

export default Dashboard;