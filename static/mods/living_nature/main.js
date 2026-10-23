/* Living Nature — animation de vent sur les meshes cutout (herbes/feuillages). */
(() => {
  'use strict';
  let raf = 0;
  window.LaPlaineAPI?.on('game:ready', ({ world }) => {
    if (!world?.mats?.cutout || !window.THREE) return;
    const material = world.mats.cutout;
    if (material.userData?.livingNatureInstalled) return;
    material.userData = material.userData || {};
    material.userData.livingNatureInstalled = true;
    const wind = { value: 0.0, strength: 0.22 };
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uLivingWindTime = wind;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        '#include <common>\nuniform float uLivingWindTime;'
      );
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         float plantHeight = clamp(transformed.y, 0.0, 2.0);
         float gust = sin(uLivingWindTime * 1.25 + position.x * 0.75 + position.z * 0.55);
         float sway = (gust * 0.11 + sin(uLivingWindTime * 2.1 + position.x * 0.3) * 0.035) * plantHeight;
         transformed.x += sway;
         transformed.z += cos(uLivingWindTime * 0.8 + position.x * 0.4) * 0.035 * plantHeight;`
      );
      material.userData.livingNatureShader = shader;
    };
    material.needsUpdate = true;
    // Les chunks déjà construits et ceux générés plus tard utilisent le même matériau.
    const start = performance.now();
    const tick = (now) => {
      raf = requestAnimationFrame(tick);
      if (document.hidden) return;
      const shader = material.userData?.livingNatureShader;
      if (shader?.uniforms?.uLivingWindTime) shader.uniforms.uLivingWindTime.value = (now - start) / 1000;
    };
    if (!raf) raf = requestAnimationFrame(tick);
    console.info('[Living Nature] Vent animé activé sur le matériau des plantes/éléments découpés.');
  });
})();
