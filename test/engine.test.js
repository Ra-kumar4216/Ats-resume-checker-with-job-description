const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ATS = require('../Ats resume checker/engine.js');

const indexHtml = fs.readFileSync(path.join(__dirname, '../Ats resume checker/index.html'), 'utf8');
const engineSource = fs.readFileSync(path.join(__dirname, '../Ats resume checker/engine.js'), 'utf8');

test('F01: score methodology and breakdown targets exist in the document', () => {
  assert.match(indexHtml, /id="score-method"/);
  assert.match(indexHtml, /id="score-breakdown"/);
});

test('F03: JD extraction ignores ordinary prose and fake company words', () => {
  assert.deepEqual(
    ATS.extractKeywords('You will excel in a team, express ideas and react quickly. Amazon values Amazon. Java, Spring Boot.'),
    ['java', 'spring boot'],
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
  const app = fs.readFileSync(path.join(__dirname, '../Ats resume checker/app.js'), 'utf8');
  assert.match(app, /addEventListener\(['"]input['"]/);
});

test('F09: JD label is not marked optional', () => {
  assert.doesNotMatch(indexHtml, /Job description\s*<span[^>]*>\(optional\)<\/span>/i);
});

test('acceptance: Node.js JD variant matches and highlights Node resume text', () => {
  const html = ATS.renderHTML([
    { key: 'experience', title: 'Experience', lines: ['Built Node APIs'] },
  ], ['node.js']);
  assert.match(html, /<mark class="kw-hit">Node<\/mark>/i);
});

test('acceptance: technical expertise and publications are separate sections', () => {
  assert.deepEqual(
    ATS.parseSections('Jane Doe\nTechnical Expertise\nJava\nPublications\nPaper title').map((s) => s.key),
    ['header', 'skills', 'other'],
  );
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
  const app = fs.readFileSync(path.join(__dirname, '../Ats resume checker/app.js'), 'utf8');
  assert.match(app, /File is too large/);
  assert.match(app, /Unsupported type/);
  assert.match(app, /password-protected/);
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
