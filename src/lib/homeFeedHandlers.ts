// Cosmos' createNoopHomeFeedHandlers (module 3454): what a home page's feed hands the home screen for its tab being
// pressed again (useTabReselect): refresh, scroll back up, and whether it is at the top; nothing until it is mounted.
export type HomeFeedHandlers = { refresh: () => void; scrollToTop: () => void; isAtTop: () => boolean };

export const createNoopHomeFeedHandlers = (): HomeFeedHandlers => ({ refresh: () => undefined, scrollToTop: () => undefined, isAtTop: () => true });
