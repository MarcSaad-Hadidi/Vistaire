"use client";

// Mirrors the approved v29 coss Command composition: search trigger, modal
// autocomplete, accent-insensitive matching, and selection after focus return.
import { useEffect, useRef, useState } from "react";
import { Command } from "cmdk";
import { Dialog } from "radix-ui";
import { Search } from "lucide-react";
import type { AdminMenuDish } from "@/lib/admin/menuReadiness";
import { useStudioLocale } from "./studioLocale";
import styles from "./StudioCommandPalette.module.css";

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("fr");
}

export function StudioCommandPalette({
  navigate,
  dishes,
  onDish,
}: {
  navigate: { label: string; onSelect: () => void }[];
  dishes: AdminMenuDish[];
  onDish: (dish: AdminMenuDish) => void;
}) {
  const { locale, t } = useStudioLocale();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const pending = useRef<(() => void) | null>(null);
  const alive = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const en = locale === "en";
  const label = en ? "Search" : "Rechercher";
  const title = en ? "Quick search" : "Recherche rapide";
  const inputLabel = en
    ? "Search pages and dishes"
    : "Rechercher une vue ou un plat";
  const pageGroup = en ? "Page" : "Vue";

  function changeOpen(next: boolean) {
    if (next) {
      setQuery("");
      pending.current = null;
    }
    setOpen(next);
  }

  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if (
        event.key.toLowerCase() !== "k" ||
        !(event.metaKey || event.ctrlKey) ||
        event.altKey ||
        event.shiftKey ||
        event.isComposing ||
        event.repeat
      )
        return;
      const target = event.target instanceof Element ? event.target : null;
      if (
        document.querySelector(
          'dialog[open], [role="dialog"][data-state="open"]',
        ) ||
        target?.closest(
          'input,textarea,select,[contenteditable]:not([contenteditable="false"])',
        )
      )
        return;
      event.preventDefault();
      setQuery("");
      pending.current = null;
      setOpen(true);
    }
    document.addEventListener("keydown", shortcut);
    return () => document.removeEventListener("keydown", shortcut);
  }, []);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      pending.current = null;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function select(action: () => void) {
    if (pending.current) return;
    pending.current = action;
    setOpen(false);
  }

  return (
    <Dialog.Root open={open} onOpenChange={changeOpen}>
      <div
        ref={setContainer}
        className={styles.root}
        data-component="coss-command"
      >
        <Dialog.Trigger asChild>
          <button
            type="button"
            className={styles.trigger}
            aria-label={label}
            aria-keyshortcuts="Control+k Meta+k"
          >
            <Search size={18} aria-hidden />
            <span>{label}</span>
            <kbd aria-hidden>⌘ K</kbd>
          </button>
        </Dialog.Trigger>
        <Dialog.Portal container={container}>
          <Dialog.Overlay className={styles.backdrop} />
          <Dialog.Content
            className={styles.popup}
            onCloseAutoFocus={() => {
              if (!alive.current) return;
              const action = pending.current;
              pending.current = null;
              // Let Radix restore the trigger before opening a dish dialog or
              // navigating. This avoids competing focus traps.
              if (action)
                timer.current = setTimeout(() => {
                  if (alive.current) action();
                }, 0);
            }}
          >
            <Dialog.Title className={styles.srOnly}>{title}</Dialog.Title>
            <Dialog.Description className={styles.srOnly}>
              {en
                ? "Search pages and dishes. Use the arrow keys, Enter and Escape."
                : "Rechercher une vue ou un plat. Utilisez les flèches, Entrée et Échap."}
            </Dialog.Description>
            <Command
              className={styles.command}
              label={title}
              loop
              filter={(_value, search, keywords) =>
                normalize((keywords ?? []).join(" ")).includes(
                  normalize(search),
                )
                  ? 1
                  : 0
              }
            >
              <div className={styles.inputGroup}>
                <Search size={19} aria-hidden />
                <Command.Input
                  autoFocus
                  value={query}
                  onValueChange={setQuery}
                  aria-label={inputLabel}
                  placeholder={en ? "Pages, dishes…" : "Vues, plats…"}
                />
              </div>
              <Command.List
                className={styles.list}
                aria-label={en ? "Search results" : "Résultats de recherche"}
              >
                <Command.Empty className={styles.empty}>
                  {t("Aucun résultat")}
                </Command.Empty>
                {navigate.map((item, index) => (
                  <Command.Item
                    key={`page:${index}`}
                    value={`page:${index}`}
                    keywords={[item.label, pageGroup]}
                    onSelect={() => select(item.onSelect)}
                    className={styles.item}
                  >
                    <span>{item.label}</span>
                    <small>{pageGroup}</small>
                  </Command.Item>
                ))}
                {dishes.map((dish) => (
                  <Command.Item
                    key={`dish:${dish.id}`}
                    value={`dish:${dish.id}`}
                    keywords={[dish.name, dish.category, t("Plat")]}
                    onSelect={() => select(() => onDish(dish))}
                    className={styles.item}
                  >
                    <span>{dish.name}</span>
                    <small>{dish.category || t("Plat")}</small>
                  </Command.Item>
                ))}
              </Command.List>
            </Command>
          </Dialog.Content>
        </Dialog.Portal>
      </div>
    </Dialog.Root>
  );
}
