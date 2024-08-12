let APP;
let UI; //uitoolkit

let db = {data:{}};
let ui = {
    IDdash_mainContainer: "IDdash_mainContainer"
};
let utils = {};

let dashboard = { db , ui , utils,  };


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
        onClick:()=>{console.log("CLICKED");utils.createNewScene()}})    

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
    
    const _goToHathorScene= ()=>dashboard.utils.goToScene(s.sid);
    const _openSceneIn3DEditor =()=>dashboard.ui.openSceneIn3DEditor(s.sid);

    let _item = UI.listItem({
        id:`sceneItem_${s.sid}`,
        icon:_cover,
        content:_content,
        links:[
           // UI.button({text:"Load",onClick:()=>dashboard.utils.loadScene(s.sid)}),
           UI.button({text:"Open", onClick: _openSceneIn3DEditor}),
           UI.button({text:"Duplicate"}),
           UI.button({text:"Delete"}),
           UI.button({text:"open in hathor", onClick: _goToHathorScene}),
        ],
        onClick: _openSceneIn3DEditor
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
    if(!s) {alert("S = null, void Editor isn't implemented yet."); return}

            let sidemenu = ui.editor_sideMenu();
            let topBar = ui.editor_topBar(s);
            let inspector = ui.editor_sideInspector();
            
            document.body.appendChild(UI.createEl({className:"editorContainer_dash_sideMenu", content: sidemenu}));
            document.body.appendChild(UI.createEl({className:"editorContainer_dash_topBar", content: topBar}));
            document.body.appendChild(UI.createEl({className:"editorContainer_inspector", content: inspector}));

}

ui.editor_sideMenu=()=>{

    const ID_editorSideMenu_Scene = "ID_editorSideMenu_Scene";
    const ID_editorSideMenu_Widget = "ID_editorSideMenu_Widget";

    const tabs=[
        {
            //Scene
            text: "Scene",
            tab: UI.createEl({
                id:ID_editorSideMenu_Scene,
                className:"dash_sideMenu",
                content: ui.editor_scenehierarchy()
            }),
            isActive:true
        },
        {
            //Widgets tab:
            text:"Widgets",
            tab: UI.createEl({
                id: ID_editorSideMenu_Widget,
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


ui.editor_scenehierarchy=()=>{

    //return "daje the cazzo"

    //summarize scene:
    //main graph:

    let _summary = [];

    for (const [key, graph] of Object.entries(ATON.SceneHub.currData.scenegraph.nodes)){
        let _graph = graph.urls.map(url=>
            {
                return UI.button({text:url})
            });
        _summary.push({header:key,content:_graph})
    }
    console.log(_summary)
    return UI.summarize( _summary);


    var sceneGraphNode_main = ATON.SceneHub.currData.scenegraph.nodes.main;
    let _main = [];
    
    sceneGraphNode_main.urls.forEach(url => {
        _main.push(url);
    });
    return UI.summarize(
        [
            {
        header:"main",
        content:_main
    }])
//    utils.printData(sceneGraphNode_main);




}

ui.editor_widgetsMenu=()=>{
return "daje the punta"
}


ui.editor_sideInspector=()=>{
    return UI.createEl({className:"editor_inspector", content:[
        dashboard.ui.avatarItem(),
        UI.button({icon:"add",text:"Btn1"}),
        UI.button({icon:"add",text:"Btn1"}),
        UI.button({icon:"add",text:"Btn1"}),
        UI.button({icon:"add",text:"Btn1"}),
    ]});
};

ui.editor_topBar = (s=null)=>{
    console.log("oh editor sidebar");
    console.log(s)
   let topBarContent = "Title of the tobparb";
   if(s){
    topBarContent = s.title? `s.title / ${s.sid}` : s.sid;
   }
   return UI.createEl({id:"IDeditor_topBar",className:"dash_topBar",content:topBarContent})
}


/* dashboard.utils
=====================*/

utils.printData=(data)=>{
    document.body.appendChild(UI.popup({
        isModal:false,
        isCentered:true,
		content: `<b></b><br><br><pre><code>${JSON.stringify(data,null,1)}</code></pre>`
	}));
}

utils.loadScene = (sid,onSuccess=null)=>{ // FE LOADING SCENE
    ATON.FE.loadSceneID(sid,onSuccess);
   // document.getElementById(ui.IDdash_mainContainer).style.opacity="0.5";
}


utils.goToScene=(sid)=> window.location.href = window.location.origin+"/s/"+sid;

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
    dashboard.db.sendSceneEdit( _sid,_edits, ATON.SceneHub.MODE_ADD, ()=>{
        
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
db.getKeywords=(callback=nulll)=>blur.get("keywords",callback);

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




export {dashboard};