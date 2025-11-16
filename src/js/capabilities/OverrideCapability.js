import { Capability } from './Capability.js';

/**
 * Material override capability with full material control
 */
export class OverrideCapability extends Capability {
    constructor(config = {}) {
        super({
            id: 'override',
            name: 'Material Override',
            config
        });
    }

    /**
     * Get the material from the item
     */
    getItemMaterial(item, materialName) {
        let foundMaterial = null;
        
        item.traverse((child) => {
            if (child.isMesh && child.material && !foundMaterial) {
                const materials = Array.isArray(child.material) ? 
                    child.material : [child.material];
                
                foundMaterial = materials.find(mat => mat.name === materialName);
            }
        });
        
        return foundMaterial;
    }

    /**
     * Get properties for this capability
     * @param {Object} item - The item to get properties for
     * @param {Object} widget - The parent widget
     * @returns {Object} Property definitions
     */
    getProperties(item, widget) {
        const materials = this.getMaterialsFromNode(item);
        const properties = {};
        const capabilityData = this.getItemData(item, widget) || {};

        // For each material expose a texture property that renders the texture selector block
        materials.forEach((material, index) => {
            const key = material.name || `material_${index}`;
            properties[key] = {
                inspectorBlock: (it) => this.createTextureOverrideBlock(material, it, widget),
                get: () => capabilityData?.materials?.[material.name]?.texturePath || null,
                set: (texturePath) => {
                    // Update capability data for this item/material
                    this.setItemData(item, widget, {
                        materials: {
                            [material.name]: { texturePath }
                        }
                    });
                }
            };
        });

        return properties;
    }

    /**
     * Get inspector blocks for all materials
     */
    getInspectorBlocks(item, widget) {
        const materials = this.getMaterialsFromNode(item);
        return materials.map(material => 
            this.createMaterialOverrideInspector(material, item, widget)
        );
    }

    /**
     * Create full material override inspector
     */
    createMaterialOverrideInspector(material, item, widget) {
        return widget.app.uikit.createContainer({
            classList: ["material-override-inspector"],
            content: [
                this.createMaterialHeader(material, widget),
                this.createTextureOverrideBlock(material, item, widget),
                this.createMaterialPropertiesBlock(material, item, widget)
            ]
        });
    }

    /**
     * Create material header
     */
    createMaterialHeader(material, widget) {
        return widget.app.uikit.createElfromString(
            `<div class="material-header">Material: ${material.name}</div>`
        );
    }

    /**
     * Create texture override block
     */
    createTextureOverrideBlock(material, item, widget) {
        // Get current texture from capability data
        const capabilityData = this.getItemData(item, widget);
        const texturePath = capabilityData?.materials?.[material.name]?.texturePath;
        
        return widget.app.uikit.TextureSelectorBlock(
            texturePath || this.getMaterialTexture(material), // fallback to current material texture
            () => this.openTextureSelector(material, item, widget)
        );
    }

    /**
     * Create material properties block
     */
    createMaterialPropertiesBlock(material, item, widget) {
        // Create controls for color, metalness, roughness, etc.
        return widget.app.uikit.createContainer({
            classList: ["material-properties"],
            content: [
                this.createColorPicker(material),
                this.createSlider("Metalness", material.metalness),
                this.createSlider("Roughness", material.roughness),
            ]
        });
    }

    /**
     * Get all materials from a node
     */
    getMaterialsFromNode(item) {
        const node = item;
        return node ? this.extractMaterials(node) : [];
    }

    /**
     * Extract all materials from a node recursively
     */
    extractMaterials(node) {
        let materials = [];
        
        // Get materials from this node
        if (node.material) {
            materials.push(node.material);
        }
        
        // Recursively get materials from children
        if (node.children) {
            node.children.forEach(child => {
                materials = materials.concat(this.extractMaterials(child));
            });
        }
        console.log("Extracted materials from node:", node.id, materials);
        return materials;
    }

    /**
     * Open texture selector
     */
    openTextureSelector(material, item, widget) {
        widget.app.uikit.createMediaGallery({
            onMediaItemClicked: (mediaItem) => {
                this.onTextureSelected(material, mediaItem, item, widget);
            },
            onAddFileBtnClicked: (evt) => {
                widget.app.db.openFileDialog({
                    callback: () => {
                        console.log("updating media picker gallery");
                        this.openTextureSelector(material, item, widget);
                        widget.app.uikit.setLoadingCursor(false);
                    }
                });
            }
        });
    }

    /**
     * Handle complete texture selection workflow
     */
    onTextureSelected(material, mediaItem, item, widget) {
        // Hide the media gallery modal
        ATON.UI.hideModal();
        
        if (!item) throw new Error("no item to apply texture to");
        
        // Store original URL in capability data but apply resolved URL to material
        this.applyTextureToMaterial(material, mediaItem.url, item, widget);
        
        // Refocus on the item to update inspector and view
        widget.app.widgetsHub.focusOnItem({ 
            id: item.nid, 
            wid: widget.id 
        });
    }

    /**
     * Apply texture to material and send patch
     */
    applyTextureToMaterial(material, textureUrl, item, widget) {
        let itemMaterial = this.getItemMaterial(item, material.name);
        
        if (!itemMaterial) {
            console.error(`Material '${material.name}' not found for item ${item.nid}`);
            return;
        }

        // Clone the material before applying texture to avoid sharing
        const clonedMaterial = itemMaterial.clone();
        
        // Replace the material on the mesh
        item.traverse((child) => {
            if (child.isMesh && child.material) {
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                const index = materials.findIndex(mat => mat.name === material.name);
                
                if (index !== -1) {
                    if (Array.isArray(child.material)) {
                        child.material[index] = clonedMaterial;
                    } else {
                        child.material = clonedMaterial;
                    }
                    console.log(`✂️ Cloned and replaced material '${material.name}' for item ${item.nid}`);
                }
            }
        });

        const resolvedUrl = ATON.Utils.resolveCollectionURL(textureUrl);
        const loader = new THREE.TextureLoader();
        loader.load(resolvedUrl, (texture) => {
            texture.encoding = THREE.sRGBEncoding;
            texture.flipY = false;
            clonedMaterial.map = texture;
            clonedMaterial.needsUpdate = true;
            console.log(`✅ Applied texture to cloned material '${material.name}' for item ${item.nid}`);
        });

        // Get current capability data
        const currentData = this.getItemData(item, widget) || {};
        
        // Update capability data
        const newData = {
            ...currentData,
            materials: {
                ...(currentData.materials || {}),
                [material.name]: {
                    ...(currentData.materials?.[material.name] || {}),
                    texturePath: textureUrl
                }
            }
        };

        console.log("📝 Updated capability data for item:", item.nid, newData);
        
        // Store in scene data (this also sends patch)
        this.setItemData(item, widget, newData);
        
        // Verify the data was stored
        const scene = widget.getCurrentScene();
        console.log("📊 Scene capabilities after setItemData:", JSON.stringify(scene.capabilities, null, 2));

        // Update UI - refresh hierarchy to update item buttons with badges
        console.log("🔄 Refreshing hierarchy and widget panel...");
        widget.app.ui.editor_updateHierarchy();
        widget.app.ui.editor_updateWidgetMainPanel();
    }

    /**
     * Create patch for material changes
     */
    createMaterialPatch(item, material, textureUrl) {
        return {
            materials: {
                [item.id]: {
                    [material.name]: {
                        texture: textureUrl
                        // Add other material properties as needed
                    }
                }
            }
        };
    }

    /**
     * Get current texture for material
     */
    getMaterialTexture(material) {
        let t = material.map?.source?.data?.currentSrc;
        console.log("Current texture for material", material.name, "is", t);
        return t;
    }

    /**
     * Get initial data when capability is equipped
     */
    getInitialData(item) {
        return {};
    }

    /**
     * Called when capability is equipped
     */
    equip(item, widget) {
        console.log(`Equipping override capability for item ${item.nid}`);
        return super.equip(item, widget);
    }

        /**
     * Decorate the item button with a 🛠️ badge if the item has screen material override
     */
    decorateItemBtn(btnOptions, item, widget) {

        // Initialize or get existing badges array
        btnOptions.badges = btnOptions.badges || [];
        
        // Add our badge
        btnOptions.badges.push({
            text: '🔥',
            type: 'info',
            title: 'Has override capability'
        });

        return btnOptions;
    }
}