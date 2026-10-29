/* VORA Experience Controller — zero dependencies, progressive, privacy-conscious.
   Does not fetch anything, alter source logo, or intercept forms/navigation.
*/
(() => {
  'use strict';
  const doc = document;
  const root = doc.documentElement;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const progress = doc.querySelector('.vora-scroll-progress__fill');
  let progressFrame = 0;

  function updateProgress() {
    progressFrame = 0;
    if (!progress) return;
    const total = Math.max(0, doc.documentElement.scrollHeight - window.innerHeight);
    const fraction = total > 0 ? Math.min(1, Math.max(0, window.scrollY / total)) : 0;
    progress.style.transform = `scaleX(${fraction.toFixed(4)})`;
  }
  function queueProgress() {
    if (!progressFrame) progressFrame = window.requestAnimationFrame(updateProgress);
  }
  window.addEventListener('scroll', queueProgress, {passive: true});
  window.addEventListener('resize', queueProgress, {passive: true});
  window.addEventListener('pageshow', queueProgress, {passive: true});
  queueProgress();

  // Subtle reveal on entering the viewport. Never hide content before observation:
  // offscreen SSR content remains visible in no-JS, screen captures and assistive tech.
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const target = entry.target;
        target.classList.add('in-view');
        observer.unobserve(target);
        if (reduced.matches || typeof target.animate !== 'function') return;
        const siblings = target.parentElement ? Array.from(target.parentElement.children) : [];
        const order = Math.min(5, Math.max(0, siblings.indexOf(target)));
        target.animate([
          { opacity: .76, transform: 'translate3d(0, 19px, 0)' },
          { opacity: 1, transform: 'translate3d(0, 0, 0)' }
        ], {duration: 560 + order * 55, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'none'});
      });
    }, {threshold: .13, rootMargin: '0px 0px -4% 0px'});
    doc.querySelectorAll(
      '.site-section .section-head, .site-section .step, .service-portfolio .service-tile,' +
      '.site-section .clay-relief-figure, .site-section .insight-card,' +
      '.site-section .scope-copy, .site-section .workflow-bullets span,' +
      '.service-detail-hero .service-detail-copy, .service-detail-hero .service-hero-art,' +
      '.page-intro .wrap, .mode-navigation .mode-tab, .editorial-statement .large-quote'
    ).forEach(el => observer.observe(el));
  }

  // Use the native cursor without tracking pointer position.
  // Ambient 3D clay animations do not depend on the mouse.

  // The RFQ preview updates the actual submitted service and route selection.
  // It is not a quote, pricing tool, or shipping-availability promise.
  const quoteForm = doc.querySelector('form[data-vora-rfq]');
  const summary = doc.querySelector('[data-vora-rfq-summary]');
  if (quoteForm && summary) {
    const locale = doc.documentElement.lang === 'id' ? 'id' : 'en';
    const empty = locale === 'id' ? 'Pilih layanan dan isi rute pengiriman.' : 'Choose a service and enter the shipment route.';
    function updateSummary() {
      const mode = quoteForm.elements.namedItem('mode');
      const origin = quoteForm.elements.namedItem('origin');
      const destination = quoteForm.elements.namedItem('destination');
      const modeLabel = mode?.selectedOptions?.[0]?.value ? mode.selectedOptions[0].textContent.trim() : '';
      const from = String(origin?.value || '').trim();
      const to = String(destination?.value || '').trim();
      const text = [modeLabel, from || to ? `${from || '…'}  →  ${to || '…'}` : ''].filter(Boolean).join('  ·  ');
      const content = summary.querySelector('strong');
      if (content) content.textContent = text || empty;
      summary.dataset.filled = String(Boolean(text));
    }
    quoteForm.addEventListener('input', updateSummary);
    quoteForm.addEventListener('change', updateSummary);
    updateSummary();
  }
  root.dataset.voraExperience = 'ready';
})();
