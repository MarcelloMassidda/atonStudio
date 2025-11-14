import { Widget } from './base/Widget.js';

/**
 * Widget for managing 3D model layers in the scene
 */
export class LayerWidget extends Widget {
    constructor(app) {
        const options = {
            id: "layers",
            hierarchy: true,
            mainBtnOptions: {
                id: "layers_mainBtn",
                text: "Models",
                icon: "collection-item"
            },
            mainPanelOptions: {
                title: "Models"
            },
            createBtnOptions: {
                text: "Add new model",
                icon: "add"
            },
            // Define how to get items from the scene
            items: () => {
                const scene = this.getCurrentScene();
                if (!scene.scenegraph) return null;
                if (!scene.scenegraph.nodes) return null;
                return scene.scenegraph.nodes;
            },
            // item button renderer (backwards-compatible)
            itemBtn: (id, item) => {
                const objNum = item.urls ? item.urls.length : 0;
                let _itemName = id;
                // Badge handling moved to ScreenOverrideCapability.decorateItemBtn
                console.log("CREATING from LAYER WIDGET ITEM BTN for item:", id, item);
                return app.widgetsHub.mainBtn_base({
                    text: _itemName,
                    attr: { "data-id": id, "data-wid": "layers" },
                    onClick: function () { app.widgetsHub.onClicked_itemBtn_base(this); }
                });
            },
            // Define how to get a specific item
            returnItem: (nid) => ATON.getSceneNode(nid),
            props: {
                position: {
                    inspectorBlock: (node) => this.createPositionInspector(node),
                    get: () => this.getActiveNodeProperty('position')
                },
                rotation: {
                    inspectorBlock: (node) => this.createRotationInspector(node),
                    get: () => this.getActiveNodeProperty('rotation')
                },
                scale: {
                    inspectorBlock: (node) => this.createScaleInspector(node),
                    get: () => this.getActiveNodeProperty('scale')
                }
            },
            components: {
                delete: {
                    inspectorBlock: (node) => this.createDeleteButton(node)
                }
            }
        };

        super(app, options);
        this.gizmoManager = app.gizmoManager;

        // bind create button handler after super (can't use `this` before super)
        if (this.options && this.options.createBtnOptions) {
            this.options.createBtnOptions.onClick = () => this.createBtnClicked();
        }
    }

    // No texturizable features in base LayerWidget

    /**
     * Open model gallery and create a new layer when selected
     */
    createBtnClicked() {
        const onModelItemClicked = async ({url, id, type}) => {
            if (!url || !id) {
                console.error("Invalid model data");
                return;
            }

            ATON.UI.hideModal();
            const nodeName = ATON.Utils.generateID(id);

            // Add in scene
            ATON.createSceneNode(nodeName)
                .load(url, () => {
                    this.updateEditorOnModelAdded(nodeName, url, type);
                    ATON.getRootScene().assignLightProbesByProximity();
                    ATON.updateLightProbes();
                })
                .setPosition(0, 0, 0)
                .attachToRoot();
        };

        // Show model gallery
        this.app.uikit.createModelGallery({ onModelItemClicked });
    }

    /**
     * Update editor state after adding a model
     */
    updateEditorOnModelAdded(nodeName, url, type) {
        // Update currentScene locally
        const scene = this.getCurrentScene();
        
        // Update scenegraph nodes
        const newSceneGraphNode = { urls: [url] };
        if (!scene.scenegraph) scene.scenegraph = { nodes: {}, edges: { ".": [] } };
        scene.scenegraph.nodes[nodeName] = newSceneGraphNode;
        
        // Update edges
        if (!scene.scenegraph.edges) {
            scene.scenegraph.edges = { ".": [nodeName] };
        } else {
            if (!Array.isArray(scene.scenegraph.edges["."])) scene.scenegraph.edges["."] = [];
            scene.scenegraph.edges["."].push(nodeName);
        }

        // If customizables, set default texture entry
        if (type === "customizables") {
            const getDefaultTexturePathByNodeId = (modelId) => {
                const customizables = this.app.config?.models?.customizables;
                if (!customizables) return null;
                const basePath = this.app.config.baseCustomizablesDefaultTexturesPath;
                const obj = customizables.find(item => item.nodeId === modelId);
                return obj ? basePath + obj.textureDefaultPath : null;
            };

            scene.texturized = scene.texturized ? scene.texturized : {};
            scene.texturized[nodeName] = { imageScreenPath: getDefaultTexturePathByNodeId(nodeName) };
        }

        // Focus on the new node
        this.app.widgetsHub.focusOnItem({ id: nodeName, wid: this.id });

        // Compose patch for the addition
        this.composePatch({
            scenegraph: {
                nodes: {
                    [nodeName]: newSceneGraphNode
                },
                edges: scene.scenegraph.edges
            }
        });

        // Update UI
        this.app.ui.editor_updateHierarchy();
        this.app.ui.editor_updateWidgetMainPanel();
    }

    /**
     * Create transform inspector blocks
     */
    createPositionInspector(node) {
        return this.createTransformInspector("position", node);
    }

    createRotationInspector(node) {
        return this.createTransformInspector("rotation", node);
    }

    createScaleInspector(node) {
        return this.createTransformInspector("scale", node);
    }

    createTransformInspector(property, node) {
        return this.app.widgetsHub.parsers.vector3({
            id: `layer_${property}_V3`,
            title: property.charAt(0).toUpperCase() + property.slice(1),
            property: property,
            v: node[property],
            target: node,
            onChange: (evt) => this.onTransformChange(evt)
        });
    }

    /**
     * Handle transform changes
     */
    onTransformChange(evt) {
        if (!evt.target) throw new Error("no evt.target to manage");
        const propName = evt.target.dataset.property;
        // Prefer new API (getProperties) but fall back to legacy props
        let propHandler = null;
        if (this.getProperties && typeof this.getProperties === 'function') {
            const props = this.getProperties();
            propHandler = props ? props[propName] : null;
        }
        if (!propHandler && this.editor && this.editor.activeWidget) {
            const aw = this.editor.activeWidget;
            if (aw.getProperties && typeof aw.getProperties === 'function') {
                const props = aw.getProperties();
                propHandler = props ? props[propName] : null;
            } else if (aw.props) {
                propHandler = aw.props[propName];
            }
        }
        if (!propHandler) throw new Error("no propHandler to manage");
        const value = propHandler.get();
        this.composePatchTransform(propName, value);
    }

    /**
     * Create delete button
     */
    createDeleteButton(node) {
        return this.app.uikit.deleteButton({
            icon: "trash",
            text: "Remove",
            onClick: () => this.deleteLayer(node.nid)
        });
    }

    /**
     * Delete a layer
     */
    deleteLayer(nid) {
        if (!this.editor.checkPendingPatch()) return;

        // Live changes
        this.gizmoManager.detachGizmo();
        this.editor.activeNode.delete();

        // Update local graph
        const nodes = this.getCurrentScene().scenegraph.nodes;
        if (nodes[nid]) delete nodes[nid];
        
        // Update UI
        this.app.ui.editor_updateHierarchy();
        this.app.ui.editor_updateWidgetMainPanel();
        this.editor.onCloseInspectorBtnClicked();

        // Send delete patch
        this.composePatch({
            scenegraph: { nodes: { [nid]: {} } },
            texturized: { [nid]: {} }
        }, ATON.SceneHub.MODE_DEL);
    }

    /**
     * Compose transform patch
     */
    composePatchTransform(propName, value) {
        const node = this.editor.activeNode;
        if (!node) throw new Error("no node");

        const transformProps = ["position", "rotation", "scale"];
        const nid = node.nid;
        
        let patch = {
            scenegraph: {
                nodes: {
                    [nid]: {}
                }
            }
        };

        if (transformProps.includes(propName)) {
            patch.scenegraph.nodes[nid].transform = {
                [propName]: [value.x, value.y, value.z]
            };
        } else {
            patch.scenegraph.nodes[nid][propName] = value;
        }

        this.composePatch(patch);
    }

    /**
     * Compose and send patch
     */
    composePatch(patch, mode = ATON.SceneHub.MODE_ADD) {
        this.editor.patch = {
            ...this.editor.patch,
            ...patch
        };
        this.editor.modePatch = mode;
        this.editor.OnPatchChanged();
    }

    /**
     * Get property of active node
     */
    getActiveNodeProperty(prop) {
        return this.editor.activeNode?.[prop];
    }

    /**
     * Get texture for node
     */
    getTextureForNode(nid) {
        return this.getCurrentScene().texturized?.[nid]?.imageScreenPath;
    }

    /**
     * Setup gizmo with custom handler
     */
    setupGizmo(id) {
        const node = ATON.getSceneNode(id);
        this.editor.setGizmoByNode(node);
        this.app.ui.editor_setGizmoToolbox();
        this.editor.udpateGizmoOnMouseUpListener((evt) => this.handleGizmo(evt));
    }

    /**
     * Handle gizmo interactions
     */
    handleGizmo(evt) {
        const gizmoOptions = {
            translate: {
                propertyName: "position",
                idVector3UIContainer: "layer_position_V3",
                getProperty: (n) => n.position
            },
            rotate: {
                propertyName: "rotation",
                idVector3UIContainer: "layer_rotation_V3",
                getProperty: (n) => n.rotation
            },
            scale: {
                propertyName: "scale",
                idVector3UIContainer: "layer_scale_V3",
                getProperty: (n) => n.scale
            }
        };

        // Update inspector
        const inspectorUpdater = this.editor.gizmoToInspectorMapper(gizmoOptions);
        inspectorUpdater(evt);

        // Compose patch
        const mode = this.gizmoManager.control.mode;
        const propName = gizmoOptions[mode].propertyName;
        if (!propName) throw new Error("no property name in gizmo handler");
        
        const activeNode = this.editor.activeNode;
        const value = gizmoOptions[mode].getProperty(activeNode);
        this.composePatchTransform(propName, value);
    }
}