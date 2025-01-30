import {dashboard} from '../js/dashboard.js';
import {UI} from '../../uitoolkit/js/uitoolkit.js';


let APP = ATON.App.realize();

APP.setup = async()=>{

		ATON.FE.realize();
		ATON.FE.addBasicLoaderEvents();

		UI.init();
		APP.UI = UI;
		APP.dashboard = dashboard;
		window.APP = APP;

		APP.dashboard.init();

	  }
	  
// Run the App
window.addEventListener('load', ()=>{
	APP.run();
});