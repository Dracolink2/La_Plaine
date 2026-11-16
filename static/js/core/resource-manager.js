/**
 * Gestion centralisée des ressources visuelles.
 * Les chemins historiques restent inchangés dans les registres : cette couche
 * choisit la ressource du pack actif et laisse le serveur gérer le repli vers
 * les textures originales si le pack ne contient pas le fichier demandé.
 */
(function installResourceManager() {
    'use strict';

    const STORAGE_KEY = 'laPlaine.texturePack';
    const originalLoad = THREE.TextureLoader.prototype.load;
    // Les mêmes URL ne doivent pas déclencher un nouveau téléchargement à chaque usage.
    THREE.Cache.enabled = true;

    function selectedPack() {
        return localStorage.getItem(STORAGE_KEY) || 'default';
    }

    function resolveTextureUrl(url) {
        if (typeof url !== 'string' || !url.includes('/static/textures/')) return url;
        const marker = '/static/textures/';
        const relative = url.slice(url.indexOf(marker) + marker.length).split(/[?#]/, 1)[0];
        if (!relative || relative.split('/').some(part => part === '..' || part === '.')) return url;
        const pack = selectedPack();
        if (pack === 'default') return url;
        return `/api/texture-packs/${encodeURIComponent(pack)}/textures/${relative.split('/').map(encodeURIComponent).join('/')}`;
    }

    THREE.TextureLoader.prototype.load = function (url, onLoad, onProgress, onError) {
        const resolved = resolveTextureUrl(url);
        // Le cache du moteur évite les chargements réseau redondants par URL.
        return originalLoad.call(this, resolved, onLoad, onProgress, onError);
    };

    window.LaPlaineResources = Object.freeze({
        getSelectedTexturePack: selectedPack,
        resolveTextureUrl,
        version: 1
    });
})();
