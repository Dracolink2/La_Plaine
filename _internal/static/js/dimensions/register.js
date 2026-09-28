// static/js/dimensions/register.js
//
// Une "dimension" = un jeu de biomes (son propre biomeRegistry, chargé depuis
// static/js/dimensions/<id>/biomes/) + un fichier static/js/dimensions/<id>/access.js
// qui l'enregistre via dimensionRegistry.register({...}).
//
// Pas de rechargement de monde ni de double stockage de chunks : chaque dimension
// occupe simplement une zone de coordonnées très éloignée des autres (DIMENSION_SPACING),
// donc les chunks ne se chevauchent jamais et le système de streaming existant de World
// fonctionne sans aucune autre modification.
//
// Pour aller d'une dimension à l'autre : construire un cadre rectangulaire plein en
// "Bloc de Portail" (id 240, voir static/js/blocks/portal.js) avec un intérieur d'air.
// Une fois le cadre complet, l'intérieur se remplit tout seul en bloc-portail (id 241) ;
// marcher dedans téléporte directement, sans objet requis.

const DIMENSION_SPACING = 200000; // écart en blocs entre deux dimensions

class DimensionRegistry {
    constructor() {
        this.PORTAL_FRAME_ID = 240;
        this.PORTAL_BLOCK_ID = 241;

        this.dimensions = new Map();
        this.order = [];
        this.current = null;
        this._lastTeleport = 0;
    }

    // Appelé par chaque static/js/dimensions/<id>/access.js une fois son biomeRegistry prêt.
    // canAccess(player) est optionnel : retourne false pour bloquer l'entrée (sinon toujours autorisé).
    register(dimData) {
        if (!dimData || !dimData.id || !dimData.biomeRegistry) {
            console.error("Échec d'enregistrement de dimension : id et biomeRegistry requis.", dimData);
            return;
        }
        if (this.dimensions.has(dimData.id)) return; // déjà enregistrée

        const offsetIndex = this.order.length;
        this.dimensions.set(dimData.id, {
            id: dimData.id,
            name: dimData.name || dimData.id,
            biomeRegistry: dimData.biomeRegistry,
            offsetX: offsetIndex * DIMENSION_SPACING,
            offsetZ: 0,
            canAccess: dimData.canAccess || null,
            _spawn: null,
            _spawnDone: false
        });
        this.order.push(dimData.id);
    }

    get(id) { return this.dimensions.get(id) || null; }
    getAll() { return this.order.map(id => this.dimensions.get(id)); }

    // Appelé une seule fois au tout début, juste après "new World(scene)", avant la génération
    // du premier chunk : fixe la dimension de départ sans téléporter personne.
    setInitialDimension(world, id) {
        const dim = this.get(id);
        if (!dim) return false;
        world.biomeRegistry = dim.biomeRegistry;
        this.current = dim;
        return true;
    }

    // Cherche un point d'apparition sec dans la zone de coordonnées de la dimension
    _findDimensionSpawn(world, dim, maxR = 28) {
        const sea = world.seaLevel;
        for (let r = 0; r <= maxR; r++) {
            for (let dx = -r; dx <= r; dx++) {
                for (let dz = -r; dz <= r; dz++) {
                    if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
                    const x = dim.offsetX + dx, z = dim.offsetZ + dz;
                    const h = world.getTerrainHeight(x, z);
                    if (h <= sea + 1) continue;
                    if (world.solidT[world.getBlockI(x, h + 1, z)] || world.solidT[world.getBlockI(x, h + 2, z)]) continue;
                    return { x: x + 0.5, y: h + 1, z: z + 0.5 };
                }
            }
        }
        return { x: dim.offsetX + 0.5, y: world.getTerrainHeight(dim.offsetX, dim.offsetZ) + 3, z: dim.offsetZ + 0.5 };
    }

    // Bascule le biomeRegistry actif du monde et téléporte le joueur au spawn de la dimension cible
    switchTo(world, player, id) {
        const dim = this.get(id);
        if (!dim) return false;

        world.biomeRegistry = dim.biomeRegistry;
        world.currentBiomeId = null;

        if (!dim._spawnDone) {
            dim._spawn = this._findDimensionSpawn(world, dim);
            dim._spawnDone = true;
        }

        player.position.set(dim._spawn.x, dim._spawn.y, dim._spawn.z);
        player.velocity.set(0, 0, 0);

        world.updateChunks(dim._spawn.x, dim._spawn.z, true);
        this.current = dim;
        return true;
    }

    // ============ PORTAILS ============

    // Appelé après la pose d'un Bloc de Portail : cherche un cadre rectangulaire plein
    // (intérieur vide) contenant ce bloc, dans le plan XY ou ZY, et remplit l'intérieur si trouvé.
    tryActivatePortal(world, x, y, z) {
        const MAXW = 4, MAXH = 5; // taille intérieure max (largeur, hauteur)
        const planes = [
            { du: [1, 0, 0], dv: [0, 1, 0] }, // plan à Z constant (le cadre varie en X et Y)
            { du: [0, 0, 1], dv: [0, 1, 0] }  // plan à X constant (le cadre varie en Z et Y)
        ];
        for (const plane of planes) {
            if (this._scanPlane(world, x, y, z, plane, MAXW, MAXH)) return true;
        }
        return false;
    }

    _scanPlane(world, x, y, z, plane, maxW, maxH) {
        const { du, dv } = plane;
        const at = (u, v) => world.getBlockI(
            x + du[0] * u + dv[0] * v,
            y + du[1] * u + dv[1] * v,
            z + du[2] * u + dv[2] * v
        );

        // Le bloc qu'on vient de poser est à (u=0, v=0) : on essaie tous les rectangles
        // raisonnables qui l'ont comme bord (coin, côté haut/bas/gauche/droite).
        for (let w = 2; w <= maxW + 1; w++) {
            for (let ou = -w; ou <= 0; ou++) {
                const u0 = ou, u1 = ou + w;
                if (u0 !== 0 && u1 !== 0) continue;
                for (let h = 3; h <= maxH + 1; h++) {
                    for (let ov = -h; ov <= 0; ov++) {
                        const v0 = ov, v1 = ov + h;
                        if (v0 !== 0 && v1 !== 0) continue;
                        if (this._checkFrame(at, u0, u1, v0, v1)) {
                            this._fillPortal(world, x, y, z, plane, u0, u1, v0, v1);
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    }

    _checkFrame(at, u0, u1, v0, v1) {
        for (let u = u0; u <= u1; u++) {
            for (let v = v0; v <= v1; v++) {
                const border = (u === u0 || u === u1 || v === v0 || v === v1);
                const id = at(u, v);
                if (border) { if (id !== this.PORTAL_FRAME_ID) return false; }
                else { if (id !== 0) return false; }
            }
        }
        return true;
    }

    _fillPortal(world, x, y, z, plane, u0, u1, v0, v1) {
        const { du, dv } = plane;
        for (let u = u0 + 1; u < u1; u++) {
            for (let v = v0 + 1; v < v1; v++) {
                world.setBlock(
                    x + du[0] * u + dv[0] * v,
                    y + du[1] * u + dv[1] * v,
                    z + du[2] * u + dv[2] * v,
                    this.PORTAL_BLOCK_ID
                );
            }
        }
        world.rebuildAround(x, z);
        world.rebuildAround(x + du[0] * (u1 - u0) * dv[0], z + du[2] * (u1 - u0) * dv[2]);
        if (window.soundManager) window.soundManager.playBlockPlace(this.PORTAL_BLOCK_ID);
    }

    // Appelé chaque frame depuis main.js : si le joueur se tient dans un bloc-portail,
    // on le fait basculer vers l'autre dimension (cooldown pour éviter les allers-retours en boucle).
    checkPlayerInPortal(world, player, now) {
        if (now - this._lastTeleport < 1500) return;
        if (this.order.length < 2) return; // rien vers quoi téléporter

        const bx = Math.floor(player.position.x);
        const by = Math.floor(player.position.y + 0.9);
        const bz = Math.floor(player.position.z);
        if (world.getBlockI(bx, by, bz) !== this.PORTAL_BLOCK_ID) return;

        const currentId = this.current ? this.current.id : this.order[0];
        const targetId = this.order.find(id => id !== currentId);
        if (!targetId) return;

        const target = this.get(targetId);
        if (target.canAccess && !target.canAccess(player)) return;

        this._lastTeleport = now;
        this.switchTo(world, player, targetId);
    }
}

window.dimensionRegistry = new DimensionRegistry();