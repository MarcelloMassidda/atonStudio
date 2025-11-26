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
   * Create the authoring UI for material override
   * This is the single source of truth for override configuration
   */
  createAuthoringUI(context) {
    const { itemId, currentData, onSave, widget, mode } = context;
    
    // Get the item node
    const item = widget.getItem(itemId);
    if (!item) {
      console.warn(`Item ${itemId} not found`);
      return null;
    }
    
    // Get materials from the item
    const materials = this.getMaterialsFromNode(item);
    
    if (materials.length === 0) {
      return widget.app.uikit.createText({
        text: "No materials found on this item",
        classList: ['text-muted', 'fst-italic']
      });
    }
    
    const container = widget.app.uikit.createContainer({
      classList: ['material-override-authoring']
    });
    
    // Create a texture selector for each material
    materials.forEach(material => {
      const matName = material.name;
      const currentTexture = currentData?.materials?.[matName]?.texturePath;
      
      // Create texture selector block
      const textureBlock = widget.app.uikit.TextureSelectorBlock(
        currentTexture || this.getMaterialTexture(material),
        () => this.openTextureSelectorForMaterial(matName, itemId, widget, mode, onSave),
        matName
      );
      
      container.appendChild(textureBlock);
      
      // If material has override, add undo button
      if (currentTexture) {
        const undoBtn = widget.app.uikit.createButton({
          text: "Restore Original",
          icon: "undo",
          classList: ['btn-sm', 'btn-warning', 'mt-1', 'mb-3'],
          onClick: () => this.restoreOriginalTexture(matName, itemId, widget, mode, onSave)
        });
        container.appendChild(undoBtn);
      }
    });
    
    return container;
  }

  /**
   * Open texture selector modal for a specific material
   */
  openTextureSelectorForMaterial(materialName, itemId, widget, mode, onSaveCallback) {
    widget.app.uikit.createMediaGallery({
      title: `Select Texture for ${materialName}`,
      onMediaItemClicked: ({ url }) => {
        // Close modal first
        ATON.UI.hideModal();
        
        if (mode === 'direct') {
          // Direct mode: save immediately to item
          this.saveTexture(itemId, materialName, url, widget);
        } else if (mode === 'action') {
          // Action mode: call callback (action will handle saving)
          onSaveCallback({
            itemId,
            materialName,
            texturePath: url
          });
        }
      }
    });
  }

  /**
   * Save texture to item's capability data and apply to 3D model
   */
  saveTexture(itemId, materialName, texturePath, widget) {
    const item = widget.getItem(itemId);
    if (!item) {
      console.error(`Item ${itemId} not found`);
      return;
    }
    
    // Get the material object
    const material = this.getItemMaterial(item, materialName);
    if (!material) {
      console.error(`Material ${materialName} not found in item ${itemId}`);
      return;
    }
    
    // Apply texture to the 3D model (this also patches and saves to scene)
    this.applyTextureToMaterial(material, texturePath, item, widget);
    
    console.log(`✅ Saved and applied texture for ${materialName} on ${itemId}`);
    
    // Refocus on item to properly reload inspector
    widget.app.widgetsHub.focusOnItem({ id: itemId, wid: widget.id });
  }

  /**
   * Restore original texture for a material
   */
  restoreOriginalTexture(materialName, itemId, widget, mode, onSaveCallback) {
    if (mode === 'direct') {
      const item = widget.getItem(itemId);
      if (!item) {
        console.error(`Item ${itemId} not found`);
        return;
      }
      
      // Get the material object (create a minimal material object for restoreOriginalMaterial)
      const material = { name: materialName };
      
      // Actually restore the material on the 3D model (this also patches)
      this.restoreOriginalMaterial(material, item, widget);
      
      console.log(`✅ Restored original texture for ${materialName}`);
      
      // Refocus on item to properly reload inspector
      widget.app.widgetsHub.focusOnItem({ id: itemId, wid: widget.id });
    } else if (mode === 'action') {
      // Action mode: notify via callback
      onSaveCallback({
        itemId,
        materialName,
        texturePath: null // null = restore original
      });
    }
  }

  /**
   * Get properties for this capability
   * Returns a single property that renders the full authoring UI
   * This is the standard way widgets consume capability UIs
   */
  getProperties(item, widget) {
    const materials = this.getMaterialsFromNode(item);
    
    if (materials.length === 0) return {};
    
    const capabilityData = this.getItemData(item, widget) || {};
    
    // Return single property with full authoring UI
    return {
      materialOverride: {
        inspectorBlock: (it) => {
          return this.createAuthoringUI({
            itemId: item.nid,
            currentData: capabilityData,
            onSave: (data) => {
              // Save handled by authoring UI internally
            },
            widget: widget,
            mode: 'direct'
          });
        }
      }
    };
  }

  /**
   * Get inspector blocks for all materials
   * Now delegated to createAuthoringUI
   * NOTE: Not used in standard widget flow - getProperties is the standard pattern
   */
  getInspectorBlocks(item, widget) {
    const materials = this.getMaterialsFromNode(item);
    
    if (materials.length === 0) return [];
    
    // Return single block using authoring UI
    return [
      this.createAuthoringUI({
        itemId: item.nid,
        currentData: this.getItemData(item, widget),
        onSave: () => {}, // Handled internally
        widget: widget,
        mode: 'direct'
      })
    ];
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
   * Add override action to widget
   * This makes the capability available as an action that can be assigned to semantic nodes
   */
  addActions(widget) {
    return [
      {
        id: "override",
        name: "Override Material",
        widgetId: widget.id,
        getProperties: (context) => {
          const { node, actionId, args } = context;
          return {
            override: {
              inspectorBlock: () => this.createActionInspectorBlock(node, actionId, args, widget),
            },
          };
        },
        execute: (context) => {
          // Runtime execution handled by prototyper flare
        },
        onDelete: (context) => {
          console.log(`🧹 Cleaning up override action`);
        },
        onReferencedItemDeleted: (deletedItemId, actionInstance) => {
          // Check if this action references the deleted item
          if (actionInstance.args?.itemId === deletedItemId) {
            return { 
              shouldRemove: true, 
              reason: `Item "${deletedItemId}" was deleted` 
            };
          }
          return { shouldRemove: false };
        },
      },
    ];
  }

  /**
   * Create action inspector block
   * Shows item selection and material configuration UI
   * This is a light wrapper around createAuthoringUI
   */
  createActionInspectorBlock(node, actionId, args, widget) {
    const itemId = args?.itemId;

    const container = widget.app.uikit.createContainer({
      classList: ["inspector_Block"],
      content: [],
    });

    // Item selector button
    const itemBtn = widget.app.uikit.createButton({
      text: itemId || "Select Item",
      icon: "collection-item",
      classList: ["btn-light", "mb-2"],
      onClick: () => this.openItemSelectionModal(node, actionId, widget),
    });
    container.appendChild(itemBtn);

    // If item is selected, show material configuration using authoring UI
    if (itemId) {
      const currentConfig = args?.materials || {};

      const configUI = this.createAuthoringUI({
        itemId: itemId,
        currentData: { materials: currentConfig },
        onSave: (data) => {
          this.saveActionConfig(node, actionId, itemId, data, widget);
        },
        widget: widget,
        mode: "action",
      });

      if (configUI) {
        container.appendChild(configUI);
      }
    }

    return container;
  }

  /**
   * Open item selection modal for override action
   */
  openItemSelectionModal(node, actionId, widget) {
    const scene = widget.getCurrentScene();
    const items = widget.options.items();

    if (!items || Object.keys(items).length === 0) {
      window.alert("No items available in the scene");
      return;
    }

    // Create modal body
    const bodyContent = document.createElement("div");

    // Add instruction text
    const instruction = document.createElement("p");
    instruction.classList.add("text-muted", "mb-3");
    instruction.textContent = "Select the item for material override:";
    bodyContent.appendChild(instruction);

    // Create list group
    const listGroup = document.createElement("div");
    listGroup.classList.add("list-group");
    bodyContent.appendChild(listGroup);

    // Add items to list
    for (const [itemId, itemData] of Object.entries(items)) {
      const itemElement = document.createElement("button");
      itemElement.type = "button";
      itemElement.classList.add("list-group-item", "list-group-item-action");
      itemElement.textContent = itemId;

      itemElement.addEventListener("click", () => {
        this.saveItemSelection(node, actionId, itemId, widget);
      });

      listGroup.appendChild(itemElement);
    }

    // Show modal
    ATON.UI.showModal({
      header: "Select Item for Override",
      body: bodyContent,
      size: "md",
    });
  }

  /**
   * Save item selection and show configuration UI
   */
  saveItemSelection(node, actionId, itemId, widget) {
    const scene = widget.getCurrentScene();
    const nid = node.nid;

    // Find the action
    const actions = scene.semanticgraph.nodes[nid]?.events?.onSelect;
    if (!actions || !actions[actionId]) {
      console.error(`Action ${actionId} not found`);
      return;
    }

    // Save itemId
    if (!actions[actionId].args) actions[actionId].args = {};
    actions[actionId].args.itemId = itemId;

    // Patch to save itemId
    const patch = {
      semanticgraph: {
        nodes: {
          [nid]: {
            events: scene.semanticgraph.nodes[nid].events,
          },
        },
        edges: ATON.SceneHub.getJSONgraphEdges(ATON.NTYPES.SEM),
      },
    };

    widget.editor.patch = patch;
    widget.editor.modePatch = ATON.SceneHub.MODE_ADD;
    widget.editor.OnPatchChanged();

    console.log(`✅ Item ${itemId} selected for override action ${actionId}`);

    // Close modal
    ATON.UI.hideModal();

    // Update inspector to show configuration UI
    widget.app.widgetsHub.focusOnItem({ id: nid, wid: "annotations" });
  }

  /**
   * Save override action material configuration
   */
  saveActionConfig(node, actionId, itemId, data, widget) {
    const scene = widget.getCurrentScene();
    const nid = node.nid;

    // Find the action
    const actions = scene.semanticgraph.nodes[nid]?.events?.onSelect;
    if (!actions || !actions[actionId]) {
      console.error(`Action ${actionId} not found`);
      return;
    }

    // Initialize materials object if needed
    if (!actions[actionId].args.materials) {
      actions[actionId].args.materials = {};
    }

    // Update material configuration
    const { materialName, texturePath } = data;

    if (texturePath === null) {
      // Restore original: remove from config
      delete actions[actionId].args.materials[materialName];
      
      // Send DELETE patch for this specific material
      const deletePatch = {
        semanticgraph: {
          nodes: {
            [nid]: {
              events: {
                onSelect: {
                  [actionId]: {
                    args: {
                      materials: {
                        [materialName]: {}
                      }
                    }
                  }
                }
              }
            }
          }
        }
      };
      
      widget.editor.patch = deletePatch;
      widget.editor.modePatch = ATON.SceneHub.MODE_DEL;
      widget.editor.OnPatchChanged();
      
      console.log(`✅ Removed override for material ${materialName} in action ${actionId}`);
    } else {
      // Set override
      actions[actionId].args.materials[materialName] = {
        texturePath,
      };
      
      // Send ADD patch with entire events structure
      const addPatch = {
        semanticgraph: {
          nodes: {
            [nid]: {
              events: scene.semanticgraph.nodes[nid].events,
            },
          },
          edges: ATON.SceneHub.getJSONgraphEdges(ATON.NTYPES.SEM),
        },
      };
      
      widget.editor.patch = addPatch;
      widget.editor.modePatch = ATON.SceneHub.MODE_ADD;
      widget.editor.OnPatchChanged();
      
      console.log(`✅ Updated override action ${actionId} material ${materialName}`);
    }

    // Refocus on semantic node to properly reload inspector
    widget.app.widgetsHub.focusOnItem({ id: nid, wid: "annotations" });
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
