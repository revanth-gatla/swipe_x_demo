import { NavLink } from "react-router-dom";

function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <h2>SWIPE X</h2>
        <p>Candidate Portal</p>
      </div>

      <nav className="sidebar-nav">
        <NavLink to="/dashboard">
          Dashboard
        </NavLink>

        <NavLink to="/profile">
          Profile
        </NavLink>

        <NavLink to="/resume">
          Resume & ATS
        </NavLink>

        <NavLink to="/jobs">
          Jobs
        </NavLink>

        <NavLink to="/recommended-jobs">
          Recommended Jobs
        </NavLink>

        <NavLink to="/applications">
          My Applications
        </NavLink>

        <NavLink to="/saved-jobs">
          Saved Jobs
        </NavLink>
      </nav>
    </aside>
  );
}

export default Sidebar;