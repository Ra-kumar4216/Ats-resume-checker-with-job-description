/* Pure resume logic (no DOM). Browser: window.ATS. Node: require('./engine'). */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.ATS = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  // ============================================================
  // KEYWORDS
  // ============================================================

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

    // Additional common data/AI skills
    "pandas",
    "numpy",
    "scikit-learn",
    "sklearn",
    "matplotlib",
    "seaborn",
    "tensorflow",
    "pytorch",
    "opencv",
    "power bi",
    "tableau",
  ];

  // ============================================================
  // STOP WORDS
  // ============================================================

  const STOP = new Set(
    `
    the and for with our you will are this that have from your job role
    team company years year experience strong ability work working skills
    skill knowledge required preferred plus including etc using use used
    such who what when where why how a an of in on to is as it be or we at
    by candidate candidates looking ideal must should can also other all any
    new about into over more than their they them responsibilities
    requirements qualifications
    `
      .trim()
      .split(/\s+/),
  );

  // ============================================================
  // GENERIC WORDS
  // ============================================================

  const GENERIC = new Set(
    `
    ai api rest boot cloud design test testing data work team software
    technology technologies development developer engineering engineer
    communication leadership management analytics candidate position role
    business solution solutions system systems application applications
    programming program technical technicalskills
    bachelor bachelors master masters degree graduate graduation
    education qualification qualifications
    `
      .trim()
      .split(/\s+/),
  );

  const REORDER = new Set(["experience", "projects", "skills"]);

  // ============================================================
  // HELPERS
  // ============================================================

  const norm = (s) =>
    String(s ?? "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

  const esc = (s) =>
    String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const escHtml = (s) =>
    String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const bounds = (k) => [
    /^[a-z0-9]/i.test(k) ? "\\b" : "(?<![a-z0-9])",
    /[a-z0-9]$/i.test(k) ? "\\b" : "(?![a-z0-9])",
  ];

  const cache = new Map();

  function pattern(kw) {
    const key = norm(kw);

    if (!cache.has(key)) {
      const [left, right] = bounds(key);

      cache.set(
        key,
        new RegExp(left + esc(key) + right, "i"),
      );
    }

    return cache.get(key);
  }

  // ============================================================
  // KEYWORD VALIDATION
  // ============================================================

  function isUsable(value) {
    const k = norm(value)
      .replace(/^[,;:.\-–—/]+|[,;:.\-–—/]+$/g, "")
      .trim();

    if (!k) return false;

    // Exact stop/generic words
    if (STOP.has(k)) return false;
    if (GENERIC.has(k)) return false;

    // Education words should not become ATS skills
    const educationWords = new Set([
      "bachelor",
      "bachelors",
      "master",
      "masters",
      "degree",
      "graduate",
      "graduation",
      "education",
      "qualification",
      "qualifications",
    ]);

    if (educationWords.has(k)) return false;

    // Very short values are normally noise
    const compact = k.replace(/[^a-z0-9+#.]/g, "");

    if (
      compact.length < 3 &&
      !/^(c\+\+|c#|r)$/.test(k)
    ) {
      return false;
    }

    const tokens = k.split(/\s+/);

    // Avoid very long natural-language phrases
    if (tokens.length > 3) return false;

    // Every token must be meaningful
    if (
      tokens.some(
        (token) =>
          token.length < 2 ||
          STOP.has(token) ||
          GENERIC.has(token),
      )
    ) {
      return false;
    }

    return true;
  }

  // ============================================================
  // SPLIT MULTIPLE SKILLS
  //
  // Examples:
  //
  // Pandas and NumPy
  // Python, Pandas, NumPy and SQL
  // React / Node.js / MongoDB
  // JavaScript & React
  // Python or Django
  // ============================================================

  function splitSkillPhrase(value) {
    if (!value) return [];

    let text = String(value)
      .replace(/\([^)]*\)/g, " ")
      .replace(/[–—]/g, "-")
      .trim();

    if (!text) return [];

    const parts = text
      .split(
        /\s*(?:,|\/|\||&|\band\b|\bor\b|\bplus\b|\bwith\b)\s*/gi,
      )
      .map((part) =>
        part
          .replace(
            /^(?:and|or|plus|also|including|such as)\s+/i,
            "",
          )
          .replace(
            /\s+(?:and|or|plus|also|including)\s*$/i,
            "",
          )
          .replace(
            /^[\s:;,.!?'"()[\]{}]+|[\s:;,.!?'"()[\]{}]+$/g,
            "",
          )
          .trim(),
      )
      .filter(Boolean);

    return parts;
  }

  // ============================================================
  // EXTRACT KEYWORDS
  // ============================================================

  function extractKeywords(jd) {
    const source = String(jd ?? "");

    if (!source.trim()) {
      return [];
    }

    const found = new Set();

    const add = (value) => {
      const k = norm(value);

      if (isUsable(k)) {
        found.add(k);
      }
    };

    // ----------------------------------------------------------
    // 1. Detect predefined technical keywords
    // ----------------------------------------------------------

    KEYWORDS.forEach((keyword) => {
      if (pattern(keyword).test(source)) {
        add(keyword);
      }
    });

    // ----------------------------------------------------------
    // 2. Multi-skill signal phrases
    //
    // IMPORTANT:
    // Old buggy code:
    //
    // add(m[1].split(...)[0]);
    //
    // That only kept the FIRST skill.
    //
    // New code extracts ALL skills.
    // ----------------------------------------------------------

    const signalRegex =
      /(?:experience\s+(?:with|in)|knowledge\s+(?:of|in)|proficien(?:t|cy)\s+(?:in|with)|familiarity\s+(?:with|in)|skilled?\s+(?:in|with)|expertise\s+(?:in|with)|hands[-\s]?on\s+(?:with|experience\s+in)|strong\s+(?:knowledge|experience|background)\s+(?:in|with))\s+([^.;:\n]{2,160})/gi;

    let match;

    while ((match = signalRegex.exec(source)) !== null) {
      const phrase = match[1]
        .replace(
          /\b(?:required|required\.|preferred|desired|bonus|plus|nice to have)\b/gi,
          " ",
        )
        .trim();

      const parts = splitSkillPhrase(phrase);

      parts.forEach((part) => {
        add(part);
      });
    }

    // ----------------------------------------------------------
    // 3. Explicit skill-list phrases
    //
    // Examples:
    // Skills: Python, Pandas, NumPy, SQL
    // Technologies: React, Node.js, MongoDB
    // ----------------------------------------------------------

    const listRegex =
      /(?:skills?|technologies?|technical\s+skills?|tools?|frameworks?|libraries?|proficiencies?)\s*:\s*([^\n]+)/gi;

    while ((match = listRegex.exec(source)) !== null) {
      const parts = splitSkillPhrase(match[1]);

      parts.forEach((part) => {
        add(part);
      });
    }

    // ----------------------------------------------------------
    // 4. Handle direct "X and Y" skill patterns
    //
    // Example:
    // "Pandas and NumPy are required"
    // ----------------------------------------------------------

    const andPairRegex =
      /\b([A-Za-z][A-Za-z0-9+#.\-]{1,30})\s+(?:and|or|\/|&)\s+([A-Za-z][A-Za-z0-9+#.\-]{1,30})\b/gi;

    while ((match = andPairRegex.exec(source)) !== null) {
      add(match[1]);
      add(match[2]);
    }

    // ----------------------------------------------------------
    // 5. Repeated capitalized technical terms
    // ----------------------------------------------------------

    const freq = {};

    const capitalizedWords =
      source.match(
        /\b[A-Z][A-Za-z0-9+#.\-]{2,}\b/g,
      ) || [];

    capitalizedWords.forEach((word) => {
      const k = norm(word);

      if (isUsable(k)) {
        freq[k] = (freq[k] || 0) + 1;
      }
    });

    Object.keys(freq).forEach((k) => {
      if (freq[k] >= 2) {
        add(k);
      }
    });

    // ----------------------------------------------------------
    // 6. Preserve predefined keyword order first
    // ----------------------------------------------------------

    const result = [...found];

    return result.slice(0, 40);
  }

  // ============================================================
  // BULLETS
  // ============================================================

  const BUL = "•·●◦∙▪‣⁃‧‥⁌⁍\uF0B7\uF0A7\uF076_*-";

  const BULLET_RE = new RegExp(
    `^\\s*[${BUL}](?=\\s|[${BUL}])\\s*`,
  );

  const LEAD_RE = new RegExp(
    `^\\s*(?:[${BUL}](?=\\s|[${BUL}])\\s*)+`,
  );

  const isBullet = (line) =>
    BULLET_RE.test(String(line ?? ""));

  const stripBullets = (line) =>
    String(line ?? "").replace(LEAD_RE, "").trim();

  const bulletize = (line) =>
    isBullet(line)
      ? "• " + stripBullets(line)
      : line;

  // ============================================================
  // CONTACT DETECTION
  // ============================================================

  const EMAIL_RE =
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

  const PHONE_RE =
    /(?<!\d)\d{5}[\s-]?\d{5}(?!\d)|\+\d[\d\s().-]{8,}\d/;

  const URL_RE =
    /\b[a-z0-9-]+\.(com|io|dev|app|net|org|in|co)\b|https?:\/\/|\b(?:linkedin|github)\b/i;

  const isContact = (line) =>
    EMAIL_RE.test(line) ||
    PHONE_RE.test(line) ||
    URL_RE.test(line);

  // ============================================================
  // RESUME SECTIONS
  // ============================================================

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

    [
      "projects",
      /^(?:(?:selected|personal|academic|key)\s+)?projects?$/i,
    ],

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
    const t = String(line ?? "").trim();

    if (!t || t.length > 80 || /[.!?]$/.test(t)) {
      return null;
    }

    const n = t
      .replace(/^[#*_\s]+|[#*_\s:]+$/g, "")
      .replace(/\s+/g, " ");

    if (!n || n.split(" ").length > 8) {
      return null;
    }

    const hit = SECTIONS.find(([, regex]) =>
      regex.test(n),
    );

    return hit ? hit[0] : null;
  }

  function parseSections(text) {
    const out = [
      {
        key: "header",
        title: null,
        lines: [],
      },
    ];

    String(text ?? "")
      .split("\n")
      .forEach((line) => {
        const key = detectSection(line);

        if (key) {
          out.push({
            key,
            title: line.trim(),
            lines: [],
          });
        } else {
          out[out.length - 1].lines.push(line);
        }
      });

    return out;
  }

  // ============================================================
  // PROJECT / EXPERIENCE BLOCK PARSING
  // ============================================================

  const HEADER_SIG =
    /\b(?:19|20)\d{2}\b|'\d{2}\b|\b\d{1,2}\/\d{2,4}\b|\((?:ongoing|present)\)|\||[–—]/i;

  const DETAIL_RE =
    /^\s*(github|live|link|url)\s*:/i;

  function splitBlocks(lines) {
    const blocks = [];
    let cur = null;

    lines.forEach((line) => {
      const t = String(line ?? "").trim();

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
        /[-–—]\s*$/.test(
          cur.header[cur.header.length - 1].trim(),
        );

      if (isHeader && wrapped) {
        cur.header.push(line);
      } else if (isHeader) {
        cur = {
          header: [line],
          bullets: [],
        };

        blocks.push(cur);
      } else if (!cur) {
        cur = {
          header: [],
          bullets: [line],
        };

        blocks.push(cur);
      } else {
        cur.bullets.push(line);
      }
    });

    return blocks;
  }

  // ============================================================
  // DATE PARSING
  // ============================================================

  const MON =
    "(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?";

  const DPH =
    `(?:${MON}\\s+)?(?:(?:19|20)\\d{2}|'\\d{2}|\\d{1,2}\\/\\d{2,4})`;

  const DATE_RE = new RegExp(
    `(${DPH}\\s*(?:–|—|-|to)\\s*(?:${DPH}|ongoing|present)|\\(\\s*(?:ongoing|present)\\s*\\)|${DPH}\\s*$)`,
    "i",
  );

  function splitHeader(line) {
    const t = String(line ?? "").trim();
    const match = t.match(DATE_RE);

    const clean = (value) =>
      value
        .split("|")
        .map((x) => x.trim())
        .filter(Boolean)
        .join(", ");

    if (!match) {
      return {
        title: clean(t),
        date: "",
      };
    }

    const tail = t
      .slice(match.index + match[0].length)
      .replace(/^[\s|]+|[\s|]+$/g, "");

    const date = match[0]
      .replace(/^\(|\)$/g, "")
      .trim();

    return {
      title: clean(t.slice(0, match.index)),
      date: tail ? `${date} · ${tail}` : date,
    };
  }

  // ============================================================
  // SCORING HELPERS
  // ============================================================

  const score = (line, keywords) =>
    keywords.reduce(
      (count, keyword) =>
        count + (pattern(keyword).test(line) ? 1 : 0),
      0,
    );

  const relevant = (lines, keywords) => {
    const matched = lines.filter(
      (line) => score(line, keywords) > 0,
    );

    return matched.length ? matched : lines;
  };

  const byScore = (lines, keywords) =>
    lines
      .map((line, index) => ({
        line,
        index,
        score: score(line, keywords),
      }))
      .sort(
        (a, b) =>
          b.score - a.score ||
          a.index - b.index,
      )
      .map((item) => item.line);

  // ============================================================
  // SKILLS LINE FILTERING
  // ============================================================

  function narrowSkills(line, keywords) {
    const content = stripBullets(line);

    const match = content.match(
      /^([^:]{2,30}):\s*(.+)$/,
    );

    const items = (match ? match[2] : content)
      .split(/,|\|/)
      .map((item) => item.trim())
      .filter(Boolean);

    if (items.length <= 1) {
      return content;
    }

    const kept = items.filter(
      (item) => score(item, keywords) > 0,
    );

    const finalItems =
      kept.length > 0 ? kept : items;

    return match
      ? `${match[1]}: ${finalItems.join(", ")}`
      : finalItems.join(", ");
  }

  // ============================================================
  // TAILOR RESUME
  // ============================================================

  function tailor(resumeText, jd) {
    const keywords = jd
      ? extractKeywords(jd)
      : [];

    const sections = parseSections(resumeText).map(
      (section) => {
        if (!REORDER.has(section.key)) {
          return section;
        }

        const lines =
          section.key === "skills"
            ? byScore(
                section.lines.filter(
                  (line) => line.trim(),
                ),
                keywords,
              )
            : splitBlocks(section.lines).flatMap(
                (block) => [
                  ...block.header,
                  ...byScore(
                    block.bullets,
                    keywords,
                  ),
                ],
              );

        return {
          ...section,
          lines,
        };
      },
    );

    return {
      sections,
      keywords,
    };
  }

  // ============================================================
  // HIGHLIGHT KEYWORDS
  // ============================================================

  function highlight(text, keywords) {
    if (!keywords.length) {
      return escHtml(text);
    }

    const alternatives = [...keywords]
      .sort((a, b) => b.length - a.length)
      .map((keyword) => {
        const [left, right] = bounds(keyword);

        return (
          left +
          esc(keyword) +
          right
        );
      })
      .join("|");

    const regex = new RegExp(
      alternatives,
      "gi",
    );

    let output = "";
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text))) {
      output +=
        escHtml(
          text.slice(
            lastIndex,
            match.index,
          ),
        ) +
        `<mark class="kw-hit">${escHtml(
          match[0],
        )}</mark>`;

      lastIndex =
        match.index + match[0].length;
    }

    return (
      output +
      escHtml(text.slice(lastIndex))
    );
  }

  // ============================================================
  // RENDER HTML
  // ============================================================

  function renderHTML(
    sections,
    keywords,
    {
      highlight: enableHighlight = true,
      jdOnly = true,
    } = {},
  ) {
    const H = (text) =>
      highlight(
        text,
        enableHighlight ? keywords : [],
      );

    let html = "";

    sections.forEach((section) => {
      const lines = section.lines
        .map((line) => line.trim())
        .filter(Boolean);

      // Header
      if (section.key === "header") {
        if (!lines.length) return;

        const [name, ...rest] = lines;

        const contacts = rest.filter(
          isContact,
        );

        const show =
          contacts.length > 0
            ? contacts
            : rest;

        html += `<div class="cv-name">${escHtml(
          name,
        )}</div>`;

        if (show.length) {
          html += `<div class="cv-contact">${escHtml(
            show.join(" · "),
          )}</div>`;
        }

        return;
      }

      const filtered =
        jdOnly &&
        keywords.length > 0 &&
        REORDER.has(section.key);

      html += `<div class="cv-section">`;

      html += `<div class="cv-section-title">${escHtml(
        TITLES[section.key] ||
          section.title ||
          "",
      )}</div>`;

      // Skills
      if (section.key === "skills") {
        (
          filtered
            ? relevant(lines, keywords)
            : lines
        ).forEach((line) => {
          html += `<p class="cv-skills-line">${H(
            filtered
              ? narrowSkills(
                  line,
                  keywords,
                )
              : stripBullets(line),
          )}</p>`;
        });
      }

      // Summary
      else if (section.key === "summary") {
        html += `<p class="cv-line">${H(
          lines.join(" "),
        )}</p>`;
      }

      // Experience / Projects / Other
      else {
        splitBlocks(section.lines).forEach(
          (block) => {
            block.header
              .map((header) =>
                header.trim(),
              )
              .filter(Boolean)
              .forEach((header) => {
                const {
                  title,
                  date,
                } = splitHeader(header);

                html +=
                  `<div class="cv-block-header-row">` +
                  `<span class="cv-block-title">${H(
                    title,
                  )}</span>` +
                  `${
                    date
                      ? `<span class="cv-block-date">${escHtml(
                          date,
                        )}</span>`
                      : ""
                  }` +
                  `</div>`;
              });

            const items = (
              filtered
                ? relevant(
                    block.bullets,
                    keywords,
                  )
                : block.bullets
            )
              .map(stripBullets)
              .filter(Boolean);

            if (items.length) {
              html +=
                `<ul class="cv-bullets">` +
                items
                  .map(
                    (item) =>
                      `<li>${H(
                        item,
                      )}</li>`,
                  )
                  .join("") +
                `</ul>`;
            }
          },
        );
      }

      html += "</div>";
    });

    return html;
  }

  // ============================================================
  // RENDER TEXT
  // ============================================================

  function renderText(
    sections,
    keywords,
    { jdOnly = true } = {},
  ) {
    const output = [];

    sections.forEach((section) => {
      if (section.title) {
        output.push(section.title);
      }

      const lines = section.lines.filter(
        (line) => line.trim(),
      );

      const filtered =
        jdOnly &&
        keywords.length > 0 &&
        REORDER.has(section.key);

      if (section.key === "skills") {
        output.push(
          ...(filtered
            ? relevant(
                lines,
                keywords,
              ).map((line) =>
                narrowSkills(
                  line,
                  keywords,
                ),
              )
            : lines.map(stripBullets)),
        );
      }

      else if (section.key === "summary") {
        output.push(
          lines
            .map((line) => line.trim())
            .join(" "),
        );
      }

      else if (
        !REORDER.has(section.key)
      ) {
        output.push(
          ...lines.map(bulletize),
        );
      }

      else {
        splitBlocks(
          section.lines,
        ).forEach((block) => {
          output.push(
            ...block.header,

            ...(
              filtered
                ? relevant(
                    block.bullets,
                    keywords,
                  )
                : block.bullets
            ).map(bulletize),
          );
        });
      }
    });

    return output
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  // ============================================================
  // ACTION VERBS
  // ============================================================

  const VERBS =
    /\b(managed|led|developed|created|improved|increased|reduced|achieved|designed|implemented|built|launched|coordinated|analyzed|delivered|streamlined|optimized|spearheaded|initiated|executed|drove|generated|negotiated|mentored|trained|automated|architected|orchestrated|resolved|established)\b/gi;

  // ============================================================
  // RESUME ANALYSIS
  // ============================================================

  function analyze(resume, jd) {
    const sections = parseSections(resume);

    const keys = new Set(
      sections.map(
        (section) => section.key,
      ),
    );

    const checks = {
      contact:
        EMAIL_RE.test(resume) ||
        PHONE_RE.test(resume),

      experience:
        keys.has("experience"),

      education:
        keys.has("education"),

      projects:
        keys.has("projects"),
    };

    const passed =
      Object.values(checks).filter(Boolean)
        .length;

    // ==========================================================
    // JD MODE
    // ==========================================================

    if (jd) {
      const keywords =
        extractKeywords(jd);

      const matched = keywords.filter(
        (keyword) =>
          pattern(keyword).test(resume),
      );

      const missing = keywords.filter(
        (keyword) =>
          !matched.includes(keyword),
      );

      return {
        mode: "jd",

        score: Math.round(
          (keywords.length
            ? (matched.length /
                keywords.length) *
              80
            : 0) +
            (passed / 4) * 20,
        ),

        matched,
        missing,
        checks,

        noKeywords:
          keywords.length === 0,
      };
    }

    // ==========================================================
    // GENERAL RESUME MODE
    // ==========================================================

    const words = resume
      .split(/\s+/)
      .filter(Boolean).length;

    const bullets = resume
      .split("\n")
      .filter(isBullet).length;

    const verbs =
      (resume.match(VERBS) || [])
        .length;

    const quant =
      (
        resume.match(
          /\d+(\.\d+)?\s?%|[$₹]\s?\d|\b\d+(\.\d+)?x\b/gi,
        ) || []
      ).length;

    const okLen =
      words >= 300 &&
      words <= 900;

    const tier = (ok, count) =>
      ok ? 15 : count > 0 ? 7 : 0;

    const tips = [];

    if (!checks.contact) {
      tips.push(
        "Add a clear email and phone number",
      );
    }

    if (!checks.experience) {
      tips.push(
        "Add a labeled Experience or Internship section",
      );
    }

    if (!checks.education) {
      tips.push(
        "Add a labeled Education section",
      );
    }

    if (!checks.projects) {
      tips.push(
        "Add a Projects section if relevant",
      );
    }

    if (!okLen) {
      tips.push(
        words < 300
          ? "Resume is short: aim for 300-900 words"
          : "Resume is long: aim for 300-900 words",
      );
    }

    if (bullets < 3) {
      tips.push(
        "Use bullet points instead of paragraphs",
      );
    }

    if (verbs < 3) {
      tips.push(
        "Start bullets with action verbs (built, led, improved)",
      );
    }

    if (quant < 2) {
      tips.push(
        "Add real numbers (%, users, time saved) where you know them",
      );
    }

    const total = Math.round(
      (passed / 4) * 40 +
        tier(
          okLen,
          words,
        ) +
        tier(
          bullets >= 3,
          bullets,
        ) +
        tier(
          verbs >= 3,
          verbs,
        ) +
        tier(
          quant >= 2,
          quant,
        ),
    );

    return {
      mode: "general",

      score: total,

      matched:
        KEYWORDS.filter(
          (keyword) =>
            pattern(keyword).test(
              resume,
            ),
        ),

      missing: tips,

      checks,
    };
  }

  // ============================================================
  // PUBLIC API
  // ============================================================

  return {
    KEYWORDS,

    extractKeywords,

    splitSkillPhrase,

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
