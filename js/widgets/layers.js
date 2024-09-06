var APP = null;
var widgetsHub = null;
var editor = null;


const layers_OnChangePropFromInspector=(evt)=>{

    //no other realtime changes needed
    //just compose patch:
    if(!evt.target) throw("no evt.target to manage");
    let propName = evt.target.dataset.property;
    let prophandler = APP.dashboard.editor.activeWidget.props[propName];
    if(!prophandler) throw("no prophandler to manage");
    let v = prophandler.get();
    layers_composePatch(propName,v);
}

const layers_GizmoHandler=(evt)=>{

    const layersGizmoOptions = {

        translate:{
            idVector3UIContainer:"layer_position_V3",
            getProperty:(n)=> {return n.position}},

        rotate:{
            idVector3UIContainer:"layer_rotation_V3",
            getProperty:(n)=> {return n.rotation}},

        scale:{
            idVector3UIContainer:"layer_scale_V3",
            getProperty:(n)=> {return n.scale}}
    }

    //Update inspector:
    const inpsectorUpdater = editor.gizmoToInspectorMapper(layersGizmoOptions);
    inpsectorUpdater(evt);

    //Compose patch:
    let propName = layersGizmoOptions[ATON._gizmo.mode].propertyName; //THIS IS WHAT
    let v = layersGizmoOptions[ATON._gizmo.mode].getProperty(APP.dashboard.editor.activeNode);
    layers_composePatch(propName,v)          

}

const layers_composePatch=(propName,v)=>{

    let node = APP.dashboard.editor.activeNode;
    if(!node) throw("no node");

    let transformProperties = ["position","rotation","scale"];
    
    let nid = node.nid;
    let _patch = editor.patch? editor.patch : {};
    
    if(!_patch.scenegraph) _patch.scenegraph = {nodes:{}};
    if(!_patch.scenegraph.nodes[nid])_patch.scenegraph.nodes[nid] = {};
    
    //Transform object
    if(transformProperties.includes(propName)){
        if(!_patch.scenegraph.nodes[nid].transform) _patch.scenegraph.nodes[nid].transform = {};
        _patch.scenegraph.nodes[nid].transform[propName] = [ v.x, v.y, v.z ]; 
    }
    //Others direct properties (to do)
    else{
        _patch.scenegraph.nodes[nid][propName] = v;
    }

    editor.patch = _patch;
    editor.OnPatchChanged();
}

let _layers_widget = () => widgetsHub.widget({
    id:"layers",
    hierarchy:true,
    itemBtn:(id,item)=>{
            let objNum  = item.urls? item.urls.length : 0;
        return UI.createEl({content:[ //THINK SOMETHING BETTER FOR OVERRIDE
            widgetsHub.mainBtn_base({text:id, attr:{"data-id":id,"data-wid":"layers"},  onClick:function(){widgetsHub.onClicked_itemBtn_base(this)}}),
            `contains: ${objNum} objects`]
        })
    },
    mainBtnOptions:{id:"layers_mainBtn",text:"Layers",icon:"collection-item"},
    items:()=>{
        let s = widgetsHub.currScene();
        if(!s.scenegraph) return null;
        if(!s.scenegraph.nodes) return null;
        return s.scenegraph.nodes;
    },
    setupGizmo:(id)=>{
        let node = ATON.getSceneNode(id);
        editor.setGizmoByNode(node);
        APP.dashboard.ui.editor_setGizmoToolbox();
        editor.udpateGizmoOnMouseUpListener(layers_GizmoHandler)
    },
    props:{
        "position":{
            inspectorBlock:(node)=>{
                return widgetsHub.parsers.vector3({
                    id:"layer_position_V3",
                    title:"Position",
                    property:"position",
                    v: node.position,
                    target: node,
                    onChange:layers_OnChangePropFromInspector
                })  
            },
            get:()=>{
                let node = APP.dashboard.editor.activeNode;
                return node.position;
            }
        },
        "rotation":{
            inspectorBlock:(node)=>{
                return widgetsHub.parsers.vector3({
                    id:"layer_rotation_V3",
                    title:"Rotation",
                    property:"rotation",
                    v: node.rotation,
                    target: node,
                    onChange:layers_OnChangePropFromInspector
                })  
            },
            get:()=>{
                let node = APP.dashboard.editor.activeNode;
                return node.rotation;
            }
        },
        "scale":{
            inspectorBlock:(node)=>{
                return widgetsHub.parsers.vector3({
                    id:"layer_scale_V3",
                    title:"Scale",
                    property:"scale",
                    v: node.scale,
                    target: node,
                    onChange:layers_OnChangePropFromInspector
                })  
            },
            get:()=>{
                let node = APP.dashboard.editor.activeNode;
                return node.scale;
            }
        }

    }
})

let layers_widget = {
    create: (_APP) => {
        APP = _APP;
        widgetsHub = _APP.dashboard.editor.widgetsHub;
        editor = _APP.dashboard.editor;
        return _layers_widget()
    }
}

export {layers_widget};

