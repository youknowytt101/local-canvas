// Collections changed on another screen (organized: reordered, elements taken out or moved), so the collection's own
// page reads its elements again when it comes back.
const changed = new Set<string>();

export const markClusterChanged = (id: string) => { changed.add(id); };
export const takeClusterChanged = (id: string) => changed.delete(id);
