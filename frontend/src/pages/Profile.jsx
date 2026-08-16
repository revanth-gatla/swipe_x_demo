import { useEffect, useState } from "react";
import API from "../services/api";

function Profile() {
  const [profile, setProfile] = useState({
    phone: "",
    location: "",
    education: "",
    experience_years: 0,
    skills: "",
    bio: "",
  });

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [profileExists, setProfileExists] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const response = await API.get("/profile");

      setProfile(response.data);
      setProfileExists(true);
    } catch (error) {
      if (error.response?.status === 404) {
        setProfileExists(false);
      } else {
        setError("Unable to load profile");
      }
    }
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    setProfile({
      ...profile,
      [name]:
        name === "experience_years"
          ? Number(value)
          : value,
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setMessage("");
    setError("");

    try {
      if (profileExists) {
        await API.put("/profile", profile);
        setMessage("Profile updated successfully");
      } else {
        await API.post("/profile", profile);
        setProfileExists(true);
        setMessage("Profile created successfully");
      }
    } catch (error) {
      setError(
        error.response?.data?.detail ||
        "Unable to save profile"
      );
    }
  };

  return (
    <div className="page-container">
      <h1>Candidate Profile</h1>

      <form onSubmit={handleSubmit}>
        <input
          type="text"
          name="phone"
          placeholder="Phone"
          value={profile.phone}
          onChange={handleChange}
          required
        />

        <input
          type="text"
          name="location"
          placeholder="Location"
          value={profile.location}
          onChange={handleChange}
          required
        />

        <input
          type="text"
          name="education"
          placeholder="Education"
          value={profile.education}
          onChange={handleChange}
          required
        />

        <input
          type="number"
          name="experience_years"
          placeholder="Experience in years"
          value={profile.experience_years}
          onChange={handleChange}
          min="0"
          required
        />

        <input
          type="text"
          name="skills"
          placeholder="Skills"
          value={profile.skills}
          onChange={handleChange}
          required
        />

        <textarea
          name="bio"
          placeholder="Bio"
          value={profile.bio}
          onChange={handleChange}
          required
        />

        <button type="submit">
          {profileExists ? "Update Profile" : "Create Profile"}
        </button>
      </form>

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

export default Profile;