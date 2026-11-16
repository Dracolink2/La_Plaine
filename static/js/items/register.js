(function () {
    class ItemsRegistry {
        constructor() { this.items = new Map(); }
        register(data) {
            if (!data || !Number.isSafeInteger(Number(data.id)) || Number(data.id) <= 0 || !data.name) return false;
            const item = {
                id: Number(data.id), name: String(data.name),
                texture: data.texture || '', place: data.place == null ? null : Number(data.place),
                tool: Boolean(data.tool), type: data.type || null,
                level: Math.max(1, Number(data.level) || 1),
                stack: Math.max(1, Math.floor(Number(data.stack) || 100)),
                maxDurability: Math.max(0, Math.floor(Number(data.maxDurability) || 0))
            };
            this.items.set(item.id, item);
            return true;
        }
        get(id) { return this.items.get(Number(id)) || null; }
        getAll() { return [...this.items.values()]; }
        registerBlocks() {
            if (!window.blockRegistry) return;
            for (const block of window.blockRegistry.getAll()) {
                if (!this.get(block.id)) {
                    const texture = block.textures?.all || block.textures?.top || block.textures?.sides || '';
                    this.register({ id: block.id, name: block.name, texture, place: block.isFluid ? null : block.id, stack: 100 });
                }
            }
        }
    }
    window.itemsRegistry = window.itemsRegistry || new ItemsRegistry();
})();
