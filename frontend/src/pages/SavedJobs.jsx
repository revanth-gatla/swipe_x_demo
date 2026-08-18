import { useEffect, useState } from "react";
import API from "../services/api";

function SavedJobs() {
  const [savedJobs, setSavedJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [applyingJobId, setApplyingJobId] = useState(null);
  const [removingJobId, setRemovingJobId] = useState(null);

  const fetchSavedJobs = async () => {
    try {
      setError("");

      const response = await API.get("/saved-jobs");

      const data = response.data || [];

      setSavedJobs(
        data.map((job) => ({
          savedId: job[0],
          jobId: job[1],
          title: job[2],
          company: job[3],
          location: job[4],
          salary: job[5],
          savedAt: job[6],
        }))
      );
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Unable to load saved jobs."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSavedJobs();
  }, []);

  const applyForJob = async (jobId) => {
    try {
      setError("");
      setApplyingJobId(jobId);

      await API.post(`/jobs/${jobId}/apply`);

      await API.delete(`/jobs/${jobId}/save`);

      setSavedJobs((current) =>
        current.filter(
          (job) => job.jobId !== jobId
        )
      );
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Unable to apply for this job."
      );
    } finally {
      setApplyingJobId(null);
    }
  };

  const removeSavedJob = async (jobId) => {
    try {
      setError("");
      setRemovingJobId(jobId);

      await API.delete(`/jobs/${jobId}/save`);

      setSavedJobs((current) =>
        current.filter(
          (job) => job.jobId !== jobId
        )
      );
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Unable to remove saved job."
      );
    } finally {
      setRemovingJobId(null);
    }
  };

  const formatDate = (date) => {
    if (!date) {
      return "Recently";
    }

    return new Date(date).toLocaleDateString(
      "en-IN",
      {
        day: "numeric",
        month: "short",
        year: "numeric",
      }
    );
  };

  return (
    <div className="saved-jobs-page">

      <div className="saved-jobs-header">

        <div>
          <p className="page-label">
            SAVED JOBS
          </p>

          <h1>
            Saved Jobs
          </h1>

          <p className="page-description">
            Jobs you've saved for later.
          </p>
        </div>

        <div className="saved-jobs-count">

          <strong>
            {savedJobs.length}
          </strong>

          <span>
            Saved
          </span>

        </div>

      </div>

      {error && (
        <div className="saved-jobs-error">
          {error}
        </div>
      )}

      {loading && (
        <div className="saved-jobs-empty">

          <div className="saved-loader"></div>

          <h2>
            Loading saved jobs...
          </h2>

          <p>
            Fetching your saved opportunities.
          </p>

        </div>
      )}

      {!loading &&
        !error &&
        savedJobs.length === 0 && (
          <div className="saved-jobs-empty">

            <div className="saved-empty-icon">
              🔖
            </div>

            <h2>
              No saved jobs yet
            </h2>

            <p>
              Drag a job card down in AI Job
              Matching to save it for later.
            </p>

          </div>
        )}

      {!loading &&
        savedJobs.length > 0 && (
          <div className="saved-jobs-list">

            {savedJobs.map((job) => (
              <div
                className="saved-job-card"
                key={job.savedId}
              >

                <div className="saved-company-logo">
                  {job.company
                    ?.charAt(0)
                    ?.toUpperCase() || "C"}
                </div>

                <div className="saved-job-main">

                  <h2>
                    {job.title}
                  </h2>

                  <p className="saved-company">
                    {job.company}
                  </p>

                  <div className="saved-job-meta">

                    <span>
                      📍{" "}
                      {job.location ||
                        "Location not specified"}
                    </span>

                    {job.salary && (
                      <span>
                        💰 {job.salary}
                      </span>
                    )}

                    <span>
                      🔖 Saved{" "}
                      {formatDate(job.savedAt)}
                    </span>

                  </div>

                </div>

                <div className="saved-job-actions">

                  <button
                    className="apply-saved-button"
                    onClick={() =>
                      applyForJob(job.jobId)
                    }
                    disabled={
                      applyingJobId === job.jobId ||
                      removingJobId === job.jobId
                    }
                  >
                    {applyingJobId === job.jobId
                      ? "Applying..."
                      : "Apply"}
                  </button>

                  <button
                    className="remove-saved-button"
                    onClick={() =>
                      removeSavedJob(job.jobId)
                    }
                    disabled={
                      applyingJobId === job.jobId ||
                      removingJobId === job.jobId
                    }
                  >
                    {removingJobId === job.jobId
                      ? "Removing..."
                      : "Remove"}
                  </button>

                </div>

              </div>
            ))}

          </div>
        )}

    </div>
  );
}

export default SavedJobs;