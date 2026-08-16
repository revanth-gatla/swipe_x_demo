import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import API from "../services/api";

function SavedJobs() {
  const [savedJobs, setSavedJobs] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSavedJobs();
  }, []);

  const loadSavedJobs = async () => {
    try {
      const response = await API.get("/saved-jobs");
      setSavedJobs(response.data);
    } catch (error) {
      setError(
        error.response?.data?.detail ||
        "Unable to load saved jobs"
      );
    } finally {
      setLoading(false);
    }
  };

  const removeSavedJob = async (jobId) => {
    try {
      await API.delete(`/jobs/${jobId}/save`);

      setSavedJobs(
        savedJobs.filter((job) => job[1] !== jobId)
      );
    } catch (error) {
      setError(
        error.response?.data?.detail ||
        "Unable to remove saved job"
      );
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <h1>Saved Jobs</h1>
        <p>Loading saved jobs...</p>
      </div>
    );
  }

  return (
    <div className="page-container">
      <h1>Saved Jobs</h1>

      {error && (
        <p className="error">
          {error}
        </p>
      )}

      {!error && savedJobs.length === 0 && (
        <p>No saved jobs yet.</p>
      )}

      <div className="jobs-grid">
        {savedJobs.map((job) => (
          <div
            className="job-card"
            key={job[0]}
          >
            <h2>{job[2]}</h2>

            <p>
              <strong>Company:</strong>{" "}
              {job[3]}
            </p>

            <p>
              <strong>Location:</strong>{" "}
              {job[4]}
            </p>

            <p>
              <strong>Salary:</strong>{" "}
              {job[5]}
            </p>

            <Link to={`/jobs/${job[1]}`}>
              View Job
            </Link>

            <button
              onClick={() => removeSavedJob(job[1])}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default SavedJobs;