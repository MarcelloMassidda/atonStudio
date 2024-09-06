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

const viewpointSetAsHome=(evt)=>{
    
    let currScene = widgetHub.currScene();

    let node = editor.activeNode;
    let id = node.nid;
    let bHome = evt.target.checked;
  
    //Se c'è già un home, savarlo con un altro nome.
    if(currScene.viewpoints){
        let prevHomePOV = currScene.viewpoints.home
        if(prevHomePOV){
        
            
    }

    }
    let _id = bHome? "home" : id;
    if(!bHome && id=="home") { _id = ATON.Utils.generateID("pov"); }
    editor.activeNode.nid = _id;
    
    console.log("is Home: " + bHome);
    console.log("id is: " + _id)

    viewpoints_composePatch();
    //UPDATE 3DEDitor info
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
   
    _patch.viewpoints[_nid]={
        position: w.props.position.get(),
        target:  w.props.target.get(),
        fov: w.props.fov.get()
    }
    editor.patch = _patch;
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
        },
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
        }
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