/**
 * Create a dropdown button with menu items
 * @param {Object} options - Configuration object
 * @param {string} options.text - Button text
 * @param {Array} options.items - Array of menu items {text, onClick}
 * @param {string} options.variant - Button variant (default 'dark')
 * @returns {Element} The dropdown container
 */
uikit.createDropdownButton = (options) => {
    const id = 'dropdown_' + Math.random().toString(36).substr(2, 9);
    const variant = options.variant || 'dark';
    
    const dropdownHTML = `
        <div class="dropdown">
            <button class="btn btn-${variant} dropdown-toggle p-2" type="button" id="${id}" data-bs-toggle="dropdown" aria-expanded="false">
                ${options.text || 'Select'}
            </button>
            <ul class="dropdown-menu" aria-labelledby="${id}">
            </ul>
        </div>
    `;
    
    const el = uikit.createElfromString(dropdownHTML);
    const menu = el.querySelector('.dropdown-menu');
    
    // Add menu items
    if (options.items && Array.isArray(options.items)) {
        options.items.forEach(item => {
            const itemHTML = `<li><a class="dropdown-item" href="#">${item.text}</a></li>`;
            const itemEl = uikit.createElfromString(itemHTML);
            
            if (item.onClick) {
                itemEl.querySelector('a').addEventListener('click', (e) => {
                    e.preventDefault();
                    item.onClick();
                });
            }
            
            menu.append(itemEl);
        });
    }
    
    return el;
};
