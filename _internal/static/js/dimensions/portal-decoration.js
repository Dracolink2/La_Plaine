// static/js/dimensions/portal-decoration.js
// Génération automatique et rare de portails, appelée depuis generateDecorations() des biomes.
// La construction du cadre est partagée avec register.js (dimensionRegistry.buildPortalFrame).
//
// Réglage de la rareté : PORTAL_RARITY_MOD plus grand = plus rare.
// Une dimension peut désactiver les portails naturels avec register({ naturalPortals: false }).
const PORTAL_RARITY_MOD = 6000;
const PORTAL_RARITY_MATCH = 777;

function _isRarePortalSpot(x, z, perlin) {
    const h = (Math.imul(x, 928371) + Math.imul(z, 123457)) >>> 0;
    if (h % PORTAL_RARITY_MOD !== PORTAL_RARITY_MATCH) return false;
    return perlin.noise(x * 0.013, z * 0.013) > 0.9;
}

// Retourne true si un portail a été construit à cet endroit (colonne à ignorer pour
// le reste de la décoration de ce biome, ex: ne pas y poser un arbre par-dessus).
window.trySpawnPortalStructure = function (world, x, surfaceY, z, perlin) {
    const reg = window.dimensionRegistry;
    if (!reg) return false;
    if (reg.order.length < 2) return false; // aucune autre dimension : portail inutile
    if (reg.current && !reg.current.naturalPortals) return false;
    if (surfaceY <= world.seaLevel) return false; // pas dans l'eau / sur la plage
    if (!_isRarePortalSpot(x, z, perlin)) return false;
    if (world.getBlock(x, surfaceY + 1, z) !== 0) return false; // il faut de la place au-dessus

    const axis = ((x + z) & 1) === 0 ? 'x' : 'z'; // orientation variée mais déterministe
    const dest = reg.getDestination(reg.current);
    reg.buildPortalFrame(world, x, surfaceY, z, axis, dest ? dest.portal : null);
    return true;
};