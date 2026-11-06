/*
  WebDAV client for the ATON collections (prototyper flare, proto_server.js).

  Same origin as the editor and authenticated by the ATON login session:
  no username/password, no extra port.

  Paths are COLLECTION paths, the same strings scenes use for their items:
    "bastet/models/room.glb", "samples/prototyper/media/x.jpg", "bastet/media/" (folder)
*/

const DAV_ROOT = "/prototyper-dav/";

/** Encode each segment of a collection path for a URL */
const encodePath = (p) => p.split("/").map(encodeURIComponent).join("/");

/** Ensure a trailing slash for folders */
const asFolder = (p) => (p.endsWith("/") ? p : p + "/");

const webdavManager = {
  DAV_ROOT,

  /** DAV URL of a collection path */
  url(path) {
    return window.location.origin + DAV_ROOT + encodePath(path.replace(/^\/+/, ""));
  },

  async request(method, path, { headers = {}, body = null } = {}) {
    return fetch(this.url(path), { method, headers, body, credentials: "same-origin" });
  },

  /**
   * List a folder (one level)
   * @param {string} folder - collection path of a folder, e.g. "bastet/media/"
   * @returns {Promise<Array<{name, path, isDir, size, mime, modified}>>} folders first, then by name
   * @throws Error with .status (401 not logged / not allowed, 404 missing)
   */
  async list(folder) {
    folder = asFolder(folder);
    const res = await this.request("PROPFIND", folder, {
      headers: { Depth: "1", "Content-Type": "application/xml" },
    });
    if (res.status !== 207) {
      const err = new Error(`PROPFIND ${folder}: ${res.status}`);
      err.status = res.status;
      throw err;
    }

    const xml = new DOMParser().parseFromString(await res.text(), "application/xml");
    const NS = "DAV:";
    const prop = (r, name) => r.getElementsByTagNameNS(NS, name)[0]?.textContent || "";

    const items = [];
    for (const r of xml.getElementsByTagNameNS(NS, "response")) {
      let href = decodeURIComponent(prop(r, "href"));
      href = href.replace(/^https?:\/\/[^/]+/, ""); // absolute or relative hrefs
      const i = href.indexOf(DAV_ROOT);
      if (i < 0) continue;
      let path = href.slice(i + DAV_ROOT.length);

      const isDir = r.getElementsByTagNameNS(NS, "collection").length > 0;
      if (isDir) path = asFolder(path);
      if (path === folder) continue; // the folder itself

      const name = path.replace(/\/$/, "").split("/").pop();
      if (name.startsWith(".")) continue; // hidden files

      items.push({
        name,
        path,
        isDir,
        size: parseInt(prop(r, "getcontentlength")) || 0,
        mime: prop(r, "getcontenttype"),
        modified: prop(r, "getlastmodified"),
      });
    }

    items.sort((a, b) => (a.isDir !== b.isDir ? (a.isDir ? -1 : 1) : a.name.localeCompare(b.name)));
    return items;
  },

  /** Create a folder (ok if it already exists) */
  async mkdir(folder) {
    const res = await this.request("MKCOL", asFolder(folder));
    // 201 created, 405 already exists
    return res.status === 201 || res.status === 405;
  },

  /**
   * Upload a file into a folder
   * Content-Type is always octet-stream: ATON's express.json would otherwise
   * consume the body of .json files before WebDAV gets it.
   * @returns {Promise<{success, status, path, fileName}>}
   */
  async upload(file, folder, fileName = file.name) {
    const path = asFolder(folder) + fileName;
    try {
      const res = await this.request("PUT", path, {
        headers: { "Content-Type": "application/octet-stream" },
        body: file,
      });
      if (res.ok) console.log(`✅ Uploaded ${path}`);
      else console.warn(`❌ Upload failed (${res.status}): ${path}`);
      return { success: res.ok, status: res.status, path, fileName };
    } catch (err) {
      console.error("💥 Upload error:", err);
      return { success: false, status: 0, path, fileName, error: err.message };
    }
  },

  /** Create the standard collection folders of a user if missing */
  async ensureUserFolders(username) {
    await this.mkdir(username + "/");
    for (const f of ["media", "models", "pano"]) await this.mkdir(`${username}/${f}/`);
  },
};

export { webdavManager };
