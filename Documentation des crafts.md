Pour créer un craft sur ce jeu c'est simple, il faut :
1 nommer un fichier comme on veut et le créer en .js static/js/crafts/

2 : un exemple est meilleur 

\[
  {
    "id": "cristal\_compresse", // identifiant du craft
    "name": "Cristal compressé", // le nom du craft
    "grid": 2, // la taille de sa grille
    "pattern": \[
      \[1200, 1200],
      \[1200, 1200]
    ], // son pattern avec les ID des items 
    "output": {
      "id": 1201, // l'item qu'il donne
      "count": 1 // son nombre 
    }
  }
]