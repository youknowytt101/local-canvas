// What the global search holds (Cosmos keeps it in SearchScreen's state and SearchInput's props; the field itself is in
// the bar, drawn outside the screen, so it is shared here): the text in the field, whether the field has focus, and the
// search that was submitted (with where it came from: the field, or a keyword of an element's description, origin
// 'caption'). Submitting blurs the field; closing search clears it all.
// The colour search (SearchScreen's searchColor and colour picker state): the colour searched (six hex digits) stays
// through later searches of words until it is cleared — by the picker's 清除 or the field's clear cross, which empties
// both (SearchScreen's _temp2 / _temp3). The picker opens on the colour searched, else the last one picked, else
// 31F26B (t33); 搜索 searches it with the words already submitted, dropping what was typed since (t35).
import { create } from 'zustand';

export type SubmittedSearch = { term: string; origin: 'search_box' | 'caption'; at: number };

type SearchState = {
  query: string;
  focused: boolean;
  submitted: SubmittedSearch | null;
  color: string | null;
  picker: { visible: boolean; initialHex: string | null };
  lastPickedHex: string | null;
  focusToken: number; // bumped to ask the field for focus
  setQuery: (query: string) => void;
  setFocused: (focused: boolean) => void;
  submit: (term: string, origin?: SubmittedSearch['origin']) => void;
  edit: () => void; // back from the results to the field
  clear: () => void; // the field's clear cross
  openColorPicker: () => void;
  setPickedHex: (hex: string) => void;
  searchColor: (hex: string) => void;
  clearColor: () => void;
  closeColorPicker: () => void;
  reset: () => void;
};

export const useSearchStore = create<SearchState>((set) => ({
  query: '',
  focused: false,
  submitted: null,
  color: null,
  picker: { visible: false, initialHex: null },
  lastPickedHex: null,
  focusToken: 0,
  setQuery: (query) => set({ query }),
  setFocused: (focused) => set({ focused }),
  submit: (term, origin = 'search_box') => {
    const t = term.trim();
    if (!t) return;
    set({ query: t, submitted: { term: t, origin, at: Date.now() }, focused: false });
  },
  edit: () => set((s) => ({ submitted: null, focusToken: s.focusToken + 1 })),
  clear: () => set((s) => ({ query: '', submitted: null, color: null, focusToken: s.focusToken + 1 })),
  openColorPicker: () => set((s) => ({ focused: false, picker: { visible: true, initialHex: s.color ?? s.lastPickedHex } })),
  setPickedHex: (hex) => set({ lastPickedHex: hex }),
  searchColor: (hex) => set((s) => ({
    lastPickedHex: hex,
    picker: { visible: false, initialHex: hex },
    color: hex,
    query: s.submitted?.term ?? '',
    focused: false,
  })),
  clearColor: () => set({ lastPickedHex: null, picker: { visible: false, initialHex: null }, color: null, focused: false }),
  closeColorPicker: () => set((s) => ({ picker: { ...s.picker, visible: false } })),
  reset: () => set({ query: '', focused: false, submitted: null, color: null, picker: { visible: false, initialHex: null }, lastPickedHex: null }),
}));
