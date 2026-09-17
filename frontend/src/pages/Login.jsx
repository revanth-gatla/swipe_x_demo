import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { clearRecommendationsCache } from "../services/cache";
import { API_URL } from "../services/api";

function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (event) => {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      const response = await axios.post(
        `${API_URL}/login`,
        {
          email: email.trim(),
          password,
        }
      );

      // Clear any prior user's recommendations from cache & session storage
      clearRecommendationsCache();
      try {
        sessionStorage.clear();
      } catch {
        // Ignore
      }

      localStorage.setItem(
        "access_token",
        response.data.access_token
      );

      localStorage.setItem(
        "username",
        response.data.name
      );

      navigate("/dashboard");
    } catch (err) {
      setError(
        err.response?.data?.detail ||
        "Login failed. Please check your credentials."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">

      <div className="auth-card">

        <div className="brand-mark">
          SX
        </div>

        <h1>Welcome to SWIPE X</h1>

        <p className="auth-subtitle">
          Discover opportunities that match you.
        </p>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin}>

          <label>Email</label>

          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(event) =>
              setEmail(event.target.value)
            }
            required
          />

          <label>Password</label>

          <div className="password-container">

            <input
              type={
                showPassword
                  ? "text"
                  : "password"
              }
              placeholder="Enter your password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              required
            />

            <button
              type="button"
              className="password-toggle"
              onClick={() =>
                setShowPassword(
                  (current) => !current
                )
              }
              aria-label={
                showPassword
                  ? "Hide password"
                  : "Show password"
              }
            >
              {showPassword ? "◉" : "◌"}
            </button>

          </div>

          <button
            type="submit"
            className="auth-button"
            disabled={loading}
          >
            {loading
              ? "Logging in..."
              : "Login"}
          </button>

        </form>

        <p className="auth-footer">
          Don't have an account?{" "}

          <Link to="/register">
            Create one
          </Link>
        </p>

      </div>

    </div>
  );
}

export default Login;