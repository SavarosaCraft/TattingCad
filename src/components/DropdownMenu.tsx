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

  const style: React.CSSProperties = {
    backgroundColor: '#374151',
    zIndex: 9999,
    top: rect ? `${rect.bottom + 4}px` : '4rem',
    maxHeight: '80vh',
    overflowY: 'auto',
    ...(rect && spaceRight < width
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
        className="fixed bg-gray-700 rounded shadow-xl"
        style={{ minWidth: width, ...style }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </>
  );
};
