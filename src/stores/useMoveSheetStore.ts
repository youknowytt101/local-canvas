// Cosmos' MoveSheetProvider / useMoveElements: which element the save sheet (SHEET_NAMES.MOVE) is about. Opening it
// presents the sheet hosted once in MainNavigator (SheetHosts); it reads the element afresh from the server.
import { TrueSheet } from '@lodev09/react-native-true-sheet';
import { create } from 'zustand';
import type { Element } from '../lib/elements';

export const MOVE_SHEET = 'move';

// move mode (useMoveElements' move: organizing a collection): these elements go to the chosen place and leave `from`
export type MoveRequest = { elementIds: string[]; fromClusterId: string; onMoved: () => void };

// destination mode (presentMoveSheetForDraft: what is about to be made, photos picked on the profile): a row is where it
// goes — the profile (null) or a collection — and the sheet closes
export type DestinationRequest = { onChoose: (cluster: { id: string; name: string } | null) => void };

type MoveSheetState = {
  element: Element | null;
  move: MoveRequest | null;
  destination: DestinationRequest | null;
  open: (element: Element) => void;
  openMove: (first: Element, move: MoveRequest) => void;
  openDestination: (destination: DestinationRequest) => void;
  close: () => void;
};

export const useMoveSheetStore = create<MoveSheetState>((set) => ({
  element: null,
  move: null,
  destination: null,
  open: (element) => {
    set({ element, move: null, destination: null });
    void TrueSheet.present(MOVE_SHEET).catch(() => undefined);
  },
  openMove: (first, move) => {
    set({ element: first, move, destination: null });
    void TrueSheet.present(MOVE_SHEET).catch(() => undefined);
  },
  openDestination: (destination) => {
    set({ element: null, move: null, destination });
    void TrueSheet.present(MOVE_SHEET).catch(() => undefined);
  },
  close: () => { void TrueSheet.dismiss(MOVE_SHEET).catch(() => undefined); },
}));

// an element saved or taken out somewhere: the lists showing it (the viewer's) learn its new state
type SavedListener = (elementId: string, patch: Partial<Element>) => void;
const savedListeners = new Set<SavedListener>();
export const onElementSaved = (fn: SavedListener) => { savedListeners.add(fn); return () => { savedListeners.delete(fn); }; };
export const announceElementSaved: SavedListener = (id, patch) => { for (const fn of savedListeners) fn(id, patch); };
