// Cosmos' SheetHosts (module 3027, rendered by MainNavigator): the sheets any screen can open by name. So far the save
// sheet (SHEET_NAMES.MOVE), the element's 更多 menu, the create-collection sheet and who has an element
// (ElementConnectionsSheet), a collection's 更多 (ClusterMenuSheet), its people and invite link
// (CollaboratorsSheet / InviteLinkSheet), reporting (ReportSheet), someone's profile menu (UserMenuSheet); the connections and share sheets come with them.
import { ClusterMenuSheet } from './ClusterMenuSheet';
import { CollaboratorsSheet, InviteLinkSheet } from './CollaboratorsSheet';
import { ReportSheet } from './ReportSheet';
import { UserMenuSheet } from './UserMenuSheet';
import { CreateClusterSheet } from './CreateClusterSheet';
import { CreateNoteSheet, CreateSheet, CreateUrlSheet } from './CreateSheets';
import { ElementConnectionsSheet } from './ElementConnectionsSheet';
import { ElementMenuSheet } from './ElementMenuSheet';
import { MoveSheet } from './MoveSheet';

export function SheetHosts() {
  return (
    <>
      <MoveSheet />
      <ElementMenuSheet />
      <CreateSheet />
      <CreateUrlSheet />
      <CreateNoteSheet />
      <CreateClusterSheet />
      <ElementConnectionsSheet />
      <ClusterMenuSheet />
      <CollaboratorsSheet />
      <InviteLinkSheet />
      <ReportSheet />
      <UserMenuSheet />
    </>
  );
}
