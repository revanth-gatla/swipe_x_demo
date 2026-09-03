import { useEffect, useState } from "react";
import API from "../services/api";

function SwipeHistory() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("ALL");

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await API.get("/swipe-history");
      setHistory(res.data || []);
    } catch (err) {
      setError(
        err.response?.data?.detail || "Failed to load swipe history."
      );
    } finally {
      setLoading(false);
    }
  };

  const filteredHistory = history.filter((item) => {
    if (filter === "ALL") return true;
    return item.action === filter;
  });

  const getActionBadge = (action) => {
    switch (action) {
      case "RIGHT":
        return {
          label: "Interested",
          className: "badge-right",
          icon: "✓",
        };
      case "LEFT":
        return {
          label: "Passed",
          className: "badge-left",
          icon: "✕",
        };
      case "SAVE":
        return {
          label: "Saved",
          className: "badge-save",
          icon: "🔖",
        };
      default:
        return {
          label: action,
          className: "badge-default",
          icon: "•",
        };
    }
  };

  const counts = {
    ALL: history.length,
    RIGHT: history.filter((h) => h.action === "RIGHT").length,
    SAVE: history.filter((h) => h.action === "SAVE").length,
    LEFT: history.filter((h) => h.action === "LEFT").length,
  };

  return (
    <div className="swipe-history-page">
      <div className="profile-page-header">
        <div>
          <p className="page-label">ACTIVITY LOG</p>
          <h1>Swipe History</h1>
          <p className="page-description">
            Review your past interactions. The AI engine learns from your swipes to continuously personalize future recommendations.
          </p>
        </div>
      </div>

      {/* FILTER TABS */}
      <div className="history-filter-tabs">
        <button
          className={`filter-tab ${filter === "ALL" ? "active" : ""}`}
          onClick={() => setFilter("ALL")}
        >
          All ({counts.ALL})
        </button>
        <button
          className={`filter-tab tab-right ${filter === "RIGHT" ? "active" : ""}`}
          onClick={() => setFilter("RIGHT")}
        >
          ✓ Interested ({counts.RIGHT})
        </button>
        <button
          className={`filter-tab tab-save ${filter === "SAVE" ? "active" : ""}`}
          onClick={() => setFilter("SAVE")}
        >
          🔖 Saved ({counts.SAVE})
        </button>
        <button
          className={`filter-tab tab-left ${filter === "LEFT" ? "active" : ""}`}
          onClick={() => setFilter("LEFT")}
        >
          ✕ Passed ({counts.LEFT})
        </button>
      </div>

      {loading && (
        <div className="profile-loading">
          <div className="loading-spinner"></div>
          Loading swipe history...
        </div>
      )}

      {error && <div className="error-message">{error}</div>}

      {!loading && !error && filteredHistory.length === 0 && (
        <div className="ai-empty-card" style={{ marginTop: "30px" }}>
          <h2>No swipe records yet</h2>
          <p>
            {filter === "ALL"
              ? "Head over to Recommended Jobs to start discovering and swiping on opportunities!"
              : `No jobs marked as ${filter.toLowerCase()} yet.`}
          </p>
        </div>
      )}

      {!loading && !error && filteredHistory.length > 0 && (
        <div className="history-grid">
          {filteredHistory.map((item) => {
            const badge = getActionBadge(item.action);
            const dateStr = item.created_at
              ? new Date(item.created_at).toLocaleString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "Recent";

            return (
              <div
                key={item.id}
                className={`history-card border-${item.action.toLowerCase()}`}
              >
                <div className="history-card-header">
                  <div>
                    <h3 className="history-job-title">{item.title}</h3>
                    <p className="history-company-name">
                      🏢 {item.company}
                      {item.location && ` • 📍 ${item.location}`}
                    </p>
                  </div>
                  <span className={`history-badge ${badge.className}`}>
                    {badge.icon} {badge.label}
                  </span>
                </div>

                <div className="history-card-footer">
                  <span className="history-salary">
                    {item.salary ? `💰 ${item.salary}` : "Salary not disclosed"}
                  </span>
                  <span className="history-date">Swiped {dateStr}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default SwipeHistory;
