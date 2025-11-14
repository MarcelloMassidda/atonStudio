/**
 * Template system for organizing widgets and their configurations
 */
export class Template {
    constructor(options) {
        this.id = options.id;
        this.name = options.name;
        this.widgets = new Map();
    }

    /**
     * Register a widget with this template
     */
    registerWidget(widget) {
        this.widgets.set(widget.id, widget);
        return this;
    }

    /**
     * Apply this template to an editor instance
     */
    async applyToEditor(editor) {
        console.log(`Applying template: ${this.name}`);

        // Clear existing widgets from hub
        editor.widgetsHub.clearWidgets();

        // Register our configured widgets
        this.widgets.forEach(widget => {
            console.log(`Registering widget: ${widget.id}`);
            editor.widgetsHub.registerWidget(widget);
        });

        // Initialize widget hub
        await editor.widgetsHub.init();

        console.log(`Template ${this.name} applied successfully`);
    }
}