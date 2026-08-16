import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import API from "../services/api";

function Jobs() {
  const [jobs, setJobs] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    loadJobs();
  }, []);

  const loadJobs = async () => {
    try {
      const response = await API.get("/jobs");
      setJobs(response.data);
    } catch (error) {
      setError(
        error.response?.data?.detail ||
        "Unable to load jobs"
      );
    }
  };

  return (
    <div className="page-container">
      <h1>Available Jobs</h1>

      {error && (
        <p className="error">
          {error}
        </p>
      )}

      {jobs.length === 0 && !error && (
        <p>No jobs available.</p>
      )}

      <div className="jobs-grid">
        {jobs.map((job) => (
          <div className="job-card" key={job[0]}>
            <h2>{job[1]}</h2>

            <p>
              <strong>Company:</strong> {job[2]}
            </p>

            <p>
              <strong>Location:</strong> {job[3]}
            </p>

            <p>
              <strong>Experience:</strong> {job[6]} years
            </p>

            <p>
              <strong>Salary:</strong> {job[7]}
            </p>

            <Link to={`/jobs/${job[0]}`}>
              View Details
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Jobs;