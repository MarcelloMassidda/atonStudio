import {UI} from '../../uitoolkit/js/uitoolkit.js';
import {editor} from './editor.js';

let APP = ATON.App.realize();

APP.url_base = window.location.origin + "/a/atonstudio/";
APP.url_dashboard = APP.url_base+"dashboard/";
APP.url_editor = APP.url_base+"editor/";

APP.setup = async()=>{

		ATON.FE.realize();
		ATON.FE.addBasicLoaderEvents();

		UI.init();
		APP.UI = UI;
		APP.editor = editor;
		
		window.APP = APP;

		APP.editor.init();
}
	  
// Run the App
window.addEventListener('load', ()=>{
	APP.run();
});