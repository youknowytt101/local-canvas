// Cosmos' SheetHosts (module 3027, rendered by MainNavigator): the sheets any screen can open by name. So far the save
// sheet (SHEET_NAMES.MOVE), the element's 更多 menu and the create-collection sheet; the connections and share sheets come with them.
import { CreateClusterSheet } from './CreateClusterSheet';
import { ElementMenuSheet } from './ElementMenuSheet';
import { MoveSheet } from './MoveSheet';

export function SheetHosts() {
  return (
    <>
      <MoveSheet />
      <ElementMenuSheet />
      <CreateClusterSheet />
    </>
  );
}
