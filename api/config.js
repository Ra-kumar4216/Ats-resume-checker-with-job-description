const API_CONFIG = Object.freeze({
  maxResumeChars: Number(process.env.MAX_RESUME_CHARS || 80000),
  maxJobDescriptionChars: Number(process.env.MAX_JD_CHARS || 40000),
  model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  upstreamTimeoutMs: Number(process.env.GEMINI_TIMEOUT_MS || 30000),
});

module.exports = API_CONFIG;
