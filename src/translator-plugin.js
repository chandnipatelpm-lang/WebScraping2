(function(){
	const ACCENT = '#6C47FF';
	const VERSION = '0.1.0';

	function html(strings, ...vals){
		return strings.reduce((acc, s, i)=> acc + s + (vals[i] ?? ''), '');
	}

	const state = {
		activeStep: 1,
		activeLanguage: null,
		viewMode: 'original', // original | translated
		isPicking: false,
		selectAllActive: false,
		strings: [], // {id, selector, sourceText, type, url, context, translatedText, status}
		stringIdCounter: 1,
		inlineEditors: new Map(),
		originalSnapshots: new Map(), // selector -> original text
	};

	function uid(){ return String(Date.now()) + '_' + (state.stringIdCounter++); }

	function normalizeText(t){
		return (t||'').replace(/\s+/g,' ').trim();
	}

	function isVisible(el){
		if(!el) return false;
		const style = getComputedStyle(el);
		if(style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
		if(el.offsetWidth === 0 && el.offsetHeight === 0) return false;
		let node = el;
		while(node){
			if(node.getAttribute && (node.getAttribute('aria-hidden') === 'true' || node.hidden)) return false;
			node = node.parentElement;
		}
		return true;
	}

	function getElementType(el){
		const tag = el.tagName?.toLowerCase() || '';
		if(tag === 'a') return 'link';
		if(tag.match(/^h[1-6]$/)) return 'heading';
		if(tag === 'button') return 'button';
		return 'paragraph';
	}

	function cssSelector(el){
		if(!(el instanceof Element)) return '';
		const path = [];
		while(el && el.nodeType === Node.ELEMENT_NODE){
			let selector = el.nodeName.toLowerCase();
			if(el.id){ selector += '#' + el.id; path.unshift(selector); break; }
			else{
				let sib = el, nth = 1;
				while(sib = sib.previousElementSibling){ if(sib.nodeName.toLowerCase() === selector) nth++; }
				selector += `:nth-of-type(${nth})`;
			}
			path.unshift(selector);
			el = el.parentElement;
		}
		return path.join(' > ');
	}

	function walkAndCollect(){
		const results = [];
		const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
			acceptNode(node){
				const t = normalizeText(node.nodeValue);
				if(!t) return NodeFilter.FILTER_REJECT;
				const parent = node.parentElement;
				if(!parent) return NodeFilter.FILTER_REJECT;
				if(['SCRIPT','STYLE','NOSCRIPT','CODE','PRE'].includes(parent.tagName)) return NodeFilter.FILTER_REJECT;
				if(parent.closest('script, style, noscript, code, pre, svg, canvas, textarea, input')) return NodeFilter.FILTER_REJECT;
				if(!isVisible(parent)) return NodeFilter.FILTER_REJECT;
				if(/https?:\/\//i.test(t)) return NodeFilter.FILTER_REJECT;
				return NodeFilter.FILTER_ACCEPT;
			}
		});
		while(walker.nextNode()){
			const node = walker.currentNode;
			const parent = node.parentElement;
			const text = normalizeText(node.nodeValue);
			if(!text) continue;
			const sel = cssSelector(parent);
			results.push({
				id: uid(),
				selector: sel,
				sourceText: text,
				type: getElementType(parent),
				url: location.href,
				context: parent.outerHTML.slice(0, 160),
				status: 'pending'
			});
		}
		// dedupe by selector + text
		const seen = new Set();
		const deduped = [];
		for(const r of results){
			const key = r.selector + '|' + r.sourceText.toLowerCase();
			if(seen.has(key)) continue;
			seen.add(key);
			deduped.push(r);
		}
		return deduped;
	}

	function ensureContainers(){
		if(document.getElementById('wt-dock')) return;
		const dock = document.createElement('div');
		dock.id = 'wt-dock';
		dock.className = 'wt-reset wt-dock';
		dock.innerHTML = html`
			<div class="wt-topbar">
				<div class="wt-title">
					<span style="display:inline-flex;width:24px;height:24px;align-items:center;justify-content:center;border-radius:999px;background:${ACCENT};color:#fff;">⟲</span>
					<span>Web UI Translator</span>
					<span class="wt-badge">v${VERSION}</span>
				</div>
				<div class="wt-actions">
					<button class="wt-icon-btn" id="wt-min">—</button>
					<button class="wt-icon-btn" id="wt-close">✕</button>
				</div>
			</div>
			<div class="wt-body" id="wt-body"></div>
		`;
		const list = document.createElement('div');
		list.id = 'wt-list';
		list.className = 'wt-reset wt-list';
		list.innerHTML = html`
			<div class="wt-list-h">
				<div class="col">Source</div>
				<div class="col">Translation</div>
				<div class="col">Actions</div>
			</div>
			<div class="wt-list-rows" id="wt-list-rows"></div>
		`;
		const toolbar = document.createElement('div');
		toolbar.id = 'wt-toolbar';
		toolbar.className = 'wt-reset wt-toolbar';
		toolbar.innerHTML = html`
			<button class="wt-btn" id="wt-pick-toggle" title="Pick/Unpick" style="display:none">Pick</button>
			<div class="wt-seg">
				<button id="wt-view-original" class="active">Original</button>
				<button id="wt-view-translated">Translated</button>
			</div>
			<button class="wt-btn" id="wt-selectall-toolbar">Select All</button>
			<button class="wt-btn" id="wt-maximize">Maximize</button>
			<button class="wt-btn" id="wt-reset">Reset</button>
		`;
		document.body.appendChild(dock);
		document.body.appendChild(list);
		document.body.appendChild(toolbar);
	}

	function render(){
		ensureContainers();
		const body = document.getElementById('wt-body');
		body.innerHTML = '';
		const steps = [
			{ id:1, title:'Inspect Elements', content: renderStep1 },
			{ id:2, title:'Choose Language', content: renderStep2 },
			{ id:3, title:'Preview & Edit', content: renderStep3 },
			{ id:4, title:'Download Translation', content: renderStep4 },
		];

		for(const s of steps){
			const card = document.createElement('div');
			card.className = 'wt-step';
			const status = stepStatus(s.id);
			card.innerHTML = html`
				<div class="wt-step-h" data-step="${s.id}">
					<h3>${s.title}</h3>
					<span class="wt-chip ${state.activeStep===s.id?'active':''} ${status==='done'?'done':''}">${state.activeStep===s.id?'Active':status==='done'?'Done':'Pending'}</span>
				</div>
				<div class="wt-step-c" ${state.activeStep===s.id?'':'style="display:none"'} id="wt-step-${s.id}"></div>
			`;
			body.appendChild(card);
		}

		// Step content
		renderStep1(document.getElementById('wt-step-1'));
		renderStep2(document.getElementById('wt-step-2'));
		renderStep3(document.getElementById('wt-step-3'));
		renderStep4(document.getElementById('wt-step-4'));

		// Events
		body.querySelectorAll('.wt-step-h').forEach(h=>{
			h.addEventListener('click',()=>{
				state.activeStep = Number(h.dataset.step);
				render();
				updateToolbarVisibility();
			});
		});

		updateList();
		updateToolbarVisibility();
	}

	function stepStatus(step){
		if(step===1){ return state.strings.length>0 ? 'done' : 'pending'; }
		if(step===2){ return state.strings.some(s=>s.translatedText) ? 'done' : 'pending'; }
		if(step===3){ return state.viewMode==='translated' ? 'done' : 'pending'; }
		if(step===4){ return 'pending'; }
		return 'pending';
	}

	// Step 1
	function renderStep1(container){
		if(!container) return;
		container.innerHTML = html`
			<div style="display:flex; flex-direction:column; gap:8px">
				<button id="wt-select-all" class="wt-btn ${state.selectAllActive?'primary active':'primary'} block">Select All Elements</button>
				<button id="wt-pick-one" class="wt-btn block ${state.isPicking?'active':''}">Select Individual Element</button>
				<div style="font-size:12px; color:#334155; margin-top:6px">${state.strings.length} elements extracted.</div>
			</div>
		`;
		container.querySelector('#wt-select-all').onclick = ()=>{
			state.selectAllActive = true; state.isPicking = false;
			const items = walkAndCollect();
			state.strings = items;
			state.activeStep = 2;
			updateList();
			applyViewMode();
			render();
		};
		container.querySelector('#wt-pick-one').onclick = ()=>{
			state.isPicking = !state.isPicking; state.selectAllActive = false;
			setPicking(state.isPicking);
			render();
		};
	}

	// Step 2
	function renderStep2(container){
		if(!container) return;
		const lang = state.activeLanguage || '';
		container.innerHTML = html`
			<div style="display:flex; flex-direction:column; gap:10px">
				<label style="font-size:12px; color:#475569">Target Language</label>
				<select id="wt-lang" class="wt-input" style="min-height:36px">
					<option value="">Select language</option>
					<option value="es">Spanish</option>
					<option value="de">German</option>
					<option value="fr">French</option>
					<option value="it">Italian</option>
				</select>
				<div style="background:#eef2ff; color:#3730a3; padding:8px; border-radius:10px; font-size:12px;">Language: ${lang?lang.toUpperCase():'—'}</div>
				<div style="background:#faf5ff; color:#6b21a8; padding:8px; border-radius:10px; font-size:12px;">Click "Translate All" to start translation</div>
				<button id="wt-translate-all" class="wt-btn primary block" ${lang?'':'disabled'}>Translate All</button>
			</div>
		`;
		const select = container.querySelector('#wt-lang');
		if(lang) select.value = lang;
		select.onchange = ()=>{ state.activeLanguage = select.value || null; render(); };
		container.querySelector('#wt-translate-all').onclick = async ()=>{
			await translateAll();
			state.activeStep = 3; state.viewMode = 'translated';
			updateList();
			applyViewMode();
			render();
		};
	}

	// Step 3
	function renderStep3(container){
		if(!container) return;
		container.innerHTML = html`
			<div style="color:#334155; font-size:12px; margin-bottom:8px;">Use the preview panel to view and edit translations. Toggle between original and translated views using the controls in the preview toolbar.</div>
			<div style="display:flex; gap:8px">
				<div style="flex:1; background:#f1f5f9; border:1px solid #e2e8f0; border-radius:10px; padding:10px; text-align:center">Preview Mode: ${state.viewMode==='translated'?'Translated':'Original'}</div>
			</div>
		`;
	}

	// Step 4
	function renderStep4(container){
		if(!container) return;
		const translatedCount = state.strings.filter(s=>!!s.translatedText).length;
		container.innerHTML = html`
			<div style="display:flex; flex-direction:column; gap:8px">
				<button class="wt-btn block" id="wt-exp-json">Download JSON</button>
				<button class="wt-btn block" id="wt-exp-csv">Download CSV</button>
				<button class="wt-btn block" id="wt-exp-xlsx">Download Excel</button>
				<button class="wt-btn block" id="wt-exp-txt">Download Text</button>
				<button class="wt-btn block" id="wt-exp-copy">Copy All to Clipboard</button>
				<div style="background:#e8f5e9; color:#065f46; padding:8px; border-radius:10px; font-size:12px;">${translatedCount} translations completed • Ready for export</div>
			</div>
		`;
		container.querySelector('#wt-exp-json').onclick = ()=> downloadFile('json');
		container.querySelector('#wt-exp-csv').onclick = ()=> downloadFile('csv');
		container.querySelector('#wt-exp-xlsx').onclick = ()=> downloadFile('xlsx');
		container.querySelector('#wt-exp-txt').onclick = ()=> downloadFile('txt');
		container.querySelector('#wt-exp-copy').onclick = ()=> copyAll();
	}

	function updateList(){
		const rows = document.getElementById('wt-list-rows');
		if(!rows) return;
		rows.innerHTML = '';
		for(const item of state.strings){
			const row = document.createElement('div');
			row.className = 'wt-row';
			row.dataset.id = item.id;
			row.innerHTML = html`
				<div class="wt-src">
					<span>${escapeHtml(item.sourceText)}</span>
					<span class="wt-type">${item.type}</span>
				</div>
				<div>
					<textarea class="wt-input" data-role="input">${item.translatedText || ''}</textarea>
				</div>
				<div class="wt-row-actions">
					<button class="wt-trash" title="Remove">🗑</button>
				</div>
			`;
			row.querySelector('[data-role="input"]').addEventListener('input', (e)=>{
				item.translatedText = e.target.value;
				item.status = item.translatedText ? 'translated' : 'pending';
				if(state.viewMode==='translated') applyTranslationForItem(item);
			});
			row.querySelector('.wt-trash').onclick = ()=>{
				removeItem(item);
			};
			rows.appendChild(row);
		}
	}

	function escapeHtml(str){
		return String(str).replace(/[&<>\"]/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[s]));
	}

	function removeItem(item){
		const idx = state.strings.findIndex(s=>s.id===item.id);
		if(idx>=0){ state.strings.splice(idx,1); }
		// revert element on page
		const el = document.querySelector(item.selector);
		if(el && state.originalSnapshots.has(item.selector)){
			el.textContent = state.originalSnapshots.get(item.selector);
		}
		updateList();
	}

	// Picking mode
	let highlightDiv = null;
	let pickMove = null;
	let pickClick = null;

	function setPicking(on){
		const toolbarPick = document.getElementById('wt-pick-toggle');
		if(toolbarPick) toolbarPick.style.display = state.activeStep===1 ? 'inline-flex' : 'none';
		if(on){
			if(!highlightDiv){ highlightDiv = document.createElement('div'); highlightDiv.className = 'wt-highlight'; document.body.appendChild(highlightDiv); }
			pickMove = (e)=>{
				const el = document.elementFromPoint(e.clientX, e.clientY);
				if(!el || dockContains(el)) return; // ignore plugin itself
				const rect = el.getBoundingClientRect();
				highlightDiv.style.left = rect.left + 'px';
				highlightDiv.style.top = rect.top + 'px';
				highlightDiv.style.width = rect.width + 'px';
				highlightDiv.style.height = rect.height + 'px';
			};
			pickClick = (e)=>{
				const el = document.elementFromPoint(e.clientX, e.clientY);
				if(!el || dockContains(el)) return;
				const text = normalizeText(el.textContent);
				if(!text) return;
				const item = { id: uid(), selector: cssSelector(el), sourceText: text, type:getElementType(el), url: location.href, context: el.outerHTML.slice(0,160), status:'pending' };
				// de-dupe
				if(!state.strings.some(s=>s.selector===item.selector && s.sourceText.toLowerCase()===item.sourceText.toLowerCase())){
					state.strings.push(item);
					updateList();
				}
			};
			document.addEventListener('mousemove', pickMove, true);
			document.addEventListener('click', pickClick, true);
			document.addEventListener('keydown', onEsc, true);
		} else {
			if(highlightDiv){ highlightDiv.remove(); highlightDiv = null; }
			document.removeEventListener('mousemove', pickMove, true);
			document.removeEventListener('click', pickClick, true);
			document.removeEventListener('keydown', onEsc, true);
		}
		updateToolbarVisibility();
	}
	function onEsc(e){ if(e.key==='Escape'){ state.isPicking=false; setPicking(false); render(); } }
	function dockContains(el){ return !!el.closest && !!el.closest('#wt-dock, #wt-list, #wt-toolbar'); }

	// Toolbar
	function updateToolbarVisibility(){
		const pickBtn = document.getElementById('wt-pick-toggle');
		if(pickBtn){
			pickBtn.style.display = state.activeStep===1 ? 'inline-flex' : 'none';
			pickBtn.textContent = state.isPicking ? 'Unpick' : 'Pick';
			pickBtn.onclick = ()=>{ state.isPicking = !state.isPicking; setPicking(state.isPicking); render(); };
		}
		document.getElementById('wt-view-original').classList.toggle('active', state.viewMode==='original');
		document.getElementById('wt-view-translated').classList.toggle('active', state.viewMode==='translated');
		document.getElementById('wt-view-original').onclick = ()=>{ state.viewMode='original'; applyViewMode(); render(); };
		document.getElementById('wt-view-translated').onclick = ()=>{ state.viewMode='translated'; applyViewMode(); render(); };
		document.getElementById('wt-selectall-toolbar').onclick = ()=>{
			const items = walkAndCollect();
			state.strings = items; updateList(); render();
		};
		document.getElementById('wt-maximize').onclick = ()=>{
			document.getElementById('wt-dock').style.width = 'min(92vw, 720px)';
		};
		document.getElementById('wt-reset').onclick = ()=> resetAll();
		// topbar actions
		document.getElementById('wt-close').onclick = ()=>{ document.getElementById('wt-dock').remove(); document.getElementById('wt-list').remove(); document.getElementById('wt-toolbar').remove(); };
		document.getElementById('wt-min').onclick = ()=>{ document.getElementById('wt-dock').classList.toggle('wt-hidden'); };
	}

	// Apply / revert
	function applyViewMode(){
		if(state.viewMode==='original'){
			for(const item of state.strings){
				const el = document.querySelector(item.selector);
				if(el && state.originalSnapshots.has(item.selector)){
					el.textContent = state.originalSnapshots.get(item.selector);
				}
			}
		}else{
			for(const item of state.strings){ applyTranslationForItem(item); }
		}
	}
	function applyTranslationForItem(item){
		if(!item.translatedText) return;
		const el = document.querySelector(item.selector);
		if(!el) return;
		if(!state.originalSnapshots.has(item.selector)){
			state.originalSnapshots.set(item.selector, el.textContent);
		}
		el.textContent = item.translatedText;
	}

	// Inline ALT+click editor
	document.addEventListener('click', (e)=>{
		if(!e.altKey) return;
		const el = e.target;
		if(dockContains(el)) return;
		const text = normalizeText(el.textContent);
		if(!text) return;
		const selector = cssSelector(el);
		let item = state.strings.find(s=>s.selector===selector && s.sourceText===text) || state.strings.find(s=>s.selector===selector);
		if(!item){
			item = { id: uid(), selector, sourceText:text, type:getElementType(el), url:location.href, context:el.outerHTML.slice(0,160), status:'pending' };
			state.strings.push(item);
			updateList();
		}
		openInlineEditor(el, item);
	}, true);

	function openInlineEditor(el, item){
		closeInlineEditor();
		const rect = el.getBoundingClientRect();
		const editor = document.createElement('div');
		editor.className = 'wt-inline-editor';
		editor.style.left = (rect.left) + 'px';
		editor.style.top = (rect.bottom + 6) + 'px';
		editor.innerHTML = html`
			<textarea class="wt-input" style="width:320px; min-height:60px">${item.translatedText || item.sourceText}</textarea>
			<div style="display:flex; gap:6px; margin-top:6px; justify-content:flex-end">
				<button class="wt-btn" data-act="cancel">Cancel</button>
				<button class="wt-btn primary" data-act="save">Save</button>
			</div>
		`;
		document.body.appendChild(editor);
		state.inlineEditors.set(item.id, editor);
		editor.querySelector('[data-act="cancel"]').onclick = closeInlineEditor;
		editor.querySelector('[data-act="save"]').onclick = ()=>{
			const val = editor.querySelector('textarea').value;
			item.translatedText = val; item.status = val? 'translated' : 'pending';
			applyTranslationForItem(item); updateList(); closeInlineEditor();
		};
	}
	function closeInlineEditor(){
		for(const el of state.inlineEditors.values()){ el.remove(); }
		state.inlineEditors.clear();
	}

	// Translate All (mock batched)
	async function translateAll(){
		if(!state.activeLanguage) return;
		const batch = 20;
		for(let i=0;i<state.strings.length;i+=batch){
			const slice = state.strings.slice(i, i+batch);
			const results = await mockTranslate(slice.map(s=>s.sourceText), state.activeLanguage);
			for(let j=0;j<slice.length;j++){
				slice[j].translatedText = results[j];
				slice[j].status = 'translated';
				slice[j].language = state.activeLanguage;
				slice[j].updatedAt = new Date().toISOString();
				slice[j].updatedBy = 'AI';
				slice[j].confidence = 0.75;
			}
			updateList();
		}
	}

	async function mockTranslate(texts, lang){
		// Simple mock: append [lang] and keep punctuation
		return texts.map(t=> t + ' ['+lang+']');
	}

	// Export
	function filename(ext){
		const domain = location.hostname.replace(/[^a-z0-9.-]/gi,'_');
		const lang = state.activeLanguage || 'xx';
		const dt = new Date();
		const fmt = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}_${String(dt.getHours()).padStart(2,'0')}${String(dt.getMinutes()).padStart(2,'0')}`;
		return `${domain}_${lang}_${fmt}.${ext}`;
	}
	function downloadFile(type){
		const data = state.strings.filter(s=>s.language===state.activeLanguage || type!=='json');
		if(type==='json'){
			const json = JSON.stringify(data, null, 2);
			download(json, filename('json'), 'application/json');
		}else if(type==='csv' || type==='xlsx' || type==='txt'){
			const rows = [['id','selector','url','type','sourceText','translatedText','language','status','confidence','updatedAt','updatedBy']].concat(
				state.strings.map(s=>[
					s.id, s.selector, s.url, s.type, s.sourceText, s.translatedText||'', s.language||'', s.status||'', s.confidence||'', s.updatedAt||'', s.updatedBy||''
				])
			);
			const csv = rows.map(r=> r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n');
			const ext = type==='txt'?'txt':type; const mime = 'text/csv;charset=utf-8';
			download(csv, filename(ext), mime);
		}
	}
	function copyAll(){
		const lines = state.strings.map(s=> `${s.sourceText} => ${s.translatedText||''}` ).join('\n');
		navigator.clipboard?.writeText(lines);
	}
	function download(content, name, mime){
		const blob = new Blob([content], {type:mime});
		const a = document.createElement('a');
		a.href = URL.createObjectURL(blob);
		a.download = name; a.click();
		URL.revokeObjectURL(a.href);
	}

	function resetAll(){
		for(const [sel, txt] of state.originalSnapshots){
			const el = document.querySelector(sel); if(el) el.textContent = txt;
		}
		state.originalSnapshots.clear();
		state.viewMode='original';
		closeInlineEditor();
	}

	// Public API
	window.WebTranslator = {
		mount(){ render(); },
		unmount(){ resetAll(); document.getElementById('wt-dock')?.remove(); document.getElementById('wt-list')?.remove(); document.getElementById('wt-toolbar')?.remove(); }
	};
})();