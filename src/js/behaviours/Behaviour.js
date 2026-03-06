/**
 * Behaviour Base Class
 * 
 * Unified entity that replaces both Actions and Capabilities.
 * A behaviour can execute in different modes:
 * - 'direct': Immediate execution, applied directly to items
 * - 'action': Deferred execution, triggered by semantic graph events
 * 
 * Each behaviour declares which modes it supports via modes[] array.
 * Future modes can be added: 'hover', 'proximity', 'timer', 'condition', etc.
 */

class Behaviour {
    /**
     * @param {Object} config - Behaviour configuration
     * @param {string} config.id - Unique identifier for this behaviour
     * @param {string} config.name - Display name
     * @param {Array<string>} config.modes - Supported execution modes ['direct', 'action']
     * @param {boolean} config.isVisible - Whether visible in UI (default: true)
     * @param {boolean} config.autoEquip - Whether to auto-equip on items (default: false)
     * @param {string} config.actionLabel - Label for action mode UI (default: name)
     * @param {Array<string>} config.eventTypes - Supported event types (default: ['onSelect'])
     */

    // #region Core
    constructor(config = {}) {
        this.id = config.id || 'behaviour';
        this.name = config.name || 'Behaviour';
        this.modes = config.modes || ['direct']; // Default to direct mode only
        this.isVisible = config.isVisible !== undefined ? config.isVisible : true;
        this.autoEquip = config.autoEquip || false;
        this.actionLabel = config.actionLabel || this.name;
        this.eventTypes = config.eventTypes || ['onSelect'];
        
        this._widget = null;
    }
    // #endregion

  
    // ============================================================
    //#region Lifecycle
    // ============================================================


     /**
     * Check if this behaviour supports a specific mode
     * @param {string} mode - Mode to check ('direct', 'action', etc.)
     * @returns {boolean}
     */
    supportsMode(mode) {
        return this.modes.includes(mode);
    }

    /**
     * Set the widget this behaviour is registered to
     * @param {Widget} widget
     */
    setWidget(widget) {
        this._widget = widget;
    }

    /**
     * Get the widget this behaviour is registered to
     * @returns {Widget}
     */
    getWidget() {
        return this._widget;
    }

    /**
     * Get the scene object
     * @returns {Object}
     */
    getScene() {
        return this._widget?.getCurrentScene();
    }

    /**
     * Check if this behaviour can be equipped on an item
     * @param {string} itemId - ID of the item
     * @returns {boolean}
     */
    canEquip(itemId) {
        return true; // Override in subclass
    }

    /**
     * Called when behaviour is equipped on an item (direct mode)
     * @param {string} itemId - ID of the item
     */
    onEquip(itemId) {
        // Override in subclass
    }

    /**
     * Called when behaviour is unequipped from an item (direct mode)
     * @param {string} itemId - ID of the item
     */
    onUnequip(itemId) {
        // Override in subclass
    }

    /**
     * Called when an item is deleted from the widget
     * Clean up behaviour data for this item
     * @param {string} itemId - ID of the deleted item
     */
    onItemDeleted(itemId) {
        // Direct mode cleanup
        if (this.supportsMode('direct')) {
            const behaviourData = this._widget.getCurrentScene().behaviours?.[this.id];
            if (behaviourData && behaviourData[itemId]) {
                delete behaviourData[itemId];
                
                // Patch to server
                this.sendPatch(
                    `behaviours/${this.id}/${itemId}`,
                    {},
                    ATON.SceneHub.MODE_DEL
                );
            }
        }
        
        // Override in subclass for additional cleanup
    }

    /**
     * Called when an item referenced by this behaviour is deleted
     * Clean up references to that item
     * @param {string} referencedItemId - ID of the referenced item that was deleted
     */
    onReferencedItemDeleted(referencedItemId) {
        // Override in subclass to clean up references
    }

       /**
     * Focus on an item to refresh UI
     * @param {string} itemId
     */
    focusOnItem(itemId) {
        if (this._widget?.app?.widgetsHub) {
            this._widget.app.widgetsHub.focusOnItem({ 
                id: itemId, 
                wid: this._widget.id 
            });
        }
    }

    
    
    // ============================================================
    // Authoring UI
    // ============================================================
    
    /**
     * Create the authoring UI for this behaviour
     * This is the SINGLE SOURCE for configuration UI
     * Must be implemented by subclass
     * 
     * @param {Object} context - Authoring context
     * @param {string} context.mode - Execution mode ('direct' or 'action')
     * @param {string} context.itemId - Item ID (for direct mode)
     * @param {string} context.actionId - Action ID (for action mode)
     * @param {Object} context.actionData - Current action data (for action mode)
     * @param {Function} context.onSave - Save callback (for action mode)
     * @returns {HTMLElement} - UI container element
    */
   createAuthoringUI(context) {
       throw new Error('createAuthoringUI() must be implemented by subclass');
    }
    //#endregion
    
    
    // ============================================================
    //#region Data and State
    // ============================================================


    // Direct Mode Integration
    // ==========================
    
    /**
     * Get properties for direct mode inspector
     * Returns properties object matching capability pattern
     * @param {string} itemId - ID of the item
     * @param {Widget} widget - The widget instance
     * @returns {Object} - Properties object with inspectorBlock methods
     */
    getProperties(itemId, widget) {
        if (!this.supportsMode('direct')) {
            return {};
        }

        // Return object with inspectorBlock method (same pattern as capabilities)
        return {
            [this.id]: {
                inspectorBlock: (item) => {
                    return this.createAuthoringUI({
                        mode: 'direct',
                        itemId: itemId,
                        widget: widget || this._widget
                    });
                }
            }
        };
    }

    /**
     * Get direct mode data for an item
     * @param {string} itemId
     * @returns {Object|undefined}
     */
    getDirectModeData(itemId) {
        if (!this._widget) return undefined;
        const scene = this._widget.getCurrentScene();
        return scene.behaviours?.[this.id]?.[itemId];
    }

    /**
     * Save direct mode data for an item
     * @param {string} itemId
     * @param {Object} data
     */
    saveDirectModeData(itemId, data) {
        if (!this._widget) return;
        
        const scene = this._widget.getCurrentScene();
        if (!scene.behaviours) scene.behaviours = {};
        if (!scene.behaviours[this.id]) scene.behaviours[this.id] = {};
        
        scene.behaviours[this.id][itemId] = data;
        
        // Patch to server
        this.sendPatch(
            `behaviours/${this.id}/${itemId}`,
            data,
            ATON.SceneHub.MODE_ADD
        );
    }

    // Action Mode Integration
    // ==========================

    /**
     * Get action definition for action mode
     * Returns action configuration for semantic graph events (compatible with capability actions)
     * @param {Widget} widget - The widget instance
     * @returns {Object} - Action definition
     */
    getActionDefinition(widget) {
        if (!this.supportsMode('action')) {
            return null;
        }

        return {
            id: this.id,
            name: this.actionLabel,
            widgetId: widget.id,
            getProperties: (context) => {
                const { node, actionId, args } = context;
                return {
                    [this.id]: {
                        inspectorBlock: () => this.createActionInspectorBlock(node, actionId, args, widget)
                    }
                };
            },
            execute: (context) => {
                // Runtime execution handled by prototyper flare
            },
            onDelete: (context) => {
                console.log(`🧹 Cleaning up ${this.id} behaviour action`);
            },
            onReferencedItemDeleted: (deletedItemId, actionInstance) => {
                // Check if this action references the deleted item
                if (actionInstance.args?.itemId === deletedItemId) {
                    return { 
                        shouldRemove: true, 
                        reason: `Item "${deletedItemId}" was deleted` 
                    };
                }
                return { shouldRemove: false };
            }
        };
    }

    /**
     * Create action inspector block for action mode
     * Override this method if your behaviour needs custom action UI
     * (e.g., item selection, additional configuration)
     * 
     * @param {string} actionId - ID of the action
     * @param {Object} actionData - Current action data
     * @param {Function} onSave - Save callback
     * @returns {HTMLElement} - UI container element
     */
    createActionInspectorBlock(actionId, actionData, onSave) {
        // Default implementation: just call createAuthoringUI
        return this.createAuthoringUI({
            mode: 'action',
            actionId: actionId,
            actionData: actionData,
            onSave: onSave
        });
    }

    /**
     * Save action mode data
     * @param {string} actionId
     * @param {Object} data
     * @param {Function} onSave - Callback to propagate save
     */
    saveActionModeData(actionId, data, onSave) {
        if (onSave) {
            onSave(data);
        }
    }

    // ============================================================
    // Utility Methods
    // ============================================================
    
    /**
     * Send a patch to the server
     * @param {string} path - Patch path (e.g., 'behaviours/override/itemId')
     * @param {Object} data - Patch data
     * @param {number} mode - Patch mode (MODE_ADD or MODE_DEL)
     */
    sendPatch(path, data, mode) {
        if (!this._widget) return;

        // Build patch object from path
        const pathParts = path.split('/');
        let patchData = {};
        
        // Build nested structure
        let current = patchData;
        for (let i = 0; i < pathParts.length - 1; i++) {
            current[pathParts[i]] = {};
            current = current[pathParts[i]];
        }
        current[pathParts[pathParts.length - 1]] = data;

        // Use widget's composePatch method (same as capabilities)
        this._widget.composePatch(patchData, mode);
    }

 
}

export { Behaviour };