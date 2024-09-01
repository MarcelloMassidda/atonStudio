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



widgetsHub.simpleWidgetPanel=(w)=>{

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
        o.itemBtn=(id,item)=>{return widgetsHub.itemBtnBase({icon:o.itemBtnOptions.icon,id,text:id,attr:{"data-id":id}})}
    }

    if(!o.createBtn){
        if(!o.createBtnOptions) throw(o.id+" :createBtn or createBtnOptions is required");
        let _createBtnOptions = o.createBtnOptions;
        _createBtnOptions.attr={"data-id":o.id};
        
        o.createBtn=()=>{
            console.log(_createBtnOptions);
            return widgetsHub.itemBtnBase(_createBtnOptions)}
    }

    if(!o.items){o.items=()=>{console.log("getting: " + o.id); return widgetsHub.currScene()[o.id]}}

    
    if(!o.mainPanel){
        o.mainPanel=()=>{
            let _mainPanel = [];
            if(o.items && o.itemBtn){
            console.log("MAIN PANEL CREATION OF " + o.id);
                let _items = o.items();
                console.log(_items);
                if(_items){ //To check if != undefined and Object.entries(_items).length>0
                    for (const [_id, _item] of Object.entries(_items)){
                        let i = o.itemBtn(_id,_item); console.log(i)
                        _mainPanel.push(i);
                    }
                }
            }
            console.log("1")
            _mainPanel.push(o.createBtn());
            console.log("2")
            return _mainPanel;
        }
    } 

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
    //if(!o.itemBtn)
    return o;
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
    }
});


let measurements_widget = widgetsHub.widget({
    id:"measurements",
    mainBtnOptions:{id:"measurements_mainBtn",text:"Measurements",icon:"measure"},
    itemBtnOptions:{icon:"measure"},
    createBtnOptions:{text:"Add new measurement",icon:"add"}
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
    items:(s)=>{console.log("truying");console.log(s);return s.viewpoints},
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