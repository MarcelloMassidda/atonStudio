import { ui } from "./ui.js";
import { uikit } from "../src/js/uikit.js";
import { utils } from "../src/js/utility.js";
import { gizmoManager } from "../src/js/gizmo.js";
import { db } from "../src/js/db.js";
import { ModernWidgetHub } from "../src/js/ModernWidgetHub.js";
import { createExhibitionTemplate } from "../src/js/templates/templates.js";
import { createFreeTemplate } from "../src/js/templates/templates.js";
import { SceneMigration } from "../src/js/sceneMigration.js";

let APP;

let editor = { db };

editor.init = () => {
  editor.checkUser((user) => editor.initialize());
};

editor.initialize = () => {
  APP = window.APP;
  APP.db = db;
  APP.gizmoManager = gizmoManager;
  APP.ui = ui;
  APP.uikit = uikit;
  APP.UI = UI;
  APP.editor = editor;
  APP.widgetsHub = new ModernWidgetHub(APP);
  editor.widgetsHub = APP.widgetsHub;

  //get sid
  const params = new URLSearchParams(window.location.search);
  if (!params) throw new Error("No params found");
  const sid = params.get("s");
  db.data.currSID = sid;
  db.initWebDavUser();

  //Load Scene:
  utils.loadScene(sid, async () => {
    db.data.currScene = ATON.SceneHub.currData;
    
    // Auto-migrate scene data (capabilities → behaviours)
    db.data.currScene = SceneMigration.migrateScene(db.data.currScene);
    
    await editor.setupFromScene(db.data.currScene);
    editor.TestCustomEventsSetup();
    editor.showWelcomeModal();
  });
};

editor.TestCustomEventsSetup = () => {
  ATON.on("KeyPress", function (k) {
    console.log("KeyPress event detected: " + k);
    if (k === "x") ATON.fireEvent("myEvent", ATON._queryDataScene);
  });

  // ...and here we handle our event!
  ATON.on("myEvent", function (p) {
    console.log(p);

    editor.focusOnItemByQueryDataScene(p.o);

    window.p = p;
    return;
    if (p === undefined) return; // no picked point, nothing to do

    p.y += 0.5; // add a little height offset

    ATON.createSceneNode()
      .load("samples/models/atoncube.glb")
      .setPosition(p)
      .attachToRoot();
  });
};

editor.focusOnItemByQueryDataScene = (o) => {
  const rootUUID = ATON.getRootScene().uuid;

  // Recursive function to get the last parent before root
  const getLastParent = (object) => {
    if (!object.parent || object.parent.uuid === rootUUID) {
      return object; // This is the last parent before root
    }
    return getLastParent(object.parent); // Keep going up
  };

  const lastParent = getLastParent(o);

  if (!lastParent.name) {
    console.log("no name!");
    return;
  }

  console.log("Last Parent Name is: " + lastParent.name);
  let { widgetKey, item } = editor.findIteminWidgets(lastParent.name);
  if (!widgetKey) {
    console.log("no widget!");
    return;
  }

  APP.widgetsHub.focusOnItem({ id: lastParent.name, wid: widgetKey });
};

editor.findIteminWidgets = (name) => {
  for (const [key, widget] of APP.widgetsHub.widgets.entries()) {
    const items = widget.getItems();
    if (items && items[name] !== undefined) {
      return {
        widgetKey: key,
        item: items[name],
      };
    }
  }

  console.log("Widget not found");
  return null;
};

editor.showWelcomeModal = () => {
  if (!APP.config) return;
  if (!APP.config.welcomeText) return;

  let welcomeContent = "";
  //1 Welcome Hero Image
  if (APP.config.welcomeHeroImagePath) {
    let _path =
      ATON.PATH_COLLECTION +
      APP.config.baseMediaPath +
      APP.config.welcomeHeroImagePath;
    welcomeContent += `
        <div>
            <div class="img-fluid">
            <div class="card-img-top centerCropped" 
             style="background-image: url('${_path}'); height:625px"></div>`;
  }
  //2 Welcome Html Text:
  // welcomeContent += `${APP.config.welcomeText}`
  welcomeContent += `</div>`;
  console.log(welcomeContent);
  //3 Compose and show Modal

  let _elModal = ATON.UI.elModal.children[0];
  _elModal.children[0].classList.add("customModal");

  UI.showModal({
    iscustom: true, //TO DELETE, USED FOR SITEM
    size: "xl",
    //    header:"Your next exhibition can be just a click away",
    body: uikit.createElfromString(welcomeContent),
    footer: uikit.createButton({
      variant: "primary",
      text: "Start Design",
      onClick: () => {
        ATON.UI.hideModal();
        _elModal.children[0].classList.remove("customModal");
      },
    }),
  });
};

editor.checkUser = (callback) => {
  console.log("checking user");
  db.getUser((user) => {
    console.log(user);
    if (Object.keys(user).length === 0) {
      var _url = window.location.href;
      window.location.href =
        window.location.origin + "/login/" + "?u=" + _url;
    } else {
      db.data.user = user;
    }
    callback();
  });
};

editor.setupFromScene = async (s = null) => {
  //setup:
  editor.currScene = db.data.currScene;
  editor.currSID = db.data.currSID;
  editor.autoSaveMode = true;

  // Use exhibition template for now
  const template = createExhibitionTemplate(APP);

  //Use Free template:
  //const template = createFreeTemplate(APP);
  await template.applyToEditor(editor);

  //Setup UI:
  ui.editorUI_Setup(db.data.currScene);

  //SETUP 3D HELPERS:
  const size = 10;
  const divisions = 10;
  editor.gridHelper = new THREE.GridHelper(size, divisions);
  //ATON.getRootScene().add(editor.gridHelper);
};

/**
 * Register all available widgets for the editor
 */
/** NO SENSE
 * Get appropriate template based on scene configuration

editor.getTemplateForScene = (scene) => {
  const {
    createFreeTemplate,
    createExhibitionTemplate,
  } = require("../src/js/templates/templates.js");

  // Example: choose template based on scene configuration
  if (scene.type === "exhibition") {
    return createExhibitionTemplate(APP);
  }

  // Default to free templatew
  return createFreeTemplate(APP);
};
 */

//GIZMO HANDLERS:
editor.setGizmoByNode = (node, mode = null) => {
  gizmoManager.attachGizmoToNode(node, mode);
};
editor.setGizmoByNID = (nid, mode = null) => {
  gizmoManager.attachGizmoByNID(nid, mode);
};

editor.udpateGizmoOnMouseUpListener = (handler) => {
  if (!gizmoManager.control) {
    console.log("NO GIZMO CONTROL");
    return;
  }

  gizmoManager.control._listeners.mouseUp = undefined;
  gizmoManager.control.addEventListener("mouseUp", handler);
};

editor.gizmoToInspectorMapper = (o) => {
  //example for viewpoints position:
  const _o = {
    translate: {
      idVector3UIContainer: "viepoints_position_V3",
      getProperty: (n) => {
        return n.position;
      },
    },
    rotate: null,
    scale: null,
  };

  const gizmoHandler = (evt) => {
    const gizmoOptions = o;
    console.log(gizmoOptions);

    //get current gizmo mode
    let _mode = evt.mode;
    console.log(_mode);

    //get relevant property of ATON Node according with gizmoMode
    let _v = gizmoOptions[_mode].getProperty(gizmoManager.control.object);

    //Update Inspector
    ui.updateVector3UI(gizmoOptions[_mode].idVector3UIContainer, _v);
  };

  return gizmoHandler;
};

editor.onGizmoMouseUp = (evt) => {
  console.log("editor handler: ");
  console.log(evt);
  window.gizmoEVT = evt;

  //if(ATON._gizmo.object.uuid != APP.dashboard.editor.activeNode.uuid) return;
  if (gizmoManager.control.object.uuid != APP.dashboard.editor.activeNode.uuid)
    return;

  const gizmoHandler = {
    translate: {
      propertyName: "position",
      idVector3UIContainer: ui.IDeditor_inspectorTransform_pos,
      getProperty: (n) => {
        return n.position;
      },
    },
    rotate: {
      propertyName: "rotation",
      idVector3UIContainer: ui.IDeditor_inspectorTransform_rot,
      getProperty: (n) => {
        let rot = n.rotation;
        return { x: rot._x, y: rot._y, z: rot._z };
      },
    },
    scale: {
      propertyName: "scale",
      idVector3UIContainer: ui.IDeditor_inspectorTransform_scale,
      getProperty: (n) => {
        return n.scale;
      },
    },
  };

  let _mode = evt.mode;
  console.log(_mode);
  let _v = gizmoHandler[_mode].getProperty(
    gizmoManager.control.object /*ATON._gizmo.object*/
  );
  //let _v = ATON._gizmo.object[gizmoHandler[_mode].nodePropertyToCopy];

  ui.updateVector3UI(gizmoHandler[_mode].idVector3UIContainer, _v);

  console.log("GIMZING");
  console.log(_v);
  window.v = _v;

  //compose Patch for x/y/z
  for (const [key, value] of Object.entries(_v)) {
    console.log(`${key}: ${value}`);

    var _dimension = key;
    var _value = value;

    var bodyPatch = {
      nid: gizmoManager.control.object.nid, // ATON._gizmo.object.nid,
      type: "transformNode",
      property: gizmoHandler[_mode].propertyName,
      dimension: _dimension,
      value: _value,
    };

    editor.composePatch(bodyPatch);
  }
};

//INSPECTOR HANDLERS:
editor.onCloseInspectorBtnClicked = () => {
  console.log("INSPECTOR CLOSE BTN CLICKED");
  //Ensure closing inspector:
  if (APP.uikit.offcanvas_end) APP.uikit.offcanvas_end.hide();
  /*hide GizmoToolbox*/
  let gizmoBox = document.getElementById(ui.IDeditor_centralToolBoxContainer);
  if (gizmoBox) gizmoBox.classList.add("hidden");

  /*remove inspector*/
  let inspector = document.getElementById(ui.IDeditor_Inspector);
  if (inspector) inspector.remove();

  /*detach Gizmo*/
  gizmoManager.detachGizmo(); //UI.detachGizmo();

  /*deactive previews widget-item*/
  if (editor.activeWidget) {
    if (editor.activeWidget.deactiveItem) {
      if (editor.activeNode) {
        editor.activeWidget.deactiveItem(editor.activeNode.nid);
      }
    }
  }

  /*reset editor globals*/
  editor.activeNode = null;
  editor.activeWidget = null;
  APP.ui.resetStyleOfActiveBtns();
};

//PATCH HANDLERS:

editor.OnPatchChanged = () => {
  //OK
  if (editor.autoSaveMode) {
    console.log("path changed: autosave");
    // editor.managePatches();
    editor.sendGlobalScenePatch();
  } else {
    console.log("path changed: autosave FALSE");
    document
      .getElementById(ui.IDeditor_saveSceneBtn)
      .classList.remove("hidden");
  }
};

editor.managePatches = () => {
  //QUEUE PATCH, NOT USED
  if (editor.patchReqList) {
    editor.sendPatchQueue(editor.patchReqList);
  } //editor.patchReqList NOT USED.
  else {
    editor.sendGlobalScenePatch();
  }
};

editor.sendGlobalScenePatch = (onComplete = null) => {
  //OK
  if (!editor.patch || editor.patch == {}) {
    console.log("SCENE PATCH NOT EXIST");
    return;
  }
  console.log("SENDING PATCH:");

  let _sid = editor.currSID;
  let _patch = editor.patch;
  let _mode = editor.modePatch;
  console.log(_patch);
  console.log(_mode);
  editor.modePatch = null;
  editor.patch = null;

  db.sendSceneEdit(_sid, _patch, _mode, onComplete);
};

editor.sendPatchQueue = (patchReqList) => {
  //QUEUE PATCH, NOT USED
  if (!patchReqList) return;
  console.log(patchReqList);
  var index = 0;

  const sendPatchQueued = (req) => {
    console.log(req);

    var _onComplete = null;

    editor.patch = req.patch;
    editor.modePatch = req.modePatch;

    index++;
    console.log("index is: " + index);
    const nextReq = patchReqList[index];
    console.log(nextReq);
    if (nextReq) {
      _onComplete = () => sendPatchQueued(nextReq);
    } else {
      _onComplete = () => {
        console.log("queue finished");
      };
    }

    editor.sendGlobalScenePatch(_onComplete);
  };

  sendPatchQueued(patchReqList[index]);
};

editor._composePatch = (o) => {
  //OLD!!

  if (!o.type) return;

  let _patch = null;

  if (o.type == "transformNode") {
    editor.modePatch = ATON.SceneHub.MODE_ADD;

    console.log("type of action is: " + o.type + ": dimension: " + o.dimension);
    console.log(o);
    /*
    type:"transform"
    nid  ....maybe not?
    property: "scale" | "rotation" | "position"
    dimension: x | y | z
    value: float
    */

    const property = o.property;
    const dimension = o.dimension;
    const value = o.value;

    const vector3Indexes = { x: 0, y: 1, z: 2 };
    const defaultTransform = {
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    };

    let nid = editor.activeNode.nid;
    _patch = editor.patch ? editor.patch : { scenegraph: { nodes: {} } };
    if (!_patch.scenegraph.nodes[nid]) _patch.scenegraph.nodes[nid] = {};
    if (!_patch.scenegraph.nodes[nid].transform)
      _patch.scenegraph.nodes[nid].transform = {};
    if (!_patch.scenegraph.nodes[nid].transform[property]) {
      let _t = defaultTransform[property];
      try {
        let prevT = editor.currScene.scenegraph.nodes[nid].transform[property];
        if (prevT) _t = prevT;
        console.log("SETTED PREV T AS: ");
        console.log(prevT);
      } catch (e) {
        console.log(_t);
        console.error(e.message);
      }
      _patch.scenegraph.nodes[nid].transform[property] = _t;
      console.log("prev or fresh t: ");
      console.log(_t);
    }

    _patch.scenegraph.nodes[nid].transform[property][
      vector3Indexes[dimension]
    ] = value;

    console.log("edited t: ");
    console.log(_patch.scenegraph.nodes[nid].transform[property]);
    console.log(_patch);
  }

  if (o.type == "addNode") {
    editor.modePatch = ATON.SceneHub.MODE_ADD;

    const nid = o.nid;
    const nodeBody = o.nodeBody;

    _patch = editor.patch ? editor.patch : { scenegraph: { nodes: {} } };
    if (_patch.scenegraph.nodes[nid]) {
      throw nid + " node ID is already used.";
    }

    _patch.scenegraph.nodes[nid] = nodeBody;
    _patch.scenegraph.edges = editor.currScene.scenegraph.edges;
  }

  if (o.type == "removeNode") {
    editor.modePatch = ATON.SceneHub.MODE_DEL;
    let nodes = {};
    nodes[o.nid] = {};
    _patch = editor.patch
      ? editor.patch
      : { scenegraph: { nodes, edges: { ".": [o.nid] } } };
  }

  editor.patch = _patch;
  editor.OnPatchChanged();
};

//MIXED TO MOVE OR MANAGE!
editor.onSaveSceneBtnIsClicked = () => {
  console.log("SaveSceneBtn Clicked");

  document.getElementById(ui.IDeditor_saveSceneBtn).classList.add("hidden");
  // editor.managePatches();
  editor.sendGlobalScenePatch();
};

editor.onRemoveModelBtnClicked = async () => {
  //OLD!   NOT USED!!!
  if (!editor.activeNode) return;
  let nid = APP.dashboard.editor.activeNode.nid;

  //prompt conferm todo
  var conferm = await UI.promptConfermDialog({
    body: "Vuoi eliminare questo oggetto?",
    confermText: "ELIMINA",
    resumeText: "ANNULLA",
  });
  if (!conferm) return;

  const onRemoveConfermed = () => {
    console.log("CANCELING: " + nid);

    //Realtime Changes:
    UI.detachGizmo(); //OLD use gizmoManager.detachGizmo instead
    APP.dashboard.editor.activeNode.delete();
    delete APP.dashboard.editor.currScene.scenegraph.nodes[nid];

    //Local SceneGraph changes:
    var _edges = APP.dashboard.editor.currScene.scenegraph.edges["."];
    const i = _edges.indexOf(nid);
    if (i <= -1) window.alert("error removing node");
    APP.dashboard.editor.currScene.scenegraph.edges["."] = _edges.splice(i, 1);

    //Patch
    const bodyPatch = {
      type: "removeNode",
      nid,
    };

    editor.composePatch(bodyPatch);
    ui.editor_updateHierarchy();
    editor.onCloseInspectorBtnClicked();
  };

  onRemoveConfermed();
};

editor.deleteAnnotation = (o) => {
  //Compose
  if (!o.nid) throw "error deleting annotations";
  let nodes = {};
  nodes[o.nid] = {};
  let _patch = { semanticgraph: { nodes } };
  //Patch
  editor.patch = _patch;
  editor.modePatch = ATON.SceneHub.MODE_DEL;
  editor.OnPatchChanged();
};

editor.checkPendingPatch = () => {
  if (editor.patch) {
    UI.showModal({ body: "Apply edits first, then delete" });
    return false;
  } else return true;
};

//SNIPPET TO DELETE:

//editor.modePatch = ATON.SceneHub.MODE_DEL;
//let nodes={};  nodes[o.nid]= {};
//_patch = editor.patch? editor.patch : {scenegraph:{nodes, edges:{".":[o.nid]}}};

/*NOTES:

WITH HATHOR SCENES CREATION objects inside the layers are not loaded as ATON-nodes: I can't edit transform properties.

*/

export { editor };
