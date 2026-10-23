/**
 * Registre des recettes. Les recettes sont des données JSON, séparées du code de
 * l'interface, pour faciliter leur documentation et l'ajout futur par les mods.
 */

(function () {
    class CraftRegistry {
        constructor() { this.recipes = []; }
        async load(files) {
            const loaded = await Promise.all((files || []).map(async file => {
                const response = await fetch(`/static/js/crafts/recipes/${encodeURIComponent(file)}`);
                if (!response.ok) throw new Error(`Recette inaccessible : ${file}`);
                return response.json();
            }));
            this.recipes = loaded.flat().filter(r => r && r.id && Array.isArray(r.pattern) && r.output);
            return this.recipes;
        }
        getAll() { return this.recipes.slice(); }
        _matchesAt(recipe, grid, size, ox, oy, mirror = false) {
            const pattern = recipe.pattern || [];
            for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
                const px = x - ox, py = y - oy;
                let expected = 0;
                if (py >= 0 && py < pattern.length) {
                    const row = pattern[py] || [];
                    const ix = mirror ? row.length - 1 - px : px;
                    if (ix >= 0 && ix < row.length) expected = Number(row[ix]) || 0;
                }
                const actual = Number(grid[y * size + x]?.type) || 0;
                if (actual !== expected) return false;
            }
            return true;
        }
        findMatch(grid, size) {
            for (const recipe of this.recipes) {
                const recipeSize = Number(recipe.grid) || recipe.pattern.length;
                if (recipeSize > size || recipe.pattern.length > size || recipe.pattern.some(row => row.length > size)) continue;
                const maxY = size - recipe.pattern.length, maxX = size - Math.max(...recipe.pattern.map(r => r.length));
                for (let y = 0; y <= maxY; y++) for (let x = 0; x <= maxX; x++) {
                    if (this._matchesAt(recipe, grid, size, x, y, false) || this._matchesAt(recipe, grid, size, x, y, true)) return recipe;
                }
            }
            return null;
        }
        canCraft(recipe, inventory) {
            const needed = new Map();
            for (const row of recipe.pattern) for (const id of row) if (id) needed.set(Number(id), (needed.get(Number(id)) || 0) + 1);
            return [...needed].every(([id, count]) => inventory.slots.reduce((sum, slot) => sum + (slot.type === id ? slot.count : 0), 0) >= count);
        }
    }
    window.craftRegistry = window.craftRegistry || new CraftRegistry();
})();
