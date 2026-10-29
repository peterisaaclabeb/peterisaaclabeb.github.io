(function () {
  'use strict';

  var root = document.documentElement;
  var motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  function reduced() { return motionQuery.matches; }
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  /* ---------- footer year ---------- */
  var year = $('#year');
  if (year) year.textContent = String(new Date().getFullYear());

  /* ---------- profile photo, with pixel-art "PI" fallback ---------- */
  var avatar = $('#avatar');
  if (avatar) {
    var img = $('img', avatar);
    var useFallback = function () {
      var pix = $('#pix', avatar);
      if (pix && !pix.childElementCount) {
        var art = [
          '####..###',
          '#...#..#.',
          '#...#..#.',
          '####...#.',
          '#......#.',
          '#......#.',
          '#.....###'
        ].join('');
        var frag = document.createDocumentFragment();
        for (var i = 0; i < art.length; i++) {
          var cell = document.createElement('i');
          if (art.charAt(i) === '#') cell.className = 'on';
          frag.appendChild(cell);
        }
        pix.appendChild(frag);
      }
      avatar.classList.add('is-fallback');
    };
    if (!img) useFallback();
    else if (img.complete && img.naturalWidth === 0) useFallback();
    else img.addEventListener('error', useFallback);
  }

  /* ---------- Cairo clock (decorative) ---------- */
  var clock = $('#clock');
  if (clock) {
    try {
      var fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Cairo', hour: '2-digit', minute: '2-digit', hour12: false });
      var tick = function () { clock.textContent = fmt.format(new Date()); };
      tick();
      window.setInterval(tick, 15000);
    } catch (e) {
      clock.parentNode.hidden = true;
    }
  }

  /* ---------- typed section commands ----------
     Text is always in the DOM at full width (no layout shift). A command is only
     clipped if it starts below the fold; it is revealed as soon as it scrolls in,
     with a timeout safety net, and everything is revealed before printing. */
  var typed = $$('.sec-head .cmd[data-type]');
  typed.forEach(function (el) {
    if (!$('.txt', el)) {
      var span = document.createElement('span');
      span.className = 'txt';
      span.textContent = el.textContent;
      el.textContent = '';
      el.appendChild(span);
    }
    el.style.setProperty('--n', el.textContent.length);
  });

  function finish(el) {
    el.classList.remove('pending', 'typing');
  }
  function type(el) {
    if (!el.classList.contains('pending')) return;
    el.classList.remove('pending');
    if (reduced()) return;
    el.classList.add('typing');
    var txt = $('.txt', el);
    var done = function () { finish(el); };
    if (txt) txt.addEventListener('animationend', done, { once: true });
    window.setTimeout(done, el.textContent.length * 48 + 600);
  }
  function revealAll() { typed.forEach(function (el) { finish(el); }); }

  var canClip = window.CSS && CSS.supports && CSS.supports('clip-path', 'inset(0 100% 0 0)');
  if ('IntersectionObserver' in window && canClip && !reduced()) {
    var vh = window.innerHeight || root.clientHeight;
    typed.forEach(function (el) {
      if (el.getBoundingClientRect().top > vh) el.classList.add('pending');
    });
    var typer = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          type(en.target);
          typer.unobserve(en.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    typed.forEach(function (el) { if (el.classList.contains('pending')) typer.observe(el); });
  }
  window.addEventListener('beforeprint', revealAll);
  if (motionQuery.addEventListener) motionQuery.addEventListener('change', function () { if (reduced()) revealAll(); });

  /* ---------- active window in the status bar ---------- */
  var header = $('#tmux');
  var links = $$('.windows a');
  var sections = links.map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); });
  var current = $('#current');
  var activeIndex = -1;
  var lockUntilScrollEnds = false;
  var scrollEndTimer = 0;

  function barHeight() { return header ? header.getBoundingClientRect().height : 0; }

  function setActive(idx) {
    if (idx === activeIndex || idx < 0) return;
    activeIndex = idx;
    links.forEach(function (a, i) {
      if (i === idx) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
    if (current) current.innerHTML = links[idx].innerHTML;
  }

  function computeActive() {
    var y = window.scrollY || window.pageYOffset;
    var atBottom = y + window.innerHeight >= root.scrollHeight - 4;
    if (atBottom) return sections.length - 1;
    var line = y + barHeight() + (window.innerHeight - barHeight()) * 0.3;
    var idx = 0;
    sections.forEach(function (s, i) {
      if (s && s.getBoundingClientRect().top + y <= line) idx = i;
    });
    return idx;
  }

  var ticking = false;
  window.addEventListener('scroll', function () {
    if (lockUntilScrollEnds) {
      window.clearTimeout(scrollEndTimer);
      scrollEndTimer = window.setTimeout(function () { lockUntilScrollEnds = false; }, 160);
      return;
    }
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () { ticking = false; setActive(computeActive()); });
  }, { passive: true });
  window.addEventListener('resize', function () { setActive(computeActive()); });
  setActive(computeActive());

  /* ---------- navigation ---------- */
  function focusSection(s) {
    var target = s.querySelector('.sec-head') || s;
    target.focus({ preventScroll: true });
  }

  function goTo(idx) {
    var s = sections[idx];
    if (!s) return;
    lockUntilScrollEnds = true;
    window.clearTimeout(scrollEndTimer);
    scrollEndTimer = window.setTimeout(function () { lockUntilScrollEnds = false; }, 1200);
    setActive(idx);
    if (idx === 0) window.scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' });
    else s.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
    focusSection(s);
    if (history.replaceState) history.replaceState(null, '', idx === 0 ? location.pathname + location.search : '#' + s.id);
  }

  links.forEach(function (a, i) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      closeMenu(false);
      goTo(i);
    });
  });
  var session = $('.session');
  if (session) session.addEventListener('click', function (e) { e.preventDefault(); closeMenu(false); goTo(0); });

  /* ---------- mobile menu ---------- */
  var menuBtn = $('#menu-btn');
  function menuOpen() { return header && header.classList.contains('is-open'); }
  function openMenu() {
    header.classList.add('is-open');
    menuBtn.setAttribute('aria-expanded', 'true');
  }
  function closeMenu(returnFocus) {
    if (!menuOpen()) return;
    header.classList.remove('is-open');
    menuBtn.setAttribute('aria-expanded', 'false');
    if (returnFocus) menuBtn.focus();
  }
  if (menuBtn && header) {
    menuBtn.addEventListener('click', function () { if (menuOpen()) closeMenu(false); else openMenu(); });
    document.addEventListener('click', function (e) { if (menuOpen() && !header.contains(e.target)) closeMenu(false); });
    document.addEventListener('focusin', function (e) { if (menuOpen() && !header.contains(e.target)) closeMenu(false); });
    window.matchMedia('(min-width: 1024px)').addEventListener('change', function (m) { if (m.matches) closeMenu(false); });
  }

  /* ---------- help dialog ---------- */
  var help = $('#help');
  var helpBtn = $('#help-open');
  var lastFocus = null;
  var dialogSupported = help && typeof help.showModal === 'function';
  function openHelp() {
    if (!dialogSupported || help.open) return;
    lastFocus = document.activeElement;
    help.showModal();
    var closeBtn = $('.close', help);
    if (closeBtn) closeBtn.focus();
  }
  function closeHelp() { if (dialogSupported && help.open) help.close(); }
  if (dialogSupported) {
    help.addEventListener('close', function () {
      if (lastFocus && typeof lastFocus.focus === 'function' && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
      lastFocus = null;
    });
    help.addEventListener('click', function (e) { if (e.target === help) closeHelp(); });
    if (helpBtn) helpBtn.addEventListener('click', openHelp);
  } else {
    if (helpBtn) helpBtn.hidden = true;
    var hint = $('.foot .hint');
    if (hint) hint.hidden = true;
  }

  /* ---------- keyboard shortcuts ---------- */
  function isTypingTarget(t) {
    if (!t || t === document.body) return false;
    if (t.isContentEditable) return true;
    var tag = t.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  }

  document.addEventListener('keydown', function (e) {
    if (e.defaultPrevented || e.isComposing || e.metaKey || e.ctrlKey || e.altKey) return;
    if (isTypingTarget(e.target)) return;

    if (e.key === 'Escape' && menuOpen()) { closeMenu(true); return; }

    if (e.key === '?') {
      if (!dialogSupported) return;
      e.preventDefault();
      if (help.open) closeHelp(); else { closeMenu(false); openHelp(); }
      return;
    }
    if (help && help.open) return;
    if (e.shiftKey) return;

    var max = sections.length - 1;
    if (/^[0-9]$/.test(e.key)) {
      var n = parseInt(e.key, 10);
      if (n > max) return;
      e.preventDefault();
      closeMenu(false);
      goTo(n);
    } else if (e.key === 'j' || e.key === 'k') {
      e.preventDefault();
      closeMenu(false);
      var base = activeIndex < 0 ? computeActive() : activeIndex;
      goTo(e.key === 'j' ? Math.min(max, base + 1) : Math.max(0, base - 1));
    }
  });
})();
