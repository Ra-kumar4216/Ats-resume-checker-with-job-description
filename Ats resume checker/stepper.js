/* Wizard step navigation ONLY. Does not read/modify resume or JD data,
   does not compute scores, and does not touch app.js or engine.js.
   It just shows/hides the step-N panels and updates the progress bar. */
(function () {
  const $ = (id) => document.getElementById(id);
  const panel = (n) => $('step-' + n);
  const hero = $('hero');
  const dots = Array.prototype.slice.call(document.querySelectorAll('#wizard-progress [data-step]'));

  let mode = null;     // 'jd' | 'general' — set on step 1, decides whether step 3 is skipped
  let current = 1;
  let furthest = 1;    // furthest step reached, so people can revisit but not skip ahead

  const skip3 = () => mode === 'general';
  const nextOf = (n) => (n === 2 && skip3() ? 4 : Math.min(n + 1, 5));
  const prevOf = (n) => (n === 4 && skip3() ? 2 : Math.max(n - 1, 1));

  function render() {
    for (let i = 1; i <= 5; i++) {
      const p = panel(i);
      if (p) p.classList.toggle('hidden', i !== current);
    }
    if (hero) hero.classList.toggle('hidden', current !== 1);

    dots.forEach((dot) => {
      const n = Number(dot.dataset.step);
      const skipped = n === 3 && skip3();
      const done = n < current && !skipped;
      dot.classList.toggle('is-active', n === current);
      dot.classList.toggle('is-done', done);
      dot.classList.toggle('is-skipped', skipped);
      dot.disabled = skipped || n > furthest;
      dot.setAttribute('aria-current', n === current ? 'step' : 'false');
      const num = dot.querySelector('.wizard-dot-num');
      if (num) num.textContent = done ? '✓' : String(n);
    });

    const label = $('wizard-step-label');
    if (label) label.textContent = 'Step ' + current + ' of 5';
  }

  function goTo(n) {
    current = Math.max(1, Math.min(5, n));
    furthest = Math.max(furthest, current);
    render();
    const top = $('wizard-progress');
    if (top) top.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const on = (id, evt, fn) => { const el = $(id); if (el) el.addEventListener(evt, fn); };

  on('continue-with-jd', 'click', () => { mode = 'jd'; goTo(2); });
  on('continue-without-jd', 'click', () => { mode = 'general'; goTo(2); });
  on('step2-back', 'click', () => goTo(1));
  on('step2-next', 'click', () => goTo(nextOf(2)));
  on('step3-back', 'click', () => goTo(2));
  on('step3-next', 'click', () => goTo(4));
  on('step4-back', 'click', () => goTo(prevOf(4)));
  on('step5-back', 'click', () => goTo(4));

  // These two buttons already run the real analysis/tailoring logic in app.js.
  // Here we only mark step 4 as reached, and move into step 5 once a tailored
  // resume has been generated — the actual content is rendered by app.js.
  on('analyze-btn', 'click', () => { furthest = Math.max(furthest, 4); });
  on('tailor-btn', 'click', () => goTo(5));

  dots.forEach((dot) => {
    dot.addEventListener('click', () => { if (!dot.disabled) goTo(Number(dot.dataset.step)); });
  });

  render();
})();
