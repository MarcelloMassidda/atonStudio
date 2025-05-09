let webdavManager = {
   
   config: {
      sizeLimit: 5 * 1000000, //x MB
      mediaFormats: ["image/jpeg", "image/png"],
      baseURL: "", 
      username: "",
      password: ""
    },
  
    setConfig(opts) {
      Object.assign(this.config, opts);
    },
  

    getAuthHeader() {

      let _username, _password;
      _username = this.config.username? this.config.username : window.prompt("Insert username:", "");
      _password = this.config.password? this.config.password : window.prompt("Insert password:", "");

      console.log("going with", _username, _password);
      
      this.config.username = _username;
      this.config.password = _password;

      return "Basic " + btoa(_username + ":" + _password);
     // return "Basic " + btoa(this.config.username + ":" + this.config.password);
    },
    
    /*
    getAuthHeader() {
      return "Basic " + btoa(this.config.username + ":" + this.config.password);
    },*/
  
    async uploadFile(file, remotePath, callback = () => {}) { 
        const fullUrl = this.config.baseURL + remotePath + encodeURIComponent(file.name);
        
      

        try {

          await webdavManager.ensureFoldersExist();

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
    openFileDialog(targetPath = config.username +"-collection/media/", callback=() => {}) {
      const input = document.createElement("input");
      input.type = "file";
      input.onchange = () => {
        
        if (input.files.length > 0) {

          console.log(input.files[0]);
          
          // Check file type and size
          if(!this.config.mediaFormats.includes(input.files[0].type)) {
            alert("File format not supported. Supported formats: " + this.config.mediaFormats.join(", "));
            return;
          }
          if(input.files[0].size > this.config.sizeLimit) {
            alert("File size too large. Max size: " + this.config.sizeLimit/1000000 + "MB");
            return;
          }

          // Upload the file
          window.APP.uikit.setLoadingCursor(true);
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
          await this.ensureFolderExists( webdavManager.config.username+"-collection"+path);
        }
    }
      
      
    
  };
  

  export { webdavManager };
  