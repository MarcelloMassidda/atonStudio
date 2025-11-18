import { Template } from "./Template.js";
import { LayerWidget } from "../widgets/LayerWidget.js";
import { LibraryLayerWidget } from "../widgets/LibraryLayerWidget.js";
import { PointOfViewWidget } from "../widgets/PointOfViewWidget.js";
import { OverrideCapability } from "../capabilities/OverrideCapability.js";
import { ScreenOverrideCapability } from "../capabilities/ScreenOverrideCapability.js";

/**
 * Free prototyping template with full capabilities
 */
export const createFreeTemplate = (app) => {
  const template = new Template({
    id: "free",
    name: "Free Prototyping",
  });

  // Create layer widget with full override capability
  const layerWidget = new LayerWidget(app);
  layerWidget.registerCapability(new OverrideCapability());
  template.registerWidget(layerWidget);

  // Create point of view widget
  const povWidget = new PointOfViewWidget(app);
  template.registerWidget(povWidget);

  return template;
};

/**
 * Exhibition design template with simplified capabilities
 */
export const createExhibitionTemplate = (app) => {
  const template = new Template({
    id: "exhibition",
    name: "Exhibition Design",
  });

  // Create library widget with screen override capability
  const libraryWidget = new LibraryLayerWidget(app);
  libraryWidget.registerCapability(new ScreenOverrideCapability());

  template.registerWidget(libraryWidget);
  return template;
};
