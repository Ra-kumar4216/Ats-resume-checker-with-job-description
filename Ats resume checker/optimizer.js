/* Privacy-first resume optimizer. No API key or uploaded data is required. */
(function (root, factory) {
  root.ATSOptimizer = factory(root.ATS);
})(typeof self !== 'undefined' ? self : this, function (ATS) {
  const ACTIONS = new Set('built created designed developed delivered deployed implemented improved integrated launched led managed migrated optimized automated analyzed configured tested refactored resolved reduced increased'.split(' '));
  const WEAK = /^(made|worked|helped|used|did|responsible for|participated in|involved in|good|various|handled)\b/i;
  const SECTION_NAMES = /^(summary|objective|profile|experience|work experience|employment|internship|internships|projects?|education|skills?|technical skills|certifications?|achievements?|awards?|publications?|languages?|contact)$/i;
  const clean = s => String(s || '').replace(/[ \t]+/g, ' ').trim();
  const lines = text => String(text || '').replace(/\r/g, '').split('\n');
  const isBullet = line => /^[ \t]*[•·●◦∙▪‣⁃‧*_\-]/.test(line);
  const strip = line => clean(line).replace(/^[•·●◦∙▪‣⁃‧*_\-]+\s*/, '');
  const sentenceCase = s => clean(s).replace(/\s+/g, ' ');
  const count = (text, re) => (String(text || '').match(re) || []).length;

  function sentenceIssue(text) {
    const issues = [];
    lines(text).forEach((raw, i) => {
      const value = strip(raw);
      if (!value || SECTION_NAMES.test(value) || value.length < 12) return;
      if (/\b(teh|recieve|recieved|managment|developement|seperate|responsibilites|acheivement|experiance)\b/i.test(value)) {
        issues.push({ type: 'Spelling', line: i + 1, before: value, after: value.replace(/teh/gi, 'the').replace(/recieve/gi, 'receive').replace(/recieved/gi, 'received').replace(/managment/gi, 'management').replace(/developement/gi, 'development').replace(/seperate/gi, 'separate').replace(/responsibilites/gi, 'responsibilities').replace(/acheivement/gi, 'achievement').replace(/experiance/gi, 'experience'), reason: 'Corrects a common spelling error so the resume reads professionally.' });
      }
      if (WEAK.test(value)) {
        issues.push({ type: 'Weak wording', line: i + 1, before: value, after: improveBullet(value), reason: 'Replaces passive or vague wording with a clearer action-led sentence without inventing facts.' });
      }
      if (value.length > 180) {
        issues.push({ type: 'Clarity', line: i + 1, before: value, after: value.replace(/, /g, '; '), reason: 'Long bullets are harder to scan; this flags the line for review.' });
      }
    });
    const lower = lines(text).map(strip).filter(Boolean).map(v => v.toLowerCase());
    const repeated = lower.filter((v, i) => lower.indexOf(v) !== i && v.length > 20);
    repeated.slice(0, 5).forEach(v => issues.push({ type: 'Repeated content', before: v, after: '', reason: 'Repeated lines reduce clarity and waste limited resume space.' }));
    return issues;
  }

  function improveBullet(value) {
    let v = sentenceCase(value);
    v = v.replace(/^made\s+(?:a\s+)?/i, 'Created ')
      .replace(/^worked\s+with\s+/i, 'Collaborated with ')
      .replace(/^used\s+/i, 'Applied ')
      .replace(/^helped\s+/i, 'Supported ')
      .replace(/^did\s+/i, 'Executed ')
      .replace(/^responsible for\s+/i, 'Managed ')
      .replace(/^participated in\s+/i, 'Contributed to ')
      .replace(/^involved in\s+/i, 'Contributed to ');
    return v.charAt(0).toUpperCase() + v.slice(1);
  }

  function spellingFix(text) {
    return String(text || '').replace(/\bteh\b/gi, 'the').replace(/\brecieve\b/gi, 'receive').replace(/\brecieved\b/gi, 'received').replace(/\bmanagment\b/gi, 'management').replace(/\bdevelopement\b/gi, 'development').replace(/\bseperate\b/gi, 'separate').replace(/\bresponsibilites\b/gi, 'responsibilities').replace(/\bacheivement\b/gi, 'achievement').replace(/\bexperiance\b/gi, 'experience');
  }

  function optimizeText(text) {
    const issues = sentenceIssue(text);
    const optimized = lines(spellingFix(text)).map(raw => {
      if (!isBullet(raw)) return raw;
      const prefix = raw.match(/^[ \t]*[•·●◦∙▪‣⁃‧*_\-]+\s*/)?.[0] || '• ';
      const value = strip(raw);
      return prefix + (WEAK.test(value) ? improveBullet(value) : sentenceCase(value));
    }).join('\n').replace(/[ \t]+\n/g, '\n');
    return { optimized, issues };
  }

  function atsWarnings(text) {
    const result = [];
    if (/[\u{1F300}-\u{1FAFF}]/u.test(text)) result.push('Emoji/icon characters may be misread by some ATS parsers.');
    if (/\|/.test(text)) result.push('Pipe-separated lines can be less reliable in strict ATS parsers; verify the contact header.');
    if (!/\b(?:experience|employment|internship)\b/i.test(text)) result.push('No Experience or Internship heading was detected.');
    if (!/\b(?:education|university|college|bachelor|master|degree)\b/i.test(text)) result.push('No Education heading or education keywords were detected.');
    if (!/\b(?:skills|technical skills|technologies)\b/i.test(text)) result.push('No Skills heading was detected.');
    if (/<table|\btable\b/i.test(text)) result.push('Tables may not parse correctly in some ATS systems.');
    return result;
  }

  function scoreBreakdown(text, jd) {
    const value = String(text || '');
    const checks = {
      'ATS Compatibility': Math.min(100, 55 + (/@/.test(value) ? 10 : 0) + (/[+\d][\d ()-]{7,}/.test(value) ? 10 : 0) + (atsWarnings(value).length ? 0 : 25)),
      'Keyword Match': jd ? ATS.analyze(value, jd).jobMatch : Math.min(100, 45 + Math.min(40, ATS.extractKeywords(value).length * 4)),
      'Skills Match': Math.min(100, 35 + Math.min(65, (ATS.extractKeywords(value).length || 0) * 5)),
      'Experience Relevance': /\b(?:experience|internship)\b/i.test(value) ? 80 : 35,
      'Project Relevance': /\bprojects?\b/i.test(value) ? 80 : 35,
      'Resume Structure': Math.min(100, 40 + ['experience', 'projects', 'education', 'skills'].filter(k => new RegExp('\\b' + k + '\\b', 'i').test(value)).length * 15),
      'Readability': Math.max(35, 100 - Math.min(55, count(value, /\b(?:very|really|good|various|responsible)\b/gi) * 8)),
      'Grammar & Spelling': Math.max(35, 100 - Math.min(55, sentenceIssue(value).filter(i => i.type === 'Spelling').length * 12)),
    };
    const values = Object.values(checks);
    return { checks, score: Math.round(values.reduce((a, b) => a + b, 0) / values.length) };
  }

  function diff(original, optimized) {
    const a = lines(original), b = lines(optimized), max = Math.max(a.length, b.length), changes = [];
    for (let i = 0; i < max; i++) {
      if (a[i] !== b[i]) changes.push({ line: i + 1, before: a[i] || '', after: b[i] || '', type: !a[i] ? 'added' : !b[i] ? 'removed' : 'modified' });
    }
    return changes;
  }

  function analyze(resume, jd) {
    const original = scoreBreakdown(resume, jd);
    const result = optimizeText(resume);
    const optimized = scoreBreakdown(result.optimized, jd);
    const changes = diff(resume, result.optimized);
    const keywordSet = jd ? ATS.extractKeywords(jd) : [];
    const resumeKeywords = new Set(ATS.extractKeywords(resume));
    const missing = keywordSet.filter(k => !resumeKeywords.has(k));
    return {
      originalText: resume,
      optimizedText: result.optimized,
      original, optimized, issues: result.issues, changes, warnings: atsWarnings(resume),
      missingKeywords: missing, jd, improvement: optimized.score - original.score,
      keywordBefore: jd ? ATS.analyze(resume, jd).jobMatch : null,
      keywordAfter: jd ? ATS.analyze(result.optimized, jd).jobMatch : null,
    };
  }
  return { analyze, optimizeText, diff, atsWarnings, scoreBreakdown, improveBullet };
});
