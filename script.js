(function() {
	var treePromise = null;
	var defaultBaseUrl = "http://prismjs.com/"
	var getConfig = function() {
		try {
			var config = JSON.parse(localStorage["config"]);
			var repo = config.baseUrl.match("https://github.com/([^/]+)/([^/]+)/tree/([^/]+)(?:/|$)");
			if (repo) {
				config.baseUrl = "https://raw.githubusercontent.com/"+repo[1]+"/"+repo[2]+"/"+repo[3]+"/";
			}
			config.isRaw = config.baseUrl.match("githubusercontent");
		} catch(error) {
			var config = {
				first: true,
				baseUrl: defaultBaseUrl,
				languages: {},
				language: undefined,
				plugins: {},
				themes: {}
			};
		}
		config.attr = {
			"line-highlight": {
				"data-line": "1-2,4"
			},
			"line-numbers": {
				"class": "line-numbers"
			},
			"file-highlight": {
				"data-src": config.baseUrl + "index.html",
				"function": function(Prism, pre) {
					if (pre.getAttribute("data-src")) {
						Prism.fileHighlight();
						return true;
					}
					return false;
				}
			},
			"jsonp-highlight": {
				"data-jsonp": "https://status.github.com/api/status.json",
				"function": function(Prism, pre) {
					if (pre.getAttribute("data-jsonp")) {
						Prism.plugins.jsonphighlight.registerAdapter(function (x) { return JSON.stringify(x,null,2); });
						Prism.plugins.jsonphighlight.highlight();
						return true;
					}
					return false;
				}
			}
		};
		config.code = config.code || '<div id="foo"><h3>Some Heading</h3>\n\t<ul>\n\t\t<li>Hello World!</li>\n\t</ul>\n</div>';
		base.value = config.baseUrl;
		[language,code,classes,attributes].forEach(function(input) {
			input.value = config[input.id] || "";
		});
		return config;
	};
	var saveConfig = function() {
		config.first = false;
		config.baseUrl = (base.value || defaultBaseUrl).replace(/\/+$/,"") + "/";
		["languages","plugins","themes"].forEach(function(category){
			$$("input[name='"+category+"']").forEach(function(input){
				config[category][input.value]=input.checked;
			})
		});
		config.language = language.value;
		[language,code,classes,attributes].forEach(function(input) {
			config[input.id] = input.value;
		});
		localStorage["config"] = JSON.stringify(config);
	};

	var config = getConfig();

	var notMeta = function(v) { return v !== "meta"; }
	var iframe, promises = {}, timer = 0;

	var ping = function(func,what,err) {
		return function() {
			trackProgress(0);
			console.log(what, typeof err === "boolean" ? (err ? "failed" : "OK") : (err || "ok"));
			func(what);
		}
	};
	var opt = function(category, id, name) {
		return typeof components[category][id][name] !== "undefined"
			? components[category][id][name]
			: components[category].meta[name];
	};
	var loadLanguage = function(lang) {
		if (!promises[lang]) {
			promises[lang] = Promise.all(components.languages[lang].require.map(loadLanguage)).then(function() {
				var files = getFiles('languages', lang);
				files.css.map(loadAsset);
				return Promise.all(files.js.map(loadAsset));
			});
		}
		return promises[lang];
	};
	var getRawContent = function(src) {
		console.log("getRawContent",src);
		return new Promise(function(resolve, reject) {
			$u.xhr({
				url: config.baseUrl + src,
				callback: function(xhr) {
					if (xhr.status < 400 && xhr.responseText) {
						resolve(xhr.responseText);
					} else {
						reject(src);
					}
				}
			});
		});
	};

	var todo = 0, done = 0, delay = 0;
	var trackProgress = function(newFile) {
		newFile ? todo++ : done++;

		clearTimeout(delay);
		delay = 0;
		if (todo === done) {
			delay = setTimeout(function() {
				if (todo === done) {
					progress.value = todo = done = delay = 0;
					progress.style.display = "none";
				}
			}, 10);
		}
		else
		{
			progress.value = Math.floor(done / todo * 100);
			progress.style.display = "";
		}
	};

	var loadAsset = function(src, doc) {
		src = config.baseUrl + src;
		// oh the hacks! Array.map(loadAsset) means doc will be an index, so just ignore
		doc = (typeof doc === "number" ? 0 : doc) || iframe.contentDocument || document;
		var xtn = (src.toLowerCase().match(/\.(css|js)$/)||[,''])[1];
		if (!xtn) return Promise.reject(src);

		trackProgress(1);
		if (config.isRaw) {
			return getRawContent(src).then(function(result) {
				if (xtn === "js") {
					$u.element.create("script",{inside:doc.head,contents:result});
				}
				else if (xtn === "css") {
					$u.element.create("style",{inside:doc.head,contents:result});
				}
				trackProgress(0);
				return Promise.resolve(src);
			});
		}
		else {
			return new Promise(function(resolve,reject) {
				if (xtn === "js") {
					var script = doc.createElement("script");
					script.src = src;
					script.onload = ping(resolve,src);
					script.onerror = ping(reject,src,true);
					doc.head.appendChild(script);
				}
				else if (xtn === "css") {
					var css = doc.createElement("link");
					css.rel = "stylesheet";
					css.href = src;
					doc.head.appendChild(css);
					ping(resolve,src)();
				}
				else {
					ping(reject,src)();
				}
			});
		}
	};

	var getFiles = function(category, id) {
		var files = { js: [], css: [] };
		var template = opt(category, id, "path").replace(/\{id}/g, id);

		var m = template.match(/\.(css|js)$/);
		if (m) {
			files[m[1]].push(template);
		}
		else {
			if (!opt(category, id, "noJS")) {
				files.js.push(template.replace(/(\.js)?$/, ".js"));
			}
			if (!opt(category, id, "noCSS")) {
				files.css.push(template.replace(/(\.css)?$/, ".css"));
			}
			if (opt(category, id, "themedCSS")) {
				files.css.push(template.replace(/(\.css)?$/, "-" + config.theme + ".css"));
			}
		}
		return files;
	};

	var generateFileList = function() {
		promises = {};
		var themeName = ($("input[name='themes']:checked") || $("input[name='themes']")).value;
		config.theme = themeName.replace(/^prism-?/, "") || "default";
		
		while(language.firstChild)
			language.firstChild.remove();

		if (iframe != null) {
			iframe.remove();
		}
		if (timer) {
			clearTimeout(timer);
		}

		iframe = $u.element.create("iframe",{inside:output,className:"wide"});

		timer = setTimeout(function() {
			// general theme CSS must be loaded before any plugin CSS
			getFiles("themes", themeName).css.map(loadAsset);

			loadAsset("components/prism-core.js").then(function() {
				return Promise.all($$("input[name='languages']:checked").reduce(function(p, input){
					$u.element.create("option",{
						inside:language,
						contents:components.languages[input.value].title,
						prop:{
							value:input.value,
							selected: input.value === config.language
						}});
					p.push(loadLanguage(input.value));
					return p;
				}, []));
			}).then(function() {
				return Promise.all($$("input[name='plugins']:checked").reduce(function(p, input){
					var files = getFiles(input.name, input.value);
					files.css.map(loadAsset)
					return p.concat(files.js.map(loadAsset));
				}, []));
			}).then(prepareCode)
		}, 10);
	}

	var addClass = function(name) {
		var _classes = getClasses();
		_classes[name] = true;
		saveClasses(_classes);
	};
	var removeClass = function(name) {
		var _classes = getClasses();
		delete _classes[name];
		saveClasses(_classes);
	};
	var getClasses = function() {
		return classes.value.split(" ").reduce(function(o,v) { if (v.length) o[v] = true; return o; }, {});
	};
	var saveClasses = function(_classes) {
		classes.value = Object.keys(_classes).join(" ");;
	};

	var addAttr = function(name,value) {
		var _attr = getAttrs();
		_attr[name] = _attr[name] || [name, "'", value];
		setAttrs(_attr);
	};
	var removeAttr = function(name) {
		var _attr = getAttrs();
		delete _attr[name];
		setAttrs(_attr);
	};
	var getAttrs = function() {
		var _attributes = {}, m, re = /(data-[\w-]+)=(['"])(.*?)\2/g
		while (m=re.exec(attributes.value))
			_attributes[m[1]] = m.slice(1);
		return _attributes;
	}
	var setAttrs = function(attr) {
		attributes.value = Object.keys(attr).map(function(k) {
			var x = attr[k];
			return k + "=" + x[1] + x[2] + x[1];
		}).join(" ");
	};

	var prepareCode = function() {
		var body = $("body", iframe.contentDocument);

		if (!body.firstChild) {
			$u.element.create("code", {
				inside: $u.element.create("pre", {
					inside: $u.element.create("div",{inside:body})
				})
			});
		}

		pre = $("pre", iframe.contentDocument);
		pre.className = "language-" + language.value;

		$("code", iframe.contentDocument).className = "";

		var _classes = getClasses();
		classes.value = Object.keys(_classes).map(function(v) {
			pre.classList.add(v);
			return v;
		}).join(" ");

		for(var a=pre.attributes,i=a.length-1; i>=0;i--)
			if (a[i].name.indexOf("data-") === 0)
				pre.removeAttribute(a[i].name)

		var _attr = getAttrs();
		Object.keys(_attr).forEach(function(k) {
			pre.setAttribute(k, _attr[k][2]);
		});

		var functions = $$("input[name='plugins']:checked").reduce(function(o, input) {
			var fn = (config.attr[input.value] || {}).function;
			if (fn) o.push(fn);
			return o;
		}, []);

		updateCode(function() {
			var renderByFunction = functions.reduce(function(done, fn) {
				return done || fn(iframe.contentWindow.Prism, pre);
			}, false);
			code.style.display = renderByFunction ? "none" : "";	
		});
	};

	var updateCode = function(cb) {
		$("code", iframe.contentDocument).textContent = code.value;
		saveConfig();
		iframe.contentWindow.Prism.highlightAll(false, cb);
	}

	var createListItem = function(list, def, category, id, type) {
		var item = $u.element.create("li", {inside:list});
		var title = typeof def[id] === "string" ? def[id] : (def[id].title || id);
		var label = $u.element.create("label",{
			inside:item
		});
		$u.element.create("input",{
			prop: {
				type: type,
				name: category,
				value: id,
				checked: config[category][id]
			},
			inside:label
		});
		$u.element.create({contents:title,inside:label})
	};

	var updatePlugin = function(input) {
		var attr = config.attr[input.value] || {};
		Object.keys(attr).forEach(function(k) {
			if (k === "class") {
				(input.checked ? addClass : removeClass)(attr[k]);
			}
			else if (k !== "function") {
				(input.checked ? addAttr : removeAttr)(k, attr[k]);
			}
		})
	};

	var checkDeps = function(lang, enabled) {
		config.languages[lang] = enabled;
		var deps = enabled
			? components.languages[lang].require
			: components.languages[lang].children;
		deps.forEach(function(dep) {
			var input = $("input[name='languages'][value='"+dep+"']");
			if (input.checked != enabled) {
				input.checked = enabled;
				checkDeps(dep, enabled);
			}
		})
	};

	loadAsset("components.js", document).then(function() {
		Object.keys(components.languages).filter(notMeta).forEach(function(lang) {
			components.languages[lang].children = components.languages[lang].children || [];
			components.languages[lang].require = [].concat(components.languages[lang].require || []);
		});
		Object.keys(components.languages).filter(notMeta).forEach(function(lang) {
			components.languages[lang].require.forEach(function(parent) {
				components.languages[parent].children.push(lang);
			})
		});
		
		["languages", "plugins", "themes"].forEach(function(category){
			var list = $u.element.create("ul",{inside:configuration});
			Object.keys(components[category]).filter(notMeta).forEach(function(id) {
				if (config.first) {
					config[category][id] = components[category][id].option === "default";
				}
				createListItem(list, components[category], category, id, components[category].meta.exclusive ? "radio" : "checkbox");
			});
		});
		$$("input[name='plugins']:checked").forEach(updatePlugin);

		generateFileList();

		configuration.addEventListener("change", function(e) {
			var target = e.target;
			if (target.name === "languages") {
				checkDeps(target.value, target.checked);
			}
			else if (target.name === "plugins") {
				updatePlugin(target);
			}
			config[target.name][target.value] = target.checked;
			generateFileList();
		});

		[language,classes,attributes].forEach(function(v) {
			v.addEventListener("change", prepareCode);
		});
		code.addEventListener("input", function() { updateCode() });
	}).catch(function(what) {
		alert("Something went wrong loading " + (what || "... something :("));
		if (typeof what === "string" && what.match("components")) {
			base.value = defaultBaseUrl;
			saveConfig();
			location.reload();
		}
	});

	// always make this available
	base.addEventListener("change", function() {
		saveConfig();
		location.reload();
	})
})();
