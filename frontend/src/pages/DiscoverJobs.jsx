import { useEffect, useState } from "react";
import API from "../services/api";

function DiscoverJobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const perPage = 20;

  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  // Modal & Actions State
  const [selectedJob, setSelectedJob] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [savedJobIds, setSavedJobIds] = useState(new Set());

  // ATS in Modal State
  const [atsLoading, setAtsLoading] = useState(false);
  const [atsReport, setAtsReport] = useState(null);
  const [atsError, setAtsError] = useState("");

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage("");
    }, 4000);
  };

  // Fetch initial saved jobs from swipe history
  useEffect(() => {
    const fetchSavedHistory = async () => {
      try {
        const res = await API.get("/swipe-history");
        const history = res.data.history || [];
        const savedIds = new Set(
          history
            .filter((item) => item.action === "SAVE")
            .map((item) => item.job_id)
        );
        setSavedJobIds(savedIds);
      } catch {
        // Ignore error if not logged in or history is empty
      }
    };
    fetchSavedHistory();
  }, []);

  useEffect(() => {
    let ignore = false;

    const loadJobs = async () => {
      try {
        const params = { page, per_page: perPage };
        if (search.trim()) {
          params.search = search.trim();
        }

        const res = await API.get("/discover-jobs", { params });
        const data = res.data;

        if (!ignore) {
          setJobs(data.jobs || []);
          setTotalPages(data.total_pages || 1);
          setTotal(data.total || 0);
          setError("");
        }
      } catch (err) {
        if (!ignore) {
          setError(
            err.response?.data?.detail || "Failed to load jobs."
          );
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    loadJobs();

    return () => {
      ignore = true;
    };
  }, [page, search]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  };

  const clearSearch = () => {
    setSearchInput("");
    setSearch("");
    setPage(1);
  };

  // View full details in modal
  const handleViewDetails = async (job) => {
    setSelectedJob(job);
    setLoadingDetails(true);
    setAtsReport(null);
    setAtsError("");

    try {
      const res = await API.get(`/jobs/${job.id}`);
      setSelectedJob(res.data);
    } catch (err) {
      console.error("Failed to load job details:", err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const closeModal = () => {
    setSelectedJob(null);
    setAtsReport(null);
    setAtsError("");
  };

  // Functional Apply Handler
  const handleApply = (job, e) => {
    if (e) e.stopPropagation();

    const targetUrl =
      job.application_url && job.application_url.startsWith("http")
        ? job.application_url
        : `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(
            `${job.title} ${job.company && job.company !== "Unknown" ? job.company : ""}`
          )}`;

    showToast(`Opening application portal for "${job.title}"...`);
    window.open(targetUrl, "_blank", "noopener,noreferrer");
  };

  // Functional Save Handler
  const handleSave = async (job, e) => {
    if (e) e.stopPropagation();

    const isAlreadySaved = savedJobIds.has(job.id);
    if (isAlreadySaved) {
      showToast(`"${job.title}" is already in your saved jobs.`);
      return;
    }

    try {
      await API.post("/swipe", {
        job_id: job.id,
        action: "SAVE",
      });
      setSavedJobIds((prev) => new Set(prev).add(job.id));
      showToast(`Saved "${job.title}" to your Swipe History!`);
    } catch {
      showToast("Could not save job. Please try again.");
    }
  };

  // ATS Analysis for Selected Job
  const handleAtsScan = async (jobId) => {
    setAtsLoading(true);
    setAtsError("");
    try {
      const res = await API.post(`/ats/analyze/${jobId}`);
      setAtsReport(res.data);
    } catch (err) {
      setAtsError(
        err.response?.data?.detail ||
          "ATS analysis failed. Make sure you have uploaded a resume in the Resume section."
      );
    } finally {
      setAtsLoading(false);
    }
  };

  const skillsArray = (skillsStr) => {
    if (!skillsStr) return [];
    return skillsStr
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  };

  return (
    <div className="discover-page">
      {/* NOTIFICATION TOAST */}
      {toastMessage && (
        <div className="action-toast">
          <span>✨ {toastMessage}</span>
        </div>
      )}

      <div className="profile-page-header">
        <div>
          <p className="page-label">JOB BROWSER</p>
          <h1>Discover Jobs</h1>
        </div>
      </div>

      {/* SEARCH BAR */}
      <form className="discover-search-bar" onSubmit={handleSearch}>
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search by title, company, or location..."
          className="discover-search-input"
        />
        <button type="submit" className="primary-btn">
          Search
        </button>
        {search && (
          <button
            type="button"
            className="secondary-btn"
            onClick={clearSearch}
          >
            Clear
          </button>
        )}
      </form>

      {/* RESULT INFO */}
      {!loading && !error && (
        <div className="discover-info">
          <span>
            {total.toLocaleString()} job{total !== 1 ? "s" : ""} found
            {search && (
              <>
                {" "}for <strong>"{search}"</strong>
              </>
            )}
          </span>
          <span>
            Page {page} of {totalPages}
          </span>
        </div>
      )}

      {/* LOADING */}
      {loading && (
        <div className="profile-loading" style={{ marginTop: "40px" }}>
          <div className="loading-spinner"></div>
          Loading jobs...
        </div>
      )}

      {/* ERROR */}
      {error && <div className="error-message">{error}</div>}

      {/* EMPTY STATE */}
      {!loading && !error && jobs.length === 0 && (
        <div className="ai-empty-card" style={{ marginTop: "30px" }}>
          <h2>No jobs found</h2>
          <p>
            {search
              ? `No jobs match "${search}". Try a different search term.`
              : "No jobs available in the database."}
          </p>
        </div>
      )}

      {/* JOBS GRID */}
      {!loading && !error && jobs.length > 0 && (
        <div className="discover-grid">
          {jobs.map((job) => {
            const skills = skillsArray(job.required_skills).slice(0, 5);
            const isSaved = savedJobIds.has(job.id);

            return (
              <div
                className="discover-card"
                key={job.id}
                onClick={() => handleViewDetails(job)}
              >
                <div className="discover-card-top">
                  <div className="discover-company-logo">
                    {job.company && job.company !== "Unknown"
                      ? job.company.charAt(0).toUpperCase()
                      : job.title.charAt(0).toUpperCase()}
                  </div>
                  <div className="discover-card-meta">
                    <h3 className="discover-job-title">{job.title}</h3>
                    <p className="discover-company-name">
                      {job.company || "Company"}
                      {job.location && ` • 📍 ${job.location}`}
                    </p>
                  </div>
                </div>

                {/* TAGS ROW */}
                <div className="discover-tags-row">
                  {job.job_type && (
                    <span className="discover-tag">💼 {job.job_type}</span>
                  )}
                  {job.work_mode && (
                    <span className="discover-tag">🏢 {job.work_mode}</span>
                  )}
                  {job.remote_allowed && (
                    <span className="discover-tag">🌐 Remote</span>
                  )}
                  {job.salary && (
                    <span className="discover-tag">💰 {job.salary}</span>
                  )}
                  {job.experience_required != null && (
                    <span className="discover-tag">
                      🎯 {job.experience_required} yrs
                    </span>
                  )}
                  {!job.experience_required && job.experience_level && (
                    <span className="discover-tag">
                      🎯 {job.experience_level}
                    </span>
                  )}
                </div>

                {/* DESCRIPTION SNIPPET */}
                {job.description && (
                  <p className="discover-description">{job.description}</p>
                )}

                {/* SKILLS */}
                {skills.length > 0 && (
                  <div className="discover-skills-row">
                    {skills.map((skill, idx) => (
                      <span className="skill-tag" key={idx}>
                        {skill}
                      </span>
                    ))}
                  </div>
                )}

                {/* CARD ACTIONS & FOOTER */}
                <div className="discover-card-footer">
                  <div className="discover-footer-badges">
                    <span className="discover-source">
                      {job.source === "linkedin" ? "LinkedIn" : "Direct"}
                    </span>
                    {isSaved && (
                      <span className="discover-status-pill saved">🔖 Saved</span>
                    )}
                  </div>

                  <div className="discover-card-btn-group" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className={`discover-save-card-btn ${isSaved ? "saved" : ""}`}
                      onClick={(e) => handleSave(job, e)}
                      title={isSaved ? "Saved in History" : "Save Job"}
                    >
                      {isSaved ? "🔖 Saved" : "🔖 Save"}
                    </button>
                    <button
                      type="button"
                      className="discover-view-btn"
                      onClick={() => handleViewDetails(job)}
                    >
                      View Details
                    </button>
                    <button
                      type="button"
                      className="discover-apply-btn"
                      onClick={(e) => handleApply(job, e)}
                    >
                      Apply ↗
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* PAGINATION */}
      {!loading && !error && totalPages > 1 && (
        <div className="discover-pagination">
          <button
            className="secondary-btn"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ← Previous
          </button>

          <div className="pagination-pages">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (page <= 3) {
                pageNum = i + 1;
              } else if (page >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = page - 2 + i;
              }
              return (
                <button
                  key={pageNum}
                  className={`pagination-btn ${pageNum === page ? "active" : ""}`}
                  onClick={() => setPage(pageNum)}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          <button
            className="secondary-btn"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next →
          </button>
        </div>
      )}

      {/* JOB DETAILS MODAL */}
      {selectedJob && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div
            className="job-details-modal"
            onClick={(e) => e.stopPropagation()}
          >
            {/* MODAL HEADER */}
            <div className="modal-header">
              <div className="modal-header-left">
                <div className="modal-company-logo">
                  {selectedJob.company && selectedJob.company !== "Unknown"
                    ? selectedJob.company.charAt(0).toUpperCase()
                    : selectedJob.title.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="modal-job-title">{selectedJob.title}</h2>
                  <p className="modal-company-name">
                    {selectedJob.company || "Company"}
                    {selectedJob.location && ` • 📍 ${selectedJob.location}`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={closeModal}
              >
                ✕
              </button>
            </div>

            {/* MODAL METADATA TAGS */}
            <div className="modal-tags-row">
              {selectedJob.job_type && (
                <span className="discover-tag">💼 {selectedJob.job_type}</span>
              )}
              {selectedJob.work_mode && (
                <span className="discover-tag">🏢 {selectedJob.work_mode}</span>
              )}
              {selectedJob.remote_allowed && (
                <span className="discover-tag">🌐 Remote Allowed</span>
              )}
              {selectedJob.salary && (
                <span className="discover-tag">💰 {selectedJob.salary}</span>
              )}
              {selectedJob.experience_required != null && (
                <span className="discover-tag">
                  🎯 {selectedJob.experience_required} years experience
                </span>
              )}
              {!selectedJob.experience_required && selectedJob.experience_level && (
                <span className="discover-tag">
                  🎯 {selectedJob.experience_level}
                </span>
              )}
              <span className="discover-source">
                Source: {selectedJob.source === "linkedin" ? "LinkedIn" : "Direct"}
              </span>
              {savedJobIds.has(selectedJob.id) && (
                <span className="discover-status-pill saved">🔖 Saved</span>
              )}
            </div>

            {/* MODAL BODY */}
            <div className="modal-body-scroll">
              {loadingDetails ? (
                <div className="profile-loading" style={{ padding: "30px 0" }}>
                  <div className="loading-spinner"></div>
                  Loading full description...
                </div>
              ) : (
                <>
                  {/* REQUIRED SKILLS */}
                  {selectedJob.required_skills && (
                    <div className="modal-section">
                      <h4 className="modal-section-title">Required Skills & Keywords</h4>
                      <div className="modal-skills-list">
                        {skillsArray(selectedJob.required_skills).map((skill, idx) => (
                          <span className="skill-tag" key={idx}>
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* FULL JOB DESCRIPTION */}
                  <div className="modal-section">
                    <h4 className="modal-section-title">Job Description</h4>
                    <div className="modal-description-text">
                      {selectedJob.description || "No full description provided."}
                    </div>
                  </div>

                  {/* ATS RESUME SCAN SECTION */}
                  <div className="modal-section ats-modal-section">
                    <div className="ats-modal-header">
                      <div>
                        <h4 className="modal-section-title" style={{ margin: 0 }}>
                          ATS Resume Compatibility Scan
                        </h4>
                        <p style={{ margin: "4px 0 0", color: "#746c82", fontSize: "12.5px" }}>
                          Analyze your uploaded resume against this specific position.
                        </p>
                      </div>
                      <button
                        type="button"
                        className="secondary-btn"
                        onClick={() => handleAtsScan(selectedJob.id)}
                        disabled={atsLoading}
                      >
                        {atsLoading ? "Scanning..." : "Run ATS Scan"}
                      </button>
                    </div>

                    {atsError && <div className="ats-error-box" style={{ marginTop: "12px" }}>{atsError}</div>}

                    {atsReport && (
                      <div className="inline-ats-report" style={{ marginTop: "14px" }}>
                        <div className="ats-score-badge">
                          <div className="ats-circular-score">
                            <strong>{atsReport.ats_score}%</strong>
                            <span>ATS SCORE</span>
                          </div>
                          <div className="ats-score-summary">
                            <p>{atsReport.summary}</p>
                          </div>
                        </div>

                        {atsReport.matched_skills && (
                          <div className="ats-detail-block">
                            <span className="ats-detail-label">Matched Skills</span>
                            <div className="skills-row">
                              {atsReport.matched_skills.split(",").map((s, idx) => (
                                <span key={idx} className="matched-skill">
                                  ✓ {s.trim()}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {atsReport.missing_skills && (
                          <div className="ats-detail-block">
                            <span className="ats-detail-label missing">Missing Keywords / Skills</span>
                            <div className="skills-row">
                              {atsReport.missing_skills.split(",").map((s, idx) => (
                                <span key={idx} className="missing-skill">
                                  + {s.trim()}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* MODAL FOOTER ACTIONS */}
            <div className="modal-footer">
              <button
                type="button"
                className="secondary-btn"
                onClick={(e) => handleSave(selectedJob, e)}
              >
                {savedJobIds.has(selectedJob.id) ? "✓ Saved in History" : "🔖 Save Job"}
              </button>

              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={closeModal}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="primary-btn"
                  onClick={(e) => handleApply(selectedJob, e)}
                >
                  Apply Now ↗
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DiscoverJobs;
