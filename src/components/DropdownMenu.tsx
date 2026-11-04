// components/DropdownMenu.tsx
//
// Shared shell for the top-bar dropdown menus (File, View, Arrange, Options,
// Help). Extracted from 5 near-identical inline blocks in tattingindex.tsx
// (see architecture.md session notes). Handles:
//   - the full-screen click-away overlay
//   - positioning under the trigger button via getBoundingClientRect()
//   - flipping to the left edge when there isn't room to the right
//
// Callers keep their own show/hide state (e.g. showFileMenu) and their own
// button refs (e.g. fileButtonRef) — this component only owns the shell.
import React from 'react';
import { getUiZoom } from '../utils/uiZoom';

interface DropdownMenuProps {
  /** Ref on the button that opened this menu, used to position it. */
  buttonRef: React.RefObject<HTMLElement>;
  /** Called when the click-away overlay (or an item) closes the menu. */
  onClose: () => void;
  /**
   * Menu min-width in px. Also used to decide whether the menu should flip
   * to hang off the left edge of the button instead of the right edge.
   */
  width?: number;
  children: React.ReactNode;
}

export const DropdownMenu: React.FC<DropdownMenuProps> = ({
  buttonRef,
  onClose,
  width = 200,
  children,
}) => {
  const rect = buttonRef.current?.getBoundingClientRect();
  const spaceRight = rect ? window.innerWidth - rect.left : 0;
  // Large size (session 60): the items are scaled by the inner .tcad-zoom
  // wrapper, so the menu is `zoom` times wider than `width` — use that for
  // the flip-left test. The outer box (position, max height, scrolling) is
  // NOT zoomed, so its px positions stay exact.
  const zoom = getUiZoom();
  // maxWidth on the items (unscaled px): a menu hanging off the right edge
  // (flipped, right-anchored) used to stretch to its longest line — e.g. the
  // Options hint on one line. 320 is above every menu's natural width at
  // normal size (widest: Arrange, 287 px), so normal size is unchanged.

  const style: React.CSSProperties = {
    backgroundColor: '#374151',
    zIndex: 9999,
    top: rect ? `${rect.bottom + 4}px` : '4rem',
    // All the height below the button (was 80vh): Large-size menus are
    // taller and would otherwise scroll on a normal laptop screen.
    maxHeight: rect ? `calc(100dvh - ${Math.round(rect.bottom + 12)}px)` : '80vh',
    overflowY: 'auto',
    ...(rect && spaceRight < width * zoom
      ? { right: `${window.innerWidth - rect.right}px` }
      : { left: rect ? `${rect.left}px` : '1rem' }),
    pointerEvents: 'auto',
  };

  return (
    <>
      <div
        className="fixed inset-0"
        style={{ zIndex: 9998, pointerEvents: 'auto' }}
        onClick={onClose}
      />
      <div
        className="fixed bg-gray-700 rounded shadow-xl select-none"
        style={{
          ...style,
          WebkitUserSelect: 'none',
          userSelect: 'none',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="tcad-zoom" style={{ minWidth: width, maxWidth: Math.max(width, 320) }}>
          {children}
        </div>
      </div>
    </>
  );
};
