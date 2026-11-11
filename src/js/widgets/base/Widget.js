import { deepMerge } from "../../components/Component.js";

/**
 * Base Widget class that defines the common interface and functionality for all widgets.
 *
 * A widget is the authoring side of a component type (options.component):
 * list, creation, inspector, gizmo, editor-only helpers and persistence.
 * Every change to an item goes through update(id, changes, {source}).
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
    this.components = new Map(); // id -> Component (only if options.component)
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
        if (this.options.component) this.addComponent(id, item);
        this.addItemToScene(id, item);
      }
    }
  }
  /**
   * Inspector properties of the widget, plus the direct-mode UI of the
   * behaviours shown on this item: the equipped ones and the autoEquip ones
   * the item is compatible with (their data is written on the first real change).
   * @param {Object} item - The item to get properties for. If null, returns base widget properties.
   * @returns {Object} Combined properties from widget and behaviours
   */
  getProperties(item = null) {
    let props = { ...this.options.props };
    if (!item) return props;

    for (const behaviour of this.getShownBehaviours(item)) {
      if (behaviour.supportsMode('direct') && behaviour.getProperties) {
        props = { ...props, ...behaviour.getProperties(item.nid, this) };
      }
    }
    return props;
  }

  /**
   * Behaviours whose direct-mode UI appears on the item
   */
  getShownBehaviours(item) {
    const equipped = this.getItemBehaviours(item.nid, item);
    const shown = [];
    for (const [id, behaviour] of this.behaviours.entries()) {
      if (equipped.includes(id)) shown.push(behaviour);
      else if (behaviour.autoEquip && behaviour.supportsMode('direct') && behaviour.canEquip(item.nid)) shown.push(behaviour);
    }
    return shown;
  }
  // #endregion

// ============================================================
// #region Components & update
// ============================================================
  /** Create the component of an item from its scene data and mount it */
  addComponent(id, data) {
    const component = new this.options.component(id, data).mount();
    this.components.set(id, component);
    return component;
  }

  getComponent(id) {
    return this.components.get(id);
  }

  /** Dispose the component of an item (removes its runtime object) */
  removeComponent(id) {
    this.components.get(id)?.dispose();
    this.components.delete(id);
  }

  /**
   * The ONE way to change an item: inspector, gizmo, behaviours and future
   * APIs all call it. Applies the changes to the component, refreshes the
   * editor (onItemUpdated) and saves the item.
   * @param {string} id
   * @param {Object} changes - partial component data
   * @param {Object} [opts]
   * @param {string} [opts.source] - "inspector" | "gizmo" | … (the inspector does not
   *                                 refresh the field the user is typing in)
   */
  update(id, changes = {}, { source } = {}) {
    const component = this.getComponent(id);
    if (!component) {
      console.warn(`⚠️ ${this.id}: no component for ${id}`);
      return;
    }
    component.apply(changes);
    this.onItemUpdated(id, component, source);
    this.saveItem(id);
  }

  /**
   * Hook: refresh editor-only things (helpers, inspector fields) after update()
   */
  onItemUpdated(id, component, source) {}

  /**
   * Where the item lives in the scene JSON (default: scene[widgetId][id])
   * @returns {string[]}
   */
  getItemPath(id) {
    return this.options.itemPath ? this.options.itemPath(id) : [this.id, id];
  }

  /**
   * Write the component's serialized data into the local scene and send it as an ADD patch
   */
  saveItem(id) {
    const data = this.getComponent(id).serialize();
    const path = this.getItemPath(id);

    let local = this.getCurrentScene();
    for (const key of path) {
      if (!local[key] || typeof local[key] !== "object") local[key] = {};
      local = local[key];
    }
    deepMerge(local, data);

    const patch = {};
    let cursor = patch;
    path.forEach((key, i) => {
      cursor[key] = i === path.length - 1 ? data : {};
      cursor = cursor[key];
    });

    const extras = this.getPatchExtras(id);
    if (extras) {
      deepMerge(this.getCurrentScene(), extras);
      deepMerge(patch, extras);
    }
    this.composePatch(patch, ATON.SceneHub.MODE_ADD);
  }

  /**
   * Hook: extra data saved together with an item (e.g. semantic graph edges)
   * @returns {Object|null} merged into the local scene and the patch
   */
  getPatchExtras(id) {
    return null;
  }

  /** Fill a vector3 inspector field (built with hub parsers.vector3) from [x,y,z] */
  setVectorField(fieldId, v) {
    if (!v || !document.getElementById(fieldId)) return;
    this.app.ui.updateVector3UI(fieldId, { x: v[0], y: v[1], z: v[2] });
  }

  /** Read a [x,y,z] value edited in a vector3 field: `current` with one axis replaced */
  vectorFromInput(evt, current) {
    const value = parseFloat(String(evt.target.value).replaceAll(",", "."));
    if (Number.isNaN(value)) return null;
    const v = [...(current || [0, 0, 0])];
    v["xyz".indexOf(evt.target.name)] = value;
    return v;
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

  /* Frame a specific item with the camera (hub.focusOnItem, unless {frame:false}) */
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
   * Delete an item (widgets with options.deletable implement it)
   */
  deleteItem(id) {
    console.warn(`⚠️ ${this.id}: deleteItem not implemented`);
  }
  // #endregion

// ============================================================
// #region Editor helpers & click selection
// ============================================================
  /**
   * Create an editor-only 3D helper (icon, handles) for an item.
   * It is an ATON UI node, not a scene node: outside the scene raycast
   * (no pointer snapping, double-tap, bounds, light probes, shadows),
   * excluded from ATON's UI picking too, and tagged so a click selects the item.
   * @param {string} id - item id (also the UI node id)
   * @param {THREE.Object3D} [content]
   */
  createHelperNode(id, content) {
    const node = ATON.createUINode(id);
    node.userData.editorItem = { wid: this.id, id };
    if (content) node.add(content);
    node.attachToRoot();
    node.disablePicking();
    return node;
  }

  getHelperNode(id) {
    return ATON.getUINode(id);
  }

  /**
   * 3D objects that select an item when clicked (helpers are found by their tag)
   * @returns {{object: THREE.Object3D, id: string}[]}
   */
  getPickables() {
    const list = [];
    for (const [id, component] of this.components) {
      for (const object of component.getObjects()) list.push({ object, id });
    }
    return list;
  }

  /** True while the widget uses scene clicks itself (e.g. placing points): no click selection */
  isBusy() {
    return false;
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

    return itemBehaviours;
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
      // (autoEquip ones are already shown on compatible items)
      if (behaviour.isVisible && !behaviour.autoEquip && !itemBehaviours.includes(behaviourId)) {
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
      // opens the widget panel: sidebar row with chevron
      return this.app.uikit.asSideItem(this.app.widgetsHub.createBaseButton(options), "nav");
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
      icon: this.options.itemBtnOptions?.icon,
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
      return this.app.uikit.asSideItem(this.app.widgetsHub.createBaseButton(options), "add");
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
   * "Remove" button at the bottom of the inspector (options.deletable)
   */
  getDeleteBlock(item) {
    if (!this.options.deletable || !item) return null;
    return this.app.uikit.deleteButton({
      icon: "trash",
      text: "Remove",
      onClick: () => this.deleteItem(item.nid),
    });
  }
  // #endregion

// ============================================================
// #region Actions
// ============================================================
  /**
   * Actions this widget offers to semantic nodes ("Add Action" catalog):
   * the actions of its component type (Component.actions) completed with the
   * widget's authoring parts, plus ALL behaviours supporting action mode.
   * @returns {Array} [{id, name, widgetId, getProperties, onDelete, onReferencedItemDeleted}]
   */
  getActions() {
    const componentActions = Object.entries(this.options.component?.actions || {}).map(
      ([id, meta]) => ({ id, name: meta.name, widgetId: this.id, ...this.getActionAuthoring(id) })
    );
    return componentActions.concat(this.getActionModeBehaviours());
  }

  /**
   * Hook: authoring parts of a component action — getProperties(context) for its
   * inspector card, onReferencedItemDeleted(deletedId, actionInstance) for cleanup
   * @returns {Object}
   */
  getActionAuthoring(actionId) {
    return {};
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
