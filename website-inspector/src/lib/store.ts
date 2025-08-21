import { create } from "zustand";
import type { AppState, ExtractedItem } from "@/types";

interface AppActions {
  setUrl: (url: string) => void;
  setStep: (step: AppState["step"]) => void;
  setLocale: (locale: string) => void;
  setIframeLoaded: (loaded: boolean) => void;
  addItems: (items: ExtractedItem[]) => void;
  updateItem: (key: string, updates: Partial<ExtractedItem>) => void;
  setPicking: (val: boolean) => void;
  toggleOverlay: () => void;
  resetItems: () => void;
}

type Store = AppState & AppActions;

export const useAppStore = create<Store>((set, get) => ({
  url: "",
  isIframeLoaded: false,
  step: 1,
  locale: "en",
  items: [],
  picking: false,
  overlayEnabled: true,

  setUrl: (url) => set({ url }),
  setStep: (step) => set({ step }),
  setLocale: (locale) => set({ locale }),
  setIframeLoaded: (loaded) => set({ isIframeLoaded: loaded }),
  addItems: (items) => set({ items: mergeByKey(get().items, items) }),
  updateItem: (key, updates) =>
    set({ items: get().items.map((it) => (it.key === key ? { ...it, ...updates } : it)) }),
  setPicking: (val) => set({ picking: val }),
  toggleOverlay: () => set({ overlayEnabled: !get().overlayEnabled }),
  resetItems: () => set({ items: [] }),
}));

function mergeByKey(existing: ExtractedItem[], incoming: ExtractedItem[]): ExtractedItem[] {
  const map = new Map(existing.map((e) => [e.key, e] as const));
  for (const item of incoming) {
    const prev = map.get(item.key);
    map.set(item.key, prev ? { ...prev, ...item } : item);
  }
  return Array.from(map.values());
}
