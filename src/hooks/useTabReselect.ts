// Cosmos' useTabReselect (module 3223) with resolveTabReselect (module 3224): on each new token of its tab (the tab
// pressed again while it is the one on screen), a list that is the active one refreshes when it is already at the top
// and otherwise scrolls back up; one that is not active lets the token go by. The token it mounted with is not acted on.
import { useEffect, useRef } from 'react';
import type { BottomTabRouteName } from '../navigation/routes';
import { useTabDoubleTapStore } from '../stores/useTabDoubleTapStore';

// module 1748: a list scrolled at most this far is at its top
export const SCROLL_AT_TOP_THRESHOLD = 0.5;

type Action = 'none' | 'refresh' | 'scroll-to-top';

export function resolveTabReselect({ token, lastHandledToken, isActive, isAtTop }: {
  token: number; lastHandledToken: number; isActive: boolean; isAtTop: boolean;
}): { action: Action; nextLastHandledToken: number } {
  if (token === lastHandledToken) return { action: 'none', nextLastHandledToken: lastHandledToken };
  if (!isActive) return { action: 'none', nextLastHandledToken: token };
  return { action: isAtTop ? 'refresh' : 'scroll-to-top', nextLastHandledToken: token };
}

export function useTabReselect({ tab, isActive, isAtTop, refresh, scrollToTop }: {
  tab: BottomTabRouteName;
  isActive: () => boolean;
  isAtTop: () => boolean;
  refresh: () => void;
  scrollToTop: () => void;
}) {
  const token = useTabDoubleTapStore((s) => s.tokens[tab]);
  const lastHandledToken = useRef(token);
  const handlers = useRef({ isActive, isAtTop, refresh, scrollToTop });
  handlers.current = { isActive, isAtTop, refresh, scrollToTop };
  useEffect(() => {
    const h = handlers.current;
    const { action, nextLastHandledToken } = resolveTabReselect({
      token, lastHandledToken: lastHandledToken.current, isActive: h.isActive(), isAtTop: h.isAtTop(),
    });
    lastHandledToken.current = nextLastHandledToken;
    if (action === 'refresh') h.refresh();
    else if (action === 'scroll-to-top') h.scrollToTop();
  }, [token]);
}
