(function() {
	var defaultBaseUrl = "http://prismjs.com/", iframe = null, timer_iframe = 0, timer_building = 0;;

	var getConfig = function() {
		try {
			var repo, config = JSON.parse(localStorage["config"]);
			if (repo = config.baseUrl.match("https://github.com/([^/]+)/([^/]+)/tree/([^/]+)(?:/|$)")) {
				config.baseUrl = "https://raw.githubusercontent.com/"+repo[1]+"/"+repo[2]+"/"+repo[3]+"/";
			}
			else if (repo = config.baseUrl.match("^([\\w\-]+):(?:([\\w\-]+):)?([\\w\-]+)/?$")) {
				config.baseUrl = "https://raw.githubusercontent.com/"+repo[1]+"/"+(repo[2] || "prism") +"/"+repo[3]+"/";
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
				"render": function(Prism, pre) {
					if (pre.getAttribute("data-src")) {
						Prism.fileHighlight();
						return true;
					}
					return false;
				}
			},
			"jsonp-highlight": {
				"data-jsonp": "https://status.github.com/api/status.json",
				"render": function(Prism, pre) {
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
		codeishtml.checked = !!config.codeishtml;
		return config;
	};

	var saveConfig = function() {
		config.baseUrl = (base.value || defaultBaseUrl).replace(/\/+$/,"") + "/";
		["languages","plugins","themes"].forEach(function(category){
			Array.prototype.slice.call(document.querySelectorAll("input[name='"+category+"']")).forEach(function(input){
				config[category][input.value]=input.checked;
			})
		});
		config.language = language.value;
		[language,code,classes,attributes].forEach(function(input) {
			config[input.id] = input.value;
		});
		config.codeishtml = codeishtml.checked;
		localStorage["config"] = JSON.stringify(config);
	};

	var notMeta = function(v) { return v !== "meta"; }

	var onAssetDone = function(resolveOrReject,src,error) {
		return function() {
			trackProgress(0);
			console.log(src, typeof error === "boolean" ? (error ? "failed" : "OK") : (error || "ok"));
			resolveOrReject(src);
		}
	};

	var opt = function(category, id, name) {
		return typeof components[category][id][name] !== "undefined"
			? components[category][id][name]
			: components[category].meta[name];
	};

	var getRawContent = function(src) {
		console.log("getRawContent",src);
		return new Promise(function(resolve, reject) {
			$u.xhr({
				url: src,
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
			progress.value = Math.floor(todo ? done / todo * 100 : 0);
			progress.style.display = "";
		}
	};

	var selectedTheme = function() {
		return $("input[name='themes']:checked") || $("input[name='themes']");
	};
	var selectedLanguages = function() {
		return $$("input[name='languages']:checked");
	};
	var selectedPlugins = function() {
		return $$("input[name='plugins']:checked");
	};

	var loadComponents = function() {
		var promises = {};
		var loader = function(input) {
			return loadComponent(promises, input.name, input.value);
		};
		
		return Promise.all([]
			.concat(selectedTheme())
			.concat(selectedLanguages())
			.concat(selectedPlugins())
			.map(loader)
		).catch(function(error) {
			console.log("failed", error)
		});
	};
	var loadComponent = function(cache, category, id) {
		var key = category + "-" + id;
		if (!cache[key]) {
			var parents = components[category][id].require.reduce(function(sequence,id) {
				return sequence.concat(loadComponent(cache, category, id));
			}, [Promise.resolve()]);
			cache[key] = Promise.all(parents).then(function() {
				return Promise.all(getFiles(category, id).map(loadAsset));
			});
		}

		return cache[key];
	};

	var loadAsset = function(src) {
		src = config.baseUrl + src;
		// hack. first time this is called is for components so iframe isn't defined yet. once we start doing Prism builds, iframe will exist
		doc = iframe ? iframe.contentDocument : document;
		
		var xtn = (src.toLowerCase().match(/\.(css|js)$/)||[,''])[1];

		trackProgress(1);
		if (xtn && config.isRaw) {
			return getRawContent(src).then(function(result) {
				return new Promise(function(resolve,reject) {
					$u.element.create(
						xtn === "js" ? "script" : "style", {
						inside: doc.head,
						contents: result
					});
					onAssetDone(resolve,src)();
				});
			});
		}
		else if (xtn === "js") {
			return new Promise(function(resolve, reject) {
				var script = doc.createElement("script");
				script.src = src;
				script.onload = onAssetDone(resolve,src);
				script.onerror = onAssetDone(reject,src,true);
				doc.head.appendChild(script);
			});
		}
		else if (xtn === "css") {
			return new Promise(function(resolve,reject) {
				var css = doc.createElement("link");
				css.rel = "stylesheet";
				css.href = src;
				doc.head.appendChild(css);
				onAssetDone(resolve,src)();
			});
		}

		return Promise.reject(src);
	};

	var getFiles = function(category, id) {
		var template = opt(category, id, "path").replace(/\{id}/g, id);

		var files = [];
		var m = template.match(/\.(css|js)$/);
		if (m) {
			files.push(template);
		}
		else {
			if (!opt(category, id, "noJS")) {
				files.push(template.replace(/(\.js)?$/, ".js"));
			}
			if (!opt(category, id, "noCSS")) {
				files.push(template.replace(/(\.css)?$/, ".css"));
			}
			if (opt(category, id, "themedCSS")) {
				files.push(template.replace(/(\.css)?$/, "-" + config.theme + ".css"));
			}
		}

		return files;
	};

	var doBuild = function() {
		if (timer_building) {
			clearTimeout(timer_building);
		}
		timer_building = setTimeout(function() {
			timer_building = 0;
			doBuildImmediate();
		}, 500);
	}
	var doBuildImmediate = function() {
		var themeName = selectedTheme().value;
		config.theme = themeName.replace(/^prism-?/, "") || "default";
	
		while(language.firstChild)
			language.firstChild.remove();

		selectedLanguages().forEach(function(input) {
			$u.element.create("option",{
				inside: language,
				contents: components.languages[input.value].title,
				prop: {
					value: input.value,
					selected: input.value === config.language
				}
			});
		})

		if (iframe != null) {
			iframe.remove();
		}
		if (timer_iframe) {
			clearTimeout(timer_iframe);
		}

		iframe = $u.element.create("iframe",{inside:output,className:"wide"});

		timer_iframe = setTimeout(function() {
			loadAsset("components/prism-core.js").then(function() {
				return loadComponents();
			}).then(prepareCode);
		}, 100);
	};

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
	};
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

		var functions = selectedPlugins().reduce(function(o, input) {
			var fn = (config.attr[input.value] || {}).render;
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
		var _code = $("code", iframe.contentDocument);
		if (codeishtml.checked) {
			_code.innerHTML = code.value;
		}
		else {
			_code.textContent = code.value;
		}
		saveConfig();
		iframe.contentWindow.Prism.highlightAll(false, typeof cb === "function" ? cb :null);
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
			else if (k !== "render") {
				(input.checked ? addAttr : removeAttr)(k, attr[k]);
			}
		})
	};

	var checkDeps = function(input) {
		var category = input.name, id = input.value, enabled = input.checked;

		config[category][id] = enabled;

		var deps = components[category][id][enabled ? "require" : "children"];
		deps.forEach(function(depName) {
			var dependant = $("input[name='"+category+"'][value='" + depName + "']");
			
			if (dependant.checked != enabled) {
				dependant.checked = enabled;
				
				checkDeps(dependant);
			}
		})
	};

	var config = getConfig();

	loadAsset("components.js").then(function() {
		["languages","plugins","themes"].forEach(function(category) {
			Object.keys(components[category]).filter(notMeta).forEach(function(id) {
				if (typeof components[category][id] === "string") {
					components[category][id] = { title: components[category][id] };
				}
				components[category][id].children = components[category][id].children || [];
				components[category][id].require = [].concat(components[category][id].require || []);
			});
			Object.keys(components[category]).filter(notMeta).forEach(function(id) {
				components[category][id].require.forEach(function(parent) {
					components[category][parent].children.push(id);
				})
			});

			var list = $u.element.create("ul",{inside:configuration});
			Object.keys(components[category]).filter(notMeta).forEach(function(id) {
				if (config.first) {
					config[category][id] = components[category][id].option === "default";
				}
				createListItem(list, components[category], category, id, components[category].meta.exclusive ? "radio" : "checkbox");
			});
		});

		selectedPlugins().forEach(updatePlugin);

		config.first = false;

		doBuildImmediate();

		configuration.addEventListener("change", function(e) {
			var target = e.target;
			
			if (["languages","plugins"].indexOf(target.name) >= 0) {
				checkDeps(target);
			}
			if (target.name === "plugins") {
				updatePlugin(target);
			}

			config[target.name][target.value] = target.checked;
			target.name === "themes" ? doBuildImmediate() : doBuild();
		});

		[language,classes,attributes,codeishtml].forEach(function(input) {
			input.addEventListener("change", prepareCode);
		});

		code.addEventListener("input", updateCode);

	}).catch(function(what) {
		alert("Something went wrong loading " + (what || "... something :("));
		console.error(what);
	});

	// always make this available
	base.addEventListener("change", function() {
		saveConfig();
		location.reload();
	})
})();