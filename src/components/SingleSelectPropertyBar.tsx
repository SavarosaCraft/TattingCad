import React from 'react';
import { LineElementPropertyBar } from './LineElementPropertyBar';
import { GeneralElementPropertyBar } from './GeneralElementPropertyBar';
import { MaterialAssignmentDropdown } from './MaterialAssignmentDropdown';

// Extracted from tattingindex.tsx (single-select property bar dispatcher).
// Pure relocation — no logic changes. Verify against original lines 7159–7713.
// Combines: type dispatch (line vs. general) + shared material-assignment dropdown,
// which sits AFTER the dispatch as a sibling (applies to both branches).

interface SingleSelectPropertyBarProps {
  selectedElement: any;
  selectedIds: (string | number)[];
  selectedIdSet: Set<any>;
  elements: any[];
  elementsRef: React.MutableRefObject<any[]>;
  elementById: Map<any, any>;
  rounds: any[];
  roundsRef: React.MutableRefObject<any[]>;
  polarGrids: any[];
  dsWidth: number;
  materials: any[];
  beadLibrary: any;
  lineBeadClipboard: any;
  draftNotation: any;
  notationError: any;
  propBarOrderDraft: string | null;
  showPropBarGroupDropdown: boolean;
  propBarGroupButtonRef: React.RefObject<HTMLButtonElement>;
  showPicotWizard: boolean;
  picotWizardFillGap: any;
  picotWizardScalePct: number;
  picotWizardSide: any;
  picotWizardSymmetric: boolean;
  isInteractingRef: React.MutableRefObject<boolean>;
  needsHistoryPushRef: React.MutableRefObject<boolean>;
  notationEscapeRef: React.MutableRefObject<any>;
  pendingNotationRef: React.MutableRefObject<any>;
  picotConnectionsRef: React.MutableRefObject<any>;
  renderRotateFlipControls: () => React.ReactNode;
  getRoundId: (el: any) => any;
  getGradientColorAtPosition: (color: any, pos: number) => string;
  parseNotation: (notation: string) => any;
  updateNotation: (notation: string, notationB: string | null, id: any, options?: any) => void;
  convertToJosephineKnot: (...args: any[]) => void;
  toggleShape: (...args: any[]) => void;
  setLabelOffset: (...args: any[]) => void;
  commitOrderDraft: (id: any, draft: string | null, el?: any) => void;
  pushHistoryState: (els: any[], picotConnections: any, rounds: any[]) => void;
  pushOrderHistory: (...args: any[]) => void;
  setAlertDialog: (v: any) => void;
  setDraftNotation: (v: any) => void;
  setNotationError: (v: any) => void;
  setElements: (fn: any[] | ((prev: any[]) => any[])) => void;
  setRounds: (rounds: any[] | ((prev: any[]) => any[])) => void;
  setPivotOffset: (v: any) => void;
  setPropBarOrderDraft: (v: string | null) => void;
  setShowPropBarGroupDropdown: (v: boolean | ((d: boolean) => boolean)) => void;
  setShowMaterialsPanel: (v: boolean) => void;
  setShowPicotWizard: (v: boolean) => void;
  setPicotWizardFillGap: (v: any) => void;
  setPicotWizardScalePct: (v: number) => void;
  setPicotWizardSide: (v: any) => void;
  setPicotWizardSymmetric: (v: boolean) => void;
  setLineBeadClipboard: (v: any) => void;
  updateElement: (...args: any[]) => void;
  updateWhere: (...args: any[]) => void;
  t: (key: string) => string;
}

export function SingleSelectPropertyBar(props: SingleSelectPropertyBarProps) {
  const { selectedElement } = props;
  return (
    <>
      {selectedElement.type === 'line' ? (
        <LineElementPropertyBar
          selectedElement={props.selectedElement}
          selectedIds={props.selectedIds}
          elements={props.elements}
          elementsRef={props.elementsRef}
          rounds={props.rounds}
          roundsRef={props.roundsRef}
          beadLibrary={props.beadLibrary}
          lineBeadClipboard={props.lineBeadClipboard}
          propBarOrderDraft={props.propBarOrderDraft}
          showPropBarGroupDropdown={props.showPropBarGroupDropdown}
          propBarGroupButtonRef={props.propBarGroupButtonRef}
          picotConnectionsRef={props.picotConnectionsRef}
          renderRotateFlipControls={props.renderRotateFlipControls}
          getRoundId={props.getRoundId}
          commitOrderDraft={props.commitOrderDraft}
          pushHistoryState={props.pushHistoryState}
          setPropBarOrderDraft={props.setPropBarOrderDraft}
          setShowPropBarGroupDropdown={props.setShowPropBarGroupDropdown}
          setElements={props.setElements}
          setRounds={props.setRounds}
          setLineBeadClipboard={props.setLineBeadClipboard}
          updateElement={props.updateElement}
          updateWhere={props.updateWhere}
          t={props.t}
        />
      ) : (
        <GeneralElementPropertyBar
          selectedElement={props.selectedElement}
          selectedIdSet={props.selectedIdSet}
          elements={props.elements}
          elementsRef={props.elementsRef}
          elementById={props.elementById}
          rounds={props.rounds}
          roundsRef={props.roundsRef}
          polarGrids={props.polarGrids}
          dsWidth={props.dsWidth}
          draftNotation={props.draftNotation}
          notationError={props.notationError}
          propBarOrderDraft={props.propBarOrderDraft}
          showPropBarGroupDropdown={props.showPropBarGroupDropdown}
          propBarGroupButtonRef={props.propBarGroupButtonRef}
          showPicotWizard={props.showPicotWizard}
          picotWizardFillGap={props.picotWizardFillGap}
          picotWizardScalePct={props.picotWizardScalePct}
          picotWizardSide={props.picotWizardSide}
          picotWizardSymmetric={props.picotWizardSymmetric}
          isInteractingRef={props.isInteractingRef}
          needsHistoryPushRef={props.needsHistoryPushRef}
          notationEscapeRef={props.notationEscapeRef}
          pendingNotationRef={props.pendingNotationRef}
          picotConnectionsRef={props.picotConnectionsRef}
          renderRotateFlipControls={props.renderRotateFlipControls}
          getRoundId={props.getRoundId}
          getGradientColorAtPosition={props.getGradientColorAtPosition}
          parseNotation={props.parseNotation}
          updateNotation={props.updateNotation}
          convertToJosephineKnot={props.convertToJosephineKnot}
          toggleShape={props.toggleShape}
          setLabelOffset={props.setLabelOffset}
          commitOrderDraft={props.commitOrderDraft}
          pushHistoryState={props.pushHistoryState}
          pushOrderHistory={props.pushOrderHistory}
          setAlertDialog={props.setAlertDialog}
          setDraftNotation={props.setDraftNotation}
          setNotationError={props.setNotationError}
          setElements={props.setElements}
          setRounds={props.setRounds}
          setPivotOffset={props.setPivotOffset}
          setPropBarOrderDraft={props.setPropBarOrderDraft}
          setShowPropBarGroupDropdown={props.setShowPropBarGroupDropdown}
          setShowPicotWizard={props.setShowPicotWizard}
          setPicotWizardFillGap={props.setPicotWizardFillGap}
          setPicotWizardScalePct={props.setPicotWizardScalePct}
          setPicotWizardSide={props.setPicotWizardSide}
          setPicotWizardSymmetric={props.setPicotWizardSymmetric}
          t={props.t}
        />
      )}
      <MaterialAssignmentDropdown
        selectedElement={props.selectedElement}
        selectedIdSet={props.selectedIdSet}
        materials={props.materials}
        getGradientColorAtPosition={props.getGradientColorAtPosition}
        setElements={props.setElements}
        setShowMaterialsPanel={props.setShowMaterialsPanel}
        t={props.t}
      />
    </>
  );
}
