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
    //to add others...

    /*Init Widgets:*/
    for (const [wId, w] of Object.entries(widgets)) {
        if(w.init) w.init();
    }

    widgetsHub.widgets=widgets;
}

/*DEFAULT UI FOR EDITOR*/
widgetsHub.simpleWidgetBtn=(id,text,icon,attr=null)=>{
    return UI.button({id,icon,text,attr,className:"fillContainer"})
}

widgetsHub.simpleWidgetInstanceBtn=(text,icon,id)=>{
    let b = widgetsHub.simpleWidgetBtn(text,icon);
    b.setAttribute("data-id",id);
    b.addEventListener("click",widgets.onClickInFocus)
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




widgetsHub.registerWidget=(widget)=>{
    widgets[widget.id]= widget;
}

let viewpoints_widget = {

    id:"viewpoints",
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
    mainBtn:function(){return widgetsHub.simpleWidgetBtn(`${this.id}_mainBtn`,"View Points","pov",{"data-id":this.id})},
    //Panel
    titlePanel: "View Points",
    items:(s)=>{console.log("truying");console.log(s);return s.viewpoints},
    itemBtn: (v_id,v)=>{return widgetsHub.simpleWidgetBtn(`${v_id}_itemBtn`,`POV: ${v_id}`,"pov",{"data-id":v_id})},
    createBtn:function(){return widgetsHub.simpleWidgetBtn(`${this.id}_createBtn`,"Create new View Point","add")},
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