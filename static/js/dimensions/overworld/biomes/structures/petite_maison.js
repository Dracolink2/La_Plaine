// Structure simple — Petite maison
// Une structure n'a volontairement pas de registre : le biome qui la veut
// récupère directement window.BiomeStructures.petiteMaison.

window.BiomeStructures = window.BiomeStructures || {};

window.BiomeStructures.petiteMaison = {
    id: 'petite_maison',
    size: { x: 7, y: 5, z: 7 },
    chance: 0.035,
    minFlatLength: 7,
    flatTolerance: 1,
    guaranteedOnFlat: true,

    place(world, x, y, z) {
        const wood = 4;
        const leaves = 5;

        // Sol
        for (let dx = 0; dx < 7; dx++) {
            for (let dz = 0; dz < 7; dz++) {
                world.setBlock(x + dx, y, z + dz, wood);
            }
        }

        // Murs : porte au milieu de la façade avant.
        for (let dy = 1; dy <= 3; dy++) {
            for (let dx = 0; dx < 7; dx++) {
                for (let dz = 0; dz < 7; dz++) {
                    const edge = dx === 0 || dx === 6 || dz === 0 || dz === 6;
                    if (!edge) continue;

                    if (dz === 0 && dx === 3 && dy <= 2) continue;
                    world.setBlock(x + dx, y + dy, z + dz, wood);
                }
            }
        }

        // Petites fenêtres sur les côtés.
        for (const dy of [2]) {
            for (const sideX of [0, 6]) {
                world.setBlock(x + sideX, y + dy, z + 2, 0);
                world.setBlock(x + sideX, y + dy, z + 4, 0);
            }
        }

        // Toit plat + légère corniche.
        for (let dx = -1; dx <= 7; dx++) {
            for (let dz = -1; dz <= 7; dz++) {
                world.setBlock(x + dx, y + 4, z + dz, leaves);
            }
        }
    }
};
