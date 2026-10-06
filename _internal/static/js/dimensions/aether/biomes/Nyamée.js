biomeRegistry.register({
    id: 'Nyamée',
    name: 'Nyamée',
    surfaceBlock: 26,      // Herbe spéciale
    subSurfaceBlock: 2,   // Terre sous la surface
    stoneBlock: 1,        // Roche

    baseHeight: 18,
    elevationScale: 6,
    detailScale: 2,

    ambiance: { tint: 0xfff2c2, fogDensity: 1 },

    generateDecorations: function(world, x, surfaceY, z, perlin) {
        // Apparition des arbres
        const treeNoise = perlin.noise(x * 0.08, z * 0.08);
        if (treeNoise > 0.65 && (x + z * 17) % 13 === 0) {
            this.spawnTree(world, x, surfaceY + 1, z);
            return;
        }

        // Apparition dense de fleurs sur l'herbe spéciale
        const flowerNoise = perlin.noise(x * 0.3, z * 0.3);
        if (flowerNoise > -0.2 && world.getBlock(x, surfaceY + 1, z) === 0) {
            world.setBlock(x, surfaceY + 1, z, 22); // Fleurs (ID 22)
        }
    },

    spawnTree: function(world, x, startY, z) {
        const height = 4;

        // Bûches (ID 25)
        for (let h = 0; h < height; h++) {
            world.setBlock(x, startY + h, z, 25);
        }

        // Feuilles (ID 24)
        for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
                for (let dy = 2; dy <= 4; dy++) {
                    if (world.getBlock(x + dx, startY + dy, z + dz) === 0) {
                        world.setBlock(x + dx, startY + dy, z + dz, 24);
                    }
                }
            }
        }
    }
});