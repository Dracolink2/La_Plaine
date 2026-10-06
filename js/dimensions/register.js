// static/js/dimensions/register.js
//
// Une "dimension" = un biomeRegistry + un fichier static/js/dimensions/<id>/access.js
// qui l'enregistre avec dimensionRegistry.register({...}).
//
// AJOUTER UNE DIMENSION (le minimum) :
//   dimensionRegistry.register({ id: 'nether', name: 'Le Nether', biomeRegistry: monRegistre });
//
// Options facultatives de register() :
//   canAccess(player)        -> false pour bloquer l'entrée
//   onDenied(player)         -> appelé quand canAccess refuse (ex: afficher un message)
//   onEnter(world, player, fromDim) / onLeave(world, player, toDim) -> hooks
//   portalTarget: 'id'       -> destination du portail de cette dimension
//                               (par défaut : la dimension suivante, en boucle A -> B -> C -> A)
//   returnPortal: false      -> ne pas construire de portail à l'arrivée (défaut : true)
//   naturalPortals: false    -> pas de portails générés naturellement ici (défaut : true)
//   spawn: { x, z }          -> point de recherche d'apparition, relatif à l'origine de la dimension
//   portal: { frame: 242, block: 243 }
//                            -> PORTAIL QUI MÈNE À CETTE DIMENSION : id du bloc de cadre (celui qu'on pose)
//                               et id du bloc qui remplit l'intérieur. Sans ça : 240 / 241 par défaut.
//                               Les blocs doivent exister dans ton registre de blocs.
//
// Pas de rechargement de monde : chaque dimension occupe une zone de coordonnées très
// éloignée (DIMENSION_SPACING), donc les chunks ne se chevauchent jamais.
//
// Console de test : dimensionRegistry.goTo('nether')

const DIMENSION_SPACING = 200000; // écart en blocs entre deux dimensions

class DimensionRegistry {
    constructor() {
        this.PORTAL_FRAME_ID = 240;
        this.PORTAL_BLOCK_ID = 241;
        this.PORTAL_INTERIOR_W = 2;
        this.PORTAL_INTERIOR_H = 3;

        this.dimensions = new Map();
        this.order = [];
        this._byFrame = new Map(); // id bloc cadre -> [dimensions]
        this._byBlock = new Map(); // id bloc portail -> [dimensions]
        this.current = null;
        this.world = null;
        this.player = null;
        this._lastTeleport = 0;
    }

    // ============ ENREGISTREMENT ============

    register(d) {
        if (!d || !d.id || !d.biomeRegistry) {
            console.error("Échec d'enregistrement de dimension : id et biomeRegistry requis.", d);
            return false;
        }
        if (this.dimensions.has(d.id)) {
            console.warn(`Dimension "${d.id}" déjà enregistrée, ignorée.`);
            return false;
        }

        const fn = (f) => (typeof f === 'function' ? f : null);
        const frame = (d.portal && d.portal.frame) || this.PORTAL_FRAME_ID;
        const block = (d.portal && d.portal.block) || this.PORTAL_BLOCK_ID;
        if (!Number.isInteger(frame) || !Number.isInteger(block) || frame <= 0 || block <= 0 || frame === block) {
            console.error(`Dimension "${d.id}" : portal.frame et portal.block doivent être deux entiers > 0 différents.`, d.portal);
            return false;
        }
        const dim = {
            id: d.id,
            name: d.name || d.id,
            biomeRegistry: d.biomeRegistry,
            canAccess: fn(d.canAccess),
            onDenied: fn(d.onDenied),
            onEnter: fn(d.onEnter),
            onLeave: fn(d.onLeave),
            portalTarget: d.portalTarget || null,
            returnPortal: d.returnPortal !== false,
            naturalPortals: d.naturalPortals !== false,
            portal: { frame, block },
            spawnHint: d.spawn || { x: 0, z: 0 },
            offsetX: this.order.length * DIMENSION_SPACING,
            offsetZ: 0,
            _spawn: null,
            _returnFrom: new Set()
        };
        this.dimensions.set(d.id, dim);
        this.order.push(d.id);
        if (!this._byFrame.has(frame)) this._byFrame.set(frame, []);
        this._byFrame.get(frame).push(dim);
        if (!this._byBlock.has(block)) this._byBlock.set(block, []);
        this._byBlock.get(block).push(dim);
        return true;
    }

    // Vrai si cet id de bloc est le cadre d'un portail (utilisé par main.js à la pose d'un bloc)
    isPortalFrame(id) { return this._byFrame.has(id); }
    isPortalBlock(id) { return this._byBlock.has(id); }

    get(id) { return this.dimensions.get(id) || null; }
    getAll() { return this.order.map(id => this.dimensions.get(id)); }

    // Appelé une fois au début, juste après "new World(scene)" : fixe la dimension de départ.
    // Si l'id n'existe pas, on prend la première dimension enregistrée.
    setInitialDimension(world, id) {
        let dim = this.get(id);
        if (!dim) {
            dim = this.getAll()[0];
            if (!dim) return false;
            console.warn(`Dimension initiale "${id}" introuvable, utilisation de "${dim.id}".`);
        }
        this.world = world;
        world.biomeRegistry = dim.biomeRegistry;
        world.currentDimensionId = dim.id;
        this.current = dim;
        return true;
    }

    // ============ TÉLÉPORTATION ============

    // Destination du portail depuis une dimension donnée
    getDestination(fromDim) {
        if (!fromDim || this.order.length < 2) return null;
        if (fromDim.portalTarget) {
            const t = this.get(fromDim.portalTarget);
            if (t && t !== fromDim) return t;
            console.warn(`portalTarget "${fromDim.portalTarget}" invalide pour "${fromDim.id}".`);
        }
        const i = this.order.indexOf(fromDim.id);
        return this.get(this.order[(i + 1) % this.order.length]);
    }

    // Raccourci console / commandes : dimensionRegistry.goTo('nether')
    goTo(id) {
        if (!this.world || !this.player) return false;
        return this.switchTo(this.world, this.player, id);
    }

    _findDimensionSpawn(world, dim, maxR = 28) {
        const sea = world.seaLevel;
        const cx = dim.offsetX + Math.floor(dim.spawnHint.x || 0);
        const cz = dim.offsetZ + Math.floor(dim.spawnHint.z || 0);
        for (let r = 0; r <= maxR; r++) {
            for (let dx = -r; dx <= r; dx++) {
                for (let dz = -r; dz <= r; dz++) {
                    if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
                    const x = cx + dx, z = cz + dz;
                    const h = world.getTerrainHeight(x, z);
                    if (h <= sea + 1) continue;
                    if (world.solidT[world.getBlockI(x, h + 1, z)] || world.solidT[world.getBlockI(x, h + 2, z)]) continue;
                    return { x: x + 0.5, y: h + 1, z: z + 0.5 };
                }
            }
        }
        return { x: cx + 0.5, y: world.getTerrainHeight(cx, cz) + 3, z: cz + 0.5 };
    }

    switchTo(world, player, id) {
        const dim = this.get(id);
        if (!dim) { console.warn(`Dimension "${id}" inconnue.`); return false; }
        const from = this.current;
        if (from === dim) return false;

        if (from && from.onLeave) this._safe(from.onLeave, world, player, dim);

        // Biomes + dimension courante AVANT de générer les chunks d'arrivée
        world.biomeRegistry = dim.biomeRegistry;
        world.currentBiomeId = null;
        world.currentDimensionId = dim.id;
        this.current = dim;

        const firstVisit = !dim._spawn;
        if (firstVisit) dim._spawn = this._findDimensionSpawn(world, dim);

        player.position.set(dim._spawn.x, dim._spawn.y, dim._spawn.z);
        player.velocity.set(0, 0, 0);
        world.updateChunks(dim._spawn.x, dim._spawn.z, true);

        if (dim.returnPortal && from) this._ensureReturnPortal(world, dim, from);
        if (dim.onEnter) this._safe(dim.onEnter, world, player, from);
        if (typeof world.onDimensionChanged === 'function') {
            try { world.onDimensionChanged(dim.id, from ? from.id : null); }
            catch (e) { console.error('Erreur lors du chargement de la position de dimension :', e); }
        }
        return true;
    }

    _safe(fn, ...args) {
        try { fn(...args); } catch (e) { console.error('Erreur dans un hook de dimension :', e); }
    }

    // ============ CONSTRUCTION DE PORTAILS ============

    // Construit un cadre + intérieur en bloc-portail. axis: 'x' (cadre le long de Z) ou 'z' (le long de X).
    // Utilisé par les portails naturels (portal-decoration.js) et le portail de retour.
    // `portal` = { frame, block } : ids à utiliser (ceux de la dimension DE DESTINATION).
    buildPortalFrame(world, x, surfaceY, z, axis, portal) {
        const frameId = portal ? portal.frame : this.PORTAL_FRAME_ID;
        const blockId = portal ? portal.block : this.PORTAL_BLOCK_ID;
        const W = this.PORTAL_INTERIOR_W, H = this.PORTAL_INTERIOR_H;
        const y0 = surfaceY + 1;
        for (let dw = -1; dw <= W; dw++) {
            for (let dh = -1; dh <= H; dh++) {
                const isBorder = (dw === -1 || dw === W || dh === -1 || dh === H);
                const px = axis === 'x' ? x : x + dw;
                const pz = axis === 'x' ? z + dw : z;
                world.setBlock(px, y0 + dh, pz, isBorder ? frameId : blockId);
            }
        }
    }

    // Portail de retour, construit une seule fois près du point d'arrivée
    // Il mène à la dimension d'où l'on vient (`from`), donc il utilise les ids de portail de `from`.
    _ensureReturnPortal(world, dim, from) {
        if (dim._returnFrom.has(from.id)) return;
        dim._returnFrom.add(from.id);
        try {
            const sx = Math.floor(dim._spawn.x), sz = Math.floor(dim._spawn.z);
            const spots = [[3, 0], [-4, 0], [0, 3], [0, -4]];
            for (const [ox, oz] of spots) {
                const x = sx + ox, z = sz + oz;
                const h = world.getTerrainHeight(x, z);
                if (h <= world.seaLevel) continue;
                this.buildPortalFrame(world, x, h, z, 'x', from.portal);
                world.rebuildAround(x, z);
                return;
            }
        } catch (e) {
            console.error('Portail de retour non construit :', e);
        }
    }

    // Appelé après la pose d'un Bloc de Cadre : cherche un cadre rectangulaire plein
    // contenant ce bloc (plan XY ou ZY) et remplit l'intérieur si trouvé.
    // frameId : id du bloc posé (par défaut, lu dans le monde à cette position).
    tryActivatePortal(world, x, y, z, frameId) {
        if (frameId === undefined) frameId = world.getBlockI(x, y, z);
        if (!this.isPortalFrame(frameId)) return false;
        const MAXW = 4, MAXH = 5;
        const planes = [
            { du: [1, 0, 0], dv: [0, 1, 0] },
            { du: [0, 0, 1], dv: [0, 1, 0] }
        ];
        for (const plane of planes) {
            if (this._scanPlane(world, x, y, z, plane, MAXW, MAXH, frameId)) return true;
        }
        return false;
    }

    _scanPlane(world, x, y, z, plane, maxW, maxH, frameId) {
        const { du, dv } = plane;
        const at = (u, v) => world.getBlockI(
            x + du[0] * u + dv[0] * v,
            y + du[1] * u + dv[1] * v,
            z + du[2] * u + dv[2] * v
        );

        for (let w = 2; w <= maxW + 1; w++) {
            for (let ou = -w; ou <= 0; ou++) {
                const u0 = ou, u1 = ou + w;
                if (u0 !== 0 && u1 !== 0) continue;
                for (let h = 3; h <= maxH + 1; h++) {
                    for (let ov = -h; ov <= 0; ov++) {
                        const v0 = ov, v1 = ov + h;
                        if (v0 !== 0 && v1 !== 0) continue;
                        if (this._checkFrame(at, u0, u1, v0, v1, frameId)) {
                            this._fillPortal(world, x, y, z, plane, u0, u1, v0, v1, this._byFrame.get(frameId)[0].portal.block);
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    }

    _checkFrame(at, u0, u1, v0, v1, frameId) {
        for (let u = u0; u <= u1; u++) {
            for (let v = v0; v <= v1; v++) {
                const border = (u === u0 || u === u1 || v === v0 || v === v1);
                const id = at(u, v);
                if (border) { if (id !== frameId) return false; }
                else { if (id !== 0) return false; }
            }
        }
        return true;
    }

    _fillPortal(world, x, y, z, plane, u0, u1, v0, v1, blockId) {
        const { du, dv } = plane;
        for (let u = u0 + 1; u < u1; u++) {
            for (let v = v0 + 1; v < v1; v++) {
                world.setBlock(
                    x + du[0] * u + dv[0] * v,
                    y + du[1] * u + dv[1] * v,
                    z + du[2] * u + dv[2] * v,
                    blockId
                );
            }
        }
        // Reconstruit les chunks aux deux extrémités du cadre (peut être à cheval sur 2 chunks)
        world.rebuildAround(x + du[0] * u0, z + du[2] * u0);
        world.rebuildAround(x + du[0] * u1, z + du[2] * u1);
        if (window.soundManager) window.soundManager.playBlockPlace(blockId);
    }

    // Appelé chaque frame depuis main.js
    checkPlayerInPortal(world, player, now) {
        this.world = world;
        this.player = player;

        if (now - this._lastTeleport < 1500) return;
        if (this.order.length < 2) return;

        const bx = Math.floor(player.position.x);
        const by = Math.floor(player.position.y + 0.9);
        const bz = Math.floor(player.position.z);
        const candidates = this._byBlock.get(world.getBlockI(bx, by, bz));
        if (!candidates) return;

        // Le bloc de portail désigne la dimension de destination (jamais celle où l'on est déjà)
        const from = this.current || this.get(this.order[0]);
        const options = candidates.filter(d => d !== from);
        if (!options.length) return;
        const preferred = this.getDestination(from);
        const target = options.includes(preferred) ? preferred : options[0];

        this._lastTeleport = now;
        if (target.canAccess && !target.canAccess(player)) {
            if (target.onDenied) this._safe(target.onDenied, player);
            return;
        }
        this.switchTo(world, player, target.id);
    }
}

window.dimensionRegistry = new DimensionRegistry();