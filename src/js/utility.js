import { db } from './db.js';

let utils = {};


/* dashboard.utils
=====================*/
utils.goToHathorScene = (_sid)=> utils.goToScene(_sid);

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

utils.openSceneIn3DEditor=(sid)=>{
   //MOVE TO EDITOR PAGE:
    let url = new URL(APP.url_editor);
    url.searchParams.append("s",sid);
    window.location.href = url; return; 
}

utils.createNewScene=async()=>{
        
    //0 Wizard for prompt info Scene
    var formSceneInfo = await UI.promptDialog({

        header:"Create new Scene",
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
        db.sendSceneEdit( _sid, _edits, ATON.SceneHub.MODE_ADD, ()=>{
            
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
            utils.openSceneIn3DEditor(_sid);
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


export {utils};