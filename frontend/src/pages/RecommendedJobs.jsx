import { useEffect, useRef, useState } from "react";
import API from "../services/api";
import {
  getCachedRecommendations,
  setCachedRecommendations,
  updateCachedCurrentIndex,
  clearRecommendationsCache,
} from "../services/cache";

function cleanSkillDisplay(skill) {
  if (!skill) return "";
  let s = String(skill).trim();
  // Strip common requirement prefixes
  s = s.replace(
    /^(?:job\s+requirements?|requirements?|must\s+(?:have|be)|ability\s+to|responsible\s+for|preferred\s+(?:qualifications?|skills?)|and|or|with|to)[:\s\-]+/i,
    ""
  ).trim();

  // If the string is a long sentence, extract first concise clause
  if (s.length > 35) {
    const parts = s.split(/[.;\n]/);
    const firstClause = parts[0].trim();
    if (firstClause.length <= 32 && firstClause.length > 2) {
      s = firstClause;
    } else {
      s = s.substring(0, 30).trim() + "...";
    }
  }
  return s;
}

function RecommendedJobs() {
  const cached = getCachedRecommendations();
  const [jobs, setJobs] = useState(cached?.jobs || []);
  const [currentIndex, setCurrentIndex] = useState(cached?.currentIndex || 0);
  const [loading, setLoading] = useState(!cached || !cached.jobs?.length);
  const [error, setError] = useState("");
  const [emptyMessage, setEmptyMessage] = useState("");
  const [profileCompleted, setProfileCompleted] = useState(true);
  const [resumeUploaded, setResumeUploaded] = useState(true);

  // Swipe animation & action states
  const [drag, setDrag] = useState({ active: false, x: 0, y: 0 });
  const [action, setAction] = useState(""); // "LEFT", "RIGHT", "SAVE"
  const [swipingId, setSwipingId] = useState(null);

  // Modal State (matches Discover Jobs)
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);

  // ATS Analysis state in Modal
  const [atsLoading, setAtsLoading] = useState(false);
  const [atsReport, setAtsReport] = useState(null);
  const [atsError, setAtsError] = useState("");
  const [atsCache, setAtsCache] = useState({});

  const startPoint = useRef({ x: 0, y: 0 });
  const dragging = useRef(false);

  const fetchRecommendations = async (force = false) => {
    if (force) {
      clearRecommendationsCache();
    }

    setLoading(true);
    setError("");
    setEmptyMessage("");
    setAtsReport(null);

    try {
      const response = await API.get("/recommended-jobs");
      const data = response.data;

      const recs = data.recommendations || [];
      if (recs.length === 0) {
        setJobs([]);
        clearRecommendationsCache();
        if (data.message) {
          setEmptyMessage(data.message);
        }
        if (data.profile_completed !== undefined) {
          setProfileCompleted(data.profile_completed);
        }
        if (data.resume_uploaded !== undefined) {
          setResumeUploaded(data.resume_uploaded);
        }
      } else {
        setJobs(recs);
        setCurrentIndex(0);
        setProfileCompleted(true);
        setResumeUploaded(true);
        setCachedRecommendations(recs, 0);
      }
    } catch (err) {
      setError(
        err.response?.data?.detail || "Unable to load recommended jobs."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (cached && cached.jobs && cached.jobs.length > 0) {
      return;
    }

    let ignore = false;

    const loadRecommendations = async () => {
      try {
        const response = await API.get("/recommended-jobs");
        const data = response.data;

        if (!ignore) {
          const recs = data.recommendations || [];
          if (recs.length === 0) {
            setJobs([]);
            clearRecommendationsCache();
            if (data.message) {
              setEmptyMessage(data.message);
            }
            if (data.profile_completed !== undefined) {
              setProfileCompleted(data.profile_completed);
            }
            if (data.resume_uploaded !== undefined) {
              setResumeUploaded(data.resume_uploaded);
            }
          } else {
            setJobs(recs);
            setCurrentIndex(0);
            setProfileCompleted(true);
            setResumeUploaded(true);
            setCachedRecommendations(recs, 0);
          }
        }
      } catch (err) {
        if (!ignore) {
          setError(
            err.response?.data?.detail || "Unable to load recommended jobs."
          );
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    loadRecommendations();

    return () => {
      ignore = true;
    };
  }, []);

  const currentJob = jobs[currentIndex];

  const matchedSkillsList = Array.isArray(currentJob?.matched_skills)
    ? currentJob.matched_skills
    : currentJob?.matched_skills
    ? String(currentJob.matched_skills).split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const missingSkillsList = Array.isArray(currentJob?.missing_skills)
    ? currentJob.missing_skills
    : currentJob?.missing_skills
    ? String(currentJob.missing_skills).split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const modalMatchedSkills = Array.isArray(selectedJob?.matched_skills)
    ? selectedJob.matched_skills
    : selectedJob?.matched_skills
    ? String(selectedJob.matched_skills).split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const modalMissingSkills = Array.isArray(selectedJob?.missing_skills)
    ? selectedJob.missing_skills
    : selectedJob?.missing_skills
    ? String(selectedJob.missing_skills).split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  // Execute swipe via API and animate
  const handleSwipe = async (swipeAction) => {
    if (!currentJob || swipingId) return;

    setSwipingId(currentJob.job_id);
    setAction(swipeAction);

    try {
      await API.post("/swipe", {
        job_id: currentJob.job_id,
        action: swipeAction,
      });
    } catch (err) {
      console.error("Swipe failed:", err);
    }

    setTimeout(() => {
      setCurrentIndex((prev) => {
        const nextIndex = prev + 1;
        updateCachedCurrentIndex(nextIndex);
        return nextIndex;
      });
      setAction("");
      setSwipingId(null);
      setDrag({ active: false, x: 0, y: 0 });
      setAtsReport(null);
      setAtsError("");
      setModalOpen(false);
      setSelectedJob(null);
    }, 280);
  };

  // Open Details Modal & automatically run ATS scan internally
  const handleOpenModal = (job) => {
    setSelectedJob(job);
    setModalOpen(true);
    setAtsError("");

    const jobId = job.job_id || job.id;
    if (jobId) {
      if (atsCache[jobId]) {
        setAtsReport(atsCache[jobId]);
        setAtsLoading(false);
      } else {
        setAtsReport(null);
        handleAtsScan(jobId);
      }
    }
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedJob(null);
    setAtsReport(null);
    setAtsError("");
    setAtsLoading(false);
  };

  // ATS Analysis for job
  const handleAtsScan = async (jobId) => {
    if (!jobId) return;

    setAtsLoading(true);
    setAtsError("");

    try {
      const response = await API.post(`/ats/analyze/${jobId}`);
      setAtsReport(response.data);
      setAtsCache((prev) => ({ ...prev, [jobId]: response.data }));
    } catch (err) {
      setAtsError(
        err.response?.data?.detail ||
          "ATS analysis failed. Make sure you have uploaded a resume."
      );
    } finally {
      setAtsLoading(false);
    }
  };

  // Drag handlers
  const startDrag = (x, y) => {
    if (!currentJob || action || swipingId || modalOpen) return;
    dragging.current = true;
    startPoint.current = { x, y };
    setDrag({ active: true, x: 0, y: 0 });
  };

  const moveDrag = (x, y) => {
    if (!dragging.current) return;
    setDrag({
      active: true,
      x: x - startPoint.current.x,
      y: y - startPoint.current.y,
    });
  };

  const finishDrag = () => {
    if (!dragging.current) return;
    dragging.current = false;

    const { x, y } = drag;
    const horizontalThreshold = 110;
    const verticalThreshold = 110;

    if (x <= -horizontalThreshold) {
      handleSwipe("LEFT");
    } else if (x >= horizontalThreshold) {
      handleSwipe("RIGHT");
    } else if (y >= verticalThreshold) {
      handleSwipe("SAVE");
    } else {
      setDrag({ active: false, x: 0, y: 0 });
    }
  };

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (modalOpen) {
        if (e.key === "Escape") closeModal();
        return;
      }
      if (e.key === "ArrowLeft") handleSwipe("LEFT");
      if (e.key === "ArrowRight") handleSwipe("RIGHT");
      if (e.key === "ArrowDown") handleSwipe("SAVE");
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentJob, swipingId, modalOpen]);

  const viewedCount = currentIndex >= jobs.length ? jobs.length : currentIndex + 1;
  const progress = jobs.length > 0 ? (viewedCount / jobs.length) * 100 : 0;
  const rotation = drag.x * 0.04;

  let dragLabel = "";
  if (drag.active) {
    if (drag.x < -50) dragLabel = "PASS";
    else if (drag.x > 50) dragLabel = "INTERESTED";
    else if (drag.y > 50) dragLabel = "SAVE";
  }

  return (
    <div className="ai-matching-page">
      <div className="ai-matching-header">
        <div>
          <p className="ai-label">AI RECOMMENDATION ENGINE</p>
          <h1>Recommended Jobs</h1>
        </div>
      </div>

      {loading && (
        <div className="ai-loading-card">
          <div className="loading-spinner"></div>
          <h2>Computing recommendations...</h2>
          <p>Analyzing opportunities tailored to your profile.</p>
        </div>
      )}

      {error && <div className="ai-error">{error}</div>}

      {!loading && !error && (emptyMessage || !profileCompleted || !resumeUploaded) && (
        <div className="onboarding-setup-card">
          <div className="onboarding-icon">✨</div>
          <h2>Unlock AI-Powered Recommendations</h2>
          <p className="onboarding-subtitle">
            {emptyMessage ||
              "To generate accurate AI matches tailored to you, please complete your candidate profile and upload your resume."}
          </p>

          <div className="onboarding-steps">
            <div
              className={`onboarding-step ${
                profileCompleted ? "step-complete" : "step-pending"
              }`}
            >
              <div className="step-icon">
                {profileCompleted ? "✓" : "1"}
              </div>
              <div className="step-info">
                <strong>Candidate Profile</strong>
                <span>Set your skills, experience, preferred roles & locations</span>
              </div>
              <div className="step-action">
                {profileCompleted ? (
                  <span className="step-badge-done">Completed</span>
                ) : (
                  <a
                    href="/profile"
                    className="primary-btn step-btn"
                    style={{ textDecoration: "none" }}
                  >
                    Complete Profile →
                  </a>
                )}
              </div>
            </div>

            <div
              className={`onboarding-step ${
                resumeUploaded ? "step-complete" : "step-pending"
              }`}
            >
              <div className="step-icon">
                {resumeUploaded ? "✓" : "2"}
              </div>
              <div className="step-info">
                <strong>Resume Upload</strong>
                <span>Upload your PDF resume for ATS parsing & verified skill extraction</span>
              </div>
              <div className="step-action">
                {resumeUploaded ? (
                  <span className="step-badge-done">Uploaded</span>
                ) : (
                  <a
                    href="/resume"
                    className="primary-btn step-btn"
                    style={{ textDecoration: "none" }}
                  >
                    Upload Resume →
                  </a>
                )}
              </div>
            </div>
          </div>

          <div className="onboarding-footer">
            <button
              className="refresh-btn"
              onClick={() => fetchRecommendations(true)}
            >
              🔄 Refresh Status & Recommendations
            </button>
          </div>
        </div>
      )}

      {!loading && !error && !emptyMessage && jobs.length === 0 && (
        <div className="ai-empty-card">
          <h2>No more jobs available</h2>
          <p>You've reviewed all available recommended positions.</p>
          <button className="primary-btn" onClick={() => fetchRecommendations(true)} style={{ marginTop: "16px" }}>
            Refresh Recommendations
          </button>
        </div>
      )}

      {!loading && !error && jobs.length > 0 && (
        <>
          {/* PROGRESS TRACKER */}
          <div className="job-progress">
            <div className="progress-text">
              <span>
                Job {viewedCount} of {jobs.length} recommended
              </span>
              <span>{Math.round(progress)}% viewed</span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>

          <div className="swipe-zone">
            {/* SWIPE DIRECTION HINTS */}
            <div className="swipe-instructions">
              <div
                className="swipe-direction skip-direction clickable"
                onClick={() => handleSwipe("LEFT")}
                title="Swipe Left: Not Interested"
              >
                <span>
                  <svg
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20 18c0-7-5-11-15-11" />
                    <polyline points="9 3 4 7 9 11" />
                  </svg>
                </span>
                <strong>PASS</strong>
                <small>Not interested</small>
              </div>

              <div
                className="swipe-direction save-direction clickable"
                onClick={() => handleSwipe("SAVE")}
                title="Swipe Down: Save for Later"
              >
                <span>
                  <svg
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="12" y1="3" x2="12" y2="20" />
                    <polyline points="6 14 12 20 18 14" />
                  </svg>
                </span>
                <strong>SAVE</strong>
                <small>Save for later</small>
              </div>

              <div
                className="swipe-direction apply-direction clickable"
                onClick={() => handleSwipe("RIGHT")}
                title="Swipe Right: Interested"
              >
                <span>
                  <svg
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M4 18c0-7 5-11 15-11" />
                    <polyline points="15 3 20 7 15 11" />
                  </svg>
                </span>
                <strong>INTERESTED</strong>
                <small>High interest</small>
              </div>
            </div>

            {/* DRAGGABLE CARD */}
            {currentJob ? (
              <div
                className={`draggable-card ${action ? `action-${action.toLowerCase()}` : ""}`}
                onMouseDown={(e) => startDrag(e.clientX, e.clientY)}
                onMouseMove={(e) => moveDrag(e.clientX, e.clientY)}
                onMouseUp={finishDrag}
                onMouseLeave={() => {
                  if (dragging.current) finishDrag();
                }}
                onTouchStart={(e) => startDrag(e.touches[0].clientX, e.touches[0].clientY)}
                onTouchMove={(e) => moveDrag(e.touches[0].clientX, e.touches[0].clientY)}
                onTouchEnd={finishDrag}
                style={{
                  transform: `translate(${drag.x}px, ${drag.y}px) rotate(${rotation}deg)`,
                  transition: drag.active ? "none" : "transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)",
                }}
              >
                {dragLabel && (
                  <div className={`drag-label ${dragLabel.toLowerCase()}`}>
                    {dragLabel}
                  </div>
                )}

                {/* TOP HEADER */}
                <div className="job-card-top">
                  <div className="company-section">
                    <div className="company-logo">
                      {currentJob.company?.charAt(0)?.toUpperCase() || "J"}
                    </div>
                    <div>
                      <p>{currentJob.company || "Company"}</p>
                      <span>📍 {currentJob.location || "Location not specified"}</span>
                    </div>
                  </div>

                  <div className="match-score">
                    <strong>{currentJob.match_score}%</strong>
                    <span>AI MATCH</span>
                  </div>
                </div>

                {/* TITLE & META */}
                <div className="job-title-section">
                  <div className="match-status">
                    {currentJob.match_score >= 80
                      ? "🔥 High Match"
                      : currentJob.match_score >= 60
                      ? "✨ Good Match"
                      : "💼 Relevant Opportunity"}
                  </div>

                  <h2>{currentJob.title}</h2>

                  <div className="job-meta">
                    <span>💼 {currentJob.job_type || "Full-time"}</span>
                    {currentJob.work_mode && <span>🏢 {currentJob.work_mode}</span>}
                    {currentJob.remote_allowed && <span>🌐 Remote Allowed</span>}
                    {currentJob.salary && <span>💰 {currentJob.salary}</span>}
                    <span>
                      🎯{" "}
                      {currentJob.experience_required != null
                        ? `${currentJob.experience_required} yrs required`
                        : currentJob.experience_level || "Experience flexible"}
                    </span>
                  </div>
                </div>

                {/* DESCRIPTION SNIPPET */}
                {currentJob.description && (
                  <div className="job-snippet">
                    <p>
                      {currentJob.description.length > 200
                        ? `${currentJob.description.substring(0, 200)}...`
                        : currentJob.description}
                    </p>
                  </div>
                )}

                <div className="job-card-divider"></div>

                {/* VIEW DETAILS BUTTON BELOW MATCHED & MISSING SKILLS */}
                <div className="card-view-details-wrapper" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="card-view-details-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenModal(currentJob);
                    }}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                    View Complete Details (ATS🤖)
                  </button>
                </div>

                {/* BOTTOM QUICK ACTIONS */}
                <div className="card-quick-actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="quick-action-btn btn-left"
                    onClick={() => handleSwipe("LEFT")}
                    title="Not Interested"
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20 18c0-7-5-11-15-11" />
                      <polyline points="9 3 4 7 9 11" />
                    </svg>
                    Pass
                  </button>

                  <button
                    type="button"
                    className="quick-action-btn btn-save"
                    onClick={() => handleSwipe("SAVE")}
                    title="Save for Later"
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="12" y1="3" x2="12" y2="20" />
                      <polyline points="6 14 12 20 18 14" />
                    </svg>
                    Save
                  </button>

                  <button
                    type="button"
                    className="quick-action-btn btn-right"
                    onClick={() => handleSwipe("RIGHT")}
                    title="Interested"
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M4 18c0-7 5-11 15-11" />
                      <polyline points="15 3 20 7 15 11" />
                    </svg>
                    Interested
                  </button>
                </div>
              </div>
            ) : (
              <div className="ai-empty-card">
                <h2>All Recommended Jobs Reviewed</h2>
                <p>
                  You've swiped through your current batch. The recommendation engine has updated your preference weights!
                </p>
                <div style={{ marginTop: "20px", display: "flex", gap: "12px", justifyContent: "center" }}>
                  <button className="primary-btn" onClick={() => fetchRecommendations(true)}>
                    Load More Jobs
                  </button>
                  <a href="/swipe-history" className="secondary-btn" style={{ textDecoration: "none" }}>
                    View Swipe History
                  </a>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* JOB DETAILS MODAL (MATCHING DISCOVER JOBS) */}
      {modalOpen && selectedJob && (
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
                    : selectedJob.title?.charAt(0).toUpperCase() || "J"}
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
              {selectedJob.match_score != null && (
                <span className="discover-tag modal-match-badge">
                  ⚡ {selectedJob.match_score}% AI Match
                </span>
              )}
            </div>

            {/* MODAL BODY */}
            <div className="modal-body-scroll">
              {/* MATCHED SKILLS */}
              {modalMatchedSkills.length > 0 && (
                <div className="modal-section">
                  <h4 className="modal-section-title modal-title-matched">
                    ✓ Matched Skills ({modalMatchedSkills.length})
                  </h4>
                  <div className="modal-skills-list">
                    {modalMatchedSkills.map((skill, idx) => (
                      <span
                        key={idx}
                        className="matched-skill"
                        style={{ padding: "6px 12px", fontSize: "13px" }}
                      >
                        ✓ {cleanSkillDisplay(skill)}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* MISSING SKILLS */}
              {modalMissingSkills.length > 0 && (
                <div className="modal-section">
                  <h4 className="modal-section-title modal-title-missing">
                    + Missing / Desired Skills ({modalMissingSkills.length})
                  </h4>
                  <div className="modal-skills-list">
                    {modalMissingSkills.map((skill, idx) => (
                      <span
                        key={idx}
                        className="missing-skill"
                        style={{ padding: "6px 12px", fontSize: "13px" }}
                      >
                        + {cleanSkillDisplay(skill)}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* FALLBACK: REQUIRED SKILLS ONLY IF NO MATCH/MISSING BREAKDOWN */}
              {modalMatchedSkills.length === 0 && modalMissingSkills.length === 0 && selectedJob.required_skills && (
                <div className="modal-section">
                  <h4 className="modal-section-title">Required Skills & Keywords</h4>
                  <div className="modal-skills-list">
                    {String(selectedJob.required_skills)
                      .split(",")
                      .map((skill, idx) => (
                        <span className="skill-tag" key={idx}>
                          {cleanSkillDisplay(skill)}
                        </span>
                      ))}
                  </div>
                </div>
              )}

              {/* FULL JOB DESCRIPTION */}
              <div className="modal-section">
                <h4 className="modal-section-title">Full Job Description</h4>
                <div
                  className="modal-description-text"
                  style={{ whiteSpace: "pre-wrap", lineHeight: 1.65 }}
                >
                  {selectedJob.description || "No full description provided."}
                </div>
              </div>

              {/* ATS RESUME COMPATIBILITY SCAN (AUTOMATIC) */}
              <div className="modal-section ats-modal-section">
                <div className="ats-modal-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <h4 className="modal-section-title" style={{ margin: 0 }}>
                      ATS Resume Compatibility Scan
                    </h4>
                    <p className="ats-modal-subtitle">
                      AI analysis evaluated against your current uploaded resume.
                    </p>
                  </div>
                  {atsReport && !atsLoading && (
                    <button
                      type="button"
                      className="secondary-btn"
                      style={{ padding: "5px 12px", fontSize: "12px", borderRadius: "8px" }}
                      onClick={() =>
                        handleAtsScan(selectedJob.job_id || selectedJob.id)
                      }
                      title="Re-run ATS Scan"
                    >
                      🔄 Re-scan ATS
                    </button>
                  )}
                </div>

                {atsLoading && (
                  <div className="ats-loading-box">
                    <div className="loading-spinner" style={{ width: "28px", height: "28px", borderWidth: "3px" }} />
                    <div className="ats-loading-title">
                      Scanning ATS compatibility with your uploaded resume...
                    </div>
                    <span className="ats-loading-subtitle">
                      Comparing resume keywords against job requirements & scoring compatibility
                    </span>
                  </div>
                )}

                {atsError && !atsLoading && (
                  <div className="ats-error-box" style={{ marginTop: "12px" }}>
                    <p style={{ margin: "0 0 6px" }}>{atsError}</p>
                    <div style={{ display: "flex", gap: "10px", alignItems: "center", marginTop: "8px" }}>
                      <button
                        type="button"
                        className="secondary-btn"
                        style={{ padding: "5px 12px", fontSize: "12px" }}
                        onClick={() =>
                          handleAtsScan(selectedJob.job_id || selectedJob.id)
                        }
                      >
                        🔄 Retry ATS Scan
                      </button>
                      <a
                        href="/resume"
                        style={{ color: "#6544ef", fontWeight: "700", fontSize: "13px" }}
                      >
                        Upload / Update Resume →
                      </a>
                    </div>
                  </div>
                )}

                {atsReport && !atsLoading && (
                  <div className="inline-ats-report" style={{ marginTop: "14px" }}>
                    <div className="ats-score-badge">
                      <div className="ats-circular-score">
                        <strong>{Math.round(atsReport.ats_score)}%</strong>
                        <span>ATS SCORE</span>
                      </div>
                      <div className="ats-score-summary">
                        <p className="ats-summary-text">
                          {atsReport.ats_score >= 80
                            ? "High Compatibility — Ready to Apply!"
                            : atsReport.ats_score >= 60
                            ? "Moderate Compatibility — Consider optimizing missing keywords."
                            : "Low Compatibility — Major skill or keyword gaps identified."}
                        </p>
                        {atsReport.cached && (
                          <small className="ats-cached-tag">
                            ⚡ Loaded instantly from saved report
                          </small>
                        )}
                      </div>
                    </div>

                    {atsReport.matched_skills && (
                      <div className="ats-detail-block">
                        <span className="ats-detail-label">Matched Skills in Resume</span>
                        <div className="skills-row">
                          {atsReport.matched_skills.split(",").map((s, idx) => (
                            <span key={idx} className="matched-skill">
                              ✓ {cleanSkillDisplay(s)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {atsReport.missing_skills && (
                      <div className="ats-detail-block">
                        <span className="ats-detail-label missing">
                          Missing Keywords Filtered by ATS
                        </span>
                        <div className="skills-row">
                          {atsReport.missing_skills.split(",").map((s, idx) => (
                            <span key={idx} className="missing-skill">
                              + {cleanSkillDisplay(s)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {atsReport.suggestions && (
                      <div className="ats-detail-block">
                        <span className="ats-detail-label">
                          Resume Improvement Suggestions
                        </span>
                        <div className="modal-suggestion-item">
                          {atsReport.suggestions}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* MODAL FOOTER */}
            <div className="modal-footer" style={{ justifyContent: "flex-end" }}>
              <button
                type="button"
                className="secondary-btn"
                style={{ minWidth: "100px", padding: "10px 22px", fontSize: "14px" }}
                onClick={closeModal}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default RecommendedJobs;
