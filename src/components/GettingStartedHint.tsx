// components/GettingStartedHint.tsx
//
// Session 58 (beginner friendliness). Shown in the otherwise-empty top
// property bar when nothing is selected (same slot as the old
// "Select an element to edit its properties" placeholder, so it never
// competes with the mode bars, realistic view or the image controls).
//
// Tells a newcomer the next step, with the actual tool buttons inline, so
// they can click them right there instead of hunting in the left toolbar:
//   - empty pattern           → add a ring / split ring / chain, or load a
//                               reference image to trace over
//   - exactly one element     → pick Select, then click it to edit notation
//   - 2+ elements, no joins   → turn on Picot Join to connect them
//   - otherwise               → the original placeholder text
//
// The sentences come from translations with {token} placeholders where the
// buttons go, so each language can put the buttons wherever its grammar
// needs them. Unknown tokens are left as plain text.
import React from 'react';
import {
  IconAddRing, IconAddSplitRing, IconAddChain, IconImage, IconSelect, IconJoinPicots,
} from './icons';

interface GettingStartedHintProps {
  /** Non-ghost elements in the pattern. */
  elementCount: number;
  /** Whether any picot connection exists. */
  hasConnections: boolean;
  onAddRing: () => void;
  onAddSplitRing: () => void;
  onAddChain: () => void;
  onRefImage: () => void;
  onSelectTool: () => void;
  onPicotJoin: () => void;
  t: (key: string) => string;
}

export type HintStage = 'empty' | 'notation' | 'join' | 'none';

/** Which hint applies. Exported so it can be checked without React. */
export const getHintStage = (elementCount: number, hasConnections: boolean): HintStage => {
  if (elementCount === 0) return 'empty';
  if (elementCount === 1) return 'notation';
  if (!hasConnections) return 'join';
  return 'none';
};

const HintButton: React.FC<{ onClick: () => void; title?: string; children: React.ReactNode }> = ({ onClick, title, children }) => (
  <button
    onClick={onClick}
    title={title}
    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-700 hover:bg-blue-600 text-white text-xs font-semibold align-middle"
    style={{ touchAction: 'manipulation' }}
  >
    {children}
  </button>
);

export const GettingStartedHint: React.FC<GettingStartedHintProps> = ({
  elementCount, hasConnections,
  onAddRing, onAddSplitRing, onAddChain, onRefImage, onSelectTool, onPicotJoin, t,
}) => {
  const stage = getHintStage(elementCount, hasConnections);

  if (stage === 'none') {
    return (
      <span style={{ color: '#4b5563', fontSize: '0.75rem', padding: '0.25rem 0.5rem', userSelect: 'none' }}>
        {t('propEmptyState')}
      </span>
    );
  }

  const buttons: Record<string, React.ReactNode> = {
    ring: <HintButton key="ring" onClick={onAddRing} title={t('toolAddRing')}><IconAddRing size={14} />{t('toolLabelRing')}</HintButton>,
    splitRing: <HintButton key="splitRing" onClick={onAddSplitRing} title={t('toolAddSplitRing')}><IconAddSplitRing size={14} />{t('toolLabelSplitRing')}</HintButton>,
    chain: <HintButton key="chain" onClick={onAddChain} title={t('toolAddChain')}><IconAddChain size={14} />{t('toolLabelChain')}</HintButton>,
    refImage: <HintButton key="refImage" onClick={onRefImage} title={t('toolRefImage')}><IconImage size={14} />{t('toolLabelRefImage')}</HintButton>,
    select: <HintButton key="select" onClick={onSelectTool} title={t('toolSelect')}><IconSelect size={14} />{t('toolLabelSelect')}</HintButton>,
    join: <HintButton key="join" onClick={onPicotJoin} title={t('toolPicotJoin')}><IconJoinPicots size={14} />{t('toolLabelJoin')}</HintButton>,
  };

  const text = t(stage === 'empty' ? 'hintEmpty' : stage === 'notation' ? 'hintNotation' : 'hintJoin');
  const parts = text.split(/(\{\w+\})/);

  return (
    <div className="flex items-center gap-2 w-full min-w-0 px-2 py-1 text-gray-300 text-sm leading-relaxed select-none top-toolbar-scalable">
      <span className="text-amber-400 text-base leading-none" aria-hidden="true">💡</span>
      <span>
        {parts.map((part, i) => {
          const m = part.match(/^\{(\w+)\}$/);
          if (m && buttons[m[1]]) return <React.Fragment key={i}>{buttons[m[1]]}</React.Fragment>;
          return <React.Fragment key={i}>{part}</React.Fragment>;
        })}
      </span>
    </div>
  );
};
