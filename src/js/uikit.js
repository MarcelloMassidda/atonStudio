import {UI} from '../../../uitoolkit/js/uitoolkit.js';

let uikit = {};

uikit.default_buttonVariant = "dark";

uikit.createElfromString = (html)=>{ return ATON.UI.createElementFromHTMLString(html); };


uikit.createButton=(options)=>{

    let el = UI.button(options);

    if (options.badge){ 
        el.append( uikit.createElfromString("<span class='badge text-bg-secondary'>"+options.badge+"</span>"));
    }
    ///Set variant:
    let _variant = options.variant || uikit.default_buttonVariant;
    el.classList.add("btn-"+_variant, "p-2");

    return el;
};

uikit.deleteButton=(options)=>{ options.variant = "danger"; return uikit.createButton(options)};


uikit.inspectorSeparator=()=>{
return uikit.createElfromString(`<div class="p-2"></div>`)}

//NOT USED:
uikit.wrapInGroupList=(options)=>{
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

uikit.createTabsGroup=(options)=>{

    let baseid = ATON.Utils.generateID("tabgroup");

    let el = document.createElement('div');

    let eltabs = document.createElement('ul');
    eltabs.classList.add("nav","nav-justified","nav-tabs"); // "nav-underline"
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

export {uikit};