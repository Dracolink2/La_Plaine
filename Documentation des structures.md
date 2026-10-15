Pour créer une sur ce jeu c'est moins simple que les autres , il faut :
1 nommer un fichier comme on veut et le créer en .js static/js/dimensions/overworld/biomes/structures

2 : un exemple est meilleur 

window.BiomeStructures = window.BiomeStructures || {};
window.BiomeStructures.cristalMonument = {
    id: 'cristal\_monument', // son identifiant unique
    size: { x: 3, y: 4, z: 3 }, // sa taille
    chance: 0.08, // ses chances de spawn
    minFlatLength: 3, // le nombre de blocks alignés minimal pour le spawn de cette structure 
    flatTolerance: 1, // sa tolérance pour le nombre de block alignés 
    guaranteedOnFlat: false, // si il est garantit sur du plat

    place(world, x, y, z) {
        for (let dx = 0; dx < 3; dx++) {
            for (let dz = 0; dz < 3; dz++) {
                world.setBlock(x + dx, y, z + dz, 200);
            }
        }
        world.setBlock(x + 1, y + 1, z + 1, 201);
    }
    // et là c'est comment il est en gros
};