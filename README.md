# ATS Resume Tracker & Matcher

A free, fully client-side resume analyzer that scores your resume against a job description (or on its own) using ATS-style keyword matching and formatting checks — all in the browser, with no backend and no data ever leaving your device.

**🔗 Runs entirely in-browser — just open `index.html` or deploy it as a static site.**

---

## Features

- **Two analysis modes**
  - **JD Match Mode** — Paste a job description and get a keyword match score, with matched vs. missing skills clearly tagged.
  - **General ATS Mode** — No job description? Get a standalone ATS-friendliness score based on resume structure and writing quality.
- **Multi-format resume upload** — Supports `.pdf`, `.docx`, and `.txt` (up to 5MB), with drag-and-drop.
- **Client-side text extraction** — Uses **PDF.js** for PDFs and **Mammoth.js** for DOCX files; text is parsed entirely in your browser.
- **Smart JD keyword extraction** — Combines a canonical skills dictionary, signal-phrase detection ("experience with X", "proficiency in Y"), and recurring capitalized-term detection to pull relevant keywords straight out of any job description.
- **Resume quality checklist** — Checks for contact info, an Experience section, an Education section, and a Projects section.
- **Writing-quality signals** — Scores based on word count, bullet-point usage, action verbs (led, built, improved, launched, etc.), and quantified achievements (%, ₹/$, multipliers).
- **Visual score report** — Animated circular score meter, matched/missing keyword tags, and actionable improvement suggestions.
- **100% private** — No server, no database, no API calls. Your resume and JD never leave your browser.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Markup / Styling | HTML5, [Tailwind CSS](https://tailwindcss.com/) (CDN) |
| Icons | [Font Awesome 6](https://fontawesome.com/) |
| PDF Parsing | [PDF.js](https://mozilla.github.io/pdf.js/) |
| DOCX Parsing | [Mammoth.js](https://github.com/mwilliamson/mammoth.js) |
| Logic | Vanilla JavaScript (no framework, no build step) |

This is a **single-file static application** — everything lives in `Ats resume checker/index.html`. There is no backend, no package manager, and no build process.

---

## Getting Started

### Run locally

No installation required.

```bash
git clone https://github.com/Ra-kumar4216/Ats-resume-checker-with-job-description.git
cd "Ats-resume-checker-with-job-description/Ats resume checker"
```

Then simply open `index.html` in any modern browser (Chrome, Edge, Firefox).

> Optional: serve it with a local static server instead of opening the file directly (some browsers restrict certain file APIs under the `file://` protocol):
> ```bash
> npx serve .
> ```

### Deploy

Since this is a static HTML file, it can be deployed on any static hosting platform — no configuration needed:

- **Vercel** — Import the repo, set the root/output directory to `Ats resume checker`, deploy.
- **Netlify** — Drag and drop the `Ats resume checker` folder, or connect the repo.
- **GitHub Pages** — Enable Pages and point it to the `Ats resume checker` directory.

---

## How It Works

1. **Upload or paste your resume** — the app extracts raw text client-side using PDF.js / Mammoth.js.
2. **(Optional) Paste a job description.**
3. Click **Analyze**:
   - **With a JD:** keywords are extracted from the JD and cross-checked against your resume text. Score = `(keyword match % × 80) + (structure checklist × 20)`.
   - **Without a JD:** the app scans your resume against a built-in industry-skills dictionary and scores structure, length, bullet usage, action verbs, and quantified results.
4. View your **score, matched/missing keywords or suggestions**, and a **structure checklist** (contact info, experience, education, projects).

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

Contributions are welcome. Since this is a single-file app, please:
1. Fork the repo
2. Make changes in `Ats resume checker/index.html`
3. Open a pull request with a clear description of the change

---

## Author

**Ratan Kumar**
Java Full Stack Developer | Software developer | AI Application Developer

- GitHub: [@Ra-kumar4216](https://github.com/Ra-kumar4216)
- LinkedIn: [ratan-kumarmetha](https://linkedin.com/in/ratan-kumarmetha)
- Portfolio: [ratankumarmetha-portfolio.vercel.app](https://ratankumarmetha-portfolio.vercel.app)
- Email: ratankumarmetha@gmail.com


