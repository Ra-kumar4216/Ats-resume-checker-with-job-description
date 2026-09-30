/* Resume template selector. Template DATA lives entirely in the JSON files under
   resume-templates/templates/ — this file only lists their filenames and loads them
   with fetch(). To add or edit a template, add/edit a JSON file; no JS changes needed.

   fetch() of local files is blocked by the browser when index.html is opened directly
   via file:// (double-click). That's fine when deployed (Vercel serves over http/https),
   but for local testing run a tiny static server instead, e.g.:
     npx serve "Ats resume checker"
   If fetch is unavailable or a JSON file fails to load, we fall back to one built-in
   template so the app still works — just with fewer choices until you run it over http.

   Browser: window.ResumeTemplates. Node: require('./selector'). */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ResumeTemplates = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const ORDER = [
    "summary",
    "skills",
    "experience",
    "projects",
    "education",
    "certifications",
  ];

  // Filenames only — add a new template by dropping a JSON file in
  // resume-templates/templates/ and listing it here.
  const MANIFEST = [
    "classic.json",
    "modern-blue.json",
    "fresher-projects-first.json",
    "compact-one-page.json",
    "minimal-serif.json",
  ];

  const STYLE_KEYS = [
    "font", "accent", "basePx", "lineHeight",
    "headingTransform", "headingRule", "nameAlign", "bullet",
  ];
  const INLINE_TEMPLATES = [{"id":"classic","name":"Classic ATS","description":"Black-and-white, single column, safest for strict parsers.","bestFor":"Any ATS, campus placements","style":{"font":"Calibri, Arial, sans-serif","accent":"#111111","basePx":11.5,"lineHeight":1.45,"headingTransform":"uppercase","headingRule":"1.5px solid #1a1a1a","nameAlign":"left","bullet":"disc"},"sectionOrder":["summary","skills","experience","projects","education","certifications"]},{"id":"compact-one-page","name":"Compact One-Page","description":"Tighter type and spacing to fit one A4 page.","bestFor":"Content-heavy resumes that spill to page 2","style":{"font":"Arial, Helvetica, sans-serif","accent":"#111111","basePx":10.5,"lineHeight":1.3,"headingTransform":"uppercase","headingRule":"1px solid #1a1a1a","nameAlign":"left","bullet":"disc"},"sectionOrder":["summary","skills","experience","projects","education","certifications"]},{"id":"fresher-projects-first","name":"Fresher: Projects First","description":"Education and projects lead; experience follows.","bestFor":"Freshers with projects stronger than work history","style":{"font":"Calibri, Arial, sans-serif","accent":"#1d4ed8","basePx":11.5,"lineHeight":1.45,"headingTransform":"uppercase","headingRule":"1.5px solid #1a1a1a","nameAlign":"left","bullet":"disc"},"sectionOrder":["summary","education","skills","projects","experience","certifications"]},{"id":"minimal-serif","name":"Minimal Serif","description":"Centered name, serif body, thin grey heading rules.","bestFor":"Academic and conservative employers","style":{"font":"Georgia, 'Times New Roman', serif","accent":"#222222","basePx":11.5,"lineHeight":1.5,"headingTransform":"capitalize","headingRule":"1px solid #888888","nameAlign":"center","bullet":"circle"},"sectionOrder":["summary","skills","experience","projects","education","certifications"]},{"id":"modern-blue","name":"Modern Blue","description":"Blue name and section rules; same parser-safe structure.","bestFor":"Product and startup roles","style":{"font":"Calibri, Arial, sans-serif","accent":"#1d4ed8","basePx":11.5,"lineHeight":1.45,"headingTransform":"uppercase","headingRule":"1.5px solid #1d4ed8","nameAlign":"left","bullet":"disc"},"sectionOrder":["summary","skills","experience","projects","education","certifications"]}];

  // Used only if fetching the JSON files fails entirely (e.g. opened via file://).
  const FALLBACK_TEMPLATE = {
    id: "classic",
    name: "Classic ATS",
    description: "Black-and-white, single column, safest for strict parsers.",
    bestFor: "Any ATS, campus placements",
    style: {
      font: "Calibri, Arial, sans-serif",
      accent: "#111111",
      basePx: 11.5,
      lineHeight: 1.45,
      headingTransform: "uppercase",
      headingRule: "1.5px solid #1a1a1a",
      nameAlign: "left",
      bullet: "disc",
    },
    sectionOrder: ORDER,
  };

  // Resolve template JSON paths relative to THIS script's own location (not the page),
  // so the app keeps working even if resume-templates/ is ever moved or referenced from
  // a different page.
  function baseUrl() {
    const scripts = document.getElementsByTagName("script");
    for (let i = scripts.length - 1; i >= 0; i--) {
      const src = scripts[i].src;
      if (src && /resume-templates\/selector\.js(?:[?#]|$)/.test(src)) {
        return src.replace(/selector\.js.*$/, "templates/");
      }
    }
    return "resume-templates/templates/"; // fallback if src can't be resolved
  }

  function isValidTemplate(data) {
    return (
      data &&
      typeof data.id === "string" && data.id &&
      typeof data.name === "string" && data.name &&
      data.style && typeof data.style === "object" &&
      STYLE_KEYS.every((k) => k in data.style)
    );
  }

  async function fetchTemplate(url, filename) {
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) throw new Error(`${filename}: HTTP ${res.status}`);
    const data = await res.json();
    if (!isValidTemplate(data)) throw new Error(`${filename}: missing required fields`);
    if (!Array.isArray(data.sectionOrder) || !data.sectionOrder.length) {
      data.sectionOrder = ORDER;
    }
    return data;
  }

  async function loadTemplates() {
    return INLINE_TEMPLATES.map((template) => ({ ...template, sectionOrder: Array.isArray(template.sectionOrder) && template.sectionOrder.length ? template.sectionOrder : ORDER }));
  }
  function getTemplate(list, id) {
    return list.find((t) => t.id === id) || list[0];
  }

  // Header stays first; known sections follow template order; unknown keys keep their original order at the end.
  function orderSections(sections, tpl) {
    const rank = (k) =>
      k === "header"
        ? -1
        : tpl.sectionOrder.includes(k)
          ? tpl.sectionOrder.indexOf(k)
          : 99;
    return sections
      .map((s, i) => ({ s, i }))
      .sort((a, b) => rank(a.s.key) - rank(b.s.key) || a.i - b.i)
      .map((x) => x.s);
  }

  function applyTemplate(el, tpl) {
    const st = tpl.style,
      set = (k, v) => el.style.setProperty(k, v);
    set("--cv-font", st.font);
    set("--cv-accent", st.accent);
    set("--cv-base-px", st.basePx + "px");
    set("--cv-line-height", st.lineHeight);
    set("--cv-heading-transform", st.headingTransform);
    set("--cv-heading-rule", st.headingRule);
    set("--cv-name-align", st.nameAlign);
    set("--cv-bullet", st.bullet);
    el.dataset.template = tpl.id;
  }

  function mountSelector(container, list, onChange) {
    container.innerHTML = "";
    const label = document.createElement("label");
    label.htmlFor = "template-select";
    label.textContent = "Resume template ";
    const select = document.createElement("select");
    select.id = "template-select";
    list.forEach((t) =>
      select.add(new Option(`${t.name} — ${t.bestFor || ""}`, t.id)),
    );
    select.addEventListener("change", () =>
      onChange(getTemplate(list, select.value)),
    );
    label.appendChild(select);
    container.appendChild(label);
    return select;
  }

  return {
    MANIFEST,
    loadTemplates,
    getTemplate,
    orderSections,
    applyTemplate,
    mountSelector,
  };
});
