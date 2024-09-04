let widgetsHub = {}
let widgets = {};

/*Global References:*/
let APP;
let editor;

widgetsHub.init=(_APP)=>{
    APP = _APP;
    editor = APP.dashboard.editor;

    /*Builtin Widgets:*/
    widgetsHub.registerWidget(viewpoints_widget);
    widgetsHub.registerWidget(measurements_widget);
    widgetsHub.registerWidget(semantic_widget);
    
    //to add others...

    /*Init Widgets:*/
    for (const [wId, w] of Object.entries(widgets)) {
        if(w.init) w.init();
    }

    widgetsHub.widgets=widgets;
}

/*DEFAULT UI FOR EDITOR*/
widgetsHub.mainBtn_base=(o)=>{
    //id,text,icon,attr=null,onClick
    let b = UI.button(o);
    b.classList.add("fillContainer");
    return b;
    //return UI.button({id,icon,text,attr,className:"fillContainer"})
}

widgetsHub.itemBtn_base=(o)=>{
    let b = widgetsHub.mainBtn_base(o);
   // b.setAttribute("data-id",id);
   // b.addEventListener("click",widgets.onClickInFocus)
    return b;
}

widgetsHub.onClicked_itemBtn_base=(btnClicked)=>{
    let target = btnClicked;
    console.log(target)
    //0 get item id and widget id
    let id = target.dataset.id;
    let wid = target.dataset.wid;
    let widgets = editor.widgetsHub.widgets;
    let w = widgets[wid];

    //1 active (3D)Item if necessary
    if(w.activeItem) w.activeItem(id);
    
    //2 get Item by Id and set as currently Active
    let item = w.returnItem(id);
    console.log(item)
    editor.activeNode = item;
    editor.activeWidget = editor.widgetsHub.widgets[wid];
    
    //3 set Focus (zoom)
    if(w.focusItem) w.focusItem(item);

    //4 Setup Gizmo Handler
    if(w.setupGizmo){
        w.setupGizmo(id);
        ATON._gizmo._listeners.mouseUp=undefined;
        let gizmoHandler = w.gizmo_mouseUp_handler? w.gizmo_mouseUp_handler : null;
        
        if(gizmoHandler){
            ATON._gizmo._listeners.mouseUp=undefined;
            ATON._gizmo.addEventListener("mouseUp", gizmoHandler );
        }
    }
 
    //5 Setup Inpector
    let _inspectorContent = [];

    //-header
    let headerContent = w.item_inspector_header(id)
    if(w.item_inspector_header) _inspectorContent.push( APP.dashboard.ui.inspectorHeader( headerContent ));
    if(w.props){
        for (const [prop, parser] of Object.entries(w.props)){
            _inspectorContent.push(parser(item))
        }
    }
    //-blocks
    APP.dashboard.ui.editor_createInspector(_inspectorContent);
}

widgetsHub.onGizmoMouseUp_base=(evt)=>{

    console.log("Base Handler for Gizmo: ");
    console.log(evt);
    
    let _mode = evt.mode; console.log(_mode);

    /* PSEUDO CODE:
    let id_vector3UI_toUpdate = o.idInspectorPanelToUdpate;

    //type: nodo:
    ??
    //type: viewpoint

    //type: measurements
    */
}


widgetsHub.simpleWidgetPanel=(w)=>{ ///OLD NOT USED

    let widgetPanelContent = [];
    
    //1 Create list of widget's instances (items)
    if(w.items && w.itemBtn){
        //TODO get OnItemClick
        let _items = w.items(widgetsHub.currScene());
        console.log(_items);
        if(_items){
            //add Panel title
            if(w.titlePanel) widgetPanelContent.push(w.titlePanel);
            for (const [itemId, item] of Object.entries(_items)){
                let _itemBtn = w.itemBtn(itemId,item);
                if(w.onClickItem) _itemBtn.addEventListener("click",function(){w.onClickItem(this)});
                widgetPanelContent.push(_itemBtn);
            }
        }
    }
    //3 CreateNewItem Btn
    if(w.createBtn) {
        //TODO: get onCreateBtnClick
        widgetPanelContent.push(w.createBtn())
    }
    return widgetPanelContent
}


widgetsHub.currScene = ()=> {return APP.dashboard.db.data.currScene}

widgetsHub.widget = (o)=>{

    if(!o.id){throw("ID is required for widget")}

    if(!o.mainBtn) {
        if(!o.mainBtnOptions) throw(o.id+": mainBtn or mainBtnOptions is required");

        let _mainBtnOptions = o.mainBtnOptions;
        _mainBtnOptions.attr={"data-id":o.id};
        
        o.mainBtn=()=>{return widgetsHub.mainBtn_base(o.mainBtnOptions)}
    }

    if(!o.itemBtn){
        if(!o.itemBtnOptions) throw(o.id+" :itemBtn or itemBtnOptions is required");
        
        o.itemBtn=(id,item)=>{return widgetsHub.itemBtn_base(
            {
                icon:o.itemBtnOptions.icon,
                id,
                text:id,
                attr:{"data-id":id,"data-wid":o.id},
                onClick:function(){widgetsHub.onClicked_itemBtn_base(this)} //terrible way to ensure that clicked item is the BTN parent (and not one of the children).
            }
        )}
    }

    if(!o.createBtn){
        if(!o.createBtnOptions) throw(o.id+" :createBtn or createBtnOptions is required");
        let _createBtnOptions = o.createBtnOptions;
        _createBtnOptions.attr={"data-id":o.id};
        
        o.createBtn=()=>{
            console.log(_createBtnOptions);
            return widgetsHub.itemBtn_base(_createBtnOptions)}
    }

    if(!o.items){o.items=()=>{
        let s = widgetsHub.currScene()
        return s[o.id]? s[o.id] : null
        }
    }

    if(!o.returnItem){o.returnItem=(nid)=>{return ATON.getSceneNode(nid)}}

    if(!o.init){
        if(o.items && o.addItemToScene){
            o.init=()=>{
                let _items = o.items(widgetsHub.currScene());
                if(!_items) {console.log("NO " +o.id+" IN SCENE"); return;}
                
                for (const [_id, _item] of Object.entries(_items)){
                    o.addItemToScene(_id,_item)
                }
            }   
        }
    }

    if(!o.focusItem){o.focusItem=(node)=>{
        if(!node){ console.error(id + " ATON NODE NOT FOUND"); return; }
        
        ATON.Nav.requestPOVbyNode(node,0.3);
        //editor.setGizmoByNode(node);
    }}

    if(!o.item_inspector_header){o.item_inspector_header=(id)=> {return `${id}`}}

    return o;
}





widgetsHub.parsers={

    vector3:(o)=>{
     
        const base_onVector3Change=(evt)=>{
            let property = evt.target.dataset.property; //can be position / rotation / scale
            let dimension = evt.target.name; //can be x/y/z
            let value = parseFloat(evt.target.value.replaceAll(",","."));
            
            //Real time change:
            console.log(o.target)
            o.target[property][dimension] = value;
        }

        let _handler = (evt)=>{
            
            if(!Object.hasOwn(o, "overrideBase")){base_onVector3Change(evt);}
            
            if(o.onChange){ console.log("Has onchange"); o.onChange(evt);}
            }

        return  UI.vector3({
            id: o.id, //ui.IDeditor_inspectorTransform_pos,
            property: o.property, //"position",
            title: o.title, //"position",
            v: o.v, //node.position,
            onChange:_handler //editor.onTransformVector3Changed
        })
    }
}

widgetsHub.registerWidget=(widget)=>{
    widgets[widget.id]= widget;
}

const viewpointsOnChangeProp=(evt)=>{
    let node = editor.activeNode;
    let nid = node.nid;
    let pos = node.children[0].children[0].position;
    let target =  node.children[0].children[2].position;
    let p_pos = [pos.x,pos.y,pos.z];
    let p_target = [target.x,target.y,target.z];
    ATON.getSceneNode(nid).delete();
    editor.widgetsHub.widgets.viewpoints.addItemToScene(nid,{position:p_pos,target:p_target});
    /*
    console.log("Daje callback for thhe line")
    let node = editor.activeNode;

    let line = editor.activeNode.children[0].children[1];
    let p_pos = node.children[0].children[0].position;
    let p_target =  node.children[0].children[2].position;
    let _array = line.geometry.attributes.position.array;
    _array[0] = p_pos.x,
    _array[1] = p_pos.y,
    _array[2] = p_pos.z
    _array[3] = p_target.x,
    _array[4] = p_target.y,
    _array[5] = p_target.z;
    line.geometry.attributes.position.array = _array;
    line.geometry.attributes.position.needsUpdate = true;

    line.geometry.computeBoundingBox();
    line.geometry.computeBoundingSphere();
    */
}

let viewpoints_widget = widgetsHub.widget({
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
       // let target =  node.children[0].children[2];
        //ATON.Nav.requestPOVbyNode(node,0.3);
        editor.setGizmoByNode(pos); 
        //Todo: register Gizmo Handler
        //return gizmoHandler;
    },
    gizmo_mouseUp_handler: viewpointsOnChangeProp, // widgetsHub.onGizmoMouseUp_base,
    onPropChangedCallBack: viewpointsOnChangeProp,
    props:{
        "position": (node)=>{
            let pos = node.children[0].children[0];
            let inspectorBlock = UI.createEl(
                {className:"inspector_Block",
                content:[
                    UI.button({text:"position",onClick:()=>{editor.setGizmoByNode(pos);}}),
                    widgetsHub.parsers.vector3({
                        id:"vpos",
                        title:"Position",
                        property:"position",
                        v: pos.position,
                        target: pos,
                        onChange: editor.activeWidget.onPropChangedCallBack
                    })
                ]
            });
           return inspectorBlock
        },
        "target": (node)=>{
            let povTarget =  node.children[0].children[2];
            let inspectorBlock = UI.createEl(
                {className:"inspector_Block",
                content:[
                    UI.button({text:"target",onClick:()=>{editor.setGizmoByNode(povTarget);}}),
                    widgetsHub.parsers.vector3({
                        id:"vtarget",
                title:"target",
                property:"position",
                target:povTarget,
                v:povTarget.position,
                onChange: editor.activeWidget.onPropChangedCallBack
                    })
                ]
            });
            return inspectorBlock;
        }
    }
});


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

const createMeasure=(a,b)=>{
    ATON.SUI.addMeasurementPoint(a);
    ATON.SUI.addMeasurementPoint(b);
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

    //facsimile update scenegraph: TO FIX
    let currScene = APP.dashboard.db.data.currScene;
    currScene.measurements[nid]= {points:[aPos.x,aPos.y,aPos.z,bPos.x,bPos.y,bPos.z]}

    updateMeasurements(currScene.measurements);
    APP.dashboard.db.data.currScene = currScene;
}




let measurements_widget = widgetsHub.widget({
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
        //maybe wrap this function separated?
        let node = ATON.getSceneNode(id);
        let A = node.children[0].children[0];
        editor.setGizmoByNode(A);
    },
    gizmo_mouseUp_handler: measurementsOnChangeProp,  //TO REPLACE WITH UPDATE INSPECTOR HANDLERS
    onPropChangedCallBack: measurementsOnChangeProp,
    props:{
        "PointA": (node)=>{
            let a = node.children[0].children[0];
            let inspectorBlock = UI.createEl(
                {className:"inspector_Block",
                content:[
                    UI.button({text:"Point A",onClick:()=>{editor.setGizmoByNode(a);}}), //TO REPLACE WITH GIZMO FEATURES SETTINGS 
                    widgetsHub.parsers.vector3({
                        id:"apos",
                        title:"Point A position",
                        property:"position",
                        v: a.position,
                        target: a,
                        onChange: editor.activeWidget.onPropChangedCallBack
                    })
                ]
            });
           return inspectorBlock
        },
        "PointB": (node)=>{
            let b =  node.children[0].children[1];
            let inspectorBlock = UI.createEl(
                {className:"inspector_Block",
                content:[
                    UI.button({text:"Point B",onClick:()=>{editor.setGizmoByNode(b);}}),
                    widgetsHub.parsers.vector3({
                        id:"bpos",
                title:"Point B position",
                property:"position",
                target:b,
                v:b.position,
                onChange: editor.activeWidget.onPropChangedCallBack
                    })
                ]
            });
            return inspectorBlock;
        }
    }
});


let semantic_widget = widgetsHub.widget({
    id:"Annotations",
    mainBtnOptions:{id:"Annotations_mainBtn",text:"Annotations",icon:"ann-sphere"},
    itemBtnOptions:{icon:"ann-sphere"},
    createBtnOptions:{text:"Add new annotation",icon:"add"},
    items:()=>{
       var semgraph = widgetsHub.currScene()["semanticgraph"];
       return semgraph? semgraph.nodes : null;
    },
    focusHandler:function(id){
        let node =ATON.getSemanticNode(id);
        ATON.Nav.requestPOVbyNode(node,0.3);
        editor.setGizmoByNode(node); 
    },
});


//OLD
let OLD_viewpoints_widget = {

    id:"viewpoints",
    /**/
    init:function(){
        console.log('%c viewPoints widget Init', 'color: yellow;');
        let items = this.items(widgetsHub.currScene());
        if(!items) {console.log("NO VIEWPOINTS YET"); return;}

        for (const [id, viewpoint] of Object.entries(items)){
            viewpoints_addItemInScene(id,viewpoint)
        }
    },

    //Main Btn
    onClickMainButton:function(){console.log(`${this.id} main Button Clicked`)},
    mainBtn:function(){return widgetsHub.mainBtn_base(`${this.id}_mainBtn`,"View Points","pov",{"data-id":this.id})},
    //Panel
    titlePanel: "View Points",
    items:(s)=>{ return s.viewpoints? s.viewpoints : null},
    itemBtn: (v_id,v)=>{return widgetsHub.mainBtn_base(`${v_id}_itemBtn`,`POV: ${v_id}`,"pov",{"data-id":v_id})},
    createBtn:function(){return widgetsHub.mainBtn_base(`${this.id}_createBtn`,"Create new View Point","add")},
    panel:function(){return widgetsHub.simpleWidgetPanel(this)},
    
    onClickItem:(btn)=>{
        let nid = btn.dataset.id;
        let atonNode = ATON.getSceneNode(nid);
        let pos = atonNode.children[0].children[0];
        //let target =  atonNode.children[0].children[2];
        ATON.Nav.requestPOVbyNode(atonNode,0.3);
        editor.setGizmoToPOV(pos); //Set gizmo to POS
    },
    //Inspector
    inspector:(v)=>{return "daje inspector for " + v.id},
    inspectorItemPropsCast:{"pos":"vector3","target":"vector3","fov":"float"}
}


//OLD
const viewpoints_addItemInScene=(vId,vp)=>{ 
    let _nid = vId;
    let POV_Icon_Node = ATON.createSceneNode(_nid); 
    POV_Icon_Node.attachToRoot();
    const IconPOV = UI.POV_3Dicon(vp.position, vp.target);
    POV_Icon_Node.add(IconPOV);
   // editor.POV_Icon_Node = POV_Icon_Node;
}



export {widgetsHub};


/* TODO:

-Handle inpsector/gizmo connection
onclickbuttons inspector than set gizmo stuff
gizmo onmove, according with current settings, change stuff in inspector if needed.
-Reuse these handlers for hierarchy, creating a "virtual" widget.

-parsers need node?

*/