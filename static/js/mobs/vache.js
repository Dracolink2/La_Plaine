window.mobDefinitions = window.mobDefinitions || [];
window.mobDefinitions.push({
    id: 'cow', name: 'Vache', type: 'animal', health: 10, speed: 1.15,
    texture: '/static/textures/cow.png',
    model: {
        textureSize: [64, 128], scale: 1 / 16,
        parts: [
            // corps et pis : textures pre-depliees pour des boites horizontales
            { name: 'body', size: [12, 10, 18], position: [0, 17, 1], uv: [0, 40] },
            { name: 'udder', size: [4, 1, 6], position: [0, 11.5, 7], uv: [0, 72] },
            { name: 'head', size: [8, 8, 6], position: [0, 20, -11], uv: [0, 0] },
            { name: 'horn1', size: [1, 3, 1], position: [-4.5, 23.5, -12.5], uv: [22, 0] },
            { name: 'horn2', size: [1, 3, 1], position: [4.5, 23.5, -12.5], uv: [22, 0] },
            { name: 'leg1', leg: true, size: [4, 12, 4], position: [-4, 6, -5], uv: [0, 16] },
            { name: 'leg2', leg: true, size: [4, 12, 4], position: [4, 6, -5], uv: [0, 16] },
            { name: 'leg3', leg: true, size: [4, 12, 4], position: [-4, 6, 7], uv: [0, 16] },
            { name: 'leg4', leg: true, size: [4, 12, 4], position: [4, 6, 7], uv: [0, 16] }
        ]
    },
    spawn: { biomes: ['plaine', 'foret', 'savane'], chance: 0.055, minGroup: 2, maxGroup: 4 },
    drops: [{ id: 1110, min: 1, max: 3, chance: 1 }, { id: 1111, min: 1, max: 2, chance: 1 }], soundProfile: { base: 125, hurt: 35, death: -20, wave: 'sawtooth', volume: 0.045 }
});
