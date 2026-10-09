(function () {
    const registry = window.itemsRegistry;
    registry.registerBlocks();
    const tools = [
        [1001, 'Pioche en bois', 'pickaxe', 1, '/static/textures/oak_plank.png'],
        [1002, 'Pioche en pierre', 'pickaxe', 2, '/static/textures/stone.png'],
        [1003, 'Pioche en fer', 'pickaxe', 3, '/static/textures/deepslate.png'],
        [1011, 'Hache en bois', 'axe', 1, '/static/textures/oak_plank.png'],
        [1012, 'Hache en pierre', 'axe', 2, '/static/textures/stone.png'],
        [1013, 'Hache en fer', 'axe', 3, '/static/textures/deepslate.png'],
        [1021, 'Pelle en bois', 'shovel', 1, '/static/textures/oak_plank.png'],
        [1022, 'Pelle en pierre', 'shovel', 2, '/static/textures/stone.png'],
        [1023, 'Pelle en fer', 'shovel', 3, '/static/textures/deepslate.png'],
        [1101, 'Bâton', null, 1, '/static/textures/oak_plank.png'],
        [1102, 'Charbon', null, 1, '/static/textures/deepslate.png'],
        [1103, 'Minerai de fer', null, 1, '/static/textures/iron_ore.png'],
        [1104, 'Lingot de fer', null, 1, '/static/textures/stone.png'],
        [1105, 'Viande de porc', null, 1, '/static/textures/pig.png'],
        [1106, 'Laine', null, 1, '/static/textures/sheep.png'],
        [1107, 'Viande de mouton', null, 1, '/static/textures/sheep.png'],
        [1108, 'Plume', null, 1, '/static/textures/chicken.png'],
        [1109, 'Œuf', null, 1, '/static/textures/chicken.png'],
        [1110, 'Viande de bœuf', null, 1, '/static/textures/cow.png'],
        [1111, 'Cuir', null, 1, '/static/textures/cow.png'],
        [1112, 'Charbon de bois', null, 1, '/static/textures/oak_plank.png'],
        [1113, 'Pierre brute', null, 1, '/static/textures/stone.png']
    ];
    for (const [id, name, type, level, texture] of tools) {
        registry.register({ id, name, texture, tool: Boolean(type), type, level, stack: type ? 1 : 100 });
    }
    registry.registerBlocks();
})();
