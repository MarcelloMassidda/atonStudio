import {webdavManager} from './webdav.js';

let db ={};

db.data = {};

/* dashboard.db
=====================*/
db.getScenes =(callback=null)=>db.get("scenes/own",callback);
db.getSceneDetail=(sid,callback=null)=>db.get("scene/"+sid, callback);
db.getKeywords=(callback=null)=>db.get("keywords",callback);
db.getModels=(callback=null)=>db.get("c/models",callback);

db.getMedia=(callback=null)=>{
  db.getUser((user)=>{
    if(!user) throw("NO USER LOGGED"); //To implement redirect to login
    db.get(`v2/items/${user.username}/media`, callback)
  });
}

db.getUser=(callback=null)=>{
  ATON.Utils.checkAuth((_user) => { callback(_user)});

  /*
  if (Object.keys(_user).length === 0) {
    return null;
  }
  else return user;
  */
}


db.initUser=()=>{
  db.getUser( async(user)=>{
    db.user = user;

    webdavManager.setConfig({
      baseURL: "http://localhost:8081/",
      username: user.username,
      password: user.username //USERS WITH SAME PASSWORD FOR TESTING
    });

    console.log("WebDAV config:", webdavManager.config);

    return;
    let basePath = "tmp-collection/" + db.user.username + "/";
    await webdavManager.ensureFoldersExist([basePath, basePath+"media", basePath+"models", basePath+"pano"]);
  });
}

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

db.post = (endpoint, content, onComplete) => { //NOT TESTED OR USED.

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


db.webdav = webdavManager; //WebDAV manager

db.openFileDialog = (o=null)=>{
  /*
  Format/Size limit validation? TODO
  o.tagetPath = "media" // "pano" // "models"
  */

  if(!o) o = {};
  let p = o.targetPath || "media"; //Default path
  let targetPath = db.user.username + "-collection/" + p + "/";

  let _callback = o.callback || (()=>{});

  webdavManager.openFileDialog(targetPath,_callback);
}


export {db};