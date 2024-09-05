var widgetsHub = null;
var editor = null;

const viewpointsOnChangeProp=(evt)=>{
    
    console.log(evt);
    if(evt.target){if(evt.target.name=="fov"){console.log("CHANGING FOV")}}
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

const viewpointGizmoHandlers={ //THIS IS BAD

    position:(evt)=>{
        viewpointsOnChangeProp(evt); //Realtime scene manipulation
        const inpsectorUpdater = editor.gizmoToInspectorMapper({
            translate:{
                propertyName:"position",
                idVector3UIContainer:"viepoints_position_V3",
                getProperty:(n)=> {return n.position}}
            })
        inpsectorUpdater(evt);
    },
    target:(evt)=>{
        viewpointsOnChangeProp(evt); //Realtime scene manipulation
        const inpsectorUpdater = editor.gizmoToInspectorMapper({
            translate:{
                propertyName:"position",
                idVector3UIContainer:"viepoints_target_V3",
                getProperty:(n)=> {return n.position}}
            })
        inpsectorUpdater(evt);
    }
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
        editor.setGizmoByNode(pos);
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
                        v:povTarget.position,
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
                v:vp.fov,
                onChange: viewpointsOnChangeProp
            })
        },
        get:()=>{return parseFloat(document.getElementById("viewpoints_fov").value)}
        }
    }}
);



let viewpoints_widget = {
    create: (_APP) => {
        widgetsHub = _APP.dashboard.editor.widgetsHub;
        editor = _APP.dashboard.editor;
        return _viewpoints_widget()
    }
}

export {viewpoints_widget};