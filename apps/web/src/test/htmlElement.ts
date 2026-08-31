/**
 * Parses a Testing Library / DOM node to a concrete HTML element.
 * instanceof is the boundary check; tests should not assert these.
 */

export function htmlButton(node: EventTarget | Node | null) {
  if (node instanceof HTMLButtonElement) {
    return node;
  }
  throw new Error("expected HTMLButtonElement");
}

export function htmlInput(node: EventTarget | Node | null) {
  if (node instanceof HTMLInputElement) {
    return node;
  }
  throw new Error("expected HTMLInputElement");
}

export function htmlTextArea(node: EventTarget | Node | null) {
  if (node instanceof HTMLTextAreaElement) {
    return node;
  }
  throw new Error("expected HTMLTextAreaElement");
}

export function htmlImage(node: EventTarget | Node | null) {
  if (node instanceof HTMLImageElement) {
    return node;
  }
  throw new Error("expected HTMLImageElement");
}

export function htmlElement(node: EventTarget | Node | null) {
  if (node instanceof HTMLElement) {
    return node;
  }
  throw new Error("expected HTMLElement");
}
