// Bridge JS - connects new redesign shell navigation with original app.js
// Includes dark/light theme toggle support
(function() {
  'use strict';

  const NAV_GROUPS = [
    { title: 'Overview', items: [
      { view: 'home', icon: 'fa-house', label: 'Home' },
    ]},
    { title: 'Library', items: [
      { view: 'knowledge', icon: 'fa-book-open', label: 'Knowledge base' },
      { view: 'protocols', icon: 'fa-clipboard-list', label: 'Protocols' },
      { view: 'compare', icon: 'fa-code-compare', label: 'Compare' },
      { view: 'interactions', icon: 'fa-shield-halved', label: 'Interactions' },
      { view: 'research', icon: 'fa-newspaper', label: 'Research' },
      { view: 'videos', icon: 'fa-youtube', iconPrefix: 'fab', label: 'Videos' },
      { view: 'favorites', icon: 'fa-heart', label: 'Favorites' },
    ]},
    { title: 'Tools', items: [
      { view: 'calculator', icon: 'fa-calculator', label: 'Calculator' },
      { view: 'builder', icon: 'fa-layer-group', label: 'Stack builder' },
    ]},
    { title: 'Community', items: [
      { view: 'community', icon: 'fa-comments', label: 'Forum' },
      { view: 'review', icon: 'fa-people-group', label: 'Review & vote' },
    ]},
  ];

  const MOBILE_NAV = [
    { view: 'home', icon: 'fa-comments', label: 'Forum' },
    { view: 'knowledge', icon: 'fa-book-medical', label: 'Library' },
    { view: '_ai', icon: 'fa-robot', label: 'AI' },
    { view: 'videos', icon: 'fa-youtube', iconPrefix: 'fab', label: 'Videos' },
    { view: '_tools', icon: 'fa-ellipsis', label: 'More' },
  ];

  const SHEET_TOOLS = [
    { icon: 'fa-book-open', label: 'Library', desc: 'All compound profiles', view: 'knowledge' },
    { icon: 'fa-calculator', label: 'Calculator', desc: 'Reconstitution & dosing math', view: 'calculator' },
    { icon: 'fa-clipboard-list', label: 'Protocols', desc: 'Dosing protocols & guides', view: 'protocols' },
    { icon: 'fa-layer-group', label: 'Stack builder', desc: 'Combine compounds safely', view: 'builder' },
    { icon: 'fa-code-compare', label: 'Compare', desc: 'Side-by-side analysis', view: 'compare' },
    { icon: 'fa-shield-halved', label: 'Interactions', desc: 'Safety across your protocol', view: 'interactions' },
    { icon: 'fa-newspaper', label: 'Research', desc: 'Latest peer-reviewed papers', view: 'research' },
    { icon: 'fa-youtube', iconPrefix: 'fab', label: 'Videos', desc: 'Educational video library', view: 'videos' },
    { icon: 'fa-heart', label: 'Favorites', desc: 'Your saved compounds', view: 'favorites' },
    { icon: 'fa-people-group', label: 'Review & vote', desc: 'Help grow the knowledge base', view: 'review' },
    { icon: 'fa-globe', label: 'Language', desc: 'Translate the site', action: 'language' },
  ];

  let _sheetOpen = false;

  // ---- Theme Management ----
  function getTheme() {
    return localStorage.getItem('rs-theme') || 'light';
  }

  function setTheme(theme) {
    localStorage.setItem('rs-theme', theme);
    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
      document.body.classList.remove('dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
      document.body.classList.add('dark');
    }
    const icon = document.getElementById('rsThemeIcon');
    const label = document.getElementById('rsThemeLabel');
    if (icon) icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    if (label) label.textContent = theme === 'dark' ? 'Light mode' : 'Dark mode';
    renderSidebar();
  }

  window.toggleTheme = function() {
    const current = getTheme();
    setTheme(current === 'dark' ? 'light' : 'dark');
  };

  // Apply theme on load
  (function initTheme() {
    const saved = getTheme();
    if (saved === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
      document.body.classList.remove('dark');
    } else {
      document.body.classList.add('dark');
    }
    setTimeout(function() {
      const icon = document.getElementById('rsThemeIcon');
      const label = document.getElementById('rsThemeLabel');
      if (icon) icon.className = saved === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
      if (label) label.textContent = saved === 'dark' ? 'Light mode' : 'Dark mode';
    }, 0);
  })();

  function getActiveView() {
    return typeof currentView !== 'undefined' ? currentView : 'home';
  }

  function isActive(view) {
    const cv = getActiveView();
    if (view === 'knowledge') return cv === 'knowledge' || cv === 'peptide-detail';
    if (view === 'protocols') return cv === 'protocols' || cv === 'protocol-detail';
    return cv === view;
  }

  const VIEW_PATHS = {
    'home': '/', 'knowledge': '/knowledge', // forum is the homepage; KB has its own page
    'protocols': '/protocols', 'compare': '/compare', 'interactions': '/interactions',
    'research': '/research', 'videos': '/videos',
    'calculator': '/calculator', 'builder': '/builder',
    'favorites': '/favorites',
    'review': '/review', 'community': '/'
  };

  function renderSidebar() {
    const nav = document.getElementById('rsSidebarNav');
    if (!nav) return;

    nav.innerHTML = NAV_GROUPS.map(g => `
      <div class="rs-nav-group">
        <div class="rs-nav-group-title">${g.title}</div>
        ${g.items.map(it => `
          <a href="${VIEW_PATHS[it.view] || '/'}" class="rs-nav-btn${isActive(it.view) ? ' active' : ''}">
            <i class="${it.iconPrefix || 'fas'} ${it.icon}"></i><span>${it.label}</span>
          </a>
        `).join('')}
      </div>
    `).join('')
    + `<div class="rs-nav-group">
        <div class="rs-nav-group-title">Account</div>
        <button type="button" class="rs-theme-toggle" onclick="toggleTheme()" title="Toggle light / dark theme">
          <i id="rsThemeIcon" class="fas ${getTheme() === 'dark' ? 'fa-sun' : 'fa-moon'}"></i><span id="rsThemeLabel">${getTheme() === 'dark' ? 'Light mode' : 'Dark mode'}</span>
        </button>
        <button type="button" id="accountBtn" class="rs-account-cta" onclick="(window.openAuthModal||function(){})('login')">
          <i class="fas fa-right-to-bracket"></i><span class="nav-label">Sign in</span><span class="nav-tooltip" style="display:none">Sign in</span>
        </button>
        <button type="button" id="accountCreateBtn" class="rs-account-create" onclick="(window.openAuthModal||function(){})('register')">Create a free account</button>
      </div>`;
    // Reflect current auth state (avatar / Account label) on the freshly-rendered button.
    if (typeof window.updateAuthUI === 'function') { try { window.updateAuthUI(); } catch (e) {} }
  }

  function renderMobileNav() {
    const nav = document.getElementById('rsBottomNav');
    if (!nav) return;
    const cv = getActiveView();
    const toolViews = ['builder', 'compare', 'interactions'];
    nav.innerHTML = '<div class="rs-bottom-nav-inner">'
      + '<span class="rs-nav-pill" id="rsNavPill" aria-hidden="true"></span>'
      + MOBILE_NAV.map(it => {
      let active;
      if (it.view === '_tools') {
        active = toolViews.includes(cv) || _sheetOpen;
      } else if (it.view === '_ai') {
        active = false;
      } else {
        active = isActive(it.view);
      }
      const prefix = it.iconPrefix || 'fas';
      if (it.view === '_tools') {
        return `<button class="rs-bottom-nav-btn${active ? ' active' : ''}" onclick="toggleMobileSheet()"><i class="${prefix} ${it.icon}"></i><span>${it.label}</span></button>`;
      }
      if (it.view === '_ai') {
        return `<button class="rs-bottom-nav-btn" onclick="(window.openMobileChat||function(){})()"><i class="${prefix} ${it.icon}"></i><span>${it.label}</span></button>`;
      }
      return `<a href="${VIEW_PATHS[it.view] || '/'}" class="rs-bottom-nav-btn${active ? ' active' : ''}"><i class="${prefix} ${it.icon}"></i><span>${it.label}</span></a>`;
    }).join('') + '</div>';
    positionNavPill();
  }

  // Slide the active-tab highlight pill under the active button.
  function positionNavPill() {
    const nav = document.getElementById('rsBottomNav');
    if (!nav) return;
    const pill = nav.querySelector('#rsNavPill');
    const active = nav.querySelector('.rs-bottom-nav-btn.active');
    if (!pill) return;
    if (!active) { pill.style.opacity = '0'; return; }
    const inner = nav.querySelector('.rs-bottom-nav-inner');
    const ir = inner.getBoundingClientRect();
    const ar = active.getBoundingClientRect();
    pill.style.opacity = '1';
    pill.style.width = ar.width + 'px';
    pill.style.height = ar.height + 'px';
    pill.style.transform = 'translateX(' + (ar.left - ir.left) + 'px)';
  }
  window.addEventListener('resize', positionNavPill);

  function renderSheetItems() {
    const container = document.getElementById('rsSheetItems');
    if (!container) return;
    container.innerHTML = SHEET_TOOLS.map(st => {
      if (st.action === 'language') {
        return `
      <button type="button" class="rs-sheet-item" style="text-decoration:none;color:inherit;border:none;background:none;width:100%;text-align:left;cursor:pointer" onclick="closeMobileSheet();(window.openLanguagePicker||function(){})()">
        <div class="rs-sheet-item-icon" style="background:var(--rs-surface-raised);color:var(--rs-text)"><i class="${st.iconPrefix || 'fas'} ${st.icon}"></i></div>
        <div style="display:flex;flex-direction:column;gap:2px;flex:1">
          <span class="rs-sheet-item-label">${st.label}</span>
          <span class="rs-sheet-item-desc">${st.desc}</span>
        </div>
        <i class="fas fa-chevron-right" style="font-size:11px;color:var(--rs-text-dim)"></i>
      </button>`;
      }
      return `
      <a href="${VIEW_PATHS[st.view] || '/'}" class="rs-sheet-item" style="text-decoration:none;color:inherit">
        <div class="rs-sheet-item-icon" style="background:var(--rs-surface-raised);color:var(--rs-text)"><i class="${st.iconPrefix || 'fas'} ${st.icon}"></i></div>
        <div style="display:flex;flex-direction:column;gap:2px;flex:1">
          <span class="rs-sheet-item-label">${st.label}</span>
          <span class="rs-sheet-item-desc">${st.desc}</span>
        </div>
        <i class="fas fa-chevron-right" style="font-size:11px;color:var(--rs-text-dim)"></i>
      </a>`;
    }).join('');
  }

  window.toggleMobileSheet = function() {
    _sheetOpen = !_sheetOpen;
    updateSheetState();
    renderMobileNav();
  };

  window.closeMobileSheet = function() {
    _sheetOpen = false;
    updateSheetState();
    renderMobileNav();
  };

  function updateSheetState() {
    const sheet = document.getElementById('rsToolsSheet');
    const backdrop = document.getElementById('rsSheetBackdrop');
    if (_sheetOpen) {
      sheet && sheet.classList.add('open');
      backdrop && backdrop.classList.add('open');
    } else {
      sheet && sheet.classList.remove('open');
      backdrop && backdrop.classList.remove('open');
    }
  }

  function updateBridgeNav() {
    renderSidebar();
    renderMobileNav();
  }

  // Hook into the original navigate function to update our nav
  const _origNavigate = window.navigate;
  if (_origNavigate) {
    window.navigate = function(view, data, skipPush) {
      _sheetOpen = false;
      updateSheetState();
      _origNavigate(view, data, skipPush);
      updateBridgeNav();
    };
  }

  // Also patch via MutationObserver on contentArea as fallback
  const observer = new MutationObserver(function() {
    updateBridgeNav();
  });
  const contentArea = document.getElementById('contentArea');
  if (contentArea) {
    observer.observe(contentArea, { childList: true });
  }

  // Init
  renderSidebar();
  renderMobileNav();
  renderSheetItems();

  // Re-render after a tick (once app.js has initialized)
  setTimeout(updateBridgeNav, 100);
  setTimeout(updateBridgeNav, 500);
  // Re-position the pill once fonts/icons have settled (widths can shift).
  setTimeout(positionNavPill, 1200);
  window.addEventListener('load', positionNavPill);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(positionNavPill);
})();
