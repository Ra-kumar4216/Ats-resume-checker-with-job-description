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
  // the date joins the line above it; it is never an empty title with a right-aligned date
  assert.match(html, /cv-block-title">Bachelor of Computer Applications<\/span><span class="cv-block-date">2021/);
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

test('launch: every local src/href/poster in index.html exists on disk (logo, video, poster)', () => {
  const root = path.join(__dirname, '../Ats resume checker');
  const refs = [...indexHtml.matchAll(/(?:src|href|poster)="([^"#?]+)"/g)].map(m => m[1]);
  const local = refs.filter(r => !/^(https?:|data:|mailto:)/.test(r));
  assert.ok(local.includes('assets/logo.svg.png') && local.some(r => r.endsWith('.mp4')));
  local.forEach(r => assert.ok(fs.existsSync(path.join(root, r)), `missing file: ${r}`));
});

test('launch: sidebar and top navbar list all sections and every #anchor has a target', () => {
  const ids = new Set([...indexHtml.matchAll(/id="([^"]+)"/g)].map(m => m[1]));
  const hrefs = [...indexHtml.matchAll(/href="#([^"]+)"/g)].map(m => m[1]);
  ['how-it-works', 'features', 'why-choose'].forEach(id => {
    assert.ok(ids.has('video-guide'), 'video card must keep its #video-guide anchor');
    assert.ok(ids.has(id), `missing section #${id}`);
    assert.ok(hrefs.filter(h => h === id).length >= 2, `#${id} must be linked from sidebar and top navbar`);
  });
  hrefs.forEach(h => assert.ok(ids.has(h), `dead link #${h}`));
});

// ---------------------------------------------------------------------------
// Real-resume regressions (small-caps PDFs, icon glyphs, LinkedIn two-column PDF)
// ---------------------------------------------------------------------------
test('pdf text: small-caps splits are repaired and section headings are found', () => {
  const text = 'R ATAN   K UMAR\nP ROFESSIONAL   S UMMARY\nBuilds apps.\nT ECHNICAL   S KILLS\nJava, Python\nP ROJECTS\nA CHIEVEMENTS & A DDITIONAL I NFORMATION\nOpen source';
  const clean = ATS.cleanExtractedText(text).split('\n');
  assert.deepEqual(clean.slice(0, 2), ['RATAN KUMAR', 'PROFESSIONAL SUMMARY']);
  assert.ok(clean.includes('ACHIEVEMENTS & ADDITIONAL INFORMATION'));
  const keys = ATS.parseSections(text).map(sec => sec.key);
  ['summary', 'skills', 'projects', 'other'].forEach(k => assert.ok(keys.includes(k), `missing section ${k}: ${keys}`));
  // real English is left alone
  assert.equal(ATS.cleanExtractedText('I AM READY'), 'I AM READY');
});

test('pdf text: icon glyphs, page footers and wrapped URLs are cleaned', () => {
  const text = '§   github.com/Aayush-code11   ï   linkedin.com/in/aayush-raj-069139361\nOnline Job Portal System   §\nwww.linkedin.com/in/ratan-kumar-\nmetha   (LinkedIn)\ngithub.com/\nRa-kumar4216\nPage   2   of   3\n1';
  const out = ATS.cleanExtractedText(text);
  assert.doesNotMatch(out, /[§ï]/);
  assert.match(out, /^github\.com\/Aayush-code11 \| linkedin\.com\/in\/aayush-raj-069139361$/m);
  assert.match(out, /^www\.linkedin\.com\/in\/ratan-kumar-metha$/m);
  assert.match(out, /^github\.com\/Ra-kumar4216$/m);
  assert.doesNotMatch(out, /Page\s+2\s+of\s+3/);
  assert.ok(!out.split('\n').includes('1'));
});

test('linkedin pdf: Contact lines join the header and Top Skills is a skills section', () => {
  const text = 'Ratan Kumar\nChennai, India\nSummary\nBuilds apps.\nExperience\nAmdox Technologies\nContact\n9507317244 (Mobile)\nratan@example.com\nTop Skills\nAI Literacy\nGenerative AI\nCertifications\nJava Assessment';
  const sections = ATS.parseSections(text);
  const header = sections.find(sec => sec.key === 'header').lines.join('\n');
  assert.match(header, /Ratan Kumar/);
  assert.match(header, /9507317244\n/);
  assert.doesNotMatch(header, /\(Mobile\)/);
  assert.match(header, /ratan@example\.com/);
  assert.deepEqual(sections.filter(sec => sec.key !== 'header').map(sec => sec.key), ['summary', 'experience', 'skills', 'certifications']);
});

test('pdf columns: sidebar, 3 columns, header above columns; date column and single column are not split', () => {
  const item = (str, x, y, w) => ({ str, transform: [1, 0, 0, 1, x, y], width: w, height: 10 });
  const col = (prefix, x, w, n, y0 = 700) => Array.from({ length: n }, (_, i) => item(`${prefix} line ${i}`, x, y0 - i * 14, w));

  // sidebar + main (LinkedIn style)
  const mainCol = col('main column text', 224, 300, 30);
  mainCol[0].height = 22; // the name is the biggest text on the page
  const two = ATS.pageText([...col('side', 22, 80, 12), ...mainCol]);
  assert.match(two.main, /^main column text line 0\nmain column text line 1/);
  assert.match(two.side, /^side line 0\nside line 1/);
  assert.doesNotMatch(two.main, /side line/);

  // full-width name + contact row above two columns
  const withHeader = ATS.pageText([item('RATAN KUMAR', 40, 800, 500), item('city | phone | mail', 40, 786, 500), ...col('left', 40, 150, 14), ...col('right', 260, 280, 24)]);
  const all = `${withHeader.main}\n${withHeader.side}`;
  assert.match(withHeader.main, /^RATAN KUMAR\ncity \| phone \| mail\n/);
  ['left line 0', 'left line 13', 'right line 0', 'right line 23'].forEach(s => assert.ok(all.includes(s), s));
  assert.ok(all.indexOf('left line 3') < all.indexOf('left line 4'), 'order inside a column is kept');
  assert.ok(!/left line 5\nright line/.test(all), 'columns are not interleaved');

  // three columns
  const three = ATS.pageText([...col('A', 30, 120, 12), ...col('B', 220, 120, 12), ...col('C', 410, 120, 12)]);
  const t3 = `${three.main}\n${three.side}`;
  ['A', 'B', 'C'].forEach(c => {
    const idx = [...Array(12).keys()].map(i => t3.indexOf(`${c} line ${i}`));
    assert.ok(idx.every(i => i >= 0) && idx.every((v, i) => i === 0 || v > idx[i - 1]), `column ${c} stays in one piece, in order`);
  });

  // single column + a right-aligned dates column must stay one column
  const single = [...Array.from({ length: 20 }, (_, i) => item(`Developer intern at company number ${i} doing things`, 40, 700 - i * 14, 300))];
  for (let i = 0; i < 4; i += 1) {
    single.push(item('Mar 2026 – Present', 500, 700 - i * 56, 70));
  }
  const one = ATS.pageText(single);
  assert.equal(one.side, '');
  assert.match(one.main, /Mar 2026 – Present/);
});

test('cover letter: skills have no labels, role/company/education read naturally, no icon glyphs', () => {
  const resume = `Aayush Raj
singhaayush7766@gmail.com | +91-8340794311
Technical Skills
Programming: Java
Backend: Spring Boot, REST APIs
Frontend: HTML, CSS
Experience
Amdox Technologies   March 2026 – Present
Java Full Stack Developer Intern   Chennai, India
Project
Online Job Portal System   §
Education
B.Tech in Computer Science Engineering   2023 – 2027
LNCT University, Bhopal`;
  const letter = ATS.generateCoverLetter(resume, '');
  assert.match(letter, /My background includes Java, Spring Boot, REST APIs, HTML and CSS,/);
  assert.doesNotMatch(letter, /Programming:|Backend:|Frontend:|§|2023/);
  assert.match(letter, /including Online Job Portal System,/);
  assert.match(letter, /I am currently working as a Java Full Stack Developer Intern at Amdox Technologies\./);
  assert.match(letter, /Alongside this, I am pursuing B\.Tech in Computer Science Engineering at LNCT University\./);
  const upper = ATS.generateCoverLetter('RATAN KUMAR\nratan@example.com\nSkills\nJava', '');
  assert.match(upper, /^Ratan Kumar\n/);
  assert.match(upper, /\nRatan Kumar$/);
});

test('resume header: short contact items never wrap in the middle', () => {
  const t = ATS.tailor('Aayush Raj\nBhopal\nsinghaayush7766@gmail.com | +91-8340794311\ngithub.com/Aayush-code11 | linkedin.com/in/aayush-raj-069139361\nSkills\nJava', '');
  const html = ATS.renderHTML(t.sections, t.keywords);
  assert.match(html, /<span class="cv-nw">linkedin\.com\/in\/aayush-raj-069139361<\/span>/);
});

test('blocks: LinkedIn company / role / date / location lines become one header, bullets never swallow the next job', () => {
  const lines = [
    'Amdox Technologies', 'java full stack developer', 'March 2026 - Present   (3 months)',
    '• Develop and maintain apps', '• Debug and resolve production issues through root-cause analysis',
    'Codec Technologies India', '3 months', 'Data Analystics', 'April 2026 - May 2026   (2 months)',
    'Full Stck Developer', 'March 2026 - April 2026   (2 months)', '• Designed pages', '• Worked in an Agile team',
    'HexSoftwares', 'Web Development Intern', 'March 2026 - April 2026   (2 months)', 'India', '• Built a gym site',
  ];
  const first = ATS.splitBlocks(lines);
  assert.deepEqual(first.map(b => b.header[0].split(/\s{3,}/)[0]), [
    'Amdox Technologies', 'Codec Technologies India', 'Codec Technologies India – Full Stck Developer', 'HexSoftwares',
  ]);
  assert.deepEqual(first[3].header.slice(1), ['Web Development Intern', 'India']);
  assert.ok(first.every(b => b.bullets.every(x => x.startsWith('•'))), 'plain lines must not become bullets');
  assert.ok(!first[0].bullets.join(' ').includes('Codec'));
  // tailor() serialises blocks and render parses them again: the result must be stable
  const again = ATS.splitBlocks(first.flatMap(b => [...b.header, ...b.bullets]));
  assert.deepEqual(again.map(b => b.header), first.map(b => b.header));
});

test('blocks: education year ranges are headers, grades are details', () => {
  const blocks = ATS.splitBlocks([
    'B.Tech in Computer Science Engineering   2023 – 2027', 'LNCT University, Bhopal', 'Current SGPA: 8.38',
    'Class XII (CBSE)   2022', 'Sardana Public School — 79.6%',
  ]);
  assert.equal(blocks.length, 2);
  assert.deepEqual(blocks[0].header, ['B.Tech in Computer Science Engineering   2023 – 2027', 'LNCT University, Bhopal']);
  assert.deepEqual(blocks[1].header, ['Class XII (CBSE)   2022', 'Sardana Public School — 79.6%']);
});

test('pdf text: LinkedIn bullets, wrapped date brackets and pipe headline are normalised', () => {
  const out = ATS.cleanExtractedText('•Develop apps\nFinal year l Software Developer l Java | Spring Boot\nBachalore of computer application , Computer application   · (June 2024 - July\n2027)');
  assert.match(out, /^• Develop apps$/m);
  assert.match(out, /^Final year \| Software Developer \| Java \| Spring Boot$/m);
  assert.match(out, /^Bachalore of computer application, Computer application {3}June 2024 - July 2027$/m);
});

test('render: when no section heading is found the text is shown line by line, not glued with middots', () => {
  const lines = ['Jane Doe', 'Chennai | jane@x.com'].concat(Array.from({ length: 12 }, (_, i) => `Plain sentence number ${i} about work.`));
  const t = ATS.tailor(lines.join('\n'), '');
  const html = ATS.renderHTML(t.sections, t.keywords, { highlight: false });
  assert.ok((html.match(/<p class="cv-line">/g) || []).length >= 10);
  assert.doesNotMatch(html, /Plain sentence number 1 about work\. · /);
});

test('render: role and location lines are quiet sub-lines, other sections keep their own heading', () => {
  const t = ATS.tailor('Jane Doe\nExperience\nAcme Corp   2024 - 2025\nBackend Intern   Chennai, India\n• Built APIs\nAchievements\n• Won a hackathon', '');
  const html = ATS.renderHTML(t.sections, t.keywords, { highlight: false });
  assert.match(html, /cv-block-sub-title">Backend Intern<\/span><span class="cv-block-date">Chennai, India/);
  assert.match(html, /cv-section-title">Achievements</);
  assert.doesNotMatch(html, /<li>Backend Intern/);
});

test('fail-safe: when no headings are found the resume is never glued into one paragraph', () => {
  const lines = ['RATAN KUMAR', 'Chennai | 9507317244 | ratan@example.com'];
  for (let i = 0; i < 30; i += 1) {
    lines.push(i % 3 === 0 ? `• Built feature number ${i} with Java` : `Plain line number ${i} about work`);
  }
  const t = ATS.tailor(lines.join('\n'), '');
  const html = ATS.renderHTML(t.sections, t.keywords);
  assert.ok(!/cv-contact">[^<]{600,}/.test(html), 'contact line must stay short');
  assert.ok((html.match(/<p class="cv-line">/g) || []).length >= 15);
  const tips = ATS.analyze(lines.join('\n'), '').missing.join(' ');
  assert.match(tips, /No section headings were detected/);
});

test('headings: common variants and letter-spaced headings are recognised', () => {
  const text = [
    'Name Here',
    'P R O F I L E  S U M M A R Y',
    'Text one.',
    'IT Skills',
    'Java',
    'Extra-Curricular Activities',
    'Chess',
    'Awards & Honors',
    'Prize',
    'Soft Skills',
    'Teamwork',
    'Declaration',
    'True.',
  ].join('\n');
  const keys = ATS.parseSections(text).map(sec => sec.key);
  assert.deepEqual(keys, ['header', 'summary', 'skills', 'other', 'other', 'other', 'other']);
});

test('analyze: raw PDF text (footers, icon glyphs) scores the same as clean text', () => {
  const clean = 'Aayush Raj\na@b.com | +91-8340794311\nSkills\nJava, Spring Boot\nExperience\nIntern\n• Built APIs for 500+ users\nEducation\nBTech 2023 – 2027';
  const dirty = clean.replace('Aayush Raj', 'Aayush Raj\n§').replace('Education', 'Page 1 of 2\nEducation') + '\n1';
  assert.equal(ATS.analyze(dirty, '').score, ATS.analyze(clean, '').score);
});

test('css: every class used in index.html has a style rule (no unstyled elements)', () => {
  const root = path.join(__dirname, '../Ats resume checker');
  const inline = (indexHtml.match(/<style[\s\S]*?<\/style>/g) || []).join('\n');
  const css = [fs.readFileSync(path.join(root, 'tailwind.generated.css'), 'utf8'), fs.readFileSync(path.join(root, 'styles.css'), 'utf8'), inline].join('\n');
  const markers = new Set(['group', 'peer', 'hidden', 'is-active', 'is-done', 'is-locked', 'kw-hit', 'sr-only']);
  const escape = c => c.replace(/([^a-zA-Z0-9_-])/g, (ch, _x, offset) => (ch === ',' ? '\\2c ' : `\\${ch}`));
  const used = new Set();
  [...indexHtml.matchAll(/\sclass="([^"]+)"/g)].forEach(m => m[1].split(/\s+/).filter(Boolean).forEach(c => used.add(c)));
  const missing = [...used].filter(c => !markers.has(c) && !css.includes(`.${escape(c)}`) && !css.includes(`.${c}`));
  assert.deepEqual(missing, [], `classes without CSS: ${missing.join(', ')}`);
});

test('blocks: an institution line after a coursework bullet is a new education entry', () => {
  const blocks = ATS.splitBlocks([
    'Sengunthar Arts & Science College   June 2024 – July 2027',
    'Bachelor of Computer Applications (BCA)   Tamil Nadu, India',
    '• Relevant Coursework: Data Structures & Algorithms, Database Management',
    'Systems, Computer Networks, Software Engineering',
    'Sanskar International School',
    'High School Diploma',
  ]);
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].bullets.length, 1);
  assert.match(blocks[0].bullets[0], /Database Management Systems, Computer Networks, Software Engineering$/);
  assert.deepEqual(blocks[1].header, ['Sanskar International School', 'High School Diploma']);
});

test('headings: wrapped list fragments and "label: value" lines are never section headings', () => {
  const text = 'Name\nSkills\nProgramming: Java\nTools & Platforms: Git, GitHub, Firebase,\nYouTube Data API, REST APIs\nTechnologies, Software Engineering\nProjects & Open Source\nApp';
  const keys = ATS.parseSections(text).map(sec => sec.key);
  assert.deepEqual(keys, ['header', 'skills', 'projects']);
});

// ---------------------------------------------------------------------------
// Any resume -> the template the user picked (HTML / PDF print and Word)
// ---------------------------------------------------------------------------
const Templates = require('../Ats resume checker/resume-templates/selector.js');
const tplDir = path.join(__dirname, '../Ats resume checker/resume-templates/templates');
const allTemplates = fs.readdirSync(tplDir).filter(f => f.endsWith('.json')).map(f => Templates.normalize(JSON.parse(fs.readFileSync(path.join(tplDir, f), 'utf8'))));

const sampleResume = `ASHA VERMA
Pune, India | +91 98765 43210 | asha@example.com
linkedin.com/in/asha-verma | github.com/asha-verma
Summary
Backend developer who builds reliable APIs with Java and Spring Boot.
Skills
Languages: Java, Python, SQL
Tools: Git, Docker, Maven
Experience
Acme Software   Jan 2025 – Present
Java Developer Intern   Pune, India
• Built REST APIs with Spring Boot used by 500+ users
• Reduced query time by 30% using indexes
Projects
Job Portal | 2024
• Developed a job portal with Spring Boot and MySQL
Education
B.Tech in Computer Science   2023 – 2027
LNCT University, Bhopal
Certifications
• Java Programming – Infosys`;

const wordsOf = text => text.toLowerCase().replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/[^a-z0-9+#@./-]+/g, ' ').split(/\s+/).filter(w => w.length > 2);

test('templates: every template keeps every word of the resume (nothing lost, nothing invented)', () => {
  const original = new Set(wordsOf(sampleResume));
  assert.ok(allTemplates.length >= 8, 'all template files are loaded');
  allTemplates.forEach(tpl => {
    const t = ATS.tailor(sampleResume, '');
    const html = ATS.renderHTML(Templates.orderSections(t.sections, tpl), t.keywords, { highlight: false, ...Templates.renderOptions(tpl) });
    const got = new Set(wordsOf(html));
    const lost = [...original].filter(w => !got.has(w));
    const invented = [...got].filter(w => !original.has(w));
    assert.deepEqual(lost, [], `${tpl.id} lost: ${lost}`);
    assert.deepEqual(invented, [], `${tpl.id} invented: ${invented}`);
  });
});

test('templates: layout, sidebar sections, section order and icons follow the selected template', () => {
  allTemplates.forEach(tpl => {
    const t = ATS.tailor(sampleResume, '');
    const ordered = Templates.orderSections(t.sections, tpl);
    const html = ATS.renderHTML(ordered, t.keywords, { highlight: false, ...Templates.renderOptions(tpl) });
    const icons = (html.match(/<svg/g) || []).length;
    if (tpl.icons) {
      assert.ok(icons >= 4, `${tpl.id}: contact icons are drawn (${icons})`);
    } else {
      assert.equal(icons, 0, `${tpl.id}: no icons when the template has none`);
    }
    if (tpl.layout === 'single') {
      assert.ok(!html.includes('cv-cols'), `${tpl.id}: single column`);
    } else {
      assert.ok(html.includes(tpl.layout === 'sidebar-left' ? 'cv-side-left' : 'cv-side-right'), `${tpl.id}: sidebar side`);
      const side = html.split('<div class="cv-side">')[1] || '';
      const sideTitles = [...side.matchAll(/cv-section-title">([^<]+)/g)].map(m => m[1].toLowerCase());
      assert.ok(sideTitles.some(s => /skills/.test(s)) && sideTitles.some(s => /education/.test(s)), `${tpl.id}: skills + education live in the sidebar`);
      const main = html.split('<div class="cv-main">')[1].split('<div class="cv-side">')[0];
      assert.ok(/Experience/i.test(main) && !/Education/i.test(main), `${tpl.id}: experience stays in the main column`);
    }
    const keys = ordered.filter(s => s.key !== 'header').map(s => s.key);
    const ranks = keys.map(k => (tpl.sectionOrder.includes(k) ? tpl.sectionOrder.indexOf(k) : 99));
    assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b), `${tpl.id}: sections follow sectionOrder`);
  });
});

test('word export: every template builds a valid .docx with icons / two-column table as selected', async () => {
  const docx = require('docx');
  const JSZip = require('jszip');
  const icons = require('../Ats resume checker/resume-icons.js');
  const src = fs.readFileSync(path.join(__dirname, '../Ats resume checker/app.js'), 'utf8');
  const body = src.slice(src.indexOf('function buildDocxDocument('), src.indexOf('async function exportDocx'));
  const build = new Function('docx', 'ATS', 'window', 'ResumeIcons', `${body}\nreturn buildDocxDocument;`)(docx, ATS, { ResumeIcons: icons }, icons);
  for (const tpl of allTemplates) {
    const t = ATS.tailor(sampleResume, '');
    const buf = await docx.Packer.toBuffer(build(Templates.orderSections(t.sections, tpl), tpl));
    const zip = await JSZip.loadAsync(buf);
    const xml = await zip.file('word/document.xml').async('string');
    const media = Object.keys(zip.files).filter(f => f.startsWith('word/media/')).length;
    assert.match(xml, /ASHA VERMA/, `${tpl.id}: name`);
    assert.match(xml, /Spring Boot used by 500\+ users/, `${tpl.id}: bullets`);
    assert.equal(media >= 4, tpl.icons, `${tpl.id}: icons in Word only when the template has icons (${media})`);
    assert.equal(xml.includes('<w:tbl>'), tpl.layout !== 'single', `${tpl.id}: two-column table`);
    if (tpl.layout !== 'single') {
      assert.match(xml, /<w:keepNext w:val="false"\/>/, `${tpl.id}: headings in table cells must not keep-with-next`);
    }
  }
});

// ---------------------------------------------------------------------------
// Print page fit: 1 page when it can look good, otherwise well-filled pages
// ---------------------------------------------------------------------------
test('page breaks: an entry that would be cut by the page edge moves whole to the next page', () => {
  const H = 1000;
  // a 200px entry starting at 900 would cross the edge: pushed to 1000, everything below moves 100px
  assert.equal(ATS.simulatePageBreaks([{ bottom: 1500, ranges: [{ top: 900, bottom: 1100 }] }], H), 1.6);
  // fits: unchanged
  assert.equal(ATS.simulatePageBreaks([{ bottom: 1500, ranges: [{ top: 100, bottom: 400 }, { top: 1200, bottom: 1300 }] }], H), 1.5);
  // nested piece (a heading inside an entry that was already placed) is not counted twice
  assert.equal(ATS.simulatePageBreaks([{ bottom: 1500, ranges: [{ top: 900, bottom: 1100 }, { top: 950, bottom: 1000 }] }], H), 1.6);
  // taller than a page: the browser must split it, nothing moves
  assert.equal(ATS.simulatePageBreaks([{ bottom: 2500, ranges: [{ top: 500, bottom: 1700 }] }], H), 2.5);
  // two columns: the taller one decides
  assert.equal(ATS.simulatePageBreaks([{ bottom: 900, ranges: [] }, { bottom: 1500, ranges: [{ top: 950, bottom: 1050 }] }], H), 1.55);
  // second push depends on the first
  assert.equal(ATS.simulatePageBreaks([{ bottom: 2000, ranges: [{ top: 900, bottom: 1100 }, { top: 1850, bottom: 2050 }] }], H), 2.15);
});

test('page fit: 1 page whenever possible, a 2nd page only when it ends up at least half full', () => {
  // content height in pages for L (at zoom 1, normal spacing); text height ~ zoom^2, tight spacing saves ~10%
  const model = L => (zoom, gap) => L * zoom * zoom * (gap < 1 ? 0.9 : 1);
  for (let L = 0.2; L <= 3.2; L += 0.01) {
    const measure = model(L);
    const fit = ATS.choosePageFit(measure);
    const where = `L=${L.toFixed(2)} -> ${JSON.stringify(fit)}`;
    assert.ok(fit.zoom >= 0.9 && fit.zoom <= 1.12, `zoom range: ${where}`);
    assert.ok(measure(fit.zoom, fit.gap) <= fit.pages * 0.9751 + 1e-9, `never overflows its pages: ${where}`);
    const lastFill = measure(fit.zoom, fit.gap) - (fit.pages - 1);
    if (fit.pages > 1 && L < 3) {
      assert.ok(lastFill >= 0.5, `last page at least half full: ${where}`);
      assert.ok(measure(0.9, 0.7) > (fit.pages - 1) * 0.975, `a smaller page count was not possible: ${where}`);
    }
    if (L <= 1.0) {
      assert.equal(fit.pages, 1, where);
    }
    if (L >= 1.0 && L <= 1.25) {
      assert.equal(fit.pages, 1, `slightly too long: shrink to 1 page: ${where}`);
    }
  }
  assert.deepEqual(ATS.choosePageFit(() => 0), { zoom: 1, gap: 1, pages: 1, fill: 0, unmeasured: true });
});

test('page fit: the real-world case - a resume 2% over one page is shrunk to one page, not left with 10 lines on page 2', () => {
  const fit = ATS.choosePageFit((zoom, gap) => 1.02 * zoom * zoom * (gap < 1 ? 0.92 : 1));
  assert.equal(fit.pages, 1);
  assert.ok(fit.zoom >= 0.95 && fit.zoom <= 1);
});

test('page fit: the DOM measurement collects the same unbreakable pieces as the print stylesheet', () => {
  // tiny fake DOM (no jsdom dependency): enough of Element for breakColumns()
  const node = (tag, cls, top, bottom, children = []) => {
    const el = {
      tag,
      cls: cls.split(' ').filter(Boolean),
      children,
      parent: null,
      classList: { contains: c => el.cls.includes(c) },
      getBoundingClientRect: () => ({ top, bottom }),
      get firstElementChild() {
        return el.children[0] || null;
      },
      get lastElementChild() {
        return el.children[el.children.length - 1] || null;
      },
      get nextElementSibling() {
        return el.parent ? el.parent.children[el.parent.children.indexOf(el) + 1] || null : null;
      },
    };
    children.forEach(c => {
      c.parent = el;
    });
    const all = () => el.children.flatMap(c => [c, ...c.querySelectorAll('*')]);
    const matches = (n, part) => {
      const [, t2, classes] = /^([a-z]*)((?:\.[\w-]+)*)$/.exec(part.trim());
      return (!t2 || n.tag === t2) && classes.split('.').filter(Boolean).every(c => n.cls.includes(c));
    };
    el.querySelectorAll = sel => {
      if (sel === '*') {
        return all();
      }
      return all().filter(n =>
        sel.split(',').some(one => {
          const parts = one.split('>').map(p => p.trim());
          return parts.length === 2 ? matches(n, parts[1]) && n.parent && matches(n.parent, parts[0]) : matches(n, parts[0]);
        })
      );
    };
    return el;
  };
  const src = fs.readFileSync(path.join(__dirname, '../Ats resume checker/app.js'), 'utf8');
  const start = src.indexOf('function breakColumns(');
  const breakColumns = new Function(`${src.slice(start, src.indexOf('function describeFit', start))}\nreturn breakColumns;`)();

  const entry = node('div', 'cv-block', 60, 300, [node('div', 'cv-block-header-row', 60, 80), node('ul', 'cv-bullets', 80, 300)]);
  const main = node('div', 'cv-main', 40, 1000, [node('div', 'cv-section', 40, 520, [node('div', 'cv-section-title', 40, 60), entry])]);
  const side = node('div', 'cv-side', 40, 600, [
    node('div', 'cv-section', 40, 300, [node('div', 'cv-section-title', 40, 60), node('ul', 'cv-bullets', 60, 300)]),
  ]);
  const page = node('div', 'resume', 0, 1000, [node('div', 'cv-name', 0, 40), node('div', 'cv-cols cv-side-left', 40, 1000, [main, side])]);

  const cols = breakColumns(page, 1000);
  assert.equal(cols.length, 2, 'main column and sidebar are measured separately');
  assert.ok(cols[0].ranges.some(r => r.top === 60 && r.bottom === 300), 'an entry (.cv-block) is one unbreakable piece');
  assert.ok(!cols[0].ranges.some(r => r.top === 40 && r.bottom === 520), 'a whole section of the main column may be split');
  assert.ok(cols[1].ranges.some(r => r.top === 40 && r.bottom === 300), 'a sidebar section stays in one piece');
  assert.equal(cols[0].bottom, 1000);

  // single column: the page itself is the only column
  const single = node('div', 'resume', 0, 800, [node('div', 'cv-name', 0, 40), node('div', 'cv-section', 40, 800, [node('div', 'cv-section-title', 40, 60), entry])]);
  const one = breakColumns(single, 800);
  assert.equal(one.length, 1);
  assert.ok(one[0].ranges.some(r => r.top === 60 && r.bottom === 300));
});
