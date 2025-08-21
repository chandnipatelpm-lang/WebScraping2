export type ExtractedItemRole = "text" | "attribute" | "button" | "input";

export interface ExtractedItem {
  key: string;
  source: string;
  target?: string;
  role: ExtractedItemRole;
  selector: string;
  locale?: string;
  url: string;
  status?: "new" | "translated" | "edited";
}

export interface AppState {
  url: string;
  isIframeLoaded: boolean;
  step: 1 | 2 | 3 | 4 | 5;
  locale: string;
  items: ExtractedItem[];
  picking: boolean;
  overlayEnabled: boolean;
}
