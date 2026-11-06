import { gizmoManager } from "./gizmo.js";

// UI toolkit, versioned inside AtonStudio (copied from wapps/uitoolkit on 2026-11-06).
// Own icons live in src/icons, resolved from this module (not from the page URL).
const ICONS_URL = new URL("../icons/", import.meta.url).href;

/**
 @namespace UI
 */
let UI =  {};

//Dialog settings:
UI.idBackdrop ="main_Backdrop";
UI.default_modalPopup_ID = "main_ModalDialog";
UI.default_modalDialogForm_ID = "main_ModalDialogForm";

const icon_orientations = ["top","bottom","left","right"] //connected to style css classes for createItem > Button TO FIX / USE.

UI.sizes =
    {
        "xsmall":"xs",
        "small":"sm",
        "medium":"md",
        "large":"lg",
        "xlarge":"xl",
        "default":"default",

        //same as:
        "xs":"xs",
        "sm":"sm",
        "md":"md",
        "lg":"lg",
        "xl":"xl"
    }   

//OLD Version-COMPATIBILITY

UI.init = ()=>{ UI.PATH_RES_ICONS = ATON.PATH_RES+"icons/"; };

UI._setupBase=()=>{ document.body.oncontextmenu = ()=>{ return false; }; };

UI.disclosureWidget = (o)=> //uniformed
{
    var _o = 
    {
        header: o.content,
        content: o.summary
    }
    return UI.summarize([_o]);
}


//UI toolkit

//1 Internal utilities:

const isStringOrHTMLElement=(obj)=> {
    if (typeof obj === "string") {
        return "string";
    } else if (obj instanceof HTMLElement) {
        return "HTMLElement";
    } else {
        return "other";
    }
}


const setAttributes =(element, attributes)=> { // 1.1 set multiple attributes to an HTML element
   
    for (let key in attributes) {
        if (attributes.hasOwnProperty(key)) {
            if(attributes[key]){
                element.setAttribute(key, attributes[key]);
            }
        }
    }
    return element;
}


const addContent = (element, content)=>{ // 1.2 addContent in HTML element with type checking: string / HTML string / HTML element / array
    if(content==null || content == undefined) return element;
    if (typeof content === 'string') {
        // Check if the string is HTML
        if (/<[a-z][\s\S]*>/i.test(content)) {
            element.innerHTML += content; // Append HTML string
        } else {
            element.appendChild(document.createTextNode(content)); // Append plain text
        }
    } else if (content instanceof HTMLElement) {
        element.appendChild(content); // Append HTML element
    } else if (Array.isArray(content)) {
        content.forEach(item => addContent(element, item)); // Recursively handle array items
    } else {
        console.error('Invalid content type. Must be a string, HTML string, HTML element, or an array of these.');

        element.innerHTML +="XXXXXXXXXXXX"
    }
    return element;
}
UI.addContent = addContent;



const createEl=(options={})=>  // 1.3 create an HTML element using options
{ 
    /* comment
    options:
    {
        tag:"div", ?=div
        id:"myID", ?
        innerHTML:"<p>my HTML </p>", ?
        classList: "a b c" | ["a","b","c"]
        className:"class1"
        cssText: "background-color:pink;font-size:55px;" ?
        tooltip: "my title for tooltip"
        content: "string" | "HTML string" | HTML object | [any of these]
        attr: ?
        {
            id:"myID",
            class: "class1 class2"
            style: "background-color:pink;font-size:55px;"
            title: "my title for tooltip"
        }
        events:
        {
            "click":callback(),
            "change":callback();
        }
        state ? /////// to add with UI.setupState(o,el);
    }
    */
    
    const o = options;
    const _tag = o.tag ? o.tag : "div";
    var el = document.createElement(_tag);
    if(o.id) el.id = o.id;
    if(o.innerHTML) el.innerHTML = o.innerHTML;
    if(o.classList){ //can be array or string
            let _classList = Array.isArray(o.classList) ? o.classList : [o.classList];
            el.classList.add(..._classList);}
    if(o.className) el.className = o.className;
    if(o.cssText) el.style.cssText += o.cssText;
    if(o.tooltip) el.title = o.tooltip;
    if(o.content){ el = addContent(el,o.content);}
    if(o.attr){setAttributes(el,o.attr)}
    if(o.events){
       // console.log(o.events)
            for (let key in o.events) {
                el.addEventListener(key, 
                o.events[key]);
            }
        }
    return el;
    //if(o.state) el = UI.setupState(o,el); ///// TO ADD
}

UI.isStringOrHTMLElement = isStringOrHTMLElement;

UI.createEl = createEl;
UI.createItem = (options={})=> //1.4 create an HTML div with inside a "icon" oriented near to a "text", both HTML elements. Used for buttons with icons, inputs
{
    /* comment
    options:
    id,
    class,
    icon = can be a generic HTML object
    iconPos: ["top","left","right","bottom"]
    text,
    tooltip
    */
   
   const o = options;
   let el = createEl(o);
   if(o.icon) el.appendChild(o.icon);
   if(o.iconPos) el.classList.add(o.iconPos+"Oriented");
   if(o.text)
    {
        if(typeof(o.text)=="object") el.appendChild(o.text);
        if(typeof(o.text)=="string") el.innerHTML+=o.text;
    }

   if(o.tooltip) el.setAttribute("title", o.tooltip);
   return el;
}

UI.image = (icon, size=null)=> //create an HTML image... to replace parameters with single object? {options}
{
   var isCropped = false;
   var _css="";

   if(size){
    if(UI.sizes[size]){
        isCropped=true;
        _css = "object-fit:cover; width:100%; height:100%";
    }
   }

   if(icon){
    if(!icon.includes(".")) icon = UI.PATH_RES_ICONS + icon+".png";
   }
   //else add place holder...

   var image = createEl({tag:"img",attr:{"src":icon}, cssText:_css});
   
   if(!isCropped) return image;

   var imageContained = createEl({
        content:image,
        classList: [`img-${UI.sizes[size]}`, "atonImgContainer"]
    });
   return imageContained;
}

UI.button = (o)=>{ //create an HTML button in an Item with an image icon (optional)

 
    /*options: createItem_options, onClick?, state?*/
    let _o = JSON.parse(JSON.stringify(o)); //avoid to permanent change input options

    if(o.icon) {
        var size = o.size? o.size:null;
        _o.icon = UI.image(o.icon,size);
        if(!o.iconPos) _o.iconPos ="left";
    }

    if(o.text) _o.text = createEl({innerHTML: o.text});
 
    _o.tag="button";
    let el = UI.createItem(_o);
    el.classList.add("btn", "aton-btn");

    let _type = "button";
    if(_o.attr) {if(_o.attr.type) _type = _o.attr.type;}
    el.setAttribute("type",_type);
    
    //el.classList.add("atonBTN", "blurredUI");

    if(o.onClick) el.onclick  = o.onClick; //To omologate
    if(o.onclick) el.onclick  = o.onclick;    

    return el;
}

UI.buttonGroup=(o)=>
    {
        /*
        options: createEl_options, buttons
        to add:
        backgroundColor
        */
    
        let group = createEl(o); group.classList.add("atonBtnGroup" , "blurredUI");
        if(!o.buttons) return group;
        o.buttons.map((btn)=>{btn.classList.remove("blurredUI"); group.appendChild(btn)});
        return group;
    }

//TO FIX
UI.setupState=(o,el)=>{

      if(!o.state) return el;
      var initialState;
      //stateHandler è una funzione di callback chiamata quando lo stato viene modificato.
      //caso 1 stateHandler è UI.defeault_onStateChange e viene chiamata all'onclick dell'element.
      var stateHandler = UI.default_onStateChange; 
      var stateTrigger = o.state.trigger ? o.state.trigger : "click";
  
      if(typeof o.state === 'boolean'){ //case 1
           initialState = o.state;
           //set state and callback
           el.data("state",!initialState);
           stateHandler(el);
          } 
  
      else if(typeof o.state === 'object'){ // case 2
          console.log("is object")
          if(o.state.onStateChange) stateHandler = o.state.onStateChange; 
          initialState = o.state.initialState;
          console.log(initialState)
          el.data("state",initialState);
          console.log("data is: " + el.data("state"))
      }
  
      el.addEventListener(stateTrigger, (e)=>{stateHandler($(e.currentTarget))});

      return el;
}

UI.default_onStateChange = (e)=>{
    window.e = e;
    //get state: get button, e could be from click event or from initialization
    const button = e// e.currentTarget ? $(e.currentTarget) : e;
    const state = button.data("state");
    //handle state:
    var newState = !state;
    const baseClass = "default_state_button_style_";
    button.removeClass(baseClass+state).classList.add(baseClass+newState);
    //set new state
    button.data("state",newState);
}


UI.input=(o)=> //create HTML input
{
    /*comment

    singleInput_options:
    o.id = "myID" (used for id of input and labelFor)
    o.type = "text",
    o.name = "myName",
    o.value = "PlaceholderName",
    o.events?
    o.checked = "checked"  //for checkbox or radio, must be: checked:"checked"
    o.step = "1" //for number
    o.labelText = "Write your name" ?
    o.required = true / false

    multipleInputs_options:
    o.inputs = [{singleInput_options}]  //case of multiple choises as radio / checkbox
    o.legendText = "Legend Text" ?

    */

    //utilites:

    const inputEl = (o)=>{
        let _o = o;
        _o.tag = "input";
        if(!_o.attr) _o.attr = {};

        if(o.type) _o.attr.type = o.type;
        if(o.name) _o.attr.name = o.name;
        if(o.value) _o.attr.value = o.value;
        if(o.checked) _o.attr.checked = o.checked;
        if(o.step)  _o.attr.step = o.step;
        if(o.required) {if(o.required==true){ _o.attr.required = true; }}

        return createEl(o);
    }

    const fieldset = (_id=null)=> {return createEl({tag:"fieldset",id:_id})}
    
    const legend = (text)=> {return createEl({tag:"legend", innerHTML:text})}
    
    const wrapWithLabel=({labelText,labelFor,input,events})=>{
            var _label = createEl({tag:"label", attr:{for:labelFor},events});
            _label.appendChild(input);
            _label.innerHTML+=labelText;
            return _label;
    }

    const composeSingleInput=(o)=>{
        var resultInput = inputEl(o);

        if(o.labelText){
            resultInput = wrapWithLabel({
                labelText: o.labelText,
                labelFor:o.id,
                input: inputEl(o),
                events: o.events}
        )}

        if(o.legendText){
          
           var wrappedInput = fieldset(o.id);     
            wrappedInput.appendChild(legend(o.legendText));
            wrappedInput.appendChild(resultInput);
            resultInput =  wrappedInput;
        }
        return resultInput;
    }

    const composeMultipleInputs=(o)=>{
        var _input = fieldset(o.id);

        _input.appendChild(legend(o.legendText));
        o.inputs.forEach(i => {_input.appendChild(composeSingleInput(i))});
        return _input;    
    }

    const inputTypes =
    [
        "text",
        "checkbox",
        "number",
        "color", //to fix margin 
        "date", 
        "datetime-local",
        "email",
        "file",
        "hidden",
        //image 
        "month",
        "password",
        "radio",
        "range",
        //reset 
        "search",
        //submit
        "tel",
        "time",
        "url",
        "week"
    ];


    if(!o.type) o.type="text"; //default type: text;
    if(!inputTypes.includes(o.type)) throw( o.type + ": Tipo di input non riconosciuto");
    
    var inputResult = null;
    
    if(!o.inputs){ inputResult= composeSingleInput(o)}
    if(o.inputs){ inputResult= composeMultipleInputs(o)}

    return inputResult;
}

UI.form=(o)=>{ //wrap in form a set of UI.input HTML objects, combining a default footer with submit btn.
    /* comment
    id,
    inputs: [input1,input2,input3],
    onsubmit? //callback
    footer? moved away
    */
   
    if(!o.inputs) throw("No inputs provided for the form");

    /*
    var footerForm = o.footer? o.footer :
    UI.buttonGroup({
        id:"formFooter",
        buttons: [UI.button({id:"confermBtn",text:"Conferma",attr:{type:"submit"}})]
    });
    */

    var formOptions = {id:o.id, tag:"form"};
    if(o.onsubmit) formOptions.events={submit:o.onsubmit};
    var _form = createEl(formOptions);

    o.inputs.forEach( i => { _form.appendChild(UI.input(i)); });     
    //_form.appendChild(footerForm);

    _form;
    return _form;
}


// Show the current value next to every range input of a form (updates live)
UI.addRangeValueLabels=(_form)=>{
    _form.querySelectorAll("input[type=range]").forEach((r)=>{
        const row = createEl({classList:["promptRangeRow"]});
        const out = createEl({tag:"output", classList:["promptRangeValue"]});
        out.textContent = r.value;
        r.addEventListener("input", ()=>{ out.textContent = r.value; });
        r.replaceWith(row);
        row.append(r, out);
    });
}

/*Notes:
checkbox false is not saved in getFormData
*/
UI.getFormData=(_form)=>{
    window.f = _form;
    const formData = new FormData(_form);
    const data = {};
    formData.forEach((value, key) => {
        data[key] = value;
    });
    window.d = data;
    return data;
}

UI.promptConfermDialog=(o)=>{
    /*
    body?
    idPopup?
    title?
    confermText?
    resumeText?
    */
    if(!o.idPopup) o.idPopup = UI.default_modalPopup_ID;
    
    let _conferm = o.confermText? o.confermText : "Confirm";
    let _resume = o.resumeText? o.resumeText : "Resume";
    
    return new Promise((resolve,reject)=>{

    //handlers
    const onConfermBtnClicked = ()=>{ resolve(true); UI.removePopup(o.idPopup);}
    const onResumeClicked = ()=>{ resolve(false); UI.removePopup(o.idPopup);}


    //header:
    let _header = o.header? o.header : null;
    let _title = o.title? o.title : null;
    if(!o.header)_header = createEl({className:"dialogHeader", content:[
        _title,
        UI.button({icon:"cancel", className:"dialogHeaderCloseBtn",onClick:onResumeClicked})]
    })

    //body:
    let _body = o.body?  createEl({className:"dialogBody",content:o.body}) : "";

    //footer:
    var _footer = o.footer? o.footer : createEl({id:"formFooter", className:"dialogFooter", content:
    [
        UI.button({id:"resumeBtn",text:_resume, onClick:onResumeClicked}),
        UI.button({id:"confermBtn",text:_conferm, onClick:onConfermBtnClicked})
    ]});

    const _promptConfermDialog = UI.dialog({id:o.idPopup,content:createEl({className:"dialogContainer",content:[_header,_body,_footer]})});
    document.body.appendChild(_promptConfermDialog);

    })
}

UI.promptDialog = (o)=>{ // create an async form wrapped in a popup, using options. returns data object.

    /* options:
        id,
        inputs: [input1, input2, input3]
        onsubmit? //passed to UI.form. An additional onSubmittedPromptForm handler is added here to manage the popup and resolve the promise.
        idPopup?
        header? (will replace default header)
        title? (will be displayed in the default header)
        footer?
    */

    if(!o.idPopup) o.idPopup = UI.default_modalPopup_ID;
    if(!o.id) o.id = UI.default_modalDialogForm_ID;

    return new Promise((resolve , reject)=>{
    
    //handlers
    const onSubmittedPromptForm = (event)=>{
        event.preventDefault();
        console.log(event.target)
        const data = UI.getFormData(event.target);
        ATON.UI.hideModal(); // UI.removePopup(o.idPopup);
        resolve(data);
    }

    const onResumeClicked = ()=>{
        ATON.UI.hideModal();//UI.removePopup(o.idPopup);
        resolve(null);
    }

    //header: custom element, or a string (header or title) rendered by showModal with the close button
    let _header = o.header ? o.header : (o.title ? o.title : null);

    //body: styled by .promptForm (atonstudio.css, "Prompt dialogs")
    let _form = UI.form(o);
    _form.classList.add("promptForm");
    _form.addEventListener("submit", onSubmittedPromptForm);
    UI.addRangeValueLabels(_form);
    let _body = createEl({className:"dialogBody", content:_form});

    //footer:
    var _footer = o.footer? o.footer : createEl({id:"formFooter", classList:["dialogFooter","promptFooter"], content:
    [
        UI.button({id:"resumeBtn",text:o.cancelText || "Cancel", classList:["btn-secondary"], onClick:onResumeClicked}),
        UI.button({id:"confermBtn",text:o.confirmText || "Confirm", classList:["btn-primary"], attr:{type:"submit", form:o.id} })
    ]});

    UI.showModal({header:_header,body:_body,footer:_footer,onModalClose:onResumeClicked});

    //focus the first editable field once the modal is visible
    ATON.UI.elModal.addEventListener("shown.bs.modal", ()=>{
        const first = _form.querySelector("input[type=text], input[type=number], input:not([type]), textarea");
        if (first) { first.focus(); first.select?.(); }
    }, {once:true});
    //const _promptDialog = UI.dialog({id:o.idPopup, content:createEl({className:"dialogContainer",content:[_header,_body,_footer]})});
    //document.body.appendChild(_promptDialog);

    })
}

UI.wizard=(o)=>{
    /*
    o.steps =[{name:"",promptDialogOptions}]
    */
   //todo...
}

//CONTAINERS:

UI.navbar=(o)=> //https://www.w3schools.com/howto/tryit.asp?filename=tryhow_js_topnav
{   
    //options: CreateEl_options, buttons
    
    const onHamburgerMenuClicked=(e)=> {
        //document.elem = e;
        var hmbtgIcon = e.target;
        
        var topnav = document.getElementById(o.id);
        if (!$(topnav).hasClass("responsive"))
        {
            topnav.classList.add("responsive");
            hmbtgIcon.style.backgroundImage = `url(${ICONS_URL}close.png)`;
        }
        else
        {
            topnav.classList.remove("responsive");
            hmbtgIcon.style.backgroundImage = `url(${ICONS_URL}hamburgerMenu.png)`;
        }
    }

    var topnav = createEl(o);
    topnav.classList.add("topnav","blurredUI");

    if(o.buttons)
    {
        o.buttons.map((b)=>{
            topnav.appendChild(createEl({classList:"navItem",content:b}));
        })
    }

    var menuBtn = createEl({
        classList:"icon",
        events:{click:onHamburgerMenuClicked},
        content:createEl({id:"hamburgerMenu"})});
            
    topnav.appendChild(menuBtn);
    return topnav;
}


UI.summarize=(options)=>
{
        // comment
        // options
        // [{
        //  header (title)
        //  content (content)
        // }] 

        // to add:
        //  id
        //  isOpen = false  
        //  containerClassName
        //  headerClassName
        //  panelClassName

    var summaryUnits = [];
    const  summary = (o)=>
    {
        let details = createEl({tag:"details",classList:"styled"})
        let summary = createEl({tag:"summary",content:o.header});
        console.log(o.content)
        let content = createEl({classList:"summaryContent", content:o.content})//.appendChild(normalizeContent(o.content));

        details.appendChild(summary);
        details.appendChild(content);

        return details;
    }

    const normalizeContent = (c)=>{
        return c
        if(typeof(c)=="string") return document.createTextNode(c);
        else return c;
    }

    const recurseContent = (c)=>
    {
        if(typeof(c)=="object" && Array.isArray(c))
        {
            let container = createEl();
            console.log(c);
         
            c.map((child)=>{
                let content = recurseContent(child);
               
                if(Array.isArray(content))
                {
                    content.forEach(c => {
                        container.appendChild(c)
                    });
                }
                else{container = addContent(container,content)}
            });
            return container;
        }

        if(c.header && c.content)
        {
            var childEl_list = [];
            c.content = recurseContent(c.content);
            childEl_list.push (summary(c));
            return childEl_list;
        }

        var _content = normalizeContent(c);
        if(_content) return _content;
    }

    const returnSummaryContained = (summaris,idContainer)=>
    {
        let summaryContainer = createEl({id:idContainer,classList:["blurredUI","summaryContainer"]});
        summaris.map((s)=>{summaryContainer.appendChild(s)});
        return summaryContainer;
    }

    options.forEach(o => {
            if(o.header && o.content)
            {
                o.content = recurseContent(o.content);
                summaryUnits.push(summary(o));
            }
    });
   
    return returnSummaryContained(summaryUnits, "myFinalSummary");
}



/*LAYOUT
-Containers:
Popup
Sidebars (Top, left, bottom, right)
Fullpage

-Wireframes
Grid, Columns, (Blocks)?FlexLayout

-Components:
icon+text (abstract button function)
card

*/
/**
 * @param {string} id - The id
 * @param {string} size - The size
 * @param {object} content - The content
 */



UI.dialog=(o)=>{
   if(!Object.hasOwn(o, 'isModal')) o.isModal = true;
   if(!Object.hasOwn(o, 'isCentered')) o.isCentered = true;
   return (UI.popup(o))
}

UI.popover=(o)=>{
    if(!Object.hasOwn(o, 'isModal')) o.isModal = false;
    if(!Object.hasOwn(o, 'isCentered')) o.isCentered = false;
    return (UI.popup(o))
}

UI.tooltip=(o)=>{return UI.popover(o)}

UI.popup=(o)=>{//options: {id, size:[large,small], content} //css to fix // to use xs / ms ecc...
    
    var popupID = o.id? o.id : UI.default_modalPopup_ID;
    
    const sizeClass = {"large":"atonDialogLarge", "small":"atonDialogCompact"}
    var _size = o.size ? sizeClass[o.size] : "small" //default size popup;
    if(!_size) throw(o.size + " is not a Popup size");

    //default configuration as dialog
    var isModal = Object.hasOwn(o, 'isModal')? o.isModal : "true";  //TO FIX: si chiude anche quando clicco sul popup
    var isCentered = Object.hasOwn(o, 'isCentered')? o.isCentered : "true";

    let popupContainer = createEl({id:popupID, classList:["atonDialog", "blurredUI", _size],content:o.content});
    if(isCentered) popupContainer.classList.add( "centered", "zoomCenteredAnim");
    
    let backDrop = createEl({id: UI.idBackdrop, classList:["backDrop"]});
    
    if( isModal ){ backDrop.classList.add("dark", "blurredUI"); }
    else{ 
        backDrop.addEventListener("touchstart",()=>UI.removePopup(popupID)); //touch only
        backDrop.addEventListener("mousedown",()=>UI.removePopup(popupID)); //mouse only
    }
    
    //Compose
    backDrop.appendChild(popupContainer);
    return backDrop;
}


UI.showModal=(options)=>{
    if (!options) return;
    //header,body,footer, onModalClose

    // Clear
    ATON.UI.elModalContent.innerHTML = "";
    
    //Size:
    let _elModal = ATON.UI.elModal.children[0];
    _elModal.classList.remove("modal-sm");
    _elModal.classList.remove("modal-lg");
    _elModal.classList.remove("modal-xl");
    if(options.size){
        _elModal.classList.add("modal-"+options.size);
    }

    //Header:
    if (options.header){
        let _header;
        if( UI.isStringOrHTMLElement(options.header) != "string" ){_header = options.header}
        else {
            let _title = ATON.UI.createElementFromHTMLString("<h4 class='modal-title' id='staticBackdropLabel'>"+options.header+"</h4>")
            _header = UI.createEl({classList:["modal-header"],content:_title});

            //BtnClose
            let _closeBtn = ATON.UI.createElementFromHTMLString("<button type='button' class='btn-close' data-bs-dismiss='modal' aria-label='Close'></button>");
            if(options.onModalClose) {_closeBtn.addEventListener("click", options.onModalClose);}
            _header.append(_closeBtn);
        }
        ATON.UI.elModalContent.append(_header);
    }

    //Body
    if (options.body){
        let el = document.createElement('div');
        el.classList.add("modal-body");
        el.append(options.body);

        ATON.UI.elModalContent.append( el );
    }

    //Footer
    if (options.footer){
        let el = document.createElement('div');
        el.classList.add("modal-footer");
        el.append(options.footer);

        ATON.UI.elModalContent.append( el );
    }

    ATON.UI.modal.show();
    ATON.UI._bModal = true;
}

/*
UI.dialog=(o)=> //To fix modal / no modal
{
    //options: {id,size:[large,small],content} //css to fix // to use xs / ms ecc...
    
    const sizeClass = {"large":"atonDialogLarge", "small":"atonDialogCompact"}
    var _size = o.size ? sizeClass[o.size] : "small" //default size popup;
    if(!_size) throw(o.size + " is not a Popup size");

    let backDrop = createEl({id: UI.idBackdrop, classList:["backDrop", "blurredUI"]});
    
    var dialogID = o.id? o.id : UI.idModalDialog;
    let dialogContainer = createEl({id:dialogID, classList:["atonDialog", "blurredUI", "centered", "zoomCenteredAnim", _size],content:o.content});
    
    //Compose
    backDrop.appendChild(dialogContainer);
    return backDrop;
}

UI.popover=(o)=>{ //To fix modal / no modal
 var p = UI.dialog(o);
 p.classList.remove("blurredUI");
 p.style.backgroundColor="transparent"
 p.firstChild.classList.remove("centered");
 p.firstChild.classList.remove("zoomCenteredAnim");
 p.addEventListener("click",()=>UI.removePopup(o.id));

 return p;
}
 */

UI.removePopup=(id=UI.default_modalPopup_ID)=>{
    var target = document.getElementById(id);
    if(!target) return;

    if(target.parentNode.id == UI.idBackdrop){
        target.parentNode.remove();
    }
    else{console.error("something wrong with popup closure")}
}

UI.card=(o)=>{
    
    /* options:
    size:
    as createEl,
    as UI.image: icon, iconPos
    as createItem: icon, text
    */
    
    const cardSizes =
    {
        "small":"sm",
        "medium":"md",
        "large":"lg"
    }
   
    if(o.icon){
        o.icon = createEl({className:"imgContainer", content:UI.image(o.icon)});
        console.log(o.icon)
       // if(o.iconPos=="left" || o.iconPos=="right"){o.cssText= "width:fit-content"}
        /*
        if(o.size){o.icon = UI.image(o.icon,o.size)}
        else{ o.icon = UI.image(o.icon); o.cssText= "width:fit-content"}
        */
    }
    if(o.text){o.text = createEl({className:"cardContent",content:o.text})}
    
    var _c = UI.createItem(o);
    _c.classList.add("atonCard", cardSizes[o.size]);
    console.log(_c)
    return _c;
}

UI.sideBar=(o)=>
{
    //options: {id, position:[left,right],content}
    const posClass = {"left":"atonSideBar-left", "right":"atonSideBar-right"}
    if(!posClass[o.position]) throw(o.position + " is not a sideBar position");
    let sidebar = createEl(o);
    sidebar.classList.add("atonSideBar", posClass[o.position]);
    return sidebar;
}

UI.toolBar = (o)=> 
{   //options: {id,classList,content,position}
    const posClass = {"top":"atonToolbar-top", "bottom":"atonToolbar-bottom"}
    if(!posClass[o.position])throw(o.position + " is not a toolBar position");

    let toolbar = createEl(o);
    toolbar.classList.add("atonToolbar", posClass[o.position]);
    return toolbar;    
}

UI.topBar = (options)=>
{   
    options.position="top";
    return UI.toolBar(options);
}

UI.bottomBar=(options)=>
{
    options.position="bottom";
    return UI.toolBar(options);
}


UI.drawer=(options)=>{
    if(!options.id) options.id = "drawerID_"+ options.position;
    var d = UI.sideBar(options);
    d.classList.add("atonDrawer");
    if(!options.header){
    d.prepend(
        createEl({
            content:UI.button({content:"X",onclick:()=>UI.closeDrawer(options.id)}),
            cssText:"text-align:right;"
        }))
    }    
    return d;
}


UI.openDrawer=(id)=>{
    var d = document.getElementById(id); if(!d) return;
    d.style.width = "250px";
}
  
UI.closeDrawer=(id)=>{
    var d = document.getElementById(id); if(!d) return;
    d.style.width = "0";
}


//layout:
//container/fluid-container
UI.container=(o={})=>    //https://getbootstrap.com/docs/5.0/layout/containers/ same as .container class
{
 //options:{size:fluid,centered ; id; classList; content }

 let container = createEl(o);
 container.classList.add("atonContainer");
 if(o.size=="fluid") container.classList.add("fluid");
 
 return container;
}

UI.flexBox =(o={})=>{
   
    /*  comments
        dir = "column" or "row" as flex-direction,
        wrap = as flex-wrap,
        justifyContent  = as justify-content;
        alignItems = as align-items; 

        createEL_options
        content
    */
   
    if(!o.cssText) o.cssText = "";
    
    let _dir = o.dir? o.dir : "column";
    let _wrap = o.wrap? o.wrap : "wrap";
    let _justifyContent = o.justifyContent? o.justifyContent : "center";
    let _alignItems = o.alignItems? o.alignItems: "center";

    if(o.dir) o.cssText +=
    `
    flex-direction: ${_dir};
    flex-wrap: ${_wrap};
    justify-content: ${_justifyContent};
    align-items: ${_alignItems}
    `
  

    let flexBox = createEl(o);
    flexBox.classList.add("flexBox");
    return flexBox;
}


UI.listItem = (o={})=>{
    //item has icon?
    const _icon = o.icon? o.icon : null;
    if(_icon) _icon.classList.add("rounded-lg");
    //item has content?
    const _content = o.content? o.content : null;
    //item has links?
    var _links = null;

    if(o.links){
        var idPopover  = "linksPopover_"+o.id
        
        //in small device links will be displayed in a popover menu:
        //Displayed in a proper position according to the quarter of the screen:
        //TO DO: in smartwatch will be different..?
      
        const checkPosTargetInScreen=(r)=>{
            //result:
            var _x; var _y; 

            //Get screenSize:
            const viewportHeight = window.innerHeight;
            const viewportWidth = window.innerWidth;
            const middleY = viewportHeight / 2;
            const middleX = viewportWidth / 2;

            //Get center of rect:
            const x =  r.right - ((r.right - r.left)/2);
            const y = r.bottom - ((r.bottom - r.top)/2);
            console.log("x: " + x, "y: " + y);
                        
            //Check pos:
            _y = y >= middleY? "bottom" : "top";
            _x = x >= middleX? "right" : "left";
            return {_x,_y};
        }
        const setPopoverPos=(pos,r,pop)=>{
          
           var leftMargin = pos._x
           var topMargin = pos._y =="top"? "bottom" : "top";
           var transformX = pos._x == "left"? "0%" : '-100%';
           var transformY = pos._y == "top"? "0%" : '-100%';
           
           var mLeft = Math.trunc(r[leftMargin])+"px";
           var mTop = Math.trunc(r[topMargin])+"px";

           pop.firstChild.style.position = 'absolute';
           pop.firstChild.style.left = mLeft;
           pop.firstChild.style.top = mTop;
           pop.firstChild.style.transform = `translate(${transformX},${transformY})`;
           return pop;
        }
        const openPopOver=(targetBtn)=>{
            let b = targetBtn;
            var popover = UI.popover({
                id:idPopover,
                className:"listItem_popover",
                content: createEl({className:"popover_linksContainer", content:[o.links]}),
              });

            //set current position:
            const rect = b.getBoundingClientRect();
            const p = checkPosTargetInScreen(rect);
            popover = setPopoverPos(p,rect,popover);
            document.body.appendChild(popover)
        }
                
        _links = [
            createEl({className:"listItem_links_container",content:o.links}), //links container
            UI.button({icon:"gallery", className:"max_xs_popoverBtn",
                onClick:function(){openPopOver(this)}
            })
           ]
    }
    console.log(_links);
    

    return createEl({
        id:o.id,
        className: "listItem_container",
        content:[
            createEl({className:"listItem_content_container",content:[_icon, _content]}), //content
             _links
        ],
        events:{"click":o.onClick}
    })    
}


/*
UI.folderPanel=(o)=>
{ 
    const onClickFolder=()=>
    {

    }
    var panel = UI.flexBox({id:o.id});
    //options: data, id
    APP[o.id+"_data"] = o.data;
    document.data =o.data;
    o.data.forEach(element => {
        panel.appendChild(UI.button({text:element.header,icon:ICONS_URL+"folder.jpg"}))
    });
   return  UI.toolBar({position:"bottom",id:"myPanelToolbar",content:panel});
}
*/

/*
TODO NEEDS AND PRIORITY:
ui fast utilities for front-end/3d/dev
ui for editor
ui/logic for editor and configurator (abstract), specific (es. authoring), configurable editor pattern? Swite? templates?

TODO LAYOUT:

-handle text elements
-block1 centered / left / right
-wrapping columns function create side-left, double-side, side-right utilities


TODO INSPECTOR:
num/float
string
vector3
colorpicker
vector4?
gizmos

TODO COMPONentS:
card? create with item?

TO KNOW JQUERY:
returned $(el):
bind, css, addClass, removeClass

returned el:
classList, style

COOL:
Filestructures:     https://codemyui.com/tag/file-structure/

Done:
-or flex or grid... need to implement stretch options? Flex-grow class is OK
-in colums: add flex grow for sides purpose https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_flexible_box_layout/Controlling_ratios_of_flex_items_along_the_main_axis Flex-grow class is OK
-fix classList ... []concatenated
*/

UI.grid=(o)=> //Wrap of css grid (rows/column/areas template usage)
{
    //options: id, classList, gridCols:"", gridRows:"", gridAreas:"", content:[ {area:"", elem:""} ];
    /*options example:
    
    id: "mygrid",
    classList: ["myCustomGridContainer"],
    gridCols: "20% 1fr",  default:auto,
    gridRows: '300px 200px 1fr 20% 3vh' default:auto;
    gridAreas: ' "header header header" "sidebar main main" "footer footer footer" '
    content:[
        {area:'header',elem:btngroupDOmEl},
        {area:'sidebar',elem: sideBtngroupDOmEl},
        {area:'main',elem: mainGroupDOmEl}
        {area:'footer',elem: footerBtngroupDOmEl}
    ]

    */
    var _grid = createEl(o);
    _grid.classList.add("gridContainer");
    
    if(o.gridCols) _grid.style["grid-template-columns"]= o.gridCols;
    if(o.gridRows) _grid.style["grid-template-rows"]= o.gridRows;
    if(o.gridAreas)_grid.style["grid-template-areas"]= o.gridAreas;

    if(!o.content) return _grid;
    
    var _content = [].concat(o.content);
    _content.map((c)=>{ 
        c.elem.style.gridArea = c.area;
        c.elem.classList.add("gridItem");      
        _grid.appendChild(c.elem);
    });
    return _grid;
}

/*API Utilities*/

UI.fetch = async(url)=> {
    try {
      let response = await fetch(url);
      let data = await response.json();
      console.log(data);
      return data;
    } catch (error) {
      console.error(error);
      throw(error);
    }
}

UI.apiPath = 
{
    "wapps": ATON.PATH_RESTAPI+"wapps",
    "models": ATON.PATH_RESTAPI+"c/models",
    "media": ATON.PATH_RESTAPI+"c/media",
    "user": ATON.PATH_RESTAPI+"user",
    "scenes": ATON.PATH_RESTAPI+"scenes",
    "coverScene" : ATON.PATH_RESTAPI+"cover"
}

UI.atonFetch = async (shortPath,param=null)=> { //faster using a UI.apiPath and param optional
    var _p =  UI.apiPath[shortPath];
    if(param) _p += + "/" + param  
    return await(UI.fetch(_p));
} 


UI.fetchModels = async()=>{ return await UI.fetch(UI.apiPath.models)}

UI.showModel= async (path)=> { //test utility to show a single model by path

    ATON.getRootScene().removeChildren(); //reset models in scene
    gizmoManager.detachGizmo(); //ATON.useGizmo(false) //detach current gizmos
    
    var currentNode =  ATON.createSceneNode("sample").load(path,()=>{
        currentNode.attachToRoot().setPosition(0,0,0);
        ATON.Nav.requestPOVbyNode(currentNode, 0.5);
        
        //ATON.useGizmo(true);
        //ATON._gizmo.setMode("translate");           
        //ATON.FE.attachGizmoToNode("sample");
        gizmoManager.attachGizmoToNode("sample");
    });
    return currentNode;
}


/*3D Utilities
================================*/

/*Gizmo*/

UI.attachGizmoByNode=(node,mode="translate")=>{

    gizmoManager.attachGizmoToNode(node,mode); return;
    ATON.useGizmo(false) //detach current gizmos
    ATON.useGizmo(true);

    //ATON._gizmo.addEventListener('dragging-changed',()=>{});

    ATON._gizmo.setMode(mode);           
    ATON._gizmo.attach(node);
}

UI.attachGizmoBynid=(nid,mode="translate")=>{
    gizmoManager.attachGizmoByNID(nid,mode); return;
    ATON.useGizmo(false) //detach current gizmos
    ATON.useGizmo(true);

    //ATON._gizmo.addEventListener('dragging-changed',()=>{});

    ATON._gizmo.setMode(mode);           
    ATON.FE.attachGizmoToNode(nid);
}

UI.detachGizmo=()=>{
    gizmoManager.detachGizmo(); return;
    ATON.useGizmo(false);
}

/*POV 3D icon*/
UI.POV_3Dicon=(pos,target)=>{
  

console.log("position is: ");
console.log(pos);

    const vPOS = new THREE.Vector3(pos[0], pos[1], pos[2]);
    const vTARGET = new THREE.Vector3(target[0], target[1], target[2]);


   // const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const material = ATON.MatHub.materials.xray;
    // Create a new group
    const group = new THREE.Group();

    // Create the posSphere
    const sphereGeometry = new THREE.SphereGeometry(0.2, 32, 32); // Adjust size if necessary
    const sphereMaterial = material // new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const posSphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    posSphere.castShadow = false;
    posSphere.receiveShadow = false; 
    posSphere.position.copy(vPOS);
    group.add(posSphere);

    // Create the line from pos to target
    const lineMaterial = material //new THREE.LineBasicMaterial({ color: 0x0000ff });
    const points = [];
    points.push(vPOS);
    points.push(vTARGET);
    const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(lineGeometry, lineMaterial);
    group.add(line);

    // Create the targetCone
    const coneGeometry = new THREE.ConeGeometry(0.15, 0.8, 32); // Adjust size if necessary
    const coneMaterial = material // new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const targetCone = new THREE.Mesh(coneGeometry, coneMaterial);
    
    // Position the cone at the target position
    targetCone.position.copy(vTARGET);
    targetCone.castShadow = false;
    targetCone.receiveShadow = false; 

    // Calculate the direction vector from pos to target
    const direction = new THREE.Vector3().subVectors(vTARGET, vPOS).normalize();

    // Align the cone to point towards the direction vector
    targetCone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);

    group.add(targetCone);
    group.castShadow = false;
    group.receiveShadow = false; 

    // Return the entire group
    return group;
}

UI.MEASURE_3Dicon=(a,b)=>{

    const material = ATON.MatHub.materials.xray;

    const sphere=(pos)=>{
        const _pos = new THREE.Vector3(pos[0], pos[1], pos[2]);
        const sphereGeometry = new THREE.SphereGeometry(0.1, 32,32); // Adjust size if necessary
        const sphereMaterial = material // new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const posSphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
        posSphere.position.copy(_pos);
        return posSphere;
    }
    const group = new THREE.Group();
    group.add(sphere(a));
    group.add(sphere(b));
    return group;
}

/*Editor UI for 3D: Vector 3*/
UI.vector3 = (o)=>{
    //o.title, o.v(x,y,z), o.onChange
    //ATON.UI IMPLEMENTATION:

    let _o = {step:0.05, vector:o.v};
    let _v = ATON.UI.createVectorControl(_o);
    
    _v.setAttribute("title", o.title);
    _v.id = o.id;
    
    //Add data-property and assign onChange event that actually pass the event (in ATON.UI is missing)
    let _x = _v.children[0];
    let _y = _v.children[1];
    let _z = _v.children[2];
    _x.name="x"; _x.addEventListener("input",o.onChange); _x.setAttribute("data-property", o.property);
    _y.name="y"; _y.addEventListener("input",o.onChange); _y.setAttribute("data-property", o.property);
    _z.name="z"; _z.addEventListener("input",o.onChange); _z.setAttribute("data-property", o.property);
    //Fix style:
    _v.style.gap = "1px";
    //Create label
    let _label = ATON.UI.createElementFromHTMLString(` <label for="${o.id}" class="form-label">${o.title}</label>`);
    let el = UI.createEl({classList:["mb-3"], content:[_label,_v]});
    return el;
    

    //MY OLD IMPLEMENTATION:
   /* 
    let _v = UI.input({id: o.id, legendText:o.title, inputs:[
        {type:"number", step:"0.05", name:"x", value:o.v.x, labelText:"x", events:{"input":o.onChange}, attr:{"data-property": o.property}},
        {type:"number", step:"0.05", name:"y", value:o.v.y, labelText:"y", events:{"input":o.onChange}, attr:{"data-property": o.property}},
        {type:"number", step:"0.05", name:"z", value:o.v.z, labelText:"z", events:{"input":o.onChange}, attr:{"data-property": o.property}}
    ]});
    return _v;
   */
}



//https://aton.ispc.cnr.it/api/
//http://aton.ispc.cnr.it:8081/aldrovandi-collection/models/S2-35-DBC_Basilisco/Basilisco.glb
//http://aton.ispc.cnr.it:8081/samples/models/aton-panel-glass.gltf

/*FileSystem Utilities*/
UI.parseInFolders=(data,onclickEl)=>  //TEMPORARY parsing from ATON API string. 
{
    const convertArrayToObject=(array)=> {
        return array.reduce((acc, path) => {
          const pathArray = path.split('/');
          let currentObj = acc;
          const l= pathArray.length

          for (let i = 0; i < l; i++)
          {
            const folderName = pathArray[i];
      
            //Last object of the path: is not a folder
            if (i === l - 1)
            {
                const fileName = pathArray[i]  //.split('.')[0];
                 const btn = UI.button({text:fileName,attr:{"data-path":path}, onClick: onclickEl})
                currentObj.push(btn);
            }
            else
            {
                // Check if folder already exists in currentObj
                const existingFolder = currentObj.find(obj => obj.header === folderName);
        
                if (existingFolder) {
                currentObj = existingFolder.content;
                } else {
                const newFolder = {
                    header: folderName,
                    content: []
                };
                currentObj.push(newFolder);
                currentObj = newFolder.content;
                }
            }

        }
          return acc;
        }, []);
      }
      
      const paths = data;
      
      const result = convertArrayToObject(paths);
    return result;
}

UI.foldersToTreeGroup=(data,onclickEl)=>{

    var treeOptions = {items:[]};
    var p = UI.parseInFolders(data,onclickEl);
    p.forEach(e => {
        treeOptions.items.push({title:e.header, content:e.content});
    });
    return treeOptions;
}



/**
Create a button (icon and/or text)
- options.variant: the bootstrap variant (primary, info, etc.)
- options.text: the button text
- options.icon: the icon, if simple string will look for centralized icon resources (e.g. "home"), otherwise a provided url to image
- options.onpress: routine to launch on click


*/


//ATON.UI Bootrstrap functions:

/**
 Create a navbar.
-(optional) options.id: id of the nav element
-(optional) options.brand: object with "title" (string or image as main title left-oriented) and "href" for link href
-(optional) options.links: an array of <li class="nav-item">
-(optional) options.form: right-oriented form 

@param {object} options - UI options object
@returns {HTMLElement}
 */
UI.createNavbar=(options)=>{

    const createLinks=(_links)=>{ 

        let linksUl = document.createElement("ul");
        linksUl.classList.add("navbar-nav", "me-auto", "mb-2", "mb-lg-0");
        _links.forEach(_l => linksUl.append(_l));
       return linksUl;
    }

    let el = document.createElement('nav');
    el.classList.add("navbar", "navbar-expand-lg", "bg-body-tertiary", "fixed-top");
    
    if(options.id) el.id = options.id;
    
    let c = document.createElement("div");
    c.classList.add("container-fluid");

    if(options.brand){
        let brand = document.createElement("a");
        brand.classList.add("navbar-brand");

        if(options.brand.href) brand.href = options.brand.href;
        if(options.brand.title) brand.append(options.brand.title);
        c.append(brand);
    }

    c.append(ATON.UI.createElementFromHTMLString( `<button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarSupportedContent" aria-controls="navbarSupportedContent" aria-expanded="false" aria-label="Toggle navigation">
        <span class="navbar-toggler-icon"></span>
      </button>
    `))

   let collapsable = document.createElement("div");
   collapsable.id ="navbarSupportedContent";
   collapsable.classList.add("collapse","navbar-collapse");


    if(options.links){
        collapsable.append(createLinks(options.links));}

    if(options.form) collapsable.append(options.form);
    c.append(collapsable);

    el.append(c);
    return el;
}



window.UI = UI;
export {UI};