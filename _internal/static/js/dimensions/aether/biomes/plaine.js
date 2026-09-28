biomeRegistry.register({
    id: 'plaine',
    name: 'Plaine',
    surfaceBlock: 3,
    subSurfaceBlock: 2,
    stoneBlock: 1,
    
    baseHeight: 18,
    elevationScale: 6, // Doux
    detailScale: 2,

    generateDecorations: function(world, x, surfaceY, z, perlin) {
        const treeNoise = perlin.noise(x * 0.08, z * 0.08);
        if (treeNoise > 0.65 && (x + z * 17) % 13 === 0) {
            if (world.getBlock(x, surfaceY + 1, z) === 0) {
                world.spawnTree(x, surfaceY + 1, z);
                return;
            }
        }

        const vegNoise = perlin.noise(x * 0.3, z * 0.3);
        if (world.getBlock(x, surfaceY + 1, z) === 0) {
            if (vegNoise > 0.45) world.setBlock(x, surfaceY + 1, z, 6);
            else if (vegNoise < -0.45) world.setBlock(x, surfaceY + 1, z, 7);
            else if (vegNoise > 0.35 && vegNoise < 0.4) world.setBlock(x, surfaceY + 1, z, 8);
        }
    }
});