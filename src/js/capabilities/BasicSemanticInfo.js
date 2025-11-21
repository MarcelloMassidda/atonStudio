import { Capability } from "./Capability.js";

/**
 * BasicSemanticInfo Capability
 * Adds rich text description editing to semantic nodes
 * Similar to HATHOR.popupEditSemNode functionality
 */
export class BasicSemanticInfo extends Capability {
  constructor() {
    super({
      id: "basicSemanticInfo",
      name: "Basic Semantic Info",
      isVisible: true,
      autoEquip: false,
    });
  }

  /**
   * Check if this capability can be equipped to an item
   */
  canEquip(item, widget) {
    // Only semantic nodes can have descriptions
    return widget.id === "annotations";
  }

  /**
   * Get initial data when capability is equipped
   */
  getInitialData(item) {
    return {
      description: "",
    };
  }

  /**
   * Called after capability is equipped
   */
  equip(item, widget) {
    // Update UI to show badge
    widget.app.ui.editor_updateHierarchy();

    // Refocus to update inspector with edit button
    widget.app.widgetsHub.focusOnItem({
      id: item.nid,
      wid: widget.id,
    });
  }

  /**
   * Get properties for this capability
   */
  getProperties(item, widget) {
    return {
      description: {
        inspectorBlock: (node) => this.createDescriptionInspector(node, widget),
        get: () => this.getDescription(item),
      },
    };
  }

  /**
   * Create description inspector block
   */
  createDescriptionInspector(node, widget) {
    const scene = widget.getCurrentScene();
    const semNode = scene.semanticgraph?.nodes?.[node.nid];
    // Has description if property exists (even if empty string)
    const hasDescription = semNode?.description !== undefined;

    const editBtn = widget.app.uikit.createButton({
      text: "Edit Description",
      icon: "edit",
      onClick: () => this.openDescriptionEditor(node, widget),
    });

    // If description exists, add undo button
    if (hasDescription) {
      const undoBtn = widget.app.uikit.createButton({
        text: "Remove Description",
        icon: "undo",
        classList: ["btn-sm", "btn-warning", "mt-2"],
        onClick: () => this.removeDescription(node, widget),
      });

      return widget.app.uikit.createContainer({
        classList: ["inspector_Block"],
        content: [editBtn, undoBtn],
      });
    }

    return widget.app.uikit.createContainer({
      classList: ["inspector_Block"],
      content: [editBtn],
    });
  }

  /**
   * Open rich text editor for description
   */
  openDescriptionEditor(node, widget) {
    const scene = widget.getCurrentScene();
    const semNode = scene.semanticgraph?.nodes?.[node.nid];
    const currentDescription = semNode?.description
      ? JSON.parse(semNode.description)
      : "";

    // Create modal body content
    const bodyContent = document.createElement("div");
    const textarea = document.createElement("textarea");
    textarea.id = "idSemDescription";
    textarea.style.width = "100%";
    bodyContent.appendChild(textarea);

    // Create footer with done button
    const doneBtn = widget.app.uikit.createButton({
      text: "DONE",
      variant: "success",
      id: "idSemDescriptionOK",
    });

    // Show modal
    ATON.UI.showModal({
      header: "Semantic Node Description",
      body: bodyContent,
      footer: doneBtn,
      size: "lg",
    });

    // Initialize WYSIWYG editor using sceditor
    const SCE = $("#idSemDescription")
      .sceditor({
        id: "idSCEditor",
        width: "100%",
        height: "300px",
        resizeEnabled: true,
        autoExpand: true,
        emoticonsEnabled: false,
        autoUpdate: true,
        style:
          "/hathor/vendors/sceditor/minified/themes/content/default.min.css",
        toolbar:
          "bold,italic,underline,link,unlink,font,size,color,removeformat|left,center,right,justify|bulletlist,orderedlist,table,code|image,youtube|source",
      })
      .sceditor("instance");

    // Set current description if exists
    if (currentDescription) {
      SCE.setWysiwygEditorValue(currentDescription);
    }

    // Handle done button
    $("#idSemDescriptionOK").click(() => {
      const xxtmldescr = JSON.stringify($("#idSemDescription").val());

      ATON.UI.hideModal();

      if (xxtmldescr && xxtmldescr.length > 2) {
        // Update ATON semantic node
        const S = ATON.getSemanticNode(node.nid);
        if (S) S.setDescription(xxtmldescr);

        // Update local scene data
        if (!scene.semanticgraph.nodes[node.nid]) {
          scene.semanticgraph.nodes[node.nid] = {};
        }
        scene.semanticgraph.nodes[node.nid].description = xxtmldescr;

        // Compose patch
        this.updateDescription(node.nid, xxtmldescr, widget);
      }
    });
  }

  /**
   * Update description and send patch
   */
  updateDescription(nid, description, widget) {
    let _patch = widget.editor.patch || {};

    if (!_patch.semanticgraph) {
      _patch.semanticgraph = { nodes: {}, edges: {} };
    }

    if (!_patch.semanticgraph.nodes[nid]) {
      _patch.semanticgraph.nodes[nid] = {};
    }

    // Add description to patch
    _patch.semanticgraph.nodes[nid].description = description;

    // Add edges
    _patch.semanticgraph.edges = ATON.SceneHub.getJSONgraphEdges(
      ATON.NTYPES.SEM
    );

    widget.editor.patch = _patch;
    widget.editor.modePatch = ATON.SceneHub.MODE_ADD;
    widget.editor.OnPatchChanged();

    // Update UI to show undo button
    widget.app.ui.editor_updateHierarchy();
    widget.app.widgetsHub.focusOnItem({
      id: nid,
      wid: widget.id,
    });
  }

  /**
   * Remove description from semantic node (removes entire capability)
   */
  removeDescription(node, widget) {
    const scene = widget.getCurrentScene();

    // Remove from ATON semantic node
    const S = ATON.getSemanticNode(node.nid);
    if (S) S.setDescription("");

    // Remove from local scene data
    if (scene.semanticgraph?.nodes?.[node.nid]) {
      delete scene.semanticgraph.nodes[node.nid].description;
    }

    // Remove capability data entirely
    if (scene.capabilities && scene.capabilities[this.id]) {
      delete scene.capabilities[this.id][node.nid];
    }

    // Send delete patch - remove description property
    const deletePatch = {
      semanticgraph: {
        nodes: {
          [node.nid]: {
            description: "",
          },
        },
      },
    };

    widget.editor.patch = deletePatch;
    widget.editor.modePatch = ATON.SceneHub.MODE_DEL;
    widget.editor.OnPatchChanged();

    console.log(
      `🗑️ Removed description and capability from semantic node ${node.nid}`
    );

    // Update UI
    widget.app.ui.editor_updateHierarchy();
    widget.app.ui.editor_updateWidgetMainPanel();

    // Refocus on the item to update inspector (will show Add Capability button)
    widget.app.widgetsHub.focusOnItem({
      id: node.nid,
      wid: widget.id,
    });
  }

  /**
   * Get description from item
   */
  getDescription(item) {
    const S = ATON.getSemanticNode(item.nid);
    if (!S) return "";
    return S.getDescription() || "";
  }

  /**
   * Check if item has this capability
   */
  hasCapabilityForItem(item, widget) {
    const scene = widget.getCurrentScene();
    const semNode = scene.semanticgraph?.nodes?.[item.nid];

    // If description exists with content, it has the capability
    if (semNode?.description && semNode.description.length > 2) return true;

    // Otherwise use default check (looks in scene.capabilities.basicSemanticInfo)
    return null;
  }

  /**
   * Decorate item button with badge when capability is equipped
   */
  decorateItemBtn(btnOptions, item, widget) {
    // Initialize or get existing badges array
    btnOptions.badges = btnOptions.badges || [];

    // Add our badge
    btnOptions.badges.push({
      text: "ℹ️",
      type: "info",
      title: "Has semantic info capability",
    });

    return btnOptions;
  }
}
