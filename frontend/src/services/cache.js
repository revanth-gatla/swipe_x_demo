// Client-side cache for Recommended Jobs to prevent re-computation on tab switching
// Scoped per user account to prevent cross-account cache bleed.
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

const getActiveUserKey = () => {
  const user = (
    localStorage.getItem("username") ||
    localStorage.getItem("name") ||
    ""
  ).toLowerCase().trim();
  return user || "anonymous";
};

const getCacheKey = () => {
  const user = getActiveUserKey();
  return `swipe_x_recommendations_${user}`;
};

// In-memory reference for instant access
let memoryCache = {
  user: null,
  jobs: [],
  currentIndex: 0,
  timestamp: 0,
};

export const getCachedRecommendations = () => {
  const currentUser = getActiveUserKey();
  if (currentUser === "anonymous") return null;

  const now = Date.now();

  // Check memory cache first (must match active user)
  if (
    memoryCache.user === currentUser &&
    memoryCache.jobs &&
    memoryCache.jobs.length > 0 &&
    now - memoryCache.timestamp < CACHE_TTL_MS
  ) {
    return {
      jobs: memoryCache.jobs,
      currentIndex: memoryCache.currentIndex || 0,
    };
  }

  // Fallback to sessionStorage for this specific user
  try {
    const cacheKey = getCacheKey();
    const raw = sessionStorage.getItem(cacheKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        parsed.user === currentUser &&
        parsed.jobs?.length > 0 &&
        now - parsed.timestamp < CACHE_TTL_MS
      ) {
        memoryCache = parsed;
        return {
          jobs: parsed.jobs,
          currentIndex: parsed.currentIndex || 0,
        };
      }
    }
  } catch {
    // Ignore storage parse errors
  }

  return null;
};

export const setCachedRecommendations = (jobs, currentIndex = 0) => {
  const currentUser = getActiveUserKey();
  if (currentUser === "anonymous" || !jobs || jobs.length === 0) return;

  const entry = {
    user: currentUser,
    jobs,
    currentIndex,
    timestamp: Date.now(),
  };
  memoryCache = entry;

  try {
    const cacheKey = getCacheKey();
    sessionStorage.setItem(cacheKey, JSON.stringify(entry));
  } catch {
    // Storage quota or disabled, memoryCache still holds it
  }
};

export const updateCachedCurrentIndex = (newIndex) => {
  memoryCache.currentIndex = newIndex;
  try {
    const cacheKey = getCacheKey();
    const raw = sessionStorage.getItem(cacheKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      parsed.currentIndex = newIndex;
      sessionStorage.setItem(cacheKey, JSON.stringify(parsed));
    }
  } catch {
    // Ignore storage errors
  }
};

export const removeJobFromRecommendationCache = (jobId) => {
  if (memoryCache.jobs) {
    memoryCache.jobs = memoryCache.jobs.filter((j) => j.job_id !== jobId);
  }
  try {
    const cacheKey = getCacheKey();
    const raw = sessionStorage.getItem(cacheKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      parsed.jobs = (parsed.jobs || []).filter((j) => j.job_id !== jobId);
      sessionStorage.setItem(cacheKey, JSON.stringify(parsed));
    }
  } catch {
    // Ignore
  }
};

export const clearRecommendationsCache = () => {
  memoryCache = {
    user: null,
    jobs: [],
    currentIndex: 0,
    timestamp: 0,
  };

  try {
    // Remove legacy unscoped key
    sessionStorage.removeItem("swipe_x_recommendations");

    // Remove all scoped user keys
    const keysToRemove = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith("swipe_x_recommendations")) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => sessionStorage.removeItem(k));
  } catch {
    // Ignore storage errors
  }
};
