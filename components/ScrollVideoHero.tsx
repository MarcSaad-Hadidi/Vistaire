"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DynamicVideoText } from "@/components/DynamicVideoText";
import { frameConfig } from "@/lib/frameConfig";
import { getActiveChapter, videoChapters } from "@/lib/videoChapters";

// Constantes pour l'optimisation et le cadrage
const WATERMARK_CROP_SCALE = 1.06; // Rognage mathématique pour cacher "Veo"
const MOBILE_BREAKPOINT = 768;

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function ScrollVideoHero() {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const progressRef = useRef(0);
  const chapterIdRef = useRef(videoChapters[0].id);

  const [chapter, setChapter] = useState(videoChapters[0]);
  const [reducedMotion, setReducedMotion] = useState(false);
  
  // Cache d'images
  const imagesRef = useRef<(HTMLImageElement | null)[]>([]);
  const currentDrawnIndexRef = useRef(-1);
  const loadFrameRef = useRef<((index: number, priority?: "high" | "low" | "auto") => HTMLImageElement | null) | null>(null);

  // Initialisation
  useEffect(() => {
    imagesRef.current = Array.from({ length: frameConfig.frameCount }, () => null);
    
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(motion.matches);
    sync();
    motion.addEventListener("change", sync);
    return () => motion.removeEventListener("change", sync);
  }, []);

  // Dessin sur Canvas (Version optimisée pour Brave/Shields)
  const drawFrame = useCallback((progress: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // On évite les options de contexte trop spécifiques qui peuvent être bloquées par les protections Brave
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Redimensionnement du canvas (Robuste face au "Farbling" de Brave sur le DPR)
    const clientWidth = canvas.clientWidth || window.innerWidth;
    const clientHeight = canvas.clientHeight || window.innerHeight;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const renderDpr = Math.min(dpr, 1.5); 
    
    const targetW = Math.round(clientWidth * renderDpr);
    const targetH = Math.round(clientHeight * renderDpr);

    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    // Reset systématique pour éviter les bugs de persistance
    ctx.globalAlpha = 1.0;
    ctx.imageSmoothingEnabled = true;

    const exactFrame = progress * (frameConfig.frameCount - 1);
    const targetIndex = Math.round(exactFrame);
    
    // Fallback: chercher l'image la plus proche déjà chargée
    let imgToDraw = imagesRef.current[targetIndex];
    let actualIndex = targetIndex;

    if (!imgToDraw) {
      for (let offset = 1; offset < 15; offset++) { // Plus grande tolérance de recherche
        if (targetIndex - offset >= 0 && imagesRef.current[targetIndex - offset]) {
          imgToDraw = imagesRef.current[targetIndex - offset];
          actualIndex = targetIndex - offset;
          break;
        }
        if (targetIndex + offset < frameConfig.frameCount && imagesRef.current[targetIndex + offset]) {
          imgToDraw = imagesRef.current[targetIndex + offset];
          actualIndex = targetIndex + offset;
          break;
        }
      }
      
      // Force le chargement immédiat si on ne l'a pas
      if (loadFrameRef.current) {
        loadFrameRef.current(targetIndex, "high");
      }
      
      if (!imgToDraw) return;
    }

    // Sécurité naturalWidth pour Brave
    const imgW = imgToDraw.naturalWidth || imgToDraw.width;
    const imgH = imgToDraw.naturalHeight || imgToDraw.height;
    if (imgW === 0 || imgH === 0) return;

    currentDrawnIndexRef.current = actualIndex;

    // --- MATHÉMATIQUES DE RENDU ---
    const cvsW = canvas.width;
    const cvsH = canvas.height;
    const scaleX = cvsW / imgW;
    const scaleY = cvsH / imgH;
    
    const isMobile = window.innerWidth < MOBILE_BREAKPOINT;
    
    if (isMobile) {
      // --- MOBILE SINGLE DRAW (Aligné en haut) ---
      const VISIBLE_WIDTH_RATIO = 0.58; 
      const fgDrawW = cvsW / VISIBLE_WIDTH_RATIO;
      const fgDrawH = fgDrawW / (imgW / imgH);
      const focalX = 0.46 + (progress * 0.04); 
      const fgDx = (cvsW / 2) - (fgDrawW * focalX);
      const fgDy = 0; 

      ctx.fillStyle = "#080706";
      ctx.fillRect(0, 0, cvsW, cvsH);
      ctx.drawImage(imgToDraw, fgDx, fgDy, fgDrawW, fgDrawH);

      // Fondre le bas
      const fadeHeight = cvsH * 0.25;
      const fadeStart = Math.max(0, fgDy + fgDrawH - fadeHeight);
      const fade = ctx.createLinearGradient(0, fadeStart, 0, fgDy + fgDrawH);
      fade.addColorStop(0, "rgba(8, 7, 6, 0)");
      fade.addColorStop(0.8, "rgba(8, 7, 6, 0.95)");
      fade.addColorStop(1, "#080706");
      ctx.fillStyle = fade;
      ctx.fillRect(0, fadeStart, cvsW, cvsH - fadeStart);
    } else {
      // --- DESKTOP PREMIUM COVER ---
      const baseScale = Math.max(scaleX, scaleY) * WATERMARK_CROP_SCALE;
      const drawW = imgW * baseScale;
      const drawH = imgH * baseScale;
      const dx = (cvsW / 2) - (drawW * 0.5);
      const dy = (cvsH / 2) - (drawH * 0.5);

      ctx.fillStyle = "#080706";
      ctx.fillRect(0, 0, cvsW, cvsH);
      ctx.drawImage(imgToDraw, dx, dy, drawW, drawH);
    }
  }, []);

  // Logique de chargement intelligent
  const loadFrame = useCallback((index: number, priority: "high" | "low" | "auto" = "auto"): HTMLImageElement | null => {
    if (index < 0 || index >= frameConfig.frameCount) return null;
    if (imagesRef.current[index]) return imagesRef.current[index];
    
    const img = new Image();
    // Brave gère mieux le chargement sans décodage explicite synchrone/asynchrone forcé
    img.fetchPriority = priority;
    img.src = frameConfig.framePath(index);
    img.onload = () => {
      imagesRef.current[index] = img;
      const expectedFrame = Math.round(progressRef.current * (frameConfig.frameCount - 1));
      if (expectedFrame === index || currentDrawnIndexRef.current === -1) {
        drawFrame(progressRef.current);
      }
    };
    return null;
  }, [drawFrame]);

  useEffect(() => {
    loadFrameRef.current = loadFrame;
  }, [loadFrame]);

  // Préchargement avec boucle de secours robuste
  useEffect(() => {
    if (reducedMotion) return;
    
    const isMobile = window.innerWidth < MOBILE_BREAKPOINT;
    const step = isMobile ? 3 : 1;
    
    loadFrame(0, "high");
    videoChapters.forEach(c => {
      loadFrame(Math.round(c.start * (frameConfig.frameCount - 1)), "high");
    });

    let currentIndex = 0;
    let timeoutId: any;

    const backgroundLoad = () => {
      let batchCount = 0;
      while (currentIndex < frameConfig.frameCount && batchCount < 5) {
        if (currentIndex % step === 0 && !imagesRef.current[currentIndex]) {
          loadFrame(currentIndex, "low");
          batchCount++;
        }
        currentIndex++;
      }
      if (currentIndex < frameConfig.frameCount) {
        timeoutId = setTimeout(backgroundLoad, 40); // Légèrement plus rapide
      }
    };

    timeoutId = setTimeout(backgroundLoad, 500);
    return () => clearTimeout(timeoutId);
  }, [reducedMotion, loadFrame]);

  // Scroll Sync
  useEffect(() => {
    const updateFromScroll = () => {
      rafRef.current = null;
      const section = sectionRef.current;
      if (!section) return;

      const rect = section.getBoundingClientRect();
      const viewportHeight = window.innerHeight || 1;
      const scrollableDistance = Math.max(1, rect.height - viewportHeight);
      const progress = clamp01(-rect.top / scrollableDistance);
      progressRef.current = progress;

      const nextChapter = getActiveChapter(progress);
      if (nextChapter.id !== chapterIdRef.current) {
        chapterIdRef.current = nextChapter.id;
        setChapter(nextChapter);
      }

      if (!reducedMotion) {
        drawFrame(progress);
      }
    };

    const schedule = () => {
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(updateFromScroll);
    };

    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("orientationchange", schedule);

    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("orientationchange", schedule);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [reducedMotion, drawFrame]);

  if (reducedMotion) {
    return (
      <section id="experience" className="relative h-[100svh] overflow-clip bg-[#080706]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={frameConfig.framePath(0)} alt="" className="absolute inset-0 h-full w-full object-cover object-center" />
        <div className="absolute inset-0 z-30 flex items-end px-5 pb-14 pt-28 sm:px-10 sm:pb-20 md:items-center md:pb-0 lg:px-16">
          <div className="mx-auto w-full max-w-7xl">
            <DynamicVideoText chapter={videoChapters[0]} />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section ref={sectionRef} id="experience" className="scroll-video-section relative overflow-clip bg-[#080706]">
      <div className="video-sticky-viewport sticky top-0 overflow-hidden bg-[#080706]">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" style={{ objectFit: 'cover' }} />
        <div className="video-readable-overlay absolute inset-0 z-10" />
        <div className="video-warmth absolute inset-0 z-10" />
        <div className="video-grain absolute inset-0 z-10" />
        <div aria-hidden="true" className="pointer-events-none absolute bottom-0 right-0 z-20 h-28 w-44 bg-gradient-to-br from-[#080706]/0 via-[#080706]/88 to-[#080706] md:h-24 md:w-44" />
        <div className="absolute inset-0 z-30 flex items-end px-5 pb-14 pt-28 sm:px-10 sm:pb-20 md:items-center md:pb-0 lg:px-16">
          <div className="mx-auto w-full max-w-7xl">
            <DynamicVideoText chapter={chapter} />
          </div>
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 h-32 bg-gradient-to-t from-[#080706] via-[#080706]/72 to-transparent" />
      </div>
    </section>
  );
}
