// components/PhoneToolBar.tsx
//
// Session 58. The tool bar for a phone held upright: one row of big
// buttons along the bottom of the screen (icon with the label under it),
// plus a "More" button that opens a panel of the remaining tools just
// above the bar. On every other screen shape the left tool rail is used
// instead; which one shows is decided purely by CSS (.phone-toolbar /
// .tool-rail media rules in tattingindex.tsx), so both are always rendered.
//
// The buttons come in as plain descriptors built in tattingindex.tsx
// (phoneMainTools / phoneMoreTools), so this component has no tool logic.
import React, { useState } from 'react';

export interface PhoneTool {
  key: string;
  label: string;
  title?: string;
  icon: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  /** Tailwind bg-* class used when active (default bg-blue-600). */
  activeColor?: string;
  disabled?: boolean;
}

interface PhoneToolBarProps {
  main: PhoneTool[];
  /** Tools in the "More" panel; no More button when empty. */
  more: PhoneTool[];
  moreLabel: string;
  moreTitle?: string;
}

export const PhoneToolBar: React.FC<PhoneToolBarProps> = ({ main, more, moreLabel, moreTitle }) => {
  const [open, setOpen] = useState(false);
  const anyMoreActive = more.some(m => m.active);

  const button = (tool: PhoneTool, inPanel: boolean) => (
    <button
      key={tool.key}
      onClick={() => { tool.onClick(); if (inPanel) setOpen(false); }}
      disabled={tool.disabled}
      title={tool.title}
      className={[
        inPanel ? 'phone-toolbar-tile' : 'phone-toolbar-btn',
        'flex flex-col items-center justify-center rounded text-white disabled:opacity-30 disabled:cursor-not-allowed',
        tool.active ? (tool.activeColor ?? 'bg-blue-600') : (inPanel ? 'bg-gray-700' : 'bg-transparent'),
      ].join(' ')}
      style={{ touchAction: 'manipulation' }}
    >
      {tool.icon}
      <span className="phone-toolbar-label">{tool.label}</span>
    </button>
  );

  return (
    <div className="phone-toolbar">
      {open && <div className="phone-toolbar-backdrop" onClick={() => setOpen(false)} />}
      {open && more.length > 0 && (
        <div className="phone-toolbar-more">
          {more.map(tool => button(tool, true))}
        </div>
      )}
      <div className="phone-toolbar-row">
        {main.map(tool => button(tool, false))}
        {more.length > 0 && (
          <button
            onClick={() => setOpen(v => !v)}
            title={moreTitle}
            className={`phone-toolbar-btn flex flex-col items-center justify-center rounded text-white ${open ? 'bg-gray-600' : anyMoreActive ? 'bg-gray-700' : 'bg-transparent'}`}
            style={{ touchAction: 'manipulation' }}
            aria-expanded={open}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
            </svg>
            <span className="phone-toolbar-label">{moreLabel}</span>
          </button>
        )}
      </div>
    </div>
  );
};
