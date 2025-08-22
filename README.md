# Website Translator Plugin (Right-Docked)

A compact, right-docked translator plugin prototype with a 4-step workflow:

1. Inspect Elements
2. Choose Language & Translate
3. Preview & Edit
4. Download Translations

## Run the demo

Open `index.html` in a browser (no build step required). The dock renders on the right and a sample page provides content to extract.

## Inject into any page

Paste in DevTools console:

```js
var s=document.createElement('link');s.rel='stylesheet';s.href='https://your-host/src/translator-plugin.css';document.head.appendChild(s);
var j=document.createElement('script');j.src='https://your-host/src/translator-plugin.js';document.body.appendChild(j);
```

Then run:

```js
window.WebTranslator.mount();
```

## Notes

- Translation is mocked (appends the language code). Replace `mockTranslate` with a real API call.
- Exports produce JSON/CSV/XLSX/TXT. XLSX is a CSV-flavored export for now.
