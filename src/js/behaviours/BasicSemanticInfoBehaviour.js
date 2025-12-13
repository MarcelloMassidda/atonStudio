import { Behaviour } from "./Behaviour.js";

/**
 * BasicSemanticInfo Behaviour
 * 
 * Provides description editing functionality for semantic nodes
 * Action mode only - not equippable as direct mode
 */
export class BasicSemanticInfoBehaviour extends Behaviour {
  constructor() {
    super({
      id: "editDescription",
      name: "Edit Description",
      modes: ['action'], // Action mode only
      isVisible: false, // Not shown in "Add Behaviour" list
      autoEquip: false,
      actionLabel: "Edit Description",
      eventTypes: ['onSelect'],
    });
  }

  /**
   * Not equippable as direct mode
   */
  canEquip(itemId) {
    return false;
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

    // Update UI
    widget.app.ui.editor_updateHierarchy();
    widget.app.widgetsHub.focusOnItem({
      id: nid,
      wid: widget.id,
    });
  }

  /**
   * Override getActionDefinition to provide custom action
   */
  getActionDefinition(widget) {
    if (!this.supportsMode('action')) {
      return null;
    }

    return {
      id: this.id,
      name: this.actionLabel,
      widgetId: widget.id,
      getProperties: (context) => {
        const { node } = context;
        return {
          description: {
            inspectorBlock: () => {
              const editBtn = widget.app.uikit.createButton({
                text: "Edit Description",
                icon: "edit",
                onClick: () => this.openDescriptionEditor(node, widget),
              });

              return widget.app.uikit.createContainer({
                classList: ["inspector_Block"],
                content: [editBtn],
              });
            },
          },
        };
      },
      execute: (context) => {
        // Runtime execution handled by hathor.js
      },
      onDelete: (context) => {
        // Clean up description data when action is removed
        const { node, widget } = context;
        const scene = widget.getCurrentScene();
        const nid = node.nid;

        console.log(`🧹 Cleaning up description for semantic node ${nid}`);

        // Remove from ATON semantic node
        const S = ATON.getSemanticNode(nid);
        if (S) S.setDescription("");

        // Remove from local scene data
        if (scene.semanticgraph?.nodes?.[nid]?.description) {
          delete scene.semanticgraph.nodes[nid].description;
        }

        // Send delete patch for description property
        const deletePatch = {
          semanticgraph: {
            nodes: {
              [nid]: {
                description: {},
              },
            },
          },
        };

        widget.editor.patch = deletePatch;
        widget.editor.modePatch = ATON.SceneHub.MODE_DEL;
        widget.editor.OnPatchChanged();

        console.log(`✅ Description removed from semantic node ${nid}`);
      },
      onReferencedItemDeleted: (deletedItemId, actionInstance) => {
        // Description action doesn't reference other items
        return { shouldRemove: false };
      },
    };
  }

  /**
   * Not used - action mode only
   */
  createAuthoringUI(context) {
    return null;
  }
}
