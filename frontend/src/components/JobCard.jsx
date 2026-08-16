import { Link } from "react-router-dom";

function JobCard({ job }) {
  return (
    <div className="job-card">
      <div className="job-card-header">
        <h2>{job.title}</h2>

        {job.match_score !== undefined && (
          <span className="match-score">
            {job.match_score}% Match
          </span>
        )}
      </div>

      <p className="company">
        {job.company}
      </p>

      <p>
        <strong>Location:</strong>{" "}
        {job.location}
      </p>

      <p>
        <strong>Experience:</strong>{" "}
        {job.experience_required} years
      </p>

      <p>
        <strong>Salary:</strong>{" "}
        {job.salary}
      </p>

      <p className="job-description">
        {job.description}
      </p>

      <div className="job-card-actions">
        <Link
          to={`/jobs/${job.id}`}
          className="view-job-button"
        >
          View Details
        </Link>
      </div>
    </div>
  );
}

export default JobCard;