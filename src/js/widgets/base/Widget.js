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
     */
    getItemCapabilities(id,item) {
        const scene = this.getCurrentScene();
        if (!scene.capabilities) return [];

        // If no item ID, return empty
        if (!item) return [];

        // Get capabilities for this item
        const itemCapabilities = [];
        
        // Check each capability type in scene.capabilities
        Object.entries(scene.capabilities).forEach(([capabilityId, capabilityData]) => {
            // If this item has data for this capability
            console.log(`Checking capability ${capabilityId} for item ${id}`);
            if (capabilityData[id]) {
                itemCapabilities.push(capabilityId);
            }
        });
        console.log(`Item ${id} has capabilities:`, itemCapabilities);
        return itemCapabilities;
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
        console.log("Decorating item button via capabilities for item:", id, item);
        const itemCaps = this.getItemCapabilities(id,item);
        console.log("Item capabilities found:",id, itemCaps);
        itemCaps.forEach(capId => {
            const capability = this.capabilities.get(capId);
            console.log("Applying capability decoration:", capId, capability);
            if (capability?.decorateItemBtn) {
                btnOptions = capability.decorateItemBtn(btnOptions, item, this);
            }
        });

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

        if (this.options.focusItem) {
            return this.options.focusItem(node);
        }

        ATON.Nav.requestPOVbyNode(node, 0.3);
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
}