// Cosmos' SheetHosts (module 3027, rendered by MainNavigator): the sheets any screen can open by name. So far the save
// sheet (SHEET_NAMES.MOVE), the element's 更多 menu, the create-collection sheet and who has an element
// (ElementConnectionsSheet); the connections and share sheets come with them.
import { CreateClusterSheet } from './CreateClusterSheet';
import { ElementConnectionsSheet } from './ElementConnectionsSheet';
import { ElementMenuSheet } from './ElementMenuSheet';
import { MoveSheet } from './MoveSheet';

export function SheetHosts() {
  return (
    <>
      <MoveSheet />
      <ElementMenuSheet />
      <CreateClusterSheet />
      <ElementConnectionsSheet />
    </>
  );
}
