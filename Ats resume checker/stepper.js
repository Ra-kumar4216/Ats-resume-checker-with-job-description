/* Wizard step navigation ONLY. Does not read/modify resume or JD data,
   does not compute scores, and does not touch app.js or engine.js.
   It just shows/hides the step-N panels and updates the progress bar. */
(function () {
  const $ = id => document.getElementById(id);
  const panel = n => $('step-' + n);
  const hero = $('hero');
  const dots = Array.prototype.slice.call(document.querySelectorAll('#wizard-progress [data-step]'));

  const STEP_KEY = 'ats-tracker-step-v1'; // own key: app.js keeps resume/JD text under a different key
  let mode = null; // 'jd' | 'general' — set on step 1, decides whether step 3 is skipped
  let current = 1;
  let furthest = 1; // furthest step reached, so people can revisit but not skip ahead

  const skip3 = () => mode === 'general';
  const nextOf = n => (n === 2 && skip3() ? 4 : Math.min(n + 1, 6));
  const prevOf = n => (n === 4 && skip3() ? 2 : Math.max(n - 1, 1));

  function render() {
    for (let i = 1; i <= 6; i++) {
      const p = panel(i);
      if (p) {
        p.classList.toggle('hidden', i !== current);
      }
    }
    if (hero) {
      hero.classList.toggle('hidden', current !== 1);
    }

    dots.forEach(dot => {
      const n = Number(dot.dataset.step);
      const skipped = n === 3 && skip3();
      const done = n < current && !skipped;
      dot.classList.toggle('is-active', n === current);
      dot.classList.toggle('is-done', done);
      dot.classList.toggle('is-skipped', skipped);
      dot.disabled = skipped || n > furthest;
      dot.setAttribute('aria-current', n === current ? 'step' : 'false');
      const num = dot.querySelector('.wizard-dot-num');
      if (num) {
        num.textContent = done ? '✓' : String(n);
      }
    });

    const label = $('wizard-step-label');
    if (label) {
      label.textContent = 'Step ' + current + ' of 6';
    }

    // Save current step to session
    try {
      const state = JSON.parse(localStorage.getItem(STEP_KEY) || '{}');
      state.currentStep = current;
      state.mode = mode;
      state.timestamp = Date.now();
      localStorage.setItem(STEP_KEY, JSON.stringify(state));
    } catch (e) {
      // ignore
    }
  }

  function goTo(n) {
    current = Math.max(1, Math.min(6, n));
    furthest = Math.max(furthest, current);
    render();
    const top = $('wizard-progress');
    if (top) {
      top.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  const on = (id, evt, fn) => {
    const el = $(id);
    if (el) {
      el.addEventListener(evt, fn);
    }
  };
  const validateResume = () => {
    const message =
      window.ATSApp && window.ATSApp.validateResume
        ? window.ATSApp.validateResume()
        : !$('resume-text').value.trim()
          ? 'Upload or paste your resume first.'
          : '';
    if (message && window.ATSApp) {
      window.ATSApp.showError(message);
    }
    return !message;
  };
  const validateJD = () => {
    const message =
      window.ATSApp && window.ATSApp.validateJobDescription
        ? window.ATSApp.validateJobDescription()
        : !$('jd-text').value.trim()
          ? 'Please add the job description before continuing.'
          : '';
    if (message && window.ATSApp) {
      window.ATSApp.showError(message);
    }
    return !message;
  };

  on('continue-with-jd', 'click', () => {
    mode = 'jd';
    goTo(2);
  });
  on('continue-without-jd', 'click', () => {
    mode = 'general';
    const jd = $('jd-text');
    if (jd) {
      jd.value = '';
      jd.dispatchEvent(new Event('input'));
    }
    goTo(2);
  });
  on('step2-back', 'click', () => goTo(1));
  on('step2-next', 'click', () => {
    if (validateResume()) {
      goTo(nextOf(2));
    }
  });
  on('step3-back', 'click', () => goTo(2));
  on('step3-next', 'click', () => {
    if (validateResume() && validateJD()) {
      goTo(4);
    }
  });
  on('step4-back', 'click', () => goTo(prevOf(4)));
  on('step5-back', 'click', () => goTo(4));
  on('step6-back', 'click', () => goTo(5));
  on('cover-letter-next', 'click', () => {
    if (validateResume() && !$('analysis-result').classList.contains('hidden')) {
      if (window.ATSApp && window.ATSApp.generateCoverLetter) {
        window.ATSApp.generateCoverLetter();
      }
      goTo(6);
    }
  });

  // These two buttons already run the real analysis/tailoring logic in app.js.
  // Here we only mark step 4 as reached, and move into step 5 once a tailored
  // resume has been generated — the actual content is rendered by app.js.
  on('analyze-btn', 'click', () => {
    const resumeOk = validateResume();
    const jdOk = mode === 'jd' ? validateJD() : true;
    if (resumeOk && jdOk) {
      furthest = Math.max(furthest, 4);
    }
  });
  on('tailor-btn', 'click', () => {
    if (validateResume() && !$('analysis-result').classList.contains('hidden')) {
      goTo(5);
    }
  });

  dots.forEach(dot => {
    dot.addEventListener('click', () => {
      if (!dot.disabled) {
        goTo(Number(dot.dataset.step));
      }
    });
  });

  window.ATSStepper = { getMode: () => mode };

  // Restore the step AFTER app.js has restored the saved resume/JD text (its DOMContentLoaded listener is registered first).
  function restoreStep() {
    try {
      const state = JSON.parse(localStorage.getItem(STEP_KEY) || '{}');
      if (!state.currentStep || !state.mode || Date.now() - (state.timestamp || 0) > 7 * 24 * 60 * 60 * 1000) {
        return;
      }
      mode = state.mode;
      const resume = $('resume-text')?.value?.trim();
      const jd = $('jd-text')?.value?.trim();
      // Results are not persisted, so never restore past the Analyze step.
      let targetStep = Math.min(state.currentStep, 4);
      if (targetStep > 2 && !resume) {
        targetStep = 2;
      }
      if (targetStep > 3 && mode === 'jd' && !jd) {
        targetStep = 3;
      }
      if (targetStep === 3 && mode === 'general') {
        targetStep = 4;
      }
      if (targetStep > 1) {
        goTo(targetStep);
      } else {
        render();
      }
    } catch (e) {
      // ignore
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', restoreStep);
  } else {
    restoreStep();
  }

  render();
})();
