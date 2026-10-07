import { useEffect, useRef } from "react";

const controls =
  'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

/** Keep keyboard interaction inside an open dialog and return focus to its trigger. */
export function useDialogFocus(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusable = () =>
      Array.from(dialog.querySelectorAll<HTMLElement>(controls)).filter(
        (el) => !el.hidden && el.getAttribute("aria-hidden") !== "true",
      );
    (
      dialog.querySelector<HTMLElement>("[data-dialog-initial-focus]") ??
      focusable()[0] ??
      dialog
    ).focus();
    function keydown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        close.current();
      }
      if (event.key !== "Tab") return;
      const elements = focusable();
      const first = elements[0],
        last = elements.at(-1);
      if (!first || !last) {
        event.preventDefault();
        dialog!.focus();
        return;
      }
      if (
        !dialog!.contains(document.activeElement) ||
        (event.shiftKey && document.activeElement === first) ||
        (!event.shiftKey && document.activeElement === last)
      ) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
    }
    dialog.addEventListener("keydown", keydown);
    const containFocus = (event: FocusEvent) => {
      if (event.target instanceof Node && !dialog.contains(event.target))
        (focusable()[0] ?? dialog).focus();
    };
    document.addEventListener("focusin", containFocus);
    return () => {
      dialog.removeEventListener("keydown", keydown);
      document.removeEventListener("focusin", containFocus);
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return ref;
}
