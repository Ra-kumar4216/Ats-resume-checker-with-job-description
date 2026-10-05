const MAX_RESUME_CHARS = 80000;
const MAX_JD_CHARS = 40000;
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function cleanJsonText(text) {
  const value = String(text || '').trim();
  if (value.startsWith('```')) return value.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  return value;
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
{
  "optimizedResume": "complete resume text",
  "issues": [{"section":"Experience","type":"Grammar","before":"...","after":"...","reason":"...","severity":"high|medium|low"}],
  "warnings": ["..."],
  "summary": ["..."],
  "suggestedSkills": ["skills to consider only if the user can verify them"]
}

The optimizedResume must be a complete standalone resume, not a diff and not a summary. Use plain text headings and bullets beginning with •. Do not include markdown fences.

JOB DESCRIPTION (may be empty):
---BEGIN JD---
${jd || '(not provided)'}
---END JD---

COMPLETE RESUME:
---BEGIN RESUME---
${resume}
---END RESUME---`;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return json(res, 503, { error: 'AI service is not configured. Local analysis is still available.' });
  const body = req.body || {};
  const resume = typeof body.resumeText === 'string' ? body.resumeText.trim() : '';
  const jd = typeof body.jobDescription === 'string' ? body.jobDescription.trim() : '';
  if (resume.length < 40) return json(res, 400, { error: 'Resume text is too short.' });
  if (resume.length > MAX_RESUME_CHARS || jd.length > MAX_JD_CHARS) return json(res, 413, { error: 'Resume or job description is too large.' });

  try {
    const upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: buildPrompt(resume, jd) }] }],
        generationConfig: { temperature: 0.15, responseMimeType: 'application/json', maxOutputTokens: 16000 },
      }),
    });
    const raw = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      console.error('Gemini upstream status:', upstream.status);
      return json(res, upstream.status === 429 ? 429 : 502, { error: upstream.status === 429 ? 'AI quota is temporarily unavailable. Please try again later.' : 'AI service could not complete this analysis.' });
    }
    const text = raw?.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('') || '';
    const parsed = JSON.parse(cleanJsonText(text));
    const optimizedResume = typeof parsed.optimizedResume === 'string' ? parsed.optimizedResume.trim() : '';
    if (optimizedResume.length < 40) throw new Error('AI returned no complete resume');
    return json(res, 200, {
      optimizedResume,
      issues: Array.isArray(parsed.issues) ? parsed.issues.map(normalizeIssue).filter(Boolean).slice(0, 150) : [],
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings.map(String).slice(0, 30) : [],
      summary: Array.isArray(parsed.summary) ? parsed.summary.map(String).slice(0, 30) : [],
      suggestedSkills: Array.isArray(parsed.suggestedSkills) ? parsed.suggestedSkills.map(String).slice(0, 50) : [],
      model: MODEL,
    });
  } catch (error) {
    console.error('Resume AI analysis failed:', error?.message || error);
    return json(res, 502, { error: 'AI response was invalid or unavailable. Local analysis is still available.' });
  }
};
