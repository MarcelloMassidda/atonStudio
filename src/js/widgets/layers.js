var APP = null;
var widgetsHub = null;
var editor = null;
var gizmoManager = null;

const layers_OnChangePropFromInspector=(evt)=>{

    //no other realtime changes needed
    //just compose patch:
    if(!evt.target) throw("no evt.target to manage");
    let propName = evt.target.dataset.property;
    let prophandler = APP.editor.activeWidget.props[propName];
    if(!prophandler) throw("no prophandler to manage");
    let v = prophandler.get();
    layers_composePatch_transform(propName,v);
}

const layers_createBtnClicked=()=>{

    console.log("Create new Layer");

    var onModelItemClicked = async (e)=>{
        const url = e.target.parentNode.dataset.path; //TODO: to change
        //ATON.UI.hideModal(); //UI.removePopup();
        
        //Prompt node Name:
        const promptResponse = await UI.promptDialog({header:"Layer Name", inputs:[{name:"newNodeName", labelText:"Node Name",type:"text"}]});
        if(!promptResponse) {ATON.UI.hideModal(); console.log("NO PROMPT"); return;}
        console.log(promptResponse);
        const nodeName = promptResponse.newNodeName;


        const updateEditorOnModelAdded=()=>{
            
            console.log(1);
            //Focus on currentNode
            widgetsHub.focusOnItem_base({ id:nodeName, wid:APP.widgetsHub.widgets.layers.id});
            
            console.log(2);
            //Update currentScene locally:
            //scenegraph
            let newSceneGraphNode = {urls:[url]}
            editor.currScene.scenegraph.nodes[nodeName] = newSceneGraphNode;
            //edges
            let _edges = editor.currScene.scenegraph.edges;
            if(!_edges) { _edges = {".":[nodeName]}}
            else{_edges["."].push(nodeName)}
            editor.currScene.scenegraph.edges = _edges;
            console.log(3);
            layers_composePatch_add(nodeName,newSceneGraphNode);
            console.log(4);
            let activeSideMenuTab = APP.ui.getSideActiveTab();
            console.log(5);
            if(activeSideMenuTab=="scene"){
                //Update hierarchy
                console.log(6);
                APP.ui.editor_updateHierarchy();
                console.log(7);
            }
            if(activeSideMenuTab=="widgets"){
                console.log(8);
                //Update widgetMainPanel:
                APP.ui.editor_updateWidgetMainPanel();
                console.log(9);
            }
        }
        console.log(10);
        
        //Add in scene:
        var newAtonNode = ATON.createSceneNode(nodeName).load(url,()=> {newAtonNode.attachToRoot().setPosition(0,0,0); updateEditorOnModelAdded();});
    }

    //1 get models:
    APP.db.getModels((models)=>{
    
        console.log(models)
        //2 create SummaryDialog:
        let _summary = UI.summarize(UI.parseInFolders( models , onModelItemClicked ));
        _summary.cssText+="text-align:left";
         ATON.UI.showModal(
            {
                header: "Select a model",
                body:_summary}
    );
    })
    
}

const layers_GizmoHandler=(evt)=>{

    console.log(evt)
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
    let propName = layersGizmoOptions[gizmoManager.control.mode].propertyName;
    if(!propName) throw("no property name in gizmo handler");
    const _activeNode = APP.editor.activeNode;
    let v = layersGizmoOptions[gizmoManager.control.mode].getProperty(_activeNode);
    layers_composePatch_transform(propName,v);
}

const layers_composePatch_transform=(propName,v)=>{

    let node = APP.editor.activeNode;
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
            
        return widgetsHub.mainBtn_base({
            text: id + " ("+objNum+")",
            attr:{"data-id":id,"data-wid":"layers"},
            onClick:function(){widgetsHub.onClicked_itemBtn_base(this)},
            //badge:`contains: ${objNum} objects`
        })
    },
    mainPanelOptions:{title:"Layers"},
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
        APP.ui.editor_setGizmoToolbox();
        editor.udpateGizmoOnMouseUpListener(layers_GizmoHandler);
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
                let node = APP.editor.activeNode;
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
                let node = APP.editor.activeNode;
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
                let node = APP.editor.activeNode;
                return node.scale;
            }
        }

    },

})

let layers_widget = {
    create: (_APP) => {
        APP = _APP;
        widgetsHub = _APP.widgetsHub;
        editor = _APP.editor;
        gizmoManager = _APP.gizmoManager;
        return _layers_widget()
    }
}

export {layers_widget};

