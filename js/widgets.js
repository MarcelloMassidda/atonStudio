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
widgetsHub.mainBtnBase=(o)=>{
    //id,text,icon,attr=null,onClick
    let b = UI.button(o);
    b.classList.add("fillContainer");
    return b;
    //return UI.button({id,icon,text,attr,className:"fillContainer"})
}

widgetsHub.itemBtnBase=(o)=>{
    let b = widgetsHub.mainBtnBase(o);
   // b.setAttribute("data-id",id);
   // b.addEventListener("click",widgets.onClickInFocus)
    return b;
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
        
        o.mainBtn=()=>{return widgetsHub.mainBtnBase(o.mainBtnOptions)}
    }

    if(!o.itemBtn){
        if(!o.itemBtnOptions) throw(o.id+" :itemBtn or itemBtnOptions is required");
        o.itemBtn=(id,item)=>{return widgetsHub.itemBtnBase({icon:o.itemBtnOptions.icon,id,text:id,attr:{"data-id":id,"data-wid":o.id}})}
    }

    if(!o.createBtn){
        if(!o.createBtnOptions) throw(o.id+" :createBtn or createBtnOptions is required");
        let _createBtnOptions = o.createBtnOptions;
        _createBtnOptions.attr={"data-id":o.id};
        
        o.createBtn=()=>{
            console.log(_createBtnOptions);
            return widgetsHub.itemBtnBase(_createBtnOptions)}
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

    if(!o.focusHandler){o.focusHandler=(id)=>{
        let node = ATON.getSceneNode(id);
        if(!node){ console.error(id + " ATON NODE NOT FOUND"); return; }
        
        ATON.Nav.requestPOVbyNode(node,0.3);
        editor.setGizmoByNode(node);

        //TO DO BETTER
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
    focusHandler:function(id){
        let node = ATON.getSceneNode(id);
        let pos = node.children[0].children[0];
       // let target =  node.children[0].children[2];
        ATON.Nav.requestPOVbyNode(node,0.3);
        editor.setGizmoByNode(pos); 
    },

    onPropChangedCallBack:(evt)=>{

        //To do better
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

    },
    props:{
        "position": (node)=>{
            let pos = node.children[0].children[0];
            return widgetsHub.parsers.vector3({
                id:"vpos",
                title:"Position",
                property:"position",
                v: pos.position,
                target: pos,
                onChange: editor.activeWidget.onPropChangedCallBack
            })},
        "target": (node)=>{
            let povTarget =  node.children[0].children[2];
            return widgetsHub.parsers.vector3({
                id:"vtarget",
                title:"target",
                property:"position",
                target:povTarget,
                v:povTarget.position,
                onChange: editor.activeWidget.onPropChangedCallBack
            })}
    }

});


let measurements_widget = widgetsHub.widget({
    id:"measurements",
    mainBtnOptions:{id:"measurements_mainBtn",text:"Measurements",icon:"measure"},
    itemBtnOptions:{icon:"measure"},
    createBtnOptions:{text:"Add new measurement",icon:"add"},
    
    focusHandler:function(id){
        const measurementsRootChilds =  ATON._rootUI.children[3].children
        const areEqual=(a,b)=>{return a.toFixed(5)==b.toFixed(5)}
        
        const getA = (m)=>{
            let p;
            measurementsRootChilds.forEach(c => {
                if(c.geometry){
                    if(c.geometry.type=="BoxGeometry"){
                        if( areEqual(c.position.x, measure.points[0])
                        && areEqual(c.position.y, measure.points[1]) 
                        && areEqual(c.position.z, measure.points[2]))
                        {p = c; return;}
                    }
                }
          });
          return p;
        }

        const getB = (m)=>{
            let p;
            measurementsRootChilds.forEach(c => {
                if(c.geometry){
                    if(c.geometry.type=="BoxGeometry"){
                        if( areEqual(c.position.x, measure.points[3])
                        && areEqual(c.position.y, measure.points[4]) 
                        && areEqual(c.position.z, measure.points[5]))
                        {p = c; return;}
                    }
                }
          });
          return p;
        }

        const getLine = (m)=>{
            let p;
            measurementsRootChilds.forEach(c => {
                if(c.geometry){
                    if(c.geometry.type=="Line"){
                        var p = c.geometry.attributes.position.array;  
                        if(areEqual(p[0],measure.points[0])
                        && areEqual(p[1],measure.points[1])
                        && areEqual(p[2],measure.points[2])
                        && areEqual(p[3],measure.points[3])
                        && areEqual(p[4],measure.points[4])
                        && areEqual(p[5],measure.points[5])
                        )
                        {p = c;}    
                }
                }            
          });
          return p;
        }

        let measure = this._items[id];
        if(!measure) throw("no measure founded for: " + id);
        let _tmpMeasureGroup = ATON.createSceneNode(id);
        const _a = getA(measure);
        const _b = getB(measure);
        const _line = getLine(measure);
        _a.parent =_tmpMeasureGroup;
        _tmpMeasureGroup.attachToRoot();
        editor.setGizmoByNode(_a);
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
    mainBtn:function(){return widgetsHub.mainBtnBase(`${this.id}_mainBtn`,"View Points","pov",{"data-id":this.id})},
    //Panel
    titlePanel: "View Points",
    items:(s)=>{ return s.viewpoints? s.viewpoints : null},
    itemBtn: (v_id,v)=>{return widgetsHub.mainBtnBase(`${v_id}_itemBtn`,`POV: ${v_id}`,"pov",{"data-id":v_id})},
    createBtn:function(){return widgetsHub.mainBtnBase(`${this.id}_createBtn`,"Create new View Point","add")},
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

const viewpoints_addItemInScene=(vId,vp)=>{ 
    let _nid = vId;
    let POV_Icon_Node = ATON.createSceneNode(_nid); 
    POV_Icon_Node.attachToRoot();
    const IconPOV = UI.POV_3Dicon(vp.position, vp.target);
    POV_Icon_Node.add(IconPOV);
   // editor.POV_Icon_Node = POV_Icon_Node;
}



export {widgetsHub};