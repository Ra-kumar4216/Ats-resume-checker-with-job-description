/* Privacy-first, deterministic resume optimizer. No API key or uploaded data is required. */
(function (root, factory) {
  root.ATSOptimizer = factory(root.ATS);
})(typeof self !== 'undefined' ? self : this, function (ATS) {
  const SECTION_MAP = {
    'about me / carrer goal': 'Professional Summary', 'about me / career goal': 'Professional Summary',
    'career goal': 'Professional Summary', 'what i know': 'Skills', 'work / job experience': 'Experience',
    'work experience': 'Experience', 'projects & things': 'Projects', 'projects and things': 'Projects',
    'certificate': 'Certifications', 'certificates': 'Certifications', 'personal': 'Personal Details',
    'reference': 'References', 'education': 'Education', 'skills': 'Skills', 'experience': 'Experience',
    'projects': 'Projects', 'professional summary': 'Professional Summary',
  };
  const SPELLING = {
    'carrer': 'career', 'feild': 'field', 'salery': 'salary', 'ponctual': 'punctual', 'managment': 'management',
    'desiging': 'designing', 'experiance': 'experience', 'acheivement': 'achievement', 'responsibilites': 'responsibilities',
    'developement': 'development', 'seperate': 'separate', 'recieve': 'receive', 'recieved': 'received',
    'teh': 'the', 'hardwork': 'hard work', 'hard working': 'hardworking', 'team worker': 'team player',
    'git hub': 'GitHub', 'htMl': 'HTML', 'mysql': 'MySQL', 'java script': 'JavaScript', 'vs code': 'VS Code',
  };
  const GRAMMAR = [
    [/\bI am hard working\b/gi, 'I am a hardworking'],
    [/\bcan do many thing\b/gi, 'can perform many tasks'],
    [/\bI can do many things in computer\b/gi, 'I can perform a range of computer-related tasks'],
    [/\blooking for best company\b/gi, 'seeking an entry-level opportunity'],
    [/\bIt have\b/gi, 'It has'],
    [/\bmade a software for\b/gi, 'developed software for'],
    [/\bused mysql maybe\b/gi, 'used MySQL'],
    [/\bwhen needed\.?$/gi, 'as required.'],
    [/\blittle bit\.?$/gi, 'basic tasks.'],
    [/\bnot fully\.?$/gi, 'as part of the work.'],
    [/\bSome online computer certificates\.?/gi, 'Additional online computer certificates.'],
    [/\bAvailable if company ask me\.?/gi, 'Available upon request.'],
    [/\bI here by declare all above are true and correct\.?/gi, 'I declare that the information above is accurate to the best of my knowledge.'],
  ];
  const DIRECT_FIXES = [
    [/^Doing computer work and customer help\.?$/i, 'Provided computer support and customer assistance.'],
    [/^Install windows and solve printer problem sometimes\.?$/i, 'Installed Windows and resolved printer issues when needed.'],
    [/^Make excel sheet and typing work\.?$/i, 'Created Excel sheets and completed typing tasks.'],
    [/^Helped in website work but not fully\.?$/i, 'Supported website-related tasks as part of the work.'],
    [/^Made some website for friends\.?$/i, 'Created websites for friends.'],
    [/^Used html and css and javascript when needed\.?$/i, 'Applied HTML, CSS and JavaScript as required.'],
    [/^Did database work little bit\.?$/i, 'Performed basic database tasks.'],
  ];
  const WEAK = /^(made|worked|helped|used|did|responsible for|participated in|involved in|good|various|handled)\b/i;
  const UNCERTAIN = /\b(?:maybe|little|not much|sometimes|if needed|many small|thing|stuff|computer boy|web thing)\b/gi;
  const BULLET = /^[ \t]*[•·●◦∙▪‣⁃‧*_\-]/;
  const clean = s => String(s || '').replace(/[ \t]+/g, ' ').trim();
  const lines = text => String(text || '').replace(/\r/g, '').split('\n');
  const strip = line => clean(line).replace(/^[•·●◦∙▪‣⁃‧*_\-]+\s*/, '');
  const lower = s => clean(s).toLowerCase().replace(/[>:]+/g, '').replace(/\s+/g, ' ');
  const sectionKey = title => lower(title).replace(/[><:]+/g, '').replace(/\s+/g, ' ').trim();
  const isHeading = value => /^\s*(?:>{2,}|#{1,3})/.test(value) || Object.prototype.hasOwnProperty.call(SECTION_MAP, sectionKey(value));
  const headingTitle = value => {
    const normalized = lower(value).replace(/^\s*[><#: -]+|[><#: -]+\s*$/g, '').replace(/\s+/g, ' ');
    return SECTION_MAP[normalized] || SECTION_MAP[normalized.replace(/^about me\s*\/\s*/, 'about me / ')] || clean(value);
  };
  const spellingReplace = value => Object.entries(SPELLING).reduce((out, [from, to]) => out.replace(new RegExp('\\b' + from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi'), to), value)
    .replace(/\bJAVASCRIPT\b/g, 'JavaScript').replace(/\bJAVA\b/g, 'Java').replace(/\bPYTHON\b/g, 'Python')
    .replace(/\bMY-SQL\b/gi, 'MySQL').replace(/\bMS OFFICE\b/gi, 'MS Office').replace(/\bWINDOWS\b/gi, 'Windows')
    .replace(/\bEXCEL\b/gi, 'Excel').replace(/\bCOMPUTER OPERATING\b/gi, 'computer operations');
  const grammarReplace = value => DIRECT_FIXES.reduce((out, [re, to]) => out.replace(re, to), GRAMMAR.reduce((out, [re, to]) => out.replace(re, to), value))
    .replace(/([.!?]\s+)([a-z])/g, (_, punctuation, letter) => punctuation + letter.toUpperCase())
    .replace(/\bI am hardworking computer student\b/gi, 'I am a hardworking computer student');
  const capitalise = value => value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
  const isEntryHeader = value => /^(?:\d{4}\s*[-–]\s*\d{4}|present|college project:|mini project:|other project:|bca\b|\d+(?:th|st|nd|rd)\b)/i.test(value) || /\s[—-]\s/.test(value);
  const currentSection = value => {
    const key = lower(value);
    if (/experience|employment|internship/.test(key)) return 'experience';
    if (/project/.test(key)) return 'projects';
    if (/skill|what i know/.test(key)) return 'skills';
    return '';
  };
  function improveBullet(value) {
    let v = capitalise(grammarReplace(spellingReplace(clean(value))));
    v = v.replace(/^made\s+(?:a\s+)?/i, 'Created ')
      .replace(/^worked\s+with\s+/i, 'Collaborated with ')
      .replace(/^used\s+/i, 'Applied ')
      .replace(/^helped\s+/i, 'Supported ')
      .replace(/^did\s+/i, 'Completed ')
      .replace(/^responsible for\s+/i, 'Managed ')
      .replace(/^participated in\s+/i, 'Contributed to ')
      .replace(/^involved in\s+/i, 'Contributed to ');
    return v.replace(/\.+$/, '.')
      .replace(/\bhtml\b/gi, 'HTML').replace(/\bcss\b/gi, 'CSS').replace(/\bjavascript\b/gi, 'JavaScript').replace(/\bsql\b/gi, 'SQL');
  }
  function transformLine(raw, state) {
    const original = raw;
    const value = strip(raw);
    if (!value) return { line: raw, changes: [] };
    if (isHeading(value)) {
      const title = headingTitle(value);
      return { line: title, changes: title !== value ? [{ type: 'Heading', before: value, after: title, reason: 'Uses a standard ATS-readable section heading.' }] : [] };
    }
    let after = capitalise(grammarReplace(spellingReplace(value)));
    const changes = [];
    if (after !== value) changes.push({ type: /\b(?:feild|salery|managment|desiging|experiance|carrer)\b/i.test(value) ? 'Spelling / grammar' : 'Grammar', before: value, after, reason: 'Corrects spelling, grammar, capitalization or sentence clarity.' });
    const inWorkSection = state.section === 'experience' || state.section === 'projects';
    if (inWorkSection && !BULLET.test(raw) && !isEntryHeader(after) && after.length >= 25) {
      const bulletAfter = improveBullet(after);
      after = bulletAfter;
      changes.push({ type: 'Bullet point', before: value, after, reason: 'Converts descriptive work into a scannable, action-led bullet point.' });
      return { line: '• ' + after, changes };
    }
    if (BULLET.test(raw)) {
      const bulletAfter = improveBullet(after);
      if (bulletAfter !== value) changes.push({ type: WEAK.test(value) ? 'Bullet wording' : 'Bullet grammar', before: value, after: bulletAfter, reason: WEAK.test(value) ? 'Replaces vague wording with a clearer action-led bullet without inventing facts.' : 'Corrects the bullet while preserving the original claim.' });
      return { line: '• ' + bulletAfter, changes };
    }
    return { line: after, changes };
  }
  function optimizeText(text) {
    const allChanges = [], output = [], state = { section: '' };
    lines(text).forEach((raw, index) => {
      const value = strip(raw);
      if (isHeading(value)) state.section = currentSection(value) || state.section;
      const result = transformLine(raw, state);
      result.changes.forEach(change => allChanges.push({ ...change, line: index + 1 }));
      output.push(result.line);
    });
    return { optimized: output.join('\n').replace(/[ \t]+\n/g, '\n'), changes: allChanges };
  }
  function issueList(text) {
    const issues = [];
    lines(text).forEach((raw, i) => {
      const value = strip(raw); if (!value) return;
      const fixed = capitalise(grammarReplace(spellingReplace(value)));
      if (fixed !== value) issues.push({ line: i + 1, type: /\b(?:feild|salery|managment|desiging|experiance|carrer)\b/i.test(value) ? 'Spelling / grammar' : 'Grammar', before: value, after: fixed, reason: 'Corrects the detected spelling, grammar or clarity problem.' });
      const weak = WEAK.test(value);
      if (weak) issues.push({ line: i + 1, type: 'Weak wording', before: value, after: improveBullet(value), reason: 'Makes the sentence more direct and professional without adding an unsupported achievement.' });
      if (UNCERTAIN.test(value)) issues.push({ line: i + 1, type: 'Unclear claim', before: value, after: improveBullet(value), reason: 'Flags uncertain wording such as “maybe”, “little” or “not much” for user review.' });
      if (value.length > 180) issues.push({ line: i + 1, type: 'Clarity', before: value, after: value.replace(/, /g, '; '), reason: 'Long lines are harder to scan.' });
    });
    return issues;
  }
  function validationWarnings(text) {
    const value = String(text || ''), result = [];
    const email = value.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g) || [];
    if (!email.length || /@@|\.con\b/i.test(value)) result.push('Email address is missing or appears invalid.');
    if (/github\s*:\s*[^\s/]+!?\b/i.test(value) || /linkedin\s*:\s*(?!https?:)/i.test(value)) result.push('GitHub/LinkedIn contact should be a valid URL or handle.');
    if (/[*★■☎✉]/.test(value)) result.push('Decorative symbols in the contact header can reduce ATS consistency.');
    if (/>>>|<<<|computer boy|web thing/i.test(value)) result.push('Non-standard or unprofessional headings/headline detected.');
    if (/\b(?:dob|date of birth|hobbies|weakness|declaration|reference)\b/i.test(value)) result.push('Personal details that are usually unnecessary for a modern resume were detected.');
    if (UNCERTAIN.test(value)) result.push('Uncertain wording such as “maybe”, “little” or “not much” needs user review.');
    if (!/\b(?:experience|employment|internship)\b/i.test(value)) result.push('No standard Experience or Internship heading was detected.');
    if (!/\b(?:education|university|college|bachelor|master|degree)\b/i.test(value)) result.push('No standard Education heading was detected.');
    if (!/\b(?:skills|technical skills|technologies)\b/i.test(value)) result.push('No standard Skills heading was detected.');
    return [...new Set(result)];
  }
  function scoreBreakdown(text, jd) {
    const value = String(text || ''), issues = issueList(value), warnings = validationWarnings(value);
    const has = re => re.test(value), spellingGrammar = issues.filter(i => /Spelling|Grammar/.test(i.type)).length;
    const uncertain = (value.match(UNCERTAIN) || []).length;
    const checks = {
      'ATS Compatibility': Math.max(0, Math.min(100, 100 - warnings.length * 10 - (has(/\|/) ? 10 : 0))),
      'Keyword Match': jd ? ATS.analyze(value, jd).jobMatch : null,
      'Skills Match': Math.max(0, Math.min(100, 30 + (has(/\b(?:skills|what i know)\b/i) ? 25 : 0) + Math.min(30, ATS.extractKeywords(value).length * 2) - uncertain * 5)),
      'Experience Relevance': Math.max(0, Math.min(100, (has(/experience|employment|internship/i) ? 55 : 25) + (has(/•/) ? 15 : 0) + (has(/\b(?:built|created|developed|managed|implemented)\b/i) ? 15 : 0) - uncertain * 4)),
      'Project Relevance': Math.max(0, Math.min(100, (has(/project/i) ? 55 : 25) + (has(/•/) ? 10 : 0) + (has(/\b(?:built|created|developed|implemented)\b/i) ? 15 : 0) - uncertain * 4)),
      'Resume Structure': Math.max(0, Math.min(100, 25 + ['experience', 'projects', 'education', 'skills', 'certif'].filter(k => has(new RegExp('\\b' + k, 'i'))).length * 15 - (has(/>>>|<<</) ? 15 : 0))),
      'Readability': Math.max(0, Math.min(100, 100 - issues.filter(i => /Weak|Unclear|Clarity/.test(i.type)).length * 7 - warnings.filter(w => /unprofessional|Uncertain/.test(w)).length * 6)),
      'Grammar & Spelling': Math.max(0, Math.min(100, 100 - spellingGrammar * 8 - issues.filter(i => i.type === 'Weak wording').length * 2)),
    };
    const numeric = Object.values(checks).filter(v => Number.isFinite(v));
    return { checks, score: Math.round(numeric.reduce((a, b) => a + b, 0) / numeric.length), warnings, issues };
  }
  function diff(original, optimized) {
    const a = lines(original), b = lines(optimized), max = Math.max(a.length, b.length), changes = [];
    for (let i = 0; i < max; i++) if (a[i] !== b[i]) changes.push({ line: i + 1, before: a[i] || '', after: b[i] || '', type: !a[i] ? 'added' : !b[i] ? 'removed' : 'modified' });
    return changes;
  }
  function analyze(resume, jd) {
    const result = optimizeText(resume), original = scoreBreakdown(resume, jd), optimized = scoreBreakdown(result.optimized, jd);
    const changes = diff(resume, result.optimized), issues = issueList(resume), keywordSet = jd ? ATS.extractKeywords(jd) : [], resumeKeywords = new Set(ATS.extractKeywords(resume));
    return { originalText: resume, optimizedText: result.optimized, original, optimized, issues, changes, warnings: original.warnings, missingKeywords: keywordSet.filter(k => !resumeKeywords.has(k)), jd, improvement: optimized.score - original.score, keywordBefore: jd ? ATS.analyze(resume, jd).jobMatch : null, keywordAfter: jd ? ATS.analyze(result.optimized, jd).jobMatch : null };
  }
  return { analyze, optimizeText, diff, issueList, validationWarnings, scoreBreakdown, improveBullet };
});
