import { Link, useNavigate } from "react-router-dom";

function Navbar() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  return (
    <header className="navbar">
      <div className="navbar-logo">
        <Link to="/dashboard">SWIPE X</Link>
      </div>

      <nav className="navbar-links">
        <Link to="/jobs">Jobs</Link>
        <Link to="/recommended-jobs">Recommended</Link>
        <Link to="/applications">Applications</Link>
        <Link to="/saved-jobs">Saved Jobs</Link>
      </nav>

      <button
        className="logout-button"
        onClick={handleLogout}
      >
        Logout
      </button>
    </header>
  );
}

export default Navbar;