import { Behaviour } from "./Behaviour.js";

/**
 * Material Override Behaviour
 * 
 * Overrides material textures of an item
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
    // Runtime logic (apply / restore textures, original materials storage, cache)
    // lives in the prototyper flare: see getRuntime() → F.overrideRuntime
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
    // Clean up original materials storage (in the flare runtime)
    this.getRuntime()?.forget(itemId);

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

    // Get materials from the item - filtered by subclass if needed
    const materials = this.getFilteredMaterials(this.getMaterialsFromNode(item));
    
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
      
      // One row per material; "Restore" only if the material has an override
      const textureBlock = widgetInstance.app.uikit.TextureSelectorBlock(
        currentTexture || this.getMaterialTexture(material),
        () => this.openTextureSelectorForMaterial(targetItemId, matName, mode, actionId, onSave),
        matName,
        currentTexture
          ? () => this.restoreOriginalTexture(targetItemId, matName, mode, actionId, onSave)
          : null
      );

      container.appendChild(textureBlock);
    });
    
    return container;
  }

  /**
   * Get all materials from a node
   */
  getMaterialsFromNode(item) {
    const node = item;
    return node ? this.extractMaterials(node) : [];
  }

  /**
   * Filter materials shown in authoring UI.
   * Override in subclasses to restrict to specific materials.
   * @param {Array} materials - All extracted materials
   * @returns {Array}
   */
  getFilteredMaterials(materials) {
    return materials;
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
    
    return materials;
  }

  /**
   * Get current texture for material
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
    // Open media gallery using uikit
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
      },
      onAddFileBtnClicked: () => {
        this._widget.app.db.openFileDialog({
          callback: (result) => {
            if (!result?.success) {
              this._widget.app.uikit.setLoadingCursor(false);
              return;
            }

            // Poll until the uploaded file appears in media, then reopen gallery
            const uploadedName = result.fileName;
            const maxAttempts = 10;
            const intervalMs = 800;
            let attempts = 0;

            const poll = () => {
              attempts++;
              this._widget.app.db.getOnlyUserMedia((mediaList) => {
                const found = mediaList.some(m => m.endsWith(uploadedName));
                if (found || attempts >= maxAttempts) {
                  this._widget.app.uikit.setLoadingCursor(false);
                  this.openTextureSelectorForMaterial(itemId, materialName, mode, actionId, onSave);
                } else {
                  setTimeout(poll, intervalMs);
                }
              });
            };

            poll();
          },
        });
      },
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
      // Direct mode: Apply immediately to 3D model (preview via flare runtime,
      // which also invalidates the ATON asset cache) + patch
      this.getRuntime()?.applyTexture(itemId, materialName, texturePath, {
        scene: this._widget.getCurrentScene(),
      });

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
   * Restore original texture for a material
   */
  restoreOriginalTexture(itemId, materialName, mode, actionId, onSave) {
    console.log(
      `🔄 Restoring original texture for ${itemId}/${materialName} (mode: ${mode})`
    );

    if (mode === "direct") {
      // Direct mode: Restore 3D model material (flare runtime) + delete from scene data
      const restored = this.getRuntime()?.restore(itemId, materialName);
      if (!restored) return;

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

    const uikit = widgetInstance.app.uikit;
    const container = uikit.createContainer({ classList: ["inspector_Block"] });

    // Item selector (picker button showing the current model)
    const itemBtn = uikit.createButton({
      text: itemId || "Select model…",
      icon: "collection-item",
      compact: true,
      block: true,
      onClick: () => this.openItemSelectionModal(node, actionId, widgetInstance),
    });
    itemBtn.classList.add("insp-picker");
    container.appendChild(uikit.field({ label: "Model", control: itemBtn }));

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
        container.appendChild(uikit.field({ label: "Materials", control: configUI }));
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

    if (!actions[actionId].args) actions[actionId].args = {};
    const args = actions[actionId].args;

    // Materials belong to the previously selected item: drop them if the item changes
    const prevItemId = args.itemId;
    const itemChanged = prevItemId !== undefined && prevItemId !== itemId;
    const hadMaterials = args.materials && Object.keys(args.materials).length > 0;
    if (itemChanged) delete args.materials;

    // Save itemId
    args.itemId = itemId;

    // Patch to save itemId (ADD merges on the server, so it can't remove old materials)
    const sendAddPatch = () => {
      widget.editor.patch = {
        semanticgraph: {
          nodes: {
            [nid]: {
              events: scene.semanticgraph.nodes[nid].events,
            },
          },
          edges: ATON.SceneHub.getJSONgraphEdges(ATON.NTYPES.SEM),
        },
      };
      widget.editor.modePatch = ATON.SceneHub.MODE_ADD;
      widget.editor.OnPatchChanged();
    };

    if (itemChanged && hadMaterials) {
      // First DEL args.materials on the server, then ADD the new itemId
      widget.editor.patch = {
        semanticgraph: {
          nodes: {
            [nid]: {
              events: { onSelect: { [actionId]: { args: { materials: {} } } } },
            },
          },
        },
      };
      widget.editor.modePatch = ATON.SceneHub.MODE_DEL;
      widget.editor.sendGlobalScenePatch(sendAddPatch);
      console.log(`🧹 Cleared materials of previous item ${prevItemId} for override action ${actionId}`);
    } else {
      sendAddPatch();
    }

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
