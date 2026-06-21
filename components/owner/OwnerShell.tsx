"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import styles from "@/components/owner/OwnerCockpit.module.css";
import {
  OWNER_ACCOUNT_NAV_ITEMS,
  OWNER_PORTFOLIO_NAV_ITEMS,
  ownerNavTitle,
  ownerRestaurantNavItems,
  type OwnerNavItem,
  type OwnerShellRestaurant
} from "@/lib/owner/nav";

function restaurantLookupFromPathname(pathname: string): string {
  const match = pathname.match(/^\/owner\/restaurants\/([^/]+)/);
  const lookup = match?.[1] ?? "";
  if (!lookup || lookup === "create") return "";

  try {
    return decodeURIComponent(lookup);
  } catch {
    return lookup;
  }
}

function isActiveHref(pathname: string, href: string): boolean {
  return href === "/owner"
    ? pathname === "/owner"
    : pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarNavItems({
  items,
  pathname,
  navTabIndex,
  onNavigate
}: {
  items: OwnerNavItem[];
  pathname: string;
  navTabIndex?: number;
  onNavigate: () => void;
}) {
  return (
    <>
      {items.map((item) => {
        const isActive = isActiveHref(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch={false}
            onClick={onNavigate}
            aria-current={isActive ? "page" : undefined}
            tabIndex={navTabIndex}
            className={`${styles.navItem} ${isActive ? styles.navItemActive : ""}`}
          >
            <span className={styles.navItemLabel}>{item.label}</span>
            <span className={styles.navItemHint}>{item.hint}</span>
          </Link>
        );
      })}
    </>
  );
}

export function OwnerShell({
  children,
  accountControl = null,
  restaurants = []
}: {
  children: React.ReactNode;
  accountControl?: React.ReactNode;
  restaurants?: OwnerShellRestaurant[];
}) {
  const pathname = usePathname() ?? "/owner";
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobileNav, setIsMobileNav] = useState(false);
  const { label, hint } = ownerNavTitle(pathname);
  const restaurantLookup = restaurantLookupFromPathname(pathname);
  const selectedRestaurant = useMemo(() => {
    const normalized = restaurantLookup.toLowerCase();
    if (!normalized) return null;

    return (
      restaurants.find(
        (restaurant) =>
          restaurant.id.toLowerCase() === normalized ||
          restaurant.slug.toLowerCase() === normalized
      ) ?? null
    );
  }, [restaurantLookup, restaurants]);
  const restaurantNavLookup = selectedRestaurant?.id ?? restaurantLookup;
  const restaurantMode = Boolean(restaurantNavLookup);
  const restaurantNavItems = restaurantMode
    ? ownerRestaurantNavItems(restaurantNavLookup)
    : [];

  useEffect(() => {
    const media = window.matchMedia("(max-width: 960px)");
    const sync = () => {
      setIsMobileNav(media.matches);
      if (!media.matches) setMobileOpen(false);
    };

    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileOpen(false);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  const sidebarHidden = isMobileNav && !mobileOpen;
  const navTabIndex = sidebarHidden ? -1 : undefined;
  const selectedName =
    selectedRestaurant?.name ?? restaurantLookup.replace(/-/g, " ") ?? "Restaurant";
  const selectedMeta = selectedRestaurant
    ? `${selectedRestaurant.readinessScore}% prêt · ${selectedRestaurant.statusLabel}`
    : "Restaurant sélectionné";

  return (
    <div className={styles.console}>
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Fermer le menu"
          className={styles.sidebarBackdrop}
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <aside
        className={`${styles.sidebar} ${mobileOpen ? styles.sidebarMobileOpen : ""}`}
        aria-label="Navigation Vistaire Owner"
        aria-hidden={sidebarHidden ? "true" : undefined}
      >
        <Link
          className={styles.sidebarBrand}
          href="/owner"
          prefetch={false}
          tabIndex={navTabIndex}
        >
          <span className={styles.sidebarBrandName}>Vistaire</span>
          <span className={styles.sidebarBrandMeta}>Studio Vistaire</span>
        </Link>

        {restaurantMode ? (
          <>
            <Link
              href="/owner"
              prefetch={false}
              tabIndex={navTabIndex}
              className={styles.sidebarBackLink}
              onClick={() => setMobileOpen(false)}
            >
              ← Portefeuille
            </Link>
            <section className={styles.sidebarRestaurant} aria-label="Restaurant sélectionné">
              <span className={styles.sidebarSectionLabel}>Restaurant sélectionné</span>
              <strong>{selectedName}</strong>
              <small>{selectedMeta}</small>
              {restaurants.length > 1 && selectedRestaurant ? (
                <label className={styles.sidebarSwitch}>
                  <span className={styles.sidebarSectionLabel}>Switch rapide</span>
                  <select
                    value={selectedRestaurant.id}
                    tabIndex={navTabIndex}
                    onChange={(event) => {
                      const next = restaurants.find(
                        (restaurant) => restaurant.id === event.target.value
                      );
                      if (next) {
                        setMobileOpen(false);
                        router.push(next.dashboardHref);
                      }
                    }}
                  >
                    {restaurants.map((restaurant) => (
                      <option key={restaurant.id} value={restaurant.id}>
                        {restaurant.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </section>
            <nav className={styles.sidebarNav} aria-label="Navigation restaurant">
              <SidebarNavItems
                items={restaurantNavItems}
                pathname={pathname}
                navTabIndex={navTabIndex}
                onNavigate={() => setMobileOpen(false)}
              />
            </nav>
          </>
        ) : (
          <>
            <span className={styles.sidebarSectionLabel}>Navigation</span>
            <nav className={styles.sidebarNav} aria-label="Navigation portefeuille">
              <SidebarNavItems
                items={OWNER_PORTFOLIO_NAV_ITEMS}
                pathname={pathname}
                navTabIndex={navTabIndex}
                onNavigate={() => setMobileOpen(false)}
              />
            </nav>
            <span className={styles.sidebarSectionLabel}>Compte</span>
            <nav className={styles.sidebarNav} aria-label="Compte">
              <SidebarNavItems
                items={OWNER_ACCOUNT_NAV_ITEMS}
                pathname={pathname}
                navTabIndex={navTabIndex}
                onNavigate={() => setMobileOpen(false)}
              />
            </nav>
          </>
        )}

        <div className={styles.sidebarFooter}>Studio interne · accès owner-only</div>
      </aside>

      <div className={styles.consoleMain}>
        <header className={styles.consoleTopbar}>
          <button
            type="button"
            className={styles.menuToggle}
            aria-label="Ouvrir le menu"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((open) => !open)}
          >
            Menu
          </button>
          <div className={styles.topbarTitleWrap}>
            <h1 className={styles.topbarTitle}>{label}</h1>
            <p className={styles.topbarSub}>{hint}</p>
          </div>
          <div className={styles.topbarActions}>
            <Link className={styles.btn} href="/apercu-restaurateur" prefetch={false}>
              Aperçu public
            </Link>
            {accountControl}
          </div>
        </header>
        <main className={styles.consoleContent}>{children}</main>
      </div>
    </div>
  );
}
