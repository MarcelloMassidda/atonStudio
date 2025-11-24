import { Widget } from "./base/Widget.js";

/**
 * Widget for managing 3D model layers in the scene
 */
export class LayerWidget extends Widget {
constructor(app) {
    const options = {
      id: "layers",
      hierarchy: true,
      mainBtnOptions: {
        id: "layers_mainBtn",
        text: "Models",
        icon: "collection-item",
      },
      mainPanelOptions: {
        title: "Models",
      },
      createBtnOptions: {
        text: "Add new model",
        icon: "add",
      },
      // Define how to get items from the scene
      items: () => {
        const scene = this.getCurrentScene();
        if (!scene.scenegraph) return null;
        if (!scene.scenegraph.nodes) return null;
        return scene.scenegraph.nodes;
      },
      // item button renderer (backwards-compatible)
      old_itemBtn: (id, item) => {
        const objNum = item.urls ? item.urls.length : 0;
        let _itemName = id;
        // Badge handling moved to ScreenOverrideCapability.decorateItemBtn
        console.log("CREATING from LAYER WIDGET ITEM BTN for item:", id, item);
        return app.widgetsHub.mainBtn_base({
          text: _itemName,
          attr: { "data-id": id, "data-wid": "layers" },
          onClick: function () {
            app.widgetsHub.onClicked_itemBtn_base(this);
          },
        });
      },
      // Define how to get a specific item
      returnItem: (nid) => ATON.getSceneNode(nid),
      props: {
        position: {
          inspectorBlock: (node) => this.createPositionInspector(node),
          get: () => this.getActiveNodeProperty("position"),
        },
        rotation: {
          inspectorBlock: (node) => this.createRotationInspector(node),
          get: () => this.getActiveNodeProperty("rotation"),
        },
        scale: {
          inspectorBlock: (node) => this.createScaleInspector(node),
          get: () => this.getActiveNodeProperty("scale"),
        },
      },
      components: {
        delete: {
          inspectorBlock: (node) => this.createDeleteButton(node),
        },
      },
    };

    super(app, options);
    this.gizmoManager = app.gizmoManager;

    // bind create button handler after super (can't use `this` before super)
    if (this.options && this.options.createBtnOptions) {
      this.options.createBtnOptions.onClick = () => this.createBtnClicked();
    }
  }

  // No texturizable features in base LayerWidget

  /**
   * Open collection-based model selector and create a new layer when selected
   * Uses ATON DB API to get models from user's collection
   */
  createBtnClicked() {
    console.log("Create new Layer");

    const onModelItemClicked = async (e) => {
      const url = e.target.parentNode.dataset.path;

      // Prompt node Name
      const promptResponse = await this.app.UI.promptDialog({
        header: "Layer Name",
        inputs: [{ name: "newNodeName", labelText: "Node Name", type: "text" }],
      });

      if (!promptResponse) {
        ATON.UI.hideModal();
        console.log("NO PROMPT");
        return;
      }

      console.log(promptResponse);
      const nodeName = promptResponse.newNodeName;

      const updateEditorOnModelAdded = () => {
        // Focus on currentNode
        this.app.widgetsHub.focusOnItem({ id: nodeName, wid: this.id });

        // Update scenegraph
        const newSceneGraphNode = { urls: [url] };
        const scene = this.getCurrentScene();
        scene.scenegraph.nodes[nodeName] = newSceneGraphNode;

        // Update edges
        let _edges = scene.scenegraph.edges;
        if (!_edges) {
          _edges = { ".": [nodeName] };
        } else {
          _edges["."].push(nodeName);
        }
        scene.scenegraph.edges = _edges;

        // Compose patch for the addition
        this.composePatch({
          scenegraph: {
            nodes: {
              [nodeName]: newSceneGraphNode,
            },
            edges: _edges,
          },
        });

        this.app.ui.editor_updateHierarchy();
        this.app.ui.editor_updateWidgetMainPanel();
      };

      // Add in scene
      ATON.createSceneNode(nodeName)
        .setCloneOnLoadHit(true)
        .load(url, () => {
          ATON.getRootScene().assignLightProbesByProximity();
          ATON.updateLightProbes();
          updateEditorOnModelAdded();
        })
        .setPosition(0, 0, 0)
        .attachToRoot();
    };

    // Get models from ATON DB and create summary dialog
    this.app.db.getModels((models) => {
      this.models = models;
      // Create summary dialog with folder structure
      const summary = this.app.UI.summarize(
        this.app.UI.parseInFolders(models, onModelItemClicked)
      );
      summary.cssText += "text-align:left";
      ATON.UI.showModal({
        header: "Select a model",
        body: summary,
      });
    });
  }

  /**
   * Update editor state after adding a model
   */
  updateEditorOnModelAdded(nodeName, url, type) {
    // Update currentScene locally
    const scene = this.getCurrentScene();

    // Update scenegraph nodes
    const newSceneGraphNode = { urls: [url] };
    if (!scene.scenegraph) scene.scenegraph = { nodes: {}, edges: { ".": [] } };
    scene.scenegraph.nodes[nodeName] = newSceneGraphNode;

    // Update edges
    if (!scene.scenegraph.edges) {
      scene.scenegraph.edges = { ".": [nodeName] };
    } else {
      if (!Array.isArray(scene.scenegraph.edges["."]))
        scene.scenegraph.edges["."] = [];
      scene.scenegraph.edges["."].push(nodeName);
    }

    // If customizables, set default texture entry
    if (type === "customizables") {
      const getDefaultTexturePathByNodeId = (modelId) => {
        const customizables = this.app.config?.models?.customizables;
        if (!customizables) return null;
        const basePath = this.app.config.baseCustomizablesDefaultTexturesPath;
        const obj = customizables.find((item) => item.nodeId === modelId);
        return obj ? basePath + obj.textureDefaultPath : null;
      };

      scene.texturized = scene.texturized ? scene.texturized : {};
      scene.texturized[nodeName] = {
        imageScreenPath: getDefaultTexturePathByNodeId(nodeName),
      };
    }

    // Focus on the new node
    this.app.widgetsHub.focusOnItem({ id: nodeName, wid: this.id });

    // Compose patch for the addition
    this.composePatch({
      scenegraph: {
        nodes: {
          [nodeName]: newSceneGraphNode,
        },
        edges: scene.scenegraph.edges,
      },
    });

    // Update UI
    this.app.ui.editor_updateHierarchy();
    this.app.ui.editor_updateWidgetMainPanel();
  }

  /**
   * Create transform inspector blocks
   */
  createPositionInspector(node) {
    return this.createTransformInspector("position", node);
  }

  createRotationInspector(node) {
    return this.createTransformInspector("rotation", node);
  }

  createScaleInspector(node) {
    return this.createTransformInspector("scale", node);
  }

  createTransformInspector(property, node) {
    return this.app.widgetsHub.parsers.vector3({
      id: `layer_${property}_V3`,
      title: property.charAt(0).toUpperCase() + property.slice(1),
      property: property,
      v: node[property],
      target: node,
      onChange: (evt) => this.onTransformChange(evt),
    });
  }

  /**
   * Handle transform changes
   */
  onTransformChange(evt) {
    if (!evt.target) throw new Error("no evt.target to manage");
    const propName = evt.target.dataset.property;
    // Prefer new API (getProperties) but fall back to legacy props
    let propHandler = null;
    if (this.getProperties && typeof this.getProperties === "function") {
      const props = this.getProperties();
      propHandler = props ? props[propName] : null;
    }
    if (!propHandler && this.editor && this.editor.activeWidget) {
      const aw = this.editor.activeWidget;
      if (aw.getProperties && typeof aw.getProperties === "function") {
        const props = aw.getProperties();
        propHandler = props ? props[propName] : null;
      } else if (aw.props) {
        propHandler = aw.props[propName];
      }
    }
    if (!propHandler) throw new Error("no propHandler to manage");
    const value = propHandler.get();
    this.composePatchTransform(propName, value);
  }

  /**
   * Create delete button
   */
  createDeleteButton(node) {
    return this.app.uikit.deleteButton({
      icon: "trash",
      text: "Remove",
      onClick: () => this.deleteLayer(node.nid),
    });
  }

  /**
   * Delete a layer
   */
  deleteLayer(nid) {
    if (!this.editor.checkPendingPatch()) return;

    // Live changes
    this.gizmoManager.detachGizmo();
    this.editor.activeNode.delete();

    // Update local graph
    const nodes = this.getCurrentScene().scenegraph.nodes;
    if (nodes[nid]) delete nodes[nid];

    // Update UI
    this.app.ui.editor_updateHierarchy();
    this.app.ui.editor_updateWidgetMainPanel();
    this.editor.onCloseInspectorBtnClicked();

    // Send delete patch
    this.composePatch(
      {
        scenegraph: { nodes: { [nid]: {} } },
        texturized: { [nid]: {} },
      },
      ATON.SceneHub.MODE_DEL
    );
  }

  /**
   * Compose transform patch
   */
  composePatchTransform(propName, value) {
    const node = this.editor.activeNode;
    if (!node) throw new Error("no node");

    const transformProps = ["position", "rotation", "scale"];
    const nid = node.nid;

    let patch = {
      scenegraph: {
        nodes: {
          [nid]: {},
        },
      },
    };

    if (transformProps.includes(propName)) {
      patch.scenegraph.nodes[nid].transform = {
        [propName]: [value.x, value.y, value.z],
      };
    } else {
      patch.scenegraph.nodes[nid][propName] = value;
    }

    this.composePatch(patch);
  }

  /**
   * Compose and send patch
   */
  composePatch(patch, mode = ATON.SceneHub.MODE_ADD) {
    this.editor.patch = {
      ...this.editor.patch,
      ...patch,
    };
    this.editor.modePatch = mode;
    this.editor.OnPatchChanged();
  }

  /**
   * Get property of active node
   */
  getActiveNodeProperty(prop) {
    return this.editor.activeNode?.[prop];
  }

  /**
   * Get texture for node
   */
  getTextureForNode(nid) {
    return this.getCurrentScene().texturized?.[nid]?.imageScreenPath;
  }

  /**
   * Get actions for this widget
   * Provides widget-native actions like toggleVisible
   */
  getActions() {
    // Get base actions from capabilities
    const baseActions = super.getActions();

    // Add widget-specific actions
    const widgetActions = [
      {
        id: "toggleVisible",
        name: "Toggle Layer Visibility",
        widgetId: this.id,
        getProperties: (context) => {
          const { node, actionId, args } = context;
          return {
            visibility: {
              inspectorBlock: () => this.createLayerSelectionBlock(node, actionId, args),
            },
          };
        },
        execute: (context) => {
          // Runtime execution handled by hathor.js
          // Context: {item: {nid, wid}, args: {...}, app, widget}
        },
        onDelete: (context) => {
          // Clean up targetLayerId when action is removed
          const { node, widget, scene } = context;
          const nid = node.nid;

          console.log(`🧹 Cleaning up toggleVisible action for semantic node ${nid}`);

          // Remove targetLayerId from events
          if (scene.semanticgraph?.nodes?.[nid]?.events?.onSelect?.args?.targetLayerId) {
            delete scene.semanticgraph.nodes[nid].events.onSelect.args.targetLayerId;
          }
        },
      },
    ];

    return baseActions.concat(widgetActions);
  }

  /**
   * Create layer selection inspector block
   * Shows selected layer or "Select Layer" button
   */
  createLayerSelectionBlock(node, actionId, args) {
    const targetLayerId = args?.targetLayerId;

    const container = this.app.uikit.createContainer({
      classList: ["inspector_Block"],
      content: [],
    });

    // If layer is already selected, show it
    if (targetLayerId) {
      const layerInfo = this.app.uikit.createText({
        text: `Target Layer: ${targetLayerId}`,
        classList: ["text-info", "mb-2"],
      });
      container.appendChild(layerInfo);

      const changeBtn = this.app.uikit.createButton({
        text: "Change Layer",
        icon: "collection-item",
        onClick: () => this.openLayerSelectionModal(node, actionId),
      });
      container.appendChild(changeBtn);
    } else {
      // No layer selected yet
      const selectBtn = this.app.uikit.createButton({
        text: "Select Layer",
        icon: "collection-item",
        onClick: () => this.openLayerSelectionModal(node, actionId),
      });
      container.appendChild(selectBtn);
    }

    return container;
  }

  /**
   * Open modal to select a layer
   * Similar to action selection modal
   */
  openLayerSelectionModal(node, actionId) {
    const scene = this.getCurrentScene();
    const layers = scene.scenegraph?.nodes;

    if (!layers || Object.keys(layers).length === 0) {
      window.alert("No layers available in the scene");
      return;
    }

    // Create modal body
    const bodyContent = document.createElement("div");

    // Add instruction text
    const instruction = document.createElement("p");
    instruction.classList.add("text-muted", "mb-3");
    instruction.textContent = "Select the layer to toggle visibility:";
    bodyContent.appendChild(instruction);

    // Create list group
    const listGroup = document.createElement("div");
    listGroup.classList.add("list-group");
    bodyContent.appendChild(listGroup);

    // Add layers to list
    for (const [layerId, layerData] of Object.entries(layers)) {
      const layerItem = document.createElement("button");
      layerItem.type = "button";
      layerItem.classList.add("list-group-item", "list-group-item-action");
      layerItem.textContent = layerId;

      layerItem.addEventListener("click", () => {
        this.saveLayerSelection(node, actionId, layerId);
      });

      listGroup.appendChild(layerItem);
    }

    // Show modal
    ATON.UI.showModal({
      header: "Select Target Layer",
      body: bodyContent,
      size: "md",
    });
  }

  /**
   * Save layer selection to semantic node
   * Finds the specific action by actionId and updates its args
   */
  saveLayerSelection(node, actionId, targetLayerId) {
    const scene = this.getCurrentScene();
    const nid = node.nid;

    // Find the specific action in the array
    const actions = scene.semanticgraph.nodes[nid]?.events?.onSelect;
    if (!actions || !Array.isArray(actions)) {
      console.error("No actions found for node");
      return;
    }

    // Find the action with this actionId
    const action = actions.find(a => a.actionId === actionId);
    if (!action) {
      console.error(`Action ${actionId} not found`);
      return;
    }

    // Update args for this specific action
    if (!action.args) action.args = {};
    action.args.targetLayerId = targetLayerId;

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

    this.editor.patch = patch;
    this.editor.modePatch = ATON.SceneHub.MODE_ADD;
    this.editor.OnPatchChanged();

    console.log(`✅ Layer ${targetLayerId} assigned to action ${actionId} on semantic node ${nid}`);

    // Close modal
    ATON.UI.hideModal();

    // Update inspector to show selected layer
    this.app.widgetsHub.focusOnItem({ id: nid, wid: "annotations" });
  }

  /**
   * Setup gizmo with custom handler
   */
  setupGizmo(id) {
    const node = ATON.getSceneNode(id);
    this.editor.setGizmoByNode(node);
    this.app.ui.editor_setGizmoToolbox();
    this.editor.udpateGizmoOnMouseUpListener((evt) => this.handleGizmo(evt));
  }

  /**
   * Handle gizmo interactions
   */
  handleGizmo(evt) {
    const gizmoOptions = {
      translate: {
        propertyName: "position",
        idVector3UIContainer: "layer_position_V3",
        getProperty: (n) => n.position,
      },
      rotate: {
        propertyName: "rotation",
        idVector3UIContainer: "layer_rotation_V3",
        getProperty: (n) => n.rotation,
      },
      scale: {
        propertyName: "scale",
        idVector3UIContainer: "layer_scale_V3",
        getProperty: (n) => n.scale,
      },
    };

    // Update inspector
    const inspectorUpdater = this.editor.gizmoToInspectorMapper(gizmoOptions);
    inspectorUpdater(evt);

    // Compose patch
    const mode = this.gizmoManager.control.mode;
    const propName = gizmoOptions[mode].propertyName;
    if (!propName) throw new Error("no property name in gizmo handler");

    const activeNode = this.editor.activeNode;
    const value = gizmoOptions[mode].getProperty(activeNode);
    this.composePatchTransform(propName, value);
  }
}
