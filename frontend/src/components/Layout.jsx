import { NavLink, Outlet, useNavigate } from "react-router-dom";

function Layout() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("username");
    localStorage.removeItem("name");
    navigate("/login", { replace: true });
  };

  const navItems = [
    { path: "/profile", label: "Profile", icon: "👤" },
    { path: "/resume", label: "Resume", icon: "📄" },
    { path: "/recommended-jobs", label: "Recommended Jobs", icon: "✨" },
    { path: "/swipe-history", label: "Swipe History", icon: "🕒" },
  ];

  const username =
    localStorage.getItem("username") ||
    localStorage.getItem("name") ||
    "Candidate";

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-logo">SX</div>
          <div>
            <h2>SWIPE X</h2>
            <span>Job Discovery</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <p className="nav-heading">WORKSPACE</p>

          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `nav-link ${isActive ? "active" : ""}`
              }
            >
              <span style={{ marginRight: "10px", fontSize: "16px" }}>
                {item.icon}
              </span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="ai-card">
            <strong>AI Recommendation</strong>
            <span>Personalized jobs based on skills, profile & swipe feedback.</span>
          </div>

          <button className="logout-button" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <span className="topbar-title">Candidate Workspace</span>
          </div>

          <div className="topbar-right">
            <div className="user-name">{username}</div>
          </div>
        </header>

        <section className="content-area">
          <Outlet />
        </section>
      </main>
    </div>
  );
}

export default Layout;