// ============================================================
// PeptideSafe UX Enhancements v2
// Fix #1: Skeleton Loaders / Shimmer
// Fix #2: Illustrated Empty States
// Fix #3: Error Recovery with Try Again
// Fix #4: Sidebar Collapsible Groups
// Fix #5: Onboarding Wizard
// ============================================================

(function() {
  'use strict';

  window._ux = window._ux || {};
  window._ux._retries = {};

  // ============================================================
  // FIX #1: SKELETON LOADERS
  // Override the existing skeletonCards with richer variants
  // ============================================================

  const _origSkeleton = typeof window.skeletonCards === 'function' ? window.skeletonCards : null;

  window.skeletonCards = function(count, type) {
    const shimmer = (w, h, radius) =>
      `<div class="ux-shimmer" style="width:${w};height:${h}px;border-radius:${radius || 6}px"></div>`;

    if (type === 'knowledge' || type === 'kb') {
      return `<div class="kb-grid">${Array(count).fill(0).map(() => `
        <div class="ux-skeleton-card">
          <div class="ux-skeleton-row" style="gap:8px;margin-bottom:12px">
            ${shimmer('80px', 22, 12)}${shimmer('60px', 22, 12)}
          </div>
          ${shimmer('65%', 20)}
          <div style="margin-top:8px">${shimmer('90%', 14)}</div>
          <div style="margin-top:6px">${shimmer('75%', 14)}</div>
          <div class="ux-skeleton-row" style="gap:6px;margin-top:14px">
            ${shimmer('50px', 18, 10)}${shimmer('60px', 18, 10)}${shimmer('45px', 18, 10)}
          </div>
        </div>
      `).join('')}</div>`;
    }

    if (type === 'protocol') {
      return Array(count).fill(0).map(() => `
        <div class="ux-skeleton-card" style="padding:20px">
          ${shimmer('50%', 20)}
          <div style="margin-top:10px">${shimmer('80%', 14)}</div>
          <div style="margin-top:6px">${shimmer('60%', 14)}</div>
          <div class="ux-skeleton-row" style="gap:8px;margin-top:14px">
            ${shimmer('80px', 28, 8)}${shimmer('80px', 28, 8)}
          </div>
        </div>
      `).join('');
    }

    if (type === 'dashboard') {
      return `
        <div class="ux-skeleton-view">
          <div class="ux-skeleton-row" style="gap:12px;flex-wrap:wrap">
            ${Array(4).fill(0).map(() => `<div class="ux-skeleton-card" style="flex:1;min-width:140px;padding:20px">${shimmer('60%', 28)}<div style="margin-top:8px">${shimmer('80%', 14)}</div></div>`).join('')}
          </div>
          <div class="ux-skeleton-card" style="padding:20px;height:200px">
            ${shimmer('30%', 18)}
            <div style="margin-top:16px">${shimmer('100%', 140, 8)}</div>
          </div>
        </div>
      `;
    }

    if (type === 'social' || type === 'community') {
      return Array(count).fill(0).map(() => `
        <div class="ux-skeleton-card" style="padding:20px">
          <div class="ux-skeleton-row" style="gap:12px;margin-bottom:14px">
            ${shimmer('36px', 36, 18)}
            <div style="flex:1">${shimmer('120px', 14)}<div style="margin-top:6px">${shimmer('60px', 10)}</div></div>
          </div>
          ${shimmer('70%', 18)}
          <div style="margin-top:8px">${shimmer('95%', 14)}</div>
          <div style="margin-top:5px">${shimmer('80%', 14)}</div>
          <div class="ux-skeleton-row" style="gap:6px;margin-top:14px">
            ${shimmer('70px', 24, 8)}${shimmer('70px', 24, 8)}${shimmer('70px', 24, 8)}
          </div>
        </div>
      `).join('');
    }

    if (type === 'home') {
      return `
        <div class="ux-skeleton-view">
          <div class="ux-skeleton-card" style="padding:32px;text-align:center">
            ${shimmer('180px', 14)}
            <div style="margin-top:12px">${shimmer('60%', 32)}</div>
            <div style="margin-top:10px">${shimmer('80%', 16)}</div>
          </div>
          <div class="ux-skeleton-row" style="gap:12px;flex-wrap:wrap">
            ${Array(3).fill(0).map(() => `<div class="ux-skeleton-card" style="flex:1;min-width:100px;padding:16px;text-align:center">${shimmer('50%', 24)}<div style="margin-top:6px">${shimmer('70%', 12)}</div></div>`).join('')}
          </div>
          <div class="ux-skeleton-grid">
            ${Array(6).fill(0).map(() => `<div class="ux-skeleton-card" style="padding:20px">${shimmer('40px', 40, 10)}<div style="margin-top:10px">${shimmer('70%', 16)}</div><div style="margin-top:6px">${shimmer('90%', 12)}</div></div>`).join('')}
          </div>
        </div>
      `;
    }

    if (type === 'tracker') {
      return `
        <div class="ux-skeleton-view">
          <div class="ux-skeleton-row" style="justify-content:space-between">
            <div>${shimmer('180px', 22)}<div style="margin-top:6px">${shimmer('250px', 14)}</div></div>
            ${shimmer('100px', 36, 10)}
          </div>
          <div class="ux-skeleton-row" style="gap:12px;flex-wrap:wrap">
            ${Array(4).fill(0).map(() => `<div class="ux-skeleton-card" style="flex:1;min-width:100px;padding:16px;text-align:center">${shimmer('50%', 28)}<div style="margin-top:6px">${shimmer('70%', 12)}</div></div>`).join('')}
          </div>
          ${Array(3).fill(0).map(() => `<div class="ux-skeleton-card" style="padding:14px"><div class="ux-skeleton-row" style="gap:12px">${shimmer('80px', 14)}<div style="flex:1">${shimmer('60%', 16)}<div style="margin-top:4px">${shimmer('40%', 12)}</div></div></div></div>`).join('')}
        </div>
      `;
    }

    // Fall back to original skeletonCards for types it already handles
    if (_origSkeleton) return _origSkeleton(count, type);
    return '';
  };


  // ============================================================
  // FIX #2: ILLUSTRATED EMPTY STATES
  // ============================================================

  const emptyStates = {
    favorites: {
      icon: 'fa-star',
      color: '#f59e0b',
      bg: 'rgba(245,158,11,0.08)',
      title: 'No Favorites Yet',
      desc: 'Save peptides and videos you want to revisit. Tap the ★ icon on any peptide card to bookmark it.',
      actions: [
        { label: 'Browse Knowledge Base', icon: 'fa-book-open', onclick: "navigate('knowledge')" },
        { label: 'Watch Videos', icon: 'fa-play', onclick: "navigate('videos')" }
      ]
    },
    tracker: {
      icon: 'fa-syringe',
      color: '#2563eb',
      bg: 'rgba(37,99,235,0.08)',
      title: 'No Doses Logged',
      desc: 'Start tracking your research protocol. Log injections, track sites, and build a compliance history.',
      actions: [
        { label: 'Log Your First Dose', icon: 'fa-plus', onclick: "openDoseLogForm()" },
        { label: 'Set Up Regimen', icon: 'fa-calendar', onclick: "navigate('calendar')" }
      ]
    },
    journal: {
      icon: 'fa-book-medical',
      color: '#8b5cf6',
      bg: 'rgba(139,92,246,0.08)',
      title: 'No Journal Entries',
      desc: 'Track how you feel each day. Rate your wellness, log side effects, and discover patterns over time.',
      actions: [
        { label: 'Write First Entry', icon: 'fa-pen', onclick: "openJournalEntry(new Date().toISOString().split('T')[0])" }
      ]
    },
    bloodwork: {
      icon: 'fa-droplet',
      color: '#3b82f6',
      bg: 'rgba(59,130,246,0.08)',
      title: 'No Blood Work Data',
      desc: 'Track your lab results over time to see how your biomarkers respond to different protocols.',
      actions: [
        { label: 'Add Lab Results', icon: 'fa-plus', onclick: "openBloodworkForm()" }
      ]
    },
    calendar: {
      icon: 'fa-calendar-alt',
      color: '#2563eb',
      bg: 'rgba(37,99,235,0.08)',
      title: 'No Regimen Set Up',
      desc: 'Create a dosing schedule to keep your research organized. Add peptides, set frequencies, and stay on track.',
      actions: [
        { label: 'Create Regimen', icon: 'fa-plus', onclick: "openRegimenForm && openRegimenForm()" },
        { label: 'Browse Protocols', icon: 'fa-clipboard-list', onclick: "navigate('protocols')" }
      ]
    },
    builder: {
      icon: 'fa-layer-group',
      color: '#3b82f6',
      bg: 'rgba(59,130,246,0.08)',
      title: 'Stack Builder Is Empty',
      desc: 'Build a peptide stack by adding compounds. Get interaction warnings and export your plan.',
      actions: [
        { label: 'Browse Peptides', icon: 'fa-book-open', onclick: "navigate('knowledge')" }
      ]
    },
    community: {
      icon: 'fa-users',
      color: '#14b8a6',
      bg: 'rgba(20,184,166,0.08)',
      title: 'No Community Protocols Yet',
      desc: 'Be the first to share! Help the community by publishing your stacking strategies and research protocols.',
      actions: [
        { label: 'Share a Protocol', icon: 'fa-share-nodes', onclick: "window._social && window._social.showShareModal()" }
      ]
    },
    search: {
      icon: 'fa-search',
      color: '#6b7280',
      bg: 'rgba(107,114,128,0.08)',
      title: 'No Results Found',
      desc: 'Try adjusting your search terms or browse by category instead.',
      actions: [
        { label: 'Browse All Peptides', icon: 'fa-book-open', onclick: "navigate('knowledge')" }
      ]
    }
  };

  function renderEmptyState(key) {
    const s = emptyStates[key];
    if (!s) return '';
    return `
      <div class="ux-empty-state">
        <div class="ux-empty-icon" style="color:${s.color};background:${s.bg};border-color:${s.color}">
          <i class="fas ${s.icon}"></i>
        </div>
        <h3 class="ux-empty-title">${s.title}</h3>
        <p class="ux-empty-desc">${s.desc}</p>
        <div class="ux-empty-actions">
          ${s.actions.map(a => `
            <button class="ux-empty-action" onclick="${a.onclick}">
              <i class="fas ${a.icon}"></i> ${a.label}
            </button>
          `).join('')}
        </div>
      </div>
    `;
  }
  window._ux.renderEmptyState = renderEmptyState;


  // ============================================================
  // FIX #3: ERROR RECOVERY
  // ============================================================

  function renderErrorState(title, message, retryFn) {
    const retryId = 'retry-' + Math.random().toString(36).substring(2, 8);
    if (retryFn) window._ux._retries[retryId] = retryFn;

    return `
      <div class="ux-error-state">
        <div class="ux-error-icon">
          <i class="fas fa-exclamation-triangle"></i>
        </div>
        <h3 class="ux-error-title">${title || 'Something Went Wrong'}</h3>
        <p class="ux-error-desc">${message || 'Failed to load this content. Please check your connection and try again.'}</p>
        <div class="ux-error-actions">
          ${retryFn ? `<button class="ux-error-retry" onclick="window._ux._retries['${retryId}']()">
            <i class="fas fa-rotate-right"></i> Try Again
          </button>` : ''}
          <button class="ux-error-home" onclick="navigate('home')">
            <i class="fas fa-home"></i> Go Home
          </button>
        </div>
      </div>
    `;
  }
  window._ux.renderErrorState = renderErrorState;

  // Offline detection
  let offlineBannerShown = false;
  function showOfflineBanner() {
    if (offlineBannerShown) return;
    offlineBannerShown = true;
    const banner = document.createElement('div');
    banner.id = 'offlineBanner';
    banner.className = 'ux-offline-banner';
    banner.innerHTML = `
      <i class="fas fa-wifi" style="margin-right:8px;opacity:0.5"></i>
      You're offline. Some features may not work.
      <button onclick="this.parentElement.remove();window._ux._offlineBannerShown=false"
        style="margin-left:12px;background:rgba(255,255,255,0.2);border:none;color:#111;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600">
        Dismiss
      </button>
    `;
    document.body.appendChild(banner);
  }
  window.addEventListener('online', () => {
    const banner = document.getElementById('offlineBanner');
    if (banner) banner.remove();
    offlineBannerShown = false;
  });
  window.addEventListener('offline', showOfflineBanner);

  // Wrap global fetch for offline detection and retry support
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    try {
      const response = await originalFetch.apply(this, args);
      return response;
    } catch (error) {
      if (!navigator.onLine) showOfflineBanner();
      throw error;
    }
  };


  // ============================================================
  // FIX #4: SUB-PANEL NAVIGATION (flyout column)
  // Activity bar shows 6 icons; clicking Tracking/Tools/Discover
  // opens a sub-panel to the right with sub-items.
  // ============================================================

  const SUB_PANEL_GROUPS = {
    tools: {
      label: 'Tools',
      items: [
        { view: 'calc-pro', icon: 'fas fa-flask-vial', label: 'Calculator', desc: 'Reconstitution math' },
        { view: 'builder', icon: 'fas fa-layer-group', label: 'Stack Builder', desc: 'Build peptide stacks' },
        { view: 'interactions', icon: 'fas fa-shield-halved', label: 'Interactions', desc: 'Check conflicts' }
      ]
    },
    discover: {
      label: 'Discover',
      items: [
        { view: 'protocols', icon: 'fas fa-clipboard-list', label: 'Protocols', desc: 'Protocol templates' },
        { view: 'community', icon: 'fas fa-users', label: 'Community', desc: 'Shared protocols' },
        { view: 'research', icon: 'fas fa-newspaper', label: 'Research', desc: 'Latest papers' },
        { view: 'videos', icon: 'fab fa-youtube', label: 'Videos', desc: 'Educational content' }
      ]
    }
  };

  let activeSubPanel = null;

  function toggleSubPanel(groupId) {
    const panel = document.getElementById('subPanel');
    if (!panel) return;

    if (activeSubPanel === groupId) {
      closeSubPanel();
      return;
    }

    activeSubPanel = groupId;
    const group = SUB_PANEL_GROUPS[groupId];
    if (!group) return;

    // Update panel content
    const titleEl = document.getElementById('subPanelTitle');
    const itemsEl = document.getElementById('subPanelItems');
    if (titleEl) titleEl.textContent = group.label;
    if (itemsEl) {
      const currentView = window.currentView || 'home';
      itemsEl.innerHTML = '';
      group.items.forEach(item => {
        const btn = document.createElement('button');
        btn.setAttribute('data-view', item.view);
        btn.title = item.label;
        const isActive = item.view === currentView;
        btn.style.cssText = 'display:flex;align-items:center;gap:10px;width:100%;padding:9px 12px;border-radius:9px;border:none;cursor:pointer;font-size:13px;text-align:left;white-space:nowrap;' +
          (isActive ? 'background:rgba(37,99,235,0.1);color:#2563eb;font-weight:600' : 'background:transparent;color:#6b7280;font-weight:500');
        btn.innerHTML = '<i class="' + item.icon + '" style="width:18px;text-align:center;font-size:14px;flex-shrink:0"></i>' +
          '<div><span>' + item.label + '</span><span style="display:block;font-size:10px;font-weight:400;color:#9ca3af;margin-top:1px">' + item.desc + '</span></div>';
        btn.addEventListener('click', function(e) {
          e.stopPropagation();
          const view = item.view;
          if (typeof window.navigate === 'function') {
            window.navigate(view);
          }
          setTimeout(closeSubPanel, 100);
        });
        itemsEl.appendChild(btn);
      });
    }

    // Open panel with inline styles
    panel.style.transform = 'translateX(0)';
    panel.style.opacity = '1';
    panel.style.pointerEvents = 'auto';
    panel.classList.add('open');

    // Click-outside: close panel when clicking outside
    setTimeout(() => {
      const onClickOutside = (e) => {
        if (!panel.contains(e.target) && !e.target.closest('.ab-group-btn')) {
          closeSubPanel();
          document.removeEventListener('click', onClickOutside);
        }
      };
      document.addEventListener('click', onClickOutside);
    }, 200);

    // Highlight active group button
    document.querySelectorAll('.ab-group-btn').forEach(btn => {
      btn.classList.toggle('ab-active', btn.dataset.group === groupId);
    });
  }
  window.toggleSubPanel = toggleSubPanel;

  function closeSubPanel() {
    const panel = document.getElementById('subPanel');
    if (panel) {
      panel.style.transform = 'translateX(-110%)';
      panel.style.opacity = '0';
      panel.style.pointerEvents = 'none';
      panel.classList.remove('open');
    }
    activeSubPanel = null;
    document.querySelectorAll('.ab-group-btn').forEach(btn => btn.classList.remove('ab-active'));

  }
  window.closeSubPanel = closeSubPanel;

  // After navigate(), update sub-panel active state and activity bar highlights
  function updateSubPanelAfterNav() {
    const currentView = window.currentView || 'home';

    // Update sub-panel item active states
    document.querySelectorAll('.sub-panel-item').forEach(item => {
      item.classList.toggle('active', item.dataset.view === currentView);
    });

    // Check if current view belongs to a group - highlight the group btn
    let belongsToGroup = null;
    for (const [groupId, group] of Object.entries(SUB_PANEL_GROUPS)) {
      if (group.items.some(i => i.view === currentView)) {
        belongsToGroup = groupId;
        break;
      }
    }

    document.querySelectorAll('.ab-group-btn').forEach(btn => {
      // If the panel is open for this group, keep it highlighted
      // Or if the current view is in this group, give it a subtle highlight
      const isActiveGroup = btn.dataset.group === activeSubPanel;
      const containsCurrent = btn.dataset.group === belongsToGroup;
      btn.classList.toggle('ab-active', isActiveGroup);
      // Add a subtle dot indicator if current view is in this group
      if (containsCurrent && !isActiveGroup) {
        btn.classList.add('ab-has-active');
      } else {
        btn.classList.remove('ab-has-active');
      }
    });

    // Also update the main sidebar nav-btn active states
    document.querySelectorAll('#activityBar .nav-btn[data-view]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === currentView);
    });
  }


  // ============================================================
  // FIX #5: ONBOARDING WIZARD  (v3 - with sign-up finale)
  // ============================================================

  const ONBOARDING_KEY = 'ps-onboarding-v3';

  // ── SVG illustrations ────────────────────────────────────────
  const OB_ILLUSTRATIONS = {
    welcome: `<svg viewBox="0 0 200 140" fill="none" xmlns="http://www.w3.org/2000/svg" class="ob-svg">
      <!-- Background blobs -->
      <ellipse cx="100" cy="80" rx="90" ry="55" fill="#eff6ff" opacity="0.7"/>
      <ellipse cx="155" cy="40" rx="30" ry="30" fill="#dbeafe" opacity="0.5"/>
      <ellipse cx="42" cy="100" rx="24" ry="24" fill="#e0f2fe" opacity="0.5"/>
      <!-- Shield body -->
      <path d="M100 22 L126 34 L126 62 C126 82 100 98 100 98 C100 98 74 82 74 62 L74 34 Z" fill="#2563eb" fill-opacity="0.1" stroke="#2563eb" stroke-width="2.5" stroke-linejoin="round"/>
      <!-- Shield shine -->
      <path d="M100 28 L120 38 L120 62 C120 78 100 92 100 92" stroke="#2563eb" stroke-width="1" stroke-opacity="0.3" fill="none" stroke-linecap="round"/>
      <!-- Check mark -->
      <path d="M88 60 L97 69 L114 52" stroke="#2563eb" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
      <!-- Floating badges -->
      <rect x="14" y="30" width="46" height="22" rx="11" fill="#fff" stroke="#bfdbfe" stroke-width="1.5"/>
      <text x="37" y="45" text-anchor="middle" font-size="9" font-weight="700" fill="#2563eb" font-family="system-ui">FREE</text>
      <rect x="140" y="90" width="50" height="22" rx="11" fill="#fff" stroke="#bbf7d0" stroke-width="1.5"/>
      <text x="165" y="105" text-anchor="middle" font-size="9" font-weight="700" fill="#059669" font-family="system-ui">SAFE</text>
      <!-- Dots decoration -->
      <circle cx="30" cy="65" r="3" fill="#93c5fd" opacity="0.7"/>
      <circle cx="172" cy="55" r="3" fill="#6ee7b7" opacity="0.7"/>
      <circle cx="160" cy="20" r="2" fill="#fbbf24" opacity="0.7"/>
      <circle cx="44" cy="122" r="2" fill="#f9a8d4" opacity="0.7"/>
    </svg>`,

    knowledge: `<svg viewBox="0 0 200 140" fill="none" xmlns="http://www.w3.org/2000/svg" class="ob-svg">
      <ellipse cx="100" cy="80" rx="88" ry="52" fill="#eff6ff" opacity="0.6"/>
      <!-- Open book -->
      <path d="M50 45 L50 105 Q75 98 100 105 Q125 98 150 105 L150 45 Q125 52 100 45 Q75 38 50 45Z" fill="#fff" stroke="#3b82f6" stroke-width="2"/>
      <line x1="100" y1="45" x2="100" y2="105" stroke="#3b82f6" stroke-width="2"/>
      <!-- Book lines left page -->
      <line x1="62" y1="60" x2="93" y2="62" stroke="#93c5fd" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="62" y1="70" x2="93" y2="72" stroke="#93c5fd" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="62" y1="80" x2="88" y2="82" stroke="#93c5fd" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="62" y1="90" x2="93" y2="91" stroke="#93c5fd" stroke-width="1.5" stroke-linecap="round"/>
      <!-- Book lines right page -->
      <line x1="107" y1="62" x2="138" y2="60" stroke="#bfdbfe" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="107" y1="72" x2="138" y2="70" stroke="#bfdbfe" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="107" y1="82" x2="132" y2="80" stroke="#bfdbfe" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="107" y1="91" x2="138" y2="90" stroke="#bfdbfe" stroke-width="1.5" stroke-linecap="round"/>
      <!-- Floating pills -->
      <rect x="18" y="50" width="22" height="8" rx="4" fill="#3b82f6" opacity="0.2" stroke="#3b82f6" stroke-width="1"/>
      <rect x="158" y="60" width="22" height="8" rx="4" fill="#8b5cf6" opacity="0.2" stroke="#8b5cf6" stroke-width="1"/>
      <circle cx="168" cy="40" r="5" fill="#fbbf24" opacity="0.4"/>
      <circle cx="30" cy="100" r="4" fill="#34d399" opacity="0.4"/>
    </svg>`,

    tracking: `<svg viewBox="0 0 200 140" fill="none" xmlns="http://www.w3.org/2000/svg" class="ob-svg">
      <ellipse cx="100" cy="80" rx="88" ry="52" fill="#f5f3ff" opacity="0.6"/>
      <!-- Chart grid -->
      <rect x="30" y="30" width="140" height="80" rx="12" fill="#fff" stroke="#e9d5ff" stroke-width="1.5"/>
      <line x1="30" y1="80" x2="170" y2="80" stroke="#f3e8ff" stroke-width="1"/>
      <line x1="30" y1="55" x2="170" y2="55" stroke="#f3e8ff" stroke-width="1"/>
      <line x1="30" y1="105" x2="170" y2="105" stroke="#f3e8ff" stroke-width="1"/>
      <!-- Chart line -->
      <polyline points="45,95 68,75 90,85 110,50 130,60 152,38" stroke="#8b5cf6" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <!-- Area fill -->
      <polygon points="45,95 68,75 90,85 110,50 130,60 152,38 152,110 45,110" fill="#8b5cf6" fill-opacity="0.08"/>
      <!-- Data dots -->
      <circle cx="45" cy="95" r="3.5" fill="#8b5cf6"/>
      <circle cx="68" cy="75" r="3.5" fill="#8b5cf6"/>
      <circle cx="90" cy="85" r="3.5" fill="#8b5cf6"/>
      <circle cx="110" cy="50" r="4.5" fill="#7c3aed" stroke="#fff" stroke-width="1.5"/>
      <circle cx="130" cy="60" r="3.5" fill="#8b5cf6"/>
      <circle cx="152" cy="38" r="3.5" fill="#8b5cf6"/>
      <!-- Tooltip at peak -->
      <rect x="116" y="34" width="40" height="18" rx="6" fill="#7c3aed"/>
      <text x="136" y="46" text-anchor="middle" font-size="8" font-weight="700" fill="#fff" font-family="system-ui">+18%</text>
      <!-- Syringe icon -->
      <rect x="14" y="50" width="10" height="22" rx="3" fill="#8b5cf6" opacity="0.15" stroke="#8b5cf6" stroke-width="1"/>
    </svg>`,

    tools: `<svg viewBox="0 0 200 140" fill="none" xmlns="http://www.w3.org/2000/svg" class="ob-svg">
      <ellipse cx="100" cy="80" rx="88" ry="52" fill="#ecfeff" opacity="0.6"/>
      <!-- Calculator body -->
      <rect x="60" y="22" width="80" height="96" rx="14" fill="#fff" stroke="#06b6d4" stroke-width="2"/>
      <!-- Screen -->
      <rect x="70" y="33" width="60" height="28" rx="7" fill="#ecfeff" stroke="#a5f3fc" stroke-width="1"/>
      <text x="100" y="52" text-anchor="middle" font-size="14" font-weight="700" fill="#0e7490" font-family="monospace">2.5mg</text>
      <!-- Buttons row 1 -->
      <rect x="70" y="70" width="16" height="13" rx="4" fill="#cffafe" stroke="#06b6d4" stroke-width="1"/>
      <rect x="92" y="70" width="16" height="13" rx="4" fill="#cffafe" stroke="#06b6d4" stroke-width="1"/>
      <rect x="114" y="70" width="16" height="13" rx="4" fill="#cffafe" stroke="#06b6d4" stroke-width="1"/>
      <!-- Buttons row 2 -->
      <rect x="70" y="89" width="16" height="13" rx="4" fill="#cffafe" stroke="#06b6d4" stroke-width="1"/>
      <rect x="92" y="89" width="16" height="13" rx="4" fill="#cffafe" stroke="#06b6d4" stroke-width="1"/>
      <rect x="114" y="89" width="16" height="13" rx="4" fill="#0891b2" stroke="#06b6d4" stroke-width="1"/>
      <text x="122" y="99" text-anchor="middle" font-size="9" font-weight="700" fill="#fff" font-family="system-ui">=</text>
      <!-- Floating molecules -->
      <circle cx="30" cy="40" r="7" fill="none" stroke="#06b6d4" stroke-width="1.5" opacity="0.5"/>
      <circle cx="30" cy="40" r="3" fill="#06b6d4" opacity="0.3"/>
      <circle cx="170" cy="95" r="7" fill="none" stroke="#8b5cf6" stroke-width="1.5" opacity="0.5"/>
      <circle cx="170" cy="95" r="3" fill="#8b5cf6" opacity="0.3"/>
    </svg>`,

    community: `<svg viewBox="0 0 200 140" fill="none" xmlns="http://www.w3.org/2000/svg" class="ob-svg">
      <ellipse cx="100" cy="80" rx="88" ry="52" fill="#f0fdfa" opacity="0.6"/>
      <!-- Person 1 (center) -->
      <circle cx="100" cy="52" r="16" fill="#d1fae5" stroke="#14b8a6" stroke-width="2"/>
      <circle cx="100" cy="46" r="7" fill="#14b8a6" opacity="0.7"/>
      <path d="M86 72 Q100 65 114 72" fill="#d1fae5" stroke="#14b8a6" stroke-width="1.5"/>
      <!-- Person 2 (left) -->
      <circle cx="58" cy="65" r="13" fill="#e0f2fe" stroke="#3b82f6" stroke-width="1.5"/>
      <circle cx="58" cy="60" r="5.5" fill="#3b82f6" opacity="0.7"/>
      <path d="M48 80 Q58 74 68 80" fill="#e0f2fe" stroke="#3b82f6" stroke-width="1.5"/>
      <!-- Person 3 (right) -->
      <circle cx="142" cy="65" r="13" fill="#fce7f3" stroke="#ec4899" stroke-width="1.5"/>
      <circle cx="142" cy="60" r="5.5" fill="#ec4899" opacity="0.7"/>
      <path d="M132 80 Q142 74 152 80" fill="#fce7f3" stroke="#ec4899" stroke-width="1.5"/>
      <!-- Connection lines -->
      <line x1="74" y1="65" x2="84" y2="65" stroke="#14b8a6" stroke-width="1.5" stroke-dasharray="3,2" opacity="0.6"/>
      <line x1="116" y1="65" x2="128" y2="65" stroke="#14b8a6" stroke-width="1.5" stroke-dasharray="3,2" opacity="0.6"/>
      <!-- Chat bubbles -->
      <rect x="30" y="90" width="50" height="22" rx="10" fill="#fff" stroke="#a5f3fc" stroke-width="1.5"/>
      <text x="55" y="105" text-anchor="middle" font-size="8" fill="#0f766e" font-family="system-ui">BPC-157 👍</text>
      <rect x="118" y="90" width="54" height="22" rx="10" fill="#fff" stroke="#fbcfe8" stroke-width="1.5"/>
      <text x="145" y="105" text-anchor="middle" font-size="8" fill="#be185d" font-family="system-ui">Great results!</text>
    </svg>`,

    signup: `<svg viewBox="0 0 200 140" fill="none" xmlns="http://www.w3.org/2000/svg" class="ob-svg">
      <!-- Background gradient blobs -->
      <ellipse cx="100" cy="75" rx="90" ry="56" fill="url(#signupGrad)" opacity="0.15"/>
      <defs>
        <linearGradient id="signupGrad" x1="0" y1="0" x2="200" y2="140" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#2563eb"/>
          <stop offset="100%" stop-color="#7c3aed"/>
        </linearGradient>
      </defs>
      <!-- Star/sparkle decorations -->
      <path d="M28 35 L30 28 L32 35 L38 37 L32 39 L30 46 L28 39 L22 37 Z" fill="#fbbf24" opacity="0.8"/>
      <path d="M168 22 L170 16 L172 22 L178 24 L172 26 L170 32 L168 26 L162 24 Z" fill="#a78bfa" opacity="0.7"/>
      <path d="M173 95 L174.5 91 L176 95 L180 96.5 L176 98 L174.5 102 L173 98 L169 96.5 Z" fill="#34d399" opacity="0.7"/>
      <!-- Cloud sync icon -->
      <path d="M72 75 Q72 58 88 56 Q90 44 106 44 Q120 44 124 56 Q136 56 136 70 Q136 82 124 82 L80 82 Q72 82 72 75 Z" fill="#eff6ff" stroke="#3b82f6" stroke-width="2"/>
      <!-- Upload arrow -->
      <line x1="100" y1="96" x2="100" y2="68" stroke="#2563eb" stroke-width="2.5" stroke-linecap="round"/>
      <polyline points="92,76 100,68 108,76" stroke="#2563eb" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      <!-- Feature chips -->
      <rect x="18" y="52" width="44" height="18" rx="9" fill="#fff" stroke="#bbf7d0" stroke-width="1.5"/>
      <text x="40" y="64" text-anchor="middle" font-size="8" font-weight="600" fill="#059669" font-family="system-ui">☁ Sync data</text>
      <rect x="136" y="52" width="50" height="18" rx="9" fill="#fff" stroke="#e9d5ff" stroke-width="1.5"/>
      <text x="161" y="64" text-anchor="middle" font-size="8" font-weight="600" fill="#7c3aed" font-family="system-ui">🔒 Private</text>
      <rect x="18" y="100" width="56" height="18" rx="9" fill="#fff" stroke="#fed7aa" stroke-width="1.5"/>
      <text x="46" y="112" text-anchor="middle" font-size="8" font-weight="600" fill="#d97706" font-family="system-ui">🔔 Alerts</text>
      <rect x="128" y="100" width="56" height="18" rx="9" fill="#fff" stroke="#bfdbfe" stroke-width="1.5"/>
      <text x="156" y="112" text-anchor="middle" font-size="8" font-weight="600" fill="#2563eb" font-family="system-ui">📊 History</text>
    </svg>`
  };

  const onboardingSteps = [
    {
      id: 'welcome',
      title: 'Welcome to PeptideSafe',
      desc: `<div class="ob-welcome-badge"><i class="fas fa-heart"></i> Free forever. No ads. No paywalls.</div>
        <div class="ob-welcome-text">Peptides are going mainstream, and with that comes real risk. PeptideSafe exists to help you <strong>educate yourself safely</strong> with reliable information, proper protocols, and tools you can trust.</div>
        <div class="ob-welcome-highlight"><i class="fas fa-flask-vial"></i> We build verified third-party testing resources so you always know what you're getting is pure and safe.</div>`,
      illustration: 'welcome',
      color: '#2563eb',
      welcomeStep: true
    },
    {
      id: 'knowledge',
      title: 'Knowledge Base',
      desc: 'Browse 80+ detailed peptide profiles - dosing, mechanisms, side effects, and latest research - all in one place.',
      illustration: 'knowledge',
      color: '#3b82f6',
      highlight: '.sidebar-nav [data-view="knowledge"]',
      tag: { icon: 'fa-book-open', label: '80+ peptides' }
    },
    {
      id: 'tracking',
      title: 'Track Your Research',
      desc: 'Log doses, record side effects in your journal, and monitor bloodwork trends over time. Your entire research journey in one dashboard.',
      illustration: 'tracking',
      color: '#8b5cf6',
      highlight: '.ab-group-btn[data-group="tracking"]',
      tag: { icon: 'fa-chart-line', label: 'Smart trends' }
    },
    {
      id: 'tools',
      title: 'Tools & Calculators',
      desc: 'Reconstitution calculator, stack builder with live interaction warnings, and ready-to-use protocol templates.',
      illustration: 'tools',
      color: '#06b6d4',
      highlight: '.ab-group-btn[data-group="tools"]',
      tag: { icon: 'fa-flask-vial', label: 'Pro tools' }
    },
    {
      id: 'community',
      title: 'Join the Community',
      desc: 'Connect with fellow researchers. Share protocols, discuss studies, and ask questions in our Reddit-style forum.',
      illustration: 'community',
      color: '#14b8a6',
      highlight: '.ab-group-btn[data-group="discover"]',
      tag: { icon: 'fa-users', label: 'Active forum' }
    },
    {
      id: 'signup',
      title: 'Save Your Progress',
      signupStep: true,
      illustration: 'signup',
      color: '#2563eb'
    }
  ];

  let onboardingStep = 0;

  function showOnboarding() {
    onboardingStep = 0;
    renderOnboardingStep();
  }

  function renderOnboardingStep() {
    const step = onboardingSteps[onboardingStep];
    const total = onboardingSteps.length;
    const isLast = onboardingStep === total - 1;
    const isFirst = onboardingStep === 0;

    document.querySelectorAll('.ux-onboarding-highlight').forEach(el => el.classList.remove('ux-onboarding-highlight'));
    if (step.highlight) {
      const target = document.querySelector(step.highlight);
      if (target) target.classList.add('ux-onboarding-highlight');
    }

    let overlay = document.getElementById('uxOnboardingOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'uxOnboardingOverlay';
      overlay.className = 'ux-onboarding-overlay';
      document.body.appendChild(overlay);
    }

    // Progress dots - exclude the signup step from the count visually
    const displaySteps = onboardingSteps.filter(s => !s.signupStep);
    const displayIdx   = Math.min(onboardingStep, displaySteps.length - 1);
    const progressDots = displaySteps.map((_, i) =>
      `<div class="ux-onboarding-dot ${i === displayIdx ? 'active' : i < displayIdx ? 'done' : ''}"></div>`
    ).join('');

    if (step.signupStep) {
      // ── Final signup slide ──────────────────────────────────
      overlay.innerHTML = `
        <div class="ux-onboarding-card ob-signup-card">
          <button class="ob-signup-skip" onclick="window._ux.skipOnboarding()" title="Skip & continue without account">
            Skip <i class="fas fa-arrow-right"></i>
          </button>
          <div class="ob-signup-illustration">${OB_ILLUSTRATIONS.signup}</div>
          <h2 class="ob-signup-title">Save Your Progress</h2>
          <p class="ob-signup-sub">Create a free account to sync your logs, journal, and stack across all your devices.</p>

          <div class="ob-signup-perks">
            <div class="ob-signup-perk"><i class="fas fa-cloud-arrow-up" style="color:#2563eb"></i><span>Sync across devices</span></div>
            <div class="ob-signup-perk"><i class="fas fa-lock" style="color:#7c3aed"></i><span>Private &amp; secure</span></div>
            <div class="ob-signup-perk"><i class="fas fa-bell" style="color:#f59e0b"></i><span>Personalized alerts</span></div>
            <div class="ob-signup-perk"><i class="fas fa-chart-line" style="color:#14b8a6"></i><span>Full history</span></div>
          </div>

          <div class="ob-signup-form-wrap">
            <div id="obSignupError" class="ob-signup-error" style="display:none"></div>
            <button class="ob-google-btn" onclick="window._ux.obSignInGoogle()">
              <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              Continue with Google
            </button>
            <div class="ob-or-divider"><span>or</span></div>
            <form id="obSignupForm" onsubmit="window._ux.obHandleSignup(event)">
              <div class="ob-field-row">
                <input class="ob-input" type="email" id="obEmail" placeholder="Email address" required autocomplete="email">
                <input class="ob-input" type="password" id="obPassword" placeholder="Password (6+ chars)" required minlength="6" autocomplete="new-password">
              </div>
              <button class="ob-submit-btn" type="submit" id="obSubmitBtn">
                <span id="obSubmitText"><i class="fas fa-user-plus"></i> Create Free Account</span>
              </button>
            </form>
            <p class="ob-privacy-note">
              By signing up you agree to our <a href="#" onclick="event.preventDefault(); window._ux.skipOnboarding(); navigate('privacy')">Privacy Policy</a>.
            </p>
          </div>
          <button class="ob-back-link" onclick="window._ux.prevOnboarding()"><i class="fas fa-arrow-left"></i> Back</button>
        </div>
      `;
    } else {
      // ── Regular feature slide ───────────────────────────────
      const tagHtml = step.tag
        ? `<div class="ob-feature-tag" style="--tag-color:${step.color}"><i class="fas ${step.tag.icon}"></i>${step.tag.label}</div>`
        : '';

      overlay.innerHTML = `
        <div class="ux-onboarding-card ${step.welcomeStep ? 'ob-welcome-card' : 'ob-feature-card'}">
          <div class="ux-onboarding-progress">${progressDots}</div>

          <div class="ob-illustration-wrap ${step.welcomeStep ? 'ob-illustration-lg' : ''}">
            ${OB_ILLUSTRATIONS[step.illustration] || ''}
          </div>

          ${tagHtml}
          <h2 class="ux-onboarding-title">${step.title}</h2>

          ${step.welcomeStep
            ? `<div class="ob-welcome-body">${step.desc}</div>`
            : `<p class="ux-onboarding-desc">${step.desc}</p>`
          }

          <div class="ux-onboarding-actions">
            ${!isFirst
              ? `<button class="ux-onboarding-back" onclick="window._ux.prevOnboarding()"><i class="fas fa-arrow-left"></i> Back</button>`
              : `<button class="ux-onboarding-skip" onclick="window._ux.skipOnboarding()">Skip</button>`
            }
            <button class="ux-onboarding-next ${isLast ? 'ux-onboarding-finish' : ''}" onclick="window._ux.nextOnboarding()">
              ${isLast
                ? `<i class="fas fa-user-plus"></i> Get Started`
                : `Next <i class="fas fa-arrow-right"></i>`
              }
            </button>
          </div>
          <div class="ux-onboarding-step-count">${onboardingStep + 1} of ${total}</div>
        </div>
      `;
    }

    overlay.style.display = 'flex';
  }

  window._ux.nextOnboarding = function() {
    if (onboardingStep < onboardingSteps.length - 1) { onboardingStep++; renderOnboardingStep(); }
  };
  window._ux.prevOnboarding = function() {
    if (onboardingStep > 0) { onboardingStep--; renderOnboardingStep(); }
  };
  window._ux.skipOnboarding = function() { window._ux.finishOnboarding(); };
  window._ux.finishOnboarding = function() {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    document.querySelectorAll('.ux-onboarding-highlight').forEach(el => el.classList.remove('ux-onboarding-highlight'));
    const overlay = document.getElementById('uxOnboardingOverlay');
    if (overlay) {
      overlay.classList.add('ux-onboarding-fadeout');
      setTimeout(() => overlay.remove(), 400);
    }
  };

  // ── Onboarding sign-up helpers ──────────────────────────────
  window._ux.obSignInGoogle = function() {
    window._ux.finishOnboarding();
    if (typeof signInWithGoogle === 'function') signInWithGoogle();
  };

  window._ux.obHandleSignup = async function(e) {
    e.preventDefault();
    const email    = document.getElementById('obEmail')?.value?.trim();
    const password = document.getElementById('obPassword')?.value;
    const errEl    = document.getElementById('obSignupError');
    const btn      = document.getElementById('obSubmitBtn');
    const btnTxt   = document.getElementById('obSubmitText');
    if (!email || !password) return;
    btn.disabled = true;
    btnTxt.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating account…';
    errEl.style.display = 'none';
    try {
      const result = await window.sbClient.auth.signUp({ email, password });
      if (result.error) {
        errEl.textContent = result.error.message;
        errEl.style.display = 'block';
        btn.disabled = false;
        btnTxt.innerHTML = '<i class="fas fa-user-plus"></i> Create Free Account';
      } else {
        // Dismiss onboarding and let the auth flow handle the rest
        window._ux.finishOnboarding();
        // Show a friendly confirmation in the main UI
        if (typeof openAuthModal === 'function') {
          // Supabase may need email confirmation - show login modal
          setTimeout(() => openAuthModal('login'), 400);
        }
      }
    } catch(err) {
      errEl.textContent = 'Network error. Please try again.';
      errEl.style.display = 'block';
      btn.disabled = false;
      btnTxt.innerHTML = '<i class="fas fa-user-plus"></i> Create Free Account';
    }
  };

  window._ux.showOnboarding = showOnboarding;


  // ============================================================
  // MONKEY-PATCH render functions to inject empty states + loaders
  // This approach works reliably without fragile MutationObservers
  // ============================================================

  function patchAfterAppLoad() {
    // --- Patch renderDoseLog ---
    const origRenderDoseLog = window.renderDoseLog;
    if (origRenderDoseLog) {
      window.renderDoseLog = function(el) {
        origRenderDoseLog(el);
        // Replace the basic empty state with our rich one
        const emptyDiv = el.querySelector('.cal-empty-state');
        if (emptyDiv && emptyDiv.closest('.tracker-view')) {
          const parent = emptyDiv.closest('.tracker-section');
          if (parent) parent.innerHTML = renderEmptyState('tracker');
        }
      };
    }

    // --- Patch renderJournal ---
    const origRenderJournal = window.renderJournal;
    if (origRenderJournal) {
      window.renderJournal = function(el) {
        origRenderJournal(el);
        const emptyDiv = el.querySelector('.cal-empty-state');
        if (emptyDiv && emptyDiv.closest('.journal-view')) {
          const parent = emptyDiv.closest('.journal-entries');
          if (parent) parent.innerHTML = renderEmptyState('journal');
        }
      };
    }

    // --- Patch renderBloodwork ---
    const origRenderBloodwork = window.renderBloodwork;
    if (origRenderBloodwork) {
      window.renderBloodwork = function(el) {
        origRenderBloodwork(el);
        const emptyDiv = el.querySelector('.cal-empty-state');
        if (emptyDiv && emptyDiv.closest('.bw-view')) {
          const parent = emptyDiv.closest('.tracker-section');
          if (parent) parent.innerHTML = renderEmptyState('bloodwork');
        }
      };
    }

    // --- Patch renderCalendar ---
    const origRenderCalendar = window.renderCalendar;
    if (origRenderCalendar) {
      window.renderCalendar = function(el) {
        origRenderCalendar(el);
        const emptyDiv = el.querySelector('.cal-empty-state');
        if (emptyDiv) {
          const parent = emptyDiv.parentElement;
          if (parent) parent.innerHTML = renderEmptyState('calendar');
        }
      };
    }

    // --- Patch renderBuilder ---
    const origRenderBuilder = window.renderBuilder;
    if (origRenderBuilder) {
      window.renderBuilder = function(el) {
        origRenderBuilder(el);
        // Check if builder stack is empty by looking for the empty indicator
        const builderView = el.querySelector('.builder-view, [class*="builder"]');
        if (builderView) {
          const emptyIndicator = builderView.querySelector('.builder-empty, .cal-empty-state');
          if (emptyIndicator) {
            emptyIndicator.innerHTML = renderEmptyState('builder');
          }
        }
      };
    }

    // --- Patch renderKBGrid for "no results" ---
    const origRenderKBGrid = window.renderKBGrid;
    if (origRenderKBGrid) {
      window.renderKBGrid = function() {
        origRenderKBGrid();
        const grid = document.getElementById('kbGrid');
        if (grid && grid.children.length === 0) {
          // No matching peptides
          grid.innerHTML = renderEmptyState('search');
        }
      };
    }

    // --- Patch navigate to update sub-panel and activity bar ---
    const origNavigate = window.navigate;
    if (origNavigate) {
      window.navigate = function(view, data, skipPush) {
        origNavigate(view, data, skipPush);
        setTimeout(updateSubPanelAfterNav, 60);
      };
    }
  }


  // ============================================================
  // INITIALIZATION
  // ============================================================

  function init() {
    patchAfterAppLoad();

    // Onboarding disabled - causes full-screen blocking overlay issues
    // if (!localStorage.getItem(ONBOARDING_KEY)) {
    //   setTimeout(showOnboarding, 1000);
    // }

    setTimeout(() => {
      const currentView = window.currentView || 'home';
      for (const [groupId, group] of Object.entries(SUB_PANEL_GROUPS)) {
        if (group.items.some(i => i.view === currentView)) {
          toggleSubPanel(groupId);
          break;
        }
      }
    }, 300);
  }

  // Run after DOM is ready and app.js has loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 200));
  } else {
    setTimeout(init, 200);
  }

})();
