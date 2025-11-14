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
        return widget.app.uikit.createEl({
            classList: ["material-override-inspector"],
            content: [
                this.createMaterialHeader(material),
                this.createTextureOverrideBlock(material, item, widget),
                this.createMaterialPropertiesBlock(material, item, widget)
            ]
        });
    }

    /**
     * Create material header
     */
    createMaterialHeader(material) {
        return widget.app.uikit.createEl({
            classList: ["material-header"],
            content: `Material: ${material.name}`
        });
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
        return widget.app.uikit.createEl({
            classList: ["material-properties"],
            content: [
                this.createColorPicker(material),
                this.createSlider("Metalness", material.metalness),
                this.createSlider("Roughness", material.roughness),
                // Add more material properties as needed
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
        // Apply texture to 3D object using resolved URL
        const resolvedUrl = ATON.Utils.resolveCollectionURL(textureUrl);
        const loader = new THREE.TextureLoader();
        loader.load(resolvedUrl, (texture) => {
            texture.encoding = THREE.sRGBEncoding;
            texture.flipY = false;
            material.map = texture;
            material.needsUpdate = true;
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

        console.log("Updated capability data for item:", item.nid, newData);
        // Store in scene data
        this.setItemData(item, widget, newData);
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
}