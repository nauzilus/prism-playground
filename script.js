(function() {
	var defaultBaseUrl = "http://prismjs.com/"
	var getConfig = function() {
		try {
			var config = JSON.parse(localStorage["config"]);
		} catch(error) {
			var config = {
				first: true,
				baseUrl: defaultBaseUrl,
				languages: {},
				language: undefined,
				plugins: {},
				themes: {},
				code: '<div id="foo"><h3>Some Heading</h3>\n\t<ul>\n\t\t<li>Hello World!</li>\n\t</ul>\n</div>',
				attr: {
					"line-highlight": {
						"data-line": "1-2,4"
					},
					"line-numbers": {
						"class": "line-numbers"
					}
				}
			};
		}
		base.value = config.baseUrl;
		code.value = config.code;
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
		config.language = langselect.value;
		config.code = code.value;
		localStorage["config"] = JSON.stringify(config);
	};

	var config = getConfig();

	var notMeta = function(v) { return v !== "meta"; }
	var iframe, promises = {}, timer = 0;

	var ping = function(func,what,err) {
		return function() {
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
				files.css.map(loadCss);
				return Promise.all(files.js.map(loadScript));
			});
		}
		return promises[lang];
	};
	var loadScript = function(src, doc) {
		return new Promise(function(resolve,reject) {
			var script = document.createElement("script");
			script.src = src;
			script.onload = ping(resolve,src);
			script.onerror = ping(reject,src,true);
			(doc || iframe.contentDocument).head.appendChild(script);
		});
	}
	var loadCss = function(path) {
		var css = iframe.contentDocument.createElement("link");
		css.rel = "stylesheet";
		css.href = path;
		iframe.contentDocument.head.appendChild(css);
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
		var themeName = $("input[name='themes']:checked").value;
		config.theme = themeName.replace(/^prism-?/, "") || "default";
		
		var langwas = langselect.value || localStorage["language"];
		while(langselect.options.length)
			langselect.options[0].remove();

		if (iframe != null) {
			iframe.remove();
		}
		if (timer) {
			clearTimeout(timer);
		}

		iframe = $u.element.create("iframe",{inside:output,className:"wide"});

		timer = setTimeout(function() {
			$u.element.create("base",{
				inside:iframe.contentDocument.head,
				prop:{href:config.baseUrl}
			});

			// general theme CSS must be loaded before any plugin CSS
			getFiles("themes", themeName).css.map(loadCss);

			loadScript("components/prism-core.js", iframe.contentDocument).then(function() {
				return Promise.all($$("input[name='languages']:checked").reduce(function(p, input){
					$u.element.create("option",{
						inside:langselect,
						contents:input.value,
						prop:{
							value:input.value,
							selected: input.value === langwas
						}});
					p.push(loadLanguage(input.value));
					return p;
				}, []));
			}).then(function() {
				return Promise.all($$("input[name='plugins']:checked").reduce(function(p, input){
					var files = getFiles(input.name, input.value);
					files.css.map(loadCss)
					return p.concat(files.js.map(loadScript));
				}, []));
			}).then(updateCode)
		}, 10);
	}

	var updateCode = function() {

		var body = $("body", iframe.contentDocument);
		while (body.childNodes.length)
			body.childNodes[0].remove();

		var container = $u.element.create("div",{inside:body});
		var pre = $u.element.create("pre", {
			inside: container,
			className: "language-" + langselect.value
		});
		
		$u.element.create("code", { inside: pre, contents: code.value });

		$$("input[name='plugins']:checked")
			.map(function(v) { return config.attr[v.value] || {} })
			.forEach(function(attr) {
				Object.keys(attr).forEach(function(k) {
					if (k === "class") {
						pre.classList.add(attr.class)
					}
					else {
						pre.setAttribute(k, attr[k]);
					}
				})
			});
		saveConfig();

		iframe.contentWindow.Prism.highlightAll();
	}

	var createListItem = function(list, def, category, id, type) {
		var item = $u.element.create("li", {inside:list});
		var title = typeof def[id] === "string" ? def[id] : (def[id].title || id);
		var label = $u.element.create("label",{
			inside:item
		});
		var cb = $u.element.create("input",{
			prop: {
				type: type,
				name: category,
				value: id,
				checked: config[category][id]
			},
			inside:label
		});
		$u.element.create({contents:title,inside:label})
		return item;
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

	loadScript(config.baseUrl + "components.js", document).then(function() {
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

		generateFileList();

		configuration.addEventListener("change", function(e) {
			var target = e.target;
			if (target.name === "languages") {
				checkDeps(target.value, target.checked);
			}
			config[target.name][target.value] = target.checked;
			generateFileList();
		});

		langselect.addEventListener("change", function() {
			localStorage["language"] = langselect.value;
			var code = $("code", iframe.contentDocument);
			var pre = $("pre", iframe.contentDocument);
			[code,pre].forEach(function(v) {
				v.className = v.className.replace(/\blang(uage)-\w+\b/g, "")
			});
			code.classList.add("language-"+langselect.value);
			iframe.contentWindow.Prism.highlightAll();
		})

		input.addEventListener("input", updateCode);
	}).catch(function(what) {
		alert("Something went wrong loading " + (what || "... something :("));
		if (what && what.match("components")) {
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