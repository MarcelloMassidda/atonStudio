var widgetsHub = null;
var editor = null;

var annotationConfigs={sphere:{},convex:{}};

const annotationSphereRadius = 0.2;


const annotations_createBtnClicked= async()=>{

    //const dataUser = {id:"myNewAnnotation", mode:"sphere"};
    //TODO: To change with User Prompt.
const dataUser = await UI.promptDialog({inputs:
    [
        { name:"id", type:"text", legendText:"Insert Annotation ID"},
        { legendText: "Shape type", inputs:[
            {type:"radio",name:"mode", value:"sphere",labelText:"sphere"},
            {type:"radio",name:"mode", value:"convex",labelText:"convex"}
            ]
        }
    ],
    title:"Add new semantic annotation"    
});
    console.log(dataUser)

    let mode = dataUser.mode;
    let id = dataUser.id;
    let semNode = null;

    if(!mode) return;
    if(!annotationConfigs[mode]) {throw("no config for: " + mode); return;}

    if(mode=="sphere"){

        let p = {x:0,y:0,z:0};
        let r = ATON.SUI.getSelectorRadius();
        semNode = ATON.SemFactory.createSphere(id, p,r);
    }
    //Realtime Add to Scene:
    ATON.getRootSemantics().add(semNode);

    //Edit local graph scene:
    APP.dashboard.db.data.currScene.sem; // to see semFactory and HATHOR.
    //patch
    //udate Editor
    //on focus
}

let _semantics_widget = ()=> widgetsHub.widget({
    id:"Annotations",
    mainBtnOptions:{id:"Annotations_mainBtn",text:"Annotations",icon:"ann-sphere"},
    itemBtnOptions:{icon:"ann-sphere"},
   // createBtnOptions:{text:"Add new annotation",icon:"add"},
    items:()=>{
       var semgraph = widgetsHub.currScene()["semanticgraph"];
       return semgraph? semgraph.nodes : null;
    },
    returnItem:(nid)=>{return ATON.getSemanticNode(nid)},
    setupGizmo:(id)=>{
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


export {semantics_widget};