import { useEffect, useRef, useState } from "react";
import API from "../services/api";

function RecommendedJobs() {
  const [jobs, setJobs] = useState([]);
  const [candidateInfo, setCandidateInfo] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [emptyMessage, setEmptyMessage] = useState("");

  // Swipe animation & action states
  const [drag, setDrag] = useState({ active: false, x: 0, y: 0 });
  const [action, setAction] = useState(""); // "LEFT", "RIGHT", "SAVE"
  const [swipingId, setSwipingId] = useState(null);

  // ATS Analysis state per job
  const [atsLoading, setAtsLoading] = useState(false);
  const [atsReport, setAtsReport] = useState(null);
  const [atsError, setAtsError] = useState("");
  const [showAts, setShowAts] = useState(false);

  const startPoint = useRef({ x: 0, y: 0 });
  const dragging = useRef(false);

  useEffect(() => {
    fetchRecommendations();
  }, []);

  const fetchRecommendations = async () => {
    setLoading(true);
    setError("");
    setEmptyMessage("");
    setAtsReport(null);
    setShowAts(false);

    try {
      const response = await API.get("/recommended-jobs");
      const data = response.data;

      if (data.candidate) {
        setCandidateInfo(data.candidate);
      }

      const recs = data.recommendations || [];
      setJobs(recs);
      setCurrentIndex(0);

      if (recs.length === 0 && data.message) {
        setEmptyMessage(data.message);
      }
    } catch (err) {
      setError(
        err.response?.data?.detail || "Unable to load recommended jobs."
      );
    } finally {
      setLoading(false);
    }
  };

  const currentJob = jobs[currentIndex];

  // Reset ATS report when moving to next job
  useEffect(() => {
    setAtsReport(null);
    setAtsError("");
    setShowAts(false);
  }, [currentIndex]);

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
      // Even if swipe API encounters an issue, proceed to next job gracefully
    }

    setTimeout(() => {
      setCurrentIndex((prev) => prev + 1);
      setAction("");
      setSwipingId(null);
      setDrag({ active: false, x: 0, y: 0 });
    }, 280);
  };

  // ATS Analysis for current job
  const handleAnalyzeATS = async () => {
    if (!currentJob) return;

    setAtsLoading(true);
    setAtsError("");
    setShowAts(true);

    try {
      const response = await API.post(`/ats/analyze/${currentJob.job_id}`);
      setAtsReport(response.data);
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
    if (!currentJob || action || swipingId) return;
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
          <p>
            Ranked based on your skills (70%), experience (20%), role relevance (10%), preferences & swipe feedback.
          </p>
        </div>
      </div>

      {loading && (
        <div className="ai-loading-card">
          <div className="loading-spinner"></div>
          <h2>Computing recommendations...</h2>
          <p>Analyzing 33,000+ opportunities tailored to your profile.</p>
        </div>
      )}

      {error && <div className="ai-error">{error}</div>}

      {!loading && !error && emptyMessage && (
        <div className="ai-empty-card">
          <h2>Get Started with Recommendations</h2>
          <p>{emptyMessage}</p>
          <div style={{ marginTop: "20px", display: "flex", gap: "12px", justifyContent: "center" }}>
            <a href="/profile" className="primary-btn" style={{ textDecoration: "none" }}>
              Complete Profile
            </a>
            <a href="/resume" className="secondary-btn" style={{ textDecoration: "none" }}>
              Upload Resume
            </a>
          </div>
        </div>
      )}

      {!loading && !error && !emptyMessage && jobs.length === 0 && (
        <div className="ai-empty-card">
          <h2>No more jobs available</h2>
          <p>You've reviewed all available recommended positions.</p>
          <button className="primary-btn" onClick={fetchRecommendations} style={{ marginTop: "16px" }}>
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
                <span>✕</span>
                <strong>PASS</strong>
                <small>Not interested</small>
              </div>

              <div
                className="swipe-direction save-direction clickable"
                onClick={() => handleSwipe("SAVE")}
                title="Swipe Down: Save for Later"
              >
                <span>🔖</span>
                <strong>SAVE</strong>
                <small>Save for later</small>
              </div>

              <div
                className="swipe-direction apply-direction clickable"
                onClick={() => handleSwipe("RIGHT")}
                title="Swipe Right: Interested"
              >
                <span>✓</span>
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
                      <p>{currentJob.company}</p>
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
                      {currentJob.description.length > 220
                        ? `${currentJob.description.substring(0, 220)}...`
                        : currentJob.description}
                    </p>
                  </div>
                )}

                <div className="job-card-divider"></div>

                {/* MATCHED SKILLS */}
                <div className="skills-section">
                  <h3>Matched Skills</h3>
                  <div className="skills-row">
                    {currentJob.matched_skills?.length > 0 ? (
                      currentJob.matched_skills.map((skill, idx) => (
                        <span className="matched-skill" key={idx}>
                          ✓ {skill}
                        </span>
                      ))
                    ) : (
                      <span className="skill-empty">No exact skill matches identified</span>
                    )}
                  </div>
                </div>

                {/* MISSING SKILLS */}
                {currentJob.missing_skills?.length > 0 && (
                  <div className="skills-section">
                    <h3 className="missing-title">Missing / Desired Skills</h3>
                    <div className="skills-row">
                      {currentJob.missing_skills.slice(0, 8).map((skill, idx) => (
                        <span className="missing-skill" key={idx}>
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* ATS ANALYSIS BUTTON & SECTION */}
                <div className="ats-trigger-section">
                  {!showAts ? (
                    <button
                      type="button"
                      className="ats-analyze-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAnalyzeATS();
                      }}
                      disabled={atsLoading}
                    >
                      <span style={{ fontSize: "16px" }}>🎯</span> Analyze ATS Compatibility
                    </button>
                  ) : (
                    <div className="inline-ats-report" onClick={(e) => e.stopPropagation()}>
                      <div className="inline-ats-header">
                        <h4>ATS Compatibility Report</h4>
                        <button
                          className="close-ats-btn"
                          onClick={() => setShowAts(false)}
                          type="button"
                        >
                          ✕ Close
                        </button>
                      </div>

                      {atsLoading && (
                        <div className="ats-loading-state">
                          <div className="loading-spinner small"></div>
                          <span>Comparing your resume against this job description...</span>
                        </div>
                      )}

                      {atsError && (
                        <div className="ats-error-box">
                          <p>{atsError}</p>
                          <a href="/resume" style={{ color: "#6544ef", fontWeight: "700" }}>
                            Upload Resume →
                          </a>
                        </div>
                      )}

                      {atsReport && (
                        <div className="ats-report-content">
                          <div className="ats-score-badge">
                            <div className="ats-circular-score">
                              <strong>{Math.round(atsReport.ats_score)}%</strong>
                              <span>ATS SCORE</span>
                            </div>
                            <div className="ats-score-summary">
                              <p>
                                {atsReport.ats_score >= 80
                                  ? "High compatibility with this job description!"
                                  : atsReport.ats_score >= 60
                                  ? "Moderate compatibility. Address missing skills to improve."
                                  : "Low compatibility. Consider tailoring your resume for this role."}
                              </p>
                              {atsReport.cached && (
                                <small style={{ color: "#8a8198" }}>⚡ Loaded from saved report</small>
                              )}
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
                              <span className="ats-detail-label missing">Missing Keywords</span>
                              <div className="skills-row">
                                {atsReport.missing_skills.split(",").map((s, idx) => (
                                  <span key={idx} className="missing-skill">
                                    {s.trim()}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {atsReport.suggestions && (
                            <div className="ats-detail-block">
                              <span className="ats-detail-label">Improvement Suggestions</span>
                              <p className="ats-suggestions-text">{atsReport.suggestions}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* BOTTOM ACTION BUTTONS */}
                <div className="card-quick-actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="quick-action-btn btn-left"
                    onClick={() => handleSwipe("LEFT")}
                    title="Not Interested"
                  >
                    ✕ Pass
                  </button>

                  <button
                    type="button"
                    className="quick-action-btn btn-save"
                    onClick={() => handleSwipe("SAVE")}
                    title="Save for Later"
                  >
                    🔖 Save
                  </button>

                  <button
                    type="button"
                    className="quick-action-btn btn-right"
                    onClick={() => handleSwipe("RIGHT")}
                    title="Interested"
                  >
                    ✓ Interested
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
                  <button className="primary-btn" onClick={fetchRecommendations}>
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
    </div>
  );
}

export default RecommendedJobs;
