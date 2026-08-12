import { currentBlockId } from "./blocks";

export interface SelectionState {
  blockId: string | null;
  anchorOffset: number;
  focusOffset: number;
  collapsed: boolean;
}

export function getSelectionState(root: HTMLElement): SelectionState {
  const selection = root.ownerDocument.getSelection();
  return {
    blockId: currentBlockId(root),
    anchorOffset: selection?.anchorOffset ?? 0,
    focusOffset: selection?.focusOffset ?? 0,
    collapsed: selection?.isCollapsed ?? true,
  };
}

