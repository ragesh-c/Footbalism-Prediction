// ─────────────────────────────────────────────
//  parallax.js — Scroll-driven parallax layers
//  One passive scroll listener, all effects batched
//  into a single requestAnimationFrame write pass.
// ─────────────────────────────────────────────

const ParallaxController = (() => {

  const layers = [];
  let ticking = false;
  let prefersReducedMotion = false;
  let heroContent = null;
  let heroHeight = 0;

  function init() {
    prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    // When native CSS scroll-driven animations are available, hero.css
    // animates the slideshow container itself — don't double-drive it from JS.
    const hasCSSScrollTimeline = window.CSS && CSS.supports('(animation-timeline: view()) and (animation-range: entry)');

    document.querySelectorAll("[data-parallax]").forEach(el => {
      if (hasCSSScrollTimeline && el.classList.contains("hero__slideshow-container")) {
        return;
      }
      layers.push({
        el,
        speed: parseFloat(el.dataset.parallax) || 0.3
      });
    });

    const hero = document.getElementById("hero");
    heroContent = document.querySelector(".hero__content");
    if (hero && heroContent) {
      heroHeight = hero.offsetHeight;
      window.addEventListener("resize", () => { heroHeight = hero.offsetHeight; }, { passive: true });
    }

    if (layers.length === 0 && !heroContent) return;

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
      el.style.transform = `translateY(${scrollY * speed}px)`;
    });

    // Hero content fades and drifts as you scroll past it
    if (heroContent && heroHeight > 0) {
      const progress = Math.min(scrollY / (heroHeight * 0.6), 1);
      heroContent.style.opacity = 1 - progress * 0.7;
      heroContent.style.transform = `translateY(${progress * 40}px)`;
    }

    ticking = false;
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

  // Smooth scroll for in-page anchors — through Lenis when active
  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener("click", e => {
        const target = document.querySelector(anchor.getAttribute("href"));
        if (!target) return;
        e.preventDefault();
        if (window.__lenis) {
          window.__lenis.scrollTo(target, { offset: -88, duration: 1.2 });
        } else {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
    });
  }

  function initAll() {
    init();
    initScrollReveal();
    initSmoothScroll();
  }

  return { init: initAll };
})();
