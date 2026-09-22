biomeRegistry.register({
    id: 'foret_sapin',
    name: 'Forêt de Sapin',
    surfaceBlock: 13,   // Herbe Froide
    subSurfaceBlock: 2, // Terre
    stoneBlock: 1,      // Pierre

    baseHeight: 20,
    elevationScale: 12,
    detailScale: 3,

    generateDecorations: function(world, x, surfaceY, z, perlin) {
        const treeNoise = perlin.noise(x * 0.12, z * 0.12);
        
        // 1. Génération des sapins
        if (treeNoise > 0.15 && (x * 11 + z * 13) % 7 === 0) {
            this.spawnPineTree(world, x, surfaceY + 1, z, perlin);
            return;
        }

        // 2. Couche de dalle de neige (ID 14) sur l'herbe froide s'il n'y a pas d'arbre
        if (world.getBlock(x, surfaceY + 1, z) === 0) {
            world.setBlock(x, surfaceY + 1, z, 14); // Dalle de Neige
        }
    },

    // Méthode pour générer un sapin conique
    spawnPineTree: function(world, x, startY, z, perlin) {
        const trunkHeight = 5 + Math.floor(Math.abs(perlin.noise(x, z)) * 3); // Hauteur entre 5 et 7
        const leavesStart = 2; // Les feuilles commencent à partir de Y + 2 du tronc

        // Génération du tronc (Bûches de Sapin : ID 15)
        for (let h = 0; h < trunkHeight; h++) {
            world.setBlock(x, startY + h, z, 15);
        }

        // Génération des feuilles coniques (Feuilles de Sapin : ID 16)
        let radius = 2;
        for (let h = leavesStart; h <= trunkHeight + 1; h++) {
            const currentY = startY + h;
            
            for (let dx = -radius; dx <= radius; dx++) {
                for (let dz = -radius; dz <= radius; dz++) {
                    // Évite les coins extrêmes pour un feuillage plus arrondi / conique
                    if (Math.abs(dx) === radius && Math.abs(dz) === radius && radius > 0) {
                        continue;
                    }

                    const targetX = x + dx;
                    const targetZ = z + dz;

                    // Place des feuilles si l'emplacement est vide ou contient une dalle de neige
                    const currentBlock = world.getBlock(targetX, currentY, targetZ);
                    if (currentBlock === 0 || currentBlock === 14) {
                        world.setBlock(targetX, currentY, targetZ, 16);
                    }
                }
            }

            // Réduit le rayon en montant pour créer la forme de cône du sapin
            if (h % 2 === 0 && radius > 0) {
                radius--;
            }
        }

        // Sommet du sapin (Pointe)
        const topY = startY + trunkHeight + 2;
        if (world.getBlock(x, topY, z) === 0 || world.getBlock(x, topY, z) === 14) {
            world.setBlock(x, topY, z, 16);
        }
    }
});