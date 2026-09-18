/**
 * FX — shared motion & 3D layer for all pages.
 * Pages opt in with data attributes:
 *   data-reveal[="left|right|zoom|flip"]   fade/3D-rise when scrolled into view
 *   data-reveal-stagger                     stagger the data-reveal children
 *   data-split                              3D word-by-word headline reveal
 *   data-tilt[="max deg"]                   3D mouse tilt with glare
 *   data-magnetic                           element drifts toward the cursor
 *   data-parallax="0.2"                     scroll parallax (speed factor)
 *   data-skill="85"                         skill bar grows to width on reveal
 *   .counter[data-target][data-suffix]      count-up on reveal
 */
(function () {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  document.documentElement.classList.add('fx');

  // ── Scroll progress bar ──
  const bar = document.createElement('div');
  bar.className = 'fx-progress';
  document.body.appendChild(bar);

  // ── Word split for headlines ──
  document.querySelectorAll('[data-split]').forEach(el => {
    let i = 0;
    const walk = node => {
      [...node.childNodes].forEach(child => {
        if (child.nodeType === 3) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach(part => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            const outer = document.createElement('span');
            outer.className = 'fx-word';
            const inner = document.createElement('span');
            inner.textContent = part;
            inner.style.setProperty('--fx-delay', (i++ * 0.08) + 's');
            outer.appendChild(inner);
            frag.appendChild(outer);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === 1 && child.classList.contains('fx-nosplit')) {
          // Keep the element whole (e.g. an underlined word) but still animate it as one word
          const outer = document.createElement('span');
          outer.className = 'fx-word';
          child.replaceWith(outer);
          outer.appendChild(child);
          child.style.setProperty('--fx-delay', (i++ * 0.08) + 's');
        } else if (child.nodeType === 1 && child.tagName !== 'BR') {
          walk(child);
        }
      });
    };
    walk(el);
    el.classList.add('fx-split');
  });

  // ── Stagger delays ──
  document.querySelectorAll('[data-reveal-stagger]').forEach(parent => {
    const step = parseFloat(parent.dataset.revealStagger) || 0.1;
    parent.querySelectorAll(':scope > [data-reveal]').forEach((child, i) => {
      child.style.setProperty('--fx-delay', (i * step) + 's');
    });
  });

  // ── Counters ──
  function runCounter(el) {
    const target = +el.dataset.target;
    const suffix = el.dataset.suffix || '';
    if (reduced) { el.textContent = target + suffix; return; }
    const start = performance.now();
    const duration = 1600;
    const tick = now => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // ── Reveal observer ──
  const revealTargets = document.querySelectorAll('[data-reveal], [data-split], [data-skill], .counter');
  const onVisible = el => {
    el.classList.add('is-visible');
    if (el.dataset.skill) el.style.width = el.dataset.skill + '%';
    if (el.classList.contains('counter')) runCounter(el);
  };
  if ('IntersectionObserver' in window && !reduced) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        onVisible(entry.target);
        io.unobserve(entry.target);
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
    revealTargets.forEach(el => io.observe(el));
  } else {
    revealTargets.forEach(onVisible);
  }

  // ── 3D tilt with glare ──
  if (finePointer && !reduced) {
    document.querySelectorAll('[data-tilt]').forEach(card => {
      const max = parseFloat(card.dataset.tilt) || 10;
      const glare = document.createElement('div');
      glare.className = 'fx-glare';
      card.appendChild(glare);
      let raf = null;
      card.addEventListener('mousemove', e => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          card.style.transition = 'transform .1s ease-out';
          card.style.transform = `perspective(900px) rotateX(${(0.5 - py) * max * 2}deg) rotateY(${(px - 0.5) * max * 2}deg) scale3d(1.03,1.03,1.03)`;
          card.style.setProperty('--gx', px * 100 + '%');
          card.style.setProperty('--gy', py * 100 + '%');
          card.style.zIndex = '10';
        });
      });
      card.addEventListener('mouseleave', () => {
        cancelAnimationFrame(raf);
        card.style.transition = 'transform .7s cubic-bezier(.2,.8,.2,1)';
        card.style.transform = '';
        card.style.zIndex = '';
      });
    });

    // ── Magnetic buttons ──
    document.querySelectorAll('[data-magnetic]').forEach(btn => {
      btn.style.transition = 'transform .4s cubic-bezier(.2,.8,.2,1)';
      btn.addEventListener('mousemove', e => {
        const r = btn.getBoundingClientRect();
        const x = e.clientX - r.left - r.width / 2;
        const y = e.clientY - r.top - r.height / 2;
        btn.style.transform = `translate3d(${x * 0.25}px, ${y * 0.35}px, 0)`;
      });
      btn.addEventListener('mouseleave', () => { btn.style.transform = ''; });
    });

    // ── Custom cursor ──
    const dot = document.createElement('div');
    const ring = document.createElement('div');
    dot.className = 'fx-cursor';
    ring.className = 'fx-cursor-ring';
    document.body.append(dot, ring);
    let mx = -100, my = -100, rx = -100, ry = -100;
    window.addEventListener('mousemove', e => {
      mx = e.clientX; my = e.clientY;
      dot.style.transform = `translate3d(${mx}px, ${my}px, 0)`;
    }, { passive: true });
    const follow = () => {
      rx += (mx - rx) * 0.18;
      ry += (my - ry) * 0.18;
      ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
      requestAnimationFrame(follow);
    };
    follow();
    document.addEventListener('mouseover', e => {
      ring.classList.toggle('is-hover', !!e.target.closest('a, button, [data-tilt], select, input, textarea, label'));
    });
  }

  // ── Scroll: progress + parallax ──
  const parallaxEls = reduced ? [] : [...document.querySelectorAll('[data-parallax]')];
  let ticking = false;
  const onScroll = () => {
    const h = document.documentElement;
    const max = h.scrollHeight - h.clientHeight;
    bar.style.transform = `scaleX(${max > 0 ? h.scrollTop / max : 0})`;
    parallaxEls.forEach(el => {
      const speed = parseFloat(el.dataset.parallax) || 0.2;
      const r = el.parentElement.getBoundingClientRect();
      const offset = (r.top + r.height / 2 - window.innerHeight / 2) * speed;
      el.style.transform = `translate3d(0, ${offset}px, 0)`;
    });
    ticking = false;
  };
  window.addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
  }, { passive: true });
  onScroll();

  // ── Tap-to-flip for touch devices ──
  if (!finePointer) {
    document.querySelectorAll('.fx-flip').forEach(card => {
      card.addEventListener('click', () => card.classList.toggle('is-flipped'));
    });
  }
})();
