import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowUpRight } from "lucide-react";
import "./pricing.css";
import { useLandingLocale } from "./locale.jsx";
import LandingFaq from "./LandingFaq.jsx";
import StudioPreviewImage from "./StudioPreviewImage.jsx";
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
} from "./PricingPhoneLayout.js";

// Verified against Vistaire's pricingPage.ts. Physical supports beyond the
// included quantity are quoted individually; no per-support rate is assumed.
const COLLECTIONS = [
  {
    id: "acrylique",
    name: "Acrylique",
    amount: 2000,
    image: "/images/marketing/home-pricing-acrylique.webp",
    material: ["Acrylique & bois", "Acrylic & wood"],
    imageAlt: [
      "Support Vistaire Acrylique sur une table de restaurant",
      "Vistaire Acrylique stand on a restaurant table",
    ],
  },
  {
    id: "sculpte",
    name: "Sculpté",
    amount: 2050,
    image: "/images/marketing/home-pricing-sculpte.webp",
    material: ["Bois sculpté", "Sculpted wood"],
    imageAlt: [
      "Support Vistaire Sculpté en bois sur une table de restaurant",
      "Vistaire Sculpté wooden stand on a restaurant table",
    ],
  },
  {
    id: "carre",
    name: "Carré",
    amount: 2100,
    image: "/images/marketing/home-pricing-carre.webp",
    material: ["Bois · format compact", "Wood · compact format"],
    imageAlt: [
      "Support carré Vistaire avec son QR code sur une table de restaurant",
      "Vistaire square QR stand on a restaurant table",
    ],
  },
  {
    id: "signature",
    name: "Signature",
    amount: 2200,
    image: "/images/marketing/home-pricing-signature.webp",
    material: ["Bois & insert noir", "Wood & black insert"],
    imageAlt: [
      "Support Vistaire Signature en bois avec insert QR noir",
      "Vistaire Signature wooden stand with a black QR insert",
    ],
  },
];
export function PricingPhoneContent({
  layerRef,
  screenRef,
  viewportRef,
  bodyRef,
  guardHiddenControl,
  revealFocusedControl,
  scrollWithKeyboard,
} = {}) {
  const { t, locale, currency, href } = useLandingLocale();
  const monthlyAmount = 200;
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
                {COLLECTIONS.map((item, index) => (
                  <a
                    key={item.id}
                    className="pricing-offer-card"
                    href={`${href("/tarifs-menu-digital-restaurant")}#collection-${item.id}`}
                  >
                    <span className="pricing-offer-photo">
                      <img
                        src={item.image}
                        alt={item.imageAlt[locale === "en" ? 1 : 0]}
                        width={1280}
                        height={960}
                        decoding="async"
                      />
                      <span className="pricing-offer-number">0{index + 1}</span>
                    </span>
                    <span className="pricing-offer-summary">
                      <span className="pricing-offer-name">
                        <h4>{item.name}</h4>
                        <span className="pricing-offer-material">
                          {item.material[locale === "en" ? 1 : 0]}
                        </span>
                      </span>
                      <span className="pricing-offer-price">
                        {currency(item.amount)}
                      </span>
                      <ArrowUpRight size={14} aria-hidden="true" />
                    </span>
                  </a>
                ))}
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
                  <StudioPreviewImage
                    mobile
                    width="600"
                    height="650"
                    decoding="async"
                    alt={
                      locale === "en"
                        ? "New Vistaire Restaurant Studio overview: activity, dish rankings and analytics. Demo data."
                        : "Nouvelle vue d’ensemble Restaurant Studio : activité du menu, plats consultés et analyses. Données de démonstration."
                    }
                  />
                </div>
                <span className="pricing-pilotage-price">
                  + {currency(100)} <small>{t("/ mois")}</small>
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
          <br />
          <em>{en ? "Your signature." : "Votre signature."}</em>
        </h2>
        <p>
          {en
            ? "Four styles. One experience, designed for your restaurant."
            : "Quatre styles. Une expérience pensée pour votre restaurant."}
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

export default function Pricing({ collection, stateRef }) {
  const { locale } = useLandingLocale();
  const selected =
    COLLECTIONS.find((item) => item.id === collection) || COLLECTIONS[0];
  const monthlyAmount = 200;
  const [portalHost, setPortalHost] = useState(null);
  const [actionsHost, setActionsHost] = useState(null);
  const layerRef = useRef(null);
  const asideRef = useRef(null);
  useEffect(() => {
    setPortalHost(document.getElementById("pricing-screen-host"));
    setActionsHost(document.getElementById("pricing-actions-host"));
  }, []);
  const introRef = useRef(null);
  const visualRef = useRef(null);
  const screenRef = useRef(null);
  const viewportRef = useRef(null);
  const bodyRef = useRef(null);
  const layoutRef = useRef(null);
  const projectionRef = useRef(null);
  const presenterRef = useRef(null);
  useEffect(() => {
    const state = stateRef?.current;
    if (!state || !portalHost) return;
    const intro = introRef.current,
      visual = visualRef.current,
      screen = screenRef.current;
    const viewport = viewportRef.current,
      body = bodyRef.current;
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
    state.pricingIntro = intro;
    state.pricingStage = visual;
    const syncScroll = (
      pageY = window.scrollY,
      top = state.pricingSectionTop ?? sectionTop,
      force = false,
    ) => {
      if (!layoutRef.current) return;
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
      const projection = projectionRef.current;
      const stackedCopy = width < 1024 && !(width >= 700 && height <= 500);
      const fallbackScale = Math.min(
        (width * 0.74) / PRICING_SCREEN_WIDTH,
        Math.max(180, height - (stackedCopy ? 320 : 170)) /
          PRICING_SCREEN_HEIGHT,
      );
      screen.style.setProperty("--pricing-fallback-scale", fallbackScale);
      layoutRef.current = pricingScrollLayout(
        height,
        contentHeight,
        viewportHeight,
        projection?.scale ?? fallbackScale,
        state.reducedMotion,
      );
      layoutRef.current.fallbackScale = fallbackScale;
      layoutRef.current.stackedCopy = stackedCopy;
      const sectionHeight = `${layoutRef.current.sectionHeight.toFixed(2)}px`;
      state.pricingViewport = {
        width,
        height,
        introHeight: layoutRef.current.sectionHeight,
      };
      if (intro.style.height !== sectionHeight)
        intro.style.height = sectionHeight;
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
      const previousScale = layoutRef.current?.scale;
      projectionRef.current = projection;
      presenter.project(projection, stageTop);
      if (
        previousScale == null ||
        Math.abs(previousScale - projection.scale) > 0.001
      )
        queueMeasure();
    };
    // The page owns scrolling. Its latest sample moves only this inner viewport,
    // including the CSS phone fallback when WebGL is unavailable.
    state.presentPricingScreen = present;
    state.syncPricingScroll = syncScroll;
    const observer = new ResizeObserver(queueMeasure);
    observer.observe(visual);
    observer.observe(body);
    document.fonts.ready.then(queueMeasure);
    measure();
    return () => {
      disposed = true;
      cancelAnimationFrame(measureFrame);
      observer.disconnect();
      if (state.pricingIntro === intro) delete state.pricingIntro;
      if (state.pricingStage === visual) delete state.pricingStage;
      if (presenterRef.current === presenter) {
        presenterRef.current = null;
        delete state.pricingViewport;
      }
      if (state.presentPricingScreen === present)
        delete state.presentPricingScreen;
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
    const usable = viewport.clientHeight - 140;
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
    else if (event.key in changes)
      next = viewportRef.current.scrollTop + changes[event.key];
    else return;
    event.preventDefault();
    window.scrollTo({
      top: pricingPagePosition(sectionTop, next, layout),
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
    stateRef.current.pricingOffer = {
      id: selected.id,
      name: selected.name,
      amount: selected.amount,
      monthlyAmount,
      pilotage: false,
      locale,
    };
    stateRef.current.invalidateScene?.();
  }, [
    stateRef,
    selected.id,
    selected.name,
    selected.amount,
    monthlyAmount,
    locale,
  ]);

  const phone = (
    <PricingPhoneContent
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
