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
        canCraft(recipe, inventory) {
            const needed = new Map();
            for (const row of recipe.pattern) for (const id of row) if (id) needed.set(Number(id), (needed.get(Number(id)) || 0) + 1);
            return [...needed].every(([id, count]) => inventory.slots.reduce((sum, slot) => sum + (slot.type === id ? slot.count : 0), 0) >= count);
        }
        craft(recipe, inventory) {
            if (!this.canCraft(recipe, inventory)) return false;
            const needed = new Map();
            for (const row of recipe.pattern) for (const id of row) if (id) needed.set(Number(id), (needed.get(Number(id)) || 0) + 1);
            const outputId = Number(recipe.output.id), outputCount = Math.max(1, Number(recipe.output.count) || 1);
            if (!inventory.canAdd(outputId, outputCount)) return false;
            for (const [id, amount] of needed) {
                let left = amount;
                for (const slot of inventory.slots) {
                    if (slot.type !== id || left <= 0) continue;
                    const take = Math.min(slot.count, left); slot.count -= take; left -= take;
                    if (!slot.count) slot.type = 0;
                }
            }
            inventory.addItem(outputId, outputCount);
            return true;
        }
    }
    window.craftRegistry = window.craftRegistry || new CraftRegistry();
})();
