function initBurger() {
  const burger = document.getElementById("burger");
  const nav = document.getElementById("nav");

  if (!burger || !nav) return;

  nav.classList.remove("active");
  burger.setAttribute("aria-expanded", "false");

  function closeMenu() {
    nav.classList.remove("active");
    burger.setAttribute("aria-expanded", "false");
  }

  burger.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("active");
    burger.setAttribute("aria-expanded", String(isOpen));
  });

  document.querySelectorAll(".nav a").forEach(link => {
    link.addEventListener("click", () => {
      closeMenu();
    });
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 800) closeMenu();
  }, { passive: true });
}

async function loadPart(selector, url) {
  const el = document.querySelector(selector);
  if (!el) return;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Kann nicht geladen werden: ${url} (${res.status})`);

  el.innerHTML = await res.text();
}

/* ✅ REVEAL */
function initReveal() {
  const items = document.querySelectorAll(".reveal");
  if (!items.length) return;

  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add("is-visible");
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });

  items.forEach(el => io.observe(el));
}

function initHeroWaves() {
  const canvases = document.querySelectorAll(".hero-waves");
  if (!canvases.length) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  canvases.forEach((canvas) => {
    if (canvas.dataset.wavesReady === "true") return;
    canvas.dataset.wavesReady = "true";

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const hero = canvas.closest(".home-hero, .offer-hero, .strategy-hero, .contact-hero, .hero");
    if (!hero) return;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let frame = 0;
    let rafId = 0;
    let mouseX = 0;
    let mouseY = 0;
    let easedX = 0;
    let easedY = 0;

    const lines = Array.from({ length: 11 }, (_, index) => ({
      offset: index / 8,
      phase: index * 0.72,
      speed: 0.00062 + index * 0.00004,
      amp: 20 + index * 3.8,
      alpha: 0.18 + index * 0.015
    }));

    function resize() {
      const rect = hero.getBoundingClientRect();
      width = Math.max(1, Math.round(rect.width));
      height = Math.max(1, Math.round(rect.height));
      dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw(0);
    }

    function draw(time) {
      ctx.clearRect(0, 0, width, height);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      const baseY = height * 0.44;
      const spread = height * 0.34;
      const mouseDriftX = easedX * 26;
      const mouseDriftY = easedY * 14;

      lines.forEach((line, index) => {
        const y = baseY + spread * line.offset + mouseDriftY * (line.offset - 0.5);
        const wave = time * line.speed + line.phase;
        const amplitude = line.amp * (0.75 + line.offset * 0.55);

        ctx.beginPath();
        ctx.strokeStyle = index % 2 ? `rgba(200, 155, 200, ${line.alpha})` : `rgba(214, 180, 252, ${line.alpha * 0.8})`;
        ctx.lineWidth = index % 3 === 0 ? 0.75 : 1;

        for (let x = -40; x <= width + 40; x += 18) {
          const progress = x / Math.max(width, 1);
          const curve =
            Math.sin(progress * Math.PI * 2.1 + wave) * amplitude +
            Math.sin(progress * Math.PI * 4.4 + wave * 0.72) * amplitude * 0.22;
          const silkDrift = Math.sin(wave * 0.86 + index) * 18;
          const px = x + silkDrift + mouseDriftX * (0.2 + line.offset * 0.5);
          const py = y + curve;

          if (x === -40) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }

        ctx.stroke();
      });

      drawLogoEcho(time);
    }

    function drawLogoEcho(time) {
      const t = time * 0.001;
      const cx = width * 0.17 + easedX * 22;
      const cy = height * 0.62 + easedY * 12;
      const maxRadius = Math.min(width, height) * 0.46;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(Math.sin(t * 0.18) * 0.035);

      for (let i = 0; i < 8; i += 1) {
        const radius = maxRadius * (0.46 + i * 0.075);
        const start = -Math.PI * 0.78 + i * 0.08 + Math.sin(t * 0.32 + i) * 0.08;
        const end = Math.PI * 0.52 + i * 0.05 + Math.sin(t * 0.22 + i) * 0.06;
        const dashMove = -time * (0.045 + i * 0.004);

        ctx.beginPath();
        ctx.setLineDash([64 + i * 4, 20, 10, 26]);
        ctx.lineDashOffset = dashMove;
        ctx.strokeStyle = `rgba(200, 155, 200, ${0.18 + i * 0.018})`;
        ctx.lineWidth = i % 2 === 0 ? 0.9 : 1.15;
        ctx.arc(0, 0, radius, start, end);
        ctx.stroke();

        const dotAngle = start + ((end - start) * ((t * 0.09 + i * 0.13) % 1));
        const dotX = Math.cos(dotAngle) * radius;
        const dotY = Math.sin(dotAngle) * radius;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.fillStyle = `rgba(115, 22, 114, ${0.18 + i * 0.014})`;
        ctx.arc(dotX, dotY, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      ctx.save();
      ctx.translate(width * 0.86 + easedX * -18, height * 0.44 + easedY * 10);
      ctx.rotate(Math.PI * 0.9 + Math.sin(t * 0.16) * 0.03);

      for (let i = 0; i < 5; i += 1) {
        const radius = maxRadius * (0.38 + i * 0.085);
        const start = -Math.PI * 0.52 + i * 0.11;
        const end = Math.PI * 0.58 + i * 0.08;

        ctx.beginPath();
        ctx.setLineDash([42, 18, 6, 24]);
        ctx.lineDashOffset = time * (0.032 + i * 0.003);
        ctx.strokeStyle = `rgba(214, 180, 252, ${0.13 + i * 0.013})`;
        ctx.lineWidth = 0.85;
        ctx.arc(0, 0, radius, start, end);
        ctx.stroke();
      }

      ctx.restore();
    }

    function animate(time) {
      easedX += (mouseX - easedX) * 0.035;
      easedY += (mouseY - easedY) * 0.035;
      draw(time);
      rafId = window.requestAnimationFrame(animate);
    }

    function onMouseMove(event) {
      const rect = hero.getBoundingClientRect();
      mouseX = ((event.clientX - rect.left) / Math.max(rect.width, 1) - 0.5) * 2;
      mouseY = ((event.clientY - rect.top) / Math.max(rect.height, 1) - 0.5) * 2;
    }

    function start() {
      window.cancelAnimationFrame(rafId);
      if (reduceMotion.matches) {
        easedX = 0;
        easedY = 0;
        draw(0);
        return;
      }
      rafId = window.requestAnimationFrame(animate);
    }

    resize();
    start();

    hero.addEventListener("mousemove", onMouseMove, { passive: true });
    hero.addEventListener("mouseleave", () => {
      mouseX = 0;
      mouseY = 0;
    }, { passive: true });

    window.addEventListener("resize", resize, { passive: true });
    reduceMotion.addEventListener?.("change", start);
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  initHeroWaves();

  try {
    // ✅ W folderze /reiki/ muszą być ścieżki RELATYWNE
    await loadPart("#site-header", "header.html?v=shared-header-2");
    await loadPart("#site-footer", "footer.html?v=shared-header-2");

    initBurger();
    initReveal();
  } catch (e) {
    console.error(e);
  }
});

if (document.readyState !== "loading") {
  initHeroWaves();
}

// --- HERO subtle motion ---
(function () {
  function extractUrl(bg) {
    const m = bg && bg.match(/url\(["']?(.*?)["']?\)/i);
    return m ? m[1] : "";
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".hero-top").forEach(hero => {
      const inlineBg = hero.style.backgroundImage;
      const computedBg = getComputedStyle(hero).backgroundImage;

      const url = extractUrl(inlineBg) || extractUrl(computedBg);
      if (!url) return;

      hero.style.setProperty("--hero-img", `url("${url}")`);
    });
  });
})();
