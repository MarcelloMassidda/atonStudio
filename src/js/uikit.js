import {UI} from '../../../uitoolkit/js/uitoolkit.js';

let uikit = {};

uikit.default_buttonVariant = "dark";

uikit.createElfromString = (html)=>{ return ATON.UI.createElementFromHTMLString(html); };

uikit.createButton=(options)=>{

    let el = UI.button(options);

    // Handle multiple badges
    if (options.badges && Array.isArray(options.badges)) {
        options.badges.forEach(badge => {
            const badgeEl = uikit.createElfromString(
                `<span class='badge text-bg-${badge.type || 'secondary'} ms-1'>${badge.text}</span>`
            );
            el.append(badgeEl);
        });
    }
    // Keep backward compatibility with single badge
    else if (options.badge) {
        el.append(uikit.createElfromString("<span class='badge text-bg-secondary ms-1'>" + options.badge + "</span>"));
    }
    ///Set variant:
    let _variant = options.variant || uikit.default_buttonVariant;
    el.classList.add("btn-"+_variant, "p-2");

    return el;
};



uikit.deleteButton=(options)=>{ options.variant = "danger"; return uikit.createButton(options)};


uikit.inspectorSeparator=()=>{
return uikit.createElfromString(`<div class="p-2"></div>`)}

uikit.wrapInGroupList=(options)=>{//NOT USED:
    let list = uikit.createElfromString(`<div class="list-group"></div>`);
    let {items} = options;

    items.forEach(item => {list.append(item);});
    return list;
}

uikit.createOffCanvas=(options)=>{

    let pos = options.pos || "start";
    let id = "offcanvas_"+pos;

    if( uikit[id]){ uikit[id]._element.remove()}

    let customClass = "custom-offcanvas-"+pos;
    let title = options.title || "Main Panel";
    let content = options.content || "";
    let show = options.show || true;
    let onOffCanvasClose = options.onOffCanvasClose || null;

    let btnCloseid = "closeOffCanvas"+pos+"Btn";

    let offCanvasHTML = `
    <div class="offcanvas offcanvas-${pos} ${customClass} dark_bg rounded-2" tabindex="-1" id="offcanvas_${pos}" aria-labelledby="offcanvasLabel">
        <div class="offcanvas-header">
            <h5 class="offcanvas-title" id="offcanvasLabel">${title}</h5>
            <button type="button" id=${btnCloseid} class="btn-close" data-bs-dismiss="offcanvas" aria-label="Close"></button>
        </div>
        <div class="offcanvas-body"></div>
    </div>`;

 let el_Canvas = uikit.createElfromString(offCanvasHTML);
 let bs_Canvas = new bootstrap.Offcanvas(el_Canvas);
 if(show) bs_Canvas.show();

 //document.body.append(el_letfOffCanvas);
 if(content) el_Canvas.querySelector(".offcanvas-body").append(content);
 if(onOffCanvasClose) el_Canvas.querySelector("#"+btnCloseid).addEventListener("click", onOffCanvasClose);
 
 /// uikit.leftOffCanvas = bs_LetfOffCanvas;
 uikit[id] = bs_Canvas;
 return el_Canvas;
};

uikit.createTabsGroup=(options)=>{ //Created to add onClick to Tab

    let baseid = ATON.Utils.generateID("tabgroup");

    let el = document.createElement('div');

    let eltabs = document.createElement('ul');
    eltabs.classList.add("nav","nav-tabs"); //, "nav-underline"
    if(options.justified == true)  eltabs.classList.add("nav-justified");
    eltabs.setAttribute("role","tablist");

    let eltabcontent = document.createElement('div');
    eltabcontent.classList.add("tab-content");
    //eltabcontent.id = baseid + "tabContent";

    el.append(eltabs);
    el.append(eltabcontent);

    for (let i=0; i<options.items.length; i++){
        let e = options.items[i];

        let tabtitle   = e.title;
        let tabcontent = e.content;
        let icon       = e.icon;

        let icontab = "";
        if (icon) icontab = "<img class='icon aton-icon aton-icon-small' src='"+UI.resolveIconURL(icon)+"'>";

        let tabid = baseid+"-"+tabtitle;
        tabid = tabid.replaceAll(" ", "");

        let eltab = document.createElement('li');
        eltab.classList.add("nav-item");
        eltab.setAttribute("role","presentation");

        var elTabBtn = uikit.createElfromString("<button class='nav-link aton-tab' id='"+tabid+"-tab' data-bs-toggle='pill' data-bs-target='#"+tabid+"' type='button' role='tab' aria-controls='"+tabid+"'>"+icontab+tabtitle+"</button>");
        if(e.onClick) elTabBtn.addEventListener("click", e.onClick);
        
        if (i===0) {
            elTabBtn.classList.add("active");
            elTabBtn.setAttribute("aria-selected","true");
        }

        eltab.append(elTabBtn);
        eltabs.append(eltab);

        let eltabbody;

        if (i===0) 
            eltabbody = uikit.createElfromString("<div class='tab-pane show active' id='"+tabid+"' role='tabpanel' aria-labelledby='"+tabid+"-tab'></div>");
        else 
            eltabbody = uikit.createElfromString("<div class='tab-pane show' id='"+tabid+"' role='tabpanel' aria-labelledby='"+tabid+"-tab'></div>");

        eltabbody.style.padding = "10px 0px 10px 0px";

        if (tabcontent) eltabbody.append( tabcontent );
        eltabcontent.append(eltabbody);

    }

    return el;
}


//TO FIX WITH PROMISE?

uikit.createModelGallery=(options)=>{

    //o.onModelItemClicked

    let artworks, utilities, customizables, media;
    
    APP.db.getMedia((_media)=>{
        media = _media;
        artworks = APP.config.models.artworks;
        utilities = APP.config.models.utilities;
        customizables = APP.config.models.customizables;
        
        _create();
    })

    const getThumb=(m,thumbBasePath)=>{
        if(!m.thumb) return APP.ui.baseIcons+"placeholder.png";
        else return ATON.PATH_COLLECTION + thumbBasePath + m.thumb;
    }

    const createCard=(o)=>{
       let _string = `
        <div class="card modelCard" style="width: 30%; height:200px">
        <div class="card-img-top centerCropped" 
         style="background-image: url('${o.thumb}'); height:200px">
        </div>
        <div class="card-body">
            <h5 class="card-title">${o.title}</h5>
        </div>
        </div>
        `
        let card = uikit.createElfromString(_string);
        card.addEventListener("click",()=>o.onClick({id:o.id, url:o.path, type:o.type}));
        return card;
    }
   
    const abortGallery=()=>{
        ATON.UI.hideModal();
      // ATON.UI.elModal.children[0].classList.remove("modal-xl");
    }

    //TODO: isolare createItemList e usare per artworks e utilites, generare tab contents, Chiamare da dentro "create"
    const createGallery=({models,thumbBasePath,modelBasePath,type})=>{
        console.log(models)
        console.log(thumbBasePath)
        let container = uikit.createElfromString("<div class='cardsFlexContainer' id='ModelCardsContainer'></div>")
        models.forEach(m => {
            console.log(m);
            let thumb = getThumb( m , thumbBasePath );
            let id = m.nodeId;
            let title = m.title;
            let path = modelBasePath + m.path;
            let onClick = options.onModelItemClicked;
            let card = createCard({ type, id, path, thumb, title, onClick });
            container.append(card);
        });
        return container;
    }
    const _create=()=>{
        
        let artworksGallery = createGallery({
            type:"artworks",
            models:artworks,
            thumbBasePath: APP.config.baseArtworksThumbPath,
            modelBasePath: APP.config.baseArtworksModelsPath});

        let utilitiesGallery = createGallery({
            type:"utilities",
            models:utilities,
            thumbBasePath:APP.config.baseUtilitiesThumbPath,
            modelBasePath:APP.config.baseUtilitiesModelsPath});

        let customizablesGallery = createGallery({
            type:"customizables",
            models:customizables,
            thumbBasePath:APP.config.baseCustomizablesThumbPath,
            modelBasePath:APP.config.baseCustomizablesModelsPath});
        
        let tabsOptions = {items:[
            {title:"Artworks", content: artworksGallery},
            {title:"Utilities", content: utilitiesGallery},
            {title:"Customizables", content: customizablesGallery}
        ]};
        
        let tabs = uikit.createTabsGroup(tabsOptions);

        //COMPOSE MODAL
        let header = "Select a Model";
        let body = tabs;
        let footer = uikit.createButton({onClick:abortGallery,text:"Cancel"});

        //Show MODAL:
        //ATON.UI.elModal.children[0].classList.add("modal-xl"); //Set extralarge. //TO REMOVE AFTER, TO FI
        UI.showModal({header,body,footer,size:"xl"});
    }
}



uikit.createMediaGallery=(options)=>{

    //o.onMediaItemClicked
    //o.onAddFileBtnClicked

    let media;
    
    
    APP.db.getOnlyUserMedia((_media)=>{
        media = _media;     
        //TODO: filter media by type and only single user?
   
        _create();
    })

    const createCard=(o)=>{
       let _string = `
        <div class="card modelCard" style="width: 20%; height:200px">
        <div class="card-img-top centerCropped" 
         style="background-image: url('${ATON.Utils.resolveCollectionURL(o.path)}'); height:200px">
        </div>
        <div class="card-body">
            <h5 class="card-title">${o.name}</h5>
        </div>
        </div>
        `
        let card = uikit.createElfromString(_string);
        card.addEventListener("click",()=>o.onClick({ url:o.path}));
        return card;
    }
   
    const abortGallery=()=>{ATON.UI.hideModal();}

    const getLastPathSegment = (str) => str.split('/').pop();

    const createGallery=(items)=>{
        console.log(items)
        let container = uikit.createElfromString("<div class='cardsFlexContainer' id='ModelCardsContainer'></div>")
        items.forEach(m => {
            console.log(m)
            let name  =  getLastPathSegment(m);
            let path = m
            let onClick = options.onMediaItemClicked;
            let card = createCard({ path, name, onClick })
            container.append(card);
        });
        return container;
    }

    const _footer = ()=>{
        let cancelBtn = uikit.createButton({text:"Cancel",onClick:abortGallery});
        let addBtn = uikit.createButton({variant:"primary",text:"Add new file",onClick: options.onAddFileBtnClicked});
        return UI.flexBox({content:[addBtn,cancelBtn],alignItems:"center",justifyContent:"between"});
    }
    const _create=()=>{
      
        //COMPOSE MODAL
        let header = "Select a Media";
        let body = createGallery(media);
        let footer = _footer();

        //Show MODAL:
        UI.showModal({header,body,footer,size:"xl"});
    }
}

/**
 * Create an element container with custom content
 * @param {Object} options - Configuration object
 * @param {Array} options.classList - CSS classes to apply
 * @param {Array} options.content - Array of child elements or HTML strings
 * @returns {Element} The created container element
 */
uikit.createContainer = (options) => {
    const el = document.createElement('div');
    
    if (options.classList && Array.isArray(options.classList)) {
        el.classList.add(...options.classList);
    }
    
    if (options.content && Array.isArray(options.content)) {
        options.content.forEach(item => {
            if (typeof item === 'string') {
                el.append(uikit.createElfromString(item));
            } else if (item instanceof Element) {
                el.append(item);
            }
        });
    }
    
    return el;
};

uikit.TextureSelectorBlock=(imgPath,onBtnClicked, materialName)=>{

    const imageThumb=(path)=>{
       let icon = ATON.Utils.resolveCollectionURL(path);
       return UI.image(icon,"sm");
    }

    const btn = (click)=> uikit.createButton({text:"🖼️ Change texture",onClick:click});
    
    // If material name provided, show it above
    if (materialName) {
        const nameLabel = uikit.createElfromString(`<div class="material-name-label" style="font-weight:bold; margin-bottom:5px;">${materialName}</div>`);
        const textureRow = UI.flexBox({content:[imageThumb(imgPath),btn(onBtnClicked)], alignItems:"center", classList:"mb-2"});
        return uikit.createContainer({content: [nameLabel, textureRow]});
    }

    return UI.flexBox({content:[imageThumb(imgPath),btn(onBtnClicked)], alignItems:"center", classList:"mb-4"});
}

uikit.setLoadingCursor=(isLoading)=>{
    if(isLoading) document.body.style.cursor = "wait";
    else document.body.style.cursor = "default";
}



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

export {uikit};
