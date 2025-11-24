import { Widget } from "./base/Widget.js";

/**
 * Widget for managing viewpoints (Points of View) in the scene
 */
export class PointOfViewWidget extends Widget {
  constructor(app) {
    const options = {
      id: "viewpoints",
      mainBtnOptions: {
        id: "viewpoints_mainBtn",
        text: "View Points",
        icon: "pov",
      },
      mainPanelOptions: {
        title: "View Points",
      },
      createBtnOptions: {
        text: "Add new viewpoint",
        icon: "add",
      },
      itemBtnOptions: {
        icon: "pov",
      },
      // Define how to get items from the scene
      items: () => {
        const scene = this.getCurrentScene();
        return scene.viewpoints || null;
      },
      // Define how to get a specific item
      returnItem: (nid) => ATON.getSceneNode(nid),
      props: {
        position: {
          inspectorBlock: (node) => this.createPositionInspector(node),
          get: () => this.getPositionFromNode(),
        },
        target: {
          inspectorBlock: (node) => this.createTargetInspector(node),
          get: () => this.getTargetFromNode(),
        },
        fov: {
          inspectorBlock: (node) => this.createFovInspector(node),
          get: () => this.getFovFromInput(),
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

    // bind create button handler after super
    if (this.options && this.options.createBtnOptions) {
      this.options.createBtnOptions.onClick = () => this.createBtnClicked();
    }
  }

  /**
   * Get actions for this widget
   * @returns {Array} Array of action definitions
   */
  getActions() {
    const actions = super.getActions();

    actions.push({
      id: "goToPov",
      name: "Go to Point of View",
      widgetId: this.id,
      getProperties: (context) => {
        const { node, actionId, args } = context;
        return {
          pov: {
            inspectorBlock: () => this.createPOVSelectionBlock(node, actionId, args),
          },
        };
      },
      execute: (context) => {
        // This will be handled by the flare
      },
      onDelete: (context) => {
        const { node, actionId } = context;
        const scene = ATON.SceneHub.currData;
        if (!scene) return;

        const nodeData = scene.semanticgraph?.nodes?.[node.nid];
        if (!nodeData?.events?.onSelect) return;

        const actions = nodeData.events.onSelect;
        if (!Array.isArray(actions)) return;

        // Find the action and clean up its args
        const action = actions.find((a) => a.actionId === actionId);
        if (action && action.args) {
          delete action.args.targetPOVId;
        }
      },
    });

    return actions;
  }

  /**
   * Create POV selection block for action inspector
   */
  createPOVSelectionBlock(node, actionId, args) {
    const container = this.app.uikit.createContainer({ classList: ["inspector_Block"] });

    const selectedPOVId = args?.targetPOVId;

    if (selectedPOVId) {
      const btnText = `📍 ${selectedPOVId}`;
      const btn = this.app.uikit.createButton({
        text: btnText,
        onClick: () => this.openPOVSelectionModal(node, actionId),
      });
      container.appendChild(btn);
    } else {
      const btn = this.app.uikit.createButton({
        text: "Select Point of View",
        onClick: () => this.openPOVSelectionModal(node, actionId),
      });
      container.appendChild(btn);
    }

    return container;
  }

  /**
   * Open modal to select POV
   */
  openPOVSelectionModal(node, actionId) {
    const scene = this.getCurrentScene();
    if (!scene.viewpoints || Object.keys(scene.viewpoints).length === 0) {
      ATON.UI.showModal({
        title: "No Viewpoints Available",
        body: "There are no viewpoints in the scene. Please create at least one viewpoint first.",
      });
      return;
    }

    const modalContent = this.app.uikit.createContainer({});

    // Add instruction text
    const instructionText = this.app.uikit.createText({
      text: "Select a Point of View to navigate to when this semantic node is selected:",
      classList: ["text-muted", "mb-2"],
    });
    modalContent.appendChild(instructionText);

    // Create list group
    const listGroup = this.app.uikit.createContainer({
      classList: ["list-group"],
    });

    for (const [povId, povData] of Object.entries(scene.viewpoints)) {
      const item = this.app.uikit.createButton({
        text: `📍 ${povId}`,
        classList: ["list-group-item", "list-group-item-action"],
        onClick: () => {
          this.savePOVSelection(node, actionId, povId);
          ATON.UI.hideModal();
        },
      });
      listGroup.appendChild(item);
    }

    modalContent.appendChild(listGroup);

    ATON.UI.showModal({
      title: "Select Point of View",
      body: modalContent,
    });
  }

  /**
   * Save POV selection for this action
   */
  savePOVSelection(node, actionId, targetPOVId) {
    const scene = this.getCurrentScene();
    if (!scene) return;

    const nid = node.nid;
    const nodeData = scene.semanticgraph?.nodes?.[nid];
    if (!nodeData?.events?.onSelect) return;

    const actions = nodeData.events.onSelect;
    if (!Array.isArray(actions)) return;

    // Find the specific action by actionId and update its args
    const action = actions.find((a) => a.actionId === actionId);
    if (action) {
      if (!action.args) action.args = {};
      action.args.targetPOVId = targetPOVId;

      // Update the local scene data
      scene.semanticgraph.nodes[nid].events.onSelect = actions;

      // Compose and send patch
      const patch = {
        semanticgraph: {
          nodes: {
            [nid]: {
              events: nodeData.events,
            },
          },
          edges: ATON.SceneHub.getJSONgraphEdges(ATON.NTYPES.SEM),
        },
      };

      this.editor.patch = patch;
      this.editor.modePatch = ATON.SceneHub.MODE_ADD;
      this.editor.OnPatchChanged();

      console.log(`💾 Saved POV selection: ${targetPOVId} for action ${actionId}`);

      // Update the UI
      this.app.ui.editor_updateHierarchy();
      this.app.ui.editor_updateWidgetMainPanel();
      this.app.widgetsHub.focusOnItem({ id: nid, wid: "annotations" });
    }
  }

  /**
   * Add a POV item to the 3D scene with visual representation
   */
  addItemToScene(vId, vp) {
    const POV_Icon_Node = ATON.createSceneNode(vId);
    POV_Icon_Node.attachToRoot();
    const IconPOV = this.app.uikit.POV_3Dicon(vp.position, vp.target);
    POV_Icon_Node.add(IconPOV);
  }

  /**
   * Create new viewpoint button clicked
   */
  async createBtnClicked() {
    console.log("CREATING A VIEWPOINT");

    const newGeneratedId = ATON.Utils.generateID("pov");
    const currPOV = ATON.Nav._currPOV;

    const dataPOV = await this.app.UI.promptDialog({
      inputs: [
        {
          type: "text",
          name: "id",
          legendText: "View Point ID",
          value: newGeneratedId,
          required: true,
        },
        {
          type: "checkbox",
          name: "fromCurrView",
          legendText: "Orientation",
          labelText: "Set from current View",
          checked: "checked",
        },
      ],
      title: "Add new ViewPoint",
    });

    if (!dataPOV) return;

    // Compose pov
    const p = dataPOV.fromCurrView
      ? [currPOV.pos.x, currPOV.pos.y, currPOV.pos.z]
      : [0, 0, 0];
    const t = dataPOV.fromCurrView
      ? [currPOV.target.x, currPOV.target.y, currPOV.target.z]
      : [0, 0, 1];
    const bodyPov = { fov: currPOV.fov, position: p, target: t };

    console.log(bodyPov);

    // Realtime Add to Scene
    this.addItemToScene(dataPOV.id, bodyPov);

    // Edit local graph scene
    const scene = this.getCurrentScene();
    if (!scene.viewpoints) scene.viewpoints = {};
    scene.viewpoints[dataPOV.id] = bodyPov;

    // Focus on new viewpoint
    this.app.widgetsHub.focusOnItem({ id: dataPOV.id, wid: this.id });

    // Compose and send patch
    this.composePatch({
      viewpoints: {
        [dataPOV.id]: bodyPov,
      },
    });

    // Update UI
    this.app.ui.editor_updateWidgetMainPanel();
  }

  /**
   * Setup gizmo for viewpoint
   */
  setupGizmo(id) {
    console.log("SEARCHING: " + id);
    const node = ATON.getSceneNode(id);
    const pos = node.children[0].children[0];
    this.editor.setGizmoByNode(pos, "translate");
    this.editor.udpateGizmoOnMouseUpListener((evt) =>
      this.onPositionGizmoChange(evt)
    );
  }

  /**
   * Create position inspector
   */
  createPositionInspector(node) {
    const pos = node.children[0].children[0];
    const inspectorBlock = this.app.uikit.createContainer({
      classList: ["inspector_Block"],
      content: [
        this.app.uikit.createButton({
          text: "position",
          onClick: () => {
            console.log("Position clicked");
            this.editor.setGizmoByNode(pos);
            this.editor.udpateGizmoOnMouseUpListener((evt) =>
              this.onPositionGizmoChange(evt)
            );
          },
        }),
        this.app.widgetsHub.parsers.vector3({
          id: "viewpoints_position_V3",
          title: "Position",
          property: "position",
          v: pos.position,
          target: pos,
          onChange: (evt) => this.onPropertyChange(evt),
        }),
      ],
    });
    return inspectorBlock;
  }

  /**
   * Create target inspector
   */
  createTargetInspector(node) {
    const povTarget = node.children[0].children[2];
    const inspectorBlock = this.app.uikit.createContainer({
      classList: ["inspector_Block"],
      content: [
        this.app.uikit.createButton({
          text: "target",
          onClick: () => {
            console.log("Target clicked");
            this.editor.setGizmoByNode(povTarget);
            this.editor.udpateGizmoOnMouseUpListener((evt) =>
              this.onTargetGizmoChange(evt)
            );
          },
        }),
        this.app.widgetsHub.parsers.vector3({
          id: "viewpoints_target_V3",
          title: "target",
          property: "position",
          target: povTarget,
          v: povTarget.position,
          onChange: (evt) => this.onPropertyChange(evt),
        }),
      ],
    });
    return inspectorBlock;
  }

  /**
   * Create FOV inspector
   */
  createFovInspector(node) {
    const scene = this.getCurrentScene();
    const vp = scene.viewpoints[node.nid];
    return this.app.widgetsHub.parsers.float({
      id: "viewpoints_fov",
      title: "FOV",
      name: "fov",
      v: vp.fov,
      onChange: (evt) => this.onPropertyChange(evt),
    });
  }

  /**
   * Create delete button
   */
  createDeleteButton(node) {
    return this.app.uikit.deleteButton({
      icon: "trash",
      text: "Remove",
      onClick: () => this.deleteViewpoint(node.nid),
    });
  }

  /**
   * Get position from active node
   */
  getPositionFromNode() {
    const node = this.editor.activeNode;
    const pos = node.children[0].children[0];
    const p_pos = pos.position;
    return [p_pos.x, p_pos.y, p_pos.z];
  }

  /**
   * Get target from active node
   */
  getTargetFromNode() {
    const node = this.editor.activeNode;
    const target = node.children[0].children[2];
    const p_target = target.position;
    return [p_target.x, p_target.y, p_target.z];
  }

  /**
   * Get FOV from input
   */
  getFovFromInput() {
    return parseFloat(document.getElementById("viewpoints_fov").value);
  }

  /**
   * Handle property changes from inspector
   */
  onPropertyChange(evt) {
    console.log(evt);
    if (evt.target && evt.target.name === "fov") {
      console.log("CHANGING FOV");
    }

    // Re-create viewpoint icon
    const node = this.editor.activeNode;
    const nid = node.nid;
    const pos = node.children[0].children[0].position;
    const target = node.children[0].children[2].position;
    const p_pos = [pos.x, pos.y, pos.z];
    const p_target = [target.x, target.y, target.z];

    ATON.getSceneNode(nid).delete();
    this.addItemToScene(nid, { position: p_pos, target: p_target });

    this.composePatchForActiveNode();
  }

  /**
   * Handle position gizmo change
   */
  onPositionGizmoChange(evt) {
    // Adjust viewpoint 3D icon in realtime
    this.onPropertyChange(evt);

    // Update inspector
    const inspectorUpdater = this.editor.gizmoToInspectorMapper({
      translate: {
        idVector3UIContainer: "viewpoints_position_V3",
        getProperty: (n) => n.position,
      },
    });
    inspectorUpdater(evt);
  }

  /**
   * Handle target gizmo change
   */
  onTargetGizmoChange(evt) {
    // Adjust viewpoint 3D icon in realtime
    this.onPropertyChange(evt);

    // Update inspector
    const inspectorUpdater = this.editor.gizmoToInspectorMapper({
      translate: {
        idVector3UIContainer: "viewpoints_target_V3",
        getProperty: (n) => n.position,
      },
    });
    inspectorUpdater(evt);
  }

  /**
   * Compose patch for active node
   */
  composePatchForActiveNode() {
    const node = this.editor.activeNode;
    if (!node) throw new Error("no node");

    const nid = node.nid;

    this.composePatch({
      viewpoints: {
        [nid]: {
          position: this.getPositionFromNode(),
          target: this.getTargetFromNode(),
          fov: this.getFovFromInput(),
        },
      },
    });
  }

  /**
   * Delete viewpoint
   */
  deleteViewpoint(nid) {
    if (!this.editor.checkPendingPatch()) return;

    // Detach gizmo first
    this.gizmoManager.detachGizmo();

    // Get the actual viewpoint node (not the child gizmo target)
    const viewpointNode = ATON.getSceneNode(nid);
    if (!viewpointNode) {
      console.error(`Viewpoint node ${nid} not found`);
      return;
    }

    // Delete the viewpoint node
    viewpointNode.delete();

    // Update local graph
    const scene = this.getCurrentScene();
    if (scene.viewpoints && scene.viewpoints[nid]) {
      delete scene.viewpoints[nid];
    }

    // Update UI editor
    this.app.ui.editor_updateWidgetMainPanel();
    this.editor.onCloseInspectorBtnClicked();

    // Compose and send delete patch
    if (!nid) throw new Error("error deleting viewpoint");

    this.composePatch(
      {
        viewpoints: {
          [nid]: {},
        },
      },
      ATON.SceneHub.MODE_DEL
    );
  }
}
