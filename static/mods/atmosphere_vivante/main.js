/* Atmosphère vivante — mod d'ambiance visuelle pour La Plaine. */
(() => {
  'use strict';
  const PREFIX = 'laPlaine.modSetting.atmosphere.';
  const state = { enabled: true, density: 48, glow: 68, speed: 50 };
  let overlay = null, ctx = null, raf = 0, lastFrame = 0, particles = [];
  let width = 0, height = 0, dpr = 1;

  function readSaved(key, fallback) {
    try {
      const value = localStorage.getItem(PREFIX + key);
      if (value === null) return fallback;
      if (key === 'enabled') return value === 'true';
      const n = Number(value);
      return Number.isFinite(n) ? n : fallback;
    } catch (_) { return fallback; }
  }

  state.enabled = readSaved('enabled', true);
  state.density = Math.max(0, Math.min(100, readSaved('density', 48)));
  state.glow = Math.max(0, Math.min(100, readSaved('glow', 68)));
  state.speed = Math.max(0, Math.min(100, readSaved('speed', 50)));

  function random(min, max) { return min + Math.random() * (max - min); }
  function newParticle(initial = false) {
    return {
      x: random(0, width || window.innerWidth),
      y: initial ? random(0, height || window.innerHeight) : (height || window.innerHeight) + random(2, 40),
      radius: random(0.7, 2.3),
      alpha: random(0.12, 0.62),
      phase: random(0, Math.PI * 2),
      drift: random(-0.20, 0.20),
      speed: random(0.08, 0.40),
      warm: Math.random() > 0.35
    };
  }

  function ensureOverlay() {
    if (!document.querySelector('body > canvas')) return;
    if (overlay && overlay.isConnected) return;
    overlay = document.getElementById('lp-atmosphere-vivante');
    if (!overlay) {
      overlay = document.createElement('canvas');
      overlay.id = 'lp-atmosphere-vivante';
      overlay.setAttribute('aria-hidden', 'true');
      overlay.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;z-index:2;pointer-events:none;mix-blend-mode:screen;opacity:1;';
      document.body.appendChild(overlay);
    }
    ctx = overlay.getContext('2d', { alpha: true });
    resize();
    if (!raf) raf = requestAnimationFrame(draw);
  }

  function resize() {
    if (!overlay || !ctx) return;
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    width = Math.max(1, window.innerWidth);
    height = Math.max(1, window.innerHeight);
    overlay.width = Math.round(width * dpr);
    overlay.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.round(state.density * 0.72);
    particles = Array.from({ length: count }, () => newParticle(true));
  }

  function draw(now) {
    raf = requestAnimationFrame(draw);
    if (!ctx || !overlay || !overlay.isConnected) { raf = 0; return; }
    if (document.hidden || !state.enabled || state.density <= 0) {
      ctx.clearRect(0, 0, width, height);
      return;
    }
    if (now - lastFrame < 30) return; // limite l'effet à environ 33 images/s
    lastFrame = now;
    const t = now * 0.001;
    const desired = Math.round(state.density * 0.72);
    while (particles.length < desired) particles.push(newParticle(true));
    while (particles.length > desired) particles.pop();
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const glow = state.glow / 100;
    const speed = 0.25 + state.speed / 65;

    // Un voile de lumière très diffus, mobile, comme une lumière de fin d'après-midi.
    const beamX = width * (0.10 + 0.035 * Math.sin(t * 0.12));
    const beam = ctx.createLinearGradient(beamX, 0, beamX + width * 0.38, height);
    beam.addColorStop(0, `rgba(255,204,125,${0.010 + glow * 0.018})`);
    beam.addColorStop(0.45, `rgba(255,225,170,${0.004 + glow * 0.009})`);
    beam.addColorStop(1, 'rgba(255,225,170,0)');
    ctx.fillStyle = beam;
    ctx.fillRect(0, 0, width, height);

    for (const p of particles) {
      p.y -= p.speed * speed;
      p.x += p.drift + Math.sin(t * 0.7 + p.phase) * 0.18;
      if (p.y < -20 || p.x < -20 || p.x > width + 20) Object.assign(p, newParticle(false));
      const twinkle = 0.45 + 0.55 * Math.sin(t * (1.1 + p.speed) + p.phase);
      const alpha = p.alpha * twinkle * (0.35 + glow * 0.85);
      const r = p.radius * (0.65 + glow * 0.55);
      const color = p.warm ? '255,207,124' : '151,220,255';
      const halo = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * (3 + glow * 5));
      halo.addColorStop(0, `rgba(${color},${alpha})`);
      halo.addColorStop(0.28, `rgba(${color},${alpha * 0.30})`);
      halo.addColorStop(1, `rgba(${color},0)`);
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * (3 + glow * 5), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(${color},${Math.min(0.8, alpha * 0.75)})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.45, r * 0.55), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function apply() {
    if (overlay) overlay.style.display = state.enabled ? 'block' : 'none';
    if (state.enabled) ensureOverlay();
    else if (ctx) ctx.clearRect(0, 0, width, height);
    if (overlay && ctx) resize();
  }

  function registerSettings() {
    if (!window.LaPlaineAPI || window.__atmosphereVivanteSettingsRegistered) return;
    window.__atmosphereVivanteSettingsRegistered = true;
    const api = window.LaPlaineAPI;
    try {
      api.registerSetting({
        id: 'atmosphere.enabled', label: 'Atmosphère cinématique', type: 'checkbox',
        defaultValue: true, description: 'Active les poussières lumineuses, lucioles et le voile de lumière.',
        onChange(value) { state.enabled = Boolean(value); apply(); }
      });
      api.registerSetting({
        id: 'atmosphere.density', label: 'Densité des particules', type: 'slider',
        min: 0, max: 100, step: 5, defaultValue: 48, unit: ' %',
        description: 'Nombre de particules à l’écran. Réduis cette valeur si tu veux gagner des FPS.',
        onChange(value) { state.density = Number(value); apply(); }
      });
      api.registerSetting({
        id: 'atmosphere.glow', label: 'Intensité lumineuse', type: 'slider',
        min: 0, max: 100, step: 5, defaultValue: 68, unit: ' %',
        description: 'Règle l’intensité des halos dorés et bleutés.',
        onChange(value) { state.glow = Number(value); apply(); }
      });
      api.registerSetting({
        id: 'atmosphere.speed', label: 'Vitesse de l’ambiance', type: 'slider',
        min: 0, max: 100, step: 5, defaultValue: 50, unit: ' %',
        description: 'Contrôle la dérive des particules.',
        onChange(value) { state.speed = Number(value); }
      });
    } catch (error) {
      console.warn('[Atmosphère vivante] Réglages non disponibles sur cette page :', error);
    }
  }

  window.addEventListener('resize', resize, { passive: true });
  document.addEventListener('visibilitychange', () => { lastFrame = 0; });
  const observer = new MutationObserver(() => { if (document.querySelector('body > canvas')) ensureOverlay(); });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  registerSettings();
  ensureOverlay();
})();
