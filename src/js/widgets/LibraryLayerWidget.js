import { LayerWidget } from "./LayerWidget.js";

/**
 * Library-based layer widget that uses a model gallery for creation
 */
export class LibraryLayerWidget extends LayerWidget {
  constructor(app) {
    const options = {
      id: "libraryLayers",
      hierarchy: true,
      mainBtnOptions: {
        id: "libraryLayers_mainBtn",
        text: "Library Models",
        icon: "collection-item",
      },
      mainPanelOptions: {
        title: "Library Models",
      },
      createBtnOptions: {
        text: "Add Model from Library",
        icon: "add",
      },
    };

    super(app, options);

    // bind create button handler after super
    if (this.options) {
      if (this.options.createBtnOptions) {
        this.options.createBtnOptions.onClick = () => this.createBtnClicked();
      }

      //TO FIX BETTER: diseable the itemBtn from LayerWidget
      this.options.itemBtn = null;
    }
  }

  /**
   * Override to use model gallery instead of file browser
   */
  createBtnClicked() {
    this.app.uikit.createModelGallery({
      onModelItemClicked: this.handleModelSelected.bind(this),
    });
  }

  /**
   * Handle model selection from gallery
   */
  async handleModelSelected({ url, id, type }) {
    if (!url || !id) {
      console.error("Invalid model data");
      return;
    }

    ATON.UI.hideModal();
    const nodeName = ATON.Utils.generateID(id);

    // Add in scene
    ATON.createSceneNode(nodeName)
      .setCloneOnLoadHit(true) // Clone materials to prevent sharing between instances
      .load(url, () => {
        this.updateEditorOnModelAdded(nodeName, url, type);
        ATON.getRootScene().assignLightProbesByProximity();
        ATON.updateLightProbes();
      })
      .setPosition(0, 0, 0)
      .attachToRoot();
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
}
