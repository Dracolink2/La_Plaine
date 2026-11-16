// Cheval : créature native de La Plaine (ne nécessite aucun mod activé).
window.mobDefinitions = window.mobDefinitions || [];
window.mobDefinitions.push({
    id: 'horse', name: 'Cheval', type: 'animal', health: 15, speed: 1.35,
    texture: '/static/textures/mobs/horse_atlas.png',
    model: {
        textureSize: [256, 256], scale: 1 / 16,
        parts: [
            { name: 'body', size: [12, 12, 22], position: [0, 21, 2], uvFaces: { front: [96,32,111,62], back: [96,32,111,62], left: [96,32,111,62], right: [96,32,111,62], top: [128,32,143,62], bottom: [64,32,79,62] } },
            { name: 'neck', size: [7, 13, 8], position: [0, 30, -9], uvFaces: { front: [224,0,232,16], back: [224,0,232,16], left: [224,0,232,16], right: [224,0,232,16], top: [224,0,232,16], bottom: [224,0,232,16] } },
            { name: 'head', size: [8, 9, 10], position: [0, 37, -13], uvFaces: { front: [0,0,16,16], back: [32,0,48,16], left: [32,0,48,16], right: [32,0,48,16], top: [32,0,48,16], bottom: [32,0,48,16] } },
            { name: 'muzzle', size: [7, 5, 5], position: [0, 34, -20], uvFaces: { front: [160,0,168,8], back: [192,0,200,8], left: [192,0,200,8], right: [192,0,200,8], top: [192,0,200,8], bottom: [192,0,200,8] } },
            { name: 'tail', size: [3, 12, 4], position: [0, 20, 15], uvFaces: { front: [32,32,40,48], back: [32,32,40,48], left: [32,32,40,48], right: [32,32,40,48], top: [32,32,40,48], bottom: [0,32,8,40] } },
            { name: 'leg1', leg: true, size: [4, 15, 4], position: [-4, 7.5, -6], uvFaces: { front: [96,0,104,16], back: [96,0,104,16], left: [96,0,104,16], right: [96,0,104,16], top: [128,0,136,8], bottom: [64,0,72,8] } },
            { name: 'leg2', leg: true, size: [4, 15, 4], position: [4, 7.5, -6], uvFaces: { front: [96,0,104,16], back: [96,0,104,16], left: [96,0,104,16], right: [96,0,104,16], top: [128,0,136,8], bottom: [64,0,72,8] } },
            { name: 'leg3', leg: true, size: [4, 15, 4], position: [-4, 7.5, 10], uvFaces: { front: [96,0,104,16], back: [96,0,104,16], left: [96,0,104,16], right: [96,0,104,16], top: [128,0,136,8], bottom: [64,0,72,8] } },
            { name: 'leg4', leg: true, size: [4, 15, 4], position: [4, 7.5, 10], uvFaces: { front: [96,0,104,16], back: [96,0,104,16], left: [96,0,104,16], right: [96,0,104,16], top: [128,0,136,8], bottom: [64,0,72,8] } }
        ]
    },
    spawn: { biomes: ['plaine', 'savane', 'foret'], chance: 0.035, minGroup: 1, maxGroup: 3 },
    drops: [{ id: 1111, min: 1, max: 3, chance: 1 }],
    soundProfile: { base: 115, hurt: 30, death: -25, wave: 'triangle', volume: 0.035 }
});
