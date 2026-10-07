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
