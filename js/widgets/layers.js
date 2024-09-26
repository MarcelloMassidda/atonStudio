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
    layers_composePatch_transform(propName,v);
}

const layers_createBtnClicked=()=>{

    console.log("BUTTON CREATE IS CLICKED")
    var onModelItemClicked= async (e)=>{
        console.log("BUTTON MODEL IS CLICKED")
        const url = e.target.parentNode.dataset.path; //TODO: to change
        UI.removePopup();
        
        //Prompt node Name:
        const promptResponse = await UI.promptDialog({inputs:[{name:"newNodeName",labelText:"Node Name",type:"text"}]});
        // console.log("nodeName");
        if(!promptResponse) {UI.removePopup(); console.log("NO PROMPT"); return;}
        const nodeName = promptResponse.newNodeName;

       

        const updateEditorOnModelAdded=()=>{
            //Focus on currentNode
            widgetsHub.focusOnItem_base({ id:nodeName, wid:editor.widgetsHub.widgets.layers.id});
            
            //Update currentScene locally:
            //scenegraph
            let newSceneGraphNode = {urls:[url]}
            editor.currScene.scenegraph.nodes[nodeName] = newSceneGraphNode;
            //edges
            let _edges = editor.currScene.scenegraph.edges;
            if(!_edges) { _edges = {".":[nodeName]}}
            else{_edges["."].push(nodeName)}
            editor.currScene.scenegraph.edges = _edges;
            layers_composePatch_add(nodeName,newSceneGraphNode);
            
            let activeSideMenuTab = APP.dashboard.ui.getSideActiveTab();
            console.log(activeSideMenuTab)
            if(activeSideMenuTab=="scene"){
                //Update hierarchy
                APP.dashboard.ui.editor_updateHierarchy();
            }
            if(activeSideMenuTab=="widgets"){

                //Update widgetMainPanel:
                APP.dashboard.ui.editor_updateWidgetMainPanel();
            }
        }
        
        //Add in scene:
        var newAtonNode = ATON.createSceneNode(nodeName).load(url,()=> {newAtonNode.attachToRoot().setPosition(0,0,0); updateEditorOnModelAdded();});
    }

    //1 get models:
    APP.dashboard.db.getModels((models)=>{
    //2 create SummaryDialog:
        
        let _summary = UI.summarize(UI.parseInFolders( models , onModelItemClicked ));
        _summary.cssText+="text-align:left";

        document.body.appendChild(UI.dialog({
            content:[
                UI.button({icon:"cancel", onClick:()=>UI.removePopup()}),
                _summary
            ]
        }));
    })
    
}

const layers_GizmoHandler=(evt)=>{

    const layersGizmoOptions = {

        translate:{
            propertyName:"position",
            idVector3UIContainer:"layer_position_V3",
            getProperty:(n)=> {return n.position}},

        rotate:{
            propertyName:"rotation",
            idVector3UIContainer:"layer_rotation_V3",
            getProperty:(n)=> {return n.rotation}},

        scale:{
            propertyName:"scale",
            idVector3UIContainer:"layer_scale_V3",
            getProperty:(n)=> {return n.scale}}
    }

    //Update inspector:
    const inpsectorUpdater = editor.gizmoToInspectorMapper(layersGizmoOptions);
    inpsectorUpdater(evt);

    //Compose patch:
    let propName = layersGizmoOptions[ATON._gizmo.mode].propertyName;
    if(!propName) throw("no property name in gizmo handler");
    let v = layersGizmoOptions[ATON._gizmo.mode].getProperty(APP.dashboard.editor.activeNode);
    layers_composePatch_transform(propName,v)          

}

const layers_composePatch_transform=(propName,v)=>{

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
    editor.modePatch = ATON.SceneHub.MODE_ADD;

    editor.OnPatchChanged();
}

const layers_composePatch_add=( nid , nodeBody )=>{

    console.log("CALLLLLLLLLL")
    var _patch = editor.patch? editor.patch : {scenegraph:{nodes:{}}};
    if(_patch.scenegraph.nodes[nid]) {throw(nid + " node ID is already used."); }
    _patch.scenegraph.nodes[nid] = nodeBody;
    _patch.scenegraph.edges = editor.currScene.scenegraph.edges;

    editor.patch = _patch;
    editor.modePatch = ATON.SceneHub.MODE_ADD;

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
    createBtnOptions:{text:"Add new layer",icon:"add", onClick: ()=>layers_createBtnClicked()},
    //createBtn:()=>{return widgetsHub.mainBtn_base({id:"layers_createBtn",icon:"add", text:"Add new Layer"})},
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

    },

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

