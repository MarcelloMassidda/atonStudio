
var widgetsHub = null;
var editor = null;


//CREATE MEASUREMENTS
const measurementManager = {
    bMeasuring:false
};

measurementManager.setIsBuilding=(b)=>{
    measurementManager.bMeasuring = b;
}

measurementManager.abortMeasure=()=>{
    measurementManager.setIsBuilding(false);
    if(ATON.SUI._prevMPoint) ATON.SUI._prevMPoint = undefined;
}

const measurements_setupEvents =()=>{
    ATON.on("Tap",(e)=>{
            if(!measurementManager.bMeasuring) return;
            addMeasurePoint(); 
        })
}

const measurements_createBtnClicked = ()=>{
    measurementManager.setIsBuilding(true);
    //UI:
    //Central Panel:
    const helperContent = measurements_HelperContent();
    APP.ui.editor_setCentralHelperPanel(helperContent);
    APP.ui.toggle_sideMenus(false);
}

const addMeasurePoint=()=>{
    console.log("create new measurement");
    let P = ATON.getSceneQueriedPoint();
    let M = ATON.SUI.addMeasurementPoint( P );

    if (M === undefined) return;
    measurementManager.setIsBuilding(false);

    //Create new measurement
    let mid = ATON.Utils.generateID("meas");
    console.log(mid)
    let E = {};
    E.measurements = {};
    E.measurements[mid] = {};
    E.measurements[mid].points = [
        parseFloat(M.A.x.toPrecision(ATON.SceneHub.FLOAT_PREC)),
        parseFloat(M.A.y.toPrecision(ATON.SceneHub.FLOAT_PREC)),
        parseFloat(M.A.z.toPrecision(ATON.SceneHub.FLOAT_PREC)),
        parseFloat(M.B.x.toPrecision(ATON.SceneHub.FLOAT_PREC)),
        parseFloat(M.B.y.toPrecision(ATON.SceneHub.FLOAT_PREC)),
        parseFloat(M.B.z.toPrecision(ATON.SceneHub.FLOAT_PREC))
    ];

    //Update local graph
    let localmeasurements = APP.db.data.currScene.measurements;
    if(!localmeasurements) localmeasurements = E;
    else localmeasurements[mid] = E.measurements[mid];
    APP.db.data.currScene.measurements = localmeasurements;
    
    //Focus Active and  on item
    widgetsHub.focusOnItem_base({ id:mid, wid:APP.widgetsHub.widgets.measurements.id}); //TOFIX self-widget-reference

    //Update UI
    APP.ui.toggle_sideMenus(true);
    APP.ui.editor_updateWidgetMainPanel();

    //Update patch
    let _patch = editor.patch;
    if(!_patch)  {_patch = E;}
    else{_patch.measurements = E.measurements}
    editor.patch = _patch;
    editor.OnPatchChanged();
}

const onMeasureAbortBtnClicked=()=>{
    measurementManager.abortMeasure();
    APP.ui.toggle_sideMenus(true);
    APP.ui.editor_removeCentralHelperPanel(); 
}

const measurements_HelperContent=()=>{

    const head = "Adding measurements: Click on any surface to add POINT A and POINT B"; 
    const abortBtn = UI.button({id:"abortMeasurement" ,tooltip:"Abort the current mesaurement", onClick:()=>onMeasureAbortBtnClicked(), text:"Abort Shape"});
    const btns = UI.flexBox({content:[abortBtn]});
    const content = UI.createEl({id:"convexShapeHelperContent",content:[head,btns]});
    return UI.flexBox({content});
}

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
    let currScene = APP.db.data.currScene;
    currScene.measurements[nid]= {points:[aPos.x,aPos.y,aPos.z,bPos.x,bPos.y,bPos.z]}
    updateMeasurements(currScene.measurements);
    APP.db.data.currScene = currScene;

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

    let node = APP.editor.activeNode;
    if(!node) throw("no node");
    
    const w = APP.editor.activeWidget;
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
    createBtnOptions:{text:"Add new measurement",icon:"add",onClick: ()=>measurements_createBtnClicked()},
    activeItem:(meas_id)=>{
        if(!meas_id) return;
      
        console.log("active item: " + meas_id);
        if(editor.activeNode && editor.activeWidget.id=="measurements"){ //TO DO BETTER
            editor.activeWidget.deactiveItem(editor.activeNode.nid)
        }
        //Get measurement info from active widget items
        let _items = APP.widgetsHub.widgets.measurements.items();
        console.log(_items)
        console.log("looking for: " + meas_id)
        let measure = _items[meas_id];
        if(!measure) throw("no measure founded for: " + meas_id);
        
        //Create 3D icon
        const p = measure.points;
        var tmpMeasurementIcon = ATON.createSceneNode(meas_id);
        var _icon = UI.MEASURE_3Dicon([p[0],p[1],p[2]],[p[3],p[4],p[5]]);
        tmpMeasurementIcon.add(_icon)
        tmpMeasurementIcon.attachToRoot();
    },
    deactiveItem:(id)=> {ATON.getSceneNode(id).delete();},
    //returnItem default
    focusItem:(item)=>{
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
    init:()=>{
        measurements_setupEvents();
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
        let node = APP.editor.activeNode;
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
            let node = APP.editor.activeNode;
            return node.children[0].children[1].position;
        }}
    }
});

let measurements_widget = {
    create: (_APP) => {
        widgetsHub = _APP.widgetsHub;
        editor = _APP.editor;
        return _measurements_widget()
    }
}

export {measurements_widget};