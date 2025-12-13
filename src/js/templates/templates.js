import { Template } from "./Template.js";
import { LayerWidget } from "../widgets/LayerWidget.js";
import { LibraryLayerWidget } from "../widgets/LibraryLayerWidget.js";
import { PointOfViewWidget } from "../widgets/PointOfViewWidget.js";
import { MeasurementsWidget } from "../widgets/MeasurementsWidget.js";
import { SemanticsWidget } from "../widgets/SemanticsWidget.js";
import { OverrideBehaviour } from "../behaviours/OverrideBehaviour.js";
import { ScreenOverrideBehaviour } from "../behaviours/ScreenOverrideBehaviour.js";
import { BasicSemanticInfoBehaviour } from "../behaviours/BasicSemanticInfoBehaviour.js";

/**
 * Free prototyping template with full behaviours
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

  // Create layer widget with full override behaviour
  const layerWidget = new LayerWidget(app);
  layerWidget.registerBehaviour(new OverrideBehaviour());
  template.registerWidget(layerWidget);

  // Create point of view widget
  const povWidget = new PointOfViewWidget(app);
  template.registerWidget(povWidget);

  // Create measurements widget
  const measurementsWidget = new MeasurementsWidget(app);
  template.registerWidget(measurementsWidget);

  // Create semantics widget with BasicSemanticInfo behaviour (action-only)
  const semanticsWidget = new SemanticsWidget(app);
  semanticsWidget.registerBehaviour(new BasicSemanticInfoBehaviour());
  template.registerWidget(semanticsWidget);

  return template;
};

/**
 * Exhibition design template with simplified behaviours
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

  // Create library widget with screen override behaviour
  const libraryWidget = new LibraryLayerWidget(app);
  libraryWidget.registerBehaviour(new ScreenOverrideBehaviour());

  template.registerWidget(libraryWidget);
  return template;
};
