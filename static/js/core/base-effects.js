/*
 * Effets graphiques natifs de La Plaine.
 * Intègre l'animation de vent de l'ancien mod Living Nature au jeu de base.
 * Compatible avec Three.js r128 et le matériau cutout utilisé par les chunks.
 */
(() => {
    'use strict';

    let raf = 0;
    let startedAt = 0;
    let windUniform = null;

    function installWind(world) {
        const material = world?.mats?.cutout;
        if (!material || !window.THREE) return;

        material.userData = material.userData || {};
        // Empêche une double injection si l'ancien mod Living Nature est activé.
        if (material.userData.livingNatureInstalled || material.userData.baseWindInstalled) return;

        const wind = { value: 0 };
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
            material.userData.baseWindShader = shader;
        };
        material.userData.baseWindInstalled = true;
        // Compatibilité avec l'ancien mod : son garde-fou évite toute double injection.
        material.userData.livingNatureInstalled = true;
        material.needsUpdate = true;
        windUniform = wind;
        startedAt = performance.now();

        console.info('[La Plaine] Animation de vent native activée.');
    }

    function tick(now) {
        raf = requestAnimationFrame(tick);
        if (document.hidden || !windUniform) return;
        windUniform.value = (now - startedAt) / 1000;
    }

    window.LaPlaineAPI?.on('game:ready', ({ world }) => {
        installWind(world);
        if (!raf) raf = requestAnimationFrame(tick);
    });
})();
