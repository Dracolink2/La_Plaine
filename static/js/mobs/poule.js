window.mobDefinitions = window.mobDefinitions || [];
window.mobDefinitions.push({
    id: 'chicken', name: 'Poule', type: 'animal', health: 4, speed: 1.6,
    texture: '/static/textures/chicken.png',
    model: {
        textureSize: [64, 64], scale: 1 / 16,
        parts: [
            { name: 'head', size: [4, 6, 3], position: [0, 12, -4.5], uv: [0, 0] },
            { name: 'beak', size: [4, 2, 2], position: [0, 12, -7], uv: [14, 0] },
            { name: 'wattle', size: [2, 2, 2], position: [0, 10, -6], uv: [14, 4] },
            // corps : texture pre-depliee pour une boite horizontale [6,6,8]
            { name: 'body', size: [6, 6, 8], position: [0, 8, 0], uv: [0, 32], inflate: 0.08 },
            { name: 'leg1', leg: true, size: [3, 5, 3], position: [-1.5, 2.5, -0.5], uv: [26, 0] },
            { name: 'leg2', leg: true, size: [3, 5, 3], position: [1.5, 2.5, -0.5], uv: [26, 0] },
            { name: 'wing1', size: [1, 4, 6], position: [-3.5, 9, 0], uv: [24, 13] },
            { name: 'wing2', size: [1, 4, 6], position: [3.5, 9, 0], uv: [24, 13] }
        ]
    },
    spawn: { biomes: ['plaine', 'foret', 'savane'], chance: 0.06, minGroup: 2, maxGroup: 5 },
    drops: [{ id: 1108, min: 1, max: 2, chance: 1 }, { id: 1109, min: 1, max: 1, chance: 0.35 }], soundProfile: { base: 520, hurt: -80, death: -170, wave: 'square', volume: 0.028 }
});
