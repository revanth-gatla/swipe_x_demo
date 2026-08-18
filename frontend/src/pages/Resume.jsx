import { useState } from "react";
import API from "../services/api.js";

function Resume() {
  const [file, setFile] = useState(null);

  const [uploadResult, setUploadResult] = useState(null);
  const [parseResult, setParseResult] = useState(null);
  const [extractResult, setExtractResult] = useState(null);
  const [atsResult, setAtsResult] = useState(null);

  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");

  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];

    setError("");
    setUploadResult(null);
    setParseResult(null);
    setExtractResult(null);
    setAtsResult(null);

    if (!selectedFile) {
      setFile(null);
      return;
    }

    if (selectedFile.type !== "application/pdf") {
      setFile(null);
      setError("Please select a PDF file.");
      return;
    }

    setFile(selectedFile);
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a PDF resume first.");
      return;
    }

    setLoading("upload");
    setError("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await API.post(
        "/resume/upload",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      setUploadResult(response.data);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Resume upload failed."
      );
    } finally {
      setLoading("");
    }
  };

  const handleParse = async () => {
    setLoading("parse");
    setError("");

    try {
      const response = await API.post(
        "/resume/parse"
      );

      setParseResult(response.data);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Resume parsing failed."
      );
    } finally {
      setLoading("");
    }
  };

  const handleExtract = async () => {
    setLoading("extract");
    setError("");

    try {
      const response = await API.post(
        "/resume/extract"
      );

      setExtractResult(response.data);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Skill extraction failed."
      );
    } finally {
      setLoading("");
    }
  };

  const handleATS = async () => {
    setLoading("ats");
    setError("");

    try {
      const response = await API.post(
        "/resume/ats"
      );

      setAtsResult(response.data);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "ATS analysis failed."
      );
    } finally {
      setLoading("");
    }
  };

  return (
    <div className="resume-page">

      <div className="resume-header">

        <div>
          <p className="page-label">
            RESUME & ATS
          </p>

          <h1>Resume Analysis</h1>

          <p className="page-description">
            Upload your resume and analyze it
            using SWIPE X AI.
          </p>
        </div>

      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {/* UPLOAD */}

      <section className="resume-card">

        <h2>Upload Resume</h2>

        <p className="resume-card-description">
          Upload your latest resume in PDF format.
        </p>

        <label className="resume-upload-box">

          <input
            type="file"
            accept=".pdf,application/pdf"
            onChange={handleFileChange}
          />

          <strong>
            {file
              ? file.name
              : "Choose your PDF resume"}
          </strong>

          <span>
            PDF files only
          </span>

        </label>

        <button
          className="primary-btn"
          onClick={handleUpload}
          disabled={
            !file || loading === "upload"
          }
        >
          {loading === "upload"
            ? "Uploading..."
            : "Upload Resume"}
        </button>

        {uploadResult && (
          <div className="resume-status success">
            ✓ {uploadResult.message}
          </div>
        )}

      </section>

      {/* PARSE */}

      {uploadResult && (
        <section className="resume-card">

          <div className="step-heading">
            <span className="step-number">
              01
            </span>

            <div>
              <h2>Parse Resume</h2>

              <p>
                Extract the text from your uploaded
                PDF.
              </p>
            </div>
          </div>

          <button
            className="primary-btn"
            onClick={handleParse}
            disabled={loading === "parse"}
          >
            {loading === "parse"
              ? "Parsing..."
              : "Parse Resume"}
          </button>

          {parseResult && (
            <div className="resume-status success">
              ✓ {parseResult.message}
            </div>
          )}

        </section>
      )}

      {/* AI EXTRACTION */}

      {parseResult && (
        <section className="resume-card">

          <div className="step-heading">
            <span className="step-number">
              02
            </span>

            <div>
              <h2>Extract Details</h2>

              <p>
                AI identifies your skills and
                work experience.
              </p>
            </div>
          </div>

          <button
            className="primary-btn"
            onClick={handleExtract}
            disabled={loading === "extract"}
          >
            {loading === "extract"
              ? "Analyzing..."
              : "Extract Details"}
          </button>

          {extractResult && (
            <div className="extraction-result">

              <div className="result-block">

                <span>Skills</span>

                <div className="skill-list">

                  {extractResult.skills?.map(
                    (skill, index) => (
                      <span
                        className="skill-tag"
                        key={index}
                      >
                        {skill}
                      </span>
                    )
                  )}

                </div>

              </div>

              <div className="result-block">

                <span>Experience</span>

                <p>
                  {extractResult.experience ||
                    "No experience details found."}
                </p>

              </div>

            </div>
          )}

        </section>
      )}

      {/* ATS */}

      {parseResult && (
        <section className="resume-card ats-card">

          <div className="step-heading">
            <span className="step-number">
              03
            </span>

            <div>
              <h2>ATS Analysis</h2>

              <p>
                Get your resume compatibility
                score from 0 to 100.
              </p>
            </div>
          </div>

          <button
            className="primary-btn"
            onClick={handleATS}
            disabled={loading === "ats"}
          >
            {loading === "ats"
              ? "Analyzing ATS..."
              : "Analyze ATS Score"}
          </button>

          {atsResult && (
            <div className="ats-result">

              <div className="ats-score">

                <strong>
                  {atsResult.ats_score}
                </strong>

                <span>/ 100</span>

              </div>

              <p>
                ATS compatibility score
              </p>

            </div>
          )}

        </section>
      )}

    </div>
  );
}

export default Resume;