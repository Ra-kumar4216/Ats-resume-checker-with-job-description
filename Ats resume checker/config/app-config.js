/**
 * Runtime configuration shared by the browser application.
 * Secrets never belong here; server-only values live in environment variables.
 */
const APP_CONFIG = Object.freeze({
  maxFileBytes: 5 * 1024 * 1024,
  maxPdfPages: 15,
  maxExtractedChars: 120000,
  minResumeWords: 10,
  minJobDescriptionWords: 8,
  sessionKey: 'ats-tracker-session-v1',
  sessionTtlMs: 7 * 24 * 60 * 60 * 1000,
  api: Object.freeze({
    analyzeResume: '/api/analyze-resume',
  }),
});

if (typeof window !== 'undefined') window.ATSConfig = APP_CONFIG;
if (typeof module !== 'undefined') module.exports = APP_CONFIG;
