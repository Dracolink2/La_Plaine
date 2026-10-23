/* The 2D Pack — profil de rendu pixelisé et léger pour La Plaine. */
(() => {
  'use strict';
  const KEY = 'laPlaine.modSetting.the2d.';
  // Ces réglages s'appliquent quand le mod est activé. L'utilisateur peut les modifier ensuite dans les paramètres.
  try {
    if (localStorage.getItem(KEY + 'configured') !== 'true') {
      localStorage.setItem('graphicsQuality', 'low');
      localStorage.setItem('gameResolution', '480p');
      localStorage.setItem('renderDistance', '2');
      localStorage.setItem('fxWaterShader', 'false');
      localStorage.setItem(KEY + 'configured', 'true');
    }
  } catch (_) {}
  window.LaPlaineAPI?.on('game:ready', ({ world, renderer, camera }) => {
    // Baisse la distance de rendu à chaud pour limiter les chunks dessinés.
    if (world) {
      world.renderDistance = Math.min(Number(world.renderDistance) || 2, 2);
      try { localStorage.setItem('renderDistance', String(world.renderDistance)); } catch (_) {}
    }
    // Réduit encore la résolution du canvas, y compris après un redimensionnement.
    if (renderer && typeof renderer.setSize === 'function' && !renderer.userData?.the2dScaleInstalled) {
      renderer.userData = renderer.userData || {};
      renderer.userData.the2dScaleInstalled = true;
      const originalSetSize = renderer.setSize.bind(renderer);
      const scale = 0.60;
      renderer.setSize = (width, height, updateStyle) => originalSetSize(
        Math.max(2, Math.round(width * scale)), Math.max(2, Math.round(height * scale)), updateStyle
      );
      const w = Math.max(2, Math.round(window.innerWidth * 480 / Math.max(1, window.innerHeight) * scale));
      const h = Math.max(2, Math.round(480 * scale));
      renderer.setSize(w, h, false);
    }
    if (camera) { camera.fov = 68; camera.updateProjectionMatrix(); }
    console.info('[The 2D Pack] Profil pixel/performance activé. Pour un rendu pixelisé, sélectionner aussi le shader The_2D_Pack.');
  });
})();
