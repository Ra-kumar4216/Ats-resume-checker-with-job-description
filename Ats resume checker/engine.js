/* Pure resume logic (no DOM). Browser: window.ATS. Node: require('./engine'). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(typeof globalThis !== 'undefined' ? globalThis : this);
  } else {
    root.ATS = factory(root);
  }
})(typeof self !== 'undefined' ? self : this, function (root) {
  // ============================================================
  // KEYWORDS
  // ============================================================

  const KEYWORDS = typeof require === 'function' ? require('./skills-data.js') : root.ATS_SKILLS || [];
  const Icons = typeof require === 'function' ? require('./resume-icons.js') : root.ResumeIcons || null;

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
      .split(/\s+/)
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
      .split(/\s+/)
  );

  const REORDER = new Set(['experience', 'projects', 'skills']);

  // Treat common spelling variants as one skill so the same requirement is
  // never counted twice (for example, Node, Node.js and NodeJS).
  const CANONICAL = new Map([
    ['node', 'node.js'],
    ['nodejs', 'node.js'],
    ['nextjs', 'next.js'],
    ['sklearn', 'scikit-learn'],
    ['dotnet', '.net'],
    ['html5', 'html'],
    ['css3', 'css'],
    ['ai', 'artificial intelligence'],
    ['ml', 'machine learning'],
    ['llms', 'llm'],
    ['huggingface', 'hugging face'],
    ['genai', 'generative ai'],
    ['gen ai', 'generative ai'],
    ['apis', 'api'],
    ['rest apis', 'rest api'],
    ['restful api', 'rest api'],
    ['restful apis', 'rest api'],
  ]);
  const VARIANTS = new Map([
    ['node.js', ['node', 'nodejs']],
    ['next.js', ['nextjs']],
    ['scikit-learn', ['sklearn']],
    ['.net', ['dotnet']],
    ['html', ['html5']],
    ['css', ['css3']],
    ['artificial intelligence', ['ai']],
    ['machine learning', ['ml']],
    ['llm', ['llms', 'large language model', 'large language models']],
    ['nlp', ['natural language processing']],
    ['rag', ['retrieval augmented generation', 'retrieval-augmented generation']],
    ['hugging face', ['huggingface']],
    ['generative ai', ['genai', 'gen ai']],
    ['vector database', ['vector db', 'vector databases']],
    ['rest api', ['rest apis', 'restful api', 'restful apis']],
  ]);

  // ============================================================
  // HELPERS
  // ============================================================

  const norm = s =>
    String(s ?? '')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

  const canonicalize = s => CANONICAL.get(norm(s)) || norm(s);

  const esc = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const HTML_ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' };
  const escHtml = s => String(s).replace(/[&<>"']/g, ch => HTML_ESC[ch]);

  const bounds = k => [/^[a-z0-9]/i.test(k) ? '\\b' : '(^|[^a-z0-9])', /[a-z0-9]$/i.test(k) ? '\\b' : '(?![a-z0-9])'];

  const cache = new Map();

  function pattern(kw) {
    const key = canonicalize(kw);

    if (!cache.has(key)) {
      const variants = [
        key,
        ...(VARIANTS.get(key) || []),
        ...KEYWORDS.filter(candidate => canonicalize(candidate) === key && norm(candidate) !== key),
      ]
        .map(norm)
        .filter((value, index, all) => all.indexOf(value) === index);
      const alternatives = variants
        .map(variant => {
          const [left, right] = bounds(variant);
          return left + esc(variant) + right;
        })
        .join('|');
      cache.set(key, new RegExp(`(?:${alternatives})`, 'i'));
    }

    return cache.get(key);
  }

  // ============================================================
  // KEYWORD VALIDATION (EXPORTED FOR TESTING)
  // ============================================================

  function isUsable(value) {
    const k = norm(value)
      .replace(/^[,;:.\-–—/]+|[,;:.\-–—/]+$/g, '')
      .trim();

    if (!k) {
      return false;
    }

    // A term that is explicitly whitelisted in the KEYWORDS dictionary is
    // always usable, even when one of its individual words would normally
    // be filtered as generic/stop noise on its own. Without this, "spring
    // boot" was silently unextractable (its own token "boot" is in
    // GENERIC), and the same would have quietly broken "prompt
    // engineering" ("engineering" is in GENERIC) the moment it was added.
    const isDictionaryTerm = KEYWORDS.some(entry => norm(entry) === k);

    if (!isDictionaryTerm) {
      // Exact stop/generic words
      if (STOP.has(k)) {
        return false;
      }
      if (GENERIC.has(k)) {
        return false;
      }

      // Education words should not become ATS skills
      const educationWords = new Set([
        'bachelor',
        'bachelors',
        'master',
        'masters',
        'degree',
        'graduate',
        'graduation',
        'education',
        'qualification',
        'qualifications',
      ]);

      if (educationWords.has(k)) {
        return false;
      }
    }

    // Very short values are normally noise
    const compact = k.replace(/[^a-z0-9+#.]/g, '');

    if (compact.length < 3 && !isDictionaryTerm && !/^(c\+\+|c#|r)$/.test(k)) {
      return false;
    }

    const tokens = k.split(/\s+/);

    // Avoid very long natural-language phrases
    if (tokens.length > 3) {
      return false;
    }

    // Every token must be meaningful
    if (!isDictionaryTerm && tokens.some(token => token.length < 2 || STOP.has(token) || GENERIC.has(token))) {
      return false;
    }

    return true;
  }

  // ============================================================
  // SPLIT MULTIPLE SKILLS
  // ============================================================

  function splitSkillPhrase(value) {
    if (!value) {
      return [];
    }

    const text = String(value)
      .replace(/\([^)]*\)/g, ' ')
      .replace(/[–—]/g, '-')
      .trim();

    if (!text) {
      return [];
    }

    const parts = text
      .split(/\s*(?:,|\/|\||&|\band\b|\bor\b|\bplus\b|\bwith\b)\s*/gi)
      .map(part =>
        part
          .replace(/^(?:and|or|plus|also|including|such as)\s+/i, '')
          .replace(/\s+(?:and|or|plus|also|including)\s*$/i, '')
          .replace(/^[\s:;,.!?'"()[\]{}]+|[\s:;,.!?'"()[\]{}]+$/g, '')
          .trim()
      )
      .filter(Boolean);

    return parts;
  }

  // ============================================================
  // EXTRACT KEYWORDS
  // ============================================================

  function extractKeywords(jd) {
    const source = String(jd ?? '');

    if (!source.trim()) {
      return [];
    }

    const found = new Set();

    const add = value => {
      const k = canonicalize(value);

      if (isUsable(k)) {
        found.add(k);
      }
    };

    // ----------------------------------------------------------
    // 1. Detect predefined technical keywords
    // ----------------------------------------------------------

    const JD_STOPLIST = new Set([
      'amazon',
      'google',
      'microsoft',
      'apple',
      'meta',
      'accenture',
      'new york',
      'san francisco',
      'london',
      'india',
    ]);
    const capitalizedMention = keyword => {
      const variants = [keyword, ...(VARIANTS.get(keyword) || [])];
      return variants.some(variant => {
        const words = variant.split(' ');
        const titled = words.map(word => (word ? word[0].toUpperCase() + word.slice(1) : word)).join(' ');
        return !JD_STOPLIST.has(norm(variant)) && new RegExp(`(^|[^a-z0-9])${esc(titled)}(?![a-z0-9])`).test(source);
      });
    };
    // Words that are also ordinary English / short names must be written like a
    // proper noun in the JD ("React", "Go"); everything else (MongoDB, SQL, AWS,
    // REST APIs, Node.js ...) is matched case-insensitively.
    const AMBIGUOUS = new Set(['react', 'express', 'excel', 'swift', 'spring', 'rag', 'go', 'rust', 'ruby', 'rails', 'bash']);
    // Employer / location lines are not skills ("Company: Acme & Sons").
    const cleaned = source.replace(/^[ \t]*(?:company|employer|organi[sz]ation|location|address|about us)\s*[:-][^\n]*$/gim, ' ');
    KEYWORDS.forEach(keyword => {
      const key = canonicalize(keyword);
      if (AMBIGUOUS.has(key)) {
        if (capitalizedMention(keyword)) {
          add(keyword);
        }
      } else if (pattern(keyword).test(cleaned)) {
        add(keyword);
      }
    });

    // ----------------------------------------------------------
    // 2. Multi-skill signal phrases
    // ----------------------------------------------------------

    const signalRegex =
      /(?:experience\s+(?:with|in)|knowledge\s+(?:of|in)|proficien(?:t|cy)\s+(?:in|with)|familiarity\s+(?:with|in)|skilled?\s+(?:in|with)|expertise\s+(?:in|with)|hands[-\s]?on\s+(?:with|experience\s+in)|strong\s+(?:knowledge|experience|background)\s+(?:in|with))\s+((?:[^.;:\n]|\.(?=[A-Za-z0-9+#])){2,160})/gi;

    let match;

    while ((match = signalRegex.exec(cleaned)) !== null) {
      const phrase = match[1]
        .replace(/\b(?:required|required\.|preferred|desired|bonus|plus|nice to have)\b/gi, ' ')
        .trim();

      const parts = splitSkillPhrase(phrase);

      parts.forEach(part => {
        add(part);
      });
    }

    // ----------------------------------------------------------
    // 3. Explicit skill-list phrases
    // ----------------------------------------------------------

    const listRegex =
      /(?:skills?|technologies?|technical\s+skills?|tools?|frameworks?|libraries?|proficiencies?)\s*:\s*([^\n]+)/gi;

    while ((match = listRegex.exec(cleaned)) !== null) {
      const parts = splitSkillPhrase(match[1]);

      parts.forEach(part => {
        add(part);
      });
    }

    // ----------------------------------------------------------
    // 4. Handle direct "X and Y" skill patterns
    // ----------------------------------------------------------

    const andPairRegex = /\b([A-Z][A-Za-z0-9+#.-]{1,30})\s+(?:and|or|\/|&)\s+([A-Z][A-Za-z0-9+#.-]{1,30})\b/g;

    const inDictionary = value => KEYWORDS.some(entry => canonicalize(entry) === canonicalize(value));
    while ((match = andPairRegex.exec(cleaned)) !== null) {
      [match[1], match[2]].forEach(word => {
        if (inDictionary(word)) {
          add(word);
        }
      });
    }

    // ----------------------------------------------------------
    // 5. Repeated capitalized technical terms
    // ----------------------------------------------------------

    const freq = {};

    const capitalizedWords = cleaned.match(/\b[A-Z][A-Za-z0-9+#.-]{2,}\b/g) || [];

    capitalizedWords.forEach(word => {
      const k = norm(word);

      if (isUsable(k)) {
        freq[k] = (freq[k] || 0) + 1;
      }
    });

    Object.keys(freq).forEach(k => {
      if (freq[k] >= 2 && !JD_STOPLIST.has(k) && inDictionary(k)) {
        add(k);
      }
    });

    // ----------------------------------------------------------
    // 6. Drop keywords that are a strict word-subset of a longer one
    // ----------------------------------------------------------

    const candidates = [...found];
    const drop = new Set();

    candidates.forEach(shortKw => {
      const shortTokens = shortKw.split(' ');

      candidates.forEach(longKw => {
        if (shortKw === longKw) {
          return;
        }

        const longTokens = longKw.split(' ');

        if (shortTokens.length >= longTokens.length) {
          return;
        }

        for (let i = 0; i <= longTokens.length - shortTokens.length; i++) {
          if (longTokens.slice(i, i + shortTokens.length).join(' ') === shortKw) {
            drop.add(shortKw);
            break;
          }
        }
      });
    });

    const result = candidates.filter(k => !drop.has(k));
    const ranked = result.map((keyword, index) => {
      const escaped = esc(keyword);
      const mentions = (source.match(new RegExp(`(?:^|[^a-z0-9])${escaped}(?![a-z0-9])`, 'gi')) || []).length;
      const required = new RegExp(`(?:must|required|essential|mandatory|need to)[^.;\n]{0,80}${escaped}`, 'i').test(
        source
      )
        ? 1
        : 0;
      return { keyword, index, priority: required * 100 + Math.min(mentions, 10) };
    });
    return ranked.sort((a, b) => b.priority - a.priority || a.index - b.index).map(item => item.keyword);
  }

  // ============================================================
  // BULLETS
  // ============================================================

  const BUL = '•·●◦∙▪‣⁃‧‥⁌⁍\uF0B7\uF0A7\uF076_*-';

  const BULLET_RE = new RegExp(`^\\s*[${BUL}](?=\\s|[${BUL}])\\s*`);

  const LEAD_RE = new RegExp(`^\\s*(?:[${BUL}](?=\\s|[${BUL}])\\s*)+`);

  const isBullet = line => BULLET_RE.test(String(line ?? ''));

  const stripBullets = line =>
    String(line ?? '')
      .replace(LEAD_RE, '')
      .trim();

  const bulletize = line => (isBullet(line) ? '• ' + stripBullets(line) : line);

  // ============================================================
  // CONTACT DETECTION
  // ============================================================

  const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

  // FIXED: Non-global regex to avoid lastIndex mutation bug
  const PHONE_RE = /(?:\+?\d[\d ().-]{7,}\d)/;
  function findPhone(value) {
    const str = String(value ?? '');
    const hit = [...str.matchAll(new RegExp(PHONE_RE.source, 'g'))].find(([raw]) => {
      const digits = raw.replace(/\D/g, '');
      if (digits.length < 10 || digits.length > 15) {
        return false;
      }
      // date ranges such as "2024 - 2027"
      return !/^\d{4}\s*[-–—]\s*\d{4}$/.test(raw.trim());
    });
    return hit ? hit[0].trim() : '';
  }
  const hasPhone = value => findPhone(value) !== '';

  // ============================================================
  // EXTRACTED-TEXT CLEANUP (PDF / DOCX / pasted text)
  // ============================================================

  // PDFs that use real small-caps fonts come out as "R ATAN K UMAR" / "P ROFESSIONAL S UMMARY".
  function fixSmallCaps(line) {
    const t = String(line ?? '').trim();
    if (!t || /[a-z]/.test(t)) {
      return line;
    }
    // fully letter-spaced text: every token is a single letter
    if (/^[A-Za-z](?:\s+[A-Za-z]){4,}(?:\s{2,}[A-Za-z](?:\s+[A-Za-z])+)*$/.test(t) && !/[a-z]/.test(t)) {
      const words = t.split(/\s{2,}/);
      return words.map(w => w.replace(/\s+/g, '')).join(' ');
    }
    const tokens = t.split(/\s+/);
    if (tokens.length > 8) {
      return line;
    }
    const pairs = tokens.filter((tok, i) => /^[A-Z]$/.test(tok) && /^[A-Z]{2,}[.,:;]?$/.test(tokens[i + 1] || ''));
    if (!pairs.length) {
      return line;
    }
    // a lone "A" / "I" in front of a word is real English, not a small-caps split
    if (pairs.length === 1 && /^[AI]$/.test(pairs[0]) && !detectSection(t.replace(/^([AI])\s+/, '$1'))) {
      return line;
    }
    return t.replace(/\b([A-Z])\s+(?=[A-Z]{2,}\b)/g, '$1').replace(/\s{2,}/g, ' ');
  }

  const URL_TAIL_RE = /(?:https?:\/\/\S*|www\.\S*|\b(?:linkedin|github)\.com\S*)[-/]\s*$/i;
  const CONTACT_LABEL_RE = /\s*\((?:mobile|home|work|linkedin|other|portfolio|blog|personal website|company website|company)\)\s*$/i;

  let cleanCache = { input: null, output: '' };

  function cleanExtractedText(text) {
    const input = String(text ?? '');
    if (cleanCache.input === input) {
      return cleanCache.output;
    }
    const output = cleanLines(input);
    cleanCache = { input, output };
    return output;
  }

  function cleanLines(input) {
    const lines = input
      .replace(/\r\n?/g, '\n')
      .replace(/[\u00A0\u202F]/g, ' ')
      .replace(/[\uF0B7\uF0A7\uF076]/g, '•') // symbol-font bullets
      .replace(/[\uE000-\uF8FF]/g, '') // other icon-font glyphs
      .replace(/\u200B|\u200C|\u200D|\uFEFF|\uFE0F/g, '')
      .split('\n')
      // page footers: "Page 1 of 3" and lone page numbers
      .filter(l => !/^\s*page\s+\d+\s+of\s+\d+\s*$/i.test(l) && !/^\s*\d{1,2}\s*$/.test(l));

    const joined = [];
    lines.forEach(line => {
      const prev = joined[joined.length - 1];
      // a URL that wrapped onto the next line: "linkedin.com/in/ratan-kumar-" + "metha"
      if (prev !== undefined && /(?:http|www\.|linkedin\.com|github\.com)/i.test(prev) && URL_TAIL_RE.test(prev) && line.trim()) {
        joined[joined.length - 1] = prev.trimEnd() + line.trimStart();
      } else if (prev !== undefined && prev.includes('(') && /\([^)]*$/.test(prev) && /^[^(]{0,24}\)/.test(line)) {
        // "(June 2024 - July" + "2027)" : a date range that wrapped inside brackets
        joined[joined.length - 1] = prev.trimEnd() + ' ' + line.trimStart();
      } else {
        joined.push(line);
      }
    });

    return joined
      .map(l => {
        let caps = fixSmallCaps(l);
        // "•Develop" -> "• Develop" (LinkedIn export has no space after the bullet)
        caps = caps.replace(/^(\s*[•●▪◦‣])(?=[^\s•●▪◦‣])/, '$1 ');
        // LinkedIn headline: the "|" separators are extracted as a lowercase "l"
        if (caps.includes('|') && /\sl\s+[A-Z]/.test(caps)) {
          caps = caps.replace(/\s+l\s+(?=[A-Z])/g, ' | ');
        }
        if (caps.includes('(')) {
          caps = caps.replace(
            /\s*[·•]?\s*\(\s*((?:[A-Za-z]{3,9}\.?\s+)?(?:19|20)\d{2}\s*[-–—]\s*(?:[A-Za-z]{3,9}\.?\s+)?(?:(?:19|20)\d{2}|present|current))\s*\)/i,
            '   $1'
          );
        }
        caps = caps.replace(/\s+,/g, ',');
        const base = caps.includes('(') ? caps.replace(CONTACT_LABEL_RE, '') : caps;
        if (!/[§ï¨¢]/.test(base)) {
          return base;
        }
        // icon-font glyphs that survive as Latin letters (github / linkedin / link icons)
        const noIcons = base.replace(
          /(^|\s)[§ï¨¢](?=\s+(?:https?:\/\/|www\.|github\.com|linkedin\.com|[\w.-]+\.[a-z]{2,}\/))/gi,
          '$1'
        );
        const out =
          noIcons === base
            ? base
            : noIcons
              .split(/\s{2,}/)
              .map(x => x.trim())
              .filter(Boolean)
              .join(' | ');
        return out.replace(/\s+[§¨¢]\s*$/, '');
      })
      .join('\n');
  }

  // ============================================================
  // PDF PAGE LAYOUT -> TEXT (any number of columns)
  // ============================================================

  const DATE_LINE = /^(?:[A-Za-z]{3,9}\.?\s+)?(?:19|20)\d{2}(?:\s*[–—-]\s*(?:present|current|(?:[A-Za-z]{3,9}\.?\s+)?(?:19|20)\d{2}))?(?:\s*\(.*\))?$/i;

  // pdf.js text items -> { main, side }.
  // The page is cut into horizontal bands at empty strips; a band that has a vertical gutter no text crosses is
  // split into columns, recursively (2, 3 or more columns, full-width header above the columns, sidebars on
  // either side). The column that holds the biggest text (the name) is read first; a narrower column next to it
  // is returned as `side` so multi-page resumes keep their main column in one piece.
  function pageText(rawItems) {
    const items = rawItems
      .map(it => ({
        text: String(it.str || ''),
        x: it.transform[4],
        y: it.transform[5],
        w: Number(it.width) || 0,
        h: Math.abs(Number(it.height) || Number(it.transform[3]) || 10),
      }))
      .filter(it => it.text.trim());
    if (!items.length) {
      return { main: '', side: '' };
    }

    const sortedH = items.map(it => it.h).sort((a, b) => a - b);
    const medianH = sortedH[Math.floor(sortedH.length / 2)] || 10;
    const maxH = sortedH[sortedH.length - 1];
    const lineKey = it => Math.round(it.y / 3);
    const lineCount = col => new Set(col.map(lineKey)).size;
    const chars = col => col.reduce((n, it) => n + it.text.trim().length, 0);

    const render = col => {
      const sorted = [...col].sort((a, b) => b.y - a.y || a.x - b.x);
      let out = '';
      let lastY = null;
      sorted.forEach(it => {
        if (lastY !== null) {
          out += Math.abs(it.y - lastY) > 2 ? '\n' : ' ';
        }
        out += it.text;
        lastY = it.y;
      });
      return out;
    };

    // empty horizontal strips -> bands, top to bottom
    const bandsOf = col => {
      const sorted = [...col].sort((a, b) => b.y + b.h - (a.y + a.h));
      const bands = [[sorted[0]]];
      let bottom = sorted[0].y - 0.28 * sorted[0].h;
      sorted.slice(1).forEach(it => {
        const top = it.y + 0.85 * it.h;
        if (bottom - top >= Math.max(0.7 * medianH, 5)) {
          bands.push([it]);
        } else {
          bands[bands.length - 1].push(it);
        }
        bottom = Math.min(bottom, it.y - 0.28 * it.h);
      });
      return bands;
    };

    // Share of lines that start at one of the 3 most common left edges. Bulleted columns use two or three
    // edges (heading, bullet, bullet text), a dates / tab-stop column uses dozens.
    const startCover = col => {
      const byLine = new Map();
      col.forEach(it => byLine.set(lineKey(it), Math.min(byLine.get(lineKey(it)) ?? Infinity, it.x)));
      const clusters = [];
      [...byLine.values()].sort((a, b) => a - b).forEach(x => {
        const last = clusters[clusters.length - 1];
        if (last && x - last.x <= 2) {
          last.n += 1;
        } else {
          clusters.push({ x, n: 1 });
        }
      });
      const top = clusters.map(c => c.n).sort((a, b) => b - a).slice(0, 3);
      return top.reduce((a, b) => a + b, 0) / byLine.size;
    };

    // two columns must both be real, line-aligned text (not a dates column, page numbers or tab stops)
    const realColumns = (left, right) => {
      const [small, big] = lineCount(left) <= lineCount(right) ? [left, right] : [right, left];
      const lines = lineCount(small);
      if (lines < 6 || lines / lineCount(big) < 0.25 || chars(small) / lines < 8) {
        return false;
      }
      if (startCover(small) < 0.7 || startCover(big) < 0.65) {
        return false;
      }
      const smallLines = new Map();
      small.forEach(it => smallLines.set(lineKey(it), `${smallLines.get(lineKey(it)) || ''} ${it.text}`.trim()));
      const dateLike = [...smallLines.values()].filter(t => DATE_LINE.test(t)).length;
      return dateLike / smallLines.size < 0.6;
    };

    const findGutter = col => {
      if (col.length < 12) {
        return null;
      }
      const sorted = [...col].sort((a, b) => a.x - b.x);
      const gaps = [];
      let reach = sorted[0].x + sorted[0].w;
      sorted.slice(1).forEach(it => {
        if (it.x - reach >= 12) {
          gaps.push({ mid: (reach + it.x) / 2, width: it.x - reach });
        }
        reach = Math.max(reach, it.x + it.w);
      });
      gaps.sort((a, b) => b.width - a.width);
      const hit = gaps.find(g => realColumns(col.filter(it => it.x + it.w <= g.mid), col.filter(it => it.x >= g.mid)));
      return hit ? hit.mid : null;
    };

    // Text of a set of items in reading order. A few full-width bands at the top (name, contact line) may sit
    // above the columns; everything below them is searched for a gutter as ONE block, so a gap inside one
    // column can never break the column detection. Columns are read left to right, recursively.
    const flow = (col, depth) => {
      const bands = bandsOf(col);
      for (let k = 0; k <= Math.min(3, bands.length - 1) && depth < 4; k += 1) {
        const body = bands.slice(k).flat();
        const mid = findGutter(body);
        if (mid !== null) {
          return [
            ...bands.slice(0, k).map(render),
            ...flow(body.filter(it => it.x + it.w <= mid), depth + 1),
            ...flow(body.filter(it => it.x >= mid), depth + 1),
          ];
        }
      }
      return bands.map(render);
    };

    // A whole-page gutter means "name column + sidebar" (LinkedIn export, sidebar templates).
    const pageMid = findGutter(items);
    if (pageMid !== null) {
      const left = items.filter(it => it.x + it.w <= pageMid);
      const right = items.filter(it => it.x >= pageMid);
      const hasName = col => col.some(it => it.h >= maxH * 0.95);
      let pair = null;
      if (hasName(right) && !hasName(left)) {
        pair = [right, left];
      } else if (hasName(left) && chars(right) < chars(left)) {
        pair = [left, right];
      }
      if (pair) {
        return { main: flow(pair[0], 1).join('\n'), side: flow(pair[1], 1).join('\n') };
      }
    }
    return { main: flow(items, 0).join('\n'), side: '' };
  }

  // ============================================================
  // RESUME SECTIONS
  // ============================================================

  const SECTIONS = [
    [
      'summary',
      /^(?:(?:professional|career|executive|personal|profile)\s+)?(?:summary|profile|objective|about me|professional profile|statement)$|^about$|^objective statement$/i,
    ],

    [
      'skills',
      /^(?:(?:technical|core|key|relevant)\s+)?(?:skills(?:\s*(?:&|and)\s*(?:tools?|technologies|technology))?|competenc(?:y|ies)|technologies|proficiencies|technical proficiencies|technical expertise|core competencies|areas of expertise|tools)$/i,
    ],

    [
      'experience',
      /^(?:(?:(?:professional|relevant)\s+)?(?:work|internship|intern)(?:\s*(?:\/|&|and)\s*(?:work|internship|intern))?\s+experience|experience|professional experience|work history|employment\s+history|career history|(?:(?:concurrent|remote|multiple)\s+)*internships?|industrial\s+training)$/i,
    ],

    ['projects', /^(?:(?:selected|personal|academic|key|relevant)\s+)?projects?(?: portfolio)?$/i],

    [
      'education',
      /^education$|^education\s*(?:&|and)\s*(?:qualifications?|details?)$|^education\s+details?$|^(?:academic|educational)\s+(?:background|qualifications?|details?)$/i,
    ],

    ['certifications', /^(?:professional\s+)?(?:certifications?|certificates?|licenses?|courses?|training)$/i],

    [
      'other',
      /^(?:achievements?|awards?(?:\s*(?:&|and)\s*(?:honou?rs|achievements?))?|honou?rs|languages?|interests?|hobbies(?:\s*(?:&|and)\s*interests)?|extra[- ]?curricular(?: activities)?|co[- ]?curricular(?: activities)?|volunteering|volunteer experience|additional information|publications?|research|conferences?|strengths|soft skills|leadership|positions? of responsibility|workshops?|references?|declaration|personal (?:details|information|profile)|accomplishments?)$/i,
    ],
    ['skills', /^(?:top skills|it skills|computer skills|programming skills|tech(?:nical)? stack|skills summary|skills? (?:&|and) (?:abilities|strengths))$/i],
    ['contact', /^contact(?:\s+(?:info|information|details))?$/i],
  ];

  const TITLES = {
    summary: 'Summary',
    skills: 'Skills',
    experience: 'Experience',
    projects: 'Projects',
    education: 'Education',
    certifications: 'Certifications',
    other: 'Other',
  };

  function detectSection(line) {
    const t = String(line ?? '').trim();

    if (!t || t.length > 80 || /[.!?]$/.test(t)) {
      return null;
    }

    const n = t
      .replace(/^\s*(?:\d+[.)]|[-•])\s*/, '')
      .replace(/^[#*_\s]+|[#*_\s:]+$/g, '')
      .replace(/\s+/g, ' ');

    if (!n || n.split(' ').length > 8) {
      return null;
    }

    const direct = SECTIONS.find(([, regex]) => regex.test(n));

    if (direct) {
      return direct[0];
    }

    // "label: value" lines and wrapped list fragments ("Tools & Platforms: Git, GitHub,") are never headings
    if (/:/.test(n) || /[,;]$/.test(t)) {
      return null;
    }

    // compound headings: "Skills & Tools", "Projects & Open Source" (one part is enough),
    // "Education, Certifications" (comma lists need every part to be a heading word)
    const matchPart = part => SECTIONS.find(([, regex]) => regex.test(part));
    const andParts = n.split(/\s*(?:&|\/|\band\b)\s*/i).filter(Boolean);
    if (andParts.length > 1) {
      const hit = andParts.map(matchPart).find(Boolean);
      if (hit) {
        return hit[0];
      }
    }
    const commaParts = n.split(/\s*,\s*/).filter(Boolean);
    if (commaParts.length > 1 && commaParts.every(matchPart)) {
      return matchPart(commaParts[0])[0];
    }

    return null;
  }

  function parseSections(text) {
    const out = [
      {
        key: 'header',
        title: null,
        lines: [],
      },
    ];
    let current = out[0];

    cleanExtractedText(text)
      .split('\n')
      .forEach(line => {
        const key = detectSection(line);

        if (key === 'contact') {
          // LinkedIn-style "Contact" block: its lines belong to the header
          current = out[0];
        } else if (key) {
          current = {
            key,
            title: line.trim(),
            lines: [],
          };
          out.push(current);
        } else {
          current.lines.push(line);
        }
      });

    return out;
  }

  // ============================================================
  // PROJECT / EXPERIENCE BLOCK PARSING
  // ============================================================

  const HEADER_SIG = /\b(?:19|20)\d{2}\b|'\d{2}\b|\b\d{1,2}\/\d{2,4}\b|\((?:ongoing|present)\)|\||[–—]/i;

  const DEGREE_LINE_RE =
    /\b(?:diploma|degree|bachelor|master|b\.?\s?tech|m\.?\s?tech|bca|mca|b\.?\s?sc|m\.?\s?sc|mba|phd|certificate|high school|higher secondary|secondary|intermediate|ssc|hsc|cbse|icse|class\s+(?:x|xi|xii|10|11|12))\b/i;
  const INSTITUTION_RE = /\b(?:school|college|university|institute|academy|polytechnic|vidyalaya)\b/i;
  const DETAIL_RE = /^\s*(?:(?:github|live|link|url)\s*:|(?:cgpa|gpa|aggregate|percentage|grade)\b)/i;

  const ROLE_WORD = /\b(?:developer|engineer|intern|analyst|designer|consultant|trainee|associate|architect|tester|programmer|scientist|administrator|specialist|lead|manager)\b/i;
  const GRADE_TAIL = /[–—]\s*(?:\d+\.\d+\s*%?|\d{1,3}\s*%|\d+(?:\.\d+)?\s*\/\s*\d+)\s*$/;
  const DURATION_ONLY = /^\d+\s*(?:months?|mos?|years?|yrs?)(?:\s+\d+\s*(?:months?|mos?))?$/i;
  const plainLine = l => l && !isBullet(l) && l.length <= 80 && !/[.!?]$/.test(l) && !DETAIL_RE.test(l);

  // "March 2026 - Present (3 months)" on a line of its own (LinkedIn exports)
  function isDateOnly(line) {
    const m = String(line).match(DATE_RE);
    if (!m) {
      return false;
    }
    const rest = (line.slice(0, m.index) + line.slice(m.index + m[0].length)).replace(/\([^)]*\)/g, '');
    return rest.replace(/[\s|·,–—-]+/g, '') === '';
  }

  function splitBlocks(lines) {
    const t = [];
    let inBullet = false;
    let lastNonEmptyIndex = -1;
    let prev = '';
    // the next two non-empty lines (only looked at when a line could be a wrapped bullet tail)
    const peek = idx => {
      const out = [];
      for (let k = idx + 1; k < lines.length && out.length < 4; k++) {
        const v = String(lines[k] ?? '').trim();
        if (v) {
          out.push(v);
        }
      }
      return out;
    };
    lines.forEach((raw, idx) => {
      const line = String(raw ?? '').trim();
      if (!line) {
        return void t.push('');
      }
      // a lowercase line right after a long unfinished plain line is the wrapped end of that line
      const plainWrap =
        !inBullet &&
        !isBullet(line) &&
        /^[a-z]/.test(line) &&
        prev.length >= 60 &&
        !/[.!?:;]$/.test(prev) &&
        !isBullet(prev) &&
        !DETAIL_RE.test(line);
      let wrappedTail =
        plainWrap ||
        (inBullet &&
        !isBullet(line) &&
        !DETAIL_RE.test(line) &&
        (!/[.!?]$/.test(prev) || /^[a-z]/.test(line)) &&
        !(/^[A-Z]/.test(line) && /\b(?:19|20)\d{2}\b/.test(line)));
      // "Company" / "Role" / "Mar 2026 - Present": a new job, not the tail of the last bullet
      if (wrappedTail && /^[A-Z]/.test(line) && peek(idx).some(isDateOnly)) {
        wrappedTail = false;
      }
      // "Sanskar International School" right after a coursework bullet: a new education entry
      if (wrappedTail && /^[A-Z]/.test(line) && line.length <= 80 && INSTITUTION_RE.test(line) && !/[,;-]$/.test(line)) {
        wrappedTail = false;
      }
      if (wrappedTail && lastNonEmptyIndex >= 0) {
        t[lastNonEmptyIndex] = prev + ' ' + line;
        prev = t[lastNonEmptyIndex];
      } else {
        t.push(line);
        lastNonEmptyIndex = t.length - 1;
        prev = line;
        inBullet = isBullet(line);
      }
    });
    const nextNonEmpty = new Array(t.length);
    let next = '';
    for (let i = t.length - 1; i >= 0; i--) {
      nextNonEmpty[i] = next;
      if (t[i]) {
        next = t[i];
      }
    }

    const blocks = [];
    let cur = null;
    let lastCompany = '';

    t.forEach((line, i) => {
      if (!line) {
        return;
      }

      const bulleted = isBullet(line);

      // LinkedIn layout:  Company / Role / "Mar 2026 - Present (3 months)" / Location / bullets
      if (!bulleted && isDateOnly(line)) {
        const pulled = [];
        while (cur && pulled.length < 3 && cur.bullets.length && plainLine(cur.bullets[cur.bullets.length - 1])) {
          pulled.unshift(cur.bullets.pop());
        }
        let titles = pulled.filter(l => !DURATION_ONLY.test(l));
        if (cur && titles.length > 2) {
          // only the last two lines can be company / role; the rest were ordinary lines
          const extra = titles.slice(0, titles.length - 2);
          cur.bullets.push(...extra);
          titles = titles.slice(-2);
        }
        if (cur && !cur.header.length && !cur.bullets.length) {
          blocks.pop();
        }
        let header;
        if (titles.length >= 2) {
          lastCompany = titles[0];
          header = [`${titles[0]}   ${line}`, ...titles.slice(1)];
        } else if (titles.length === 1 && lastCompany && ROLE_WORD.test(titles[0])) {
          header = [`${lastCompany} – ${titles[0]}   ${line}`];
        } else if (titles.length === 1) {
          header = [`${titles[0]}   ${line}`];
        } else {
          header = [line];
        }
        cur = { header, bullets: [], afterDate: true };
        blocks.push(cur);
        return;
      }

      // location line right under a date line ("India", "Remote, India")
      if (
        cur &&
        cur.afterDate &&
        !cur.bullets.length &&
        plainLine(line) &&
        /^[A-Z][A-Za-z .,&-]{1,30}$/.test(line) &&
        !ROLE_WORD.test(line) &&
        !isDateOnly(nextNonEmpty[i])
      ) {
        cur.header.push(line);
        cur.afterDate = false;
        return;
      }

      const hasSig =
        !DETAIL_RE.test(line) && !bulleted && line.length < 160 && HEADER_SIG.test(line) && !GRADE_TAIL.test(line);

      const nextLine = nextNonEmpty[i];

      const isBareTitleBeforeBullets =
        !DETAIL_RE.test(line) && !bulleted && !hasSig && line.length < 160 && !!nextLine && isBullet(nextLine);

      // an institution line after a finished entry ("Sanskar International School") opens a new education entry
      const isInstitution =
        !bulleted && !hasSig && /^[A-Z]/.test(line) && line.length <= 80 && INSTITUTION_RE.test(line) && !/[.!?,;:]$/.test(line) && !!cur && cur.bullets.length > 0;

      const isHeader = hasSig || isBareTitleBeforeBullets || isInstitution;

      const wrapped =
        cur && !cur.bullets.length && cur.header.length && /[-–—]\s*$/.test(cur.header[cur.header.length - 1].trim());

      if (cur) {
        cur.afterDate = false;
      }

      if (
        !hasSig &&
        cur &&
        !cur.bullets.length &&
        cur.header.length >= 1 &&
        cur.header.length < 4 &&
        (HEADER_SIG.test(cur.header[0]) || (INSTITUTION_RE.test(cur.header[0]) && DEGREE_LINE_RE.test(line))) &&
        plainLine(line) &&
        line.length <= 60 &&
        (!/\d/.test(line) || GRADE_TAIL.test(line)) &&
        !isDateOnly(nextNonEmpty[i])
      ) {
        // role / location / institution line directly under a dated company or degree row
        cur.header.push(line);
        return;
      }

      if (isHeader && wrapped) {
        cur.header.push(line);
      } else if (isHeader && cur && !cur.header.length && cur.bullets.length && cur.bullets.every(plainLine) && cur.bullets.length <= 2) {
        // "College" / "Degree (2024 - 2027)": the plain line above a dated line belongs to its header
        cur.header = [...cur.bullets, line];
        cur.bullets = [];
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

  const MON = '(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?';

  const DPH = `(?:${MON}\\s+)?(?:(?:19|20)\\d{2}|'\\d{2}|\\d{1,2}\\/\\d{2,4})`;

  const DATE_RE = new RegExp(
    `(\\b${MON}\\s*(?:–|—|-|to)\\s*${DPH}|${DPH}\\s*(?:–|—|-|to)\\s*(?:${DPH}|ongoing|present)|\\(\\s*(?:ongoing|present)\\s*\\)|${DPH}\\s*$)`,
    'i'
  );

  function splitHeader(line) {
    const t = String(line ?? '').trim();
    const match = t.match(DATE_RE);

    const clean = value =>
      value
        .split('|')
        .map(x => x.trim())
        .filter(Boolean)
        .join(' · ');

    if (!match) {
      const [head, ...stack] = t.split(/\s{3,}/);
      return { title: clean(head), date: stack.join(' · ') };
    }

    const tail = t.slice(match.index + match[0].length).replace(/^[\s|]+|[\s|]+$/g, '');

    const date = match[0].replace(/^\(|\)$/g, '').trim();

    return {
      title: clean(t.slice(0, match.index)),
      date: tail ? `${date}${tail.startsWith('(') ? ' ' : ' · '}${tail}` : date,
    };
  }

  // ============================================================
  // SCORING HELPERS
  // ============================================================

  const score = (line, keywords) =>
    keywords.reduce((count, keyword) => count + (pattern(keyword).test(line) ? 1 : 0), 0);

  const relevant = (lines, keywords) => {
    const matched = lines.filter(line => score(line, keywords) > 0);

    return matched.length ? matched : lines;
  };

  const byScore = (lines, keywords) =>
    lines
      .map((line, index) => ({
        line,
        index,
        score: score(line, keywords),
      }))
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .map(item => item.line);

  // ============================================================
  // SKILLS LINE FILTERING
  // ============================================================

  function narrowSkills(line, keywords) {
    const content = stripBullets(line);

    const match = content.match(/^([^:]{2,30}):\s*(.+)$/);

    const items = (match ? match[2] : content)
      .split(/,|\|/)
      .map(item => item.trim())
      .filter(Boolean);

    if (items.length <= 1) {
      return content;
    }

    const kept = items.filter(item => score(item, keywords) > 0);

    const finalItems = kept.sort((a, b) => score(b, keywords) - score(a, keywords));

    return match ? `${match[1]}: ${finalItems.join(', ')}` : finalItems.join(', ');
  }

  // ============================================================
  // TAILOR RESUME
  // ============================================================

  function tailor(resumeText, jd) {
    const keywords = jd ? extractKeywords(jd) : [];

    const sections = parseSections(resumeText).map(section => {
      if (!REORDER.has(section.key)) {
        return section;
      }

      const lines =
        section.key === 'skills'
          ? byScore(
            section.lines.filter(line => line.trim()),
            keywords
          )
          : splitBlocks(section.lines).flatMap(block => [...block.header, ...byScore(block.bullets, keywords)]);

      return {
        ...section,
        lines,
      };
    });

    return {
      sections,
      keywords,
    };
  }

  // ============================================================
  // HIGHLIGHT KEYWORDS
  // ============================================================

  let highlightCache = { key: null, regex: null };

  function highlight(text, keywords) {
    if (!keywords.length) {
      return escHtml(text);
    }

    // the same keyword list is used for every line of a resume: compile the regex once
    const cacheKey = keywords.join('\u0000');
    if (highlightCache.key !== cacheKey) {
      const alternatives = [...keywords]
        .flatMap(keyword => [canonicalize(keyword), ...(VARIANTS.get(canonicalize(keyword)) || [])])
        .map(norm)
        .filter((value, index, all) => all.indexOf(value) === index)
        .sort((a, b) => b.length - a.length)
        .map(esc)
        .join('|');
      highlightCache = { key: cacheKey, regex: new RegExp(`(^|[^a-z0-9])(?:${alternatives})(?![a-z0-9])`, 'gi') };
    }
    const regex = highlightCache.regex;
    regex.lastIndex = 0;

    let output = '';
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text))) {
      const prefix = match[1] || '';
      const start = match.index + prefix.length;
      output +=
        escHtml(text.slice(lastIndex, start)) + `<mark class="kw-hit">${escHtml(match[0].slice(prefix.length))}</mark>`;
      lastIndex = match.index + match[0].length;
    }

    return output + escHtml(text.slice(lastIndex));
  }

  // ============================================================
  // RENDER HTML
  // ============================================================

  // ============================================================
  // CONTACT ITEMS + ICONS (templates with icons: true)
  // ============================================================

  // Icons are inline vector SVG: they print crisply and add no text for an ATS parser to trip over.
  const iconSvg = kind => (Icons ? Icons.svg(kind) : '');

  const WEB_RE = /^(?:https?:\/\/|www\.)|\.(?:com|in|io|dev|app|me|net|org|co|tech|ai|xyz|vercel\.app)(?:\/|$)/i;

  function contactKind(item) {
    const t = String(item).replace(/\s+/g, '');
    if (/@/.test(t)) {
      return 'email';
    }
    if (/linkedin\.com/i.test(t)) {
      return 'linkedin';
    }
    if (/github\.com/i.test(t)) {
      return 'github';
    }
    if (WEB_RE.test(t)) {
      return 'web';
    }
    if (hasPhone(item)) {
      return 'phone';
    }
    return '';
  }

  // "City, State, Country" style text (no digits, short, comma separated)
  const looksLikeLocation = l => l.length <= 60 && !/\d/.test(l) && /^[A-Za-z][A-Za-z .'-]*(?:,\s*[A-Za-z][A-Za-z .'-]*){0,3}$/.test(l);

  // header lines -> [{ kind, text }]. kind is '' for a plain tagline / headline (no icon).
  function contactItems(lines) {
    const items = [];
    const add = (kind, text) => {
      const t = text.replace(/^[\s|·•,;-]+|[\s|·•,;-]+$/g, '').trim();
      if (t && !items.some(i => i.text.toLowerCase() === t.toLowerCase())) {
        items.push({ kind, text: t });
      }
    };
    lines.forEach(line => {
      const parts = line.split(/\s+[|·•]\s+|\s{3,}/).map(p => p.trim()).filter(Boolean);
      const kinds = parts.map(contactKind);
      if (!kinds.some(Boolean)) {
        // no email / phone / link: a location or a headline, keep the line whole
        add(looksLikeLocation(line) ? 'location' : '', line);
        return;
      }
      parts.forEach((p, i) => add(kinds[i] || (looksLikeLocation(p) ? 'location' : ''), p));
    });
    return items;
  }

  const contactItemHtml = item =>
    `<span class="cv-ci">${item.kind ? iconSvg(item.kind) : ''}<span class="cv-nw">${escHtml(item.text)}</span></span>`;

  // Sections that live in the narrow column of a two-column template.
  const SIDEBAR_KEYS = ['skills', 'education', 'certifications'];

  function renderHTML(sections, keywords, options = {}) {
    const { layout = 'single', icons = false, sidebar = SIDEBAR_KEYS } = options;
    if (layout === 'sidebar' || layout === 'sidebar-left' || layout === 'sidebar-right') {
      const total = sections.length;
      const part = list => renderHTML(list, keywords, { ...options, layout: 'single', _total: total });
      const header = sections.filter(sec => sec.key === 'header');
      const body = sections.filter(sec => sec.key !== 'header');
      const main = body.filter(sec => !sidebar.includes(sec.key));
      const side = body.filter(sec => sidebar.includes(sec.key));
      if (!side.length || !main.length) {
        return part(sections);
      }
      // main column first in the document, so text extraction reads Summary / Experience before the sidebar
      const place = layout === 'sidebar-right' ? 'cv-side-right' : 'cv-side-left';
      return `${part(header)}<div class="cv-cols ${place}"><div class="cv-main">${part(main)}</div><div class="cv-side">${part(side)}</div></div>`;
    }
    const { highlight: enableHighlight = true, jdOnly = false, _total } = options;
    const sectionCount = _total || sections.length;
    const H = text => highlight(text, enableHighlight ? keywords : []);

    let html = '';

    sections.forEach(section => {
      const lines = section.lines.map(line => line.trim()).filter(Boolean);

      // Header
      if (section.key === 'header') {
        if (!lines.length) {
          return;
        }

        const [name, ...rest] = lines;

        const show = rest
          .reduce((a, l) => {
            const prevLine = a[a.length - 1];
            const headlineWrap = a.length && prevLine.includes('|') && l.includes('|') && !/@|\.com|\d{5}/.test(l);
            if (a.length && (/[|,]\s*$/.test(prevLine) || headlineWrap)) {
              a[a.length - 1] += ' ' + l;
            } else {
              a.push(l);
            }
            return a;
          }, [])
          .map(l => l.replace(/\s*\|\s*$/, ''));

        html += `<div class="cv-name">${escHtml(name)}</div>`;

        // No section heading was recognised at all: show the text as it is instead of gluing it into one line.
        if (sectionCount === 1 && rest.length > 8) {
          const [first, second, ...others] = show;
          html += `<div class="cv-contact">${escHtml([first, second].filter(Boolean).join(' · '))}</div>`;
          others.forEach(l => {
            html += `<p class="cv-line">${H(stripBullets(l))}</p>`;
          });
          return;
        }

        // header blocks are a few lines; skip the O(n^2) de-duplication for pathological input
        const uniqueShow =
          show.length > 30
            ? show
            : show.filter(
              (l, i) => !show.some((o, j) => j !== i && o.length > l.length && o.toLowerCase().includes(l.toLowerCase()))
            );

        if (uniqueShow.length && icons) {
          const items = contactItems(uniqueShow);
          const tagline = items.filter(i => !i.kind);
          const contact = items.filter(i => i.kind);
          if (tagline.length) {
            html += `<div class="cv-tagline">${tagline.map(i => escHtml(i.text)).join(' · ')}</div>`;
          }
          html += `<div class="cv-contact cv-contact-icons">${contact.map(contactItemHtml).join('')}</div>`;
        } else if (uniqueShow.length) {
          // short items stay whole when the line wraps (never split a URL at its hyphen)
          const item = l => (l.length <= 42 ? `<span class="cv-nw">${escHtml(l)}</span>` : escHtml(l));
          const line = l => l.split(/\s+\|\s+/).map(item).join(' | ');
          html += `<div class="cv-contact">${uniqueShow.map(line).join(' · ')}</div>`;
        }

        return;
      }

      const filtered = jdOnly && keywords.length > 0 && REORDER.has(section.key);

      html += '<div class="cv-section">';

      const prettyTitle = (section.title || '').replace(/[:\s]+$/, '').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
      html += `<div class="cv-section-title">${escHtml(
        (section.key === 'other' && prettyTitle) || TITLES[section.key] || prettyTitle
      )}</div>`;

      // Skills
      if (section.key === 'skills') {
        (filtered ? relevant(lines, keywords) : lines).forEach(line => {
          html += `<p class="cv-skills-line">${H(filtered ? narrowSkills(line, keywords) : stripBullets(line))}</p>`;
        });
      }

      // Summary
      else if (section.key === 'summary') {
        html += `<p class="cv-line">${H(lines.join(' '))}</p>`;
      }

      // Experience / Projects / Other
      else {
        splitBlocks(section.lines).forEach(block => {
          block.header
            .map(header => header.trim())
            .filter(Boolean)
            .forEach((header, headerIndex) => {
              const { title, date } = splitHeader(header);
              if (headerIndex > 0 && title && !/\b(?:19|20)\d{2}\b/.test(date)) {
                // role / location line under a company row: quieter than the company line
                html += date
                  ? `<div class="cv-block-header-row"><span class="cv-block-sub-title">${H(title)}</span><span class="cv-block-date">${escHtml(date)}</span></div>`
                  : `<div class="cv-block-sub">${H(title)}</div>`;
                return;
              }
              if (!title && date) {
                html += `<div class="cv-block-date-only">${escHtml(date)}</div>`;
                return;
              }
              html +=
                '<div class="cv-block-header-row">' +
                `<span class="cv-block-title">${H(title)}</span>` +
                `${date ? `<span class="cv-block-date">${escHtml(date)}</span>` : ''}` +
                '</div>';
            });

          const items = (filtered ? relevant(block.bullets, keywords) : block.bullets)
            .map(stripBullets)
            .filter(Boolean);

          if (items.length) {
            html += '<ul class="cv-bullets">' + items.map(item => `<li>${H(item)}</li>`).join('') + '</ul>';
          }
        });
      }

      html += '</div>';
    });

    return html;
  }

  // ============================================================
  // RENDER TEXT
  // ============================================================

  function renderText(sections, keywords, { jdOnly = false } = {}) {
    const output = [];

    sections.forEach(section => {
      if (section.title) {
        output.push(section.title);
      }

      const lines = section.lines.filter(line => line.trim());

      const filtered = jdOnly && keywords.length > 0 && REORDER.has(section.key);

      if (section.key === 'skills') {
        output.push(
          ...(filtered ? relevant(lines, keywords).map(line => narrowSkills(line, keywords)) : lines.map(stripBullets))
        );
      } else if (section.key === 'summary') {
        output.push(lines.map(line => line.trim()).join(' '));
      } else if (!REORDER.has(section.key)) {
        output.push(...lines.map(bulletize));
      } else {
        splitBlocks(section.lines).forEach(block => {
          output.push(
            ...block.header,

            ...(filtered ? relevant(block.bullets, keywords) : block.bullets).map(bulletize)
          );
        });
      }
    });

    return output
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  // ============================================================
  // ACTION VERBS
  // ============================================================

  const VERB_WORDS = [
    'managed',
    'manage',
    'managing',
    'led',
    'lead',
    'leading',
    'developed',
    'develop',
    'developing',
    'created',
    'create',
    'creating',
    'improved',
    'improve',
    'improving',
    'increased',
    'increase',
    'increasing',
    'reduced',
    'reduce',
    'reducing',
    'achieved',
    'achieve',
    'achieving',
    'designed',
    'design',
    'designing',
    'implemented',
    'implement',
    'implementing',
    'built',
    'build',
    'building',
    'launched',
    'launch',
    'launching',
    'coordinated',
    'coordinate',
    'coordinating',
    'analyzed',
    'analysed',
    'analyze',
    'analyse',
    'analyzing',
    'analysing',
    'delivered',
    'deliver',
    'delivering',
    'streamlined',
    'streamline',
    'streamlining',
    'optimized',
    'optimised',
    'optimize',
    'optimise',
    'optimizing',
    'optimising',
    'spearheaded',
    'spearhead',
    'spearheading',
    'initiated',
    'initiate',
    'initiating',
    'executed',
    'execute',
    'executing',
    'drove',
    'drive',
    'driving',
    'driven',
    'generated',
    'generate',
    'generating',
    'negotiated',
    'negotiate',
    'negotiating',
    'mentored',
    'mentor',
    'mentoring',
    'trained',
    'train',
    'training',
    'automated',
    'automate',
    'automating',
    'architected',
    'architect',
    'architecting',
    'orchestrated',
    'orchestrate',
    'orchestrating',
    'resolved',
    'resolve',
    'resolving',
    'established',
    'establish',
    'establishing',
    'deployed',
    'deploy',
    'deploying',
    'integrated',
    'integrate',
    'integrating',
    'engineered',
    'engineer',
    'engineering',
    'collaborated',
    'collaborate',
    'collaborating',
    'wrote',
    'write',
    'writing',
    'configured',
    'configure',
    'configuring',
    'organized',
    'organised',
    'organize',
    'organise',
    'organizing',
    'organising',
    'maintained',
    'maintain',
    'maintaining',
    'migrated',
    'migrate',
    'migrating',
    'refactored',
    'refactor',
    'refactoring',
    'debugged',
    'debug',
    'debugging',
    'documented',
    'document',
    'documenting',
    'researched',
    'research',
    'researching',
    'presented',
    'present',
    'presenting',
    'scaled',
    'scale',
    'scaling',
    'secured',
    'secure',
    'securing',
    'contributed',
    'contribute',
    'contributing',
    'participated',
    'participate',
    'participating',
  ];

  const VERB_START = new RegExp(`^(?:${VERB_WORDS.join('|')})\\b`, 'i');

  // ============================================================
  // RESUME ANALYSIS
  // ============================================================

  function analyze(rawResume, jd) {
    const resume = cleanExtractedText(rawResume);
    const sections = parseSections(resume);

    const keys = new Set(sections.map(section => section.key));

    const checks = {
      contact: EMAIL_RE.test(resume) || hasPhone(resume),

      experience: keys.has('experience'),

      education: keys.has('education'),

      projects: keys.has('projects'),
    };

    const passed = Object.values(checks).filter(Boolean).length;
    const words = resume.split(/\s+/).filter(Boolean).length;
    const bullets = resume.split('\n').filter(isBullet).length;
    const verbs = resume
      .split(/\n/)
      .filter(isBullet)
      .reduce((count, line) => count + (VERB_START.test(stripBullets(line)) ? 1 : 0), 0);
    const QUANT_UNITS =
      'k|m|ms|s|sec|secs|seconds|min|mins|minutes|hrs?|hours?|days?|weeks?|months?|years?|users?|customers?|clients?|members?|requests?|records?|rows?|people|engineers?|developers?|teams?';
    const quant = (
      resume.match(
        new RegExp(
          `\\d+(\\.\\d+)?\\s?%|[$₹]\\s?\\d[\\d,]*|\\b\\d+(\\.\\d+)?x\\b|\\b\\d+\\+(?=\\s)|\\b\\d+(?:\\.\\d+)?\\s?(?:${QUANT_UNITS})\\b`,
          'gi'
        )
      ) || []
    ).length;
    const contentSignals = Math.min(
      1,
      (Math.min(bullets, 5) / 5) * 0.5 + (Math.min(verbs, 5) / 5) * 0.3 + (Math.min(quant, 2) / 2) * 0.2
    );

    // ==========================================================
    // JD MODE
    // ==========================================================

    if (jd) {
      const keywords = extractKeywords(jd);

      const matched = keywords.filter(keyword => pattern(keyword).test(resume));

      const missing = keywords.filter(keyword => !matched.includes(keyword));

      const bodyKeys = new Set(['experience', 'projects', 'summary']);
      const skillsText = sections
        .filter(section => section.key === 'skills')
        .map(section => section.lines.join('\n'))
        .join('\n');
      const bodyText = sections
        .filter(section => bodyKeys.has(section.key))
        .map(section => section.lines.join('\n'))
        .join('\n');

      const weights = keywords.map(keyword => {
        if (pattern(keyword).test(bodyText)) {
          return 1;
        }
        if (pattern(keyword).test(skillsText)) {
          return 0.5;
        }
        return 0;
      });
      const weightedCoverage = keywords.length ? weights.reduce((a, b) => a + b, 0) / keywords.length : 0;

      const structureCoverage = passed / 4;
      const scoreBreakdown = {
        'keyword coverage': Math.round(weightedCoverage * 100),
        'structure checks': Math.round(structureCoverage * 100),
        'content signals': Math.round(contentSignals * 100),
      };

      const lowRelevance = keywords.length > 0 && weightedCoverage < 0.25;

      return {
        mode: 'jd',

        score: Math.round(weightedCoverage * 60 + structureCoverage * 25 + contentSignals * 15),
        jobMatch: Math.round(weightedCoverage * 100),
        atsReadiness: Math.round((structureCoverage * 0.6 + contentSignals * 0.4) * 100),
        scoreBreakdown,
        methodology:
          'Estimate: 60% JD keyword coverage (full credit when a keyword is demonstrated in Experience/Projects/Summary, half credit when it only appears in the Skills list), 25% resume structure checks, 15% content signals (bullets, action verbs, measurable results). Not a prediction of recruiter or ATS decisions.',

        matched,
        missing,
        checks,

        noKeywords: keywords.length === 0,
        lowRelevance,
      };
    }

    // ==========================================================
    // GENERAL RESUME MODE
    // ==========================================================

    const okLen = words >= 300 && words <= 900;

    const tier = (ok, count) => (ok ? 15 : count > 0 ? 7 : 0);

    const tips = [];

    if (sections.length <= 1 && words > 40) {
      tips.push('No section headings were detected: put Summary, Skills, Experience, Education and Projects on their own lines');
    }

    if (!checks.contact) {
      tips.push('Add a clear email and phone number');
    }

    if (!checks.experience) {
      tips.push('Add a labeled Experience or Internship section');
    }

    if (!checks.education) {
      tips.push('Add a labeled Education section');
    }

    if (!checks.projects) {
      tips.push('Add a Projects section if relevant');
    }

    if (!okLen) {
      tips.push(words < 300 ? 'Resume is short: aim for 300-900 words' : 'Resume is long: aim for 300-900 words');
    }

    if (bullets < 3) {
      tips.push('Use bullet points instead of paragraphs');
    }

    if (verbs < 3) {
      tips.push('Start bullets with action verbs (built, led, improved)');
    }

    if (quant < 2) {
      tips.push('Add real numbers (%, users, time saved) where you know them');
    }

    const total = Math.round(
      (passed / 4) * 40 +
        tier(okLen, words) +
        tier(bullets >= 3, bullets) +
        tier(verbs >= 3, verbs) +
        tier(quant >= 2, quant)
    );

    return {
      mode: 'general',

      score: total,
      jobMatch: null,
      atsReadiness: total,
      scoreBreakdown: {
        'structure checks': Math.round((passed / 4) * 100),
        length: Math.round((okLen ? 1 : words > 0 ? 0.5 : 0) * 100),
        'bullet quality': Math.round((bullets >= 3 ? 1 : bullets > 0 ? 0.5 : 0) * 100),
        'action verbs': Math.round((verbs >= 3 ? 1 : verbs > 0 ? 0.5 : 0) * 100),
        'measurable results': Math.round((quant >= 2 ? 1 : quant > 0 ? 0.5 : 0) * 100),
      },
      methodology:
        'Estimate: structure 40%, length 15%, bullets 15%, action verbs 15%, measurable results 15%. This is a writing-quality heuristic, not a prediction of ATS or recruiter decisions.',

      matched: KEYWORDS.filter(keyword => pattern(keyword).test(resume)),

      missing: tips,

      checks,
    };
  }

  // ============================================================
  // COVER LETTER GENERATOR
  // ============================================================

  function firstMatch(text, regex) {
    // Use matchAll to avoid global regex lastIndex issues
    const m = String(text || '').match(regex);
    return m ? String(m[1] || m[0]).trim() : '';
  }

  function extractJobProfile(jd) {
    const text = String(jd || '').trim();
    const title = firstMatch(text, /(?:job\s*title|position|role)\s*[:-]\s*([^\n|]{2,80})/i) ||
      firstMatch(text, /(?:hiring|looking for|seeking)\s+(?:an?|the)?\s*([A-Za-z][A-Za-z .&/-]{2,70}?)(?:\s+(?:to|who|with|for)\b|[.\n])/i) ||
      'the position';
    const company = firstMatch(text, /(?:company|employer|organization)\s*[:-]\s*([^\n|]{2,80})/i) || 'your organization';
    return { title, company };
  }


  const DATE_TAIL = /\s*(?:\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+)?\b(?:19|20)\d{2}\b.*$/i;
  const ROLE_RE =
    /^(.*?\b(?:developer|engineer|intern|analyst|designer|consultant|trainee|associate|architect|tester|programmer|scientist|administrator|specialist|lead|manager)s?(?:\s+(?:intern|trainee|apprentice))?)\b/i;
  const tidyCase = v => (/[a-z]/.test(v) && v === v.toLowerCase() ? v.replace(/\b\w/g, c => c.toUpperCase()) : v);
  const joinList = items => (items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}` : items[0] || '');

  function extractResumeProfile(resumeText) {
    const text = cleanExtractedText(resumeText).trim();
    const lines = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    const email = firstMatch(text, EMAIL_RE);
    const phone = findPhone(text);
    const rawName =
      lines.find(line => {
        const clean = line.replace(/[^A-Za-z .'-]/g, ' ').replace(/\s+/g, ' ').trim();
        return (
          clean &&
          clean.split(/\s+/).length >= 2 &&
          clean.split(/\s+/).length <= 5 &&
          !/@/.test(clean) &&
          !/\d/.test(clean) &&
          !/^(resume|curriculum vitae|cv)$/i.test(clean)
        );
      }) || 'Candidate';
    const name = /[a-z]/.test(rawName) ? rawName : tidyCase(rawName.toLowerCase());

    const sections = parseSections(text);
    const linesOf = key => {
      const sec = sections.find(s => s.key === key);
      return sec ? sec.lines.map(l => l.trim()).filter(Boolean) : [];
    };

    // "Backend: Spring Boot, REST APIs" -> ["Spring Boot", "REST APIs"] (labels removed, known technologies first)
    const known = item => KEYWORDS.some(k => canonicalize(k) === canonicalize(item));
    const items = [];
    linesOf('skills').forEach(l =>
      stripBullets(l)
        .replace(/^[A-Za-z][A-Za-z &/.+-]{1,38}:\s*/, '')
        .split(/[,|;•]/)
        .map(v => v.replace(/\s+/g, ' ').replace(/\s*\([A-Z]{2,6}\)$/, '').trim())
        .filter(Boolean)
        .forEach(v => {
          if (!items.some(x => x.toLowerCase() === v.toLowerCase())) {
            items.push(v);
          }
        })
    );
    const skillItems = [...items.filter(known), ...items.filter(v => !known(v))];

    const projectTitle = (linesOf('projects').find(l => !isBullet(l)) || '')
      .split(/\s+[|—–]\s+/)[0]
      .replace(/\s+(?:19|20)\d{2}\s*$/, '')
      .replace(/[.]+$/, '')
      .trim();

    return {
      name,
      email,
      phone,
      skills: skillItems.join(', '),
      skillItems,
      projects: projectTitle ? [projectTitle] : [],
      experience: linesOf('experience').map(stripBullets).slice(0, 6),
      education: linesOf('education').map(stripBullets).slice(0, 6),
    };
  }

  function describeExperience(rows) {
    const list = rows.filter(l => l && !isBullet(l)).slice(0, 3);
    if (!list.length) {
      return '';
    }
    const current = /\b(?:present|current(?:ly)?)\b/i.test(list.join(' '));
    const strip = l =>
      l
        .replace(DATE_TAIL, '')
        .replace(/\s*\(\s*\d+\s*(?:months?|years?|yrs?|mos?)[^)]*\)/gi, '')
        .replace(/\s{2,}.*$/, '')
        .trim();
    const first = strip(list[0]);
    const second = list[1] ? strip(list[1]) : '';
    let role = '';
    let company = '';
    if (ROLE_RE.test(first) && /\s(?:-|–|—|\||@|at)\s/.test(first)) {
      const [x, y] = first.split(/\s+(?:-|–|—|\||@|at)\s+/);
      [role, company] = ROLE_RE.test(x) || !ROLE_RE.test(y || '') ? [x, y || ''] : [y, x];
    } else if (!ROLE_RE.test(first) && ROLE_RE.test(second)) {
      company = first;
      role = second.match(ROLE_RE)[1];
    } else if (ROLE_RE.test(first)) {
      role = first.match(ROLE_RE)[1];
      company = second;
    } else {
      company = first;
    }
    role = tidyCase(role.trim());
    company = tidyCase(company.trim());
    if (role && company) {
      return ` ${current ? 'I am currently working' : 'I have worked'} as ${/^[aeiou]/i.test(role) ? 'an' : 'a'} ${role} at ${company}.`;
    }
    return company ? ` My experience also includes ${company}.` : '';
  }

  function describeEducation(rows) {
    const list = rows.filter(l => l && !isBullet(l)).slice(0, 4);
    if (!list.length) {
      return '';
    }
    const DEG = /\b(?:b\.?\s?tech|b\.?\s?e|b\.?\s?sc|b\.?\s?com|bca|mca|m\.?\s?tech|m\.?\s?sc|mba|bachelor|master|diploma|phd)\b/i;
    const INST = /\b(?:university|college|institute|school|academy|polytechnic)\b/i;
    const clean = l => l.replace(DATE_TAIL, '').replace(/\s{2,}.*$/, '').replace(/[\s·•]+$/, '').trim();
    const degRow = list.find(l => DEG.test(l));
    const instRow = list.find(l => INST.test(l) && l !== degRow);
    const degree = degRow ? clean(degRow).replace(/^(.*?\))\s+.*$/, '$1') : '';
    const institution = instRow ? clean(instRow).split(',')[0].trim() : '';
    const years = (list.join(' ').match(/\b(?:19|20)\d{2}\b/g) || []).map(Number);
    const pursuing = /\b(?:present|current(?:ly)?|pursuing)\b/i.test(list.join(' ')) || Math.max(0, ...years) >= new Date().getFullYear();
    if (degree && institution) {
      return pursuing ? ` I am currently pursuing ${degree} at ${institution}.` : ` I hold ${degree} from ${institution}.`;
    }
    if (degree) {
      return pursuing ? ` I am currently pursuing ${degree}.` : ` I hold ${degree}.`;
    }
    const fallback = clean(instRow || list[0]);
    return fallback ? ` I am also continuing my studies at ${fallback}.` : '';
  }

  function generateCoverLetter(resumeText, jd = '') {
    const text = cleanExtractedText(resumeText);
    const profile = extractResumeProfile(text);
    const job = extractJobProfile(jd);
    const keywords = jd ? extractKeywords(jd).filter(k => pattern(k).test(text)).slice(0, 6) : [];
    const relevant = keywords.length ? keywords : profile.skillItems.slice(0, 5);
    const projectLine = profile.projects[0]
      ? ` Through my project work, including ${profile.projects[0]}, I have applied these skills in practical, hands-on work.`
      : '';
    const experienceLine = describeExperience(profile.experience);
    let educationLine = describeEducation(profile.education);
    if (/^ I am currently working/.test(experienceLine)) {
      educationLine = educationLine.replace(/^ I am currently pursuing/, ' Alongside this, I am pursuing');
    }
    const skillLine = relevant.length
      ? ` My background includes ${joinList(relevant)}, which aligns with the capabilities relevant to this role.`
      : ' My background has given me a strong foundation in software development and problem solving.';
    const intro = jd
      ? `I am writing to express my interest in the ${job.title} opportunity at ${job.company}. Based on my background and the requirements described for this role, I believe my skills and project experience are relevant to the position.`
      : `I am writing to express my interest in software development opportunities at ${job.company}. I would welcome the opportunity to contribute my technical skills, project experience, and willingness to learn to your team.`;

    return [
      profile.name,
      [profile.email, profile.phone].filter(Boolean).join(' | '),
      '',
      'Dear Hiring Manager,',
      '',
      intro,
      '',
      (skillLine + projectLine + experienceLine + educationLine).trim(),
      '',
      'I am particularly interested in an opportunity where I can continue developing as a software professional while contributing to meaningful products and working collaboratively with the team. I would be glad to discuss how my background could support your team.',
      '',
      'Thank you for considering my application. I look forward to the opportunity to discuss my qualifications further.',
      '',
      'Sincerely,',
      profile.name,
    ]
      .filter((line, index, arr) => line !== '' || (index > 0 && arr[index - 1] !== ''))
      .join('\n');
  }

  // ============================================================
  // PUBLIC API (EXPORT ALL FOR TESTING)
  // ============================================================

  return {
    KEYWORDS,

    extractKeywords,

    splitSkillPhrase,

    parseSections,

    cleanExtractedText,

    pageText,

    splitBlocks,

    splitHeader,

    tailor,

    analyze,

    generateCoverLetter,

    renderHTML,

    contactItems,

    SIDEBAR_KEYS,

    renderText,

    stripBullets,

    isBullet,

    contactKind,

    TITLES,

    findPhone,

    // Exported for testing
    isUsable,
    canonicalize,
    pattern,
    norm,
    esc,
    escHtml,
    PHONE_RE,
    hasPhone,
    EMAIL_RE,
    STOP,
    GENERIC,
    CANONICAL,
    VARIANTS,
    VERB_WORDS,
    VERB_START,
  };
});
