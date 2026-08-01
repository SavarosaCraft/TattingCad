// components/TopMenuBar.tsx
//
// Row 1 of the two-row header: File/View dropdown triggers, Undo/Redo,
// Copy/Cut/Paste, Send-to-back/Bring-to-front, Fit All, and the
// Arrange/Options/Help dropdown triggers. Extracted from tattingindex.tsx
// (see architecture.md — properties-bar mode dispatch / charted structure).
//
// This is the one section in the "Chrome" div where a large flat prop list
// is the accepted trade-off rather than a sign something's wrong — it's
// genuinely the app's central control row and touches a wide slice of
// state by nature. See architecture.md's note on Properties vs Canvas+Toolbar
// overlap for why this doesn't need Context/reducer to extract safely: the
// dropdown menus this triggers (DropdownMenu.tsx instances) already live as
// separate floating overlays elsewhere, so this component only owns the
// trigger buttons and the direct-action buttons (undo/redo/clipboard/etc),
// not any dropdown content itself.
import React from 'react';
import {
  IconMenu, IconChevronDown, IconEyeOn, IconUndo, IconRedo, IconCopy,
  IconCut, IconPaste, IconSendToBack, IconBringToFront, IconFitView,
  IconAlignMiddle, IconSettings, IconHelp,
} from './icons';

interface TopMenuBarProps {
  fileButtonRef: React.RefObject<HTMLButtonElement>;
  viewButtonRef: React.RefObject<HTMLButtonElement>;
  arrangeButtonRef: React.RefObject<HTMLButtonElement>;
  optionsButtonRef: React.RefObject<HTMLButtonElement>;
  helpButtonRef: React.RefObject<HTMLButtonElement>;
  showFileMenu: boolean;
  showViewMenu: boolean;
  onToggleFileMenu: () => void;
  onToggleViewMenu: () => void;
  onToggleArrangeMenu: () => void;
  onToggleOptionsMenu: () => void;
  onToggleHelpMenu: () => void;

  undo: () => void;
  redo: () => void;
  historyIndex: number;
  historyLength: number;
  activeMode: string | null;

  onCopy: () => void;
  onCut: () => void;
  onPaste: () => void;
  copyCutDisabled: boolean;
  pasteDisabled: boolean;

  sendToBack: () => void;
  bringToFront: () => void;
  arrangeDisabled: boolean;

  fitAllElements: () => void;
  fitAllDisabled: boolean;

  t: (key: string) => string;
}

export const TopMenuBar: React.FC<TopMenuBarProps> = ({
  fileButtonRef, viewButtonRef, arrangeButtonRef, optionsButtonRef, helpButtonRef,
  showFileMenu, showViewMenu,
  onToggleFileMenu, onToggleViewMenu, onToggleArrangeMenu, onToggleOptionsMenu, onToggleHelpMenu,
  undo, redo, historyIndex, historyLength, activeMode,
  onCopy, onCut, onPaste, copyCutDisabled, pasteDisabled,
  sendToBack, bringToFront, arrangeDisabled,
  fitAllElements, fitAllDisabled,
  t,
}) => {
  const undoRedoDisabled = activeMode === 'beading' || activeMode === 'tattingOrder';
  const wideBtn = { height: '44px', width: window.innerWidth <= 768 ? '44px' : 'auto' } as const;
  const squareBtn = { width: '44px', height: '44px' } as const;

  return (
    <div className="top-row-buttons min-h-12 flex flex-wrap items-center px-4 mobile-no-padding gap-1 md:gap-4 border-b border-gray-700 py-1 md:py-2">
      {/* File operations dropdown menu */}
      <div className="relative" style={{ overflow: 'visible' }}>
        <button
          ref={fileButtonRef}
          onClick={onToggleFileMenu}
          className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded"
          style={{ height: '44px' }}
          title={t('menuFileTitle')}
        >
          <IconMenu size={18} />
          <span className="text-sm font-semibold hide-label-mobile">{t('menuFile')}</span>
          <IconChevronDown size={14} />
        </button>
      </div>

      {/* View menu */}
      <div className="relative" style={{ overflow: 'visible' }}>
        <button
          ref={viewButtonRef}
          onClick={onToggleViewMenu}
          className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded flex items-center gap-2 justify-center"
          style={wideBtn}
          title={t('menuViewTitle')}
        >
          <IconEyeOn size={18} />
          <span className="text-sm font-medium hide-label-mobile">{t('menuView')}</span>
          <IconChevronDown size={14} className="hide-label-mobile" />
        </button>
      </div>

      {/* Divider */}
      <div className="w-px h-8 bg-gray-600"></div>

      {/* Undo/Redo/Copy/Paste — centered in remaining space */}
      <div className="flex-1 flex items-center justify-center gap-1">
        <button
          onClick={undo}
          className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          style={squareBtn}
          title={t('btnUndo')}
          disabled={historyIndex === 0 || undoRedoDisabled}
        >
          <IconUndo size={20} />
        </button>
        <button
          onClick={redo}
          className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          style={squareBtn}
          title={t('btnRedo')}
          disabled={historyIndex >= historyLength - 1 || undoRedoDisabled}
        >
          <IconRedo size={20} />
        </button>

        <button
          onClick={onCopy}
          className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          style={squareBtn}
          title={t('btnCopy')}
          disabled={copyCutDisabled}
        >
          <IconCopy size={20} />
        </button>

        <button
          onClick={onCut}
          className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          style={squareBtn}
          title={t('btnCut')}
          disabled={copyCutDisabled}
        >
          <IconCut size={20} />
        </button>

        <button
          onClick={onPaste}
          className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          style={squareBtn}
          title={t('btnPaste')}
          disabled={pasteDisabled}
        >
          <IconPaste size={20} />
        </button>

        <div className="w-px h-6 bg-gray-600 mx-0.5" />

        <button
          onClick={sendToBack}
          className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          style={squareBtn}
          title={t('btnSendToBack')}
          disabled={arrangeDisabled}
        >
          <IconSendToBack size={20} />
        </button>

        <button
          onClick={bringToFront}
          className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          style={squareBtn}
          title={t('btnBringToFront')}
          disabled={arrangeDisabled}
        >
          <IconBringToFront size={20} />
        </button>
      </div>{/* end centered flex */}

      <button
        onClick={fitAllElements}
        className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
        style={squareBtn}
        title={t('btnFitAll')}
        disabled={fitAllDisabled}
      >
        <IconFitView size={20} />
      </button>

      {/* Arrange menu (Duplicate + Alignment) */}
      <button
        ref={arrangeButtonRef}
        onClick={onToggleArrangeMenu}
        className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded flex items-center gap-2 justify-center"
        style={wideBtn}
        title={t('menuArrangeTitle')}
      >
        <IconAlignMiddle size={18} />
        <span className="text-sm font-medium hide-label-mobile">{t('menuArrange')}</span>
        <IconChevronDown size={14} className="hide-label-mobile" />
      </button>

      {/* Divider */}
      <div className="w-px h-8 bg-gray-600"></div>

      {/* Options menu (BG, Grid, Snap) */}
      <button
        ref={optionsButtonRef}
        onClick={onToggleOptionsMenu}
        className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded flex items-center gap-2 justify-center"
        style={wideBtn}
        title={t('menuOptions')}
      >
        <IconSettings size={18} />
        <span className="text-sm font-medium hide-label-mobile">{t('menuOptions')}</span>
        <IconChevronDown size={14} className="hide-label-mobile" />
      </button>

      {/* Divider */}
      <div className="w-px h-8 bg-gray-600"></div>

      {/* Help / About dropdown */}
      <button
        ref={helpButtonRef}
        onClick={onToggleHelpMenu}
        className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded flex items-center gap-1 justify-center"
        style={{ height: '44px' }}
        title={t('menuHelpDropdown')}
      >
        <IconHelp size={20} />
        <span className="text-xs">&#9660;</span>
      </button>
    </div>
  );
};
