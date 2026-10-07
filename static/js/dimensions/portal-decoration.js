





const PORTAL_RARITY_MOD = 6000;
const PORTAL_RARITY_MATCH = 777;

function _isRarePortalSpot(x, z, perlin) {
    const h = (Math.imul(x, 928371) + Math.imul(z, 123457)) >>> 0;
    if (h % PORTAL_RARITY_MOD !== PORTAL_RARITY_MATCH) return false;
    return perlin.noise(x * 0.013, z * 0.013) > 0.9;
}



window.trySpawnPortalStructure = function (world, x, surfaceY, z, perlin) {
    const reg = window.dimensionRegistry;
    if (!reg) return false;
    if (reg.order.length < 2) return false; 
    if (reg.current && !reg.current.naturalPortals) return false;
    if (surfaceY <= world.seaLevel) return false; 
    if (!_isRarePortalSpot(x, z, perlin)) return false;
    if (world.getBlock(x, surfaceY + 1, z) !== 0) return false; 

    const axis = ((x + z) & 1) === 0 ? 'x' : 'z'; 
    const dest = reg.getDestination(reg.current);
    reg.buildPortalFrame(world, x, surfaceY, z, axis, dest ? dest.portal : null);
    return true;
};