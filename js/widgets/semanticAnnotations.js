var widgetsHub = null;
var editor = null;

let _semantics_widget = ()=> widgetsHub.widget({
    id:"Annotations",
    mainBtnOptions:{id:"Annotations_mainBtn",text:"Annotations",icon:"ann-sphere"},
    itemBtnOptions:{icon:"ann-sphere"},
   // createBtnOptions:{text:"Add new annotation",icon:"add"},
    items:()=>{
       var semgraph = widgetsHub.currScene()["semanticgraph"];
       return semgraph? semgraph.nodes : null;
    },
    returnItem:(nid)=>{return ATON.getSemanticNode(nid)}
});


let semantics_widget = {
    create: (_APP) => {
        widgetsHub = _APP.dashboard.editor.widgetsHub;
        editor = _APP.dashboard.editor;
        return _semantics_widget()
    }
}


export {semantics_widget};