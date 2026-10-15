Pour créer un item sur ce jeu c'est simple, il faut :
1 nommer un fichier comme un veut ou juste ajouter une ligne dans un JS existant dans static/js/items/ 

2 : un exemple est meilleur 

itemsRegistry.register({
    id: 1200, // l'identifiant de l'item
    name: 'Éclat bleu', // le nom de l'item
    texture: '/static/textures/materials/eclat\_bleu.png',
    place: null,       // l'ID du block qu'on peut placer, "null" veut dire qu'on ne peut pas poser de                           // block avec
    tool: false, // définis si c'est un outil ou pas
    stack: 64           // taille maximale de pile
});