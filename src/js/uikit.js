import { UI } from "./uitoolkit.js";

let uikit = {};

uikit.default_buttonVariant = "dark";

uikit.createElfromString = (html) => {
  return ATON.UI.createElementFromHTMLString(html);
};

uikit.createButton = (options) => {
  let el = UI.button(options);

  // Handle multiple badges
  if (options.badges && Array.isArray(options.badges)) {
    options.badges.forEach((badge) => {
      const badgeEl = uikit.createElfromString(
        `<span class='badge text-bg-${badge.type || "secondary"} ms-1'>${
          badge.text
        }</span>`
      );
      el.append(badgeEl);
    });
  }
  // Keep backward compatibility with single badge
  else if (options.badge) {
    el.append(
      uikit.createElfromString(
        "<span class='badge text-bg-secondary ms-1'>" +
          options.badge +
          "</span>"
      )
    );
  }
  ///Set variant and density (compact: used inside the inspector forms).
  // NB: options.size is the toolkit icon size (UI.image), not the button size.
  let _variant = options.variant || uikit.default_buttonVariant;
  el.classList.add("btn-" + _variant);
  el.classList.add(options.compact ? "btn-sm" : "p-2");
  if (options.block) el.classList.add("insp-btn-block");

  return el;
};

uikit.deleteButton = (options) => {
  options.variant = "danger";
  return uikit.createButton(options);
};

// ============================================================
// Authoring forms (inspector). Styles: atonstudio.css, "Authoring forms".
// ============================================================

/** Append an element, an array of elements, or nothing. */
const appendContent = (parent, content) => {
  if (Array.isArray(content)) content.forEach((c) => c && parent.append(c));
  else if (content) parent.append(content);
};

uikit.inspectorSeparator = () => {
  return uikit.createElfromString(`<hr class="insp-sep">`);
};

/**
 * Small square button with only an icon (tooltip as accessible name)
 */
uikit.iconButton = ({ id, icon, tooltip, onClick, variant = "dark", active = false }) => {
  const el = uikit.createButton({ id, icon, variant, compact: true, onClick });
  el.classList.add("insp-icon-btn");
  if (tooltip) {
    el.title = tooltip;
    el.setAttribute("aria-label", tooltip);
  }
  if (active) el.classList.add("Inspector_activeBtn");
  return el;
};

/**
 * Labeled form field: label (+ optional actions on the right) above a control
 * @param {Object} o
 * @param {string} o.label - field label
 * @param {string} [o.labelFor] - id of the control, for the <label for>
 * @param {Element} o.control - the input / control element
 * @param {Element[]} [o.actions] - small buttons shown next to the label
 * @param {string} [o.hint] - muted help text under the control
 */
uikit.field = ({ label, labelFor, control, actions, hint }) => {
  const field = document.createElement("div");
  field.classList.add("insp-field");

  const head = document.createElement("div");
  head.classList.add("insp-field-head");
  const lbl = document.createElement("label");
  lbl.classList.add("insp-label");
  lbl.textContent = label || "";
  if (labelFor) lbl.htmlFor = labelFor;
  head.append(lbl);
  if (actions && actions.length) {
    const act = document.createElement("div");
    act.classList.add("insp-field-actions");
    appendContent(act, actions);
    head.append(act);
  }
  field.append(head);

  appendContent(field, control);

  if (hint) {
    const h = document.createElement("div");
    h.classList.add("insp-hint");
    h.textContent = hint;
    field.append(h);
  }
  return field;
};

/**
 * Create a micro-title for inspector sections
 */
uikit.microTitle = (text, actions = null) => {
  const el = document.createElement("div");
  el.classList.add("insp-section-title");
  const span = document.createElement("span");
  span.textContent = text;
  el.append(span);
  if (actions) appendContent(el, actions);
  return el;
};

/**
 * Create a section container with micro-title
 * @param {string} title
 * @param {Element|Element[]} content
 * @param {Element|Element[]} [titleActions] - small buttons aligned right in the title row
 */
uikit.inspectorSection = (title, content, titleActions = null) => {
  const section = document.createElement("div");
  section.classList.add("insp-section");
  if (title) section.appendChild(uikit.microTitle(title, titleActions));
  appendContent(section, content);
  return section;
};

/**
 * Card wrapping one action assigned to a semantic node
 * @param {string} actionId
 * @param {string} actionType
 * @param {Element|Element[]} content
 * @param {Object} [options]
 * @param {string} [options.title] - readable action name (defaults to actionType)
 * @param {Function} [options.onRemove] - shows a remove button in the header
 */
uikit.actionContainer = (actionId, actionType, content, options = {}) => {
  const card = document.createElement("div");
  card.classList.add("insp-action-card");
  card.dataset.actionId = actionId;

  const head = document.createElement("div");
  head.classList.add("insp-action-head");
  const title = document.createElement("div");
  title.classList.add("insp-action-title");
  title.textContent = options.title || actionType;
  title.title = `${actionType} · ${actionId}`;
  head.append(title);
  if (options.onRemove) {
    head.append(
      uikit.iconButton({
        icon: "cancel",
        tooltip: "Remove this action",
        onClick: options.onRemove,
      })
    );
  }
  card.append(head);

  const body = document.createElement("div");
  body.classList.add("insp-action-body");
  appendContent(body, content);
  card.append(body);

  return card;
};

uikit.createOffCanvas = (options) => {
  let pos = options.pos || "start";
  let id = "offcanvas_" + pos;

  if (uikit[id]) {
    uikit[id]._element.remove();
  }

  let customClass = "custom-offcanvas-" + pos;
  let title = options.title || "Main Panel";
  let content = options.content || "";
  let show = options.show || true;
  let onOffCanvasClose = options.onOffCanvasClose || null;

  let btnCloseid = "closeOffCanvas" + pos + "Btn";

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
  if (show) bs_Canvas.show();

  //document.body.append(el_letfOffCanvas);
  if (content) el_Canvas.querySelector(".offcanvas-body").append(content);
  if (onOffCanvasClose)
    el_Canvas
      .querySelector("#" + btnCloseid)
      .addEventListener("click", onOffCanvasClose);

  /// uikit.leftOffCanvas = bs_LetfOffCanvas;
  uikit[id] = bs_Canvas;
  return el_Canvas;
};

uikit.createTabsGroup = (options) => {
  //Created to add onClick to Tab

  let baseid = ATON.Utils.generateID("tabgroup");

  let el = document.createElement("div");

  let eltabs = document.createElement("ul");
  eltabs.classList.add("nav", "nav-tabs"); //, "nav-underline"
  if (options.justified == true) eltabs.classList.add("nav-justified");
  eltabs.setAttribute("role", "tablist");

  let eltabcontent = document.createElement("div");
  eltabcontent.classList.add("tab-content");
  //eltabcontent.id = baseid + "tabContent";

  el.append(eltabs);
  el.append(eltabcontent);

  for (let i = 0; i < options.items.length; i++) {
    let e = options.items[i];

    let tabtitle = e.title;
    let tabcontent = e.content;
    let icon = e.icon;

    let icontab = "";
    if (icon)
      icontab =
        "<img class='icon aton-icon aton-icon-small' src='" +
        UI.resolveIconURL(icon) +
        "'>";

    let tabid = baseid + "-" + tabtitle;
    tabid = tabid.replaceAll(" ", "");

    let eltab = document.createElement("li");
    eltab.classList.add("nav-item");
    eltab.setAttribute("role", "presentation");

    var elTabBtn = uikit.createElfromString(
      "<button class='nav-link aton-tab' id='" +
        tabid +
        "-tab' data-bs-toggle='pill' data-bs-target='#" +
        tabid +
        "' type='button' role='tab' aria-controls='" +
        tabid +
        "'>" +
        icontab +
        tabtitle +
        "</button>"
    );
    if (e.onClick) elTabBtn.addEventListener("click", e.onClick);

    if (i === 0) {
      elTabBtn.classList.add("active");
      elTabBtn.setAttribute("aria-selected", "true");
    }

    eltab.append(elTabBtn);
    eltabs.append(eltab);

    let eltabbody;

    if (i === 0)
      eltabbody = uikit.createElfromString(
        "<div class='tab-pane show active' id='" +
          tabid +
          "' role='tabpanel' aria-labelledby='" +
          tabid +
          "-tab'></div>"
      );
    else
      eltabbody = uikit.createElfromString(
        "<div class='tab-pane show' id='" +
          tabid +
          "' role='tabpanel' aria-labelledby='" +
          tabid +
          "-tab'></div>"
      );

    eltabbody.style.padding = "10px 0px 10px 0px";

    if (tabcontent) eltabbody.append(tabcontent);
    eltabcontent.append(eltabbody);
  }

  return el;
};

//TO FIX WITH PROMISE?

uikit.createModelGallery = (options) => {
  //o.onModelItemClicked

  let artworks, utilities, customizables, media;

  APP.db.getMedia((_media) => {
    media = _media;
    artworks = APP.config.models.artworks;
    utilities = APP.config.models.utilities;
    customizables = APP.config.models.customizables;

    _create();
  });

  const getThumb = (m, thumbBasePath) => {
    if (!m.thumb) return APP.ui.baseIcons + "placeholder.png";
    else return ATON.PATH_COLLECTION + thumbBasePath + m.thumb;
  };

  const createCard = (o) => {
    let _string = `
        <div class="card modelCard" style="width: 30%; height:200px">
        <div class="card-img-top centerCropped" 
         style="background-image: url('${o.thumb}'); height:200px">
        </div>
        <div class="card-body">
            <h5 class="card-title">${o.title}</h5>
        </div>
        </div>
        `;
    let card = uikit.createElfromString(_string);
    card.addEventListener("click", () =>
      o.onClick({ id: o.id, url: o.path, type: o.type })
    );
    return card;
  };

  const abortGallery = () => {
    ATON.UI.hideModal();
    // ATON.UI.elModal.children[0].classList.remove("modal-xl");
  };

  //TODO: isolare createItemList e usare per artworks e utilites, generare tab contents, Chiamare da dentro "create"
  const createGallery = ({ models, thumbBasePath, modelBasePath, type }) => {
    console.log(models);
    console.log(thumbBasePath);
    let container = uikit.createElfromString(
      "<div class='cardsFlexContainer' id='ModelCardsContainer'></div>"
    );
    models.forEach((m) => {
      console.log(m);
      let thumb = getThumb(m, thumbBasePath);
      let id = m.nodeId;
      let title = m.title;
      let path = modelBasePath + m.path;
      let onClick = options.onModelItemClicked;
      let card = createCard({ type, id, path, thumb, title, onClick });
      container.append(card);
    });
    return container;
  };
  const _create = () => {
    let artworksGallery = createGallery({
      type: "artworks",
      models: artworks,
      thumbBasePath: APP.config.baseArtworksThumbPath,
      modelBasePath: APP.config.baseArtworksModelsPath,
    });

    let utilitiesGallery = createGallery({
      type: "utilities",
      models: utilities,
      thumbBasePath: APP.config.baseUtilitiesThumbPath,
      modelBasePath: APP.config.baseUtilitiesModelsPath,
    });

    let customizablesGallery = createGallery({
      type: "customizables",
      models: customizables,
      thumbBasePath: APP.config.baseCustomizablesThumbPath,
      modelBasePath: APP.config.baseCustomizablesModelsPath,
    });

    let tabsOptions = {
      items: [
        { title: "Artworks", content: artworksGallery },
        { title: "Utilities", content: utilitiesGallery },
        { title: "Customizables", content: customizablesGallery },
      ],
    };

    let tabs = uikit.createTabsGroup(tabsOptions);

    //COMPOSE MODAL
    let header = "Select a Model";
    let body = tabs;
    let footer = uikit.createButton({ onClick: abortGallery, text: "Cancel" });

    //Show MODAL:
    //ATON.UI.elModal.children[0].classList.add("modal-xl"); //Set extralarge. //TO REMOVE AFTER, TO FI
    UI.showModal({ header, body, footer, size: "xl" });
  };
};

uikit.createMediaGallery = (options) => {
  //o.onMediaItemClicked
  //o.onAddFileBtnClicked

  let media;

  APP.db.getOnlyUserMedia((_media) => {
    media = _media;
    //TODO: filter media by type and only single user?

    _create();
  });

  const createCard = (o) => {
    let _string = `
        <div class="card modelCard" style="width: 20%; height:200px">
        <div class="card-img-top centerCropped" 
         style="background-image: url('${ATON.Utils.resolveCollectionURL(
           o.path
         )}'); height:200px">
        </div>
        <div class="card-body">
            <h5 class="card-title">${o.name}</h5>
        </div>
        </div>
        `;
    let card = uikit.createElfromString(_string);
    card.addEventListener("click", () => o.onClick({ url: o.path }));
    return card;
  };

  const abortGallery = () => {
    ATON.UI.hideModal();
  };

  const getLastPathSegment = (str) => str.split("/").pop();

  const createGallery = (items) => {
    console.log(items);
    let container = uikit.createElfromString(
      "<div class='cardsFlexContainer' id='ModelCardsContainer'></div>"
    );
    items.forEach((m) => {
      console.log(m);
      let name = getLastPathSegment(m);
      let path = m;
      let onClick = options.onMediaItemClicked;
      let card = createCard({ path, name, onClick });
      container.append(card);
    });
    return container;
  };

  const _footer = () => {
    let cancelBtn = uikit.createButton({
      text: "Cancel",
      onClick: abortGallery,
    });
    let addBtn = uikit.createButton({
      variant: "primary",
      text: "Add new file",
      onClick: options.onAddFileBtnClicked,
    });
    return UI.flexBox({
      content: [addBtn, cancelBtn],
      alignItems: "center",
      justifyContent: "between",
    });
  };
  const _create = () => {
    //COMPOSE MODAL
    let header = "Select a Media";
    let body = createGallery(media);
    let footer = _footer();

    //Show MODAL:
    UI.showModal({ header, body, footer, size: "xl" });
  };
};

/**
 * Create an element container with custom content
 * @param {Object} options - Configuration object
 * @param {Array} options.classList - CSS classes to apply
 * @param {Array} options.content - Array of child elements or HTML strings
 * @returns {Element} The created container element
 */
uikit.createContainer = (options) => {
  const el = document.createElement("div");

  if (options.classList && Array.isArray(options.classList)) {
    el.classList.add(...options.classList);
  }

  if (options.content && Array.isArray(options.content)) {
    options.content.forEach((item) => {
      if (typeof item === "string") {
        el.append(uikit.createElfromString(item));
      } else if (item instanceof Element) {
        el.append(item);
      }
    });
  }

  return el;
};

/**
 * Create a text element (paragraph or span)
 * Wrapper for UI.createEl from uitoolkit
 * @param {Object} options - Configuration object
 * @param {string} options.text - The text content
 * @param {Array|string} options.classList - CSS classes to apply
 * @param {string} options.tag - HTML tag to use (default: 'p')
 * @returns {Element} The created text element
 */
uikit.createText = (options) => {
  const tag = options.tag || 'p';
  return UI.createEl({
    tag: tag,
    innerHTML: options.text || '',
    classList: options.classList
  });
};

/**
 * One row per material: thumbnail, name, "Change" and (optional) "Restore"
 * @param {string} imgPath - current texture (collection path)
 * @param {Function} onBtnClicked - opens the texture picker
 * @param {string} [materialName]
 * @param {Function} [onRestore] - if given, the texture is overridden: show "Restore"
 */
uikit.TextureSelectorBlock = (imgPath, onBtnClicked, materialName, onRestore = null) => {
  const row = document.createElement("div");
  row.classList.add("insp-material-row");
  if (onRestore) row.classList.add("is-overridden");

  const thumb = document.createElement("div");
  thumb.classList.add("insp-material-thumb");
  if (imgPath) {
    const img = document.createElement("img");
    img.src = ATON.Utils.resolveCollectionURL(imgPath);
    img.alt = "";
    img.onerror = () => img.remove(); // keep the empty placeholder box
    thumb.append(img);
  }
  row.append(thumb);

  const info = document.createElement("div");
  info.classList.add("insp-material-info");
  const name = document.createElement("div");
  name.classList.add("insp-material-name");
  name.textContent = materialName || "Texture";
  name.title = materialName || "";
  info.append(name);

  const btns = document.createElement("div");
  btns.classList.add("insp-material-btns");
  btns.append(uikit.createButton({ text: "Change", compact: true, onClick: onBtnClicked }));
  if (onRestore) {
    btns.append(
      uikit.createButton({ text: "Restore", compact: true, variant: "outline-warning", onClick: onRestore })
    );
  }
  info.append(btns);
  row.append(info);

  return row;
};

uikit.setLoadingCursor = (isLoading) => {
  if (isLoading) document.body.style.cursor = "wait";
  else document.body.style.cursor = "default";
};

/**
 * Create a dropdown button with menu items
 * @param {Object} options - Configuration object
 * @param {string} options.text - Button text
 * @param {Array} options.items - Array of menu items {text, onClick}
 * @param {string} options.variant - Button variant (default 'dark')
 * @returns {Element} The dropdown container
 */
uikit.createDropdownButton = (options) => {
  const id = "dropdown_" + Math.random().toString(36).substr(2, 9);
  const variant = options.variant || "dark";

  const dropdownHTML = `
        <div class="dropdown">
            <button class="btn btn-${variant} dropdown-toggle p-2" type="button" id="${id}" data-bs-toggle="dropdown" aria-expanded="false">
                ${options.text || "Select"}
            </button>
            <ul class="dropdown-menu" aria-labelledby="${id}">
            </ul>
        </div>
    `;

  const el = uikit.createElfromString(dropdownHTML);
  const menu = el.querySelector(".dropdown-menu");

  // Add menu items
  if (options.items && Array.isArray(options.items)) {
    options.items.forEach((item) => {
      const itemHTML = `<li><a class="dropdown-item" href="#">${item.text}</a></li>`;
      const itemEl = uikit.createElfromString(itemHTML);

      if (item.onClick) {
        itemEl.querySelector("a").addEventListener("click", (e) => {
          e.preventDefault();
          item.onClick();
        });
      }

      menu.append(itemEl);
    });
  }

  return el;
};

/**
 * Create a 3D Point of View icon (arrow with sphere and cone)
 * Wrapper for UI.POV_3Dicon from uitoolkit
 * @param {Array} position - Position array [x, y, z]
 * @param {Array} target - Target array [x, y, z]
 * @returns {THREE.Group} The 3D POV icon group
 */
uikit.POV_3Dicon = (position, target) => {
  return UI.POV_3Dicon(position, target);
};

/**
 * Create a 3D measurement icon with two points
 * Wrapper for UI.MEASURE_3Dicon from uitoolkit
 * @param {Array} pointA - Start point [x, y, z]
 * @param {Array} pointB - End point [x, y, z]
 * @returns {THREE.Group} The measurement icon group
 */
uikit.MEASURE_3Dicon = (pointA, pointB) => {
  return UI.MEASURE_3Dicon(pointA, pointB);
};

export { uikit };
