import { Behaviour } from "./Behaviour.js";

/**
 * Material Override Behaviour
 * 
 * Unified behaviour that replaces OverrideCapability
 * Supports both direct mode (immediate application) and action mode (deferred execution)
 */
export class OverrideBehaviour extends Behaviour {
  constructor(config = {}) {
    super({
      id: config.id || "override",
      name: config.name || "Material Override",
      modes: ['direct', 'action'], // Supports both modes
      isVisible: config.isVisible ?? true,
      autoEquip: config.autoEquip ?? false,
      actionLabel: config.actionLabel || "Override Material",
      eventTypes: ['onSelect'],
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
   * Check if behaviour can be equipped on an item
   */
  canEquip(itemId) {
    const item = this._widget.getItem(itemId);
    if (!item) return false;

    // Check if item has any materials
    let hasMaterials = false;
    item.traverse((child) => {
      if (child.isMesh && child.material) {
        hasMaterials = true;
      }
    });

    return hasMaterials;
  }

  // ============================================================
  // Lifecycle Hooks
  // ============================================================

  /**
   * Called when an item is deleted from the widget
   * Clean up behaviour data for this item
   * NOTE: Don't send patch here - ModernWidgetHub.cleanupBehavioursForDeletedItem handles patching
   */
  onItemDeleted(itemId) {
    // Clean up original materials storage
    const storage = this.getOriginalMaterialsStorage();
    if (storage.has(itemId)) {
      storage.delete(itemId);
      console.log(`\ud83e\uddf9 Cleaned up original materials storage for item ${itemId}`);
    }

    // Local scene data cleanup (patch sent by widget hub)
    if (this.supportsMode('direct')) {
      const scene = this._widget?.getCurrentScene();
      if (scene?.behaviours?.[this.id]?.[itemId]) {
        delete scene.behaviours[this.id][itemId];
        console.log(`\ud83e\uddf9 Cleaned up behaviour data for item ${itemId}`);
      }
    }
  }

  /**
   * Called when an item referenced by this behaviour is deleted
   */
  onReferencedItemDeleted(referencedItemId) {
    // Not applicable for override behaviour
  }

  // ============================================================
  // Authoring UI - Single Source of Truth
  // ============================================================

  /**
   * Create the authoring UI for this behaviour
   * This is used by both direct mode and action mode
   * 
   * @param {Object} context - Authoring context
   * @param {string} context.mode - Execution mode ('direct' or 'action')
   * @param {string} context.itemId - Item ID (for direct mode)
   * @param {string} context.actionId - Action ID (for action mode)
   * @param {Object} context.actionData - Current action data (for action mode)
   * @param {Function} context.onSave - Save callback (for action mode)
   * @returns {HTMLElement} - UI container element
   */
  createAuthoringUI(context) {
    const { mode, itemId, actionId, actionData, onSave, widget, currentData: providedCurrentData } = context;
    
    // Use widget from context or fall back to this._widget
    const widgetInstance = widget || this._widget;

    // Get the target item
    let targetItemId = itemId;
    if (mode === 'action' && actionData?.args?.itemId) {
      targetItemId = actionData.args.itemId;
    }

    if (!targetItemId) {
      return widgetInstance.app.uikit.createText({
        text: "⚠️ No item selected",
        classList: ['text-muted', 'fst-italic']
      });
    }

    const item = widgetInstance.getItem(targetItemId);
    if (!item) {
      return widgetInstance.app.uikit.createText({
        text: "⚠️ Item not found",
        classList: ['text-muted', 'fst-italic']
      });
    }

    // Get materials from the item (same as capability)
    const materials = this.getMaterialsFromNode(item);
    
    if (materials.length === 0) {
      return widgetInstance.app.uikit.createText({
        text: "No materials found on this item",
        classList: ['text-muted', 'fst-italic']
      });
    }

    // Get current override data - use provided currentData if available (for action mode)
    let currentData = {};
    if (providedCurrentData) {
      currentData = providedCurrentData;
    } else if (mode === 'direct') {
      const data = this.getDirectModeData(targetItemId);
      currentData = { materials: data?.materials || {} };
    } else if (mode === 'action') {
      currentData = { materials: actionData?.args?.materials || {} };
    }

    const container = widgetInstance.app.uikit.createContainer({
      classList: ['material-override-authoring']
    });
    
    // Create a texture selector for each material
    materials.forEach(material => {
      const matName = material.name;
      const rawTexture = currentData?.materials?.[matName]?.texturePath;
      const currentTexture = typeof rawTexture === 'string' && rawTexture ? rawTexture : null;
      
      // Create texture selector block
      const textureBlock = widgetInstance.app.uikit.TextureSelectorBlock(
        currentTexture || this.getMaterialTexture(material),
        () => this.openTextureSelectorForMaterial(targetItemId, matName, mode, actionId, onSave),
        matName
      );
      
      container.appendChild(textureBlock);
      
      // If material has override, add undo button
      if (currentTexture) {
        const undoBtn = widgetInstance.app.uikit.createButton({
          text: "Restore Original",
          icon: "undo",
          classList: ['btn-sm', 'btn-warning', 'mt-1', 'mb-3'],
          onClick: () => this.restoreOriginalTexture(targetItemId, matName, mode, actionId, onSave)
        });
        container.appendChild(undoBtn);
      }
    });
    
    return container;
  }

  /**
   * Get all materials from a node (same as capability)
   */
  getMaterialsFromNode(item) {
    const node = item;
    return node ? this.extractMaterials(node) : [];
  }

  /**
   * Extract all materials from a node recursively (same as capability)
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
    
    return materials;
  }

  /**
   * Get current texture for material (same as capability)
   */
  getMaterialTexture(material) {
    let t = material.map?.source?.data?.currentSrc;
    return t;
  }

  // ============================================================
  // Texture Selection
  // ============================================================

  /**
   * Open texture selector for a specific material
   */
  openTextureSelectorForMaterial(itemId, materialName, mode, actionId, onSave) {
    // Open media gallery using uikit (same as capability)
    this._widget.app.uikit.createMediaGallery({
      title: `Select Texture for ${materialName}`,
      onMediaItemClicked: ({ url }) => {
        // Close modal first
        ATON.UI.hideModal();
        
        this.saveTexture(
          itemId,
          materialName,
          url,
          mode,
          actionId,
          onSave
        );
      }
    });
  }

  /**
   * Save texture override
   */
  saveTexture(itemId, materialName, texturePath, mode, actionId, onSave) {
    console.log(
      `💾 Saving texture for ${itemId}/${materialName}: ${texturePath} (mode: ${mode})`
    );

    if (mode === "direct") {
      // Direct mode: Apply immediately to 3D model + patch
      this.applyTextureToMaterial(itemId, materialName, texturePath);

      // Get or create override data
      let data = this.getDirectModeData(itemId);
      if (!data) {
        data = { materials: {} };
      }
      if (!data.materials) {
        data.materials = {};
      }

      // Update material override
      data.materials[materialName] = { texturePath };

      // Save to scene + patch
      this.saveDirectModeData(itemId, data);

      // CACHE INVALIDATION: Clear ATON._assetsManager cache for this item's URLs
      const item = this._widget.getItem(itemId);
      if (item) {
        this.invalidateItemCache(item);
      }

      // Update UI - refresh hierarchy to update item buttons with badges
      this._widget.app.ui.editor_updateHierarchy();
      this._widget.app.ui.editor_updateWidgetMainPanel();

      // Refresh UI
      this.focusOnItem(itemId);
    } else if (mode === "action") {
      // Action mode: Call onSave callback with material data
      if (onSave) {
        onSave({
          materialName: materialName,
          texturePath: texturePath
        });
      }

      // Refresh UI
      ATON.UI.showModal();
    }
  }

  /**
   * Apply texture to material in 3D scene (matches capability exactly)
   */
  applyTextureToMaterial(itemId, materialName, texturePath) {
    if (typeof texturePath !== 'string' || !texturePath) {
      console.warn(`⚠️ applyTextureToMaterial: invalid texturePath for ${itemId}/${materialName}`, texturePath);
      return;
    }

    const item = this._widget.getItem(itemId);
    if (!item) {
      console.warn(`⚠️ Item not found: ${itemId}`);
      return;
    }

    const itemMaterial = this.getItemMaterial(item, materialName);
    if (!itemMaterial) {
      console.error(`Material '${materialName}' not found for item ${itemId}`);
      return;
    }

    // Get shared storage
    const storage = this.getOriginalMaterialsStorage();
    if (!storage.has(item.nid)) {
      storage.set(item.nid, new Map());
    }
    const itemOriginals = storage.get(item.nid);

    const resolvedUrl = ATON.Utils.resolveCollectionURL(texturePath);
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
            if (mat.name === materialName) {
              // Save original before cloning if not already saved
              if (!itemOriginals.has(materialName)) {
                itemOriginals.set(materialName, mat.clone());
                console.log(
                  `💾 [Behaviour] Saved original material '${materialName}' for item ${item.nid}`
                );
              }

              const clonedMat = mat.clone();
              clonedMat.map = texture;
              clonedMat.needsUpdate = true;
              console.log(
                `✅ [Behaviour] Applied texture to cloned material '${materialName}' for item ${item.nid}`
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
  }

  /**
   * Invalidate ATON cache for item's URLs to force fresh loads
   */
  invalidateItemCache(item) {
    const scene = this._widget.getCurrentScene();
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
   * Restore original texture for a material (matches capability exactly)
   */
  restoreOriginalTexture(itemId, materialName, mode, actionId, onSave) {
    console.log(
      `🔄 Restoring original texture for ${itemId}/${materialName} (mode: ${mode})`
    );

    if (mode === "direct") {
      // Direct mode: Restore 3D model material + delete from scene data
      const item = this._widget.getItem(itemId);
      if (!item) {
        console.error(`Item ${itemId} not found`);
        return;
      }

      const storage = this.getOriginalMaterialsStorage();
      const itemOriginals = storage.get(item.nid);
      if (!itemOriginals || !itemOriginals.has(materialName)) {
        console.warn(
          `No original material found for '${materialName}' in item ${item.nid}`
        );
        return;
      }

      const originalMaterial = itemOriginals.get(materialName);

      // Replace the material on the mesh with the original
      item.traverse((child) => {
        if (child.isMesh && child.material) {
          const materials = Array.isArray(child.material)
            ? child.material
            : [child.material];
          const index = materials.findIndex((mat) => mat.name === materialName);

          if (index !== -1) {
            const restoredMaterial = originalMaterial.clone();
            restoredMaterial.needsUpdate = true;

            if (Array.isArray(child.material)) {
              child.material[index] = restoredMaterial;
            } else {
              child.material = restoredMaterial;
            }
            console.log(
              `↩️ Restored original material '${materialName}' for item ${item.nid}`
            );
          }
        }
      });

      // Update light probes to fix lighting after material restoration
      ATON.getRootScene().assignLightProbesByProximity();
      ATON.updateLightProbes();

      // Remove from scene data
      const data = this.getDirectModeData(itemId);
      if (data?.materials?.[materialName]) {
        delete data.materials[materialName];

        // If no more materials, remove entire entry
        if (Object.keys(data.materials).length === 0) {
          this.sendPatch(
            `behaviours/${this.id}/${itemId}`,
            {},
            ATON.SceneHub.MODE_DEL
          );
        } else {
          // Update with remaining materials
          this.saveDirectModeData(itemId, data);
        }
      }

      // Update UI
      this._widget.app.ui.editor_updateHierarchy();
      this._widget.app.ui.editor_updateWidgetMainPanel();

      // Refresh UI
      this.focusOnItem(itemId);
    } else if (mode === "action") {
      // Action mode: Call onSave callback with null to remove material
      if (onSave) {
        onSave({
          materialName: materialName,
          texturePath: null
        });
      }

      // Refresh UI
      ATON.UI.showModal();
    }
  }

  // ============================================================
  // Action Mode Specific
  // ============================================================

  /**
   * Create action inspector block for action mode
   * Includes item selection + material configuration
   */
  createActionInspectorBlock(node, actionId, args, widget) {
    // Use passed widget or fallback to this._widget
    const widgetInstance = widget || this._widget;
    
    // ALWAYS read fresh args from scene data to ensure UI shows latest state
    const scene = widgetInstance.getCurrentScene();
    const nid = node.nid;
    const freshArgs = scene.semanticgraph.nodes[nid]?.events?.onSelect?.[actionId]?.args || {};
    
    const itemId = freshArgs.itemId;

    const container = widgetInstance.app.uikit.createContainer({
      classList: ["inspector_Block"],
      content: [],
    });

    // Item selector button
    const itemBtn = widgetInstance.app.uikit.createButton({
      text: itemId || "Select Item",
      icon: "collection-item",
      classList: ["btn-light", "mb-2"],
      onClick: () => this.openItemSelectionModal(node, actionId, widgetInstance),
    });
    container.appendChild(itemBtn);

    // If item is selected, show material configuration using authoring UI
    if (itemId) {
      const currentConfig = freshArgs.materials || {};

      const configUI = this.createAuthoringUI({
        itemId: itemId,
        currentData: { materials: currentConfig },
        onSave: (data) => {
          this.saveActionConfig(node, actionId, itemId, data, widgetInstance);
        },
        widget: widgetInstance,
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

    if (texturePath !== null && (typeof texturePath !== 'string' || !texturePath)) {
      console.warn(`⚠️ updateActionModeData: invalid texturePath, skipping`, texturePath);
      return;
    }

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
}
