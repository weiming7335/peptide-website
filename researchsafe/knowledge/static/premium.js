// Premium interaction layer - View Transitions, staggered entrances,
// pointer-tracked card glow, stat count-ups, ⌘K command palette.
(function () {
  'use strict';

  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- View Transitions API around SPA navigation ----
  // Must run after bridge.js has wrapped navigate.
  function wrapNavigate() {
    var orig = window.navigate;
    if (!orig || orig.__pvt) return;
    var wrapped = function (view, data, skipPush) {
      if (reducedMotion || !document.startViewTransition) {
        return orig(view, data, skipPush);
      }
      document.startViewTransition(function () {
        orig(view, data, skipPush);
      });
    };
    wrapped.__pvt = true;
    window.navigate = wrapped;
  }
  setTimeout(wrapNavigate, 600);

  // ---- Staggered entrance + glow tagging on each render ----
  var GLOW_SELECTOR = [
    '.feature-card', '.peptide-card', '.tool-card', '.protocol-card',
    '.research-card', '.rs-related-card', '.stat-card', '.ix-card',
  ].join(',');

  function decorate(root) {
    if (!root) return;
    // Stagger direct children of the rendered view
    var view = root.firstElementChild;
    if (view && !reducedMotion) {
      var kids = view.children;
      var n = Math.min(kids.length, 14);
      for (var i = 0; i < n; i++) {
        kids[i].style.setProperty('--stagger', String(i));
        kids[i].classList.add('p-enter');
      }
    }
    var cards = root.querySelectorAll(GLOW_SELECTOR);
    for (var j = 0; j < cards.length; j++) cards[j].classList.add('p-glow');
    countUpStats(root);
  }

  var contentArea = document.getElementById('contentArea');
  if (contentArea) {
    new MutationObserver(function () { decorate(contentArea); })
      .observe(contentArea, { childList: true });
    decorate(contentArea);
  }

  // ---- Pointer-tracked glow (rAF-throttled, event delegation) ----
  var glowTarget = null, glowX = 0, glowY = 0, glowQueued = false;
  document.addEventListener('pointermove', function (e) {
    var t = e.target && e.target.closest ? e.target.closest('.p-glow') : null;
    if (!t) return;
    glowTarget = t; glowX = e.clientX; glowY = e.clientY;
    if (glowQueued) return;
    glowQueued = true;
    requestAnimationFrame(function () {
      glowQueued = false;
      if (!glowTarget) return;
      var r = glowTarget.getBoundingClientRect();
      glowTarget.style.setProperty('--mx', (glowX - r.left) + 'px');
      glowTarget.style.setProperty('--my', (glowY - r.top) + 'px');
    });
  }, { passive: true });

  // ---- Stat count-up ----
  function countUpStats(root) {
    if (reducedMotion) return;
    var nodes = root.querySelectorAll('.ph-stat-n');
    nodes.forEach(function (el) {
      if (el.__counted) return;
      var raw = el.textContent.trim();
      var m = raw.match(/^(\d+)$/);
      if (!m) return;
      el.__counted = true;
      var target = parseInt(m[1], 10);
      if (!target || target > 9999) return;
      var t0 = performance.now(), dur = 800;
      (function tick(now) {
        var p = Math.min((now - t0) / dur, 1);
        var eased = 1 - Math.pow(1 - p, 3);
        el.textContent = String(Math.round(target * eased));
        if (p < 1) requestAnimationFrame(tick);
        else el.textContent = raw;
      })(t0);
    });
  }

  // ---- ⌘K command palette ----
  var VIEWS = [
    { label: 'Home', view: 'home', icon: 'fa-house', group: 'Navigate' },
    { label: 'Knowledge base', view: 'knowledge', icon: 'fa-book-open', group: 'Navigate' },
    { label: 'Compare', view: 'compare', icon: 'fa-code-compare', group: 'Navigate' },
    { label: 'Interactions', view: 'interactions', icon: 'fa-shield-halved', group: 'Navigate' },
    { label: 'Calculator', view: 'calculator', icon: 'fa-calculator', group: 'Navigate' },
    { label: 'Stack builder', view: 'builder', icon: 'fa-layer-group', group: 'Navigate' },
    { label: 'Protocols', view: 'protocols', icon: 'fa-clipboard-list', group: 'Navigate' },
    { label: 'Latest research', view: 'research', icon: 'fa-newspaper', group: 'Navigate' },
  ];

  var cmdkOpen = false, cmdkSel = 0, cmdkResults = [];
  var backdrop, panel, input, list;

  function buildCmdk() {
    backdrop = document.createElement('div');
    backdrop.className = 'p-cmdk-backdrop';
    backdrop.addEventListener('click', closeCmdk);

    panel = document.createElement('div');
    panel.className = 'p-cmdk';
    panel.innerHTML =
      '<div class="p-cmdk-input-row">' +
        '<i class="fas fa-search"></i>' +
        '<input class="p-cmdk-input" placeholder="Search pages and compounds…" />' +
        '<span class="p-cmdk-esc">ESC</span>' +
      '</div>' +
      '<div class="p-cmdk-list"></div>';

    document.body.appendChild(backdrop);
    document.body.appendChild(panel);
    input = panel.querySelector('.p-cmdk-input');
    list = panel.querySelector('.p-cmdk-list');

    input.addEventListener('input', function () { renderCmdk(input.value); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); moveSel(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); moveSel(-1); }
      else if (e.key === 'Enter') { e.preventDefault(); execSel(); }
    });
  }

  function compoundResults(q) {
    var peps = window.peptides || [];
    if (!peps.length) return [];
    var out = [];
    for (var i = 0; i < peps.length && out.length < 8; i++) {
      var p = peps[i];
      var name = (p.name || '').toLowerCase();
      if (!q || name.indexOf(q) !== -1) {
        out.push({
          label: p.name,
          icon: 'fa-dna',
          group: 'Compounds',
          meta: p.category || '',
          run: (function (id) {
            return function () { window.navigate && window.navigate('peptide-detail', { id: id }); };
          })(p.id || p.slug),
        });
      }
    }
    return out;
  }

  function renderCmdk(query) {
    var q = (query || '').trim().toLowerCase();
    var views = VIEWS.filter(function (v) {
      return !q || v.label.toLowerCase().indexOf(q) !== -1;
    }).map(function (v) {
      return {
        label: v.label, icon: v.icon, group: v.group, meta: '',
        run: function () { window.navigate && window.navigate(v.view); },
      };
    });
    cmdkResults = views.concat(compoundResults(q));
    cmdkSel = 0;

    if (!cmdkResults.length) {
      list.innerHTML = '<div class="p-cmdk-empty">No results for “' + escapeHtml(query) + '”</div>';
      return;
    }

    var html = '', lastGroup = null;
    cmdkResults.forEach(function (r, i) {
      if (r.group !== lastGroup) {
        html += '<div class="p-cmdk-group">' + r.group + '</div>';
        lastGroup = r.group;
      }
      html += '<button class="p-cmdk-item' + (i === cmdkSel ? ' sel' : '') + '" data-i="' + i + '">' +
        '<i class="fas ' + r.icon + '"></i><span>' + escapeHtml(r.label) + '</span>' +
        (r.meta ? '<span class="p-cmdk-meta">' + escapeHtml(r.meta) + '</span>' : '') +
        '</button>';
    });
    list.innerHTML = html;
    list.querySelectorAll('.p-cmdk-item').forEach(function (el) {
      el.addEventListener('click', function () {
        cmdkSel = parseInt(el.getAttribute('data-i'), 10);
        execSel();
      });
      el.addEventListener('pointerenter', function () {
        setSel(parseInt(el.getAttribute('data-i'), 10));
      });
    });
  }

  function setSel(i) {
    cmdkSel = i;
    list.querySelectorAll('.p-cmdk-item').forEach(function (el, j) {
      el.classList.toggle('sel', j === cmdkSel);
    });
  }

  function moveSel(d) {
    if (!cmdkResults.length) return;
    setSel((cmdkSel + d + cmdkResults.length) % cmdkResults.length);
    var el = list.querySelector('.p-cmdk-item.sel');
    if (el) el.scrollIntoView({ block: 'nearest' });
  }

  function execSel() {
    var r = cmdkResults[cmdkSel];
    if (!r) return;
    closeCmdk();
    r.run();
  }

  function openCmdk() {
    if (!panel) buildCmdk();
    cmdkOpen = true;
    backdrop.classList.add('open');
    panel.classList.add('open');
    input.value = '';
    renderCmdk('');
    setTimeout(function () { input.focus(); }, 30);
  }

  function closeCmdk() {
    if (!panel) return;
    cmdkOpen = false;
    backdrop.classList.remove('open');
    panel.classList.remove('open');
    input.blur();
  }

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      cmdkOpen ? closeCmdk() : openCmdk();
    } else if (e.key === 'Escape' && cmdkOpen) {
      closeCmdk();
    }
  });

  // Sidebar footer hint
  setTimeout(function () {
    var footer = document.querySelector('.rs-sidebar-footer');
    if (footer && !footer.querySelector('.p-kbd') && navigator.maxTouchPoints === 0) {
      var hint = document.createElement('div');
      hint.style.cssText = 'margin-top:10px;display:flex;align-items:center;gap:7px;font-size:11px;color:var(--p-text-faint,#6F6F6F)';
      var isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      hint.innerHTML = '<span class="p-kbd">' + (isMac ? '⌘' : 'Ctrl') + ' K</span> Quick search';
      footer.appendChild(hint);
    }
  }, 700);
})();
