
/* Pure resume logic (no DOM). Browser: window.ATS. Node: require('./engine'). */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ATS = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const KEYWORDS = [
    "javascript",
    "react",
    "node",
    "express",
    "mongodb",
    "mysql",
    "java",
    "spring",
    "spring boot",
    "hibernate",
    "junit",
    "maven",
    "flask",
    "python",
    "django",
    "html",
    "css",
    "git",
    "github",
    "docker",
    "aws",
    "kubernetes",
    "typescript",
    "c++",
    "sql",
    "php",
    "laravel",
    "angular",
    "vue",
    "next.js",
    "nextjs",
    "scrum",
    "agile",
    "jira",
    "android",
    "ios",
    "swift",
    "kotlin",
    "devops",
    "ci/cd",
    "machine learning",
    "c#",
    ".net",
    "dotnet",
    "postgresql",
    "redis",
    "firebase",
    "graphql",
    "tailwind",
    "bootstrap",
    "jquery",
    "redux",
    "figma",
    "terraform",
    "azure",
    "gcp",
    "linux",
    "project management",
    "salesforce",
    "excel",
    "sql server",
    "nosql",
    "microservices",
    "html5",
    "css3",
    "sass",
    "webpack",
    "jenkins",
    "ansible",
  ];
  const STOP = new Set(
    "the and for with our you will are this that have from your job role team company years year experience strong ability work working skills skill knowledge required preferred plus including etc using use used such who what when where why how a an of in on to is as it be or we at by candidate candidates looking ideal must should can also other all any new about into over more than their they them responsibilities requirements qualifications".split(
      " ",
    ),
  );
  const GENERIC = new Set(
    "ai api rest boot cloud design test testing data work team software technology technologies development developer engineering engineer communication leadership management analytics".split(
      " ",
    ),
  );
  const REORDER = new Set(["experience", "projects", "skills"]);

  const norm = (s) => s.replace(/\s+/g, " ").trim().toLowerCase();
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escHtml = (s) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const bounds = (k) => [
    /^[a-z0-9]/i.test(k) ? "\\b" : "(?<![a-z0-9])",
    /[a-z0-9]$/i.test(k) ? "\\b" : "(?![a-z0-9])",
  ];
  const cache = new Map();
  function pattern(kw) {
    if (!cache.has(kw)) {
      const [l, r] = bounds(kw);
      cache.set(kw, new RegExp(l + esc(kw) + r, "i"));
    }
    return cache.get(kw);
  }

  function isUsable(v) {
    const k = norm(v).replace(/^[,;:.\-]+|[,;:.\-]+$/g, "");
    if (!k || STOP.has(k) || GENERIC.has(k)) return false;
    if (k.replace(/[^a-z0-9+#.]/g, "").length < 3 && !/^(c\+\+|c#|r)$/.test(k))
      return false;
    const t = k.split(" ");
    return (
      t.length <= 3 &&
      t.some((x) => !GENERIC.has(x)) &&
      t.every((x) => x.length >= 2 && !STOP.has(x))
    );
  }

  function extractKeywords(jd) {
    const found = new Set(),
      add = (v) => {
        const k = norm(v);
        if (isUsable(k)) found.add(k);
      };
    KEYWORDS.forEach((k) => pattern(k).test(jd) && add(k));
    const sig =
      /(?:experience (?:with|in)|knowledge of|proficien(?:t|cy)? (?:in|with)|familiarity with|skilled? (?:in|with)|expertise in|hands-on with)\s+([a-zA-Z0-9+#.\/\- ]{2,50})/gi;
    let m;
    while ((m = sig.exec(jd)))
      add(m[1].split(/,| and | or |\.|;|\bbut\b|\bplus\b/i)[0]);
    const freq = {};
    (jd.match(/\b[A-Z][a-zA-Z0-9+#.]{2,}\b/g) || []).forEach((w) => {
      const k = norm(w);
      if (isUsable(k)) freq[k] = (freq[k] || 0) + 1;
    });
    Object.keys(freq).forEach((k) => freq[k] >= 2 && add(k));
    return [...found].slice(0, 40);
  }

  // Bullets: includes U+F0B7/F0A7/F076, the private-use glyphs Word puts in exported PDFs.
  const BUL = "•·●◦∙▪‣⁃‧‥⁌⁍\uF0B7\uF0A7\uF076_*-";
  const BULLET_RE = new RegExp(`^\\s*[${BUL}](?=\\s|[${BUL}])\\s*`);
  const LEAD_RE = new RegExp(`^\\s*(?:[${BUL}](?=\\s|[${BUL}])\\s*)+`);
  const isBullet = (l) => BULLET_RE.test(l);
  const stripBullets = (l) => l.replace(LEAD_RE, "").trim();
  const bulletize = (l) => (isBullet(l) ? "• " + stripBullets(l) : l);

  const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  const PHONE_RE = /(?<!\d)\d{5}[\s-]?\d{5}(?!\d)|\+\d[\d\s().-]{8,}\d/; // not date ranges like 2024-2027
  const URL_RE =
    /\b[a-z0-9-]+\.(com|io|dev|app|net|org|in|co)\b|https?:\/\/|\b(?:linkedin|github)\b/i;
  const isContact = (l) =>
    EMAIL_RE.test(l) || PHONE_RE.test(l) || URL_RE.test(l);

  const SECTIONS = [
    [
      "summary",
      /^(?:(?:professional|career)\s+)?(?:summary|profile|objective|about me)$/i,
    ],
    [
      "skills",
      /^(?:(?:technical|core|key)\s+)?(?:skills|competenc(?:y|ies)|technologies)$/i,
    ],
    [
      "experience",
      /^(?:(?:(?:professional|relevant)\s+)?(?:work|internship|intern)(?:\s*(?:\/|&|and)\s*(?:work|internship|intern))?\s+experience|experience|employment\s+history|internships?|industrial\s+training)$/i,
    ],
    ["projects", /^(?:(?:selected|personal|academic|key)\s+)?projects?$/i],
    [
      "education",
      /^(?:(?:academic|qualifications?)\s+)?background$|^education(?:\s*(?:&|and)\s+(?:qualifications?|details?))?$/i,
    ],
    [
      "certifications",
      /^(?:professional\s+)?(?:certifications?|certificates?|licenses?)$/i,
    ],
    [
      "other",
      /^(?:achievements?|awards?|languages?|interests?|hobbies|extracurriculars?|volunteering)$/i,
    ],
  ];
  const TITLES = {
    summary: "Summary",
    skills: "Skills",
    experience: "Experience",
    projects: "Projects",
    education: "Education",
    certifications: "Certifications",
  };

  function detectSection(line) {
    const t = line.trim();
    if (!t || t.length > 80 || /[.!?]$/.test(t)) return null;
    const n = t.replace(/^[#*_\s]+|[#*_\s:]+$/g, "").replace(/\s+/g, " ");
    if (!n || n.split(" ").length > 8) return null;
    const hit = SECTIONS.find(([, re]) => re.test(n));
    return hit ? hit[0] : null;
  }
  function parseSections(text) {
    const out = [{ key: "header", title: null, lines: [] }];
    text.split("\n").forEach((line) => {
      const key = detectSection(line);
      if (key) out.push({ key, title: line.trim(), lines: [] });
      else out[out.length - 1].lines.push(line);
    });
    return out;
  }

  // "present"/"ongoing" alone no longer marks a header ("Present the results..."); a year, pipe, "(Ongoing)"
  // or an em/en dash does. Project headers like "TaskManagement3 — Agile Task Tracker Spring Boot, MySQL,
  // JWT" carry no date at all, only the "Name — description" em-dash pattern, so without this alternative
  // they never matched HEADER_SIG and got swallowed as a bullet of the previous block instead of their own
  // bold header row — the whole Projects section then rendered as one flat, unstructured bullet list.
  const HEADER_SIG =
    /\b(?:19|20)\d{2}\b|'\d{2}\b|\b\d{1,2}\/\d{2,4}\b|\((?:ongoing|present)\)|\||[–—]/i;
  const DETAIL_RE = /^\s*(github|live|link|url)\s*:/i;
  function splitBlocks(lines) {
    const blocks = [];
    let cur = null;
    lines.forEach((line) => {
      const t = line.trim();
      if (!t) return;
      const isHeader =
        !DETAIL_RE.test(t) &&
        !isBullet(t) &&
        t.length < 160 &&
        HEADER_SIG.test(t);
      const wrapped =
        cur &&
        !cur.bullets.length &&
        cur.header.length &&
        /[-–—]\s*$/.test(cur.header[cur.header.length - 1].trim());
      if (isHeader && wrapped) cur.header.push(line);
      else if (isHeader) {
        cur = { header: [line], bullets: [] };
        blocks.push(cur);
      } else if (!cur) {
        cur = { header: [], bullets: [line] };
        blocks.push(cur);
      } else cur.bullets.push(line);
    });
    return blocks;
  }

  const MON =
    "(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?";
  const DPH = `(?:${MON}\\s+)?(?:(?:19|20)\\d{2}|'\\d{2}|\\d{1,2}\\/\\d{2,4})`;
  const DATE_RE = new RegExp(
    `(${DPH}\\s*(?:–|—|-|to)\\s*(?:${DPH}|ongoing|present)|\\(\\s*(?:ongoing|present)\\s*\\)|${DPH}\\s*$)`,
    "i",
  );
  function splitHeader(line) {
    const t = line.trim(),
      m = t.match(DATE_RE);
    const clean = (s) =>
      s
        .split("|")
        .map((x) => x.trim())
        .filter(Boolean)
        .join(", ");
    if (!m) return { title: clean(t), date: "" };
    const tail = t.slice(m.index + m[0].length).replace(/^[\s|]+|[\s|]+$/g, "");
    const d = m[0].replace(/^\(|\)$/g, "").trim();
    return {
      title: clean(t.slice(0, m.index)),
      date: tail ? `${d} · ${tail}` : d,
    };
  }

  const score = (line, kws) =>
    kws.reduce((n, k) => n + (pattern(k).test(line) ? 1 : 0), 0);
  const relevant = (lines, kws) => {
    const k = lines.filter((l) => score(l, kws) > 0);
    return k.length ? k : lines;
  };
  const byScore = (lines, kws) =>
    lines
      .map((line, i) => ({ line, i, s: score(line, kws) }))
      .sort((a, b) => b.s - a.s || a.i - b.i)
      .map((x) => x.line);
  function narrowSkills(line, kws) {
    const c = stripBullets(line),
      m = c.match(/^([^:]{2,30}):\s*(.+)$/);
    const items = (m ? m[2] : c)
      .split(/,|\|/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (items.length <= 1) return c;
    const kept = items.filter((i) => score(i, kws) > 0),
      f = kept.length ? kept : items;
    return m ? `${m[1]}: ${f.join(", ")}` : f.join(", ");
  }

  function tailor(resumeText, jd) {
    const keywords = jd ? extractKeywords(jd) : [];
    const sections = parseSections(resumeText).map((sec) => {
      if (!REORDER.has(sec.key)) return sec;
      const lines =
        sec.key === "skills"
          ? byScore(
              sec.lines.filter((l) => l.trim()),
              keywords,
            )
          : splitBlocks(sec.lines).flatMap((b) => [
              ...b.header,
              ...byScore(b.bullets, keywords),
            ]);
      return { ...sec, lines };
    });
    return { sections, keywords };
  }

  // One combined regex pass: sequential replaces used to re-match text inside already-inserted <mark> tags.
  function highlight(text, kws) {
    if (!kws.length) return escHtml(text);
    const alt = [...kws]
      .sort((a, b) => b.length - a.length)
      .map((k) => {
        const [l, r] = bounds(k);
        return l + esc(k) + r;
      })
      .join("|");
    const re = new RegExp(alt, "gi");
    let out = "",
      last = 0,
      m;
    while ((m = re.exec(text))) {
      out +=
        escHtml(text.slice(last, m.index)) +
        `<mark class="kw-hit">${escHtml(m[0])}</mark>`;
      last = m.index + m[0].length;
    }
    return out + escHtml(text.slice(last));
  }

  function renderHTML(
    sections,
    kws,
    { highlight: hl = true, jdOnly = true } = {},
  ) {
    const H = (t) => highlight(t, hl ? kws : []);
    let html = "";
    sections.forEach((sec) => {
      const lines = sec.lines.map((l) => l.trim()).filter(Boolean);
      if (sec.key === "header") {
        if (!lines.length) return;
        const [name, ...rest] = lines,
          c = rest.filter(isContact),
          show = c.length ? c : rest;
        html += `<div class="cv-name">${escHtml(name)}</div>`;
        if (show.length)
          html += `<div class="cv-contact">${escHtml(show.join(" · "))}</div>`;
        return;
      }
      const filt = jdOnly && kws.length > 0 && REORDER.has(sec.key); // Education/Certs/Summary are never filtered
      html += `<div class="cv-section"><div class="cv-section-title">${escHtml(TITLES[sec.key] || sec.title || "")}</div>`;
      if (sec.key === "skills") {
        (filt ? relevant(lines, kws) : lines).forEach((l) => {
          html += `<p class="cv-skills-line">${H(filt ? narrowSkills(l, kws) : stripBullets(l))}</p>`;
        });
      } else if (sec.key === "summary") {
        html += `<p class="cv-line">${H(lines.join(" "))}</p>`;
      } else {
        splitBlocks(sec.lines).forEach((b) => {
          b.header
            .map((h) => h.trim())
            .filter(Boolean)
            .forEach((h) => {
              const { title, date } = splitHeader(h);
              html += `<div class="cv-block-header-row"><span class="cv-block-title">${H(title)}</span>${date ? `<span class="cv-block-date">${escHtml(date)}</span>` : ""}</div>`;
            });
          const items = (filt ? relevant(b.bullets, kws) : b.bullets)
            .map(stripBullets)
            .filter(Boolean);
          if (items.length)
            html += `<ul class="cv-bullets">${items.map((i) => `<li>${H(i)}</li>`).join("")}</ul>`;
        });
      }
      html += "</div>";
    });
    return html;
  }

  function renderText(sections, kws, { jdOnly = true } = {}) {
    const out = [];
    sections.forEach((sec) => {
      if (sec.title) out.push(sec.title);
      const lines = sec.lines.filter((l) => l.trim());
      const filt = jdOnly && kws.length > 0 && REORDER.has(sec.key);
      if (sec.key === "skills")
        out.push(
          ...(filt
            ? relevant(lines, kws).map((l) => narrowSkills(l, kws))
            : lines.map(stripBullets)),
        );
      else if (sec.key === "summary")
        out.push(lines.map((l) => l.trim()).join(" "));
      else if (!REORDER.has(sec.key)) out.push(...lines.map(bulletize));
      else
        splitBlocks(sec.lines).forEach((b) => {
          out.push(
            ...b.header,
            ...(filt ? relevant(b.bullets, kws) : b.bullets).map(bulletize),
          );
        });
    });
    return out
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  const VERBS =
    /\b(managed|led|developed|created|improved|increased|reduced|achieved|designed|implemented|built|launched|coordinated|analyzed|delivered|streamlined|optimized|spearheaded|initiated|executed|drove|generated|negotiated|mentored|trained|automated|architected|orchestrated|resolved|established)\b/gi;
  function analyze(resume, jd) {
    const keys = new Set(parseSections(resume).map((s) => s.key));
    const checks = {
      contact: EMAIL_RE.test(resume) || PHONE_RE.test(resume),
      experience: keys.has("experience"),
      education: keys.has("education"),
      projects: keys.has("projects"),
    };
    const passed = Object.values(checks).filter(Boolean).length;
    if (jd) {
      const kws = extractKeywords(jd),
        matched = kws.filter((k) => pattern(k).test(resume));
      const missing = kws.filter((k) => !matched.includes(k));
      return {
        mode: "jd",
        score: Math.round(
          (kws.length ? (matched.length / kws.length) * 80 : 0) +
            (passed / 4) * 20,
        ),
        matched,
        missing,
        checks,
        noKeywords: !kws.length,
      };
    }
    const words = resume.split(/\s+/).filter(Boolean).length,
      bullets = resume.split("\n").filter(isBullet).length;
    const verbs = (resume.match(VERBS) || []).length,
      quant = (
        resume.match(/\d+(\.\d+)?\s?%|[$₹]\s?\d|\b\d+(\.\d+)?x\b/gi) || []
      ).length;
    const okLen = words >= 300 && words <= 900,
      tier = (ok, n) => (ok ? 15 : n > 0 ? 7 : 0);
    const tips = [];
    if (!checks.contact) tips.push("Add a clear email and phone number");
    if (!checks.experience)
      tips.push("Add a labeled Experience or Internship section");
    if (!checks.education) tips.push("Add a labeled Education section");
    if (!checks.projects) tips.push("Add a Projects section if relevant");
    if (!okLen)
      tips.push(
        words < 300
          ? "Resume is short: aim for 300-900 words"
          : "Resume is long: aim for 300-900 words",
      );
    if (bullets < 3) tips.push("Use bullet points instead of paragraphs");
    if (verbs < 3)
      tips.push("Start bullets with action verbs (built, led, improved)");
    if (quant < 2)
      tips.push("Add real numbers (%, users, time saved) where you know them");
    const total = Math.round(
      (passed / 4) * 40 +
        tier(okLen, words) +
        tier(bullets >= 3, bullets) +
        tier(verbs >= 3, verbs) +
        tier(quant >= 2, quant),
    );
    return {
      mode: "general",
      score: total,
      matched: KEYWORDS.filter((k) => pattern(k).test(resume)),
      missing: tips,
      checks,
    };
  }

  return {
    KEYWORDS,
    extractKeywords,
    parseSections,
    splitBlocks,
    splitHeader,
    tailor,
    analyze,
    renderHTML,
    renderText,
    stripBullets,
    isBullet,
    PHONE_RE,
  };
});
