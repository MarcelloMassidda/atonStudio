var widgetsHub = null;
var editor = null;

var semUtils=
{
    sphere:{ getInfo:(id)=>{ return {spheres:ATON.SceneHub.getJSONsemanticSpheresList(id)}; }
    },
    convex:{ getInfo:(id)=>ATON.SceneHub.getJSONsemanticConvexShapes(id)}
};

const annotationSphereRadius = 1;


const annotations_createBtnClicked= async()=>{

    //TODO: create dinamyc flows for sphere / convex shapes
const dataUser = await UI.promptDialog({inputs:
    [
        { name:"id", type:"text", legendText:"Insert Annotation ID"},
        { legendText: "Shape type", inputs:[
            {type:"radio",name:"mode", value:"sphere",labelText:"sphere"},
            {type:"radio",name:"mode", value:"convex",labelText:"convex"}
            ]
        },
        {name:"radius", legendText:"Radius", type:"range", value:0.05, attr:{min:0.05,max:1,step:0.01}}
    ],
    title:"Add new semantic annotation"    
});
    if(!dataUser) return;
    console.log(dataUser)

    let mode = dataUser.mode;
    let id = dataUser.id;
    let semNode = null; //the 3d object
    let semNode_info = null; //the corresponding json in the scene config

    if(!mode) return;
    if(!semUtils[mode]) {throw("no config for: " + mode); return;}

    let semUtil = semUtils[mode];

    if(mode=="sphere"){
        let p = {x:0,y:0,z:0};
        let r = dataUser.radius? parseFloat(dataUser.radius) : ATON.SUI.getSelectorRadius(); //annotationSphereRadius;
        semNode = ATON.SemFactory.createSphere(id, p,r);
    }
    if(mode=="convex"){
        alert("Convex Shape is not implemented yet")
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
    else{patch.semanticgraph = E.semanticgraph}
    editor.patch = _patch;
    editor.OnPatchChanged();

    //focus:
    widgetsHub.focusOnItem_base({ id, wid:editor.widgetsHub.widgets.annotations.id});
    //focus_base set current actualWidget

    //Update WidgetMainPanel
    APP.dashboard.ui.editor_updateWidgetMainPanel();
}

let _semantics_widget = ()=> widgetsHub.widget({
    id:"annotations",
    mainBtnOptions:{id:"Annotations_mainBtn",text:"Annotations",icon:"ann-sphere"},
    itemBtnOptions:{icon:"ann-sphere"},
   // createBtnOptions:{text:"Add new annotation",icon:"add"},
    items:()=>{
       var semgraph = widgetsHub.currScene()["semanticgraph"];
       return semgraph? semgraph.nodes : null;
    },
    returnItem:(nid)=>{return ATON.getSemanticNode(nid)},
    setupGizmo:(id)=>{ //TODO: change behaviours (for sphere/convex)
        let node = ATON.getSemanticNode(id);
        editor.setGizmoByNode(node);
        APP.dashboard.ui.editor_setGizmoToolbox();
    },
    createBtnOptions:{text:"Add new Annotation",icon:"add", onClick: ()=>annotations_createBtnClicked()},
   
});


let semantics_widget = {
    create: (_APP) => {
        widgetsHub = _APP.dashboard.editor.widgetsHub;
        editor = _APP.dashboard.editor;
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