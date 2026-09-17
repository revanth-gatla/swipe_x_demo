import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { clearRecommendationsCache } from "../services/cache";

function Layout() {
  const navigate = useNavigate();
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("swipex_theme") || "light";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("swipex_theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const handleLogout = () => {
    clearRecommendationsCache();
    try {
      sessionStorage.clear();
    } catch {
      // Ignore
    }
    localStorage.removeItem("access_token");
    localStorage.removeItem("username");
    localStorage.removeItem("name");
    navigate("/login", { replace: true });
  };

  const navItems = [
    { path: "/profile", label: "Profile", icon: "👤" },
    { path: "/resume", label: "Resume", icon: "📄" },
    { path: "/recommended-jobs", label: "Recommended Jobs", icon: "✨" },
    { path: "/discover-jobs", label: "Discover Jobs", icon: "🔍" },
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

          <div className="topbar-right" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {/* DARK / LIGHT MODE PILL SWITCH (on the left side of user name) */}
            <button
              type="button"
              className={`theme-mode-toggle ${theme === "dark" ? "mode-dark" : "mode-light"}`}
              onClick={toggleTheme}
              title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
              aria-label="Toggle dark/light mode"
            >
              <div className="theme-toggle-pill">
                <div className="theme-toggle-thumb">
                  {theme === "dark" ? (
                    <svg
                      viewBox="0 0 24 24"
                      className="thumb-icon moon-icon"
                      width="12"
                      height="12"
                      fill="currentColor"
                    >
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                    </svg>
                  ) : (
                    <svg
                      viewBox="0 0 24 24"
                      className="thumb-icon sun-icon"
                      width="12"
                      height="12"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="4" />
                      <line x1="12" y1="2" x2="12" y2="4" />
                      <line x1="12" y1="20" x2="12" y2="22" />
                      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                      <line x1="2" y1="12" x2="4" y2="12" />
                      <line x1="20" y1="12" x2="22" y2="12" />
                      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                    </svg>
                  )}
                </div>
              </div>
            </button>

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