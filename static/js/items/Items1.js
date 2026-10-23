(function () {
    const registry = window.itemsRegistry;
    registry.registerBlocks();
    const tools = [
        [1001, 'Pioche en bois', 'pickaxe', 1, '/static/textures/bois/tools/wooden_pick.png'],
        [1002, 'Pioche en pierre', 'pickaxe', 2, '/static/textures/pierres/tools/stone_pick.png'],
        [1003, 'Pioche en fer', 'pickaxe', 3, '/static/textures/iron/iron_pick.png'],
        [1011, 'Hache en bois', 'axe', 1, '/static/textures/bois/tools/wooden_axe.png'],
        [1012, 'Hache en pierre', 'axe', 2, '/static/textures/pierres/tools/stone_axe.png'],
        [1013, 'Hache en fer', 'axe', 3, '/static/textures/iron/iron_axe.png'],
        [1021, 'Pelle en bois', 'shovel', 1, '/static/textures/bois/tools/wooden_shovel.png'],
        [1022, 'Pelle en pierre', 'shovel', 2, '/static/textures/pierres/tools/stone_shovel.png'],
        [1023, 'Pelle en fer', 'shovel', 3, '/static/textures/iron/iron_shovel.png'],
        [1031, 'Épée en bois', 'sword', 1, '/static/textures/bois/tools/wooden_sword.png'],
        [1032, 'Épée en pierre', 'sword', 2, '/static/textures/pierres/tools/stone_sword.png'],
        [1033, 'Épée en fer', 'sword', 3, '/static/textures/iron/iron_sword.png'],
        [1004, 'Pioche en diamant', 'pickaxe', 4, '/static/textures/tools/diamond_pick.png'],
        [1014, 'Hache en diamant', 'axe', 4, '/static/textures/tools/diamond_axe.png'],
        [1024, 'Pelle en diamant', 'shovel', 4, '/static/textures/tools/diamond_shovel.png'],
        [1034, 'Épée en diamant', 'sword', 4, '/static/textures/tools/diamond_sword.png'],
        [1101, 'Bâton', null, 1, '/static/textures/materials/stick.png'],
        [1102, 'Charbon', null, 1, '/static/textures/materials/coal.png'],
        [1103, 'Minerai de fer', null, 1, '/static/textures/ores/iron_ore.png'],
        [1104, 'Lingot de fer', null, 1, '/static/textures/iron/iron_ingot.png'],
	[1105, 'mouton cuit', null, 1, '/static/textures/food/cooked_sheep.png'],
        [1106, 'Laine', null, 1, '/static/textures/others/laine.png'],
        [1107, 'mouton cru', null, 1, '/static/textures/food/raw_sheep.png'],
        [1108, 'Plume', null, 1, '/static/textures/materials/feather.png'],
        [1109, 'Œuf', null, 1, '/static/textures/others/egg.png'],
        [1111, 'Cuir', null, 1, '/static/textures/materials/leather.png'],
        [1112, 'Charbon de bois', null, 1, '/static/textures/others/wood_coal.png'],
        [1113, 'Pierre brute', null, 1, '/static/textures/pierres/stone/stone.png'],
        [1114, 'Minerai de cuivre', null, 1, '/static/textures/ores/cooper_ore.png'],
        [1115, 'Diamant', null, 1, '/static/textures/ores/diamond_ore.png'],
        [1116, 'Lingot de cuivre', null, 1, '/static/textures/ores/cooper_block.png'],
        [1117, 'Charbon', null, 1, '/static/textures/materials/coal.png'],
        [1118, 'Poulet cru', null, 1, '/static/textures/food/raw_chicken.png'],
        [1119, 'Poulet cuit', null, 1, '/static/textures/food/cooked_chicken.png'],
        [1120, 'Porc cru', null, 1, '/static/textures/food/raw_pig.png'],
        [1121, 'Porc cuit', null, 1, '/static/textures/food/cooked_pig.png'],
        [1122, 'Bœuf cru', null, 1, '/static/textures/food/raw_cow.png'],
        [1123, 'Bœuf cuit', null, 1, '/static/textures/food/cooked_cow.png'],
        [1124, 'Fil', null, 1, '/static/textures/materials/string.png'],
        [1125, 'Os', null, 1, '/static/textures/materials/bone.png']
    ];
    for (const [id, name, type, level, texture] of tools) {
        registry.register({ id, name, texture, tool: Boolean(type), type, level, stack: type ? 1 : 100 });
    }
    registry.registerBlocks();
})();
