// ─────────────────────────────────────────────
//  parallax.js — Scroll-driven parallax layers
// ─────────────────────────────────────────────

const ParallaxController = (() => {

  const layers = [];
  let ticking = false;
  let prefersReducedMotion = false;

  function init() {
    prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    // Check if native CSS scroll animations are supported
    const hasCSSScrollTimeline = window.CSS && CSS.supports('(animation-timeline: view()) and (animation-range: entry)');

    // Register all parallax layers from DOM
    document.querySelectorAll("[data-parallax]").forEach(el => {
      // If native CSS scroll animations are supported, skip JS parallax for those elements in hero
      if (hasCSSScrollTimeline && (
        el.classList.contains('hero__magazine-card') || 
        el.classList.contains('hero__magazine-accent') || 
        el.classList.contains('hero__watermark--bg')
      )) {
        return;
      }

      layers.push({
        el,
        speed: parseFloat(el.dataset.parallax) || 0.3,
        initialY: 0
      });
    });

    if (layers.length === 0) return;

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll(); // Initial position
  }

  function onScroll() {
    if (!ticking) {
      requestAnimationFrame(update);
      ticking = true;
    }
  }

  function update() {
    const scrollY = window.scrollY;

    layers.forEach(({ el, speed }) => {
      const offset = scrollY * speed;
      el.style.transform = `translateY(${offset}px)`;
    });

    ticking = false;
  }

  // Hero section fade on scroll
  function initHeroFade() {
    const hero = document.getElementById("hero");
    const heroContent = document.querySelector(".hero__content");
    if (!hero || !heroContent || prefersReducedMotion) return;

    const heroHeight = hero.offsetHeight;

    window.addEventListener("scroll", () => {
      const progress = Math.min(window.scrollY / (heroHeight * 0.6), 1);
      heroContent.style.opacity = 1 - progress * 0.7;
      heroContent.style.transform = `translateY(${progress * 40}px)`;
    }, { passive: true });
  }

  // Reveal elements as they enter viewport
  function initScrollReveal() {
    if (prefersReducedMotion) {
      document.querySelectorAll("[data-reveal]").forEach(el => {
        el.classList.add("is-visible");
      });
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: "0px 0px -60px 0px" });

    document.querySelectorAll("[data-reveal]").forEach(el => {
      observer.observe(el);
    });
  }

  // Smooth scroll for CTA button
  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener("click", e => {
        const target = document.querySelector(anchor.getAttribute("href"));
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  function initAll() {
    init();
    initHeroFade();
    initScrollReveal();
    initSmoothScroll();
  }

  return { init: initAll };
})();
