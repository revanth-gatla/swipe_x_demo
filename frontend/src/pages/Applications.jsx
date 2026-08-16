import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import API from "../services/api";

function Applications() {
  const [applications, setApplications] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadApplications();
  }, []);

  const loadApplications = async () => {
    try {
      const response = await API.get("/applications");
      setApplications(response.data);
    } catch (error) {
      setError(
        error.response?.data?.detail ||
        "Unable to load applications"
      );
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <h1>My Applications</h1>
        <p>Loading applications...</p>
      </div>
    );
  }

  return (
    <div className="page-container">
      <h1>My Applications</h1>

      {error && (
        <p className="error">
          {error}
        </p>
      )}

      {!error && applications.length === 0 && (
        <p>You haven't applied for any jobs yet.</p>
      )}

      <div className="applications-list">
        {applications.map((application) => (
          <div
            className="application-card"
            key={application[0]}
          >
            <h2>{application[2]}</h2>

            <p>
              <strong>Company:</strong>{" "}
              {application[3]}
            </p>

            <p>
              <strong>Status:</strong>{" "}
              {application[4]}
            </p>

            <p>
              <strong>Applied:</strong>{" "}
              {application[5]}
            </p>

            <Link
              to={`/jobs/${application[1]}`}
            >
              View Job
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Applications;