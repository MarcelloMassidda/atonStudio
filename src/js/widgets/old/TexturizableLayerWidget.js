import { LayerWidget } from './LayerWidget.js';

/**
 * A specialized layer widget that adds texturizable functionality
 */
export class TexturizableLayerWidget extends LayerWidget {
    constructor(app) {
        super(app);
        this.id = "texturizableLayers";  // override id
        // update options id and main button text so it appears in widgets list
        if (this.options) {
            this.options.id = this.id;
            this.options.mainBtnOptions = { id: "texturizable_mainBtn", text: "Texturized Models", icon: "collection-item" };
        }
        this.setupTexturizable();
    }

    /**
     * Return only texturized items (filter scenegraph.nodes)
     */
    getItems() {
        const scene = this.getCurrentScene();
        if (!scene || !scene.scenegraph || !scene.scenegraph.nodes) return null;
        const nodes = scene.scenegraph.nodes;
        const texturized = scene.texturized || {};
        const result = {};
        for (const [k, v] of Object.entries(nodes)) {
            if (texturized[k]) result[k] = v;
        }
        return result;
    }



    /**
     * Setup texturizable features
     */
    setupTexturizable() {
        // Initialize props object if it doesn't exist
        if (!this.options.props) {
            this.options.props = {};
        }
        
        // Add texturizable property to props
        this.options.props.screen = {
            inspectorBlock: (node) => {
                console.log('Creating texture inspector for node:', node);
                return this.createTextureInspector(node);
            },
            get: () => {
                const texture = this.getTextureForNode(this.editor.activeNode?.nid);
                console.log('Getting texture for node:', this.editor.activeNode?.nid, 'Texture:', texture);
                return texture;
            }
        };

        console.log("Texturizable widget props setup:", this.options.props);
    }

    /**
     * Create texture inspector block
     */
    createTextureInspector(node) {
        const texturized = this.getCurrentScene().texturized;
        if (!texturized || !texturized[node.nid]) {
            return null;
        }

        return this.app.uikit.TextureSelectorBlock(
            texturized[node.nid].imageScreenPath,
            () => this.showMediaPicker()
        );
    }

    /**
     * Show media picker for textures
     */
    showMediaPicker() {
        this.app.uikit.createMediaGallery({
            onMediaItemClicked: (item) => this.onTextureSelected(item),
            onAddFileBtnClicked: (evt) => {
                this.app.db.openFileDialog({
                    callback: () => {
                        console.log("updating media picker gallery");
                        this.showMediaPicker();
                        this.app.uikit.setLoadingCursor(false);
                    }
                });
            }
        });
    }

    /**
     * Handle texture selection
     */
    onTextureSelected(item) {
        ATON.UI.hideModal();
        
        const node = this.editor.activeNode;
        if (!node) throw new Error("no node to texturize");
        
        const nid = node.nid;
        const texturized = this.getCurrentScene().texturized || {};
        texturized[nid] = { imageScreenPath: item.url };
        this.getCurrentScene().texturized = texturized;
        
        // Live Update
        ATON.Flares.Prototyper_flare.parse(texturized);
        this.app.widgetsHub.focusOnItem_base({ id: nid, wid: this.id });
        
        // Send Patch
        this.composePatch({
            texturized: {
                [nid]: { imageScreenPath: item.url }
            }
        });
    }

    /**
     * Override deleteLayer to also clean up texturizable data
     */
    deleteLayer(nid) {
        if (!this.editor.checkPendingPatch()) return;

        // Call parent class delete implementation
        super.deleteLayer(nid);

        // Clean up texturizable data
        const texturized = this.getCurrentScene().texturized;
        if (texturized && texturized[nid]) {
            delete texturized[nid];
        }
    }

    /**
     * Get texture for node
     */
    getTextureForNode(nid) {
        return this.getCurrentScene().texturized?.[nid]?.imageScreenPath;
    }

    /**
     * Override the item button to show texturizable indicator
     */
    getItemButton(id, item) {
        // Skip parent's icon addition by using raw options
        const options = {
            text: id,
            attr: { "data-id": id, "data-wid": this.id },
            onClick: function() { 
                this.app.widgetsHub.onClicked_itemBtn_base(this);
            }
        };
        
        const button = this.app.widgetsHub.itemBtn_base(options);
        
        // Add our texturizable indicator
        const texturized = this.getCurrentScene().texturized;
        if (texturized && texturized[id]) {
            const text = button.textContent;
            button.textContent = `🛠️ ${text}`;
        }
        
        return button;
    }
}