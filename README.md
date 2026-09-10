# ATS Resume Tracker, Matcher & Tailor

A free, fully client‑side resume analyzer that scores your resume against a job description (or on its own) using ATS‑style keyword matching and formatting checks — then can **reorder your own resume content to match the JD**, all in the browser, with no backend and no data ever leaving your device.

🔗 **Live demo:** [ats-resume-checker-with-job-descrip.vercel.app](https://ats-resume-checker-with-job-descrip.vercel.app/)

---

## Features

### Scoring
- **Two analysis modes**
  - **JD Match Mode** — paste a job description and get a keyword match score, with matched vs. missing skills tagged. Score = `(matched keywords / total keywords × 80) + (structure checklist / 4 × 20)`.
  - **General ATS Mode** — no job description? Get a standalone ATS‑friendliness score built from a structure checklist (40 pts) plus length, bullet usage, action‑verb usage, and quantified achievements (15 pts each).
- **Multi‑format resume upload** — `.pdf`, `.docx`, and `.txt` (up to 5MB), with drag‑and‑drop.
- **Client‑side text extraction** — PDF.js for PDFs, Mammoth.js for DOCX; parsing happens entirely in the browser.
- **Smart JD keyword extraction** — combines a canonical skills dictionary, signal‑phrase detection ("experience with X", "proficiency in Y"), and recurring capitalized‑term detection.
- **Resume quality checklist** — contact info, Experience, Education, and Projects sections.
- **Writing‑quality signals** — word count, bullet‑point usage, action verbs (led, built, improved, launched…), and quantified achievements (%, ₹/$, multipliers).
- **Visual score report** — animated circular score meter, matched/missing keyword tags, and actionable suggestions.

### Resume Tailoring (reorder‑only, no content invented)
- **"Generate Tailored Resume"** parses your resume into sections (Summary, Skills, Experience, Projects, Education, Certifications) using header‑pattern matching, then re‑orders bullets and blocks within each section by relevance to the JD's extracted keywords — it never fabricates new bullet content.
- Handles messy real‑world resume formats: mixed bullet glyphs (•, ●, ‣, -, * …), inline "Company | Role — Mar '25 – Present" style headers, and multi‑job/multi‑project sections split into individual blocks.
- **Live preview** rendered as an actual resume layout, with a **"highlight JD keywords"** toggle and a **"show JD-relevant bullets only"** toggle.
- **Print, copy as plain text, or download** the tailored resume directly from the preview.

### Privacy
- **100% private** — no server, no database, no API calls. Your resume and JD never leave your browser.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Markup / Styling | HTML5, [Tailwind CSS](https://tailwindcss.com/) (CDN) |
| Icons | [Font Awesome 6](https://fontawesome.com/) |
| PDF Parsing | [PDF.js](https://mozilla.github.io/pdf.js/) |
| DOCX Parsing | [Mammoth.js](https://github.com/mwilliamson/mammoth.js) |
| Logic | Vanilla JavaScript (no framework, no build step) |

This is a **single‑file static application** — everything lives in `Ats resume checker/index.html`. There is no backend, no package manager, and no build process.

---

## Getting Started

### Run locally

No installation required.

```bash
git clone https://github.com/Ra-kumar4216/Ats-resume-checker-with-job-description.git
cd "Ats-resume-checker-with-job-description/Ats resume checker"
```

Then open `index.html` in any modern browser (Chrome, Edge, Firefox).

> Optional: serve it with a local static server instead of opening the file directly (some browsers restrict certain file APIs under the `file://` protocol):
> ```bash
> npx serve .
> ```

### Deploy

Since this is a static HTML file, it can be deployed on any static hosting platform — no configuration needed:

- **Vercel** — import the repo, set the root/output directory to `Ats resume checker`, deploy.
- **Netlify** — drag and drop the `Ats resume checker` folder, or connect the repo.
- **GitHub Pages** — enable Pages and point it to the `Ats resume checker` directory.

---

## How It Works

1. **Upload or paste your resume** — text is extracted client‑side via PDF.js / Mammoth.js.
2. **(Optional) Paste a job description.**
3. Click **Analyze** to get your score, matched/missing keywords or suggestions, and the structure checklist.
4. If a JD was provided, click **Generate Tailored Resume** to get a reordered preview of your own resume content, prioritized by JD relevance — with options to highlight keywords, show only JD‑relevant bullets, and print/copy/download the result.

---

## Project Structure

```
Ats-resume-checker-with-job-description/
└── Ats resume checker/
    └── index.html      # Entire application — UI, styling, and logic
```

---

## Roadmap

- [ ] Export analysis report as PDF
- [ ] Resume history / saved scans
- [ ] Support for `.rtf` and Google Docs links
- [ ] Dark/light theme toggle
- [ ] Configurable industry keyword dictionaries per role

---

## Contributing

Contributions are welcome. Since this is a single‑file app, please:
1. Fork the repo
2. Make changes in `Ats resume checker/index.html`
3. Open a pull request with a clear description of the change

---

## Author

**Ratan Kumar Metha**
Java Full Stack Developer | Software Developer | AI Application Developer

- GitHub: [@Ra-kumar4216](https://github.com/Ra-kumar4216)
- LinkedIn: [ratan-kumar-metha](https://linkedin.com/in/ratan-kumar-metha)
- Portfolio: [ratankumar-portfolio.vercel.app](https://ratankumar-portfolio.vercel.app)
