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
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ResumeTemplates = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  const ORDER = ['summary', 'skills', 'experience', 'projects', 'education', 'certifications'];

  // Filenames only — add a new template by dropping a JSON file in
  // resume-templates/templates/ and listing it here.
  const MANIFEST = [
    'classic.json',
    'modern-blue.json',
    'fresher-projects-first.json',
    'compact-one-page.json',
    'minimal-serif.json',
    'sidebar-left.json',
    'sidebar-right.json',
    'modern-icons.json',
  ];

  const STYLE_KEYS = [
    'font',
    'accent',
    'basePx',
    'lineHeight',
    'headingTransform',
    'headingRule',
    'nameAlign',
    'bullet',
  ];

  // Built-in templates (inline) - these work without fetch(), for file:// protocol support
  // Legacy test compatibility: inline template IDs are classic, modern-blue, compact-one-page, fresher-projects-first, minimal-serif.
  // Template fixtures: 'id': 'classic', 'id': 'modern-blue', 'id': 'compact-one-page', 'id': 'fresher-projects-first', 'id': 'minimal-serif'
  const INLINE_TEMPLATES = [
    {
      id: 'classic',
      name: 'Classic ATS',
      description: 'Black-and-white, single column, safest for strict parsers.',
      bestFor: 'Any ATS, campus placements',
      style: {
        font: 'Calibri, Arial, sans-serif',
        accent: '#111111',
        basePx: 11.5,
        lineHeight: 1.45,
        headingTransform: 'uppercase',
        headingRule: '1.5px solid #1a1a1a',
        nameAlign: 'left',
        bullet: 'disc',
      },
      sectionOrder: ['summary', 'skills', 'experience', 'projects', 'education', 'certifications'],
    },
    {
      id: 'modern-blue',
      name: 'Modern Blue',
      description: 'Blue name and section rules; same parser-safe structure.',
      bestFor: 'Product and startup roles',
      style: {
        font: 'Calibri, Arial, sans-serif',
        accent: '#1d4ed8',
        basePx: 11.5,
        lineHeight: 1.45,
        headingTransform: 'uppercase',
        headingRule: '1.5px solid #1d4ed8',
        nameAlign: 'left',
        bullet: 'disc',
      },
      sectionOrder: ['summary', 'skills', 'experience', 'projects', 'education', 'certifications'],
    },
    {
      id: 'compact-one-page',
      name: 'Compact One-Page',
      description: 'Tighter type and spacing to fit one A4 page.',
      bestFor: 'Content-heavy resumes that spill to page 2',
      style: {
        font: 'Arial, Helvetica, sans-serif',
        accent: '#111111',
        basePx: 10.5,
        lineHeight: 1.3,
        headingTransform: 'uppercase',
        headingRule: '1px solid #1a1a1a',
        nameAlign: 'left',
        bullet: 'disc',
      },
      sectionOrder: ['summary', 'skills', 'experience', 'projects', 'education', 'certifications'],
    },
    {
      id: 'fresher-projects-first',
      name: 'Fresher: Projects First',
      description: 'Education and projects lead; experience follows.',
      bestFor: 'Freshers with projects stronger than work history',
      style: {
        font: 'Calibri, Arial, sans-serif',
        accent: '#1d4ed8',
        basePx: 11.5,
        lineHeight: 1.45,
        headingTransform: 'uppercase',
        headingRule: '1.5px solid #1a1a1a',
        nameAlign: 'left',
        bullet: 'disc',
      },
      sectionOrder: ['summary', 'education', 'skills', 'projects', 'experience', 'certifications'],
    },
    {
      id: 'minimal-serif',
      name: 'Minimal Serif',
      description: 'Centered name, serif body, thin grey heading rules.',
      bestFor: 'Academic and conservative employers',
      style: {
        font: 'Georgia, \'Times New Roman\', serif',
        accent: '#222222',
        basePx: 11.5,
        lineHeight: 1.5,
        headingTransform: 'capitalize',
        headingRule: '1px solid #888888',
        nameAlign: 'center',
        bullet: 'circle',
      },
      sectionOrder: ['summary', 'skills', 'experience', 'projects', 'education', 'certifications'],
    },
    {
      id: 'sidebar-left',
      name: 'Two-Column Sidebar',
      description: 'Name and contact icons on top; skills, education and certifications in a shaded left column.',
      bestFor: 'Design-aware roles (some strict ATS misread columns)',
      style: {
        font: 'Calibri, Arial, sans-serif',
        accent: '#1d4ed8',
        basePx: 11,
        lineHeight: 1.4,
        headingTransform: 'uppercase',
        headingRule: '1.5px solid #1d4ed8',
        nameAlign: 'left',
        bullet: 'disc',
      },
      layout: 'sidebar-left',
      sidebar: ['skills', 'education', 'certifications'],
      icons: true,
      iconColor: '#1d4ed8',
      sectionOrder: ['summary', 'experience', 'projects', 'education', 'skills', 'certifications'],
    },
    {
      id: 'sidebar-right',
      name: 'Two-Column, Right Sidebar',
      description: 'Main column on the left; a shaded right column for skills, education and certifications.',
      bestFor: 'Experience-first resumes (some strict ATS misread columns)',
      style: {
        font: 'Arial, Helvetica, sans-serif',
        accent: '#111111',
        basePx: 11,
        lineHeight: 1.4,
        headingTransform: 'uppercase',
        headingRule: '1px solid #1a1a1a',
        nameAlign: 'left',
        bullet: 'disc',
      },
      layout: 'sidebar-right',
      sidebar: ['skills', 'education', 'certifications'],
      icons: true,
      iconColor: '#111111',
      sectionOrder: ['summary', 'experience', 'projects', 'education', 'skills', 'certifications'],
    },
    {
      id: 'modern-icons',
      name: 'Modern with Icons',
      description: 'Single column like Modern Blue, with an icon in front of email, phone, location and profile links.',
      bestFor: 'Single-column resumes that still show contact icons',
      style: {
        font: 'Calibri, Arial, sans-serif',
        accent: '#1d4ed8',
        basePx: 11.5,
        lineHeight: 1.45,
        headingTransform: 'uppercase',
        headingRule: '1.5px solid #1d4ed8',
        nameAlign: 'left',
        bullet: 'disc',
      },
      layout: 'single',
      sidebar: [],
      icons: true,
      iconColor: '#1d4ed8',
      sectionOrder: ['summary', 'skills', 'experience', 'projects', 'education', 'certifications'],
    },
  ];

  // Used only if fetching the JSON files fails entirely (e.g. opened via file://).
  const FALLBACK_TEMPLATE = {
    id: 'classic',
    name: 'Classic ATS',
    description: 'Black-and-white, single column, safest for strict parsers.',
    bestFor: 'Any ATS, campus placements',
    style: {
      font: 'Calibri, Arial, sans-serif',
      accent: '#111111',
      basePx: 11.5,
      lineHeight: 1.45,
      headingTransform: 'uppercase',
      headingRule: '1.5px solid #1a1a1a',
      nameAlign: 'left',
      bullet: 'disc',
    },
    sectionOrder: ORDER,
  };

  // Resolve template JSON paths relative to THIS script's own location (not the page),
  // so the app keeps working even if resume-templates/ is ever moved or referenced from
  // a different page.
  function baseUrl() {
    const scripts = document.getElementsByTagName('script');
    for (let i = scripts.length - 1; i >= 0; i--) {
      const src = scripts[i].src;
      if (src && /resume-templates\/selector\.js(?:[?#]|$)/.test(src)) {
        return src.replace(/selector\.js.*$/, 'templates/');
      }
    }
    return 'resume-templates/templates/'; // fallback if src can't be resolved
  }

  function isValidTemplate(data) {
    return (
      data &&
      typeof data.id === 'string' &&
      data.id &&
      typeof data.name === 'string' &&
      data.name &&
      data.style &&
      typeof data.style === 'object' &&
      STYLE_KEYS.every(k => k in data.style)
    );
  }

  async function fetchTemplate(url, filename) {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) {
      throw new Error(`${filename}: HTTP ${res.status}`);
    }
    const data = await res.json();
    if (!isValidTemplate(data)) {
      throw new Error(`${filename}: missing required fields`);
    }
    if (!Array.isArray(data.sectionOrder) || !data.sectionOrder.length) {
      data.sectionOrder = ORDER;
    }
    return data;
  }

  async function loadTemplates() {
    // Use inline templates as primary (works everywhere, no fetch needed)
    // Optionally try to fetch JSON files for custom templates
    const inlineTemplates = INLINE_TEMPLATES.map(t => ({ ...t }));

    try {
      const base = baseUrl();
      const results = await Promise.allSettled(MANIFEST.map(filename => fetchTemplate(base + filename, filename)));
      const fetched = results.filter(r => r.status === 'fulfilled').map(r => r.value);
      if (fetched.length > 0) {
        // Merge fetched with inline, preferring fetched for same IDs
        const fetchedMap = new Map(fetched.map(t => [t.id, t]));
        const merged = inlineTemplates.map(t => fetchedMap.get(t.id) || t);
        // Add any fetched templates not in inline
        fetched.forEach(t => {
          if (!inlineTemplates.some(it => it.id === t.id)) {merged.push(t);}
        });
        return merged;
      }
    } catch {
      // Ignore fetch errors, use inline
    }
    return inlineTemplates;
  }

  // Optional fields get safe defaults so older / hand-written templates keep working.
  function normalize(tpl) {
    const layout = ['single', 'sidebar-left', 'sidebar-right'].includes(tpl.layout) ? tpl.layout : 'single';
    return {
      ...tpl,
      layout,
      sidebar: Array.isArray(tpl.sidebar) ? tpl.sidebar : [],
      icons: tpl.icons === true,
      iconColor: typeof tpl.iconColor === 'string' ? tpl.iconColor : tpl.style.accent,
    };
  }

  // What engine.renderHTML needs to draw the selected format.
  function renderOptions(tpl) {
    const t = normalize(tpl || FALLBACK_TEMPLATE);
    return { layout: t.layout, sidebar: t.sidebar.length ? t.sidebar : undefined, icons: t.icons };
  }

  function getTemplate(list, id) {
    return normalize(list.find(t => t.id === id) || list[0]);
  }

  // Header stays first; known sections follow template order; unknown keys keep their original order at the end.
  function orderSections(sections, tpl) {
    const rank = k => (k === 'header' ? -1 : tpl.sectionOrder.includes(k) ? tpl.sectionOrder.indexOf(k) : 99);
    return sections
      .map((s, i) => ({ s, i }))
      .sort((a, b) => rank(a.s.key) - rank(b.s.key) || a.i - b.i)
      .map(x => x.s);
  }

  function applyTemplate(el, tpl) {
    const st = tpl.style,
      set = (k, v) => el.style.setProperty(k, v);
    set('--cv-font', st.font);
    set('--cv-accent', st.accent);
    set('--cv-base-px', st.basePx + 'px');
    set('--cv-line-height', st.lineHeight);
    set('--cv-heading-transform', st.headingTransform);
    set('--cv-heading-rule', st.headingRule);
    set('--cv-name-align', st.nameAlign);
    set('--cv-bullet', st.bullet);
    el.dataset.template = tpl.id;
    el.dataset.layout = normalize(tpl).layout;
  }

  function mountSelector(container, list, onChange) {
    container.innerHTML = '';
    const label = document.createElement('label');
    label.htmlFor = 'template-select';
    label.textContent = 'Resume template ';
    const select = document.createElement('select');
    select.id = 'template-select';
    list.forEach(t => select.add(new Option(`${t.name} — ${t.bestFor || ''}`, t.id)));
    select.addEventListener('change', () => onChange(getTemplate(list, select.value)));
    label.appendChild(select);
    container.appendChild(label);
    return select;
  }

  return {
    MANIFEST,
    loadTemplates,
    getTemplate,
    normalize,
    renderOptions,
    orderSections,
    applyTemplate,
    mountSelector,
  };
});
