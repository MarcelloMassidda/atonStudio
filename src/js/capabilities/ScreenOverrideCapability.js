import { OverrideCapability } from './OverrideCapability.js';

/**
 * Simplified screen material override capability
 */
export class ScreenOverrideCapability extends OverrideCapability {
    constructor() {
        super({
            id: 'screenOverride',
            name: 'Screen Texture Override'
        });
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