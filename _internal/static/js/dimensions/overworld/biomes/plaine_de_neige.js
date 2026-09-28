biomeRegistry.register({
    id: 'plaine_enneigee',
    name: 'Plaine Enneigée',
    surfaceBlock: 13,
    subSurfaceBlock: 2,
    stoneBlock: 1,

    baseHeight: 18,
    elevationScale: 6,
    detailScale: 2,

    generateDecorations: function(world, x, surfaceY, z, perlin) {
        const treeNoise = perlin.noise(x * 0.08, z * 0.08);
        if (treeNoise > 0.65 && (x + z * 17) % 13 === 0) {
            if (world.getBlock(x, surfaceY + 1, z) === 0) {
                world.spawnTree(x, surfaceY + 1, z);
                return;
            }
        }

        const snowNoise = perlin.noise(x * 0.3, z * 0.3);
        if (world.getBlock(x, surfaceY + 1, z) === 0 && snowNoise > -0.1) {
            world.setBlock(x, surfaceY + 1, z, 14);
        }
    }
});