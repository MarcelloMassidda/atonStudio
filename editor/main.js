import {UI} from '../../uitoolkit/js/uitoolkit.js';
import {editor} from './editor.js';

let APP = ATON.App.realize();

APP.baseUrl = window.location.origin + "a/atonstudio/";

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