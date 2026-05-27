import { useEffect } from "react";

/**
 * Bridges global popup events to the product tour.
 * Popups dispatch `umoja:popup-open` / `umoja:popup-close`.
 * The ProductTour listens for `umoja:tour-pause` / `umoja:tour-resume`.
 */
export function useTourControl() {
  useEffect(() => {
    const onOpen = () => window.dispatchEvent(new CustomEvent("umoja:tour-pause"));
    const onClose = () => window.dispatchEvent(new CustomEvent("umoja:tour-resume"));
    window.addEventListener("umoja:popup-open", onOpen);
    window.addEventListener("umoja:popup-close", onClose);
    return () => {
      window.removeEventListener("umoja:popup-open", onOpen);
      window.removeEventListener("umoja:popup-close", onClose);
    };
  }, []);
}
