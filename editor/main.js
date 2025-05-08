import {UI} from '../../uitoolkit/js/uitoolkit.js';
import {editor} from './editor.js';

let APP = ATON.App.realize();
APP.requireFlares(["prototyper"]);

APP.url_base = window.location.origin + "/a/atonstudio/";
APP.url_dashboard = APP.url_base+"dashboard/";
APP.url_editor = APP.url_base+"editor/";
APP.pathConfigFile  = APP.url_base + "config/config.json";

APP.setup = async()=>{

		ATON.FE.realize();
		ATON.FE.addBasicLoaderEvents();

		UI.init();
		APP.UI = UI;
		APP.editor = editor;
		
		window.APP = APP;
		APP.loadConfig(APP.editor.init);

		/*
		ATON.on("AllFlaresReady",()=>{
		});*/
}
	  

// Config
APP.loadConfig = (onLoadedCallback)=>{
    return $.getJSON( APP.pathConfigFile, ( config )=>{
        //console.log(data);
        console.log("Loaded config");
        APP.config = config;
//		if (APP.cdata.assetsFolder) APP.pathAssetsFolder = ATON.PATH_COLLECTION + APP.cdata.assetsFolder;

  //      ATON.fireEvent("APP_ConfigLoaded");
		onLoadedCallback();
    });
};


// Run the App
window.addEventListener('load', ()=>{
	APP.run();
});