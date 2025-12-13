import { OverrideBehaviour } from './OverrideBehaviour.js';

/**
 * Simplified screen material override behaviour
 * Uses the same JSON structure as OverrideBehaviour but only manages "screen" material
 * Extends OverrideBehaviour with specialized screen detection logic
 */
export class ScreenOverrideBehaviour extends OverrideBehaviour {
    constructor() {
        super({
            id: 'override', // Use same ID as parent to share JSON structure
            name: 'Screen Texture Override',
            modes: ['direct', 'action'], // Supports both modes
            isVisible: false, // Not shown in Add Behaviour dropdown
            autoEquip: true // Automatically equip when conditions are met
        });
        
        // Override the ID after super() for internal identification
        this.internalId = 'screenOverride';
    }

    /**
     * Check if this behaviour can be equipped to an item
     * ScreenOverride requires exactly one material named "screen"
     */
    canEquip(itemId) {
        const item = this._widget.getItem(itemId);
        if (!item) return false;

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
            console.log(`✅ ScreenOverride behaviour: Found screen material in ${itemId}`);
            return true;
        }

        console.log(`❌ ScreenOverride behaviour: No single screen material in ${itemId}`);
        return false;
    }

    /**
     * Custom detection for this behaviour on an item
     * Checks if the override behaviour data contains a "screen" key
     */
    hasCapabilityForItem(item, widget) {
        // Check if there's override data for this item with "screen" material
        const scene = widget.getCurrentScene();
        
        // Check both behaviours and capabilities namespaces (for migration support)
        const behaviourData = scene.behaviours?.[this.id]?.[item.nid];
        const capabilityData = scene.capabilities?.[this.id]?.[item.nid];
        const data = behaviourData || capabilityData;
        
        if (data?.materials?.screen) {
            console.log(`✅ Found screen override data for ${item.nid}`);
            return true;
        }

        // Also check if the item physically has a screen material (for auto-equip)
        return this.canEquip(item.nid);
    }

    /**
     * Decorate item button with screen indicator badge
     */
    decorateItemBtn(btnOptions, item, widget) {
        const scene = widget.getCurrentScene();
        
        // Check both behaviours and capabilities for screen texture
        const behaviourData = scene.behaviours?.[this.id]?.[item.nid];
        const capabilityData = scene.capabilities?.[this.id]?.[item.nid];
        const data = behaviourData || capabilityData;
        
        if (data?.materials?.screen) {
            console.log(`🎨 ScreenOverride decorating button for ${item.nid}`);
            
            if (!btnOptions.badges) btnOptions.badges = [];
            
            btnOptions.badges.push({
                text: "🖼️",
                title: "Has screen texture override",
                variant: "info"
            });
        }

        return btnOptions;
    }

    /**
     * Get initial data when behaviour is equipped
     */
    getInitialData(item) {
        return {
            materials: {
                screen: {
                    texturePath: null
                }
            }
        };
    }

    /**
     * Equip the behaviour on an item (called when auto-equipping)
     */
    onEquip(itemId) {
        console.log(`🎨 ScreenOverride behaviour equipped on ${itemId}`);
    }

    /**
     * Unequip the behaviour from an item
     */
    onUnequip(itemId) {
        console.log(`🎨 ScreenOverride behaviour unequipped from ${itemId}`);
    }
}
