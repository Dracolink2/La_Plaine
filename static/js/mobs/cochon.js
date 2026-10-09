window.mobDefinitions = window.mobDefinitions || [];
window.mobDefinitions.push({
    id: 'pig', name: 'Cochon', type: 'animal', health: 10, speed: 1.2,
    texture: '/static/textures/pig.png',
    model: {
        textureSize: [64, 64], scale: 1 / 16,
        parts: [
            // corps : texture pre-depliee pour une boite horizontale [10,8,16]
            { name: 'body', size: [10, 8, 16], position: [0, 10, 0], uv: [0, 32] },
            { name: 'head', size: [8, 8, 8], position: [0, 12, -10], uv: [0, 0] },
            { name: 'snout', size: [4, 3, 1], position: [0, 10.5, -14.5], uv: [16, 16] },
            { name: 'leg1', leg: true, size: [4, 6, 4], position: [-3, 3, -5], uv: [0, 16] },
            { name: 'leg2', leg: true, size: [4, 6, 4], position: [3, 3, -5], uv: [0, 16] },
            { name: 'leg3', leg: true, size: [4, 6, 4], position: [-3, 3, 7], uv: [0, 16] },
            { name: 'leg4', leg: true, size: [4, 6, 4], position: [3, 3, 7], uv: [0, 16] }
        ]
    },
    spawn: { biomes: ['plaine', 'foret'], chance: 0.045, minGroup: 2, maxGroup: 4 },
    drops: [{ id: 1105, min: 1, max: 3, chance: 1 }], soundProfile: { base: 175, hurt: -35, death: -75, wave: 'sawtooth', volume: 0.045 }
});
