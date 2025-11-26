import { OverrideCapability } from './OverrideCapability.js';

/**
 * Simplified screen material override capability
 * Uses the same JSON structure as OverrideCapability but only manages "screen" material
 */
export class ScreenOverrideCapability extends OverrideCapability {
    constructor() {
        super({
            id: 'override', // Use same ID as parent to share JSON structure
            name: 'Screen Texture Override',
            isVisible: false, // Not shown in Add Capability dropdown
            autoEquip: true // Automatically equip when conditions are met
        });
        
        // Override the ID after super() for internal identification
        this.internalId = 'screenOverride';
    }

    /**
     * Check if this capability can be equipped to an item
     * ScreenOverride requires exactly one material named "screen"
     */
    canEquip(item, widget) {
        // Collect all materials from the node
        const materials = [];
        item.traverse((child) => {
            if (child.isMesh && child.material) {
                const mats = Array.isArray(child.material) ? 
                    child.material : [child.material];
                materials.push(...mats);
            }
        });

        // Check if there's exactly one material named "screen"
        const screenMaterials = materials.filter(mat => mat.name === 'screen');
        
        if (screenMaterials.length === 1) {
            console.log(`✅ ScreenOverride capability: Found screen material in ${item.nid}`);
            return true;
        }

        console.log(`❌ ScreenOverride capability: No single screen material in ${item.nid}`);
        return false;
    }

    /**
     * Custom detection for this capability on an item
     * Checks if the override capability data contains a "screen" key
     */
    hasCapabilityForItem(item, widget) {
        const scene = widget.getCurrentScene();
        // Get item ID - could be .nid or .name property
        const itemId = item.nid || item.name;
        
        console.log(`🔍 ScreenOverride.hasCapabilityForItem for ${itemId}:`, {
            hasCapabilities: !!scene.capabilities,
            hasOverride: !!scene.capabilities?.override,
            overrideData: scene.capabilities?.override?.[itemId],
            itemHasNid: !!item.nid,
            itemHasName: !!item.name
        });
        
        if (!scene.capabilities?.override) return false;
        
        const overrideData = scene.capabilities.override[itemId];
        
        // Check if screen material key exists in the materials object
        // This ensures we only detect screen override, not other material overrides
        if (overrideData?.materials?.screen !== undefined) {
            console.log(`✅ ScreenOverride: Item ${itemId} has screen capability equipped`);
            return true;
        }
        
        console.log(`❌ ScreenOverride: Item ${itemId} does NOT have screen capability equipped`);
        return false;
    }

    /**
     * Get initial data when capability is equipped
     * Initialize with screen material structure
     */
    getInitialData(item) {
        return {
            materials: {
                screen: {}
            }
        };
    }

    /**
     * Override createAuthoringUI to filter for screen material
     * Reuses parent implementation but with filtered materials
     */
    createAuthoringUI(context) {
        const { itemId, widget } = context;
        
        // Get the item
        const item = widget.getItem(itemId);
        if (!item) return null;
        
        // Get screen materials (should be 1)
        const materials = this.getMaterialsFromNode(item);
        
        if (materials.length === 0) {
            return widget.app.uikit.createText({
                text: "No screen material found on this item",
                classList: ['text-muted', 'fst-italic']
            });
        }
        
        // Use parent's authoring UI with filtered context
        return super.createAuthoringUI(context);
    }

    /**
     * Get properties for this capability
     * @param {Object} item - The item to get properties for
     * @param {Object} widget - The parent widget
     * @returns {Object} Property definitions
     */
    getProperties(item, widget) {
        // Only add properties if item has screen material
        const materials = this.getMaterialsFromNode(item);
        console.log(item)
        console.log("Materials for item:", materials);

        const screenMaterial = materials.find(m => m.name === 'screen');
        
        if (!screenMaterial) return {};

        // Get our capability data
        const capabilityData = this.getItemData(item, widget);
        
        return {
            screenTexture: {
                inspectorBlock: (item) => this.createTextureOverrideBlock(screenMaterial, item, widget),
                get: () => capabilityData?.materials?.screen?.texturePath || null,
                set: (texturePath) => {
                    this.setItemData(item, widget, {
                        materials: {
                            screen: { texturePath }
                        }
                    });
                }
            }
        };
    }

    /**
     * Filter to only affect screen material
     */
    modifyPatchData(patch, item, widget, currentData) {
        // If patch doesn't affect materials, return as is
        if (!patch.capabilities?.[this.id]) return patch;
        
        const capabilityData = patch.capabilities[this.id];
        
        // Ensure we only modify screen material data
        if (capabilityData.materials?.screen) {
            return {
                capabilities: {
                    [this.id]: {
                        materials: {
                            screen: capabilityData.materials.screen
                        }
                    }
                }
            };
        }
        
        return patch;
    }

    /**
     * Decorate the item button with a 🛠️ badge if the item has screen material override
     */
    decorateItemBtn(btnOptions, item, widget) {

        /*
        const materials = this.getMaterialsFromNode(item);
        const screenMaterial = materials.find(m => m.name === 'screen');
        
        if (!screenMaterial) return btnOptions;
        */
        // Initialize or get existing badges array
        btnOptions.badges = btnOptions.badges || [];
        
        // Add our badge
        btnOptions.badges.push({
            text: '🛠️',
            type: 'info',
            title: 'Has screen override capability'
        });

        return btnOptions;
    }
}