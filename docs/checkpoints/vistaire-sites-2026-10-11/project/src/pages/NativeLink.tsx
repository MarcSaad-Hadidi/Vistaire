import { forwardRef, type AnchorHTMLAttributes } from "react";
const Link = forwardRef<
  HTMLAnchorElement,
  AnchorHTMLAttributes<HTMLAnchorElement> & {
    prefetch?: boolean;
    replace?: boolean;
    scroll?: boolean;
  }
>(function Link(
  { href, prefetch: _prefetch, replace: _replace, scroll: _scroll, ...props },
  ref,
) {
  const official =
    href?.startsWith("/menu/") ||
    /^\/(?:admin|owner|sign-in|todos|legacy|q)(?:\/|$)/.test(href ?? "");
  return (
    <a
      {...props}
      href={official ? `https://www.vistaire.ca${href}` : href}
      ref={ref}
    />
  );
});
export default Link;
