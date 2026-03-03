/**
 * Modern implementation of the Widget Hub using a registry pattern
 */
export class ModernWidgetHub {
  constructor(app) {
    this.app = app;
    this.widgets = new Map();
    this.parsers = this.initParsers();
  }

  /**
   * Initialize the widget hub
   */
  async init() {
    // Initialize all registered widgets
    for (const widget of this.widgets.values()) {
      await widget.init();
    }
  }

  /**
   * Clear all registered widgets
   */
  clearWidgets() {
    this.widgets.clear();
  }

  /**
   * Register a widget with the hub
   */
  registerWidget(widget) {
    if (!widget.id) {
      throw new Error("Widget must have an ID");
    }

    if (this.widgets.has(widget.id)) {
      throw new Error(`Widget with ID ${widget.id} is already registered`);
    }

    this.widgets.set(widget.id, widget);
    console.log(`Registered widget: ${widget.id}`);
    return widget;
  }

  /**
   * Get a widget by ID
   */
  getWidget(id) {
    return this.widgets.get(id);
  }

  /**
   * Get all registered widgets
   */
  getAllWidgets() {
    return Array.from(this.widgets.values());
  }

  /**
   * Focus on a specific item in a widget
   */
  focusOnItem({ id, wid }) {
    const widget = this.getWidget(wid);
    if (!widget) {
      throw new Error(`Widget ${wid} not found`);
    }

    // If switching from a different widget, let the previous widget cleanup
    if (
      this.app.editor.activeNode &&
      this.app.editor.activeWidget &&
      this.app.editor.activeWidget.id !== wid
    ) {
      const previousWidget = this.app.editor.activeWidget;
      if (previousWidget.onLoseFocus) {
        previousWidget.onLoseFocus(this.app.editor.activeNode);
      }
    }

    // Handle 3D item activation FIRST if necessary
    // (some widgets like measurements need this to create the node wrapper)
    if (widget.activeItem) {
      widget.activeItem(id);
    }

    // Get the item (now it should exist)
    const item = widget.getItem(id);
    if (!item) {
      console.error("Item not found");
      return;
    }

    // Set as currently active
    this.app.editor.activeNode = item;
    this.app.editor.activeWidget = widget;

    // Check for auto-equip behaviours
    if (widget.checkAutoEquipBehaviours) {
      widget.checkAutoEquipBehaviours(item);
    }

    // Set focus (zoom)
    if (widget.focusItem) {
      widget.focusItem(item);
    }

    // Setup Gizmo Handler
    if (widget.setupGizmo) {
      widget.setupGizmo(id);
    }

    // Setup Inspector
    this.setupInspector(widget, item, id);
  }

  /**
   * Setup the inspector for an item
   */
  setupInspector(widget, item, id) {
    const inspectorOptions = {
      title: widget.getInspectorHeader?.(id),
    };

    const blocks = [];

    // Get both base and item-specific properties
    const baseProps = widget.getProperties(); // Get base widget properties
    const itemProps = item ? widget.getProperties(item) : {}; // Get item-specific properties
    const allProps = { ...baseProps, ...itemProps }; // Merge with item properties taking precedence

    console.log("Widget Inspector Setup - Widget:", widget.id);
    console.log("Base properties:", baseProps);
    console.log("Item-specific properties:", itemProps);
    console.log("Item being inspected:", item);

    if (allProps) {
      for (const [propId, prop] of Object.entries(allProps)) {
        console.log(`Processing property ${propId}:`, prop);
        if (prop.inspectorBlock) {
          const block = prop.inspectorBlock(item);
          console.log(`Inspector block for ${propId}:`, block);
          if (block) blocks.push(block);
        }
      }
    }

    // Add capability button before components if there are available capabilities
    if (item && widget.getAddCapabilityButton) {
      const capabilityButton = widget.getAddCapabilityButton(item);
      if (capabilityButton) {
        blocks.push(this.app.uikit.inspectorSeparator());
        blocks.push(capabilityButton);
      }
    }

    // Add separator before components
    blocks.push(this.app.uikit.inspectorSeparator());

    // Add component blocks
    const components = widget.getComponents();
    if (components) {
      for (const [cId, component] of Object.entries(components)) {
        if (component.inspectorBlock) {
          blocks.push(component.inspectorBlock(item));
        }
      }
    }

    inspectorOptions.blocks = blocks;
    this.app.ui.editor_createInspector(inspectorOptions);
  }

  /**
   * Initialize parsers used by widgets
   */
  initParsers() {
    return {
      vector3: (o) => {
        const base_onVector3Change = (evt) => {
          const property = evt.target.dataset.property;
          const dimension = evt.target.name;
          const value = parseFloat(evt.target.value.replaceAll(",", "."));

          if (o.target) {
            o.target[property][dimension] = value;
          }
        };

        const handler = (evt) => {
          if (!Object.hasOwn(o, "overrideBase")) {
            base_onVector3Change(evt);
          }
          if (o.onChange) {
            o.onChange(evt);
          }
        };

        return this.app.UI.vector3({
          id: o.id,
          property: o.property,
          title: o.title,
          v: o.v,
          onChange: handler,
        });
      },

      float: (o) => {
        const evt = o.onChange ? { change: o.onChange } : null;

        return this.app.UI.input({
          id: o.id,
          attr: { "data-property": o.property },
          name: o.name,
          type: "number",
          value: o.v,
          labelText: o.title,
          events: evt,
        });
      },

      checkbox: (o) => {
        const evt = o.onChange ? { change: o.onChange } : null;

        return this.app.UI.input({
          type: "checkbox",
          id: o.id,
          labelText: o.title,
          name: o.name,
          checked: o.checked,
          events: evt,
        });
      },
    };
  }

  /**
   * Create a base button for widgets
   */
  createBaseButton(options) {
    console.log("Creating base button with options:", options);
    const button = this.app.uikit.createButton(options);
    if (options.variant === "primary") {
      button.classList.add("btn-primary");
    }
    return button;
  }

  // Compatibility shims for old hub API names used by existing widgets
  mainBtn_base(options) {
    return this.createBaseButton(options);
  }

  itemBtn_base(options) {
    return this.createItemButton(options);
  }

  createBtn_base(options) {
    return this.createBaseButton(options);
  }

  /**
   * Create an item button
   */
  createItemButton(options) {
    return this.createBaseButton(options);
  }

  /**
   * Find the closest button element from a given element
   * This ensures we always get the button no matter which child element was clicked
   */
  findButtonElement(element) {
    // If we get null/undefined, return null
    if (!element) return null;

    // If this is already the button we want, return it
    if (
      element.tagName === "BUTTON" &&
      element.dataset &&
      (element.dataset.id || element.dataset.wid)
    ) {
      return element;
    }

    // Otherwise, look for the closest parent button
    return element.closest("button[data-id][data-wid]");
  }

  /**
   * Handle item button click
   */
  onItemButtonClicked(target) {
    // Always find the actual button element
    const button = this.findButtonElement(target);

    if (!button) {
      console.warn("Could not find button element from click target:", target);
      return;
    }

    const id = button.dataset.id;
    const wid = button.dataset.wid;

    if (!id || !wid) {
      console.warn(
        "Button found but missing required data attributes:",
        button
      );
      return;
    }

    this.focusOnItem({ id, wid });
    this.app.ui.setStyleOfActiveBtn(button);
  }

  // Backwards-compatibility alias used by old widgets
  onClicked_itemBtn_base(button) {
    return this.onItemButtonClicked(button);
  }

  // Backwards-compatibility alias for focus
  focusOnItem_base(o) {
    return this.focusOnItem(o);
  }

  /**
   * Get current scene
   */
  getCurrentScene() {
    return this.app.db.data.currScene;
  }

  /**
   * Assign an action to a semantic node
   * Shows scrollable list of actions grouped by widget
   * Stores result in semanticgraph.nodes[nid].events.onSelect
   */
  assignActionToNode(node, widget) {
    // Get template filtering if available
    const template = this.app.editor.activeTemplate;
    const allowedActions = template?.allowedActions || {};

    // Collect all available actions from all widgets
    const actionsByWidget = {};

    // Iterate through all registered widgets
    for (const [widgetId, w] of this.widgets.entries()) {
      const actions = w.getActions();
      if (!actions || actions.length === 0) continue;

      // Apply template filtering if configured
      let filteredActions = actions;
      if (allowedActions[widgetId]) {
        filteredActions = actions.filter((action) =>
          allowedActions[widgetId].includes(action.id)
        );
      }

      if (filteredActions.length > 0) {
        actionsByWidget[widgetId] = filteredActions;
      }
    }

    if (Object.keys(actionsByWidget).length === 0) {
      window.alert("No actions available");
      return;
    }

    // Create action list grouped by widget
    const bodyContent = document.createElement("div");
    
    // Add instruction text
    const instruction = document.createElement("p");
    instruction.classList.add("text-muted", "mb-3");
    instruction.textContent = "Select the action to assign to this semantic node:";
    bodyContent.appendChild(instruction);
    
    // Create list group
    const listGroup = document.createElement("div");
    listGroup.classList.add("list-group");
    bodyContent.appendChild(listGroup);

    for (const [widgetId, actions] of Object.entries(actionsByWidget)) {
      const widgetObj = this.getWidget(widgetId);
      const widgetName = widgetObj?.options?.mainBtnOptions?.text || widgetId;

      // Add widget header
      const header = document.createElement("div");
      header.classList.add("list-group-item", "list-group-item-secondary", "fw-bold");
      header.textContent = widgetName;
      listGroup.appendChild(header);

      // Add action items for this widget
      actions.forEach((action) => {
        const actionItem = document.createElement("button");
        actionItem.type = "button";
        actionItem.classList.add("list-group-item", "list-group-item-action");
        actionItem.textContent = action.name;
        
        actionItem.addEventListener("click", () => {
          this.saveActionAssignment(node, widget, action);
        });
        
        listGroup.appendChild(actionItem);
      });
    }

    // Show modal with action list
    ATON.UI.showModal({
      header: "Assign Action",
      body: bodyContent,
      size: "md",
    });
  }

  /**
   * Save action assignment to semantic node
   * Adds action to the actions array with unique ID
   */
  saveActionAssignment(node, widget, action) {
    const scene = this.getCurrentScene();
    const nid = node.nid;

    // Initialize structure if needed
    if (!scene.semanticgraph) scene.semanticgraph = { nodes: {}, edges: {} };
    if (!scene.semanticgraph.nodes[nid]) scene.semanticgraph.nodes[nid] = {};
    if (!scene.semanticgraph.nodes[nid].events)
      scene.semanticgraph.nodes[nid].events = {};

    // Get existing actions or initialize as empty dictionary
    let actions = scene.semanticgraph.nodes[nid].events.onSelect;
    if (!actions) {
      actions = {};
    }
    // Actions must be a dictionary object
    if (typeof actions !== 'object' || Array.isArray(actions)) {
      console.error("events.onSelect must be an object dictionary");
      actions = {};
    }

    // Generate unique action ID
    const uniqueActionId = ATON.Utils.generateID(action.id);

    // Add new action to dictionary with actionId as key
    actions[uniqueActionId] = {
      actionType: action.id, // Original action type (e.g., "toggleVisible")
      widgetId: action.widgetId,
      args: {}, // Will be populated by action-specific UI
    };

    // Store actions dictionary
    scene.semanticgraph.nodes[nid].events.onSelect = actions;

    // Compose patch
    const patch = {
      semanticgraph: {
        nodes: {
          [nid]: {
            events: scene.semanticgraph.nodes[nid].events,
          },
        },
        edges: ATON.SceneHub.getJSONgraphEdges(ATON.NTYPES.SEM),
      },
    };

    widget.editor.patch = patch;
    widget.editor.modePatch = ATON.SceneHub.MODE_ADD;
    widget.editor.OnPatchChanged();

    console.log(`✅ Added action ${action.id} (ID: ${uniqueActionId}) to semantic node ${nid}`);

    // Close modal
    ATON.UI.hideModal();

    // Update UI to show badge and refresh hierarchy
    this.app.ui.editor_updateHierarchy();
    this.app.ui.editor_updateWidgetMainPanel();

    // Refocus to update inspector
    this.focusOnItem({ id: nid, wid: widget.id });
  }

  /**
   * Remove action from semantic node
   * Removes specific action from the actions array by actionId
   * Calls action's onDelete method if provided to clean up action-specific data
   */
  removeActionFromNode(node, widget, actionId = null) {
    const scene = this.getCurrentScene();
    const nid = node.nid;

    let actions = scene.semanticgraph?.nodes?.[nid]?.events?.onSelect;
    if (!actions) return;

    // Actions must be a dictionary
    if (typeof actions !== 'object' || Array.isArray(actions)) {
      console.error("events.onSelect must be an object dictionary");
      return;
    }
    
    // If no specific actionId, remove all actions
    if (actionId === null) {
      // Call onDelete for all actions
      Object.entries(actions).forEach(([aid, actionAssignment]) => {
        const actionWidget = this.getWidget(actionAssignment.widgetId);
        if (actionWidget) {
          const widgetActions = actionWidget.getActions();
          const action = widgetActions.find((a) => a.id === actionAssignment.actionType);
          
          if (action && action.onDelete) {
            console.log(`🧹 Calling onDelete for action ${action.id}`);
            action.onDelete({ node, widget, scene });
          }
        }
      });

      // Remove all actions
      delete scene.semanticgraph.nodes[nid].events.onSelect;
      
      // Send delete patch
      const deletePatch = {
        semanticgraph: {
          nodes: {
            [nid]: {
              events: {
                onSelect: {},
              },
            },
          },
        },
      };

      widget.editor.patch = deletePatch;
      widget.editor.modePatch = ATON.SceneHub.MODE_DEL;
      widget.editor.OnPatchChanged();

      console.log(`🗑️ Removed all actions from semantic node ${nid}`);
    } else {
      // Remove specific action by actionId using dictionary key
      if (!actions[actionId]) {
        console.warn(`Action with ID ${actionId} not found`);
        return;
      }

      const actionAssignment = actions[actionId];
      
      // Call onDelete for this action
      const actionWidget = this.getWidget(actionAssignment.widgetId);
      if (actionWidget) {
        const widgetActions = actionWidget.getActions();
        const action = widgetActions.find((a) => a.id === actionAssignment.actionType);
        
        if (action && action.onDelete) {
          console.log(`🧹 Calling onDelete for action ${action.id}`);
          action.onDelete({ node, widget, scene });
        }
      }

      // Remove from dictionary locally
      delete actions[actionId];

      // Update local data
      if (Object.keys(actions).length === 0) {
        delete scene.semanticgraph.nodes[nid].events.onSelect;
      }

      // Send delete patch for specific action key
      const patch = {
        semanticgraph: {
          nodes: {
            [nid]: {
              events: {
                onSelect: {
                  [actionId]: {}
                }
              },
            }
          }
        },
      };

      widget.editor.patch = patch;
      widget.editor.modePatch = ATON.SceneHub.MODE_DEL;
      widget.editor.OnPatchChanged();

      console.log(`🗑️ Removed action ${actionId} from semantic node ${nid}`);
    }

    // Update UI to remove badge and refresh hierarchy
    this.app.ui.editor_updateHierarchy();
    this.app.ui.editor_updateWidgetMainPanel();

    // Refocus to update inspector
    this.focusOnItem({ id: nid, wid: widget.id });
  }

  /**
   * Clean up actions referencing a deleted item
   * Scans all semantic nodes and removes actions that reference the deleted item
   * @param {Object} options - Cleanup options
   * @param {string} options.deletedItemId - ID of the deleted item (layer, POV, etc.)
   * @param {string} options.widgetId - ID of the widget that owns the action
   * @param {string} options.actionType - Type of action to clean up
   */
  cleanupActionsForDeletedItem({ deletedItemId, widgetId, actionType }) {
    const widget = this.getWidget(widgetId);
    if (!widget) {
      console.warn(`Widget ${widgetId} not found`);
      return;
    }

    // Get action definition
    const actionDef = widget.getActions().find(a => a.id === actionType);
    if (!actionDef) {
      console.warn(`Action ${actionType} not found in widget ${widgetId}`);
      return;
    }

    // Check if action has cleanup handler
    if (!actionDef.onReferencedItemDeleted) {
      console.log(`Action ${actionType} has no onReferencedItemDeleted handler, skipping cleanup`);
      return;
    }

    const scene = this.getCurrentScene();
    if (!scene.semanticgraph?.nodes) return;

    const affectedNodes = [];
    let totalRemoved = 0;

    // Scan all semantic nodes and collect actions to delete
    const actionsToDelete = {}; // { nodeId: [actionId1, actionId2, ...] }

    for (const [nid, nodeData] of Object.entries(scene.semanticgraph.nodes)) {
      if (!nodeData.events?.onSelect) continue;
      
      const actions = nodeData.events.onSelect;
      if (typeof actions !== 'object' || Array.isArray(actions)) continue;

      // Check each action in the dictionary
      for (const [actionId, actionInstance] of Object.entries(actions)) {
        // Only check actions of matching type and widget
        if (actionInstance.actionType !== actionType || actionInstance.widgetId !== widgetId) {
          continue;
        }

        // Call the action's cleanup handler
        const result = actionDef.onReferencedItemDeleted(deletedItemId, actionInstance);
        
        if (result.shouldRemove) {
          console.log(`🗑️ Marking action ${actionId} for removal from semantic node ${nid}: ${result.reason}`);
          
          if (!actionsToDelete[nid]) actionsToDelete[nid] = [];
          actionsToDelete[nid].push(actionId);
          
          totalRemoved++;
        }
      }
    }

    // If any actions need to be deleted, send delete patches
    if (Object.keys(actionsToDelete).length > 0) {
      console.log(`✅ Cleaning up ${totalRemoved} action(s) from ${Object.keys(actionsToDelete).length} semantic node(s)`);
      
      // Compose delete patch for all affected action keys
      const patchNodes = {};
      
      for (const [nid, actionIds] of Object.entries(actionsToDelete)) {
        const nodeData = scene.semanticgraph.nodes[nid];
        const onSelectPatch = {};
        
        // Create delete patch for each action
        actionIds.forEach(actionId => {
          onSelectPatch[actionId] = {};
          // Also delete from local data
          delete nodeData.events.onSelect[actionId];
        });
        
        patchNodes[nid] = {
          events: {
            onSelect: onSelectPatch
          }
        };
        
        // Clean up empty events locally
        if (Object.keys(nodeData.events.onSelect).length === 0) {
          delete nodeData.events.onSelect;
        }
      }

      const patch = {
        semanticgraph: {
          nodes: patchNodes
          // NO edges - we're just deleting specific action keys
        }
      };

      // Send as DEL mode - this will delete the specific action keys
      widget.editor.patch = patch;
      widget.editor.modePatch = ATON.SceneHub.MODE_DEL;
      widget.editor.OnPatchChanged();

      // Update UI
      this.app.ui.editor_updateHierarchy();
    } else {
      console.log(`No actions referencing ${deletedItemId} found`);
    }
  }

  /**
   * Clean up behaviours data for a deleted item
   * Calls onItemDeleted lifecycle hook for all behaviours
   * @param {Object} options - Cleanup options
   * @param {string} options.deletedItemId - ID of the deleted item
   * @param {string} options.widgetId - ID of the widget that owns the item
   */
  cleanupBehavioursForDeletedItem({ deletedItemId, widgetId }) {
    const widget = this.getWidget(widgetId);
    if (!widget) {
      console.warn(`Widget ${widgetId} not found`);
      return;
    }

    const scene = this.getCurrentScene();
    if (!scene.behaviours) return;

    const behavioursToClean = {};
    let totalRemoved = 0;

    // Check each behaviour if it has data for this item
    for (const [behaviourId, behaviour] of widget.behaviours.entries()) {
      if (!scene.behaviours[behaviourId]) continue;
      if (!scene.behaviours[behaviourId][deletedItemId]) continue;

      // Call lifecycle hook
      if (behaviour.onItemDeleted) {
        behaviour.onItemDeleted(deletedItemId);
      }

      // Mark for cleanup
      if (!behavioursToClean[behaviourId]) {
        behavioursToClean[behaviourId] = {};
      }
      behavioursToClean[behaviourId][deletedItemId] = {};
      totalRemoved++;

      console.log(`🧹 Cleaning up behaviour ${behaviourId} data for item: ${deletedItemId}`);
    }

    // Send delete patch for all affected behaviours
    if (Object.keys(behavioursToClean).length > 0) {
      const patch = {
        behaviours: behavioursToClean
      };

      widget.editor.patch = patch;
      widget.editor.modePatch = ATON.SceneHub.MODE_DEL;
      widget.editor.OnPatchChanged();

      console.log(`✅ Cleaned up ${totalRemoved} behaviour data entry(ies) for item: ${deletedItemId}`);
    } else {
      console.log(`No behaviour data found for deleted item: ${deletedItemId}`);
    }
  }

  /**
   * Clean up capabilities data for a deleted item
   * Scans all capabilities and removes data for the deleted item
   * @param {Object} options - Cleanup options
   * @param {string} options.deletedItemId - ID of the deleted item
   * @param {string} options.widgetId - ID of the widget that owns the item
   */
  cleanupCapabilitiesForDeletedItem({ deletedItemId, widgetId }) {
    const widget = this.getWidget(widgetId);
    if (!widget) {
      console.warn(`Widget ${widgetId} not found`);
      return;
    }

    const scene = this.getCurrentScene();
    if (!scene.capabilities) return;

    const capabilitiesToClean = {};
    let totalRemoved = 0;

    // Get all capabilities registered to this widget
    const capabilities = widget.getCapabilities ? widget.getCapabilities() : {};

    // Check each capability if it needs cleanup
    for (const [capId, capability] of Object.entries(capabilities)) {
      if (!capability.onItemDeleted) continue;

      const result = capability.onItemDeleted(deletedItemId, scene);
      
      if (result.shouldRemove) {
        console.log(`🗑️ Removing capability "${capability.id}" data for deleted item: ${deletedItemId} - ${result.reason}`);
        
        // Mark for deletion
        if (!capabilitiesToClean[capability.id]) {
          capabilitiesToClean[capability.id] = {};
        }
        capabilitiesToClean[capability.id][deletedItemId] = {};
        
        // Remove from local scene data
        if (scene.capabilities[capability.id]) {
          delete scene.capabilities[capability.id][deletedItemId];
        }
        
        totalRemoved++;
      }
    }

    // Send delete patch for all affected capabilities
    if (Object.keys(capabilitiesToClean).length > 0) {
      const patch = {
        capabilities: capabilitiesToClean
      };

      widget.editor.patch = patch;
      widget.editor.modePatch = ATON.SceneHub.MODE_DEL;
      widget.editor.OnPatchChanged();

      console.log(`✅ Cleaned up ${totalRemoved} capability data entry(ies) for item: ${deletedItemId}`);
    } else {
      console.log(`No capability data found for deleted item: ${deletedItemId}`);
    }
  }
}
