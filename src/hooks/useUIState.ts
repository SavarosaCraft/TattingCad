// useUIState.ts — All dialog, menu, and UI visibility state
// Pure UI state with no domain logic dependencies.

import { useState } from 'react';

export function useUIState() {
  // ── Menus ──────────────────────────────────────────────────────────────
  const [showFileMenu, setShowFileMenu] = useState(false);
  const [showHelpMenu, setShowHelpMenu] = useState(false);
  const [showArrangeMenu, setShowArrangeMenu] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showViewMenu, setShowViewMenu] = useState(false);

  // ── Dialogs ────────────────────────────────────────────────────────────
  const [showHelp, setShowHelp] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showUiGuide, setShowUiGuide] = useState(false);
  const [showSplash, setShowSplash] = useState<boolean>(true);
  const [showUpdatePopup, setShowUpdatePopup] = useState<boolean>(false);
  const [showUpdateReminder, setShowUpdateReminder] = useState<boolean>(false);
  const [showNewCanvasDialog, setShowNewCanvasDialog] = useState(false);
  const [showRecentProjectsDialog, setShowRecentProjectsDialog] = useState(false);
  const [showRecentLoadConfirm, setShowRecentLoadConfirm] = useState(false);
  const [showLoadConfirmDialog, setShowLoadConfirmDialog] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [showBeadLibrary, setShowBeadLibrary] = useState(false);
  const [showMaterialsPanel, setShowMaterialsPanel] = useState(false);
  const [showThreadProperties, setShowThreadProperties] = useState(false);
  const [showPolarGridPanel, setShowPolarGridPanel] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showJoinTip, setShowJoinTip] = useState(
    () => localStorage.getItem('tcad_seen_join_tip') !== '1'
  );
  const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [alertDialog, setAlertDialog] = useState<{ message: string } | null>(null);

  // ── Array dialogs ──────────────────────────────────────────────────────
  const [showPolarArrayDialog, setShowPolarArrayDialog] = useState(false);
  const [polarArrayPeek, setPolarArrayPeek] = useState(false);
  const [polarArrayCount, setPolarArrayCount] = useState(6);
  const [polarArrayAngle, setPolarArrayAngle] = useState(360);
  const [polarArrayPivotId, setPolarArrayPivotId] = useState<string | 'selection' | null>(null);

  const [showLinearArrayDialog, setShowLinearArrayDialog] = useState(false);
  const [linearArrayPeek, setLinearArrayPeek] = useState(false);
  const [linearArrayCount, setLinearArrayCount] = useState(4);
  const [linearArrayAngle, setLinearArrayAngle] = useState(0);
  const [linearArraySpacing, setLinearArraySpacing] = useState(60);
  const [linearArrayRotStep, setLinearArrayRotStep] = useState(0);

  const [showSpiralArrayDialog, setShowSpiralArrayDialog] = useState(false);
  const [spiralArrayPeek, setSpiralArrayPeek] = useState(false);
  const [spiralArrayCount, setSpiralArrayCount] = useState(8);
  const [spiralArrayType, setSpiralArrayType] = useState<'archimedean' | 'geometric'>('archimedean');
  const [spiralArrayGap, setSpiralArrayGap] = useState(40);
  const [spiralArrayGrowth, setSpiralArrayGrowth] = useState(1.2);
  const [spiralArrayRotate, setSpiralArrayRotate] = useState(true);
  const [spiralArrayAngleStep, setSpiralArrayAngleStep] = useState(30);

  // ── Polar grid ─────────────────────────────────────────────────────────
  const [polarGridPeek, setPolarGridPeek] = useState(false);

  // ── Color picker ───────────────────────────────────────────────────────
  const [colorPickerTab, setColorPickerTab] = useState('picker');
  const [pickerTabsAllowed, setPickerTabsAllowed] = useState<string[] | null>(null);
  const [pickerColor, setPickerColor] = useState('#FFFFFF');
  const [pickerCallback, setPickerCallback] = useState<((color: string) => void) | null>(null);
  const [pickerGradientCallback, setPickerGradientCallback] = useState<((id: string) => void) | null>(null);
  const [editingColorIndex, setEditingColorIndex] = useState<number | null>(null);
  const [selectedGradient, setSelectedGradient] = useState<any>(null);
  const [gradientSearchTerm, setGradientSearchTerm] = useState('');
  const [gradientCategory, setGradientCategory] = useState('all');
  const [gradientPage, setGradientPage] = useState(0);

  // ── DMC color picker ───────────────────────────────────────────────────
  const [selectedDmcColor, setSelectedDmcColor] = useState<any>(null);
  const [dmcSearchTerm, setDmcSearchTerm] = useState('');
  const [dmcPage, setDmcPage] = useState(0);
  const [dmcCategory, setDmcCategory] = useState('all');

  // ── Canvas view toggles ────────────────────────────────────────────────
  const [showRotationHandles, setShowRotationHandles] = useState(false);
  const [showUnnumbered, setShowUnnumbered] = useState(false);
  const [showInvalidNotation, setShowInvalidNotation] = useState(true);
  const [showEditingArtifacts, setShowEditingArtifacts] = useState(true);

  // ── Misc UI ────────────────────────────────────────────────────────────
  const [notesOpen, setNotesOpen] = useState(false);
  const [loadMsg, setLoadMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [pendingRecentLoad, setPendingRecentLoad] = useState<(() => void) | null>(null);
  const [selectedBeadId, setSelectedBeadId] = useState<string | null>(null);
  const [resolvedHelpUrl, setResolvedHelpUrl] = useState('./tatting-help.html');
  const [helpUrlReady, setHelpUrlReady] = useState(false);
  const [resolvedUiGuideUrl, setResolvedUiGuideUrl] = useState('./tatting-ui-guide.html');
  const [uiGuideUrlReady, setUiGuideUrlReady] = useState(false);

  return {
    // Menus
    showFileMenu, setShowFileMenu,
    showHelpMenu, setShowHelpMenu,
    showArrangeMenu, setShowArrangeMenu,
    showOptionsMenu, setShowOptionsMenu,
    showViewMenu, setShowViewMenu,
    // Dialogs
    showHelp, setShowHelp,
    showAbout, setShowAbout,
    showUiGuide, setShowUiGuide,
    showSplash, setShowSplash,
    showUpdatePopup, setShowUpdatePopup,
    showUpdateReminder, setShowUpdateReminder,
    showNewCanvasDialog, setShowNewCanvasDialog,
    showRecentProjectsDialog, setShowRecentProjectsDialog,
    showRecentLoadConfirm, setShowRecentLoadConfirm,
    showLoadConfirmDialog, setShowLoadConfirmDialog,
    showRemoveConfirm, setShowRemoveConfirm,
    showBeadLibrary, setShowBeadLibrary,
    showMaterialsPanel, setShowMaterialsPanel,
    showThreadProperties, setShowThreadProperties,
    showPolarGridPanel, setShowPolarGridPanel,
    showColorPicker, setShowColorPicker,
    showJoinTip, setShowJoinTip,
    confirmDialog, setConfirmDialog,
    alertDialog, setAlertDialog,
    // Array dialogs
    showPolarArrayDialog, setShowPolarArrayDialog,
    polarArrayPeek, setPolarArrayPeek,
    polarArrayCount, setPolarArrayCount,
    polarArrayAngle, setPolarArrayAngle,
    polarArrayPivotId, setPolarArrayPivotId,
    showLinearArrayDialog, setShowLinearArrayDialog,
    linearArrayPeek, setLinearArrayPeek,
    linearArrayCount, setLinearArrayCount,
    linearArrayAngle, setLinearArrayAngle,
    linearArraySpacing, setLinearArraySpacing,
    linearArrayRotStep, setLinearArrayRotStep,
    showSpiralArrayDialog, setShowSpiralArrayDialog,
    spiralArrayPeek, setSpiralArrayPeek,
    spiralArrayCount, setSpiralArrayCount,
    spiralArrayType, setSpiralArrayType,
    spiralArrayGap, setSpiralArrayGap,
    spiralArrayGrowth, setSpiralArrayGrowth,
    spiralArrayRotate, setSpiralArrayRotate,
    spiralArrayAngleStep, setSpiralArrayAngleStep,
    // Polar grid
    polarGridPeek, setPolarGridPeek,
    // Color picker
    colorPickerTab, setColorPickerTab,
    pickerTabsAllowed, setPickerTabsAllowed,
    pickerColor, setPickerColor,
    pickerCallback, setPickerCallback,
    pickerGradientCallback, setPickerGradientCallback,
    editingColorIndex, setEditingColorIndex,
    selectedGradient, setSelectedGradient,
    gradientSearchTerm, setGradientSearchTerm,
    gradientCategory, setGradientCategory,
    gradientPage, setGradientPage,
    // DMC
    selectedDmcColor, setSelectedDmcColor,
    dmcSearchTerm, setDmcSearchTerm,
    dmcPage, setDmcPage,
    dmcCategory, setDmcCategory,
    // Canvas view toggles
    showRotationHandles, setShowRotationHandles,
    showUnnumbered, setShowUnnumbered,
    showInvalidNotation, setShowInvalidNotation,
    showEditingArtifacts, setShowEditingArtifacts,
    // Misc
    notesOpen, setNotesOpen,
    loadMsg, setLoadMsg,
    pendingRecentLoad, setPendingRecentLoad,
    selectedBeadId, setSelectedBeadId,
    resolvedHelpUrl, setResolvedHelpUrl,
    helpUrlReady, setHelpUrlReady,
    resolvedUiGuideUrl, setResolvedUiGuideUrl,
    uiGuideUrlReady, setUiGuideUrlReady,
  };
}
