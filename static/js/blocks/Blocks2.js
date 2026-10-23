blockRegistry.register({ id: 41, name: 'Planche de chêne', type: 'axe', level: 1, breakTime: 0.5, textures: { all: '/static/textures/bois/planks/oak_plank.png' }, transparent: false });

blockRegistry.register({ id: 42, name: 'Planche d acacia', type: 'axe', level: 1, breakTime: 0.5, textures: { all: '/static/textures/bois/planks/acacia_plank.png' }, transparent: false });

blockRegistry.register({ id: 43, name: 'Planche noire', type: 'axe', level: 1, breakTime: 0.5, textures: { all: '/static/textures/bois/planks/dark_plank.png' }, transparent: false });

blockRegistry.register({ id: 44, name: 'Planche de Nyamée', type: 'axe', level: 1, breakTime: 0.5, textures: { all: '/static/textures/Nyamée/nyamée_plank.png' }, transparent: false });

blockRegistry.register({ id: 45, name: 'Planche de sapin', type: 'axe', level: 1, breakTime: 0.5, textures: { all: '/static/textures/bois/planks/pine_plank.png' }, transparent: false });

blockRegistry.register({ id: 46, name: 'Pierre taillée', textures: { all: '/static/textures/pierres/stone/chiseled_stone.png' }, transparent: false });

blockRegistry.register({ id: 47, name: 'Pierre taillée cassée', textures: { all: '/static/textures/pierres/stone/broken_chiseled_stone.png' }, transparent: false });

blockRegistry.register({ id: 48, name: 'Brick', textures: { all: '/static/textures/pierres/bricks/brick.png' }, transparent: false });

blockRegistry.register({ id: 49, name: 'Brick de deepslate', textures: { all: '/static/textures/pierres/deepslates/deepslate_brick.png' }, transparent: false });

blockRegistry.register({ id: 50, name: 'Brick de deepslate cassée', textures: { all: '/static/textures/pierres/deepslates/broken-deepslate-brick.png' }, transparent: false });

blockRegistry.register({ id: 51, name: 'verre', textures: { all: '/static/textures/others/glass.png' }, transparent: true });
blockRegistry.register({ id: 52, name: 'Minerai de fer', textures: { all: '/static/textures/ores/iron_ore.png' }, transparent: false, drop: 1103, type: 'pickaxe', level: 2, breakTime: 1.7 });

// Bloc utilitaire : table de fabrication (grille 3×3).
blockRegistry.register({ id: 54, name: 'Table de craft', textures: { top: '/static/textures/bois/crafting_table/crafting_table_top.png', bottom: '/static/textures/bois/crafting_table/crafting_table_top.png', sides: '/static/textures/bois/crafting_table/crafting_table_side.png' }, transparent: false, breakTime: 1.2 });

blockRegistry.register({ id: 58, name: 'Bloc de charbon', textures: { all: '/static/textures/others/coal_block.png' }, transparent: false, type: 'pickaxe', level: 1, breakTime: 3.0 });


// Four : bloc de cuisson utilisant les textures déjà présentes.
blockRegistry.register({ id: 53, name: 'Four', textures: { all: '/static/textures/others/furnace_off.png' }, transparent: false, type: 'pickaxe', level: 1, breakTime: 2.5 });
