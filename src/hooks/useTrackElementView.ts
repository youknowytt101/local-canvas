// Cosmos' useTrackElementView (module 2707): while the viewer is focused on an element (and was not opened from the
// canvas), it is being viewed. Starting counts the view (ViewElement, here POST /api/elements/:id/view: its views are
// For You's taste); leaving it (another element, another screen, the app going to the background) sends an
// ElementViewed event with how long it was on screen (viewTime), its list (userInteractionSource) and slate. Going to
// the background only ends the view; coming back does not start a new one of the same element.
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { api } from '../lib/api';
import { gql } from '../lib/auth';
import type { Element } from '../lib/elements';

export function recordElementEvent(elementId: string, input: Record<string, unknown>) {
  gql('mutation', 'RecordElementEvent', 'recordElementEvent', { id: elementId, input }).catch(() => undefined);
}

export function useTrackElementView(element: Element | null, enabled: boolean, userInteractionSource: string) {
  const viewing = useRef<{ id: string; startMs: number; slateId: string | null } | null>(null);
  const paused = useRef<string | null>(null);

  const end = () => {
    const v = viewing.current;
    if (!v) return;
    viewing.current = null;
    recordElementEvent(v.id, { eventType: 'ElementViewed', viewTime: Math.max(0, Date.now() - v.startMs), userInteractionSource, slateId: v.slateId });
  };

  const id = enabled && userInteractionSource !== 'Canvas' ? element?.id ?? null : null;
  useEffect(() => {
    if (!id || id === paused.current) return;
    paused.current = null;
    viewing.current = { id, startMs: Date.now(), slateId: element?.slateId ?? null };
    api('POST', `/api/elements/${encodeURIComponent(id)}/view`).catch(() => undefined);
    return end;
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') return;
      paused.current = viewing.current?.id ?? null;
      end();
    });
    return () => sub.remove();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
