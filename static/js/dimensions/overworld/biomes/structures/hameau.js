window.BiomeStructures = window.BiomeStructures || {};
window.BiomeStructures.hameau = {
    id: 'hameau', size: { x: 11, y: 6, z: 9 }, chance: 0.012,
    minFlatLength: 11, flatTolerance: 1,
    place(world, x, y, z) {
        for (let dx = 0; dx < 11; dx++) for (let dz = 0; dz < 9; dz++) world.setBlock(x + dx, y, z + dz, 41);
        for (const [ox, oz, w, d] of [[1,1,4,4],[6,2,4,5]]) {
            for (let dy = 1; dy <= 3; dy++) {
                for (let dx = 0; dx < w; dx++) for (let dz = 0; dz < d; dz++) {
                    if (dx === 0 || dz === 0 || dx === w-1 || dz === d-1) {
                        const door = dz === 0 && dx === Math.floor(w/2) && dy <= 2;
                        world.setBlock(x + ox + dx, y + dy, z + oz + dz, door ? 0 : 4);
                    }
                }
            }
            for (let dx = -1; dx <= w; dx++) for (let dz = -1; dz <= d; dz++) world.setBlock(x + ox + dx, y + 4, z + oz + dz, 41);
        }
        for (let dx = 4; dx <= 6; dx++) for (let dz = 6; dz <= 7; dz++) world.setBlock(x + dx, y + 1, z + dz, 9);
        for (const [dx,dz] of [[0,0],[10,0],[0,8],[10,8]]) {
            world.setBlock(x + dx, y + 1, z + dz, 5);
            world.setBlock(x + dx, y + 2, z + dz, 5);
        }
    }
};
