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
  static keys = ["urls", "transform"];
  static actions = { toggleVisible: { name: "Toggle Layer Visibility" } };

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
  static keys = ["position", "target", "fov"];
  static actions = { goToPov: { name: "Go to Point of View" } };
}

/**
 * Measurement = a distance between two points. Scene JSON: measurements[id] = { points:[ax,ay,az, bx,by,bz] }
 * ATON draws all measurements in one shared group (ATON.SUI.gMeasures): this
 * component owns only its own objects there (2 ticks, line, label).
 * The draggable spheres shown when a measurement is selected are a widget helper.
 */
export class MeasurementComponent extends Component {
  static type = "measurement";
  static defaults = { points: [0, 0, 0, 0, 0, 0] };
  static keys = ["points"];

  mount() {
    const SUI = ATON.SUI;
    const p = this.data.points;
    const from = SUI.gMeasures.children.length;
    const pending = SUI._prevMPoint; // don't break a measurement the user is drawing
    SUI._prevMPoint = undefined;
    SUI.addMeasurementPoint(new THREE.Vector3(p[0], p[1], p[2]));
    SUI.addMeasurementPoint(new THREE.Vector3(p[3], p[4], p[5]));
    SUI._prevMPoint = pending;
    this.parts = SUI.gMeasures.children.slice(from);
    return this;
  }

  apply(changes = {}) {
    super.apply(changes);
    if (changes.points) {
      this.removeParts();
      this.mount();
    }
    return this;
  }

  removeParts() {
    MeasurementComponent.removeObjects(this.parts || []);
    this.parts = [];
  }

  dispose() {
    this.removeParts();
    super.dispose();
  }

  getObjects() {
    return this.parts || [];
  }

  /** Remove measurement objects (and their labels) from ATON's shared group */
  static removeObjects(objects) {
    const SUI = ATON.SUI;
    for (const o of objects) {
      SUI.gMeasures.remove(o);
      SUI._measLabels = SUI._measLabels.filter((L) => L !== o);
    }
  }
}

/**
 * Semantic node = an ATON semantic node (hotspot), sphere or convex shape.
 * Scene JSON: semanticgraph.nodes[id] = { spheres:[[x,y,z,r]] } | { convexshapes:[…] }, plus `events`
 * (actions), which belong to the action system and are NOT owned here.
 * Only the first sphere is editable; convex shapes are fixed once drawn.
 */
export class SemanticNodeComponent extends Component {
  static type = "semanticNode";
  static keys = ["spheres", "convexshapes"];

  mount() {
    this.object3D = ATON.getSemanticNode(this.id) || null;
    return this;
  }

  get shape() {
    return this.data.spheres ? "sphere" : this.data.convexshapes ? "convex" : null;
  }

  /** First sphere as {position:[x,y,z], radius} (null for convex shapes) */
  get sphere() {
    const s = this.data.spheres?.[0];
    return s ? { position: [s[0], s[1], s[2]], radius: s[3] } : null;
  }

  apply(changes = {}) {
    super.apply(changes); // arrays (spheres) are replaced, not merged
    const mesh = this.object3D?.children[0];
    const s = changes.spheres?.[0];
    if (mesh && s) {
      mesh.position.set(s[0], s[1], s[2]);
      mesh.scale.setScalar(s[3]);
    }
    return this;
  }

  /** The gizmo moves the sphere directly: read it back */
  serialize() {
    if (this.data.spheres && this.object3D) {
      this.data.spheres = ATON.SceneHub.getJSONsemanticSpheresList(this.id);
    }
    return super.serialize();
  }

  dispose() {
    this.object3D?.delete();
    super.dispose();
  }
}

// #endregion
