
class BlockRegistry {
    constructor() {
        this.blocks = new Map();
    }

    register(blockData) {
        if (!blockData || typeof blockData.id !== 'number' || !blockData.name) {
            console.error("Échec d'enregistrement du bloc : ID et nom requis.", blockData);
            return;
        }

        const formattedBlock = {
            id: blockData.id,
            name: blockData.name,
            textures: blockData.textures || {},
            transparent: Boolean(blockData.transparent),
            alphaTest: blockData.alphaTest || 0,
            isPlant: Boolean(blockData.isPlant),
            
            isFluid: Boolean(blockData.isFluid),
            viscosity: blockData.viscosity || 1, 
            lightLevel: blockData.lightLevel || 0, 
            emitColor: blockData.emitColor || 0xffffff
        };

        this.blocks.set(formattedBlock.id, formattedBlock);
    }

    get(id) {
        return this.blocks.get(id) || null;
    }

    getAll() {
        return Array.from(this.blocks.values());
    }
}

window.blockRegistry = new BlockRegistry();