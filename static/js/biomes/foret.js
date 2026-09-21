biomeRegistry.register({
    id: 'foret',
    name: 'Forêt',
    surfaceBlock: 3,    // Herbe
    subSurfaceBlock: 2, // Terre
    stoneBlock: 1,      // Pierre

    baseHeight: 20,
    elevationScale: 12,
    detailScale: 3,

    generateDecorations: function(world, x, surfaceY, z, perlin) {
        const treeNoise = perlin.noise(x * 0.12, z * 0.12);
        
        // Forte densité d'arbres
        if (treeNoise > 0.15 && (x * 11 + z * 13) % 7 === 0) {
            if (world.getBlock(x, surfaceY + 1, z) === 0) {
                world.spawnTree(x, surfaceY + 1, z);
                return;
            }
        }

        // Sous-bois (herbe et fleurs)
        const veg = perlin.noise(x * 0.4, z * 0.4);
        if (world.getBlock(x, surfaceY + 1, z) === 0) {
            if (veg > 0.2) world.setBlock(x, surfaceY + 1, z, 6); // Haute Herbe
            else if (veg < -0.3) world.setBlock(x, surfaceY + 1, z, 7); // Fleur
        }
    }
});