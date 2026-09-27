/* UI wiring: upload, analyze, tailor, templates, export. Logic lives in engine.js. */
(function () {
  const $ = (id) => document.getElementById(id);
  let tailored = null, template = null;
  const MAX_FILE_BYTES = 5 * 1024 * 1024;
  const MAX_PDF_PAGES = 15;
  const MAX_EXTRACTED_CHARS = 120000;
  const MIN_RESUME_WORDS = 10;
  const MIN_JD_WORDS = 8;

  const words = (s) => s.trim().split(/\s+/).filter(Boolean).length;
  [['resume-text', 'resume-count'], ['jd-text', 'jd-count']].forEach(([i, o]) => {
    const f = () => ($(o).textContent = words($(i).value) + ' words');
    $(i).addEventListener('input', f); f();
  });
  const showError = (m) => { $('form-error').textContent = m; $('form-error').classList.remove('hidden'); };
  const hideError = () => $('form-error').classList.add('hidden');

  // ---- "coming soon" nav placeholders: href="#" would otherwise jump/scroll the page ----
  document.querySelectorAll('[title="Coming soon"]').forEach((el) => {
    el.addEventListener('click', (e) => e.preventDefault());
  });

  // ---- upload ----
  const input = $('file-input');
  ['dragover', 'drop'].forEach((e) => window.addEventListener(e, (ev) => ev.preventDefault()));
  $('drop-zone').addEventListener('drop', (e) => e.dataTransfer.files[0] && handleFile(e.dataTransfer.files[0]));
  input.addEventListener('change', () => input.files[0] && handleFile(input.files[0]));

  const wordCount = (s) => String(s || '').trim().split(/\s+/).filter(Boolean).length;
  const validateResume = () => {
    const value = $('resume-text').value.trim();
    if (!value) return 'Upload or paste your resume first.';
    if (wordCount(value) < MIN_RESUME_WORDS) return `Please add a little more resume content (at least ${MIN_RESUME_WORDS} words).`;
    if (value.length > MAX_EXTRACTED_CHARS) return 'Resume text is too long to process safely. Please keep it under 120,000 characters.';
    return '';
  };
  const validateJobDescription = () => {
    const value = $('jd-text').value.trim();
    if (!value) return 'Please add the job description before continuing.';
    if (wordCount(value) < MIN_JD_WORDS) return `Please add a fuller job description (at least ${MIN_JD_WORDS} words).`;
    if (value.length > MAX_EXTRACTED_CHARS) return 'Job description is too long to process safely. Please keep it under 120,000 characters.';
    return '';
  };
  window.ATSApp = { validateResume, validateJobDescription, showError, hideError };

  async function handleFile(file) {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (file.size > MAX_FILE_BYTES) return fail('File is too large (maximum 5MB).');
    if (!['pdf', 'docx', 'txt'].includes(ext)) return fail('Unsupported type. Use PDF, DOCX or TXT.');
    $('upload-status').textContent = 'Extracting text…'; hideError();
    try {
      const buf = ext === 'txt' ? null : await file.arrayBuffer();
      const text = ext === 'txt' ? await file.text() : ext === 'pdf' ? await readPdf(buf) : await readDocx(buf);
      const safeText = String(text || '').trim();
      if (!safeText) throw new Error('No extractable text');
      if (safeText.length > MAX_EXTRACTED_CHARS) throw new Error('Extracted text is too large');
      $('resume-text').value = safeText; $('resume-text').dispatchEvent(new Event('input'));
      $('upload-status').textContent = 'Loaded: ' + file.name;
    } catch (err) {
      console.error(err);
      fail(ext === 'pdf' ? 'Could not read this PDF (password-protected or scanned image?). Paste the text instead.' : 'Could not read this file. Paste the text instead.');
    }
  }
  function fail(msg) { $('upload-status').textContent = ''; input.value = ''; showError(msg); }

  async function readPdf(buf) {
    if (!window.pdfjsLib) throw new Error('PDF engine not loaded');
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'assets/vendor/pdf.worker.min.js';
    const pdf = await pdfjsLib.getDocument({ data: buf, isEvalSupported: false }).promise; // CVE-2024-4367 mitigation
    if (pdf.numPages > MAX_PDF_PAGES) { pdf.destroy(); throw new Error('Too many PDF pages'); }
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const content = await (await pdf.getPage(i)).getTextContent();
      let lastY = null;
      content.items.forEach((it) => { const y = it.transform[5]; if (lastY !== null) text += Math.abs(y - lastY) > 2 ? '\n' : ' '; text += it.str; lastY = y; });
      text += '\n';
      if (text.length > MAX_EXTRACTED_CHARS) { pdf.destroy(); throw new Error('Extracted text is too large'); }
    }
    pdf.destroy();
    if (!text.trim()) throw new Error('No extractable text');
    return text;
  }
  async function readDocx(buf) {
    if (!window.mammoth) throw new Error('DOCX engine not loaded');
    const { value } = await mammoth.convertToHtml({ arrayBuffer: buf });
    const body = new DOMParser().parseFromString(value, 'text/html').body; // inert parse, no innerHTML on live DOM
    const text = [...body.children].flatMap((el) => /^(UL|OL)$/.test(el.tagName)
      ? [...el.querySelectorAll(':scope > li')].map((li) => '• ' + li.textContent.trim())
      : [el.textContent.trim()]).filter(Boolean).join('\n');
    if (text.length > MAX_EXTRACTED_CHARS) throw new Error('Extracted text is too large');
    return text;
  }

  // ---- analyze ----
  function tags(el, items, cls, empty) {
    el.replaceChildren();
    if (!items.length) { const s = document.createElement('span'); s.className = 'text-xs text-slate-400'; s.textContent = empty; el.append(s); return; }
    items.forEach((t) => { const s = document.createElement('span'); s.className = `${cls} text-xs px-2.5 py-1 rounded-full`; s.textContent = t; el.append(s); });
  }
  function onAnalyze() {
    const resume = $('resume-text').value.trim(), jd = $('jd-text').value.trim();
    const resumeError = validateResume();
    if (resumeError) return showError(resumeError);
    if (jd) {
      const jdError = validateJobDescription();
      if (jdError) return showError(jdError);
    }
    hideError();
    const r = ATS.analyze(resume, jd), s = r.score;
    const [color, status] = s >= 80 ? ['#10b981', 'Strong resume'] : s >= 60 ? ['#8b5cf6', 'Good, room to improve'] : s >= 40 ? ['#f59e0b', 'Weak, needs work'] : ['#f43f5e', 'Needs significant work'];
    $('placeholder-result').classList.add('hidden'); $('analysis-result').classList.remove('hidden');
    const c = $('score-circle'); c.style.strokeDashoffset = 377 - (377 * s) / 100; c.setAttribute('stroke', color);
    $('score-text').textContent = s + '%'; $('score-status').textContent = status; $('score-status').style.color = color;
    const jdMode = r.mode === 'jd';
    $('mode-badge').textContent = jdMode ? 'JD keyword match estimate' : 'General resume-quality estimate';
    $('matched-label').textContent = jdMode ? 'Matched keywords' : 'Skills detected';
    $('missing-label').textContent = jdMode ? 'Missing keywords' : 'Suggestions';
    $('matched-count').textContent = r.matched.length; $('missing-count').textContent = r.missing.length;
    tags($('matched-tags'), r.matched, 'tag-matched capitalize', 'None found');
    tags($('missing-tags'), r.missing, 'tag-missing', r.noKeywords ? 'No usable keywords found in this JD; no keyword points awarded.' : 'Nothing missing');
    Object.entries(r.checks).forEach(([k, ok]) => { const e = $('chk-' + k); e.textContent = ok ? '✓ Found' : '✗ Missing'; e.className = ok ? 'text-emerald-400' : 'text-rose-400'; });
    const breakdown = r.scoreBreakdown || {};
    $('score-method').textContent = r.methodology || 'Weighted estimate based on keyword coverage and resume structure.';
    $('score-breakdown').textContent = Object.entries(breakdown).map(([k, v]) => `${k}: ${v}%`).join(' · ');
  }

  // ---- tailor + preview ----
  const opts = () => ({ highlight: $('highlight-toggle').checked, jdOnly: $('jd-only-toggle').checked });
  const applyOrder = () => { if (tailored && template) tailored.sections = ResumeTemplates.orderSections(tailored.sections, template); };

  // ---- mobile preview: shrink the whole resume page to fit narrow screens ----
  // The resume keeps its real desktop layout (fixed DESIGN_WIDTH, no text reflow) and is
  // visually scaled down with a CSS transform, like a zoomed-out full-page thumbnail.
  const DESIGN_WIDTH = 700; // matches #resume-page's max-width in styles.css
  function fitResumeToScreen() {
    const scaleWrap = $('resume-page-scale'), page = $('resume-page');
    if (!tailored || !scaleWrap) return;
    page.style.transform = 'none';
    page.style.width = '';
    const available = scaleWrap.clientWidth;
    if (!available) return; // section not visible yet (e.g. still hidden pre-tailor)
    if (available >= DESIGN_WIDTH) { scaleWrap.style.height = ''; return; } // fits at full size
    const scale = available / DESIGN_WIDTH;
    page.style.width = DESIGN_WIDTH + 'px';
    const naturalHeight = page.offsetHeight;
    page.style.transformOrigin = 'top left';
    page.style.transform = `scale(${scale})`;
    scaleWrap.style.height = (naturalHeight * scale) + 'px';
  }
  window.addEventListener('resize', () => requestAnimationFrame(fitResumeToScreen));

  function render() {
    if (!tailored) return;
    $('resume-page').innerHTML = ATS.renderHTML(tailored.sections, tailored.keywords, opts());
    $('tailored-output').value = ATS.renderText(tailored.sections, tailored.keywords, opts());
    fitResumeToScreen();
  }
  function onTailor() {
    const resume = $('resume-text').value.trim();
    const resumeError = validateResume();
    if (resumeError) return showError(resumeError);
    hideError();
    tailored = ATS.tailor(resume, $('jd-text').value.trim());
    applyOrder(); render();
    $('tailored-section').classList.remove('hidden');
    requestAnimationFrame(fitResumeToScreen); // section just became visible; refit now it has real width
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
  // ---- print ----
  // For printing, the resume is temporarily moved to be a direct child of <body>. This
  // keeps it in NORMAL document flow, so a multi-page resume paginates the same way any
  // ordinary page does. (It was previously kept in place and pulled out with
  // position:absolute, which does not fragment across printed pages reliably — that's
  // what caused page 2 to render the top of the resume compressed/overlapping.)
  // Hooked on beforeprint/afterprint (not just the button) so it also works if printing
  // is started from the browser's own menu.
  let printMarker = null, printVpOriginal = null, printExtras = null;
  function preparePrint() {
    const scaleWrap = $('resume-page-scale');
    if (!scaleWrap || scaleWrap.parentElement === document.body) return; // already prepared
    printMarker = document.createComment('resume-page-scale-anchor');
    scaleWrap.before(printMarker);
    document.body.appendChild(scaleWrap);
    // Some browser extensions / third-party embeds attach their own floating UI as a
    // sibling of <body> (a direct child of <html>), specifically to dodge the page's own
    // CSS and JS. Hiding body's children doesn't reach those, so remove them outright;
    // this is what was bleeding a floating widget icon into the printed PDF.
    printExtras = [...document.documentElement.children]
      .filter((el) => el !== document.head && el !== document.body)
      .map((el) => [el, el.nextSibling]);
    printExtras.forEach(([el]) => el.remove());
    const vp = document.querySelector('meta[name="viewport"]');
    if (vp) { printVpOriginal = vp.getAttribute('content'); vp.setAttribute('content', 'width=1000'); } // A4-ish width, not the phone's narrow screen width
  }
  function restoreAfterPrint() {
    const scaleWrap = $('resume-page-scale');
    if (printMarker && scaleWrap) { printMarker.replaceWith(scaleWrap); printMarker = null; }
    if (printExtras) { printExtras.forEach(([el, next]) => document.documentElement.insertBefore(el, next)); printExtras = null; }
    const vp = document.querySelector('meta[name="viewport"]');
    if (vp && printVpOriginal !== null) { vp.setAttribute('content', printVpOriginal); printVpOriginal = null; }
    fitResumeToScreen(); // recompute the on-screen mobile "fit to screen" scaling
  }
  window.addEventListener('beforeprint', preparePrint);
  window.addEventListener('afterprint', restoreAfterPrint);

  $('print-btn').addEventListener('click', () => {
    const t = document.title; document.title = '';
    const restoreTitle = () => (document.title = t);
    window.addEventListener('afterprint', restoreTitle, { once: true });
    setTimeout(restoreTitle, 2500); // fallback: some mobile browsers never fire afterprint
    preparePrint(); // run now too, in case this browser fires beforeprint too late
    requestAnimationFrame(() => requestAnimationFrame(window.print));
  });

  // ---- templates (embedded in resume-templates/selector.js, not fetched — see its header comment) ----
  (async function () {
    if (!window.ResumeTemplates) return;
    try {
      const list = await ResumeTemplates.loadTemplates();
      template = ResumeTemplates.getTemplate(list, 'modern-blue');
      const sel = ResumeTemplates.mountSelector($('template-picker'), list, (t) => {
        template = t; ResumeTemplates.applyTemplate($('resume-page'), t); applyOrder(); render();
      });
      sel.value = template.id; ResumeTemplates.applyTemplate($('resume-page'), template);
    } catch (e) { console.warn('Could not load resume templates.', e); }
  })();
})();
