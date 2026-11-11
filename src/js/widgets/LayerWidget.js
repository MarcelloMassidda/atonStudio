import { Widget } from "./base/Widget.js";
import { LayerComponent } from "../components/components.js";

/**
 * Widget for managing 3D model layers in the scene (component: LayerComponent)
 */
export class LayerWidget extends Widget {
constructor(app) {
    const options = {
      id: "layers",
      component: LayerComponent,
      itemPath: (id) => ["scenegraph", "nodes", id],
      deletable: true,
      hierarchy: true,
      mainBtnOptions: {
        id: "layers_mainBtn",
        text: "Models",
        icon: "collection-item",
      },
      itemBtnOptions: {
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
      // Define how to get a specific item
      returnItem: (nid) => ATON.getSceneNode(nid),
      props: {
        position: { inspectorBlock: (node) => this.createTransformInspector("position", node) },
        rotation: { inspectorBlock: (node) => this.createTransformInspector("rotation", node) },
        scale: { inspectorBlock: (node) => this.createTransformInspector("scale", node) },
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
   * "Add new model": open the media library on the 3D models of the user's collection
   */
  createBtnClicked() {
    this.app.library.open({
      title: "Add a 3D model",
      start: `${this.app.library.user()}/models/`,
      filter: "model",
      actions: this.getLibraryActions(),
    });
  }

  /**
   * Actions this widget offers in the media library (see ModernWidgetHub.getLibraryActions)
   */
  getLibraryActions() {
    return [
      {
        id: "importAsLayer",
        label: "Import as layer",
        icon: "add",
        primary: true,
        accepts: "model",
        run: (item) => this.importModel(item.path),
      },
    ];
  }

  /**
   * Ask for the layer name, load the model and add it to the scene
   * @param {string} url - collection path of the model (e.g. "bastet/models/room.glb")
   */
  async importModel(url) {
    const promptResponse = await this.app.UI.promptDialog({
      title: "Import as layer",
      inputs: [{ name: "newNodeName", legendText: "Layer name", type: "text", value: this.suggestLayerName(url), required: true }],
      confirmText: "Import",
    });
    if (!promptResponse) return;

    const nodeName = this.uniqueLayerName(promptResponse.newNodeName.trim());

    ATON.createSceneNode(nodeName)
      .setCloneOnLoadHit(true)
      .load(url, () => {
        ATON.getRootScene().assignLightProbesByProximity();
        ATON.updateLightProbes();
        this.updateEditorOnModelAdded(nodeName, url);
      })
      .setPosition(0, 0, 0)
      .attachToRoot();
  }

  /** "models/room.glb" → "room"; "models/Room/scene.gltf" → "Room" */
  suggestLayerName(url) {
    const parts = url.split("/");
    let name = parts.pop().replace(/\.[^.]+$/, "");
    if (["scene", "model", "tileset", "index"].includes(name.toLowerCase()) && parts.length) name = parts.pop();
    return this.uniqueLayerName(name.replace(/[^\w.-]+/g, "_"));
  }

  /** Layer ids must be unique in the scenegraph */
  uniqueLayerName(name) {
    const nodes = this.getCurrentScene().scenegraph?.nodes || {};
    if (!nodes[name] && !ATON.getSceneNode(name)) return name;
    let i = 2;
    while (nodes[`${name}-${i}`] || ATON.getSceneNode(`${name}-${i}`)) i++;
    return `${name}-${i}`;
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
    this.addComponent(nodeName, newSceneGraphNode);

    // Update edges
    if (!scene.scenegraph.edges) {
      scene.scenegraph.edges = { ".": [nodeName] };
    } else {
      if (!Array.isArray(scene.scenegraph.edges["."]))
        scene.scenegraph.edges["."] = [];
      scene.scenegraph.edges["."].push(nodeName);
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
   * Transform field (position / rotation / scale): edits go through update()
   */
  createTransformInspector(property, node) {
    return this.app.widgetsHub.parsers.vector3({
      id: `layer_${property}_V3`,
      title: property.charAt(0).toUpperCase() + property.slice(1),
      property: property,
      v: node[property],
      onChange: (evt) => {
        const id = node.nid;
        const current = this.getComponent(id)?.serialize().transform?.[property];
        const v = this.vectorFromInput(evt, current);
        if (v) this.update(id, { transform: { [property]: v } }, { source: "inspector" });
      },
    });
  }

  /**
   * After update(): the gizmo moved the node, refresh the transform fields
   */
  onItemUpdated(id, component, source) {
    if (source === "inspector") return;
    const t = component.serialize().transform || {};
    for (const p of ["position", "rotation", "scale"]) this.setVectorField(`layer_${p}_V3`, t[p]);
  }

  /**
   * Delete a layer
   */
  deleteItem(nid) {
    if (!this.editor.checkPendingPatch()) return;

    // Live changes
    this.gizmoManager.detachGizmo();
    if (this.getComponent(nid)) this.removeComponent(nid); // deletes the ATON node
    else ATON.getSceneNode(nid)?.delete();

    // Update local graph
    const scene = this.getCurrentScene();
    const nodes = scene.scenegraph.nodes;
    if (nodes[nid]) delete nodes[nid];

    // Update edges - remove this node from parent edges
    const edges = scene.scenegraph.edges;
    if (edges) {
      for (const [parentId, children] of Object.entries(edges)) {
        const index = children.indexOf(nid);
        if (index > -1) {
          children.splice(index, 1);
          console.log(`🔗 Removed ${nid} from edges[${parentId}]`);
        }
      }
    }

    // Update UI
    this.app.ui.editor_updateHierarchy();
    this.app.ui.editor_updateWidgetMainPanel();
    this.editor.onCloseInspectorBtnClicked();

    // Send delete patch — only delete the node entry.
    this.composePatch(
      {
        scenegraph: { 
          nodes: { [nid]: {} }
        }
      },
      ATON.SceneHub.MODE_DEL
    );

    // Clean up any actions referencing this layer (AFTER delete patch sent):
    // behaviour actions and widget-native ones (toggleVisible)
    const actions = this.getActions();
    for (const action of actions) {
      if (action.widgetId === this.id && action.onReferencedItemDeleted) {
        this.app.widgetsHub.cleanupActionsForDeletedItem({
          deletedItemId: nid,
          widgetId: this.id,
          actionType: action.id
        });
      }
    }

    // Clean up any behaviour data for this layer
    this.app.widgetsHub.cleanupBehavioursForDeletedItem({
      deletedItemId: nid,
      widgetId: this.id
    });
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
   * Get actions for this widget
   * Provides widget-native actions like toggleVisible
   */
  getActions() {
    // Get behaviour actions from the base widget
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
          const { node, widget, scene, actionId } = context;
          const nid = node.nid;

          console.log(`🧹 Cleaning up toggleVisible action for semantic node ${nid}`);

          // With dictionary structure, the action will be deleted by the caller
          // No additional cleanup needed here as args are part of the action being deleted
        },
        onReferencedItemDeleted: (deletedItemId, actionInstance) => {
          // Check if this action references the deleted layer
          if (actionInstance.args?.targetLayerId === deletedItemId) {
            return { 
              shouldRemove: true, 
              reason: `Layer "${deletedItemId}" was deleted` 
            };
          }
          return { shouldRemove: false };
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

    // Find the specific action in the dictionary
    const actions = scene.semanticgraph.nodes[nid]?.events?.onSelect;
    if (!actions || typeof actions !== 'object' || Array.isArray(actions)) {
      console.error("No actions found for node or invalid structure");
      return;
    }

    // Find the action with this actionId in dictionary
    const action = actions[actionId];
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
    // The gizmo moves the node itself: the component reads the transform back when saving
    this.gizmoManager.onChangeEnd(() => this.update(id, {}, { source: "gizmo" }));
  }
}
