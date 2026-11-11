import { Widget } from "./base/Widget.js";
import { SemanticNodeComponent } from "../components/components.js";
import { toArray3 } from "../components/Component.js";

/**
 * Widget for managing semantic annotations (spheres and convex shapes)
 * This is the backbone for all interactable semantic nodes.
 * Component: SemanticNodeComponent (geometry only). The node's `events`
 * (actions) are authored here but stored by the hub's action system.
 */
export class SemanticsWidget extends Widget {
  constructor(app) {
    const options = {
      id: "annotations",
      component: SemanticNodeComponent,
      itemPath: (id) => ["semanticgraph", "nodes", id],
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
        position: { inspectorBlock: (node) => this.createPositionInspector(node) },
        radius: { inspectorBlock: (node) => this.createRadiusInspector(node) },
        events: {
          inspectorBlock: (node) => this.createEventsInspector(node),
        },
      },
      deletable: true,
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

    let btnOptions = {
      icon: icon,
      id: id,
      text: id,
      attr: { "data-id": id, "data-wid": this.id },
      onClick: (event) => {
        this.app.widgetsHub.onItemButtonClicked(event.target);
      },
    };

    // Check if semantic node has assigned actions - add ⚡ badge
    const scene = this.getCurrentScene();
    const semNode = scene.semanticgraph?.nodes?.[id];
    const actions = semNode?.events?.onSelect;
    
    // Check if actions dictionary exists and has keys
    if (actions && typeof actions === 'object' && !Array.isArray(actions)) {
      const count = Object.keys(actions).length;
      
      if (count > 0) {
        btnOptions.badges = btnOptions.badges || [];
        btnOptions.badges.push({
          text: count > 1 ? `⚡${count}` : "⚡",
          type: "warning",
          title: `Has ${count} assigned action${count > 1 ? 's' : ''}`,
        });
      }
    }

    return this.app.widgetsHub.createItemButton(btnOptions);
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

    // Gizmo on the sphere mesh (first child); the component reads it back when saving
    const node = ATON.getSemanticNode(id);
    if (!node) return;

    this.editor.setGizmoByNode(node.children[0], "translate");
    this.gizmoManager.onChangeEnd(() => this.update(id, {}, { source: "gizmo" }));
  }

  /**
   * Get semantic type (sphere or convex)
   */
  getSemanticsType(nid) {
    return this.getComponent(nid)?.shape || null;
  }

  /**
   * Semantic nodes are created by ATON from the graph edges: save them with the item
   */
  getPatchExtras() {
    return { semanticgraph: { edges: ATON.SceneHub.getJSONgraphEdges(ATON.NTYPES.SEM) } };
  }

  /**
   * After update(): refresh position / radius fields
   */
  onItemUpdated(id, component, source) {
    if (source === "inspector") return;
    const s = component.serialize().spheres?.[0];
    if (!s) return;
    this.setVectorField("semantics_position_V3", s.slice(0, 3));
    const r = document.getElementById("semantics_radius_float");
    if (r) r.value = s[3];
  }

  /** spheres with the first sphere's position and/or radius replaced */
  withSphere(id, { position, radius }) {
    const spheres = this.getComponent(id).serialize().spheres.map((s) => [...s]);
    if (position) spheres[0].splice(0, 3, ...position);
    if (radius !== undefined) spheres[0][3] = radius;
    return spheres;
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
          legendText: "Annotation ID",
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
      title: "New annotation",
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

      // Add to scene immediately, then component + save (local scene + patch)
      ATON.getRootSemantics().add(semNode);
      this.addComponent(id, { spheres: ATON.SceneHub.getJSONsemanticSpheresList(id) });
      this.saveItem(id);

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

    // Add to scene, then component + save (local scene + patch)
    ATON.getRootSemantics().add(S);
    this.convexShapeManager.bConvexBuilding = false;
    this.addComponent(S.nid, { convexshapes: ATON.SceneHub.getJSONsemanticConvexShapes(S.nid) });
    this.saveItem(S.nid);

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

  // ========== INSPECTOR BLOCKS ==========

  /**
   * Create position inspector (only for spheres)
   */
  createPositionInspector(node) {
    const id = node.nid;
    const sphere = this.getComponent(id)?.sphere;
    if (!sphere) return null;
    const [x, y, z] = sphere.position;

    return this.app.widgetsHub.parsers.vector3({
      id: "semantics_position_V3",
      title: "Position",
      property: "position",
      v: { x, y, z },
      onChange: (evt) => {
        const nv = this.vectorFromInput(evt, this.getComponent(id).sphere.position);
        if (nv) this.update(id, { spheres: this.withSphere(id, { position: nv }) }, { source: "inspector" });
      },
    });
  }

  /**
   * Create radius inspector (only for spheres)
   */
  createRadiusInspector(node) {
    const id = node.nid;
    const sphere = this.getComponent(id)?.sphere;
    if (!sphere) return null;

    return this.app.widgetsHub.parsers.float({
      id: "semantics_radius_float",
      title: "Radius",
      property: "radius",
      v: sphere.radius,
      step: 0.01,
      onChange: (evt) => {
        const radius = parseFloat(String(evt.target.value).replaceAll(",", "."));
        if (radius > 0) this.update(id, { spheres: this.withSphere(id, { radius }) }, { source: "inspector" });
      },
    });
  }

  /**
   * Create events inspector block
   * Shows assigned actions and provides "Assign Action" button
   */
  createEventsInspector(node) {
    const scene = this.getCurrentScene();
    const semNode = scene.semanticgraph?.nodes?.[node.nid];
    const actionsDict = semNode?.events?.onSelect;

    // Create section with micro-title
    const actionsContent = [];

    // "Add" button lives in the section title row
    const addBtn = this.app.uikit.createButton({
      text: "Add",
      icon: "add",
      compact: true,
      onClick: () => {
        this.app.widgetsHub.assignActionToNode(node, this);
      },
    });
    addBtn.title = "Add an action triggered when this node is selected";

    // If actions are assigned, render each action in its own container
    if (actionsDict && typeof actionsDict === 'object' && !Array.isArray(actionsDict)) {
      const actionEntries = Object.entries(actionsDict);
      
      actionEntries.forEach(([actionId, actionData]) => {
        const actionWidget = this.app.widgetsHub.getWidget(actionData.widgetId);
        if (actionWidget) {
          const widgetActions = actionWidget.getActions();
          const action = widgetActions.find((a) => a.id === actionData.actionType);

          if (action && action.getProperties) {
            const actionContent = [];

            // Get properties from action, passing the unique actionId
            const props = action.getProperties({ 
              node, 
              widget: this, 
              actionId: actionId,
              args: actionData.args 
            });

            // Render each property's inspector block
            for (const [propName, propConfig] of Object.entries(props)) {
              if (propConfig.inspectorBlock) {
                const block = propConfig.inspectorBlock();
                if (block) actionContent.push(block);
              }
            }

            // Wrap in action card (readable name + remove button in the header)
            const actionContainer = this.app.uikit.actionContainer(
              actionId,
              actionData.actionType,
              actionContent,
              {
                title: action.name,
                onRemove: () => {
                  this.app.widgetsHub.removeActionFromNode(node, this, actionId);
                },
              }
            );
            actionsContent.push(actionContainer);
          }
        }
      });
    }

    if (actionsContent.length === 0) {
      actionsContent.push(
        this.app.uikit.createText({
          text: "No actions yet. Add one to define what happens when this node is selected.",
          classList: ["insp-hint"],
        })
      );
    }

    // Wrap everything in inspector section with micro-title
    return this.app.uikit.inspectorSection("Actions", actionsContent, addBtn);
  }


  // ========== DELETE ==========

  /**
   * Delete semantic node
   */
  deleteItem(nid) {
    if (!this.editor.checkPendingPatch()) return;

    // Live changes
    this.gizmoManager.detachGizmo();
    if (this.getComponent(nid)) this.removeComponent(nid); // deletes the ATON semantic node
    else ATON.getSemanticNode(nid)?.delete();

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
