/** Browser-only file parsing service. Depends on window.ATS and ATSExternalScript. */
(function (root) {
  const config = root.ATSConfig || { maxFileBytes: 5 * 1024 * 1024, maxPdfPages: 15, maxExtractedChars: 120000 };

  async function readPdf(buffer) {
    const pdfjsLib = await root.ATSExternalScript.load('assets/vendor/pdf.min.js', 'pdfjsLib');
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'assets/vendor/pdf.worker.min.js';
    const pdf = await pdfjsLib.getDocument({ data: buffer, isEvalSupported: false }).promise;
    try {
      if (pdf.numPages > config.maxPdfPages) throw new Error('Too many PDF pages');
      let text = ''; let sidebars = '';
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const content = await (await pdf.getPage(pageNumber)).getTextContent();
        const page = root.ATS.pageText(content.items);
        text += `${page.main}\n`; if (page.side) sidebars += `${page.side}\n`;
        if (text.length + sidebars.length > config.maxExtractedChars) throw new Error('Extracted text is too large');
      }
      const extracted = root.ATS.cleanExtractedText(`${text}${sidebars}`);
      if (!extracted.trim()) throw new Error('No extractable text');
      return extracted;
    } finally { pdf.destroy(); }
  }

  async function readDocx(buffer) {
    const mammoth = await root.ATSExternalScript.load('assets/vendor/mammoth.browser.min.js', 'mammoth');
    const { value } = await mammoth.convertToHtml({ arrayBuffer: buffer });
    const body = new DOMParser().parseFromString(value, 'text/html').body;
    const extract = element => {
      if (/^(UL|OL)$/.test(element.tagName)) return [...element.children].map(item => `• ${item.textContent.trim()}`);
      if (element.tagName === 'TABLE') return [...element.rows].map(row => [...row.cells].map(cell => cell.textContent.trim()).filter(Boolean).join(' | '));
      return [element.textContent.trim()];
    };
    const text = [...body.children].flatMap(extract).filter(Boolean).join('\n');
    if (text.length > config.maxExtractedChars) throw new Error('Extracted text is too large');
    return text;
  }

  async function extract(file) {
    if (!file) throw new Error('No file selected');
    if (file.size > config.maxFileBytes) throw new Error('File is too large');
    const extension = file.name.split('.').pop().toLowerCase();
    if (!['pdf', 'docx', 'txt'].includes(extension)) throw new Error('Unsupported file type');
    const buffer = extension === 'txt' ? null : await file.arrayBuffer();
    const text = extension === 'txt' ? await file.text() : extension === 'pdf' ? await readPdf(buffer) : await readDocx(buffer);
    const safeText = String(text || '').trim();
    if (!safeText) throw new Error('No extractable text');
    if (safeText.length > config.maxExtractedChars) throw new Error('Extracted text is too large');
    return { extension, text: safeText };
  }

  root.ATSFileParser = Object.freeze({ extract });
})(typeof self !== 'undefined' ? self : window);
