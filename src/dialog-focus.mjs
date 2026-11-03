// R16: small, pure focus-navigation helpers for the repository dialog.
// No global DOM work, storage, networking, or security/approval side effects.
export const DIALOG_FOCUSABLE_SELECTOR = [
  "a[href]", "button:not([disabled])", "input:not([disabled])",
  "select:not([disabled])", "textarea:not([disabled])",
  "summary", "[tabindex]:not([tabindex='-1'])"
].join(", ");

export function dialogFocusableElements(root) {
  if (!root || typeof root.querySelectorAll !== "function") return [];
  return Array.from(root.querySelectorAll(DIALOG_FOCUSABLE_SELECTOR))
    .filter(node => {
      if (!node || node.isConnected !== true ||
          typeof node.getClientRects !== "function" ||
          node.getClientRects().length === 0 ||
          node.getAttribute?.("aria-hidden") === "true" ||
          node.closest?.("[inert]")) return false;
      const view = node.ownerDocument?.defaultView;
      const visibility = view?.getComputedStyle?.(node)?.visibility;
      return visibility !== "hidden" && visibility !== "collapse";
    });
}

// Return a target only when Tab would escape the modal.
// Returning null lets the browser preserve its normal tab sequence.
export function wrappedTabTarget(focusables, active, reverse = false) {
  if (!Array.isArray(focusables) || focusables.length === 0) return null;
  const index = focusables.indexOf(active);
  if (index === -1) return reverse ?
    focusables[focusables.length - 1] : focusables[0];
  if (reverse && index === 0) return focusables[focusables.length - 1];
  if (!reverse && index === focusables.length - 1) return focusables[0];
  return null;
}

export function restoreFocusToOpener(opener) {
  if (!opener || opener.isConnected !== true ||
      typeof opener.focus !== "function") return false;
  opener.focus();
  return true;
}
