let gizmoManager = {};
let control;
let gizmo;
let bGizmo = false;
let currentMode;
let onChangeEndCb = null; // single "drag finished" callback, set by the focused widget

gizmoManager.setupGizmo=()=>{
    if(bGizmo) return;

    control = new THREE.TransformControls( ATON.Nav._camera, ATON._renderer.domElement );
    gizmo = control.getHelper();
    ATON._rootUI.add(gizmo);

    control.addEventListener('dragging-changed', function( event ){
        let bDrag = event.value;

        ATON.Nav.setUserControl(!bDrag);
        ATON._bPauseQuery = bDrag;

        if (!bDrag){
            ATON.recomputeSceneBounds();
            ATON.updateLightProbes();
        }
    });

    // One listener for the whole session: widgets swap the callback with onChangeEnd()
    control.addEventListener('mouseUp', (evt) => {
        if (onChangeEndCb) onChangeEndCb(evt);
    });

    bGizmo = true;

    gizmoManager.control = control;
    gizmoManager.gizmo = gizmo;
    gizmoManager.bGizmo = bGizmo;
    gizmoManager._currentMode = "translate";
}

gizmoManager.attachGizmoByNID=(nid, mode=null)=>{
    //Check Gizmo:
    if(!control) gizmoManager.setupGizmo();
    /*Check for gizmo.object to detached*/control.detach();
    if(mode==null) mode = gizmoManager._currentMode;
    let N = ATON.getSceneNode(nid);
    if (N === undefined) return;
    gizmoManager.attachGizmoToNode(N, mode);
}

gizmoManager.attachGizmoToNode=(n, mode=null)=>{
    if(!control) gizmoManager.setupGizmo();
    console.log(n);
    control.attach(n); 
    if(mode==null) mode = gizmoManager._currentMode;
    gizmoManager.setMode(mode);
    bGizmo=true;
    currentMode = mode;
}

gizmoManager.setMode=(mode)=>{
    control.setMode(mode);
    currentMode = mode;
    gizmoManager._currentMode = currentMode;
}

/**
 * Set what happens when a gizmo drag ends (replaces the previous callback).
 * Widgets use it to call widget.update(id, changes, {source:"gizmo"}).
 */
gizmoManager.onChangeEnd=(cb)=>{
    if(!control) gizmoManager.setupGizmo();
    onChangeEndCb = cb;
}

gizmoManager.detachGizmo=()=>{
    if(!control) return;
    control.detach();
    bGizmo=false;
}

export {gizmoManager}