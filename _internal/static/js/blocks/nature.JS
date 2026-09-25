// Blocs existants
blockRegistry.register({ id: 1, name: 'Pierre', textures: { all: '/static/textures/stone.png' }, transparent: false });
blockRegistry.register({ id: 2, name: 'Terre', textures: { all: '/static/textures/dirt.png' }, transparent: false });
blockRegistry.register({ id: 3, name: 'Herbe', textures: { top: '/static/textures/grass_top.png', bottom: '/static/textures/dirt.png', sides: '/static/textures/grass_side.png' }, transparent: false });
blockRegistry.register({ id: 4, name: 'Bois', textures: { top: '/static/textures/oak_top.png', bottom: '/static/textures/oak_top.png', sides: '/static/textures/oak_side.png' }, transparent: false });
blockRegistry.register({ id: 5, name: 'Feuilles', textures: { all: '/static/textures/oak_leaves.png' }, transparent: true, alphaTest: 0.5 });

// Plantes & Décorations
blockRegistry.register({ id: 6, name: 'Haute Herbe', textures: { all: '/static/textures/tall_grass.png' }, transparent: true, alphaTest: 0.5, isPlant: true });
blockRegistry.register({ id: 7, name: 'Rose', textures: { all: '/static/textures/rose.png' }, transparent: true, alphaTest: 0.5, isPlant: true });
blockRegistry.register({ id: 8, name: 'Pissenlit', textures: { all: '/static/textures/dandelion.png' }, transparent: true, alphaTest: 0.5, isPlant: true });
blockRegistry.register({ id: 9, name: 'Sable', textures: { all: '/static/textures/sand.png' }, transparent: false });
blockRegistry.register({ id: 10, name: 'Cactus', textures: { top: '/static/textures/cactus_top.png', bottom: '/static/textures/cactus_bottom.png', sides: '/static/textures/cactus_side.png' }, transparent: true, alphaTest: 0.5 });

// Eau
blockRegistry.register({
    id: 11,
    name: 'Eau',
    textures: { all: '/static/textures/water.png' },
    transparent: true,
    alphaTest: 0.1,
    isFluid: true,
    viscosity: 1
});

// Neige
blockRegistry.register({
    id: 12,
    name: 'Neige',
    textures: { all: '/static/textures/neige.png' },
    transparent: false
});
// Herbe Froide (ID 13)
blockRegistry.register({
    id: 13,
    name: 'Herbe Froide',
    textures: {
        top: '/static/textures/grass_top_cold.png',
        bottom: '/static/textures/dirt.png',
        sides: '/static/textures/grass_side_cold.png'
    },
    transparent: false
});

// Dalle de Neige (ID 14)
blockRegistry.register({
    id: 14,
    name: 'Dalle de Neige',
    textures: { all: '/static/textures/snow_slab.png' },
    transparent: true,
    alphaTest: 0.5,
    isSlab: true // Optionnel : flag pour votre mesher 3D (hauteur 0.2)
});
// Bûche de Sapin (ID 15)
blockRegistry.register({
    id: 15,
    name: 'Bûche de Sapin',
    textures: {
        top: '/static/textures/pine_top.png',
        bottom: '/static/textures/pine_top.png',
        sides: '/static/textures/pine_side.png'
    },
    transparent: false
});

// Feuilles de Sapin (ID 16)
blockRegistry.register({
    id: 16,
    name: 'Feuilles de Sapin',
    textures: { all: '/static/textures/pine_leaves.png' },
    transparent: true,
    alphaTest: 0.5
});
// Deepslate (ID 17)
blockRegistry.register({
    id: 17,
    name: 'Deepslate',
    textures: { all: '/static/textures/deepslate.png' },
    transparent: false
});
// Pied de Champignon (ID 18)
blockRegistry.register({
    id: 18,
    name: 'Pied de Champignon',
    textures: { all: '/static/textures/mushroom_stem.png' },
    transparent: false
});

// Chapeau de Champignon Rouge (ID 19)
blockRegistry.register({
    id: 19,
    name: 'Chapeau Champignon Rouge',
    textures: { all: '/static/textures/mushroom_block_red.png' },
    transparent: false
});

// Mycélium (ID 20)
blockRegistry.register({
    id: 20,
    name: 'Mycélium',
    textures: {
        top: '/static/textures/mycelium_top.png',
        bottom: '/static/textures/dirt.png',
        sides: '/static/textures/mycelium_side.png'
    },
    transparent: false
});

// Petit Champignon Lumineux (ID 21)
blockRegistry.register({
    id: 21,
    name: 'Petit Champignon',
    textures: { all: '/static/textures/red_mushroom.png' },
    transparent: true,
    alphaTest: 0.5,
    isPlant: true,
    lightLevel: 8, // Émet un peu de lumière
    emitColor: 0xff4444
});
blockRegistry.register({ id: 22, name: 'Fleur Nyamée', textures: { all: '/static/textures/Fleur-Nyamée.png' }, transparent: true, alphaTest: 0.5, isPlant: true });
// Feuilles d'automne (ID 23)
blockRegistry.register({
    id: 23,
    name: 'Feuilles de Sapin',
    textures: { all: '/static/textures/automne_leaves.png' },
    transparent: true,
    alphaTest: 0.5
});
blockRegistry.register({ id: 24, name: 'Feuilles_Nyamée', textures: { all: '/static/textures/Nyamée_leaves.png' }, transparent: true, alphaTest: 0.5 });
blockRegistry.register({ id: 25, name: 'Bois_Nyamée', textures: { top: '/static/textures/Nyamée_top.png', bottom: '/static/textures/Nyamée_top.png', sides: '/static/textures/Nyamée_side.png' }, transparent: false });
blockRegistry.register({ id: 26, name: 'Herbe_Nyamée', textures: { top: '/static/textures/grass_top_Nyamée.png', bottom: '/static/textures/dirt.png', sides: '/static/textures/grass_side_Nyamée.png' }, transparent: false });
blockRegistry.register({ id: 27, name: 'Feuilles_savane', textures: { all: '/static/textures/acacia_leaves.png' }, transparent: true, alphaTest: 0.5 });
blockRegistry.register({ id: 28, name: 'Bois_savane', textures: { top: '/static/textures/acacia_top.png', bottom: '/static/textures/acacia_top.png', sides: '/static/textures/acacia_side.png' }, transparent: false });
blockRegistry.register({ id: 29, name: 'Herbe_Nyamée', textures: { top: '/static/textures/grass_top_hot.png', bottom: '/static/textures/dirt.png', sides: '/static/textures/grass_side_hot.png' }, transparent: false });