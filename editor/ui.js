import {UI} from '../../uitoolkit/js/uitoolkit.js';
import {utils} from "../src/js/utility.js";
import {uikit}  from "../src/js/uikit.js";

let APP, editor, widgetsHub, gizmoManager;

let ui = {

     //Editor
     IDeditor_saveSceneBtn: "IDeditor_saveSceneBtn",
     //Editor - SideMenu
     ID_MainSideMenu: "ID_MainSideMenu",
     ID_editorSideMenu_Scene: "ID_editorSideMenu_Scene",
     ID_editorSideMenu_Widget: "ID_editorSideMenu_Widget",
     ID_SecondSideMenuCurrentlyActive:"ID_SecondSideMenuCurrentlyActive",
     //EDitor- Widget Panels
     ID_widget_viewPoints:"ID_widget_viewPoints",
 
     //Editor - Inspector components:
     IDeditor_Inspector: "IDeditor_Inspector",
 
     IDeditor_inspectorTransform_pos: "IDeditor_inspectorTransform_pos",
     IDeditor_inspectorTransform_rot: "IDeditor_inspectorTransform_rot",
     IDeditor_inspectorTransform_scale: "IDeditor_inspectorTransform_scale",
     
     IDeditor_inspectorTransform_target:"IDeditor_inspectorTransform_target",
 
     //Editor - center Toolbox Container:
     IDeditor_centralToolBoxContainer: "IDeditor_centralToolBoxContainer",
     //Editor - Gizmo
     IDeditor_gizmoToolbox: "IDeditor_gizmoToolbox"
};

ui.baseIcons = "../src/icons/";

ui.editorUI_Setup=(s=null)=>{
    APP = window.APP;
    editor = APP.editor;
    widgetsHub = APP.widgetsHub;
    gizmoManager = APP.gizmoManager;
    

    if(!s) {alert("S = null, void Editor isn't implemented yet."); return}

            let sidemenu = ui.editor_sideMenu();
            let topBar = ui.editor_topBar(s);
            let inspector = ui.editor_createInspector();
            let gizmoToolBox =  ui.editor_gizmoControlToolbox();
            
            //document.body.appendChild(UI.createEl({id:ui.ID_MainSideMenu, className:"editorContainer_dash_sideMenu", content: sidemenu}));
            document.body.appendChild(sidemenu);
            document.body.appendChild(UI.createEl({className:"editorContainer_dash_topBar", content: topBar}));
            document.body.appendChild(UI.createEl({className:"editorContainer_inspector", content: inspector}));
            document.body.appendChild(UI.createEl({id: ui.IDeditor_centralToolBoxContainer, content: gizmoToolBox, classList:["editorContainer_centerToolbox","hidden"]}));
}

ui.toggle= (id, b)=>{
    let el = document.getElementById(id);
    let _display = b? "block" : "none";
    if(el) el.style.display = _display;
}

ui.getSideActiveTab=()=>{
    let activeTab = editor.activeTab;
    let aTab = ""; 
    if(activeTab==ui.ID_editorSideMenu_Scene) aTab="scene";
    if(activeTab==ui.ID_editorSideMenu_Widget) aTab="widgets";
    return aTab;
}

ui.toggle_sideMenus=(b)=>{
    ui.toggle_sideMenu( b); ui.toggle_secondSideMenu(b);
}

ui.toggle_sideMenu=(b)=>{
    ui.toggle(ui.ID_MainSideMenu, b);
}

ui.toggle_secondSideMenu=(b)=>{
    ui.toggle(ui.ID_SecondSideMenuCurrentlyActive, b);
}

ui.OLD_editor_sideMenu=()=>{
    
    //TODO: "_tabLink" suffix is garbage (it's because otherwise tab and content have same id)  

    //Init with scene tab active:
    if(!editor.activeTab) editor.activeTab = ui.ID_editorSideMenu_Scene;

    const tabs=[
        {
            //Scene
            title: "Scene",
            content: UI.createEl({
                id:ui.ID_editorSideMenu_Scene,
                className:"dash_sideMenu_Content",
                content: ui.editor_scenehierarchy()
            }),
            isActive:true
        },
        {
            //Widgets tab:
            text:"Widgets",
            tab: UI.createEl({
                id: ui.ID_editorSideMenu_Widget,
                className:"dash_sideMenu_Content",
                content:ui.editor_widgetsListPanel()
            })
        }
    ]

    const onClickTabLink=(evt, id)=>{
        ui.closeSecondSideMenu();
        editor.activeTab = id;
        
        tabs.forEach(t => {
            //toggle content
            var isActive = t.tab.id == id;
            let _display = isActive? "block" : "none";
            t.tab.style.display =_display;
            //toggle btns:
            let _tabLink = document.getElementById(t.tab.id+"_tabLink")
            if(isActive) {_tabLink.classList.add("tabActive")}
            else{_tabLink.classList.remove("tabActive")} 
        });
    }   


    let TabLinks = [];
    let TabContents = [];

    tabs.forEach(t => {
        
        //tab links:
        TabLinks.push(
            UI.button({
            id:t.tab.id+"_tabLink",
            text:t.text,
            className: t.isActive? "tabActive" : "",
            onClick:(evt)=>onClickTabLink(evt, t.tab.id)
        }));

        //tab contents:
        t.tab.style.display = t.isActive? "block" : "none";    
        TabContents.push(t.tab);
    });

    let main = UI.createEl({
        id:"myMainTabbedContainer",
        className:"tabbedMainContaner",
        content:[
            UI.createEl({className:"tabLinksContainer",content:TabLinks}),
            UI.createEl({className:"tabContentsContainer",content:TabContents})
        ]
    });
    
    return main;
}


ui.editor_sideMenu=()=>{
    
    //Init with scene tab active:
    if(!editor.activeTab) editor.activeTab = ui.ID_editorSideMenu_Scene; 

    const onClickTab=(id)=>{
        ui.closeSecondSideMenu();
        console.log(id)
        editor.activeTab = id;
    }

    const items=[
        {
            //Scene
            title: "Scene",
            onClick: ()=>onClickTab(ui.ID_editorSideMenu_Scene),
            content: ui.editor_scenehierarchy()
        },
        {
            //Widgets tab:
            title:"Widgets",
            onClick: ()=>onClickTab(ui.ID_editorSideMenu_Widget),
            content: UI.createEl({classList:["d-grid", "gap-2"], content:ui.editor_widgetsListPanel()})
        }
    ];
    let sideMenuContent = uikit.createTabsGroup({items});
    sideMenuContent.id = ui.ID_MainSideMenu;
    let sideMenu = uikit.createOffCanvas({content:sideMenuContent, title:"Prototyper Tools"});
    
    return sideMenu;
}

ui.editor_topBar = (s=null)=>{

    let titleTopBar = "ATON STUDIO";
    let _sid;
    if(s){
        _sid = APP.db.data.currSID;
        titleTopBar += s.title? `${s.title} / ${_sid}` : _sid;
    }

    let backBtn = UI.button({icon:"back",onClick:()=> window.location.href = APP.url_dashboard});
    let saveSceneBtn = UI.button({id: ui.IDeditor_saveSceneBtn, text:"SAVE CHANGES", onClick: editor.onSaveSceneBtnIsClicked, classList:"hidden"})
    let openInHathorBtn = UI.button({title:"Open scene in HATHOR front end", text:"Launch scene (HATHOR)", onClick: ()=>utils.goToHathorScene(_sid)})
    let vrBtn = UI.button({text:"vr",onClick:()=> ATON.XR.toggle("immersive-vr")})
    let topBarContent = UI.flexBox({dir:"row",content:[backBtn,titleTopBar,saveSceneBtn,openInHathorBtn,vrBtn]});
    
   return UI.createEl({id:"IDeditor_topBar",className:"dash_topBar",content: topBarContent})
}

ui.OLD_editor_createInspector=(content=null)=>{
    let contentInspector = content? content :"My default Inpsector content";
    let objInspector = UI.createEl({id:ui.IDeditor_Inspector,className:"editor_inspector", content:contentInspector});

    var container = document.querySelector(".editorContainer_inspector");
    if(!container){ container = UI.createEl({className:"editorContainer_inspector"});}
    container.innerHTML = "";
   
    UI.addContent(container,objInspector); 
}

ui.editor_createInspector=(options = null)=>{
    if(!options) return;
    let {title, blocks} = options;
    let content = blocks? UI.createEl({classList:["editor_inspector"], content:blocks}) : "";
    document.body.append(uikit.createOffCanvas({pos:"end", content, title, onOffCanvasClose: editor.onCloseInspectorBtnClicked})); return;
}




//GIZMO UI:
ui.editor_gizmoControlToolbox = (modes=null)=>{

    if(!modes) modes=["translate","rotate","scale"];

    const isSelected=(mode)=>{
        
        if(!gizmoManager.control) return "";
        if(gizmoManager._currentMode ==mode) return "selected";
        
        //if (!ATON._gizmo )return "";
        //if(ATON._gizmo.mode == mode) return "selected"
        
    }

    const gizmotoolboxBtns={
        "translate": ()=>  UI.button({id:"translateGizmoBtn", icon:ui.baseIcons+"translate.svg",tooltip:"translate", onClick:()=>onGizmoModeBtnClicked("translate"), attr:{"data-gizmomode":"translate"}, classList:isSelected("translate")}),
        "rotate": ()=>  UI.button({icon:ui.baseIcons+"rotate.svg",tooltip:"rotate",onClick:()=>onGizmoModeBtnClicked("rotate"), attr:{"data-gizmomode":"rotate"}, classList:isSelected("rotate")}),
        "scale": ()=> UI.button({icon:ui.baseIcons+"scale.svg",tooltip:"scale",onClick:()=>onGizmoModeBtnClicked("scale"), attr:{"data-gizmomode":"scale"}, classList:isSelected("scale")}),
    }

    const onGizmoModeBtnClicked=(mode)=>{
            gizmoManager.setMode(mode); //ATON._gizmo.setMode(mode);
            //change selected Style:
            var _container = document.getElementById(ui.IDeditor_gizmoToolbox);
            Array.from(_container.children).forEach(c => {
                console.log("mode is"+mode);
                console.log("mode of c is"+c.dataset.gizmoMode);
                if(c.dataset.gizmomode==mode){ c.classList.add("selected");}
                else{c.classList.remove("selected");}
            });
    }

    return UI.flexBox({id:ui.IDeditor_gizmoToolbox, content: modes.map( m => gizmotoolboxBtns[m]() )})
}
ui.editor_setGizmoToolbox = ( modes = null ) => {
    let actualEl = document.getElementById( ui.IDeditor_centralToolBoxContainer); if(actualEl) actualEl.remove();

    let gizmoToolBox = ui.editor_gizmoControlToolbox(modes);
    document.body.appendChild(UI.createEl({id: ui.IDeditor_centralToolBoxContainer, content: gizmoToolBox, classList:["editorContainer_centerToolbox"]}));
}

ui.editor_scenehierarchy=()=>{

    let content = ui.editor_widgetMainPanel(APP.widgetsHub.widgets.layers);
    //Remove title:
    let _title = content.querySelector("#mainTitle");
    if(_title) _title.remove();
    content.id = ui.ID_editorSideMenu_Scene;
    return content;
}

ui.editor_updateHierarchy=()=>{
    var HierarchyContainer = document.getElementById(ui.ID_editorSideMenu_Scene);
    console.log(HierarchyContainer)
    HierarchyContainer.innerHTML = "";
    var _c = ui.editor_scenehierarchy();
    console.log(_c);
    UI.addContent(HierarchyContainer,_c);
}

ui.editor_widgetMainPanel_Title=(_title)=> {
    let _header = `
    <div id="mainTitle" class="offcanvas-header">
        <h5 class="offcanvas-title" id="offcanvasLabel">${_title}</h5>
    </div>`
    return uikit.createElfromString(_header);
}

ui.editor_widgetMainPanel=(w)=>{
    
    let mainPanelItemList = [];

    //Title:
    if(w.mainPanelOptions){
        if(w.mainPanelOptions.title) mainPanelItemList.push(ui.editor_widgetMainPanel_Title(w.mainPanelOptions.title))
    }
    //Items:
    if(w.items && w.itemBtn){
    console.log("MAIN PANEL CREATION OF " + w.id);
        let _items = w.items();
        w._items = _items;
        console.log(_items);
        if(_items){
            for (const [_id, _item] of Object.entries(_items)){
                let itemBtn = w.itemBtn(_id,_item);
               // itemBtn.addEventListener("click",function(){onItemBtnClicked(this)});
               mainPanelItemList.push(itemBtn);
            }
        }
    }
    //Add New Item BTN:
    if(w.createBtn) mainPanelItemList.push(w.createBtn());   
    let _panel = UI.createEl({classList:["WidgetMainPanel_Container","d-grid", "gap-2"],content:mainPanelItemList});
    console.log(_panel)
    return _panel;
}

ui.editor_updateWidgetMainPanel=()=>{
     //Update widgetMainPanel:
     var w = APP.editor.activeWidget;
     if(!w) return;
     let widgetMainPanel = APP.ui.editor_widgetMainPanel(w);
     if(APP.editor.activeTab == APP.ui.ID_editorSideMenu_Widget) APP.ui.openSecondSideMenu(widgetMainPanel);
}

ui.editor_widgetsListPanel=()=>{

    let widgets = APP.widgetsHub.widgets;
    
    let widgetsBtnList = [];

    const onWidgetMainButtonClicked=(target)=>{

        //Reset preview opened tools and panels:
        editor.onCloseInspectorBtnClicked();
        
        ui.editor_removeGizmoToolBox();

        console.log(target);
        if(!target.dataset.id) throw("Issues with: " + target);
        let w = widgets[target.dataset.id];
        console.log("Im properly wrapping: " + w.id );
        
        //Compose widget Panel:
        let widgetMainPanel = ui.editor_widgetMainPanel(w);
        ui.openSecondSideMenu(widgetMainPanel)
    }

    for (const [wId, w] of Object.entries(widgets)) {
        if(w.mainBtn){
            let widgetButton = w.mainBtn();
            widgetButton.addEventListener("click",function(){onWidgetMainButtonClicked(this)});
            widgetsBtnList.push(widgetButton)
        }
    }
    
    return widgetsBtnList;
}

ui.inspectorHeader=(headContent)=>{ //OLD

       return UI.flexBox({
            dir:"row",
            justifyContent:"space-between",
            wrap:"nowrap",
            content:[
                UI.createEl({content:headContent}),
                UI.button({icon:"cancel", onClick:editor.onCloseInspectorBtnClicked})
            ]
        })
}

ui.updateVector3UI =(idContainer,_v)=>{
    console.log(idContainer);
    console.log(_v)
     document.querySelector(`#${idContainer} [name="x"]`).value = _v.x;
     document.querySelector(`#${idContainer} [name="y"]`).value = _v.y;
     document.querySelector(`#${idContainer} [name="z"]`).value = _v.z;
}

ui.headerPanel=(title, btn=null)=>{
    return UI.flexBox({
        dir: "row",
        content:[title,btn],
        justifyContent:"space-between"
    })
}

ui.closeSecondSideMenu=(id=null)=>{
    var _id = id? id : ui.ID_SecondSideMenuCurrentlyActive;
    if(!_id) return;
    var secondSidePanel = document.getElementById(_id);
    if(secondSidePanel) secondSidePanel.remove();
}

ui.openSecondSideMenu=(content)=>{
    //Close existing panel
    console.log(content)
    ui.closeSecondSideMenu(); 

    
    const panel = UI.createEl({
        id:ui.ID_SecondSideMenuCurrentlyActive,
        classList:["secondSideMenu","p-2", "dark_bg", "rounded-2"],
        content
     });
    document.getElementById(ui.ID_MainSideMenu).appendChild(panel);
}

ui.editor_removeGizmoToolBox=()=>{
    
    let gizmoToolbox = document.getElementById(ui.IDeditor_centralToolBoxContainer);
    if(gizmoToolbox) gizmoToolbox.remove();
}

ui.editor_setCentralHelperPanel=(content)=>{
    document.body.appendChild(UI.createEl({id:ui.IDeditor_centralToolBoxContainer, className:"editorContainer_centerToolbox",content}));
}

ui.editor_removeCentralHelperPanel=()=>{
    let centralHelper = document.getElementById(ui.IDeditor_centralToolBoxContainer);
    if(centralHelper) centralHelper.remove();
}

export { ui };