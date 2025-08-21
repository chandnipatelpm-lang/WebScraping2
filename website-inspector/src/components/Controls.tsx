"use client";
import React, { useCallback } from "react";
import { useAppStore } from "@/lib/store";
import { translateAll } from "@/lib/translate";
import Papa from "papaparse";
import * as XLSX from "xlsx";

export function Controls() {
  const { url, setUrl, setStep, items, addItems, setPicking, locale, setLocale, toggleOverlay } = useAppStore();

  const handleLoad = useCallback(() => {
    setStep(2);
  }, [setStep]);

  const handleInspect = useCallback(() => {
    setPicking(true);
    try { (window as unknown as { frames: Array<any> }).frames[0].__inspector_startPicking?.(); } catch {}
  }, [setPicking]);

  const handleSelectAll = useCallback(() => {
    try {
      const doc = (window as unknown as { frames: Array<{ document: Document }> }).frames[0].document as Document;
      const script = doc.createElement('script');
      script.type = 'module';
      script.textContent = `(${selectAllInIframe.toString()})('${url}')`;
      doc.head.appendChild(script);
    } catch (e) { console.warn(e); }
  }, [url]);

  // Receive bulk extraction results
  React.useEffect(() => {
    type BulkMsg = { type: 'bulkExtract'; payload: typeof items } | { type: string };
    function onMessage(ev: MessageEvent) {
      const data = ev.data as BulkMsg;
      if ((data as any)?.type === 'bulkExtract') addItems((data as any).payload as typeof items);
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [addItems, items]);

  const doTranslateAll = useCallback(async () => {
    const map = await translateAll(items.map(i => ({ key: i.key, source: i.source })), locale);
    for (const [k, v] of Object.entries(map)) {
      useAppStore.getState().updateItem(k, { target: v, status: 'translated', locale });
    }
    setStep(4);
  }, [items, locale, setStep]);

  const exportJSON = useCallback(() => {
    const data = JSON.stringify(items, null, 2);
    downloadBlob(new Blob([data], { type: 'application/json' }), 'translations.json');
  }, [items]);

  const exportCSV = useCallback(() => {
    const csv = Papa.unparse(items.map(i => ({ key: i.key, source: i.source, target: i.target || "", selector: i.selector })));
    downloadBlob(new Blob([csv], { type: 'text/csv' }), 'translations.csv');
  }, [items]);

  const exportXLSX = useCallback(() => {
    const worksheet = XLSX.utils.json_to_sheet(items);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, worksheet, 'Translations');
    const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    downloadBlob(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'translations.xlsx');
  }, [items]);

  return (
    <div className="card p-4 w-[360px] flex flex-col gap-4">
      <div>
        <div className="text-sm font-semibold mb-2">Step 1 – Enter URL</div>
        <div className="flex gap-2">
          <input className="flex-1 border rounded px-2 py-2" placeholder="https://example.com" value={url} onChange={(e) => setUrl(e.target.value)} />
          <button className="btn btn-primary" onClick={handleLoad}>Load</button>
          <button className="btn btn-secondary" onClick={() => window.location.reload()}>Refresh</button>
        </div>
      </div>

      <div>
        <div className="text-sm font-semibold mb-2">Step 2 – Inspect / Select All</div>
        <div className="flex gap-2">
          <button className="btn btn-secondary" onClick={handleInspect}>Inspect Element</button>
          <button className="btn btn-secondary" onClick={handleSelectAll}>Select All</button>
        </div>
      </div>

      <div>
        <div className="text-sm font-semibold mb-2">Step 3 – Choose Language</div>
        <div className="flex gap-2">
          <select className="border rounded px-2 py-2" value={locale} onChange={(e) => setLocale(e.target.value)}>
            {['en','fr','de','es','hi','ja','zh','ar'].map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <button className="btn btn-primary" onClick={() => setStep(4)} disabled={!items.length}>Next</button>
        </div>
      </div>

      <div>
        <div className="text-sm font-semibold mb-2">Step 4 – Preview & Edit</div>
        <div className="flex gap-2">
          <button className="btn btn-success" onClick={doTranslateAll} disabled={!items.length}>Translate All</button>
          <button className="btn btn-secondary" onClick={toggleOverlay}>Toggle Overlay</button>
        </div>
      </div>

      <div>
        <div className="text-sm font-semibold mb-2">Step 5 – Export</div>
        <div className="flex gap-2">
          <button className="btn btn-secondary" onClick={exportCSV}>Export CSV</button>
          <button className="btn btn-secondary" onClick={exportXLSX}>Export XLSX</button>
          <button className="btn btn-secondary" onClick={exportJSON}>Export JSON</button>
        </div>
      </div>
    </div>
  );
}

function downloadBlob(blob: Blob, filename: string){
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); setTimeout(()=>URL.revokeObjectURL(url), 1000);
}

// This function gets stringified and executed inside the iframe to collect text
function selectAllInIframe(url: string){
  function normalizeText(s: string){ return s.replace(/\s+/g,' ').trim(); }
  function isVisible(el: Element){ const style = getComputedStyle(el as HTMLElement); if(style.display==='none'||style.visibility==='hidden'||parseFloat((style.opacity||'1') as string)===0) return false; const r = (el as HTMLElement).getBoundingClientRect(); return r.width>0 && r.height>0; }
  function buildSelector(el: Element){
    const dataAttr = Array.from(el.attributes).find(a => a.name.startsWith('data-') && a.value);
    if (dataAttr) return '['+dataAttr.name+'="'+dataAttr.value.replace(/(["'\\])/g,'\\$1')+'"]';
    const id = el.id; if (id) return '#'+id.replace(/(["'\\])/g,'\\$1');
    const path:string[]=[]; let curr: Element | null = el;
    while(curr && curr.nodeType===1){
      let sel = curr.nodeName.toLowerCase();
      const cls = (curr.className||'').toString().trim();
      if (cls){ sel += '.'+cls.split(/\s+/).slice(0,2).join('.'); }
      let i=0, nth=1; if (curr.parentElement){
        for (const c of Array.from(curr.parentElement.children)) { if (c.nodeName===curr.nodeName){ i++; if (c===curr) nth=i; } }
      }
      if (nth>1) sel += ':nth-of-type('+nth+')';
      path.unshift(sel);
      curr = (curr as HTMLElement).parentElement;
      if (curr && (curr as HTMLElement).id){ path.unshift('#'+(curr as HTMLElement).id); break; }
    }
    return path.join(' > ');
  }
  const items: Array<{ key: string; source: string; role: string; selector: string; url: string; status: string }> = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, null);
  let node = walker.nextNode();
  while(node){
    const el = node as HTMLElement;
    if(el instanceof HTMLElement){
      const text = normalizeText(el.innerText||'');
      if(text && isVisible(el)) items.push({ key: Math.random().toString(36).slice(2,8), source:text, role:'text', selector: buildSelector(el), url, status:'new' });
      const attrs=['title','alt','aria-label','placeholder'];
      for(const n of attrs){ const v = (el.getAttribute(n)||'').trim(); if(v) items.push({ key: Math.random().toString(36).slice(2,8), source: v, role:'attribute', selector: buildSelector(el), url, status:'new' }); }
      if(el.tagName.toLowerCase()==='button'){ const t=normalizeText(el.textContent||''); if(t) items.push({ key: Math.random().toString(36).slice(2,8), source:t, role:'button', selector: buildSelector(el), url, status:'new' }); }
    }
    node = walker.nextNode();
  }
  parent.postMessage({ type:'bulkExtract', payload: items }, '*');
}
