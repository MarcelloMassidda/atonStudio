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
    this.capabilities = new Map(); // Legacy - for backward compatibility
    this.behaviours = new Map(); // New unified behaviours system
  }

  /**
   * Register a behaviour with this widget
   * @param {Behaviour} behaviour - The behaviour to register
   */
  registerBehaviour(behaviour) {
    if (!behaviour.id) {
      throw new Error("Behaviour must have an ID");
    }
    behaviour.setWidget(this);
    this.behaviours.set(behaviour.id, behaviour);
    console.log(`✨ Registered behaviour ${behaviour.id} for widget ${this.id}`);
    return this;
  }

  /**
   * Register a capability with this widget (LEGACY - for backward compatibility)
   * @deprecated Use registerBehaviour() instead
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
   * Get behaviours that support direct mode
   * @returns {Array} Array of behaviours supporting 'direct' mode
   */
  getDirectModeBehaviours() {
    const directBehaviours = [];
    for (const [id, behaviour] of this.behaviours.entries()) {
      if (behaviour.supportsMode('direct')) {
        directBehaviours.push(behaviour);
      }
    }
    return directBehaviours;
  }

  /**
   * Get behaviours that support action mode
   * @returns {Array} Array of action definitions for behaviours supporting 'action' mode
   */
  getActionModeBehaviours() {
    const actions = [];
    for (const [id, behaviour] of this.behaviours.entries()) {
      if (behaviour.supportsMode('action')) {
        const actionDef = behaviour.getActionDefinition(this);
        if (actionDef) {
          actions.push(actionDef);
        }
      }
    }
    return actions;
  }

  /**
   * Get all capabilities registered to this widget
   * @returns {Object} Object with capability id as key and capability instance as value
   */
  getCapabilities() {
    const capsObject = {};
    for (const [id, capability] of this.capabilities.entries()) {
      capsObject[id] = capability;
    }
    return capsObject;
  }

  /**
   * Get behaviours for a specific item by checking scene JSON structure
   * @param {string} id - Item ID
   * @param {Object} item - Item object
   * @returns {Array} Array of behaviour IDs equipped on this item
   */
  getItemBehaviours(id, item) {
    const scene = this.getCurrentScene();
    if (!scene.behaviours) {
      console.log(`No behaviours in scene`);
      return [];
    }

    // Get the actual item ID - could be passed as first param or from item.nid
    const itemId = id || (item && item.nid);

    if (!itemId) {
      console.log(`No item ID provided to getItemBehaviours`);
      return [];
    }

    // ALWAYS get the actual ATON node for behaviour checks
    const atonNode = this.getItem(itemId);
    if (!atonNode) {
      console.log(`Could not get ATON node for ${itemId}`);
      return [];
    }

    // Get behaviours for this item
    const itemBehaviours = [];

    // Check registered behaviours using their detection logic
    for (const [registeredBehaviourId, behaviour] of this.behaviours.entries()) {
      console.log(`Checking behaviour ${registeredBehaviourId} for item ${itemId}`);
      
      // If behaviour has custom detection method, use it
      if (behaviour.canEquip) {
        const canEquip = behaviour.canEquip(itemId);
        
        // Check if behaviour is actually equipped (has data in scene)
        if (canEquip && scene.behaviours[behaviour.id]?.[itemId]) {
          itemBehaviours.push(registeredBehaviourId);
        }
      } else {
        // Standard check: look in scene.behaviours[behaviour.id][itemId]
        if (scene.behaviours[behaviour.id]?.[itemId]) {
          itemBehaviours.push(registeredBehaviourId);
        }
      }
    }

    console.log(
      `✅ Item ${itemId} has ${itemBehaviours.length} behaviours:`,
      itemBehaviours
    );
    return itemBehaviours;
  }

  /**
   * Get capabilities for a specific item by checking scene JSON structure (LEGACY)
   * @deprecated Use getItemBehaviours() instead for new code
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

    console.log(
      `✅ Item ${itemId} has ${itemCapabilities.length} capabilities:`,
      itemCapabilities
    );
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
        const canEquip = capability.canEquip
          ? capability.canEquip(item, this)
          : true; // Default to true if canEquip not implemented

        if (canEquip) {
          availableCapabilities.push({
            id: capId,
            name: capability.name,
            capability: capability,
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
    const initialData = capability.getInitialData
      ? capability.getInitialData(item)
      : {};

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
    const initialData = capability.getInitialData
      ? capability.getInitialData(item)
      : {};

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
        attr: { "data-id": this.id },
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
      },
    };

    // Allow registered capabilities to decorate the button
    console.log(
      "🎨 Decorating item button via capabilities for item:",
      id,
      item
    );
    const itemCaps = this.getItemCapabilities(id, item);
    console.log("   Item capabilities found:", itemCaps);
    itemCaps.forEach((capId) => {
      const capability = this.capabilities.get(capId);
      console.log(
        "   Checking capability:",
        capId,
        "has decorateItemBtn?",
        !!capability?.decorateItemBtn
      );
      if (capability?.decorateItemBtn) {
        console.log("   Before decoration, badges:", btnOptions.badges);
        btnOptions = capability.decorateItemBtn(btnOptions, item, this);
        console.log("   After decoration, badges:", btnOptions.badges);
      }
    });
    console.log("   Final btnOptions before rendering:", btnOptions);

    // Allow widget-specific button customization last
    if (this.options.itemBtn) {
      console.log(
        "Customizing item button via widget options for item:",
        id,
        item
      );
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
        attr: { "data-id": this.id },
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
      console.log(
        `   Checking capability: ${capId}, autoEquip=${capability.autoEquip}`
      );

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
      const canEquip = capability.canEquip
        ? capability.canEquip(item, this)
        : true;

      console.log(`   canEquip result for ${capId}:`, canEquip);

      if (canEquip) {
        console.log(
          `🔧 Auto-equipping capability ${capId} to item ${item.nid}`
        );
        // Pass skipFocus=true to prevent infinite loop
        this.addCapabilityToItem(item, capId, true);

        // Verify it was equipped
        const updatedCapabilities = this.getItemCapabilities(item.nid, item);
        console.log(
          `   ✅ After equipping, capabilities:`,
          updatedCapabilities
        );
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
   * Remove a behaviour from an item (manual unequip)
   * @param {string} itemId - ID of the item
   * @param {string} behaviourId - ID of the behaviour to remove
   */
  removeBehaviourFromItem(itemId, behaviourId) {
    const behaviour = this.behaviours.get(behaviourId);
    if (!behaviour) {
      console.warn(`Behaviour ${behaviourId} not found`);
      return;
    }

    // Call lifecycle hook
    if (behaviour.onUnequip) {
      behaviour.onUnequip(itemId);
    }

    // Delete from scene data
    const scene = this.getCurrentScene();
    if (scene.behaviours?.[behaviourId]?.[itemId]) {
      delete scene.behaviours[behaviourId][itemId];

      // If no more items have this behaviour, clean up the behaviour entry
      if (Object.keys(scene.behaviours[behaviourId]).length === 0) {
        delete scene.behaviours[behaviourId];
      }
    }

    // Send delete patch
    this.composePatch(
      {
        behaviours: {
          [behaviourId]: {
            [itemId]: {}
          }
        }
      },
      ATON.SceneHub.MODE_DEL
    );

    console.log(`🗑️ Removed behaviour ${behaviourId} from item ${itemId}`);

    // Refresh UI
    this.app.ui.editor_updateHierarchy();
    this.app.ui.editor_updateWidgetMainPanel();
    this.app.widgetsHub.focusOnItem({ id: itemId, wid: this.id });
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
   * Get properties including behaviour/capability-provided properties
   * @param {Object} item - The item to get properties for. If null, returns base widget properties.
   * @returns {Object} Combined properties from widget, behaviours, and capabilities
   */
  getProperties(item = null) {
    // Start with base widget properties
    let props = { ...this.options.props };

    // If no item provided, return base properties only
    if (!item) return props;

    // Get properties from behaviours (direct mode)
    const itemBehaviours = this.getItemBehaviours(item.nid, item);
    console.log(
      "Getting properties via behaviours for item:",
      item.nid,
      item,
      itemBehaviours
    );
    itemBehaviours.forEach((behaviourId) => {
      const behaviour = this.behaviours.get(behaviourId);
      if (behaviour?.supportsMode('direct') && behaviour.getProperties) {
        const behaviourProps = behaviour.getProperties(item.nid, this);
        console.log(`Properties from behaviour ${behaviourId}:`, behaviourProps);
        // Merge behaviour properties (same pattern as capabilities)
        props = { ...props, ...behaviourProps };
      }
    });

    // Legacy: Get additional properties from item's capabilities (backward compatibility)
    const itemCaps = this.getItemCapabilities(item.nid, item);
    console.log(
      "Getting properties via capabilities for item:",
      item.nid,
      item,
      itemCaps
    );
    itemCaps.forEach((capId) => {
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
    itemCaps.forEach((capId) => {
      const capability = this.capabilities.get(capId);
      if (capability?.getInspectorBlocks) {
        const capBlocks = capability.getInspectorBlocks(item, this);
        
        // Wrap capability blocks in a section with micro-title
        if (capBlocks.length > 0) {
          const capSection = this.app.uikit.inspectorSection(
            capability.name || capId,
            capBlocks
          );
          blocks.push(capSection);
        }
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
      itemCaps.forEach((capId) => {
        const capability = this.capabilities.get(capId);
        if (capability?.modifyPatchData) {
          // Get current capability data for context
          const currentData = this.getItemCapabilityData(activeNode, capId);

          // Let capability modify the patch
          patch = capability.modifyPatchData(
            patch,
            activeNode,
            this,
            currentData
          );
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
                      texturePath: texturizedData.imageScreenPath,
                    },
                  },
                },
              },
            },
            // Mark texturized for removal
            texturized: {
              [activeNode.nid]: null,
            },
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
   * Virtual method called when widget loses focus (before switching to another item/widget)
   * Allows widgets to cleanup temporary resources like 3D icons
   * @param {Object} item - The item that is losing focus
   */
  onLoseFocus(item) {
    // To be implemented by child classes that need cleanup
  }

  /**
   * Get behaviours available to add to an item
   * Returns visible behaviours that are not yet attached to the item
   * and are compatible with the item (via canEquip check)
   */
  getAvailableBehaviours(item) {
    if (!item) return [];

    const itemBehaviours = this.getItemBehaviours(item.nid, item);
    const availableBehaviours = [];

    // Check all registered behaviours
    for (const [behaviourId, behaviour] of this.behaviours.entries()) {
      // Only include visible behaviours not already attached
      if (behaviour.isVisible && !itemBehaviours.includes(behaviourId)) {
        // Check if behaviour is compatible with this item
        const canEquip = behaviour.canEquip
          ? behaviour.canEquip(item.nid)
          : true; // Default to true if canEquip not implemented

        if (canEquip) {
          availableBehaviours.push({
            id: behaviourId,
            name: behaviour.name,
            behaviour: behaviour,
          });
        }
      }
    }

    return availableBehaviours;
  }

  /**
   * Add a behaviour to an item (equip, patch, and update UI)
   */
  addBehaviourToItem(item, behaviourId, skipFocus = false) {
    const behaviour = this.behaviours.get(behaviourId);
    if (!behaviour) {
      throw new Error(`Behaviour ${behaviourId} not found`);
    }

    console.log(`✨ Adding behaviour ${behaviourId} to item ${item.nid}`);

    // Get initial data from behaviour
    const initialData = behaviour.getInitialData
      ? behaviour.getInitialData(item)
      : {};

    // Store and patch behaviour data
    behaviour.saveDirectModeData(item.nid, initialData);

    // Let behaviour perform any additional setup
    if (behaviour.onEquip) {
      behaviour.onEquip(item.nid);
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
   * Get the "Add Behaviour/Capability" button for the inspector
   * Returns null if no behaviours or capabilities are available to add
   */
  getAddCapabilityButton(item) {
    if (!item) return null;

    // Get available behaviours and capabilities
    const availableBehaviours = this.getAvailableBehaviours(item);
    const availableCapabilities = this.getAvailableCapabilities(item);

    // Combine both
    const allAvailable = [];

    // Add behaviours
    availableBehaviours.forEach((b) => {
      allAvailable.push({
        text: b.name,
        onClick: () => {
          this.addBehaviourToItem(item, b.id);
        },
      });
    });

    // Add legacy capabilities
    availableCapabilities.forEach((c) => {
      allAvailable.push({
        text: c.name,
        onClick: () => {
          this.addCapabilityToItem(item, c.id);
        },
      });
    });

    // No button if nothing available
    if (allAvailable.length === 0) return null;

    // Create and return the dropdown button
    return this.app.uikit.createDropdownButton({
      text: " Add Behaviour",
      variant: "success",
      items: allAvailable,
    });
  }

  /**
   * Get actions for this widget
   * Returns array of action objects that can be assigned to items at runtime
   * Override in subclasses to provide widget-specific actions
   * Behaviours with action mode support are automatically included
   * @returns {Array} Array of action objects
   */
  getActions() {
    let actions = [];

    // Get actions from behaviours that support action mode
    // Note: We get actions from ALL behaviours, not just equipped ones
    // This is because the action catalog should show what's possible
    const behaviourActions = this.getActionModeBehaviours();
    actions = actions.concat(behaviourActions);

    // Legacy: Get actions from capabilities (backward compatibility)
    this.capabilities.forEach((capability) => {
      if (capability?.addActions) {
        const capActions = capability.addActions(this);
        if (capActions && Array.isArray(capActions)) {
          actions = actions.concat(capActions);
        }
      }
    });

    return actions;
  }
}
