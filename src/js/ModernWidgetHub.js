
/**
 * Modern implementation of the Widget Hub using a registry pattern
 */
export class ModernWidgetHub {
    constructor(app) {
        this.app = app;
        this.widgets = new Map();
        this.parsers = this.initParsers();
    }

    /**
     * Initialize the widget hub
     */
    async init() {
        // Initialize all registered widgets
        for (const widget of this.widgets.values()) {
            await widget.init();
        }
    }

    /**
     * Clear all registered widgets
     */
    clearWidgets() {
        this.widgets.clear();
    }

    /**
     * Register a widget with the hub
     */
    registerWidget(widget) {
        if (!widget.id) {
            throw new Error("Widget must have an ID");
        }
        
        if (this.widgets.has(widget.id)) {
            throw new Error(`Widget with ID ${widget.id} is already registered`);
        }

        this.widgets.set(widget.id, widget);
        console.log(`Registered widget: ${widget.id}`);
        return widget;
    }

    /**
     * Get a widget by ID
     */
    getWidget(id) {
        return this.widgets.get(id);
    }

    /**
     * Get all registered widgets
     */
    getAllWidgets() {
        return Array.from(this.widgets.values());
    }

    /**
     * Focus on a specific item in a widget
     */
    focusOnItem({ id, wid }) {
        const widget = this.getWidget(wid);
        if (!widget) {
            throw new Error(`Widget ${wid} not found`);
        }

        // Get the item
        const item = widget.getItem(id);
        if (!item) {
            console.error("Item not found");
            return;
        }

        // Handle 3D item activation if necessary
        if (widget.activeItem) {
            widget.activeItem(id);
        }

        // Set as currently active
        this.app.editor.activeNode = item;
        this.app.editor.activeWidget = widget;

        // Set focus (zoom)
        if (widget.focusItem) {
            widget.focusItem(item);
        }

        // Setup Gizmo Handler
        if (widget.setupGizmo) {
            widget.setupGizmo(id);
        }

        // Setup Inspector
        this.setupInspector(widget, item, id);
    }

    /**
     * Setup the inspector for an item
     */
    setupInspector(widget, item, id) {
        const inspectorOptions = {
            title: widget.getInspectorHeader?.(id)
        };

        const blocks = [];

        // Get both base and item-specific properties
        const baseProps = widget.getProperties(); // Get base widget properties
        const itemProps = item ? widget.getProperties(item) : {}; // Get item-specific properties
        const allProps = { ...baseProps, ...itemProps }; // Merge with item properties taking precedence

        console.log("Widget Inspector Setup - Widget:", widget.id);
        console.log("Base properties:", baseProps);
        console.log("Item-specific properties:", itemProps);
        console.log("Item being inspected:", item);

        if (allProps) {
            for (const [propId, prop] of Object.entries(allProps)) {
                console.log(`Processing property ${propId}:`, prop);
                if (prop.inspectorBlock) {
                    const block = prop.inspectorBlock(item);
                    console.log(`Inspector block for ${propId}:`, block);
                    if (block) blocks.push(block);
                }
            }
        }

        // Add separator before components
        blocks.push(this.app.uikit.inspectorSeparator());

        // Add component blocks
        const components = widget.getComponents();
        if (components) {
            for (const [cId, component] of Object.entries(components)) {
                if (component.inspectorBlock) {
                    blocks.push(component.inspectorBlock(item));
                }
            }
        }

        inspectorOptions.blocks = blocks;
        this.app.ui.editor_createInspector(inspectorOptions);
    }

    /**
     * Initialize parsers used by widgets
     */
    initParsers() {
        return {
            vector3: (o) => {
                const base_onVector3Change = (evt) => {
                    const property = evt.target.dataset.property;
                    const dimension = evt.target.name;
                    const value = parseFloat(evt.target.value.replaceAll(",", "."));

                    if (o.target) {
                        o.target[property][dimension] = value;
                    }
                };

                const handler = (evt) => {
                    if (!Object.hasOwn(o, "overrideBase")) {
                        base_onVector3Change(evt);
                    }
                    if (o.onChange) {
                        o.onChange(evt);
                    }
                };

                return this.app.UI.vector3({
                    id: o.id,
                    property: o.property,
                    title: o.title,
                    v: o.v,
                    onChange: handler
                });
            },

            float: (o) => {
                const evt = o.onChange ? { "change": o.onChange } : null;

                return this.app.UI.input({
                    id: o.id,
                    attr: { "data-property": o.property },
                    name: o.name,
                    type: "number",
                    value: o.v,
                    labelText: o.title,
                    events: evt
                });
            },

            checkbox: (o) => {
                const evt = o.onChange ? { "change": o.onChange } : null;

                return this.app.UI.input({
                    type: "checkbox",
                    id: o.id,
                    labelText: o.title,
                    name: o.name,
                    checked: o.checked,
                    events: evt
                });
            }
        };
    }

    /**
     * Create a base button for widgets
     */
    createBaseButton(options) {


        const button = this.app.uikit.createButton(options);
        if (options.variant === "primary") {
            button.classList.add("btn-primary");
        }
        return button;
    }

    // Compatibility shims for old hub API names used by existing widgets
    mainBtn_base(options) {
        return this.createBaseButton(options);
    }

    itemBtn_base(options) {
        return this.createItemButton(options);
    }

    createBtn_base(options) {
        return this.createBaseButton(options);
    }

    /**
     * Create an item button
     */
    createItemButton(options) {

         return this.createBaseButton(options);
    }

    /**
     * Find the closest button element from a given element
     * This ensures we always get the button no matter which child element was clicked
     */
    findButtonElement(element) {
        // If we get null/undefined, return null
        if (!element) return null;
        
        // If this is already the button we want, return it
        if (element.tagName === 'BUTTON' && element.dataset && (element.dataset.id || element.dataset.wid)) {
            return element;
        }
        
        // Otherwise, look for the closest parent button
        return element.closest('button[data-id][data-wid]');
    }

    /**
     * Handle item button click
     */
    onItemButtonClicked(target) {
        // Always find the actual button element
        const button = this.findButtonElement(target);
        
        if (!button) {
            console.warn('Could not find button element from click target:', target);
            return;
        }

        const id = button.dataset.id;
        const wid = button.dataset.wid;

        if (!id || !wid) {
            console.warn('Button found but missing required data attributes:', button);
            return;
        }

        this.focusOnItem({ id, wid });
        this.app.ui.setStyleOfActiveBtn(button);
    }

    // Backwards-compatibility alias used by old widgets
    onClicked_itemBtn_base(button) {
        return this.onItemButtonClicked(button);
    }

    // Backwards-compatibility alias for focus
    focusOnItem_base(o) {
        return this.focusOnItem(o);
    }

    /**
     * Get current scene
     */
    getCurrentScene() {
        return this.app.db.data.currScene;
    }
}