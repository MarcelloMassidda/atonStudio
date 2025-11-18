/**
 * Base Widget class that defines the common interface and functionality for all widgets
 */
export class Widget {
    constructor(app, options) {
        if (!options.id) {
            throw new Error("ID is required for widget");
        }
        
        this.app = app;
        this.id = options.id;
        this.editor = app.editor;
        this.options = options;
        this.items = new Map();
        this.capabilities = new Map();
    }

    /**
     * Register a capability with this widget
     */
    registerCapability(capability) {
        if (!capability.id) {
            throw new Error("Capability must have an ID");
        }
        this.capabilities.set(capability.id, capability);
        console.log(`Registered capability ${capability.id} for widget ${this.id}`);
        return this;
    }

    /**
     * Get capabilities for a specific item by checking scene JSON structure
     * or using custom capability detection methods
     */
    getItemCapabilities(id, item) {
        const scene = this.getCurrentScene();
        if (!scene.capabilities) {
            console.log(`No capabilities in scene`);
            return [];
        }

        // Get the actual item ID - could be passed as first param or from item.nid
        const itemId = id || (item && item.nid);
        
        if (!itemId) {
            console.log(`No item ID provided to getItemCapabilities`);
            return [];
        }

        // ALWAYS get the actual ATON node for capability checks
        // The 'item' parameter might be the JSON scene object, not the node
        const atonNode = this.getItem(itemId);
        if (!atonNode) {
            console.log(`Could not get ATON node for ${itemId}`);
            return [];
        }

        // Get capabilities for this item
        const itemCapabilities = [];
        
        // Check registered capabilities using their detection logic
        for (const [registeredCapId, capability] of this.capabilities.entries()) {
            console.log(`Checking capability ${registeredCapId} for item ${itemId}`);
            // If capability has custom detection method, use it
            if (capability.hasCapabilityForItem) {
                console.log(`Using custom detection for capability ${registeredCapId}`);    
                const hasCapability = capability.hasCapabilityForItem(atonNode, this);
                console.log(hasCapability);

                
                // null means "use default check"
                if (hasCapability === null) {
                    // Fall back to standard JSON check
                    if (scene.capabilities[capability.id]?.[itemId]) {
                        itemCapabilities.push(registeredCapId);
                    }
                } else if (hasCapability === true) {
                    itemCapabilities.push(registeredCapId);
                }
            } else {
                // Standard check: look in scene.capabilities[capability.id][itemId]
                if (scene.capabilities[capability.id]?.[itemId]) {
                    itemCapabilities.push(registeredCapId);
                }
            }
        }
        
        console.log(`✅ Item ${itemId} has ${itemCapabilities.length} capabilities:`, itemCapabilities);
        return itemCapabilities;
    }

    /**
     * Get capabilities available to add to an item
     * Returns visible capabilities that are not yet attached to the item
     * and are compatible with the item (via canEquip check)
     */
    getAvailableCapabilities(item) {
        if (!item) return [];

        const itemCapabilities = this.getItemCapabilities(item.nid, item);
        const availableCapabilities = [];

        // Check all registered capabilities
        for (const [capId, capability] of this.capabilities.entries()) {
            // Only include visible capabilities not already attached
            if (capability.isVisible && !itemCapabilities.includes(capId)) {
                // Check if capability is compatible with this item
                const canEquip = capability.canEquip ? 
                    capability.canEquip(item, this) : 
                    true; // Default to true if canEquip not implemented

                if (canEquip) {
                    availableCapabilities.push({
                        id: capId,
                        name: capability.name,
                        capability: capability
                    });
                }
            }
        }

        return availableCapabilities;
    }

    // Data management methods moved to Capability class

    /**
     * Equip an item with a capability
     */
    equipItemWithCapability(item, capabilityId) {
        const capability = this.capabilities.get(capabilityId);
        if (!capability) {
            throw new Error(`Capability ${capabilityId} not found`);
        }

        // Get or create initial data for this capability
        const initialData = capability.getInitialData ? 
            capability.getInitialData(item) : 
            {};

        // Store the capability data
        this.setItemCapabilityData(item, capabilityId, initialData);
        
        // Let the capability perform any setup
        if (capability.equip) {
            capability.equip(item, this);
        }

        this.app.ui.editor_updateWidgetMainPanel();
        return this;
    }

    /**
     * Add a capability to an item (attach, patch, and update UI)
     */
    addCapabilityToItem(item, capabilityId, skipFocus = false) {
        const capability = this.capabilities.get(capabilityId);
        if (!capability) {
            throw new Error(`Capability ${capabilityId} not found`);
        }

        console.log(`Adding capability ${capabilityId} to item ${item.nid}`);

        // Get initial data from capability
        const initialData = capability.getInitialData ? 
            capability.getInitialData(item) : 
            {};

        // Use setItemData from capability to store and patch
        capability.setItemData(item, this, initialData);

        // Let capability perform any additional setup
        if (capability.equip) {
            capability.equip(item, this);
        }

        // Update hierarchy to refresh item buttons with new decorations
        this.app.ui.editor_updateHierarchy();
        
        // Update the main panel
        this.app.ui.editor_updateWidgetMainPanel();

        // Update the inspector for the current item (but skip if called from auto-equip to avoid loop)
        if (!skipFocus) {
            this.app.widgetsHub.focusOnItem({ id: item.nid, wid: this.id });
        }

        return this;
    }

    /**
     * Initialize the widget
     */
    init() {
        if (this.options.items) {
            const items = this.getItems();
            if (!items) {
                console.log(`NO ${this.id} IN SCENE`);
                return;
            }

            for (const [id, item] of Object.entries(items)) {
                this.addItemToScene(id, item);
            }
        }
    }

    /**
     * Get the main button for the widget
     */
    getMainButton() {
        if (this.options.mainBtn) {
            return this.options.mainBtn();
        }

        if (this.options.mainBtnOptions) {
            const options = {
                ...this.options.mainBtnOptions,
                attr: { "data-id": this.id }
            };
            return this.app.widgetsHub.mainBtn_base(options);
        }
    }

    /**
     * Get a button for a specific item
     */
    getItemButton(id, item) {

        //console.log("Creating item button for item:", id, item);

        // Start with base button options
        let btnOptions = {
            id,
            text: id,
            attr: { "data-id": id, "data-wid": this.id },
            onClick: (event) => {
                // Use the proper this context and pass the event target
                this.app.widgetsHub.onClicked_itemBtn_base(event.target);
            }
        };

        // Allow registered capabilities to decorate the button
        console.log("🎨 Decorating item button via capabilities for item:", id, item);
        const itemCaps = this.getItemCapabilities(id,item);
        console.log("   Item capabilities found:", itemCaps);
        itemCaps.forEach(capId => {
            const capability = this.capabilities.get(capId);
            console.log("   Checking capability:", capId, "has decorateItemBtn?", !!capability?.decorateItemBtn);
            if (capability?.decorateItemBtn) {
                console.log("   Before decoration, badges:", btnOptions.badges);
                btnOptions = capability.decorateItemBtn(btnOptions, item, this);
                console.log("   After decoration, badges:", btnOptions.badges);
            }
        });
        console.log("   Final btnOptions before rendering:", btnOptions);

        // Allow widget-specific button customization last
        if (this.options.itemBtn) {
            console.log("Customizing item button via widget options for item:", id, item);
            btnOptions = this.options.itemBtn(id, item, btnOptions);
        }

        return this.app.widgetsHub.itemBtn_base(btnOptions);
    }

    /**
     * Get the create button for adding new items
     */
    getCreateButton() {
        if (this.options.createBtn) {
            return this.options.createBtn();
        }

        if (this.options.createBtnOptions) {
            const options = {
                ...this.options.createBtnOptions,
                attr: { "data-id": this.id }
            };
            return this.app.widgetsHub.createBtn_base(options);
        }
    }

    /**
     * Get all items for this widget from the current scene
     */
    getItems() {
        if (this.options.items) {
            return this.options.items();
        }

        const scene = this.getCurrentScene();
        return scene[this.id] || null;
    }

    /**
     * Get a specific item by ID
     */
    getItem(id) {
        if (this.options.returnItem) {
            return this.options.returnItem(id);
        }
        return ATON.getSceneNode(id);
    }

    /**
     * Focus on a specific item
     */
    focusItem(node) {
        if (!node) {
            console.error("ATON NODE NOT FOUND");
            return;
        }

        // Check for auto-equip capabilities
        this.checkAutoEquipCapabilities(node);

        if (this.options.focusItem) {
            return this.options.focusItem(node);
        }

        ATON.Nav.requestPOVbyNode(node, 0.3);
    }

    /**
     * Check and auto-equip capabilities that have autoEquip=true
     */
    checkAutoEquipCapabilities(item) {
        if (!item) return;

        console.log(`🔍 Checking auto-equip capabilities for item: ${item.nid}`);

        // Get current capabilities for this item
        const currentCapabilities = this.getItemCapabilities(item.nid, item);
        console.log(`   Current capabilities:`, currentCapabilities);

        // Check all registered capabilities for auto-equip
        for (const [capId, capability] of this.capabilities.entries()) {
            console.log(`   Checking capability: ${capId}, autoEquip=${capability.autoEquip}`);
            
            // Skip if already equipped
            if (currentCapabilities.includes(capId)) {
                console.log(`   ⏭️  Skipping ${capId} - already equipped`);
                continue;
            }

            // Skip if not auto-equip
            if (!capability.autoEquip) {
                console.log(`   ⏭️  Skipping ${capId} - autoEquip is false`);
                continue;
            }

            // Check if can be equipped
            const canEquip = capability.canEquip ? 
                capability.canEquip(item, this) : 
                true;

            console.log(`   canEquip result for ${capId}:`, canEquip);

            if (canEquip) {
                console.log(`🔧 Auto-equipping capability ${capId} to item ${item.nid}`);
                // Pass skipFocus=true to prevent infinite loop
                this.addCapabilityToItem(item, capId, true);
                
                // Verify it was equipped
                const updatedCapabilities = this.getItemCapabilities(item.nid, item);
                console.log(`   ✅ After equipping, capabilities:`, updatedCapabilities);
            }
        }
    }

    /**
     * Setup the gizmo for an item
     */
    setupGizmo(id) {
        if (this.options.setupGizmo) {
            this.options.setupGizmo(id);
        }
    }

    /**
     * Get the current scene
     */
    getCurrentScene() {
        return this.app.db.data.currScene;
    }

    /**
     * Get the inspector header for an item
     */
    getInspectorHeader(id) {
        if (this.options.item_inspector_header) {
            return this.options.item_inspector_header(id);
        }
        return `${id}`;
    }

    /**
     * Delete an item
     */
    deleteItem(id) {
        if (this.options.deleteItem) {
            return this.options.deleteItem(id);
        }
    }

    /**
     * Method to be overridden by widgets that need to handle component features
     */
    getComponents() {
        return this.options.components || {};
    }

    /**
     * Get properties including capability-provided properties
     * @param {Object} item - The item to get properties for. If null, returns base widget properties.
     * @returns {Object} Combined properties from widget and capabilities
     */
    getProperties(item = null) {
        // Start with base widget properties
        let props = { ...this.options.props };

        // If no item provided, return base properties only
        if (!item) return props;

        // Get additional properties from item's capabilities
        const itemCaps = this.getItemCapabilities(item.nid, item);
        console.log("Getting properties via capabilities for item:", item.nid, item, itemCaps);
        itemCaps.forEach(capId => {
            const capability = this.capabilities.get(capId);
            if (capability?.getProperties) {
                const capProps = capability.getProperties(item, this);
                console.log(`Properties from capability ${capId}:`, capProps);
                props = { ...props, ...capProps };
            }
        });

        return props;
    }

    /**
     * Get inspector blocks including capability-provided blocks
     */
    getInspectorBlocks(item) {
        let blocks = [];

        // Add base inspector blocks
        if (this.options.inspectorBlocks) {
            blocks = blocks.concat(this.options.inspectorBlocks(item));
        }

        // Add capability-provided blocks
        const itemCaps = this.getItemCapabilities(item);
        itemCaps.forEach(capId => {
            const capability = this.capabilities.get(capId);
            if (capability?.getInspectorBlocks) {
                const capBlocks = capability.getInspectorBlocks(item, this);
                blocks = blocks.concat(capBlocks);
            }
        });

        return blocks;
    }

    /**
     * Compose a patch with capability modifications
     */
    composePatch(patch, mode) {
        // Let capabilities modify the patch
        const activeNode = this.editor.activeNode;
        if (activeNode) {
            const itemCaps = this.getItemCapabilities(activeNode);
            itemCaps.forEach(capId => {
                const capability = this.capabilities.get(capId);
                if (capability?.modifyPatchData) {
                    // Get current capability data for context
                    const currentData = this.getItemCapabilityData(activeNode, capId);
                    
                    // Let capability modify the patch
                    patch = capability.modifyPatchData(patch, activeNode, this, currentData);
                }
            });

            // Handle legacy texturized data migration if present
            const scene = this.getCurrentScene();
            if (scene.texturized && scene.texturized[activeNode.nid]) {
                // Migrate texturized data to new capability structure
                const texturizedData = scene.texturized[activeNode.nid];
                if (texturizedData.imageScreenPath) {
                    patch = {
                        ...patch,
                        capabilities: {
                            ...patch.capabilities,
                            override: {
                                [activeNode.nid]: {
                                    materials: {
                                        screen: {
                                            texturePath: texturizedData.imageScreenPath
                                        }
                                    }
                                }
                            }
                        },
                        // Mark texturized for removal
                        texturized: {
                            [activeNode.nid]: null
                        }
                    };
                }
            }
        }

        // Send the final patch
        this.editor.patch = patch;
        this.editor.modePatch = mode;
        this.editor.OnPatchChanged();
    }

    /**
     * Virtual method for adding an item to the scene
     */
    addItemToScene(id, item) {
        // To be implemented by child classes
    }

    /**
     * Get the "Add Capability" button for the inspector
     * Returns null if no capabilities are available to add
     */
    getAddCapabilityButton(item) {
        if (!item) return null;

        const availableCapabilities = this.getAvailableCapabilities(item);
        
        // No button if no capabilities available
        if (availableCapabilities.length === 0) return null;

        // Create dropdown items
        const dropdownItems = availableCapabilities.map(cap => ({
            text: cap.name,
            onClick: () => {
                this.addCapabilityToItem(item, cap.id);
            }
        }));

        // Create and return the dropdown button
        return this.app.uikit.createDropdownButton({
            text: ' Add Capability',
            variant: 'success',
            items: dropdownItems
        });
    }
}
