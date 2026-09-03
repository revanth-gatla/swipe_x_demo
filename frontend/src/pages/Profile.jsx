import { useEffect, useState } from "react";
import API from "../services/api.js";

const EMPTY_PROFILE = {
  phone: "",
  location: "",
  education: "",
  experience_years: 0,
  skills: "",
  bio: "",
  preferred_roles: "",
  preferred_locations: "",
  career_interests: "",
  work_mode_preference: "",
};

function Profile() {
  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [skillInput, setSkillInput] = useState("");
  const [exists, setExists] = useState(false);

  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await API.get("/profile");

      setProfile({
        ...EMPTY_PROFILE,
        ...response.data,
      });

      setExists(true);
      setEditing(false);
    } catch (err) {
      if (err.response?.status === 404) {
        setProfile(EMPTY_PROFILE);
        setExists(false);
        setEditing(true);
      } else if (err.response?.status === 401) {
        setError("Session expired. Please login again.");
      } else {
        setError(
          err.response?.data?.detail || "Unable to load profile."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setProfile((current) => ({
      ...current,
      [field]: value,
    }));
  };

  // Skill chip handlers
  const getSkillsArray = () => {
    if (!profile.skills) return [];
    return profile.skills
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  };

  const addSkill = (skillToAdd) => {
    const trimmed = skillToAdd.trim();
    if (!trimmed) return;

    const currentSkills = getSkillsArray();
    if (!currentSkills.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      const updated = [...currentSkills, trimmed].join(", ");
      handleChange("skills", updated);
    }
    setSkillInput("");
  };

  const removeSkill = (skillToRemove) => {
    const updated = getSkillsArray()
      .filter((s) => s.toLowerCase() !== skillToRemove.toLowerCase())
      .join(", ");
    handleChange("skills", updated);
  };

  const handleSkillKeyDown = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addSkill(skillInput);
    }
  };

  const handleSave = async (event) => {
    event.preventDefault();

    setSaving(true);
    setMessage("");
    setError("");

    // PHONE NUMBER VALIDATION
    const phone = (profile.phone || "").trim();
    if (phone && !/^[0-9]{10}$/.test(phone)) {
      setError("Phone number must be exactly 10 digits.");
      setSaving(false);
      return;
    }

    const payload = {
      phone: phone,
      location: (profile.location || "").trim(),
      education: (profile.education || "").trim(),
      experience_years: parseFloat(profile.experience_years) || 0,
      skills: (profile.skills || "").trim(),
      bio: (profile.bio || "").trim(),
      preferred_roles: (profile.preferred_roles || "").trim(),
      preferred_locations: (profile.preferred_locations || "").trim(),
      career_interests: (profile.career_interests || "").trim(),
      work_mode_preference: (profile.work_mode_preference || "").trim(),
    };

    try {
      if (exists) {
        await API.put("/profile", payload);
        setMessage("Profile updated successfully.");
      } else {
        await API.post("/profile", payload);
        setExists(true);
        setMessage("Profile created successfully.");
      }

      setProfile(payload);
      setEditing(false);
    } catch (err) {
      if (err.response?.status === 401) {
        setError("Session expired. Please login again.");
      } else {
        setError(
          err.response?.data?.detail || "Could not save profile."
        );
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setMessage("");
    setError("");
    setEditing(false);
  };

  if (loading) {
    return <div className="profile-loading">Loading profile...</div>;
  }

  const skillsList = getSkillsArray();

  return (
    <div className="profile-page">
      {/* HEADER */}
      <div className="profile-page-header">
        <div>
          <p className="page-label">CANDIDATE PROFILE</p>
          <h1>Your Profile</h1>
          <p className="page-description">
            Your candidate profile and preferences are used by the AI engine to recommend ideal jobs.
          </p>
        </div>

        {exists && !editing && (
          <button
            className="primary-btn"
            onClick={() => {
              setMessage("");
              setError("");
              setEditing(true);
            }}
          >
            Edit Profile
          </button>
        )}
      </div>

      {/* MESSAGES */}
      {message && <div className="success-message">{message}</div>}
      {error && <div className="error-message">{error}</div>}

      {/* VIEW PROFILE */}
      {!editing && exists ? (
        <section className="profile-card">
          <div className="profile-card-header">
            <div className="profile-avatar-large">SX</div>
            <div>
              <h2>Candidate Profile & Preferences</h2>
              <p>{profile.location || "Location not added"}</p>
            </div>
          </div>

          <div className="profile-details-grid">
            <ProfileInfo label="Phone Number" value={profile.phone} />
            <ProfileInfo label="Current Location" value={profile.location} />
            <ProfileInfo label="Education" value={profile.education} />
            <ProfileInfo
              label="Total Experience"
              value={
                Number(profile.experience_years) === 0
                  ? "Fresher / 0 years"
                  : `${profile.experience_years} years`
              }
            />

            {/* PREFERENCE HIGHLIGHTS */}
            <ProfileInfo
              label="Preferred Roles"
              value={profile.preferred_roles || "Any matching role"}
            />
            <ProfileInfo
              label="Preferred Locations"
              value={profile.preferred_locations || "Any location"}
            />
            <ProfileInfo
              label="Work Mode Preference"
              value={profile.work_mode_preference || "Flexible"}
            />
            <ProfileInfo
              label="Career Interests"
              value={profile.career_interests || "Not specified"}
            />

            {/* SKILLS CHIPS */}
            <div className="profile-info full">
              <span>Skills ({skillsList.length})</span>
              <div className="skill-list" style={{ marginTop: "6px" }}>
                {skillsList.length > 0 ? (
                  skillsList.map((skill, idx) => (
                    <span className="skill-tag" key={idx}>
                      {skill}
                    </span>
                  ))
                ) : (
                  <span style={{ color: "#999" }}>No skills added yet</span>
                )}
              </div>
            </div>

            <ProfileInfo
              label="About / Bio"
              value={profile.bio}
              full
            />
          </div>
        </section>
      ) : (
        /* CREATE / EDIT PROFILE */
        <form className="profile-card" onSubmit={handleSave}>
          {/* SECTION 1: BASIC INFO */}
          <div className="profile-section">
            <div className="profile-section-title">
              <h2>1. Candidate Information</h2>
              <p>Personal and academic background.</p>
            </div>

            <div className="profile-form-grid">
              {/* PHONE */}
              <div className="profile-field">
                <label>Phone Number</label>
                <input
                  type="tel"
                  value={profile.phone || ""}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "");
                    if (val.length <= 10) handleChange("phone", val);
                  }}
                  placeholder="10-digit phone number"
                  maxLength={10}
                  pattern="[0-9]{10}"
                  inputMode="numeric"
                />
                <small
                  style={{
                    color:
                      (profile.phone || "").length === 10 ? "green" : "#777",
                    marginTop: "4px",
                    display: "block",
                  }}
                >
                  {(profile.phone || "").length}/10 digits
                </small>
              </div>

              {/* LOCATION */}
              <div className="profile-field">
                <label>Current Location</label>
                <input
                  type="text"
                  value={profile.location || ""}
                  onChange={(e) => handleChange("location", e.target.value)}
                  placeholder="e.g. Hyderabad, India"
                />
              </div>

              {/* EDUCATION */}
              <div className="profile-field">
                <label>Education</label>
                <input
                  type="text"
                  value={profile.education || ""}
                  onChange={(e) => handleChange("education", e.target.value)}
                  placeholder="e.g. B.Tech Computer Science"
                />
              </div>

              {/* EXPERIENCE (DECIMAL SUPPORT) */}
              <div className="profile-field">
                <label>Experience (Years)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="50"
                  value={profile.experience_years}
                  onChange={(e) =>
                    handleChange("experience_years", e.target.value)
                  }
                  placeholder="e.g. 2.5 (decimals supported)"
                />
                <small style={{ color: "#777", marginTop: "4px", display: "block" }}>
                  Supports 0, 1, 2.5, 3.5, etc.
                </small>
              </div>
            </div>
          </div>

          {/* SECTION 2: CANDIDATE PREFERENCES */}
          <div className="profile-section" style={{ marginTop: "30px", paddingTop: "25px", borderTop: "1px solid #eeeaf2" }}>
            <div className="profile-section-title">
              <h2>2. Candidate Preferences</h2>
              <p>These preferences personalize your job recommendation rankings.</p>
            </div>

            <div className="profile-form-grid">
              {/* PREFERRED ROLES */}
              <div className="profile-field">
                <label>Preferred Job Roles</label>
                <input
                  type="text"
                  value={profile.preferred_roles || ""}
                  onChange={(e) => handleChange("preferred_roles", e.target.value)}
                  placeholder="e.g. Backend Developer, Python Engineer"
                />
                <small style={{ color: "#777", marginTop: "4px", display: "block" }}>
                  Comma-separated roles
                </small>
              </div>

              {/* PREFERRED LOCATIONS */}
              <div className="profile-field">
                <label>Preferred Locations</label>
                <input
                  type="text"
                  value={profile.preferred_locations || ""}
                  onChange={(e) =>
                    handleChange("preferred_locations", e.target.value)
                  }
                  placeholder="e.g. Remote, Bangalore, Hyderabad"
                />
                <small style={{ color: "#777", marginTop: "4px", display: "block" }}>
                  Comma-separated cities or Remote
                </small>
              </div>

              {/* WORK MODE PREFERENCE */}
              <div className="profile-field">
                <label>Work Mode Preference</label>
                <select
                  value={profile.work_mode_preference || ""}
                  onChange={(e) =>
                    handleChange("work_mode_preference", e.target.value)
                  }
                >
                  <option value="">Flexible / Any</option>
                  <option value="Remote">Remote</option>
                  <option value="Hybrid">Hybrid</option>
                  <option value="On-site">On-site</option>
                </select>
              </div>

              {/* CAREER INTERESTS */}
              <div className="profile-field">
                <label>Career Interests / Industries</label>
                <input
                  type="text"
                  value={profile.career_interests || ""}
                  onChange={(e) =>
                    handleChange("career_interests", e.target.value)
                  }
                  placeholder="e.g. AI / ML, FinTech, SaaS, Cloud"
                />
              </div>
            </div>
          </div>

          {/* SECTION 3: SKILLS & BIO */}
          <div className="profile-section" style={{ marginTop: "30px", paddingTop: "25px", borderTop: "1px solid #eeeaf2" }}>
            <div className="profile-section-title">
              <h2>3. Skills & Bio</h2>
              <p>Add technical and professional skills for matching.</p>
            </div>

            <div className="profile-form-grid">
              {/* SKILLS INPUT WITH TAGS */}
              <div className="profile-field full">
                <label>Skills</label>
                <div className="skill-input-container">
                  <div className="skill-chips-row">
                    {skillsList.map((skill, idx) => (
                      <span className="skill-chip" key={idx}>
                        {skill}
                        <button
                          type="button"
                          className="chip-remove"
                          onClick={() => removeSkill(skill)}
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>

                  <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                    <input
                      type="text"
                      value={skillInput}
                      onChange={(e) => setSkillInput(e.target.value)}
                      onKeyDown={handleSkillKeyDown}
                      placeholder="Type a skill and press Enter or comma (e.g. Python, Docker, PostgreSQL)"
                    />
                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={() => addSkill(skillInput)}
                    >
                      + Add
                    </button>
                  </div>
                </div>
              </div>

              {/* BIO */}
              <div className="profile-field full">
                <label>About / Bio</label>
                <textarea
                  value={profile.bio || ""}
                  onChange={(e) => handleChange("bio", e.target.value)}
                  placeholder="Tell recruiters about yourself, your projects, and your goals..."
                  rows="4"
                />
              </div>
            </div>
          </div>

          {/* ACTIONS */}
          <div className="profile-actions">
            {exists && (
              <button
                type="button"
                className="secondary-btn"
                onClick={handleCancel}
                disabled={saving}
              >
                Cancel
              </button>
            )}

            <button
              type="submit"
              className="primary-btn"
              disabled={
                saving ||
                ((profile.phone || "").length > 0 &&
                  (profile.phone || "").length !== 10)
              }
            >
              {saving
                ? "Saving..."
                : exists
                ? "Save Changes"
                : "Create Profile"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function ProfileInfo({ label, value, full = false }) {
  return (
    <div className={`profile-info ${full ? "full" : ""}`}>
      <span>{label}</span>
      <strong>{value || "Not added yet"}</strong>
    </div>
  );
}

export default Profile;