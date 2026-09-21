biomeRegistry.register({
    id: 'plaine_enneigee',
    name: 'Plaine Enneigée',
    surfaceBlock: 13,   // Herbe Froide
    subSurfaceBlock: 2, // Terre
    stoneBlock: 1,      // Pierre

    // Mêmes propriétés de relief que la Plaine
    baseHeight: 18,
    elevationScale: 10,
    detailScale: 2,

    generateDecorations: function(world, x, surfaceY, z, perlin) {
        // Arbres très rares
        const treeNoise = perlin.noise(x * 0.08, z * 0.08);
        if (treeNoise > 0.65 && (x + z * 17) % 13 === 0) {
            if (world.getBlock(x, surfaceY + 1, z) === 0) {
                world.spawnTree(x, surfaceY + 1, z);
                return;
            }
        }

        // Couverture au sol avec les dalles de neige
        const snowNoise = perlin.noise(x * 0.3, z * 0.3);
        if (world.getBlock(x, surfaceY + 1, z) === 0) {
            if (snowNoise > -0.1) {
                world.setBlock(x, surfaceY + 1, z, 14); // Dalle de Neige
            }
        }
    }
});