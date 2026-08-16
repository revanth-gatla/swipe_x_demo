import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import API from "../services/api";

function JobDetails() {
  const { jobId } = useParams();
  const navigate = useNavigate();

  const [job, setJob] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadJob();
  }, [jobId]);

  const loadJob = async () => {
    try {
      const response = await API.get(`/jobs/${jobId}`);
      setJob(response.data);
    } catch (error) {
      setError(
        error.response?.data?.detail ||
        "Unable to load job details"
      );
    }
  };

  const applyForJob = async () => {
    setMessage("");
    setError("");

    try {
      const response = await API.post(
        `/jobs/${jobId}/apply`
      );

      setMessage(response.data.message);
    } catch (error) {
      setError(
        error.response?.data?.detail ||
        "Unable to apply for this job"
      );
    }
  };

  const saveJob = async () => {
    setMessage("");
    setError("");

    try {
      const response = await API.post(
        `/jobs/${jobId}/save`
      );

      setMessage(response.data.message);
    } catch (error) {
      setError(
        error.response?.data?.detail ||
        "Unable to save this job"
      );
    }
  };

  if (error && !job) {
    return (
      <div className="page-container">
        <p className="error">{error}</p>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="page-container">
        <p>Loading job...</p>
      </div>
    );
  }

  return (
    <div className="page-container">
      <button onClick={() => navigate("/jobs")}>
        ← Back to Jobs
      </button>

      <div className="job-details">
        <h1>{job.title}</h1>

        <h2>{job.company}</h2>

        <p>
          <strong>Location:</strong>{" "}
          {job.location}
        </p>

        <p>
          <strong>Experience Required:</strong>{" "}
          {job.experience_required} years
        </p>

        <p>
          <strong>Salary:</strong>{" "}
          {job.salary}
        </p>

        <p>
          <strong>Job Type:</strong>{" "}
          {job.job_type}
        </p>

        <h3>Description</h3>
        <p>{job.description}</p>

        <h3>Required Skills</h3>
        <p>{job.required_skills}</p>

        <div className="job-actions">
          <button onClick={applyForJob}>
            Apply Now
          </button>

          <button onClick={saveJob}>
            Save Job
          </button>
        </div>

        {job.application_url && (
          <a
            href={job.application_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            External Application Link
          </a>
        )}
      </div>

      {message && (
        <p className="success">
          {message}
        </p>
      )}

      {error && (
        <p className="error">
          {error}
        </p>
      )}
    </div>
  );
}

export default JobDetails;