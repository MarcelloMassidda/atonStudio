import { Widget } from "./base/Widget.js";

/**
 * Measurements Widget
 * Allows users to create and manage measurement lines in the scene
 */
export class MeasurementsWidget extends Widget {
  constructor(app) {
    const options = {
      id: "measurements",
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
      // Define how to get a specific item
      returnItem: (nid) => ATON.getSceneNode(nid),
      props: {
        PointA: {
          inspectorBlock: (node) => this.createPointAInspector(node),
          get: () => this.getPointA(),
        },
        PointB: {
          inspectorBlock: (node) => this.createPointBInspector(node),
          get: () => this.getPointB(),
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
    this.bMeasuring = false;

    // bind create button handler after super
    if (this.options && this.options.createBtnOptions) {
      this.options.createBtnOptions.onClick = () => this.createBtnClicked();
    }

    // Setup ATON tap event for measurement creation
    this.setupMeasurementEvents();
  }

  /**
   * Setup ATON events for measurement workflow
   */
  setupMeasurementEvents() {
    ATON.on("Tap", (e) => {
      console.log("Tap event detected in MeasurementsWidget");
      if (!this.bMeasuring) return;
      this.addMeasurePoint();
    });
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
   * Add measurement point (called on tap when measuring)
   */
  addMeasurePoint() {
    console.log("create new measurement");
    const P = ATON.getSceneQueriedPoint();
    const M = ATON.SUI.addMeasurementPoint(P);

    if (M === undefined) return;
    this.bMeasuring = false;

    // Create new measure info object
    const mid = ATON.Utils.generateID("meas");
    const measurementData = {
      points: [
        parseFloat(M.A.x.toPrecision(ATON.SceneHub.FLOAT_PREC)),
        parseFloat(M.A.y.toPrecision(ATON.SceneHub.FLOAT_PREC)),
        parseFloat(M.A.z.toPrecision(ATON.SceneHub.FLOAT_PREC)),
        parseFloat(M.B.x.toPrecision(ATON.SceneHub.FLOAT_PREC)),
        parseFloat(M.B.y.toPrecision(ATON.SceneHub.FLOAT_PREC)),
        parseFloat(M.B.z.toPrecision(ATON.SceneHub.FLOAT_PREC)),
      ],
    };

    // Update local graph
    const scene = this.getCurrentScene();
    if (!scene.measurements) scene.measurements = {};
    scene.measurements[mid] = measurementData;

    // Focus on item - this will call activeItem internally via widgetsHub
    this.app.widgetsHub.focusOnItem({ id: mid, wid: this.id });

    // Update UI
    this.app.ui.toggle_sideMenus(true);
    this.app.ui.editor_updateWidgetMainPanel();
    this.app.ui.editor_removeCentralHelperPanel();

    // Send patch
    this.composePatch({
      measurements: {
        [mid]: measurementData,
      },
    });
  }

  /**
   * Active item - create 3D icon for measurement
   */
  activeItem(meas_id) {
    if (!meas_id) return;

    console.log("active item: " + meas_id);

    // Deactivate previous if exists
    if (
      this.editor.activeNode &&
      this.editor.activeWidget.id === "measurements"
    ) {
      this.deactiveItem(this.editor.activeNode.nid);
    }

    // Get measurement info from scene
    const scene = this.getCurrentScene();
    const measure = scene.measurements?.[meas_id];
    if (!measure) throw new Error("no measure found for: " + meas_id);

    // Create 3D icon
    const p = measure.points;
    const tmpMeasurementIcon = ATON.createSceneNode(meas_id);
    const icon = this.app.uikit.MEASURE_3Dicon(
      [p[0], p[1], p[2]],
      [p[3], p[4], p[5]]
    );
    tmpMeasurementIcon.add(icon);
    tmpMeasurementIcon.attachToRoot();
  }

  /**
   * Deactivate measurement item - remove 3D icon
   */
  deactiveItem(id) {
    const node = ATON.getSceneNode(id);
    if (node) node.delete();
  }

  /**
   * Called when losing focus to another widget - cleanup 3D icon
   */
  onLoseFocus(item) {
    if (item && item.nid) {
      this.deactiveItem(item.nid);
    }
  }

  /**
   * Focus item - navigate to measurement line
   */
  _focusItem(item) {
    if (!item) {
      console.error("ATON NODE NOT FOUND");
      return;
    }
    console.log(item);
    const line = item.children[1];
    if (line) {
      ATON.Nav.requestPOVbyNode(line, 0.3);
    } else {
      console.error("Measurement line not found");
    }
  }

  /**
   * Remove all measurements from UI root
   */
  removeAllMeasurements() {
    if (ATON._rootUI && ATON._rootUI.children[3]) {
      ATON._rootUI.children[3].removeChildren();
    }
  }

  /**
   * Update all measurements in the scene
   */
  updateMeasurements(measurements) {
    this.removeAllMeasurements();

    for (const m in measurements) {
      const measure = measurements[m];

      if (measure.points && measure.points.length === 6) {
        const A = new THREE.Vector3(
          parseFloat(measure.points[0]),
          parseFloat(measure.points[1]),
          parseFloat(measure.points[2])
        );
        const B = new THREE.Vector3(
          parseFloat(measure.points[3]),
          parseFloat(measure.points[4]),
          parseFloat(measure.points[5])
        );
        ATON.SUI.addMeasurementPoint(A);
        ATON.SUI.addMeasurementPoint(B);
      }
    }
  }

  /**
   * Setup gizmo for measurement
   */
  setupGizmo(id) {
    const node = ATON.getSceneNode(id);
    if (!node) return;

    const A = node.children[0].children[0];
    this.editor.setGizmoByNode(A, "translate");
    this.editor.udpateGizmoOnMouseUpListener((evt) =>
      this.onPointAGizmoChange(evt)
    );
  }

  /**
   * Handle Point A gizmo change
   */
  onPointAGizmoChange(evt) {
    // Adjust measurement 3D icon in realtime
    this.onMeasurementPropertyChange(evt);

    // Update inspector
    const inspectorUpdater = this.editor.gizmoToInspectorMapper({
      translate: {
        idVector3UIContainer: "measure_pointA_v3",
        getProperty: (n) => n.position,
      },
    });
    inspectorUpdater(evt);
  }

  /**
   * Handle Point B gizmo change
   */
  onPointBGizmoChange(evt) {
    // Adjust measurement 3D icon in realtime
    this.onMeasurementPropertyChange(evt);

    // Update inspector
    const inspectorUpdater = this.editor.gizmoToInspectorMapper({
      translate: {
        idVector3UIContainer: "measure_pointB_v3",
        getProperty: (n) => n.position,
      },
    });
    inspectorUpdater(evt);
  }

  /**
   * Handle measurement property change
   */
  onMeasurementPropertyChange(evt) {
    console.log("measure update");

    // Update line
    const node = this.editor.activeNode;
    const nid = node.nid;
    const a = node.children[0].children[0];
    const b = node.children[0].children[1];
    const aPos = a.position;
    const bPos = b.position;

    // Recreate measurements from currScene
    const scene = this.getCurrentScene();
    scene.measurements[nid] = {
      points: [aPos.x, aPos.y, aPos.z, bPos.x, bPos.y, bPos.z],
    };
    this.updateMeasurements(scene.measurements);

    // Compose patch
    this.composePatchForActiveNode();
  }

  /**
   * Compose patch for active node
   */
  composePatchForActiveNode() {
    const node = this.editor.activeNode;
    if (!node) throw new Error("no node");

    const nid = node.nid;
    const a = this.getPointA();
    const b = this.getPointB();

    this.composePatch({
      measurements: {
        [nid]: {
          points: [a.x, a.y, a.z, b.x, b.y, b.z],
        },
      },
    });
  }

  /**
   * Set active point button in inspector and reset the other
   * @param {'A'|'B'} activePointType - Which point button is active
   */
  setActivePointButton(activePointType) {
    const btnPointA = document.getElementById("measure_inspector_btn_point_a");
    const btnPointB = document.getElementById("measure_inspector_btn_point_b");

    if (!btnPointA || !btnPointB) return;

    if (activePointType === "A") {
      btnPointA.classList.add("Inspector_activeBtn");
      btnPointB.classList.remove("Inspector_activeBtn");
    } else {
      btnPointB.classList.add("Inspector_activeBtn");
      btnPointA.classList.remove("Inspector_activeBtn");
    }
  }

  /**
   * Create inspector for a measurement point
   * @param {THREE.Object3D} node - The measurement node
   * @param {'A'|'B'} pointType - Which point to create inspector for
   * @returns {HTMLElement} Inspector block element
   */
  createPointInspector(node, pointType) {
    const pointIndex = pointType === "A" ? 0 : 1;
    const point = node.children[0].children[pointIndex];
    const gizmoHandler =
      pointType === "A"
        ? (evt) => this.onPointAGizmoChange(evt)
        : (evt) => this.onPointBGizmoChange(evt);

    const btnId = `measure_inspector_btn_point_${pointType.toLowerCase()}`;
    const btn = this.app.uikit.createButton({
      id: btnId,
      text: `Point ${pointType}`,
      classList: pointType === "A" ? ["Inspector_activeBtn"] : [],
      onClick: () => {
        this.setActivePointButton(pointType);
        this.editor.setGizmoByNode(point);
        this.editor.udpateGizmoOnMouseUpListener(gizmoHandler);
      },
    });

    return this.app.uikit.createContainer({
      classList: ["inspector_Block"],
      content: [
        btn,
        this.app.widgetsHub.parsers.vector3({
          id: `measure_point${pointType}_v3`,
          title: `Point ${pointType} position`,
          property: "position",
          v: point.position,
          target: point,
          onChange: (evt) => this.onMeasurementPropertyChange(evt),
        }),
      ],
    });
  }

  /**
   * Create Point A inspector
   */
  createPointAInspector(node) {
    return this.createPointInspector(node, "A");
  }

  /**
   * Create Point B inspector
   */
  createPointBInspector(node) {
    return this.createPointInspector(node, "B");
  }

  /**
   * Create delete button
   */
  createDeleteButton(node) {
    return this.app.uikit.deleteButton({
      icon: "trash",
      text: "Remove",
      onClick: () => this.deleteMeasurement(node.nid),
    });
  }

  /**
   * Get Point A from active node
   */
  getPointA() {
    const node = this.editor.activeNode;
    if (!node) return null;
    return node.children[0].children[0].position;
  }

  /**
   * Get Point B from active node
   */
  getPointB() {
    const node = this.editor.activeNode;
    if (!node) return null;
    return node.children[0].children[1].position;
  }

  /**
   * Delete a measurement
   */
  deleteMeasurement(nid) {
    if (!this.editor.checkPendingPatch()) return;

    // Live changes
    this.gizmoManager.detachGizmo();
    this.deactiveItem(nid);
    this.editor.activeNode = null;

    // Update local graph
    const scene = this.getCurrentScene();
    if (scene.measurements && scene.measurements[nid]) {
      delete scene.measurements[nid];
    }

    // Recreate all measurements from scene graph
    this.updateMeasurements(scene.measurements);

    // Update UI editor
    this.app.ui.editor_updateWidgetMainPanel();
    this.editor.onCloseInspectorBtnClicked();

    // Compose and send delete patch
    if (!nid) throw new Error("error deleting measurement");

    this.composePatch(
      {
        measurements: {
          [nid]: {},
        },
      },
      ATON.SceneHub.MODE_DEL
    );

    console.log(`🗑️ Deleted measurement: ${nid}`);
  }
}
