/*
  Media Library: browse the ATON collections through WebDAV (webdav.js),
  upload files, create folders, run actions on files.

  One modal (size xl), configurable by the caller:

    APP.library.open({
      title,            // modal title
      hint,             // footer text while nothing is selected
      start,            // folder to open (collection path), default: the user's collection
      filter,           // "model" | "image" | "video" | "audio" | "pano" | null (all files)
      actions,          // [{ id, label, icon?, primary?, accepts?: type|type[]|fn(item), run(item) }]
      pickOnUpload,     // true: a single uploaded file matching the filter runs the primary action
    })

    APP.library.pick({ title, start, filter, onPick, pickOnUpload })   // "Select" as primary action

  Roots: the user's collection (read + write) and "samples" (read only),
  the same folders as data/collections/ on the server.
  Styles: "Media library" section of atonstudio.css.
*/

import { webdavManager as dav } from "./webdav.js";
import { UI } from "./uitoolkit.js";
import { uikit } from "./uikit.js";

// ============================================================
// #region File types
// ============================================================
const TYPES = {
  model: ["gltf", "glb", "spz", "splat", "ksplat", "sog", "rad", "dzi"],
  image: ["jpg", "jpeg", "png", "webp", "gif", "bmp", "svg"],
  video: ["mp4", "webm", "m3u8"],
  audio: ["wav", "mp3", "ogg"],
  pano: ["hdr", "exr"],
};

const typeOf = (item) => {
  if (item.isDir) return "folder";
  const n = item.name.toLowerCase();
  if (n.endsWith("tileset.json")) return "model";
  const ext = n.split(".").pop();
  for (const [t, exts] of Object.entries(TYPES)) if (exts.includes(ext)) return t;
  return "file";
};

const TYPE_LABEL = { model: "3D models", image: "images", video: "videos", audio: "audio", pano: "panoramas" };

const matches = (item, filter) => {
  if (!filter || item.isDir) return true;
  const t = typeOf(item);
  return Array.isArray(filter) ? filter.includes(t) : t === filter;
};

const accepts = (action, item) => {
  if (!action.accepts) return !item.isDir;
  if (typeof action.accepts === "function") return action.accepts(item);
  return matches(item, action.accepts);
};

const formatSize = (b) => {
  if (!b) return "";
  const u = ["B", "KB", "MB", "GB"];
  let i = 0;
  while (b >= 1024 && i < u.length - 1) { b /= 1024; i++; }
  return `${b.toFixed(i ? 1 : 0)} ${u[i]}`;
};

// Minimal inline icons (currentColor, follow the theme)
const ICONS = {
  folder: '<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4l2 2h9A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z"/>',
  model: '<path d="M12 3 4 7.5v9L12 21l8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
  video: '<rect x="3" y="5" width="13" height="14" rx="2"/><path d="m16 10 5-3v10l-5-3z"/>',
  audio: '<path d="M9 18V6l11-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
  pano: '<path d="M2 7c6 2 14 2 20 0v10c-6-2-14-2-20 0z"/>',
  file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
};
const icon = (name, cls = "mlib-icon") =>
  `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.file}</svg>`;

/** Small DOM helper */
const h = (tag, cls, text) => {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text !== undefined) el.textContent = text;
  return el;
};
// #endregion

// ============================================================
// #region Library
// ============================================================
const mediaLibrary = {
  SHARED_ROOTS: ["samples"],

  /** Logged user name (set by editor.checkUser) */
  user() {
    return window.APP?.db?.data?.user?.username;
  },

  isReadOnly(path) {
    return this.SHARED_ROOTS.includes(path.split("/")[0]);
  },

  /** Open the library with "Select" as the primary action */
  pick({ title = "Select a file", start, filter, onPick, pickOnUpload = false, hint }) {
    this.open({
      title,
      start,
      filter,
      pickOnUpload,
      hint: hint || "Double-click a file, or select it and press Select." + (pickOnUpload ? " A file you upload here is selected right away." : ""),
      actions: [{ id: "select", label: "Select", primary: true, accepts: filter || null, run: (item) => onPick(item) }],
    });
  },

  open(options = {}) {
    const user = this.user();
    if (!user) {
      console.warn("Media library: no logged user");
      return;
    }
    const o = {
      title: "Library",
      start: `${user}/`,
      filter: null,
      actions: [],
      pickOnUpload: false,
      ...options,
    };
    new LibraryView(this, o, user).show();
  },
};

class LibraryView {
  constructor(lib, o, user) {
    this.lib = lib;
    this.o = o;
    this.user = user;
    this.folder = null;
    this.items = [];
    this.selected = null;
    this.showAll = false;
  }

  // ---------- layout ----------
  show() {
    this.el = h("div", "mlib");
    this.side = h("nav", "mlib-side");
    this.side.setAttribute("aria-label", "Collections");
    this.main = h("div", "mlib-main");
    this.el.append(this.side, this.main);

    this.toolbar = h("div", "mlib-toolbar");
    this.crumbs = h("div", "mlib-crumbs");
    this.tools = h("div", "mlib-tools");
    this.toolbar.append(this.crumbs, this.tools);

    this.folderForm = this.buildFolderForm();
    this.grid = h("div", "mlib-grid");
    this.grid.setAttribute("role", "listbox");
    this.status = h("div", "mlib-status");
    this.main.append(this.toolbar, this.folderForm, this.grid, this.status);
    this.setupDrop();

    this.footer = h("div", "mlib-footer");
    this.info = h("div", "mlib-info");
    this.actionsBar = h("div", "mlib-actions");
    this.footer.append(this.info, this.actionsBar);

    this.buildTools();
    this.buildTree();

    UI.showModal({ header: this.o.title, body: this.el, footer: this.footer, size: "xl" });
    this.navigate(this.o.start);
  }

  buildTools() {
    if (this.o.filter) {
      const chip = h("label", "mlib-filter");
      const cb = h("input");
      cb.type = "checkbox";
      cb.onchange = () => { this.showAll = cb.checked; this.render(); };
      chip.append(cb, document.createTextNode(" Show all files"));
      chip.title = `Showing only ${TYPE_LABEL[this.o.filter] || this.o.filter}`;
      this.tools.append(chip);
    }

    this.newFolderBtn = uikit.createButton({ text: "New folder", compact: true, onClick: () => this.toggleFolderForm(true) });
    this.uploadBtn = uikit.createButton({ text: "Upload", icon: "add", compact: true, variant: "primary", onClick: () => this.fileInput.click() });

    this.fileInput = h("input");
    this.fileInput.type = "file";
    this.fileInput.multiple = true;
    this.fileInput.hidden = true;
    if (this.o.filter && TYPES[this.o.filter]) this.fileInput.accept = TYPES[this.o.filter].map((e) => "." + e).join(",");
    this.fileInput.onchange = () => {
      this.upload([...this.fileInput.files]);
      this.fileInput.value = "";
    };

    this.roChip = h("span", "mlib-ro-chip");
    this.roChip.innerHTML = icon("lock", "mlib-icon sm") + "<span>Read only</span>";
    this.roChip.title = "Shared collection: browse and use its files, uploads go to your collection";

    this.tools.append(this.roChip, this.newFolderBtn, this.uploadBtn, this.fileInput);
  }

  buildFolderForm() {
    const form = h("form", "mlib-newfolder");
    form.hidden = true;
    const input = h("input");
    input.type = "text";
    input.placeholder = "Folder name";
    input.required = true;
    input.pattern = "[^/\\\\:*?\"<>|]+";
    input.title = "No / \\ : * ? \" < > |";
    const ok = uikit.createButton({ text: "Create", compact: true, variant: "primary", attr: { type: "submit" } });
    const cancel = uikit.createButton({ text: "Cancel", compact: true, onClick: () => this.toggleFolderForm(false) });
    form.append(input, ok, cancel);
    form.onsubmit = async (e) => {
      e.preventDefault();
      const name = input.value.trim();
      if (!name) return;
      const path = this.folder + name + "/";
      if (await dav.mkdir(path)) {
        this.toggleFolderForm(false);
        await this.refreshTreeNode(this.folder);
        this.navigate(path);
      } else this.setStatus(`Could not create “${name}”.`, "error");
    };
    this.folderInput = input;
    return form;
  }

  toggleFolderForm(show) {
    this.folderForm.hidden = !show;
    if (show) {
      this.folderInput.value = "";
      this.folderInput.focus();
    }
  }

  // ---------- tree ----------
  buildTree() {
    const roots = [
      { label: "My collection", path: `${this.user}/`, readonly: false },
      ...this.lib.SHARED_ROOTS.map((r) => ({ label: r.charAt(0).toUpperCase() + r.slice(1), path: `${r}/`, readonly: true })),
    ];
    this.treeNodes = new Map();
    for (const r of roots) {
      const group = h("div", "mlib-tree-group");
      const title = h("div", "mlib-tree-title");
      title.innerHTML = (r.readonly ? icon("lock", "mlib-icon sm") : "") + `<span></span>`;
      title.querySelector("span").textContent = r.label + (r.readonly ? " · read only" : "");
      group.append(title, this.treeNode({ name: r.label, path: r.path }, 0, true));
      this.side.append(group);
    }
  }

  treeNode(item, depth, isRoot = false) {
    const node = h("div", "mlib-tree-node");
    const row = h("button", "mlib-tree-row");
    row.type = "button";
    row.style.setProperty("--depth", depth);
    row.dataset.path = item.path;
    row.innerHTML = `<span class="mlib-caret">${icon("chevron", "mlib-icon xs")}</span>${icon("folder", "mlib-icon sm")}<span class="mlib-tree-name"></span>`;
    row.querySelector(".mlib-tree-name").textContent = isRoot ? item.path.replace(/\/$/, "") : item.name;
    const children = h("div", "mlib-tree-children");
    children.hidden = true;
    node.append(row, children);

    const entry = { row, children, loaded: false, depth };
    this.treeNodes.set(item.path, entry);

    row.querySelector(".mlib-caret").onclick = (e) => {
      e.stopPropagation();
      this.expand(item.path, children.hidden);
    };
    row.onclick = () => this.navigate(item.path);
    return node;
  }

  async expand(path, open = true) {
    const entry = this.treeNodes.get(path);
    if (!entry) return;
    if (open && !entry.loaded) await this.refreshTreeNode(path);
    entry.children.hidden = !open;
    entry.row.classList.toggle("open", open);
  }

  async refreshTreeNode(path) {
    const entry = this.treeNodes.get(path);
    if (!entry) return;
    let items = [];
    try {
      items = (await this.listWithInit(path)).filter((i) => i.isDir);
    } catch (e) { /* shown by navigate */ }
    entry.children.innerHTML = "";
    for (const it of items) entry.children.append(this.treeNode(it, entry.depth + 1));
    entry.loaded = true;
    entry.row.classList.toggle("empty", items.length === 0);
  }

  /** Expand the tree down to a folder and highlight it */
  async revealInTree(path) {
    const parts = path.replace(/\/$/, "").split("/");
    let acc = "";
    for (let i = 0; i < parts.length; i++) {
      acc += parts[i] + "/";
      await this.expand(acc, true);
    }
    for (const [p, e] of this.treeNodes) e.row.classList.toggle("active", p === path);
    this.treeNodes.get(path)?.row.scrollIntoView({ block: "nearest" });
  }

  // ---------- navigation ----------
  async listWithInit(folder) {
    try {
      return await dav.list(folder);
    } catch (e) {
      // first use: the user's collection folders may not exist yet
      if (e.status === 404 && folder.startsWith(this.user + "/")) {
        await dav.ensureUserFolders(this.user);
        return await dav.list(folder);
      }
      throw e;
    }
  }

  async navigate(folder) {
    if (!folder.endsWith("/")) folder += "/";
    this.folder = folder;
    this.selected = null;
    this.toggleFolderForm(false);
    this.renderCrumbs();
    this.updateTools();
    this.grid.innerHTML = "";
    this.setStatus("Loading…");
    this.revealInTree(folder);
    try {
      this.items = await this.listWithInit(folder);
      if (this.folder !== folder) return; // navigated away meanwhile
      this.render();
    } catch (e) {
      this.items = [];
      this.render();
      this.setStatus(e.status === 401 ? "Not allowed: are you still logged in?" : `Cannot open this folder (${e.status || e.message}).`, "error");
    }
  }

  renderCrumbs() {
    this.crumbs.innerHTML = "";
    const parts = this.folder.replace(/\/$/, "").split("/");
    let acc = "";
    parts.forEach((p, i) => {
      acc += p + "/";
      const target = acc;
      const label = i === 0 ? (p === this.user ? "My collection" : p.charAt(0).toUpperCase() + p.slice(1)) : p;
      if (i < parts.length - 1) {
        const b = h("button", "mlib-crumb", label);
        b.type = "button";
        b.onclick = () => this.navigate(target);
        this.crumbs.append(b, h("span", "mlib-crumb-sep", "/"));
      } else this.crumbs.append(h("span", "mlib-crumb current", label));
    });
  }

  updateTools() {
    const ro = this.lib.isReadOnly(this.folder);
    for (const b of [this.newFolderBtn, this.uploadBtn]) {
      b.disabled = ro;
      b.hidden = ro;
    }
    this.roChip.hidden = !ro;
    this.el.classList.toggle("readonly", ro);
  }

  // ---------- grid ----------
  render() {
    this.grid.innerHTML = "";
    const filter = this.showAll ? null : this.o.filter;
    const visible = this.items.filter((i) => matches(i, filter));
    const hidden = this.items.length - visible.length;

    for (const item of visible) this.grid.append(this.card(item));

    if (!visible.length) this.setStatus(hidden ? `No ${TYPE_LABEL[this.o.filter] || "matching files"} here (${hidden} other file${hidden > 1 ? "s" : ""} hidden).` : "This folder is empty." + (this.lib.isReadOnly(this.folder) ? "" : " Drop files here or use Upload."));
    else this.setStatus(hidden ? `${hidden} other file${hidden > 1 ? "s" : ""} hidden` : "");

    this.renderSelection();
  }

  card(item) {
    const t = typeOf(item);
    const card = h("button", `mlib-card type-${t}`);
    card.type = "button";
    card.setAttribute("role", "option");
    card.dataset.path = item.path;
    card.title = item.name;

    const thumb = h("div", "mlib-thumb");
    if (t === "image") {
      const img = h("img");
      img.loading = "lazy";
      img.alt = "";
      img.src = ATON.Utils.resolveCollectionURL(item.path);
      img.onerror = () => { thumb.innerHTML = icon("image", "mlib-icon lg"); };
      thumb.append(img);
    } else thumb.innerHTML = icon(t === "folder" ? "folder" : t, "mlib-icon lg");

    const name = h("div", "mlib-name", item.name);
    const meta = h("div", "mlib-meta", item.isDir ? "Folder" : [t !== "file" ? t : item.name.split(".").pop().toUpperCase(), formatSize(item.size)].filter(Boolean).join(" · "));
    card.append(thumb, name, meta);

    card.onclick = () => (item.isDir ? this.navigate(item.path) : this.select(item));
    card.ondblclick = () => {
      if (item.isDir) return;
      const primary = this.applicableActions(item).find((a) => a.primary);
      if (primary) this.run(primary, item);
    };
    return card;
  }

  select(item) {
    this.selected = item;
    this.renderSelection();
  }

  applicableActions(item) {
    return this.o.actions.filter((a) => accepts(a, item));
  }

  renderSelection() {
    for (const c of this.grid.children) c.classList.toggle("selected", c.dataset.path === this.selected?.path);
    this.info.innerHTML = "";
    this.actionsBar.innerHTML = "";

    const item = this.selected;
    if (!item) {
      this.info.append(h("span", "mlib-hint", this.o.hint || (this.o.actions.length ? "Select a file to see what you can do with it." : "Browse and upload files.")));
      return;
    }

    this.info.append(h("div", "mlib-info-name", item.name), h("div", "mlib-info-path", item.path));

    const open = uikit.createButton({ text: "Open", compact: true, variant: "secondary", onClick: () => window.open(ATON.Utils.resolveCollectionURL(item.path), "_blank") });
    open.title = "Open the file in a new tab";
    this.actionsBar.append(open);

    const actions = this.applicableActions(item);
    for (const a of actions) {
      const b = uikit.createButton({ text: a.label, icon: a.icon, compact: true, variant: a.primary ? "primary" : "secondary", onClick: () => this.run(a, item) });
      this.actionsBar.append(b);
    }
    if (!actions.length && this.o.actions.length) this.info.append(h("div", "mlib-hint", "No action available for this file type."));
  }

  /**
   * Close the library, THEN run the action. Actions often open another dialog in
   * the same ATON modal: Bootstrap ignores show() while the hide transition is
   * still running, so we wait for "hidden.bs.modal" (with a fallback timeout).
   */
  run(action, item) {
    const modal = ATON.UI.elModal;
    let started = false;
    const go = () => {
      if (started) return;
      started = true;
      action.run(item);
    };
    if (modal?.classList.contains("show")) {
      modal.addEventListener("hidden.bs.modal", go, { once: true });
      setTimeout(go, 1000);
      ATON.UI.hideModal();
    } else go();
  }

  setStatus(text, kind = "") {
    this.status.textContent = text;
    this.status.className = "mlib-status" + (kind ? " " + kind : "");
  }

  // ---------- upload ----------
  setupDrop() {
    const zone = this.main;
    zone.addEventListener("dragover", (e) => {
      if (this.lib.isReadOnly(this.folder) || !e.dataTransfer?.types.includes("Files")) return;
      e.preventDefault();
      zone.classList.add("dragging");
    });
    zone.addEventListener("dragleave", (e) => {
      if (!zone.contains(e.relatedTarget)) zone.classList.remove("dragging");
    });
    zone.addEventListener("drop", (e) => {
      zone.classList.remove("dragging");
      if (this.lib.isReadOnly(this.folder)) return;
      e.preventDefault();
      this.upload([...e.dataTransfer.files]);
    });
  }

  /** Never overwrite: "name.ext" → "name (1).ext" if it already exists */
  uniqueName(name, taken) {
    if (!taken.has(name)) return name;
    const dot = name.lastIndexOf(".");
    const base = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : "";
    let i = 1;
    while (taken.has(`${base} (${i})${ext}`)) i++;
    return `${base} (${i})${ext}`;
  }

  async upload(files) {
    if (!files.length || this.lib.isReadOnly(this.folder)) return;
    const folder = this.folder;
    const taken = new Set(this.items.map((i) => i.name));
    const done = [];
    const failed = [];
    const already = []; // same name + same size already in the folder: not uploaded again

    this.uploadBtn.disabled = true;
    uikit.setLoadingCursor(true);
    for (let i = 0; i < files.length; i++) {
      const same = this.items.find((it) => !it.isDir && it.name === files[i].name && it.size === files[i].size);
      if (same) {
        already.push(same.path);
        continue;
      }
      const name = this.uniqueName(files[i].name, taken);
      taken.add(name);
      this.setStatus(`Uploading ${i + 1}/${files.length}: ${name}…`);
      const r = await dav.upload(files[i], folder, name);
      (r.success ? done : failed).push(r);
    }
    uikit.setLoadingCursor(false);
    this.uploadBtn.disabled = false;

    if (this.folder !== folder) return;
    if (done.length) await this.navigate(folder);

    // uploaded files + files that were already here: select them as if just uploaded
    const uploaded = this.items.filter((it) => done.some((d) => d.path === it.path) || already.includes(it.path));
    const msg = [];
    if (done.length) msg.push(`Uploaded ${done.length} file${done.length > 1 ? "s" : ""}.`);
    if (already.length) msg.push(`Already in this folder, not uploaded again: ${already.map((p) => p.split("/").pop()).join(", ")}.`);
    if (failed.length) this.setStatus(`Upload failed: ${failed.map((f) => f.fileName).join(", ")}`, "error");
    else if (msg.length) this.setStatus(msg.join(" "), "ok");

    if (uploaded.length) {
      this.select(uploaded[uploaded.length - 1]);
      this.grid.querySelector(".selected")?.scrollIntoView({ block: "nearest" });
    }

    // Picker mode: one matching file uploaded → use it right away
    if (this.o.pickOnUpload && uploaded.length === 1 && matches(uploaded[0], this.o.filter)) {
      const primary = this.applicableActions(uploaded[0]).find((a) => a.primary);
      if (primary) this.run(primary, uploaded[0]);
    }
  }
}
// #endregion

export { mediaLibrary, typeOf as libraryTypeOf };
