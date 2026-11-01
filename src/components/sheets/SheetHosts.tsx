// Cosmos' SheetHosts (module 3027, rendered by MainNavigator): the sheets any screen can open by name. So far the save
// sheet (SHEET_NAMES.MOVE) and the element's 更多 menu; the connections and share sheets come with them.
import { ElementMenuSheet } from './ElementMenuSheet';
import { MoveSheet } from './MoveSheet';

export function SheetHosts() {
  return (
    <>
      <MoveSheet />
      <ElementMenuSheet />
    </>
  );
}
