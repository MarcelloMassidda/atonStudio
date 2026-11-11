import { LayerWidget } from "./LayerWidget.js";

/**
 * LayerWidget variant (exhibition template) that adds models from the
 * curated catalog of config.json instead of the media library.
 * Same id ("layers"), component and scene data as LayerWidget.
 */
export class LibraryLayerWidget extends LayerWidget {

  /**
   * Override to use model gallery instead of file browser
   */
  createBtnClicked() {
    this.app.uikit.createModelGallery({
      onModelItemClicked: this.handleModelSelected.bind(this),
    });
  }

  /**
   * Handle model selection from gallery
   */
  async handleModelSelected({ url, id, type }) {
    if (!url || !id) {
      console.error("Invalid model data");
      return;
    }

    ATON.UI.hideModal();
    const nodeName = ATON.Utils.generateID(id);

    // Add in scene
    ATON.createSceneNode(nodeName)
      .setCloneOnLoadHit(true) // Clone materials to prevent sharing between instances
      .load(url, () => {
        this.updateEditorOnModelAdded(nodeName, url, type);
        ATON.getRootScene().assignLightProbesByProximity();
        ATON.updateLightProbes();
      })
      .setPosition(0, 0, 0)
      .attachToRoot();
  }
}
