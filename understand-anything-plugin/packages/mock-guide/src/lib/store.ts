import { create } from "zustand";

export type MockMode = "screenshot" | "structural" | "template";
export type Persona = "non-technical" | "junior" | "experienced";

export interface ThemeConfig {
  presetId: string;
  accentId: string;
}

export interface AppState {
  currentPageId: string | null;
  currentMode: MockMode;
  currentPersona: Persona;
  noLlm: boolean;
  theme: ThemeConfig;
  bindingHover: string | null;
  bindingSelect: string | null;

  setCurrentPageId: (id: string | null) => void;
  setCurrentMode: (mode: MockMode) => void;
  setCurrentPersona: (persona: Persona) => void;
  setNoLlm: (v: boolean) => void;
  setTheme: (theme: ThemeConfig) => void;
  setBindingHover: (label: string | null) => void;
  setBindingSelect: (label: string | null) => void;
}

export const useStore = create<AppState>()((set) => ({
  currentPageId: null,
  currentMode: "structural",
  currentPersona: "experienced",
  noLlm: false,
  theme: { presetId: "dark-gold", accentId: "gold" },
  bindingHover: null,
  bindingSelect: null,

  setCurrentPageId: (id) => set({ currentPageId: id }),
  setCurrentMode: (mode) => set({ currentMode: mode }),
  setCurrentPersona: (persona) => set({ currentPersona: persona }),
  setNoLlm: (v) => set({ noLlm: v }),
  setTheme: (theme) => set({ theme }),
  setBindingHover: (label) => set({ bindingHover: label }),
  setBindingSelect: (label) => set({ bindingSelect: label }),
}));