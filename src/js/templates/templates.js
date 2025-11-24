import { Template } from "./Template.js";
import { LayerWidget } from "../widgets/LayerWidget.js";
import { LibraryLayerWidget } from "../widgets/LibraryLayerWidget.js";
import { PointOfViewWidget } from "../widgets/PointOfViewWidget.js";
import { MeasurementsWidget } from "../widgets/MeasurementsWidget.js";
import { SemanticsWidget } from "../widgets/SemanticsWidget.js";
import { OverrideCapability } from "../capabilities/OverrideCapability.js";
import { ScreenOverrideCapability } from "../capabilities/ScreenOverrideCapability.js";
import { BasicSemanticInfo_action } from "../capabilities/BasicSemanticInfo_action.js";

/**
 * Free prototyping template with full capabilities
 */
export const createFreeTemplate = (app) => {
  const template = new Template({
    id: "free",
    name: "Free Prototyping",
    allowedActions: {
      layers: ["toggleVisible"],
      annotations: ["editDescription"],
      viewpoints: ["goToPov"],
      measurements: [],
    },
  });

  // Create layer widget with full override capability
  const layerWidget = new LayerWidget(app);
  layerWidget.registerCapability(new OverrideCapability());
  template.registerWidget(layerWidget);

  // Create point of view widget
  const povWidget = new PointOfViewWidget(app);
  template.registerWidget(povWidget);

  // Create measurements widget
  const measurementsWidget = new MeasurementsWidget(app);
  template.registerWidget(measurementsWidget);

  // Create semantics widget with BasicSemanticInfo_action (action-only capability)
  const semanticsWidget = new SemanticsWidget(app);
  semanticsWidget.registerCapability(new BasicSemanticInfo_action());
  template.registerWidget(semanticsWidget);

  return template;
};

/**
 * Exhibition design template with simplified capabilities
 */
export const createExhibitionTemplate = (app) => {
  const template = new Template({
    id: "exhibition",
    name: "Exhibition Design",
    allowedActions: {
      layers: [],
      annotations: [],
    },
  });

  // Create library widget with screen override capability
  const libraryWidget = new LibraryLayerWidget(app);
  libraryWidget.registerCapability(new ScreenOverrideCapability());

  template.registerWidget(libraryWidget);
  return template;
};
