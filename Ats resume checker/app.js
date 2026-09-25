/* UI wiring: upload, analyze, tailor, templates, export. Logic lives in engine.js. */
(function () {
  const $ = (id) => document.getElementById(id);
  let tailored = null, template = null;

  const words = (s) => s.trim().split(/\s+/).filter(Boolean).length;
  [['resume-text', 'resume-count'], ['jd-text', 'jd-count']].forEach(([i, o]) => {
    const f = () => ($(o).textContent = words($(i).value) + ' words');
    $(i).addEventListener('input', f); f();
  });
  const showError = (m) => { $('form-error').textContent = m; $('form-error').classList.remove('hidden'); };
  const hideError = () => $('form-error').classList.add('hidden');

  // ---- upload ----
  const input = $('file-input');
  ['dragover', 'drop'].forEach((e) => window.addEventListener(e, (ev) => ev.preventDefault()));
  $('drop-zone').addEventListener('drop', (e) => e.dataTransfer.files[0] && handleFile(e.dataTransfer.files[0]));
  input.addEventListener('change', () => input.files[0] && handleFile(input.files[0]));

  async function handleFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (file.size > 5 * 1024 * 1024) return fail('File is too large (max 5MB).');
    if (!['pdf', 'docx', 'txt'].includes(ext)) return fail('Unsupported type. Use PDF, DOCX or TXT.');
    $('upload-status').textContent = 'Extracting text…'; hideError();
    try {
      const buf = ext === 'txt' ? null : await file.arrayBuffer();
      const text = ext === 'txt' ? await file.text() : ext === 'pdf' ? await readPdf(buf) : await readDocx(buf);
      $('resume-text').value = text.trim(); $('resume-text').dispatchEvent(new Event('input'));
      $('upload-status').textContent = 'Loaded: ' + file.name;
    } catch (err) {
      console.error(err);
      fail(ext === 'pdf' ? 'Could not read this PDF (password-protected or scanned image?). Paste the text instead.' : 'Could not read this file. Paste the text instead.');
    }
  }
  function fail(msg) { $('upload-status').textContent = ''; input.value = ''; showError(msg); }

  async function readPdf(buf) {
    if (!window.pdfjsLib) throw new Error('PDF engine not loaded');
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
    const pdf = await pdfjsLib.getDocument({ data: buf, isEvalSupported: false }).promise; // CVE-2024-4367 mitigation
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const content = await (await pdf.getPage(i)).getTextContent();
      let lastY = null;
      content.items.forEach((it) => { const y = it.transform[5]; if (lastY !== null) text += Math.abs(y - lastY) > 2 ? '\n' : ' '; text += it.str; lastY = y; });
      text += '\n';
    }
    pdf.destroy();
    if (!text.trim()) throw new Error('No extractable text');
    return text;
  }
  async function readDocx(buf) {
    if (!window.mammoth) throw new Error('DOCX engine not loaded');
    const { value } = await mammoth.convertToHtml({ arrayBuffer: buf });
    const body = new DOMParser().parseFromString(value, 'text/html').body; // inert parse, no innerHTML on live DOM
    return [...body.children].flatMap((el) => /^(UL|OL)$/.test(el.tagName)
      ? [...el.querySelectorAll(':scope > li')].map((li) => '• ' + li.textContent.trim())
      : [el.textContent.trim()]).filter(Boolean).join('\n');
  }

  // ---- analyze ----
  function tags(el, items, cls, empty) {
    el.replaceChildren();
    if (!items.length) { const s = document.createElement('span'); s.className = 'text-xs text-slate-400'; s.textContent = empty; el.append(s); return; }
    items.forEach((t) => { const s = document.createElement('span'); s.className = `${cls} text-xs px-2.5 py-1 rounded-full`; s.textContent = t; el.append(s); });
  }
  function onAnalyze() {
    const resume = $('resume-text').value.trim(), jd = $('jd-text').value.trim();
    if (!resume) return showError('Upload or paste your resume first.');
    hideError();
    const r = ATS.analyze(resume, jd), s = r.score;
    const [color, status] = s >= 80 ? ['#10b981', 'Strong resume'] : s >= 60 ? ['#8b5cf6', 'Good, room to improve'] : s >= 40 ? ['#f59e0b', 'Weak, needs work'] : ['#f43f5e', 'Needs significant work'];
    $('placeholder-result').classList.add('hidden'); $('analysis-result').classList.remove('hidden');
    const c = $('score-circle'); c.style.strokeDashoffset = 377 - (377 * s) / 100; c.setAttribute('stroke', color);
    $('score-text').textContent = s + '%'; $('score-status').textContent = status; $('score-status').style.color = color;
    const jdMode = r.mode === 'jd';
    $('mode-badge').textContent = jdMode ? 'JD keyword match' : 'General ATS score (no JD)';
    $('matched-label').textContent = jdMode ? 'Matched keywords' : 'Skills detected';
    $('missing-label').textContent = jdMode ? 'Missing keywords' : 'Suggestions';
    $('matched-count').textContent = r.matched.length; $('missing-count').textContent = r.missing.length;
    tags($('matched-tags'), r.matched, 'tag-matched capitalize', 'None found');
    tags($('missing-tags'), r.missing, 'tag-missing', r.noKeywords ? 'No usable keywords found in this JD; no keyword points awarded.' : 'Nothing missing');
    Object.entries(r.checks).forEach(([k, ok]) => { const e = $('chk-' + k); e.textContent = ok ? '✓ Found' : '✗ Missing'; e.className = ok ? 'text-emerald-400' : 'text-rose-400'; });
  }

  // ---- tailor + preview ----
  const opts = () => ({ highlight: $('highlight-toggle').checked, jdOnly: $('jd-only-toggle').checked });
  const applyOrder = () => { if (tailored && template) tailored.sections = ResumeTemplates.orderSections(tailored.sections, template); };
  function render() {
    if (!tailored) return;
    $('resume-page').innerHTML = ATS.renderHTML(tailored.sections, tailored.keywords, opts());
    $('tailored-output').value = ATS.renderText(tailored.sections, tailored.keywords, opts());
  }
  function onTailor() {
    const resume = $('resume-text').value.trim();
    if (!resume) return showError('Upload or paste your resume first.');
    hideError();
    tailored = ATS.tailor(resume, $('jd-text').value.trim());
    applyOrder(); render();
    $('tailored-section').classList.remove('hidden');
    $('tailored-section').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  $('analyze-btn').addEventListener('click', onAnalyze);
  $('tailor-btn').addEventListener('click', onTailor);
  $('highlight-toggle').addEventListener('change', render);
  $('jd-only-toggle').addEventListener('change', render);

  // ---- export ----
  function flash(btn, msg) { const o = btn.textContent; btn.textContent = msg; setTimeout(() => (btn.textContent = o), 1500); }
  $('copy-btn').addEventListener('click', async (e) => {
    try { await navigator.clipboard.writeText($('tailored-output').value); flash(e.target, 'Copied!'); }
    catch { showError('Clipboard blocked by the browser. Use the .txt download instead.'); }
  });
  $('download-btn').addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([$('tailored-output').value], { type: 'text/plain' }));
    const a = document.createElement('a'); a.href = url; a.download = 'tailored-resume.txt'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  $('print-btn').addEventListener('click', () => {
    const t = document.title; document.title = '';
    window.addEventListener('afterprint', () => (document.title = t), { once: true });
    window.print();
  });

  // ---- templates (needs http://, fetch() does not work from file://) ----
  (async function () {
    if (!window.ResumeTemplates) return;
    try {
      const list = await ResumeTemplates.loadTemplates('./resume-templates');
      template = ResumeTemplates.getTemplate(list, 'modern-blue');
      const sel = ResumeTemplates.mountSelector($('template-picker'), list, (t) => {
        template = t; ResumeTemplates.applyTemplate($('resume-page'), t); applyOrder(); render();
      });
      sel.value = template.id; ResumeTemplates.applyTemplate($('resume-page'), template);
    } catch (e) { console.warn('Templates unavailable. Serve over http (npx serve .).', e); }
  })();
})();
