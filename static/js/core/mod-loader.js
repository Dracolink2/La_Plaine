/**
 * Chargeur de mods côté client. Les mods sont des scripts JavaScript exécutés
 * dans le contexte du jeu : n'installez que des mods provenant de sources sûres.
 * Cette API prépare les points d'extension sans prétendre isoler du code hostile.
 */
(function installModLoader() {
    'use strict';
    const STORAGE_KEY = 'laPlaine.enabledMods';
    const loaded = new Set();
    const errors = [];
    const eventHandlers = new Map();

    function on(eventName, handler) {
        if (typeof eventName !== 'string' || !eventName.trim() || typeof handler !== 'function') {
            throw new TypeError('Un événement et une fonction de rappel sont requis.');
        }
        if (!eventHandlers.has(eventName)) eventHandlers.set(eventName, new Set());
        eventHandlers.get(eventName).add(handler);
        return () => eventHandlers.get(eventName)?.delete(handler);
    }

    function emit(eventName, payload) {
        const handlers = eventHandlers.get(eventName);
        if (!handlers) return;
        for (const handler of handlers) {
            try { handler(payload); }
            catch (error) { console.error(`[La Plaine] Erreur dans l'événement ${eventName}`, error); }
        }
    }

    function readEnabled() {
        try {
            const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
            return Array.isArray(value) ? value.filter(id => typeof id === 'string') : null;
        } catch (_) { return null; }
    }

    function enabledIds(mods) {
        const saved = readEnabled();
        // Première installation : les mods disponibles sont activés par défaut.
        return new Set(saved === null ? mods.map(mod => mod.id) : saved);
    }

    function loadScript(url) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = url;
            script.async = false;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`Impossible de charger ${url}`));
            document.head.appendChild(script);
        });
    }

    async function loadEnabledMods(options = {}) {
        const response = await fetch('/api/mods', { cache: 'no-store' });
        if (!response.ok) throw new Error('Impossible de lire la liste des mods.');
        const payload = await response.json();
        const allMods = Array.isArray(payload.mods) ? payload.mods : [];
        // Le menu principal ne charge que les mods qui déclarent explicitement
        // qu'ils peuvent fonctionner sans monde ni registres de gameplay.
        const mods = options.settingsOnly ? allMods.filter(mod => mod.menu_settings === true) : allMods;
        const enabled = enabledIds(allMods);
        const available = new Map(mods.map(mod => [mod.id, mod]));
        const ordered = [];
        const visiting = new Set();
        const visited = new Set();

        // Un parcours en profondeur place chaque dépendance avant le mod qui l'utilise.
        function visit(mod) {
            if (visited.has(mod.id)) return;
            if (visiting.has(mod.id)) {
                errors.push({ id: mod.id, error: 'Cycle de dépendances détecté.' });
                return;
            }
            visiting.add(mod.id);
            for (const dependencyId of mod.dependencies || []) {
                const dependency = available.get(dependencyId);
                if (!dependency || !enabled.has(dependencyId)) {
                    errors.push({ id: mod.id, error: `Dépendance absente ou désactivée : ${dependencyId}` });
                    visiting.delete(mod.id);
                    visited.add(mod.id);
                    return;
                }
                visit(dependency);
                if (!ordered.some(item => item.id === mod.id) && errors.some(item => item.id === dependencyId)) {
                    errors.push({ id: mod.id, error: `La dépendance ${dependencyId} n'a pas pu être chargée.` });
                    visiting.delete(mod.id);
                    visited.add(mod.id);
                    return;
                }
            }
            visiting.delete(mod.id);
            visited.add(mod.id);
            if (!errors.some(item => item.id === mod.id)) ordered.push(mod);
        }

        for (const mod of mods) if (enabled.has(mod.id)) visit(mod);
        for (const mod of ordered) {
            if (loaded.has(mod.id)) continue;
            const entry = typeof mod.entry === 'string' ? mod.entry : 'main.js';
            const parts = entry.split('/');
            if (!entry || entry.startsWith('/') || parts.some(part => !part || part === '.' || part === '..')) {
                errors.push({ id: mod.id, error: 'Chemin d’entrée invalide dans manifest.json.' });
                continue;
            }
            const encodedEntry = parts.map(encodeURIComponent).join('/');
            try {
                await loadScript(`/api/mods/${encodeURIComponent(mod.id)}/${encodedEntry}`);
                loaded.add(mod.id);
                console.info(`[La Plaine] Mod chargé : ${mod.name} (${mod.version})`);
            } catch (error) {
                errors.push({ id: mod.id, error: error.message });
                console.error(`[La Plaine] Échec du mod ${mod.id}`, error);
            }
        }
        emit('mods:loaded', { loaded: [...loaded], errors: [...errors] });
        window.dispatchEvent(new CustomEvent('laplaine:mods-loaded', { detail: { loaded: [...loaded], errors: [...errors] } }));
        return { loaded: [...loaded], errors: [...errors] };
    }

    // Les mods partagent une API documentée. Elle fournit des points d'extension,
    // mais n'isole pas le JavaScript des mods : n'installez que des mods de confiance.
    const settingHandles = new Map();
    const textureHandles = new Map();
    const soundHandles = new Map();
    const inventoryHandles = new Map();

    function getModSettingsRoot() {
        // Sur le menu principal, les réglages des mods vivent dans la vraie fenêtre PARAMÈTRES.
        const settingsContainer = document.getElementById('lp-mod-settings-container');
        if (settingsContainer) return settingsContainer;

        // Repli pour les pages de jeu qui n'affichent pas la fenêtre du menu principal.
        const pause = document.getElementById('pause-overlay');
        if (!pause) return null;
        let root = document.getElementById('lp-mod-settings');
        if (root) return root;
        root = document.createElement('section');
        root.id = 'lp-mod-settings';
        root.style.cssText = 'display:block;max-height:30vh;overflow:auto;text-align:left;margin:14px auto;padding:12px;width:min(420px,90vw);box-sizing:border-box;background:rgba(15,18,22,.88);border:1px solid rgba(255,255,255,.22);border-radius:9px;color:white;';
        const title = document.createElement('h3');
        title.textContent = 'Paramètres des mods';
        title.style.cssText = 'margin:0 0 8px;font-size:1rem;';
        root.appendChild(title);
        const resume = document.getElementById('btn-resume');
        pause.insertBefore(root, resume || null);
        return root;
    }

    function safeAssetUrl(modId, relativePath) {
        if (typeof modId !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(modId)) {
            throw new TypeError('Identifiant de mod invalide.');
        }
        if (typeof relativePath !== 'string' || !relativePath.trim()) throw new TypeError('Chemin de ressource requis.');
        const normalized = relativePath.replace(/\\/g, '/');
        const parts = normalized.split('/');
        if (normalized.startsWith('/') || parts.some(p => !p || p === '.' || p === '..')) throw new TypeError('Chemin de ressource invalide.');
        return `/api/mods/${encodeURIComponent(modId)}/${parts.map(encodeURIComponent).join('/')}`;
    }

    function registerSetting(config) {
        if (!config || typeof config.id !== 'string' || !/^[a-zA-Z0-9_.-]{1,100}$/.test(config.id)) throw new TypeError('Un paramètre doit avoir un id unique et valide.');
        if (settingHandles.has(config.id)) throw new Error(`Paramètre déjà enregistré : ${config.id}`);
        const root = getModSettingsRoot();
        if (!root) throw new Error('Le menu des paramètres du jeu est introuvable.');
        const type = config.type || 'slider';
        if (!['slider', 'checkbox', 'select'].includes(type)) throw new TypeError(`Type de paramètre non pris en charge : ${type}`);
        const storageKey = `laPlaine.modSetting.${config.id}`;
        let saved = null;
        try { saved = localStorage.getItem(storageKey); } catch (_) {}
        const row = document.createElement('div');
        row.style.cssText = 'padding:9px 4px;border-bottom:1px solid rgba(255,255,255,.12);';
        const label = document.createElement('label');
        label.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:14px;';
        const name = document.createElement('span');
        name.textContent = String(config.label || config.id);
        label.appendChild(name);
        let input;
        let output = null;
        const defaultValue = config.defaultValue ?? config.default ?? (type === 'checkbox' ? false : 0);
        if (type === 'slider') {
            input = document.createElement('input'); input.type = 'range';
            input.min = String(Number(config.min ?? 0)); input.max = String(Number(config.max ?? 100)); input.step = String(Number(config.step ?? 1));
            input.style.cssText = 'width:100%;accent-color:#7bc96f;';
            output = document.createElement('output'); output.style.cssText = 'min-width:58px;text-align:right;font-weight:700;';
            label.appendChild(output);
            input.value = String(Math.max(Number(input.min), Math.min(Number(input.max), Number(saved ?? defaultValue))));
        } else if (type === 'checkbox') {
            input = document.createElement('input'); input.type = 'checkbox'; input.checked = saved === null ? Boolean(defaultValue) : saved === 'true';
            input.style.cssText = 'width:18px;height:18px;accent-color:#7bc96f;'; label.appendChild(input);
        } else {
            input = document.createElement('select'); input.style.cssText = 'max-width:55%;padding:5px;border-radius:5px;';
            for (const item of (Array.isArray(config.options) ? config.options : [])) {
                const option = document.createElement('option'); option.value = String(item.value); option.textContent = String(item.label ?? item.value); input.appendChild(option);
            }
            input.value = String(saved ?? defaultValue);
            label.appendChild(input);
        }
        row.appendChild(label);
        if (type === 'slider') row.appendChild(input);
        if (config.description) {
            const description = document.createElement('small'); description.textContent = String(config.description);
            description.style.cssText = 'display:block;color:#cbd1d6;margin-top:5px;font-size:12px;'; row.appendChild(description);
        }
        root.appendChild(row);
        const getValue = () => type === 'checkbox' ? input.checked : type === 'slider' ? Number(input.value) : input.value;
        const apply = (persist=true) => {
            const value = getValue();
            if (output) { output.value = `${value}${config.unit || ''}`; output.textContent = output.value; }
            if (persist) { try { localStorage.setItem(storageKey, String(value)); } catch (_) {} }
            try { config.onChange?.(value); } catch (error) { console.error(`[La Plaine] Paramètre ${config.id}`, error); }
        };
        input.addEventListener(type === 'slider' ? 'input' : 'change', () => apply(true));
        const handle = {
            id: config.id, element: row, input,
            getValue,
            setValue(value) {
                if (type === 'checkbox') input.checked = Boolean(value); else input.value = String(value);
                apply(true);
            },
            remove() { row.remove(); settingHandles.delete(config.id); }
        };
        settingHandles.set(config.id, handle);
        apply(false);
        return handle;
    }

    window.LaPlaineAPI = Object.freeze({
        apiVersion: 2,
        on, emit,
        registerSetting,
        openSettings() {
            const root = getModSettingsRoot();
            if (!root) return false;
            root.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            return true;
        },
        registerBlock(data) {
            if (!window.blockRegistry) throw new Error('Le registre de blocs n’est pas prêt.');
            if (!data || !Number.isSafeInteger(Number(data.id)) || Number(data.id) <= 0 || !data.name) throw new TypeError('Un bloc doit avoir un id numérique positif et un nom.');
            if (window.blockRegistry.get(Number(data.id))) throw new Error(`Identifiant de bloc déjà utilisé : ${data.id}`);
            const block = { ...data, id: Number(data.id), textures: { ...(data.textures || {}) } };
            for (const [face, path] of Object.entries(block.textures)) if (typeof path === 'string' && path && !/^(https?:|data:|blob:|\/)/.test(path)) block.textures[face] = safeAssetUrl(data.modId, path);
            window.blockRegistry.register(block);
            const result = window.blockRegistry.get(Number(data.id));
            emit('registry:block-registered', { block: result });
            return result;
        },
        updateBlock(id, patch) {
            const block = window.blockRegistry?.get(Number(id));
            if (!block) throw new Error(`Bloc introuvable : ${id}`);
            Object.assign(block, patch || {});
            emit('registry:block-updated', { block }); return block;
        },
        removeBlock(id) {
            const registry = window.blockRegistry;
            const removed = registry?.blocks?.delete(Number(id)) || false;
            if (removed) emit('registry:block-removed', { id: Number(id) });
            return removed;
        },
        registerItem(data) {
            if (!window.itemsRegistry) throw new Error('Le registre d’objets n’est pas prêt.');
            if (window.itemsRegistry.get(data?.id)) throw new Error(`Identifiant d’objet déjà utilisé : ${data.id}`);
            const item = { ...data };
            if (typeof item.texture === 'string' && item.texture && !/^(https?:|data:|blob:|\/)/.test(item.texture)) item.texture = safeAssetUrl(data.modId, item.texture);
            if (!window.itemsRegistry.register(item)) throw new Error('Impossible d’enregistrer cet objet.');
            return window.itemsRegistry.get(data.id);
        },
        updateItem(id, patch) {
            const item = window.itemsRegistry?.get(id); if (!item) throw new Error(`Objet introuvable : ${id}`);
            Object.assign(item, patch || {}); emit('registry:item-updated', { item }); return item;
        },
        removeItem(id) { const removed = window.itemsRegistry?.items?.delete(Number(id)) || false; if (removed) emit('registry:item-removed', { id: Number(id) }); return removed; },
        registerMob(data) {
            if (!window.mobRegistry) throw new Error('Le registre de créatures n’est pas prêt.');
            if (!data || typeof data !== 'object') throw new TypeError('Définition de créature invalide.');
            if (data.id && window.mobRegistry.getAll().some(m => m.id === data.id)) throw new Error(`Identifiant de créature déjà utilisé : ${data.id}`);
            return window.mobRegistry.register(data);
        },
        updateMob(id, patch) {
            const mob = window.mobRegistry?.getAll?.().find(m => m.id === id); if (!mob) throw new Error(`Créature introuvable : ${id}`);
            Object.assign(mob, patch || {}); emit('registry:mob-updated', { mob }); return mob;
        },
        removeMob(id) {
            const list = window.mobRegistry?.definitions; if (!Array.isArray(list)) return false;
            const index = list.findIndex(m => m.id === id); if (index < 0) return false;
            list.splice(index, 1); emit('registry:mob-removed', { id }); return true;
        },
        registerRecipe(data) {
            const recipes = window.craftRegistry?.recipes;
            if (!Array.isArray(recipes)) throw new Error('Le registre de recettes n’est pas prêt.');
            if (!data?.id || !Array.isArray(data.pattern) || !data.output) throw new TypeError('Une recette doit avoir id, pattern et output.');
            if (recipes.some(r => r.id === data.id)) throw new Error(`Identifiant de recette déjà utilisé : ${data.id}`);
            recipes.push(data); emit('registry:recipe-registered', { recipe: data }); return data;
        },
        registerDimension(data) {
            if (!window.dimensionRegistry) throw new Error('Le registre de dimensions n’est pas prêt.');
            return window.dimensionRegistry.register(data);
        },
        registerTexture(id, relativePath, modId) {
            if (typeof id !== 'string' || !id.trim()) throw new TypeError('Identifiant de texture requis.');
            const url = safeAssetUrl(modId, relativePath); textureHandles.set(id, url); return url;
        },
        getTexture(id) { return textureHandles.get(id) || null; },
        registerSound(id, relativePath, modId) {
            if (typeof id !== 'string' || !id.trim()) throw new TypeError('Identifiant de son requis.');
            const url = safeAssetUrl(modId, relativePath); soundHandles.set(id, url); return url;
        },
        playSound(id, options={}) {
            const url = soundHandles.get(id); if (!url) throw new Error(`Son de mod introuvable : ${id}`);
            const audio = new Audio(url); audio.volume = Math.max(0, Math.min(1, Number(options.volume ?? 1))); audio.loop = Boolean(options.loop); return audio.play();
        },
        registerInventoryExtension(config) {
            if (!config?.id || typeof config.render !== 'function') throw new TypeError('Une extension doit avoir un id et render(container).');
            if (inventoryHandles.has(config.id)) throw new Error(`Extension déjà enregistrée : ${config.id}`);
            inventoryHandles.set(config.id, config);
            const panel = document.getElementById('inventory-panel');
            if (panel) {
                let root = panel.querySelector('#lp-mod-inventory-extensions');
                if (!root) { root = document.createElement('div'); root.id = 'lp-mod-inventory-extensions'; root.style.cssText = 'margin-top:12px;padding-top:12px;border-top:1px solid #777;'; (panel.querySelector('.inv-box') || panel).appendChild(root); }
                const section = document.createElement('section'); section.dataset.modInventoryId = config.id;
                const title = document.createElement('h3'); title.textContent = config.title || config.id; section.appendChild(title);
                config.render(section); root.appendChild(section);
            }
            return config;
        },
        getBlock(id) { return window.blockRegistry?.get(Number(id)) || null; },
        getItem(id) { return window.itemsRegistry?.get(Number(id)) || null; },
        getMobs() { return window.mobRegistry?.getAll?.() || []; },
        getSetting(id) { return settingHandles.get(id) || null; }
    });
    window.LaPlaineModLoader = Object.freeze({ loadEnabledMods, getLoaded: () => [...loaded], getErrors: () => [...errors] });
})();
