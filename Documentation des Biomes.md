Pour créer un biome sur ce jeu c'est simple, il faut :
1 nommer un fichier comme un veut ou juste ajouter une ligne dans un JS existant dans static/js/dimensions/overworld/biomes ( pour ajouter un biome dans l'overworld)

2 : un exemple est meilleur 

overworldBiomeRegistry.register({
    id: 'cristalines', // identifiant du biome unique
    name: 'Terres cristallines', // le nom du biome
    surfaceBlock: 200, // l'identifiant du block de surface
    subSurfaceBlock: 2, // l'identifiant du block en dessous du block de surface
    stoneBlock: 1, // l'indentifiant du block qui est en dessous de tout le reste jusqu'au socle
    baseHeight: 20, // la hauteur moyenne du biome
    elevationScale: 7, // le variation de hauteur du biome
    detailScale: 2, // le niveau de détail
	// vous avez aussi le droit d'ajouter du javascript pour générer d'autres choses
});