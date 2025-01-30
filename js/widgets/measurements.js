var widgetsHub = null;
var editor = null;

const removeAllMeasurements=()=>{
    ATON._rootUI.children[3].removeChildren()
}

const updateMeasurements=(M)=>{
    removeAllMeasurements();
    
    for (let m in M){
        let measure = M[m];

        if (measure.points && measure.points.length === 6){
            let A = new THREE.Vector3(
                parseFloat(measure.points[0]),
                parseFloat(measure.points[1]),
                parseFloat(measure.points[2])
            );
            let B = new THREE.Vector3(
                parseFloat(measure.points[3]),
                parseFloat(measure.points[4]),
                parseFloat(measure.points[5])
            );
            ATON.SUI.addMeasurementPoint(A);
            ATON.SUI.addMeasurementPoint(B);
        }
    }
}

const measurementsOnChangeProp=(evt)=>{
    
    console.log("measure update")
    //Update line:
    let node = editor.activeNode;
    let nid = node.nid;
    let a = node.children[0].children[0];
    let b = node.children[0].children[1];
    let aPos = a.position; // [a.x,a.y,a.z];
    let bPos = b.position;// [b.x,b.y,b.z];

    //Recreate measurements from currScene //TO FIX scene MANIPULATION
    let currScene = APP.dashboard.db.data.currScene;
    currScene.measurements[nid]= {points:[aPos.x,aPos.y,aPos.z,bPos.x,bPos.y,bPos.z]}
    updateMeasurements(currScene.measurements);
    APP.dashboard.db.data.currScene = currScene;

    measurements_composePatch();
}

const measurementsGizmoHandlers={
    pointA:(evt)=>{
        //Adjust measurement 3D icon in realtime
        measurementsOnChangeProp(evt);
       //Update inpsector
        const inpsectorUpdater = editor.gizmoToInspectorMapper(
            {
                translate:{
                    idVector3UIContainer:"measure_pointA_v3",
                    getProperty:(n)=> {return n.position}}
                }
        );
        inpsectorUpdater(evt);
    },
    pointB:(evt)=>{
        //Adjust measurement 3D icon in realtime
        measurementsOnChangeProp(evt);
        //Update inpsector
        const inpsectorUpdater = editor.gizmoToInspectorMapper(
            {
                translate:{
                    idVector3UIContainer:"measure_pointB_v3",
                    getProperty:(n)=> {return n.position}}
                }
        );
        inpsectorUpdater(evt);
    }
}

const measurements_composePatch=()=>{

    let node = APP.dashboard.editor.activeNode;
    if(!node) throw("no node");
    
    const w = APP.dashboard.editor.activeWidget;
    if(!w) throw("no widget active");
    
    //Compose patch:
    let _nid = node.nid;
    let _patch = editor.patch? editor.patch : {};
    if(!_patch.measurements)_patch.measurements={};
    
    let a = w.props.PointA.get();
    let b = w.props.PointB.get();

    _patch.measurements[_nid]={
        points:[a.x, a.y, a.z, b.x, b.y, b.z]
    }
    editor.patch = _patch;
    editor.modePatch = ATON.SceneHub.MODE_ADD;
    
    editor.OnPatchChanged();
}


let _measurements_widget = ()=> widgetsHub.widget({
    id:"measurements",
    mainBtnOptions:{id:"measurements_mainBtn",text:"Measurements",icon:"measure"},
    itemBtnOptions:{icon:"measure"},
    createBtnOptions:{text:"Add new measurement",icon:"add"},
    activeItem:function(id){
   
        if(editor.activeNode && editor.activeWidget.id=="measurements"){ //TO DO BETTER
        editor.activeWidget.deactiveItem(editor.activeNode.nid)
        }

        let measure = this._items[id];
        if(!measure) throw("no measure founded for: " + id);
        const p = measure.points;
        var tmpMeasurementIcon = ATON.createSceneNode(id);
        var _icon = UI.MEASURE_3Dicon([p[0],p[1],p[2]],[p[3],p[4],p[5]]);
        tmpMeasurementIcon.add(_icon)
        tmpMeasurementIcon.attachToRoot();
    },
    deactiveItem:(id)=> {ATON.getSceneNode(id).delete();},
    //returnItem default
    focuItem:(item)=>{
        console.log(item)
        let line = item.children[1];        
        ATON.Nav.requestPOVbyNode(line,0.3);
    },
    setupGizmo:(id)=>{
        let node = ATON.getSceneNode(id);
        let A = node.children[0].children[0];
        editor.setGizmoByNode(A);
        editor.udpateGizmoOnMouseUpListener(measurementsGizmoHandlers.pointA)
    },
    props:{
        "PointA": {
            inspectorBlock:(node)=>{
            let a = node.children[0].children[0];
            let inspectorBlock = UI.createEl(
                {className:"inspector_Block",
                content:[
                    UI.button({text:"Point A",onClick:()=>{
                        editor.setGizmoByNode(a);
                        editor.udpateGizmoOnMouseUpListener(measurementsGizmoHandlers.pointA);
                    }}),
                    widgetsHub.parsers.vector3({
                        id:"measure_pointA_v3",
                        title:"Point A position",
                        property:"position",
                        v: a.position,
                        target: a,
                        onChange: measurementsOnChangeProp
                    })
                ]
            });
           return inspectorBlock
        },
    get:()=>{
        let node = APP.dashboard.editor.activeNode;
        return node.children[0].children[0].position;
    }
    },
        "PointB": {
            inspectorBlock:(node)=>{
            let b =  node.children[0].children[1];
            let inspectorBlock = UI.createEl(
                {className:"inspector_Block",
                content:[
                    UI.button({text:"Point B",onClick:()=>{
                        editor.setGizmoByNode(b);
                        editor.udpateGizmoOnMouseUpListener(measurementsGizmoHandlers.pointB);
                    }}),
                    widgetsHub.parsers.vector3({
                        id:"measure_pointB_v3",
                title:"Point B position",
                property:"position",
                target:b,
                v:b.position,
                onChange: measurementsOnChangeProp
                    })
                ]
            });
            return inspectorBlock;
        },
        get:()=>{
            let node = APP.dashboard.editor.activeNode;
            return node.children[0].children[1].position;
        }}
    }
});

let measurements_widget = {
    create: (_APP) => {
        widgetsHub = _APP.dashboard.editor.widgetsHub;
        editor = _APP.dashboard.editor;
        return _measurements_widget()
    }
}

export {measurements_widget};