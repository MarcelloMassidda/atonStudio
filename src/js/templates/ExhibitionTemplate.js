import { Template } from './Template.js';
import { LibraryLayerWidget } from '../widgets/LibraryLayerWidget.js';
import { ScreenOverrideBehaviour } from '../behaviours/ScreenOverrideBehaviour.js';

export class ExhibitionTemplate extends Template {
    constructor(app) {
        super({
            id: 'exhibition',
            name: 'Exhibition Design'
        });

        // Create library widget with screen override behaviour
        const libraryWidget = new LibraryLayerWidget(app);
        libraryWidget.registerBehaviour(new ScreenOverrideBehaviour());
        
        this.registerWidget(libraryWidget);
    }
}