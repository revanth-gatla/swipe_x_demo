import { useEffect, useState } from "react";
import API from "../services/api";

function Applications() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchApplications = async () => {
    try {
      const response = await API.get("/applications");

      const data = response.data || [];

      setApplications(
        data.map((application) => ({
          id: application[0],
          job_id: application[1],
          title: application[2],
          company: application[3],
          status: application[4],
          applied_at: application[5],
        }))
      );
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Unable to load applications."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, []);

  const getStatusClass = (status) => {
    const value = status?.toLowerCase();

    if (value === "applied") {
      return "application-status applied";
    }

    if (
      value === "under review" ||
      value === "review"
    ) {
      return "application-status review";
    }

    if (value === "shortlisted") {
      return "application-status shortlisted";
    }

    if (
      value === "rejected" ||
      value === "declined"
    ) {
      return "application-status rejected";
    }

    if (
      value === "selected" ||
      value === "hired"
    ) {
      return "application-status selected";
    }

    return "application-status";
  };

  const getStatusText = (status) => {
    if (!status) {
      return "Applied";
    }

    const value = status.toLowerCase();

    if (value === "under review" || value === "review") {
      return "Under Review";
    }

    if (value === "shortlisted") {
      return "Shortlisted";
    }

    if (value === "rejected" || value === "declined") {
      return "Rejected";
    }

    if (value === "selected" || value === "hired") {
      return "Selected";
    }

    return "Applied";
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
    <div className="applications-page">

      <div className="applications-header">

        <div>
          <p className="page-label">
            APPLICATIONS
          </p>

          <h1>
            My Applications
          </h1>

          <p className="page-description">
            Track the jobs you've applied for.
          </p>
        </div>

        <div className="applications-count">
          <strong>
            {applications.length}
          </strong>

          <span>
            Applications
          </span>
        </div>

      </div>

      {error && (
        <div className="applications-error">
          {error}
        </div>
      )}

      {loading && (
        <div className="applications-empty">

          <div className="application-loader"></div>

          <h2>
            Loading applications...
          </h2>

          <p>
            Fetching your application history.
          </p>

        </div>
      )}

      {!loading &&
        !error &&
        applications.length === 0 && (
          <div className="applications-empty">

            <div className="empty-application-icon">
              📄
            </div>

            <h2>
              No applications yet
            </h2>

            <p>
              When you swipe right on a job,
              your application will appear here.
            </p>

          </div>
        )}

      {!loading &&
        !error &&
        applications.length > 0 && (
          <div className="applications-list">

            {applications.map((application) => (
              <div
                className="application-card"
                key={application.id}
              >

                <div className="application-company-logo">
                  {application.company
                    ?.charAt(0)
                    ?.toUpperCase() || "C"}
                </div>

                <div className="application-main">

                  <div className="application-title-row">

                    <div>
                      <h2>
                        {application.title}
                      </h2>

                      <p>
                        {application.company}
                      </p>
                    </div>

                    <span
                      className={getStatusClass(
                        application.status
                      )}
                    >
                      {getStatusText(
                        application.status
                      )}
                    </span>

                  </div>

                  <div className="application-meta">

                    <span>
                      🗓 Applied{" "}
                      {formatDate(
                        application.applied_at
                      )}
                    </span>

                    <span>
                      💼 Application #{application.id}
                    </span>

                  </div>

                </div>

              </div>
            ))}

          </div>
        )}

    </div>
  );
}

export default Applications;