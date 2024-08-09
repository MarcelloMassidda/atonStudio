let APP;
let UI; //uitoolkit

let db = {data:{}};
let ui = {};
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


ui.initMediaQueries=()=>{

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

    let fullContainer = UI.createEl({id:"IDdash_mainContainer", className:"dash_mainContainer",content:[
        dashboard.ui.dash_topBar(), /*topbar*/
        UI.createEl({id:"IDdash_body", className:"dash_body", content:[ /*body*/ 
            dashboard.ui.dash_sideMenu(), /*sideMenu*/  
            UI.createEl({id:"IDdash_mainPageContainer",className:"dash_mainPageContainer", content:/*mainPageContainer*/
               dashboard.ui.scenesPage()}) /*Actual Page*/ 
        ]})
    ]});
    document.body.appendChild(fullContainer)
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


ui.sceneItem = (s)=>{

    const _size = "sm";
    let _cover = s.cover? UI.image(ATON.PATH_SCENES + s.sid + "/cover.png",_size) : UI.image(location.origin + "/res/scenecover.png",_size);
    let _title = s.title? s.title : s.sid;
    
    let _item = UI.listItem({
        id:`sceneItem_${s.sid}`,
        icon:_cover,
        content:_title,
        links:[
            UI.button({text:"Open",onClick:()=>dashboard.utils.goToScene(s.sid)}),
            UI.button({text:"Edit"}),
            UI.button({text:"Duplicate"}),
            UI.button({text:"Delete"})
        ]
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

/* dashboard.utils
=====================*/
utils.goToScene=(sid)=> window.location.href = window.location.origin+"/s/"+sid;

utils.createNewScene=async()=>{

    //Base Scene Object
    var sceneObj = utils.createBaseScene();

    //Prompt info Scene
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
                checked:"checked"
            }
        ]
    });

    /*
    for (const [key, value] of Object.entries(formSceneInfo)) {
        console.log(`${key}: ${value}`);
        sceneObj[key] = value;
      }
    */

    //Compose info:
    //sceneObj.title = formSceneInfo.title;

    //Create Obj for request:
    let o = {};
    o.sid =  db.data.user.username+"/"+utils.generateUserSID();
    o.pub = Object.hasOwn(formSceneInfo, 'visibility');
    o.data = sceneObj;
    o.title = formSceneInfo.title

    console.log(o);

    
    let handleServerResponse = (r)=>{
        if (r){console.log(r);}
        ui.createDashboard();
    };
    
    ATON.Utils.postJSON( ATON.PATH_RESTAPI+"new/scene", o, handleServerResponse);
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
db.getScenes =(callback)=>db.get("scenes/own",callback);
db.getSceneDetail=(sid,callback)=>db.get("scene/"+sid, callback);
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



export {dashboard};