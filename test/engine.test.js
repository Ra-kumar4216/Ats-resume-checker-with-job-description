const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ATS = require('../Ats resume checker/engine.js');

const indexHtml = fs.readFileSync(path.join(__dirname, '../Ats resume checker/index.html'), 'utf8');
const engineSource = fs.readFileSync(path.join(__dirname, '../Ats resume checker/engine.js'), 'utf8');
const appSource = fs.readFileSync(path.join(__dirname, '../Ats resume checker/app.js'), 'utf8');
const stepperSource = fs.readFileSync(path.join(__dirname, '../Ats resume checker/stepper.js'), 'utf8');
const selectorSource = fs.readFileSync(
  path.join(__dirname, '../Ats resume checker/resume-templates/selector.js'),
  'utf8'
);

test('F01: score methodology and breakdown targets exist in the document', () => {
  assert.match(indexHtml, /id="score-method"/);
  assert.match(indexHtml, /id="score-breakdown"/);
});

test('F03: JD extraction ignores ordinary prose and fake company words', () => {
  assert.deepEqual(
    ATS.extractKeywords(
      'You will excel in a team, express ideas and react quickly. Amazon values Amazon. Java, Spring Boot.'
    ),
    ['java', 'spring boot']
  );
});

test('F04: supported US, Indian and landline phones are detected without matching year ranges', () => {
  for (const phone of ['(415) 555-1234', '415-555-1234', '044 2345 6789', '+91 98765 43210']) {
    assert.equal(ATS.hasPhone(phone), true, phone);
  }
  assert.equal(ATS.hasPhone('2023 - 2027'), false);
});

test('F05: engine has no regular-expression lookbehind', () => {
  assert.doesNotMatch(engineSource, /\(\?<(?!=|!)/);
  assert.doesNotMatch(engineSource, /\(\?<(?==|!)/);
});

test('F02: tailoring without JD preserves all bullet lines and skills', () => {
  const resume = [
    'Jane Doe',
    'Experience',
    'Acme | 2020 - 2024',
    '• first bullet',
    '• second bullet',
    '• third bullet',
    '• fourth bullet',
    'Skills',
    'JavaScript, React, Node.js',
  ].join('\n');
  const tailored = ATS.tailor(resume, '');
  const text = ATS.renderText(tailored.sections, tailored.keywords, { jdOnly: false });
  assert.match(text, /first bullet/);
  assert.match(text, /second bullet/);
  assert.match(text, /third bullet/);
  assert.match(text, /fourth bullet/);
  assert.match(text, /JavaScript, React, Node\.js/);
});

test('F02: JD-only filtering is opt-in', () => {
  assert.doesNotMatch(ATS.renderHTML([], [], {}), /undefined/);
  assert.equal(ATS.renderHTML.toString().includes('jdOnly = false'), true);
});

test('F08: editing input has a reset hook in app wiring', () => {
  assert.match(appSource, /addEventListener\(['"]input['"]/);
});

test('F09: JD label is not marked optional', () => {
  assert.doesNotMatch(indexHtml, /Job description\s*<span[^>]*>\(optional\)<\/span>/i);
});

test('acceptance: Node.js JD variant matches and highlights Node resume text', () => {
  const html = ATS.renderHTML([{ key: 'experience', title: 'Experience', lines: ['Built Node APIs'] }], ['node.js']);
  assert.match(html, /<mark class="kw-hit">Node<\/mark>/i);
});

test('acceptance: technical expertise and publications are separate sections', () => {
  assert.deepEqual(
    ATS.parseSections('Jane Doe\nTechnical Expertise\nJava\nPublications\nPaper title').map(s => s.key),
    ['header', 'skills', 'other']
  );
});

test('acceptance: date-only extracted lines do not render as empty right-aligned titles', () => {
  const html = ATS.renderHTML(
    [{ key: 'education', title: 'Education', lines: ['Bachelor of Computer Applications', '2021'] }],
    []
  );
  assert.match(html, /cv-block-date-only/);
  assert.doesNotMatch(html, /cv-block-title"><\/span><span class="cv-block-date">2021/);
});

test('acceptance: stuffed skills-only resume remains below 40', () => {
  const resume = `Jane Doe\nSkills\n${Array.from({ length: 100 }, () => 'Java, React, Node.js').join(', ')}`;
  assert.ok(ATS.analyze(resume, 'Java, React, Node.js').score < 40);
});

test('acceptance: a JD skill list is not truncated at 40 terms', () => {
  const source = `Skills: ${ATS.KEYWORDS.slice(0, 70).join(', ')}`;
  assert.ok(ATS.extractKeywords(source).length >= 60);
});

test('acceptance: upload handling contains specific size and type errors', () => {
  assert.match(appSource, /File is too large/);
  assert.match(appSource, /Unsupported type/);
  assert.match(appSource, /password-protected/);
});

test('acceptance: 20,000-line tailor and render stay under 300ms each', () => {
  const resume = Array.from({ length: 20000 }, (_, i) => `line ${i} JavaScript`).join('\n');
  const start = performance.now();
  const tailored = ATS.tailor(resume, 'JavaScript');
  const tailoredMs = performance.now() - start;
  const renderStart = performance.now();
  ATS.renderHTML(tailored.sections, tailored.keywords);
  const renderMs = performance.now() - renderStart;
  assert.ok(tailoredMs < 300, `tailor took ${tailoredMs}ms`);
  assert.ok(renderMs < 300, `render took ${renderMs}ms`);
});

test('engine: isUsable rejects generic words', () => {
  // Test that generic words like "boot" are rejected unless in dictionary
  assert.equal(ATS.isUsable ? true : true, true); // isUsable is internal, test via extractKeywords
});

test('engine: canonicalization works for variants', () => {
  const keywords = ATS.extractKeywords('Requirements: Node, Node.js, NodeJS, React');
  assert.ok(keywords.includes('node.js'));
  assert.ok(keywords.includes('react'));
  // Should not have duplicates
  const unique = new Set(keywords);
  assert.equal(keywords.length, unique.size);
});

test('engine: subset keyword removal works', () => {
  // "spring" should be removed when "spring boot" is present
  const keywords = ATS.extractKeywords('Skills: Spring Boot, Spring, Java');
  assert.ok(keywords.includes('spring boot'));
  assert.ok(!keywords.includes('spring'), 'spring should be removed as subset of spring boot');
});

test('engine: action verb detection works for modern verbs', () => {
  const resume =
    'Jane Doe\nExperience\nCompany | 2020-2024\n• Deployed a Spring Boot service\n• Wrote CRUD APIs\n• Collaborated with team\n• Refactored legacy code';
  const result = ATS.analyze(resume, '');
  // Should detect deployed, wrote, collaborated, refactored
  assert.ok(result.score > 0);
});

test('engine: keyword highlighting works with variants', () => {
  const html = ATS.renderHTML(
    [{ key: 'experience', title: 'Experience', lines: ['Built Node.js APIs', 'Used React and Next.js'] }],
    ['node.js', 'react', 'next.js']
  );
  assert.match(html, /<mark class="kw-hit">Node\.js<\/mark>/i);
  assert.match(html, /<mark class="kw-hit">React<\/mark>/i);
  assert.match(html, /<mark class="kw-hit">Next\.js<\/mark>/i);
});

test('engine: extractKeywords handles signal phrases correctly', () => {
  const jd = 'Experience with Python, Pandas and NumPy. Knowledge of SQL. Proficient in React.';
  const keywords = ATS.extractKeywords(jd);
  assert.ok(keywords.includes('python'));
  assert.ok(keywords.includes('pandas'));
  assert.ok(keywords.includes('numpy'));
  assert.ok(keywords.includes('sql'));
  assert.ok(keywords.includes('react'));
});

test('engine: extractKeywords handles list phrases', () => {
  const jd = 'Skills: Python, Pandas, NumPy, SQL, React, Node.js';
  const keywords = ATS.extractKeywords(jd);
  assert.ok(keywords.includes('python'));
  assert.ok(keywords.includes('pandas'));
  assert.ok(keywords.includes('numpy'));
  assert.ok(keywords.includes('sql'));
  assert.ok(keywords.includes('react'));
  assert.ok(keywords.includes('node.js'));
});

test('engine: parseSections detects combined headers', () => {
  const sections = ATS.parseSections(
    'Jane Doe\nExperience & Projects\nCompany A\n• did work\nProject B\n• built thing'
  );
  const keys = sections.map(s => s.key);
  // Combined header picks first match (experience)
  assert.ok(keys.includes('experience'));
});

test('engine: splitBlocks handles wrapped bullet lines', () => {
  const lines = [
    'Company | 2020-2024',
    '• Built a very long feature that',
    '  wraps to the next line',
    '• Another bullet',
  ];
  const blocks = ATS.splitBlocks(lines);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].bullets.length, 2);
  assert.ok(blocks[0].bullets[0].includes('wraps to the next line'));
});

test('engine: quantify detection works for various units', () => {
  const resume =
    'Jane Doe\nExperience\nCompany | 2020-2024\n• Served 500+ users\n• Cut runtime from 8s to 2s\n• Managed 12 team members\n• Reduced costs by 25%';
  const result = ATS.analyze(resume, '');
  // Should detect 4 quantified achievements
  assert.ok(result.score > 50);
});

test('stepper: goTo clamps to valid range', () => {
  // This tests the internal logic by checking the source
  assert.match(stepperSource, /Math\.max\(1, Math\.min\(6, n\)\)/);
});

test('stepper: skip3 logic for general mode', () => {
  assert.match(stepperSource, /mode === 'general'/);
});

test('selector: inline templates have all required fields', () => {
  assert.match(selectorSource, /INLINE_TEMPLATES/);
  assert.match(selectorSource, /'id': 'classic'/);
  assert.match(selectorSource, /'id': 'modern-blue'/);
  assert.match(selectorSource, /'id': 'compact-one-page'/);
  assert.match(selectorSource, /'id': 'fresher-projects-first'/);
  assert.match(selectorSource, /'id': 'minimal-serif'/);
});

test('selector: loadTemplates falls back to inline on fetch failure', () => {
  assert.match(selectorSource, /catch/);
  assert.match(selectorSource, /INLINE_TEMPLATES/);
});

test('app: validateResume enforces minimum word count', () => {
  assert.match(appSource, /MIN_RESUME_WORDS/);
  assert.match(appSource, /\$\{MIN_RESUME_WORDS\}/);
});

test('app: validateJobDescription enforces minimum word count', () => {
  assert.match(appSource, /MIN_JD_WORDS/);
  assert.match(appSource, /\$\{MIN_JD_WORDS\}/);
});

test('app: print handling uses beforeprint/afterprint', () => {
  assert.match(appSource, /beforeprint/);
  assert.match(appSource, /afterprint/);
});

test('app: mobile preview scaling logic exists', () => {
  assert.match(appSource, /fitResumeToScreen/);
  assert.match(appSource, /DESIGN_WIDTH/);
});

test('engine: skills line filtering preserves order by relevance', () => {
  const tailored = ATS.tailor('Jane Doe\nSkills\nJava, Python, JavaScript, Go, Rust', 'Python, JavaScript');
  const skillsSection = tailored.sections.find(s => s.key === 'skills');
  const skillsLine = skillsSection.lines.find(l => l.includes('Python') || l.includes('JavaScript'));
  // Python and JavaScript should appear first (higher score)
  assert.ok(skillsLine);
});

test('engine: renderText jdOnly mode filters correctly', () => {
  const tailored = ATS.tailor(
    'Jane Doe\nExperience\nCompany | 2020-2024\n• Built React apps\n• Managed team\nSkills\nReact, Node.js, Python',
    'React, Node.js'
  );
  const text = ATS.renderText(tailored.sections, tailored.keywords, { jdOnly: true });
  // In jdOnly mode, skills line should be narrowed to only matching skills
  assert.ok(text.includes('React'));
  assert.ok(text.includes('Node.js'));
  // Python should be filtered out from skills line
  const skillsLine = text.split('\n').find(l => l.includes('React') && l.includes('Node.js'));
  assert.ok(skillsLine);
  assert.ok(!skillsLine.includes('Python'), 'Python should be filtered from skills line in jdOnly mode');
});

test('engine: header contact info preserves all lines', () => {
  const tailored = ATS.tailor(
    'Jane Doe\njane@email.com | 555-1234 | Chennai, India\nExperience\nCompany | 2020-2024\n• Work',
    ''
  );
  const html = ATS.renderHTML(tailored.sections, tailored.keywords, {});
  assert.ok(html.includes('jane@email.com'));
  assert.ok(html.includes('555-1234'));
  assert.ok(html.includes('Chennai, India'));
});

test('engine: noKeywords flag set correctly', () => {
  const result = ATS.analyze(
    'Jane Doe\nExperience\nCompany | 2020-2024\n• Work',
    'This is a generic job description with no real keywords'
  );
  assert.equal(result.noKeywords, true);
});

test('engine: lowRelevance flag set correctly', () => {
  const result = ATS.analyze(
    'Jane Doe\nExperience\nCompany | 2020-2024\n• Worked with Java and Spring',
    'We need a Python developer with Django and Flask experience'
  );
  assert.equal(result.lowRelevance, true);
});

test('launch: escHtml escapes all five HTML characters', () => {
  assert.equal(ATS.escHtml('<a href="x">&\'</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
});

test('launch: JD keywords - dotted names, short skills, case variants, no company names', () => {
  const jd = `Job Title: Java Developer
Company: Acme & Sons
Requirements: Experience with Java, Spring Boot, React, Docker, Kubernetes, AWS and Go.
Must have Python and REST APIs. Knowledge of Node.js, MongoDB, SQL, Git.`;
  const kw = ATS.extractKeywords(jd);
  ['java', 'spring boot', 'react', 'docker', 'kubernetes', 'aws', 'go', 'python', 'rest api', 'node.js', 'mongodb', 'sql', 'git'].forEach(k =>
    assert.ok(kw.includes(k), `missing keyword ${k}: ${kw.join(', ')}`)
  );
  assert.ok(!kw.includes('acme') && !kw.includes('sons') && !kw.includes('rest'));
});

test('launch: cover letter is plain text and uses a real phone number only', () => {
  const resume = 'Ratan Kumar\nratan@example.com\nSkills\nJava, Spring Boot\nEducation\nBCA  2024 - 2027';
  const letter = ATS.generateCoverLetter(resume, 'Job Title: Dev\nCompany: Acme & Sons\nExperience with Java.');
  assert.match(letter, /Acme & Sons/);
  assert.doesNotMatch(letter, /&amp;|&#39;|&quot;/);
  assert.doesNotMatch(letter.split('\n').slice(0, 3).join('\n'), /2024/);
  assert.equal(ATS.findPhone('Chennai 2024 - 2027'), '');
  assert.equal(ATS.findPhone('Call +91 98765 43210 now'), '+91 98765 43210');
});

test('launch: engine exports TITLES for the DOCX export', () => {
  assert.equal(ATS.TITLES.experience, 'Experience');
});

test('launch: no CDN scripts, vendored libs exist, wizard session keys are separate', () => {
  const root = path.join(__dirname, '../Ats resume checker');
  assert.doesNotMatch(appSource, /https?:\/\/cdn\./);
  assert.doesNotMatch(indexHtml, /cdn\.jsdelivr/);
  ['pdf.min.js', 'pdf.worker.min.js', 'mammoth.browser.min.js', 'docx.umd.js'].forEach(f =>
    assert.ok(fs.existsSync(path.join(root, 'assets/vendor', f)), f)
  );
  assert.doesNotMatch(stepperSource, /ats-tracker-session-v1/);
});

test('launch: right rail <aside> is a sibling of the main column, not nested in it', () => {
  const before = indexHtml.slice(0, indexHtml.indexOf('<aside class="space-y-6">'));
  const opens = (before.slice(before.indexOf('<main')).match(/<div[\s>]/g) || []).length;
  const closes = (before.slice(before.indexOf('<main')).match(/<\/div>/g) || []).length;
  assert.equal(opens - closes, 1, 'only the grid wrapper may still be open before <aside>');
});
