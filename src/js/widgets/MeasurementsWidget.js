import { Widget } from "./base/Widget.js";
import { MeasurementComponent } from "../components/components.js";
import { toArray3 } from "../components/Component.js";

/**
 * Measurements Widget
 * Component: MeasurementComponent (points + its objects in ATON's measurement group).
 * Editor helper: while a measurement is selected, a helper (UI) node named after it
 * holds two draggable spheres (A, B), created in activeItem and removed on lose focus.
 */
export class MeasurementsWidget extends Widget {
  constructor(app) {
    const options = {
      id: "measurements",
      component: MeasurementComponent,
      deletable: true,
      mainPanelOptions: {
        title: "Measurements",
      },
      mainBtnOptions: {
        id: "measurements_mainBtn",
        text: "Measurements",
        icon: "measure",
      },
      itemBtnOptions: {
        icon: "measure",
      },
      createBtnOptions: {
        text: "Add measurement",
        icon: "add",
      },
      // Define how to get items from the scene
      items: () => {
        const scene = this.getCurrentScene();
        return scene.measurements || null;
      },
      // The selected item is the editor helper node (see activeItem)
      returnItem: (nid) => this.getHelperNode(nid),
      props: {
        PointA: { inspectorBlock: (node) => this.createPointInspector(node, "A") },
        PointB: { inspectorBlock: (node) => this.createPointInspector(node, "B") },
      },
    };

    super(app, options);
    this.gizmoManager = app.gizmoManager;
    this.bMeasuring = false;

    // bind create button handler after super
    if (this.options && this.options.createBtnOptions) {
      this.options.createBtnOptions.onClick = () => this.createBtnClicked();
    }

    // Setup ATON tap event for measurement creation
    this.setupMeasurementEvents();
  }

  /**
   * ATON already drew the scene's measurements when it parsed the scene:
   * clear them and let each component draw (and own) its own.
   */
  init() {
    ATON.SUI.clearMeasurements();
    return super.init();
  }

  /**
   * Setup ATON events for measurement workflow
   */
  setupMeasurementEvents() {
    ATON.on("Tap", () => {
      if (!this.bMeasuring) return;
      this.addMeasurePoint();
    });
  }

  /** Placing measurement points: scene clicks are not selections */
  isBusy() {
    return this.bMeasuring;
  }

  /**
   * Handle create button click - start measurement workflow
   */
  createBtnClicked() {
    this.bMeasuring = true;

    // Show central helper panel with instructions
    const helperContent = this.createHelperContent();
    this.app.ui.editor_setCentralHelperPanel(helperContent);
    this.app.ui.toggle_sideMenus(false);
  }

  /**
   * Create helper content for measurement workflow
   */
  createHelperContent() {
    const title = "Adding measurements";
    const description =
      "Click on any surface to add START and END point of the measure.";
    const abortBtn = this.app.uikit.createButton({
      id: "abortMeasurement",
      tooltip: "Cancel the current measurement",
      onClick: () => this.abortMeasure(),
      text: "Cancel measure",
    });
    return this.app.ui.wrapInToast({
      title,
      description,
      btns: [abortBtn],
    });
  }

  /**
   * Abort measurement workflow
   */
  abortMeasure() {
    this.bMeasuring = false;
    if (ATON.SUI._prevMPoint) ATON.SUI._prevMPoint = undefined;
    this.app.ui.toggle_sideMenus(true);
    this.app.ui.editor_removeCentralHelperPanel();
  }

  /**
   * Add measurement point (called on tap when measuring).
   * ATON draws the measurement on the 2nd point: those objects are replaced
   * by the component's own, so it can update and remove them later.
   */
  addMeasurePoint() {
    const P = ATON.getSceneQueriedPoint();
    const from = ATON.SUI.gMeasures.children.length;
    const M = ATON.SUI.addMeasurementPoint(P);
    if (M === undefined) return;
    this.bMeasuring = false;
    MeasurementComponent.removeObjects(ATON.SUI.gMeasures.children.slice(from));

    const prec = (v) => parseFloat(v.toPrecision(ATON.SceneHub.FLOAT_PREC));
    const mid = ATON.Utils.generateID("meas");
    this.addComponent(mid, { points: [...toArray3(M.A), ...toArray3(M.B)].map(prec) });
    this.saveItem(mid);

    // Focus on item - this will call activeItem internally via widgetsHub
    this.app.widgetsHub.focusOnItem({ id: mid, wid: this.id });

    // Update UI
    this.app.ui.toggle_sideMenus(true);
    this.app.ui.editor_updateWidgetMainPanel();
    this.app.ui.editor_removeCentralHelperPanel();
  }

  /**
   * Called by the hub before getItem: create the editor helper (spheres A, B)
   */
  activeItem(meas_id) {
    if (!meas_id) return;

    // Remove the helper of the previously selected measurement
    if (this.editor.activeNode && this.editor.activeWidget?.id === this.id) {
      this.deactiveItem(this.editor.activeNode.nid);
    }

    const component = this.getComponent(meas_id);
    if (!component) throw new Error("no measure found for: " + meas_id);

    const p = component.data.points;
    this.createHelperNode(meas_id, this.app.uikit.MEASURE_3Dicon([p[0], p[1], p[2]], [p[3], p[4], p[5]]));
  }

  /**
   * Remove the editor helper of a measurement
   */
  deactiveItem(id) {
    this.getHelperNode(id)?.delete();
  }

  /**
   * Called when losing focus to another widget - cleanup the helper
   */
  onLoseFocus(item) {
    if (item && item.nid) {
      this.deactiveItem(item.nid);
    }
  }

  /** Helper spheres [A, B] of the selected measurement */
  getHandles(id) {
    const group = this.getHelperNode(id)?.children[0];
    return group ? { A: group.children[0], B: group.children[1] } : null;
  }

  /**
   * After update(): move the helper spheres and refresh the fields
   */
  onItemUpdated(id, component, source) {
    const p = component.data.points;
    const handles = this.getHandles(id);
    if (handles) {
      handles.A.position.set(p[0], p[1], p[2]);
      handles.B.position.set(p[3], p[4], p[5]);
    }
    if (source === "inspector") return;
    this.setVectorField("measure_pointA_v3", p.slice(0, 3));
    this.setVectorField("measure_pointB_v3", p.slice(3, 6));
  }

  /** points with point A or B replaced by v */
  withPoint(id, which, v) {
    const p = [...this.getComponent(id).data.points];
    p.splice(which === "A" ? 0 : 3, 3, ...v);
    return p;
  }

  /**
   * Gizmo on point A when the measurement is focused
   */
  setupGizmo(id) {
    this.attachGizmoTo(id, "A");
  }

  /**
   * Attach the gizmo to sphere A or B; at the end of a drag that point is updated
   * @param {"A"|"B"} which
   */
  attachGizmoTo(id, which) {
    const handle = this.getHandles(id)?.[which];
    if (!handle) return;
    this.editor.setGizmoByNode(handle, "translate");
    this.gizmoManager.onChangeEnd(() =>
      this.update(id, { points: this.withPoint(id, which, toArray3(handle.position)) }, { source: "gizmo" })
    );
  }

  /**
   * Set active point button in inspector and reset the other
   * @param {'A'|'B'} activePointType - Which point button is active
   */
  setActivePointButton(activePointType) {
    for (const t of ["A", "B"]) {
      document
        .getElementById(`measure_inspector_btn_point_${t.toLowerCase()}`)
        ?.classList.toggle("Inspector_activeBtn", t === activePointType);
    }
  }

  /**
   * Field of point A or B, with its "Move" (gizmo) button
   * @param {'A'|'B'} pointType
   */
  createPointInspector(node, pointType) {
    const id = node.nid;
    const component = this.getComponent(id);
    if (!component) return null;
    const offset = pointType === "A" ? 0 : 3;
    const v = component.data.points.slice(offset, offset + 3);

    const btn = this.app.uikit.createButton({
      id: `measure_inspector_btn_point_${pointType.toLowerCase()}`,
      text: "Move",
      icon: this.app.ui.baseIcons + "translate.svg",
      compact: true,
      classList: pointType === "A" ? ["Inspector_activeBtn"] : [],
      onClick: () => {
        this.setActivePointButton(pointType);
        this.attachGizmoTo(id, pointType);
      },
    });
    btn.title = `Move point ${pointType} with the gizmo`;

    return this.app.widgetsHub.parsers.vector3({
      id: `measure_point${pointType}_v3`,
      title: `Point ${pointType}`,
      property: `point${pointType}`,
      v: { x: v[0], y: v[1], z: v[2] },
      onChange: (evt) => {
        const current = this.getComponent(id).data.points.slice(offset, offset + 3);
        const nv = this.vectorFromInput(evt, current);
        if (nv) this.update(id, { points: this.withPoint(id, pointType, nv) }, { source: "inspector" });
      },
      actions: [btn],
    });
  }

  /**
   * Delete a measurement
   */
  deleteItem(nid) {
    if (!this.editor.checkPendingPatch()) return;

    // Live changes
    this.gizmoManager.detachGizmo();
    this.deactiveItem(nid);
    this.removeComponent(nid);
    this.editor.activeNode = null;

    // Update local graph
    const scene = this.getCurrentScene();
    if (scene.measurements && scene.measurements[nid]) {
      delete scene.measurements[nid];
    }

    // Update UI editor
    this.app.ui.editor_updateWidgetMainPanel();
    this.editor.onCloseInspectorBtnClicked();

    this.composePatch(
      {
        measurements: {
          [nid]: {},
        },
      },
      ATON.SceneHub.MODE_DEL
    );
  }
}
