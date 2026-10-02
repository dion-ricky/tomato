/* Tomato — static, no backend.
 * Cycle: work 50 → break 10 → work 40 → break 10 → work 30 → break 10
 *        → work 20 → break 10 → work 10 → break 10 → repeat.
 */
(() => {
  "use strict";

  const WORK_MINUTES = [50, 40, 30, 20, 10];
  const BREAK_MINUTES = 10;

  // A full cycle of phases, in order.
  const PHASES = WORK_MINUTES.flatMap((m) => [
    { type: "work", minutes: m },
    { type: "break", minutes: BREAK_MINUTES },
  ]);

  const CYCLE_MS = PHASES.reduce((sum, p) => sum + p.minutes * 60_000, 0);

  // ---- State -------------------------------------------------------------
  // Timestamp-based so the clock stays accurate even if the tab is throttled.
  // state = { phaseIndex, cycle, remainingMs, running, endAt (epoch ms when running) }
  const STORAGE_KEY = "tomato-state-v1";

  let state = {
    phaseIndex: 0,
    cycle: 1,
    remainingMs: PHASES[0].minutes * 60_000,
    running: false,
    endAt: null,
  };

  // ---- DOM ---------------------------------------------------------------
  const app = document.querySelector(".app");
  const ladderEl = document.getElementById("ladder");
  const phaseLabel = document.getElementById("phaseLabel");
  const timeDisplay = document.getElementById("timeDisplay");
  const progressFill = document.getElementById("progressFill");
  const progressTrack = document.getElementById("progressTrack");
  const sessionCount = document.getElementById("sessionCount");
  const startPauseBtn = document.getElementById("startPauseBtn");
  const skipBtn = document.getElementById("skipBtn");
  const resetBtn = document.getElementById("resetBtn");

  // ---- Persistence -------------------------------------------------------
  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch { /* private mode etc. — fine to ignore */ }
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (
        saved &&
        Number.isInteger(saved.phaseIndex) &&
        saved.phaseIndex >= 0 &&
        saved.phaseIndex < PHASES.length &&
        Number.isInteger(saved.cycle) &&
        saved.cycle >= 1 &&
        typeof saved.remainingMs === "number" &&
        saved.remainingMs > 0
      ) {
        state = { ...saved, running: false, endAt: null };
      }
    } catch { /* corrupted save — start fresh */ }
  }

  // ---- Helpers -----------------------------------------------------------
  const phase = () => PHASES[state.phaseIndex];
  const phaseTotalMs = () => phase().minutes * 60_000;

  function fmt(ms) {
    const total = Math.max(0, Math.round(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function chime(kind) {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const notes = kind === "work" ? [523.25, 659.25, 783.99] : [783.99, 659.25, 523.25];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const t0 = ctx.currentTime + i * 0.18;
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(0.25, t0 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t0);
        osc.stop(t0 + 0.55);
      });
    } catch { /* audio unavailable — no problem */ }
  }

  function notify(kind) {
    chime(kind);
    if (document.title) document.title = kind === "work" ? "🍅 Work time!" : "☕ Break time!";
    setTimeout(() => render(), 1500);
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(
        kind === "work" ? "Break over — back to work" : "Work block done — take a break",
        { body: `Next: ${kind === "work" ? `${phase().minutes} min work` : `${BREAK_MINUTES} min break`}` }
      );
    }
  }

  // ---- Timer core --------------------------------------------------------
  function tick() {
    if (!state.running) return;
    const left = state.endAt - Date.now();
    if (left <= 0) advance(true);
    else {
      state.remainingMs = left;
      render();
      scheduleNextTick();
    }
  }

  let tickTimer = null;
  function scheduleNextTick() {
    clearTimeout(tickTimer);
    tickTimer = setTimeout(tick, 250);
  }

  function advance(playChime) {
    const finishedType = phase().type;
    const nextIndex = (state.phaseIndex + 1) % PHASES.length;
    if (nextIndex === 0) state.cycle += 1;
    state.phaseIndex = nextIndex;
    state.remainingMs = phaseTotalMs();
    if (state.running) state.endAt = Date.now() + state.remainingMs;
    if (playChime) notify(phase().type === "work" ? "work" : "break");
    else if (finishedType) { /* skipped — quiet */ }
    save();
    render();
  }

  function start() {
    state.running = true;
    state.endAt = Date.now() + state.remainingMs;
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
    save();
    render();
    scheduleNextTick();
  }

  function pause() {
    clearTimeout(tickTimer);
    state.remainingMs = Math.max(0, state.endAt - Date.now());
    state.running = false;
    state.endAt = null;
    save();
    render();
  }

  function reset() {
    clearTimeout(tickTimer);
    state = {
      phaseIndex: 0,
      cycle: 1,
      remainingMs: PHASES[0].minutes * 60_000,
      running: false,
      endAt: null,
    };
    save();
    render();
  }

  // ---- Rendering ---------------------------------------------------------
  function renderLadder() {
    if (ladderEl.childElementCount === 0) {
      PHASES.forEach((p) => {
        const li = document.createElement("li");
        const mins = document.createElement("span");
        mins.className = "mins";
        mins.textContent = p.minutes;
        const kind = document.createElement("span");
        kind.className = "kind";
        kind.textContent = p.type;
        li.append(mins, kind);
        ladderEl.append(li);
      });
    }
    [...ladderEl.children].forEach((li, i) => {
      li.classList.toggle("current", i === state.phaseIndex);
      li.classList.toggle("done", i < state.phaseIndex);
    });
  }

  function render() {
    const p = phase();
    const mode = state.running || state.remainingMs < phaseTotalMs() ? p.type : "idle";
    app.dataset.mode = state.running ? p.type : "idle";
    phaseLabel.textContent = state.running || state.remainingMs < phaseTotalMs()
      ? `${p.type === "work" ? "Work" : "Break"} · ${p.minutes} min`
      : "Ready?";
    timeDisplay.textContent = fmt(state.remainingMs);

    const pct = Math.min(100, ((phaseTotalMs() - state.remainingMs) / phaseTotalMs()) * 100);
    progressFill.style.width = `${pct}%`;
    progressTrack.setAttribute("aria-valuenow", Math.round(pct));

    sessionCount.textContent = `Cycle ${state.cycle} · Work session ${
      Math.floor(state.phaseIndex / 2) + 1
    } of ${WORK_MINUTES.length}`;

    startPauseBtn.textContent = state.running ? "Pause" : mode === "idle" ? "Start" : "Resume";
    document.title = state.running ? `${fmt(state.remainingMs)} — ${p.type === "work" ? "Work" : "Break"}` : "Tomato";
    renderLadder();
  }

  // ---- Events ------------------------------------------------------------
  startPauseBtn.addEventListener("click", () => (state.running ? pause() : start()));
  skipBtn.addEventListener("click", () => advance(false));
  resetBtn.addEventListener("click", reset);

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && state.running) tick();
  });

  // ---- Boot --------------------------------------------------------------
  load();
  render();
  if (state.running) { /* never resume running across reloads — user presses Start */ }
})();