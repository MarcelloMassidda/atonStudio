import { Widget } from "./base/Widget.js";

/**
 * Widget for managing semantic annotations (spheres and convex shapes)
 * This is the backbone for all interactable semantic nodes
 */
export class SemanticsWidget extends Widget {
  constructor(app) {
    const options = {
      id: "annotations",
      mainBtnOptions: {
        id: "Annotations_mainBtn",
        text: "Annotations",
        icon: "ann-sphere",
      },
      mainPanelOptions: {
        title: "Semantic annotations",
      },
      createBtnOptions: {
        text: "Add new Annotation",
        icon: "add",
      },
      // Define how to get items from the scene
      items: () => {
        const scene = this.getCurrentScene();
        return scene.semanticgraph?.nodes || null;
      },
      // Define how to get a specific item
      returnItem: (nid) => ATON.getSemanticNode(nid),
      props: {
        position: {
          inspectorBlock: (node) => this.createPositionInspector(node),
          get: () => this.getPositionFromNode(),
        },
        radius: {
          inspectorBlock: (node) => this.createRadiusInspector(node),
          get: () => this.getRadiusFromNode(),
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

    // Convex shape building state
    this.convexShapeManager = {
      bConvexBuilding: false,
      _currentSemId: null,
    };

    // bind create button handler after super
    if (this.options && this.options.createBtnOptions) {
      this.options.createBtnOptions.onClick = () => this.createBtnClicked();
    }
  }

  /**
   * Initialize widget - setup event listeners
   */
  init() {
    this.setupEvents();
    return super.init();
  }

  /**
   * Setup ATON event listeners for convex shape building
   */
  setupEvents() {
    ATON.on("Tap", (e) => {
      if (!this.convexShapeManager.bConvexBuilding) return;
      this.addSurfaceConvexPoint();
    });
  }

  /**
   * Get custom item button based on semantic type
   */
  getItemButton(id, item) {
    const semanticType = this.getSemanticsType(id);
    const icon = semanticType === "sphere" ? "ann-sphere" : "ann-convex";

    const btnOptions = {
      icon: icon,
      id: id,
      text: id,
      attr: { "data-id": id, "data-wid": this.id },
      onClick: (event) => {
        this.app.widgetsHub.onClicked_itemBtn_base(event.target);
      },
    };

    return this.app.widgetsHub.itemBtn_base(btnOptions);
  }

  /**
   * Setup gizmo for semantic node
   */
  setupGizmo(id) {
    const semanticType = this.getSemanticsType(id);

    // Convex shapes don't have gizmo
    if (semanticType !== "sphere") {
      this.gizmoManager.detachGizmo();
      return;
    }

    // Setup gizmo for sphere (first child)
    const node = ATON.getSemanticNode(id);
    if (!node) return;

    this.editor.setGizmoByNode(node.children[0], "translate");
    this.editor.udpateGizmoOnMouseUpListener((evt) => this.onGizmoChange(evt));
  }

  /**
   * Get semantic type (sphere or convex)
   */
  getSemanticsType(nid) {
    const scene = this.getCurrentScene();
    const semNode = scene.semanticgraph?.nodes?.[nid];
    if (!semNode) return null;

    if (semNode.spheres) return "sphere";
    if (semNode.convexshapes) return "convex";
    return null;
  }

  /**
   * Create button clicked - show dialog for semantic type selection
   */
  async createBtnClicked() {
    this.gizmoManager.detachGizmo();
    this.app.ui.toggle_sideRightMenu(false);
    this.editor.activeNode = null;

    const onShapeModeClicked = (e) => {
      const shapeMode = e.target.value;
      const sphereOptionsPanel = document.getElementById("sphere_OptionsPanel");
      const _visible = shapeMode === "sphere" ? "block" : "none";
      sphereOptionsPanel.style.display = _visible;
    };

    const dataUser = await this.app.UI.promptDialog({
      inputs: [
        {
          name: "id",
          type: "text",
          legendText: "Insert Annotation ID",
          required: true,
        },
        {
          legendText: "Shape type",
          inputs: [
            {
              type: "radio",
              name: "mode",
              value: "sphere",
              labelText: "sphere",
              events: { change: onShapeModeClicked },
              checked: "checked",
            },
            {
              type: "radio",
              name: "mode",
              value: "convex",
              labelText: "convex",
              events: { change: onShapeModeClicked },
            },
          ],
        },
        {
          id: "sphere_OptionsPanel",
          name: "radius",
          legendText: "Radius",
          type: "range",
          value: 0.5,
          attr: { min: 0.05, max: 1, step: 0.01 },
        },
      ],
      title: "Add new semantic annotation",
    });

    if (!dataUser) return;

    const mode = dataUser.mode;
    if (!mode) return;

    this.createSemantic(dataUser);
  }

  /**
   * Create semantic node (sphere or convex)
   */
  createSemantic(dataUser) {
    const mode = dataUser.mode;
    const id = dataUser.id;

    let semNode = null;
    let semNode_info = null;

    // SPHERE CREATION - immediate
    if (mode === "sphere") {
      const p = { x: 0, y: 0, z: 0 };
      const r = dataUser.radius
        ? parseFloat(dataUser.radius)
        : ATON.SUI.getSelectorRadius();
      semNode = ATON.SemFactory.createSphere(id, p, r);

      // Add to scene immediately
      ATON.getRootSemantics().add(semNode);
      semNode_info = { spheres: ATON.SceneHub.getJSONsemanticSpheresList(id) };

      // Update local graph and patch
      this.updateSceneGraph(id, semNode_info);
      this.composePatchForCreation(id, semNode_info);

      // Focus on created item
      this.app.widgetsHub.focusOnItem({ id, wid: this.id });
      this.app.ui.editor_updateWidgetMainPanel();
    }
    // CONVEX CREATION - interactive workflow
    else if (mode === "convex") {
      this.startConvexShapeBuilding(id);
    }
  }

  /**
   * Start convex shape building workflow
   */
  startConvexShapeBuilding(id) {
    this.convexShapeManager._currentSemId = id;
    this.convexShapeManager.bConvexBuilding = true;

    // Setup central helper panel
    const helperContent = this.createConvexShapeHelperContent();
    this.app.ui.editor_setCentralHelperPanel(helperContent);

    // Hide side menus during building
    this.app.ui.toggle_sideMenus(false);
  }

  /**
   * Create helper content for convex shape building
   */
  createConvexShapeHelperContent() {
    const title =
      this.convexShapeManager._currentSemId + ": Convex Shape Building";
    const description = "Tap on any surface to create a polygonal mesh";

    const completeBtn = this.app.uikit.createButton({
      variant: "primary",
      id: "completeShape",
      tooltip: "Complete the current convex shape",
      onClick: () => this.onConvexShapeCompleteClicked(),
      text: "Complete Shape",
    });

    const abortBtn = this.app.uikit.createButton({
      id: "cancelShape",
      tooltip: "Cancel the current convex shape",
      onClick: () => this.onConvexShapeAbortClicked(),
      text: "Cancel Shape",
    });

    return this.app.ui.wrapInToast({
      title,
      description,
      btns: [completeBtn, abortBtn],
    });
  }

  /**
   * Add a point to the current convex shape
   */
  addSurfaceConvexPoint() {
    ATON.SemFactory.addSurfaceConvexPoint();
  }

  /**
   * Complete the convex shape
   */
  onConvexShapeCompleteClicked() {
    const id = this.convexShapeManager._currentSemId;
    if (!id) {
      window.alert("No id for the convex shape");
      return;
    }

    const numPoints = ATON.SemFactory.convexPoints.length;
    if (numPoints < 4) {
      window.alert("At least 4 points are needed to create a convex shape");
      return;
    }

    const S = ATON.SemFactory.completeConvexShape(id);
    if (!S) return;

    // Add to scene
    ATON.getRootSemantics().add(S);
    this.convexShapeManager.bConvexBuilding = false;

    // Update local graph
    const semNode_info = {
      convexshapes: ATON.SceneHub.getJSONsemanticConvexShapes(S.nid),
    };
    this.updateSceneGraph(S.nid, semNode_info);

    // Update patch
    this.composePatchForCreation(S.nid, semNode_info);

    // Update UI
    this.app.ui.editor_removeCentralHelperPanel();
    this.app.ui.toggle_sideMenus(true);
    this.app.widgetsHub.focusOnItem({ id, wid: this.id });
    this.app.ui.editor_updateWidgetMainPanel();
  }

  /**
   * Abort convex shape building
   */
  onConvexShapeAbortClicked() {
    ATON.SemFactory.stopCurrentConvex();

    // Clean up visual artifacts
    ATON.SemFactory.convexPoints = [];
    if (ATON.SemFactory.currSemNode) {
      ATON.SemFactory.currSemNode.removeChildren();
    }
    if (ATON.SUI.gPoints) {
      ATON.SUI.gPoints.removeChildren();
    }

    this.convexShapeManager.bConvexBuilding = false;

    // Restore UI
    this.app.ui.toggle_sideMenus(true);
    this.app.ui.editor_removeCentralHelperPanel();
  }

  /**
   * Update scene graph with new semantic node
   */
  updateSceneGraph(id, semNode_info) {
    const scene = this.getCurrentScene();

    const E = {
      semanticgraph: {
        nodes: { [id]: semNode_info },
        edges: ATON.SceneHub.getJSONgraphEdges(ATON.NTYPES.SEM),
      },
    };

    if (!scene.semanticgraph) {
      scene.semanticgraph = E.semanticgraph;
    } else {
      scene.semanticgraph.nodes[id] = semNode_info;
      scene.semanticgraph.edges = E.semanticgraph.edges;
    }
  }

  /**
   * Compose patch for semantic creation (when activeNode is not yet set)
   */
  composePatchForCreation(nid, semNode_info) {
    let _patch = this.editor.patch || {};

    if (!_patch.semanticgraph) {
      _patch.semanticgraph = { nodes: {}, edges: {} };
    }

    // Add node info
    _patch.semanticgraph.nodes[nid] = semNode_info;

    // Add edges - required for ATON to create the node
    _patch.semanticgraph.edges = ATON.SceneHub.getJSONgraphEdges(
      ATON.NTYPES.SEM
    );

    this.editor.patch = _patch;
    this.editor.modePatch = ATON.SceneHub.MODE_ADD;
    this.editor.OnPatchChanged();
  }

  /**
   * Compose patch for semantic changes (when editing existing node)
   */
  composePatch(mode) {
    const node = this.editor.activeNode;
    if (!node) return;

    const nid = node.nid;
    let _patch = this.editor.patch || {};

    if (!_patch.semanticgraph) {
      _patch.semanticgraph = { nodes: {}, edges: {} };
    }

    // Get semantic info based on type
    const semanticType = this.getSemanticsType(nid);
    if (semanticType === "sphere") {
      const p = this.getPositionFromNode();
      const r = this.getRadiusFromNode();

      if (!_patch.semanticgraph.nodes[nid]) {
        _patch.semanticgraph.nodes[nid] = { spheres: [[0, 0, 0, 1]] };
      }

      const _spheres = _patch.semanticgraph.nodes[nid].spheres;
      _spheres[0][0] = p.x;
      _spheres[0][1] = p.y;
      _spheres[0][2] = p.z;
      _spheres[0][3] = r;

      _patch.semanticgraph.nodes[nid].spheres = _spheres;
    } else if (semanticType === "convex") {
      _patch.semanticgraph.nodes[nid] = {
        convexshapes: ATON.SceneHub.getJSONsemanticConvexShapes(nid),
      };
    }

    // Add edges - required for ATON to create the node
    _patch.semanticgraph.edges = ATON.SceneHub.getJSONgraphEdges(
      ATON.NTYPES.SEM
    );

    this.editor.patch = _patch;
    this.editor.modePatch = ATON.SceneHub.MODE_ADD;
    this.editor.OnPatchChanged();
  }

  /**
   * Gizmo change handler
   */
  onGizmoChange(evt) {
    const node = this.editor.activeNode;
    if (!node) return;

    const semanticType = this.getSemanticsType(node.nid);
    if (semanticType !== "sphere") return;

    const gizmoOptions = {
      translate: {
        propertyName: "position",
        idVector3UIContainer: "semantics_position_V3",
        getProperty: (n) => n.position,
      },
    };

    // Update inspector
    const inspectorUpdater = this.editor.gizmoToInspectorMapper(gizmoOptions);
    inspectorUpdater(evt);

    // Compose patch
    const propName = gizmoOptions[this.gizmoManager.control.mode].propertyName;
    if (!propName) return;

    const v = gizmoOptions[this.gizmoManager.control.mode].getProperty(
      node.children[0]
    );
    this.composePatchTransform(propName, v);
  }

  /**
   * Compose patch for transform changes
   */
  composePatchTransform(propName, v) {
    const node = this.editor.activeNode;
    if (!node) return;

    const semanticType = this.getSemanticsType(node.nid);
    if (semanticType !== "sphere") return;

    const nid = node.nid;
    let _patch = this.editor.patch || {};

    if (!_patch.semanticgraph) {
      _patch.semanticgraph = { nodes: {}, edges: {} };
    }
    if (!_patch.semanticgraph.nodes[nid]) {
      _patch.semanticgraph.nodes[nid] = { spheres: [[0, 0, 0, 1]] };
    }

    const _spheres = _patch.semanticgraph.nodes[nid].spheres;

    // Update position
    const p = this.getPositionFromNode();
    _spheres[0][0] = p.x;
    _spheres[0][1] = p.y;
    _spheres[0][2] = p.z;

    // Update radius
    const r = this.getRadiusFromNode();
    _spheres[0][3] = r;

    _patch.semanticgraph.nodes[nid].spheres = _spheres;

    // Add edges - required for ATON to update the node
    _patch.semanticgraph.edges = ATON.SceneHub.getJSONgraphEdges(
      ATON.NTYPES.SEM
    );

    this.editor.patch = _patch;
    this.editor.modePatch = ATON.SceneHub.MODE_ADD;
    this.editor.OnPatchChanged();
  }

  /**
   * Property change handler from inspector
   */
  onPropertyChange(evt) {
    if (!evt.target) return;

    const propName = evt.target.dataset.property;

    // Handle radius special case
    if (propName === "radius") {
      const _val = parseFloat(evt.target.value.replaceAll(",", "."));
      const _target = this.editor.activeNode.children[0];
      _target.scale.x = _val;
      _target.scale.y = _val;
      _target.scale.z = _val;
    }

    const propHandler = this.options.props[propName];
    if (!propHandler) return;

    const v = propHandler.get();
    this.composePatchTransform(propName, v);
  }

  // ========== INSPECTOR BLOCKS ==========

  /**
   * Create position inspector (only for spheres)
   */
  createPositionInspector(node) {
    const semanticType = this.getSemanticsType(node.nid);
    if (semanticType !== "sphere") return null;

    return this.app.widgetsHub.parsers.vector3({
      id: "semantics_position_V3",
      title: "Position",
      property: "position",
      v: node.children[0].position,
      target: node.children[0],
      onChange: (evt) => this.onPropertyChange(evt),
    });
  }

  /**
   * Create radius inspector (only for spheres)
   */
  createRadiusInspector(node) {
    const semanticType = this.getSemanticsType(node.nid);
    if (semanticType !== "sphere") return null;

    return this.app.widgetsHub.parsers.float({
      id: "semantics_radius_float",
      title: "Radius",
      property: "radius",
      v: node.children[0].scale.x,
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
      onClick: () => this.deleteItem(node.nid),
    });
  }

  // ========== GETTERS ==========

  /**
   * Get position from active node
   */
  getPositionFromNode() {
    const node = this.editor.activeNode;
    if (!node) return null;

    const semanticType = this.getSemanticsType(node.nid);
    if (semanticType === "sphere") {
      return node.children[0].position;
    }
    return node.position;
  }

  /**
   * Get radius from active node
   */
  getRadiusFromNode() {
    const node = this.editor.activeNode;
    if (!node) return null;

    const semanticType = this.getSemanticsType(node.nid);
    if (semanticType === "sphere") {
      return node.children[0].scale.x;
    }
    return null;
  }

  // ========== DELETE ==========

  /**
   * Delete semantic node
   */
  deleteItem(nid) {
    if (!this.editor.checkPendingPatch()) return;

    // Live changes
    this.gizmoManager.detachGizmo();
    this.editor.activeNode.delete();

    // Update local graph
    const scene = this.getCurrentScene();
    if (scene.semanticgraph?.nodes?.[nid]) {
      delete scene.semanticgraph.nodes[nid];
    }

    // Update UI
    this.app.ui.editor_updateWidgetMainPanel();
    this.editor.onCloseInspectorBtnClicked();

    // Compose patch
    const nodes = { [nid]: {} };
    const _patch = { semanticgraph: { nodes } };

    this.editor.patch = _patch;
    this.editor.modePatch = ATON.SceneHub.MODE_DEL;
    this.editor.OnPatchChanged();
  }
}
