import { Widget } from "./base/Widget.js";
import { ViewpointComponent } from "../components/components.js";
import { toArray3 } from "../components/Component.js";

/**
 * Widget for managing viewpoints (Points of View) in the scene.
 * Component: ViewpointComponent (the data). The 3D icon — a helper (UI) node named
 * after the viewpoint, holding [sphere, line, cone] — is an editor helper.
 */
export class PointOfViewWidget extends Widget {
  constructor(app) {
    const options = {
      id: "viewpoints",
      component: ViewpointComponent,
      deletable: true,
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
      returnItem: (nid) => this.getHelperNode(nid),
      props: {
        position: { inspectorBlock: (node) => this.createPointInspector("position", node) },
        target: { inspectorBlock: (node) => this.createPointInspector("target", node) },
        fov: { inspectorBlock: (node) => this.createFovInspector(node) },
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
   * Authoring of the ViewpointComponent actions (runtime: flare "goToPov")
   */
  getActionAuthoring(actionId) {
    if (actionId !== "goToPov") return {};
    return {
      getProperties: ({ node, actionId, args }) => ({
        pov: {
          inspectorBlock: () => this.createPOVSelectionBlock(node, actionId, args),
        },
      }),
      onReferencedItemDeleted: (deletedItemId, actionInstance) =>
        actionInstance.args?.targetPOVId === deletedItemId
          ? { shouldRemove: true, reason: `Viewpoint "${deletedItemId}" was deleted` }
          : { shouldRemove: false },
    };
  }

  /**
   * Create POV selection block for action inspector
   */
  createPOVSelectionBlock(node, actionId, args) {
    const selectedPOVId = args?.targetPOVId;
    const btn = this.app.uikit.createButton({
      text: selectedPOVId || "Select viewpoint…",
      icon: "pov",
      compact: true,
      block: true,
      onClick: () => this.openPOVSelectionModal(node, actionId),
    });
    btn.classList.add("insp-picker");
    return this.app.uikit.createContainer({
      classList: ["inspector_Block"],
      content: [this.app.uikit.field({ label: "Viewpoint", control: btn })],
    });
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
    if (typeof actions !== 'object' || Array.isArray(actions)) return;

    // Find the specific action by actionId in dictionary and update its args
    const action = actions[actionId];
    if (action) {
      if (!action.args) action.args = {};
      action.args.targetPOVId = targetPOVId;

      // Local data is already updated by reference

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
   * Create the editor icon of a viewpoint (helper node named after it).
   * The line is not hittable: three.js picks lines within 1 unit, so it would
   * catch clicks around it; sphere and cone select the viewpoint.
   */
  addItemToScene(vId) {
    const { position, target } = this.getComponent(vId).data;
    this.createHelperNode(vId, this.app.uikit.POV_3Dicon(position, target));
    this.getIconParts(vId).line.raycast = ATON.Utils.VOID_CAST;
  }

  /** Icon parts: [sphere (position), line, cone (target)] */
  getIconParts(vId) {
    const icon = this.getHelperNode(vId)?.children[0];
    if (!icon) return null;
    const [sphere, line, cone] = icon.children;
    return { sphere, line, cone };
  }

  /**
   * Move the icon to the component's data (in place: the gizmo stays attached)
   */
  updateIcon(vId) {
    const parts = this.getIconParts(vId);
    const component = this.getComponent(vId);
    if (!parts || !component) return;

    const p = new THREE.Vector3(...component.data.position);
    const t = new THREE.Vector3(...component.data.target);
    parts.sphere.position.copy(p);
    parts.cone.position.copy(t);
    parts.cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), t.clone().sub(p).normalize());
    parts.line.geometry.dispose();
    parts.line.geometry = new THREE.BufferGeometry().setFromPoints([p, t]);
  }

  /**
   * After update(): move the icon and refresh the fields
   */
  onItemUpdated(id, component, source) {
    this.updateIcon(id);
    if (source === "inspector") return;
    this.setVectorField("viewpoints_position_V3", component.data.position);
    this.setVectorField("viewpoints_target_V3", component.data.target);
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
          legendText: "Viewpoint ID",
          value: newGeneratedId,
          required: true,
        },
        {
          type: "checkbox",
          name: "fromCurrView",
          legendText: "Orientation",
          labelText: "Use the current camera view",
          checked: "checked",
        },
      ],
      title: "New viewpoint",
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

    // Component + editor icon, then save (local scene + patch)
    this.addComponent(dataPOV.id, bodyPov);
    this.addItemToScene(dataPOV.id);
    this.saveItem(dataPOV.id);

    // Focus on new viewpoint
    this.app.widgetsHub.focusOnItem({ id: dataPOV.id, wid: this.id });

    // Update UI
    this.app.ui.editor_updateWidgetMainPanel();
  }

  /**
   * Gizmo on the position sphere when the viewpoint is focused
   */
  setupGizmo(id) {
    this.attachGizmoTo(id, "position");
  }

  /**
   * Attach the gizmo to one part of the icon; at the end of a drag the new
   * position of that part becomes position/target of the viewpoint
   * @param {"position"|"target"} part
   */
  attachGizmoTo(id, part) {
    const parts = this.getIconParts(id);
    if (!parts) return;
    const handle = part === "position" ? parts.sphere : parts.cone;
    this.editor.setGizmoByNode(handle, "translate");
    this.gizmoManager.onChangeEnd(() =>
      this.update(id, { [part]: toArray3(handle.position) }, { source: "gizmo" })
    );
  }

  /**
   * Position / target field with its "Move" (gizmo) button
   * @param {"position"|"target"} part
   */
  createPointInspector(part, node) {
    const id = node.nid;
    const data = this.getComponent(id)?.data;
    if (!data) return null;
    const v = data[part];
    return this.app.widgetsHub.parsers.vector3({
      id: `viewpoints_${part}_V3`,
      title: part === "position" ? "Position" : "Target",
      property: part,
      v: { x: v[0], y: v[1], z: v[2] },
      onChange: (evt) => {
        const nv = this.vectorFromInput(evt, this.getComponent(id).data[part]);
        if (nv) this.update(id, { [part]: nv }, { source: "inspector" });
      },
      // setupGizmo attaches the gizmo to the position when the POV is focused
      actions: [this.createGizmoButton(id, part, part === "position")],
    });
  }

  /**
   * "Move" button next to a vector field: attaches the gizmo to that part of the POV
   */
  createGizmoButton(id, part, active) {
    const btn = this.app.uikit.createButton({
      id: `viewpoints_btn_${part}`,
      text: "Move",
      icon: this.app.ui.baseIcons + "translate.svg",
      compact: true,
      onClick: () => {
        for (const p of ["position", "target"]) {
          document.getElementById(`viewpoints_btn_${p}`)?.classList.toggle("Inspector_activeBtn", p === part);
        }
        this.attachGizmoTo(id, part);
      },
    });
    btn.title = `Move the ${part} with the gizmo`;
    if (active) btn.classList.add("Inspector_activeBtn");
    return btn;
  }

  /**
   * Create FOV inspector
   */
  createFovInspector(node) {
    const id = node.nid;
    return this.app.widgetsHub.parsers.float({
      id: "viewpoints_fov",
      title: "Field of view (°)",
      name: "fov",
      v: this.getComponent(id)?.data.fov,
      step: 1,
      onChange: (evt) => {
        const fov = parseFloat(String(evt.target.value).replaceAll(",", "."));
        if (!Number.isNaN(fov)) this.update(id, { fov }, { source: "inspector" });
      },
    });
  }

  /**
   * Delete viewpoint
   */
  deleteItem(nid) {
    if (!this.editor.checkPendingPatch()) return;

    // Detach gizmo first
    this.gizmoManager.detachGizmo();
    this.removeComponent(nid);

    // Delete the editor icon
    const viewpointNode = this.getHelperNode(nid);
    if (!viewpointNode) {
      console.error(`Viewpoint node ${nid} not found`);
      return;
    }
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

    // Clean up any actions referencing this POV (AFTER delete patch sent)
    this.app.widgetsHub.cleanupActionsForDeletedItem({
      deletedItemId: nid,
      widgetId: this.id,
      actionType: 'goToPov'
    });
  }
}
