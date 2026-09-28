biomeRegistry.register({
    id: 'Savane',
    name: 'Savane',
    surfaceBlock: 29, // Bloc de surface (ex: herbe séchée)
    subSurfaceBlock: 2, // Bloc sous la surface (ex: terre)
    stoneBlock: 1, // Bloc de roche

    baseHeight: 21,
    elevationScale: 9,
    detailScale: 3,

    /**
     * Méthode appelée lors de la génération du terrain pour placer la végétation/décorations.
     */
    generateDecorations: function(world, x, y, z, perlin) {
        // Utilisation du bruit perlin pour une distribution plus naturelle
        const treeNoise = perlin.noise(x * 0.05 + 500, z * 0.05 + 500);
        const grassNoise = perlin.noise(x * 0.2 - 200, z * 0.2 - 200);

        // Génération d'acacias (densité moyenne/faible)
        if (treeNoise > 0.42) {
            // Vérification ponctuelle pour espacer les arbres
            if ((x % 7 === 0) && (z % 7 === 0)) {
                this.spawnSavaneTree(world, x, y + 1, z, perlin);
                return;
            }
        }

        // Décoration au sol (hautes herbes, fleurs/buissons de savane)
        if (grassNoise > 0.25) {
            const blockAbove = world.getBlock(x, y + 1, z);
            if (blockAbove === 0) {
                // Alternance entre herbe haute et herbe sèche selon le bruit
                const decorBlock = grassNoise > 0.5 ? 14 : 15; 
                world.setBlock(x, y + 1, z, decorBlock);
            }
        }
    },

    /**
     * Génère un acacia style savane avec un feuillage étalé en parasol.
     */
    spawnSavaneTree: function(world, x, startY, z, perlin) {
        // Hauteur de tronc variable (entre 5 et 8 blocs)
        const trunkHeight = 5 + Math.floor(Math.abs(perlin.noise(x * 0.5, z * 0.5)) * 4);

        // 1. Génération du tronc avec une légère courbure
        let currentX = x;
        let currentZ = z;
        const offsetX = perlin.noise(x, startY) > 0 ? 1 : -1;

        for (let h = 0; h < trunkHeight; h++) {
            // Fait dévier le tronc sur le haut pour donner un effet courbé
            if (h === trunkHeight - 2) {
                currentX += offsetX;
            }
            world.setBlock(currentX, startY + h, currentZ, 28); // ID 28 : Bois d'acacia
        }

        // 2. Génération du feuillage en plateau (parasol)
        const crownY = startY + trunkHeight;
        const radius = 3; // Largeur du parasol

        // Couche principale du feuillage (large et plate)
        for (let dx = -radius; dx <= radius; dx++) {
            for (let dz = -radius; dz <= radius; dz++) {
                // Découpe les coins pour arrondir le parasol
                if (Math.abs(dx) === radius && Math.abs(dz) === radius) continue;

                const targetX = currentX + dx;
                const targetZ = currentZ + dz;
                const currentBlock = world.getBlock(targetX, crownY, targetZ);

                if (currentBlock === 0 || currentBlock === 14) {
                    world.setBlock(targetX, crownY, targetZ, 27); // ID 27 : Feuilles d'acacia
                }
            }
        }

        // Petite couche supérieure pour bombée légèrement le centre
        for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
                const targetX = currentX + dx;
                const targetZ = currentZ + dz;
                const currentBlock = world.getBlock(targetX, crownY + 1, targetZ);

                if (currentBlock === 0 || currentBlock === 14) {
                    world.setBlock(targetX, crownY + 1, targetZ, 27);
                }
            }
        }

        // Décoration / Fleur au sommet de l'arbre
        const topY = crownY + 2;
        if (world.getBlock(currentX, topY, currentZ) === 0) {
            world.setBlock(currentX, topY, currentZ, 16);
        }
    }
});