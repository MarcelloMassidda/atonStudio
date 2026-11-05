/**
 * Base Widget class that defines the common interface and functionality for all widgets
 */
export class Widget {

// ============================================================
// #region Core
// ============================================================
  constructor(app, options) {
    if (!options.id) {
      throw new Error("ID is required for widget");
    }

    this.app = app;
    this.id = options.id;
    this.editor = app.editor;
    this.options = options;
    this.items = new Map();
    this.behaviours = new Map();
  }
  // #endregion

// ============================================================
// #region Data & State
// ============================================================
   //   /* Initialize the widget*/
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
   * Get properties including behaviour-provided properties
   * @param {Object} item - The item to get properties for. If null, returns base widget properties.
   * @returns {Object} Combined properties from widget and behaviours
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
        props = { ...props, ...behaviourProps };
      }
    });

    return props;
  }

  /**
   * Compose and send a patch
   */
  composePatch(patch, mode) {
    this.editor.patch = patch;
    this.editor.modePatch = mode;
    this.editor.OnPatchChanged();
  }

   /**
   * Get the current scene
   */
  getCurrentScene() {
    return this.app.db.data.currScene;
  }
  // #endregion

// ============================================================
// #region Item Management
// ============================================================
  /* Virtual method for adding an item to the scene*/
  addItemToScene(id, item) {
    // To be implemented by child classes
  }

  
  /* Get all items for this widget from the current scene */
  getItems() {
    if (this.options.items) {
      return this.options.items();
    }

    const scene = this.getCurrentScene();
    return scene[this.id] || null;
  }

  /* Get a specific item by ID */
  getItem(id) {
    if (this.options.returnItem) {
      return this.options.returnItem(id);
    }
    return ATON.getSceneNode(id);
  }

  /* Focus on a specific item */
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
   * Virtual method called when widget loses focus (before switching to another item/widget)
   * Allows widgets to cleanup temporary resources like 3D icons
   * @param {Object} item - The item that is losing focus
   */
  onLoseFocus(item) {
    // To be implemented by child classes that need cleanup
  }

  
  /**
   * Delete an item
   */
  deleteItem(id) {
    if (this.options.deleteItem) {
      return this.options.deleteItem(id);
    }
  }
  // #endregion

// ============================================================  
// #region Behaviour System
// ============================================================
  /* Register a behaviour with this widget
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
   * Check and auto-equip behaviours that should be automatically equipped
   * @param {Object} item - The item to check
   */
  checkAutoEquipBehaviours(item) {
    if (!item) return;

    // Get all behaviours that support direct mode
    const directBehaviours = this.getDirectModeBehaviours();
    
    for (const behaviour of directBehaviours) {
      // Skip if not auto-equip
      if (!behaviour.autoEquip) continue;
      
      // Skip if not visible (optional, but good practice)
      // if (!behaviour.visible) continue;
      
      // Check if behaviour can be equipped
      if (!behaviour.canEquip(item.nid)) continue;
      
      // Check if already equipped
      const equipped = this.getItemBehaviours(item.nid, item);
      if (equipped.includes(behaviour.id)) {
        console.log(`✅ Behaviour ${behaviour.id} already equipped on ${item.nid}`);
        continue;
      }
      
      // Auto-equip this behaviour
      console.log(`🔧 Auto-equipping behaviour ${behaviour.id} on ${item.nid}`);
      this.addBehaviourToItem(item, behaviour.id);
    }
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
  // #endregion

// ============================================================
// #region UI Components
// ============================================================
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
      return this.app.widgetsHub.createBaseButton(options);
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
        this.app.widgetsHub.onItemButtonClicked(event.target);
      },
    };

    // Allow equipped behaviours to decorate the button (e.g. badges)
    this.getItemBehaviours(id, item).forEach((behaviourId) => {
      const behaviour = this.behaviours.get(behaviourId);
      if (behaviour?.decorateItemBtn) {
        btnOptions = behaviour.decorateItemBtn(btnOptions, id);
      }
    });

    // Allow widget-specific button customization last
    if (this.options.itemBtn) {
      console.log(
        "Customizing item button via widget options for item:",
        id,
        item
      );
      btnOptions = this.options.itemBtn(id, item, btnOptions);
    }

    return this.app.widgetsHub.createItemButton(btnOptions);
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
      return this.app.widgetsHub.createBaseButton(options);
    }
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
   * Get inspector blocks for an item
   */
  getInspectorBlocks(item) {
    let blocks = [];

    if (this.options.inspectorBlocks) {
      blocks = blocks.concat(this.options.inspectorBlocks(item));
    }

    return blocks;
  }

  /**
   * Get the "Add Behaviour" dropdown for the inspector
   * Returns null if no behaviours are available to add
   */
  getAddBehaviourButton(item) {
    if (!item) return null;

    const items = this.getAvailableBehaviours(item).map((b) => ({
      text: b.name,
      onClick: () => this.addBehaviourToItem(item, b.id),
    }));

    if (items.length === 0) return null;

    return this.app.uikit.createDropdownButton({
      text: " Add Behaviour",
      variant: "success",
      items,
    });
  }

  /**
   * Method to be overridden by widgets that need to handle component features
   */
  getComponents() {
    return this.options.components || {};
  }
  // #endregion

// ============================================================
// #region Actions
// ============================================================
  /**
   * Get actions for this widget (the catalog shown when assigning an action
   * to a semantic node). Includes ALL behaviours supporting action mode,
   * not just equipped ones. Subclasses extend it with widget-native actions.
   * @returns {Array} Array of action objects
   */
  getActions() {
    return this.getActionModeBehaviours();
  }
  // #endregion

// ============================================================
// #region 3D & Gizmo
// ============================================================
  /**
   * Setup the gizmo for an item
   */
  setupGizmo(id) {
    if (this.options.setupGizmo) {
      this.options.setupGizmo(id);
    }
  }

  // #endregion
}
