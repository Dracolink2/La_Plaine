overworldBiomeRegistry.register({
    id: 'Savane',
    name: 'Savane',
    surfaceBlock: 29,
    subSurfaceBlock: 2,
    stoneBlock: 1,

    baseHeight: 20,
    elevationScale: 8,
    detailScale: 3,

    generateDecorations(world, x, surfaceY, z, perlin) {
        if (world.getBlock(x, surfaceY + 1, z) !== 0) return;

        const treeNoise = perlin.noise(x * 0.055 + 500, z * 0.055 + 500);
        if (treeNoise > 0.40 && ((x * 7 + z * 11) % 13 === 0)) {
            this.spawnSavaneTree(world, x, surfaceY + 1, z, perlin);
            return;
        }

        const grassNoise = perlin.noise(x * 0.20 - 200, z * 0.20 - 200);
        if (grassNoise > 0.28) world.setBlock(x, surfaceY + 1, z, grassNoise > 0.55 ? 6 : 8);
    },

    spawnSavaneTree(world, x, startY, z, perlin) {
        const trunkHeight = 5 + Math.floor(Math.abs(perlin.noise(x * 0.5, z * 0.5)) * 4);
        let currentX = x;
        const offsetX = perlin.noise(x * 0.7, startY * 0.2) > 0 ? 1 : -1;

        for (let h = 0; h < trunkHeight; h++) {
            if (h === trunkHeight - 2) currentX += offsetX;
            world.setBlock(currentX, startY + h, z, 28);
        }

        const crownY = startY + trunkHeight;
        const radius = 3;
        for (let dx = -radius; dx <= radius; dx++) {
            for (let dz = -radius; dz <= radius; dz++) {
                if (Math.abs(dx) === radius && Math.abs(dz) === radius) continue;
                const px = currentX + dx, pz = z + dz;
                if (world.getBlock(px, crownY, pz) === 0) world.setBlock(px, crownY, pz, 27);
            }
        }
        for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
                if (world.getBlock(currentX + dx, crownY + 1, z + dz) === 0) world.setBlock(currentX + dx, crownY + 1, z + dz, 27);
            }
        }
    }
});
