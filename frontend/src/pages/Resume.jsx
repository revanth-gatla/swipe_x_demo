import { useEffect, useState } from "react";
import API from "../services/api.js";
import { clearRecommendationsCache } from "../services/cache.js";

function Resume() {
  const [file, setFile] = useState(null);
  const [currentResume, setCurrentResume] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const refreshResume = async () => {
    try {
      const res = await API.get("/resume");
      if (res.data?.resume) {
        setCurrentResume(res.data.resume);
      }
    } catch (err) {
      console.error("Failed to fetch resume:", err);
    }
  };

  useEffect(() => {
    let ignore = false;

    const loadResume = async () => {
      try {
        const res = await API.get("/resume");
        if (!ignore && res.data?.resume) {
          setCurrentResume(res.data.resume);
        }
      } catch (err) {
        console.error("Failed to fetch resume:", err);
      } finally {
        if (!ignore) {
          setFetching(false);
        }
      }
    };

    loadResume();

    return () => {
      ignore = true;
    };
  }, []);

  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
    setError("");
    setSuccessMessage("");
    setUploadResult(null);

    if (!selectedFile) {
      setFile(null);
      return;
    }

    if (selectedFile.type !== "application/pdf" && !selectedFile.name.endsWith(".pdf")) {
      setFile(null);
      setError("Please select a valid PDF file.");
      return;
    }

    setFile(selectedFile);
  };

  const handleSingleActionUpload = async () => {
    if (!file) {
      setError("Please choose a PDF resume file first.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccessMessage("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      // Single action: backend handles save -> parse -> extract details -> store
      const response = await API.post("/resume/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setUploadResult(response.data);
      setSuccessMessage("Resume Analyzed Successfully✓");
      setFile(null);

      // Refresh stored resume state and invalidate recommendations cache
      refreshResume();
      clearRecommendationsCache();
    } catch (err) {
      setError(
        err.response?.data?.detail || "Resume upload and extraction failed."
      );
    } finally {
      setLoading(false);
    }
  };

  const displayedResume = uploadResult
    ? {
        file_name: uploadResult.file_name,
        skills: Array.isArray(uploadResult.skills)
          ? uploadResult.skills.join(", ")
          : uploadResult.skills,
        experience: uploadResult.experience,
        uploaded_at: "Just now",
      }
    : currentResume;

  const skillsList = displayedResume?.skills
    ? displayedResume.skills
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  return (
    <div className="resume-page">
      <div className="resume-header">
        <div>
          <p className="page-label">RESUME WORKSPACE</p>
          <h1>Resume Analysis</h1>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}
      {successMessage && <div className="success-message">{successMessage}</div>}

      {/* SINGLE UPLOAD ACTION CARD */}
      <section className="resume-card">
        <h2>Upload Resume</h2>

        <label className="resume-upload-box">
          <input
            type="file"
            accept=".pdf,application/pdf"
            onChange={handleFileChange}
            disabled={loading}
          />

          <div style={{ fontSize: "28px" }}>📄</div>
          <strong>
            {file ? file.name : "Choose Resume"}
          </strong>
          <span>PDF documents only • Max 10MB</span>
        </label>

        <div style={{ marginTop: "18px", display: "flex", alignItems: "center", gap: "14px" }}>
          <button
            className="primary-btn"
            onClick={handleSingleActionUpload}
            disabled={!file || loading}
          >
            {loading ? "Analyzing Resume..." : "Analyze Resume🔎"}
          </button>

          {file && !loading && (
            <button
              className="secondary-btn"
              onClick={() => {
                setFile(null);
                setError("");
              }}
            >
              Clear
            </button>
          )}
        </div>


      </section>

      {/* EXTRACTED INFORMATION CARD */}
      {fetching && (
        <div className="profile-loading" style={{ marginTop: "24px" }}>
          Loading your stored resume details...
        </div>
      )}

      {!fetching && displayedResume && (
        <section className="resume-card" style={{ marginTop: "25px" }}>
          <div className="step-heading">
            <div className="step-number">SX</div>
            <div>
              <h2>Current Resume Details</h2>
              <p>
                <strong>{displayedResume.file_name}</strong>
                {displayedResume.uploaded_at && ` • Uploaded ${displayedResume.uploaded_at}`}
              </p>
            </div>
          </div>

          <div className="extraction-result" style={{ marginTop: "15px", paddingTop: "15px" }}>
            {/* EXTRACTED SKILLS */}
            <div className="result-block">
              <span>Extracted Skills ({skillsList.length})</span>
              <div className="skill-list">
                {skillsList.length > 0 ? (
                  skillsList.map((skill, idx) => (
                    <span className="skill-tag" key={idx}>
                      ✓ {skill}
                    </span>
                  ))
                ) : (
                  <span style={{ color: "#999" }}>
                    No skills extracted yet.
                  </span>
                )}
              </div>
            </div>

            {/* EXTRACTED EXPERIENCE */}
            <div className="result-block">
              <span>Extracted Work Experience Summary</span>
              <p>
                {displayedResume.experience ||
                  "No work experience summary extracted."}
              </p>
            </div>
          </div>
        </section>
      )}

      {!fetching && !displayedResume && (
        <div className="ai-empty-card" style={{ marginTop: "25px" }}>
          <h2>No Resume Uploaded Yet</h2>
          <p>
            Upload your resume above to unlock job recommendations and job-specific ATS analyses.
          </p>
        </div>
      )}
    </div>
  );
}

export default Resume;