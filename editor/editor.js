import { ui } from "./ui.js";
import { uikit } from "../src/js/uikit.js";
import { utils } from "../src/js/utility.js";
import { gizmoManager } from "../src/js/gizmo.js";
import { db } from "../src/js/db.js";
import { mediaLibrary } from "../src/js/mediaLibrary.js";
import { ModernWidgetHub } from "../src/js/ModernWidgetHub.js";
import { createExhibitionTemplate } from "../src/js/templates/templates.js";
import { createFreeTemplate } from "../src/js/templates/templates.js";

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
  APP.library = mediaLibrary;
  APP.editor = editor;
  APP.widgetsHub = new ModernWidgetHub(APP);
  editor.widgetsHub = APP.widgetsHub;

  //get sid
  const params = new URLSearchParams(window.location.search);
  if (!params) throw new Error("No params found");
  const sid = params.get("s");
  db.data.currSID = sid;

  //Load Scene:
  utils.loadScene(sid, async () => {
    db.data.currScene = ATON.SceneHub.currData;

    await editor.setupFromScene(db.data.currScene);
    // A click in the 3D view selects the item under the pointer
    APP.widgetsHub.enableClickSelection();
    editor.showWelcomeModal();
  });
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

//GIZMO HANDLERS:
editor.setGizmoByNode = (node, mode = null) => {
  gizmoManager.attachGizmoToNode(node, mode);
};
editor.setGizmoByNID = (nid, mode = null) => {
  gizmoManager.attachGizmoByNID(nid, mode);
};

// Gizmo "drag finished" callbacks: gizmoManager.onChangeEnd(cb), set by the widgets.
// Inspector fields are refreshed by widget.onItemUpdated after widget.update().

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

//MIXED TO MOVE OR MANAGE!
editor.onSaveSceneBtnIsClicked = () => {
  console.log("SaveSceneBtn Clicked");

  document.getElementById(ui.IDeditor_saveSceneBtn).classList.add("hidden");
  // editor.managePatches();
  editor.sendGlobalScenePatch();
};

editor.checkPendingPatch = () => {
  if (editor.patch) {
    UI.showModal({ body: "Apply edits first, then delete" });
    return false;
  } else return true;
};

/*NOTES:

WITH HATHOR SCENES CREATION objects inside the layers are not loaded as ATON-nodes: I can't edit transform properties.

*/

export { editor };
