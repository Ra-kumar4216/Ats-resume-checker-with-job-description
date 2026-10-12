/** Typed boundary for server APIs. UI code should not construct fetch requests directly. */
(function (root) {
  async function parseResponse(response) {
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
    return payload;
  }

  async function analyzeResume(resumeText, jobDescription) {
    const endpoint = root.ATSConfig?.api?.analyzeResume || '/api/analyze-resume';
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ resumeText, jobDescription }),
    });
    return parseResponse(response);
  }

  root.ATSApi = Object.freeze({ analyzeResume });
})(typeof self !== 'undefined' ? self : window);
