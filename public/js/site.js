// Shared behaviour for every page: mobile menu and the Google Translate widget.
(function () {
  const toggle = document.querySelector('.menu-toggle');
  const menu = document.getElementById('mobileMenu');

  if (toggle && menu) {
    const setOpen = (open) => {
      menu.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    };
    toggle.addEventListener('click', () => setOpen(!menu.classList.contains('open')));
    menu.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menu.classList.contains('open')) {
        setOpen(false);
        toggle.focus();
      }
    });
  }

  // Older page scripts call this name; keep it working
  window.toggleMobileMenu = () => toggle && toggle.click();

  // "Show Google Map": the map only loads when someone asks for it
  const mapToggle = document.getElementById('mapToggle');
  const mapFrame = document.getElementById('googleMapContainer');
  if (mapToggle && mapFrame) {
    mapToggle.addEventListener('click', () => {
      const show = mapFrame.hidden;
      const iframe = mapFrame.querySelector('iframe');
      if (show && iframe && !iframe.src) iframe.src = iframe.dataset.src;
      mapFrame.hidden = !show;
      mapToggle.setAttribute('aria-expanded', String(show));
      const label = document.getElementById('mapTriggerText');
      if (label) label.textContent = show ? 'Hide Google Map' : 'Show Google Map';
    });
  }

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Homepage slideshow
  const slider = document.querySelector('[data-slider]');
  if (slider) {
    const slides = [...slider.querySelectorAll('.hero-slide')];
    const dots = [...slider.querySelectorAll('.hero-dot')];
    const pauseBtn = slider.querySelector('.hero-pause');
    let index = 0;
    let timer = null;
    let paused = reduceMotion;

    const show = (n) => {
      index = (n + slides.length) % slides.length;
      slides.forEach((s, i) => {
        const on = i === index;
        s.classList.toggle('is-active', on);
        s.setAttribute('aria-hidden', String(!on));
        s.querySelectorAll('a').forEach((a) => { if (on) a.removeAttribute('tabindex'); else a.setAttribute('tabindex', '-1'); });
      });
      dots.forEach((d, i) => { if (i === index) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current'); });
    };
    const stop = () => { clearInterval(timer); timer = null; };
    const start = () => { stop(); if (!paused && slides.length > 1) timer = setInterval(() => show(index + 1), 6500); };

    slider.querySelector('.hero-controls').hidden = false;
    slider.querySelector('.prev').addEventListener('click', () => { show(index - 1); start(); });
    slider.querySelector('.next').addEventListener('click', () => { show(index + 1); start(); });
    dots.forEach((d, i) => d.addEventListener('click', () => { show(i); start(); }));
    if (pauseBtn) {
      if (reduceMotion) { pauseBtn.textContent = 'Play'; pauseBtn.setAttribute('aria-pressed', 'true'); }
      pauseBtn.addEventListener('click', () => {
        paused = !paused;
        pauseBtn.textContent = paused ? 'Play' : 'Pause';
        pauseBtn.setAttribute('aria-pressed', String(paused));
        if (paused) stop(); else start();
      });
    }
    // Hold still while someone is reading or using the controls
    slider.addEventListener('mouseenter', stop);
    slider.addEventListener('mouseleave', start);
    slider.addEventListener('focusin', stop);
    slider.addEventListener('focusout', start);
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
    start();
  }

  // Impact counters count up once when they scroll into view
  const counters = document.querySelectorAll('[data-count]');
  if (counters.length && !reduceMotion && 'IntersectionObserver' in window) {
    const fmt = (n) => n.toLocaleString('en-IN');
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        io.unobserve(entry.target);
        const el = entry.target;
        const target = Number(el.dataset.count);
        const t0 = performance.now();
        const tick = (now) => {
          const p = Math.min(1, (now - t0) / 1400);
          el.textContent = fmt(Math.round(target * (1 - Math.pow(1 - p, 3))));
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    }, { threshold: 0.6 });
    counters.forEach((el) => io.observe(el));
  }

  // Footer newsletter signup (saved under Connections & Subscribers in the admin panel)
  const subscribe = document.getElementById('subscribeForm');
  if (subscribe) {
    const status = document.getElementById('subscribeStatus');
    subscribe.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(subscribe).entries());
      if (!data.name.trim() || !data.email.trim() || !data.phone.trim()) {
        status.textContent = 'Enter your name, email and phone to subscribe.';
        return;
      }
      if (!subscribe.subEmail.checkValidity()) {
        status.textContent = 'Enter a valid email address.';
        return;
      }
      const btn = subscribe.querySelector('button');
      btn.disabled = true;
      status.textContent = 'Subscribing...';
      try {
        const res = await fetch('/api/connections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: data.name.trim(), email: data.email.trim(), phone: data.phone.trim() }),
        });
        if (!res.ok) throw new Error();
        subscribe.reset();
        status.textContent = 'Subscribed. Thank you for staying connected.';
      } catch (err) {
        status.textContent = 'Could not subscribe right now. Please try again, or email info@dhaathreefoundation.org.';
      } finally {
        btn.disabled = false;
      }
    });
  }

  // Donation amount: quick-pick buttons, and an amount passed in the link (?amount=1000)
  const amountInput = document.getElementById('donorAmount');
  if (amountInput) {
    const chips = [...document.querySelectorAll('.amount-chip')];
    const setAmount = (value) => {
      amountInput.value = value;
      amountInput.dataset.preset = value;
      amountInput.readOnly = false;
      chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.amount === String(value))));
      amountInput.dispatchEvent(new Event('input', { bubbles: true }));
    };
    chips.forEach((c) => c.addEventListener('click', () => setAmount(c.dataset.amount)));
    amountInput.addEventListener('input', () => chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.amount === amountInput.value))));
    const preset = Number(new URLSearchParams(window.location.search).get('amount'));
    if (preset > 0 && preset < 10000000) setAmount(String(Math.round(preset)));
  }

  // Google Translate: loaded once here instead of on every page
  if (document.getElementById('google_translate_element')) {
    window.googleTranslateElementInit = function () {
      new google.translate.TranslateElement({ pageLanguage: 'en' }, 'google_translate_element');
    };
    const s = document.createElement('script');
    s.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
    s.async = true;
    document.body.appendChild(s);
  }
})();
