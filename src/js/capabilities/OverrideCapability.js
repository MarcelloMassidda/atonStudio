import { Capability } from "./Capability.js";

/**
 * Material override capability with full material control
 */
export class OverrideCapability extends Capability {
  constructor(config = {}) {
    super({
      id: config.id || "override",
      name: config.name || "Material Override",
      isVisible: config.isVisible ?? true, // Default to true - meant to be subclassed
      autoEquip: config.autoEquip ?? false,
      ...config,
    });

    // Store original materials for each item (shared with flare if available)
    this._originalMaterials = null; // Will be set to flare's storage or new Map
  }

  /**
   * Get the original materials storage (from flare or local)
   */
  getOriginalMaterialsStorage() {
    if (this._originalMaterials) return this._originalMaterials;

    // Try to use flare's storage if available
    const flare = ATON.getFlare("Prototyper_flare");
    if (flare && flare._originalMaterials) {
      this._originalMaterials = flare._originalMaterials;
      console.log("📦 Using shared original materials storage from flare");
    } else {
      this._originalMaterials = new Map();
      console.log("📦 Created local original materials storage");
    }

    return this._originalMaterials;
  }

  /**
   * Get the material from the item
   */
  getItemMaterial(item, materialName) {
    let foundMaterial = null;

    item.traverse((child) => {
      if (child.isMesh && child.material && !foundMaterial) {
        const materials = Array.isArray(child.material)
          ? child.material
          : [child.material];

        foundMaterial = materials.find((mat) => mat.name === materialName);
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
        inspectorBlock: (it) =>
          this.createTextureOverrideBlock(material, it, widget),
        get: () =>
          capabilityData?.materials?.[material.name]?.texturePath || null,
        set: (texturePath) => {
          // Update capability data for this item/material
          this.setItemData(item, widget, {
            materials: {
              [material.name]: { texturePath },
            },
          });
        },
      };
    });

    return properties;
  }

  /**
   * Get inspector blocks for all materials
   */
  getInspectorBlocks(item, widget) {
    const materials = this.getMaterialsFromNode(item);
    return materials.map((material) =>
      this.createMaterialOverrideInspector(material, item, widget)
    );
  }

  /**
   * Create full material override inspector //NOT USED YET
   */
  createMaterialOverrideInspector(material, item, widget) {
    return widget.app.uikit.createContainer({
      classList: ["material-override-inspector"],
      content: [
        this.createMaterialHeader(material, widget),
        this.createTextureOverrideBlock(material, item, widget),
        this.createMaterialPropertiesBlock(material, item, widget),
      ],
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
    const hasOverride = !!texturePath;

    const textureSelector = widget.app.uikit.TextureSelectorBlock(
      texturePath || this.getMaterialTexture(material), // fallback to current material texture
      () => this.openTextureSelector(material, item, widget),
      material.name // Pass material name to show it in the UI
    );

    // If material has been overridden, add undo button
    if (hasOverride) {
      const undoBtn = widget.app.uikit.createButton({
        text: "Undo Override",
        icon: "cancel",
        classList: ["btn-sm", "btn-warning", "mt-2"],
        onClick: () => this.restoreOriginalMaterial(material, item, widget),
      });

      return widget.app.uikit.createContainer({
        classList: ["texture-override-block"],
        content: [textureSelector, undoBtn],
      });
    }

    return textureSelector;
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
      ],
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
      node.children.forEach((child) => {
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
          },
        });
      },
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
      wid: widget.id,
    });
  }

  /**
   * Apply texture to material and send patch
   */
  applyTextureToMaterial(material, textureUrl, item, widget) {
    let itemMaterial = this.getItemMaterial(item, material.name);

    if (!itemMaterial) {
      console.error(
        `Material '${material.name}' not found for item ${item.nid}`
      );
      return;
    }

    // Get shared storage
    const storage = this.getOriginalMaterialsStorage();
    if (!storage.has(item.nid)) {
      storage.set(item.nid, new Map());
    }
    const itemOriginals = storage.get(item.nid);

    const resolvedUrl = ATON.Utils.resolveCollectionURL(textureUrl);
    const loader = new THREE.TextureLoader();
    loader.load(resolvedUrl, (texture) => {
      texture.encoding = THREE.sRGBEncoding;
      texture.flipY = false;

      // Clone and replace materials when texture is loaded
      item.traverse((child) => {
        if (child.isMesh && child.material) {
          const materials = Array.isArray(child.material)
            ? child.material
            : [child.material];

          // Clone materials and apply texture
          const newMaterials = materials.map((mat) => {
            if (mat.name === material.name) {
              // Save original before cloning if not already saved
              if (!itemOriginals.has(material.name)) {
                itemOriginals.set(material.name, mat.clone());
                console.log(
                  `💾 [Capability] Saved original material '${material.name}' for item ${item.nid}`
                );
              }

              const clonedMat = mat.clone();
              clonedMat.map = texture;
              clonedMat.needsUpdate = true;
              console.log(
                `✅ [Capability] Applied texture to cloned material '${material.name}' for item ${item.nid}`
              );
              return clonedMat;
            }
            return mat;
          });

          // Replace with cloned materials
          child.material = Array.isArray(child.material)
            ? newMaterials
            : newMaterials[0];
        }
      });
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
          texturePath: textureUrl,
        },
      },
    };

    console.log("📝 Updated capability data for item:", item.nid, newData);

    // Store in scene data (this also sends patch)
    this.setItemData(item, widget, newData);

    // Verify the data was stored
    const scene = widget.getCurrentScene();
    console.log(
      "📊 Scene capabilities after setItemData:",
      JSON.stringify(scene.capabilities, null, 2)
    );

    // CACHE INVALIDATION: Clear ATON._assetsManager cache for this item's URLs
    // This forces fresh loads for new instances, preventing modified materials from being reused
    this.invalidateItemCache(item, scene);

    // Update UI - refresh hierarchy to update item buttons with badges
    console.log("🔄 Refreshing hierarchy and widget panel...");
    widget.app.ui.editor_updateHierarchy();
    widget.app.ui.editor_updateWidgetMainPanel();
  }

  /**
   * Invalidate ATON cache for item's URLs to force fresh loads
   */
  invalidateItemCache(item, scene) {
    // Get URLs from scene data
    const itemData = scene.scenegraph?.nodes?.[item.nid];
    if (!itemData || !itemData.urls || !Array.isArray(itemData.urls)) {
      console.warn(`⚠️ No URLs found for item ${item.nid} in scene data`);
      return;
    }

    // Resolve each URL and clear from cache
    itemData.urls.forEach((url) => {
      const resolvedUrl = ATON.Utils.resolveCollectionURL(url);
      if (
        ATON._assetsManager &&
        ATON._assetsManager[resolvedUrl] !== undefined
      ) {
        ATON._assetsManager[resolvedUrl] = undefined;
        console.log(`🗑️ Invalidated cache for: ${resolvedUrl}`);
      }
    });

    console.log(
      `✨ Cache cleared for ${itemData.urls.length} URL(s) of item ${item.nid}`
    );
  }

  /**
   * Create patch for material changes
   */
  createMaterialPatch(item, material, textureUrl) {
    return {
      materials: {
        [item.id]: {
          [material.name]: {
            texture: textureUrl,
            // Add other material properties as needed
          },
        },
      },
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
    // Initialize with empty materials object for consistent structure
    return {
      materials: {},
    };
  }

  /**
   * Restore original material
   */
  restoreOriginalMaterial(material, item, widget) {
    const storage = this.getOriginalMaterialsStorage();
    const itemOriginals = storage.get(item.nid);
    if (!itemOriginals || !itemOriginals.has(material.name)) {
      console.warn(
        `No original material found for '${material.name}' in item ${item.nid}`
      );
      return;
    }

    const originalMaterial = itemOriginals.get(material.name);

    // Replace the material on the mesh with the original
    item.traverse((child) => {
      if (child.isMesh && child.material) {
        const materials = Array.isArray(child.material)
          ? child.material
          : [child.material];
        const index = materials.findIndex((mat) => mat.name === material.name);

        if (index !== -1) {
          const restoredMaterial = originalMaterial.clone();
          restoredMaterial.needsUpdate = true;

          if (Array.isArray(child.material)) {
            child.material[index] = restoredMaterial;
          } else {
            child.material = restoredMaterial;
          }
          console.log(
            `↩️ Restored original material '${material.name}' for item ${item.nid}`
          );
        }
      }
    });

    // Update light probes to fix lighting after material restoration
    ATON.getRootScene().assignLightProbesByProximity();
    ATON.updateLightProbes();

    // Remove the override from capability data locally
    const currentData = this.getItemData(item, widget) || {};
    if (currentData.materials && currentData.materials[material.name]) {
      delete currentData.materials[material.name];

      // If no more materials overridden, clean up completely
      if (Object.keys(currentData.materials).length === 0) {
        delete currentData.materials;

        // Delete the entire item from scene.capabilities
        const scene = widget.getCurrentScene();
        if (scene.capabilities && scene.capabilities[this.id]) {
          delete scene.capabilities[this.id][item.nid];
        }
      } else {
        // Update scene with remaining materials
        const scene = widget.getCurrentScene();
        if (scene.capabilities && scene.capabilities[this.id]) {
          scene.capabilities[this.id][item.nid] = currentData;
        }
      }
    }

    // Send delete patch with empty object for this material
    const deletePatch = {
      capabilities: {
        [this.id]: {
          [item.nid]: {
            materials: {
              [material.name]: {},
            },
          },
        },
      },
    };

    widget.composePatch(deletePatch, ATON.SceneHub.MODE_DEL);
    console.log(
      `🗑️ Sent delete patch for material '${material.name}' in item ${item.nid}`
    );

    // Update UI
    widget.app.ui.editor_updateHierarchy();
    widget.app.ui.editor_updateWidgetMainPanel();

    // Refocus on the item to update inspector
    widget.app.widgetsHub.focusOnItem({
      id: item.nid,
      wid: widget.id,
    });
  }

  /**
   * Check if this capability can be equipped to an item
   * Override capability requires materials with different names
   */
  canEquip(item, widget) {
    // Collect all materials from the node
    const materials = [];
    item.traverse((child) => {
      if (child.isMesh && child.material) {
        const mats = Array.isArray(child.material)
          ? child.material
          : [child.material];
        materials.push(...mats);
      }
    });

    // Check if there are any materials
    if (materials.length === 0) {
      console.log(`❌ Override capability: No materials found in ${item.nid}`);
      return false;
    }

    // Get material names
    const materialNames = materials.map((mat) => mat.name || "");

    // Check if all materials have different names
    const uniqueNames = new Set(materialNames);
    if (uniqueNames.size === materialNames.length) {
      console.log(
        `✅ Override capability: All materials have different names in ${item.nid}`
      );
      return true;
    }

    console.log(
      `❌ Override capability: Materials don't all have different names in ${item.nid}`
    );
    return false;
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
      text: "🔥",
      type: "info",
      title: "Has override capability",
    });

    return btnOptions;
  }
}
