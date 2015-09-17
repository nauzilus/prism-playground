prism-playground
================

[Prism Playground] allows you to live test custom builds of the [Prism] highlighter.

It works similar to the Prism [test page], however Playground allows you to:

* include multiple languages
* include any number of plugins
* modify classes/data attributes
* most importantly: change the base repo to test unmerged or custom builds.

## Usage

The UI sucks. I know that. Here's what each input/option is for:

### Base URL

The field at the top-left is a URL which contains a build of Prism used to configure the rest of the page.

It can either be a site hosting a build of Prism (e.g. http://prismjs.com) or a GitHub repo (e.g. https://github.com/Golmote/prism/tree/prism-keep-markup).

### Build options

The languages, plugins and themes section should be self explanatory. Whatever you check will be bundled up and used to highlight the code.

### Language selector

As you can choose to bundle multiple languages, you need to inform which is the actual language with which to highlight your code. For example, you have have chosen to bundle Markup, JavaScript and CSS (quite common), but you want to highlight your code as Markup (which then may also include CSS and JavaScript, and be highlighted appropriately).

### Code Input

Just like Prism, whatever you enter here will be highlighted

### Treat code as Markup

Unchecked, the code input will be injected as text. This means any HTML tags will be encoded (e.g. `<h1>` becomes `&lt;h1&gt;`). This is probably what you want.

Checking this option however will inject code as actual HTML, which Prism will probably then strip out before highlighting.

### Classes and Attributes

Classes and attributes will be applied to the code element before highlighting, which are required for some plugins to function. When selecting a plugin that uses classes and/or attributes, some default example values will be populated automatically.

### Output

Finally, the rendered and highlighted code. What you came to see!

## Final Word

This is a bit hacky and flakey, but it serves my purposes. Hopefully it helps someone out there also :)

[Prism Playground]: http://nauzilus.github.io/prism-playground/
[Prism]: http://prismjs.com/
[test page]: http://prismjs.com/test.html
