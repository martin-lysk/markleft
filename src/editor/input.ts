export interface CompositionState {
  composing: boolean;
}

export function trackComposition(element: HTMLElement, state: CompositionState): void {
  element.addEventListener("compositionstart", () => {
    state.composing = true;
  });
  element.addEventListener("compositionend", () => {
    state.composing = false;
    element.dispatchEvent(new Event("local-md-sync", { bubbles: true }));
  });
}

