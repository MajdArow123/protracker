import { Modal } from '../../ui/Modal';
import { PlayerInspectorBody, type InspectorProps } from './PlayerInspector';

// Mobile/tablet inspector: the Phase-1-deferred drawer, delivered by REUSING
// the shared Modal (bottom-sheet on mobile, focus trap, Esc, tap-out) rather
// than a new drawer system. Same body as the desktop panel — one source of truth.
export function InspectorSheet({ isOpen, onClose, ...body }: InspectorProps & {
  isOpen: boolean;
  onClose: () => void;
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={body.player.fullName} size="md">
      <PlayerInspectorBody {...body} />
    </Modal>
  );
}
