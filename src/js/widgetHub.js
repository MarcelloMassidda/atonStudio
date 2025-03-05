import {viewpoints_widget} from './widgets/viewpoints.js';
import {measurements_widget} from './widgets/measurements.js';
import {semantics_widget} from './widgets/semantics.js';
import {layers_widget} from './widgets/layers.js';

import {uikit}  from "./uikit.js";

/*Global References:*/
let APP, editor;

let widgetsHub = {}
let widgets = {};


widgetsHub.init=()=>{
    APP = window.APP;
    editor = APP.editor;
    
    /*Builtin Widgets:*/
    widgetsHub.registerWidget(layers_widget.create(APP));
    widgetsHub.registerWidget(viewpoints_widget.create(APP));
    widgetsHub.registerWidget(measurements_widget.create(APP));
    widgetsHub.registerWidget(semantics_widget.create(APP));
    
    /*Init Widgets:*/
    for (const [wId, w] of Object.entries(widgets)) {
        if(w.init) w.init();
    }

    widgetsHub.widgets = widgets;
}

widgetsHub.registerWidget=(widget)=>{
    widgets[widget.id]= widget;
}

/*DEFAULT UI and LOGIC FOR EDITOR*/
widgetsHub.mainBtn_base=(o)=>{
    //id,text,icon,attr=null,onClick

    let b = uikit.createButton(o);
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
    console.log("CLICKED ITEMBTN")
    //0 get item id and widget id
    let id = target.dataset.id;
    let wid = target.dataset.wid;

    widgetsHub.focusOnItem_base({id,wid});
}

widgetsHub.focusOnItem_base=({id,wid})=>{

    let widgets = widgetsHub.widgets;
    let w = widgets[wid];

    //1 active (3D)Item if necessary
    if(w.activeItem) w.activeItem(id);
    
    //2 get Item by Id and set as currently Active
    let item = w.returnItem(id);
    console.log(item)
    editor.activeNode = item;
    editor.activeWidget = widgetsHub.widgets[wid];
    
    //3 set Focus (zoom)
    if(w.focusItem) w.focusItem(item);

    //4 Setup Gizmo Handler
    if(w.setupGizmo){ w.setupGizmo(id); }
 
    //5 Setup Inpector
    let inspectorOptions = {};

    //---header
    let headerContent = w.item_inspector_header(id)
    if(w.item_inspector_header) inspectorOptions.title = headerContent;
    
    //---blocks
    if(w.props){
        let blocks = [];
        for (const [propId, prop] of Object.entries(w.props)){
            console.log(prop);
            console.log(propId)
            if(prop.inspectorBlock) blocks.push(prop.inspectorBlock(item))
        }
        inspectorOptions.blocks = blocks;
    }
    
    APP.ui.editor_createInspector(inspectorOptions);
}


widgetsHub.deleteItem_base=({id,wid})=>{ //TODO
    //a) ADD first, DELETE after: 
    // If patch ADD MODE is present, "don't delete before saving the adding/editing actions"

    //b) udate scenegraph
    //c) If it's a patch not saved -> remove from patch
    //d) If it's a DELETE MODE Patch -> remove with DELETE patch
}


/*Widget Factory*/
widgetsHub.widget = (o)=>{

    if(!o.id){throw("ID is required for widget")}

    if(!o.mainBtn) {
        if(o.mainBtnOptions){
            let _mainBtnOptions = o.mainBtnOptions;
            _mainBtnOptions.attr={"data-id":o.id};
            o.mainBtn=()=>{return widgetsHub.mainBtn_base(o.mainBtnOptions)}
        }
    }

    if(!o.itemBtn){
        if(!o.itemBtnOptions) throw(o.id+" :itemBtn or itemBtnOptions is required");
        let _icon = o.itemBtnOptions.icon? o.itemBtnOptions.icon : null;

        o.itemBtn=(id,item)=>{return widgetsHub.itemBtn_base(
            {
                icon:_icon,
                id,
                text:id,
                attr:{"data-id":id,"data-wid":o.id},
                onClick:function(){widgetsHub.onClicked_itemBtn_base(this)} //terrible way to ensure that clicked item is the BTN parent (and not one of the children).
            }
        )}
    }

    if(!o.createBtn){
        if(o.createBtnOptions){
            let _createBtnOptions = o.createBtnOptions;
            _createBtnOptions.attr={"data-id":o.id};
            
            o.createBtn=()=>{
                console.log(_createBtnOptions);
                return widgetsHub.itemBtn_base(_createBtnOptions)}
        }
    }

    if(!o.items){
        o.items=()=>{
        let s = widgetsHub.currScene()
        return s[o.id]? s[o.id] : null
        }
    }

    if(!o.returnItem){
        o.returnItem=(nid)=>{return ATON.getSceneNode(nid)}
    }

    if(!o.init){
        if(o.items && o.addItemToScene){
            o.init=()=>{
                let _items = o.items(widgetsHub.currScene());
                if(!_items) { console.log("NO " +o.id+" IN SCENE"); return; }
                
                for (const [_id, _item] of Object.entries(_items)){
                    o.addItemToScene(_id,_item)
                }
            }   
        }
    }

    if(!o.focusItem){
        o.focusItem=(node)=>{
        if(!node){ console.error(" ATON NODE NOT FOUND"); return; }
        ATON.Nav.requestPOVbyNode(node,0.3);
    }}

    if(!o.item_inspector_header){
        o.item_inspector_header=(id)=> {
            return `${id}`
        }
    }


    //TO ADD OTHERS METHODS...

    return o;
}

//Utils
widgetsHub.currScene = ()=> {return APP.db.data.currScene}

widgetsHub.parsers={

    vector3:(o)=>{
     
        const base_onVector3Change=(evt)=>{
            console.log("is changing");
            console.log(evt)
            let property = evt.target.dataset.property; //can be position / rotation / scale
            let dimension = evt.target.name; //can be x/y/z
            let value = parseFloat(evt.target.value.replaceAll(",","."));
            console.log("property");
            console.log(property);
            console.log("dimension");
            console.log(dimension);
            console.log("value");
            console.log(value);

            //Real time change:
            if(o.target) o.target[property][dimension] = value;
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
            onChange:_handler
        })
    },
    float:(o)=>{
        let evt = null;
        if(o.onChange){ evt = {"change":o.onChange}}

        return UI.input({
            id: o.id, //("myInput",
            attr:{"data-property": o.property},
            name: o.name, //Not used yet.
            type:"number",
            value:o.v,
            labelText:o.title,
            events: evt
        });
    },
    checkbox:(o)=>{
        let evt = null;
        if(o.onChange){ evt = {"change":o.onChange}}

        return UI.input({
            type:"checkbox",
            id: o.id,
            labelText:o.title,
            name:o.name,
            checked:o.checked,
            events: evt
        });
    }
}

export {widgetsHub};


/* TODO:

-Reuse these handlers for hierarchy, creating a "virtual" widget:
-- to fix toolbox Gizmo which button is selected? OK

-Refactor gizmoMappersHandlers in  viewpoints, layers and measurements.... Per ora rimane così OK
-Manage CRUD workflows for layers, viewpoints, measures. TO DO TODAY:

EDIT:
-add other field (es. start from "set as home" for viewpoint), to see if fits
CANCEL:
--Widgets.Hub.
CREATE:
--WidgetHub.baseCreateBtn()=> return btn
--WidgetHub.baseCreateItem()=> wizard system management

-Annotations? No convex form, or not drawable.

*/