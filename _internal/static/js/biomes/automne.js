biomeRegistry.register({
    id: 'foret_automne',
    name: "Forêt d'Automne",
    surfaceBlock: 3,        // Bloc d'herbe / surface habituel
    subSurfaceBlock: 2,     // Terre sous la surface
    stoneBlock: 1,          // Pierre profonde

    baseHeight: 20,
    elevationScale: 8,
    detailScale: 3,

    ambiance: { tint: 0xffd9a0, fogDensity: 0.85 },

    generateDecorations: function(world, x, surfaceY, z, perlin) {
        const treeNoise = perlin.noise(x * 0.12, z * 0.12);
        if (treeNoise > 0.15 && (x * 11 + z * 13) % 7 === 0) {
            this.spawnAutumnTree(world, x, surfaceY + 1, z, perlin);
            return;
        }

        const veg = perlin.noise(x * 0.4, z * 0.4);
        if (world.getBlock(x, surfaceY + 1, z) === 0) {
            if (veg > 0.2) world.setBlock(x, surfaceY + 1, z, 22);
            else if (veg < -0.3) world.setBlock(x, surfaceY + 1, z, 7);
        }
    },

    spawnAutumnTree: function(world, x, startY, z, perlin) {
        const treeHeight = 4 + Math.floor(Math.abs(perlin.noise(x * 0.5, z * 0.5)) * 2);

        // ID 4 = Tronc de bois
        for (let y = startY; y < startY + treeHeight; y++) {
            world.setBlock(x, y, z, 4);
        }

        const leafStart = startY + treeHeight - 2;
        const leafEnd = startY + treeHeight + 1;

        // Génération de la couronne de feuilles
        for (let ly = leafStart; ly <= leafEnd; ly++) {
            const radius = ly >= leafEnd - 1 ? 1 : 2;
            for (let lx = x - radius; lx <= x + radius; lx++) {
                for (let lz = z - radius; lz <= z + radius; lz++) {
                    if (world.getBlock(lx, ly, lz) === 0) {
                        if (Math.abs(lx - x) === radius && Math.abs(lz - z) === radius && ((lx + ly + lz) & 1) === 0) {
                            continue;
                        }
                        // Remplacez 23 par l'ID numérique associé à 'automne_leaves.png' dans votre blockRegistry
                        world.setBlock(lx, ly, lz, 23);
                    }
                }
            }
        }
    }
});