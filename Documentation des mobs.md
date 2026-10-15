Pour créer un mob sur ce jeu c'est moins simple que les autres , il faut :
1 nommer un fichier comme on veut et le créer en .js static/js/mobs/

2 : un exemple est meilleur 

window.mobDefinitions = window.mobDefinitions || \[];
window.mobDefinitions.push({
    id: 'cristal\_lapin', // son identifiant
    name: 'Lapin cristallin', // son nom
    type: 'animal', // son type
    health: 8, // sa vie
    speed: 1.3, // sa vitesse 
    texture: '/static/textures/mobs/cristal\_lapin.png', // sa texture
    model: {
        textureSize: \[64, 64],
        scale: 1 / 16,
        parts: \[
            { name: 'body', size: \[8, 6, 12], position: \[0, 7, 0], uv: \[0, 24] },
            { name: 'head', size: \[6, 6, 6], position: \[0, 9, -8], uv: \[0, 0] },
            { name: 'leg1', leg: true, size: \[2, 4, 2], position: \[-2, 2, -3], uv: \[0, 12] },
            { name: 'leg2', leg: true, size: \[2, 4, 2], position: \[2, 2, -3], uv: \[0, 12] }
        ]
    }, // les UV pour la texture/modèle 3D 
    spawn: { biomes: \['plaine'], chance: 0.03, minGroup: 1, maxGroup: 2 }, // ses spa
    drops: \[{ id: 1200, min: 1, max: 2, chance: 1 }]
});