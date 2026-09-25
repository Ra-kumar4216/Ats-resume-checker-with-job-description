body{font-family:"Plus Jakarta Sans",system-ui,sans-serif}
.field{width:100%;background:#020617;border:1px solid #334155;border-radius:8px;padding:12px;color:#e2e8f0;font-size:13px}
.field:focus{outline:2px solid #8b5cf6;border-color:transparent}
.tag-matched{background:rgba(16,185,129,.1);color:#34d399;border:1px solid rgba(16,185,129,.25)}
.tag-missing{background:rgba(244,63,94,.08);color:#fb7185;border:1px solid rgba(244,63,94,.2)}
#drop-zone:focus-within{outline:2px solid #a78bfa}
#template-picker select{background:#0f172a;border:1px solid #334155;color:#e2e8f0;border-radius:6px;padding:4px 8px;margin-left:6px;max-width:260px}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}

/* Resume preview. Template variables come from resume-templates/selector.js */
#resume-page{background:#fff;color:#1a1a1a;font-family:var(--cv-font,Calibri,Arial,sans-serif);line-height:var(--cv-line-height,1.45);max-width:700px;margin:0 auto;padding:36px 40px;border-radius:6px}
#resume-page .cv-name{font-size:24px;font-weight:700;color:var(--cv-accent,#1d4ed8);text-align:var(--cv-name-align,left);margin-bottom:3px}
#resume-page .cv-contact{font-size:11px;color:#555;text-align:var(--cv-name-align,left);margin-bottom:14px}
#resume-page .cv-section{margin-top:14px}
#resume-page .cv-section-title{font-size:12.5px;font-weight:700;letter-spacing:.7px;text-transform:var(--cv-heading-transform,uppercase);border-bottom:var(--cv-heading-rule,1.5px solid #1a1a1a);padding-bottom:2px;margin-bottom:6px}
#resume-page .cv-block-header-row{display:flex;justify-content:space-between;align-items:baseline;gap:12px;margin-top:8px}
#resume-page .cv-block-title{font-size:12.5px;font-weight:700}
#resume-page .cv-block-date{font-size:11px;font-style:italic;color:#555;white-space:nowrap}
#resume-page ul.cv-bullets{margin:2px 0 4px;padding-left:18px;list-style-type:var(--cv-bullet,disc)}
#resume-page li,#resume-page p{font-size:var(--cv-base-px,11.5px);margin:2px 0}
mark.kw-hit{background:#fef08a;color:#1a1a1a;padding:0 1px;border-radius:2px}
@media print{
  @page{size:A4;margin:0}
  html,body{background:#fff!important}
  body>header,body>footer,main>*:not(#tailored-section),#tailored-section>*:not(#resume-page){display:none!important}
  #resume-page{max-width:none;border-radius:0;padding:10mm 12mm}
  mark.kw-hit{background:none;padding:0}
}
