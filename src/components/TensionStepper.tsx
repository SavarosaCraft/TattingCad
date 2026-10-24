// components/TensionStepper.tsx
//
// "Tension" control in the property bars (single select, free multi-select,
// group) — session 57. Replaces the earlier "Tension" apply button.
//
// Shows the selected rings' tension (1 tight … 5 loose); "–" when they
// differ; the user's default when nothing selected uses tension (chains,
// circles…). Changing it — −/+ in steps of 0.5 or typing any 1–5 value —
// calls setTensionForIds in tattingindex.tsx, which resizes the eligible
// selected elements (one undo step) AND makes the value the default for new
// rings, the way picking a material does. See "Tension" in architecture.md.
import React from 'react';
import { NumberStepper } from './NumberStepper';
import { MIN_TENSION, MAX_TENSION } from '../geometry/stitchGeometry';

export interface TensionInfo { value: number; mixed: boolean }

interface TensionStepperProps {
  ids: string[];
  tensionInfoForIds: (ids: string[]) => TensionInfo;
  setTensionForIds: (ids: string[], tension: number) => void;
  t: (key: string) => string;
}

export const TensionStepper: React.FC<TensionStepperProps> = ({ ids, tensionInfoForIds, setTensionForIds, t }) => {
  const info = tensionInfoForIds(ids);
  return (
    <div className="flex items-center gap-0.5 md:gap-2 top-toolbar-scalable">
      <label className="text-xs text-gray-400 hide-label-mobile">{t('propApplyEndAllowanceBtn')}</label>
      <NumberStepper
        value={info.value}
        min={MIN_TENSION}
        max={MAX_TENSION}
        step={0.5}
        decimals={1}
        mixedText={info.mixed ? '–' : undefined}
        title={t('propApplyEndAllowance')}
        onCommit={(v) => setTensionForIds(ids, v)}
      />
    </div>
  );
};
