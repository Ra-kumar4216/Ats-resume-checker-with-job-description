/* global docx */
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
    if ($('cover-letter-result')) {$('cover-letter-result').classList.add('hidden');}
    if ($('cover-letter-output')) {$('cover-letter-output').value = '';}
    if ($('cover-letter-status')) {$('cover-letter-status').textContent = '';}
  }

  // ---- localStorage session persistence ----
  const SESSION_KEY = 'ats-tracker-session-v1';
  function saveSession() {
    try {
      const state = {
        resume: $('resume-text').value,
        jd: $('jd-text').value,
        mode: window.ATSStepper?.getMode?.() || 'jd',
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
      if (!raw) {return null;}
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
    if (!state) {return;}
    if (state.resume) {
      $('resume-text').value = state.resume;
      $('resume-text').dispatchEvent(new Event('input'));
    }
    if (state.jd) {
      $('jd-text').value = state.jd;
      $('jd-text').dispatchEvent(new Event('input'));
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
    if (el) {el.addEventListener('input', scheduleSave);}
  });
  // Also save on major actions
  ['analyze-btn', 'tailor-btn', 'cover-letter-btn', 'cover-letter-regenerate'].forEach(id => {
    const el = $(id);
    if (el) {el.addEventListener('click', saveSession);}
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

  async function readPdf(buf) {
    // Vendored pdf.js (classic script, sets window.pdfjsLib) - no CDN, works with the strict CSP.
    const pdfjsLib = await loadScript('assets/vendor/pdf.min.js', 'pdfjsLib');
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'assets/vendor/pdf.worker.min.js';
    const pdf = await pdfjsLib.getDocument({ data: buf, isEvalSupported: false }).promise; // CVE-2024-4367 mitigation
    if (pdf.numPages > MAX_PDF_PAGES) {
      pdf.destroy();
      throw new Error('Too many PDF pages');
    }
    // Two-column PDFs (LinkedIn): read every page's main column first, then the sidebars,
    // so a section that continues on page 2 is not cut in half by the sidebar.
    let text = '';
    let sidebars = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const content = await (await pdf.getPage(i)).getTextContent();
      const page = ATS.pageText(content.items);
      text += page.main + '\n';
      sidebars += page.side ? page.side + '\n' : '';
      if (text.length + sidebars.length > MAX_EXTRACTED_CHARS) {
        pdf.destroy();
        throw new Error('Extracted text is too large');
      }
    }
    pdf.destroy();
    text += sidebars;
    if (!text.trim()) {
      throw new Error('No extractable text');
    }
    return ATS.cleanExtractedText(text);
  }
  async function readDocx(buf) {
    const mammoth = await loadScript('assets/vendor/mammoth.browser.min.js', 'mammoth');
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
    const format = window.ResumeTemplates ? ResumeTemplates.renderOptions(template) : {};
    $('resume-page').innerHTML = ATS.renderHTML(tailored.sections, tailored.keywords, { ...opts(), ...format });
    $('tailored-output').value = ATS.renderText(tailored.sections, tailored.keywords, opts());
    fitResumeToScreen();
    schedulePageFitNote();
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
    if (!source || !page) {return;}
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
    if (resumeError) {return showError(resumeError);}
    hideError();
    const letter = ATS.generateCoverLetter(resume, jd);
    $('cover-letter-output').value = letter;
    if ($('cover-letter-result')) {$('cover-letter-result').classList.remove('hidden');}
    $('cover-letter-status').classList.remove('hidden');
    $('cover-letter-status').textContent = 'Generated automatically from your resume' + (jd ? ' and job description.' : '.');
    syncCoverLetterPrintPage();
    scheduleSave();
  }
  if ($('cover-letter-btn')) {$('cover-letter-btn').addEventListener('click', generateCoverLetterNow);}
  if ($('cover-letter-regenerate')) {$('cover-letter-regenerate').addEventListener('click', generateCoverLetterNow);}
  if ($('cover-letter-output')) {$('cover-letter-output').addEventListener('input', syncCoverLetterPrintPage);}
  if ($('cover-letter-copy')) {$('cover-letter-copy').addEventListener('click', async e => {
    try { await navigator.clipboard.writeText($('cover-letter-output').value); flash(e.target, 'Copied!'); }
    catch { showError('Clipboard blocked by the browser.'); }
  });}
  if ($('cover-letter-download')) {$('cover-letter-download').addEventListener('click', () => {
    const blob = new Blob([$('cover-letter-output').value], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'cover-letter.txt'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });}
  if ($('cover-letter-download-docx')) {$('cover-letter-download-docx').addEventListener('click', async () => {
    try {
      const docxLib = await loadDocx();
      if (!docxLib) {throw new Error('docx library failed to load');}
      const { Document, Packer, Paragraph, TextRun, AlignmentType } = docxLib;
      const lines = $('cover-letter-output').value.split('\n');
      const children = lines.map(line => new Paragraph({
        children: [new TextRun({ text: line, size: 24, font: 'Calibri' })],
        spacing: { line: 276, after: 60 },
        alignment: AlignmentType.LEFT,
      }));
      const doc = new Document({ sections: [{ properties: {}, children }] });
      const blob = await docxLib.Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'cover-letter.docx';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      flash($('cover-letter-download-docx'), 'Downloaded!');
    } catch (err) {
      console.error('Cover letter DOCX export failed:', err);
      showError('Failed to generate DOCX. Try printing to PDF instead.');
    }
  });}
  let coverPrintMarker = null;
  function printCoverLetter() {
    syncCoverLetterPrintPage();
    if (!$('cover-letter-output').value.trim()) {
      generateCoverLetterNow();
      syncCoverLetterPrintPage();
    }
    const page = $('cover-letter-print-page');
    if (!page) {return;}
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
  if ($('cover-letter-print')) {$('cover-letter-print').addEventListener('click', printCoverLetter);}
  if ($('step6-resume-pdf')) {$('step6-resume-pdf').addEventListener('click', () => $('print-btn').click());}

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
  // ---- DOCX export ----
  async function loadDocx() {
    return loadScript('assets/vendor/docx.umd.js', 'docx');
  }
  function buildDocxDocument(sections, template, fit = { zoom: 1, gap: 1 }) {
    const {
      Document, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType,
      HeadingLevel, AlignmentType, VerticalAlign, TabStopType,
    } = docx;
    const style = template?.style || {};
    const font = String(style.font || 'Calibri').split(',')[0].replace(/['"]/g, '').trim() || 'Calibri';
    const accent = style.accent || '#111111';
    // same fit as the printed PDF: text scale (zoom) and spacing (gap)
    const zoom = fit?.zoom || 1;
    const gap = fit?.gap || 1;
    const sp = n => Math.round(n * gap);
    const basePx = (style.basePx || 11.5) * zoom;
    const lineHeight = (style.lineHeight || 1.45) * (gap < 1 ? 0.9 : 1);
    const PAGE_MARGIN_V = 567; // 10 mm, like the printed page
    const PAGE_MARGIN_H = 680; // 12 mm
    const headingTransform = style.headingTransform || 'uppercase';
    const nameAlign = style.nameAlign || 'left';
    const layout = template?.layout || 'single';
    const wantIcons = template?.icons === true;
    const sidebarKeys = template?.sidebar?.length ? template.sidebar : ATS.SIDEBAR_KEYS;
    const body = sections.filter(sec => sec.key !== 'header');
    const twoCols =
      layout.startsWith('sidebar') &&
      body.some(sec => sidebarKeys.includes(sec.key)) &&
      body.some(sec => !sidebarKeys.includes(sec.key));

    const head = [];
    const mainList = [];
    const sideList = [];
    let target = head;
    const sidebarCell = () => twoCols && target === sideList;
    const addHeading = (text, level = HeadingLevel.HEADING_2) => {
      target.push(new Paragraph({
        children: [new TextRun({
          text: headingTransform === 'uppercase' ? text.toUpperCase() : text,
          font,
          bold: true,
          size: Math.round(basePx * 2 * 1.08),
          color: headingTransform === 'uppercase' && accent.toLowerCase() === '#111111' ? '111111' : accent.replace('#', ''),
        })],
        heading: level,
        // inside a table cell, "keep with next" makes Word / LibreOffice push the whole row to the next page
        ...(twoCols ? { keepNext: false, keepLines: false } : {}),
        alignment: AlignmentType.LEFT,
        spacing: { before: sp(200), after: sp(100) },
        border: { bottom: { color: accent.replace('#', ''), style: BorderStyle.SINGLE, size: 6 } },
      }));
    };
    const accentHex = accent.replace('#', '');
    const addParagraph = (text, options = {}) => {
      const sizeScale = options.sizeScale || 1;
      const runs = options.runs || [new TextRun({
        text,
        font,
        bold: options.bold,
        italics: options.italics,
        size: Math.round(basePx * 2 * (sidebarCell() ? 0.94 : 1) * sizeScale),
        color: options.color || '000000',
      })];
      target.push(new Paragraph({
        children: runs,
        spacing: { line: Math.round(lineHeight * 240), before: sp(40), after: sp(40), ...options.spacing },
        alignment: options.alignment,
        indent: options.indent,
        bullet: options.bullet,
        tabStops: options.tabStops,
        keepNext: options.keepNext,
      }));
    };
    // right edge of the text area, used for right-aligned dates (single column only)
    const rightTab = [{ type: TabStopType.RIGHT, position: 11906 - 2 * PAGE_MARGIN_H }];
    const iconRun = kind => {
      const bytes = window.ResumeIcons ? ResumeIcons.png(kind, template?.iconColor || accent) : null;
      return bytes ? [new ImageRun({ data: bytes, transformation: { width: 13, height: 13 } }), new TextRun({ text: '  ', font })] : [];
    };
    const align = nameAlign === 'center' ? AlignmentType.CENTER : AlignmentType.LEFT;

    sections.forEach(section => {
      if (section.key === 'header') {
        target = head;
        const lines = section.lines.map(l => l.trim()).filter(Boolean);
        if (!lines.length) {return;}
        const [name, ...rest] = lines;
        addParagraph(name, { alignment: align, bold: true, color: accentHex, sizeScale: 2.0, spacing: { before: sp(0), after: sp(60), line: 340 } });
        if (wantIcons && rest.length) {
          const items = ATS.contactItems(rest);
          const tagline = items.filter(i => !i.kind).map(i => i.text).join(' · ');
          if (tagline) {addParagraph(tagline, { alignment: align, spacing: { before: sp(0), after: sp(60) } });}
          const runs = [];
          items.filter(i => i.kind).forEach((item, i) => {
            if (i) {runs.push(new TextRun({ text: '      ', font }));}
            runs.push(...iconRun(item.kind), new TextRun({ text: item.text, font, size: Math.round(basePx * 2 * 0.92), color: '444444' }));
          });
          head.push(new Paragraph({ children: runs, alignment: align, spacing: { before: sp(0), after: sp(200) } }));
        } else if (rest.length) {
          addParagraph(rest.join(' · '), { alignment: align, spacing: { before: sp(0), after: sp(200), line: 240 } });
        }
        return;
      }
      target = twoCols && sidebarKeys.includes(section.key) ? sideList : mainList;
      const pretty = (section.title || '').replace(/[:\s]+$/, '').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
      const title = (section.key === 'other' && pretty) || ATS.TITLES[section.key] || pretty;
      addHeading(title);
      const lines = section.lines.map(l => l.trim()).filter(Boolean);
      if (section.key === 'skills') {
        lines.forEach(line => addParagraph(line));
      } else if (section.key === 'summary') {
        addParagraph(lines.join(' '));
      } else {
        const blocks = ATS.splitBlocks(section.lines);
        blocks.forEach(block => {
          block.header.map(h => h.trim()).filter(Boolean).forEach((header, headerIndex) => {
            const { title: blockTitle, date } = ATS.splitHeader(header);
            const sub = headerIndex > 0 && blockTitle && !/\b(?:19|20)\d{2}\b/.test(date);
            if (!blockTitle && date) {
              addParagraph(date, { italics: true, color: '555555', sizeScale: 0.95, alignment: sidebarCell() ? AlignmentType.LEFT : AlignmentType.LEFT, spacing: { before: sp(20), after: sp(40) } });
            } else if (sub) {
              addParagraph(date ? `${blockTitle}   ${date}` : blockTitle, { italics: true, color: '333333', sizeScale: 0.95, spacing: { before: sp(0), after: sp(40) } });
            } else if (date && !twoCols) {
              // title on the left, date flush right (one line, like the on-screen resume)
              addParagraph('', {
                runs: [
                  new TextRun({ text: blockTitle, font, bold: true, size: Math.round(basePx * 2 * 1.05), color: '000000' }),
                  new TextRun({ text: `\t${date}`, font, italics: true, size: Math.round(basePx * 2 * 0.95), color: '555555' }),
                ],
                tabStops: rightTab,
                keepNext: true,
                spacing: { before: sp(120), after: sp(20) },
              });
            } else {
              addParagraph(blockTitle, { bold: true, sizeScale: 1.05, keepNext: !twoCols, spacing: { before: sp(120), after: sp(20) } });
              if (date) {
                addParagraph(date, { italics: true, color: '555555', sizeScale: 0.95, spacing: { before: sp(0), after: sp(40) } });
              }
            }
          });
          block.bullets.map(ATS.stripBullets).filter(Boolean).forEach(bullet => {
            addParagraph(bullet, { bullet: { level: 0 }, indent: { left: 720, hanging: 360 }, spacing: { before: sp(20), after: sp(20), line: Math.round(lineHeight * 240) } });
          });
        });
      }
    });

    if (!twoCols) {
      return new Document({ sections: [{ properties: { page: { margin: { top: PAGE_MARGIN_V, bottom: PAGE_MARGIN_V, left: PAGE_MARGIN_H, right: PAGE_MARGIN_H } } }, children: [...head, ...mainList] }] });
    }

    // two-column templates: a borderless 2-cell table under the header, shaded sidebar cell
    const total = 11906 - PAGE_MARGIN_H * 2;
    const sideW = Math.round(total * 0.31);
    const mainW = total - sideW;
    const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
    const borders = { top: none, bottom: none, left: none, right: none };
    const cell = (children, width, fill) => new TableCell({
      children: children.length ? children : [new Paragraph('')],
      width: { size: width, type: WidthType.DXA },
      borders,
      verticalAlign: VerticalAlign.TOP,
      margins: { top: 80, bottom: 120, left: 160, right: 160 },
      shading: fill ? { type: ShadingType.CLEAR, fill, color: 'auto' } : undefined,
    });
    const sideCell = cell(sideList, sideW, 'F1F5F9');
    const mainCell = cell(mainList, mainW);
    const left = layout === 'sidebar-right';
    const table = new Table({
      width: { size: total, type: WidthType.DXA },
      columnWidths: left ? [mainW, sideW] : [sideW, mainW],
      borders: { ...borders, insideHorizontal: none, insideVertical: none },
      rows: [new TableRow({ children: left ? [mainCell, sideCell] : [sideCell, mainCell] })],
    });
    return new Document({
      sections: [{
        properties: { page: { margin: { top: PAGE_MARGIN_V, bottom: PAGE_MARGIN_V, left: PAGE_MARGIN_H, right: PAGE_MARGIN_H } } },
        children: [...head, table],
      }],
    });
  }
  async function exportDocx() {
    if (!confirmLossyExport()) {return;}
    if (!tailored || !template) {
      showError('Please generate a tailored resume first.');
      return;
    }
    try {
      const docxLib = await loadDocx();
      if (!docxLib) {throw new Error('docx library failed to load');}
      const fit = computeFit();
      const doc = buildDocxDocument(tailored.sections, template, fit && !fit.unmeasured ? fit : { zoom: 1, gap: 1 });
      const blob = await docxLib.Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'tailored-resume.docx';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      flash($('download-docx-btn'), 'Downloaded!');
    } catch (err) {
      console.error('DOCX export failed:', err);
      showError('Failed to generate DOCX. Try printing to PDF instead.');
    }
  }
  // Initialize DOCX button after DOM ready
  setTimeout(() => {
    const btn = $('download-docx-btn');
    if (btn) {btn.addEventListener('click', exportDocx);}
  }, 0);
  // ---- print page fit: 1 page whenever it can look good, otherwise 2 well-filled pages ----
  const MM = 96 / 25.4;
  const PAGE_W_MM = 210;
  const PAGE_H_MM = 297;
  const PAD_V_MM = 10;
  const PAD_H_MM = 12;
  const PAGE_TEXT_PX = (PAGE_H_MM - 2 * PAD_V_MM) * MM;

  function setFitVars(zoom, gap) {
    const page = $('resume-page');
    page.style.setProperty('--cv-fit', String(zoom));
    page.style.setProperty('--cv-gap', String(gap));
    page.style.setProperty('--cv-lh', gap < 1 ? '0.9' : '1');
  }
  function clearFitVars() {
    const page = $('resume-page');
    if (page) {
      ['--cv-fit', '--cv-gap', '--cv-lh'].forEach(name => page.style.removeProperty(name));
    }
  }

  // content height, in pages of text area, when the resume is laid out exactly like the printed A4 page
  function measureResumePages(zoom, gap) {
    const page = $('resume-page');
    const wrap = $('resume-page-scale');
    const keepPage = page.getAttribute('style');
    const keepWrap = wrap.getAttribute('style');
    setFitVars(zoom, gap);
    page.style.width = `${PAGE_W_MM}mm`;
    page.style.maxWidth = 'none';
    page.style.margin = '0';
    page.style.transform = 'none';
    page.style.borderRadius = '0';
    page.style.padding = `${PAD_V_MM / zoom}mm ${PAD_H_MM / zoom}mm`;
    wrap.style.cssText = `overflow:visible;height:auto;width:${PAGE_W_MM}mm`;
    const total = wrap.getBoundingClientRect().height - 2 * PAD_V_MM * MM;
    const columns = breakColumns(page, total);
    keepPage === null ? page.removeAttribute('style') : page.setAttribute('style', keepPage);
    keepWrap === null ? wrap.removeAttribute('style') : wrap.setAttribute('style', keepWrap);
    // the unbreakable pieces (entries, bullet lists, headings) decide where the real page breaks fall
    return Math.max(total / PAGE_TEXT_PX, ATS.simulatePageBreaks(columns, PAGE_TEXT_PX));
  }

  // Unbreakable ranges of each text column, in printed pixels (same rules as the @media print block in styles.css).
  function breakColumns(page, total) {
    const first = page.firstElementChild;
    const last = page.lastElementChild;
    if (!first || !last) {
      return [];
    }
    const top0 = first.getBoundingClientRect().top;
    const span = Math.max(1, last.getBoundingClientRect().bottom - top0);
    // rects may be reported zoomed or unzoomed: normalise them to the measured printed height
    const k = total / span;
    const rel = el => {
      const r = el.getBoundingClientRect();
      return { top: (r.top - top0) * k, bottom: (r.bottom - top0) * k };
    };
    const twoCols = page.querySelectorAll('.cv-cols > .cv-main, .cv-cols > .cv-side');
    const roots = twoCols.length ? [...twoCols] : [page];
    return roots.map(root => {
      const ranges = [];
      const sidebar = root.classList.contains('cv-side');
      root.querySelectorAll('.cv-block, ul.cv-bullets, .cv-block-header-row, .cv-section-title, .cv-section').forEach(el => {
        if (el.classList.contains('cv-section') && !sidebar) {
          return;
        }
        const r = rel(el);
        if (el.classList.contains('cv-section-title')) {
          // a heading is kept together with the first lines that follow it
          r.bottom = Math.min(r.bottom + 34 * k, el.nextElementSibling ? rel(el.nextElementSibling).bottom : r.bottom + 34 * k);
        }
        ranges.push(r);
      });
      return { bottom: Math.max(...ranges.map(r => r.bottom), rel(root).bottom), ranges };
    });
  }

  function computeFit() {
    const wrap = $('resume-page-scale');
    if (!tailored || !wrap || !$('resume-page').firstChild) {
      return null;
    }
    // the preview step can be hidden (PDF button on the last step): measure it off-screen
    let host = null;
    let marker = null;
    if (!wrap.offsetWidth) {
      host = document.createElement('div');
      host.style.cssText = `position:fixed;left:-10000px;top:0;visibility:hidden;width:${PAGE_W_MM}mm`;
      marker = document.createComment('fit-anchor');
      wrap.before(marker);
      host.appendChild(wrap);
      document.body.appendChild(host);
    }
    try {
      return ATS.choosePageFit(measureResumePages);
    } finally {
      if (host) {
        marker.replaceWith(wrap);
        host.remove();
      }
    }
  }

  function describeFit(fit) {
    if (!fit || fit.unmeasured) {
      return '';
    }
    if (fit.pages === 1) {
      const adjusted = fit.zoom < 0.995 || fit.gap < 1;
      return `Print layout: fits on 1 page${adjusted ? ` (spacing and text size adjusted automatically, ${Math.round(fit.zoom * 100)}%)` : ''}`;
    }
    return `Print layout: ${fit.pages} pages (last page ${Math.round(fit.fill * 100)}% full)`;
  }

  let fitNoteTimer = null;
  function updatePageFitNote() {
    const note = $('page-fit-note');
    if (note && tailored) {
      note.textContent = describeFit(computeFit());
    }
  }
  function schedulePageFitNote() {
    clearTimeout(fitNoteTimer);
    fitNoteTimer = setTimeout(updatePageFitNote, 80);
  }

  function applyPageFit() {
    if (document.body.classList.contains('print-cover-letter')) {
      return;
    }
    const fit = computeFit();
    if (fit && !fit.unmeasured) {
      setFitVars(fit.zoom, fit.gap);
    }
  }

  Object.assign(window.ATSApp, { measureResumePages, computeFit });

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
    clearFitVars();
    fitResumeToScreen();
  }
  window.addEventListener('beforeprint', () => {
    preparePrint();
    applyPageFit();
  });
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
    applyPageFit();
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
