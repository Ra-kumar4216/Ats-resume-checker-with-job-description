/* Resume template selector. Templates are embedded here (not fetched), so this
   works even when index.html is opened directly by double-clicking it (file://)
   and fetch() to templates/*.json would otherwise be blocked by the browser.
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
  const TEMPLATES = [
    {
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
    },
    {
      id: "modern-blue",
      name: "Modern Blue",
      description: "Blue name and section rules; same parser-safe structure.",
      bestFor: "Product and startup roles",
      style: {
        font: "Calibri, Arial, sans-serif",
        accent: "#1d4ed8",
        basePx: 11.5,
        lineHeight: 1.45,
        headingTransform: "uppercase",
        headingRule: "1.5px solid #1d4ed8",
        nameAlign: "left",
        bullet: "disc",
      },
      sectionOrder: ORDER,
    },
    {
      id: "fresher-projects-first",
      name: "Fresher: Projects First",
      description: "Education and projects lead; experience follows.",
      bestFor: "Freshers with projects stronger than work history",
      style: {
        font: "Calibri, Arial, sans-serif",
        accent: "#1d4ed8",
        basePx: 11.5,
        lineHeight: 1.45,
        headingTransform: "uppercase",
        headingRule: "1.5px solid #1a1a1a",
        nameAlign: "left",
        bullet: "disc",
      },
      sectionOrder: [
        "summary",
        "education",
        "skills",
        "projects",
        "experience",
        "certifications",
      ],
    },
    {
      id: "compact-one-page",
      name: "Compact One-Page",
      description: "Tighter type and spacing to fit one A4 page.",
      bestFor: "Content-heavy resumes that spill to page 2",
      style: {
        font: "Arial, Helvetica, sans-serif",
        accent: "#111111",
        basePx: 10.5,
        lineHeight: 1.3,
        headingTransform: "uppercase",
        headingRule: "1px solid #1a1a1a",
        nameAlign: "left",
        bullet: "disc",
      },
      sectionOrder: ORDER,
    },
    {
      id: "minimal-serif",
      name: "Minimal Serif",
      description: "Centered name, serif body, no heading rules.",
      bestFor: "Academic and conservative employers",
      style: {
        font: "Georgia, 'Times New Roman', serif",
        accent: "#222222",
        basePx: 11.5,
        lineHeight: 1.5,
        headingTransform: "capitalize",
        headingRule: "0 none transparent",
        nameAlign: "center",
        bullet: "circle",
      },
      sectionOrder: ORDER,
    },
  ];
  const IDS = TEMPLATES.map((t) => t.id);

  // Kept async for API compatibility (and in case someone swaps this for a real
  // fetch later); resolves instantly since the data is already in memory.
  async function loadTemplates() {
    return TEMPLATES.map((t) => JSON.parse(JSON.stringify(t)));
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
      select.add(new Option(`${t.name} — ${t.bestFor}`, t.id)),
    );
    select.addEventListener("change", () =>
      onChange(getTemplate(list, select.value)),
    );
    label.appendChild(select);
    container.appendChild(label);
    return select;
  }

  return {
    IDS,
    TEMPLATES,
    loadTemplates,
    getTemplate,
    orderSections,
    applyTemplate,
    mountSelector,
  };
});
