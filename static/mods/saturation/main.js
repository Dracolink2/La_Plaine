/**
 * Réglage de saturation pour La Plaine.
 * Le curseur est enregistré dans les paramètres des mods et appliqué au canvas WebGL.
 * 100 % correspond au rendu normal ; 0 % désature l'image et 1000 % renforce les couleurs.
 */
(() => {
  'use strict';
  const STORAGE_KEY = 'laPlaine.modSetting.saturation.percent';
  let current = 100;

  function apply() {
    const value = Math.max(0, Math.min(1000, Number(current) || 0));
    const filter = `saturate(${value / 100})`;
    document.querySelectorAll('canvas').forEach(canvas => { canvas.style.filter = filter; });
  }

  // Le jeu peut créer/remplacer son canvas après le chargement du mod.
  const observer = new MutationObserver(apply);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  function register() {
    if (!window.LaPlaineAPI) return;
    window.LaPlaineAPI.registerSetting({
      id: 'saturation.percent',
      label: 'Saturation du jeu',
      description: '0 % = noir et blanc · 100 % = normal · 1000 % = couleurs extrêmes. Appliqué immédiatement.',
      type: 'slider', min: 0, max: 1000, step: 10, defaultValue: 100, unit: ' %',
      onChange(value) { current = value; apply(); }
    });
  }
  register();
})();
