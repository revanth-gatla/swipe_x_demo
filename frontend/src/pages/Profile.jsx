import { useEffect, useState } from "react";
import API from "../services/api.js";

const EMPTY_PROFILE = {
  phone: "",
  location: "",
  education: "",
  experience_years: 0,
  skills: "",
  bio: "",
};

function Profile() {
  const [profile, setProfile] = useState(EMPTY_PROFILE);
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
          err.response?.data?.detail ||
            "Unable to load profile."
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

  const handleSave = async (event) => {
    event.preventDefault();

    setSaving(true);
    setMessage("");
    setError("");

    // PHONE NUMBER VALIDATION
    const phone = profile.phone.trim();

    if (!/^[0-9]{10}$/.test(phone)) {
      setError(
        "Phone number must be exactly 10 digits."
      );
      setSaving(false);
      return;
    }

    const payload = {
      phone: phone,
      location: profile.location.trim(),
      education: profile.education.trim(),
      experience_years: Number(profile.experience_years),
      skills: profile.skills.trim(),
      bio: profile.bio.trim(),
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
          err.response?.data?.detail ||
            "Could not save profile."
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
    return (
      <div className="profile-loading">
        Loading profile...
      </div>
    );
  }

  return (
    <div className="profile-page">

      {/* HEADER */}
      <div className="profile-page-header">

        <div>
          <p className="page-label">
            CANDIDATE PROFILE
          </p>

          <h1>Your Profile</h1>

          <p className="page-description">
            Keep your information updated to
            improve your job matches.
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

      {message && (
        <div className="success-message">
          {message}
        </div>
      )}

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {/* VIEW PROFILE */}

      {!editing && exists ? (

        <section className="profile-card">

          <div className="profile-card-header">

            <div className="profile-avatar-large">
              SX
            </div>

            <div>
              <h2>Candidate Profile</h2>

              <p>
                {profile.location ||
                  "Location not added"}
              </p>
            </div>

          </div>

          <div className="profile-details-grid">

            <ProfileInfo
              label="Phone Number"
              value={profile.phone}
            />

            <ProfileInfo
              label="Location"
              value={profile.location}
            />

            <ProfileInfo
              label="Education"
              value={profile.education}
            />

            <ProfileInfo
              label="Experience"
              value={
                Number(profile.experience_years) === 0
                  ? "Fresher"
                  : `${profile.experience_years} years`
              }
            />

            <ProfileInfo
              label="Skills"
              value={profile.skills}
              full
            />

            <ProfileInfo
              label="About / Bio"
              value={profile.bio}
              full
            />

          </div>

        </section>

      ) : (

        /* CREATE / EDIT PROFILE */

        <form
          className="profile-card"
          onSubmit={handleSave}
        >

          <div className="profile-section">

            <div className="profile-section-title">

              <h2>Candidate Information</h2>

              <p>
                Complete your profile to help
                SWIPE X find suitable jobs.
              </p>

            </div>

            <div className="profile-form-grid">

              {/* PHONE */}

              <div className="profile-field">

                <label>
                  Phone Number
                </label>

                <input
                  type="tel"
                  value={profile.phone}
                  onChange={(event) => {
                    // Allow digits only
                    const value =
                      event.target.value.replace(
                        /\D/g,
                        ""
                      );

                    // Maximum 10 digits
                    if (value.length <= 10) {
                      handleChange(
                        "phone",
                        value
                      );
                    }
                  }}
                  placeholder="Enter 10-digit phone number"
                  maxLength={10}
                  minLength={10}
                  pattern="[0-9]{10}"
                  inputMode="numeric"
                  required
                />

                <small
                  style={{
                    color:
                      profile.phone.length === 10
                        ? "green"
                        : "#777",
                    marginTop: "5px",
                    display: "block",
                  }}
                >
                  {profile.phone.length}/10 digits
                </small>

              </div>

              {/* LOCATION */}

              <div className="profile-field">

                <label>
                  Location
                </label>

                <input
                  type="text"
                  value={profile.location}
                  onChange={(event) =>
                    handleChange(
                      "location",
                      event.target.value
                    )
                  }
                  placeholder="e.g. Hyderabad"
                  required
                />

              </div>

              {/* EDUCATION */}

              <div className="profile-field">

                <label>
                  Education
                </label>

                <input
                  type="text"
                  value={profile.education}
                  onChange={(event) =>
                    handleChange(
                      "education",
                      event.target.value
                    )
                  }
                  placeholder="e.g. B.Tech CSE"
                  required
                />

              </div>

              {/* EXPERIENCE */}

              <div className="profile-field">

                <label>
                  Experience
                </label>

                <select
                  value={profile.experience_years}
                  onChange={(event) =>
                    handleChange(
                      "experience_years",
                      Number(
                        event.target.value
                      )
                    )
                  }
                >

                  <option value={0}>
                    Fresher / 0 years
                  </option>

                  <option value={1}>
                    1 year
                  </option>

                  <option value={2}>
                    2 years
                  </option>

                  <option value={3}>
                    3 years
                  </option>

                  <option value={4}>
                    4 years
                  </option>

                  <option value={5}>
                    5 years
                  </option>

                  <option value={6}>
                    6 years
                  </option>

                  <option value={7}>
                    7 years
                  </option>

                  <option value={8}>
                    8 years
                  </option>

                  <option value={9}>
                    9 years
                  </option>

                  <option value={10}>
                    10+ years
                  </option>

                </select>

              </div>

              {/* SKILLS */}

              <div className="profile-field full">

                <label>
                  Skills
                </label>

                <input
                  type="text"
                  value={profile.skills}
                  onChange={(event) =>
                    handleChange(
                      "skills",
                      event.target.value
                    )
                  }
                  placeholder="Python, React, SQL, Machine Learning..."
                  required
                />

              </div>

              {/* BIO */}

              <div className="profile-field full">

                <label>
                  About / Bio
                </label>

                <textarea
                  value={profile.bio}
                  onChange={(event) =>
                    handleChange(
                      "bio",
                      event.target.value
                    )
                  }
                  placeholder="Tell recruiters about yourself..."
                  rows="6"
                  required
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
                profile.phone.length !== 10
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

function ProfileInfo({
  label,
  value,
  full = false,
}) {
  return (
    <div
      className={`profile-info ${
        full ? "full" : ""
      }`}
    >

      <span>
        {label}
      </span>

      <strong>
        {value || "Not added yet"}
      </strong>

    </div>
  );
}

export default Profile;