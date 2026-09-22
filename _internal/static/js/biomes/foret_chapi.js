biomeRegistry.register({
    id: 'foret_champignon',
    name: 'Forêt Champignon',
    surfaceBlock: 20,   // Mycélium
    subSurfaceBlock: 2, // Terre
    stoneBlock: 1,      // Pierre

    baseHeight: 18,
    elevationScale: 8,
    detailScale: 3,

    generateDecorations: function(world, x, surfaceY, z, perlin) {
        const shroomNoise = perlin.noise(x * 0.1, z * 0.1);

        // Génération de grands champignons géants
        if (shroomNoise > 0.2 && (x * 7 + z * 13) % 11 === 0) {
            if (world.getBlock(x, surfaceY + 1, z) === 0) {
                this.spawnGiantMushroom(world, x, surfaceY + 1, z, perlin);
                return;
            }
        }

        // Petits champignons au sol
        const veg = perlin.noise(x * 0.3, z * 0.3);
        if (world.getBlock(x, surfaceY + 1, z) === 0 && veg > 0.3) {
            world.setBlock(x, surfaceY + 1, z, 21); // Petit champignon
        }
    },

    spawnGiantMushroom: function(world, x, startY, z, perlin) {
        const height = 4 + Math.floor(Math.abs(perlin.noise(x, z)) * 3); // Hauteur 4 à 6

        // Tronc (Pied de champignon : ID 18)
        for (let h = 0; h < height; h++) {
            world.setBlock(x, startY + h, z, 18);
        }

        // Chapeau (ID 19)
        const capY = startY + height;
        const radius = 2;

        for (let dx = -radius; dx <= radius; dx++) {
            for (let dz = -radius; dz <= radius; dz++) {
                // Forme arrondie pour le chapeau
                if (Math.abs(dx) === radius && Math.abs(dz) === radius) continue;

                world.setBlock(x + dx, capY, z + dz, 19);

                // Rebord descendant du chapeau pour faire un dôme
                if (Math.abs(dx) === radius || Math.abs(dz) === radius) {
                    world.setBlock(x + dx, capY - 1, z + dz, 19);
                }
            }
        }
    }
});