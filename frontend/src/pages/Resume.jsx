import { useState } from "react";
import API from "../services/api";

function Resume() {
  const [file, setFile] = useState(null);
  const [resumeText, setResumeText] = useState("");
  const [skills, setSkills] = useState([]);
  const [experience, setExperience] = useState("");
  const [atsScore, setAtsScore] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleFileChange = (event) => {
    setFile(event.target.files[0]);
  };

  const uploadResume = async () => {
    if (!file) {
      setError("Please select a resume");
      return;
    }

    setError("");
    setMessage("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      await API.post("/resume/upload", formData);

      setMessage("Resume uploaded successfully");
    } catch (error) {
      setError(
        error.response?.data?.detail ||
        "Resume upload failed"
      );
    }
  };

  const parseResume = async () => {
    setError("");
    setMessage("");

    try {
      const response = await API.post("/resume/parse");

      setResumeText(response.data.extracted_text);
      setMessage("Resume parsed successfully");
    } catch (error) {
      setError(
        error.response?.data?.detail ||
        "Resume parsing failed"
      );
    }
  };

  const extractDetails = async () => {
    setError("");
    setMessage("");

    try {
      const response = await API.post("/resume/extract");

      setSkills(response.data.skills);
      setExperience(response.data.experience);
      setMessage("Resume details extracted successfully");
    } catch (error) {
      setError(
        error.response?.data?.detail ||
        "Resume extraction failed"
      );
    }
  };

  const analyzeATS = async () => {
    setError("");
    setMessage("");

    try {
      const response = await API.post("/resume/ats");

      setAtsScore(response.data.ats_score);
      setMessage("ATS analysis completed");
    } catch (error) {
      setError(
        error.response?.data?.detail ||
        "ATS analysis failed"
      );
    }
  };

  return (
    <div className="page-container">
      <h1>Resume & ATS</h1>

      <div className="resume-section">
        <h2>Upload Resume</h2>

        <input
          type="file"
          accept=".pdf"
          onChange={handleFileChange}
        />

        <button onClick={uploadResume}>
          Upload Resume
        </button>
      </div>

      <div className="resume-section">
        <h2>Resume Processing</h2>

        <button onClick={parseResume}>
          Parse Resume
        </button>

        <button onClick={extractDetails}>
          Extract Details
        </button>

        <button onClick={analyzeATS}>
          Calculate ATS Score
        </button>
      </div>

      {resumeText && (
        <div className="resume-section">
          <h2>Extracted Resume Text</h2>
          <pre>{resumeText}</pre>
        </div>
      )}

      {skills.length > 0 && (
        <div className="resume-section">
          <h2>Skills</h2>

          <ul>
            {skills.map((skill, index) => (
              <li key={index}>{skill}</li>
            ))}
          </ul>

          <h2>Experience</h2>
          <p>{experience}</p>
        </div>
      )}

      {atsScore !== null && (
        <div className="resume-section">
          <h2>ATS Score</h2>
          <div className="ats-score">
            {atsScore}/100
          </div>
        </div>
      )}

      {message && (
        <p className="success">
          {message}
        </p>
      )}

      {error && (
        <p className="error">
          {error}
        </p>
      )}
    </div>
  );
}

export default Resume;