// static/js/dimensions/nether/access.js
dimensionRegistry.register({
    id: 'aether',
    name: 'aether',
    biomeRegistry: window.aetherBiomeRegistry
    // canAccess: (player) => true   <- si un jour tu veux remettre une condition, ajoute-la ici.
    // Pour l'instant : construire le cadre en "Bloc de Portail" suffit, aucun objet requis.
});