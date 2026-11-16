window.BiomeStructures = window.BiomeStructures || {};
window.BiomeStructures.ruines = {
    id: 'ruines', size: { x: 9, y: 5, z: 9 }, chance: 0.018,
    minFlatLength: 9, flatTolerance: 2,
    place(world, x, y, z) {
        for (let dx = 0; dx < 9; dx++) for (let dz = 0; dz < 9; dz++) {
            if (dx === 0 || dx === 8 || dz === 0 || dz === 8) {
                if ((dx + dz) % 3 !== 0) world.setBlock(x + dx, y, z + dz, 17);
            }
        }
        for (const [dx,dz,h] of [[0,0,4],[8,0,2],[0,8,3],[8,8,4],[4,0,2],[0,4,2]]) {
            for (let dy = 1; dy <= h; dy++) world.setBlock(x + dx, y + dy, z + dz, dy === h && dy % 2 ? 49 : 17);
        }
        world.setBlock(x + 4, y, z + 4, 46);
        world.setBlock(x + 4, y + 1, z + 4, 37);
    }
};
