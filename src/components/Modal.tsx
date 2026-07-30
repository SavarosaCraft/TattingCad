// components/Modal.tsx
//
// Generalized dialog shell — backdrop, centering, peek-to-fade, and
// click-outside-to-close. Originally a one-off (`ArrayDialogShell`, used
// only by the Polar/Linear/Spiral array dialogs); generalized per
// architecture.md's note to also cover the Recent Projects dialog, About
// panel, Materials Manager, Bead Library, Polar Grid Panel, Thread
// Properties, Confirm Dialog, and Alert Dialog.
//
// z-index is passed explicitly as two separate numbers rather than derived
// (e.g. base/base+1) because the real call sites don't follow one
// convention: most use a backdrop/wrapper pair one apart, but Confirm and
// Alert both use the SAME literal value (2147483647, the max safe z-index)
// for both layers. Deriving one from the other would have silently changed
// that. Always pass the exact values from the original inline style.
//
// Two other "modal-shaped" spots deliberately do NOT use this component:
// the Ghost Array Manager (no backdrop, no click-outside-close — clicking
// outside currently does nothing) and the small Update toast (no backdrop
// at all, non-blocking). Both differ in actual interaction behavior, not
// just styling, so folding them in here would silently change what they do.
import React from 'react';

interface ModalProps {
  show: boolean;
  /** While true, fades backdrop + wrapper to opacity 0 (drag-to-peek-behind dialogs). Default false. */
  peek?: boolean;
  onClose: () => void;
  backdropZIndex: number;
  wrapperZIndex: number;
  /** Full literal Tailwind classes for the backdrop, e.g. 'bg-black bg-opacity-60'. */
  backdropClassName?: string;
  /** Classes for the content box — override the default padding/gap for custom layouts (e.g. two-pane panels). */
  contentClassName?: string;
  /** Sizing for the content box (width/height/maxHeight/overflow etc). */
  contentStyle?: React.CSSProperties;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  show,
  peek = false,
  onClose,
  backdropZIndex,
  wrapperZIndex,
  backdropClassName = 'bg-black bg-opacity-60',
  contentClassName = 'flex flex-col gap-4 p-5',
  contentStyle,
  children,
}) => {
  if (!show) return null;
  return (
    <>
      <div
        className={`fixed inset-0 ${backdropClassName}`}
        style={{ zIndex: backdropZIndex, opacity: peek ? 0 : 1, transition: 'opacity 0.15s' }}
        onClick={onClose}
      />
      <div
        className="fixed inset-0 flex items-center justify-center pointer-events-none"
        style={{ zIndex: wrapperZIndex, opacity: peek ? 0 : 1, transition: 'opacity 0.15s' }}
      >
        <div
          className={`bg-gray-800 rounded-xl shadow-2xl border border-gray-600 pointer-events-auto ${contentClassName}`}
          style={contentStyle}
          onClick={e => e.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </>
  );
};
