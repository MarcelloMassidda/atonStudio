import { Component, toArray3 } from "./Component.js";

/**
 * Component types used by the widgets.
 * The ATON-backed ones are declared here; new types (lights, projector…)
 * go in their own file and are re-exported from here.
 */

// ============================================================
// #region ATON-backed components
// ============================================================

/**
 * Layer = an ATON scene node loaded from one or more model urls.
 * Scene JSON: scenegraph.nodes[id] = { urls, transform:{position, rotation, scale} }
 * ATON builds the node when it parses the scene; mount() adopts it.
 */
export class LayerComponent extends Component {
  static type = "layer";
  static defaults = { transform: {} };

  mount() {
    this.object3D = ATON.getSceneNode(this.id) || null;
    return this;
  }

  apply(changes = {}) {
    super.apply(changes);
    const N = this.object3D;
    const t = changes.transform;
    if (N && t) {
      if (t.position) N.setPosition(...t.position);
      if (t.rotation) N.setRotation(...t.rotation);
      if (t.scale) N.setScale(...t.scale);
    }
    return this;
  }

  /** The gizmo moves the node directly: read the transform back from it */
  serialize() {
    const N = this.object3D;
    if (N) {
      this.data.transform = {
        ...this.data.transform,
        position: toArray3(N.position),
        rotation: toArray3(N.rotation),
        scale: toArray3(N.scale),
      };
    }
    return super.serialize();
  }

  dispose() {
    this.object3D?.delete();
    super.dispose();
  }
}

/**
 * Viewpoint = a camera pose. Scene JSON: viewpoints[id] = { position, target, fov }
 * No runtime object in the editor: ATON turns it into an ATON.POV in Hathor,
 * and the 3D icon (sphere, line, cone) is an editor helper owned by the widget.
 */
export class ViewpointComponent extends Component {
  static type = "viewpoint";
  static defaults = { position: [0, 0, 0], target: [0, 0, 1] };
}

// #endregion
