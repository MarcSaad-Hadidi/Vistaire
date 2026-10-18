type MenuViewport = Pick<Window, "addEventListener" | "removeEventListener" | "visualViewport"> & {
  ResizeObserver: typeof ResizeObserver;
};

/** Keep the drawer's scrollable area entirely below its fixed header. */
export function bindPublicMenuViewport(
  header: HTMLElement,
  panel: HTMLElement,
  view: MenuViewport = window,
) {
  const property = "--vistaire-menu-top";
  const previous = panel.style.getPropertyValue(property);
  const priority = panel.style.getPropertyPriority(property);
  const measure = () => {
    const top = `${Math.ceil(header.getBoundingClientRect().bottom) + 8}px`;
    if (panel.style.getPropertyValue(property) !== top) {
      panel.style.setProperty(property, top);
    }
  };
  measure();
  const observer = new view.ResizeObserver(measure);
  observer.observe(header);
  view.addEventListener("resize", measure);
  const viewport = view.visualViewport;
  viewport?.addEventListener("resize", measure);
  return () => {
    observer.disconnect();
    view.removeEventListener("resize", measure);
    viewport?.removeEventListener("resize", measure);
    if (previous) panel.style.setProperty(property, previous, priority);
    else panel.style.removeProperty(property);
  };
}
