// Dynamic ATS Analyzer & Sanitizer Helper
// Ensures job-specific missing keywords and tailored resume suggestions are always shown,
// and rejects any legacy dummy static fallbacks.

const TECH_KEYWORDS = [
  "Python", "JavaScript", "TypeScript", "React", "ReactJS", "Node.js", "C#", ".NET", "ASP.NET",
  "Java", "Spring Boot", "SQL", "PostgreSQL", "Postgres", "MySQL", "MongoDB", "AWS", "Azure", "GCP",
  "Docker", "Kubernetes", "Git", "CI/CD", "REST API", "GraphQL", "Machine Learning", "AI",
  "HTML", "CSS", "Tailwind", "Redux", "Kafka", "Redis", "Linux", "Microservices", "XML", "POS",
  "Database Architecture", "Performance Tuning", "Replication", "High Availability"
];

export function cleanSkillDisplay(skill) {
  if (!skill) return "";
  let s = String(skill).trim();
  s = s.replace(
    /^(?:job\s+requirements?|requirements?|must\s+(?:have|be)|ability\s+to|responsible\s+for|preferred\s+(?:qualifications?|skills?)|and|or|with|to)[:\s\-]+/i,
    ""
  ).trim();

  if (s.length > 35) {
    const parts = s.split(/[.;\n]/);
    const firstClause = parts[0].trim();
    if (firstClause.length <= 32 && firstClause.length > 2) {
      s = firstClause;
    } else {
      s = s.substring(0, 30).trim() + "...";
    }
  }
  return s;
}

export function isLegacyDummyAtsReport(report) {
  if (!report || typeof report !== "object") return true;
  const missing = String(report.missing_skills || "");
  const suggestions = String(report.suggestions || "");
  const matched = String(report.matched_skills || "");

  if (missing.includes("Domain Specific Tools")) return true;
  if (suggestions.includes("Tailor resume keywords to match job description")) return true;
  if (
    matched.includes("Technical Skills") &&
    matched.includes("Problem Solving") &&
    missing.includes("Domain Specific Tools")
  ) {
    return true;
  }
  return false;
}

export function getSanitizedAtsReport(job, rawReport) {
  if (rawReport && !isLegacyDummyAtsReport(rawReport)) {
    return {
      ...rawReport,
      suggestions: rawReport.suggestions || "No specific suggestions provided."
    };
  }

  if (!job) return rawReport || null;

  // 1. Gather all required skills for this specific job
  let requiredList = [];

  if (Array.isArray(job.missing_skills) || Array.isArray(job.matched_skills)) {
    const fromMissing = Array.isArray(job.missing_skills)
      ? job.missing_skills
      : String(job.missing_skills || "").split(",").map((s) => s.trim()).filter(Boolean);
    const fromMatched = Array.isArray(job.matched_skills)
      ? job.matched_skills
      : String(job.matched_skills || "").split(",").map((s) => s.trim()).filter(Boolean);
    requiredList = [...fromMatched, ...fromMissing];
  }

  if (requiredList.length === 0 && job.required_skills) {
    if (Array.isArray(job.required_skills)) {
      requiredList = [...job.required_skills];
    } else {
      requiredList = String(job.required_skills).split(",").map((s) => s.trim()).filter(Boolean);
    }
  }

  // Scan title and description for additional tech keywords
  const haystack = String((job.title || "") + " " + (job.description || "")).toLowerCase();
  for (const tk of TECH_KEYWORDS) {
    const escaped = tk.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp("(^|[^a-zA-Z0-9])" + escaped + "([^a-zA-Z0-9]|$)", "i");
    if (regex.test(haystack)) {
      if (!requiredList.some((r) => r.toLowerCase() === tk.toLowerCase())) {
        requiredList.push(tk);
      }
    }
  }

  if (/postgres/i.test(haystack) && !requiredList.some((r) => /postgres/i.test(r))) {
    requiredList.push("PostgreSQL");
  }

  // 2. Candidate skills
  let candidateSkills = [];
  if (Array.isArray(job.matched_skills)) {
    candidateSkills = [...job.matched_skills];
  } else if (job.matched_skills) {
    candidateSkills = String(job.matched_skills).split(",").map((s) => s.trim()).filter(Boolean);
  }

  try {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      const u = JSON.parse(storedUser);
      if (u.skills) {
        const uSkills = Array.isArray(u.skills) ? u.skills : String(u.skills).split(",");
        uSkills.forEach((s) => {
          const trimmed = String(s).trim();
          if (trimmed && !candidateSkills.includes(trimmed)) candidateSkills.push(trimmed);
        });
      }
    }
  } catch (e) {
    // Ignore storage parse errors
  }

  // 3. Compute Matched and Missing
  const matched = [];
  const missing = [];

  for (const req of requiredList) {
    const clean = cleanSkillDisplay(req);
    if (!clean || clean.length < 2) continue;
    const reqLower = clean.toLowerCase();

    const isMatch = candidateSkills.some((cs) => {
      const csLower = cs.toLowerCase().trim();
      return (
        csLower === reqLower ||
        (csLower.length >= 3 && reqLower.includes(csLower)) ||
        (reqLower.length >= 3 && csLower.includes(reqLower))
      );
    });

    if (isMatch) {
      if (!matched.includes(clean)) matched.push(clean);
    } else {
      if (!missing.includes(clean)) missing.push(clean);
    }
  }

  // If no missing skills found, extract key technical nouns from title
  if (missing.length === 0 && requiredList.length === 0) {
    const titleWords = (job.title || "").split(/[\s,-/()]+/).filter((w) => w.length > 3);
    titleWords.slice(0, 3).forEach((w) => missing.push(w));
  }

  // 4. Dynamic ATS Score
  const total = matched.length + missing.length;
  let atsScore = 60;
  if (total > 0) {
    const ratio = matched.length / total;
    atsScore = Math.round(Math.max(30, Math.min(95, (ratio * 65) + 25)));
  }

  // 5. Tailored, Actionable Suggestions
  const company = job.company && job.company !== "Unknown" ? job.company : "the employer";
  const title = job.title || "this position";

  const topMissing = missing.slice(0, 4).join(", ");
  const topMatched = matched.slice(0, 3).join(", ");

  const suggestions = [
    missing.length > 0
      ? `1. Target Missing Keywords: Explicitly integrate core missing keywords (${topMissing}) into your technical summary and work experience bullets to satisfy ATS scan criteria for ${title}.`
      : `1. Keyword Alignment: Strong core coverage for ${title}. Ensure all acronyms and long-form variations match the job description.`,
    matched.length > 0
      ? `2. Quantify Core Alignment: You demonstrate strong alignment in ${topMatched}. Elevate these competencies by adding quantifiable metrics (e.g., latency, throughput, scale) expected at ${company}.`
      : `2. Bridge Technical Gaps: Emphasize adjacent engineering fundamentals, open-source projects, or specialized certifications related to ${title} to demonstrate fast ramp-up potential.`,
    `3. Resume Structure & Formatting: Calibrate your resume summary statement to reflect the level expected by ${company}, ensuring standard ATS-readable headings without multi-column tables.`
  ].join("\n\n");

  return {
    ats_score: atsScore,
    matched_skills: matched.length > 0 ? matched.join(", ") : "Problem Solving, Engineering Fundamentals",
    missing_skills: missing.length > 0 ? missing.join(", ") : "None — Strong Keyword Coverage",
    suggestions: suggestions,
    cached: false,
    job_title: title,
    job_company: company
  };
}
