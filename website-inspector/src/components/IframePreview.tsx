"use client";
import React, { useEffect, useRef } from "react";
import { useAppStore } from "@/lib/store";
import type { ExtractedItem } from "@/types";

type MessageFromChild =
  | { type: "pick"; payload: { text: string; selector: string; role: ExtractedItem["role"] } }
  | { type: "debug"; payload: unknown };

export function IframePreview() {
  const { url, setIframeLoaded, addItems, overlayEnabled, items, locale } = useAppStore();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Listen to picked elements
  useEffect(() => {
    function onMessage(ev: MessageEvent<MessageFromChild>) {
      if (!ev.data || typeof ev.data !== "object") return;
      const data = ev.data as MessageFromChild;
      if (data.type === "pick") {
        const { text, selector, role } = data.payload;
        const entry: ExtractedItem = {
          key: `${selector}-${Math.random().toString(36).slice(2, 8)}`,
          source: text,
          selector,
          role,
          url,
          status: "new",
        };
        addItems([entry]);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [addItems, url]);

  // Inject helper script whenever iframe loads
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const onLoad = () => {
      setIframeLoaded(true);
      try {
        const doc = iframe.contentDocument!;
        // Expose API on window for selecting and translating
        const script = doc.createElement("script");
        script.type = "text/javascript";
        script.textContent = injectedScript;
        doc.head.appendChild(script);
      } catch (e) {
        console.warn("Injection failed", e);
      }
    };
    iframe.addEventListener("load", onLoad);
    return () => iframe.removeEventListener("load", onLoad);
  }, [url, setIframeLoaded]);

  // Update overlay translations
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !overlayEnabled) return;
    try {
      const win = iframe.contentWindow as unknown as {
        __inspector_applyOverlay?: (map: Record<string, string>, locale: string) => void;
      } | null;
      if (win && typeof win.__inspector_applyOverlay === "function") {
        const map: Record<string, string> = {};
        for (const it of items) if (it.target) map[it.selector] = it.target;
        win.__inspector_applyOverlay(map, locale);
      }
    } catch {}
  }, [items, overlayEnabled, locale]);

  return (
    <div className="card w-full h-full">
      {url ? (
        <iframe ref={iframeRef} src={url} className="w-full h-[80vh] rounded-2xl" sandbox="allow-scripts allow-forms allow-same-origin" />
      ) : (
        <div className="p-8 text-center text-sm text-neutral-600">Enter a URL to load the website preview.</div>
      )}
    </div>
  );
}

// Script injected into the iframe to enable picking and overlay
const injectedScript = `(() => {
  const HIGHLIGHT_COLOR = 'rgba(25,118,210,0.4)';
  let picking = false;
  let hoverEl = null;
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;pointer-events:none;border:2px solid #1976D2;background:'+HIGHLIGHT_COLOR+';z-index:999999;display:none;';
  document.documentElement.appendChild(overlay);

  function computeRect(el){
    const r = el.getBoundingClientRect();
    overlay.style.left = r.left + 'px';
    overlay.style.top = r.top + 'px';
    overlay.style.width = r.width + 'px';
    overlay.style.height = r.height + 'px';
  }

  function setPicking(enabled){
    picking = enabled;
    overlay.style.display = enabled ? 'block' : 'none';
  }

  function isVisible(el){
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity||'1') === 0) return false;
    const rect = el.getBoundingClientRect();
    return rect.width>0 && rect.height>0;
  }

  function buildSelector(el){
    const dataAttr = Array.from(el.attributes).find(a => a.name.startsWith('data-') && a.value);
    if (dataAttr) return '['+dataAttr.name+'="'+dataAttr.value.replace(/(["'\\])/g,'\\$1')+'"]';
    const id = el.id; if (id) return '#'+id.replace(/(["'\\])/g,'\\$1');
    const path=[]; let curr=el;
    while(curr && curr.nodeType===1){
      let sel = curr.nodeName.toLowerCase();
      const cls = (curr.className||'').toString().trim();
      if (cls){ sel += '.'+cls.split(/\s+/).slice(0,2).join('.'); }
      let i=0, nth=1; if (curr.parentElement){
        for (const c of Array.from(curr.parentElement.children)) { if (c.nodeName===curr.nodeName){ i++; if (c===curr) nth=i; } }
      }
      if (nth>1) sel += ':nth-of-type('+nth+')';
      path.unshift(sel);
      curr = curr.parentElement;
      if (curr && curr.id){ path.unshift('#'+curr.id); break; }
    }
    return path.join(' > ');
  }

  function onMouseMove(e){
    if(!picking) return;
    hoverEl = e.target;
    if(!(hoverEl instanceof Element)) return;
    computeRect(hoverEl);
  }
  function onClick(e){
    if(!picking) return;
    e.preventDefault(); e.stopPropagation();
    const el = e.target; if(!(el instanceof Element)) return;
    if(!isVisible(el)) return;
    const text = (el.innerText||'').trim();
    if(!text) return;
    const selector = buildSelector(el);
    parent.postMessage({ type:'pick', payload:{ text, selector, role:'text' } }, '*');
    setPicking(false);
  }
  window.addEventListener('mousemove', onMouseMove, true);
  window.addEventListener('click', onClick, true);

  window.__inspector_startPicking = () => setPicking(true);
  window.__inspector_stopPicking = () => setPicking(false);

  // Translation overlay API
  const overlayAttr = 'data-inspector-overlay';
  window.__inspector_applyOverlay = (selectorToText, locale) => {
    for (const [selector, text] of Object.entries(selectorToText)){
      try{
        const el = document.querySelector(selector);
        if (!el) continue;
        let span = el.querySelector('span['+overlayAttr+'="1"]');
        if(!span){ span = document.createElement('span'); span.setAttribute(overlayAttr,'1'); span.style.background='rgba(76,175,80,0.12)'; span.style.borderRadius='4px'; span.style.padding='0 2px'; el.appendChild(span); }
        span.textContent = text;
      }catch{}
    }
  };
})();`;

declare global {
  interface Window {
    __inspector_startPicking?: () => void;
    __inspector_stopPicking?: () => void;
    __inspector_applyOverlay?: (map: Record<string, string>, locale: string) => void;
  }
}
