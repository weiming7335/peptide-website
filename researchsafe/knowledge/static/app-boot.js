// ============================================================
// PeptideSafe - Million-Dollar Premium Frontend v3
// ============================================================

let peptides = [];
let protocols = [];
let categories = [];
let currentView = 'home';
let particleSystem = null;
let currentUser = null; // { id, email, name, avatar_url, provider } or null
window.currentUser = null; // expose globally for admin.js

// ============================================================
// PARTNER REF TRACKING

function createRipple(e, element) {
  const rect = element.getBoundingClientRect();
  const x = e.clientX - rect.left, y = e.clientY - rect.top;
  const size = Math.max(rect.width, rect.height);
  const ripple = document.createElement('div');
  ripple.className = 'ripple-effect';
  ripple.style.cssText = `width:${size}px;height:${size}px;left:${x-size/2}px;top:${y-size/2}px;`;
  element.appendChild(ripple);
  setTimeout(() => ripple.remove(), 700);
}

// ============================================================
// VIEW TRANSITION ENGINE
// ============================================================
function transitionView(area, renderFn) {
  const current = area.firstElementChild;
  if (current) {
    current.classList.add('view-exit');
    setTimeout(() => {
      renderFn();
      if (area.firstElementChild) {
        area.firstElementChild.classList.add('view-enter');
        setTimeout(() => {
          if (area.firstElementChild) area.firstElementChild.classList.remove('view-enter');
        }, 600);
      }
    }, 180);
  } else {
    renderFn();
    if (area.firstElementChild) {
      area.firstElementChild.classList.add('view-enter');
      setTimeout(() => {
        if (area.firstElementChild) area.firstElementChild.classList.remove('view-enter');
      }, 600);
    }
  }
}

// ============================================================
// SIDEBAR EXPAND / COLLAPSE
// ============================================================
function toggleSidebar() {
  // Sidebar expand/collapse disabled - using sub-panel navigation now
}

function restoreSidebarState() {
  // Clear any legacy expanded state from localStorage
  localStorage.removeItem('peptideai_sidebar_expanded');
  const sidebar = document.querySelector('.sidebar');
  if (sidebar) sidebar.classList.remove('expanded');
}

// ============================================================
// INIT

const viewToPath = {
  'home': '/', // the forum feed is the homepage
  'forum-post': '/forum/', // + id
  'knowledge': '/knowledge', // knowledge base has its own page now

  'calculator': '/calculator',
  'compare': '/compare',
  'protocols': '/protocols',
  'protocol-detail': '/protocols/', // + id
  'research': '/research',
  'videos': '/videos',
  'favorites': '/favorites',
  'builder': '/builder',
  'peptide-detail': '/peptides/', // + id
  'interactions': '/interactions',
  'community': '/community',
  'disclaimer': '/disclaimer',
  'account': '/account',
  'privacy': '/privacy',
  'terms': '/terms',
  'admin': '/admin',
  'partner-apply': '/partner',
  'review': '/review'
};

// Reverse: path to view + data
function pathToView(path) {
  if (path === '/' || path === '') return { view: 'home', data: null };
  // /forum/123 → forum post detail (community forum permalink)
  const forumMatch = path.match(/^\/forum\/(\d+)/);
  if (forumMatch) return { view: 'forum-post', data: forumMatch[1] };
  // /community/healing-recovery → forum filtered to that community hub
  const hubMatch = path.match(/^\/community\/([a-z0-9-]+)$/);
  if (hubMatch) return { view: 'community', data: hubMatch[1] };
  // /u/username → public profile
  const userMatch = path.match(/^\/u\/([A-Za-z0-9_-]{3,20})$/);
  if (userMatch) return { view: 'profile', data: userMatch[1] };
  // /peptides/bpc-157
  const pepMatch = path.match(/^\/peptides\/(.+)$/);
  if (pepMatch) return { view: 'peptide-detail', data: pepMatch[1] };
  // /protocols/healing-recovery
  const protoMatch = path.match(/^\/protocols\/(.+)$/);
  if (protoMatch) return { view: 'protocol-detail', data: protoMatch[1] };
  // /categories/healing → knowledge with category filter
  const catMatch = path.match(/^\/categories\/(.+)$/);
  if (catMatch) return { view: 'knowledge', data: catMatch[1] };
  // /compare/bpc-157-vs-tb-500 → compare tool preloaded with both compounds
  const cmpMatch = path.match(/^\/compare\/(.+)-vs-(.+)$/);
  if (cmpMatch) return { view: 'compare', data: { a: cmpMatch[1], b: cmpMatch[2] } };
  // /partner
  if (path === '/partner') return { view: 'partner-apply', data: null };
  // Static paths
  for (const [v, p] of Object.entries(viewToPath)) {
    if (p === path) return { view: v, data: null };
  }
  return { view: 'home', data: null };
}

function updatePageTitle(view, data) {
  const titles = {
    'home': 'ResearchSafe Community - Peptide & Longevity Forum',
    'knowledge': 'Peptide Knowledge Base | ResearchSafe',
    'calculator': 'Reconstitution & Dosage Calculator | PeptideSafe',
    'compare': 'Peptide Comparison Tool | PeptideSafe',
    'protocols': 'Peptide Protocols & Dosing Guides | PeptideSafe',
    'research': 'Peptide Research & Studies | PeptideSafe',
    'videos': 'Peptide Education Videos | PeptideSafe',
    'favorites': 'My Favorites | PeptideSafe',
    'builder': 'Peptide Stack Builder | PeptideSafe',
    'interactions': 'Interaction Checker | PeptideSafe',
    'dashboard': 'Dashboard | PeptideSafe',
    'community': 'Community Forum | PeptideSafe',
    'profile': (data ? 'u/' + data + ' | ' : '') + 'ResearchSafe Community',
    'disclaimer': 'Disclaimer | PeptideSafe',
    'privacy': 'Privacy Policy | PeptideSafe',
    'terms': 'Terms of Service | PeptideSafe',
    'admin': 'Admin Dashboard | PeptideSafe',
    'partner-apply': 'Become a Partner | PeptideSafe',
    'review': 'Community Review | PeptideSafe',
    'inventory': 'Peptide Inventory | PeptideSafe'
  };
  if (view === 'peptide-detail' && data) {
    const p = peptides.find(pep => pep.id === data);
    document.title = p ? `${p.name} - ${p.fullName} | PeptideSafe` : 'PeptideSafe';
  } else if (view === 'protocol-detail' && data) {
    document.title = `Protocol: ${data} | PeptideSafe`;
  } else {
    document.title = titles[view] || 'PeptideSafe | Intelligent Peptide Research Assistant';
  }
}

function esc(s) {
  const d = document.createElement('div'); d.textContent = s; return d.innerHTML;
}

function toggleDark() {
  document.body.classList.toggle('dark');
  const icon = document.getElementById('themeIcon');
  if (icon) icon.className = document.body.classList.contains('dark') ? 'fas fa-sun' : 'fas fa-moon';
}

// Navigate with lazy-load: if view renderer not available, load app-views.js first
var _viewsLoaded = false;
var _viewsLoading = false;
var _pendingView = null;

function _ensureViews(cb) {
  if (_viewsLoaded) { cb(); return; }
  if (_viewsLoading) { _pendingView = cb; return; }
  _viewsLoading = true;
  var s = document.createElement('script');
  s.src = '/static/app-views.js?v=' + (window.__ASSET_V__ || '3');
  s.onload = function() { _viewsLoaded = true; if (cb) cb(); if (_pendingView) { _pendingView(); _pendingView = null; } };
  s.onerror = s.onload;
  document.body.appendChild(s);
}

// Auth entry-point bootstrap. The real openAuthModal lives in app-views.js,
// which lazy-loads on first navigation. But the Sign in / Create account
// buttons in the SSR shell can be clicked before that script loads, so we
// install a stub that loads app-views.js first, then opens the modal. When
// app-views.js loads, its `function openAuthModal` declaration overwrites
// this stub on window, so the retry below calls the real implementation.
var _authStub = function(mode, context) {
  _ensureViews(function() {
    if (typeof window.openAuthModal === 'function' && window.openAuthModal !== _authStub) {
      try { window.openAuthModal(mode, context); } catch (e) {}
    }
  });
};
if (typeof window.openAuthModal !== 'function') {
  window.openAuthModal = _authStub;
}

// Forum bundle loader (renders the homepage feed + /forum/:id detail).
var _forumLoaded = false;
var _forumLoading = false;
var _forumQueue = [];
function _ensureForum(cb) {
  if (_forumLoaded || typeof window._forumRender === 'function') { _forumLoaded = true; cb(); return; }
  _forumQueue.push(cb);
  if (_forumLoading) return;
  _forumLoading = true;
  var s = document.createElement('script');
  s.src = '/static/forum.js?v=' + (window.__ASSET_V__ || '3');
  s.onload = function () {
    _forumLoaded = true;
    var q = _forumQueue; _forumQueue = [];
    q.forEach(function (fn) { try { fn(); } catch (e) {} });
  };
  s.onerror = s.onload;
  document.body.appendChild(s);
}

function navigate(view, data, skipPush) {
  // The forum IS the homepage now. 'home' renders the community feed at '/';
  // the knowledge base lives at its own '/knowledge' route.
  currentView = view;
  if (typeof closeMobileSheet === 'function') closeMobileSheet();
  var seoEl = document.getElementById('seoContent');
  if (seoEl) seoEl.style.display = 'none';

  document.querySelectorAll('.nav-btn[data-view]').forEach(function(b){b.classList.toggle('active', b.dataset.view === view)});
  document.querySelectorAll('.mobile-nav-btn[data-view]').forEach(function(b){b.classList.toggle('active', b.dataset.view === view)});

  if (!skipPush) {
    var newPath = viewToPath[view] || '/';
    if ((view === 'peptide-detail' || view === 'protocol-detail' || view === 'forum-post') && data) {
      newPath = viewToPath[view] + data;
    }
    if (view === 'community') { newPath = data ? '/community/' + data : '/community'; }
    if (view === 'profile') { newPath = '/u/' + data; }
    if (view === 'compare' && data && data.a && data.b) {
      newPath = '/compare/' + data.a + '-vs-' + data.b;
    }
    if (window.location.pathname !== newPath) {
      window.history.pushState({ view: view, data: data }, '', newPath);
    }
  }

  // Stash a preloaded comparison so renderCompare can auto-run it on a deep link.
  if (view === 'compare' && data && data.a && data.b) {
    window.__comparePreload = { a: data.a, b: data.b };
  }

  updatePageTitle(view, data);

  var area = document.getElementById('contentArea');
  if (view === 'home' || view === 'community' || view === 'forum-post' || view === 'profile') {
    // The forum is the homepage: 'home' renders the community feed at the root.
    _ensureForum(function () {
      transitionView(area, function () {
        if (typeof window._forumRender === 'function') {
          window._forumRender(view === 'home' ? 'community' : view, view === 'home' ? null : data, area);
        } else {
          renderHome(area); // fallback if forum.js failed to load
        }
      });
    });
  } else {
    _ensureViews(function() {
      transitionView(area, function() {
        if (typeof window._renderView === 'function') {
          window._renderView(view, data, area);
        } else {
          area.innerHTML = '<div class="rs-loading"><div class="rs-loading-spinner"></div><span>Loading...</span></div>';
        }
      });
    });
  }
}

window.addEventListener('popstate', function(e) {
  if (e.state && e.state.view) {
    navigate(e.state.view, e.state.data, true);
  } else {
    var parsed = pathToView(window.location.pathname);
    navigate(parsed.view, parsed.data, true);
  }
});

(function initRouter() {
  var ssrView = window.__SSR_VIEW__;
  var ssrData = window.__SSR_DATA__;
  if (ssrView) {
    window.history.replaceState({ view: ssrView, data: ssrData || null }, '', window.location.pathname);
  }
})();
function renderHome(el) {
  const pepCount = peptides.length || 12;

  // ---- Category segments for "Library by category" bar ----
  const catPalette = ['#16B886','#4F6BFF','#8B5CF6','#F59E0B','#EC4899','#06B6D4','#EF4444','#10B981'];
  const catCounts = {};
  peptides.forEach(p => { const c = p.category || 'Other'; catCounts[c] = (catCounts[c] || 0) + 1; });
  const catEntries = Object.keys(catCounts).map((name, i) => ({
    name, count: catCounts[name],
    color: (peptides.find(p => p.category === name) || {}).categoryColor || catPalette[i % catPalette.length]
  })).sort((a, b) => b.count - a.count);
  const catTotal = peptides.length || 1;
  const catBar = catEntries.map(s => `<div style="width:${Math.max(4, (s.count / catTotal) * 100)}%;background:${s.color};border-radius:5px"></div>`).join('');
  // Legend entries deep-link into the knowledge base category pages.
  const catLegend = catEntries.slice(0, 8).map(s => {
    const catObj = (categories || []).find(c => c.name === s.name);
    const inner = `<span class="rs-cat-dot" style="background:${s.color}"></span>${s.name} <span class="rs-cat-count">· ${s.count}</span>`;
    return catObj
      ? `<a class="rs-cat-legend-item" href="/categories/${catObj.id}" style="text-decoration:none;color:inherit;cursor:pointer">${inner}</a>`
      : `<div class="rs-cat-legend-item">${inner}</div>`;
  }).join('');

  // ---- Evidence pill meta (matches Claude design exactly) ----
  function evMeta(ev) {
    const v = String(ev || 'Research');
    if (/fda/i.test(v)) return { bg: '#E3F4EC', color: '#0E7C5A', label: v };
    if (/clinical/i.test(v)) return { bg: '#E6F2FB', color: '#1F73B8', label: v };
    return { bg: '#F0EBFB', color: '#7C5CD4', label: v };
  }

  // ---- Featured compound cards (design layout) ----
  const featured = peptides.slice(0, 6).map(p => {
    const ev = evMeta(p.evidence || p.status);
    return `
      <button class="rs-home-compound" onclick="openPeptideDetail('${p.id}')">
        <div class="rs-hc-top">
          <span class="rs-hc-cat-dot" style="background:${p.categoryColor || '#16B886'}"></span>
          <span class="rs-hc-cat">${p.category || 'Compound'}</span>
          <span class="rs-hc-ev" style="background:${ev.bg};color:${ev.color}">${ev.label}</span>
        </div>
        <div class="rs-hc-names">
          <div class="rs-hc-name">${p.name}</div>
          <div class="rs-hc-full">${p.fullName || p.name}</div>
        </div>
        <div class="rs-hc-desc">${p.description || ''}</div>
        <div class="rs-hc-meta">
          ${p.halfLife ? `<span><i class="fas fa-clock"></i>${p.halfLife}</span>` : ''}
          ${p.route ? `<span><i class="fas fa-syringe"></i>${p.route}</span>` : ''}
        </div>
      </button>`;
  }).join('');

  el.innerHTML = `
    <div class="home-view">

      <!-- ===== Design hero ===== -->
      <section class="rs-hero">
        <span class="rs-hero-orb rs-hero-orb-1"></span>
        <span class="rs-hero-orb rs-hero-orb-2"></span>
        <div class="rs-hero-inner">
          <div class="rs-hero-eyebrow"><i class="fas fa-shield-halved"></i> Research-grade intelligence</div>
          <h1 class="rs-hero-title">Compound research,<br><span class="rs-hero-shine">finally organized.</span></h1>
          <p class="rs-hero-sub">Clear, structured profiles for peptides, hormones, and longevity compounds. Dosing math, interaction safety, and protocol tracking, all in one calm place.</p>
          <button class="rs-hero-search" onclick="navigate('knowledge')">
            <i class="fas fa-magnifying-glass rs-hero-search-icon"></i>
            <span>Search ${pepCount} compounds, mechanisms, goals…</span>
            <i class="fas fa-arrow-right rs-hero-search-arrow"></i>
          </button>
        </div>
      </section>

      <!-- ===== Library by category + Today's protocol ===== -->
      <div class="rs-home-tworow">
        <div class="rs-cat-card">
          <div class="rs-cat-head"><i class="fas fa-layer-group" style="color:#8B5CF6"></i> Library by category</div>
          <div class="rs-cat-bar">${catBar}</div>
          <div class="rs-cat-legend">${catLegend}</div>
        </div>
        <button class="rs-protocol-tile" onclick="navigate('tracker')">
          <div class="rs-protocol-top">
            <div class="rs-protocol-icon"><i class="fas fa-calendar-check"></i></div>
            <div class="rs-protocol-labels">
              <div class="rs-protocol-title">Today's protocol</div>
              <div class="rs-protocol-sub" id="rsTodayDoses">Track your daily doses</div>
            </div>
            <i class="fas fa-arrow-right rs-protocol-arrow"></i>
          </div>
          <div class="rs-protocol-bar"><div class="rs-protocol-fill" id="rsTodayFill" style="width:0%"></div></div>
        </button>
      </div>

      <!-- ===== Community discussions teaser (filled async) ===== -->
      <div id="homeForumTeaser"></div>

      <!-- ===== Compound library (featured) ===== -->
      <div class="rs-home-library">
        <div class="rs-home-library-head">
          <h2>Compound library</h2>
          <button onclick="navigate('knowledge')">View all <i class="fas fa-arrow-right"></i></button>
        </div>
        <div class="rs-home-compound-grid">${featured}</div>
      </div>

      <div class="feature-grid">
        <div class="feature-card ripple-container" onclick="navigate('knowledge')">
          <span class="fc-arrow"><i class="fas fa-arrow-right"></i></span>
          <div class="fc-icon" style="background:linear-gradient(135deg,#eff6ff,#dbeafe);color:#3b82f6"><i class="fas fa-book-open"></i></div>
          <div class="fc-label">Knowledge Base</div>
          <div class="fc-desc">Browse ${pepCount} detailed peptide profiles with mechanisms & dosing</div>
        </div>
        <div class="feature-card ripple-container" onclick="navigate('calculator')">
          <span class="fc-arrow"><i class="fas fa-arrow-right"></i></span>
          <div class="fc-icon" style="background:linear-gradient(135deg,#faf5ff,#ede9fe);color:#8b5cf6"><i class="fas fa-calculator"></i></div>
          <div class="fc-label">Calculator</div>
          <div class="fc-desc">Precise reconstitution math. Concentrations, volumes & units</div>
        </div>
        <div class="feature-card ripple-container" onclick="navigate('compare')">
          <span class="fc-arrow"><i class="fas fa-arrow-right"></i></span>
          <div class="fc-icon" style="background:linear-gradient(135deg,#fff7ed,#ffedd5);color:#f97316"><i class="fas fa-code-compare"></i></div>
          <div class="fc-label">Compare</div>
          <div class="fc-desc">Side-by-side 3D analysis of any two compounds</div>
        </div>
        <div class="feature-card ripple-container" onclick="navigate('protocols')">
          <span class="fc-arrow"><i class="fas fa-arrow-right"></i></span>
          <div class="fc-icon" style="background:linear-gradient(135deg,#eff6ff,#dbeafe);color:#3b82f6"><i class="fas fa-clipboard-list"></i></div>
          <div class="fc-label">Protocols</div>
          <div class="fc-desc">Structured research templates for stacking & dosing schedules</div>
        </div>
        <div class="feature-card ripple-container" onclick="navigate('research')">
          <span class="fc-arrow"><i class="fas fa-arrow-right"></i></span>
          <div class="fc-icon" style="background:linear-gradient(135deg,#eff6ff,#bfdbfe);color:#2563eb"><i class="fas fa-newspaper"></i></div>
          <div class="fc-label">Latest Research</div>
          <div class="fc-desc">Real-time PubMed articles on peptide research and clinical trials</div>
        </div>
        <div class="feature-card ripple-container" onclick="navigate('videos')">
          <span class="fc-arrow"><i class="fas fa-arrow-right"></i></span>
          <div class="fc-icon" style="background:linear-gradient(135deg,#fef2f2,#fecaca);color:#ef4444"><i class="fab fa-youtube"></i></div>
          <div class="fc-label">Video Library</div>
          <div class="fc-desc">Live YouTube videos on peptide education, dosing, and protocols</div>
        </div>
      </div>

      <div class="home-section-header">
        <h2><i class="fas fa-rocket" style="color:#f59e0b"></i>Your Journey</h2>
        <p>Track your progress, earn achievements, and connect with the community.</p>
      </div>
      <div class="feature-grid">
        <div class="feature-card ripple-container" onclick="navigate('dashboard')">
          <span class="fc-arrow"><i class="fas fa-arrow-right"></i></span>
          <div class="fc-icon" style="background:linear-gradient(135deg,#eff6ff,#dbeafe);color:#3b82f6"><i class="fas fa-chart-line"></i></div>
          <div class="fc-label">Progress Dashboard</div>
          <div class="fc-desc">Streaks, compliance rates, heatmaps, and trend charts for your journey</div>
        </div>
        <div class="feature-card ripple-container" onclick="navigate('achievements')">
          <span class="fc-arrow"><i class="fas fa-arrow-right"></i></span>
          <div class="fc-icon" style="background:linear-gradient(135deg,#fffbeb,#fef3c7);color:#f59e0b"><i class="fas fa-trophy"></i></div>
          <div class="fc-label">Achievements</div>
          <div class="fc-desc">Earn XP, unlock badges, and level up as you build your routine</div>
        </div>
        <div class="feature-card ripple-container" onclick="navigate('community')">
          <span class="fc-arrow"><i class="fas fa-arrow-right"></i></span>
          <div class="fc-icon" style="background:linear-gradient(135deg,#f0fdfa,#ccfbf1);color:#14b8a6"><i class="fas fa-users"></i></div>
          <div class="fc-label">Community Protocols</div>
          <div class="fc-desc">Share and discover peptide protocols from the community</div>
        </div>
      </div>

      <div class="home-section-header">
        <h2><i class="fas fa-toolbox" style="color:#2563eb"></i>Your Toolkit</h2>
        <p>Daily tracking, calculators, and management tools for your peptide regimen.</p>
      </div>
      <div class="feature-grid">
        <div class="feature-card ripple-container" onclick="navigate('calendar')">
          <span class="fc-arrow"><i class="fas fa-arrow-right"></i></span>
          <div class="fc-icon" style="background:linear-gradient(135deg,#eff6ff,#dbeafe);color:#2563eb"><i class="fas fa-calendar-alt"></i></div>
          <div class="fc-label">Regimen Calendar</div>
          <div class="fc-desc">Schedule peptides with dosing times, export to iCal for reminders</div>
        </div>
        <div class="feature-card ripple-container" onclick="navigate('tracker')">
          <span class="fc-arrow"><i class="fas fa-arrow-right"></i></span>
          <div class="fc-icon" style="background:linear-gradient(135deg,#eff6ff,#dbeafe);color:#2563eb"><i class="fas fa-syringe"></i></div>
          <div class="fc-label">Dose Tracker</div>
          <div class="fc-desc">Log every injection, track site rotation, and monitor compliance</div>
        </div>
        <div class="feature-card ripple-container" onclick="navigate('journal')">
          <span class="fc-arrow"><i class="fas fa-arrow-right"></i></span>
          <div class="fc-icon" style="background:linear-gradient(135deg,#faf5ff,#ede9fe);color:#8b5cf6"><i class="fas fa-book-medical"></i></div>
          <div class="fc-label">Side Effect Journal</div>
          <div class="fc-desc">Daily check-in with wellness ratings, side effects, and trend charts</div>
        </div>
        <div class="feature-card ripple-container" onclick="navigate('calc-pro')">
          <span class="fc-arrow"><i class="fas fa-arrow-right"></i></span>
          <div class="fc-icon" style="background:linear-gradient(135deg,#ecfeff,#cffafe);color:#06b6d4"><i class="fas fa-flask-vial"></i></div>
          <div class="fc-label">Recon Calc Pro</div>
          <div class="fc-desc">Multi-vial tracking, BAC water optimizer, and expiration alerts</div>
        </div>

        <div class="feature-card ripple-container" onclick="navigate('builder')">
          <span class="fc-arrow"><i class="fas fa-arrow-right"></i></span>
          <div class="fc-icon" style="background:linear-gradient(135deg,#eff6ff,#dbeafe);color:#3b82f6"><i class="fas fa-layer-group"></i></div>
          <div class="fc-label">Stack Builder</div>
          <div class="fc-desc">Build peptide stacks with interaction warnings and PDF export</div>
        </div>
        <div class="feature-card ripple-container" onclick="navigate('interactions')">
          <span class="fc-arrow"><i class="fas fa-arrow-right"></i></span>
          <div class="fc-icon" style="background:linear-gradient(135deg,#fff7ed,#ffedd5);color:#f97316"><i class="fas fa-shield-halved"></i></div>
          <div class="fc-label">Interaction Checker</div>
          <div class="fc-desc">Check drug-peptide interactions with severity levels and notes</div>
        </div>

      </div>

    </div>
    <div class="disclaimer"><i class="fas fa-info-circle" style="margin-right:4px"></i> PeptideSafe is a research assistant. All information is for educational and research purposes only, not medical advice. <a href="#" onclick="event.preventDefault(); navigate('disclaimer')" style="color:var(--teal);text-decoration:underline;font-weight:600">Read full disclaimer</a>.</div>
  `;

  // Populate "Today's protocol" tile from regimen data (functions live in app-views.js, loaded later)
  try {
    if (typeof getDosesForDate === 'function') {
      const today = new Date();
      const doses = getDosesForDate(today) || [];
      const total = doses.length;
      let logged = 0;
      if (typeof getDoseLog === 'function') {
        const dateStr = today.toISOString().slice(0, 10);
        const log = getDoseLog() || [];
        logged = log.filter(e => (e.timestamp || e.date || '').slice(0, 10) === dateStr).length;
        if (total) logged = Math.min(logged, total);
      }
      const subEl = el.querySelector('#rsTodayDoses');
      const fillEl = el.querySelector('#rsTodayFill');
      if (subEl) subEl.textContent = total ? `${logged} of ${total} doses logged` : 'No doses scheduled today';
      if (fillEl) fillEl.style.width = total ? `${Math.round((logged / total) * 100)}%` : '0%';
    }
  } catch (e) {}

  renderHomeDiscussions(el);
}

// "Community discussions" teaser on the homepage: top threads from the forum
// at /community. Kept dependency-free (no forum.js needed for the teaser).
// Homepage hero: what ResearchSafe is, with clear paths into the forum.
function homeHeroHtml() {
  var count = (peptides && peptides.length) || 273;
  return '' +
    '<section class="rs-hero rs-hero-home">' +
      '<span class="rs-hero-orb rs-hero-orb-1"></span>' +
      '<span class="rs-hero-orb rs-hero-orb-2"></span>' +
      '<div class="rs-hero-inner">' +
        '<div class="rs-hero-eyebrow"><i class="fas fa-shield-halved"></i> Evidence-based compound research</div>' +
        '<h1 class="rs-hero-title">A peptide knowledge base,<br><span class="rs-hero-shine">powered by its community.</span></h1>' +
        '<p class="rs-hero-sub">' + count + ' structured compound profiles — mechanisms, dosing math, interactions and study citations — plus a community forum where researchers ask questions, share protocols and vote on what helps.</p>' +
        '<div class="rs-hero-ctas">' +
          '<button type="button" class="rs-hero-cta rs-hero-cta-primary" onclick="navigate(\'community\')"><i class="fas fa-comments"></i> Join the forum</button>' +
          '<button type="button" class="rs-hero-cta rs-hero-cta-ghost" onclick="window.__forumComposeIntent=true;navigate(\'community\')"><i class="fas fa-pen-to-square"></i> Ask a question</button>' +
          '<button type="button" class="rs-hero-cta rs-hero-cta-ghost" onclick="var k=document.getElementById(\'homeKbMount\');if(k)k.scrollIntoView({behavior:\'smooth\'})"><i class="fas fa-book-open"></i> Browse ' + count + ' compounds</button>' +
        '</div>' +
      '</div>' +
    '</section>';
}

function renderHomeDiscussions(el) {
  var slot = el.querySelector('#homeForumTeaser');
  if (!slot) return;
  fetch('/api/forum/posts?sort=hot&limit=5').then(function (r) { return r.json(); }).then(function (data) {
    var posts = (data && data.posts) || [];
    if (!posts.length) { slot.innerHTML = ''; return; }
    function ago(iso) {
      var s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
      if (s < 3600) return Math.max(1, Math.floor(s / 60)) + 'm';
      if (s < 86400) return Math.floor(s / 3600) + 'h';
      return Math.floor(s / 86400) + 'd';
    }
    slot.innerHTML =
      '<div class="rs-home-library fr-home-teaser">' +
        '<div class="rs-home-library-head">' +
          '<h2><i class="fas fa-comments" style="color:#14b8a6;margin-right:8px"></i>Community discussions</h2>' +
          '<button onclick="navigate(\'community\')">Visit the forum <i class="fas fa-arrow-right"></i></button>' +
        '</div>' +
        '<div class="fr-teaser-list">' +
        posts.map(function (p) {
          return '<a class="fr-teaser-row" href="/forum/' + p.id + '">' +
            '<span class="fr-teaser-score"><i class="fas fa-arrow-up"></i>' + (p.score || 0) + '</span>' +
            '<span class="fr-teaser-title">' + esc(p.title) + (p.is_pinned ? ' <i class="fas fa-thumbtack" style="color:#22c55e;font-size:.7em"></i>' : '') + '</span>' +
            '<span class="fr-teaser-meta">' + (p.comment_count || 0) + ' <i class="far fa-comment"></i> · ' + ago(p.created_at) + '</span>' +
          '</a>';
        }).join('') +
        '</div>' +
        '<button class="fr-teaser-cta" onclick="navigate(\'community\')"><i class="fas fa-pen-to-square"></i> Ask a question or share a protocol</button>' +
      '</div>';
  }).catch(function () { slot.innerHTML = ''; });
}


// Init - runs immediately, renders home page
(function init() {
  try {
    if (window.__INLINE_DATA__) {
      peptides = window.__INLINE_DATA__.peptides || [];
      protocols = window.__INLINE_DATA__.protocols || [];
      categories = window.__INLINE_DATA__.categories || [];
      window.peptides = peptides;
      window.categories = categories;
      delete window.__INLINE_DATA__;
    }

    document.addEventListener('click', function(e) {
      var btn = e.target.closest('.feature-card, .pill, .nav-btn, .home-send-btn, .compare-btn, .protocol-card, .peptide-card');
      if (btn) createRipple(e, btn);
      var anchor = e.target.closest('a[href]');
      if (anchor && anchor.hostname === window.location.hostname && !anchor.getAttribute('href').startsWith('#') && !anchor.getAttribute('href').startsWith('/api/')) {
        e.preventDefault();
        var href = anchor.getAttribute('href');
        var parsed = pathToView(href);
        navigate(parsed.view, parsed.data);
      }
    });

    var ssrView = window.__SSR_VIEW__ || 'home';
    var ssrData = window.__SSR_DATA__;
    if (ssrView === 'home' || !ssrView) {
      navigate('home', null, true);
    } else if (ssrView === 'compare-detail' && ssrData && ssrData.a && ssrData.b) {
      navigate('compare', { a: ssrData.a, b: ssrData.b }, true);
    } else if (ssrView === 'community') {
      // Derive the community slug (if any) from the URL for hub deep-links.
      var parsedHub = pathToView(window.location.pathname);
      navigate('community', parsedHub.data || null, true);
    } else if (ssrView === 'profile') {
      var parsedProfile = pathToView(window.location.pathname);
      navigate('profile', parsedProfile.data || null, true);
    } else {
      navigate(ssrView, ssrData && typeof ssrData === 'object' ? (ssrData.id || ssrData.category || null) : (ssrData || null), true);
    }
  } catch(e) { console.error('Boot error:', e); }
})();
