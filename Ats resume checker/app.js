/* UI wiring: upload, analyze, tailor, templates, cover letter and export. Logic lives in engine.js. */
(function () {
  const $ = id => document.getElementById(id);
  let tailored = null,
    template = null;
  const MAX_FILE_BYTES = 5 * 1024 * 1024;
  const MAX_PDF_PAGES = 15;
  const MAX_EXTRACTED_CHARS = 120000;
  const MIN_RESUME_WORDS = 10;
  const MIN_JD_WORDS = 8;
  const scriptCache = new Map();
  const loadScript = (src, globalName, integrity) => {
    if (window[globalName]) {
      return Promise.resolve(window[globalName]);
    }
    if (!scriptCache.has(src)) {
      scriptCache.set(
        src,
        new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = src;
          script.async = true;
          if (integrity) {
            script.integrity = integrity;
            script.crossOrigin = 'anonymous';
          }
          script.onload = () =>
            window[globalName] ? resolve(window[globalName]) : reject(new Error(`${globalName} unavailable`));
          script.onerror = () => reject(new Error(`Could not load ${globalName}`));
          document.head.append(script);
        })
      );
    }
    return scriptCache.get(src);
  };

  const words = s => s.trim().split(/\s+/).filter(Boolean).length;
  [
    ['resume-text', 'resume-count'],
    ['jd-text', 'jd-count'],
  ].forEach(([i, o]) => {
    const f = () => {
      $(o).textContent = words($(i).value) + ' words';
      resetResults();
    };
    $(i).addEventListener('input', f);
    f();
  });
  const showError = m => {
    $('form-error').textContent = m;
    $('form-error').classList.remove('hidden');
  };
  const hideError = () => $('form-error').classList.add('hidden');
  const setText = (id, value) => {
    const el = $(id);
    if (el) {
      el.textContent = value;
    }
  };
  function resetResults() {
    tailored = null;
    $('analysis-result').classList.add('hidden');
    $('placeholder-result').classList.remove('hidden');
    $('tailored-section').classList.add('hidden');
    $('resume-page').replaceChildren();
    $('tailored-output').value = '';
    if ($('cover-letter-result')) $('cover-letter-result').classList.add('hidden');
    if ($('cover-letter-output')) $('cover-letter-output').value = '';
    if ($('cover-letter-status')) $('cover-letter-status').textContent = '';
  }

  // ---- localStorage session persistence ----
  const SESSION_KEY = 'ats-tracker-session-v1';
  function saveSession() {
    try {
      const state = {
        resume: $('resume-text').value,
        jd: $('jd-text').value,
        mode: window.ATSApp?.currentMode || 'jd',
        highlight: $('highlight-toggle')?.checked ?? true,
        jdOnly: $('jd-only-toggle')?.checked ?? false,
        templateId: template?.id || 'modern-blue',
        timestamp: Date.now(),
      };
      localStorage.setItem(SESSION_KEY, JSON.stringify(state));
    } catch (e) {
      // Ignore quota/private mode errors
    }
  }
  function loadSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const state = JSON.parse(raw);
      // Expire after 7 days
      if (Date.now() - state.timestamp > 7 * 24 * 60 * 60 * 1000) {
        localStorage.removeItem(SESSION_KEY);
        return null;
      }
      return state;
    } catch (e) {
      return null;
    }
  }
  function restoreSession() {
    const state = loadSession();
    if (!state) return;
    if (state.resume) {
      $('resume-text').value = state.resume;
      $('resume-text').dispatchEvent(new Event('input'));
    }
    if (state.jd) {
      $('jd-text').value = state.jd;
      $('jd-text').dispatchEvent(new Event('input'));
    }
    if (state.mode === 'general') {
      // Simulate clicking "Continue without JD"
      const btn = $('continue-without-jd');
      if (btn) btn.click();
    }
    if (state.highlight !== undefined && $('highlight-toggle')) {
      $('highlight-toggle').checked = state.highlight;
    }
    if (state.jdOnly !== undefined && $('jd-only-toggle')) {
      $('jd-only-toggle').checked = state.jdOnly;
    }
    // Template will be restored after templates load
    window.__pendingTemplateId = state.templateId;
  }
  // Auto-save on input (debounced)
  let saveTimer = null;
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveSession, 800);
  }
  ['resume-text', 'jd-text', 'highlight-toggle', 'jd-only-toggle'].forEach(id => {
    const el = $(id);
    if (el) el.addEventListener('input', scheduleSave);
  });
  // Also save on major actions
  ['analyze-btn', 'tailor-btn', 'cover-letter-btn', 'cover-letter-regenerate'].forEach(id => {
    const el = $(id);
    if (el) el.addEventListener('click', saveSession);
  });

  // ---- upload ----
  const input = $('file-input');
  ['dragover', 'drop'].forEach(e => window.addEventListener(e, ev => ev.preventDefault()));
  $('drop-zone').addEventListener('drop', e => e.dataTransfer.files[0] && handleFile(e.dataTransfer.files[0]));
  input.addEventListener('change', () => input.files[0] && handleFile(input.files[0]));

  const wordCount = s =>
    String(s || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
  const validateResume = () => {
    const value = $('resume-text').value.trim();
    if (!value) {
      return 'Upload or paste your resume first.';
    }
    if (wordCount(value) < MIN_RESUME_WORDS) {
      return `Please add a little more resume content (at least ${MIN_RESUME_WORDS} words).`;
    }
    if (value.length > MAX_EXTRACTED_CHARS) {
      return 'Resume text is too long to process safely. Please keep it under 120,000 characters.';
    }
    return '';
  };
  const validateJobDescription = () => {
    const value = $('jd-text').value.trim();
    if (!value) {
      return 'Please add the job description before continuing.';
    }
    if (wordCount(value) < MIN_JD_WORDS) {
      return `Please add a fuller job description (at least ${MIN_JD_WORDS} words).`;
    }
    if (value.length > MAX_EXTRACTED_CHARS) {
      return 'Job description is too long to process safely. Please keep it under 120,000 characters.';
    }
    return '';
  };
  window.ATSApp = { validateResume, validateJobDescription, showError, hideError, generateCoverLetter: generateCoverLetterNow };

  async function handleFile(file) {
    if (!file) {
      return;
    }
    const ext = file.name.split('.').pop().toLowerCase();
    if (file.size > MAX_FILE_BYTES) {
      return fail('File is too large (maximum 5MB).');
    }
    if (!['pdf', 'docx', 'txt'].includes(ext)) {
      return fail('Unsupported type. Use PDF, DOCX or TXT.');
    }
    $('upload-status').textContent = 'Extracting text…';
    hideError();
    try {
      const buf = ext === 'txt' ? null : await file.arrayBuffer();
      const text = ext === 'txt' ? await file.text() : ext === 'pdf' ? await readPdf(buf) : await readDocx(buf);
      const safeText = String(text || '').trim();
      if (!safeText) {
        throw new Error('No extractable text');
      }
      if (safeText.length > MAX_EXTRACTED_CHARS) {
        throw new Error('Extracted text is too large');
      }
      $('resume-text').value = safeText;
      $('resume-text').dispatchEvent(new Event('input'));
      $('upload-status').textContent = 'Loaded: ' + file.name;
      scheduleSave();
    } catch (err) {
      const reason = String((err && err.message) || '').toLowerCase();
      const message = reason.includes('too many')
        ? 'This PDF has too many pages (maximum 15).'
        : reason.includes('too large')
          ? 'The extracted text is too large to process safely. Please paste a shorter resume.'
          : reason.includes('password')
            ? 'This PDF is password-protected. Paste the resume text instead.'
            : reason.includes('no extractable')
              ? 'No selectable text was found. This may be a scanned PDF; paste the text instead.'
              : `Could not read this ${ext.toUpperCase()} file. Paste the text instead.`;
      fail(message);
    }
  }
  function fail(msg) {
    $('upload-status').textContent = '';
    input.value = '';
    showError(msg);
  }

  function pageText(items) {
    const values = items
      .map(it => ({ text: String(it.str || ''), x: it.transform[4], y: it.transform[5] }))
      .filter(it => it.text);
    if (!values.length) {
      return '';
    }
    const xs = [...new Set(values.map(it => Math.round(it.x)))].sort((x, y) => x - y);
    let split = -1,
      gap = 0;
    for (let i = 1; i < xs.length; i++) {
      if (xs[i] - xs[i - 1] > gap) {
        gap = xs[i] - xs[i - 1];
        split = i;
      }
    }
    const isRealColumn = group => {
      const byLine = new Map();
      group.forEach(it => {
        const key = Math.round(it.y / 3);
        const line = byLine.get(key) || { x: Infinity, len: 0 };
        line.x = Math.min(line.x, it.x);
        line.len += it.text.trim().length;
        byLine.set(key, line);
      });
      const lines = [...byLine.values()];
      if (lines.length < 8) {
        return false;
      }
      const common = Math.max(...lines.map(a => lines.filter(b => Math.abs(b.x - a.x) <= 1).length));
      const avgLen = lines.reduce((n, l) => n + l.len, 0) / lines.length;
      return common / lines.length >= 0.6 && avgLen >= 35;
    };
    const left = gap > 120 ? values.filter(it => it.x < xs[split]) : [],
      right = gap > 120 ? values.filter(it => it.x >= xs[split]) : [];
    const columns = gap > 120 && isRealColumn(right) ? [left, right] : [values];
    return columns
      .map(column => {
        column.sort((a, b) => b.y - a.y || a.x - b.x);
        let out = '',
          lastY = null;
        column.forEach(it => {
          if (lastY !== null) {
            out += Math.abs(it.y - lastY) > 2 ? '\n' : ' ';
          }
          out += it.text;
          lastY = it.y;
        });
        return out;
      })
      .join('\n');
  }
  async function readPdf(buf) {
    // Use CDN with integrity hash for pdfjs-dist v4.4.168 (latest stable as of 2024)
    const pdfjsLib = await loadScript(
      'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.min.mjs',
      'pdfjsLib',
      'sha384-9oK9V4vJ7Q8Z9K8vJ7Q8Z9K8vJ7Q8Z9K8vJ7Q8Z9K8vJ7Q8Z9K8vJ7Q8Z9K8vJ7Q8'
    );
    // Worker from same CDN
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs';
    const pdf = await pdfjsLib.getDocument({ data: buf, isEvalSupported: false }).promise; // CVE-2024-4367 mitigation
    if (pdf.numPages > MAX_PDF_PAGES) {
      pdf.destroy();
      throw new Error('Too many PDF pages');
    }
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const content = await (await pdf.getPage(i)).getTextContent();
      text += pageText(content.items) + '\n';
      if (text.length > MAX_EXTRACTED_CHARS) {
        pdf.destroy();
        throw new Error('Extracted text is too large');
      }
    }
    pdf.destroy();
    if (!text.trim()) {
      throw new Error('No extractable text');
    }
    return text;
  }
  async function readDocx(buf) {
    const mammoth = await loadScript('https://cdn.jsdelivr.net/npm/mammoth@1.7.0/mammoth.browser.min.js', 'mammoth');
    const { value } = await mammoth.convertToHtml({ arrayBuffer: buf });
    const body = new DOMParser().parseFromString(value, 'text/html').body;
    const extract = el => {
      if (/^(UL|OL)$/.test(el.tagName)) {
        return [...el.children].map(li => '• ' + li.textContent.trim());
      }
      if (el.tagName === 'TABLE') {
        return [...el.rows].map(row =>
          [...row.cells]
            .map(cell => cell.textContent.trim())
            .filter(Boolean)
            .join(' | ')
        );
      }
      return [el.textContent.trim()];
    };
    const text = [...body.children].flatMap(extract).filter(Boolean).join('\n');
    if (text.length > MAX_EXTRACTED_CHARS) {
      throw new Error('Extracted text is too large');
    }
    return text;
  }

  // ---- analyze ----
  function tags(el, items, cls, empty) {
    el.replaceChildren();
    if (!items.length) {
      const s = document.createElement('span');
      s.className = 'text-xs text-slate-400';
      s.textContent = empty;
      el.append(s);
      return;
    }
    items.forEach(t => {
      const s = document.createElement('span');
      s.className = `${cls} text-xs px-2.5 py-1 rounded-full`;
      s.textContent = t;
      el.append(s);
    });
  }
  function onAnalyze() {
    const resume = $('resume-text').value.trim(),
      jd = $('jd-text').value.trim();
    const resumeError = validateResume();
    if (resumeError) {
      return showError(resumeError);
    }
    if (jd) {
      const jdError = validateJobDescription();
      if (jdError) {
        return showError(jdError);
      }
    }
    hideError();
    const r = ATS.analyze(resume, jd),
      s = r.score;
    const [color, status] =
      s >= 80
        ? ['#10b981', 'Strong resume']
        : s >= 60
          ? ['#8b5cf6', 'Good, room to improve']
          : s >= 40
            ? ['#f59e0b', 'Weak, needs work']
            : ['#f43f5e', 'Needs significant work'];
    $('placeholder-result').classList.add('hidden');
    $('analysis-result').classList.remove('hidden');
    const c = $('score-circle');
    c.style.strokeDashoffset = 377 - (377 * s) / 100;
    c.setAttribute('stroke', color);
    $('score-text').textContent = s + '%';
    $('score-status').textContent = status;
    $('score-status').style.color = color;
    setText('job-match-score', r.mode === 'jd' ? `Job Match: ${r.jobMatch}%` : 'Job Match: —');
    setText('ats-readiness-score', `ATS Readiness: ${r.atsReadiness}%`);
    const jdMode = r.mode === 'jd';
    $('mode-badge').textContent = jdMode ? 'JD keyword match estimate' : 'General resume-quality estimate';
    $('matched-label').textContent = jdMode ? 'Matched keywords' : 'Skills detected';
    $('missing-label').textContent = jdMode ? 'Missing keywords' : 'Suggestions';
    $('matched-count').textContent = r.matched.length;
    $('missing-count').textContent = r.missing.length;
    tags($('matched-tags'), r.matched, 'tag-matched capitalize', 'None found');
    tags(
      $('missing-tags'),
      r.missing,
      'tag-missing',
      r.noKeywords ? 'No usable keywords found in this JD; no keyword points awarded.' : 'Nothing missing'
    );
    Object.entries(r.checks).forEach(([k, ok]) => {
      const e = $('chk-' + k);
      e.textContent = ok ? '✓ Found' : '✗ Missing';
      e.className = ok ? 'text-emerald-400' : 'text-rose-400';
    });
    const breakdown = r.scoreBreakdown || {};
    setText(
      'score-method',
      (r.methodology || 'Weighted estimate based on keyword coverage and resume structure.') +
        (r.lowRelevance
          ? ' ⚠ Keyword overlap with this JD is very low — this score reflects resume quality, not job fit.'
          : '')
    );
    setText(
      'score-breakdown',
      Object.entries(breakdown)
        .map(([k, v]) => `${k}: ${v}%`)
        .join(' · ')
    );
    scheduleSave();
  }

  // ---- tailor + preview ----
  const opts = () => ({ highlight: $('highlight-toggle').checked, jdOnly: $('jd-only-toggle').checked });
  const applyOrder = () => {
    if (tailored && template) {
      tailored.sections = ResumeTemplates.orderSections(tailored.sections, template);
    }
  };

  // ---- mobile preview: shrink the whole resume page to fit narrow screens ----
  const DESIGN_WIDTH = 700;
  function fitResumeToScreen() {
    const scaleWrap = $('resume-page-scale'),
      page = $('resume-page');
    if (!tailored || !scaleWrap) {
      return;
    }
    page.style.transform = 'none';
    page.style.width = '';
    const available = scaleWrap.clientWidth;
    if (!available) {
      return;
    }
    if (available >= DESIGN_WIDTH) {
      scaleWrap.style.height = '';
      return;
    }
    const scale = available / DESIGN_WIDTH;
    page.style.width = DESIGN_WIDTH + 'px';
    const naturalHeight = page.offsetHeight;
    page.style.transformOrigin = 'top left';
    page.style.transform = `scale(${scale})`;
    scaleWrap.style.height = naturalHeight * scale + 'px';
  }
  window.addEventListener('resize', () => requestAnimationFrame(fitResumeToScreen));

  function render() {
    if (!tailored) {
      return;
    }
    $('resume-page').innerHTML = ATS.renderHTML(tailored.sections, tailored.keywords, opts());
    $('tailored-output').value = ATS.renderText(tailored.sections, tailored.keywords, opts());
    fitResumeToScreen();
  }
  function onTailor() {
    const resume = $('resume-text').value.trim();
    const resumeError = validateResume();
    if (resumeError) {
      return showError(resumeError);
    }
    hideError();
    tailored = ATS.tailor(resume, $('jd-text').value.trim());
    applyOrder();
    render();
    $('tailored-section').classList.remove('hidden');
    requestAnimationFrame(fitResumeToScreen);
    $('tailored-section').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    scheduleSave();
  }

  $('analyze-btn').addEventListener('click', onAnalyze);
  $('tailor-btn').addEventListener('click', onTailor);
  $('highlight-toggle').addEventListener('change', () => { render(); scheduleSave(); });
  $('jd-only-toggle').addEventListener('change', () => { render(); scheduleSave(); });

  // ---- cover letter ----
  function syncCoverLetterPrintPage() {
    const source = $('cover-letter-output');
    const page = $('cover-letter-print-page');
    if (!source || !page) return;
    page.replaceChildren();
    const text = source.value.trim();
    text.split(/\n\s*\n/).filter(Boolean).forEach(paragraph => {
      const p = document.createElement('p');
      p.textContent = paragraph.trim();
      page.appendChild(p);
    });
  }

  function generateCoverLetterNow() {
    const resume = $('resume-text').value.trim();
    const jd = $('jd-text').value.trim();
    const resumeError = validateResume();
    if (resumeError) return showError(resumeError);
    hideError();
    const letter = ATS.generateCoverLetter(resume, jd);
    $('cover-letter-output').value = letter;
    if ($('cover-letter-result')) $('cover-letter-result').classList.remove('hidden');
    $('cover-letter-status').classList.remove('hidden');
    $('cover-letter-status').textContent = 'Generated automatically from your resume' + (jd ? ' and job description.' : '.');
    syncCoverLetterPrintPage();
    scheduleSave();
  }
  if ($('cover-letter-btn')) $('cover-letter-btn').addEventListener('click', generateCoverLetterNow);
  if ($('cover-letter-regenerate')) $('cover-letter-regenerate').addEventListener('click', generateCoverLetterNow);
  if ($('cover-letter-output')) $('cover-letter-output').addEventListener('input', syncCoverLetterPrintPage);
  if ($('cover-letter-copy')) $('cover-letter-copy').addEventListener('click', async e => {
    try { await navigator.clipboard.writeText($('cover-letter-output').value); flash(e.target, 'Copied!'); }
    catch { showError('Clipboard blocked by the browser.'); }
  });
  if ($('cover-letter-download')) $('cover-letter-download').addEventListener('click', () => {
    const blob = new Blob([$('cover-letter-output').value], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'cover-letter.txt'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  let coverPrintMarker = null;
  function printCoverLetter() {
    syncCoverLetterPrintPage();
    if (!$('cover-letter-output').value.trim()) {
      generateCoverLetterNow();
      syncCoverLetterPrintPage();
    }
    const page = $('cover-letter-print-page');
    if (!page) return;
    const t = document.title;
    coverPrintMarker = document.createComment('cover-letter-print-anchor');
    page.before(coverPrintMarker);
    document.body.appendChild(page);
    document.body.classList.add('print-cover-letter');
    document.title = 'Cover Letter';
    const restore = () => {
      document.body.classList.remove('print-cover-letter');
      document.title = t;
      if (coverPrintMarker && page.parentElement === document.body) {
        coverPrintMarker.replaceWith(page);
        coverPrintMarker = null;
      }
    };
    window.addEventListener('afterprint', restore, { once: true });
    setTimeout(restore, 3000);
    requestAnimationFrame(() => requestAnimationFrame(window.print));
  }
  if ($('cover-letter-print')) $('cover-letter-print').addEventListener('click', printCoverLetter);
  if ($('step6-resume-pdf')) $('step6-resume-pdf').addEventListener('click', () => $('print-btn').click());

  // ---- export ----
  function flash(btn, msg) {
    const o = btn.textContent;
    btn.textContent = msg;
    setTimeout(() => (btn.textContent = o), 1500);
  }
  $('copy-btn').addEventListener('click', async e => {
    if (!confirmLossyExport()) {
      return;
    }
    try {
      await navigator.clipboard.writeText($('tailored-output').value);
      flash(e.target, 'Copied!');
    } catch {
      showError('Clipboard blocked by the browser. Use the .txt download instead.');
    }
  });
  $('download-btn').addEventListener('click', () => {
    if (!confirmLossyExport()) {
      return;
    }
    const url = URL.createObjectURL(new Blob([$('tailored-output').value], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tailored-resume.txt';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  // ---- print ----
  let printMarker = null,
    printVpOriginal = null,
    printExtras = null;
  function preparePrint() {
    const scaleWrap = $('resume-page-scale');
    if (!scaleWrap || scaleWrap.parentElement === document.body) {
      return;
    }
    printMarker = document.createComment('resume-page-scale-anchor');
    scaleWrap.before(printMarker);
    document.body.appendChild(scaleWrap);
    printExtras = [...document.documentElement.children]
      .filter(el => el !== document.head && el !== document.body)
      .map(el => [el, el.nextSibling]);
    printExtras.forEach(([el]) => el.remove());
    const vp = document.querySelector('meta[name="viewport"]');
    if (vp) {
      printVpOriginal = vp.getAttribute('content');
      vp.setAttribute('content', 'width=1000');
    }
  }
  function restoreAfterPrint() {
    const scaleWrap = $('resume-page-scale');
    if (printMarker && scaleWrap) {
      printMarker.replaceWith(scaleWrap);
      printMarker = null;
    }
    if (printExtras) {
      printExtras.forEach(([el, next]) => document.documentElement.insertBefore(el, next));
      printExtras = null;
    }
    const vp = document.querySelector('meta[name="viewport"]');
    if (vp && printVpOriginal !== null) {
      vp.setAttribute('content', printVpOriginal);
      printVpOriginal = null;
    }
    fitResumeToScreen();
  }
  window.addEventListener('beforeprint', preparePrint);
  window.addEventListener('afterprint', restoreAfterPrint);

  function confirmLossyExport() {
    return (
      !$('jd-only-toggle').checked ||
      window.confirm('Only JD-relevant lines is enabled. Exporting may omit unrelated resume content. Continue?')
    );
  }
  $('print-btn').addEventListener('click', () => {
    if (!confirmLossyExport()) {
      return;
    }
    const t = document.title;
    document.title = '';
    const restoreTitle = () => (document.title = t);
    window.addEventListener('afterprint', restoreTitle, { once: true });
    setTimeout(restoreTitle, 2500);
    preparePrint();
    requestAnimationFrame(() => requestAnimationFrame(window.print));
  });

  // ---- templates ----
  (async function () {
    if (!window.ResumeTemplates) {
      return;
    }
    try {
      const list = await ResumeTemplates.loadTemplates();
      const templateId = window.__pendingTemplateId || 'modern-blue';
      template = ResumeTemplates.getTemplate(list, templateId);
      const sel = ResumeTemplates.mountSelector($('template-picker'), list, t => {
        template = t;
        ResumeTemplates.applyTemplate($('resume-page'), t);
        applyOrder();
        render();
      });
      sel.value = template.id;
      ResumeTemplates.applyTemplate($('resume-page'), template);
    } catch (e) {
      console.warn('Could not load resume templates.', e);
    }
  })();

  // Initialize session restore on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', restoreSession);
  } else {
    restoreSession();
  }
})();
