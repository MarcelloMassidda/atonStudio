
let APP;
let UI; //uitoolkit

let db = {data:{}};

let ui = {
    //Dashboard
    IDdash_mainContainer: "IDdash_mainContainer",
    //Editor
    IDeditor_saveSceneBtn: "IDeditor_saveSceneBtn",
    //Editor - SideMenu
    ID_editorSideMenu_Scene: "ID_editorSideMenu_Scene",
    ID_editorSideMenu_Widget: "ID_editorSideMenu_Widget",
    //Editor - Inspector components:
    IDeditor_Inspector: "IDeditor_Inspector",
    IDeditor_inspectorTransform_pos: "IDeditor_inspectorTransform_pos",
    IDeditor_inspectorTransform_rot: "IDeditor_inspectorTransform_rot",
    IDeditor_inspectorTransform_scale: "IDeditor_inspectorTransform_scale",
    //Editor - center Toolbox Container:
    IDeditor_centralToolBoxContainer: "IDeditor_centralToolBoxContainer",
    //Gizmo
    IDeditor_gizmoToolbox: "IDeditor_gizmoToolbox"
};
let utils = {};
let editor = {};

let dashboard = { db , ui , utils, editor };


dashboard.init = () => {
    APP = window.APP;
    UI = window.APP.UI;
    dashboard.db = db;

    //init ui:
    //document.body.addEventListener('DOMContentLoaded', ui.initMediaQueries(), false);

    // Init Page:
    ATON.Utils.checkAuth((user) => {

        // If user is not logged -> redirect to login
        if (Object.keys(user).length === 0) {
            var _url = window.location.href;
            window.location.href = window.location.origin + "/shu/auth" + "?url=" + _url;
        }

        // Get data
        db.data.user = user;
        db.getScenes((s) => {
            db.data.userScenes = s;

            // Compose dashboard
            dashboard.ui.createDashboard();
        });
    });
}

/* dashboard.ui
=====================*/


ui.initMediaQueries=()=>{ //not used

    /* for dynamic purpose
    const mediaqueries = { 
        '(max-width: 576px)':handle_max_xs
    }
    */
    const handle_max_xs = (e)=>{
        console.log("is still max widht 576 " + e.matches);
        const linksContainers = document.querySelectorAll('.dash_item_links_container');
        linksContainers.forEach(container => {
          console.log(container)
        });
    }
  
    ui.mediaQuery_max_XS = window.matchMedia('(max-width: 576px)');
    if(ui.mediaQuery_max_XS.matches) handle_max_xs({matches:true})
    ui.mediaQuery_max_XS.addListener(handle_max_xs);

   
}

ui.createDashboard=()=>{

    ui.removeDashboard();

    let fullContainer = UI.createEl({id: ui.IDdash_mainContainer, className:"dash_mainContainer",content:[
        dashboard.ui.dash_topBar(), /*topbar*/
        UI.createEl({id:"IDdash_body", className:"dash_body", content:[ /*body*/ 
            dashboard.ui.dash_sideMenu(), /*sideMenu*/ 
            UI.createEl({id:"IDdash_mainPageContainer",className:"dash_mainPageContainer", content:/*mainPageContainer*/
               dashboard.ui.scenesPage()}) /*Actual Page*/ 
        ]})
    ]});
    document.body.appendChild(fullContainer)
}

ui.removeDashboard = ()=>{
    let _prevDashboard = document.getElementById(ui.IDdash_mainContainer);
    if(_prevDashboard) _prevDashboard.remove();
}

ui.scenesPage = ()=>{
    const newSceneBtn = UI.button({text:"Create new scene",
        onClick:()=>{console.log("CLICKED"); utils.createNewScene()}})    

    return UI.createEl({id:"scenesPage", className:"dash_page", content:["#SCENESPAGE .dash_page",
        
        /*Scenes page header*/
        UI.createEl({id:"scenesHead",className:"dash_pageHeader",content:[
            `<div>Title .dash_pageHeader</div>`,
            newSceneBtn
        ]}),
        
        /*Scenes page body*/
        UI.createEl({id:"scenesBody",className:"dash_pageBody", content:
             /*List of Scenes*/
            UI.createEl({id:"scenesListContainer",className:"dash_listContainer",content:
                db.data.userScenes.map((s) => dashboard.ui.sceneItem(s))
            })
        }),
        
        /*Scenes page footer*/
        UI.createEl({id:"scenesFooter",className:"dash_pageFooter",content:`<div>Footer .dash_pageFooter</div>`}),
        ]
    })
}

ui.dash_sideMenu=()=>{
    return UI.createEl({className:"dash_sideMenu", content:[
        dashboard.ui.avatarItem(),
        UI.button({icon:"add",text:"Btn1"}),
        UI.button({icon:"add",text:"Btn1"}),
        UI.button({icon:"add",text:"Btn1"}),
        UI.button({icon:"add",text:"Btn1"}),
    ]});
}

ui.dash_topBar = ()=>{
    return UI.createEl({id:"IDdash_topBar",className:"dash_topBar",content:"dash_topBar"})
}


ui.openSceneIn3DEditor=(sid)=>{
    console.log(sid);
    dashboard.db.data.currSID = sid;
    dashboard.utils.loadScene(sid,()=>{
        dashboard.db.data.currScene = ATON.SceneHub.currData;
        ui.removeDashboard();
        ui.create3DEditor(dashboard.db.data.currScene);
    })
}



ui.sceneItem = (s)=>{

    const _size = "sm";
    let _cover = s.cover? UI.image(ATON.PATH_SCENES + s.sid + "/cover.png",_size) : UI.image(location.origin + "/res/scenecover.png",_size);
    let _title = s.title? s.title : s.sid;
    let _visibility = Object.hasOwn(s, 'visibility')? "public" : "private"; 
    let _content = `<div><b>${_title}</b><br>id: ${s.sid}</br>Visibility: ${_visibility}</div>`
    

    let _item = UI.listItem({
        id:`sceneItem_${s.sid}`,
        icon:_cover,
        content:_content,
        links:[
           // UI.button({text:"Load",onClick:()=>dashboard.utils.loadScene(s.sid)}),
           UI.button({text:"Open", onClick: ()=>utils.openSceneIn3DEditor(s.sid)}),
           UI.button({text:"Duplicate"}),
           UI.button({text:"Delete"}),
           UI.button({text:"open in hathor", onClick: ()=>utils.goToHathorScene(s.sid)}),
        ],
        onClick: ()=>utils.openSceneIn3DEditor(s.sid)
    })
    return _item;
}

ui.avatarItem=()=>{
    var user = dashboard.db.data.user;
    var role = user.admin? "admin" : "simple";
    return UI.button({
        id:"avatarBtn",
        icon:"user",
        //size:"md",
        text:`<b>${user.username}</b><br>Role: ${role}`,
        onClick:()=>console.log(user.username + " is clicked")
    })
}

/* ui.editor utilities
=====================*/
ui.create3DEditor=(s=null)=>{

    editor.currScene = dashboard.db.data.currScene;
    editor.currSID = dashboard.db.data.currSID;
    editor.autoSaveMode = false;
    //editor.patch = {};


    if(!s) {alert("S = null, void Editor isn't implemented yet."); return}

            let sidemenu = ui.editor_sideMenu();
            let topBar = ui.editor_topBar(s);
            let inspector = ui.editor_sideInspector();
            let gizmoToolBox =  ui.editor_gizmoControlToolbox();
            
            document.body.appendChild(UI.createEl({className:"editorContainer_dash_sideMenu", content: sidemenu}));
            document.body.appendChild(UI.createEl({className:"editorContainer_dash_topBar", content: topBar}));
            document.body.appendChild(UI.createEl({className:"editorContainer_inspector", content: inspector}));
            document.body.appendChild(UI.createEl({id: ui.IDeditor_centralToolBoxContainer, content: gizmoToolBox, classList:["editorContainer_centerToolbox","hidden"]}));           

}

ui.editor_updateHierarchy=()=>{
    var HierarchyContainer = document.getElementById(ui.ID_editorSideMenu_Scene);
    HierarchyContainer.innerHTML = "";
    var _c = ui.editor_scenehierarchy();
    console.log(_c);
    UI.addContent(HierarchyContainer,_c);
    //HierarchyContainer.appendChild(_c);    
}


ui.editor_sideMenu=()=>{

    const tabs=[
        {
            //Scene
            text: "Scene",
            tab: UI.createEl({
                id:ui.ID_editorSideMenu_Scene,
                className:"dash_sideMenu",
                content: ui.editor_scenehierarchy()
            }),
            isActive:true
        },
        {
            //Widgets tab:
            text:"Widgets",
            tab: UI.createEl({
                id: ui.ID_editorSideMenu_Widget,
                className:"dash_sideMenu",
                content:ui.editor_widgetsMenu()
            })
        }
    ]

    const onClickTabLink=(evt, id)=>{

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
};


//WITH HATHOR SCENES CREATION objects inside the layers are not loaded as ATON-nodes: I can't edit transform properties.

editor.setFocusOnNode=(nid)=>{
    let node = ATON.getSceneNode(nid);
    //Set Gloabal focused Object:
    editor.activeNode = node;
    
    //configure and attach Gizmo
    ATON.Nav.requestPOVbyNode(node,0.3);
    editor.setGizmoByNID(nid);
    document.getElementById(ui.IDeditor_centralToolBoxContainer).classList.remove("hidden");

    //compose Inspector
    let infoNode = [
        /*HEADER*/
        UI.flexBox({
            dir:"row",
            justifyContent:"space-between",
            wrap:"nowrap",
            content:[
                UI.createEl({content:`Node ID: ${nid}<br> <small>uuid: ${node.uuid}</small>`}),
                UI.button({icon:"cancel", onClick:editor.onCloseInspectorBtnClicked})
            ]
        }),
        /*PANEL - TRANSFORM*/
        UI.vector3({id:ui.IDeditor_inspectorTransform_pos, property:"position", title:"position", v:node.position, onChange:editor.onTransformVector3Changed}),
        UI.vector3({id:ui.IDeditor_inspectorTransform_rot ,property:"rotation", title:"rotation", v:node.rotation, onChange:editor.onTransformVector3Changed}),
        UI.vector3({id:ui.IDeditor_inspectorTransform_scale, property:"scale", title:"scale", v:node.scale, onChange:editor.onTransformVector3Changed}),
    ]
    ui.editor_sideInspector_update(infoNode);
   // APP.UI.openDrawer(ui.IDeditor_Inspector+"_drawer");
}

ui.editor_btn_atonNode=(nid)=>{
     
    const _onclick=()=>{ editor.setFocusOnNode(nid);}

    return UI.button({text:nid,onClick:_onclick})
}

ui.objNameFromPath=(path)=> {return path.substring(path.lastIndexOf('/') + 1);}

ui.editor_btnUrlModel=(url)=>{ 

    return UI.listItem({
        content: ui.objNameFromPath(url),
        icon: UI.image("collection-item","xs"),
        links: [UI.image("lock","xs")]
    })

    /*return UI.button({
        icon:"collection-item",
        text: url.substring(url.lastIndexOf('/') + 1),//the title is the object name
        //attr:{disabled:true},
        tooltip:url})
        */
}


ui.editor_onAdd3DModelBtnClicked =  ()=>{

    var onModelItemClicked= async (e)=>{
        const url = e.target.parentNode.dataset.path;

        UI.removePopup();
        
        //Prompt node Name:
        const promptResponse = await UI.promptDialog({inputs:[{name:"newNodeName",labelText:"Node Name",type:"text"}]});
        console.log("nodeName");
        if(!promptResponse) {UI.removePopup(); return;}

        const nodeName = promptResponse.newNodeName;

        //Add in scene:
        var newAtonNode = ATON.createSceneNode(nodeName).load(url, ()=>{

            console.log("DAje?")
            newAtonNode.attachToRoot().setPosition(0,0,0);

            ATON.Nav.requestPOVbyNode(newAtonNode, 0.3);
            editor.setGizmoByNID(newAtonNode.nid);

             //Set Focus on new model
            editor.setFocusOnNode(newAtonNode.nid);
           
            console.log("DAje   1  ?")
           
           
            //Update local scenegraph:
            let newSceneGraphNode = {urls:[url]}
            editor.currScene.scenegraph.nodes[nodeName] = newSceneGraphNode;
            //Update local edges:
            let _edges = editor.currScene.scenegraph.edges;
            if(!_edges) { _edges = {".":[nodeName]}}
            else{_edges["."].push(nodeName)}
            editor.currScene.scenegraph.edges = _edges;
           
            console.log("DAje   2 ?")
           
            //Update global Patch
            let _patch = editor.patch? editor.patch : {scenegraph:{nodes:{}}};
            _patch.scenegraph.nodes[nodeName] = newSceneGraphNode;
            _patch.scenegraph.edges = _edges;

            editor.patch = _patch;
            editor.OnPatchChanged();
            
            console.log("DAje   3 ?")

            
            //Update hierarchy:
            ui.editor_updateHierarchy();
        });

    }

    //1 get models:
    db.getModels((models)=>{
    //2 create SummaryDialog:
        
        let _summary = UI.summarize(UI.parseInFolders(models,onModelItemClicked));
        _summary.cssText+="text-align:left";

        document.body.appendChild(UI.dialog({
            content:[
                UI.button({icon:"cancel", onClick:()=>UI.removePopup()}),
                _summary
            ]
        }));
    })
}



ui.editor_btnAdd3DModel=()=>{return UI.button({icon:"add",onClick:ui.editor_onAdd3DModelBtnClicked,text:"Add a 3D Model</br><small>As HATHOR Layer</small>"})}

ui.editor_scenehierarchy=()=>{

    var hierarchyContent = [];

    //If it's an empty scene with no HATHOR Layers
    /*if(Object.keys(editor.currScene.scenegraph.nodes).length == 0){
        hierarchyContent.push(ui.editor_btnAdd3DModel())
    }*/

   for (const [key, graph] of Object.entries(editor.currScene.scenegraph.nodes/*ATON.SceneHub.currData.scenegraph.nodes*/)){
        console.log(key)
        console.log(graph);
        let _graph = "0 objects";

        if(graph.urls){ 
            _graph = `${graph.urls.length} objects: `;
            _graph+= graph.urls.map(url=>{ return ui.objNameFromPath(url)+" "});
        }
            hierarchyContent.push( UI.createEl({content:[ui.editor_btn_atonNode(key), _graph]}))
    }
        hierarchyContent.push(ui.editor_btnAdd3DModel())
        return hierarchyContent;
}
      


ui.editor_widgets_layers=()=>{

    let _summary = [];

    for (const [key, graph] of Object.entries(editor.currScene.scenegraph.nodes/*ATON.SceneHub.currData.scenegraph.nodes*/)){
        console.log(key)
        console.log(graph);
        let _graph = "No objects in this layer";
        if(graph.urls){ _graph = graph.urls.map(url=>{ return ui.editor_btnUrlModel(url)});}
        _summary.push({header:key,content:_graph})
    }
      
    return UI.summarize( _summary);

}

ui.editor_widgetsMenu=()=>{
return "widgets panel"
}

ui.editor_sideInspector=(content=null)=>{

    let InspectorContent = content? content :"My default Inpsector content";
    return UI.createEl({id:ui.IDeditor_Inspector,className:"editor_inspector", content:InspectorContent})
    /* DRAWER To Fix:
    return UI.drawer({
        id:ui.IDeditor_Inspector+"_drawer",
        content: UI.createEl({id:ui.IDeditor_Inspector,className:"editor_inspector", content:InspectorContent}),
        position:"right"
    })
    */ 
};

ui.editor_sideInspector_update=(content)=>{
    let _inspector = document.getElementById(ui.IDeditor_Inspector);
    if(_inspector){ _inspector.innerHTML = ""; UI.addContent(_inspector,content)}
    else {
        var container = document.querySelector(".editorContainer_inspector");
        if(container){ container.appendChild(ui.editor_sideInspector(content))}
        else{alert("editor issues")}
       
    }
}

ui.editor_topBar = (s=null)=>{

    let titleTopBar = "ATON STUDIO";
    let _sid;
    if(s){
        _sid = dashboard.db.data.currSID;
        titleTopBar += s.title? `${s.title} / ${_sid}` : _sid;
    }

    let backBtn = UI.button({icon:"back",onClick:()=>window.location.reload()});
    let saveSceneBtn = UI.button({id: ui.IDeditor_saveSceneBtn, text:"SAVE CHANGES", onClick: editor.onSaveSceneBtnIsClicked, classList:"hidden"})
    let openInHathorBtn = UI.button({title:"Open scene in HATHOR front end", text:"Launch scene (HATHOR)", onClick: ()=>utils.goToHathorScene(_sid)})
    let topBarContent = UI.flexBox({dir:"row",content:[backBtn,titleTopBar,saveSceneBtn,openInHathorBtn]});
    
   return UI.createEl({id:"IDeditor_topBar",className:"dash_topBar",content: topBarContent})
}


ui.editor_gizmoControlToolbox = ()=>{

        const onGizmoModeBtnClicked=(mode)=>
            {
                ATON._gizmo.setMode(mode);
              
                //change selected Style:
                var _container = document.getElementById(ui.IDeditor_gizmoToolbox);
                Array.from(_container.children).forEach(c => {
                    console.log("mode is"+mode);
                    console.log("mode of c is"+c.dataset.gizmoMode);
                    if(c.dataset.gizmomode==mode){ c.classList.add("selected");}
                    else{c.classList.remove("selected");}
                });
            }

        let gizmoToolBox = 
                UI.flexBox({id:ui.IDeditor_gizmoToolbox, content:[
                UI.button({id:"translateGizmoBtn", icon:"icons/translate.svg",tooltip:"translate", onClick:()=>onGizmoModeBtnClicked("translate"), attr:{"data-gizmomode":"translate"}, classList:"selected"}),
                UI.button({icon:"icons/rotate.svg",tooltip:"rotate",onClick:()=>onGizmoModeBtnClicked("rotate"), attr:{"data-gizmomode":"rotate"}}),
                UI.button({icon:"icons/scale.svg",tooltip:"scale",onClick:()=>onGizmoModeBtnClicked("scale"), attr:{"data-gizmomode":"scale"}})
            ]});

        return gizmoToolBox;
}

/* dashboard.utils
=====================*/
utils.goToHathorScene = (_sid)=>dashboard.utils.goToScene(_sid);

utils.openSceneIn3DEditor = (_sid)=>dashboard.ui.openSceneIn3DEditor(_sid);

utils.beautifyData=(data)=>{ return `<b></b><br><br><pre><code>${JSON.stringify(data,null,1)}</code></pre>`}

utils.showData=(data)=>{
    const stringedData = utils.beautifyData(data);

    document.body.appendChild(UI.popup({
        isModal:false,
        isCentered:true,
		content: stringedData 
	}));
}

utils.loadScene = (sid,onSuccess=null)=>{ // FE LOADING SCENE
    ATON.FE.loadSceneID(sid,onSuccess);
   // document.getElementById(ui.IDdash_mainContainer).style.opacity="0.5";
}


utils.goToScene=(sid,blank=true)=>{
    let _url =  window.location.origin+"/s/"+sid;
        if(blank){ window.open(_url, '_blank'); }
        else{ window.location.href = _url;}
    }

utils.createNewScene=async()=>{
    
//0 Wizard for prompt info Scene
var formSceneInfo = await UI.promptDialog({

    title:"<div>New Scene</div>",
    inputs:[
        {
            id:"sceneTitle",
            type:"text",
            name:"title",
            legendText: "Title of the scene",
            labelText: "verrà creato un titolo",
            value: `New Scene n°${db.data.userScenes.length+1}`
        },
        {
            id:"sceneVisibility",
            type:"checkbox",
            name:"visibility",
            legendText:"Scene status",
            labelText: "If the scene is public it will be shown in the main gallery.",
            checked:"checked",
        }
    ]
});

console.log(formSceneInfo)

if(!formSceneInfo) return;

//1 Create new scene
//Base Scene Object
let baseScene = utils.createBaseScene();
let o = {};
o.sid =  db.data.user.username+"/"+utils.generateUserSID();
if(Object.hasOwn(formSceneInfo, 'visibility')) {o.pub = "1";}

o.data = baseScene;
db.data.currentSceneObj = o;

//2 Collect and send edit
let collectEdits =()=>{

    var edits = {};
    edits.title = formSceneInfo.title;
    if(db.data.currentSceneObj.pub){edits.visibility = "1"}
    //console.log(edits);
    
    //others...todo 

    /* //dynamic approach, but wizard is dirty: visibility.

    for (const [key, value] of Object.entries(formSceneInfo)) {
        console.log(`${key}: ${value}`);
        sceneObj[key] = value;
    }
    */
   return edits;
}


let handleServerResponse = (r)=>{
    if (r){
        console.log("Server has responded:");
        console.log(r);
    }
 
    //load scene:
   // dashboard.utils.loadScene( db.data.currentSceneObj.sid ,()=>{
    
        //Collect edits:
        let _edits = collectEdits();
        let _sid  = db.data.currentSceneObj.sid;
        console.log("edits");
        console.log(_edits);

        // sid, patch, mode, onComplete=null
    dashboard.db.sendSceneEdit( _sid, _edits, ATON.SceneHub.MODE_ADD, ()=>{
        
        console.log("Scene Created!");
        
        //You may stay and reload list of Scenes:
        /*
        db.getScenes((s) => {
            console.log(s);
            db.data.userScenes = s;
            dashboard.ui.createDashboard();
        });
        */
        
        //or open in atonStudio:
        ui.openSceneIn3DEditor(_sid);
    })

//})

  


};

ATON.Utils.postJSON( ATON.PATH_RESTAPI+"new/scene", db.data.currentSceneObj, handleServerResponse);

}

/*SHU
===================*/
utils.createBaseScene=()=>{ 
    let sobj = {};
    sobj.status = "complete";
    sobj.environment = {};
    sobj.scenegraph = {};
    sobj.scenegraph.nodes = {};
    sobj.scenegraph.edges = {};
    sobj.scenegraph.edges["."] = [];

    return sobj;
}

utils.generateUserSID = ()=>{
    let today = new Date();

    let dd   = String( today.getDate() );
    let mm   = String( today.getMonth()+1 );
    let yyyy = String( today.getFullYear() );
    if(dd<10) dd = '0'+dd;
    if(mm<10) mm = '0'+mm;

    console.log(dd)

    let R = yyyy+mm+dd;
    console.log(R)
    
    return utils.generateID(R);
};

utils.generateID = (prefix)=>{
    if (prefix === undefined) prefix = "id";
    return prefix+'-' + Math.random().toString(36).substr(2,9);
};
/*END SHU
===================*/

/* dashboard.db
=====================*/
db.getScenes =(callback=null)=>db.get("scenes/own",callback);
db.getSceneDetail=(sid,callback=null)=>db.get("scene/"+sid, callback);
db.getKeywords=(callback=null)=>db.get("keywords",callback);
db.getModels=(callback=null)=>db.get("c/models",callback);

db.get = (endpoint,onReceive) => {

    const url = ATON.PATH_RESTAPI + endpoint;
    fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      }
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response was not ok ' + response.statusText);
      }
      return response.json();
    })
    .then(data => {
      onReceive(data);
    })
    .catch(error => {
      console.error('There was a problem with the fetch operation:', error);
      onReceive(undefined);
    });
};

db.post = (endpoint, content, onComplete) => {

    const url = ATON.PATH_RESTAPI + endpoint;
    fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      },
      body: content //already stringified
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response was not ok ' + response.statusText);
      }
      return response.json();
    })
    .then(r => {
      // Update local scene JSON
      //if (r) SceneHub.currData = r;
      if (onComplete) onComplete();
    })
    .catch(error => {
      console.error('There was a problem with the fetch operation:', error);
      if (onComplete) onComplete(); // Ensure onComplete is called even in case of error
    });
};



db.sendSceneEdit=( sid, patch, mode, onComplete=null)=>{
    
    //Endpoint for post request
    const _endpoint = "edit/scene";
    
    //Compose data
    let O = {};
    O.sid  = sid;
    O.data = patch;
    O.mode = (mode === ATON.SceneHub.MODE_DEL)? "DEL" : "ADD";
    let jstr = JSON.stringify(O);
    
    //Send request
    db.post(_endpoint,jstr,onComplete);
}

db.setSceneVisibility=(sid,vis,callback=null)=>{
    var data = {sid,vis}
    if(vis==true || vis==false){
        ATON.Utils.postJSON(ATON.PATH_RESTAPI+"visibility/scene", data, (res)=>{
            if (res) if(callback) callback(res);
        });
    }    
}

/*
EDITOR 3D Management
=============*/

editor.onTransformVector3Changed=(evt)=>{
    const vector3Indexes = { x:0, y:1, z:2 };
    const defaultTransform ={
        "position": [0,0,0],
        "rotation": [0,0,0],
        "scale": [1,1,1]
    }

    window.e = evt;
    let property = evt.target.dataset.property; //can be position / rotation / scale
    let dimension = evt.target.name; //can be x/y/z
    let value = parseFloat(evt.target.value.replaceAll(",",".")); //float value TO VALIDADE!!!!!
    
    // console.log("Vector 3 changed: " + property + ": " + dimension + ": " + value);
    
    //Apply in editor:
    editor.activeNode[property][dimension] = value;

    //Compose Patch:
    let _patch = editor.patch? editor.patch : {};
    let nid = editor.activeNode.nid;
    if(!_patch.scenegraph) _patch.scenegraph = {};
    if(!_patch.scenegraph.nodes) _patch.scenegraph.nodes = {};
    if(!_patch.scenegraph.nodes[nid]) _patch.scenegraph.nodes[nid] = {};
    if(!_patch.scenegraph.nodes[nid].transform) _patch.scenegraph.nodes[nid].transform = {};
    if(!_patch.scenegraph.nodes[nid].transform[property]) {

        let _t = defaultTransform[property];
        try {
            let prevT = editor.currScene.scenegraph.nodes[nid].transform[property];
            if(prevT) _t = prevT;}
        catch (e) { console.error("jesus"); console.log(_t); console.error(e.message); }
        _patch.scenegraph.nodes[nid].transform[property] = _t;
        console.log("prev or fresh t: "); console.log(_t)
    }

    _patch.scenegraph.nodes[nid].transform[property][vector3Indexes[dimension]] = value;
    
    console.log("edited t: "); console.log(_patch.scenegraph.nodes[nid].transform[property])
    console.log(_patch);
    
    editor.patch = _patch;
    editor.OnPatchChanged();
    
}

editor.OnPatchChanged=()=>{
    if(editor.autoSaveMode){
        console.log("path changed: autosave");

        editor.sendGlobalScenePatch();
    }
    else{
        console.log("path changed: autosave FALSE");
        document.getElementById(ui.IDeditor_saveSceneBtn).classList.remove("hidden");
    }
}


editor.onSaveSceneBtnIsClicked=()=>{
        console.log("SaveSceneBtn Clicked");

        document.getElementById(ui.IDeditor_saveSceneBtn).classList.add("hidden");
        editor.sendGlobalScenePatch();
}

editor.sendGlobalScenePatch=()=>{
    if( !editor.patch || editor.patch=={} ){console.log("SCENE PATCH NOT EXIST");  return}
    let _sid = editor.currSID;
    let _patch = editor.patch;
    let _mode = ATON.SceneHub.MODE_ADD;
    let _onComplete = ()=>{
        console.log("SAVED");
    }
    
    db.sendSceneEdit( _sid, _patch, _mode, _onComplete);
}


editor.onGizmoMouseUp=(evt)=>{
    console.log("editor handler: "); console.log(evt); window.gizmoEVT = evt;
    if(ATON._gizmo.object.uuid != APP.dashboard.editor.activeNode.uuid) return;

    const gizmoUpdaters = {
        translate: {
            idVector3UIContainer: ui.IDeditor_inspectorTransform_pos,
            nodePropertyToCopy: "position"
        },
        rotate: {
            idVector3UIContainer: ui.IDeditor_inspectorTransform_rot,
            nodePropertyToCopy: "rotation"
        } ,
        scale: {
            idVector3UIContainer: ui.IDeditor_inspectorTransform_scale,
            nodePropertyToCopy: "scale"
        } 
    }
    
    let _mode = evt.mode; console.log(_mode);
    let _v = ATON._gizmo.object[gizmoUpdaters[_mode].nodePropertyToCopy];

    editor.updateVector3UI(gizmoUpdaters[_mode].idVector3UIContainer,_v);
    editor.OnPatchChanged();
}

editor.updateVector3UI =(idContainer,_v)=>{
     document.querySelector(`#${idContainer} [name="x"]`).value = _v.x;
     document.querySelector(`#${idContainer} [name="y"]`).value = _v.y;
     document.querySelector(`#${idContainer} [name="z"]`).value = _v.z;
}

editor.setGizmoByNID=(nid,mode="translate")=>{
    console.log("setting GIMZO in editor")
    UI.attachGizmoBynid(nid,mode);
    if(!ATON._gizmo._listeners.mouseUp) ATON._gizmo.addEventListener("mouseUp",editor.onGizmoMouseUp);
}


editor.onCloseInspectorBtnClicked=()=>{
    /*hide GizmoToolbox*/ document.getElementById(ui.IDeditor_centralToolBoxContainer).classList.add("hidden");
    /*remove inspector*/ document.getElementById(ui.IDeditor_Inspector).remove();
    /*detach Gizmo*/ UI.detachGizmo();
    editor.activeNode = null;
}




export {dashboard};