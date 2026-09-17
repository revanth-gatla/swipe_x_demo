import axios from "axios";

let rawUrl = import.meta.env.VITE_API_URL;
if (!rawUrl || rawUrl === "http://localhost:8000") {
  if (
    typeof window !== "undefined" &&
    window.location.hostname &&
    !window.location.hostname.includes("localhost") &&
    !window.location.hostname.includes("127.0.0.1")
  ) {
    rawUrl = "https://swipe-x-backend-pcb8.onrender.com";
  } else {
    rawUrl = "http://localhost:8000";
  }
}
if (rawUrl && !rawUrl.startsWith("http://") && !rawUrl.startsWith("https://")) {
  rawUrl = `https://${rawUrl}`;
}
export const API_URL = rawUrl.replace(/\/+$/, "");

const API = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

API.interceptors.request.use(
  (config) => {
    const token =
      localStorage.getItem("access_token") ||
      localStorage.getItem("token");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

export default API;