biomeRegistry.register({
    id: 'foret',
    name: 'Forêt',
    surfaceBlock: 3,
    subSurfaceBlock: 2,
    stoneBlock: 1,

    baseHeight: 20,
    elevationScale: 8,
    detailScale: 3,

    generateDecorations: function(world, x, surfaceY, z, perlin) {
        const treeNoise = perlin.noise(x * 0.12, z * 0.12);
        if (treeNoise > 0.15 && (x * 11 + z * 13) % 7 === 0) {
            if (world.getBlock(x, surfaceY + 1, z) === 0) {
                world.spawnTree(x, surfaceY + 1, z);
                return;
            }
        }

        const veg = perlin.noise(x * 0.4, z * 0.4);
        if (world.getBlock(x, surfaceY + 1, z) === 0) {
            if (veg > 0.2) world.setBlock(x, surfaceY + 1, z, 6);
            else if (veg < -0.3) world.setBlock(x, surfaceY + 1, z, 7);
        }
    }
});