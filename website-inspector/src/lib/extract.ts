import slugify from "slugify";
import { nanoid } from "nanoid";
import type { ExtractedItem } from "@/types";

export function normalizeText(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

export function isVisible(el: Element): boolean {
  const style = getComputedStyle(el as HTMLElement);
  if (style.display === "none" || style.visibility === "hidden" || parseFloat(style.opacity || "1") === 0) return false;
  const rect = (el as HTMLElement).getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

export function buildKey(text: string, url: string, selector: string): string {
  const slug = slugify(normalizeText(text).slice(0, 50), { lower: true, strict: true });
  const suffix = nanoid(6);
  return `${slug}-${suffix}`;
}

export function buildSelector(el: Element): string {
  // Prefer data-* attributes
  const dataAttrs = Array.from(el.attributes).find((a) => a.name.startsWith("data-") && a.value);
  if (dataAttrs) return `[${dataAttrs.name}='${cssEscape(dataAttrs.value)}']`;

  // Use id if present
  const id = (el as HTMLElement).id;
  if (id) return `#${cssEscape(id)}`;

  // Build path
  const path: string[] = [];
  let curr: Element | null = el;
  while (curr && curr.nodeType === Node.ELEMENT_NODE) {
    const name = curr.nodeName.toLowerCase();
    let selector = name;
    const className = (curr as HTMLElement).className?.toString().trim();
    if (className) {
      const first = className.split(/\s+/).slice(0, 2).map(cssEscape).join(".");
      if (first) selector += `.${first}`;
    }
    const siblingIndex = getNthOfType(curr);
    if (siblingIndex > 1) selector += `:nth-of-type(${siblingIndex})`;
    path.unshift(selector);
    curr = curr.parentElement;
    if (curr && (curr as HTMLElement).id) {
      path.unshift(`#${cssEscape((curr as HTMLElement).id)}`);
      break;
    }
  }
  return path.join(" > ");
}

function getNthOfType(el: Element): number {
  let i = 0;
  const nodeName = el.nodeName;
  if (!el.parentElement) return 1;
  for (const sib of Array.from(el.parentElement.children)) {
    if (sib.nodeName === nodeName) {
      i++;
      if (sib === el) return i;
    }
  }
  return 1;
}

function cssEscape(value: string): string {
  return value.replace(/(["'\\])/g, "\\$1");
}

export function walkDocumentForText(doc: Document, url: string): ExtractedItem[] {
  const items: ExtractedItem[] = [];
  const pushItem = (text: string, el: Element, role: ExtractedItem["role"]) => {
    const source = normalizeText(text);
    if (!source) return;
    if (source.length === 1 && source.toUpperCase() !== "OK") return;
    if (!isVisible(el)) return;
    const selector = buildSelector(el);
    const key = buildKey(source, url, selector);
    items.push({ key, source, role, selector, url, status: "new" });
  };

  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT, null);
  let node = walker.nextNode() as Element | null;
  while (node) {
    const el = node as HTMLElement;
    // Text content for standard elements
    const text = normalizeText(el.innerText || "");
    if (text) pushItem(text, el, "text");

    // Attributes
    const attrs = ["title", "alt", "aria-label", "placeholder"] as const;
    for (const n of attrs) {
      const v = (el.getAttribute(n) || "").trim();
      if (v) pushItem(v, el, "attribute");
    }

    // Buttons
    if (el.tagName.toLowerCase() === "button") {
      const t = normalizeText(el.textContent || "");
      if (t) pushItem(t, el, "button");
    }

    node = walker.nextNode() as Element | null;
  }
  return dedupeByKey(items);
}

function dedupeByKey(items: ExtractedItem[]): ExtractedItem[] {
  const map = new Map<string, ExtractedItem>();
  for (const it of items) {
    if (!map.has(it.key)) map.set(it.key, it);
  }
  return Array.from(map.values());
}
