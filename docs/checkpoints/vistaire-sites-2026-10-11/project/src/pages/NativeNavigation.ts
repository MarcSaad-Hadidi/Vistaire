// Public Studio demo keeps its local state; no private loaders or admin writes.
export function useRouter() {
  return {
    push: (href: string) => window.location.assign(href),
    replace: (href: string) => window.location.replace(href),
    refresh: () => window.location.reload(),
  };
}
