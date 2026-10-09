window.mobDefinitions = window.mobDefinitions || [];
window.mobDefinitions.push({
    id: 'sheep', name: 'Mouton', type: 'animal', health: 8, speed: 1.25,
    texture: '/static/textures/sheep.png',
    model: {
        textureSize: [64, 64], scale: 1 / 16,
        parts: [
            // corps : texture pre-depliee pour une boite horizontale [8,6,16]
            { name: 'body', size: [8, 6, 16], position: [0, 15, 0], uv: [0, 32], inflate: 0.35 },
            { name: 'head', size: [6, 6, 8], position: [0, 19, -10], uv: [0, 0] },
            { name: 'leg1', leg: true, size: [4, 12, 4], position: [-3, 6, -5], uv: [0, 16] },
            { name: 'leg2', leg: true, size: [4, 12, 4], position: [3, 6, -5], uv: [0, 16] },
            { name: 'leg3', leg: true, size: [4, 12, 4], position: [-3, 6, 7], uv: [0, 16] },
            { name: 'leg4', leg: true, size: [4, 12, 4], position: [3, 6, 7], uv: [0, 16] }
        ]
    },
    spawn: { biomes: ['plaine', 'foret', 'montagne'], chance: 0.05, minGroup: 2, maxGroup: 4 },
    drops: [{ id: 1106, min: 1, max: 2, chance: 1 }, { id: 1107, min: 1, max: 1, chance: 0.5 }], soundProfile: { base: 260, hurt: -20, death: -65, wave: 'triangle', volume: 0.04 }
});
