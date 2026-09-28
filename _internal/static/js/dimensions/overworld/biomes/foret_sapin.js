biomeRegistry.register({
    id: 'foret_sapin',
    name: 'Forêt de Sapin',
    surfaceBlock: 13,
    subSurfaceBlock: 2,
    stoneBlock: 1,

    baseHeight: 21,
    elevationScale: 9,
    detailScale: 3,

    generateDecorations: function(world, x, surfaceY, z, perlin) {
        const treeNoise = perlin.noise(x * 0.12, z * 0.12);
        if (treeNoise > 0.15 && (x * 11 + z * 13) % 7 === 0) {
            this.spawnPineTree(world, x, surfaceY + 1, z, perlin);
            return;
        }

        if (world.getBlock(x, surfaceY + 1, z) === 0) {
            world.setBlock(x, surfaceY + 1, z, 14);
        }
    },

    spawnPineTree: function(world, x, startY, z, perlin) {
        const trunkHeight = 5 + Math.floor(Math.abs(perlin.noise(x, z)) * 3);
        const leavesStart = 2;

        for (let h = 0; h < trunkHeight; h++) {
            world.setBlock(x, startY + h, z, 15);
        }

        let radius = 2;
        for (let h = leavesStart; h <= trunkHeight + 1; h++) {
            const currentY = startY + h;
            for (let dx = -radius; dx <= radius; dx++) {
                for (let dz = -radius; dz <= radius; dz++) {
                    if (Math.abs(dx) === radius && Math.abs(dz) === radius && radius > 0) continue;
                    const currentBlock = world.getBlock(x + dx, currentY, z + dz);
                    if (currentBlock === 0 || currentBlock === 14) {
                        world.setBlock(x + dx, currentY, z + dz, 16);
                    }
                }
            }
            if (h % 2 === 0 && radius > 0) radius--;
        }

        const topY = startY + trunkHeight + 2;
        if (world.getBlock(x, topY, z) === 0 || world.getBlock(x, topY, z) === 14) {
            world.setBlock(x, topY, z, 16);
        }
    }
});