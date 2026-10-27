import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { ArrowUpRight } from "lucide-react";
import "./pricing.css";
import { useLandingLocale } from "./locale.jsx";
import LandingFaq from "./LandingFaq.jsx";
import { pricingLightTheme, subscribePricingTheme } from "./PricingTheme.js";
import { getPricingPage } from "../../lib/pricingPage.ts";
import { getSeoMarketingImage } from "../../lib/seoMarketingImages.ts";
import {
  createPricingPhonePresenter,
  pricingStageAtScroll,
} from "./PricingPhonePresenter.js";
import {
  PRICING_SCREEN_WIDTH,
  PRICING_SCREEN_HEIGHT,
  PRICING_SCREEN_HEADER,
  pricingScrollLayout,
  pricingScreenScroll,
  pricingPagePosition,
  pricingCopyReserve,
} from "./PricingPhoneLayout.js";

// Home photography remains distinct for physical collections. Digital shares
// its approved illustrative book photograph with the pricing page.
const COLLECTIONS = [
  {
    id: "digital",
    image: getSeoMarketingImage("PRICING:collection:digital").src,
    material: ["Aucun support physique inclus", "No physical display included"],
    imageAlt: [
      getSeoMarketingImage("PRICING:collection:digital", "fr").alt,
      getSeoMarketingImage("PRICING:collection:digital", "en").alt,
    ],
  },
  {
    id: "acrylique",
    image: getSeoMarketingImage("HOME:pricing:acrylique").src,
    material: ["Acrylique & bois", "Acrylic & wood"],
    imageAlt: [
      "Support Vistaire Acrylique sur une table de restaurant",
      "Vistaire Acrylique stand on a restaurant table",
    ],
  },
  {
    id: "sculpte",
    image: getSeoMarketingImage("HOME:pricing:sculpte").src,
    material: ["Bois sculpté", "Sculpted wood"],
    imageAlt: [
      "Support Vistaire Sculpté en bois sur une table de restaurant",
      "Vistaire Sculpté wooden stand on a restaurant table",
    ],
  },
  {
    id: "carre",
    image: getSeoMarketingImage("HOME:pricing:carre").src,
    material: ["Bois · format compact", "Wood · compact format"],
    imageAlt: [
      "Support carré Vistaire avec son QR code sur une table de restaurant",
      "Vistaire square QR stand on a restaurant table",
    ],
  },
  {
    id: "signature",
    image: getSeoMarketingImage("HOME:pricing:signature").src,
    material: ["Bois & insert noir", "Wood & black insert"],
    imageAlt: [
      "Support Vistaire Signature en bois avec insert QR noir",
      "Vistaire Signature wooden stand with a black QR insert",
    ],
  },
];
export function PricingPhoneContent({
  dashboardReady = false,
  layerRef,
  screenRef,
  viewportRef,
  bodyRef,
  guardHiddenControl,
  revealFocusedControl,
  scrollWithKeyboard,
} = {}) {
  const { t, locale, currency, href } = useLandingLocale();
  const lightTheme = useSyncExternalStore(subscribePricingTheme, pricingLightTheme, () => false);
  const pricing = getPricingPage(locale);
  const monthlyAmount = pricing.monthlyAmount;
  return (
    <div
      className="pricing pricing-phone-layer"
      ref={layerRef}
      style={{ visibility: "hidden" }}
      aria-hidden="true"
      inert
    >
      <div
        className="pricing-phone-screen"
        ref={screenRef}
        onPointerDownCapture={guardHiddenControl}
        onClickCapture={guardHiddenControl}
        style={{ width: PRICING_SCREEN_WIDTH, height: PRICING_SCREEN_HEIGHT }}
      >
        <header className="pricing-phone-header">
          <span>VISTAIRE</span>
          <h2 id="open-weight-title">{t("Tarifs")}</h2>
        </header>
        <div
          className="pricing-phone-viewport"
          ref={viewportRef}
          tabIndex={0}
          aria-label={
            locale === "en"
              ? "Vistaire pricing in the phone"
              : "Les tarifs Vistaire dans le téléphone"
          }
          style={{ top: PRICING_SCREEN_HEADER }}
          onFocusCapture={revealFocusedControl}
          onKeyDown={scrollWithKeyboard}
        >
          <div className="pricing-phone-body" ref={bodyRef}>
            <section
              className="pricing-offer"
              aria-labelledby="pricing-offer-title"
            >
              <h3 id="pricing-offer-title">
                {locale === "en" ? "Our collections." : "Nos collections."}
              </h3>
              <p className="pricing-setup-label">
                {locale === "en"
                  ? "One-time setup · CAD"
                  : "Mise en place · CAD"}
              </p>
              <div
                className="pricing-offers"
                aria-label={t("Votre collection")}
              >
                {pricing.collections.map((collection, index) => {
                  const item = COLLECTIONS.find((entry) => entry.id === collection.id);
                  return (
                    <a
                      key={item.id}
                      className="pricing-offer-card"
                      data-pricing-kind={collection.kind}
                      href={`${href("/tarifs-menu-digital-restaurant")}#collection-${item.id}`}
                    >
                      <span className="pricing-offer-photo">
                        <img
                          // 640px suffices inside the scaled phone; full size slowed its reader.
                          src={dashboardReady ? `/_next/image?url=${encodeURIComponent(item.image)}&w=640&q=75` : undefined}
                          alt={item.imageAlt[locale === "en" ? 1 : 0]}
                          width={1280}
                          height={960}
                          decoding="async"
                          fetchPriority="low"
                        />
                        <span className="pricing-offer-number">0{index + 1}</span>
                      </span>
                      <span className="pricing-offer-summary">
                        <span className="pricing-offer-name">
                          <h4>{collection.name.replace(/^Vistaire\s/, "")}</h4>
                          <span className="pricing-offer-material">
                            {item.material[locale === "en" ? 1 : 0]}
                          </span>
                        </span>
                        <span className="pricing-offer-price">
                          <small>{collection.kind === "digital" ? (locale === "en" ? "Fixed setup" : "Mise en place fixe") : t("À partir de")}</small>
                          {currency(collection.setupAmount)}
                        </span>
                        <ArrowUpRight size={14} aria-hidden="true" />
                      </span>
                      {collection.kind === "digital" && (
                        <span className="pricing-offer-disclosure">
                          {locale === "en" ? "Illustrative book · Book, printing and delivery not included." : "Livre illustratif · Livre, impression et livraison non inclus."}
                        </span>
                      )}
                    </a>
                  );
                })}
              </div>
              <div className="pricing-monthly">
                <span>
                  {currency(monthlyAmount)} <small>{t("/ mois")}</small>
                </span>
                <small>
                  {locale === "en"
                    ? "Digital menu · All collections"
                    : "Menu digital · Toutes les collections"}
                </small>
              </div>
              <section
                className="pricing-pilotage"
                aria-labelledby="pricing-pilotage-title"
              >
                <span className="pricing-pilotage-label">
                  VISTAIRE PILOTAGE
                </span>
                <h4 id="pricing-pilotage-title">
                  {locale === "en"
                    ? "Your restaurant. At a glance."
                    : "Votre restaurant. En un regard."}
                </h4>
                <div className="pricing-pilotage-visual">
                  <img
                    src={dashboardReady ? (lightTheme ? "/immersive-assets/dashboard/dashboard-light.webp" : "/immersive-assets/dashboard/dashboard-black-gold.webp") : undefined}
                    width="1184"
                    height="758"
                    loading="lazy"
                    fetchPriority="low"
                    decoding="async"
                    alt={
                      locale === "en"
                        ? "Vistaire Restaurant Studio preview: menu activity and analytics. Synthetic demo data."
                        : "Aperçu réel de Restaurant Studio : activité du menu et analyses. Données de démonstration fictives."
                    }
                  />
                </div>
                <small className="pricing-pilotage-note">
                  {locale === "en" ? "Preview · Synthetic demo data" : "Aperçu · Données de démonstration fictives"}
                </small>
                <span className="pricing-pilotage-price">
                  + {currency(pricing.pilotage.monthlyAmount)} <small>{t("/ mois")}</small>
                </span>
                <p>
                  {locale === "en"
                    ? "The dashboard to manage availability and understand your guests’ choices."
                    : "Le dashboard pour gérer vos disponibilités et comprendre les choix de vos clients."}
                </p>
                <small className="pricing-pilotage-note">
                  {locale === "en"
                    ? "Optional · In addition to the digital menu"
                    : "En option · En complément du menu digital"}
                </small>
              </section>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PricingStageContent({ layerRef } = {}) {
  const { locale, href } = useLandingLocale();
  const en = locale === "en";
  return (
    <div
      className="pricing-aside-layer"
      ref={layerRef}
      style={{ visibility: "hidden", opacity: 0 }}
      aria-hidden="true"
      inert
    >
      <div className="pricing-aside-intro">
        <span className="pricing-eyebrow">
          {en ? "Your Vistaire experience" : "Votre expérience Vistaire"}
        </span>
        <h2 id="pricing-stage-title">
          {en ? "Your collection." : "Votre collection."}
          {" "}<br />
          <em>{en ? "Your signature." : "Votre signature."}</em>
        </h2>
        <p>
          {en
            ? "Five offers. One experience, designed for your restaurant."
            : "Cinq offres. Une expérience pensée pour votre restaurant."}
        </p>
      </div>
      <div className="pricing-aside-actions">
        <p>
          {en
            ? "Compare the materials, prices and everything included."
            : "Comparez les matières, les prix et tout ce qui est inclus."}
        </p>
        <div className="pricing-aside-links">
          <a
            className="pricing-cta pricing-details-link"
            href={href("/tarifs-menu-digital-restaurant")}
          >
            {en ? "See full pricing" : "Voir les tarifs complets"}
            <ArrowUpRight size={17} aria-hidden="true" />
          </a>
          <a className="pricing-cta" href={href("/prendre-rendez-vous")}>
            {en ? "Book a meeting" : "Prendre rendez-vous"}
            <ArrowUpRight size={17} aria-hidden="true" />
          </a>
        </div>
        <a className="pricing-studio-link" href={href("/apercu-restaurateur")}>
          {en ? "Explore the dashboard" : "Découvrir le dashboard"}
          <ArrowUpRight size={16} aria-hidden="true" />
        </a>
        <small className="pricing-aside-terms">
          {en ? "Prices in CAD · Taxes extra" : "Prix en CAD · Taxes en sus"}
          <br />{" "}
          {en
            ? "Initial 12-month commitment."
            : "Engagement initial de 12 mois."}
        </small>
      </div>
    </div>
  );
}

const subscribePortalHost = () => () => {};
const serverPortalHost = () => null;
const pricingScreenHost = () => document.getElementById("pricing-screen-host");
const pricingActionsHost = () => document.getElementById("pricing-actions-host");

export default function Pricing({ collection, stateRef }) {
  const [dashboardReady, setDashboardReady] = useState(false);
  const { locale } = useLandingLocale();
  const pricing = getPricingPage(locale);
  const selected = pricing.collections.find((item) => item.id === collection) || pricing.collections[0];
  const monthlyAmount = pricing.monthlyAmount;
  const portalHost = useSyncExternalStore(subscribePortalHost, pricingScreenHost, serverPortalHost);
  const actionsHost = useSyncExternalStore(subscribePortalHost, pricingActionsHost, serverPortalHost);
  const layerRef = useRef(null);
  const asideRef = useRef(null);
  const introRef = useRef(null);
  const visualRef = useRef(null);
  const screenRef = useRef(null);
  const viewportRef = useRef(null);
  const bodyRef = useRef(null);
  const layoutRef = useRef(null);
  const presenterRef = useRef(null);
  useEffect(() => {
    const state = stateRef?.current;
    if (!state || !portalHost || !actionsHost) return;
    const intro = introRef.current,
      visual = visualRef.current,
      screen = screenRef.current;
    const viewport = viewportRef.current,
      body = bodyRef.current;
    let dashboardRequested = false;
    // Focus can natively scroll the clipped reader; the transform owns its offset.
    const keepNativeOffset = () => { if (viewport.scrollTop) viewport.scrollTop = 0; };
    viewport.addEventListener("scroll", keepNativeOffset, { passive: true });
    let disposed = false,
      measureFrame = 0,
      lastReducedMotion = state.reducedMotion,
      sectionTop = 0;
    const presenter = createPricingPhonePresenter(
      screen,
      viewport,
      layerRef.current,
      asideRef.current,
    );
    presenterRef.current = presenter;
    const navigationTarget = () => pricingPagePosition(intro.getBoundingClientRect().top + window.scrollY, 0, layoutRef.current);
    // Assisted scroll stops: phone in place with the first offer, last offer, FAQ.
    const readingStops = () => {
      const layout = layoutRef.current;
      if (!layout) return null;
      const top = intro.getBoundingClientRect().top + window.scrollY;
      // The FAQ arrives below the fixed navigation bar, with breathing room.
      const header = document.querySelector(".site-header")?.getBoundingClientRect().bottom ?? 0;
      // Navigation and gesture boundaries share the first readable phone pose.
      // The entry finishes earlier, leaving a lead before native reading starts.
      return { start: pricingPagePosition(top, 0, layout), end: pricingPagePosition(top, layout.maxScroll, layout), faq: top + layout.sectionHeight - header - 24 };
    };
    Object.assign(state, { pricingIntro: intro, pricingStage: visual, pricingNavigationTarget: navigationTarget, pricingReadingStops: readingStops });
    const syncScroll = (
      pageY = window.scrollY,
      top = state.pricingSectionTop ?? sectionTop,
      force = false,
    ) => {
      if (!layoutRef.current) return;
      // The fixed hidden portal is in the viewport even at the hero. Only the
      // measured document approach may start this below-fold image request.
      if (!dashboardRequested && pageY >= top - state.pricingViewport.height) {
        dashboardRequested = true;
        setDashboardReady(true);
      }
      if (lastReducedMotion !== state.reducedMotion) queueMeasure();
      presenter.scroll(pageY, top, layoutRef.current, force);
      if (!state.renderSceneFrame || state.pricingHandUnavailable) {
        const stage = pricingStageAtScroll(top, pageY, state.pricingViewport);
        const scale = layoutRef.current.fallbackScale;
        presenter.project(
          {
            matrix: [
              scale,
              0,
              0,
              scale,
              (stage.width - PRICING_SCREEN_WIDTH * scale) / 2,
              (stage.height - PRICING_SCREEN_HEIGHT * scale) / 2 +
                (layoutRef.current.stackedCopy ? 20 : 0),
            ],
          },
          stage.top,
        );
        presenter.show(stage.top <= 0 && stage.bottom > 0, false);
        presenter.copy(
          stage.top <= 0 && stage.bottom > 0,
          1,
          Math.max(0, -stage.top),
          stage.height,
        );
      }
    };
    const measure = () => {
      measureFrame = 0;
      if (disposed) return;
      const height = visual.clientHeight;
      const width = visual.clientWidth;
      const contentHeight = body.scrollHeight;
      const viewportHeight = viewport.clientHeight;
      sectionTop = intro.getBoundingClientRect().top + window.scrollY;
      if (!height) return;
      lastReducedMotion = state.reducedMotion;
      const stackedCopy = width < 1024 && !(width >= 700 && height <= 500);
      const fallbackScale = Math.min(
        (width * 0.74) / PRICING_SCREEN_WIDTH,
        Math.max(180, height - pricingCopyReserve(height, stackedCopy) - (stackedCopy ? 20 : 0)) /
          PRICING_SCREEN_HEIGHT,
      );
      screen.style.setProperty("--pricing-fallback-scale", fallbackScale);
      layoutRef.current = pricingScrollLayout(
        height,
        contentHeight,
        viewportHeight,
        // Document travel is fixed before the hand texture/model is ready.
        // The exact screen projection places HTML but cannot move the FAQ.
        fallbackScale,
        state.reducedMotion,
      );
      layoutRef.current.fallbackScale = fallbackScale;
      layoutRef.current.stackedCopy = stackedCopy;
      const sectionHeight = `${layoutRef.current.sectionHeight.toFixed(2)}px`;
      Object.assign(state, { pricingViewport: {
        width,
        height,
        introHeight: layoutRef.current.sectionHeight,
      } });
      if (intro.style.height !== sectionHeight)
        intro.style.height = sectionHeight;
      // The reverse-gesture boundary is derived from this first-offer pose.
      // Refresh after its actual layout changes, before the next touch begins.
      state.syncEntryTouchLock?.();
      syncScroll(window.scrollY, sectionTop, true);
      state.invalidateScene?.();
    };
    const queueMeasure = () => {
      if (!disposed && !measureFrame)
        measureFrame = requestAnimationFrame(measure);
    };
    const present = (
      projection,
      stageTop = 0,
      visible = true,
      entryProgress = 1,
    ) => {
      if (disposed) return;
      presenter.show(visible, Boolean(projection));
      presenter.copy(
        visible,
        entryProgress,
        stageTop,
        state.pricingViewport?.height,
      );
      if (!projection) return;
      presenter.project(projection, stageTop);
    };
    // The page owns scrolling. Its latest sample moves only this inner viewport,
    // including the CSS phone fallback when WebGL is unavailable.
    Object.assign(state, { presentPricingScreen: present, syncPricingScroll: syncScroll });
    const observer = new ResizeObserver(queueMeasure);
    observer.observe(visual);
    observer.observe(body);
    document.fonts.ready.then(queueMeasure);
    measure();
    return () => {
      disposed = true;
      viewport.removeEventListener("scroll", keepNativeOffset);
      cancelAnimationFrame(measureFrame);
      observer.disconnect();
      if (state.pricingNavigationTarget === navigationTarget) delete state.pricingNavigationTarget;
      if (state.pricingReadingStops === readingStops) delete state.pricingReadingStops;
      if (state.pricingIntro === intro) delete state.pricingIntro;
      if (state.pricingStage === visual) delete state.pricingStage;
      if (presenterRef.current === presenter) {
        presenterRef.current = null;
        delete state.pricingViewport;
      }
      if (state.presentPricingScreen === present)
        delete state.presentPricingScreen;
      delete state.pricingHandUnavailable;
      if (state.syncPricingScroll === syncScroll)
        delete state.syncPricingScroll;
    };
  }, [stateRef, portalHost, actionsHost]);
  const revealFocusedControl = (event) => {
    const viewport = viewportRef.current,
      body = bodyRef.current,
      target = event.target;
    const layout = layoutRef.current;
    if (!layout) return;
    const sectionTop =
      introRef.current.getBoundingClientRect().top + window.scrollY;
    presenterRef.current?.scroll(window.scrollY, sectionTop, layout, true);
    if (target === viewport) return;
    let top = 0,
      element = target;
    while (element && element !== body) {
      top += element.offsetTop;
      element = element.offsetParent;
    }
    const usable = viewport.clientHeight - 24;
    const expected = pricingScreenScroll(
      introRef.current.getBoundingClientRect().top,
      layout,
    );
    if (top >= expected && top + target.offsetHeight <= expected + usable)
      return;
    const screenScroll = Math.max(0, top - 20);
    window.scrollTo({
      top: pricingPagePosition(sectionTop, screenScroll, layout),
      behavior: "instant",
    });
  };
  const scrollWithKeyboard = (event) => {
    if (event.target !== viewportRef.current) return;
    const layout = layoutRef.current;
    if (!layout) return;
    const sectionTop =
      introRef.current.getBoundingClientRect().top + window.scrollY;
    const changes = {
      ArrowDown: 48,
      ArrowUp: -48,
      PageDown: viewportRef.current.clientHeight * 0.7,
      PageUp: -viewportRef.current.clientHeight * 0.7,
    };
    let next;
    if (event.key === "Home") next = 0;
    else if (event.key === "End") next = layout.maxScroll;
    // The reader offset is mapped from the page (the presenter's transform).
    const current = pricingScreenScroll(introRef.current.getBoundingClientRect().top, layout);
    if (event.key in changes) next = current + changes[event.key];
    else if (next === undefined) return;
    // The phone lives under a fixed portal, so WebKit cannot reliably chain
    // its boundary keys to the document. Continue the native page explicitly.
    // WebKit can quantize document scroll to whole CSS pixels. Compare the
    // mapped page endpoint too, or a subpixel reader remainder traps End/PageDown.
    const atStart = current <= 0.5 || Math.abs(window.scrollY - pricingPagePosition(sectionTop, 0, layout)) <= 1;
    const atEnd = current >= layout.maxScroll - 0.5 || Math.abs(window.scrollY - pricingPagePosition(sectionTop, layout.maxScroll, layout)) <= 1;
    if ((atStart && next <= 0) || (atEnd && next >= layout.maxScroll)) {
      event.preventDefault();
      if (event.key in changes) {
        window.scrollBy({
          top: event.key.startsWith("Page") ? Math.sign(changes[event.key]) * window.innerHeight * 0.8 : changes[event.key],
          behavior: "instant",
        });
      }
      return;
    }
    event.preventDefault();
    window.scrollTo({
      // WebKit floors fractional scroll targets. Home must remain inside the
      // section, or hiding the fixed portal drops focus before the next key.
      top: Math.ceil(pricingPagePosition(sectionTop, next, layout)),
      behavior: "instant",
    });
  };
  const guardHiddenControl = (event) => {
    if (event.type === "click" && event.detail === 0) return;
    if (layerRef.current?.dataset.handReady !== "true") return;
    if (
      stateRef.current.pricingScreenHit?.(event.clientX, event.clientY) ===
      false
    ) {
      event.preventDefault();
      event.stopPropagation();
    }
  };
  useEffect(() => {
    if (!stateRef?.current) return;
    const state = stateRef.current;
    const offer = {
      id: selected.id,
      name: selected.name,
      amount: selected.setupAmount,
      monthlyAmount,
      pilotage: false,
      locale,
    };
    Object.assign(state, { pricingOffer: offer });
    state.invalidateScene?.();
    return () => {
      if (state.pricingOffer === offer) delete state.pricingOffer;
    };
  }, [
    stateRef,
    selected.id,
    selected.name,
    selected.setupAmount,
    monthlyAmount,
    locale,
  ]);

  const phone = (
    <PricingPhoneContent
      dashboardReady={dashboardReady}
      layerRef={layerRef}
      screenRef={screenRef}
      viewportRef={viewportRef}
      bodyRef={bodyRef}
      guardHiddenControl={guardHiddenControl}
      revealFocusedControl={revealFocusedControl}
      scrollWithKeyboard={scrollWithKeyboard}
    />
  );
  return (
    <div className="pricing-content">
      <div className="pricing-hero" ref={introRef}>
        <div className="pricing-cinematic-stage">
          <div
            className="pricing-hand-visual"
            ref={visualRef}
            aria-hidden="true"
          />
        </div>
      </div>
      {portalHost && createPortal(phone, portalHost)}
      {actionsHost &&
        createPortal(<PricingStageContent layerRef={asideRef} />, actionsHost)}
      <LandingFaq />
    </div>
  );
}
