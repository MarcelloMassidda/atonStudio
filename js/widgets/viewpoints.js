var widgetsHub = null;
var editor = null;

/*Globals utils for viewpointsWidget*/

const viewpointsOnChangeProp=(evt)=>{
    
    console.log(evt);
    if(evt.target) { if(evt.target.name=="fov"){console.log("CHANGING FOV") } }
   // if(evt.target) { if(evt.target.name=="home"){console.log("CHANGING HOME") } }

    //Re-create viewpoint icon
    let node = editor.activeNode;
    let nid = node.nid;
    let pos = node.children[0].children[0].position;
    let target =  node.children[0].children[2].position;
    let p_pos = [pos.x,pos.y,pos.z];
    let p_target = [target.x,target.y,target.z];
    ATON.getSceneNode(nid).delete();
    editor.widgetsHub.widgets.viewpoints.addItemToScene(nid,{position:p_pos,target:p_target});
    
    viewpoints_composePatch();
}

const viewpointGizmoHandlers={

    position:(evt)=>{
        //Adjust viewpoint 3D icon in realtime
        viewpointsOnChangeProp(evt);
         //Update inpsector
        const inpsectorUpdater = editor.gizmoToInspectorMapper({
            translate:{
                idVector3UIContainer:"viepoints_position_V3",
                getProperty:(n)=> {return n.position}}
            })
        inpsectorUpdater(evt);
    },
    target:(evt)=>{
        //Adjust viewpoint 3D icon in realtime 
        viewpointsOnChangeProp(evt);
        //Update inpsector
        const inpsectorUpdater = editor.gizmoToInspectorMapper({
            translate:{
                idVector3UIContainer:"viepoints_target_V3",
                getProperty:(n)=> {return n.position}}
            })
        inpsectorUpdater(evt);
    }
}


const viewpointSetAsHome=(evt)=>{ ///ABORTED
    let currScene = widgetsHub.currScene();
    let w = editor.activeWidget;

    //get CurrentPatch
    let _patch = editor.patch? editor.patch : {};
    if(!_patch.viewpoints) _patch.viewpoints = {};

    let node = editor.activeNode;
    let _id = node.id;
    let bHome = evt.target.checked;

    let currPov = {
        fov: w.props.fov.get(node.nid),
        position: w.props.position.get(node.nid),
        target: w.props.target.get(node.nid),
    }

    let id_pov_NOTHOME = ()=>{
        // Find the first key that is not "home"
        let noHomePov;
        let _items = w.items();
        
        for (let idpov in _items) {
            if (idpov !== "home") {
                noHomePov = { id:idpov, pov: _items[idpov]};
                break;
            }
        }
        return noHomePov
    }

    let currHome = currScene.viewpoints.home;
    //Cambiare la current Scene obj
    //Organizzare la patch
    //Realtime change of 3dScene
    //Update inpsectors and lists

    if(bHome){
        node.nid = "home";
        //CurrScene:
        currScene.viewpoints.home = currPov;
        currScene.viewpoints[_id] = currHome;
        //patch:
        _patch.viewpoints.home = currPov;
        _patch.viewpoints[_id] = currHome;
    }
    else{
        let noHomePov = id_pov_NOTHOME();
        //CurrScene:
        currScene.viewpoints.home = noHomePov.pov;
        currScene.viewpoints[noHomePov.id] = currPov;
        node.nid = noHomePov.id;
        //patch:
        _patch.viewpoints.home = noHomePov.pov;
        _patch.viewpoints[noHomePov.id] = currPov;
    }

    viewpoints_composePatch();
    
     //Ricompose widget Panel:
     let widgetMainPanel = APP.dashboard.ui.editor_widgetMainPanel(w);
     let target = document.getElementById(APP.dashboard.ui.ID_editorSideMainContainer);
     APP.dashboard.ui.openSecondSideMenu(target, widgetMainPanel,w.items()==null);
     
     //Focus on currentNode:
     let _target = {dataset:{}};
     _target.dataset.id = editor.activeNode.nid;
     _target.dataset.wid = editor.activeWidget.id;
     widgetsHub.onClicked_itemBtn_base(_target);
}

const _viewpointSetAsHome=(evt)=>{ ///ABORTED

    let currScene = widgetsHub.currScene();
    let w = editor.activeWidget;
    
    //get CurrentPatch
    let _patch = editor.patch? editor.patch : {};
    if(!_patch.viewpoints) _patch.viewpoints = {};
    
    //set possible Queue
    let patches = editor.patchReqList;
    let nextPatch = patches? patches[1].patch : {viewpoints:{}};
    
    const prevHomePOV = ()=>{
        if(!currScene.viewpoints) return null;
        let home = currScene.viewpoints.home;
        return home? home : null;
    }

    let node = editor.activeNode;
    let bHome = evt.target.checked;

    let pv = {
        fov: w.props.fov.get(node.nid),
        position: w.props.position.get(node.nid),
        target: w.props.target.get(node.nid),
    }

    
    if(bHome){
        console.log("SETTING AS HOME")
        //Set currentNode as home
        const oldId = node.nid;

        //Se c'è già un homePOV, conserva il pov, ma con un nuovo id
        let homep = prevHomePOV();
        if(homep){
            const _id = ATON.Utils.generateID("pov");
            _patch.viewpoints[_id] = homep;
            console.log("previews homepov changed as: " + _id);
            editor.currScene.viewpoints[_id] = homep;
        }

        //Patch:
        //Elimina il pov salvato con il vecchio id
        nextPatch.viewpoints[oldId] = {};
        //Prepara activeNode per composePatc()
        let _n = ATON.createSceneNode("home"); _n.children.push(editor.activeNode.children[0]);
        _n.attachToRoot();
        editor.activeNode = _n;
        UI.detachGizmo();
        ATON.getSceneNode(oldId).delete();
        
        //CurrScene:
        //let prevNode = editor.currScene.viewpoints[oldId];
        console.log("PREV ID: "+ oldId) 
        delete editor.currScene.viewpoints[oldId];
        editor.currScene.viewpoints["home"] = pv; //currScene !TODO: To find the ACTUAL NODE instead.
       
    }
    else{
        console.log("SETTING AS NORMAL")
        let _id = ATON.Utils.generateID("pov");
        //Patch:
        //Assicurarsi che non abbia più l'id "home"
        let _n = ATON.createSceneNode(_id); _n.children.push(editor.activeNode.children[0]);
        _n.attachToRoot();
        editor.activeNode = _n;
        UI.detachGizmo();
        ATON.getSceneNode("home").delete();

        nextPatch.viewpoints["home"] = {};
        //CurrScene

        editor.currScene.viewpoints[_id] = pv;
        delete editor.currScene.viewpoints["home"];
    }
    console.log("NEW SCENE CURRENT VIEWPOINTS ARE:");
    console.log(editor.currScene.viewpoints)
    
    //Ricompose widget Panel:
    let widgetMainPanel = APP.dashboard.ui.editor_widgetMainPanel(w);
    let target = document.getElementById(APP.dashboard.ui.ID_editorSideMainContainer);
    APP.dashboard.ui.openSecondSideMenu(target, widgetMainPanel,w.items()==null)

    //To manage messingup with editor 
    console.log("is Home: " + bHome);
    console.log("current node has id: " + node.nid);
    
    editor.patch = _patch;

    if(Object.keys(nextPatch.viewpoints).length > 0){
        editor.patchReqList = [
            {modePatch:ATON.SceneHub.MODE_ADD, patch: editor.patch},
            {modePatch:ATON.SceneHub.MODE_DEL, patch: nextPatch}
        ]
    }

    viewpoints_composePatch();

    let _target = {dataset:{}};
    _target.dataset.id = editor.activeNode.nid;
    _target.dataset.wid = editor.activeWidget.id;
    widgetsHub.onClicked_itemBtn_base(_target);
}

const viewpoints_composePatch=()=>{

    let node = APP.dashboard.editor.activeNode;
    if(!node) throw("no node");
    
    const w = APP.dashboard.editor.activeWidget;
    if(!w) throw("no widget active");
    
    //Compose patch:
    let _nid = node.nid;
    let _patch = editor.patch? editor.patch : {};
    if(!_patch.viewpoints)_patch.viewpoints={};
   
    _patch.viewpoints[_nid]= {
        position: w.props.position.get(),
        target:  w.props.target.get(),
        fov: w.props.fov.get()
    }
    editor.patch = _patch;
    if(editor.patchReqList){ editor.patchReqList[0].patch = editor.patch;}
    editor.OnPatchChanged();
}

let _viewpoints_widget = ()=> widgetsHub.widget({
    id:"viewpoints",
    mainBtnOptions:{id:"viewpoints_mainBtn",text:"View Points",icon:"pov"},
    itemBtnOptions:{icon:"pov"},
    createBtnOptions:{text:"Add new viewpoint",icon:"add"},
    addItemToScene:(vId,vp)=>{
        let _nid = vId;
        let POV_Icon_Node = ATON.createSceneNode(_nid); 
        POV_Icon_Node.attachToRoot();
        const IconPOV = UI.POV_3Dicon(vp.position, vp.target);
        POV_Icon_Node.add(IconPOV);
    },
    //activeItem not necessary
    //returnItem default
    //focusItem defautl
    setupGizmo:(id)=>{
        console.log("SEARCHING: " + id)
        let node = ATON.getSceneNode(id);
        let pos = node.children[0].children[0];
        editor.setGizmoByNode(pos,"translate");
        editor.udpateGizmoOnMouseUpListener(viewpointGizmoHandlers.position)
    },
    props:{
        "position":{
            inspectorBlock:(node)=>{
                let pos = node.children[0].children[0];
                let _inspectorBlock = UI.createEl(
                    {className:"inspector_Block",
                    content:[
                        UI.button({text:"position",onClick:()=>{
                            editor.setGizmoByNode(pos);
                            editor.udpateGizmoOnMouseUpListener(viewpointGizmoHandlers.position)
                        }}),
                        widgetsHub.parsers.vector3({
                            id:"viepoints_position_V3",
                            title:"Position",
                            property:"position",
                            v: pos.position,
                            target: pos,
                            onChange:viewpointsOnChangeProp
                        })
                    ]
                });
               return _inspectorBlock
            },
            get:()=>{
                    //get pos:
                    let node = APP.dashboard.editor.activeNode;
                    console.log(node)
                    const pos = node.children[0].children[0];
                    const p_pos = pos.position;
                    return [p_pos.x,p_pos.y,p_pos.z];}
            },
        "target":{
            inspectorBlock:(node)=>{
            let povTarget =  node.children[0].children[2];
            let inspectorBlock = UI.createEl(
                {className:"inspector_Block",
                content:[
                    UI.button({text:"target",onClick:()=>{
                        editor.setGizmoByNode(povTarget);
                        editor.udpateGizmoOnMouseUpListener(viewpointGizmoHandlers.target)
                    }}),
                    widgetsHub.parsers.vector3({
                        id:"viepoints_target_V3",
                        title:"target",
                        property:"position",
                        target:povTarget,
                        v: povTarget.position,
                        onChange: viewpointsOnChangeProp  //To handle here the patchComposer
                    })
                ]
            });
            return inspectorBlock;
        },
        get:()=>{
             //get target:
            let node = APP.dashboard.editor.activeNode;
            const target = node.children[0].children[2];
            const p_target = target.position;
            return [p_target.x,p_target.y,p_target.z];
            }
        },
        "fov":{
            inspectorBlock:(node)=>{
            let vp = APP.dashboard.db.data.currScene.viewpoints[node.nid];
            return widgetsHub.parsers.float({
                id:"viewpoints_fov",
                title:"FOV",
                name:"fov",
                v: vp.fov,
                onChange: viewpointsOnChangeProp
            })
        },
        get:()=>{return parseFloat(document.getElementById("viewpoints_fov").value)}
        }
        /*, ABORTED
        "home":{
            inspectorBlock:(node)=>{
            let checked = node.nid =="home";
            return widgetsHub.parsers.checkbox({
                id:"viewpoints_home",
                title:"Set as Home-Viewpoint",
                name:"home",
                checked:checked,
                onChange: viewpointSetAsHome
            })
        },
        get:()=>{return parseFloat(document.getElementById("viewpoints_home").checked)}
        }*/
    }
    }
);



let viewpoints_widget = {
    create: (_APP) => {
        widgetsHub = _APP.dashboard.editor.widgetsHub;
        editor = _APP.dashboard.editor;
        return _viewpoints_widget()
    }
}

export {viewpoints_widget};