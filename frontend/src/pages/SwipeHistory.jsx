import { useEffect, useState } from "react";
import API from "../services/api";

function SwipeHistory() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const perPage = 20;

  useEffect(() => {
    let ignore = false;

    const fetchHistory = async () => {
      try {
        const res = await API.get("/swipe-history");
        const data = res.data;
        // Handle both object response { history: [...] } and plain array
        const list = Array.isArray(data) ? data : data.history || [];
        if (!ignore) {
          setHistory(list);
        }
      } catch (err) {
        if (!ignore) {
          setError(
            err.response?.data?.detail || "Failed to load swipe history."
          );
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    fetchHistory();

    return () => {
      ignore = true;
    };
  }, []);

  const handleFilterChange = (newFilter) => {
    setFilter(newFilter);
    setPage(1);
  };

  const filteredHistory = history.filter((item) => {
    if (filter === "ALL") return true;
    return item.action === filter;
  });

  const totalPages = Math.ceil(filteredHistory.length / perPage) || 1;
  const paginatedHistory = filteredHistory.slice(
    (page - 1) * perPage,
    page * perPage
  );

  const getActionBadge = (action) => {
    switch (action) {
      case "RIGHT":
        return {
          label: "Interested",
          className: "badge-right",
          icon: "✓",
        };
      case "SAVE":
        return {
          label: "Saved",
          className: "badge-save",
          icon: "🔖",
        };
      case "LEFT":
        return {
          label: "Passed",
          className: "badge-left",
          icon: "✕",
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
        </div>
      </div>

      {/* FILTER TABS */}
      <div className="history-filter-tabs">
        <button
          type="button"
          className={`filter-tab ${filter === "ALL" ? "active" : ""}`}
          onClick={() => handleFilterChange("ALL")}
        >
          All ({counts.ALL})
        </button>
        <button
          type="button"
          className={`filter-tab tab-right ${filter === "RIGHT" ? "active" : ""}`}
          onClick={() => handleFilterChange("RIGHT")}
        >
          ✓ Interested ({counts.RIGHT})
        </button>
        <button
          type="button"
          className={`filter-tab tab-save ${filter === "SAVE" ? "active" : ""}`}
          onClick={() => handleFilterChange("SAVE")}
        >
          🔖 Saved ({counts.SAVE})
        </button>
        <button
          type="button"
          className={`filter-tab tab-left ${filter === "LEFT" ? "active" : ""}`}
          onClick={() => handleFilterChange("LEFT")}
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
        <>
          <div className="history-grid">
            {paginatedHistory.map((item) => {
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

          {/* PAGINATION CONTROLS */}
          {totalPages > 1 && (
            <div className="discover-pagination" style={{ marginTop: "28px" }}>
              <button
                type="button"
                className="secondary-btn"
                disabled={page <= 1}
                onClick={() => {
                  setPage((p) => Math.max(1, p - 1));
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
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
                      type="button"
                      className={`pagination-btn ${pageNum === page ? "active" : ""}`}
                      onClick={() => {
                        setPage(pageNum);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                className="secondary-btn"
                disabled={page >= totalPages}
                onClick={() => {
                  setPage((p) => Math.min(totalPages, p + 1));
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default SwipeHistory;
