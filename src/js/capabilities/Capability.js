/**
 * Base class for all capabilities that can be equipped on widgets
 */
export class Capability {
    constructor(options) {
        this.id = options.id;
        this.name = options.name;
        this.isVisible = options.isVisible ?? true;
        this.config = options.config ?? {};
    }

    /**
     * Add this capability to an item
     */
    equip(item, widget) {
        if (!item.capabilities) item.capabilities = [];
        item.capabilities.push(this.id);
        return this.onEquip?.(item, widget);
    }

    /**
     * Remove this capability from an item
     */
    unequip(item, widget) {
        if (!item.capabilities) return;
        item.capabilities = item.capabilities.filter(c => c !== this.id);
        return this.onUnequip?.(item, widget);
    }

    /**
     * Decorate an item's button display
     */
    decorateItemBtn(btnOptions, item, widget) { 
        return btnOptions; 
    }

    /**
     * Get inspector blocks for this capability
     */
    getInspectorBlocks(item, widget) { 
        return []; 
    }

    /**
     * Modify create workflow
     */
    modifyCreateWorkflow(workflow, widget) { 
        return workflow; 
    }

    /**
     * Get capability data for a specific item from the scene
     * @protected - For use by capability implementations
     */
    getItemData(item, widget) {
        const scene = widget.getCurrentScene();
        if (!scene.capabilities?.[this.id]) return null;
        if (!item) return null;

        return scene.capabilities[this.id][item.nid];
    }

    /**
     * Set capability data for an item in the scene
     * @protected - For use by capability implementations
     */
    setItemData(item, widget, data) {
        if (!item || !item.nid) {
            throw new Error('Item must have an nid to set capability data');
        }

        const scene = widget.getCurrentScene();
        
        // Initialize capabilities structure if needed
        if (!scene.capabilities) scene.capabilities = {};
        if (!scene.capabilities[this.id]) scene.capabilities[this.id] = {};
        
        // Store capability data
        scene.capabilities[this.id][item.nid] = data;
        
        // Create patch to update scene
        const patch = {
            capabilities: {
                [this.id]: {
                    [item.nid]: data
                }
            }
        };
        console.log("Setting capability data patch:", patch);
        widget.composePatch(patch);
    }

    /**
     * Get initial data structure when equipping this capability
     * Override in subclasses to provide capability-specific initial data
     */
    getInitialData(item) {
        return {};
    }

    /**
     * Modify patch data before sending
     * Subclasses should override this to handle their specific data structures
     */
    modifyPatchData(patch, item, widget) { 
        return patch; 
    }
}