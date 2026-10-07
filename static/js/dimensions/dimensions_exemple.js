// static/js/dimensions/<id>/access.js  -- MODÈLE : copie, change l'id et le biomeRegistry
//
// À faire pour une nouvelle dimension :
//   1. créer static/js/dimensions/<id>/biomes/ avec ses biomes + son biomeRegistry
//   2. créer ce access.js
//   3. ajouter les <script> correspondants dans ton HTML (avant main.js)
// C'est tout : le portail, le retour et la téléportation sont gérés par register.js.

dimensionRegistry.register({
    id: 'nether',
    name: 'Le Nether',
    biomeRegistry: window.netherBiomeRegistry, // <-- le registre de TA dimension

    // Portail QUI MÈNE À cette dimension : change juste ces deux ids de blocs.
    // (les blocs doivent exister dans ton registre de blocs ; sans cette ligne : 240 / 241)
    portal: { frame: 242, block: 243 },

    // --- tout ce qui suit est facultatif ---
    // canAccess: (player) => player.inventory.has(123),
    // onDenied: () => console.log('Accès refusé'),
    // onEnter: (world, player, fromDim) => {},
    // onLeave: (world, player, toDim) => {},
    // portalTarget: 'overworld',   // sinon : dimension suivante, en boucle
    // returnPortal: true,          // portail de retour auto à l'arrivée
    // naturalPortals: true,        // portails rares générés dans cette dimension
    // spawn: { x: 0, z: 0 },       // zone d'apparition, relative à la dimension
});