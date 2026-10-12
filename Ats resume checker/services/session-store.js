/** Best-effort local session persistence. Storage failures never block analysis. */
(function (root) {
  const config = root.ATSConfig || {};
  const key = config.sessionKey || 'ats-tracker-session-v1';
  const ttlMs = config.sessionTtlMs || 7 * 24 * 60 * 60 * 1000;

  function read() {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const state = JSON.parse(raw);
      if (!state || Date.now() - Number(state.timestamp) > ttlMs) { localStorage.removeItem(key); return null; }
      return state;
    } catch (_) { return null; }
  }

  function write(state) {
    try { localStorage.setItem(key, JSON.stringify({ ...state, timestamp: Date.now() })); } catch (_) { /* private mode/quota */ }
  }

  root.ATSSessionStore = Object.freeze({ read, write });
})(typeof self !== 'undefined' ? self : window);
