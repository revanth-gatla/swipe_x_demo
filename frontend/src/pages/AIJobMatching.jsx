import { useEffect, useRef, useState } from "react";
import API from "../services/api";

function AIJobMatching() {
  const [jobs, setJobs] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [drag, setDrag] = useState({
    active: false,
    x: 0,
    y: 0
  });
  const [action, setAction] = useState("");

  const startPoint = useRef({ x: 0, y: 0 });
  const dragging = useRef(false);

  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        const response = await API.get("/recommended-jobs");
        setJobs(response.data.recommendations || []);
      } catch (err) {
        setError(
          err.response?.data?.detail ||
            "Unable to load recommended jobs."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchRecommendations();
  }, []);

  const currentJob = jobs[currentIndex];

  const startDrag = (x, y) => {
    if (!currentJob || action) {
      return;
    }

    dragging.current = true;
    startPoint.current = { x, y };

    setDrag({
      active: true,
      x: 0,
      y: 0
    });
  };

  const moveDrag = (x, y) => {
    if (!dragging.current) {
      return;
    }

    setDrag({
      active: true,
      x: x - startPoint.current.x,
      y: y - startPoint.current.y
    });
  };

  const completeSwipe = (type, finalX, finalY) => {
    setAction(type);

    setDrag({
      active: false,
      x: finalX,
      y: finalY
    });

    setTimeout(() => {
      setCurrentIndex((prev) => prev + 1);

      setDrag({
        active: false,
        x: 0,
        y: 0
      });

      setAction("");
    }, 300);
  };

  const finishDrag = async () => {
    if (!dragging.current) {
      return;
    }

    dragging.current = false;

    const { x, y } = drag;

    const horizontalThreshold = 130;
    const verticalThreshold = 130;

    if (x <= -horizontalThreshold) {
      completeSwipe(
        "skip",
        -window.innerWidth,
        y
      );
      return;
    }

    if (x >= horizontalThreshold) {
      setAction("apply");

      try {
        await API.post(
          `/jobs/${currentJob.job_id}/apply`
        );

        completeSwipe(
          "apply",
          window.innerWidth,
          y
        );
      } catch (err) {
        setError(
          err.response?.data?.detail ||
            "Unable to apply for this job."
        );

        setDrag({
          active: false,
          x: 0,
          y: 0
        });

        setAction("");
      }

      return;
    }

    if (y >= verticalThreshold) {
      setAction("save");

      try {
        await API.post(
          `/jobs/${currentJob.job_id}/save`
        );

        completeSwipe(
          "save",
          x,
          window.innerHeight
        );
      } catch (err) {
        setError(
          err.response?.data?.detail ||
            "Unable to save this job."
        );

        setDrag({
          active: false,
          x: 0,
          y: 0
        });

        setAction("");
      }

      return;
    }

    setDrag({
      active: false,
      x: 0,
      y: 0
    });
  };

  const handleMouseDown = (event) => {
    startDrag(
      event.clientX,
      event.clientY
    );
  };

  const handleMouseMove = (event) => {
    if (dragging.current) {
      moveDrag(
        event.clientX,
        event.clientY
      );
    }
  };

  const handleMouseUp = () => {
    finishDrag();
  };

  const handleTouchStart = (event) => {
    const touch = event.touches[0];

    startDrag(
      touch.clientX,
      touch.clientY
    );
  };

  const handleTouchMove = (event) => {
    const touch = event.touches[0];

    moveDrag(
      touch.clientX,
      touch.clientY
    );
  };

  const handleTouchEnd = () => {
    finishDrag();
  };

  const resetCards = () => {
    setCurrentIndex(0);
    setDrag({
      active: false,
      x: 0,
      y: 0
    });
    setAction("");
  };

  const viewedCount =
    currentIndex >= jobs.length
      ? jobs.length
      : currentIndex + 1;

  const progress =
    jobs.length > 0
      ? (viewedCount / jobs.length) * 100
      : 0;

  const rotation = drag.x * 0.04;

  let dragLabel = "";

  if (drag.active) {
    if (drag.x < -60) {
      dragLabel = "SKIP";
    } else if (drag.x > 60) {
      dragLabel = "APPLY";
    } else if (drag.y > 60) {
      dragLabel = "SAVE";
    }
  }

  return (
    <div className="ai-matching-page">

      <div className="ai-matching-header">
        <div>
          <p className="ai-label">
            AI JOB MATCHING
          </p>

          <h1>
            AI Job Matches
          </h1>

          <p>
            Drag the job card to explore opportunities.
          </p>
        </div>
      </div>

      {loading && (
        <div className="ai-loading-card">
          <div className="loading-spinner"></div>

          <h2>
            Finding your best matches...
          </h2>

          <p>
            Our matching engine is analyzing
            available technical jobs.
          </p>
        </div>
      )}

      {error && (
        <div className="ai-error">
          {error}
        </div>
      )}

      {!loading &&
        !error &&
        jobs.length === 0 && (
          <div className="ai-empty-card">
            <h2>
              No matching jobs found
            </h2>

            <p>
              Add technical jobs to the database
              and try again.
            </p>
          </div>
        )}

      {!loading &&
        !error &&
        jobs.length > 0 && (
          <>
            <div className="job-progress">

              <div className="progress-text">
                <span>
                  {viewedCount} / {jobs.length} jobs viewed
                </span>

                <span>
                  {Math.round(progress)}%
                </span>
              </div>

              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{
                    width: `${progress}%`
                  }}
                />
              </div>

            </div>

            <div className="swipe-zone">

              <div className="swipe-instructions">

                <div className="swipe-direction skip-direction">
                  <span>←</span>
                  <strong>SKIP</strong>
                  <small>Drag left</small>
                </div>

                <div className="swipe-direction save-direction">
                  <span>↓</span>
                  <strong>SAVE</strong>
                  <small>Drag down</small>
                </div>

                <div className="swipe-direction apply-direction">
                  <span>→</span>
                  <strong>APPLY</strong>
                  <small>Drag right</small>
                </div>

              </div>

              {currentJob ? (
                <div
                  className={`draggable-card ${
                    action
                      ? `action-${action}`
                      : ""
                  }`}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={() => {
                    if (dragging.current) {
                      finishDrag();
                    }
                  }}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  style={{
                    transform: `translate(${drag.x}px, ${drag.y}px) rotate(${rotation}deg)`,
                    transition: drag.active
                      ? "none"
                      : "transform 0.3s ease"
                  }}
                >

                  {dragLabel && (
                    <div
                      className={`drag-label ${dragLabel.toLowerCase()}`}
                    >
                      {dragLabel}
                    </div>
                  )}

                  <div className="job-card-top">

                    <div className="company-section">

                      <div className="company-logo">
                        {currentJob.company
                          ?.charAt(0)
                          ?.toUpperCase() || "C"}
                      </div>

                      <div>
                        <p>
                          {currentJob.company}
                        </p>

                        <span>
                          {currentJob.location ||
                            "Location not specified"}
                        </span>
                      </div>

                    </div>

                    <div className="match-score">

                      <strong>
                        {currentJob.match_score}%
                      </strong>

                      <span>
                        MATCH
                      </span>

                    </div>

                  </div>

                  <div className="job-title-section">

                    <div className="match-status">
                      {currentJob.match_score >= 80
                        ? "🔥 High Match"
                        : currentJob.match_score >= 60
                        ? "✨ Good Match"
                        : "💼 Potential Match"}
                    </div>

                    <h2>
                      {currentJob.title}
                    </h2>

                    <div className="job-meta">

                      <span>
                        💼 Full-time
                      </span>

                      <span>
                        📍{" "}
                        {currentJob.location ||
                          "Flexible"}
                      </span>

                      <span>
                        🎯{" "}
                        {currentJob.experience_match
                          ? "Experience matched"
                          : "Experience gap"}
                      </span>

                    </div>

                  </div>

                  <div className="job-card-divider"></div>

                  <div className="skills-section">

                    <h3>
                      Matched Skills
                    </h3>

                    <div className="skills-row">

                      {currentJob.matched_skills?.length > 0 ? (
                        currentJob.matched_skills.map(
                          (skill, index) => (
                            <span
                              className="matched-skill"
                              key={index}
                            >
                              ✓ {skill}
                            </span>
                          )
                        )
                      ) : (
                        <span className="skill-empty">
                          No matching skills
                        </span>
                      )}

                    </div>

                  </div>

                  <div className="skills-section">

                    <h3 className="missing-title">
                      Missing Skills
                    </h3>

                    <div className="skills-row">

                      {currentJob.missing_skills?.length > 0 ? (
                        currentJob.missing_skills.map(
                          (skill, index) => (
                            <span
                              className="missing-skill"
                              key={index}
                            >
                              {skill}
                            </span>
                          )
                        )
                      ) : (
                        <span className="skill-empty">
                          No major missing skills
                        </span>
                      )}

                    </div>

                  </div>

                  <div className="drag-hint">
                    Drag this card
                    <span>
                      ← Skip
                    </span>
                    <span>
                      ↓ Save
                    </span>
                    <span>
                      Apply →
                    </span>
                  </div>

                </div>
              ) : (
                <div className="ai-empty-card">
                  <h2>
                    All jobs reviewed
                  </h2>

                  <p>
                    You've gone through all the
                    recommended jobs.
                  </p>

                  <button
                    className="restart-button"
                    onClick={resetCards}
                  >
                    Start Again
                  </button>
                </div>
              )}

            </div>
          </>
        )}

    </div>
  );
}

export default AIJobMatching;