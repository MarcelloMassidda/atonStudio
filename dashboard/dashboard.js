import { gizmoManager } from '../src/js/gizmo.js';
import { utils } from "../src/js/utility.js";
import { db } from '../src/js/db.js';

let APP, UI;

let ui = {
    //Dashboard
    IDdash_mainContainer: "IDdash_mainContainer"
};

let editor = {};

let dashboard = { db , ui , utils, editor, gizmoManager};


dashboard.init = () => {
    APP = window.APP;
    APP.db = db;
    UI = APP.UI;

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

/* dashboard.ui =====================*/


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
        UI.createEl({
            className:"dash_sideMenu_Content",
            content:[
                dashboard.ui.avatarItem(),
                UI.button({icon:"add",text:"Btn1"}),
                UI.button({icon:"add",text:"Btn1"}),
                UI.button({icon:"add",text:"Btn1"}),
                UI.button({icon:"add",text:"Btn1"}),
            ]            
        })
    ]});
}

ui.dash_topBar = ()=>{
    return UI.createEl({id:"IDdash_topBar",className:"dash_topBar",content:"dash_topBar"})
}

ui.openSceneIn3DEditor=(sid)=>{

    //MOVE TO PAGE:
    let url = new URL(APP.url_editor);
    url.searchParams.append("s",sid);
    window.location.href = url; return; 
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
           UI.button({text:"Open", onClick: ()=>ui.openSceneIn3DEditor(s.sid)}),
           UI.button({text:"Duplicate"}),
           UI.button({text:"Delete"}),
           UI.button({text:"open in hathor", onClick: ()=>utils.goToHathorScene(s.sid)}),
        ],
        onClick: ()=>ui.openSceneIn3DEditor(s.sid)
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

export {dashboard};