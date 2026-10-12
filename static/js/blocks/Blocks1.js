blockRegistry.register({ id: 1, name: 'Pierre', type: 'pickaxe', level: 1, breakTime: 1.4, textures: { all: '/static/textures/pierres/stone/stone.png' }, transparent: false });

blockRegistry.register({ id: 2, name: 'Terre', type: 'shovel', level: 1, breakTime: 0.35, textures: { all: '/static/textures/grass/dirt.png' }, transparent: false });

blockRegistry.register({ id: 3, name: 'Herbe', type: 'shovel', level: 1, breakTime: 0.4, textures: { top: '/static/textures/grass/grass_top.png', bottom: '/static/textures/grass/dirt.png', sides: '/static/textures/grass/grass_side.png' }, transparent: false });

blockRegistry.register({ id: 4, name: 'Bois', type: 'axe', level: 1, breakTime: 0.8, textures: { top: '/static/textures/bois/bûches/oak_top.png', bottom: '/static/textures/bois/bûches/oak_top.png', sides: '/static/textures/bois/bûches/oak_side.png' }, transparent: false });

blockRegistry.register({ id: 5, name: 'Feuilles chêne', breakTime: 0.15, textures: { all: '/static/textures/bois/leaves/oak_leaves.png' }, transparent: true, alphaTest: 0.5 });

blockRegistry.register({ id: 6, name: 'Haute herbe (bas)', textures: { all: '/static/textures/others/high_grass_down.png' }, transparent: true, alphaTest: 0.1, isPlant: true });

blockRegistry.register({ id: 63, name: 'Haute herbe (haut)', textures: { all: '/static/textures/others/hign_grass_up.png' }, transparent: true, alphaTest: 0.1, isPlant: true, drop: null });

blockRegistry.register({ id: 64, name: 'Coquelicot', textures: { all: '/static/textures/others/coquelicot.png' }, transparent: true, alphaTest: 0.1, isPlant: true });

blockRegistry.register({ id: 65, name: 'Le Socle', textures: { all: '/static/textures/others/socle.png' }, transparent: false, type: 'pickaxe', level: 99, breakTime: 999999, drop: null });

blockRegistry.register({ id: 7, name: 'Rose', textures: { all: '/static/textures/others/rose.png' }, transparent: true, alphaTest: 0.5, isPlant: true });

blockRegistry.register({ id: 8, name: 'Pissenlit', textures: { all: '/static/textures/others/dandelion.png' }, transparent: true, alphaTest: 0.5, isPlant: true });

blockRegistry.register({ id: 9, name: 'Sable', type: 'shovel', level: 1, breakTime: 0.3, textures: { all: '/static/textures/desert/sand.png' }, transparent: false });

blockRegistry.register({ id: 10, name: 'Cactus', textures: { top: '/static/textures/desert/cactus_top.png', bottom: '/static/textures/desert/cactus_bottom.png', sides: '/static/textures/desert/cactus_side.png' }, transparent: true, alphaTest: 0.5 });

blockRegistry.register({ id: 11, name: 'Eau', textures: { all: '/static/textures/others/water.png' }, transparent: true, alphaTest: 0.1, isFluid: true, viscosity: 1, drop: null, breakTime: 0 });

blockRegistry.register({ id: 12, name: 'Neige', textures: { all: '/static/textures/others/neige.png' }, transparent: false });

blockRegistry.register({ id: 13, name: 'Herbe froide', textures: { top: '/static/textures/grass/grass_top_cold.png', bottom: '/static/textures/grass/dirt.png', sides: '/static/textures/grass/grass_side_cold.png' }, transparent: false });

blockRegistry.register({ id: 14, name: 'Dalle de Neige', textures: { all: '/static/textures/others/snow_slab.png' }, transparent: false, isSlab: true });

blockRegistry.register({ id: 15, name: 'Bûche de Sapin', type: 'axe', level: 1, breakTime: 0.8, textures: { top: '/static/textures/bois/bûches/pine_top.png', bottom: '/static/textures/bois/bûches/pine_top.png', sides: '/static/textures/bois/bûches/pine_side.png' }, transparent: false });

blockRegistry.register({ id: 16, name: 'Feuilles de sapin', textures: { all: '/static/textures/bois/leaves/pine_leaves.png' }, transparent: true, alphaTest: 0.5 });

blockRegistry.register({ id: 17, name: 'Deepslate', type: 'pickaxe', level: 2, breakTime: 2.2, textures: { all: '/static/textures/pierres/deepslates/deepslate.png' }, transparent: false });

blockRegistry.register({ id: 22, name: 'Fleur Nyamée', textures: { all: '/static/textures/Nyamée/Fleur-Nyamée.png' }, transparent: true, alphaTest: 0.5, isPlant: true });

blockRegistry.register({ id: 24, name: 'Feuilles_Nyamée', textures: { all: '/static/textures/Nyamée/Nyamée_leaves.png' }, transparent: true, alphaTest: 0.5 });

blockRegistry.register({ id: 25, name: 'Bois_Nyamée', type: 'axe', level: 1, breakTime: 0.8, textures: { top: '/static/textures/Nyamée/Nyamée_top.png', bottom: '/static/textures/Nyamée/Nyamée_top.png', sides: '/static/textures/Nyamée/Nyamée_side.png' }, transparent: false });

blockRegistry.register({ id: 26, name: 'Herbe_Nyamée', textures: { top: '/static/textures/Nyamée/grass_top_Nyamée.png', bottom: '/static/textures/grass/dirt.png', sides: '/static/textures/Nyamée/grass_side_Nyamée.png' }, transparent: false });

blockRegistry.register({ id: 27, name: 'Feuilles_savane', textures: { all: '/static/textures/bois/leaves/acacia_leaves.png' }, transparent: true, alphaTest: 0.5 });

blockRegistry.register({ id: 28, name: 'Bois_savane', type: 'axe', level: 1, breakTime: 0.8, textures: { top: '/static/textures/bois/bûches/acacia_top.png', bottom: '/static/textures/bois/bûches/acacia_top.png', sides: '/static/textures/bois/bûches/acacia_side.png' }, transparent: false });

blockRegistry.register({ id: 29, name: 'Herbe_Nyamée', textures: { top: '/static/textures/grass/grass_top_hot.png', bottom: '/static/textures/grass/dirt.png', sides: '/static/textures/grass/grass_side_hot.png' }, transparent: false });

blockRegistry.register({ id: 30, name: 'Herbe Noire', textures: { top: '/static/textures/grass/grass_top_dark.png', bottom: '/static/textures/grass/dirt.png', sides: '/static/textures/grass/grass_side_dark.png' }, transparent: false });

blockRegistry.register({ id: 31, name: 'Herbe chaude', textures: { top: '/static/textures/grass/grass_top_hot.png', bottom: '/static/textures/grass/dirt.png', sides: '/static/textures/grass/grass_side_hot.png' }, transparent: false });

blockRegistry.register({ id: 32, name: 'Lave', textures: { all: '/static/textures/others/lava.png' }, transparent: true, alphaTest: 0.1, isFluid: true, viscosity: 2, lightLevel: 12, drop: null, breakTime: 0 });

blockRegistry.register({ id: 33, name: 'Sable rouge', textures: { all: '/static/textures/desert/red_sand.png' }, transparent: false });

blockRegistry.register({ id: 34, name: 'Feuilles acacia', textures: { all: '/static/textures/bois/leaves/acacia_leaves.png' }, transparent: true, alphaTest: 0.5 });

blockRegistry.register({ id: 35, name: 'Bois Noir', type: 'axe', level: 1, breakTime: 0.9, textures: { top: '/static/textures/bois/bûches/dark_top.png', bottom: '/static/textures/bois/bûches/dark_top.png', sides: '/static/textures/bois/bûches/dark_side.png' }, transparent: false });

blockRegistry.register({ id: 36, name: 'Feuilles Noire', textures: { all: '/static/textures/bois/leaves/dark_leaves.png' }, transparent: true, alphaTest: 0.5 });

blockRegistry.register({ id: 37, name: 'Magma', textures: { all: '/static/textures/others/magma.png' }, transparent: false, lightLevel: 12 });

blockRegistry.register({ id: 38, name: 'Obsidienne', type: 'pickaxe', level: 3, breakTime: 5, textures: { all: '/static/textures/others/obsidian.png' }, transparent: false });

blockRegistry.register({ id: 39, name: 'Dalle de cendre', textures: { all: '/static/textures/others/ash_slab.png' }, transparent: false, isSlab: true });

blockRegistry.register({ id: 40, name: 'Herbe', textures: { top: '/static/textures/pierres/others/basalt_top.png', bottom: '/static/textures/pierres/others/basalt_top.png', sides: '/static/textures/pierres/others/basalt_side.png' }, transparent: false });

blockRegistry.register({
    id: 18,
    name: 'Pied de Champignon',
    textures: { all: '/static/textures/others/mushroom_stem.png' },
    transparent: false
});

blockRegistry.register({
    id: 19,
    name: 'Chapeau Champignon Rouge',
    textures: { all: '/static/textures/others/mushroom_block_red.png' },
    transparent: false
});

blockRegistry.register({
    id: 20,
    name: 'Mycélium',
    textures: {
        top: '/static/textures/others/mycelium_top.png',
        bottom: '/static/textures/grass/dirt.png',
        sides: '/static/textures/others/mycelium_side.png'
    },
    transparent: false
});

blockRegistry.register({
    id: 21,
    name: 'Petit Champignon',
    textures: { all: '/static/textures/others/red_mushroom.png' },
    transparent: true,
    alphaTest: 0.5,
    isPlant: true,
    lightLevel: 8, 
    emitColor: 0xff4444
});

blockRegistry.register({
    id: 23,
    name: 'Feuilles d automne',
    textures: { all: '/static/textures/bois/leaves/automne_leaves.png' },
    transparent: true,
    alphaTest: 0.5
});

blockRegistry.register({
    id: 240,
    name: 'Bloc de Portail',
    textures: { all: '/static/textures/portal.png' },
    transparent: false
});

blockRegistry.register({
    id: 241,
    name: 'Portail',
    textures: { all: '/static/textures/portal_cadre.png' },
    transparent: true,
    alphaTest: 0.1,
    isPlant: true,
    lightLevel: 12,
    emitColor: 0x9b30ff
});

// Minerais supplémentaires utilisant les textures déjà présentes.
blockRegistry.register({ id: 55, name: 'Minerai de charbon', textures: { all: '/static/textures/ores/coal_ore.png' }, transparent: false, drop: 1102, type: 'pickaxe', level: 1, breakTime: 1.2 });
blockRegistry.register({ id: 56, name: 'Minerai de cuivre', textures: { all: '/static/textures/ores/cooper_ore.png' }, transparent: false, drop: 1114, type: 'pickaxe', level: 2, breakTime: 1.6 });
blockRegistry.register({ id: 57, name: 'Minerai de diamant', textures: { all: '/static/textures/ores/diamond_ore.png' }, transparent: false, drop: 1115, type: 'pickaxe', level: 3, breakTime: 2.4 });
blockRegistry.register({ id: 62, name: 'Torche', textures: { all: '/static/textures/others/torche.png' }, transparent: true, alphaTest: 0.1, lightLevel: 12, breakTime: 0.1 });
