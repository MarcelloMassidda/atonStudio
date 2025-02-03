var widgetsHub = null;
var editor = null;
var gizmoManager = null;


let convexShapeManager = {};

convexShapeManager.bConvexBuilding=false;
convexShapeManager._currentSemId = null;

convexShapeManager.setIsBuilding=(b)=>{
    convexShapeManager.bConvexBuilding = b;
};

convexShapeManager.addSurfaceConvexPoint=()=>{
    ATON.SemFactory.addSurfaceConvexPoint();
};

convexShapeManager.completeConvexShape=()=>{
    let id = convexShapeManager._currentSemId;
    if(!id) return;

    let S = ATON.SemFactory.completeConvexShape(id);
    
    if (S) ATON.getRootSemantics().add(S);
    convexShapeManager.setIsBuilding(false);
    
    //TODO: Update local graph scene
    //TODO: Update patch
    //TODO: Update widgetMainPanel
    //TODO: Focus on item
    //TODO: Update Gizmo
}

convexShapeManager.stopCurrentConvex=()=>{
    ATON.SemFactory.stopCurrentConvex();
}

/* 
convexShapeManager._createConvexShape=()=>{ 
 
    //Listing HATHOR Beahviours 
    const HATHOR = {}; 
    HATHOR.selectionMode = ()=>{return HATHOR}; 
 
    HATHOR._actState == HATHOR.SELECTION_ADDCONVEXPOINT; 
    HATHOR.setSelectionMode(HATHOR.SELACTION_ADDCONVEXPOINT); 
    ATON.Nav.setUserControl(false); 
 
    //on select: 
    //ATON.SemFactory.addSurfaceConvexPoint(); 
    ATON.EventHub.on("Tap", (e)=>{ 
        console.log("tapped from shapes"); 
    }); 
}
*/

const semantics_OnChangePropFromInspector=(evt)=>{
 
    APP._currentEVT = evt;
    //just compose patch:
    if(!evt.target) throw("no evt.target to manage");
    let propName = evt.target.dataset.property;

    //Trovare un altro modo per disaccoppiare widgetHub.parsers effect (non sempre float influenza una singola cosa nel 3D, in effetti stesso per Vector3?)
    if(propName=="radius"){
        let _val = parseFloat(evt.target.value.replaceAll(",","."));
        let _target = APP.dashboard.editor.activeNode.children[0];
        _target.scale.x = _val;
        _target.scale.y = _val;
        _target.scale.z = _val;
    }

    let prophandler = APP.dashboard.editor.activeWidget.props[propName];
    if(!prophandler) throw(propName + ": no prophandler to manage");
    let v = prophandler.get();
    semantics_composePatch_transform(propName,v);
}

const getSemanticsType=(nid)=>{
    console.log("NID IS: " + nid);
     const semNode = APP.dashboard.db.data.currScene.semanticgraph.nodes[nid];
     console.log(semNode);

     if(semNode.spheres) return "sphere";
     else if (semNode.convexshapes) return "convex";
    }

const semUtils=
{
    sphere:{ getInfo:(id)=>{ return {spheres:ATON.SceneHub.getJSONsemanticSpheresList(id)}; }
    },
    convex:{ getInfo:(id)=>ATON.SceneHub.getJSONsemanticConvexShapes(id)}
};



const semantics_createBtnClicked= async()=>{

    //FORM:
    const onShapeModeClicked=(e)=>{
        const shapeMode = e.target.value;
        let sphereOptionsPanel = document.getElementById("sphere_OptionsPanel");
        let _visible = shapeMode=="sphere" ? "block" :"none";
        sphereOptionsPanel.style.display=_visible;
    }
    const dataUser = await UI.promptDialog({inputs:
    [
        { name:"id", type:"text", legendText:"Insert Annotation ID"},
        { legendText: "Shape type", inputs:[
            { type:"radio", name:"mode", value:"sphere", labelText:"sphere", events:{"change":onShapeModeClicked}, checked:"checked"},
            { type:"radio", name:"mode", value:"convex", labelText:"convex" ,events:{"change":onShapeModeClicked} },
            ]
        },
        {id:"sphere_OptionsPanel", name:"radius", legendText:"Radius", type:"range", value: 0.5, attr:{min:0.05,max:1,step:0.01}}
    ],
    title:"Add new semantic annotation"    
});
    if(!dataUser) return;
    console.log(dataUser)

    if(!dataUser.mode) return;
    const mode = dataUser.mode;

    if(!semUtils[mode]) {throw("no config for: " + mode);}
    createSemantic(dataUser)
}

const createSemantic=(dataUser)=>{

    //TODO: Manage mode:
    //TODO: Manage if it's to add on existing semantic node
    //TODO: Manage mode geometry
    
    const mode = dataUser.mode;
    const id = dataUser.id;
    
    let semUtil = semUtils[mode];

    let semNode = null; //the 3d object
    let semNode_info = null; //the corresponding json in the scene config
   

    if(mode=="sphere"){
        let p = {x:0,y:0,z:0};
        let r = dataUser.radius? parseFloat(dataUser.radius) : ATON.SUI.getSelectorRadius();
        semNode = ATON.SemFactory.createSphere(id, p, r);
    }
    if(mode=="convex"){
       convexShapeManager._currentSemId = dataUser.id;
       convexShapeManager.setIsBuilding(true);
       console.log("SETUP CONVEX BUILDING");
       return;
    }

    //Realtime Add to Scene:
    ATON.getRootSemantics().add(semNode);
    semNode_info = semUtil.getInfo(id);

    //Edit local graph scene:
    let E = {};
    E.semanticgraph = {};
    E.semanticgraph.nodes = {};
    E.semanticgraph.nodes[id] = semNode_info;

    //edges
    E.semanticgraph.edges = ATON.SceneHub.getJSONgraphEdges(ATON.NTYPES.SEM);
    
    let localSceneSemGraph = APP.dashboard.db.data.currScene.semanticgraph;
    if(localSceneSemGraph){ localSceneSemGraph.nodes[id] = semNode_info;}
    else { APP.dashboard.db.data.currScene.semanticgraph = E.semanticgraph}

    //patch
    let _patch = editor.patch;
    if(!_patch)  {_patch = E;}
    else{_patch.semanticgraph = E.semanticgraph}
    editor.patch = _patch;
    editor.OnPatchChanged();

    //focus:
    widgetsHub.focusOnItem_base({ id, wid:editor.widgetsHub.widgets.annotations.id});
    //focus_base set current actualWidget

    //Update WidgetMainPanel
    APP.dashboard.ui.editor_updateWidgetMainPanel();

}



const semantics_GizmoHandler=(evt)=>{


    //TODO: manage convex/sphere
    const _activeNode = APP.dashboard.editor.activeNode;
    const mode = getSemanticsType(_activeNode.nid);

    const semanticsGizmoOptions = {
        translate:{
            propertyName:"position",
            idVector3UIContainer:"semantics_position_V3",
            getProperty:(n)=> {
                console.log(n)
                if(mode=="sphere") return n.position;
                else {throw(mode + "not yet implemented")}} 
            }
    }

    //Update inspector:
    const inpsectorUpdater = editor.gizmoToInspectorMapper(semanticsGizmoOptions);
    inpsectorUpdater(evt);

    //Compose patch:
    let propName = semanticsGizmoOptions[gizmoManager.control.mode].propertyName;
    if(!propName) throw("no property name in gizmo handler");

    let v = semanticsGizmoOptions[gizmoManager.control.mode].getProperty(_activeNode);
    semantics_composePatch_transform(propName,v);
}

const semantics_composePatch_transform=(propName,v)=>{

    //TODO: Radius - Done?
    //TODO: To manage convex shapes
    //TODO: How to separate 3D logic from UI?

    let node = APP.dashboard.editor.activeNode;
    if(!node) throw("no node");
    
    const mode = getSemanticsType(node.nid);
    if(mode!="sphere") throw(mode + " not yet implemented");

    
    let transformProperties = ["position","radius"];
    
    let nid = node.nid;
    let _patch = editor.patch? editor.patch : {};
        
    if(!_patch.semanticgraph) _patch.semanticgraph = {nodes:{}, edges:{}};
    if(!_patch.semanticgraph.nodes[nid]) _patch.semanticgraph.nodes[nid] = {spheres:[[0,0,0,1]]};     //TODO: Now only takes first sphere    
    let _spheres = _patch.semanticgraph.nodes[nid].spheres;
    
    //Transform object
    if(!transformProperties.includes(propName))throw(propName + " not managed");

    //Non importa quale parametro sto modificando, patch sia radius che position.
    //Position:
    let w = APP.dashboard.editor.activeWidget;
    const p = w.props.position.get()
    _spheres[0][0]= p.x;
    _spheres[0][1]= p.y;
    _spheres[0][2]= p.z;
    //Radius:
    const r = w.props.radius.get()
    _spheres[0][3] = r;
    
    _patch.semanticgraph.nodes[nid].spheres= _spheres;

    editor.patch = _patch;
    editor.modePatch = ATON.SceneHub.MODE_ADD;

    editor.OnPatchChanged();
}

let semantics_setupEvents =()=>{

    ATON.on("Tap",(e)=>{
        if(!convexShapeManager.bConvexBuilding) return;
        convexShapeManager.addSurfaceConvexPoint(); 
    })
}


let _semantics_widget = ()=> widgetsHub.widget({
    convexShapeManager:convexShapeManager,
    id:"annotations",
    mainBtnOptions:{id:"Annotations_mainBtn",text:"Annotations",icon:"ann-sphere"},
    //itemBtnOptions:{icon:"ann-sphere"},
    itemBtn:(itemId)=>{
        let _icon = getSemanticsType(itemId)=="sphere"? "ann-sphere" : "ann-convex";
        return widgetsHub.itemBtn_base({
            icon:_icon,
            id:itemId,
            text:itemId,
            attr:{"data-id":itemId,"data-wid":"annotations"},
            onClick:function(){widgetsHub.onClicked_itemBtn_base(this)}
        }
    )},
    items:()=>{
       var semgraph = widgetsHub.currScene()["semanticgraph"];
       return semgraph? semgraph.nodes : null;
    },
    returnItem:(nid)=>{return ATON.getSemanticNode(nid)},
    setupGizmo:(id)=>{ 
        let node = ATON.getSemanticNode(id);
        editor.setGizmoByNode(node.children[0]); //Only return first sphere of semantic node, TODO: mulitple items and convex shape case
        APP.dashboard.ui.editor_setGizmoToolbox();
        editor.udpateGizmoOnMouseUpListener(semantics_GizmoHandler);
    },
    createBtnOptions:{text:"Add new Annotation",icon:"add", onClick: ()=>semantics_createBtnClicked()},
    props:{
        //SPHERE: (convex to add)
        "position":{
            inspectorBlock:(node)=>{
                return widgetsHub.parsers.vector3({
                    id:"semantics_position_V3",
                    title:"Position",
                    property:"position",
                    v: node.children[0].position,
                    target: node.children[0],
                    onChange: semantics_OnChangePropFromInspector
                })  
            },
            get:()=>{
                let node = APP.dashboard.editor.activeNode;
                if(getSemanticsType(node.nid)=="sphere"){
                    return node.children[0].position;
                }
            }
        },
        "radius":{
            inspectorBlock:(node)=>{
                return widgetsHub.parsers.float({
                    id: "semantics_radius_float",
                    title:"Radius",
                   // target:node.children[0],
                    property:"radius",
                    v: node.children[0].scale.x, //  widgetsHub.currScene()["semanticgraph"].nodes[node.nid].spheres[0][3], //TO CHECK IF IT WORKS
                    onChange: semantics_OnChangePropFromInspector
                })
            },
            get:()=>{
                let node = APP.dashboard.editor.activeNode;
                if(getSemanticsType(node.nid)=="sphere"){
                    return node.children[0].scale.x;
                }
            }
        }
    },
    init:()=>{
        semantics_setupEvents();
    }
});


let semantics_widget = {
    create: (_APP) => {
        widgetsHub = _APP.dashboard.editor.widgetsHub;
        editor = _APP.dashboard.editor;
        gizmoManager = _APP.dashboard.gizmoManager;
        return _semantics_widget()
    }
}

/*
- Convex pipeline creational
- GIZMO Setup (sphere / convex)
- Editor stuff (convex / sphere setup, content of semantics)
- Patch stuff
*/


export {semantics_widget};