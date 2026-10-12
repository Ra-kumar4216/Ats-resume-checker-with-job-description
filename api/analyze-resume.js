const { sendJson, methodNotAllowed } = require('./lib/http');
const config = require('./config');

function cleanJsonText(text) {
  const value = String(text || '').trim();
  return value.startsWith('```') ? value.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim() : value;
}

function normalizeIssue(issue) {
  if (!issue || typeof issue !== 'object') return null;
  return {
    section: String(issue.section || 'General').slice(0, 100),
    type: String(issue.type || 'Review').slice(0, 80),
    before: String(issue.before || '').slice(0, 1000),
    after: String(issue.after || '').slice(0, 1000),
    reason: String(issue.reason || 'Improves clarity, correctness or ATS readability.').slice(0, 500),
    severity: ['high', 'medium', 'low'].includes(issue.severity) ? issue.severity : 'medium',
  };
}

function buildPrompt(resume, jd) {
  return `You are a meticulous professional resume editor and ATS specialist. Read the COMPLETE resume below, not just selected bullets. Analyze every section and every sentence in context, then produce a complete improved resume.

NON-NEGOTIABLE FACT RULES:
- Never invent or assume jobs, employers, dates, education, skills, tools, certifications, awards, metrics or achievements.
- Preserve all true facts from the source. You may reorganize, correct, shorten and professionally rephrase them.
- If a detail is unclear, keep it cautious and put it in warnings; do not guess.
- Do not silently fix a person's name, email, phone or social handle when the intended value is uncertain. Flag it for review.
- Do not add a keyword merely because it appears in the job description unless the resume provides evidence.
- Use standard ATS section headings and clean bullet points where appropriate.
- Correct grammar, spelling, capitalization, punctuation, tense, repetition, vague wording and sentence clarity across the whole document.
- Preserve the meaning and scope of every work and project claim.

Return ONLY valid JSON with this exact shape:
{"optimizedResume":"complete resume text","issues":[{"section":"Experience","type":"Grammar","before":"...","after":"...","reason":"...","severity":"high|medium|low"}],"warnings":["..."],"summary":["..."],"suggestedSkills":["skills to consider only if the user can verify them"]}

The optimizedResume must be a complete standalone resume, not a diff and not a summary. Use plain text headings and bullets beginning with •. Do not include markdown fences.

JOB DESCRIPTION (may be empty):\n---BEGIN JD---\n${jd || '(not provided)'}\n---END JD---\n\nCOMPLETE RESUME:\n---BEGIN RESUME---\n${resume}\n---END RESUME---`;
}

function readInput(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch (_) { return {}; }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res);
  const key = process.env.GEMINI_API_KEY;
  if (!key) return sendJson(res, 503, { error: 'AI service is not configured. Local analysis is still available.' });
  const body = readInput(req);
  const resume = typeof body.resumeText === 'string' ? body.resumeText.trim() : '';
  const jd = typeof body.jobDescription === 'string' ? body.jobDescription.trim() : '';
  if (resume.length < 40) return sendJson(res, 400, { error: 'Resume text is too short.' });
  if (resume.length > config.maxResumeChars || jd.length > config.maxJobDescriptionChars) return sendJson(res, 413, { error: 'Resume or job description is too large.' });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.upstreamTimeoutMs);
  try {
    const upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:generateContent?key=${encodeURIComponent(key)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: buildPrompt(resume, jd) }] }], generationConfig: { temperature: 0.15, responseMimeType: 'application/json', maxOutputTokens: 16000 } }),
    });
    const raw = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      console.error('Gemini upstream status:', upstream.status);
      return sendJson(res, upstream.status === 429 ? 429 : 502, { error: upstream.status === 429 ? 'AI quota is temporarily unavailable. Please try again later.' : 'AI service could not complete this analysis.' });
    }
    const text = raw?.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('') || '';
    const parsed = JSON.parse(cleanJsonText(text));
    const optimizedResume = typeof parsed.optimizedResume === 'string' ? parsed.optimizedResume.trim() : '';
    if (optimizedResume.length < 40) throw new Error('AI returned no complete resume');
    return sendJson(res, 200, { optimizedResume, issues: Array.isArray(parsed.issues) ? parsed.issues.map(normalizeIssue).filter(Boolean).slice(0, 150) : [], warnings: Array.isArray(parsed.warnings) ? parsed.warnings.map(String).slice(0, 30) : [], summary: Array.isArray(parsed.summary) ? parsed.summary.map(String).slice(0, 30) : [], suggestedSkills: Array.isArray(parsed.suggestedSkills) ? parsed.suggestedSkills.map(String).slice(0, 50) : [], model: config.model });
  } catch (error) {
    console.error('Resume AI analysis failed:', error?.name === 'AbortError' ? 'timeout' : error?.message || error);
    return sendJson(res, 502, { error: 'AI response was invalid or unavailable. Local analysis is still available.' });
  } finally { clearTimeout(timeout); }
};
