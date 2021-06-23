class YaaClass {
  constructor(configuration) {
    this.info = {}; //to do differentiation

    this.configuration = {};
    if (configuration) this.configure(configuration);
    this.files = {};
    this.currentPrompt = {};
    this.request_callbacks = {};
    this.listen_callbacks = {};
    this.socket = {};
    this.socketData = { query: [], room: [] };
    this.socketFunctions = { query: {}, room: {} };
    this.receivingStatus = false;
    this.loginCallback = null;

    this.api = {
      post: (route, body) => {
        return this.query(route, body, "POST");
      },
      get: (route) => {
        return this.query(route, null, "GET");
      },
    };

    //for next.js support
    if (typeof window !== "undefined") {
      if (this.getUrlParam("cookie")) {
        localStorage.setItem("user-cookie", this.getUrlParam("cookie"));
        let urlWithoutCookie =
          window.location.origin + window.location.pathname;
        window.history.pushState({}, null, urlWithoutCookie);
      }

      this.addGoogleAnalytics();
    }

    this.updateServerLink();
  }
  addGoogleAnalytics = () => {
    if (!this.configuration.disableGoogleAnalytics) {
      let anaScript = document.createElement("script");
      anaScript.innerHTML = `
            (function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
              (i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
              m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
              })(window,document,'script','https://www.google-analytics.com/analytics.js','ga');
              
              ga('create', 'UA-166276820-1', 'auto');
              ga('send', 'pageview');
            `;
      document.head.appendChild(anaScript);
    }
  };
  configure = (configuration) => {
    Object.assign(this.configuration, configuration ? configuration : {});
    this.configuration.name = this.configuration.name.toLowerCase();

    if (!this.configuration.name) throw Error("name is required");

    this.updateServerLink();
  };
  collection = (collectionName) => {
    let U = this;
    return new (class {
      constructor() {
        this.collectionName = collectionName;
        this.find = this.find.bind(this);
        this.search = this.search.bind(this);
        this.update = this.update.bind(this);
        this.delete = this.delete.bind(this);
        this.getQuery = this.getQuery.bind(this);
      }

      getQuery(where, put, aditionalQuery) {
        if (!aditionalQuery) aditionalQuery = {};
        return Object.assign(
          { on: this.collectionName, where: where, put: put },
          aditionalQuery
        );
      }

      find(where, aditionalQuery) {
        aditionalQuery.action = "find";
        return U.api.post(
          "query-database",
          this.getQuery(where, null, aditionalQuery)
        );
      }

      search(where, aditionalQuery) {
        aditionalQuery.action = "search";
        return U.api.post(
          "query-database",
          this.getQuery(where, null, aditionalQuery)
        );
      }

      count(where, aditionalQuery) {
        aditionalQuery.action = "count";
        return U.api.post(
          "query-database",
          this.getQuery(where, null, aditionalQuery)
        );
      }

      remove(where, aditionalQuery) {
        aditionalQuery.action = "remove";
        return U.api.post("query-database", this.getQuery(where));
      }

      update(where, put, aditionalQuery) {
        aditionalQuery.action = "update";
        return U.api.post("query-database", this.getQuery(where, put));
      }

      write(put, aditionalQuery) {
        aditionalQuery.action = "write";
        return U.api.post("query-database", this.getQuery(null, put));
      }
    })();
  };

  updateServerLink = () => {
    let setToProduction = () => {
      this.info.host = "backend.yaa.one";
      this.info.port = 80;
    };

    let setToLocal = () => {
      this.info.host = "localhost.com";
      this.info.port = 8080;
    };

    let protocol = "http:";

    this.configuration.local ? setToLocal() : setToProduction();

    if (typeof window !== "undefined") {
      protocol = window.location.protocol;
      if (window.location.host.indexOf("localhost.com:8080") !== -1)
        setToLocal();
    }

    let portString = this.info.port === 80 ? "" : ":" + this.info.port;

    this.info.serverUrl = `${protocol}//${this.info.host + portString}/${
      this.configuration.name
    }`;
  };

  query = async (route, body, requestType) => {
    if (!requestType) requestType = "POST";
    let headerParam = {
      withCredentials: true,
      authorization: this.getUserCookie()
        ? "Bearer " + this.getUserCookie()
        : "",
      "Content-type": "application/json",
    };

    let requestObject = {
      method: requestType,
      headers: headerParam,
    };

    if (body) requestObject.body = JSON.stringify(body);

    let res = await fetch(
      this.info.serverUrl + "/api/v1/" + route,
      requestObject
    );

    let jsonData = await res.json();

    if (jsonData.error) throw Error(jsonData.error);
    return jsonData.data;
  };

  random() {
    return (
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    );
  }

  logout = () => {
    let type = "user";
    localStorage.removeItem(type);
    localStorage.removeItem(type + "-cookie");
    window.location.href =
      this.getAccountLink() + `/logout/?appLink=${window.location.origin}`;
  };
  getAccountLink = () => {
    let host = "localhost.com:3000";

    if (!this.configuration.local) {
      host = "yaa.one";
    }

    return window.location.protocol + "//" + `${host}/account`;
  };

  getLoggedInUser = () => {
    return new Promise((resolve, reject) => {
      let type = "user";
      if (!this.getUserCookie()) return resolve();

      if (localStorage.getItem(type)) {
        let whole = JSON.parse(localStorage.getItem(type));
        return resolve(whole);
      } else {
        this.api
          .get("logged-in-user")
          .then((userData) => {
            if (!userData) return resolve(false);
            localStorage.setItem(type, JSON.stringify(userData));
            return resolve(userData);
          })
          .catch((error) => {
            reject(new Error(error.message));
          });
      }
    });
  };
  fromPhone() {
    let width = window.innerWidth > 0 ? window.innerWidth : window.screen.width;
    if (width < 500) return true;
    return false;
  }
  setMetaTag(findBY, attributeToAssign) {
    let key = Object.keys(findBY)[0];
    let metaTag = document.querySelector(`meta[${key}="${findBY[key]}"]`);
    if (metaTag) {
      for (let key in attributeToAssign) {
        metaTag.setAttribute(key, attributeToAssign[key]);
      }
    } else {
      metaTag = document.createElement("meta");

      let attributes = Object.assign(findBY, attributeToAssign);
      for (let key in attributes) {
        metaTag.setAttribute(key, attributes[key]);
      }

      document.head.appendChild(metaTag);
    }
  }
  getAppUrl = (app) => {
    return `http://${this.info.host}:${this.info.port}/${app}`;
  };

  userUploadedFiles = (path) => {
    return `${this.info.serverUrl}/userUploadedFiles/${path}`;
  };
  login = () => {
    if (this.getUrlParam("cookie"))
      throw Error("Error: Cookie alredy generated ");
    return (window.location.href =
      this.getAccountLink() +
      `/login/?appName=${this.configuration.name}&appLink=${window.location.href}`);
  };
  changeProfilePicture = () => {
    if (!this.getUserCookie()) throw Error("Login required");
    return (window.location.href =
      window.location.protocol +
      "//" +
      this.info.host +
      `account/change-profile-picture/?redirectLink=${window.location.href}`);
  };
  getProfilePicture = (userId) => {
    if (!userId) {
      userId = "user";
    }
    return (
      this.getAppUrl("www") +
      "/profilePicture/" +
      userId +
      ".jpg?disableChache=" +
      this.random()
    );
  };

  getUserCookie() {
    if (typeof window == "undefined") return false;

    let type = "user";
    if (localStorage.getItem(type + "-cookie")) {
      return localStorage.getItem(type + "-cookie");
    }
    return false;
  }
  caps(s) {
    if (typeof s !== "string") return "";
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  getUrlParam(property) {
    let getUrlParam = window.location.search
      .replace("?", "")
      .split("&")
      .map((item) => {
        let part = item.split("=");
        let val = {};
        val[part[0]] = part[1];
        return val;
      });

    let paramObject = {};
    for (let index of getUrlParam) {
      paramObject = Object.assign(paramObject, index);
    }
    return paramObject[property];
  }
  upload = async (file, bucketName, fileToReplace, attribute = {}) => {
    let form = new FormData();

    if (fileToReplace) form.append("fileToReplace", fileToReplace); //for replacing
    form.append("bucket", bucketName);

    for (let key in attribute) {
      form.append(key, attribute[key]);
    }

    //fileToReplace is for declaring the file which needs to be replaced
    //on the server side the file.filename is for finding extension
    //file.filename is set automatically by the browser if we don't overwrite them
    //but when we create blob (in case of hosting upload) it does not happens automatically
    //if fileToReplace is undefined it is automatically extracted from file.filename by multer

    let nameUsedForExtension = file.name ? file.name : fileToReplace;
    form.append("file", file, nameUsedForExtension); //if it was appended before the other appends then req.body will not be processed instantly

    let endPoint = "/upload";
    if (bucketName === "profilePicture") endPoint = "/uploadProfilePicture";
    if (bucketName === "hostingUpload") endPoint = "/hostingUpload";

    let headerParam = {
      authorization: this.getUserCookie()
        ? "Bearer " + this.getUserCookie()
        : "",
    };

    let response = await fetch(this.info.serverUrl + endPoint, {
      method: "POST",
      body: form,
      headers: headerParam,
    });

    let postData = await response.json();
    if (postData.error) throw Error(postData.error);
    return postData.data;
  };
}

let yaaInstance = new YaaClass();

module.exports = { Yaa: yaaInstance, YaaClass: YaaClass };
