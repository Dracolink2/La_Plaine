Pour créer un block sur ce jeu c'est simple, il faut :
1 nommer un fichier comme un veut ou juste ajouter une ligne dans un JS existant dans static/js/blocks/
2 : c'est relou à expliquer donc voici un exemple :

blockRegistry.register({
    id: 200,
    name: 'Cristal bleu', //c'est le nom du block
    type: 'pickaxe',       // c'est l'outil requis pour le miner et avoir un drop
    level: 2,              // niveau d'outil requis
    breakTime: 1.2,        // temps de minage
    textures: {
        all: '/static/textures/others/cristal_bleu.png'   // le chemin de la texture
    },
    transparent: false,  // si il est transparent ou non
    drop: 200              // c'est l'identifiant de l'item à donner au joueur
});

En gros , c'est plutôt simple en fait , après c'est un peu limité pour l'instant désolé