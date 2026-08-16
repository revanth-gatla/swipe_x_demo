import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import API from "../services/api";

function RecommendedJobs() {
  const [recommendations, setRecommendations] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRecommendations();
  }, []);

  const loadRecommendations = async () => {
    try {
      const response = await API.get("/recommended-jobs");

      setRecommendations(
        response.data.recommendations || []
      );
    } catch (error) {
      setError(
        error.response?.data?.detail ||
        "Unable to load recommended jobs"
      );
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <h1>AI Recommended Jobs</h1>
        <p>Finding the best jobs for you...</p>
      </div>
    );
  }

  return (
    <div className="page-container">
      <h1>AI Recommended Jobs</h1>

      {error && (
        <p className="error">
          {error}
        </p>
      )}

      {!error && recommendations.length === 0 && (
        <p>No recommended jobs available.</p>
      )}

      <div className="jobs-grid">
        {recommendations.map((recommendation) => (
          <div
            className="job-card"
            key={recommendation.job_id}
          >
            <h2>
              Job #{recommendation.job_id}
            </h2>

            <p>
              <strong>AI Match Score:</strong>{" "}
              {recommendation.match_score}%
            </p>

            <Link
              to={`/jobs/${recommendation.job_id}`}
            >
              View Job
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

export default RecommendedJobs;