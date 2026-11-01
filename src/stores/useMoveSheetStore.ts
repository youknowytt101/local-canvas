// Cosmos' MoveSheetProvider / useMoveElements: which element the save sheet (SHEET_NAMES.MOVE) is about. Opening it
// presents the sheet hosted once in MainNavigator (SheetHosts); it reads the element afresh from the server.
import { TrueSheet } from '@lodev09/react-native-true-sheet';
import { create } from 'zustand';
import type { Element } from '../lib/elements';

export const MOVE_SHEET = 'move';

type MoveSheetState = {
  element: Element | null;
  open: (element: Element) => void;
  close: () => void;
};

export const useMoveSheetStore = create<MoveSheetState>((set) => ({
  element: null,
  open: (element) => {
    set({ element });
    void TrueSheet.present(MOVE_SHEET).catch(() => undefined);
  },
  close: () => { void TrueSheet.dismiss(MOVE_SHEET).catch(() => undefined); },
}));

// an element saved or taken out somewhere: the lists showing it (the viewer's) learn its new state
type SavedListener = (elementId: string, patch: Partial<Element>) => void;
const savedListeners = new Set<SavedListener>();
export const onElementSaved = (fn: SavedListener) => { savedListeners.add(fn); return () => { savedListeners.delete(fn); }; };
export const announceElementSaved: SavedListener = (id, patch) => { for (const fn of savedListeners) fn(id, patch); };
