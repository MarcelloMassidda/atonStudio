let webdavManager = {
    config: {
      baseURL: "http://localhost:8081/",
      username: "tmp",
      password: "tmp"
    },
  
    setConfig(opts) {
      Object.assign(this.config, opts);
    },
  
    getAuthHeader() {
      return "Basic " + btoa(this.config.username + ":" + this.config.password);
    },
  
    async uploadFile(file, remotePath, callback = () => {}) {
        const fullUrl = this.config.baseURL + remotePath + encodeURIComponent(file.name);
      
        try {
          const res = await fetch(fullUrl, {
            method: "PUT",
            headers: {
              "Authorization": this.getAuthHeader(),
              "Content-Type": file.type || "application/octet-stream"
            },
            body: file
          });
      
          const result = {
            success: res.ok,
            status: res.status,
            statusText: res.statusText,
            url: fullUrl,
            fileName: file.name
          };
      
          if (res.ok) {
            console.log(`✅ Uploaded ${file.name} to ${remotePath}`);
          } else {
            const msg = await res.text();
            console.warn(`❌ Upload failed (${res.status}):`, msg);
            result.error = msg;
          }
      
          callback(result);
      
        } catch (err) {
          console.error("💥 Upload error:", err);
          callback({
            success: false,
            error: err.message,
            url: fullUrl,
            fileName: file.name
          });
        }
      },
      
    // Open a file dialog and upload the selected file to the specified path
    openFileDialog(targetPath = "bastet-collection/media/", callback=() => {}) {
      const input = document.createElement("input");
      input.type = "file";
      input.onchange = () => {
        if (input.files.length > 0) {
          this.uploadFile(input.files[0], targetPath, callback);
        }
      };
      input.click();
    },


    async ensureFolderExists(path) {
        const cleanPath = path.replace(/^\//, ""); // remove leading slash
        const fullUrl = this.config.baseURL + cleanPath;
      
        try {
          // Check if folder exists
          const checkRes = await fetch(fullUrl, {
            method: "PROPFIND",
            headers: {
              "Authorization": this.getAuthHeader(),
              "Depth": "0"
            }
          });
      
          if (checkRes.ok) {
            console.log(`✅ Folder already exists: ${path}`);
            return true;
          }
      
          // Try to create the folder
          const createRes = await fetch(fullUrl, {
            method: "MKCOL",
            headers: {
              "Authorization": this.getAuthHeader()
            }
          });
      
          if (createRes.ok) {
            console.log(`📁 Created folder: ${path}`);
            return true;
          } else {
            const msg = await createRes.text();
            console.warn(`❌ Failed to create folder ${path} (${createRes.status}):`, msg);
            return false;
          }
      
        } catch (err) {
          console.error(`💥 Error checking/creating folder ${path}:`, err);
          return false;
        }
      },

    async ensureFoldersExist(paths = ["/media", "/models", "/pano"]) {
        for (const path of paths) {
          await this.ensureFolderExists(path);
        }
    }
      
      
    
  };
  

  export { webdavManager };
  