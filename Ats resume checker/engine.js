/* Pure resume logic (no DOM). Browser: window.ATS. Node: require('./engine'). */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(typeof globalThis !== "undefined" ? globalThis : this);
  } else {
    root.ATS = factory(root);
  }
})(typeof self !== "undefined" ? self : this, function (root) {
  // ============================================================
  // KEYWORDS
  // ============================================================

  const KEYWORDS = typeof require === "function" ? require("./skills-data.js") : (root.ATS_SKILLS || []);

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
    boot cloud design test testing data work team software
    technology technologies development developer engineering engineer
    communication leadership management analytics candidate position role
    business solution solutions system systems application applications
    programming program technical technicalskills
    bachelor bachelors master masters degree graduate graduation
    education qualification qualifications
    methodology methodologies concept concepts fundamentals fundamental
    principle principles
    `
      .trim()
      .split(/\s+/),
  );

  const REORDER = new Set(["experience", "projects", "skills"]);

  // Treat common spelling variants as one skill so the same requirement is
  // never counted twice (for example, Node, Node.js and NodeJS).
  const CANONICAL = new Map([
    ["node", "node.js"], ["nodejs", "node.js"],
    ["nextjs", "next.js"], ["sklearn", "scikit-learn"],
    ["dotnet", ".net"], ["html5", "html"], ["css3", "css"],
    // "ai"/"ml" are routed through their long canonical form because a bare
    // 2-character token fails the 3-char minimum in isUsable() below (same
    // reason node/nodejs redirect to "node.js" instead of staying bare).
    ["ai", "artificial intelligence"],
    ["ml", "machine learning"],
    ["llms", "llm"],
    ["huggingface", "hugging face"],
    ["genai", "generative ai"],
    ["gen ai", "generative ai"],
    ["apis", "api"],
    ["rest apis", "rest api"],
    ["restful api", "rest api"],
    ["restful apis", "rest api"],
  ]);
  const VARIANTS = new Map([
    ["node.js", ["node", "nodejs"]],
    ["next.js", ["nextjs"]],
    ["scikit-learn", ["sklearn"]],
    [".net", ["dotnet"]],
    ["html", ["html5"]],
    ["css", ["css3"]],
    ["artificial intelligence", ["ai"]],
    ["machine learning", ["ml"]],
    ["llm", ["llms", "large language model", "large language models"]],
    ["nlp", ["natural language processing"]],
    ["rag", ["retrieval augmented generation", "retrieval-augmented generation"]],
    ["hugging face", ["huggingface"]],
    ["generative ai", ["genai", "gen ai"]],
    ["vector database", ["vector db", "vector databases"]],
    ["rest api", ["rest apis", "restful api", "restful apis"]],
  ]);

  // ============================================================
  // HELPERS
  // ============================================================

  const norm = (s) =>
    String(s ?? "")
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

  const canonicalize = (s) => CANONICAL.get(norm(s)) || norm(s);

  const esc = (s) =>
    String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const escHtml = (s) =>
    String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const bounds = (k) => [
    /^[a-z0-9]/i.test(k) ? "\\b" : "(^|[^a-z0-9])",
    /[a-z0-9]$/i.test(k) ? "\\b" : "(?![a-z0-9])",
  ];

  const cache = new Map();

  function pattern(kw) {
    const key = canonicalize(kw);

    if (!cache.has(key)) {
      const variants = [key, ...(VARIANTS.get(key) || []), ...KEYWORDS.filter((candidate) => canonicalize(candidate) === key && norm(candidate) !== key)]
        .map(norm).filter((value, index, all) => all.indexOf(value) === index);
      const alternatives = variants.map((variant) => {
        const [left, right] = bounds(variant);
        return left + esc(variant) + right;
      }).join("|");
      cache.set(
        key,
        new RegExp(`(?:${alternatives})`, "i"),
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

    // A term that is explicitly whitelisted in the KEYWORDS dictionary is
    // always usable, even when one of its individual words would normally
    // be filtered as generic/stop noise on its own. Without this, "spring
    // boot" was silently unextractable (its own token "boot" is in
    // GENERIC), and the same would have quietly broken "prompt
    // engineering" ("engineering" is in GENERIC) the moment it was added.
    const isDictionaryTerm = KEYWORDS.some(
      (entry) => norm(entry) === k,
    );

    if (!isDictionaryTerm) {
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
    }

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
      !isDictionaryTerm &&
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
      const k = canonicalize(value);

      if (isUsable(k)) {
        found.add(k);
      }
    };

    // ----------------------------------------------------------
    // 1. Detect predefined technical keywords
    // ----------------------------------------------------------

    const JD_STOPLIST = new Set([
      "amazon", "google", "microsoft", "apple", "meta", "accenture",
      "new york", "san francisco", "london", "india",
    ]);
    const capitalizedMention = (keyword) => {
      const variants = [keyword, ...(VARIANTS.get(keyword) || [])];
      return variants.some((variant) => {
        const words = variant.split(" ");
        const titled = words.map((word) => word ? word[0].toUpperCase() + word.slice(1) : word).join(" ");
        return !JD_STOPLIST.has(norm(variant)) && new RegExp(`(^|[^a-z0-9])${esc(titled)}(?![a-z0-9])`).test(source);
      });
    };
    KEYWORDS.forEach((keyword) => {
      if (capitalizedMention(keyword)) add(keyword);
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
    //
    // IMPORTANT: both tokens must start with a capital letter (real
    // tool/library names are capitalized in JDs — React, NumPy, Svelte).
    // Without this, the pattern also matched ordinary lowercase sentence
    // grammar ("clearly and effectively", "independently and
    // collaboratively", "Science or related field") and injected those as
    // fake keywords. No /i flag on purpose — it must stay case-sensitive.
    // ----------------------------------------------------------

    const andPairRegex =
      /\b([A-Z][A-Za-z0-9+#.\-]{1,30})\s+(?:and|or|\/|&)\s+([A-Z][A-Za-z0-9+#.\-]{1,30})\b/g;

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
      if (freq[k] >= 2 && !JD_STOPLIST.has(k)) {
        add(k);
      }
    });

    // ----------------------------------------------------------
    // 6. Drop keywords that are a strict word-subset of a longer one
    //
    // A JD mentioning "Spring Boot" also makes the bare dictionary entry
    // "spring" match (word-boundary substring), and "REST APIs and MySQL"
    // can independently surface both "rest api" and a stray "api". Both are
    // really one requirement counted twice, which inflates the denominator
    // and can make an unrelated keyword falsely show as "missing". Drop the
    // shorter keyword only when its words are an exact contiguous run
    // inside the longer one (token-for-token, not a plain substring test —
    // "sql" is not dropped just because "mysql" is present, since "mysql"
    // is one token, not two).
    // ----------------------------------------------------------

    const candidates = [...found];
    const drop = new Set();

    candidates.forEach((shortKw) => {
      const shortTokens = shortKw.split(" ");

      candidates.forEach((longKw) => {
        if (shortKw === longKw) return;

        const longTokens = longKw.split(" ");

        if (shortTokens.length >= longTokens.length) return;

        for (let i = 0; i <= longTokens.length - shortTokens.length; i++) {
          if (
            longTokens.slice(i, i + shortTokens.length).join(" ") ===
            shortKw
          ) {
            drop.add(shortKw);
            break;
          }
        }
      });
    });

    const result = candidates.filter((k) => !drop.has(k));
    const ranked = result.map((keyword, index) => {
      const escaped = esc(keyword);
      const mentions = (source.match(new RegExp(`(?:^|[^a-z0-9])${escaped}(?![a-z0-9])`, "gi")) || []).length;
      const required = new RegExp(`(?:must|required|essential|mandatory|need to)[^.;\n]{0,80}${escaped}`, "i").test(source) ? 1 : 0;
      return { keyword, index, priority: required * 100 + Math.min(mentions, 10) };
    });
    return ranked.sort((a, b) => b.priority - a.priority || a.index - b.index).map((item) => item.keyword);
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

  const PHONE_RE = /(?:\+?\d[\d ().-]{7,}\d)/g;
  function hasPhone(value) {
    return [...String(value ?? "").matchAll(PHONE_RE)].some(([raw]) => {
      const digits = raw.replace(/\D/g, "");
      if (digits.length < 10 || digits.length > 15) return false;
      if (/^\d{4}\s*[-–—]\s*\d{4}$/.test(raw.trim())) return false;
      return true;
    });
  }

  // ============================================================
  // RESUME SECTIONS
  // ============================================================

  const SECTIONS = [
    [
      "summary",
      /^(?:(?:professional|career|executive)\s+)?(?:summary|profile|objective|about me|professional profile)$/i,
    ],

    [
      "skills",
      /^(?:(?:technical|core|key|relevant)\s+)?(?:skills(?:\s*(?:&|and)\s*(?:tools?|technologies|technology))?|competenc(?:y|ies)|technologies|proficiencies|technical proficiencies|technical expertise|core competencies|areas of expertise|tools)$/i,
    ],

    [
      "experience",
      /^(?:(?:(?:professional|relevant)\s+)?(?:work|internship|intern)(?:\s*(?:\/|&|and)\s*(?:work|internship|intern))?\s+experience|experience|professional experience|work history|employment\s+history|career history|(?:(?:concurrent|remote|multiple)\s+)*internships?|industrial\s+training)$/i,
    ],

    [
      "projects",
      /^(?:(?:selected|personal|academic|key|relevant)\s+)?projects?(?: portfolio)?$/i,
    ],

    [
      "education",
      /^education$|^education\s*(?:&|and)\s*(?:qualifications?|details?)$|^education\s+details?$|^(?:academic|educational)\s+(?:background|qualifications?|details?)$/i,
    ],

    [
      "certifications",
      /^(?:professional\s+)?(?:certifications?|certificates?|licenses?|courses?|training)$/i,
    ],

    [
      "other",
      /^(?:achievements?|awards?|languages?|interests?|hobbies|extracurriculars?|volunteering|additional information|publications?|research|conferences?)$/i,
    ],
  ];

  const TITLES = {
    summary: "Summary",
    skills: "Skills",
    experience: "Experience",
    projects: "Projects",
    education: "Education",
    certifications: "Certifications",
    other: "Other",
  };

  function detectSection(line) {
    const t = String(line ?? "").trim();

    if (!t || t.length > 80 || /[.!?]$/.test(t)) {
      return null;
    }

    const n = t
      .replace(/^\s*(?:\d+[.)]|[-•])\s*/, "")
      .replace(/^[#*_\s]+|[#*_\s:]+$/g, "")
      .replace(/\s+/g, " ");

    if (!n || n.split(" ").length > 8) {
      return null;
    }

    const direct = SECTIONS.find(([, regex]) => regex.test(n));

    if (direct) return direct[0];

    // Combined headers ("Experience & Projects", "Achievements &
    // Certifications") name two things under one line. We can only tag a
    // section with a single key, so without this the whole heading (and
    // everything under it) went undetected and silently fell into
    // whatever section came before it — which also meant its content never
    // counted toward the experience/projects structure checks. Try each
    // connector-separated part and use the first one that matches a known
    // section; this only fires when the whole heading did not already
    // match above, so plain single-topic headers are unaffected.
    const parts = n
      .split(/\s*(?:&|,|\/|\band\b)\s*/i)
      .filter(Boolean);

    if (parts.length > 1) {
      for (const part of parts) {
        const hit = SECTIONS.find(([, regex]) => regex.test(part));
        if (hit) return hit[0];
      }
    }

    return null;
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
      .replace(/\r\n?/g, "\n")
      .replace(/[\u00A0\u202F]/g, " ")
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
    /^\s*(?:(?:github|live|link|url)\s*:|(?:cgpa|gpa|aggregate|percentage|grade)\b)/i;

  function splitBlocks(lines) {
    // PDFs hard-wrap long bullets. Glue a wrapped tail back onto its bullet
    // so it is not mistaken for a new title/bullet.
    const t = [];
    let inBullet = false;
    let lastNonEmptyIndex = -1;
    let prev = "";
    lines.forEach((raw) => {
      const line = String(raw ?? "").trim();
      if (!line) return void t.push("");
      const wrappedTail =
        inBullet && !isBullet(line) && !DETAIL_RE.test(line) &&
        (!/[.!?]$/.test(prev) || /^[a-z]/.test(line)) &&
        !(/^[A-Z]/.test(line) && /\b(?:19|20)\d{2}\b/.test(line));
      if (wrappedTail && lastNonEmptyIndex >= 0) {
        t[lastNonEmptyIndex] = prev + " " + line;
        prev = t[lastNonEmptyIndex];
      } else {
        t.push(line);
        lastNonEmptyIndex = t.length - 1;
        prev = line;
        inBullet = isBullet(line);
      }
    });
    const nextNonEmpty = new Array(t.length);
    let next = "";
    for (let i = t.length - 1; i >= 0; i--) {
      nextNonEmpty[i] = next;
      if (t[i]) next = t[i];
    }

    const blocks = [];
    let cur = null;

    t.forEach((line, i) => {
      if (!line) return;

      const bulleted = isBullet(line);

      const hasSig =
        !DETAIL_RE.test(line) &&
        !bulleted &&
        line.length < 160 &&
        HEADER_SIG.test(line);

      // Generalized rule: ANY plain line (no date/pipe/dash/year of its
      // own) that is immediately followed by a real bulleted line is a
      // title for that bullet group — regardless of what resume format
      // produced it. Without this, a bare "Mehta AI" (no separators at
      // all) followed by "- did X" silently merges into whatever block
      // came before it instead of starting its own.
      const nextLine = nextNonEmpty[i];

      const isBareTitleBeforeBullets =
        !DETAIL_RE.test(line) &&
        !bulleted &&
        !hasSig &&
        line.length < 160 &&
        !!nextLine &&
        isBullet(nextLine);

      const isHeader = hasSig || isBareTitleBeforeBullets;

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
    `(\\b${MON}\\s*(?:–|—|-|to)\\s*${DPH}|${DPH}\\s*(?:–|—|-|to)\\s*(?:${DPH}|ongoing|present)|\\(\\s*(?:ongoing|present)\\s*\\)|${DPH}\\s*$)`,
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
        .join(" · ");

    if (!match) {
      const [head, ...stack] = t.split(/\s{3,}/);
      return { title: clean(head), date: stack.join(" · ") };
    }

    const tail = t
      .slice(match.index + match[0].length)
      .replace(/^[\s|]+|[\s|]+$/g, "");

    const date = match[0]
      .replace(/^\(|\)$/g, "")
      .trim();

    return {
      title: clean(t.slice(0, match.index)),
      date: tail ? `${date}${tail.startsWith("(") ? " " : " · "}${tail}` : date,
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

    const finalItems = [...items].sort((a, b) => score(b, keywords) - score(a, keywords));

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
      .flatMap((keyword) => [canonicalize(keyword), ...(VARIANTS.get(canonicalize(keyword)) || [])])
      .map(norm)
      .filter((value, index, all) => all.indexOf(value) === index)
      .sort((a, b) => b.length - a.length)
      .map(esc)
      .join("|");
    const regex = new RegExp(`(^|[^a-z0-9])(?:${alternatives})(?![a-z0-9])`, "gi");

    let output = "";
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text))) {
      const prefix = match[1] || "";
      const start = match.index + prefix.length;
      output += escHtml(text.slice(lastIndex, start)) +
        `<mark class="kw-hit">${escHtml(match[0].slice(prefix.length))}</mark>`;
      lastIndex = match.index + match[0].length;
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
      jdOnly = false,
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

        // Previously this kept ONLY the lines that matched a contact
        // pattern (email/phone/URL) whenever at least one such line
        // existed — so a location line like "Chennai, India" or a
        // one-line tagline silently vanished from the rendered/printed
        // resume the moment any real contact line was present. Keep
        // every header line, in order.
        const show = rest.reduce((a, l) => {
          if (a.length && /[|,]\s*$/.test(a[a.length - 1])) a[a.length - 1] += " " + l;
          else a.push(l);
          return a;
        }, []).map((l) => l.replace(/\s*\|\s*$/, ""));

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
          (section.title || "").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()),
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
              .map((header) => header.trim())
              .filter(Boolean)
              .forEach((header) => {
                const { title, date } = splitHeader(header);
                // PDF/DOCX extraction can place a date on its own line. Do
                // not create an empty flex title that pushes the date to the
                // far right; preserve it as readable full-width metadata.
                if (!title && date) {
                  html += `<div class="cv-block-date-only">${escHtml(date)}</div>`;
                  return;
                }
                html +=
                  `<div class="cv-block-header-row">` +
                  `<span class="cv-block-title">${H(title)}</span>` +
                  `${date ? `<span class="cv-block-date">${escHtml(date)}</span>` : ""}` +
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
    { jdOnly = false } = {},
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

  // The original list only had past-tense forms of ~30 verbs, and was
  // missing common engineering-resume verbs entirely (deployed, integrated,
  // engineered, collaborated, wrote, configured, maintained, debugged...).
  // A real bullet like "Deployed a Spring Boot service" or "Wrote CRUD
  // APIs" scored zero action verbs under the old list.
  const VERB_WORDS = [
    "managed", "manage", "managing",
    "led", "lead", "leading",
    "developed", "develop", "developing",
    "created", "create", "creating",
    "improved", "improve", "improving",
    "increased", "increase", "increasing",
    "reduced", "reduce", "reducing",
    "achieved", "achieve", "achieving",
    "designed", "design", "designing",
    "implemented", "implement", "implementing",
    "built", "build", "building",
    "launched", "launch", "launching",
    "coordinated", "coordinate", "coordinating",
    "analyzed", "analysed", "analyze", "analyse", "analyzing", "analysing",
    "delivered", "deliver", "delivering",
    "streamlined", "streamline", "streamlining",
    "optimized", "optimised", "optimize", "optimise", "optimizing", "optimising",
    "spearheaded", "spearhead", "spearheading",
    "initiated", "initiate", "initiating",
    "executed", "execute", "executing",
    "drove", "drive", "driving", "driven",
    "generated", "generate", "generating",
    "negotiated", "negotiate", "negotiating",
    "mentored", "mentor", "mentoring",
    "trained", "train", "training",
    "automated", "automate", "automating",
    "architected", "architect", "architecting",
    "orchestrated", "orchestrate", "orchestrating",
    "resolved", "resolve", "resolving",
    "established", "establish", "establishing",
    "deployed", "deploy", "deploying",
    "integrated", "integrate", "integrating",
    "engineered", "engineer", "engineering",
    "collaborated", "collaborate", "collaborating",
    "wrote", "write", "writing",
    "configured", "configure", "configuring",
    "organized", "organised", "organize", "organise", "organizing", "organising",
    "maintained", "maintain", "maintaining",
    "migrated", "migrate", "migrating",
    "refactored", "refactor", "refactoring",
    "debugged", "debug", "debugging",
    "documented", "document", "documenting",
    "researched", "research", "researching",
    "presented", "present", "presenting",
    "scaled", "scale", "scaling",
    "secured", "secure", "securing",
    "contributed", "contribute", "contributing",
    "participated", "participate", "participating",
  ];

  const VERB_START = new RegExp(`^(?:${VERB_WORDS.join("|")})\\b`, "i");

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
        hasPhone(resume),

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
    const words = resume.split(/\s+/).filter(Boolean).length;
    const bullets = resume.split("\n").filter(isBullet).length;
    const verbs = resume.split(/\n/).filter(isBullet).reduce((count, line) => count + (VERB_START.test(stripBullets(line)) ? 1 : 0), 0);
    // The original only caught %, currency and "Nx" multipliers, so bullets
    // like "500+ users", "cut runtime from 8s to 2s", or "12 team members"
    // scored zero measurable results despite clearly having numbers. This
    // adds counted units; it intentionally requires a unit word right after
    // the number (not a bare number alone) so dates like "Mar 2026" and
    // phone numbers are not miscounted as achievements.
    const QUANT_UNITS = "k|m|ms|s|sec|secs|seconds|min|mins|minutes|hrs?|hours?|days?|weeks?|months?|years?|users?|customers?|clients?|members?|requests?|records?|rows?|people|engineers?|developers?|teams?";
    const quant = (resume.match(new RegExp(`\\d+(\\.\\d+)?\\s?%|[$₹]\\s?\\d[\\d,]*|\\b\\d+(\\.\\d+)?x\\b|\\b\\d+\\+(?=\\s)|\\b\\d+(?:\\.\\d+)?\\s?(?:${QUANT_UNITS})\\b`, "gi")) || []).length;
    const contentSignals = Math.min(1, (Math.min(bullets, 5) / 5) * 0.5 + (Math.min(verbs, 5) / 5) * 0.3 + (Math.min(quant, 2) / 2) * 0.2);

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

      // A keyword pasted into the Skills line counts for less than one
      // actually demonstrated in Experience/Projects/Summary. Without this,
      // a resume that just lists every JD keyword in one line with no real
      // content behind it scores almost the same as an honest resume that
      // proves each one — a plain word-search can't tell "know Docker" from
      // "used Docker to ship a service serving 500 users".
      const bodyKeys = new Set(["experience", "projects", "summary"]);
      const skillsText = sections
        .filter((section) => section.key === "skills")
        .map((section) => section.lines.join("\n"))
        .join("\n");
      const bodyText = sections
        .filter((section) => bodyKeys.has(section.key))
        .map((section) => section.lines.join("\n"))
        .join("\n");

      const weights = keywords.map((keyword) => {
        if (pattern(keyword).test(bodyText)) return 1;
        if (pattern(keyword).test(skillsText)) return 0.5;
        return 0;
      });
      const weightedCoverage = keywords.length
        ? weights.reduce((a, b) => a + b, 0) / keywords.length
        : 0;

      const structureCoverage = passed / 4;
      const scoreBreakdown = {
        "keyword coverage": Math.round(weightedCoverage * 100),
        "structure checks": Math.round(structureCoverage * 100),
        "content signals": Math.round(contentSignals * 100),
      };

      // A resume that shares almost no keywords with the JD (wrong role
      // entirely) can still score a moderate total from structure and
      // content-quality points alone. That total is a fair writing-quality
      // read but a misleading "match" read, so flag it separately rather
      // than silently blending it into one number.
      const lowRelevance = keywords.length > 0 && weightedCoverage < 0.25;

      return {
        mode: "jd",

        score: Math.round(weightedCoverage * 60 + structureCoverage * 25 + contentSignals * 15),
        jobMatch: Math.round(weightedCoverage * 100),
        atsReadiness: Math.round((structureCoverage * 0.6 + contentSignals * 0.4) * 100),
        scoreBreakdown,
        methodology: "Estimate: 60% JD keyword coverage (full credit when a keyword is demonstrated in Experience/Projects/Summary, half credit when it only appears in the Skills list), 25% resume structure checks, 15% content signals (bullets, action verbs, measurable results). Not a prediction of recruiter or ATS decisions.",

        matched,
        missing,
        checks,

        noKeywords:
          keywords.length === 0,
        lowRelevance,
      };
    }

    // ==========================================================
    // GENERAL RESUME MODE
    // ==========================================================

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
      jobMatch: null,
      atsReadiness: total,
      scoreBreakdown: {
        "structure checks": Math.round((passed / 4) * 100),
        "length": Math.round((okLen ? 1 : words > 0 ? 0.5 : 0) * 100),
        "bullet quality": Math.round((bullets >= 3 ? 1 : bullets > 0 ? 0.5 : 0) * 100),
        "action verbs": Math.round((verbs >= 3 ? 1 : verbs > 0 ? 0.5 : 0) * 100),
        "measurable results": Math.round((quant >= 2 ? 1 : quant > 0 ? 0.5 : 0) * 100),
      },
      methodology: "Estimate: structure 40%, length 15%, bullets 15%, action verbs 15%, measurable results 15%. This is a writing-quality heuristic, not a prediction of ATS or recruiter decisions.",

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
    hasPhone,
  };
});
