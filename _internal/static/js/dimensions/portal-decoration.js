// static/js/dimensions/portal-decoration.js
// Génération automatique et rare de portails, appelée depuis generateDecorations() des biomes.
// Une seule fonction partagée pour ne pas dupliquer la logique dans chaque biome.
//
// Réglage de la rareté : PORTAL_RARITY_MOD plus grand = plus rare.
// Avec ces valeurs, on obtient environ 1 portail tous les ~6000 colonnes candidates
// (et seulement celles au-dessus du niveau de la mer) -> de l'ordre de 0 à 1 portail
// par petite zone explorée d'un biome, comme demandé.
const PORTAL_RARITY_MOD = 6000;
const PORTAL_RARITY_MATCH = 777;
const PORTAL_INTERIOR_W = 2; // largeur intérieure
const PORTAL_INTERIOR_H = 3; // hauteur intérieure

function _isRarePortalSpot(x, z, perlin) {
    const h = (Math.imul(x, 928371) + Math.imul(z, 123457)) >>> 0;
    if (h % PORTAL_RARITY_MOD !== PORTAL_RARITY_MATCH) return false;
    return perlin.noise(x * 0.013, z * 0.013) > 0.9;
}

// Retourne true si un portail a été construit à cet endroit (colonne à ignorer pour
// le reste de la décoration de ce biome, ex: ne pas y poser un arbre par-dessus).
window.trySpawnPortalStructure = function (world, x, surfaceY, z, perlin) {
    if (typeof dimensionRegistry === 'undefined') return false;
    if (surfaceY <= world.seaLevel) return false; // pas dans l'eau / sur la plage
    if (!_isRarePortalSpot(x, z, perlin)) return false;
    if (world.getBlock(x, surfaceY + 1, z) !== 0) return false; // il faut de la place au-dessus

    const axis = ((x + z) & 1) === 0 ? 'x' : 'z'; // orientation du portail, variée mais déterministe
    const W = PORTAL_INTERIOR_W, H = PORTAL_INTERIOR_H;
    const y0 = surfaceY + 1;
    const frameId = dimensionRegistry.PORTAL_FRAME_ID;
    const portalId = dimensionRegistry.PORTAL_BLOCK_ID;

    for (let dw = -1; dw <= W; dw++) {
        for (let dh = -1; dh <= H; dh++) {
            const isBorder = (dw === -1 || dw === W || dh === -1 || dh === H);
            const px = axis === 'x' ? x : x + dw;
            const pz = axis === 'x' ? z + dw : z;
            world.setBlock(px, y0 + dh, pz, isBorder ? frameId : portalId);
        }
    }
    return true;
};