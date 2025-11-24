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

    // Get existing actions or initialize as empty array
    let actions = scene.semanticgraph.nodes[nid].events.onSelect;
    if (!actions) {
      actions = [];
    }
    // Actions must be an array
    if (!Array.isArray(actions)) {
      console.error("events.onSelect must be an array");
      actions = [];
    }

    // Generate unique action ID
    const uniqueActionId = ATON.Utils.generateID(action.id);

    // Add new action to array with unique ID
    actions.push({
      actionId: uniqueActionId,
      actionType: action.id, // Original action type (e.g., "toggleVisible")
      widgetId: action.widgetId,
      args: {}, // Will be populated by action-specific UI
    });

    // Store actions array
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
   * Removes specific action from the actions array by index
   * Calls action's onDelete method if provided to clean up action-specific data
   */
  removeActionFromNode(node, widget, actionIndex = null) {
    const scene = this.getCurrentScene();
    const nid = node.nid;

    let actionsData = scene.semanticgraph?.nodes?.[nid]?.events?.onSelect;
    if (!actionsData) return;

    // Convert to array if needed
    let actions = Array.isArray(actionsData) ? actionsData : [actionsData];
    
    // If no specific index, remove all actions
    if (actionIndex === null) {
      // Call onDelete for all actions
      actions.forEach(actionAssignment => {
        const actionWidget = this.getWidget(actionAssignment.widgetId);
        if (actionWidget) {
          const widgetActions = actionWidget.getActions();
          const action = widgetActions.find((a) => a.id === actionAssignment.actionId);
          
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
      // Remove specific action by index
      if (actionIndex < 0 || actionIndex >= actions.length) {
        console.warn(`Invalid action index: ${actionIndex}`);
        return;
      }

      const actionAssignment = actions[actionIndex];
      
      // Call onDelete for this action
      const actionWidget = this.getWidget(actionAssignment.widgetId);
      if (actionWidget) {
        const widgetActions = actionWidget.getActions();
        const action = widgetActions.find((a) => a.id === actionAssignment.actionId);
        
        if (action && action.onDelete) {
          console.log(`🧹 Calling onDelete for action ${action.id}`);
          action.onDelete({ node, widget, scene });
        }
      }

      // Remove from array
      actions.splice(actionIndex, 1);

      // Update or delete based on remaining actions
      if (actions.length === 0) {
        delete scene.semanticgraph.nodes[nid].events.onSelect;
      } else {
        scene.semanticgraph.nodes[nid].events.onSelect = actions;
      }

      // Send patch
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
      widget.editor.modePatch = actions.length === 0 ? ATON.SceneHub.MODE_DEL : ATON.SceneHub.MODE_ADD;
      widget.editor.OnPatchChanged();

      console.log(`🗑️ Removed action ${actionAssignment.actionId} from semantic node ${nid}`);
    }

    // Update UI to remove badge and refresh hierarchy
    this.app.ui.editor_updateHierarchy();
    this.app.ui.editor_updateWidgetMainPanel();

    // Refocus to update inspector
    this.focusOnItem({ id: nid, wid: widget.id });
  }
}
