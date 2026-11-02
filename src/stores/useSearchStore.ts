// What the global search holds (Cosmos keeps it in SearchScreen's state and SearchInput's props; the field itself is in
// the bar, drawn outside the screen, so it is shared here): the text in the field, whether the field has focus, and the
// search that was submitted (with where it came from: the field, or a keyword of an element's description, origin
// 'caption'). Submitting blurs the field; closing search clears it all.
import { create } from 'zustand';

export type SubmittedSearch = { term: string; origin: 'search_box' | 'caption'; at: number };

type SearchState = {
  query: string;
  focused: boolean;
  submitted: SubmittedSearch | null;
  focusToken: number; // bumped to ask the field for focus
  setQuery: (query: string) => void;
  setFocused: (focused: boolean) => void;
  submit: (term: string, origin?: SubmittedSearch['origin']) => void;
  edit: () => void; // back from the results to the field
  reset: () => void;
};

export const useSearchStore = create<SearchState>((set) => ({
  query: '',
  focused: false,
  submitted: null,
  focusToken: 0,
  setQuery: (query) => set({ query }),
  setFocused: (focused) => set({ focused }),
  submit: (term, origin = 'search_box') => {
    const t = term.trim();
    if (!t) return;
    set({ query: t, submitted: { term: t, origin, at: Date.now() }, focused: false });
  },
  edit: () => set((s) => ({ submitted: null, focusToken: s.focusToken + 1 })),
  reset: () => set({ query: '', focused: false, submitted: null }),
}));
