import { Template } from './Template.js';
import { LibraryLayerWidget } from '../widgets/LibraryLayerWidget.js';
import { ScreenOverrideCapability } from '../capabilities/ScreenOverrideCapability.js';

export class ExhibitionTemplate extends Template {
    constructor(app) {
        super({
            id: 'exhibition',
            name: 'Exhibition Design'
        });

        // Create library widget with screen override capability
        const libraryWidget = new LibraryLayerWidget(app);
        libraryWidget.registerCapability(new ScreenOverrideCapability());
        
        this.registerWidget(libraryWidget);
    }
}