// useTattingOrder.ts — Tatting order mode state
// Covers rounds, active round, conflict resolution, input, and group dropdown UI.

import { useState } from 'react';

export function useTattingOrder() {
  const [rounds, setRounds] = useState<{ id: string; name: string }[]>([]);
  const [activeRoundId, setActiveRoundId] = useState<string | null>(null);
  const [tattingOrderConflict, setTattingOrderConflict] = useState<{
    newNum: number;
    existingElId: string;
    targetElId: string;
  } | null>(null);
  const [tattingOrderInput, setTattingOrderInput] = useState('');

  // Group dropdown UI state
  const [newGroupNameInput, setNewGroupNameInput] = useState('');
  const [showNewGroupInput, setShowNewGroupInput] = useState(false);
  const [renamingGroupId, setRenamingGroupId] = useState<string | null>(null);
  const [renameGroupInput, setRenameGroupInput] = useState('');
  const [showGroupDropdown, setShowGroupDropdown] = useState(false);
  const [showPropBarGroupDropdown, setShowPropBarGroupDropdown] = useState(false);
  const [propBarOrderDraft, setPropBarOrderDraft] = useState<string | null>(null);

  return {
    rounds, setRounds,
    activeRoundId, setActiveRoundId,
    tattingOrderConflict, setTattingOrderConflict,
    tattingOrderInput, setTattingOrderInput,
    newGroupNameInput, setNewGroupNameInput,
    showNewGroupInput, setShowNewGroupInput,
    renamingGroupId, setRenamingGroupId,
    renameGroupInput, setRenameGroupInput,
    showGroupDropdown, setShowGroupDropdown,
    showPropBarGroupDropdown, setShowPropBarGroupDropdown,
    propBarOrderDraft, setPropBarOrderDraft,
  };
}
