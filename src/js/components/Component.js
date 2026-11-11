/**
 * Component — a runtime entity of the scene, with NO authoring UI.
 *
 * - data        what goes in the scene description (plain JSON)
 * - object3D    the runtime object, if any (ATON node, three.js light…)
 *
 * The widget owns everything editor-only: inspector, gizmo, helpers/icons,
 * persistence (patches). It talks to its components only through:
 *   mount()          create/adopt the runtime object
 *   apply(changes)   update data + runtime object (partial, idempotent)
 *   serialize()      current state as scene-description JSON
 *   dispose()        remove the runtime object
 *
 * Components that must also run in Hathor keep their 3D logic in the
 * prototyper flare (like behaviours); ATON-backed ones (see components.js)
 * rely on ATON, which already parses their scene keys.
 */
export class Component {
  static type = "component";
  static defaults = {};
  /**
   * Keys of the scene entry this component owns (null = all). Others stay
   * untouched in the scene, e.g. a semantic node's `events` belong to the
   * action system, not to the component.
   */
  static keys = null;
  /**
   * Actions this component type can perform at runtime (Hathor), id → { name }.
   * The runtime of each id is registered in the prototyper flare (F.registerRuntime);
   * the widget adds the authoring parts (Widget.getActionAuthoring).
   */
  static actions = {};

  constructor(id, data = {}) {
    this.id = id;
    const keys = this.constructor.keys;
    const owned = keys ? Object.fromEntries(Object.entries(data || {}).filter(([k]) => keys.includes(k))) : data;
    this.data = deepMerge(deepMerge({}, this.constructor.defaults), owned || {});
    this.object3D = null;
  }

  mount() {
    return this;
  }

  apply(changes = {}) {
    deepMerge(this.data, changes);
    return this;
  }

  serialize() {
    return deepMerge({}, this.data);
  }

  dispose() {
    this.object3D = null;
  }
}

/**
 * Deep-merge plain JSON `src` into `target` (arrays and values are copied, not shared).
 * @returns {Object} target
 */
export const deepMerge = (target, src) => {
  for (const [k, v] of Object.entries(src || {})) {
    if (Array.isArray(v)) target[k] = v.map((x) => (x && typeof x === "object" ? deepMerge(Array.isArray(x) ? [] : {}, x) : x));
    else if (v && typeof v === "object") {
      if (!target[k] || typeof target[k] !== "object" || Array.isArray(target[k])) target[k] = {};
      deepMerge(target[k], v);
    } else target[k] = v;
  }
  return target;
};

/** THREE.Vector3 / Euler → [x, y, z] */
export const toArray3 = (v) => [v.x, v.y, v.z];
