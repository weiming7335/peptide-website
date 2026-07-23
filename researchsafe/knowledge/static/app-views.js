(function trackPartnerRef() {
  try {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) {
      // Store ref code in localStorage for conversion tracking later
      localStorage.setItem('ps-partner-ref', ref);
      localStorage.setItem('ps-partner-ref-time', Date.now().toString());
      // Fire tracking pixel
      fetch('/api/partner/track?ref=' + encodeURIComponent(ref) + '&page=' + encodeURIComponent(window.location.pathname)).catch(() => {});
      // Clean URL (remove ref param without reload)
      const url = new URL(window.location);
      url.searchParams.delete('ref');
      window.history.replaceState({}, '', url);
    }
  } catch(e) { /* silent */ }
})();

// Shared HTML escaper used by detail views and charts.
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}


// ============================================================
// COMPOUND TYPE CLASSIFIER
// Not everything in the library is a peptide - derive a human-readable
// type (Peptide / Supplement / Vitamin / Medication / Hormone) from each
// compound's status, category, name and tags.
// ============================================================
function compoundType(p) {
  if (!p) return { key: 'peptide', label: 'Peptide', icon: 'fa-dna', color: '#6366f1' };
  const status = String(p.status || '').toLowerCase();
  const cat = String(p.category || '').toLowerCase();
  const name = String(p.name || '').toLowerCase();
  const full = String(p.fullName || '').toLowerCase();
  const tags = (Array.isArray(p.tags) ? p.tags : []).join(' ').toLowerCase();
  const nameStr = name + ' ' + full;
  const hay = status + ' ' + cat + ' ' + nameStr + ' ' + tags;

  // Stacks / blends first
  if (/stack|blend/.test(status) || /stack/.test(name)) {
    return { key: 'stack', label: 'Stack', icon: 'fa-layer-group', color: '#8b5cf6' };
  }
  // Vitamins (match on the primary name, not fullName which may list blend ingredients)
  if (/\bvitamin\b|\bbiotin\b|\bniacin\b|\bfolate\b|\bcobalamin\b|methylcobalamin|\bb12\b/.test(name) || /\bvitamin\b/.test(tags)) {
    return { key: 'vitamin', label: 'Vitamin', icon: 'fa-pills', color: '#f59e0b' };
  }
  // Hormones - match the actual hormone substance by primary name, not by category
  // (e.g. the "Growth Hormone" category holds peptides/secretagogues, not hormones).
  if (/testosterone|estradiol|estrogen|\bprogesterone\b|pregnenolone|\bdhea\b|liothyronine|levothyroxine|\bt3\b|\bt4\b|cortisol|\bhcg\b|gonadorelin|oxytocin|melatonin/.test(name)) {
    return { key: 'hormone', label: 'Hormone', icon: 'fa-venus-mars', color: '#ec4899' };
  }
  // Peptides - sequence present, or explicit peptide markers in the name
  if (p.sequence || /peptide/.test(nameStr) || /peptide/.test(tags) || /^[a-z]+-?\d+/.test(name)) {
    return { key: 'peptide', label: 'Peptide', icon: 'fa-dna', color: '#6366f1' };
  }
  // Medications (prescription / FDA-approved drugs, compounded meds)
  if (/medication|prescription|prescribed|fda[- ]approved|fda approved|schedule|off-label|otc \/ medical|medical device/.test(status)) {
    return { key: 'medication', label: 'Medication', icon: 'fa-prescription-bottle-medical', color: '#ef4444' };
  }
  // Supplements (dietary supplements, GRAS, novel food, coenzymes, amino acids)
  if (/supplement|dietary|gras|novel food|nootropic/.test(status) || /supplement|coenzyme|amino acid|antioxidant/.test(hay)) {
    return { key: 'supplement', label: 'Supplement', icon: 'fa-leaf', color: '#10b981' };
  }
  // Default - research compound treated as peptide
  return { key: 'peptide', label: 'Peptide', icon: 'fa-dna', color: '#6366f1' };
}
function compoundTypeBadge(p, opts) {
  const t = compoundType(p);
  const fs = (opts && opts.fontSize) || '10px';
  return '<span class="ct-badge ct-' + t.key + '" style="background:' + t.color + '1f;color:' + t.color + ';border:1px solid ' + t.color + '33;font-size:' + fs + '"><i class="fas ' + t.icon + '"></i>' + t.label + '</span>';
}

// ============================================================
// SUPABASE AUTH SYSTEM
// ============================================================
const SUPABASE_URL = 'https://pqhpgfwhvhezlpqgrxmz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Kjk32AH842stPXmo8eZvOg_09bF1Ek8';
// Supabase JS (supabase.min.js) is loaded deferred, and app-views.js can run
// before it arrives. Capturing the client at module-load time used to leave us
// with a dead no-op stub forever (login silently failed). Instead we resolve
// the real client lazily and load the library on demand if it isn't ready yet.
const _sbClientOpts = {
  auth: {
    detectSessionInUrl: true,
    flowType: 'implicit',
    autoRefreshToken: true,
    persistSession: true,
  }
};
let _sbRealClient = null;

function _createSbClient() {
  if (_sbRealClient) return _sbRealClient;
  if (window.supabase && window.supabase.createClient) {
    _sbRealClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, _sbClientOpts);
    // Wire the auth-state listener onto the freshly created real client.
    if (typeof _registerAuthListener === 'function') _registerAuthListener(_sbRealClient);
  }
  return _sbRealClient;
}

// Loads supabase.min.js if it hasn't loaded yet, then returns a real client.
let _sbLoadPromise = null;
function ensureSupabase() {
  const existing = _createSbClient();
  if (existing) return Promise.resolve(existing);
  if (_sbLoadPromise) return _sbLoadPromise;
  _sbLoadPromise = new Promise((resolve) => {
    const done = () => resolve(_createSbClient());
    // Maybe another loader is already in flight - poll briefly.
    let waited = 0;
    const poll = setInterval(() => {
      if (window.supabase && window.supabase.createClient) {
        clearInterval(poll);
        done();
      } else if ((waited += 100) >= 1500) {
        clearInterval(poll);
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
        s.onload = done;
        s.onerror = () => resolve(null);
        document.body.appendChild(s);
      }
    }, 100);
  });
  return _sbLoadPromise;
}
window.ensureSupabase = ensureSupabase;

// Proxy so existing `sbClient.auth.xxx(...)` call sites keep working: every
// access resolves the real client lazily once supabase-js is available.
const sbClient = new Proxy({}, {
  get(_t, prop) {
    const real = _createSbClient();
    if (real) return real[prop];
    if (prop === 'auth') {
      // Minimal stand-in until the library loads.
      return { onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }) };
    }
    return undefined;
  }
});

function getAccessToken() {
  try {
    const raw = localStorage.getItem('sb-pqhpgfwhvhezlpqgrxmz-auth-token');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.access_token || null;
  } catch { return null; }
}
window.getAccessToken = getAccessToken;

function authHeaders() {
  const token = getAccessToken();
  return token ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}
window.authHeaders = authHeaders;

// checkAuth() removed - onAuthStateChange(INITIAL_SESSION) handles the initial session
// restoration on page load, eliminating the duplicate auth check that caused users
// to see the login state flicker or be prompted to log in twice.

// Single source of truth for all auth state changes
// Handles: initial page load session, email/password login, OAuth login, token refresh, sign out
// _skipNextSignedIn: set by handleAuth() after email/password login so the
// resulting SIGNED_IN event doesn't double-execute the post-login flow.
let _skipNextSignedIn = false;
let _authInitialized = false;
let _authListenerRegistered = false;

// Registers the auth-state handler on whichever real client exists. Called from
// _createSbClient() the moment supabase-js becomes available, so we never miss
// the INITIAL_SESSION event even when the library loads after this script.
function _registerAuthListener(client) {
  if (_authListenerRegistered || !client || !client.auth) return;
  _authListenerRegistered = true;
  client.auth.onAuthStateChange(_onAuthStateChange);
}
window._registerAuthListener = _registerAuthListener;

async function _onAuthStateChange(event, session) {
  console.log('[Auth]', event, session ? session.user?.email : 'no session');

  if (session?.user && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION')) {
    const u = session.user;
    currentUser = {
      id: u.id,
      email: u.email,
      name: u.user_metadata?.full_name || u.user_metadata?.name || '',
      avatar_url: u.user_metadata?.avatar_url || null,
      provider: u.app_metadata?.provider || 'email',
      created_at: u.created_at,
    };
    window.currentUser = currentUser;
    updateAuthUI();

    // Sync user record into D1 on every sign-in / session restore (fire-and-forget)
    if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
      fetch('/api/auth/sync-user', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ email: currentUser.email, name: currentUser.name, provider: currentUser.provider })
      })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (res) {
          // Brand-new account → show the one-time referral welcome popup. The
          // popup itself is also guarded per-user, so OAuth races can't double it.
          if (res && res.isNew && window.__referral && window.__referral.showWelcomePopup) {
            setTimeout(function () { window.__referral.showWelcomePopup(); }, 700);
          }
        })
        .catch(() => {});
    }

    if (event === 'INITIAL_SESSION') {
      if (!_authInitialized) {
        _authInitialized = true;
        // Only navigate if we're genuinely returning from an OAuth redirect.
        // Do NOT use authModal presence as a signal - the modal may be open
        // because the user just clicked "Sign in", not because OAuth redirected.
        const fromOAuth = document.referrer.includes('/auth/callback');
        if (fromOAuth) {
          document.getElementById('authModal')?.remove();
          await syncPull();
          // If they signed up via OAuth mid-"Ask the community", resume that
          // draft (survives the full-page redirect via sessionStorage).
          if (!_resumePendingCompose()) navigate('home');
        } else {
          // Normal page load with existing session - sync silently, stay on page.
          syncPull();
        }
      }

    } else if (event === 'SIGNED_IN') {
      // Fires after email/password login OR OAuth, but ALSO fires on plain
      // session restoration when a logged-in user simply opens/returns to the
      // site (e.g. clicking a deep link). We must NOT redirect to the dashboard
      // in that case - the user should land on the page they navigated to.
      // handleAuth() sets _skipNextSignedIn=true BEFORE the await so it's
      // already true when this fires - meaning handleAuth handles the redirect.
      var hasPendingClone = false;
      try { hasPendingClone = !!sessionStorage.getItem('rs_clone_protocol'); } catch (e) {}
      if (_resumePendingCompose()) {
        // Reader started an "Ask the community" while logged out → resume it
        // (KB→member conversion path). _resumePendingCompose navigated us there.
        _skipNextSignedIn = false;
        syncPull();
      } else if (_skipNextSignedIn) {
        _skipNextSignedIn = false;
        // handleAuth() already handled modal + navigation - but if there's a
        // protocol waiting to be cloned, send them to the calendar to import it.
        if (hasPendingClone) { await syncPull(); navigate('home'); }
      } else if (hasPendingClone) {
        // User signed in specifically to clone a shared protocol.
        document.getElementById('authModal')?.remove();
        await syncPull();
        navigate('home');
      } else {
        // Only redirect when this SIGNED_IN is the result of a genuine OAuth
        // redirect (returning from /auth/callback). Otherwise it's a session
        // restore on normal page load - sync silently and stay on the page.
        const fromOAuth = document.referrer.includes('/auth/callback');
        if (fromOAuth) {
          document.getElementById('authModal')?.remove();
          await syncPull();
          navigate('home');
        } else {
          syncPull();
        }
      }
    }
    // TOKEN_REFRESHED: UI already updated above, no navigation needed.

  } else if (event === 'INITIAL_SESSION' && !session?.user) {
    if (!_authInitialized) {
      _authInitialized = true;
      updateAuthUI();
    }
  } else if (event === 'SIGNED_OUT') {
    currentUser = null;
    window.currentUser = null;
    _cachedRole = null;
    updateAuthUI();
  }
  // Keep the forum's viewer identity in sync so admin-gated controls (Delete,
  // Pin, Lock) appear/disappear the instant auth changes. Only on an actual
  // login/logout TRANSITION - NOT on INITIAL_SESSION (the forum's first render
  // already reflects the initial auth state) or TOKEN_REFRESHED. Re-rendering on
  // INITIAL_SESSION double-renders the forum on every cold load and races the
  // initial feed fetch.
  if ((event === 'SIGNED_IN' || event === 'SIGNED_OUT') && typeof window._forumOnAuth === 'function') {
    try { window._forumOnAuth(); } catch (e) { /* forum not loaded */ }
  }
}

// Kick off the real client now (registers the listener) and guarantee
// supabase-js is loaded so INITIAL_SESSION fires even on a cold start.
ensureSupabase();

// ── Role cache: populated once after login via /api/admin/me ──
let _cachedRole = null; // null = not loaded, {} = loaded (may have no privileges)

async function fetchAndCacheRole() {
  if (!currentUser) { _cachedRole = null; return; }
  try {
    const res = await fetch('/api/admin/me', {
      headers: authHeaders()
    });
    const data = await res.json();
    _cachedRole = {
      isAdmin:      !!(data.isAdmin || data.isSuperAdmin),
      isStaff:      !!(data.isStaff || data.isAdmin || data.isSuperAdmin),
      isInfluencer: !!data.isInfluencer,
      role:         data.role || ''
    };
  } catch(e) {
    _cachedRole = {};
  }
  updateAnalyticsBtn();
}

function _hasAnalyticsAccess() {
  if (!_cachedRole) return false;
  return _cachedRole.isAdmin || _cachedRole.isStaff || _cachedRole.isInfluencer;
}

function updateAnalyticsBtn() { updateRoleNavBtns(); } // alias kept for callers

function updateRoleNavBtns() {
  // Remove any previously injected role elements
  ['analyticsNavBtn','crmNavBtn','roleNavDivider'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.remove();
  });

  // Mobile cleanup
  const existingMobile = document.getElementById('adminBtnMobile');
  if (existingMobile) existingMobile.remove();

  if (!currentUser || !_hasAnalyticsAccess()) return;

  // ── Role-specific colours ──────────────────────────────────
  let accentColor = '#6366f1';
  if (_cachedRole.isAdmin)           accentColor = '#ef4444';
  else if (_cachedRole.isStaff)      accentColor = '#f97316';
  else if (_cachedRole.isInfluencer) accentColor = '#8b5cf6';

  const roleLabel = _cachedRole.isAdmin ? 'Admin' : _cachedRole.isStaff ? 'Staff' : 'Partner';

  // ── Helper: build a sidebar nav button ──────────────────────
  function makeRoleBtn({ id, icon, label, tooltip, onClick }) {
    const btn = document.createElement('button');
    btn.id        = id;
    btn.className = 'nav-btn role-nav-btn';
    btn.setAttribute('data-view', 'admin');
    btn.title     = tooltip;
    btn.style.setProperty('--role-accent', accentColor);
    btn.onclick   = onClick;
    btn.innerHTML = `
      <i class="fas ${icon}" style="color:${accentColor}"></i>
      <span class="nav-label">${label}</span>
      <span class="nav-tooltip">${tooltip}</span>
    `;
    return btn;
  }

  // ── Divider before role section ──────────────────────────────
  const divider = document.createElement('div');
  divider.id = 'roleNavDivider';
  divider.className = 'sidebar-divider';
  divider.style.cssText = `
    width:24px;height:1px;background:${accentColor};opacity:0.25;
    margin:6px auto 2px;border-radius:2px;
  `;

  // ── Analytics button ──────────────────────────────────────
  const analyticsBtn = makeRoleBtn({
    id:      'analyticsNavBtn',
    icon:    'fa-chart-line',
    label:   'Analytics',
    tooltip: 'Analytics Dashboard',
    onClick: () => { window._adminStartTab = 'analytics'; navigate('admin'); },
  });

  // ── CRM button ────────────────────────────────────────────
  const crmBtn = makeRoleBtn({
    id:      'crmNavBtn',
    icon:    'fa-users-gear',
    label:   'CRM',
    tooltip: 'CRM Dashboard',
    onClick: () => { window._adminStartTab = 'crm'; navigate('admin'); },
  });

  // ── Inject into sidebar-nav (main scrollable nav, not bottom) ──
  const sidebarNav = document.querySelector('.sidebar-nav');
  if (sidebarNav) {
    sidebarNav.appendChild(divider);
    sidebarNav.appendChild(analyticsBtn);
    // Only show CRM for admin/staff (not influencer/partner)
    if (_cachedRole.isAdmin || _cachedRole.isStaff) {
      sidebarNav.appendChild(crmBtn);
    }
  }

  // ── Mobile bottom nav ────────────────────────────────────────
  const mobileNav = document.getElementById('mobileNav');
  if (mobileNav) {
    const adminBtnMobile = document.createElement('button');
    adminBtnMobile.id = 'adminBtnMobile';
    adminBtnMobile.className = 'mobile-nav-btn';
    adminBtnMobile.setAttribute('data-view', 'admin');
    adminBtnMobile.innerHTML = `
      <i class="fas fa-chart-line" style="color:${accentColor}"></i>
      <span style="color:${accentColor}">${roleLabel}</span>
    `;
    adminBtnMobile.onclick = () => { window._adminStartTab = 'analytics'; navigate('admin'); };

    const mobileAccountBtn = document.getElementById('accountBtnMobile');
    if (mobileAccountBtn) mobileNav.insertBefore(adminBtnMobile, mobileAccountBtn);
    else mobileNav.appendChild(adminBtnMobile);
  }
}

function updateAuthUI() {
  const accountBtn = document.getElementById('accountBtn');
  const accountBtnMobile = document.getElementById('accountBtnMobile');
  const accountCreateBtn = document.getElementById('accountCreateBtn');
  if (accountBtn) {
    if (currentUser) {
      const initial = (currentUser.name || currentUser.email || '?')[0].toUpperCase();
      const displayName = currentUser.name || (currentUser.email || '').split('@')[0] || 'Account';
      const avatar = currentUser.avatar_url
        ? `<img src="${currentUser.avatar_url}" class="auth-avatar-img" alt="">`
        : `<span class="auth-avatar">${initial}</span>`;
      accountBtn.classList.add('is-account');
      accountBtn.innerHTML = `${avatar}<span class="nav-label">${displayName}</span><span class="nav-tooltip" style="display:none">${currentUser.email || ''}</span>`;
      accountBtn.title = currentUser.email || 'Account';
      accountBtn.setAttribute('data-view', 'account');
      accountBtn.onclick = () => navigate('account');
      if (accountCreateBtn) accountCreateBtn.style.display = 'none';
      if (currentUser && !_cachedRole) fetchAndCacheRole();
    } else {
      accountBtn.classList.remove('is-account');
      accountBtn.innerHTML = `<i class="fas fa-right-to-bracket"></i><span class="nav-label">Sign in</span><span class="nav-tooltip" style="display:none">Sign in</span>`;
      accountBtn.title = 'Sign in';
      accountBtn.removeAttribute('data-view');
      accountBtn.onclick = () => openAuthModal('login');
      if (accountCreateBtn) {
        accountCreateBtn.style.display = '';
        accountCreateBtn.onclick = () => openAuthModal('register');
      }
      _cachedRole = null;
      updateAnalyticsBtn();
      const mobileAdminBtn = document.getElementById('adminBtnMobile');
      if (mobileAdminBtn) mobileAdminBtn.remove();
    }
  }
  if (accountBtnMobile) {
    if (currentUser) {
      if (currentUser.avatar_url) {
        accountBtnMobile.innerHTML = `<img src="${currentUser.avatar_url}" class="auth-avatar-img-sm" alt="">`;
      } else {
        accountBtnMobile.innerHTML = `<span class="auth-avatar-sm">${(currentUser.name || currentUser.email || '?')[0].toUpperCase()}</span>`;
      }
      accountBtnMobile.setAttribute('aria-label', 'Account');
      accountBtnMobile.onclick = () => navigate('account');
    } else {
      accountBtnMobile.innerHTML = '<i class="fas fa-user"></i>';
      accountBtnMobile.setAttribute('aria-label', 'Sign in');
      accountBtnMobile.onclick = () => openAuthModal('login');
    }
  }
}

// ============================================================
// BUG REPORT
// ============================================================
function openBugReport() {
  // Remove any existing modal
  const existing = document.getElementById('bugReportModal');
  if (existing) { existing.remove(); return; }

  const modal = document.createElement('div');
  modal.id = 'bugReportModal';
  modal.innerHTML = `
    <div class="bug-backdrop" onclick="document.getElementById('bugReportModal').remove()"></div>
    <div class="bug-modal">
      <div class="bug-modal-header">
        <div class="bug-modal-icon"><i class="fas fa-bug"></i></div>
        <div>
          <div class="bug-modal-title">Report a Bug</div>
          <div class="bug-modal-sub">Help us improve - all reports are reviewed</div>
        </div>
        <button class="bug-modal-close" onclick="document.getElementById('bugReportModal').remove()">
          <i class="fas fa-times"></i>
        </button>
      </div>

      <div class="bug-modal-body">
        <div class="bug-field">
          <label class="bug-label">What type of issue?</label>
          <div class="bug-type-grid">
            <button class="bug-type-btn" data-type="ui" onclick="selectBugType(this)"><i class="fas fa-palette"></i> UI / Display</button>
            <button class="bug-type-btn" data-type="data" onclick="selectBugType(this)"><i class="fas fa-database"></i> Data / Content</button>
            <button class="bug-type-btn" data-type="feature" onclick="selectBugType(this)"><i class="fas fa-wrench"></i> Feature Broken</button>
            <button class="bug-type-btn" data-type="other" onclick="selectBugType(this)"><i class="fas fa-ellipsis"></i> Other</button>
          </div>
        </div>

        <div class="bug-field">
          <label class="bug-label">Describe the issue <span style="color:#ef4444">*</span></label>
          <textarea id="bugDescription" class="bug-textarea" placeholder="What happened? What did you expect to happen? Which page were you on?" rows="4"></textarea>
        </div>

        <div class="bug-field">
          <label class="bug-label">Steps to reproduce <span style="opacity:.5;font-weight:500">(optional)</span></label>
          <textarea id="bugSteps" class="bug-textarea" placeholder="1. Go to...&#10;2. Click on...&#10;3. See error" rows="3"></textarea>
        </div>

        <div class="bug-field">
          <label class="bug-label">Your email <span style="opacity:.5;font-weight:500">(optional - for follow-up)</span></label>
          <input id="bugEmail" class="bug-input" type="email" placeholder="${currentUser?.email || 'your@email.com'}" value="${currentUser?.email || ''}">
        </div>

        <div id="bugMsg" style="display:none;font-size:12px;padding:10px 14px;border-radius:10px;margin-top:4px"></div>
      </div>

      <div class="bug-modal-footer">
        <div class="bug-footer-note"><i class="fas fa-circle-info" style="margin-right:5px;color:#6366f1"></i>Free Peptide Tools (Beta) - your feedback shapes what we build next</div>
        <div style="display:flex;gap:8px">
          <button class="bug-btn-cancel" onclick="document.getElementById('bugReportModal').remove()">Cancel</button>
          <button class="bug-btn-submit" onclick="submitBugReport()"><i class="fas fa-paper-plane" style="margin-right:6px"></i>Send Report</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  // Animate in
  requestAnimationFrame(() => modal.classList.add('bug-modal-visible'));
  setTimeout(() => document.getElementById('bugDescription')?.focus(), 150);
}

function selectBugType(btn) {
  document.querySelectorAll('.bug-type-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

async function submitBugReport() {
  const desc = document.getElementById('bugDescription')?.value?.trim();
  const steps = document.getElementById('bugSteps')?.value?.trim();
  const email = document.getElementById('bugEmail')?.value?.trim();
  const typeBtn = document.querySelector('.bug-type-btn.active');
  const type = typeBtn?.dataset?.type || 'other';
  const msgEl = document.getElementById('bugMsg');

  if (!desc) {
    if (msgEl) { msgEl.style.display='block'; msgEl.style.background='#fef2f2'; msgEl.style.color='#ef4444'; msgEl.textContent='Please describe the issue before submitting.'; }
    document.getElementById('bugDescription')?.focus();
    return;
  }

  const submitBtn = document.querySelector('.bug-btn-submit');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-right:6px"></i>Sending...'; }

  try {
    // Build report payload
    const payload = {
      type,
      description: desc,
      steps: steps || '',
      email: email || (currentUser?.email || ''),
      page: currentView || 'unknown',
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      userId: currentUser?.id || 'guest',
    };

    // Post to analytics collect endpoint as a bug_report event
    const res = await fetch('/api/analytics/collect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_type: 'bug_report',
        page: '/' + (currentView || ''),
        metadata: JSON.stringify(payload),
        session_id: window._analyticsSession || 'unknown',
      }),
    });

    if (msgEl) {
      msgEl.style.display = 'block';
      msgEl.style.background = '#f0fdf4';
      msgEl.style.color = '#059669';
      msgEl.textContent = '✓ Bug report sent! Thank you - we\'ll look into it.';
    }
    if (submitBtn) { submitBtn.innerHTML = '<i class="fas fa-check" style="margin-right:6px"></i>Sent!'; }
    setTimeout(() => document.getElementById('bugReportModal')?.remove(), 2000);
  } catch (err) {
    if (msgEl) { msgEl.style.display='block'; msgEl.style.background='#fef2f2'; msgEl.style.color='#ef4444'; msgEl.textContent='Failed to send. Please try again.'; }
    if (submitBtn) { submitBtn.disabled=false; submitBtn.innerHTML='<i class="fas fa-paper-plane" style="margin-right:6px"></i>Send Report'; }
  }
}

function openAuthModal(mode, context) {
  const existing = document.getElementById('authModal');
  if (existing) existing.remove();

  // Context-aware titles and subtitles
  let title, subtitle, logoIcon;
  if (context === 'favorite') {
    title = mode === 'login' ? 'Sign in to Save' : 'Create a Free Account';
    subtitle = mode === 'login'
      ? 'Sign in to save favorites and sync across devices'
      : 'Save peptides and videos to your personal favorites list';
    logoIcon = 'fa-star';
  } else if (context === 'ai-limit' || context === 'ai-meter') {
    title = mode === 'login' ? 'Sign in to Keep Chatting' : 'Create a Free Account';
    subtitle = mode === 'login'
      ? 'Sign in to keep using ResearchSafe AI - 50 messages/day, free.'
      : "You've used your 20 free preview messages. Create a free account for 50 AI messages/day.";
    logoIcon = 'fa-robot';
  } else {
    title = mode === 'login' ? 'Welcome Back' : 'Create Account';
    subtitle = mode === 'login' ? 'Sign in to sync your data across devices' : 'Save your data in the cloud and access it anywhere';
    logoIcon = 'fa-shield-halved';
  }

  const modal = document.createElement('div');
  modal.id = 'authModal';
  modal.className = 'auth-modal-overlay';
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  modal.innerHTML = `
    <div class="auth-modal">
      <button class="auth-modal-close" onclick="document.getElementById('authModal').remove()"><i class="fas fa-times"></i></button>
      <div class="auth-modal-logo"><i class="fas ${logoIcon}"></i></div>
      <h2 class="auth-modal-title" id="authTitle">${title}</h2>
      <p class="auth-modal-subtitle" id="authSubtitle">${subtitle}</p>

      <div class="auth-tabs" role="tablist">
        <button type="button" class="auth-tab${mode === 'login' ? ' active' : ''}" onclick="document.getElementById('authModal').remove(); openAuthModal('login', '${context || ''}')">Sign in</button>
        <button type="button" class="auth-tab${mode === 'register' ? ' active' : ''}" onclick="document.getElementById('authModal').remove(); openAuthModal('register', '${context || ''}')">Create account</button>
      </div>
      
      <!-- Social Login Buttons -->
      <div class="auth-social-buttons">
        <button class="auth-social-btn auth-google-btn" onclick="signInWithGoogle()">
          <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
          Continue with Google
        </button>

      </div>
      
      <div class="auth-divider">
        <span>or</span>
      </div>

      <div id="authError" class="auth-error" style="display:none"></div>
      <form id="authForm" onsubmit="handleAuth(event)">
        <input type="hidden" id="authMode" value="${mode}">
        <div id="authNameField" style="display:${mode === 'register' ? 'block' : 'none'}">
          <label class="auth-label">Name</label>
          <input class="auth-input" type="text" id="authName" placeholder="Your name (optional)" autocomplete="name">
        </div>
        <div>
          <label class="auth-label">Email</label>
          <input class="auth-input" type="email" id="authEmail" placeholder="you@example.com" required autocomplete="email">
        </div>
        <div>
          <label class="auth-label">Password</label>
          <input class="auth-input" type="password" id="authPassword" placeholder="${mode === 'register' ? 'Minimum 6 characters' : 'Your password'}" required autocomplete="${mode === 'register' ? 'new-password' : 'current-password'}" minlength="6">
        </div>
        <button class="auth-submit" type="submit" id="authSubmitBtn">
          <span id="authSubmitText">${mode === 'login' ? 'Sign In' : 'Create Account'}</span>
        </button>
      </form>
      <div class="auth-switch">
        ${mode === 'login'
          ? `Don't have an account? <a href="#" onclick="event.preventDefault(); document.getElementById('authModal').remove(); openAuthModal('register', '${context || ''}')">Sign up</a>`
          : `Already have an account? <a href="#" onclick="event.preventDefault(); document.getElementById('authModal').remove(); openAuthModal('login', '${context || ''}')">Sign in</a>`
        }
      </div>
      <div class="auth-privacy">
        ${mode === 'register'
          ? 'By creating an account you agree to our <a href="#" onclick="event.preventDefault(); document.getElementById(\'authModal\').remove(); navigate(\'privacy\')">Privacy Policy</a> and consent to anonymized usage analytics as described therein.'
          : 'By signing in you agree to our <a href="#" onclick="event.preventDefault(); document.getElementById(\'authModal\').remove(); navigate(\'privacy\')">Privacy Policy</a>.'
        }
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  setTimeout(() => document.getElementById('authEmail')?.focus(), 100);
}

async function signInWithGoogle() {
  await ensureSupabase();
  // Redirect to /auth/callback - a lightweight page that handles
  // token extraction without triggering Cloudflare WAF/bot rules
  const callbackUrl = window.location.origin + '/auth/callback';
  console.log('[Auth] Starting Google OAuth, redirectTo:', callbackUrl);
  const { error } = await sbClient.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: callbackUrl,
    },
  });
  if (error) {
    const errEl = document.getElementById('authError');
    if (errEl) { errEl.textContent = error.message || 'Google sign-in failed'; errEl.style.display = 'block'; }
  }
}



async function handleAuth(e) {
  e.preventDefault();
  const mode = document.getElementById('authMode').value;
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  const name = document.getElementById('authName')?.value?.trim() || '';
  const errorEl = document.getElementById('authError');
  const btn = document.getElementById('authSubmitBtn');
  const btnText = document.getElementById('authSubmitText');

  errorEl.style.display = 'none';
  btn.disabled = true;
  btnText.textContent = mode === 'login' ? 'Signing in...' : 'Creating account...';

  try {
    const sb = await ensureSupabase();
    if (!sb || !sb.auth) {
      errorEl.textContent = 'Authentication service failed to load. Please refresh and try again.';
      errorEl.style.display = 'block';
      btn.disabled = false;
      btnText.textContent = mode === 'login' ? 'Sign In' : 'Create Account';
      return;
    }
    let result;
    if (mode === 'login') {
      // Set flag BEFORE the await so it's already true when SIGNED_IN fires
      // synchronously inside signInWithPassword.
      _skipNextSignedIn = true;
      result = await sb.auth.signInWithPassword({ email, password });
    } else {
      result = await sb.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } },
      });
    }

    if (result.error) {
      _skipNextSignedIn = false; // reset on error
      errorEl.textContent = result.error.message;
      errorEl.style.display = 'block';
      btn.disabled = false;
      btnText.textContent = mode === 'login' ? 'Sign In' : 'Create Account';
      return;
    }

    const u = result.data?.user;
    const session = result.data?.session;

    btn.disabled = false;
    btnText.textContent = mode === 'login' ? 'Sign In' : 'Create Account';

    if (u && session) {
      // Logged in - set currentUser, close modal, go to dashboard immediately.
      // syncPull runs in background (no await) so it doesn't delay navigation.
      // On sign-up: record analytics consent (agreed via Privacy Policy on form).
      if (mode === 'register') {
        localStorage.setItem('ps_consent', 'all');
      }
      currentUser = {
        id: u.id,
        email: u.email,
        name: u.user_metadata?.full_name || u.user_metadata?.name || name || '',
        avatar_url: u.user_metadata?.avatar_url || null,
        provider: u.app_metadata?.provider || 'email',
        created_at: u.created_at,
      };
      window.currentUser = currentUser;
      updateAuthUI();
      document.getElementById('authModal')?.remove();
      navigate('home');
      syncPull(); // background, no await
    } else if (u && !session && mode === 'login') {
      _skipNextSignedIn = false;
      errorEl.style.color = '#f97316';
      errorEl.style.display = 'block';
      errorEl.textContent = '⚠️ Please confirm your email address before signing in. Check your inbox.';
    } else if (u && !session && mode === 'register') {
      errorEl.style.color = '#10b981';
      errorEl.style.display = 'block';
      errorEl.textContent = '✅ Account created! Check your email to confirm, then sign in.';
    }
  } catch (err) {
    _skipNextSignedIn = false;
    errorEl.textContent = 'Network error. Please try again.';
    errorEl.style.display = 'block';
    btn.disabled = false;
    btnText.textContent = mode === 'login' ? 'Sign In' : 'Create Account';
  }
}

async function logout() {
  try {
    const sb = await ensureSupabase();
    if (sb && sb.auth) await sb.auth.signOut();
  } catch {}
  currentUser = null;
  window.currentUser = null;
  updateAuthUI();
  navigate('home');
}

// ============================================================
// DATA SYNC (localStorage <-> Cloud D1)
// ============================================================
const SYNC_KEYS = [
  'peptideai_favorites',
  'peptideai_video_favorites',
  'peptideai_regimen',
  'peptideai_doselog',
  'peptideai_journal',
  'peptideai_bloodwork',
  'peptideai_builder_stack',
  'peptideai_vials',
  'peptideai_inventory',
  'peptideai_achievements',
];

async function syncPush() {
  if (!currentUser) return;
  try {
    const data = {};
    SYNC_KEYS.forEach(key => {
      const val = localStorage.getItem(key);
      if (val) { try { data[key] = JSON.parse(val); } catch { data[key] = val; } }
    });
    if (Object.keys(data).length === 0) return;
    await fetch('/api/sync/push', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ data }),
    });
  } catch (err) { console.error('Sync push failed:', err); }
}

async function syncPull() {
  if (!currentUser) return;
  try {
    const res = await fetch('/api/sync/pull', { headers: authHeaders() });
    const result = await res.json();
    if (result.success && result.data) {
      for (const [key, value] of Object.entries(result.data)) {
        if (SYNC_KEYS.includes(key)) {
          localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
        }
      }
    }
  } catch (err) { console.error('Sync pull failed:', err); }
}

// Auto-sync on data changes (debounced)
let syncTimer = null;
function scheduleSyncPush() {
  if (!currentUser) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => syncPush(), 5000);
}

// ============================================================
// ACCOUNT SETTINGS PAGE
// ============================================================
async function renderAccount(el) {
  if (!currentUser) { navigate('home'); return; }

  const isOAuth = currentUser.provider && currentUser.provider !== 'email';
  const providerLabel = currentUser.provider === 'google'
    ? '<i class="fab fa-google" style="color:#4285F4;margin-right:5px"></i>Google'
    : currentUser.provider === 'apple'
      ? '<i class="fab fa-apple" style="margin-right:5px"></i>Apple'
      : '<i class="fas fa-envelope" style="margin-right:5px"></i>Email / Password';

  // Re-use cached role from updateAuthUI; fetch if not yet loaded
  if (!_cachedRole) await fetchAndCacheRole();
  const isAdmin = !!(_cachedRole?.isAdmin || _cachedRole?.isStaff);
  const isInfluencer = !!_cachedRole?.isInfluencer;
  const hasAnyAccess = isAdmin || isInfluencer;

  // Gather quick stats
  const stats = getProgressStats();
  const { totalXP, level, xpInLevel, xpNeeded, progress } = getXPAndLevel();
  const levelTitle = getLevelTitle(level);
  const doseLog = getDoseLog();
  const journal = getJournal();
  const regimen = getRegimen();
  const memberSince = new Date(currentUser.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const initials = (currentUser.name || currentUser.email || '?').slice(0,2).toUpperCase();

  el.innerHTML = `
    <div class="acct-view">

      <!-- PAGE HERO -->
      <div class="page-hero page-hero-indigo" style="margin-bottom:20px">
        <div class="page-hero-bg">
          <div class="ph-orb ph-orb1" style="background:radial-gradient(circle,rgba(99,102,241,.35),rgba(79,70,229,.1))"></div>
          <div class="ph-orb ph-orb2" style="background:radial-gradient(circle,rgba(79,70,229,.25),rgba(139,92,246,.1))"></div>
          <div class="ph-orb ph-orb3" style="background:radial-gradient(circle,rgba(139,92,246,.2),rgba(99,102,241,.1))"></div>
          <div class="ph-grid"></div>
        </div>
        <div class="page-hero-body">
          <div class="ph-icon" style="background:rgba(99,102,241,.2);border-color:rgba(99,102,241,.3);color:#818cf8"><i class="fas fa-user-circle"></i></div>
          <div class="ph-text">
            <h1 class="ph-title">My Account</h1>
            <p class="ph-sub">Manage your profile, sync data, and access your personal dashboard.</p>
          </div>
          <div class="ph-stats">
            <div class="ph-stat"><div class="ph-stat-n">${level}</div><div class="ph-stat-l">Level</div></div>
            <div class="ph-stat"><div class="ph-stat-n">${totalXP}</div><div class="ph-stat-l">Total XP</div></div>
            <div class="ph-stat"><div class="ph-stat-n">${doseLog.length}</div><div class="ph-stat-l">Doses Logged</div></div>
          </div>
        </div>
      </div>

    <div class="acct-layout">

      <!-- ═══════════════ LEFT SIDEBAR ═══════════════ -->
      <aside class="acct-sidebar">

        <!-- Profile card -->
        <div class="acct-profile-card">
          <div class="acct-profile-banner"></div>
          <div class="acct-profile-body">
            <div class="acct-avatar-wrap">
              ${currentUser.avatar_url
                ? `<img src="${esc(currentUser.avatar_url)}" class="acct-avatar-img" alt="">`
                : `<div class="acct-avatar-initials">${initials}</div>`}
              <div class="acct-avatar-ring"></div>
            </div>
            <div class="acct-profile-name">${currentUser.name ? esc(currentUser.name) : esc(currentUser.email.split('@')[0])}</div>
            <div class="acct-profile-email">${esc(currentUser.email)}</div>
            <div class="acct-profile-meta">
              <span class="acct-meta-chip">${providerLabel}</span>
              <span class="acct-meta-chip"><i class="fas fa-calendar-alt" style="margin-right:4px;opacity:.6"></i>${memberSince}</span>
            </div>
          </div>
        </div>

        <!-- Level / XP card -->
        <div class="acct-xp-card">
          <div class="acct-xp-top">
            <div>
              <div class="acct-xp-level">Level ${level}</div>
              <div class="acct-xp-title">${levelTitle}</div>
            </div>
            <div class="acct-xp-badge"><i class="fas fa-trophy"></i></div>
          </div>
          <div class="acct-xp-bar-wrap">
            <div class="acct-xp-bar-fill" style="width:${progress}%"></div>
          </div>
          <div class="acct-xp-label">${xpInLevel} / ${xpNeeded} XP to Level ${level + 1}</div>
        </div>

        <!-- Quick stats -->
        <div class="acct-stats-grid">
          <div class="acct-stat">
            <div class="acct-stat-val">${doseLog.length}</div>
            <div class="acct-stat-key">Doses Logged</div>
          </div>
          <div class="acct-stat">
            <div class="acct-stat-val">${journal.length}</div>
            <div class="acct-stat-key">Journal Entries</div>
          </div>
          <div class="acct-stat">
            <div class="acct-stat-val">${regimen.length}</div>
            <div class="acct-stat-key">Active Peptides</div>
          </div>
          <div class="acct-stat">
            <div class="acct-stat-val">${stats.doseStreak || 0}</div>
            <div class="acct-stat-key">Day Streak</div>
          </div>
        </div>

        <!-- Quick nav links -->
        <div class="acct-quick-nav">
          <button class="acct-qnav-btn" onclick="navigate('home')"><i class="fas fa-book-open"></i><span>Knowledge base</span></button>
          <button class="acct-qnav-btn" onclick="navigate('community')"><i class="fas fa-comments"></i><span>Forum</span></button>
          <button class="acct-qnav-btn" onclick="navigate('favorites')"><i class="fas fa-heart"></i><span>Favorites</span></button>
          <button class="acct-qnav-btn" onclick="navigate('calculator')"><i class="fas fa-calculator"></i><span>Calculator</span></button>
        </div>

      </aside>

      <!-- ═══════════════ MAIN CONTENT ═══════════════ -->
      <main class="acct-main">

        <!-- Forum username -->
        <div class="acct-card">
          <div class="acct-card-header">
            <div class="acct-card-icon" style="background:#eef2ff;color:#6366f1"><i class="fas fa-at"></i></div>
            <div>
              <div class="acct-card-title">Forum Username</div>
              <div class="acct-card-desc">Your public handle in the community. Changing it renames all your past posts and comments too.</div>
            </div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
            <input id="acctUsername" class="auth-input" maxlength="20" placeholder="loading…" style="flex:1;min-width:180px" disabled>
            <button id="acctUsernameSave" class="acct-btn-secondary" disabled><i class="fas fa-check" style="margin-right:5px"></i>Save</button>
          </div>
          <div id="acctUsernameMsg" style="font-size:12px;margin-top:8px;color:var(--text-muted)">3-20 characters (letters, numbers, - or _). One change per 14 days.</div>
        </div>

        <!-- Country -->
        <div class="acct-card">
          <div class="acct-card-header">
            <div class="acct-card-icon" style="background:#ecfeff;color:#0891b2"><i class="fas fa-earth-americas"></i></div>
            <div>
              <div class="acct-card-title">Country</div>
              <div class="acct-card-desc">Shows a flag next to your username so the community sees where researchers are from.</div>
            </div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
            <select id="acctCountry" class="auth-input acct-select" style="flex:1;min-width:200px" disabled><option>loading…</option></select>
            <button id="acctCountrySave" class="acct-btn-secondary" disabled><i class="fas fa-check" style="margin-right:5px"></i>Save</button>
          </div>
          <div id="acctCountryMsg" style="font-size:12px;margin-top:8px;color:var(--text-muted)"></div>
        </div>

        <!-- About me / bio -->
        <div class="acct-card">
          <div class="acct-card-header">
            <div class="acct-card-icon" style="background:#fdf4ff;color:#c026d3"><i class="fas fa-address-card"></i></div>
            <div>
              <div class="acct-card-title">About You</div>
              <div class="acct-card-desc">A short description shown on your public profile. Tell the community who you are.</div>
            </div>
          </div>
          <textarea id="acctBio" class="auth-input" rows="3" maxlength="300" placeholder="e.g. Nurse in Toronto, into recovery peptides after a running injury. Always chasing better sleep." style="width:100%;resize:vertical" disabled></textarea>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px">
            <span id="acctBioCount" style="font-size:12px;color:var(--text-muted)">0 / 300</span>
            <button id="acctBioSave" class="acct-btn-secondary" disabled><i class="fas fa-check" style="margin-right:5px"></i>Save</button>
          </div>
          <div id="acctBioMsg" style="font-size:12px;margin-top:6px;color:var(--text-muted)"></div>
        </div>

        <!-- Research Profile -->
        <div class="acct-card">
          <div class="acct-card-header">
            <div class="acct-card-icon" style="background:#f5f3ff;color:#8b5cf6"><i class="fas fa-user-graduate"></i></div>
            <div>
              <div class="acct-card-title">Research Profile</div>
              <div class="acct-card-desc">Optional - helps us improve the platform. Never shared individually.</div>
            </div>
          </div>
          <div id="researchProfileForm" class="acct-form-grid">
            <label class="acct-label">Your Role
              <select id="profileRole" class="auth-input acct-select">
                <option value="">Select...</option>
                <option value="researcher">Researcher / Scientist</option>
                <option value="biohacker">Biohacker / Self-experimenter</option>
                <option value="athlete">Athlete / Fitness</option>
                <option value="clinician">Clinician / Healthcare Pro</option>
                <option value="coach">Coach / Trainer</option>
                <option value="student">Student</option>
                <option value="curious">Just Curious</option>
              </select>
            </label>
            <label class="acct-label">Research Purpose
              <select id="profilePurpose" class="auth-input acct-select">
                <option value="">Select...</option>
                <option value="personal">Personal Research</option>
                <option value="academic">Academic / University</option>
                <option value="clinical">Clinical / Medical</option>
                <option value="coaching">Coaching / Client Support</option>
                <option value="commercial">Commercial / Industry</option>
              </select>
            </label>
            <label class="acct-label">Experience Level
              <select id="profileExperience" class="auth-input acct-select">
                <option value="">Select...</option>
                <option value="beginner">Beginner (just starting)</option>
                <option value="intermediate">Intermediate (some knowledge)</option>
                <option value="advanced">Advanced (experienced user)</option>
                <option value="expert">Expert (professional/researcher)</option>
              </select>
            </label>
            <label class="acct-label">Age Range
              <select id="profileAge" class="auth-input acct-select">
                <option value="">Prefer not to say</option>
                <option value="18-24">18-24</option>
                <option value="25-34">25-34</option>
                <option value="35-44">35-44</option>
                <option value="45-54">45-54</option>
                <option value="55-64">55-64</option>
                <option value="65+">65+</option>
              </select>
            </label>
            <label class="acct-checkbox-label">
              <input type="checkbox" id="profileNewsletter" class="acct-checkbox">
              <span>Receive peptide research updates via email</span>
            </label>
            <label class="acct-checkbox-label">
              <input type="checkbox" id="profileDataSharing" class="acct-checkbox">
              <span>Allow anonymized data use in market trend reports</span>
            </label>
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
              <button class="acct-btn-primary" onclick="saveResearchProfile()"><i class="fas fa-save" style="margin-right:6px"></i>Save Profile</button>
              <div id="profileMsg" style="font-size:12px;display:none"></div>
            </div>
          </div>
        </div>

        <!-- Data Sync -->
        <div class="acct-card">
          <div class="acct-card-header">
            <div class="acct-card-icon" style="background:#f0fdf4;color:#10b981"><i class="fas fa-cloud"></i></div>
            <div>
              <div class="acct-card-title">Data Sync</div>
              <div class="acct-card-desc">Your data auto-syncs to the cloud. Use manual sync if needed.</div>
            </div>
          </div>
          <div class="acct-btn-row">
            <button class="acct-btn-secondary" onclick="syncPush().then(()=>alert('Data pushed to cloud!'))">
              <i class="fas fa-cloud-arrow-up"></i> Push to Cloud
            </button>
            <button class="acct-btn-secondary" onclick="syncPull().then(()=>{ alert('Data pulled from cloud!'); navigate('account'); })">
              <i class="fas fa-cloud-arrow-down"></i> Pull from Cloud
            </button>
          </div>
        </div>

        <!-- Inbox (hidden until messages exist) -->
        <div class="acct-card" id="accountInboxSection" style="display:none">
          <div class="acct-card-header">
            <div class="acct-card-icon" style="background:#eff6ff;color:#3b82f6"><i class="fas fa-envelope"></i></div>
            <div>
              <div class="acct-card-title">Inbox <span id="inboxBadge" style="display:none;background:#ef4444;color:#fff;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;margin-left:6px"></span></div>
              <div class="acct-card-desc">Messages from your partner representative.</div>
            </div>
          </div>
          <div id="inboxContainer">
            <div style="text-align:center;padding:20px"><i class="fas fa-spinner fa-spin" style="color:var(--text-muted)"></i></div>
          </div>
        </div>

        <!-- Privacy & History -->
        <div class="acct-card">
          <div class="acct-card-header">
            <div class="acct-card-icon" style="background:#fffbeb;color:#f59e0b"><i class="fas fa-shield-halved"></i></div>
            <div>
              <div class="acct-card-title">Privacy & History</div>
              <div class="acct-card-desc">Manage your search history and analytics preferences.</div>
            </div>
          </div>
          <div class="acct-btn-row">
            <button class="acct-btn-secondary" onclick="clearSearchHistory()">
              <i class="fas fa-eraser"></i> Clear Search History
            </button>
            <button class="acct-btn-secondary" onclick="resetAnalyticsConsent()">
              <i class="fas fa-cookie-bite"></i> Reset Analytics Consent
            </button>
          </div>
        </div>

        ${!isOAuth ? `
        <!-- Change Password -->
        <div class="acct-card">
          <div class="acct-card-header">
            <div class="acct-card-icon" style="background:#fffbeb;color:#f59e0b"><i class="fas fa-key"></i></div>
            <div>
              <div class="acct-card-title">Change Password</div>
              <div class="acct-card-desc">Update your email / password login credentials.</div>
            </div>
          </div>
          <div id="pwChangeForm" style="display:grid;gap:10px;max-width:320px">
            <input class="auth-input" type="password" id="newPw" placeholder="New password (min 6 chars)">
            <button class="acct-btn-primary" onclick="changePassword()"><i class="fas fa-check" style="margin-right:6px"></i>Update Password</button>
            <div id="pwChangeMsg" style="font-size:12px;display:none"></div>
          </div>
        </div>` : ''}

        ${hasAnyAccess ? `
        <!-- Admin/Partner Dashboard link -->
        <div class="acct-card">
          <div class="acct-card-header">
            <div class="acct-card-icon" style="background:${isAdmin ? '#f0fdf4' : '#f5f3ff'};color:${isAdmin ? '#10b981' : '#8b5cf6'}"><i class="fas fa-chart-line"></i></div>
            <div>
              <div class="acct-card-title">${isAdmin ? 'Admin Dashboard' : 'Partner Dashboard'}</div>
              <div class="acct-card-desc">${isAdmin ? 'Analytics, CRM, user management, and market intelligence.' : 'Your analytics, CRM, and partner stats.'}</div>
            </div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="acct-btn-primary" onclick="navigate('admin')"><i class="fas fa-chart-bar" style="margin-right:6px"></i>Open Dashboard</button>
            ${isAdmin ? `<button class="acct-btn-secondary" onclick="window._adminStartTab='crm';navigate('admin')"><i class="fas fa-users-gear" style="margin-right:6px"></i>CRM</button>` : ''}
          </div>
        </div>` : ''}

        <!-- Sign Out + Delete row -->
        <div class="acct-danger-row">
          <div class="acct-card acct-card-signout">
            <div class="acct-card-header">
              <div class="acct-card-icon" style="background:#f9fafb;color:#6b7280"><i class="fas fa-sign-out-alt"></i></div>
              <div>
                <div class="acct-card-title">Sign Out</div>
                <div class="acct-card-desc">Your local data stays on this device.</div>
              </div>
            </div>
            <button class="acct-btn-secondary" onclick="logout()"><i class="fas fa-sign-out-alt"></i> Sign Out</button>
          </div>
          <div class="acct-card acct-card-delete">
            <div class="acct-card-header">
              <div class="acct-card-icon" style="background:#fef2f2;color:#ef4444"><i class="fas fa-trash-alt"></i></div>
              <div>
                <div class="acct-card-title">Delete Account</div>
                <div class="acct-card-desc">Permanently removes all cloud data.</div>
              </div>
            </div>
            <button class="acct-btn-danger" onclick="deleteAccount()"><i class="fas fa-trash-alt"></i> Delete Account</button>
          </div>
        </div>

        <!-- Admin Setup (hidden by default, shown via URL hash or for known admins) -->
        <div id="adminSetupSection" style="display:none">
          <div class="acct-card" style="border:1px solid rgba(239,68,68,.2);background:rgba(239,68,68,.03)">
            <div class="acct-card-header">
              <div class="acct-card-icon" style="background:#fef2f2;color:#ef4444"><i class="fas fa-shield-halved"></i></div>
              <div>
                <div class="acct-card-title">Admin Setup</div>
                <div class="acct-card-desc">Claim admin access with your bootstrap secret. Your UID: <code id="adminSetupUid" style="font-size:11px;background:rgba(0,0,0,.06);padding:2px 6px;border-radius:4px"></code></div>
              </div>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
              <input type="password" id="bootstrapSecretInput" placeholder="Bootstrap secret key" class="auth-input" style="flex:1;min-width:200px;max-width:340px">
              <button class="acct-btn-primary" onclick="claimAdmin()" style="background:#ef4444;border-color:#ef4444"><i class="fas fa-key" style="margin-right:6px"></i>Claim Admin</button>
            </div>
            <div id="bootstrapMsg" style="font-size:12px;margin-top:8px;display:none"></div>
          </div>
        </div>

        <div class="disclaimer" style="margin-top:8px"><i class="fas fa-info-circle" style="margin-right:4px"></i>
          Data on Cloudflare's global edge.
          <a href="#" onclick="event.preventDefault();navigate('privacy')" style="color:var(--teal);text-decoration:underline">Privacy</a> ·
          <a href="#" onclick="event.preventDefault();navigate('terms')" style="color:var(--teal);text-decoration:underline">Terms</a>
        </div>
      </main>

    </div>
    </div>
  `;
  loadResearchProfile();
  loadUserInbox();
  bindUsernameCard();
  bindCountryCard();
  bindBioCard();

  // Show admin setup if URL contains ?admin-setup or #admin-setup
  const showSetup = location.search.includes('admin-setup') || location.hash.includes('admin-setup');
  if (showSetup && currentUser) {
    const section = document.getElementById('adminSetupSection');
    const uidEl = document.getElementById('adminSetupUid');
    if (section) section.style.display = 'block';
    if (uidEl) uidEl.textContent = currentUser.id || 'not found';
  }
}

async function claimAdmin() {
  const secretInput = document.getElementById('bootstrapSecretInput');
  const msgEl = document.getElementById('bootstrapMsg');
  const secret = secretInput?.value?.trim();
  if (!secret) { if (msgEl) { msgEl.style.display='block'; msgEl.style.color='#ef4444'; msgEl.textContent='Enter the bootstrap secret key.'; } return; }
  if (!currentUser) { if (msgEl) { msgEl.style.display='block'; msgEl.style.color='#ef4444'; msgEl.textContent='Not logged in.'; } return; }
  try {
    const res = await fetch('/api/admin/bootstrap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid: currentUser.id, email: currentUser.email, secret })
    });
    const data = await res.json();
    if (msgEl) {
      msgEl.style.display = 'block';
      if (data.success) {
        msgEl.style.color = '#10b981';
        msgEl.textContent = '✅ Admin access granted! Refreshing...';
        _cachedRole = null;
        setTimeout(() => { fetchAndCacheRole().then(() => navigate('account')); }, 1200);
      } else {
        msgEl.style.color = '#ef4444';
        msgEl.textContent = '❌ ' + (data.error || 'Failed');
      }
    }
  } catch(e) {
    if (msgEl) { msgEl.style.display='block'; msgEl.style.color='#ef4444'; msgEl.textContent='Error: '+e.message; }
  }
}

// ── User Inbox (messages from partner reps) ──
async function loadUserInbox() {
  if (!currentUser?.email) return;
  try {
    const res = await fetch('/api/user/messages', {
      headers: { 'X-Admin-Email': currentUser.email }
    });
    const data = await res.json();
    const convs = data.conversations || [];
    const totalUnread = data.totalUnread || 0;

    const section = document.getElementById('accountInboxSection');
    const container = document.getElementById('inboxContainer');
    const badge = document.getElementById('inboxBadge');
    if (!section || !container) return;

    // Only show if user has messages
    if (convs.length === 0) { section.style.display = 'none'; return; }
    section.style.display = 'block';

    if (totalUnread > 0 && badge) {
      badge.textContent = totalUnread;
      badge.style.display = 'inline';
    }

    container.innerHTML = convs.map(c => {
      const unread = c.customer_unread || 0;
      return `
        <div onclick="openUserConversation(${c.id})" style="display:flex;align-items:center;gap:12px;padding:12px;border-radius:10px;border:1px solid ${unread ? '#bfdbfe' : 'var(--border)'};background:${unread ? '#eff6ff' : 'transparent'};cursor:pointer;margin-bottom:8px;transition:all .15s" onmouseover="this.style.borderColor='var(--teal)'" onmouseout="this.style.borderColor='${unread ? '#bfdbfe' : 'var(--border)'}'">
          <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,var(--teal),#0d9488);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:13px;flex-shrink:0">
            ${(c.partner_name || '?')[0].toUpperCase()}
          </div>
          <div style="flex:1;min-width:0">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <strong style="font-size:13px;color:var(--text)">${esc(c.partner_name || 'Your Rep')}</strong>
              <span style="font-size:10px;color:var(--text-muted)">${timeAgoShort(c.last_message_at)}</span>
            </div>
            ${c.subject ? `<div style="font-size:11px;font-weight:600;color:var(--teal);margin:2px 0">${esc(c.subject)}</div>` : ''}
            <div style="font-size:12px;color:var(--text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(c.last_message_preview || '')}</div>
          </div>
          ${unread ? `<span style="background:#ef4444;color:#fff;padding:2px 7px;border-radius:10px;font-size:10px;font-weight:700;flex-shrink:0">${unread}</span>` : ''}
        </div>`;
    }).join('');
  } catch(e) {
    console.error('Inbox load error:', e);
  }
}

function timeAgoShort(d) {
  if (!d) return '';
  const s = Math.floor((Date.now() - new Date(d + (d.includes('Z') ? '' : 'Z')).getTime()) / 1000);
  if (s < 60) return 'now';
  if (s < 3600) return Math.floor(s/60) + 'm';
  if (s < 86400) return Math.floor(s/3600) + 'h';
  if (s < 604800) return Math.floor(s/86400) + 'd';
  return new Date(d).toLocaleDateString();
}

async function openUserConversation(convId) {
  if (!currentUser?.email) return;
  try {
    const res = await fetch(`/api/user/messages/${convId}`, {
      headers: { 'X-Admin-Email': currentUser.email }
    });
    const data = await res.json();
    const conv = data.conversation;
    const msgs = data.messages || [];

    // Create modal
    let modal = document.getElementById('userMsgModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'userMsgModal';
      document.body.appendChild(modal);
    }
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px';
    modal.innerHTML = `
      <div style="background:var(--bg-card,#fff);border-radius:16px;width:100%;max-width:550px;max-height:85vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.3)">
        <div style="padding:14px 20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
          <div>
            <h3 style="font-size:15px;font-weight:700;margin:0;color:var(--text)">${esc(conv.partner_name || 'Your Rep')}</h3>
            ${conv.subject ? `<p style="font-size:12px;color:var(--teal);margin:2px 0 0;font-weight:500">${esc(conv.subject)}</p>` : ''}
          </div>
          <button onclick="document.getElementById('userMsgModal').style.display='none'" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text-muted)">&times;</button>
        </div>
        <div id="userMsgBody" style="flex:1;overflow-y:auto;padding:16px 20px;display:flex;flex-direction:column;gap:8px;max-height:50vh">
          ${msgs.length ? msgs.map(m => {
            const isMine = m.sender_type === 'customer';
            return `
              <div style="display:flex;${isMine ? 'justify-content:flex-end' : 'justify-content:flex-start'}">
                <div style="max-width:80%;padding:10px 14px;border-radius:${isMine ? '14px 14px 4px 14px' : '14px 14px 14px 4px'};background:${isMine ? 'linear-gradient(135deg,var(--teal),#0d9488)' : '#f1f5f9'};color:${isMine ? '#fff' : 'var(--text)'};font-size:13px;line-height:1.5">
                  <div>${esc(m.message)}</div>
                  ${m.attached_peptide_name ? `<div style="margin-top:6px;padding:6px 10px;border-radius:8px;background:${isMine ? 'rgba(255,255,255,0.15)' : '#dbeafe'};font-size:11px;cursor:pointer" onclick="event.stopPropagation();document.getElementById('userMsgModal').style.display='none';navigate('peptide-detail',{id:'${esc(m.attached_peptide_id)}'})"><i class="fas fa-pills" style="margin-right:4px"></i>${esc(m.attached_peptide_name)}</div>` : ''}
                  <div style="font-size:10px;opacity:0.65;margin-top:4px;text-align:${isMine ? 'right' : 'left'}">${timeAgoShort(m.created_at)}</div>
                </div>
              </div>`;
          }).join('') : '<div style="text-align:center;padding:30px;color:var(--text-muted);font-size:13px">No messages yet</div>'}
        </div>
        <div style="padding:12px 20px;border-top:1px solid var(--border);display:flex;gap:8px;align-items:flex-end">
          <textarea id="userReplyInput" placeholder="Type your reply..." style="flex:1;resize:none;border:1px solid var(--border);border-radius:10px;padding:10px 12px;font-size:13px;font-family:inherit;min-height:40px;max-height:100px;background:var(--bg);color:var(--text)" rows="1" oninput="this.style.height='auto';this.style.height=Math.min(this.scrollHeight,100)+'px'"></textarea>
          <button onclick="sendUserReply(${convId})" style="background:linear-gradient(135deg,var(--teal),#0d9488);color:#fff;border:none;border-radius:10px;padding:10px 16px;cursor:pointer;font-size:13px;font-weight:600" title="Send">
            <i class="fas fa-paper-plane"></i>
          </button>
        </div>
      </div>
    `;

    setTimeout(() => {
      const body = document.getElementById('userMsgBody');
      if (body) body.scrollTop = body.scrollHeight;
    }, 100);

    // Refresh inbox badge
    loadUserInbox();
  } catch(e) {
    alert('Failed to load messages');
  }
}

async function sendUserReply(convId) {
  const input = document.getElementById('userReplyInput');
  const msg = input?.value?.trim();
  if (!msg) return;
  if (msg.length > 2000) { alert('Message too long (max 2000 characters)'); return; }
  input.value = '';
  input.style.height = 'auto';

  try {
    await fetch(`/api/user/messages/${convId}/reply`, {
      method: 'POST',
      headers: { 'X-Admin-Email': currentUser.email, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg })
    });
    // Refresh the conversation
    await openUserConversation(convId);
  } catch(e) {
    alert('Failed to send reply');
  }
}

async function changePassword() {
  const newPw = document.getElementById('newPw').value;
  const msg = document.getElementById('pwChangeMsg');
  if (!newPw) { msg.textContent = 'Please enter a new password.'; msg.style.color = '#3b82f6'; msg.style.display = 'block'; return; }
  if (newPw.length < 6) { msg.textContent = 'Password must be at least 6 characters.'; msg.style.color = '#3b82f6'; msg.style.display = 'block'; return; }
  try {
    const { error } = await sbClient.auth.updateUser({ password: newPw });
    if (error) { msg.textContent = error.message; msg.style.color = '#ef4444'; }
    else { msg.textContent = 'Password updated!'; msg.style.color = '#10b981'; document.getElementById('newPw').value = ''; }
    msg.style.display = 'block';
  } catch { msg.textContent = 'Failed to update password.'; msg.style.color = '#ef4444'; msg.style.display = 'block'; }
}

async function deleteAccount() {
  if (!confirm('Are you sure? This will permanently delete your account and ALL cloud data. This cannot be undone.')) return;
  if (!confirm('Really delete everything? Last chance.')) return;
  try {
    // Delete D1 cloud data via our backend
    await fetch('/api/auth/delete-account', { method: 'POST', headers: authHeaders() });
    // Sign out from Supabase
    await sbClient.auth.signOut();
    currentUser = null;
    window.currentUser = null;
    updateAuthUI();
    navigate('home');
    alert('Account deleted. Your local data on this device is still available.');
  } catch { alert('Failed to delete account. Please try again.'); }
}

// ── Research Profile ──
// Forum username card on the account page. Same endpoint and rules as the
// forum-rail editor: PATCH /api/forum/me, one change per 14 days.
async function bindUsernameCard() {
  const input = document.getElementById('acctUsername');
  const save = document.getElementById('acctUsernameSave');
  const msg = document.getElementById('acctUsernameMsg');
  if (!input || !save) return;
  try {
    const me = await fetch('/api/forum/me', { headers: authHeaders() }).then(r => r.json());
    input.value = me.username || '';
    input.placeholder = 'your-username';
    input.disabled = false;
    save.disabled = false;
  } catch {
    msg.textContent = 'Could not load your username - try refreshing.';
    return;
  }
  save.onclick = async () => {
    const v = input.value.trim();
    if (!v) return;
    save.disabled = true;
    try {
      const r = await fetch('/api/forum/me', { method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ username: v }) }).then(x => x.json());
      if (r.error) {
        msg.textContent = r.error;
        msg.style.color = '#dc2626';
      } else {
        input.value = r.username;
        msg.textContent = `Saved - you are now ${r.username} everywhere on the forum.`;
        msg.style.color = '#10b981';
      }
    } catch {
      msg.textContent = 'Network error - try again.';
      msg.style.color = '#dc2626';
    }
    save.disabled = false;
  };
  input.onkeydown = (ev) => { if (ev.key === 'Enter') save.onclick(); };
}

// Country card on the account page. Same endpoint as the forum rail picker.
var ACCT_COUNTRIES = [
  ['US','United States'],['GB','United Kingdom'],['CA','Canada'],['AU','Australia'],['IE','Ireland'],['NZ','New Zealand'],
  ['DE','Germany'],['FR','France'],['NL','Netherlands'],['SE','Sweden'],['NO','Norway'],['DK','Denmark'],['FI','Finland'],['PL','Poland'],
  ['ES','Spain'],['IT','Italy'],['PT','Portugal'],['CH','Switzerland'],['AT','Austria'],['BE','Belgium'],['CZ','Czechia'],['GR','Greece'],
  ['RO','Romania'],['HU','Hungary'],['UA','Ukraine'],['RU','Russia'],['TR','Turkey'],['HR','Croatia'],['RS','Serbia'],['SK','Slovakia'],['BG','Bulgaria'],['IS','Iceland'],
  ['BR','Brazil'],['MX','Mexico'],['AR','Argentina'],['CL','Chile'],['CO','Colombia'],['PE','Peru'],
  ['JP','Japan'],['KR','South Korea'],['CN','China'],['IN','India'],['SG','Singapore'],['PH','Philippines'],['ID','Indonesia'],
  ['TH','Thailand'],['VN','Vietnam'],['MY','Malaysia'],['HK','Hong Kong'],['TW','Taiwan'],['PK','Pakistan'],['BD','Bangladesh'],
  ['ZA','South Africa'],['NG','Nigeria'],['EG','Egypt'],['KE','Kenya'],['MA','Morocco'],['IL','Israel'],['AE','UAE'],['SA','Saudi Arabia']
];
function acctCodeToFlag(code) {
  if (!/^[A-Za-z]{2}$/.test(code || '')) return '';
  return String.fromCodePoint.apply(null, code.toUpperCase().split('').map(function (ch) { return 0x1F1E6 + ch.charCodeAt(0) - 65; }));
}
async function bindCountryCard() {
  var sel = document.getElementById('acctCountry');
  var save = document.getElementById('acctCountrySave');
  var msg = document.getElementById('acctCountryMsg');
  if (!sel || !save) return;
  var current = '';
  try {
    var me = await fetch('/api/forum/me', { headers: authHeaders() }).then(function (r) { return r.json(); });
    current = me.country || '';
  } catch { /* default to none */ }
  sel.innerHTML = '<option value="">— No country —</option>' + ACCT_COUNTRIES.map(function (c) {
    return '<option value="' + c[0] + '"' + (c[0] === current ? ' selected' : '') + '>' + acctCodeToFlag(c[0]) + ' ' + c[1] + '</option>';
  }).join('');
  sel.disabled = false;
  save.disabled = false;
  save.onclick = async function () {
    save.disabled = true;
    try {
      var r = await fetch('/api/forum/me/country', { method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ country: sel.value }) }).then(function (x) { return x.json(); });
      if (r.error) { msg.textContent = r.error; msg.style.color = '#dc2626'; }
      else { msg.textContent = r.flag ? ('Saved ' + r.flag + ' - it now shows next to your name.') : 'Country cleared.'; msg.style.color = '#10b981'; }
    } catch { msg.textContent = 'Network error - try again.'; msg.style.color = '#dc2626'; }
    save.disabled = false;
  };
}

// "About you" free-text bio on the account page. Saved to /api/forum/me/bio,
// shown on the public /u/<name> profile.
async function bindBioCard() {
  const ta = document.getElementById('acctBio');
  const save = document.getElementById('acctBioSave');
  const count = document.getElementById('acctBioCount');
  const msg = document.getElementById('acctBioMsg');
  if (!ta || !save) return;
  try {
    const me = await fetch('/api/forum/me', { headers: authHeaders() }).then(function (r) { return r.json(); });
    ta.value = me.bio || '';
  } catch { /* leave empty */ }
  const updateCount = function () { count.textContent = (ta.value.length) + ' / 300'; };
  updateCount();
  ta.disabled = false;
  save.disabled = false;
  ta.addEventListener('input', updateCount);
  save.onclick = async function () {
    save.disabled = true;
    try {
      const r = await fetch('/api/forum/me/bio', { method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ bio: ta.value }) }).then(function (x) { return x.json(); });
      if (r.error) { msg.textContent = r.error; msg.style.color = '#dc2626'; }
      else { ta.value = r.bio || ''; updateCount(); msg.textContent = 'Saved - this now shows on your profile.'; msg.style.color = '#10b981'; }
    } catch { msg.textContent = 'Network error - try again.'; msg.style.color = '#dc2626'; }
    save.disabled = false;
  };
}

async function loadResearchProfile() {
  try {
    const res = await fetch('/api/profile', { headers: authHeaders() });
    if (!res.ok) return;
    const p = await res.json();
    if (document.getElementById('profileRole')) {
      document.getElementById('profileRole').value = p.role || '';
      document.getElementById('profilePurpose').value = p.research_purpose || '';
      document.getElementById('profileExperience').value = p.experience_level || '';
      document.getElementById('profileAge').value = p.age_range || '';
      document.getElementById('profileNewsletter').checked = !!p.newsletter_optin;
      document.getElementById('profileDataSharing').checked = !!p.data_sharing_optin;
    }
  } catch(e) { console.error('Profile load error:', e); }
}

async function saveResearchProfile() {
  const msg = document.getElementById('profileMsg');
  try {
    const body = {
      role: document.getElementById('profileRole').value,
      research_purpose: document.getElementById('profilePurpose').value,
      experience_level: document.getElementById('profileExperience').value,
      age_range: document.getElementById('profileAge').value,
      interests: [],
      newsletter_optin: document.getElementById('profileNewsletter').checked,
      data_sharing_optin: document.getElementById('profileDataSharing').checked,
    };
    const res = await fetch('/api/profile', { method: 'POST', headers: authHeaders(), body: JSON.stringify(body) });
    if (res.ok) {
      msg.textContent = '✓ Profile saved successfully!';
      msg.style.color = '#10b981';
    } else {
      msg.textContent = 'Failed to save profile.';
      msg.style.color = '#ef4444';
    }
    msg.style.display = 'block';
    setTimeout(() => { if (msg) msg.style.display = 'none'; }, 3000);
  } catch(e) {
    msg.textContent = 'Error saving profile.';
    msg.style.color = '#ef4444';
    msg.style.display = 'block';
  }
}

async function clearSearchHistory() {
  if (!confirm('Clear your search history? This cannot be undone.')) return;
  try {
    await fetch('/api/search-history', { method: 'DELETE', headers: authHeaders() });
    alert('Search history cleared.');
  } catch { alert('Failed to clear search history.'); }
}

function resetAnalyticsConsent() {
  localStorage.removeItem('ps_consent');
  localStorage.removeItem('ps_profile_prompted');
  alert('Analytics consent reset. The consent banner will appear on next page load.');
  location.reload();
}

// ============================================================
// PARTICLE SYSTEM - Floating molecular dots
// ============================================================
class ParticleSystem {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.particles = [];
    this.mouse = { x: -1000, y: -1000 };
    this.animFrame = null;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    document.addEventListener('mousemove', (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
    });
    this.init();
    this.animate();
  }
  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }
  init() {
    const isMobile = window.innerWidth < 768;
    const count = isMobile ? Math.min(Math.floor((window.innerWidth * window.innerHeight) / 60000), 15) : Math.min(Math.floor((window.innerWidth * window.innerHeight) / 28000), 45);
    this.particles = [];
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        radius: Math.random() * 1.8 + 0.5,
        opacity: Math.random() * 0.25 + 0.05,
        color: Math.random() > 0.5 ? '37,99,235' : '59,130,246'
      });
    }
  }
  animate() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const isDark = document.body.classList.contains('dark');
    for (const p of this.particles) {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > this.canvas.width) p.vx *= -1;
      if (p.y < 0 || p.y > this.canvas.height) p.vy *= -1;
      const dx = p.x - this.mouse.x, dy = p.y - this.mouse.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 100) {
        const force = (100 - dist) / 100 * 0.012;
        p.vx += dx * force; p.vy += dy * force;
      }
      p.vx *= 0.998; p.vy *= 0.998;
      const alpha = isDark ? p.opacity * 1.5 : p.opacity;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = `rgba(${p.color},${alpha})`;
      this.ctx.fill();
    }
    const connDist = this.particles.length > 20 ? 130 : 80;
    for (let i = 0; i < this.particles.length; i++) {
      for (let j = i + 1; j < this.particles.length; j++) {
        const a = this.particles[i], b = this.particles[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < connDist) {
          const alpha = (1 - dist / connDist) * (isDark ? 0.06 : 0.03);
          this.ctx.beginPath();
          this.ctx.moveTo(a.x, a.y);
          this.ctx.lineTo(b.x, b.y);
          this.ctx.strokeStyle = `rgba(37,99,235,${alpha})`;
          this.ctx.lineWidth = 0.5;
          this.ctx.stroke();
        }
      }
    }
    this.animFrame = requestAnimationFrame(() => this.animate());
  }
  destroy() { if (this.animFrame) cancelAnimationFrame(this.animFrame); }
}

// ============================================================
// RIPPLE EFFECT
// ============================================================
// App Views - loaded lazily after initial page render
window._renderView = function(view, data, area) {
  // Personal tracking tools require a registered (logged-in) account.
  // Data for these features is stored per-user and synced, so guests are
  // shown a sign-in / create-account gate instead of the tool.
  const TRACKING_VIEWS = {
  };
  if (TRACKING_VIEWS[view] && !window.currentUser) {
    const t = TRACKING_VIEWS[view];
    renderLoginGate(area, t.name, t.icon, t.color, t.desc);
    return;
  }

  switch(view) {
    case 'knowledge': renderKnowledge(area); break;
    case 'calculator': renderCalculator(area); break;
    case 'compare': renderCompare(area); break;
    case 'protocols': renderProtocols(area); break;
    case 'protocol-detail': renderProtocolDetail(area, data); break;
    case 'research': renderResearch(area); break;
    case 'videos': renderVideos(area); break;
    case 'favorites': renderFavorites(area); break;
    case 'builder': renderBuilder(area); break;
    case 'peptide-detail': renderPeptideDetailPage(area, data); break;
    case 'interactions': renderInteractions(area); break;
    case 'community': renderCommunity(area); break;
    case 'disclaimer': renderDisclaimer(area); break;
    case 'account': renderAccount(area); break;
    case 'privacy': renderPrivacyPolicy(area); break;
    case 'terms': renderTermsOfService(area); break;
    case 'admin': renderAdminDashboard(area); break;
    case 'partner-apply': renderPartnerApply(area); break;
    case 'review': renderReview(area); break;
    default: renderHome(area);
  }
};

// On mobile, three.js now loads (after a short delay), so we no longer swap
// <molecule-3d> tags for static PNGs. The 3D viewer is interactive everywhere.
(function initMobileMoleculeShim() {
  // DISABLED - 3D viewer now works on mobile
  return;
})();

// ============================================================
// KNOWLEDGE BASE
// ============================================================
let kbFilter = 'all';

function renderKnowledge(el) {
  el.innerHTML = `
    <div class="kb-view rs-kb">

      <div class="rs-kb-head">
        <h1 class="rs-kb-title">Knowledge base</h1>
        <p class="rs-kb-sub">${peptides.length} structured profiles - mechanisms, dosing, safety and research status.</p>
      </div>

      <div class="rs-kb-toolbar">
        <div class="rs-kb-search">
          <i class="fas fa-magnifying-glass"></i>
          <input id="kbSearch" placeholder="Search by name, mechanism, or goal…" oninput="filterKB()">
        </div>
        <button class="rs-kb-share" id="kbShareBtn" onclick="shareKnowledgeBase()" title="Share the knowledge base">
          <i class="fas fa-share-nodes"></i><span>Share</span>
        </button>
      </div>

      <div class="rs-kb-chips" id="kbCats">
        <button class="rs-chip active" onclick="setKBFilter('all', this)"><span class="rs-chip-dot" style="background:#0E7C5A"></span>All</button>
        ${(window.categories || categories).map(c => `<button class="rs-chip" onclick="setKBFilter('${c.name}', this)"><span class="rs-chip-dot" style="background:${c.color}"></span>${c.name}</button>`).join('')}
      </div>

      <div class="rs-kb-grid" id="kbGrid"></div>
    </div>
  `;
  renderKBGrid();

  // Apply shared deep-link params (?cat= / ?q=) so a shared link lands on the right view.
  try {
    const sp = new URLSearchParams(window.location.search);
    const sharedQ = sp.get('q');
    const sharedCat = sp.get('cat');
    if (sharedQ) {
      const searchEl = el.querySelector('#kbSearch');
      if (searchEl) searchEl.value = sharedQ;
    }
    if (sharedCat) {
      const chips = el.querySelectorAll('.rs-kb-chips .rs-chip');
      let matched = null;
      chips.forEach(c => { if (c.textContent.trim() === sharedCat) matched = c; });
      if (matched) { setKBFilter(sharedCat, matched); }
    }
    if (sharedQ || sharedCat) renderKBGrid();
  } catch (e) {}
}

function shareKnowledgeBase() {
  // Build a link that reflects what the user is currently viewing.
  const params = new URLSearchParams();
  if (typeof kbFilter !== 'undefined' && kbFilter && kbFilter !== 'all') params.set('cat', kbFilter);
  const q = (document.getElementById('kbSearch')?.value || '').trim();
  if (q) params.set('q', q);
  const qs = params.toString();
  const url = `${window.location.origin}/knowledge${qs ? '?' + qs : ''}`;

  const count = (typeof peptides !== 'undefined' && peptides.length) ? peptides.length : '';
  const title = 'ResearchSafe Knowledge Base';
  const text = count
    ? `Explore ${count} structured compound profiles - mechanisms, dosing, safety and 3D molecular views.`
    : 'Explore structured compound profiles - mechanisms, dosing, safety and 3D molecular views.';

  const notify = (msg) => {
    if (typeof showToast === 'function') showToast(msg);
    else if (typeof showNotification === 'function') showNotification(msg, 'success');
  };

  const copyFallback = () => {
    const done = () => notify('Link copied to clipboard');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(done).catch(() => promptCopy());
    } else {
      promptCopy();
    }
    function promptCopy() {
      const input = document.createElement('input');
      input.value = url;
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.select();
      try { document.execCommand('copy'); done(); }
      catch (e) { window.prompt('Copy this link:', url); }
      document.body.removeChild(input);
    }
  };

  if (navigator.share) {
    navigator.share({ title, text, url }).catch((err) => {
      // User cancelled the native sheet, or it failed - fall back to copy.
      if (err && err.name === 'AbortError') return;
      copyFallback();
    });
  } else {
    copyFallback();
  }

  try { if (typeof psTrackFeatureUse === 'function') psTrackFeatureUse('kb_share', { url }); } catch (e) {}
}

function sharePeptide(id) {
  const p = (typeof peptides !== 'undefined' ? peptides : []).find(x => x.id === id) || {};
  const name = p.name || 'compound';
  const url = `${window.location.origin}/peptides/${id}`;
  const title = `${name} - ResearchSafe`;
  const text = p.description
    ? `${name}: ${String(p.description).slice(0, 140)}`
    : `Check out the ${name} research profile on ResearchSafe - mechanism, dosing and safety.`;

  const notify = (msg) => {
    if (typeof showToast === 'function') showToast(msg);
    else if (typeof showNotification === 'function') showNotification(msg, 'success');
  };

  const copyFallback = () => {
    const done = () => notify('Link copied to clipboard');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(done).catch(() => promptCopy());
    } else {
      promptCopy();
    }
    function promptCopy() {
      const input = document.createElement('input');
      input.value = url;
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.select();
      try { document.execCommand('copy'); done(); }
      catch (e) { window.prompt('Copy this link:', url); }
      document.body.removeChild(input);
    }
  };

  if (navigator.share) {
    navigator.share({ title, text, url }).catch((err) => {
      if (err && err.name === 'AbortError') return;
      copyFallback();
    });
  } else {
    copyFallback();
  }

  try { if (typeof psTrackFeatureUse === 'function') psTrackFeatureUse('peptide_share', { id, url }); } catch (e) {}
}

function setKBFilter(cat, btn) {
  kbFilter = cat;
  document.querySelectorAll('.rs-kb-chips .rs-chip').forEach(c => c.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderKBGrid();
}
function filterKB() {
  renderKBGrid();
  // Record the search for admin analytics (Top Search Queries / Recent Searches).
  // Debounced so we log the settled query, not every keystroke.
  try {
    const q = (document.getElementById('kbSearch')?.value || '').trim();
    clearTimeout(window.__kbSearchTimer);
    if (q.length >= 2) {
      window.__kbSearchTimer = setTimeout(function () {
        const cur = (document.getElementById('kbSearch')?.value || '').trim();
        if (cur !== q) return;
        const count = document.querySelectorAll('#kbGrid .rs-cc').length;
        recordSearchEvent(q, count, null);
      }, 1200);
    }
  } catch (e) {}
}

function renderKBGrid() {
  // Load compound rating summaries once, then re-render so cards show stars.
  if (window.__kbRatings === undefined) {
    window.__kbRatings = null;
    fetch('/api/reviews-summary').then(r => r.json()).then(m => { window.__kbRatings = m || {}; renderKBGrid(); }).catch(() => { window.__kbRatings = {}; });
  }
  const search = (document.getElementById('kbSearch')?.value || '').toLowerCase();
  let filtered = peptides;
  if (kbFilter !== 'all') filtered = filtered.filter(p => p.category === kbFilter);
  if (search) filtered = filtered.filter(p =>
    p.name.toLowerCase().includes(search) ||
    p.description.toLowerCase().includes(search) ||
    p.tags.some(t => t.includes(search))
  );
  const grid = document.getElementById('kbGrid');
  if (!grid) return;
  const evidenceLevel = (p) => {
    if (p.status && (p.status.includes('FDA') || p.status.includes('Phase III'))) return 'high';
    if (p.status && (p.status.includes('Phase') || p.status.includes('Investigational'))) return 'moderate';
    return 'emerging';
  };
  const evidenceLabel = (lv) => lv === 'high' ? 'FDA Approved' : lv === 'moderate' ? 'Clinical Trials' : 'Research';
  const EVIDENCE = {
    'FDA Approved': { bg: '#E3F4EC', color: '#0E7C5A' },
    'Clinical Trials': { bg: '#E6F2FB', color: '#1F73B8' },
    'Research': { bg: '#F0EBFB', color: '#7C5CD4' },
  };
  // Plain-language one-liner: lead with what it actually does for you, not the
  // scientific receptor name. Prefer benefits, fall back to a trimmed description.
  const laymanSummary = (p) => {
    if (Array.isArray(p.benefits) && p.benefits.length) {
      const top = p.benefits.slice(0, 2).map(b => String(b).trim()).filter(Boolean);
      if (top.length) return top.join(' · ');
    }
    let d = (p.description || p.fullName || '').trim();
    // Drop a leading "Scientific (Receptor Agonist)" style label if present.
    if (d.length > 130) d = d.slice(0, 127).replace(/\s+\S*$/, '') + '…';
    return d;
  };
  grid.innerHTML = filtered.map(p => {
    const ev = evidenceLevel(p);
    const evLabel = evidenceLabel(ev);
    const evC = EVIDENCE[evLabel] || EVIDENCE['Research'];
    const route = p.dosing?.route || p.route || '';
    const hl = p.halfLife || '';
    const catColor = p.categoryColor || '#0E7C5A';
    return `
    <div class="rs-cc ripple-container" onclick="openPeptideDetail('${p.id}')">
      <button class="rs-cc-fav ${isFavorite(p.id) ? 'is-active' : ''}" onclick="event.stopPropagation(); toggleFavorite('${p.id}')" title="${isFavorite(p.id) ? 'Remove from favorites' : 'Add to favorites'}"><i class="fas fa-star"></i></button>
      <div class="rs-cc-top">
        <span class="rs-cc-dot" style="background:${catColor}"></span>
        <span class="rs-cc-cat">${p.category}</span>
        <span class="rs-cc-ev" style="background:${evC.bg};color:${evC.color}">${evLabel}</span>
      </div>
      <div class="rs-cc-head">
        <div class="rs-cc-name">${p.name}</div>
        <div class="rs-cc-full">${p.fullName || ''}</div>
      </div>
      <div class="rs-cc-desc">${laymanSummary(p)}</div>
      ${(() => { const rt = window.__kbRatings && window.__kbRatings[p.id]; return rt && rt.count ? `<div class="rs-cc-rating">${_starRow(Math.round(rt.avg), 'rs-cc-star')}<span class="rs-cc-rate-avg">${rt.avg}</span><span class="rs-cc-rate-n">${rt.count} review${rt.count == 1 ? '' : 's'}</span></div>` : ''; })()}
      <div class="rs-cc-foot">
        ${hl ? `<span><i class="fas fa-clock"></i> ${hl}</span>` : ''}
        ${route ? `<span><i class="fas fa-syringe"></i> ${route.length > 25 ? route.slice(0,23) + '…' : route}</span>` : ''}
      </div>
    </div>
  `;}).join('') || `<div style="text-align:center;padding:40px 20px">
      <p style="color:var(--text-muted);font-size:13px;margin-bottom:14px">No compounds match your search.</p>
      ${search ? `<button class="cal-action-btn" style="font-size:13px;padding:9px 18px" onclick="requestCompound(${JSON.stringify(search).replace(/"/g, '&quot;')})"><i class="fas fa-plus" style="margin-right:6px"></i>Request "${esc(search)}"</button>
      <p style="color:var(--text-muted);font-size:11px;margin-top:10px">We'll research it and add it to the knowledge base.</p>` : ''}
    </div>`;
}

// Visitor requests a compound the KB doesn't cover yet → adds demand signal to
// the knowledge-gap backlog that the drafting pipeline pulls from.
async function requestCompound(name) {
  const q = (name || '').trim();
  if (!q) return;
  try {
    const res = await fetch('/api/kb/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: q }),
    });
    const data = await res.json().catch(() => ({}));
    if (typeof showToast === 'function') {
      showToast(res.ok ? (data.message || 'Thanks - request received.') : (data.error || 'Could not send request.'));
    } else {
      alert(res.ok ? (data.message || 'Thanks - request received.') : (data.error || 'Could not send request.'));
    }
  } catch {
    if (typeof showToast === 'function') showToast('Network error - please try again.');
  }
}
window.requestCompound = requestCompound;

async function openPeptideDetail(id) {
  navigate('peptide-detail', id);
}

// Self-contained analytics writers for admin "Peptides & Search" panels.
// These post directly to the D1-backed endpoints and do NOT depend on
// analytics.js having finished loading (that script defines psTrack* via an
// async-loaded module, so on SSR deep links the page can render before the
// wrappers exist). Reads the same session id analytics.js persists.
function _psSessionId() {
  try {
    var s = localStorage.getItem('ps_session_id');
    if (!s) {
      s = (crypto && crypto.randomUUID) ? crypto.randomUUID() : ('sid_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10));
      localStorage.setItem('ps_session_id', s);
    }
    return s;
  } catch (e) { return ''; }
}
function recordPeptideEvent(eventType, data) {
  data = data || {};
  var sid = _psSessionId();
  try {
    fetch('/api/analytics/peptide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        session_id: sid,
        visitor_id: sid,
        event_type: eventType || 'view',
        peptide_id: data.peptide_id || '',
        peptide_name: data.peptide_name || '',
        category: data.category || '',
        source: data.source || '',
        duration_sec: data.duration_sec || 0,
        search_query: data.search_query || '',
      }),
    }).catch(function () {});
  } catch (e) {}
}
function recordSearchEvent(query, resultsCount, clicked) {
  var q = (query || '').trim();
  if (q.length < 2) return;
  var sid = _psSessionId();
  try {
    fetch('/api/analytics/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        session_id: sid,
        visitor_id: sid,
        query: q,
        results_count: resultsCount || 0,
        clicked_peptide_id: (clicked && clicked.id) || '',
        clicked_peptide_name: (clicked && clicked.name) || '',
      }),
    }).catch(function () {});
  } catch (e) {}
}
window.recordPeptideEvent = recordPeptideEvent;
window.recordSearchEvent = recordSearchEvent;

function openResearchPopup(id) {
  const p = peptides.find(pp => pp.id === id);
  if (!p) return;
  try { recordPeptideEvent('view', { peptide_id: p.id, peptide_name: p.name, category: p.category, source: 'popup' }); } catch (e) {}

  const existing = document.getElementById('researchPopup');
  if (existing) existing.remove();

  const hasMol = (typeof window.hasMoleculeStructure === 'function') && window.hasMoleculeStructure(id);
  const isMobile = window.innerWidth <= 768 || ('ontouchstart' in window && window.innerWidth < 1024);
  const benefits = Array.isArray(p.benefits) ? p.benefits.slice(0, 5) : [];
  const sideEffects = Array.isArray(p.sideEffects) ? p.sideEffects.slice(0, 4) : [];
  const research = Array.isArray(p.research) ? p.research : [];
  const dosing = p.dosing || {};
  const statusClass = (p.status || '').includes('FDA') ? 'status-approved' : (p.status || '').includes('Phase') ? 'status-investigational' : 'status-research';
  const statusText = (p.status || '').includes('FDA') ? 'FDA Approved' : (p.status || '').includes('Phase') ? 'Clinical Trial' : 'Research';

  const molSection = hasMol
    ? `<div class="rp-mol-viewer">
        <molecule-3d data-id="${id}" style="width:100%;height:100%;display:block"></molecule-3d>
             <div class="rp-mol-hint"><i class="fas fa-hand-pointer"></i> Drag to rotate</div>
      </div>`
    : `<div class="rp-mol-viewer rp-mol-placeholder">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="rgba(99,102,241,0.3)" stroke-width="1"><circle cx="12" cy="12" r="3"/><ellipse cx="12" cy="12" rx="10" ry="4"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(120 12 12)"/></svg>
        <span>Structure not available</span>
      </div>`;

  const overlay = document.createElement('div');
  overlay.id = 'researchPopup';
  overlay.className = 'rp-overlay';
  overlay.onclick = (e) => { if (e.target === overlay) closeResearchPopup(); };
  overlay.innerHTML = `
    <div class="rp-modal">
      <button class="rp-close" onclick="closeResearchPopup()"><i class="fas fa-times"></i></button>
      <div class="rp-layout">
        ${molSection}
        <div class="rp-content">
          <div class="rp-header">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px">
              ${compoundTypeBadge(p, { fontSize: '10px' })}
              <span class="pc-badge" style="--cat:${p.categoryColor || '#6b7280'};font-size:10px">${p.category || 'General'}</span>
              <span class="status-badge ${statusClass}" style="font-size:10px">${statusText}</span>
            </div>
            <h2 class="rp-title">${esc(p.name)}</h2>
            <p class="rp-subtitle">${esc(p.fullName || '')}</p>
          </div>

          <div class="rp-stats">
            ${p.halfLife ? `<div class="rp-stat"><i class="fas fa-clock" style="color:#10b981"></i><span>${p.halfLife}</span></div>` : ''}
            ${p.molecularWeight ? `<div class="rp-stat"><i class="fas fa-weight-hanging" style="color:#f59e0b"></i><span>${p.molecularWeight}</span></div>` : ''}
            ${dosing.route ? `<div class="rp-stat"><i class="fas fa-syringe" style="color:#3b82f6"></i><span>${dosing.route.length > 30 ? dosing.route.split(/[,;]/)[0] : dosing.route}</span></div>` : ''}
            ${dosing.typical ? `<div class="rp-stat"><i class="fas fa-prescription" style="color:#8b5cf6"></i><span>${dosing.typical}</span></div>` : ''}
          </div>

          ${p.mechanism ? `<div class="rp-section"><div class="rp-section-title"><i class="fas fa-cogs"></i> Mechanism</div><p class="rp-text">${p.mechanism}</p></div>` : ''}

          ${benefits.length > 0 ? `<div class="rp-section"><div class="rp-section-title"><i class="fas fa-check-circle" style="color:#10b981"></i> Key Benefits</div><ul class="rp-list rp-list-benefits">${benefits.map(b => `<li>${b}</li>`).join('')}</ul></div>` : ''}

          ${sideEffects.length > 0 ? `<div class="rp-section"><div class="rp-section-title"><i class="fas fa-exclamation-triangle" style="color:#f59e0b"></i> Side Effects</div><ul class="rp-list rp-list-side">${sideEffects.map(s => `<li>${s}</li>`).join('')}</ul></div>` : ''}

          ${research.length > 0 ? `<div class="rp-section"><div class="rp-section-title"><i class="fas fa-microscope" style="color:#6366f1"></i> Research</div><ul class="rp-list">${research.map(r => typeof r === 'object' ? `<li><strong>${r.title || ''}</strong> (${r.year || ''}) - ${r.finding || ''}</li>` : `<li>${r}</li>`).join('')}</ul></div>` : ''}

          <button class="rp-full-btn" onclick="closeResearchPopup(); navigate('peptide-detail','${id}')"><i class="fas fa-expand"></i> View Full Profile</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('open'));
  document.body.style.overflow = 'hidden';
}

function closeResearchPopup() {
  const overlay = document.getElementById('researchPopup');
  if (!overlay) return;
  overlay.classList.remove('open');
  document.body.style.overflow = '';
  setTimeout(() => overlay.remove(), 250);
}

// Lazy molecule card renderer - desktop: live animated 3D; mobile: static PNG.
(function initMolCardRenderer() {
  const isMobileDevice = window.innerWidth <= 768 || ('ontouchstart' in window && window.innerWidth < 1024);

  // Mobile: drop in the pre-rendered static image (no three.js needed).
  function renderStaticImage(el) {
    const id = el.dataset.molId;
    el.dataset.rendered = '1';
    if (!id) { renderPlaceholder(el); return; }
    el.innerHTML = `<img src="/static/mol-png/${id}.png" loading="lazy" alt="" `
      + `style="width:100%;height:100%;object-fit:contain;display:block" `
      + `onerror="this.parentNode.dataset.molFailed='1';this.remove()">`;
    const img = el.querySelector('img');
    if (img) img.addEventListener('error', () => { if (!el.querySelector('img')) renderPlaceholder(el); }, { once: true });
  }

  function renderPlaceholder(el) {
    el.innerHTML = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(99,102,241,0.4)" stroke-width="1.2">
        <circle cx="12" cy="12" r="3"/><ellipse cx="12" cy="12" rx="10" ry="4"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(120 12 12)"/>
      </svg>
    </div>`;
    el.dataset.rendered = '1';
  }

  // Desktop: mount a live, animated 3D viewer.
  function renderLive(el) {
    const id = el.dataset.molId;
    if (!id) { renderPlaceholder(el); return; }
    el.dataset.rendered = '1';
    el.style.position = 'relative';
    const mol = document.createElement('molecule-3d');
    mol.setAttribute('data-id', id);
    mol.style.cssText = 'width:100%;height:100%;display:block';
    mol.addEventListener('molempty', () => renderPlaceholder(el), { once: true });
    el.innerHTML = '';
    el.appendChild(mol);
  }

  function observeCards() {
    const cards = document.querySelectorAll('.kb-card-mol[data-mol-id]:not([data-rendered])');
    if (!cards.length) return;
    if (!customElements.get('molecule-3d')) { return; } // viewer not loaded yet; will retry
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target;
          if (el.dataset.molId && !el.dataset.rendered) renderLive(el);
          io.unobserve(el);
        }
      });
    }, { rootMargin: '300px' });
    cards.forEach(c => { if (c.dataset.molId && !c.dataset.rendered) io.observe(c); });
  }

  const origRenderKBGrid = window.renderKBGrid;
  if (origRenderKBGrid) {
    window.renderKBGrid = function() {
      origRenderKBGrid.apply(this, arguments);
      setTimeout(observeCards, 300);
    };
  }
  function initWhenReady() {
    if (isMobileDevice) { setTimeout(observeCards, 100); return; }
    if (customElements.get('molecule-3d')) {
      setTimeout(observeCards, 200);
    } else {
      customElements.whenDefined('molecule-3d').then(() => setTimeout(observeCards, 200));
      setTimeout(observeCards, 5000);
    }
  }
  if (document.readyState === 'complete') initWhenReady();
  else window.addEventListener('load', initWhenReady);
  window._molCardObserve = observeCards;
})();

// Detail page molecule - desktop: live animated 3D; mobile: static PNG.
(function initDetailMolCapture() {
  const isMobileDevice = window.innerWidth <= 768 || ('ontouchstart' in window && window.innerWidth < 1024);

  function renderDetailStaticImage(el) {
    const id = el.dataset.molId;
    el.dataset.rendered = '1';
    el.style.position = 'relative';
    const label = el.querySelector('[style*="position:absolute;bottom"]');
    if (!id) { el.innerHTML = '<i class="fas fa-atom" style="font-size:36px;opacity:0.2"></i>'; if (label) el.appendChild(label); return; }
    el.innerHTML = `<img src="/static/mol-png/${id}.png" loading="lazy" alt="" `
      + `style="width:100%;height:100%;object-fit:contain;display:block">`;
    const img = el.querySelector('img');
    if (img) img.addEventListener('error', () => { el.innerHTML = '<i class="fas fa-atom" style="font-size:36px;opacity:0.2"></i>'; if (label) el.appendChild(label); }, { once: true });
    if (label) el.appendChild(label);
  }

  function renderDetailLive(el) {
    const id = el.dataset.molId;
    if (!id) return;
    el.dataset.rendered = '1';
    el.style.position = 'relative';
    const label = el.querySelector('[style*="position:absolute;bottom"]');
    const mol = document.createElement('molecule-3d');
    mol.setAttribute('data-id', id);
    mol.style.cssText = 'width:100%;height:100%;display:block';
    mol.addEventListener('molempty', () => { el.innerHTML = '<i class="fas fa-atom" style="font-size:36px;opacity:0.2"></i>'; if (label) el.appendChild(label); }, { once: true });
    el.innerHTML = '';
    el.appendChild(mol);
    if (label) el.appendChild(label);
  }

  function renderDetailMols() {
    const els = document.querySelectorAll('.detail-mol-capture[data-mol-id]:not([data-rendered])');
    if (!els.length) return;
    if (!customElements.get('molecule-3d')) return;
    els.forEach(renderDetailLive);
  }
  const observer = new MutationObserver(() => setTimeout(renderDetailMols, 300));
  const ca = document.getElementById('contentArea');
  if (ca) observer.observe(ca, { childList: true, subtree: false });
  window.addEventListener('load', () => setTimeout(renderDetailMols, 1500));
  if (!isMobileDevice && !customElements.get('molecule-3d')) {
    if (customElements.whenDefined) customElements.whenDefined('molecule-3d').then(() => setTimeout(renderDetailMols, 200));
  }
  window._detailMolRender = renderDetailMols;
})();

// Renders a comprehensive "Dosing Protocol" section.
// Backward compatible: with only typical/frequency/duration/route it renders
// the original 4-stat grid. Richer optional fields add a structured detail
// block describing how the compound is normally run.
function renderDosingProtocol(dosing) {
  dosing = dosing || {};
  const hasCore = dosing.typical || dosing.frequency || dosing.duration || dosing.route;
  const detailDefs = [
    { key: 'protocol',       label: 'How it\'s typically run', icon: 'fa-list-check' },
    { key: 'titration',      label: 'Ramp-up / titration',     icon: 'fa-stairs' },
    { key: 'timing',         label: 'Timing',                  icon: 'fa-clock' },
    { key: 'cycle',          label: 'Cycling (on / off)',      icon: 'fa-rotate' },
    { key: 'injectionSites', label: 'Injection sites',         icon: 'fa-syringe' },
    { key: 'reconstitution', label: 'Reconstitution example',  icon: 'fa-flask-vial' },
    { key: 'tapering',       label: 'Tapering / discontinuation', icon: 'fa-arrow-trend-down' },
  ];
  const hasDetail = detailDefs.some(d => dosing[d.key]) || dosing.notes;
  if (!hasCore && !hasDetail) return '';

  const stat = (label, value) => `<div class="detail-stat"><div class="detail-stat-label">${label}</div><div class="detail-stat-value">${value}</div></div>`;
  const items = [];
  if (dosing.typical) items.push(stat('Typical Dose', dosing.typical));
  if (dosing.frequency) items.push(stat('Frequency', dosing.frequency));
  if (dosing.duration) items.push(stat('Duration', dosing.duration));
  if (dosing.route) items.push(stat('Route', dosing.route));

  const renderVal = (v) => Array.isArray(v)
    ? `<ul class="dose-row-list">${v.map(x => `<li>${x}</li>`).join('')}</ul>`
    : `<span>${v}</span>`;

  const rows = detailDefs
    .filter(d => dosing[d.key])
    .map(d => `<div class="dose-row"><div class="dose-row-head"><i class="fas ${d.icon}"></i>${d.label}</div><div class="dose-row-body">${renderVal(dosing[d.key])}</div></div>`)
    .join('');

  let html = `<div class="detail-section"><div class="detail-section-title">Dosing Protocol</div>`;
  if (items.length) html += `<div class="detail-grid">${items.join('')}</div>`;
  if (rows) html += `<div class="dose-detail">${rows}</div>`;
  if (dosing.notes) html += `<p class="detail-text dose-note"><i class="fas fa-circle-info"></i> ${dosing.notes}</p>`;
  html += `</div>`;
  return html;
}

function showDetailModal(p) {
  let overlay = document.getElementById('detailOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'detailOverlay';
    overlay.className = 'detail-overlay';
    overlay.onclick = (e) => { if (e.target === overlay) closeDetail(); };
    document.body.appendChild(overlay);
  }
  // Safe accessors for optional fields
  const status = p.status || 'Research compound';
  const dosing = p.dosing || {};
  const benefits = Array.isArray(p.benefits) ? p.benefits : [];
  const sideEffects = Array.isArray(p.sideEffects) ? p.sideEffects : [];
  const research = Array.isArray(p.research) ? p.research : [];
  const stacks = Array.isArray(p.stacksWith) ? p.stacksWith : [];
  const tags = Array.isArray(p.tags) ? p.tags : [];
  const statusClass = status.includes('FDA') ? 'status-approved' : status.includes('Phase') || status.includes('Investigational') ? 'status-investigational' : 'status-research';
  const statusText = status.includes('FDA') ? 'FDA Approved' : status.includes('Phase') ? 'Clinical Trial' : 'Research';

  let bodyHTML = '';

  // Overview (always show)
  bodyHTML += `<div class="detail-section"><div class="detail-section-title">Overview</div><p class="detail-text">${p.description || 'No description available.'}</p></div>`;

  // Mechanism (if available)
  if (p.mechanism) {
    bodyHTML += `<div class="detail-section"><div class="detail-section-title">Mechanism of Action</div><p class="detail-text">${p.mechanism}</p></div>`;
  }

  // Key Properties (show available ones)
  const props = [];
  if (p.molecularWeight) props.push({label:'Molecular Weight', value:p.molecularWeight});
  if (p.halfLife) props.push({label:'Half-Life', value:p.halfLife});
  if (p.bioavailability) props.push({label:'Bioavailability', value:p.bioavailability});
  if (p.sequence) props.push({label:'Sequence', value:`<span style="font-size:11px;font-family:'SF Mono','Fira Code',monospace">${p.sequence}</span>`});
  if (props.length > 0) {
    bodyHTML += `<div class="detail-section"><div class="detail-section-title">Key Properties</div><div class="detail-grid">${props.map(pr => `<div class="detail-stat"><div class="detail-stat-label">${pr.label}</div><div class="detail-stat-value">${pr.value}</div></div>`).join('')}</div></div>`;
  }

  // Dosing Protocol (if available)
  bodyHTML += renderDosingProtocol(dosing);

  // Storage & Reconstitution (if available)
  if (p.storage || p.reconstitution) {
    bodyHTML += `<div class="detail-section"><div class="detail-section-title">Storage & Reconstitution</div>${p.storage ? `<p class="detail-text"><strong>Storage:</strong> ${p.storage}</p>` : ''}${p.reconstitution ? `<p class="detail-text" style="margin-top:5px"><strong>Reconstitution:</strong> ${p.reconstitution}</p>` : ''}</div>`;
  }

  // Benefits (if available)
  if (benefits.length > 0) {
    bodyHTML += `<div class="detail-section"><div class="detail-section-title">Benefits</div><ul class="detail-list">${benefits.map(b => `<li>${b}</li>`).join('')}</ul></div>`;
  }

  // Side Effects (if available)
  if (sideEffects.length > 0) {
    bodyHTML += `<div class="detail-section"><div class="detail-section-title">Side Effects</div><ul class="detail-list">${sideEffects.map(s => `<li>${s}</li>`).join('')}</ul></div>`;
  }

  // Research Status (if available)
  if (research.length > 0) {
    bodyHTML += `<div class="detail-section"><div class="detail-section-title">Research Status</div><ul class="detail-list">${research.map(r => typeof r === 'object' && r !== null ? `<li><strong>${r.title || ''}</strong>${r.year ? ` (${r.year})` : ''}${r.finding ? ` - ${r.finding}` : ''}</li>` : `<li>${r}</li>`).join('')}</ul></div>`;
  }

  // Tags (show if available and no benefits/sideEffects/research)
  if (tags.length > 0 && benefits.length === 0) {
    bodyHTML += `<div class="detail-section"><div class="detail-section-title">Tags</div><div class="detail-tags">${tags.map(t => `<span class="detail-tag">${t}</span>`).join('')}</div></div>`;
  }

  // Stacks With
  if (stacks.length > 0) {
    bodyHTML += `<div class="detail-section"><div class="detail-section-title">Stacks With</div><div class="detail-tags">${stacks.map(s => `<span class="detail-tag">${s}</span>`).join('')}</div></div>`;
  }

  // Interaction Warnings
  try {
    const warnings = getInteractionWarnings(p);
    if (warnings.length > 0) {
      bodyHTML += `<div class="detail-section"><div class="detail-section-title" style="color:#f59e0b"><i class="fas fa-exclamation-triangle" style="margin-right:4px"></i>Interaction Notes</div><ul class="detail-list interaction-warnings">${warnings.map(w => `<li>${w}</li>`).join('')}</ul></div>`;
    }
  } catch(e) {}

  // Action buttons
  const safeName = (p.name || '').replace(/'/g, "\\'");
  bodyHTML += `<div class="detail-section">
    <button class="research-detail-btn" onclick="closeDetail(); openResearchForPeptide('${safeName}')"><i class="fas fa-newspaper" style="margin-right:6px"></i>View Latest Research on ${p.name}<i class="fas fa-arrow-right" style="margin-left:auto;opacity:0.5"></i></button>
    <button class="research-detail-btn" style="margin-top:8px;background:rgba(37,99,235,0.06);border-color:rgba(37,99,235,0.15)" onclick="closeDetail(); openVideosForPeptide('${safeName}')"><i class="fab fa-youtube" style="margin-right:6px;color:#ff0000"></i>Watch Videos on ${p.name}<i class="fas fa-arrow-right" style="margin-left:auto;opacity:0.5"></i></button>
    <button class="research-detail-btn" style="margin-top:8px;background:rgba(139,92,246,0.06);border-color:rgba(139,92,246,0.15);color:#7c3aed" onclick="exportPeptide('${p.id}')"><i class="fas fa-file-export" style="margin-right:6px;color:#7c3aed"></i>Export Profile as PDF<i class="fas fa-arrow-right" style="margin-left:auto;opacity:0.5"></i></button>
  </div>`;

  // Disclaimer
  bodyHTML += `<div style="padding:12px 16px;border-radius:11px;background:#eff6ff;border:1px solid #bfdbfe;margin-top:14px"><p style="font-size:11px;color:#1e3a8a;line-height:1.55"><strong>Disclaimer:</strong> ${status}. All information is for educational and research purposes only. Consult a licensed medical professional.</p></div>`;

  overlay.innerHTML = `
    <div class="detail-panel">
      <div class="detail-header" style="position:relative">
        <button class="detail-close" onclick="closeDetail()"><i class="fas fa-times"></i></button>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap">
          <span class="pc-badge" style="--cat:${p.categoryColor || '#6b7280'};display:inline-block">${p.category || 'General'}</span>
          <span class="status-badge ${statusClass}">${statusText}</span>
          <button class="fav-star-detail ${isFavorite(p.id) ? 'fav-active' : ''}" onclick="toggleFavorite('${p.id}'); this.classList.toggle('fav-active')"><i class="fas fa-star"></i> ${isFavorite(p.id) ? 'Saved' : 'Save'}</button>
        </div>
        <h2 style="font-size:22px;font-weight:800;color:var(--text);margin-top:6px;letter-spacing:-0.3px">${p.name}</h2>
        <p style="font-size:12px;color:var(--text-secondary);margin-top:3px">${p.fullName || ''}</p>
        <button class="detail-fullpage-btn" onclick="closeDetail(); navigate('peptide-detail', '${p.id}')"><i class="fas fa-expand" style="margin-right:5px"></i>Open Full Page</button>
      </div>
      <div class="detail-body">
        ${bodyHTML}
      </div>
    </div>
  `;
  requestAnimationFrame(() => {
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  });
}

function closeDetail() {
  const overlay = document.getElementById('detailOverlay');
  if (overlay) {
    overlay.style.transition = 'opacity 0.25s, backdrop-filter 0.25s';
    overlay.style.opacity = '0';
    overlay.style.backdropFilter = 'blur(0px)';
    setTimeout(() => {
      overlay.classList.remove('open');
      overlay.style.cssText = '';
      document.body.style.overflow = '';
    }, 250);
  }
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { closeDetail(); closeSpotlight(); }
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); openSpotlight(); }
});

// ============================================================
// CALCULATOR
// ============================================================
function renderCalculator(el) {
  el.innerHTML = `
    <div class="calc-view">

      <!-- PAGE HERO -->
      <div class="page-hero page-hero-purple">
        <div class="page-hero-bg">
          <div class="ph-orb ph-orb1" style="background:radial-gradient(circle,rgba(139,92,246,.35),rgba(99,102,241,.1))"></div>
          <div class="ph-orb ph-orb2" style="background:radial-gradient(circle,rgba(99,102,241,.25),rgba(167,139,250,.1))"></div>
          <div class="ph-orb ph-orb3" style="background:radial-gradient(circle,rgba(167,139,250,.2),rgba(139,92,246,.1))"></div>
          <div class="ph-grid"></div>
        </div>
        <div class="page-hero-body">
          <div class="ph-icon" style="background:rgba(139,92,246,.2);border-color:rgba(139,92,246,.3);color:#a78bfa"><i class="fas fa-calculator"></i></div>
          <div class="ph-text">
            <h1 class="ph-title">Reconstitution Calculator</h1>
            <p class="ph-sub">Precise peptide math - concentrations, volumes, syringe units, and doses per vial calculated instantly.</p>
          </div>
          <div class="ph-stats">
            <div class="ph-stat"><div class="ph-stat-n">mcg/mL</div><div class="ph-stat-l">Concentration</div></div>
            <div class="ph-stat"><div class="ph-stat-n">Units</div><div class="ph-stat-l">Syringe Draw</div></div>
            <div class="ph-stat"><div class="ph-stat-n">Doses</div><div class="ph-stat-l">Per Vial</div></div>
          </div>
        </div>
      </div>

      <div class="calc-card">
        <div class="calc-field">
          <label class="calc-label">Peptide Amount (mg)</label>
          <input class="calc-input" type="number" id="calcPeptide" value="5" min="0.1" step="0.1" oninput="calculate()">
        </div>
        <div class="calc-field">
          <label class="calc-label">Bacteriostatic Water (mL)</label>
          <input class="calc-input" type="number" id="calcWater" value="2" min="0.1" step="0.1" oninput="calculate()">
        </div>
        <div class="calc-field">
          <label class="calc-label">Desired Dose (mcg)</label>
          <input class="calc-input" type="number" id="calcDose" value="250" min="1" step="1" oninput="calculate()">
        </div>
        <div class="calc-results" id="calcResults">
          <div class="calc-result-row">
            <span class="calc-result-label"><i class="fas fa-flask" style="margin-right:6px;opacity:0.5"></i>Concentration</span>
            <span class="calc-result-value" id="resultConc">2,500 mcg/mL</span>
          </div>
          <div class="calc-result-row">
            <span class="calc-result-label"><i class="fas fa-syringe" style="margin-right:6px;opacity:0.5"></i>Volume to draw</span>
            <span class="calc-result-value" id="resultVol">0.100 mL</span>
          </div>
          <div class="calc-result-row">
            <span class="calc-result-label"><i class="fas fa-ruler-vertical" style="margin-right:6px;opacity:0.5"></i>Syringe units</span>
            <span class="calc-result-value" id="resultUnits">10.0 units</span>
          </div>
          <div class="calc-result-row">
            <span class="calc-result-label"><i class="fas fa-vial" style="margin-right:6px;opacity:0.5"></i>Doses per vial</span>
            <span class="calc-result-value" id="resultDoses">20 doses</span>
          </div>
        </div>
        <div class="calc-syringe-wrap">
          <div class="calc-syringe-bar"><div class="calc-syringe-fill" id="syringeFill" style="width:10%"></div></div>
          <div class="calc-syringe-ticks"><span>0</span><span>25</span><span>50</span><span>75</span><span>100 units</span></div>
        </div>
        <div style="text-align:center;font-size:12px;color:var(--p-text-secondary,#9E9E9E);margin-top:4px" id="calcSentence"></div>
        <div class="calc-how">
          <div class="calc-how-title"><i class="fas fa-info-circle" style="color:#2563eb;margin-right:5px"></i>How it works</div>
          <ol>
            <li><strong>Concentration</strong> = (Peptide mg × 1000) ÷ Water mL</li>
            <li><strong>Volume to draw</strong> = Desired dose ÷ Concentration</li>
            <li><strong>Syringe units</strong> = Volume mL × 100</li>
            <li><strong>Doses per vial</strong> = Total peptide mcg ÷ Desired dose</li>
          </ol>
        </div>
      </div>
    </div>
    <div class="disclaimer"><i class="fas fa-info-circle" style="margin-right:4px"></i> PeptideSafe is a research assistant. All information is for educational and research purposes only.</div>
  `;
  calculate();
}

function calculate() {
  const peptideMg = parseFloat(document.getElementById('calcPeptide')?.value) || 0;
  const waterMl = parseFloat(document.getElementById('calcWater')?.value) || 0;
  const doseMcg = parseFloat(document.getElementById('calcDose')?.value) || 0;
  if (peptideMg <= 0 || waterMl <= 0 || doseMcg <= 0) return;
  const concentration = (peptideMg * 1000) / waterMl;
  const volume = doseMcg / concentration;
  const units = volume * 100;
  const totalMcg = peptideMg * 1000;
  const doses = totalMcg / doseMcg;
  const updateEl = (id, val) => {
    const e = document.getElementById(id);
    if (e) {
      const old = e.textContent;
      e.textContent = val;
      if (old !== val) {
        e.classList.remove('flash');
        void e.offsetWidth;
        e.classList.add('flash');
        setTimeout(() => e.classList.remove('flash'), 500);
      }
    }
  };
  updateEl('resultConc', concentration.toLocaleString(undefined, {maximumFractionDigits:1}) + ' mcg/mL');
  updateEl('resultVol', volume.toFixed(3) + ' mL');
  updateEl('resultUnits', units.toFixed(1) + ' units');
  updateEl('resultDoses', Math.floor(doses) + ' doses');
  const fill = document.getElementById('syringeFill');
  if (fill) fill.style.width = Math.min(100, units).toFixed(1) + '%';
  const sentence = document.getElementById('calcSentence');
  if (sentence) sentence.textContent = `Draw to ${units.toFixed(1)} units on a U-100 syringe for ${doseMcg} mcg`;
}

// ============================================================
// COMPARE
// ============================================================
function renderCompare(el) {
  const options = peptides.map(p => `<option value="${p.id}">${p.name} · ${p.category}</option>`).join('');
  el.innerHTML = `
    <div class="compare-view">

      <!-- PAGE HERO -->
      <div class="page-hero page-hero-orange">
        <div class="page-hero-bg">
          <div class="ph-orb ph-orb1" style="background:radial-gradient(circle,rgba(249,115,22,.35),rgba(234,88,12,.1))"></div>
          <div class="ph-orb ph-orb2" style="background:radial-gradient(circle,rgba(234,88,12,.25),rgba(249,115,22,.1))"></div>
          <div class="ph-orb ph-orb3" style="background:radial-gradient(circle,rgba(251,146,60,.2),rgba(249,115,22,.1))"></div>
          <div class="ph-grid"></div>
        </div>
        <div class="page-hero-body">
          <div class="ph-icon" style="background:rgba(249,115,22,.2);border-color:rgba(249,115,22,.3);color:#fb923c"><i class="fas fa-code-compare"></i></div>
          <div class="ph-text">
            <h1 class="ph-title">Compare Peptides</h1>
            <p class="ph-sub">Evaluate any two compounds side-by-side across mechanisms, dosing, safety, and research status.</p>
          </div>
          <div class="ph-stats">
            <div class="ph-stat"><div class="ph-stat-n">${peptides.length}</div><div class="ph-stat-l">Peptides</div></div>
            <div class="ph-stat"><div class="ph-stat-n">12+</div><div class="ph-stat-l">Data Points</div></div>
            <div class="ph-stat"><div class="ph-stat-n">Side</div><div class="ph-stat-l">By Side</div></div>
          </div>
        </div>
      </div>

      <div class="compare-selectors">
        <select class="compare-select" id="compare1"><option value="">Select first peptide</option>${options}</select>
        <select class="compare-select" id="compare2"><option value="">Select second peptide</option>${options}</select>
        <button class="compare-btn ripple-container" onclick="runCompare()"><i class="fas fa-arrows-left-right" style="margin-right:5px"></i>Compare</button>
      </div>
      <div id="compareResult"></div>
    </div>
    <div class="disclaimer"><i class="fas fa-info-circle" style="margin-right:4px"></i> PeptideSafe is a research assistant. All information is for educational and research purposes only.</div>
  `;

  // Deep-link preload: /compare/a-vs-b lands here with both compounds chosen.
  const pre = window.__comparePreload;
  if (pre && pre.a && pre.b) {
    window.__comparePreload = null;
    const s1 = el.querySelector('#compare1');
    const s2 = el.querySelector('#compare2');
    const validA = peptides.some(p => p.id === pre.a);
    const validB = peptides.some(p => p.id === pre.b);
    if (s1 && s2 && validA && validB && pre.a !== pre.b) {
      s1.value = pre.a;
      s2.value = pre.b;
      runCompare();
    }
  }
}

async function runCompare() {
  const id1 = document.getElementById('compare1')?.value;
  const id2 = document.getElementById('compare2')?.value;
  if (!id1 || !id2) return alert('Please select two peptides to compare.');
  if (id1 === id2) return alert('Please select two different peptides.');
  try {
    const res = await fetch('/api/compare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ peptideIds: [id1, id2] })
    });
    const data = await res.json();
    renderCompareTable(data.peptides);
  } catch(e) { console.error(e); }
}

function renderCompareTable(peps) {
  const p1 = peps[0], p2 = peps[1];
  const container = document.getElementById('compareResult');
  if (!container) return;
  const _isMobile = window.innerWidth <= 768 || ('ontouchstart' in window && window.innerWidth < 1024);
  // On mobile the 3D engine isn't loaded; render the tag anyway (the mobile shim
  // swaps it for a static PNG, and the <img> hides itself if none exists).
  const hasMol1 = _isMobile || ((typeof window.hasMoleculeStructure === 'function') && window.hasMoleculeStructure(p1.id));
  const hasMol2 = _isMobile || ((typeof window.hasMoleculeStructure === 'function') && window.hasMoleculeStructure(p2.id));
  const row = (label, v1, v2) => `<tr><td class="row-label">${label}</td><td>${v1}</td><td>${v2}</td></tr>`;
  const molRow = (hasMol1 || hasMol2) ? `
    <div class="compare-mol-row">
      <div class="compare-mol-cell">
        ${hasMol1 ? `<molecule-3d data-id="${p1.id}" style="width:100%;height:100%;display:block"></molecule-3d>` : '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--p-text-dim,#5E5E5E);font-size:12px">No 3D structure</div>'}
        <div class="cmp-mol-hint"><i class="fas fa-cube"></i> 3D structure</div>
        <div class="cmp-mol-label">${esc(p1.name)}</div>
      </div>
      <div class="compare-mol-cell">
        ${hasMol2 ? `<molecule-3d data-id="${p2.id}" style="width:100%;height:100%;display:block"></molecule-3d>` : '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--p-text-dim,#5E5E5E);font-size:12px">No 3D structure</div>'}
        <div class="cmp-mol-hint"><i class="fas fa-cube"></i> 3D structure</div>
        <div class="cmp-mol-label">${esc(p2.name)}</div>
      </div>
    </div>` : '';
  container.innerHTML = `
    ${molRow}
    <div style="overflow-x:auto;border-radius:14px;border:1px solid var(--border);margin-top:8px">
      <table class="compare-table">
        <thead><tr>
          <th style="width:140px">Property</th>
          <th><span style="font-size:15px;font-weight:700">${p1.name}</span><br><span style="font-size:11px;font-weight:400;color:var(--text-secondary)">${p1.category}</span></th>
          <th><span style="font-size:15px;font-weight:700">${p2.name}</span><br><span style="font-size:11px;font-weight:400;color:var(--text-secondary)">${p2.category}</span></th>
        </tr></thead>
        <tbody>
          ${row('Full Name', p1.fullName, p2.fullName)}
          ${row('Mechanism', truncate(p1.mechanism, 180), truncate(p2.mechanism, 180))}
          ${row('Molecular Weight', p1.molecularWeight, p2.molecularWeight)}
          ${row('Half-Life', p1.halfLife, p2.halfLife)}
          ${row('Typical Dose', p1.dosing.typical, p2.dosing.typical)}
          ${row('Frequency', p1.dosing.frequency, p2.dosing.frequency)}
          ${row('Duration', p1.dosing.duration, p2.dosing.duration)}
          ${row('Route', p1.dosing.route, p2.dosing.route)}
          ${row('Benefits', p1.benefits.slice(0,4).map(b=>'• '+b).join('<br>'), p2.benefits.slice(0,4).map(b=>'• '+b).join('<br>'))}
          ${row('Side Effects', p1.sideEffects.slice(0,3).map(s=>'• '+s).join('<br>'), p2.sideEffects.slice(0,3).map(s=>'• '+s).join('<br>'))}
          ${row('Storage', p1.storage, p2.storage)}
          ${row('Status', p1.status, p2.status)}
          ${row('Stacks With', p1.stacksWith.join(', ') || 'N/A', p2.stacksWith.join(', ') || 'N/A')}
        </tbody>
      </table>
    </div>
  `;
}

function truncate(s, n) { return s.length > n ? s.slice(0, n) + '...' : s; }

// ============================================================
// PROTOCOLS
// ============================================================
function renderProtocols(el) {
  const list = Array.isArray(protocols) ? protocols : [];
  const cats = Array.from(new Set(list.map(p => p.category).filter(Boolean))).sort();
  window._protoFilter = window._protoFilter || { cat: 'all', q: '' };

  el.innerHTML = `
    <div class="protocols-view">

      <!-- PAGE HERO -->
      <div class="page-hero page-hero-blue">
        <div class="page-hero-bg">
          <div class="ph-orb ph-orb1" style="background:radial-gradient(circle,rgba(59,130,246,.35),rgba(37,99,235,.1))"></div>
          <div class="ph-orb ph-orb2" style="background:radial-gradient(circle,rgba(37,99,235,.25),rgba(96,165,250,.1))"></div>
          <div class="ph-orb ph-orb3" style="background:radial-gradient(circle,rgba(96,165,250,.2),rgba(59,130,246,.1))"></div>
          <div class="ph-grid"></div>
        </div>
        <div class="page-hero-body">
          <div class="ph-icon" style="background:rgba(59,130,246,.2);border-color:rgba(59,130,246,.3);color:#60a5fa"><i class="fas fa-clipboard-list"></i></div>
          <div class="ph-text">
            <h1 class="ph-title">Protocol Templates</h1>
            <p class="ph-sub">Structured research protocols with per-compound dosing, goals, and practical schedules. Tap any protocol for full dosing detail.</p>
          </div>
          <div class="ph-stats">
            <div class="ph-stat"><div class="ph-stat-n">${list.length}</div><div class="ph-stat-l">Protocols</div></div>
            <div class="ph-stat"><div class="ph-stat-n">${cats.length}</div><div class="ph-stat-l">Categories</div></div>
            <div class="ph-stat"><div class="ph-stat-n">Phased</div><div class="ph-stat-l">Dosing</div></div>
          </div>
        </div>
      </div>

      <!-- CONTROLS -->
      <div class="proto-controls" style="display:flex;flex-direction:column;gap:12px;margin:18px 0 8px">
        <div class="proto-search" style="position:relative">
          <i class="fas fa-search" style="position:absolute;left:14px;top:50%;transform:translateY(-50%);color:var(--text-secondary);font-size:13px"></i>
          <input id="protoSearch" type="text" placeholder="Search protocols, goals, or compounds..." value="${(window._protoFilter.q || '').replace(/"/g,'&quot;')}"
            oninput="filterProtocols()" style="width:100%;padding:11px 14px 11px 38px;border:1px solid var(--border);border-radius:11px;font-size:14px;background:var(--bg-card,#fff);color:var(--text-primary)" />
        </div>
        <div class="proto-cat-bar" style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="proto-cat-pill" data-cat="all" onclick="setProtoCat('all')">All</button>
          ${cats.map(c => `<button class="proto-cat-pill" data-cat="${c.replace(/"/g,'&quot;')}" onclick="setProtoCat(${JSON.stringify(c)})">${c}</button>`).join('')}
        </div>
      </div>

      <div id="protoGrid"></div>
    </div>
    <div class="disclaimer"><i class="fas fa-info-circle" style="margin-right:4px"></i> PeptideSafe is a research assistant. All information is for educational and research purposes only.</div>
  `;
  renderProtocolGrid();
}

function renderProtocolGrid() {
  const grid = document.getElementById('protoGrid');
  if (!grid) return;
  const list = Array.isArray(protocols) ? protocols : [];
  const f = window._protoFilter || { cat: 'all', q: '' };
  const q = (f.q || '').trim().toLowerCase();
  const filtered = list.filter(p => {
    if (f.cat !== 'all' && p.category !== f.cat) return false;
    if (!q) return true;
    const hay = [p.name, p.description, p.goal, p.category, (Array.isArray(p.peptides) ? p.peptides.join(' ') : '')].join(' ').toLowerCase();
    return hay.includes(q);
  });

  // reflect active pill
  document.querySelectorAll('.proto-cat-pill').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-cat') === f.cat);
  });

  if (!filtered.length) {
    grid.innerHTML = `<div style="padding:32px;text-align:center;color:var(--text-secondary)"><i class="fas fa-clipboard-list" style="font-size:28px;opacity:.4;margin-bottom:10px;display:block"></i>No protocols match your search.</div>`;
    return;
  }

  grid.innerHTML = filtered.map(p => `
    <div class="protocol-card ripple-container" onclick="navigate('protocol-detail', '${p.id}')">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px">
        <div class="proto-name">${p.name}</div>
        ${p.category ? `<span style="font-size:10px;font-weight:600;color:#2563eb;background:#eff6ff;border:1px solid #bfdbfe;padding:2px 8px;border-radius:999px;white-space:nowrap;flex-shrink:0">${p.category}</span>` : ''}
      </div>
      <div class="proto-desc">${p.description || ''}</div>
      ${p.goal ? `<div style="display:flex;gap:6px;align-items:flex-start;margin-top:8px;font-size:12px;color:#15803d"><i class="fas fa-bullseye" style="margin-top:2px;flex-shrink:0"></i><span>${p.goal}</span></div>` : ''}
      <div class="proto-meta" style="margin-top:10px">
        ${p.duration ? `<span><i class="fas fa-clock"></i> ${p.duration}</span>` : ''}
        ${Array.isArray(p.peptides) && p.peptides.length ? `<span><i class="fas fa-flask"></i> ${p.peptides.length} compounds</span>` : ''}
      </div>
      ${Array.isArray(p.peptides) && p.peptides.length ? `<div class="detail-tags" style="margin-top:8px">${p.peptides.slice(0,5).map(n => `<span class="detail-tag" style="font-size:10px">${n}</span>`).join('')}${p.peptides.length > 5 ? `<span class="detail-tag" style="font-size:10px">+${p.peptides.length - 5}</span>` : ''}</div>` : ''}
    </div>
  `).join('');
}

function setProtoCat(cat) {
  window._protoFilter = window._protoFilter || { cat: 'all', q: '' };
  window._protoFilter.cat = cat;
  renderProtocolGrid();
}
function filterProtocols() {
  const inp = document.getElementById('protoSearch');
  window._protoFilter = window._protoFilter || { cat: 'all', q: '' };
  window._protoFilter.q = inp ? inp.value : '';
  renderProtocolGrid();
}
window.setProtoCat = setProtoCat;
window.filterProtocols = filterProtocols;

async function renderProtocolDetail(el, id) {
  if (!id || id === 'undefined') {
    el.innerHTML = '<p style="padding:24px;color:#3b82f6">No protocol selected. <a href="#" onclick="navigate(\'protocols\');return false" style="color:#2563eb">Browse protocols</a></p>';
    return;
  }
  el.innerHTML = '<div class="protocol-detail" style="padding:24px;color:var(--text-secondary)"><i class="fas fa-spinner fa-spin" style="margin-right:8px"></i> Loading protocol…</div>';
  try {
    let r = await fetch(`/api/protocols/${encodeURIComponent(id)}`);
    if (!r.ok && r.status !== 404) r = await fetch(`https://researchsafe.org/api/protocols/${encodeURIComponent(id)}`);
    const p = await r.json();
    if (!p || p.error) {
      el.innerHTML = '<div class="protocol-detail" style="padding:24px"><button class="back-btn" onclick="navigate(\'protocols\')"><i class="fas fa-arrow-left"></i> Back to Protocols</button><p style="color:#3b82f6;margin-top:12px">Protocol not found. <a href="#" onclick="navigate(\'protocols\');return false" style="color:#2563eb">Browse all protocols</a>.</p></div>';
      return;
    }

    const compounds = Array.isArray(p.compounds) ? p.compounds : [];
    const pepList = compounds.length ? compounds.map(c => c.name) : (Array.isArray(p.peptides) ? p.peptides : []);
    const notes = Array.isArray(p.notes) ? p.notes : [];
    const tags = Array.isArray(p.tags) ? p.tags : [];
    const esc = (s) => String(s == null ? '' : s).replace(/</g, '&lt;').replace(/>/g, '&gt;');

    let bodyHTML = '';
    bodyHTML += `<button class="back-btn" onclick="navigate('protocols')"><i class="fas fa-arrow-left"></i> Back to Protocols</button>`;
    bodyHTML += `<h2 style="font-size:24px;font-weight:700;margin-bottom:6px;letter-spacing:-0.3px">${esc(p.name) || 'Protocol'}</h2>`;
    if (p.category) bodyHTML += `<div style="display:inline-block;font-size:11px;font-weight:600;color:#2563eb;background:#eff6ff;border:1px solid #bfdbfe;padding:3px 10px;border-radius:999px;margin-bottom:10px">${esc(p.category)}</div>`;
    bodyHTML += `<p style="font-size:14px;color:var(--text-secondary);line-height:1.6;margin-bottom:12px">${esc(p.description)}</p>`;

    // Meta row
    bodyHTML += `<div style="display:flex;gap:16px;margin-bottom:16px;flex-wrap:wrap">`;
    if (p.duration) bodyHTML += `<span style="font-size:12px;color:var(--text-secondary);display:flex;align-items:center;gap:5px"><i class="fas fa-clock" style="color:#2563eb"></i> ${esc(p.duration)}</span>`;
    if (compounds.length || pepList.length) bodyHTML += `<span style="font-size:12px;color:var(--text-secondary);display:flex;align-items:center;gap:5px"><i class="fas fa-flask" style="color:#8b5cf6"></i> ${(compounds.length || pepList.length)} compounds</span>`;
    bodyHTML += `</div>`;

    // Goal callout + AI button
    if (p.goal) {
      bodyHTML += `<div style="display:flex;align-items:flex-start;gap:10px;padding:14px 16px;border-radius:12px;background:#f0fdf4;border:1px solid #bbf7d0;margin-bottom:18px">
        <i class="fas fa-bullseye" style="color:#16a34a;margin-top:2px"></i>
        <div><div style="font-size:11px;font-weight:700;color:#15803d;text-transform:uppercase;letter-spacing:.4px;margin-bottom:2px">Goal</div>
        <div style="font-size:13px;color:#166534;line-height:1.5">${esc(p.goal)}</div></div></div>`;
    }
    const compoundNames = (compounds.length ? compounds.map(c => c.name) : pepList).join(', ');
    bodyHTML += `<button class="proto-ai-btn" onclick="askAboutProtocol(${JSON.stringify(esc(p.name))}, ${JSON.stringify(esc(compoundNames))})" style="display:inline-flex;align-items:center;gap:8px;font-size:13px;font-weight:600;color:#fff;background:linear-gradient(135deg,#3b82f6,#2563eb);border:none;padding:10px 16px;border-radius:10px;cursor:pointer;margin-bottom:22px;box-shadow:0 2px 8px rgba(37,99,235,.25)"><i class="fas fa-wand-magic-sparkles"></i> Ask AI about this protocol</button>`;

    // Per-compound dosing cards
    const dosed = compounds.filter(c => c.found && c.dosing);
    if (dosed.length) {
      bodyHTML += `<div class="detail-section-title" style="font-size:15px;font-weight:700;margin-bottom:12px">Dosing by Compound</div>`;
      bodyHTML += dosed.map(c => {
        const d = c.dosing || {};
        const row = (icon, label, val) => val ? `<div style="display:flex;gap:8px;font-size:12.5px;margin-bottom:6px;line-height:1.5"><span style="color:var(--text-secondary);min-width:78px;font-weight:600"><i class="fas ${icon}" style="color:#2563eb;margin-right:5px"></i>${label}</span><span style="color:var(--text-primary)">${esc(val)}</span></div>` : '';
        let protoSteps = '';
        if (Array.isArray(d.protocol) && d.protocol.length) {
          protoSteps = `<div style="margin-top:8px"><div style="font-size:11px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.3px;margin-bottom:4px">How it's commonly run</div><ul style="margin:0;padding-left:18px;font-size:12px;color:var(--text-secondary);line-height:1.55">${d.protocol.map(s => `<li>${esc(s)}</li>`).join('')}</ul></div>`;
        }
        return `<div class="proto-compound-card" style="border:1px solid var(--border);border-radius:12px;padding:14px 16px;margin-bottom:12px;background:var(--bg-card,#fff)">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px">
            <a href="/peptides/${esc(c.id)}" onclick="event.preventDefault();navigate('peptide-detail','${esc(c.id)}')" style="font-size:15px;font-weight:700;color:#2563eb;text-decoration:none">${esc(c.name)} <i class="fas fa-arrow-up-right-from-square" style="font-size:10px;opacity:.6"></i></a>
            ${c.category ? `<span style="font-size:10px;font-weight:600;color:${esc(c.categoryColor || '#6b7280')};background:rgba(0,0,0,.04);padding:2px 8px;border-radius:999px;white-space:nowrap">${esc(c.category)}</span>` : ''}
          </div>
          ${row('fa-syringe','Typical', d.typical)}
          ${row('fa-repeat','Frequency', d.frequency)}
          ${row('fa-calendar-days','Duration', d.duration)}
          ${row('fa-route','Route', d.route)}
          ${row('fa-clock','Timing', d.timing)}
          ${row('fa-rotate','Cycle', d.cycle)}
          ${protoSteps}
        </div>`;
      }).join('');
    } else if (compounds.length) {
      bodyHTML += `<div class="detail-section"><div class="detail-section-title">Compounds in this Protocol</div><div class="detail-tags">${compounds.map(c => `<a class="detail-tag" href="/peptides/${esc(c.id)}" onclick="event.preventDefault();navigate('peptide-detail','${esc(c.id)}')" style="text-decoration:none">${esc(c.name)}</a>`).join('')}</div></div>`;
    } else if (pepList.length) {
      bodyHTML += `<div class="detail-section"><div class="detail-section-title">Compounds in this Protocol</div><div class="detail-tags">${pepList.map(name => `<span class="detail-tag">${esc(name)}</span>`).join('')}</div></div>`;
    }

    if (tags.length > 0) {
      bodyHTML += `<div class="detail-section"><div class="detail-section-title">Tags</div><div class="detail-tags">${tags.map(t => `<span class="detail-tag">${esc(t)}</span>`).join('')}</div></div>`;
    }

    if (notes.length > 0) {
      bodyHTML += `<div class="proto-notes"><div class="proto-notes-title"><i class="fas fa-exclamation-triangle" style="margin-right:4px"></i> Important Notes</div><ul style="padding-left:18px">${notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul></div>`;
    }

    bodyHTML += `<div style="padding:12px 16px;border-radius:11px;background:#eff6ff;border:1px solid #bfdbfe;margin-top:20px"><p style="font-size:11px;color:#1e3a8a;line-height:1.55"><strong>Disclaimer:</strong> This protocol template combines per-compound dosing references for educational and research purposes only. It is not medical advice. Consult a licensed medical professional before using any compound.</p></div>`;

    el.innerHTML = `<div class="protocol-detail">${bodyHTML}</div>`;
  } catch(e) {
    console.error(e);
    el.innerHTML = '<div class="protocol-detail" style="padding:24px"><button class="back-btn" onclick="navigate(\'protocols\')"><i class="fas fa-arrow-left"></i> Back to Protocols</button><p style="color:#3b82f6;margin-top:12px">Failed to load protocol. Please try again.</p></div>';
  }
}

// Prefill the protocol chat advisor (fullpage sidebar on the detail page) with a question.
function askAboutProtocol(name, compounds) {
  const cmp = compounds ? ` It combines: ${compounds}.` : '';
  const q = `Walk me through the "${name}" protocol.${cmp} How are these compounds typically dosed together, what's the timing/cycling, and what are the key safety considerations?`;
  let tries = 0;
  (function attempt() {
    const input = document.getElementById('rsChatInput_fullpage');
    if (input && window.__rsChat && typeof window.__rsChat.send === 'function') {
      input.value = q;
      const btn = document.getElementById('rsChatSend_fullpage');
      if (btn) btn.disabled = false;
      try { input.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
      input.focus();
      window.__rsChat.send('fullpage');
      return;
    }
    if (tries++ < 25) setTimeout(attempt, 120);
  })();
}
window.askAboutProtocol = askAboutProtocol;

// Open the compound-detail AI chat (mobile sheet or desktop sidebar) and send a
// question about the current compound. Works across both layouts.
function askAIAboutCompound(name) {
  const q = `Explain ${name} in simple terms that anyone can understand. What is it, how does it work, how do people use it, and what should I know about safety?`;
  const isMobile = window.innerWidth <= 768 || ('ontouchstart' in window && window.innerWidth < 1024);
  let tries = 0;
  (function attempt() {
    // Prefer the mobile detail sheet on phones; fall back to the desktop sidebar.
    if (isMobile && typeof window.toggleMobileDetailChat === 'function') {
      window.toggleMobileDetailChat(true);
    }
    const id = isMobile ? 'mobiledetail' : 'detail';
    let input = document.getElementById('rsChatInput_' + id);
    // If the preferred input isn't present, try the other one.
    if (!input) input = document.getElementById('rsChatInput_detail') || document.getElementById('rsChatInput_mobiledetail');
    if (input && window.__rsChat && typeof window.__rsChat.send === 'function') {
      input.value = q;
      try { input.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
      const sendId = input.id.replace('rsChatInput_', '');
      const btn = document.getElementById('rsChatSend_' + sendId);
      if (btn) btn.disabled = false;
      try { input.focus({ preventScroll: true }); } catch (e) {}
      window.__rsChat.send(sendId);
      return;
    }
    if (tries++ < 30) setTimeout(attempt, 120);
  })();
}
window.askAIAboutCompound = askAIAboutCompound;

// ============================================================
// RESEARCH - PubMed Article Feed
// ============================================================
let researchTopics = [];
let researchQuery = 'therapeutic peptides';
let researchPage = 1;
let researchLoading = false;
let researchResults = null;

async function loadResearchTopics() {
  if (researchTopics.length > 0) return;
  try {
    const r = await fetch('/api/research/topics');
    if (!r.ok || !r.headers.get('content-type')?.includes('application/json')) return;
    researchTopics = await r.json();
  } catch(e) { console.error(e); }
}

let researchTopicExpanded = false;

function renderResearch(el) {
  loadResearchTopics().then(() => {
    // Group topics by category
    const categoryOrder = ['General', 'Healing & Recovery', 'Weight Management', 'Growth Hormone', 'Anti-Aging', 'Skin & Anti-Aging', 'Immune Support', 'Cognitive & Nootropic', 'Sexual Health', 'Muscle Growth', 'Sleep & Recovery'];
    const grouped = {};
    researchTopics.forEach(t => {
      const cat = t.category || 'General';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(t);
    });

    // Show top featured chips (one per category + general)
    const featuredIds = new Set(['general', 'bpc-157', 'semaglutide', 'tirzepatide', 'tb-500', 'ghk-cu', 'epithalon', 'thymosin-alpha-1', 'ipamorelin', 'semax', 'll-37', 'mots-c', 'pt-141', 'igf-1-lr3', 'foxo4-dri', 'dsip']);
    const featured = researchTopics.filter(t => featuredIds.has(t.id));
    const featuredChips = featured.map(t =>
      `<button class="cat-chip ${researchQuery === t.query ? 'active' : ''}" onclick="searchResearch('${t.query.replace(/'/g, "\\'")}', this)">${t.label}</button>`
    ).join('');

    // Build full category groups (shown when expanded)
    const catColors = {'Healing & Recovery':'#0ea5e9','Weight Management':'#8b5cf6','Growth Hormone':'#3b82f6','Anti-Aging':'#f59e0b','Skin & Anti-Aging':'#f59e0b','Immune Support':'#06b6d4','Cognitive & Nootropic':'#7c3aed','Sexual Health':'#ec4899','Muscle Growth':'#2563eb','Sleep & Recovery':'#6366f1','General':'#6b7280'};
    let groupedHTML = '';
    categoryOrder.forEach(cat => {
      if (!grouped[cat] || grouped[cat].length === 0) return;
      const color = catColors[cat] || '#6b7280';
      const chips = grouped[cat].map(t =>
        `<button class="cat-chip ${researchQuery === t.query ? 'active' : ''}" onclick="searchResearch('${t.query.replace(/'/g, "\\'")}', this)" style="--chip-color:${color}">${t.label}</button>`
      ).join('');
      groupedHTML += `
        <div class="research-cat-group">
          <div class="research-cat-label" style="color:${color}"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};margin-right:6px"></span>${cat} <span style="opacity:0.5;font-weight:400">(${grouped[cat].length})</span></div>
          <div class="research-cat-chips">${chips}</div>
        </div>
      `;
    });

    el.innerHTML = `
      <div class="research-view">

        <!-- PAGE HERO -->
        <div class="page-hero page-hero-teal" style="margin-bottom:20px">
          <div class="page-hero-bg">
            <div class="ph-orb ph-orb1" style="background:radial-gradient(circle,rgba(37,99,235,.35),rgba(6,182,212,.1))"></div>
            <div class="ph-orb ph-orb2" style="background:radial-gradient(circle,rgba(6,182,212,.25),rgba(37,99,235,.1))"></div>
            <div class="ph-orb ph-orb3" style="background:radial-gradient(circle,rgba(96,165,250,.2),rgba(6,182,212,.1))"></div>
            <div class="ph-grid"></div>
          </div>
          <div class="page-hero-body">
            <div class="ph-icon" style="background:rgba(37,99,235,.2);border-color:rgba(37,99,235,.3);color:#60a5fa"><i class="fas fa-newspaper"></i></div>
            <div class="ph-text">
              <h1 class="ph-title">Latest Research</h1>
              <p class="ph-sub">Real-time peer-reviewed articles from Europe PMC - <strong style="color:#fff">${researchTopics.length} peptides</strong> with live research data.</p>
            </div>
          </div>
          <div class="ph-search-row">
            <div class="ph-search-wrap">
              <i class="fas fa-search"></i>
              <input class="ph-search" id="researchSearch" placeholder="Search peptide research…" value="${esc(researchQuery)}" onkeydown="if(event.key==='Enter')searchResearchInput()">
            </div>
          </div>
        </div>
        <div class="kb-categories" id="researchTopics" style="margin-bottom:8px">
          ${featuredChips}
        </div>
        <div style="margin-bottom:16px">
          <button class="research-expand-btn" onclick="toggleResearchTopics()">
            <i class="fas ${researchTopicExpanded ? 'fa-chevron-up' : 'fa-chevron-down'}" id="expandIcon"></i>
            ${researchTopicExpanded ? 'Hide' : 'Show'} All ${researchTopics.length} Peptide Topics
          </button>
        </div>
        <div id="researchAllTopics" class="research-all-topics" style="display:${researchTopicExpanded ? 'block' : 'none'}">
          ${groupedHTML}
        </div>
        <div id="researchResults">
          ${skeletonCards(4, 'research')}
        </div>
      </div>
      <div class="disclaimer"><i class="fas fa-info-circle" style="margin-right:4px"></i> Articles sourced from Europe PMC. PeptideSafe does not host or modify research content.</div>
    `;
    fetchResearch(researchQuery);
  });
}

function toggleResearchTopics() {
  researchTopicExpanded = !researchTopicExpanded;
  const panel = document.getElementById('researchAllTopics');
  const icon = document.getElementById('expandIcon');
  const btn = document.querySelector('.research-expand-btn');
  if (panel) panel.style.display = researchTopicExpanded ? 'block' : 'none';
  if (icon) { icon.className = researchTopicExpanded ? 'fas fa-chevron-up' : 'fas fa-chevron-down'; }
  if (btn) btn.innerHTML = `<i class="fas ${researchTopicExpanded ? 'fa-chevron-up' : 'fa-chevron-down'}" id="expandIcon"></i> ${researchTopicExpanded ? 'Hide' : 'Show'} All ${researchTopics.length} Peptide Topics`;
}

function searchResearch(query, btn) {
  researchQuery = query;
  researchPage = 1;
  // Update active chip across both featured and category groups
  document.querySelectorAll('#researchTopics .cat-chip, .research-cat-chips .cat-chip').forEach(c => c.classList.remove('active'));
  if (btn) btn.classList.add('active');
  // Update search input
  const input = document.getElementById('researchSearch');
  if (input) input.value = query;
  fetchResearch(query);
}

function searchResearchInput() {
  const input = document.getElementById('researchSearch');
  if (!input || !input.value.trim()) return;
  researchQuery = input.value.trim();
  researchPage = 1;
  // Deactivate all chips across both sections
  document.querySelectorAll('#researchTopics .cat-chip, .research-cat-chips .cat-chip').forEach(c => c.classList.remove('active'));
  fetchResearch(researchQuery);
}

async function fetchResearch(query, page = 1, cursor = '*') {
  if (researchLoading) return;
  researchLoading = true;
  const container = document.getElementById('researchResults');
  if (!container) return;

  if (cursor === '*') {
    container.innerHTML = skeletonCards(4, 'research');
  }

  try {
    let res = await fetch(`/api/research?q=${encodeURIComponent(query)}&page=${page}&per_page=10&cursor=${encodeURIComponent(cursor)}`);
    if (!res.ok) res = await fetch(`https://researchsafe.org/api/research?q=${encodeURIComponent(query)}&page=${page}&per_page=10&cursor=${encodeURIComponent(cursor)}`);
    const data = await res.json();
    researchResults = data;
    researchPage = page;

    if (data.error) {
      container.innerHTML = `<div style="text-align:center;padding:40px;color:#3b82f6"><i class="fas fa-exclamation-circle" style="margin-right:6px"></i>${data.error}</div>`;
      researchLoading = false;
      return;
    }

    if (data.articles.length === 0) {
      container.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-muted)"><i class="fas fa-search" style="font-size:20px;margin-bottom:10px;display:block;opacity:0.5"></i>No articles found for "${esc(query)}". Try a different search term.</div>`;
      researchLoading = false;
      return;
    }

    const articleCards = data.articles.map(a => `
      <div class="research-card">
        <div class="research-card-header">
          <span class="research-journal"><i class="fas fa-book-medical" style="margin-right:4px;opacity:0.5"></i>${esc(a.journal)}</span>
          <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
            ${a.isOpenAccess ? '<span class="research-oa-badge"><i class="fas fa-unlock" style="margin-right:3px"></i>Open Access</span>' : ''}
            ${a.citedBy > 0 ? `<span class="research-cited"><i class="fas fa-quote-right" style="margin-right:3px;opacity:0.5"></i>Cited: ${a.citedBy}</span>` : ''}
            <span class="research-date"><i class="fas fa-calendar" style="margin-right:4px;opacity:0.5"></i>${esc(a.pubDate)}</span>
          </div>
        </div>
        <a href="${a.url}" target="_blank" rel="noopener noreferrer" class="research-title">${esc(a.title)}</a>
        <div class="research-authors">${esc(a.authors.length > 120 ? a.authors.substring(0, 120) + '...' : a.authors)}</div>
        <div class="research-card-footer">
          <span class="research-pmid">PMID: ${a.pmid}</span>
          ${a.doi ? `<span class="research-doi">${esc(a.doi)}</span>` : ''}
          <div style="display:flex;gap:8px;margin-left:auto">
            ${a.pmcUrl ? `<a href="${a.pmcUrl}" target="_blank" rel="noopener noreferrer" class="research-link"><i class="fas fa-file-alt" style="margin-right:3px"></i>PMC</a>` : ''}
            ${a.pubmedUrl ? `<a href="${a.pubmedUrl}" target="_blank" rel="noopener noreferrer" class="research-link"><i class="fas fa-external-link-alt" style="margin-right:3px"></i>PubMed</a>` : ''}
            ${a.doiUrl && !a.pubmedUrl ? `<a href="${a.doiUrl}" target="_blank" rel="noopener noreferrer" class="research-link"><i class="fas fa-external-link-alt" style="margin-right:3px"></i>DOI</a>` : ''}
          </div>
        </div>
      </div>
    `).join('');

    const totalPages = Math.ceil(data.total / data.perPage);
    const pagination = data.total > 0 ? `
      <div class="research-pagination">
        <span class="research-total">${data.total.toLocaleString()} results found</span>
        <div class="research-page-btns">
          ${data.articles.length === data.perPage && data.nextCursor ? `<button class="research-page-btn" onclick="fetchResearchNext('${query.replace(/'/g, "\\'")}', '${data.nextCursor}')">Load More <i class="fas fa-chevron-right"></i></button>` : ''}
        </div>
      </div>
    ` : '';

    container.innerHTML = articleCards + pagination;
  } catch(e) {
    console.error(e);
    container.innerHTML = `<div style="text-align:center;padding:40px;color:#3b82f6"><i class="fas fa-exclamation-circle" style="margin-right:6px"></i>Failed to load articles. Please try again.</div>`;
  }
  researchLoading = false;
}

function openResearchForPeptide(name) {
  researchQuery = name;
  researchPage = 1;
  navigate('research');
}

async function fetchResearchNext(query, cursor) {
  if (researchLoading) return;
  researchLoading = true;
  const container = document.getElementById('researchResults');
  if (!container) { researchLoading = false; return; }

  // Remove old pagination
  const oldPagination = container.querySelector('.research-pagination');
  if (oldPagination) {
    oldPagination.innerHTML = '<div style="text-align:center;padding:10px"><i class="fas fa-spinner fa-spin" style="opacity:0.5"></i> Loading more...</div>';
  }

  try {
    let res = await fetch(`/api/research?q=${encodeURIComponent(query)}&per_page=10&cursor=${encodeURIComponent(cursor)}`);
    if (!res.ok) res = await fetch(`https://researchsafe.org/api/research?q=${encodeURIComponent(query)}&per_page=10&cursor=${encodeURIComponent(cursor)}`);
    const data = await res.json();

    if (data.articles.length > 0) {
      // Remove old pagination
      if (oldPagination) oldPagination.remove();

      // Append new articles
      const articleCards = data.articles.map(a => `
        <div class="research-card">
          <div class="research-card-header">
            <span class="research-journal"><i class="fas fa-book-medical" style="margin-right:4px;opacity:0.5"></i>${esc(a.journal)}</span>
            <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
              ${a.isOpenAccess ? '<span class="research-oa-badge"><i class="fas fa-unlock" style="margin-right:3px"></i>Open Access</span>' : ''}
              ${a.citedBy > 0 ? `<span class="research-cited"><i class="fas fa-quote-right" style="margin-right:3px;opacity:0.5"></i>Cited: ${a.citedBy}</span>` : ''}
              <span class="research-date"><i class="fas fa-calendar" style="margin-right:4px;opacity:0.5"></i>${esc(a.pubDate)}</span>
            </div>
          </div>
          <a href="${a.url}" target="_blank" rel="noopener noreferrer" class="research-title">${esc(a.title)}</a>
          <div class="research-authors">${esc(a.authors.length > 120 ? a.authors.substring(0, 120) + '...' : a.authors)}</div>
          <div class="research-card-footer">
            <span class="research-pmid">PMID: ${a.pmid}</span>
            ${a.doi ? `<span class="research-doi">${esc(a.doi)}</span>` : ''}
            <div style="display:flex;gap:8px;margin-left:auto">
              ${a.pmcUrl ? `<a href="${a.pmcUrl}" target="_blank" rel="noopener noreferrer" class="research-link"><i class="fas fa-file-alt" style="margin-right:3px"></i>PMC</a>` : ''}
              ${a.pubmedUrl ? `<a href="${a.pubmedUrl}" target="_blank" rel="noopener noreferrer" class="research-link"><i class="fas fa-external-link-alt" style="margin-right:3px"></i>PubMed</a>` : ''}
              ${a.doiUrl && !a.pubmedUrl ? `<a href="${a.doiUrl}" target="_blank" rel="noopener noreferrer" class="research-link"><i class="fas fa-external-link-alt" style="margin-right:3px"></i>DOI</a>` : ''}
            </div>
          </div>
        </div>
      `).join('');

      // Add new pagination
      const newPagination = data.articles.length === 10 && data.nextCursor ? `
        <div class="research-pagination">
          <span class="research-total">${data.total.toLocaleString()} results found</span>
          <div class="research-page-btns">
            <button class="research-page-btn" onclick="fetchResearchNext('${query.replace(/'/g, "\\'")}', '${data.nextCursor}')">Load More <i class="fas fa-chevron-right"></i></button>
          </div>
        </div>
      ` : '';

      container.insertAdjacentHTML('beforeend', articleCards + newPagination);
    }
  } catch(e) {
    console.error(e);
  }
  researchLoading = false;
}

// ============================================================
// VIDEOS - YouTube Video Library
// ============================================================
let videoTopics = [];
let videoQuery = 'peptide therapy research';
let videoLoading = false;
let videoTopicExpanded = false;
let videoSort = 'relevance';
let videoContinuation = null;
let videoTotalLoaded = 0;

async function loadVideoTopics() {
  if (videoTopics.length > 0) return;
  try {
    const r = await fetch('/api/videos/topics');
    if (!r.ok || !r.headers.get('content-type')?.includes('application/json')) return;
    videoTopics = await r.json();
  } catch(e) { console.error(e); }
}

function renderVideos(el) {
  loadVideoTopics().then(() => {
    // Featured topic chips
    const featuredIds = new Set(['general', 'bpc-157', 'semaglutide', 'tirzepatide', 'tb-500', 'ghk-cu', 'epithalon', 'ipamorelin', 'mk-677', 'semax', 'pt-141', 'sermorelin', 'retatrutide', 'foxo4-dri', 'mots-c']);
    const featured = videoTopics.filter(t => featuredIds.has(t.id));
    const featuredChips = featured.map(t =>
      `<button class="cat-chip ${videoQuery === t.query ? 'active' : ''}" onclick="searchVideos('${t.query.replace(/'/g, "\\'")}', this)">${t.label}</button>`
    ).join('');

    // Category-grouped chips
    const categoryOrder = ['General', 'Healing & Recovery', 'Weight Management', 'Growth Hormone', 'Anti-Aging', 'Skin & Anti-Aging', 'Immune Support', 'Cognitive & Nootropic', 'Sexual Health', 'Muscle Growth', 'Sleep & Recovery'];
    const catColors = {'Healing & Recovery':'#0ea5e9','Weight Management':'#8b5cf6','Growth Hormone':'#3b82f6','Anti-Aging':'#f59e0b','Skin & Anti-Aging':'#f59e0b','Immune Support':'#06b6d4','Cognitive & Nootropic':'#7c3aed','Sexual Health':'#ec4899','Muscle Growth':'#2563eb','Sleep & Recovery':'#6366f1','General':'#6b7280'};
    const grouped = {};
    videoTopics.forEach(t => {
      const cat = t.category || 'General';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(t);
    });
    let groupedHTML = '';
    categoryOrder.forEach(cat => {
      if (!grouped[cat] || grouped[cat].length === 0) return;
      const color = catColors[cat] || '#6b7280';
      const chips = grouped[cat].map(t =>
        `<button class="cat-chip ${videoQuery === t.query ? 'active' : ''}" onclick="searchVideos('${t.query.replace(/'/g, "\\'")}', this)" style="--chip-color:${color}">${t.label}</button>`
      ).join('');
      groupedHTML += `<div class="research-cat-group"><div class="research-cat-label" style="color:${color}"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};margin-right:6px"></span>${cat} <span style="opacity:0.5;font-weight:400">(${grouped[cat].length})</span></div><div class="research-cat-chips">${chips}</div></div>`;
    });

    el.innerHTML = `
      <div class="research-view video-view">

        <!-- PAGE HERO -->
        <div class="page-hero page-hero-red" style="margin-bottom:20px">
          <div class="page-hero-bg">
            <div class="ph-orb ph-orb1" style="background:radial-gradient(circle,rgba(239,68,68,.35),rgba(220,38,38,.1))"></div>
            <div class="ph-orb ph-orb2" style="background:radial-gradient(circle,rgba(220,38,38,.25),rgba(239,68,68,.1))"></div>
            <div class="ph-orb ph-orb3" style="background:radial-gradient(circle,rgba(252,165,165,.2),rgba(239,68,68,.1))"></div>
            <div class="ph-grid"></div>
          </div>
          <div class="page-hero-body">
            <div class="ph-icon" style="background:rgba(239,68,68,.2);border-color:rgba(239,68,68,.3);color:#f87171"><i class="fab fa-youtube"></i></div>
            <div class="ph-text">
              <h1 class="ph-title">Video Library</h1>
              <p class="ph-sub">Live YouTube videos on peptide education, dosing, and protocols - <strong style="color:#fff">${videoTopics.length} topics</strong> available.</p>
            </div>
          </div>
          <div class="ph-search-row">
            <div class="ph-search-wrap">
              <i class="fas fa-search"></i>
              <input class="ph-search" id="videoSearch" placeholder="Search YouTube for peptide videos…" value="${esc(videoQuery)}" onkeydown="if(event.key==='Enter')searchVideoInput()">
            </div>
          </div>
        </div>
        <div class="kb-categories" id="videoTopicChips" style="margin-bottom:8px">
          ${featuredChips}
        </div>
        <div style="display:flex;gap:10px;align-items:center;margin-bottom:16px;flex-wrap:wrap">
          <button class="research-expand-btn" onclick="toggleVideoTopics()">
            <i class="fas ${videoTopicExpanded ? 'fa-chevron-up' : 'fa-chevron-down'}" id="vidExpandIcon"></i>
            ${videoTopicExpanded ? 'Hide' : 'Show'} All ${videoTopics.length} Topics
          </button>
          <div class="video-sort-group">
            <button class="video-sort-btn ${videoSort === 'relevance' ? 'active' : ''}" onclick="setVideoSort('relevance')">Relevant</button>
            <button class="video-sort-btn ${videoSort === 'date' ? 'active' : ''}" onclick="setVideoSort('date')">Newest</button>
            <button class="video-sort-btn ${videoSort === 'views' ? 'active' : ''}" onclick="setVideoSort('views')">Most Viewed</button>
          </div>
        </div>
        <div id="videoAllTopics" class="research-all-topics" style="display:${videoTopicExpanded ? 'block' : 'none'}">
          ${groupedHTML}
        </div>
        <div id="videoResults">
          ${skeletonCards(6, 'video')}
        </div>
      </div>
      <div class="disclaimer"><i class="fas fa-info-circle" style="margin-right:4px"></i> Videos sourced from YouTube. PeptideSafe does not host or endorse video content. For educational reference only.</div>
    `;
    fetchVideos(videoQuery, videoSort);
  });
}

function toggleVideoTopics() {
  videoTopicExpanded = !videoTopicExpanded;
  const panel = document.getElementById('videoAllTopics');
  const icon = document.getElementById('vidExpandIcon');
  if (panel) panel.style.display = videoTopicExpanded ? 'block' : 'none';
  if (icon) icon.className = videoTopicExpanded ? 'fas fa-chevron-up' : 'fas fa-chevron-down';
}

function setVideoSort(sort) {
  videoSort = sort;
  document.querySelectorAll('.video-sort-btn').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
  fetchVideos(videoQuery, sort);
}

function searchVideos(query, btn) {
  videoQuery = query;
  document.querySelectorAll('#videoTopicChips .cat-chip, #videoAllTopics .cat-chip').forEach(c => c.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const input = document.getElementById('videoSearch');
  if (input) input.value = query;
  fetchVideos(query, videoSort);
}

function searchVideoInput() {
  const input = document.getElementById('videoSearch');
  if (!input || !input.value.trim()) return;
  videoQuery = input.value.trim();
  document.querySelectorAll('#videoTopicChips .cat-chip, #videoAllTopics .cat-chip').forEach(c => c.classList.remove('active'));
  fetchVideos(videoQuery, videoSort);
}

function openVideosForPeptide(name) {
  videoQuery = name + ' peptide';
  navigate('videos');
}

async function fetchVideos(query, sort) {
  if (videoLoading) return;
  videoLoading = true;
  videoContinuation = null;
  videoTotalLoaded = 0;
  const container = document.getElementById('videoResults');
  if (!container) { videoLoading = false; return; }

  container.innerHTML = skeletonCards(6, 'video');

  try {
    let res = await fetch(`/api/videos?q=${encodeURIComponent(query)}&sort=${sort}`);
    if (!res.ok) res = await fetch(`https://researchsafe.org/api/videos?q=${encodeURIComponent(query)}&sort=${sort}`);
    const data = await res.json();

    if (data.error) {
      if (data.configRequired) {
        container.innerHTML = `<div style="text-align:center;padding:60px 20px;color:var(--text-muted)">
          <i class="fab fa-youtube" style="font-size:48px;margin-bottom:16px;display:block;color:#ff0000;opacity:0.4"></i>
          <div style="font-size:16px;font-weight:600;margin-bottom:8px;color:var(--text-primary)">YouTube API Not Configured</div>
          <div style="font-size:14px;max-width:400px;margin:0 auto;line-height:1.6">
            A YouTube Data API key is required to load videos.<br>
            Add <code style="background:var(--bg-hover);padding:2px 6px;border-radius:4px">YOUTUBE_API_KEY</code> to your Cloudflare Pages secrets to enable this feature.
          </div>
        </div>`;
      } else {
        container.innerHTML = `<div style="text-align:center;padding:40px;color:#3b82f6"><i class="fas fa-exclamation-circle" style="margin-right:6px"></i>${data.error}</div>`;
      }
      videoLoading = false;
      return;
    }

    if (data.videos.length === 0) {
      container.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-muted)"><i class="fab fa-youtube" style="font-size:24px;margin-bottom:10px;display:block;opacity:0.3"></i>No videos found for "${esc(query)}". Try a different search term.</div>`;
      videoLoading = false;
      return;
    }

    videoContinuation = data.continuation || null;
    videoTotalLoaded = data.videos.length;

    const videoCards = data.videos.map(v => buildVideoCard(v)).join('');

    container.innerHTML = `
      <div class="video-count" id="videoCount">${videoTotalLoaded} videos loaded for "${esc(query)}"</div>
      <div class="video-grid" id="videoGrid">${videoCards}</div>
      ${videoContinuation ? buildLoadMoreBtn() : ''}
    `;
  } catch(e) {
    console.error(e);
    container.innerHTML = `<div style="text-align:center;padding:40px;color:#3b82f6"><i class="fas fa-exclamation-circle" style="margin-right:6px"></i>Failed to load videos. Please try again.</div>`;
  }
  videoLoading = false;
}

function buildVideoCard(v) {
  const isFav = isVideoFavorite(v.id);
  const safeTitle = esc(v.title).replace(/'/g, '&#39;').replace(/"/g, '&quot;');
  const safeChannel = esc(v.channel).replace(/'/g, '&#39;').replace(/"/g, '&quot;');
  const safeThumb = esc(v.thumbnail).replace(/'/g, '&#39;').replace(/"/g, '&quot;');
  const safeLen = v.length ? esc(v.length).replace(/'/g, '&#39;') : '';
  const safeUrl = esc(v.url).replace(/'/g, '&#39;').replace(/"/g, '&quot;');
  return `
    <div class="video-card" onclick="playVideo('${v.id}', this)">
      <div class="video-thumb-wrap">
        <img class="video-thumb" src="${v.thumbnail}" alt="${esc(v.title)}" loading="lazy">
        ${v.length ? `<span class="video-duration">${esc(v.length)}</span>` : ''}
        <div class="video-play-overlay"><i class="fas fa-play"></i></div>
        <button class="video-fav-btn ${isFav ? 'video-fav-active' : ''}" data-vid="${v.id}" onclick="event.stopPropagation(); toggleVideoFavorite('${v.id}', '${safeTitle}', '${safeChannel}', '${safeThumb}', '${safeLen}', '${safeUrl}')" title="${isFav ? 'Remove from favorites' : 'Save video'}"><i class="fas fa-heart"></i></button>
      </div>
      <div class="video-info">
        <div class="video-title">${esc(v.title)}</div>
        <div class="video-channel"><i class="fas fa-user-circle" style="margin-right:4px;opacity:0.4"></i>${esc(v.channel)}</div>
        <div class="video-meta">
          ${v.views ? `<span><i class="fas fa-eye" style="margin-right:3px;opacity:0.4"></i>${esc(v.views)}</span>` : ''}
          ${v.published ? `<span><i class="fas fa-clock" style="margin-right:3px;opacity:0.4"></i>${esc(v.published)}</span>` : ''}
        </div>
      </div>
    </div>`;
}

function buildLoadMoreBtn() {
  return `<div class="video-load-more-wrap" id="videoLoadMore">
    <button class="research-page-btn video-load-more-btn" onclick="fetchMoreVideos()">
      <i class="fas fa-plus" style="margin-right:6px"></i>Load More Videos
    </button>
  </div>`;
}

async function fetchMoreVideos() {
  if (videoLoading || !videoContinuation) return;
  videoLoading = true;

  const btn = document.querySelector('.video-load-more-btn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-right:6px"></i>Loading...';
  }

  try {
    let res = await fetch(`/api/videos?q=${encodeURIComponent(videoQuery)}&sort=${videoSort}&continuation=${encodeURIComponent(videoContinuation)}`);
    if (!res.ok) res = await fetch(`https://researchsafe.org/api/videos?q=${encodeURIComponent(videoQuery)}&sort=${videoSort}&continuation=${encodeURIComponent(videoContinuation)}`);
    const data = await res.json();

    if (data.error || data.videos.length === 0) {
      // No more results - remove the load more button
      const loadMoreEl = document.getElementById('videoLoadMore');
      if (loadMoreEl) loadMoreEl.remove();
      videoLoading = false;
      return;
    }

    videoContinuation = data.continuation || null;
    videoTotalLoaded += data.videos.length;

    // Append new video cards to the grid
    const grid = document.getElementById('videoGrid');
    if (grid) {
      const newCards = data.videos.map(v => buildVideoCard(v)).join('');
      grid.insertAdjacentHTML('beforeend', newCards);
    }

    // Update count text
    const countEl = document.getElementById('videoCount');
    if (countEl) countEl.textContent = `${videoTotalLoaded} videos loaded for "${videoQuery}"`;

    // Update or remove load more button
    const loadMoreEl = document.getElementById('videoLoadMore');
    if (loadMoreEl) {
      if (videoContinuation) {
        loadMoreEl.innerHTML = `<button class="research-page-btn video-load-more-btn" onclick="fetchMoreVideos()">
          <i class="fas fa-plus" style="margin-right:6px"></i>Load More Videos
        </button>`;
      } else {
        loadMoreEl.innerHTML = `<div style="text-align:center;padding:16px;color:var(--text-muted);font-size:13px"><i class="fas fa-check-circle" style="margin-right:4px"></i>All available videos loaded</div>`;
      }
    }
  } catch(e) {
    console.error(e);
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-exclamation-circle" style="margin-right:6px"></i>Retry Load More';
    }
  }
  videoLoading = false;
}

function playVideo(videoId, cardEl) {
  // Toggle embed if already open
  if (cardEl.querySelector('.video-embed-wrap')) {
    cardEl.querySelector('.video-embed-wrap').remove();
    cardEl.classList.remove('video-card-expanded');
    return;
  }

  // Close any other open embeds
  document.querySelectorAll('.video-embed-wrap').forEach(e => e.remove());
  document.querySelectorAll('.video-card-expanded').forEach(e => e.classList.remove('video-card-expanded'));

  // Create embed
  const embed = document.createElement('div');
  embed.className = 'video-embed-wrap';
  embed.innerHTML = `
    <iframe
      src="https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0"
      frameborder="0"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowfullscreen
    ></iframe>
    <div class="video-embed-actions">
      <a href="https://www.youtube.com/watch?v=${videoId}" target="_blank" rel="noopener noreferrer" class="video-embed-link">
        <i class="fab fa-youtube" style="margin-right:4px"></i>Open on YouTube
      </a>
      <button class="video-embed-close" onclick="event.stopPropagation(); this.closest('.video-embed-wrap').remove(); this.closest('.video-card').classList.remove('video-card-expanded')">
        <i class="fas fa-times" style="margin-right:4px"></i>Close
      </button>
    </div>
  `;

  cardEl.classList.add('video-card-expanded');
  cardEl.appendChild(embed);
  setTimeout(() => cardEl.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
}

// ============================================================
// FEATURE #2: FAVORITES / BOOKMARKS (localStorage)
// ============================================================
function getFavorites() {
  try { return JSON.parse(localStorage.getItem('peptideai_favorites') || '[]'); } catch { return []; }
}
function isFavorite(id) { return getFavorites().includes(id); }
function toggleFavorite(id) {
  // Require sign-in to save favorites
  if (!window.currentUser) {
    openAuthModal('register', 'favorite');
    return;
  }
  let favs = getFavorites();
  if (favs.includes(id)) { favs = favs.filter(f => f !== id); } else { favs.push(id); }
  localStorage.setItem('peptideai_favorites', JSON.stringify(favs));
  scheduleSyncPush();
  // Re-render star buttons in current view
  document.querySelectorAll(`.fav-star`).forEach(btn => {
    const pid = btn.getAttribute('onclick')?.match(/'([^']+)'/)?.[1];
    if (pid) btn.classList.toggle('fav-active', favs.includes(pid));
  });
}

let favTab = 'peptides';
function renderFavorites(el) {
  const favIds = getFavorites();
  const favPeptides = peptides.filter(p => favIds.includes(p.id));
  const favVideos = getVideoFavorites();
  const pepCount = favPeptides.length;
  const vidCount = favVideos.length;

  el.innerHTML = `
    <div class="kb-view">
      <!-- PAGE HERO -->
      <div class="page-hero page-hero-amber" style="margin-bottom:20px">
        <div class="page-hero-bg">
          <div class="ph-orb ph-orb1" style="background:radial-gradient(circle,rgba(245,158,11,.35),rgba(217,119,6,.1))"></div>
          <div class="ph-orb ph-orb2" style="background:radial-gradient(circle,rgba(217,119,6,.25),rgba(251,191,36,.1))"></div>
          <div class="ph-orb ph-orb3" style="background:radial-gradient(circle,rgba(251,191,36,.2),rgba(245,158,11,.1))"></div>
          <div class="ph-grid"></div>
        </div>
        <div class="page-hero-body">
          <div class="ph-icon" style="background:rgba(245,158,11,.2);border-color:rgba(245,158,11,.3);color:#fbbf24"><i class="fas fa-star"></i></div>
          <div class="ph-text">
            <h1 class="ph-title">My Favorites</h1>
            <p class="ph-sub">${pepCount + vidCount > 0 ? `${pepCount} saved peptide${pepCount !== 1 ? 's' : ''} and ${vidCount} saved video${vidCount !== 1 ? 's' : ''} in your collection.` : 'Save peptides and videos to build your personal collection.'}</p>
          </div>
          <div class="ph-stats">
            <div class="ph-stat"><div class="ph-stat-n">${pepCount}</div><div class="ph-stat-l">Peptides</div></div>
            <div class="ph-stat"><div class="ph-stat-n">${vidCount}</div><div class="ph-stat-l">Videos</div></div>
          </div>
        </div>
      </div>
      <div class="fav-tabs">
        <button class="fav-tab ${favTab === 'peptides' ? 'fav-tab-active' : ''}" onclick="favTab='peptides'; navigate('favorites')">
          <i class="fas fa-flask" style="margin-right:5px"></i>Peptides <span class="fav-tab-count">${pepCount}</span>
        </button>
        <button class="fav-tab ${favTab === 'videos' ? 'fav-tab-active' : ''}" onclick="favTab='videos'; navigate('favorites')">
          <i class="fas fa-heart" style="margin-right:5px"></i>Videos <span class="fav-tab-count">${vidCount}</span>
        </button>
      </div>
      ${favTab === 'peptides' ? `
        <div class="kb-grid" id="favGrid">
          ${pepCount > 0 ? favPeptides.map(p => `
            <div class="peptide-card ripple-container" onclick="openPeptideDetail('${p.id}')">
              <button class="fav-star fav-active" onclick="event.stopPropagation(); toggleFavorite('${p.id}'); navigate('favorites')" title="Remove from favorites"><i class="fas fa-star"></i></button>
              <div class="pc-top">
                <span class="pc-badge" style="--cat:${p.categoryColor}">${p.category}</span>
              </div>
              <div class="pc-name">${p.name}</div>
              <div class="pc-desc">${p.description}</div>
              <div class="pc-tags">${p.tags.slice(0,4).map(t => `<span class="pc-tag">${t}</span>`).join('')}</div>
            </div>
          `).join('') : `
            <div style="grid-column:1/-1;text-align:center;padding:60px 20px">
              <i class="fas fa-flask" style="font-size:40px;color:var(--border);margin-bottom:16px;display:block"></i>
              <p style="font-size:15px;font-weight:600;color:var(--text-secondary);margin-bottom:8px">No saved peptides</p>
              <p style="font-size:13px;color:var(--text-muted);margin-bottom:20px">Browse the Knowledge Base and click the ★ on any peptide card to save it here.</p>
              <button class="compare-btn" onclick="navigate('knowledge')"><i class="fas fa-book-open" style="margin-right:5px"></i>Browse Knowledge Base</button>
            </div>
          `}
        </div>
      ` : `
        <div class="video-grid" id="favVideoGrid" style="margin-top:4px">
          ${vidCount > 0 ? favVideos.map(v => `
            <div class="video-card" onclick="playVideo('${v.id}', this)">
              <div class="video-thumb-wrap">
                <img class="video-thumb" src="${v.thumbnail}" alt="${esc(v.title)}" loading="lazy">
                ${v.length ? `<span class="video-duration">${esc(v.length)}</span>` : ''}
                <div class="video-play-overlay"><i class="fas fa-play"></i></div>
                <button class="video-fav-btn video-fav-active" data-vid="${v.id}" onclick="event.stopPropagation(); removeVideoFavorite('${v.id}')" title="Remove from favorites"><i class="fas fa-heart"></i></button>
              </div>
              <div class="video-info">
                <div class="video-title">${esc(v.title)}</div>
                <div class="video-channel"><i class="fas fa-user-circle" style="margin-right:4px;opacity:0.4"></i>${esc(v.channel)}</div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px">
                  <a href="${v.url}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()" style="font-size:11px;color:var(--teal);text-decoration:none;font-weight:600"><i class="fab fa-youtube" style="margin-right:3px"></i>Watch on YouTube</a>
                </div>
              </div>
            </div>
          `).join('') : `
            <div style="grid-column:1/-1;text-align:center;padding:60px 20px">
              <i class="fas fa-heart" style="font-size:40px;color:var(--border);margin-bottom:16px;display:block"></i>
              <p style="font-size:15px;font-weight:600;color:var(--text-secondary);margin-bottom:8px">No saved videos</p>
              <p style="font-size:13px;color:var(--text-muted);margin-bottom:20px">Browse the Video Library and click the <i class="fas fa-heart" style="color:#ef4444"></i> on any video to save it here.</p>
              <button class="compare-btn" onclick="navigate('videos')"><i class="fab fa-youtube" style="margin-right:5px"></i>Browse Video Library</button>
            </div>
          `}
        </div>
      `}
    </div>
    <div class="disclaimer"><i class="fas fa-info-circle" style="margin-right:4px"></i> Favorites are stored locally in your browser.</div>
  `;
}

function removeVideoFavorite(videoId) {
  let favs = getVideoFavorites();
  favs = favs.filter(v => v.id !== videoId);
  localStorage.setItem('peptideai_video_favorites', JSON.stringify(favs));
  navigate('favorites');
}

// ============================================================
// VIDEO FAVORITES (localStorage)
// ============================================================
function getVideoFavorites() {
  try { return JSON.parse(localStorage.getItem('peptideai_video_favorites') || '[]'); } catch { return []; }
}
function isVideoFavorite(videoId) {
  return getVideoFavorites().some(v => v.id === videoId);
}
function toggleVideoFavorite(videoId, title, channel, thumbnail, length, url) {
  // Require sign-in to save video favorites
  if (!window.currentUser) {
    openAuthModal('register', 'favorite');
    return;
  }
  let favs = getVideoFavorites();
  const idx = favs.findIndex(v => v.id === videoId);
  if (idx >= 0) {
    favs.splice(idx, 1);
  } else {
    favs.unshift({ id: videoId, title, channel, thumbnail, length, url, savedAt: Date.now() });
  }
  localStorage.setItem('peptideai_video_favorites', JSON.stringify(favs));
  scheduleSyncPush();
  // Update all heart buttons for this video
  document.querySelectorAll(`.video-fav-btn[data-vid="${videoId}"]`).forEach(btn => {
    const isFav = favs.some(v => v.id === videoId);
    btn.classList.toggle('video-fav-active', isFav);
    btn.innerHTML = `<i class="fas fa-heart"></i>`;
  });
}

// ============================================================
// FEATURE #3: GLOBAL SPOTLIGHT SEARCH (Ctrl+K)
// ============================================================
function openSpotlight() {
  const overlay = document.getElementById('spotlightOverlay');
  if (!overlay) return;
  overlay.style.display = 'flex';
  requestAnimationFrame(() => {
    overlay.classList.add('open');
    document.getElementById('spotlightInput')?.focus();
  });
}
function closeSpotlight() {
  const overlay = document.getElementById('spotlightOverlay');
  if (!overlay) return;
  overlay.classList.remove('open');
  setTimeout(() => { overlay.style.display = 'none'; }, 200);
}

function onSpotlightInput(query) {
  const results = document.getElementById('spotlightResults');
  if (!results) return;
  if (!query.trim()) { results.innerHTML = `<div class="spotlight-empty"><i class="fas fa-search" style="opacity:0.3;font-size:18px;margin-bottom:8px;display:block"></i>Type to search across peptides, protocols, and topics</div>`; return; }
  const q = query.toLowerCase();
  // Search peptides
  const pepMatches = peptides.filter(p =>
    p.name.toLowerCase().includes(q) || p.fullName?.toLowerCase().includes(q) || p.category.toLowerCase().includes(q) || p.tags.some(t => t.toLowerCase().includes(q))
  ).slice(0, 5);
  // Search protocols
  const protoMatches = protocols.filter(p =>
    p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q) || p.peptides.some(pp => pp.toLowerCase().includes(q))
  ).slice(0, 3);
  // Build results
  let html = '';
  if (pepMatches.length > 0) {
    html += `<div class="spotlight-group-label">Peptides</div>`;
    html += pepMatches.map(p => `
      <button class="spotlight-result" onclick="closeSpotlight(); navigate('peptide-detail', '${p.id}')">
        <span class="pc-badge" style="--cat:${p.categoryColor};font-size:9px;padding:2px 7px">${p.category}</span>
        <span class="spotlight-result-name">${highlightMatch(p.name, query)}</span>
        <span class="spotlight-result-sub">${p.molecularWeight || ''}</span>
        <i class="fas fa-arrow-right spotlight-result-arrow"></i>
      </button>
    `).join('');
  }
  if (protoMatches.length > 0) {
    html += `<div class="spotlight-group-label">Protocols</div>`;
    html += protoMatches.map(p => `
      <button class="spotlight-result" onclick="closeSpotlight(); navigate('protocol-detail', '${p.id}')">
        <i class="fas fa-clipboard-list" style="color:var(--text-muted);font-size:12px"></i>
        <span class="spotlight-result-name">${highlightMatch(p.name, query)}</span>
        <span class="spotlight-result-sub">${p.duration}</span>
        <i class="fas fa-arrow-right spotlight-result-arrow"></i>
      </button>
    `).join('');
  }
  // Quick actions
  html += `<div class="spotlight-group-label">Quick Actions</div>`;
  html += `<button class="spotlight-result" onclick="closeSpotlight(); researchQuery='${esc(query)}'; navigate('research')"><i class="fas fa-newspaper" style="color:var(--text-muted);font-size:12px"></i><span class="spotlight-result-name">Search Research for "${esc(query)}"</span><i class="fas fa-arrow-right spotlight-result-arrow"></i></button>`;
  html += `<button class="spotlight-result" onclick="closeSpotlight(); videoQuery='${esc(query)}'; navigate('videos')"><i class="fab fa-youtube" style="color:var(--text-muted);font-size:12px"></i><span class="spotlight-result-name">Search Videos for "${esc(query)}"</span><i class="fas fa-arrow-right spotlight-result-arrow"></i></button>`;
  if (pepMatches.length === 0 && protoMatches.length === 0) {
    html = `<div class="spotlight-empty">No peptide or protocol matches. Try the quick actions below.</div>` + html;
  }
  results.innerHTML = html;
}

function highlightMatch(text, query) {
  if (!query) return esc(text);
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return esc(text);
  return esc(text.substring(0, idx)) + `<mark>${esc(text.substring(idx, idx + query.length))}</mark>` + esc(text.substring(idx + query.length));
}

// ============================================================
// FEATURE #4: FULL PEPTIDE DETAIL PAGE (routed, deep-linkable)
// ============================================================

function buildBenefitsChart(p) {
  return '';
}

// Picks a colorful radial-glow tint for the 3D molecule panel. Seeded by the
// compound id so a given molecule keeps a consistent (but varied) color across
// re-renders instead of flickering. Returns inline CSS custom properties.
const MOL_GLOW_PALETTE = [
  { glow: '236, 72, 153', base: '#211a1f', dark: '#100d0f' }, // pink
  { glow: '139, 92, 246', base: '#1c1a26', dark: '#0e0c14' }, // violet
  { glow: '59, 130, 246', base: '#181d28', dark: '#0b0e14' }, // blue
  { glow: '16, 185, 129', base: '#152120', dark: '#0a1110' }, // emerald
  { glow: '245, 158, 11', base: '#231d14', dark: '#120e09' }, // amber
  { glow: '244, 63, 94', base: '#231619', dark: '#120a0c' },  // rose
  { glow: '6, 182, 212', base: '#142023', dark: '#091012' },  // cyan
  { glow: '168, 85, 247', base: '#1e1826', dark: '#0f0b14' }, // purple
  { glow: '251, 113, 133', base: '#231a1d', dark: '#120c0e' },// coral
  { glow: '34, 197, 94', base: '#152019', dark: '#0a100c' },  // green
];
function molGlowStyle(seed) {
  let h = 0;
  const s = String(seed || '');
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const c = MOL_GLOW_PALETTE[h % MOL_GLOW_PALETTE.length];
  return `--mol-glow:${c.glow};--mol-base:${c.base};--mol-base-dark:${c.dark}`;
}

async function renderPeptideDetailPage(el, id) {
  el.innerHTML = skeletonCards(1, 'detail');
  try {
    let r = await fetch(`/api/peptides/${id}`);
    if (!r.ok) r = await fetch(`https://researchsafe.org/api/peptides/${id}`);
    const p = await r.json();
    if (p.error) { el.innerHTML = '<p style="padding:24px;color:#3b82f6">Peptide not found.</p>'; return; }
    // Record the view for admin analytics (Most Viewed / Top Categories / Trending).
    try { recordPeptideEvent('view', { peptide_id: p.id, peptide_name: p.name, category: p.category, source: 'detail-page' }); } catch (e) {}
    const status = p.status || 'Research compound';
    const dosing = p.dosing || {};
    const benefits = Array.isArray(p.benefits) ? p.benefits : [];
    const sideEffects = Array.isArray(p.sideEffects) ? p.sideEffects : [];
    const research = Array.isArray(p.research) ? p.research : [];
    const stacks = Array.isArray(p.stacksWith) ? p.stacksWith : [];
    const tags = Array.isArray(p.tags) ? p.tags : [];
    const statusClass = status.includes('FDA') ? 'status-approved' : status.includes('Phase') || status.includes('Investigational') ? 'status-investigational' : 'status-research';
    const statusText = status.includes('FDA') ? 'FDA Approved' : status.includes('Phase') ? 'Clinical Trial' : 'Research';
    let warnings = [];
    try { warnings = getInteractionWarnings(p); } catch(e) {}

    let bodyHTML = '';

    const hasMol = (typeof window.hasMoleculeStructure === 'function') && window.hasMoleculeStructure(p.id);
    const isMobile = window.innerWidth <= 768 || ('ontouchstart' in window && window.innerWidth < 1024);
    if (typeof window.loadMoleculeViewer === 'function') {
      try { window.loadMoleculeViewer(); } catch (e) {}
    }
    const catColor = p.categoryColor || '#6b7280';
    // ── 3D Molecule Panel ──
    let molHTML = '';
    const molInner = `<molecule-3d data-id="${p.id}" style="width:100%;height:100%;display:block"></molecule-3d>`;
    const mwCaption = p.molecularWeight ? ` · ${esc(String(p.molecularWeight))}` : '';
    const molGlow = molGlowStyle(p.id);
    if (hasMol) {
      molHTML = `<div class="rsd-mol-panel" id="rsdMolPanel" style="${molGlow}">
        <div class="rsd-mol-stage">${molInner}</div>
        <div class="rsd-mol-label"><i class="fas fa-cube"></i> 3D Structure</div>
        <div id="molLegend" class="rsd-mol-legend"></div>
        <div class="rsd-mol-foot rsd-mol-foot-left"><i class="fas fa-arrows-rotate"></i> <span id="molSource">Drag to rotate</span></div>
        <div class="rsd-mol-foot rsd-mol-foot-right">CPK-colored${mwCaption}</div>
      </div>`;
    }

    // ── HERO: Name + TL;DR ──
    const tldr = p.description ? p.description.split('.').slice(0,2).join('.') + '.' : '';
    bodyHTML += `<div class="rsd-card rsd-hero">
      <div class="rsd-hero-text">
        <div class="rsd-hero-badges">
          <span class="rsd-cat-pill" style="--cat:${catColor}"><span class="rsd-cat-dot" style="background:${catColor}"></span>${esc(p.category || 'General')}</span>
          <span class="rsd-status-pill rsd-status-${statusText.toLowerCase().replace(/[^a-z]/g,'')}">${statusText}</span>
        </div>
        <h1 class="rsd-hero-name">${esc(p.name)}</h1>
        ${p.fullName ? `<p class="rsd-hero-sub">${esc(p.fullName)}</p>` : ''}
        <p class="edu-tldr">${esc(tldr)}</p>
      </div>
      <div class="rsd-hero-actions">
        <button class="rsd-btn rsd-btn-primary" onclick="if(!builderStack.includes('${p.id}')){builderStack.push('${p.id}')};navigate('builder')"><i class="fas fa-plus"></i> Add to stack</button>
        <button class="rsd-btn rsd-btn-ghost" onclick="document.getElementById('compare1')&&(document.getElementById('compare1').value='${p.id}');navigate('compare')"><i class="fas fa-code-compare"></i> Compare</button>
        <button class="rsd-btn rsd-btn-icon" title="${isFavorite(p.id) ? 'Saved' : 'Save'}" onclick="toggleFavorite('${p.id}');navigate('peptide-detail','${p.id}')"><i class="fa${isFavorite(p.id) ? 's' : 'r'} fa-star"></i></button>
        <button class="rsd-btn rsd-btn-icon" title="Share" onclick="sharePeptide('${p.id}')"><i class="fas fa-arrow-up-from-bracket"></i></button>
      </div>
    </div>`;

    // ── 3D structure panel ──
    if (molHTML) bodyHTML += molHTML;

    // ── Quick Stats (visual cards) ──
    const quickStats = [];
    if (p.halfLife) quickStats.push({ icon: 'fa-clock', label: 'Half-life', value: p.halfLife, tip: 'How long it stays active in your body' });
    if (dosing.route) quickStats.push({ icon: 'fa-syringe', label: 'How you take it', value: dosing.route, tip: 'The way this enters your body' });
    if (dosing.frequency) quickStats.push({ icon: 'fa-calendar-check', label: 'How often', value: dosing.frequency, tip: 'How frequently people use it' });
    if (dosing.typical) quickStats.push({ icon: 'fa-vial', label: 'Typical dose', value: dosing.typical, tip: 'Common amount used per session' });
    if (quickStats.length > 0) {
      bodyHTML += `<div class="edu-stats-grid">${quickStats.map(s => `
        <div class="edu-stat-card">
          <div class="edu-stat-icon" style="color:${catColor}"><i class="fas ${s.icon}"></i></div>
          <div class="edu-stat-label">${esc(s.label)}</div>
          <div class="edu-stat-value">${esc(String(s.value))}</div>
          <div class="edu-stat-tip">${esc(s.tip)}</div>
        </div>`).join('')}</div>`;
    }

    // ── What Is It? (plain-language overview) ──
    bodyHTML += `<div class="rsd-card edu-section">
      <div class="edu-section-header">
        <span class="edu-section-emoji">🧬</span>
        <h2 class="edu-section-title">What is ${esc(p.name)}?</h2>
      </div>
      <p class="edu-text">${esc(p.description || 'No description available.')}</p>
    </div>`;

    // ── How Does It Work? (mechanism in plain language) ──
    if (p.mechanism) {
      bodyHTML += `<div class="rsd-card edu-section">
        <div class="edu-section-header">
          <span class="edu-section-emoji">⚙️</span>
          <h2 class="edu-section-title">How does it work?</h2>
        </div>
        <p class="edu-text">${esc(p.mechanism)}</p>
      </div>`;
    }

    // ── Benefits vs Side Effects (visual split) ──
    if (benefits.length || sideEffects.length) {
      bodyHTML += `<div class="edu-split-row">
        ${benefits.length ? `<div class="rsd-card edu-section edu-good">
          <div class="edu-section-header">
            <span class="edu-section-emoji">✅</span>
            <h2 class="edu-section-title">The Good Stuff</h2>
          </div>
          <ul class="edu-list edu-list-good">${benefits.map(b => `<li><i class="fas fa-check-circle"></i><span>${esc(b)}</span></li>`).join('')}</ul>
        </div>` : ''}
        ${sideEffects.length ? `<div class="rsd-card edu-section edu-warn">
          <div class="edu-section-header">
            <span class="edu-section-emoji">⚠️</span>
            <h2 class="edu-section-title">Watch Out For</h2>
          </div>
          <ul class="edu-list edu-list-warn">${sideEffects.map(s => `<li><i class="fas fa-exclamation-circle"></i><span>${esc(s)}</span></li>`).join('')}</ul>
        </div>` : ''}
      </div>`;
    }

    // ── How To Use It (dosing made simple) ──
    const dosingRows = [];
    if (dosing.typical) dosingRows.push(['💊 Dose', dosing.typical]);
    if (dosing.frequency) dosingRows.push(['📅 Frequency', dosing.frequency]);
    if (dosing.duration) dosingRows.push(['⏱️ Duration', dosing.duration]);
    if (dosing.route) dosingRows.push(['💉 Method', dosing.route]);
    if (dosing.timing) dosingRows.push(['🕐 Best time', dosing.timing]);
    if (dosing.cycle) dosingRows.push(['🔄 Cycle', dosing.cycle]);
    if (dosingRows.length || (Array.isArray(dosing.protocol) && dosing.protocol.length)) {
      bodyHTML += `<div class="rsd-card edu-section">
        <div class="edu-section-header">
          <span class="edu-section-emoji">📋</span>
          <h2 class="edu-section-title">How to use it</h2>
        </div>
        ${dosingRows.length ? `<div class="edu-dosing-grid">${dosingRows.map(r => `
          <div class="edu-dosing-item">
            <div class="edu-dosing-label">${r[0]}</div>
            <div class="edu-dosing-value">${esc(r[1])}</div>
          </div>`).join('')}</div>` : ''}
        ${Array.isArray(dosing.protocol) && dosing.protocol.length ? `
          <div class="edu-steps">
            <h3 class="edu-steps-title">Step-by-step protocol</h3>
            <ol class="edu-step-list">${dosing.protocol.map((s, i) => `<li><span class="edu-step-num">${i+1}</span><span class="edu-step-text">${esc(s)}</span></li>`).join('')}</ol>
          </div>` : ''}
        ${dosing.notes ? `<div class="edu-callout edu-callout-info"><i class="fas fa-lightbulb"></i><span>${esc(dosing.notes)}</span></div>` : ''}
      </div>`;
    }

    // ── Key Properties (science stats) ──
    const props = [];
    if (p.molecularWeight) props.push(['⚖️ Molecular weight', p.molecularWeight]);
    if (p.halfLife) props.push(['⏳ Half-life', p.halfLife]);
    if (p.bioavailability) props.push(['📊 Bioavailability', p.bioavailability]);
    if (p.sequence) props.push(['🧪 Sequence', p.sequence]);
    if (props.length) {
      bodyHTML += `<div class="rsd-card edu-section">
        <div class="edu-section-header">
          <span class="edu-section-emoji">🔬</span>
          <h2 class="edu-section-title">Science Stats</h2>
        </div>
        <div class="edu-props-grid">${props.map(pr => `
          <div class="edu-prop-item">
            <span class="edu-prop-label">${pr[0]}</span>
            <span class="edu-prop-value"${pr[0].includes('Sequence') ? ' style="font-family:monospace;font-size:11px;word-break:break-all"' : ''}>${esc(String(pr[1]))}</span>
          </div>`).join('')}</div>
      </div>`;
    }

    // ── Storage & Handling ──
    if (p.storage || p.reconstitution) {
      bodyHTML += `<div class="rsd-card edu-section">
        <div class="edu-section-header">
          <span class="edu-section-emoji">🧊</span>
          <h2 class="edu-section-title">Storage & Handling</h2>
        </div>
        ${p.storage ? `<div class="edu-callout edu-callout-storage"><i class="fas fa-temperature-low"></i><span>${esc(p.storage)}</span></div>` : ''}
        ${p.reconstitution ? `<div class="edu-callout edu-callout-info" style="margin-top:10px"><i class="fas fa-flask"></i><span><strong>Reconstitution:</strong> ${esc(p.reconstitution)}</span></div>` : ''}
      </div>`;
    }

    // ── Research & Evidence ──
    if (research.length) {
      bodyHTML += `<div class="rsd-card edu-section">
        <div class="edu-section-header">
          <span class="edu-section-emoji">📚</span>
          <h2 class="edu-section-title">What does the research say?</h2>
        </div>
        <div class="edu-research-list">${research.map(r => typeof r === 'object' && r !== null ? `
          <div class="edu-research-item">
            <div class="edu-research-title"><i class="fas fa-file-lines"></i> ${esc(r.title || 'Study')}</div>
            ${r.year ? `<span class="edu-research-year">${esc(String(r.year))}</span>` : ''}
            ${r.finding ? `<p class="edu-research-finding">${esc(r.finding)}</p>` : ''}
          </div>` : `<div class="edu-research-item"><p class="edu-research-finding">${esc(r)}</p></div>`).join('')}</div>
      </div>`;
    }

    // ── Pairs Well With (stacks) ──
    if (stacks.length) {
      bodyHTML += `<div class="rsd-card edu-section">
        <div class="edu-section-header">
          <span class="edu-section-emoji">🤝</span>
          <h2 class="edu-section-title">Pairs well with</h2>
        </div>
        <p class="edu-text" style="margin-bottom:14px">These compounds are commonly combined with ${esc(p.name)} for synergistic effects:</p>
        <div class="edu-stack-grid">${stacks.map(s => { const sp = peptides.find(pp => pp.name === s); return `<button class="edu-stack-chip" ${sp ? `onclick="navigate('peptide-detail','${sp.id}')"` : 'disabled'}><span class="edu-stack-dot" style="background:${sp ? (sp.categoryColor || catColor) : '#9ca3af'}"></span>${esc(s)}${sp ? ' <i class="fas fa-arrow-right" style="font-size:10px;opacity:0.5"></i>' : ''}</button>`; }).join('')}</div>
      </div>`;
    }

    // ── Interaction Warnings ──
    if (warnings.length) {
      bodyHTML += `<div class="rsd-card edu-section edu-section-danger">
        <div class="edu-section-header">
          <span class="edu-section-emoji">🚨</span>
          <h2 class="edu-section-title">Important Interactions</h2>
        </div>
        <ul class="edu-list edu-list-warn">${warnings.map(w => `<li><i class="fas fa-exclamation-triangle"></i><span>${esc(w)}</span></li>`).join('')}</ul>
      </div>`;
    }

    // ── Learn More CTAs ──
    const safeName = (p.name || '').replace(/'/g, "\\'");
    bodyHTML += `<div class="edu-cta-row">
      <button class="edu-cta-btn" onclick="openResearchForPeptide('${safeName}')"><i class="fas fa-newspaper"></i> Latest research</button>
      <button class="edu-cta-btn edu-cta-video" onclick="openVideosForPeptide('${safeName}')"><i class="fab fa-youtube"></i> Watch videos</button>
      <button class="edu-cta-btn edu-cta-ai" onclick="askAIAboutCompound('${safeName}')"><i class="fas fa-robot"></i> Ask AI</button>
    </div>`;

    // ── Community reviews ──
    bodyHTML += `<div class="rsd-card edu-section" id="rsdReviews" data-pid="${esc(p.id)}">
      <div class="edu-section-header">
        <span class="edu-section-emoji">💬</span>
        <h2 class="edu-section-title">Community Reviews</h2>
      </div>
      <div class="rsd-reviews-loading"><i class="fas fa-spinner fa-spin"></i> Loading reviews...</div>
    </div>`;

    bodyHTML += `<div class="edu-disclaimer"><i class="fas fa-info-circle"></i> <strong>Heads up:</strong> ${esc(p.name)} is classified as "${esc(status)}." All info here is for educational and research purposes only. Always consult a qualified professional before use.</div>`;

    el.innerHTML = `
      <div class="protocol-detail rsd-detail">
        <button class="back-btn rsd-back" onclick="navigate('knowledge')"><i class="fas fa-chevron-left"></i> Knowledge base</button>
        ${bodyHTML}
      </div>
    `;
    // Populate the CPK legend + structure-source label once the molecule draws.
    // The panel is rendered optimistically on desktop and removed here if the
    // compound has no structure.
    if (!isMobile || hasMol) {
      el.addEventListener('molready', (ev) => {
        const legend = el.querySelector('#molLegend');
        const src = el.querySelector('#molSource');
        if (legend && ev.detail && ev.detail.elements) {
          const dots = ev.detail.elements.map((e) =>
            `<span class="rsd-leg-item"><i class="rsd-leg-dot" style="background:${e.color}"></i>${e.el}</span>`
          ).join('');
          legend.innerHTML = dots;
        }
        if (src) src.textContent = ev.detail && ev.detail.source === 'experimental'
          ? 'Ball-and-stick · experimental'
          : 'Ball-and-stick · illustrative';
        // The interactive 3D has drawn — fade out the instant PNG placeholder.
        const png = el.querySelector('.rsd-mol-png');
        if (png) { png.classList.add('rsd-mol-png-hide'); setTimeout(() => png.remove(), 600); }
      }, { once: true });
      el.addEventListener('molempty', () => {
        const panel = el.querySelector('#rsdMolPanel');
        if (panel) panel.remove();
      }, { once: true });

      // Belt-and-suspenders: the panel is rendered optimistically, so the
      // <molecule-3d> element may exist before the viewer module is defined.
      // Once it's defined (and thus upgraded), force a resize + rebuild so the
      // canvas always picks up the panel's real dimensions and draws, even if
      // the element was inserted before layout settled or the module loaded.
      if (typeof window.loadMoleculeViewer === 'function') {
        try { window.loadMoleculeViewer(); } catch (e) {}
        const kick = () => {
          const mol = el.querySelector('molecule-3d');
          if (!mol) return;
          try {
            if (typeof mol._resize === 'function') mol._resize();
            // Re-run the build if it never produced geometry (no molready yet).
            if (typeof mol._build === 'function' && mol._THREE &&
                (!mol._group || mol._group.children.length === 0)) {
              mol._build();
            }
          } catch (e) {}
        };
        if (window.customElements && customElements.whenDefined) {
          customElements.whenDefined('molecule-3d').then(() => {
            // Give the upgraded element a tick to finish _setup, then kick.
            setTimeout(kick, 60);
            setTimeout(kick, 400);
          });
        }

        // Final safety net: if WebGL is unavailable/blocked on this device, the
        // <molecule-3d> never produces a renderer. The instant PNG placeholder
        // is already showing, so here we just keep it and drop the dead element.
        const ensureMoleculeVisible = () => {
          const stage = el.querySelector('.rsd-mol-stage');
          const mol = stage && stage.querySelector('molecule-3d');
          if (!stage || !mol) return;
          const rendererOk = !!mol._renderer;
          const drewGeometry = mol._group && mol._group.children.length > 0;
          if (rendererOk && drewGeometry) return; // 3D is working; leave it.

          // 3D didn't come up. Keep the already-visible PNG placeholder if present.
          const existingPng = stage.querySelector('.rsd-mol-png');
          const src = el.querySelector('#molSource');
          if (existingPng) {
            existingPng.classList.remove('rsd-mol-png-hide');
            existingPng.classList.add('rsd-mol-png-spin');
            if (src) src.textContent = 'Ball-and-stick · static render';
            mol.remove();
            return;
          }
          // No PNG yet (e.g. hasMol was false) — try to inject one.
          const img = document.createElement('img');
          img.className = 'rsd-mol-png rsd-mol-png-spin';
          img.alt = (p.name || '') + ' molecular structure';
          img.src = '/static/mol-png/' + p.id + '.png';
          img.onload = () => { if (src) src.textContent = 'Ball-and-stick · static render'; };
          img.onerror = () => {
            const panel = el.querySelector('#rsdMolPanel');
            if (panel) panel.remove();
          };
          mol.replaceWith(img);
        };
        setTimeout(ensureMoleculeVisible, 2200);
      }
    }

    // Load community reviews for this compound.
    if (typeof loadCompoundReviews === 'function') {
      loadCompoundReviews(p.id, p.name);
    }

    // Forum threads mentioning this compound (KB → forum cross-links).
    injectCompoundDiscussions(el, p);
  } catch(e) {
    console.error(e);
    el.innerHTML = '<p style="padding:24px;color:#3b82f6">Failed to load peptide.</p>';
  }
}

// "Community discussions" section on the compound detail page: live threads
// mentioning the compound plus a one-tap "Ask the community" that opens the
// forum composer pre-filled with this compound and its topic community.
function _guessCommunityFor(p) {
  const cat = String(p.category || '').toLowerCase();
  if (cat.includes('healing') || cat.includes('recovery')) return 'healing-recovery';
  if (cat.includes('growth')) return 'gh-peptides';
  if (cat.includes('weight') || cat.includes('metabol')) return 'weight-loss';
  if (cat.includes('cognitive') || cat.includes('nootropic')) return 'cognitive';
  if (cat.includes('anti-aging') || cat.includes('longevity') || cat.includes('nad')) return 'longevity';
  return 'general';
}

// Restore a KB→forum draft the reader started before signing up (persisted to
// sessionStorage so it survives even an OAuth full-page redirect). Returns true
// and navigates to the forum (reopening the composer) if a draft was pending.
function _resumePendingCompose() {
  let raw = null;
  try { raw = sessionStorage.getItem('rs_pending_compose'); } catch (e) {}
  if (!raw) return false;
  try { sessionStorage.removeItem('rs_pending_compose'); } catch (e) {}
  try { window.__forumComposePrefill = JSON.parse(raw); } catch (e) { return false; }
  document.getElementById('authModal')?.remove();
  window.__forumComposeIntent = true;
  navigate('community');
  return true;
}

// Specific, ready-to-post question starters for a given compound. Each opens the
// forum composer with a complete title + a short scaffold body, so a KB reader
// converts to a poster in one tap instead of staring at a blank box.
function _askStarters(p) {
  const n = p.name;
  return [
    { label: 'Dosing & timing', icon: 'fa-syringe',
      title: `${n}: dosing and timing that worked for you?`,
      body: `Looking into ${n} and trying to understand the typical approach. What dose, frequency and timing have you used, and how did you land on it? Not after a personalized dose, just the general range and what shaped your choice.` },
    { label: 'Results & timeline', icon: 'fa-chart-line',
      title: `${n}: what did you notice, and how long did it take?`,
      body: `Curious about real experiences with ${n}. What changed for you (or didn't), and how many days/weeks in before you noticed anything? Trying to set realistic expectations - n=1 anecdotes welcome.` },
    { label: 'Side effects', icon: 'fa-triangle-exclamation',
      title: `${n}: any side effects or downsides to watch for?`,
      body: `Reading up on ${n}. What side effects did you run into, how bad were they, and is there anything you'd do differently to avoid them?` },
    { label: 'Stacking', icon: 'fa-layer-group',
      title: `${n}: what do you stack it with?`,
      body: `Thinking about ${n}. What have you combined it with (or deliberately kept it apart from), and did the combo actually make a difference?` },
    { label: 'Something else', icon: 'fa-pen',
      title: `${n}: `,
      body: `` },
  ];
}

async function injectCompoundDiscussions(el, p) {
  try {
    const r = await fetch('/api/forum/related?q=' + encodeURIComponent(p.name));
    const threads = await r.json();
    if (!el.isConnected) return; // user navigated away while fetching
    const section = document.createElement('div');
    section.className = 'detail-section rsd-discussions';
    const rows = (Array.isArray(threads) ? threads : []).map(t =>
      `<a class="rsd-thread" href="/forum/${t.id}">
        <span class="rsd-thread-score"><i class="fas fa-arrow-up"></i>${t.score || 0}</span>
        <span class="rsd-thread-title">${esc(t.title)}</span>
        <span class="rsd-thread-meta">${t.comment_count || 0} <i class="far fa-comment"></i></span>
      </a>`).join('');
    const starters = _askStarters(p);
    const chips = starters.map((s, i) =>
      `<button type="button" class="rsd-ask-chip" data-starter="${i}"><i class="fas ${s.icon}"></i>${esc(s.label)}</button>`).join('');
    section.innerHTML = `
      <div class="detail-section-title"><i class="fas fa-comments" style="color:#14b8a6;margin-right:6px"></i>Community discussions</div>
      ${rows || `<p class="detail-text" style="font-size:13px;opacity:.75">No forum threads mention ${esc(p.name)} yet — be the first to start one.</p>`}
      <div class="rsd-ask">
        <div class="rsd-ask-label"><i class="fas fa-pen-to-square"></i> Ask the community about ${esc(p.name)}</div>
        <div class="rsd-ask-chips">${chips}</div>
      </div>`;
    const disc = el.querySelector('.disclaimer');
    if (disc) el.insertBefore(section, disc); else el.appendChild(section);
    const comm = _guessCommunityFor(p);
    section.querySelectorAll('.rsd-ask-chip').forEach(function (chip) {
      chip.onclick = function () {
        const s = starters[parseInt(chip.getAttribute('data-starter'), 10)];
        if (!s) return;
        // Hand a ready-made, specific question + scaffold to the forum composer:
        // the reader lands in an almost-finished post and just adds their details.
        window.__forumComposeIntent = true;
        window.__forumComposePrefill = { title: s.title, body: s.body, community: comm };
        navigate('community');
      };
    });
  } catch (e) { /* cross-links are enhancement only */ }
}

// ============================================================
// COMMUNITY REVIEWS (compound detail page)
// ============================================================
const REVIEW_PROMPTS = [
  'Describe your experience in detail. What were the effects, the timeline, and anything you wish you had known beforehand?',
  'Share what worked, what did not, and how it compared to your expectations. Specific details help others the most.',
  'Walk through your experience: dosing approach, how it felt, side effects, and your overall takeaway.',
];
const REVIEW_RATING_LABELS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];
const REVIEW_DURATIONS = [
  { v: 'lt1m', label: 'Less than 1 month' },
  { v: '1to3m', label: '1 to 3 months' },
  { v: '3to6m', label: '3 to 6 months' },
  { v: '6to12m', label: '6 to 12 months' },
  { v: 'gt12m', label: 'More than 1 year' },
];
function _durationLabel(v) {
  const d = REVIEW_DURATIONS.find(x => x.v === v);
  return d ? d.label : '';
}
let _reviewState = { pid: null, name: '', sort: 'helpful', myReviewId: null, items: [], canReview: false, isAdmin: false, draftRating: 0, draftRecommend: null, draftDuration: '', draftAnonymous: false };

function _starRow(rating, cls) {
  let out = '';
  for (let i = 1; i <= 5; i++) {
    out += `<i class="fa${i <= rating ? 's' : 'r'} fa-star ${cls || ''}"></i>`;
  }
  return out;
}

function _timeAgo(iso) {
  try {
    const then = new Date(iso).getTime();
    const s = Math.floor((Date.now() - then) / 1000);
    if (s < 60) return 'just now';
    const m = Math.floor(s / 60); if (m < 60) return m + 'm ago';
    const h = Math.floor(m / 60); if (h < 24) return h + 'h ago';
    const d = Math.floor(h / 24); if (d < 30) return d + 'd ago';
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  } catch { return ''; }
}

async function loadCompoundReviews(pid, name, sort) {
  const wrap = document.getElementById('rsdReviews');
  if (!wrap || wrap.dataset.pid !== pid) return;
  _reviewState.pid = pid;
  _reviewState.name = name || 'this compound';
  if (sort) _reviewState.sort = sort;
  try {
    const res = await fetch(`/api/reviews/${encodeURIComponent(pid)}?sort=${_reviewState.sort}`, { headers: authHeaders() });
    const data = await res.json();
    _reviewState.items = data.items || [];
    _reviewState.myReviewId = data.myReviewId || null;
    _reviewState.canReview = !!data.canReview;
    _reviewState.isAdmin = !!data.isAdmin;
    renderReviews(data.summary || { count: 0, avg: 0, dist: {} });
  } catch (e) {
    wrap.innerHTML = '<div class="rsd-reviews-loading">Could not load reviews.</div>';
  }
}

function renderReviews(summary) {
  const wrap = document.getElementById('rsdReviews');
  if (!wrap) return;
  const items = _reviewState.items;
  const count = summary.count || 0;
  const avg = summary.avg || 0;
  const dist = summary.dist || {};
  const recommendPct = (summary.recommendPct === 0 || summary.recommendPct) ? summary.recommendPct : null;
  const signedIn = !!window.currentUser;
  const mine = _reviewState.myReviewId ? items.find(r => r.id === _reviewState.myReviewId) : null;

  // Section header.
  let head = `<div class="rsd-reviews-head">
    <div class="rsd-reviews-headline">
      <h3 class="rsd-prose-title" style="margin:0"><i class="fas fa-comments" style="margin-right:8px;color:#ec4899"></i>Community reviews</h3>
      <p class="rsd-reviews-sub">First-hand experiences shared by people in the research community. Reviews reflect individual experiences and are not medical advice.</p>
    </div>
  </div>`;

  // Summary panel.
  let summaryHTML = '';
  if (count > 0) {
    summaryHTML = `<div class="rsd-rev-summary">
      <div class="rsd-rev-score">
        <div class="rsd-rev-avg">${avg.toFixed(1)}</div>
        <div class="rsd-rev-stars">${_starRow(Math.round(avg))}</div>
        <div class="rsd-rev-count">Based on ${count} review${count === 1 ? '' : 's'}</div>
      </div>
      <div class="rsd-rev-bars">
        ${[5,4,3,2,1].map(n => {
          const c = dist[n] || 0; const pct = count ? Math.round((c / count) * 100) : 0;
          return `<div class="rsd-rev-bar-row"><span class="rsd-rev-bar-n">${n} star</span><div class="rsd-rev-bar"><div class="rsd-rev-bar-fill" style="width:${pct}%"></div></div><span class="rsd-rev-bar-c">${c}</span></div>`;
        }).join('')}
      </div>
      ${recommendPct !== null ? `<div class="rsd-rev-recommend">
        <div class="rsd-rev-recommend-pct">${recommendPct}%</div>
        <div class="rsd-rev-recommend-label">would recommend</div>
      </div>` : ''}
    </div>`;
  }

  // Composer / CTA.
  let composer = '';
  if (!signedIn) {
    composer = `<div class="rsd-rev-cta">
      <div class="rsd-rev-cta-text">
        <strong>Have experience with ${esc(_reviewState.name)}?</strong>
        <div class="rsd-rev-cta-sub">Sign in to contribute a verified review and help the community make informed decisions.</div>
      </div>
      <button class="rsd-btn rsd-btn-primary" onclick="openAuthModal('login')"><i class="fas fa-pen"></i> Write a review</button>
    </div>`;
  } else if (mine && !_reviewState.editing) {
    composer = `<div class="rsd-rev-cta rsd-rev-cta-done">
      <div class="rsd-rev-cta-text"><i class="fas fa-circle-check" style="color:#10b981;margin-right:6px"></i> Your review is published ${_starRow(mine.rating, 'rsd-rev-mini-star')}</div>
      <div style="display:flex;gap:8px"><button class="rsd-btn rsd-btn-ghost" onclick="editMyReview()"><i class="fas fa-pen"></i> Edit review</button></div>
    </div>`;
  } else {
    const prompt = REVIEW_PROMPTS[Math.floor(Math.random() * REVIEW_PROMPTS.length)];
    const init = mine || { rating: 0, title: '', body: '', wouldRecommend: null, duration: '', anonymous: false };
    _reviewState.draftRating = init.rating || 0;
    _reviewState.draftRecommend = (init.wouldRecommend === 0 || init.wouldRecommend === 1) ? init.wouldRecommend : null;
    _reviewState.draftDuration = init.duration || '';
    _reviewState.draftAnonymous = !!init.anonymous;
    composer = `<div class="rsd-rev-composer" id="rsdRevComposer">
      <div class="rsd-rev-composer-title">${mine ? 'Edit your review' : 'Write a review'}</div>

      <div class="rsd-rev-field">
        <label class="rsd-rev-label">Overall rating <span class="rsd-rev-req">required</span></label>
        <div class="rsd-rev-starpick" id="rsdRevStarPick">
          ${[1,2,3,4,5].map(n => `<i class="fa${n <= (init.rating||0) ? 's' : 'r'} fa-star" data-star="${n}" onclick="setReviewStar(${n})" onmouseover="hoverReviewStar(${n})" onmouseout="hoverReviewStar(0)"></i>`).join('')}
          <span class="rsd-rev-star-label" id="rsdRevStarLabel">${init.rating ? REVIEW_RATING_LABELS[init.rating] : 'Select a rating'}</span>
        </div>
      </div>

      <div class="rsd-rev-field">
        <label class="rsd-rev-label">Would you recommend it?</label>
        <div class="rsd-rev-toggle" id="rsdRevRecommend">
          <button type="button" class="rsd-rev-toggle-btn ${_reviewState.draftRecommend === 1 ? 'active yes' : ''}" data-rec="1" onclick="setReviewRecommend(1)"><i class="fas fa-thumbs-up"></i> Yes</button>
          <button type="button" class="rsd-rev-toggle-btn ${_reviewState.draftRecommend === 0 ? 'active no' : ''}" data-rec="0" onclick="setReviewRecommend(0)"><i class="fas fa-thumbs-down"></i> No</button>
        </div>
      </div>

      <div class="rsd-rev-field">
        <label class="rsd-rev-label" for="rsdRevDuration">How long did you use it?</label>
        <select id="rsdRevDuration" class="rsd-rev-select" onchange="setReviewDuration(this.value)">
          <option value="">Prefer not to say</option>
          ${REVIEW_DURATIONS.map(d => `<option value="${d.v}" ${_reviewState.draftDuration === d.v ? 'selected' : ''}>${d.label}</option>`).join('')}
        </select>
      </div>

      <div class="rsd-rev-field">
        <label class="rsd-rev-label" for="rsdRevTitle">Headline</label>
        <input id="rsdRevTitle" class="rsd-rev-input" maxlength="140" placeholder="Summarize your experience in a sentence" value="${esc(init.title || '')}">
      </div>

      <div class="rsd-rev-field">
        <label class="rsd-rev-label" for="rsdRevBody">Your review <span class="rsd-rev-req">required</span></label>
        <textarea id="rsdRevBody" class="rsd-rev-textarea" maxlength="4000" placeholder="${esc(prompt)}">${esc(init.body || '')}</textarea>
      </div>

      <div class="rsd-rev-composer-foot">
        <label class="rsd-rev-anon" for="rsdRevAnon">
          <input type="checkbox" id="rsdRevAnon" ${_reviewState.draftAnonymous ? 'checked' : ''} onchange="setReviewAnonymous(this.checked)">
          <span><i class="fas fa-user-secret"></i> Post anonymously <span class="rsd-rev-anon-hint">— hide my name &amp; show as “Anonymous”</span></span>
        </label>
        <span class="rsd-rev-hint"><i class="fas fa-circle-info"></i> Share your experience, not medical advice. Reviews are public.</span>
        <div style="display:flex;gap:8px">
          ${mine ? `<button class="rsd-btn rsd-btn-ghost" onclick="cancelEditReview()">Cancel</button>` : ''}
          <button class="rsd-btn rsd-btn-primary" id="rsdRevSubmit" onclick="submitReview()"><i class="fas fa-paper-plane"></i> ${mine ? 'Update review' : 'Publish review'}</button>
        </div>
      </div>
    </div>`;
  }

  // Sort + list.
  let listHead = '';
  if (count > 1) {
    listHead = `<div class="rsd-rev-sortbar">
      <span class="rsd-rev-sortbar-label">${count} review${count === 1 ? '' : 's'}</span>
      <div class="rsd-rev-sortbtns">
        <span class="rsd-rev-sort-prefix">Sort by</span>
        <button class="rsd-rev-sort ${_reviewState.sort === 'helpful' ? 'active' : ''}" onclick="sortReviews('helpful')">Most helpful</button>
        <button class="rsd-rev-sort ${_reviewState.sort === 'newest' ? 'active' : ''}" onclick="sortReviews('newest')">Most recent</button>
      </div>
    </div>`;
  }

  let list = '';
  if (!count) {
    list = `<div class="rsd-rev-empty"><i class="fas fa-feather-pointed"></i> No reviews yet. Be the first to share your experience with ${esc(_reviewState.name)}.</div>`;
  } else {
    list = items.map(r => {
      const initial = (r.authorName || '?')[0].toUpperCase();
      const avatar = r.authorAvatar
        ? `<img src="${esc(r.authorAvatar)}" class="rsd-rev-avatar-img" alt="">`
        : `<span class="rsd-rev-avatar">${esc(initial)}</span>`;
      const recBadge = r.wouldRecommend === 1
        ? `<span class="rsd-rev-tag rec-yes"><i class="fas fa-thumbs-up"></i> Recommends</span>`
        : (r.wouldRecommend === 0 ? `<span class="rsd-rev-tag rec-no"><i class="fas fa-thumbs-down"></i> Does not recommend</span>` : '');
      const durTag = r.duration ? `<span class="rsd-rev-tag"><i class="fas fa-clock"></i> Used for ${esc(_durationLabel(r.duration))}</span>` : '';
      const tags = (recBadge || durTag) ? `<div class="rsd-rev-tags">${recBadge}${durTag}</div>` : '';
      const isHidden = r.status === 'hidden';
      const modBtn = _reviewState.isAdmin
        ? `<button class="rsd-rev-mod ${isHidden ? 'is-hidden' : ''}" title="${isHidden ? 'Restore this review (make public)' : 'Hide this review from the public'}" onclick="moderateReview('${r.id}', ${isHidden ? 'false' : 'true'})"><i class="fas fa-${isHidden ? 'eye' : 'eye-slash'}"></i> ${isHidden ? 'Restore' : 'Hide'}</button>`
        : '';
      const hiddenBadge = (_reviewState.isAdmin && isHidden)
        ? `<span class="rsd-rev-hidden-badge"><i class="fas fa-eye-slash"></i> Hidden from public</span>`
        : '';
      return `<div class="rsd-rev-item${isHidden ? ' rsd-rev-item-hidden' : ''}">
        <div class="rsd-rev-item-head">
          ${avatar}
          <div class="rsd-rev-item-meta">
            <div class="rsd-rev-author">${esc(r.authorName)}${r.isAi ? '<span class="rsd-rev-ai" title="Disclosed AI community member"><i class="fas fa-robot"></i> AI</span>' : '<span class="rsd-rev-verified" title="Signed-in member"><i class="fas fa-circle-check"></i> Verified</span>'}${r.isMine ? ' <span class="rsd-rev-you">You</span>' : ''}${hiddenBadge}</div>
            <div class="rsd-rev-sub">${_starRow(r.rating, 'rsd-rev-mini-star')} <span class="rsd-rev-time">${_timeAgo(r.createdAt)}${r.edited ? ' · edited' : ''}</span></div>
          </div>
          ${r.isMine ? `<button class="rsd-rev-del" title="Delete review" onclick="deleteMyReview('${r.id}')"><i class="fas fa-trash"></i></button>` : ''}
        </div>
        ${r.title ? `<div class="rsd-rev-title">${esc(r.title)}</div>` : ''}
        <div class="rsd-rev-body">${esc(r.body).replace(/\n/g, '<br>')}</div>
        ${tags}
        <div class="rsd-rev-actions">
          <button class="rsd-rev-helpful ${r.markedHelpful ? 'active' : ''}" ${r.isMine ? 'disabled title="You cannot mark your own review"' : ''} onclick="toggleHelpful('${r.id}')">
            <i class="fa${r.markedHelpful ? 's' : 'r'} fa-thumbs-up"></i> Helpful${r.helpful ? ` (${r.helpful})` : ''}
          </button>
          ${modBtn}
        </div>
      </div>`;
    }).join('');
  }

  wrap.innerHTML = head + summaryHTML + composer + listHead + `<div class="rsd-rev-list">${list}</div>`;
}

function setReviewStar(n) {
  _reviewState.draftRating = n;
  const pick = document.getElementById('rsdRevStarPick');
  if (pick) {
    pick.querySelectorAll('i[data-star]').forEach(el => {
      const s = parseInt(el.getAttribute('data-star'), 10);
      el.className = (s <= n ? 'fas' : 'far') + ' fa-star';
    });
  }
  const label = document.getElementById('rsdRevStarLabel');
  if (label) label.textContent = REVIEW_RATING_LABELS[n] || '';
}

function setReviewRecommend(v) {
  _reviewState.draftRecommend = (_reviewState.draftRecommend === v) ? null : v;
  const box = document.getElementById('rsdRevRecommend');
  if (!box) return;
  box.querySelectorAll('.rsd-rev-toggle-btn').forEach(el => {
    const rec = parseInt(el.getAttribute('data-rec'), 10);
    el.classList.toggle('active', _reviewState.draftRecommend === rec);
    el.classList.toggle('yes', _reviewState.draftRecommend === rec && rec === 1);
    el.classList.toggle('no', _reviewState.draftRecommend === rec && rec === 0);
  });
}

function setReviewDuration(v) {
  _reviewState.draftDuration = v || '';
}

function setReviewAnonymous(v) {
  _reviewState.draftAnonymous = !!v;
}

function hoverReviewStar(n) {
  const pick = document.getElementById('rsdRevStarPick');
  if (!pick) return;
  const eff = n || _reviewState.draftRating || 0;
  pick.querySelectorAll('i[data-star]').forEach(el => {
    const s = parseInt(el.getAttribute('data-star'), 10);
    el.className = (s <= eff ? 'fas' : 'far') + ' fa-star';
  });
}

function editMyReview() { _reviewState.editing = true; renderReviewsKeepSummary(); }
function cancelEditReview() { _reviewState.editing = false; renderReviewsKeepSummary(); }

function renderReviewsKeepSummary() {
  // Recompute a quick summary from cached items so we don't refetch.
  const count = _reviewState.items.length;
  let sum = 0; const dist = { 1:0,2:0,3:0,4:0,5:0 };
  let recYes = 0, recTotal = 0;
  _reviewState.items.forEach(r => {
    sum += r.rating; if (dist[r.rating] != null) dist[r.rating]++;
    if (r.wouldRecommend === 0 || r.wouldRecommend === 1) { recTotal++; if (r.wouldRecommend === 1) recYes++; }
  });
  const recommendPct = recTotal ? Math.round((recYes / recTotal) * 100) : null;
  renderReviews({ count, avg: count ? Math.round((sum / count) * 10) / 10 : 0, dist, recommendPct });
}

function sortReviews(sort) {
  if (_reviewState.sort === sort) return;
  loadCompoundReviews(_reviewState.pid, _reviewState.name, sort);
}

async function submitReview() {
  if (!window.currentUser) { openAuthModal('login'); return; }
  const rating = _reviewState.draftRating;
  const body = (document.getElementById('rsdRevBody') || {}).value || '';
  const title = (document.getElementById('rsdRevTitle') || {}).value || '';
  if (!rating) { showToast ? showToast('Please select an overall rating') : alert('Please select an overall rating'); return; }
  if (body.trim().length < 4) { showToast ? showToast('Please add a little more detail to your review') : alert('Please add a little more detail to your review'); return; }
  const btn = document.getElementById('rsdRevSubmit');
  const editing = !!_reviewState.myReviewId;
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving…'; }
  try {
    const res = await fetch(`/api/reviews/${encodeURIComponent(_reviewState.pid)}`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        rating, title: title.trim(), body: body.trim(),
        wouldRecommend: _reviewState.draftRecommend,
        duration: _reviewState.draftDuration || null,
        anonymous: _reviewState.draftAnonymous,
        authorName: window.currentUser.name || (window.currentUser.email || '').split('@')[0] || 'Anonymous',
        authorAvatar: window.currentUser.avatar_url || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed');
    _reviewState.editing = false;
    if (typeof showToast === 'function') showToast(data.updated ? 'Your review was updated' : 'Thank you. Your review has been published.');
    loadCompoundReviews(_reviewState.pid, _reviewState.name);
  } catch (e) {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> ' + (editing ? 'Update review' : 'Publish review'); }
    if (typeof showToast === 'function') showToast(e.message || 'Could not save'); else alert(e.message || 'Could not save');
  }
}

async function deleteMyReview(id) {
  if (!confirm('Delete your review?')) return;
  try {
    const res = await fetch(`/api/reviews/item/${id}`, { method: 'DELETE', headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed');
    if (typeof showToast === 'function') showToast('Review deleted');
    _reviewState.editing = false;
    loadCompoundReviews(_reviewState.pid, _reviewState.name);
  } catch (e) {
    if (typeof showToast === 'function') showToast(e.message || 'Could not delete');
  }
}

async function moderateReview(id, hidden) {
  if (hidden && !confirm('Hide this review from the public? You can restore it later.')) return;
  try {
    const res = await fetch(`/api/reviews/item/${id}/moderate`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ hidden: !!hidden }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed');
    if (typeof showToast === 'function') showToast(hidden ? 'Review hidden from public' : 'Review restored');
    loadCompoundReviews(_reviewState.pid, _reviewState.name);
  } catch (e) {
    if (typeof showToast === 'function') showToast(e.message || 'Could not update review');
  }
}

async function toggleHelpful(id) {
  try {
    const res = await fetch(`/api/reviews/item/${id}/helpful`, { method: 'POST', headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed');
    const item = _reviewState.items.find(r => r.id === id);
    if (item) { item.helpful = data.helpful; item.markedHelpful = data.marked; }
    renderReviewsKeepSummary();
  } catch (e) {
    if (typeof showToast === 'function') showToast(e.message || 'Could not update');
  }
}
window.loadCompoundReviews = loadCompoundReviews;
window.submitReview = submitReview;
window.setReviewStar = setReviewStar;
window.setReviewRecommend = setReviewRecommend;
window.setReviewDuration = setReviewDuration;
window.setReviewAnonymous = setReviewAnonymous;
window.hoverReviewStar = hoverReviewStar;
window.sortReviews = sortReviews;
window.editMyReview = editMyReview;
window.cancelEditReview = cancelEditReview;
window.deleteMyReview = deleteMyReview;
window.moderateReview = moderateReview;
window.toggleHelpful = toggleHelpful;

// ============================================================
// FEATURE #5: PROTOCOL/STACK BUILDER
// ============================================================
let builderStack = [];

function renderBuilder(el) {
  const stackPeptides = builderStack.map(id => peptides.find(p => p.id === id)).filter(Boolean);
  const options = peptides.map(p => `<option value="${p.id}" ${builderStack.includes(p.id) ? 'disabled' : ''}>${p.name} · ${p.category}</option>`).join('');
  const warnings = getStackWarnings(stackPeptides);
  el.innerHTML = `
    <div class="protocols-view" style="max-width:800px">

      <!-- PAGE HERO -->
      <div class="page-hero page-hero-violet">
        <div class="page-hero-bg">
          <div class="ph-orb ph-orb1" style="background:radial-gradient(circle,rgba(139,92,246,.35),rgba(124,58,237,.1))"></div>
          <div class="ph-orb ph-orb2" style="background:radial-gradient(circle,rgba(124,58,237,.25),rgba(167,139,250,.1))"></div>
          <div class="ph-orb ph-orb3" style="background:radial-gradient(circle,rgba(167,139,250,.2),rgba(139,92,246,.1))"></div>
          <div class="ph-grid"></div>
        </div>
        <div class="page-hero-body">
          <div class="ph-icon" style="background:rgba(139,92,246,.2);border-color:rgba(139,92,246,.3);color:#a78bfa"><i class="fas fa-layer-group"></i></div>
          <div class="ph-text">
            <h1 class="ph-title">Stack Builder</h1>
            <p class="ph-sub">Build your custom peptide stack, detect interaction risks, and export your protocol as a PDF.</p>
          </div>
          <div class="ph-stats">
            <div class="ph-stat"><div class="ph-stat-n">${stackPeptides.length || 0}</div><div class="ph-stat-l">In Stack</div></div>
            <div class="ph-stat"><div class="ph-stat-n">${warnings.length || 0}</div><div class="ph-stat-l">Warnings</div></div>
            <div class="ph-stat"><div class="ph-stat-n">${peptides.length}</div><div class="ph-stat-l">Available</div></div>
          </div>
        </div>
      </div>

      <div style="display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap">
        <select class="compare-select" id="builderSelect"><option value="">+ Add a peptide to your stack...</option>${options}</select>
        <button class="compare-btn" onclick="addToBuilder()"><i class="fas fa-plus" style="margin-right:4px"></i>Add</button>
        ${builderStack.length > 0 ? `<button class="compare-btn" style="background:linear-gradient(135deg,#3b82f6,#2563eb)" onclick="builderStack=[];navigate('builder')"><i class="fas fa-trash" style="margin-right:4px"></i>Clear All</button>` : ''}
      </div>
      ${stackPeptides.length > 0 ? `
        <div class="builder-stack">
          ${stackPeptides.map((p, i) => `
            <div class="builder-item">
              <div class="builder-item-left">
                <span class="pc-badge" style="--cat:${p.categoryColor};font-size:10px">${p.category}</span>
                <span class="builder-item-name" onclick="navigate('peptide-detail','${p.id}')" style="cursor:pointer">${p.name}</span>
                <span style="font-size:11px;color:var(--text-muted)">${p.dosing ? p.dosing.typical + ' • ' + p.dosing.frequency : ''}</span>
              </div>
              <button class="builder-remove" onclick="builderStack.splice(${i},1);navigate('builder')"><i class="fas fa-times"></i></button>
            </div>
          `).join('')}
        </div>
        <div class="builder-summary">
          <div class="detail-section-title">Stack Summary</div>
          <div class="detail-grid" style="margin-bottom:14px">
            <div class="detail-stat"><div class="detail-stat-label">Peptides</div><div class="detail-stat-value">${stackPeptides.length}</div></div>
            <div class="detail-stat"><div class="detail-stat-label">Categories</div><div class="detail-stat-value">${new Set(stackPeptides.map(p=>p.category)).size}</div></div>
            <div class="detail-stat"><div class="detail-stat-label">Routes</div><div class="detail-stat-value">${[...new Set(stackPeptides.map(p=>p.dosing?.route).filter(Boolean))].join(', ') || 'N/A'}</div></div>
          </div>
          ${warnings.length > 0 ? `
            <div class="detail-section-title" style="margin-bottom:10px"><i class="fas fa-exclamation-triangle" style="color:var(--p-text-muted,#7E7E7E);margin-right:6px;font-size:11px"></i>Stack insights</div>
            <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px">
              ${warnings.map(w => {
                const isSevere = w.toLowerCase().includes('caution') || w.toLowerCase().includes('avoid') || w.toLowerCase().includes('risk');
                return `<div style="padding:12px 14px;border-radius:var(--p-radius-sm,9px);background:var(--p-card,#1F1F1F);border:1px solid ${isSevere ? 'rgba(239,68,68,0.25)' : 'var(--p-hairline,#2C2C2C)'};display:flex;align-items:flex-start;gap:10px">
                  <span style="flex-shrink:0;font-size:9px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;padding:3px 7px;border-radius:6px;background:${isSevere ? 'rgba(239,68,68,0.12)' : 'rgba(234,179,8,0.12)'};color:${isSevere ? '#fca5a5' : '#fbbf24'}">${isSevere ? 'Caution' : 'Note'}</span>
                  <span style="font-size:12px;line-height:1.5;color:var(--p-text-secondary,#9E9E9E)">${w}</span>
                </div>`;
              }).join('')}
            </div>
          ` : `<div style="padding:12px 14px;border-radius:var(--p-radius-sm,9px);background:var(--p-card,#1F1F1F);border:1px solid var(--p-hairline,#2C2C2C);font-size:12px;color:var(--p-text-secondary,#9E9E9E);margin-bottom:14px;display:flex;align-items:center;gap:8px"><i class="fas fa-check-circle" style="color:var(--p-text-muted,#7E7E7E)"></i>No known conflicts between the compounds in this stack.</div>`}
          <button class="research-detail-btn" onclick="exportStack()"><i class="fas fa-file-export" style="margin-right:6px;color:#7c3aed"></i>Export Stack as PDF<i class="fas fa-arrow-right" style="margin-left:auto;opacity:0.5"></i></button>
        </div>
      ` : `
        <div style="text-align:center;padding:50px 20px">
          <i class="fas fa-layer-group" style="font-size:40px;color:var(--border);margin-bottom:16px;display:block"></i>
          <p style="font-size:15px;font-weight:600;color:var(--text-secondary);margin-bottom:8px">Start building your stack</p>
          <p style="font-size:13px;color:var(--text-muted)">Select peptides from the dropdown above to create your custom protocol.</p>
        </div>
      `}
    </div>
    <div class="disclaimer"><i class="fas fa-info-circle" style="margin-right:4px"></i> Stack Builder is for educational research planning only. Consult a medical professional.</div>
  `;
}

function addToBuilder() {
  const sel = document.getElementById('builderSelect');
  if (!sel || !sel.value) return;
  if (!builderStack.includes(sel.value)) builderStack.push(sel.value);
  navigate('builder');
}

// ============================================================
// FEATURE #6: SKELETON LOADERS
// ============================================================
function skeletonCards(count, type) {
  if (type === 'research') {
    return Array(count).fill(0).map(() => `
      <div class="skeleton-card">
        <div class="skeleton-line" style="width:30%;height:14px;margin-bottom:10px"></div>
        <div class="skeleton-line" style="width:90%;height:18px;margin-bottom:8px"></div>
        <div class="skeleton-line" style="width:70%;height:14px;margin-bottom:6px"></div>
        <div class="skeleton-line" style="width:50%;height:12px"></div>
      </div>
    `).join('');
  }
  if (type === 'video') {
    return `<div class="video-grid">${Array(count).fill(0).map(() => `
      <div class="skeleton-card" style="overflow:hidden">
        <div class="skeleton-line" style="width:100%;height:0;padding-bottom:56.25%;border-radius:0"></div>
        <div style="padding:12px 14px">
          <div class="skeleton-line" style="width:85%;height:14px;margin-bottom:6px"></div>
          <div class="skeleton-line" style="width:50%;height:12px;margin-bottom:4px"></div>
          <div class="skeleton-line" style="width:35%;height:10px"></div>
        </div>
      </div>
    `).join('')}</div>`;
  }
  if (type === 'detail') {
    return `<div style="padding:28px;max-width:800px"><div class="skeleton-line" style="width:120px;height:14px;margin-bottom:16px"></div><div class="skeleton-line" style="width:60%;height:28px;margin-bottom:12px"></div><div class="skeleton-line" style="width:40%;height:14px;margin-bottom:24px"></div><div class="skeleton-line" style="width:100%;height:80px;margin-bottom:16px"></div><div class="skeleton-line" style="width:100%;height:60px"></div></div>`;
  }
  return '';
}

// ============================================================
// FEATURE #8: INTERACTION WARNINGS
// ============================================================
const INTERACTION_NOTES = {
  'MK-677': ['MK-677 may elevate blood glucose and insulin. Monitor if stacking with other GH secretagogues', 'Significant appetite increase may counteract weight-loss peptides'],
  'Semaglutide': ['GLP-1 agonists slow gastric emptying. May affect absorption of oral peptides', 'Dose escalation required. Do not combine with other GLP-1 agonists'],
  'Tirzepatide': ['Dual GIP/GLP-1 mechanism. Do NOT combine with other GLP-1 agonists (semaglutide, liraglutide)', 'Dose escalation protocol required over 4+ weeks'],
  'PT-141': ['May cause blood pressure changes. Avoid combining with vasodilators or cardiovascular medications', 'Nausea is common. Space away from GLP-1 agonists'],
  'Melanotan II': ['Broad receptor activity with more side effects than PT-141 for sexual health', 'May cause moles/nevi darkening. Dermatological monitoring recommended'],
  'CJC-1295': ['When combined with Ipamorelin, may cause water retention and tingling initially', 'Avoid combining with GHRP-6 or GHRP-2 simultaneously (cortisol/prolactin elevation)'],
  'GHRP-6': ['Significant hunger stimulation. May not pair well with weight-loss protocols', 'Can elevate cortisol and prolactin at higher doses'],
  'IGF-1 LR3': ['Potent. Use with caution alongside other growth factors', 'Hypoglycemia risk. Monitor blood glucose, especially with insulin-sensitizing compounds'],
  'FOXO4-DRI': ['Senolytic mechanism. May cause temporary fatigue as senescent cells clear', 'Very limited human data. Considered experimental'],
  'Follistatin-344': ['Myostatin inhibition is potent. Connective tissue may not adapt as fast as muscle', 'Limited long-term safety data in humans'],
};

function getInteractionWarnings(peptide) {
  return INTERACTION_NOTES[peptide.name] || [];
}

function getStackWarnings(stackPeptides) {
  const warnings = [];
  const names = stackPeptides.map(p => p.name);
  // GLP-1 conflict
  const glp1s = names.filter(n => ['Semaglutide', 'Tirzepatide', 'Liraglutide', 'Retatrutide', 'Survodutide', 'Orforglipron'].includes(n));
  if (glp1s.length > 1) warnings.push(`⚠️ Multiple GLP-1 agonists (${glp1s.join(', ')}). Do NOT combine. Choose one.`);
  // GH overload
  const ghPeps = names.filter(n => ['CJC-1295', 'Ipamorelin', 'MK-677', 'GHRP-6', 'GHRP-2', 'Hexarelin', 'Sermorelin', 'Tesamorelin'].includes(n));
  if (ghPeps.length > 3) warnings.push(`⚠️ ${ghPeps.length} GH secretagogues. Risk of excessive GH/IGF-1 elevation. Consider reducing to 2-3 max.`);
  // Individual notes
  stackPeptides.forEach(p => {
    const notes = INTERACTION_NOTES[p.name];
    if (notes) notes.forEach(n => warnings.push(`${p.name}: ${n}`));
  });
  return warnings;
}

// ============================================================
// FEATURE #9: EXPORT / SHARE (Print-to-PDF)
// ============================================================
async function exportPeptide(id) {
  try {
    let r = await fetch(`/api/peptides/${id}`);
    if (!r.ok) r = await fetch(`https://researchsafe.org/api/peptides/${id}`);
    const p = await r.json();
    const printWin = window.open('', '_blank');
    const dosing = p.dosing || {};
    const benefits = Array.isArray(p.benefits) ? p.benefits : [];
    const sideEffects = Array.isArray(p.sideEffects) ? p.sideEffects : [];
    const research = Array.isArray(p.research) ? p.research : [];
    const stacks = Array.isArray(p.stacksWith) ? p.stacksWith : [];
    let exportBody = `<h1>${esc(p.name)}</h1><h2>${esc(p.fullName || '')} · ${esc(p.category || '')}</h2>`;
    exportBody += `<p style="font-size:13px">${esc(p.description || '')}</p>`;
    if (p.mechanism) exportBody += `<h3>Mechanism</h3><p style="font-size:13px">${esc(p.mechanism)}</p>`;
    const propItems = [];
    if (p.molecularWeight) propItems.push(`<div class="stat"><div class="stat-label">MW</div><div class="stat-value">${esc(p.molecularWeight)}</div></div>`);
    if (p.halfLife) propItems.push(`<div class="stat"><div class="stat-label">Half-Life</div><div class="stat-value">${esc(p.halfLife)}</div></div>`);
    if (p.bioavailability) propItems.push(`<div class="stat"><div class="stat-label">Bioavailability</div><div class="stat-value">${esc(p.bioavailability)}</div></div>`);
    if (p.sequence) propItems.push(`<div class="stat"><div class="stat-label">Sequence</div><div class="stat-value" style="font-size:10px;word-break:break-all">${esc(p.sequence)}</div></div>`);
    if (propItems.length) exportBody += `<h3>Properties</h3><div class="grid">${propItems.join('')}</div>`;
    if (dosing.typical || dosing.frequency) {
      const di = [];
      if (dosing.typical) di.push(`<div class="stat"><div class="stat-label">Dose</div><div class="stat-value">${esc(dosing.typical)}</div></div>`);
      if (dosing.frequency) di.push(`<div class="stat"><div class="stat-label">Frequency</div><div class="stat-value">${esc(dosing.frequency)}</div></div>`);
      if (dosing.duration) di.push(`<div class="stat"><div class="stat-label">Duration</div><div class="stat-value">${esc(dosing.duration)}</div></div>`);
      if (dosing.route) di.push(`<div class="stat"><div class="stat-label">Route</div><div class="stat-value">${esc(dosing.route)}</div></div>`);
      exportBody += `<h3>Dosing Protocol</h3><div class="grid">${di.join('')}</div>`;
      if (dosing.notes) exportBody += `<p style="font-size:12px;font-style:italic;margin-top:8px">${esc(dosing.notes)}</p>`;
    }
    if (benefits.length) exportBody += `<h3>Benefits</h3><ul>${benefits.map(b => `<li>${esc(b)}</li>`).join('')}</ul>`;
    if (sideEffects.length) exportBody += `<h3>Side Effects</h3><ul>${sideEffects.map(s => `<li>${esc(s)}</li>`).join('')}</ul>`;
    if (research.length) exportBody += `<h3>Research</h3><ul>${research.map(r => typeof r === 'object' && r !== null ? `<li><strong>${esc(r.title || '')}</strong>${r.year ? ` (${esc(String(r.year))})` : ''}${r.finding ? ` - ${esc(r.finding)}` : ''}</li>` : `<li>${esc(r)}</li>`).join('')}</ul>`;
    if (stacks.length) exportBody += `<h3>Stacks With</h3><div class="tags">${stacks.map(s=>`<span class="tag">${esc(s)}</span>`).join('')}</div>`;
    exportBody += `<p class="disclaimer">Generated by PeptideSafe | ${new Date().toLocaleDateString()}. For educational and research purposes only. Consult a licensed medical professional.</p>`;
    printWin.document.write(`<!DOCTYPE html><html><head><title>${p.name} | PeptideSafe Profile</title><style>
      body{font-family:Inter,-apple-system,sans-serif;max-width:700px;margin:40px auto;padding:0 20px;color:#1a1a2e;line-height:1.7}
      h1{font-size:28px;margin-bottom:4px;color:#2563eb}h2{font-size:14px;color:#6b7280;margin-bottom:24px}
      h3{font-size:13px;text-transform:uppercase;letter-spacing:1px;color:#2563eb;margin:24px 0 8px;border-bottom:2px solid #dbeafe;padding-bottom:4px}
      .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}.stat{background:#f9fafb;padding:10px 12px;border-radius:8px}
      .stat-label{font-size:10px;text-transform:uppercase;color:#9ca3af;letter-spacing:0.5px}.stat-value{font-size:14px;font-weight:600}
      ul{padding-left:18px}li{margin:4px 0;font-size:13px}.tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
      .tag{font-size:11px;padding:3px 10px;border-radius:6px;background:#eff6ff;color:#2563eb;font-weight:500}
      .disclaimer{font-size:10px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:12px;margin-top:30px}
      @media print{body{margin:0}}
    </style></head><body>${exportBody}</body></html>`);
    printWin.document.close();
    setTimeout(() => printWin.print(), 400);
  } catch(e) { alert('Failed to export. Please try again.'); }
}

function exportStack() {
  const stackPeptides = builderStack.map(id => peptides.find(p => p.id === id)).filter(Boolean);
  if (stackPeptides.length === 0) return;
  const warnings = getStackWarnings(stackPeptides);
  const printWin = window.open('', '_blank');
  printWin.document.write(`<!DOCTYPE html><html><head><title>Custom Stack - PeptideSafe</title><style>
    body{font-family:Inter,-apple-system,sans-serif;max-width:700px;margin:40px auto;padding:0 20px;color:#1a1a2e;line-height:1.7}
    h1{font-size:24px;color:#2563eb}h3{font-size:13px;text-transform:uppercase;letter-spacing:1px;color:#7c3aed;margin:20px 0 8px;border-bottom:2px solid #ede9fe;padding-bottom:4px}
    .pep{background:#f9fafb;padding:14px;border-radius:10px;margin-bottom:10px;border-left:3px solid #2563eb}
    .pep-name{font-size:16px;font-weight:700}.pep-meta{font-size:12px;color:#6b7280;margin-top:4px}
    .warn{background:#fffbeb;border:1px solid #fef3c7;padding:10px 14px;border-radius:8px;margin:4px 0;font-size:12px;color:#92400e}
    .disclaimer{font-size:10px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:12px;margin-top:30px}
    @media print{body{margin:0}}
  </style></head><body>
    <h1><i>⚗️</i> Custom Peptide Stack</h1>
    <p style="font-size:13px;color:#6b7280">${stackPeptides.length} peptides • ${new Set(stackPeptides.map(p=>p.category)).size} categories</p>
    <h3>Peptides in Stack</h3>
    ${stackPeptides.map(p => `<div class="pep"><div class="pep-name">${esc(p.name)}</div><div class="pep-meta">${esc(p.category)} • ${p.dosing ? esc(p.dosing.typical) + ' • ' + esc(p.dosing.frequency) + ' • ' + esc(p.dosing.route) : 'See dosing details'}</div></div>`).join('')}
    ${warnings.length ? `<h3>Interaction Notes</h3>${warnings.map(w=>`<div class="warn">${esc(w)}</div>`).join('')}` : '<h3>Interactions</h3><p style="font-size:13px;color:#059669">✓ No known interaction concerns.</p>'}
    <p class="disclaimer">Generated by PeptideSafe Stack Builder - ${new Date().toLocaleDateString()}. For educational research planning only.</p>
  </body></html>`);
  printWin.document.close();
  setTimeout(() => printWin.print(), 400);
}

// ============================================================
// FEATURE #10: ONBOARDING TOUR
// ============================================================
const TOUR_STEPS = [
  { title: 'Welcome to PeptideSafe! 🧬', text: 'Your intelligent research assistant for peptide science. Let me show you around.', icon: 'fa-hand-sparkles' },
  { title: 'Knowledge Base', text: 'Browse 82+ detailed peptide profiles with mechanisms, dosing protocols, and research context. Click the ★ to save favorites.', icon: 'fa-book-open', highlight: '[data-view="knowledge"]' },
  { title: 'Quick Search (Ctrl+K)', text: 'Press Ctrl+K anytime to instantly search across all peptides, protocols, and topics.', icon: 'fa-search' },
  { title: 'Stack Builder', text: 'Build custom peptide stacks and get automatic interaction warnings. Export your protocol as PDF.', icon: 'fa-layer-group', highlight: '[data-view="builder"]' },
  { title: 'You\'re all set!', text: 'Explore the Research feed, Video Library, Calculator, and more. Everything is saved locally - your data stays private.', icon: 'fa-rocket' },
];
let tourStep = 0;

function showOnboardingIfNew() {
  if (localStorage.getItem('peptideai_toured')) return;
  tourStep = 0;
  showTourStep();
}

function showTourStep() {
  const overlay = document.getElementById('tourOverlay');
  const card = document.getElementById('tourCard');
  if (!overlay || !card) return;
  if (tourStep >= TOUR_STEPS.length) {
    localStorage.setItem('peptideai_toured', '1');
    overlay.style.display = 'none';
    return;
  }
  const step = TOUR_STEPS[tourStep];
  overlay.style.display = 'flex';
  card.innerHTML = `
    <div class="tour-icon"><i class="fas ${step.icon}"></i></div>
    <h3 class="tour-title">${step.title}</h3>
    <p class="tour-text">${step.text}</p>
    <div class="tour-footer">
      <div class="tour-dots">${TOUR_STEPS.map((_, i) => `<span class="tour-dot ${i === tourStep ? 'active' : ''}"></span>`).join('')}</div>
      <div class="tour-btns">
        <button class="tour-skip" onclick="skipTour()">Skip</button>
        <button class="tour-next" onclick="nextTourStep()">${tourStep === TOUR_STEPS.length - 1 ? 'Get Started' : 'Next'}</button>
      </div>
    </div>
  `;
}

function nextTourStep() { tourStep++; showTourStep(); }
function skipTour() {
  localStorage.setItem('peptideai_toured', '1');
  document.getElementById('tourOverlay').style.display = 'none';
}

// ============================================================
// FEATURE #11: REGIMEN CALENDAR WITH iCAL SYNC
// ============================================================

// --- Data Model ---
// Regimen item: { id, peptideId, peptideName, dose, unit, time, frequency, route, startDate, endDate, color, reminderMin, notes }
// frequency: 'daily' | 'eod' (every other day) | 'biweekly' | 'weekly' | 'mwf' (Mon/Wed/Fri) | 'custom'
// customDays: [0,1,2,3,4,5,6] for custom frequency (0=Sun)

const REGIMEN_KEY = 'peptideai_regimen';
let calMonth = new Date().getMonth();
let calYear = new Date().getFullYear();
let calSelectedDate = null;
let editingRegimenId = null;

function getRegimen() {
  try { return JSON.parse(localStorage.getItem(REGIMEN_KEY) || '[]'); } catch { return []; }
}
function saveRegimen(items) { localStorage.setItem(REGIMEN_KEY, JSON.stringify(items)); scheduleSyncPush(); }

function addRegimenItem(item) {
  const items = getRegimen();
  item.id = 'reg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  items.push(item);
  saveRegimen(items);
  return item;
}

function updateRegimenItem(id, updates) {
  const items = getRegimen();
  const idx = items.findIndex(i => i.id === id);
  if (idx >= 0) { Object.assign(items[idx], updates); saveRegimen(items); }
}

function deleteRegimenItem(id) {
  saveRegimen(getRegimen().filter(i => i.id !== id));
}

// Check if a regimen item is scheduled on a specific date
function isScheduledOn(item, date) {
  const d = new Date(date);
  const start = new Date(item.startDate);
  const end = new Date(item.endDate);
  d.setHours(0,0,0,0); start.setHours(0,0,0,0); end.setHours(0,0,0,0);
  if (d < start || d > end) return false;
  const dow = d.getDay();
  const dayDiff = Math.floor((d - start) / 86400000);
  switch (item.frequency) {
    case 'daily': return true;
    case 'eod': return dayDiff % 2 === 0;
    case 'weekly': return dow === start.getDay();
    case 'biweekly': return dow === start.getDay() && Math.floor(dayDiff / 7) % 2 === 0;
    case 'mwf': return [1, 3, 5].includes(dow);
    case 'custom': return (item.customDays || []).includes(dow);
    default: return true;
  }
}

// Get all doses for a specific date
function getDosesForDate(date) {
  const items = getRegimen();
  return items.filter(item => isScheduledOn(item, date)).sort((a, b) => (a.time || '08:00').localeCompare(b.time || '08:00'));
}

// Calendar color palette for regimen items
const REGIMEN_COLORS = ['#2563eb','#8b5cf6','#0ea5e9','#f59e0b','#10b981','#ec4899','#6366f1','#06b6d4','#f97316','#84cc16'];

function getRegimenColor(index) { return REGIMEN_COLORS[index % REGIMEN_COLORS.length]; }

// ── Public protocol sharing + cloning ────────────────────────────────────────
// Publish the user's current regimen as a read-only link other people can open
// and clone. This is a viral loop: each shared protocol is a backlink + a signup
// funnel for the person who clones it.
async function shareMyProtocol() {
  const regimen = getRegimen();
  if (!regimen.length) {
    alert('Add at least one compound to your regimen before sharing.');
    return;
  }
  const items = regimen.map(it => ({
    peptideName: it.peptideName || it.name || '',
    peptideId: it.peptideId || '',
    dose: it.dose != null ? String(it.dose) : '',
    unit: it.unit || '',
    frequency: it.frequency || 'daily',
    time: it.time || '',
    customDays: it.customDays || undefined,
    notes: it.notes || '',
  })).filter(it => it.peptideName);

  const defaultTitle = items.length === 1 ? (items[0].peptideName + ' protocol') : ('My ' + items.length + '-compound protocol');
  const title = (prompt('Name this protocol', defaultTitle) || defaultTitle).slice(0, 120);

  try {
    const headers = (typeof authHeaders === 'function') ? authHeaders() : { 'Content-Type': 'application/json' };
    const res = await fetch('/api/protocols/share', {
      method: 'POST', headers, body: JSON.stringify({ title, items })
    });
    const data = await res.json();
    if (!data.url) { alert(data.error || 'Could not create share link.'); return; }
    if (typeof showWrappedModal === 'function') {
      showWrappedModal(data.url, 'Check out my peptide research protocol on ResearchSafe: ' + title);
    } else {
      prompt('Share this link', data.url);
    }
  } catch (e) {
    alert('Could not create share link. Please try again.');
  }
}
window.shareMyProtocol = shareMyProtocol;

function maybeImportClonedProtocol() {
  var raw = null;
  try { raw = sessionStorage.getItem('rs_clone_protocol'); } catch (e) {}
  if (!raw) return;
  try { sessionStorage.removeItem('rs_clone_protocol'); } catch (e) {}
  let payload;
  try { payload = JSON.parse(raw); } catch (e) { return; }
  if (!payload || !Array.isArray(payload.items) || !payload.items.length) return;

  const existing = getRegimen();
  const today = new Date();
  const start = today.toISOString().slice(0, 10);
  const end = new Date(today.getTime() + 56 * 86400000).toISOString().slice(0, 10);
  payload.items.forEach((it, i) => {
    existing.push({
      id: 'reg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7) + i,
      peptideName: it.peptideName || '',
      peptideId: it.peptideId || '',
      dose: it.dose || '',
      unit: it.unit || '',
      route: it.route || '',
      frequency: it.frequency || 'daily',
      time: it.time || '08:00',
      customDays: it.customDays || [],
      startDate: start,
      endDate: end,
      notes: it.notes || '',
      color: getRegimenColor(existing.length + i),
    });
  });
  saveRegimen(existing);
  setTimeout(function () {
    if (typeof showToast === 'function') showToast('Protocol cloned to your calendar');
  }, 400);
}
window.maybeImportClonedProtocol = maybeImportClonedProtocol;


// --- Main Render ---
// ============================================================
// AUTH GATE - shown instead of tracking tools for logged-out users
// ============================================================
// Legacy - kept for compatibility but no longer used as a hard gate
function renderAuthGate(el, toolName, toolIcon, toolColor, toolDesc) {
  // Now just renders the tool normally with a save banner instead of blocking
  // (All tools are free to use; account only needed to sync/save data)
}

// Returns HTML for a soft "save your progress" banner shown to guests
function renderSaveBanner(toolName, toolColor) {
  const sessionKey = 'ps_save_banner_dismissed';
  const dismissed = sessionStorage.getItem(sessionKey);
  if (dismissed) return '';
  return `
    <div class="save-banner" id="saveBanner" style="
      display:flex;align-items:center;gap:12px;flex-wrap:wrap;
      background:linear-gradient(135deg,${toolColor}18,${toolColor}08);
      border:1px solid ${toolColor}30;
      border-radius:14px;padding:14px 18px;margin-bottom:16px;
      animation:fadeIn .3s ease;
    ">
      <div style="flex-shrink:0;width:36px;height:36px;border-radius:50%;background:${toolColor}20;display:flex;align-items:center;justify-content:center">
        <i class="fas fa-cloud-arrow-up" style="color:${toolColor};font-size:15px"></i>
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:2px">
          <i class="fas fa-check-circle" style="color:#10b981;margin-right:5px"></i>All tools are 100% free - no account needed
        </div>
        <div style="font-size:12px;color:var(--text-secondary);line-height:1.4">
          Your data is saved locally right now. <strong>Create a free account</strong> to sync across devices &amp; never lose your progress.
        </div>
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-shrink:0;flex-wrap:wrap">
        <button onclick="openAuthModal('register')" style="
          padding:7px 14px;border-radius:8px;border:none;cursor:pointer;font-size:12px;font-weight:700;
          background:${toolColor};color:#fff;white-space:nowrap;
        "><i class="fas fa-user-plus" style="margin-right:5px"></i>Save Progress</button>
        <button onclick="openAuthModal('login')" style="
          padding:7px 14px;border-radius:8px;border:1px solid var(--border);cursor:pointer;font-size:12px;font-weight:600;
          background:var(--bg-card);color:var(--text-secondary);white-space:nowrap;
        ">Sign In</button>
        <button onclick="document.getElementById('saveBanner').style.display='none';sessionStorage.setItem('ps_save_banner_dismissed','1')" style="
          width:28px;height:28px;border-radius:50%;border:none;cursor:pointer;background:none;color:var(--text-muted);font-size:16px;display:flex;align-items:center;justify-content:center;flex-shrink:0;
        " title="Dismiss">&times;</button>
      </div>
    </div>
  `;
}

// LOGIN GATE - shown instead of personal tracking tools for guests
function renderLoginGate(el, toolName, toolIcon, toolColor, toolDesc) {
  const c = toolColor || '#2563eb';
  el.innerHTML = `
    <div class="login-gate">
      <div class="login-gate-card">
        <div class="login-gate-icon" style="background:${c}1a;color:${c}">
          <i class="fas ${toolIcon || 'fa-lock'}"></i>
        </div>
        <h1 class="login-gate-title">${esc(toolName)}</h1>
        <p class="login-gate-desc">${esc(toolDesc || 'This tool keeps a personal history, so it requires a free account.')}</p>
        <div class="login-gate-note">
          <i class="fas fa-lock"></i>
          <span>Create a free account to use ${esc(toolName)} and securely sync your data across devices.</span>
        </div>
        <div class="login-gate-actions">
          <button class="login-gate-btn login-gate-btn-primary" style="background:${c}" onclick="openAuthModal('register')">
            <i class="fas fa-user-plus"></i> Create free account
          </button>
          <button class="login-gate-btn login-gate-btn-ghost" onclick="openAuthModal('login')">
            <i class="fas fa-right-to-bracket"></i> Sign in
          </button>
        </div>
        <ul class="login-gate-perks">
          <li><i class="fas fa-circle-check"></i> Free forever — no card required</li>
          <li><i class="fas fa-circle-check"></i> Synced &amp; backed up across devices</li>
          <li><i class="fas fa-circle-check"></i> Private to your account</li>
        </ul>
      </div>
    </div>
  `;
}
window.renderLoginGate = renderLoginGate;

function renderCalendar(el) {
  // If the user arrived from a shared protocol link (/p/:id -> /calendar?clone),
  // import that protocol into their regimen before rendering.
  maybeImportClonedProtocol();
  const _calSaveBanner = !currentUser ? renderSaveBanner('Regimen Calendar', '#2563eb') : '';
  const regimen = getRegimen();
  const today = new Date();
  today.setHours(0,0,0,0);

  // Active items (not expired)
  const activeItems = regimen.filter(item => new Date(item.endDate) >= today);
  const upcomingDoses = getDosesForDate(today);

  el.innerHTML = `
    <div class="calendar-view">
      <!-- PAGE HERO -->
      <div class="page-hero page-hero-blue" style="margin-bottom:20px">
        <div class="page-hero-bg">
          <div class="ph-orb ph-orb1" style="background:radial-gradient(circle,rgba(37,99,235,.35),rgba(59,130,246,.1))"></div>
          <div class="ph-orb ph-orb2" style="background:radial-gradient(circle,rgba(59,130,246,.25),rgba(96,165,250,.1))"></div>
          <div class="ph-orb ph-orb3" style="background:radial-gradient(circle,rgba(96,165,250,.2),rgba(37,99,235,.1))"></div>
          <div class="ph-grid"></div>
        </div>
        <div class="page-hero-body">
          <div class="ph-icon" style="background:rgba(37,99,235,.2);border-color:rgba(37,99,235,.3);color:#60a5fa"><i class="fas fa-calendar-alt"></i></div>
          <div class="ph-text">
            <h1 class="ph-title">Regimen Calendar</h1>
            <p class="ph-sub">Schedule peptides, view doses on a calendar, and export reminders to iCal.</p>
          </div>
          <div class="ph-actions">
            <button class="ph-action-btn" onclick="openRegimenForm()"><i class="fas fa-plus"></i> Add Peptide</button>
            <button class="ph-action-btn" style="background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.2)" onclick="shareMyProtocol()"><i class="fas fa-share-nodes"></i> Share protocol</button>
            <button class="ph-action-btn" style="background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.2)" onclick="exportRegimenICal()"><i class="fas fa-download"></i> Export .ics</button>
          </div>
        </div>
      </div>

      ${_calSaveBanner}

      <!-- Today's Schedule Quick Look -->
      ${upcomingDoses.length > 0 ? `
      <div class="cal-today-strip">
        <div class="cal-today-label"><i class="fas fa-clock"></i> Today's Schedule - ${today.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</div>
        <div class="cal-today-doses">
          ${upcomingDoses.map(item => `
            <div class="cal-today-pill" style="--pill-color:${item.color || '#2563eb'}">
              <span class="cal-pill-time">${formatTime12(item.time)}</span>
              <span class="cal-pill-name">${esc(item.peptideName)}</span>
              <span class="cal-pill-dose">${esc(item.dose)}${esc(item.unit)} ${esc(item.route)}</span>
            </div>
          `).join('')}
        </div>
      </div>
      ` : ''}

      <div class="cal-layout">
        <!-- Calendar Grid -->
        <div class="cal-grid-container">
          <div class="cal-nav">
            <button class="cal-nav-btn" onclick="calPrev()"><i class="fas fa-chevron-left"></i></button>
            <span class="cal-nav-title">${new Date(calYear, calMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
            <button class="cal-nav-btn" onclick="calNext()"><i class="fas fa-chevron-right"></i></button>
            <button class="cal-nav-btn cal-today-btn" onclick="calToday()">Today</button>
          </div>
          <div class="cal-weekdays">
            ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => `<div class="cal-wd">${d}</div>`).join('')}
          </div>
          <div class="cal-days" id="calDays">
            ${buildCalendarDays(calYear, calMonth, regimen, today)}
          </div>
        </div>

        <!-- Right Panel: Active Regimen List or Day Detail -->
        <div class="cal-side-panel" id="calSidePanel">
          ${calSelectedDate ? buildDayDetail(calSelectedDate) : buildRegimenList(regimen)}
        </div>
      </div>
    </div>
    <div class="disclaimer"><i class="fas fa-info-circle" style="margin-right:4px"></i> Calendar is stored locally. Export to .ics to sync with Google Calendar, Apple Calendar, or Outlook.</div>
  `;
}

function buildCalendarDays(year, month, regimen, today) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevDays = new Date(year, month, 0).getDate();
  let html = '';

  // Previous month filler
  for (let i = firstDay - 1; i >= 0; i--) {
    html += `<div class="cal-day cal-day-outside">${prevDays - i}</div>`;
  }

  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const dateObj = new Date(year, month, d);
    dateObj.setHours(0,0,0,0);
    const doses = regimen.filter(item => isScheduledOn(item, dateStr));
    const isToday = dateObj.getTime() === today.getTime();
    const isSelected = calSelectedDate === dateStr;
    const isPast = dateObj < today;

    html += `<div class="cal-day ${isToday ? 'cal-day-today' : ''} ${isSelected ? 'cal-day-selected' : ''} ${isPast ? 'cal-day-past' : ''} ${doses.length > 0 ? 'cal-day-has-dose' : ''}" onclick="selectCalDay('${dateStr}')">
      <span class="cal-day-num">${d}</span>
      ${doses.length > 0 ? `<div class="cal-day-dots">${doses.slice(0, 4).map(item => `<span class="cal-dot" style="background:${item.color || '#2563eb'}"></span>`).join('')}${doses.length > 4 ? `<span class="cal-dot-more">+${doses.length - 4}</span>` : ''}</div>` : ''}
    </div>`;
  }

  // Next month filler
  const totalCells = firstDay + daysInMonth;
  const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (let i = 1; i <= remaining; i++) {
    html += `<div class="cal-day cal-day-outside">${i}</div>`;
  }

  return html;
}

function buildRegimenList(regimen) {
  if (regimen.length === 0) {
    return `
      <div class="cal-empty-state">
        <i class="fas fa-calendar-plus"></i>
        <p class="cal-empty-title">No peptides scheduled</p>
        <p class="cal-empty-text">Add your first peptide to start building your regimen calendar.</p>
        <button class="cal-action-btn" onclick="openRegimenForm()"><i class="fas fa-plus"></i> Add Peptide</button>
      </div>
    `;
  }
  return `
    <div class="cal-panel-title"><i class="fas fa-list-check"></i> Active Regimen (${regimen.length})</div>
    <div class="cal-regimen-list">
      ${regimen.map(item => {
        const start = new Date(item.startDate);
        const end = new Date(item.endDate);
        const totalDays = Math.ceil((end - start) / 86400000) + 1;
        const elapsed = Math.max(0, Math.ceil((new Date() - start) / 86400000));
        const progress = Math.min(100, Math.round((elapsed / totalDays) * 100));
        return `
        <div class="cal-regimen-card" style="--reg-color:${item.color || '#2563eb'}">
          <div class="cal-reg-top">
            <div class="cal-reg-name">${esc(item.peptideName)}</div>
            <div class="cal-reg-actions">
              <button class="cal-reg-edit" onclick="openRegimenForm('${item.id}')" title="Edit"><i class="fas fa-pen"></i></button>
              <button class="cal-reg-del" onclick="confirmDeleteRegimen('${item.id}')" title="Delete"><i class="fas fa-trash"></i></button>
            </div>
          </div>
          <div class="cal-reg-meta">
            <span>${esc(item.dose)}${esc(item.unit)} • ${esc(item.route)}</span>
            <span>${formatFrequency(item.frequency)} @ ${formatTime12(item.time)}</span>
          </div>
          <div class="cal-reg-dates">${start.toLocaleDateString('en-US', {month:'short',day:'numeric'})} → ${end.toLocaleDateString('en-US', {month:'short',day:'numeric',year:'numeric'})}</div>
          <div class="cal-progress-bar"><div class="cal-progress-fill" style="width:${progress}%;background:${item.color || '#2563eb'}"></div></div>
          ${item.reminderMin > 0 ? `<div class="cal-reg-reminder"><i class="fas fa-bell"></i> ${item.reminderMin}min before</div>` : ''}
        </div>`;
      }).join('')}
    </div>
  `;
}

function buildDayDetail(dateStr) {
  const doses = getDosesForDate(dateStr);
  const d = new Date(dateStr + 'T00:00:00');
  const dayLabel = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  return `
    <div class="cal-day-detail">
      <button class="cal-back-to-list" onclick="calSelectedDate=null;navigate('calendar')"><i class="fas fa-arrow-left"></i> Back to regimen list</button>
      <div class="cal-panel-title" style="margin-top:12px"><i class="fas fa-calendar-day"></i> ${dayLabel}</div>
      ${doses.length > 0 ? `
        <div class="cal-day-doses-list">
          ${doses.map(item => `
            <div class="cal-dose-card" style="--dose-color:${item.color || '#2563eb'}">
              <div class="cal-dose-time">${formatTime12(item.time)}</div>
              <div class="cal-dose-info">
                <div class="cal-dose-name">${esc(item.peptideName)}</div>
                <div class="cal-dose-meta">${esc(item.dose)}${esc(item.unit)} • ${esc(item.route)} • ${formatFrequency(item.frequency)}</div>
                ${item.notes ? `<div class="cal-dose-notes">${esc(item.notes)}</div>` : ''}
              </div>
              <div class="cal-dose-check"><i class="fas fa-syringe"></i></div>
            </div>
          `).join('')}
        </div>
      ` : `
        <div class="cal-empty-state" style="padding:30px 10px">
          <i class="fas fa-calendar-xmark" style="font-size:28px"></i>
          <p class="cal-empty-title" style="font-size:14px">No doses scheduled</p>
          <p class="cal-empty-text">Nothing planned for this day.</p>
        </div>
      `}
    </div>
  `;
}

// --- Calendar Navigation ---
function calPrev() { calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; } calSelectedDate = null; navigate('calendar'); }
function calNext() { calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; } calSelectedDate = null; navigate('calendar'); }
function calToday() { const t = new Date(); calMonth = t.getMonth(); calYear = t.getFullYear(); calSelectedDate = null; navigate('calendar'); }
function selectCalDay(dateStr) { calSelectedDate = dateStr; navigate('calendar'); }

// --- Helpers ---
function formatTime12(t) {
  if (!t) return '8:00 AM';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2,'0')} ${ampm}`;
}

function formatFrequency(f) {
  const map = { daily: 'Daily', eod: 'Every other day', weekly: 'Weekly', biweekly: 'Biweekly', mwf: 'Mon/Wed/Fri', custom: 'Custom days' };
  return map[f] || f;
}

function confirmDeleteRegimen(id) {
  if (confirm('Remove this peptide from your regimen?')) {
    deleteRegimenItem(id);
    navigate('calendar');
  }
}

// --- Add/Edit Form (Modal) ---
function openRegimenForm(editId) {
  editingRegimenId = editId || null;
  const item = editId ? getRegimen().find(i => i.id === editId) : null;
  const today = new Date().toISOString().split('T')[0];
  const defaultEnd = new Date(Date.now() + 42 * 86400000).toISOString().split('T')[0]; // 6 weeks default

  const overlay = document.createElement('div');
  overlay.className = 'cal-modal-overlay';
  overlay.id = 'regimenFormOverlay';
  overlay.onclick = (e) => { if (e.target === overlay) closeRegimenForm(); };

  overlay.innerHTML = `
    <div class="cal-modal">
      <div class="cal-modal-header">
        <h3>${item ? 'Edit' : 'Add'} Peptide to Regimen</h3>
        <button class="cal-modal-close" onclick="closeRegimenForm()"><i class="fas fa-times"></i></button>
      </div>
      <div class="cal-modal-body">
        <div class="cal-form-group">
          <label>Peptide</label>
          <select id="regPeptide" class="cal-input">
            <option value="">Select a peptide...</option>
            ${peptides.map(p => `<option value="${p.id}" ${item && item.peptideId === p.id ? 'selected' : ''}>${p.name} - ${p.category}</option>`).join('')}
          </select>
        </div>
        <div class="cal-form-row">
          <div class="cal-form-group" style="flex:1">
            <label>Dose</label>
            <input type="number" id="regDose" class="cal-input" placeholder="250" step="any" value="${item ? item.dose : ''}">
          </div>
          <div class="cal-form-group" style="width:90px">
            <label>Unit</label>
            <select id="regUnit" class="cal-input">
              ${['mcg','mg','IU','units'].map(u => `<option ${item && item.unit === u ? 'selected' : ''}>${u}</option>`).join('')}
            </select>
          </div>
          <div class="cal-form-group" style="width:120px">
            <label>Route</label>
            <select id="regRoute" class="cal-input">
              ${['SubQ','IM','IV','Oral','Nasal','Topical'].map(r => `<option ${item && item.route === r ? 'selected' : ''}>${r}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="cal-form-row">
          <div class="cal-form-group" style="flex:1">
            <label>Time of Day</label>
            <input type="time" id="regTime" class="cal-input" value="${item ? item.time : '08:00'}">
          </div>
          <div class="cal-form-group" style="flex:1">
            <label>Frequency</label>
            <select id="regFreq" class="cal-input" onchange="toggleCustomDays()">
              ${[['daily','Daily'],['eod','Every Other Day'],['mwf','Mon / Wed / Fri'],['weekly','Weekly'],['biweekly','Every 2 Weeks'],['custom','Custom Days']].map(([v,l]) => `<option value="${v}" ${item && item.frequency === v ? 'selected' : ''}>${l}</option>`).join('')}
            </select>
          </div>
        </div>
        <div id="customDaysRow" class="cal-form-group cal-custom-days" style="display:none">
          <label>Select Days</label>
          <div class="cal-day-toggles">
            ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d, i) => `<button type="button" class="cal-day-toggle ${item && item.customDays && item.customDays.includes(i) ? 'active' : ''}" data-day="${i}" onclick="this.classList.toggle('active')">${d}</button>`).join('')}
          </div>
        </div>
        <div class="cal-form-row">
          <div class="cal-form-group" style="flex:1">
            <label>Start Date</label>
            <input type="date" id="regStart" class="cal-input" value="${item ? item.startDate : today}">
          </div>
          <div class="cal-form-group" style="flex:1">
            <label>End Date</label>
            <input type="date" id="regEnd" class="cal-input" value="${item ? item.endDate : defaultEnd}">
          </div>
        </div>
        <div class="cal-form-row">
          <div class="cal-form-group" style="flex:1">
            <label>Reminder (minutes before)</label>
            <select id="regReminder" class="cal-input">
              ${[[0,'No reminder'],[5,'5 min'],[10,'10 min'],[15,'15 min'],[30,'30 min'],[60,'1 hour']].map(([v,l]) => `<option value="${v}" ${item && item.reminderMin == v ? 'selected' : ''}>${l}</option>`).join('')}
            </select>
          </div>
          <div class="cal-form-group" style="flex:1">
            <label>Color</label>
            <div class="cal-color-picker" id="regColorPicker">
              ${REGIMEN_COLORS.map((c, i) => `<button type="button" class="cal-color-swatch ${(!item && i === 0) || (item && item.color === c) ? 'active' : ''}" style="background:${c}" data-color="${c}" onclick="pickColor(this)"></button>`).join('')}
            </div>
          </div>
        </div>
        <div class="cal-form-group">
          <label>Notes (optional)</label>
          <input type="text" id="regNotes" class="cal-input" placeholder="e.g., Take on empty stomach, reconstituted with 2mL BAC water" value="${item && item.notes ? item.notes : ''}">
        </div>
      </div>
      <div class="cal-modal-footer">
        <button class="cal-btn-cancel" onclick="closeRegimenForm()">Cancel</button>
        <button class="cal-btn-save" onclick="saveRegimenForm()"><i class="fas fa-check" style="margin-right:5px"></i>${item ? 'Update' : 'Add to Regimen'}</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('open'));
  toggleCustomDays();

  // Auto-fill dose info if selecting a peptide
  document.getElementById('regPeptide').addEventListener('change', function() {
    const p = peptides.find(pp => pp.id === this.value);
    if (p && !editingRegimenId && p.dosing) {
      const doseInput = document.getElementById('regDose');
      if (!doseInput.value) {
        // Parse typical dose
        const match = p.dosing.typical.match(/([\d.]+)\s*(mcg|mg|IU|units)/i);
        if (match) {
          doseInput.value = match[1];
          document.getElementById('regUnit').value = match[2].toLowerCase() === 'iu' ? 'IU' : match[2];
        }
      }
      // Set route
      const route = p.dosing.route;
      if (route) {
        const routeSel = document.getElementById('regRoute');
        for (let opt of routeSel.options) {
          if (route.toLowerCase().includes(opt.value.toLowerCase())) { routeSel.value = opt.value; break; }
        }
      }
    }
  });
}

function closeRegimenForm() {
  const overlay = document.getElementById('regimenFormOverlay');
  if (overlay) {
    overlay.classList.remove('open');
    setTimeout(() => overlay.remove(), 200);
  }
  editingRegimenId = null;
}

function toggleCustomDays() {
  const freq = document.getElementById('regFreq');
  const row = document.getElementById('customDaysRow');
  if (freq && row) row.style.display = freq.value === 'custom' ? 'block' : 'none';
}

function pickColor(btn) {
  document.querySelectorAll('.cal-color-swatch').forEach(s => s.classList.remove('active'));
  btn.classList.add('active');
}

function saveRegimenForm() {
  const pepSel = document.getElementById('regPeptide');
  const dose = document.getElementById('regDose').value;
  const unit = document.getElementById('regUnit').value;
  const route = document.getElementById('regRoute').value;
  const time = document.getElementById('regTime').value;
  const freq = document.getElementById('regFreq').value;
  const start = document.getElementById('regStart').value;
  const end = document.getElementById('regEnd').value;
  const reminder = parseInt(document.getElementById('regReminder').value);
  const notes = document.getElementById('regNotes').value.trim();
  const color = document.querySelector('.cal-color-swatch.active')?.dataset.color || '#2563eb';

  if (!pepSel.value) { alert('Please select a peptide.'); return; }
  if (!dose || parseFloat(dose) <= 0) { alert('Please enter a valid dose.'); return; }
  if (!start || !end) { alert('Please set start and end dates.'); return; }
  if (new Date(end) < new Date(start)) { alert('End date must be after start date.'); return; }

  const pep = peptides.find(p => p.id === pepSel.value);
  const customDays = freq === 'custom'
    ? [...document.querySelectorAll('.cal-day-toggle.active')].map(b => parseInt(b.dataset.day))
    : [];

  const data = {
    peptideId: pepSel.value,
    peptideName: pep ? pep.name : pepSel.value,
    dose, unit, route, time, frequency: freq,
    startDate: start, endDate: end,
    color, reminderMin: reminder, notes,
    customDays
  };

  if (editingRegimenId) {
    updateRegimenItem(editingRegimenId, data);
  } else {
    addRegimenItem(data);
  }

  closeRegimenForm();
  navigate('calendar');
}

// --- iCal (.ics) Export ---
function exportRegimenICal() {
  const regimen = getRegimen();
  if (regimen.length === 0) { alert('No regimen items to export. Add peptides first!'); return; }

  let ical = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PeptideSafe//Regimen Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:PeptideSafe Regimen',
    'X-WR-TIMEZONE:' + Intl.DateTimeFormat().resolvedOptions().timeZone,
  ];

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  regimen.forEach(item => {
    const start = new Date(item.startDate + 'T' + (item.time || '08:00'));
    const end = new Date(item.endDate + 'T23:59:59');
    const durationMin = 5; // 5 min event
    const eventEnd = new Date(start.getTime() + durationMin * 60000);

    // Build RRULE based on frequency
    let rrule = '';
    const untilStr = formatICalDate(end);
    switch (item.frequency) {
      case 'daily':
        rrule = `RRULE:FREQ=DAILY;UNTIL=${untilStr}`;
        break;
      case 'eod':
        rrule = `RRULE:FREQ=DAILY;INTERVAL=2;UNTIL=${untilStr}`;
        break;
      case 'weekly':
        rrule = `RRULE:FREQ=WEEKLY;UNTIL=${untilStr}`;
        break;
      case 'biweekly':
        rrule = `RRULE:FREQ=WEEKLY;INTERVAL=2;UNTIL=${untilStr}`;
        break;
      case 'mwf':
        rrule = `RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR;UNTIL=${untilStr}`;
        break;
      case 'custom':
        if (item.customDays && item.customDays.length > 0) {
          const dayMap = ['SU','MO','TU','WE','TH','FR','SA'];
          const byDay = item.customDays.map(d => dayMap[d]).join(',');
          rrule = `RRULE:FREQ=WEEKLY;BYDAY=${byDay};UNTIL=${untilStr}`;
        }
        break;
    }

    const uid = item.id + '@peptideai';
    const description = `Dose: ${item.dose}${item.unit}\\nRoute: ${item.route}\\nFrequency: ${formatFrequency(item.frequency)}${item.notes ? '\\nNotes: ' + item.notes : ''}`;

    ical.push('BEGIN:VEVENT');
    ical.push('UID:' + uid);
    ical.push('DTSTART;TZID=' + tz + ':' + formatICalDateLocal(start));
    ical.push('DTEND;TZID=' + tz + ':' + formatICalDateLocal(eventEnd));
    if (rrule) ical.push(rrule);
    ical.push('SUMMARY:💉 ' + item.peptideName + ' - ' + item.dose + item.unit);
    ical.push('DESCRIPTION:' + description);
    ical.push('STATUS:CONFIRMED');
    ical.push('CATEGORIES:Peptide Regimen');

    // Alarm / Reminder
    if (item.reminderMin > 0) {
      ical.push('BEGIN:VALARM');
      ical.push('TRIGGER:-PT' + item.reminderMin + 'M');
      ical.push('ACTION:DISPLAY');
      ical.push('DESCRIPTION:Time to take ' + item.peptideName + ' (' + item.dose + item.unit + ')');
      ical.push('END:VALARM');
    }

    ical.push('END:VEVENT');
  });

  ical.push('END:VCALENDAR');

  // Download
  const blob = new Blob([ical.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'PeptideSafe_Regimen.ics';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function formatICalDate(d) {
  return d.getUTCFullYear() +
    String(d.getUTCMonth() + 1).padStart(2, '0') +
    String(d.getUTCDate()).padStart(2, '0') + 'T' +
    String(d.getUTCHours()).padStart(2, '0') +
    String(d.getUTCMinutes()).padStart(2, '0') +
    String(d.getUTCSeconds()).padStart(2, '0') + 'Z';
}

function formatICalDateLocal(d) {
  return d.getFullYear() +
    String(d.getMonth() + 1).padStart(2, '0') +
    String(d.getDate()).padStart(2, '0') + 'T' +
    String(d.getHours()).padStart(2, '0') +
    String(d.getMinutes()).padStart(2, '0') +
    String(d.getSeconds()).padStart(2, '0');
}

// Quick-add from Stack Builder
function addStackToRegimen() {
  const stackPeptides = builderStack.map(id => peptides.find(p => p.id === id)).filter(Boolean);
  if (stackPeptides.length === 0) return;
  const today = new Date().toISOString().split('T')[0];
  const endDate = new Date(Date.now() + 42 * 86400000).toISOString().split('T')[0];
  stackPeptides.forEach((p, i) => {
    const match = p.dosing?.typical?.match(/([\d.]+)\s*(mcg|mg|IU|units)/i);
    addRegimenItem({
      peptideId: p.id,
      peptideName: p.name,
      dose: match ? match[1] : '250',
      unit: match ? (match[2].toLowerCase() === 'iu' ? 'IU' : match[2]) : 'mcg',
      route: p.dosing?.route?.includes('Sub') ? 'SubQ' : p.dosing?.route?.includes('Oral') ? 'Oral' : 'SubQ',
      time: `${String(8 + i).padStart(2, '0')}:00`,
      frequency: p.dosing?.frequency?.toLowerCase().includes('daily') ? 'daily' : p.dosing?.frequency?.toLowerCase().includes('other') ? 'eod' : 'daily',
      startDate: today,
      endDate: endDate,
      color: getRegimenColor(i),
      reminderMin: 15,
      notes: '',
      customDays: []
    });
  });
  navigate('calendar');
}

// ============================================================
// FEATURE 12: DOSE LOGGING / INJECTION TRACKER
// ============================================================
const DOSE_LOG_KEY = 'peptideai_dose_log';
const INJECTION_SITES = ['Left Deltoid','Right Deltoid','Left Quad','Right Quad','Left Abdomen','Right Abdomen','Left Glute','Right Glute','Left Love Handle','Right Love Handle'];

function getDoseLog() { try { return JSON.parse(localStorage.getItem(DOSE_LOG_KEY) || '[]'); } catch { return []; } }
function saveDoseLog(log) { localStorage.setItem(DOSE_LOG_KEY, JSON.stringify(log)); scheduleSyncPush(); }

function logDose(entry) {
  const log = getDoseLog();
  entry.id = 'dl_' + Date.now();
  entry.timestamp = new Date().toISOString();
  log.unshift(entry);
  saveDoseLog(log);
  return entry;
}

function deleteDoseLogEntry(id) {
  saveDoseLog(getDoseLog().filter(e => e.id !== id));
}

function getLastSite() {
  const log = getDoseLog();
  return log.length > 0 ? log[0].site : '';
}

function getSuggestedSite() {
  const last = getLastSite();
  const idx = INJECTION_SITES.indexOf(last);
  if (idx === -1) return INJECTION_SITES[0];
  return INJECTION_SITES[(idx + 1) % INJECTION_SITES.length];
}

function renderDoseLog(el) {
  const _dtSaveBanner = !currentUser ? renderSaveBanner('Dose Tracker', '#2563eb') : '';
  const log = getDoseLog();
  const regimen = getRegimen();
  const today = new Date().toISOString().split('T')[0];
  const todayLogs = log.filter(e => e.timestamp.startsWith(today));
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const weekLogs = log.filter(e => e.timestamp >= weekAgo);

  // Site rotation heatmap data
  const siteCount = {};
  weekLogs.forEach(e => { siteCount[e.site] = (siteCount[e.site] || 0) + 1; });

  el.innerHTML = `
    <div class="tracker-view">
      <!-- PAGE HERO -->
      <div class="page-hero page-hero-blue" style="margin-bottom:20px">
        <div class="page-hero-bg">
          <div class="ph-orb ph-orb1" style="background:radial-gradient(circle,rgba(37,99,235,.35),rgba(59,130,246,.1))"></div>
          <div class="ph-orb ph-orb2" style="background:radial-gradient(circle,rgba(59,130,246,.25),rgba(96,165,250,.1))"></div>
          <div class="ph-orb ph-orb3" style="background:radial-gradient(circle,rgba(96,165,250,.2),rgba(37,99,235,.1))"></div>
          <div class="ph-grid"></div>
        </div>
        <div class="page-hero-body">
          <div class="ph-icon" style="background:rgba(37,99,235,.2);border-color:rgba(37,99,235,.3);color:#60a5fa"><i class="fas fa-syringe"></i></div>
          <div class="ph-text">
            <h1 class="ph-title">Dose Tracker</h1>
            <p class="ph-sub">Log each injection, track site rotation, and monitor your compliance streak.</p>
          </div>
          <div class="ph-stats">
            <div class="ph-stat"><div class="ph-stat-n">${todayLogs.length}</div><div class="ph-stat-l">Today</div></div>
            <div class="ph-stat"><div class="ph-stat-n">${weekLogs.length}</div><div class="ph-stat-l">This Week</div></div>
            <div class="ph-stat"><div class="ph-stat-n">${log.length}</div><div class="ph-stat-l">All Time</div></div>
          </div>
          <div class="ph-actions">
            <button class="ph-action-btn" onclick="openDoseLogForm()"><i class="fas fa-plus"></i> Log Dose</button>
          </div>
        </div>
      </div>

      ${_dtSaveBanner}

      <!-- Stats Strip -->
      <div class="tracker-stats">
        <div class="tracker-stat-card">
          <div class="tracker-stat-num">${todayLogs.length}</div>
          <div class="tracker-stat-label">Today</div>
        </div>
        <div class="tracker-stat-card">
          <div class="tracker-stat-num">${weekLogs.length}</div>
          <div class="tracker-stat-label">This Week</div>
        </div>
        <div class="tracker-stat-card">
          <div class="tracker-stat-num">${log.length}</div>
          <div class="tracker-stat-label">All Time</div>
        </div>
        <div class="tracker-stat-card">
          <div class="tracker-stat-num">${getSuggestedSite().split(' ').map(w => w[0]).join('')}</div>
          <div class="tracker-stat-label">Next Site: ${getSuggestedSite()}</div>
        </div>
      </div>

      <!-- Site Rotation Map -->
      <div class="tracker-section">
        <div class="tracker-section-title"><i class="fas fa-body-text"></i> Site Rotation (Last 7 Days)</div>
        <div class="site-rotation-grid">
          ${INJECTION_SITES.map(site => {
            const count = siteCount[site] || 0;
            const intensity = Math.min(count * 25, 100);
            const isLast = getLastSite() === site;
            return `<div class="site-chip ${isLast ? 'site-last' : ''}" style="--site-intensity:${intensity}%">
              <span class="site-name">${site}</span>
              <span class="site-count">${count}</span>
            </div>`;
          }).join('')}
        </div>
      </div>

      <!-- Recent Log -->
      <div class="tracker-section">
        <div class="tracker-section-title"><i class="fas fa-history"></i> Recent Doses</div>
        ${log.length > 0 ? `
          <div class="dose-log-list">
            ${log.slice(0, 30).map(e => {
              const d = new Date(e.timestamp);
              const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
              const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              const isToday = e.timestamp.startsWith(today);
              return `<div class="dose-log-item ${isToday ? 'dose-log-today' : ''}">
                <div class="dose-log-time">
                  <span class="dose-log-date">${isToday ? 'Today' : dateStr}</span>
                  <span class="dose-log-clock">${timeStr}</span>
                </div>
                <div class="dose-log-info">
                  <div class="dose-log-name">${esc(e.peptideName)}</div>
                  <div class="dose-log-meta">${esc(e.dose)}${esc(e.unit)} • ${esc(e.route)} • ${esc(e.site)}</div>
                  ${e.notes ? `<div class="dose-log-notes">${esc(e.notes)}</div>` : ''}
                </div>
                <button class="dose-log-del" onclick="deleteDoseLogEntry('${e.id}');navigate('tracker')"><i class="fas fa-times"></i></button>
              </div>`;
            }).join('')}
          </div>
          ${log.length > 30 ? `<p style="text-align:center;font-size:12px;color:var(--text-muted);margin-top:10px">Showing 30 of ${log.length} entries</p>` : ''}
        ` : `<div class="cal-empty-state" style="padding:30px"><i class="fas fa-syringe"></i><p class="cal-empty-title">No doses logged yet</p><p class="cal-empty-text">Tap "Log Dose" to record your first injection.</p></div>`}
      </div>
    </div>
    <div class="disclaimer"><i class="fas fa-info-circle" style="margin-right:4px"></i> Dose log is stored locally in your browser. For educational tracking only.</div>
  `;
}

function openDoseLogForm() {
  const suggested = getSuggestedSite();
  const overlay = document.createElement('div');
  overlay.className = 'cal-modal-overlay';
  overlay.id = 'doseLogOverlay';
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  overlay.innerHTML = `
    <div class="cal-modal">
      <div class="cal-modal-header"><h3>Log Dose</h3><button class="cal-modal-close" onclick="document.getElementById('doseLogOverlay').remove()"><i class="fas fa-times"></i></button></div>
      <div class="cal-modal-body">
        <div class="cal-form-group"><label>Peptide</label><select id="dlPeptide" class="cal-input"><option value="">Select...</option>${peptides.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}</select></div>
        <div class="cal-form-row">
          <div class="cal-form-group" style="flex:1"><label>Dose</label><input type="number" id="dlDose" class="cal-input" placeholder="250" step="any"></div>
          <div class="cal-form-group" style="width:90px"><label>Unit</label><select id="dlUnit" class="cal-input">${['mcg','mg','IU','units'].map(u => `<option>${u}</option>`).join('')}</select></div>
          <div class="cal-form-group" style="width:100px"><label>Route</label><select id="dlRoute" class="cal-input">${['SubQ','IM','IV','Oral','Nasal','Topical'].map(r => `<option>${r}</option>`).join('')}</select></div>
        </div>
        <div class="cal-form-group"><label>Injection Site</label><select id="dlSite" class="cal-input">${INJECTION_SITES.map(s => `<option ${s === suggested ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
        <div class="cal-form-group"><label>Notes (optional)</label><input type="text" id="dlNotes" class="cal-input" placeholder="e.g., slight pip, used 29g needle"></div>
      </div>
      <div class="cal-modal-footer">
        <button class="cal-btn-cancel" onclick="document.getElementById('doseLogOverlay').remove()">Cancel</button>
        <button class="cal-btn-save" onclick="saveDoseLogForm()"><i class="fas fa-check" style="margin-right:5px"></i>Log Dose</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('open'));

  // Auto-fill from peptide selection
  document.getElementById('dlPeptide').addEventListener('change', function() {
    const p = peptides.find(pp => pp.id === this.value);
    if (p && p.dosing) {
      const match = p.dosing.typical.match(/([\d.]+)\s*(mcg|mg|IU|units)/i);
      if (match && !document.getElementById('dlDose').value) {
        document.getElementById('dlDose').value = match[1];
        document.getElementById('dlUnit').value = match[2].toLowerCase() === 'iu' ? 'IU' : match[2];
      }
      const route = p.dosing.route;
      if (route) {
        const routeSel = document.getElementById('dlRoute');
        for (let opt of routeSel.options) { if (route.toLowerCase().includes(opt.value.toLowerCase())) { routeSel.value = opt.value; break; } }
      }
    }
  });
}

function saveDoseLogForm() {
  const pepSel = document.getElementById('dlPeptide');
  const dose = document.getElementById('dlDose').value;
  const unit = document.getElementById('dlUnit').value;
  const route = document.getElementById('dlRoute').value;
  const site = document.getElementById('dlSite').value;
  const notes = document.getElementById('dlNotes').value.trim();
  if (!pepSel.value || !dose) { alert('Please select a peptide and enter a dose.'); return; }
  const pep = peptides.find(p => p.id === pepSel.value);
  logDose({ peptideId: pepSel.value, peptideName: pep ? pep.name : pepSel.value, dose, unit, route, site, notes });
  document.getElementById('doseLogOverlay')?.remove();
  navigate('tracker');
}

// ============================================================
// FEATURE 13: SIDE EFFECT JOURNAL
// ============================================================
const JOURNAL_KEY = 'peptideai_journal';
const SIDE_EFFECTS_LIST = ['Injection site pain','Redness/swelling','Nausea','Headache','Fatigue','Dizziness','Flushing','Appetite change','Water retention','Numbness/tingling','Insomnia','Joint pain','Mood changes','Brain fog','Heart palpitations','Other'];

function getJournal() { try { return JSON.parse(localStorage.getItem(JOURNAL_KEY) || '[]'); } catch { return []; } }
function saveJournal(j) { localStorage.setItem(JOURNAL_KEY, JSON.stringify(j)); scheduleSyncPush(); }

function renderJournal(el) {
  const _jSaveBanner = !currentUser ? renderSaveBanner('Side Effect Journal', '#8b5cf6') : '';
  const journal = getJournal();
  const today = new Date().toISOString().split('T')[0];
  const todayEntry = journal.find(e => e.date === today);
  const last7 = journal.slice(0, 7);

  // Trend data for mini chart
  const trendData = journal.slice(0, 14).reverse();
  const trendSVG = buildTrendSVG(trendData);

  // Most common side effects
  const seCount = {};
  journal.forEach(e => (e.sideEffects || []).forEach(s => { seCount[s] = (seCount[s] || 0) + 1; }));
  const topSE = Object.entries(seCount).sort((a, b) => b[1] - a[1]).slice(0, 5);

  el.innerHTML = `
    <div class="journal-view">
      <!-- PAGE HERO -->
      <div class="page-hero page-hero-violet" style="margin-bottom:20px">
        <div class="page-hero-bg">
          <div class="ph-orb ph-orb1" style="background:radial-gradient(circle,rgba(139,92,246,.35),rgba(124,58,237,.1))"></div>
          <div class="ph-orb ph-orb2" style="background:radial-gradient(circle,rgba(124,58,237,.25),rgba(167,139,250,.1))"></div>
          <div class="ph-orb ph-orb3" style="background:radial-gradient(circle,rgba(167,139,250,.2),rgba(139,92,246,.1))"></div>
          <div class="ph-grid"></div>
        </div>
        <div class="page-hero-body">
          <div class="ph-icon" style="background:rgba(139,92,246,.2);border-color:rgba(139,92,246,.3);color:#a78bfa"><i class="fas fa-book-medical"></i></div>
          <div class="ph-text">
            <h1 class="ph-title">Side Effect Journal</h1>
            <p class="ph-sub">Daily wellness check-ins, side effect logging, and trend charts to track how you feel over time.</p>
          </div>
          <div class="ph-actions">
            <button class="ph-action-btn" style="background:rgba(139,92,246,.25);border-color:rgba(139,92,246,.4)" onclick="openJournalEntry('${today}')"><i class="fas fa-plus"></i> ${todayEntry ? 'Edit Today' : 'Log Today'}</button>
          </div>
        </div>
      </div>

      ${_jSaveBanner}

      <!-- Wellness Trend -->
      <div class="journal-trend-card">
        <div class="journal-trend-title">Wellness Trend (Last 14 Days)</div>
        ${trendData.length >= 2 ? trendSVG : '<p style="text-align:center;font-size:12px;color:var(--text-muted);padding:20px">Log at least 2 days to see trends</p>'}
      </div>

      <div class="journal-layout">
        <!-- Top Side Effects -->
        <div class="journal-top-se">
          <div class="tracker-section-title"><i class="fas fa-chart-bar"></i> Most Reported</div>
          ${topSE.length > 0 ? topSE.map(([name, count]) => `
            <div class="se-bar-row">
              <span class="se-bar-name">${esc(name)}</span>
              <div class="se-bar"><div class="se-bar-fill" style="width:${Math.min(100, (count / journal.length) * 100)}%"></div></div>
              <span class="se-bar-count">${count}×</span>
            </div>
          `).join('') : '<p style="font-size:12px;color:var(--text-muted)">No data yet</p>'}
        </div>

        <!-- Recent Entries -->
        <div class="journal-entries">
          <div class="tracker-section-title"><i class="fas fa-calendar-check"></i> Recent Entries</div>
          ${journal.length > 0 ? journal.slice(0, 14).map(e => {
            const d = new Date(e.date + 'T00:00:00');
            const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            const moodEmoji = ['','😫','😕','😐','🙂','💪'][e.rating] || '😐';
            return `<div class="journal-entry-card" onclick="openJournalEntry('${e.date}')">
              <div class="journal-entry-rating">${moodEmoji}<span class="journal-rating-num">${e.rating}/5</span></div>
              <div class="journal-entry-body">
                <div class="journal-entry-date">${dayLabel}</div>
                <div class="journal-entry-se">${(e.sideEffects || []).length > 0 ? e.sideEffects.join(', ') : 'No side effects'}</div>
                ${e.notes ? `<div class="journal-entry-notes">${esc(e.notes)}</div>` : ''}
              </div>
            </div>`;
          }).join('') : `<div class="cal-empty-state" style="padding:30px"><i class="fas fa-book-medical"></i><p class="cal-empty-title">No entries yet</p><p class="cal-empty-text">Tap "Log Today" to start tracking.</p></div>`}
        </div>
      </div>
    </div>
    <div class="disclaimer"><i class="fas fa-info-circle" style="margin-right:4px"></i> Journal is stored locally. Share with your healthcare provider if needed.</div>
  `;
}

function buildTrendSVG(data) {
  if (data.length < 2) return '';
  const w = 400, h = 80, pad = 10;
  const maxR = 5;
  const stepX = (w - pad * 2) / (data.length - 1);
  const points = data.map((e, i) => [pad + i * stepX, h - pad - ((e.rating / maxR) * (h - pad * 2))]);
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ');
  const area = line + ` L${points[points.length - 1][0]},${h - pad} L${pad},${h - pad} Z`;
  return `<svg viewBox="0 0 ${w} ${h}" class="journal-trend-svg">
    <defs><linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#8b5cf6" stop-opacity="0.3"/><stop offset="100%" stop-color="#8b5cf6" stop-opacity="0.02"/></linearGradient></defs>
    <path d="${area}" fill="url(#trendGrad)"/>
    <path d="${line}" fill="none" stroke="#8b5cf6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    ${points.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="#8b5cf6" stroke="var(--surface)" stroke-width="2"/>`).join('')}
  </svg>`;
}

function openJournalEntry(date) {
  const journal = getJournal();
  const existing = journal.find(e => e.date === date);
  const overlay = document.createElement('div');
  overlay.className = 'cal-modal-overlay';
  overlay.id = 'journalOverlay';
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  overlay.innerHTML = `
    <div class="cal-modal">
      <div class="cal-modal-header"><h3>${existing ? 'Edit' : 'New'} Journal Entry - ${new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</h3><button class="cal-modal-close" onclick="document.getElementById('journalOverlay').remove()"><i class="fas fa-times"></i></button></div>
      <div class="cal-modal-body">
        <div class="cal-form-group">
          <label>How do you feel today? (1-5)</label>
          <div class="journal-rating-picker">
            ${[1,2,3,4,5].map(r => `<button type="button" class="journal-rating-btn ${existing && existing.rating === r ? 'active' : ''}" data-rating="${r}" onclick="document.querySelectorAll('.journal-rating-btn').forEach(b=>b.classList.remove('active'));this.classList.add('active')">
              <span class="journal-rating-emoji">${['','😫','😕','😐','🙂','💪'][r]}</span>
              <span class="journal-rating-label">${['','Terrible','Poor','Okay','Good','Great'][r]}</span>
            </button>`).join('')}
          </div>
        </div>
        <div class="cal-form-group">
          <label>Side Effects (select all that apply)</label>
          <div class="journal-se-grid">
            ${SIDE_EFFECTS_LIST.map(se => `<button type="button" class="journal-se-btn ${existing && existing.sideEffects?.includes(se) ? 'active' : ''}" onclick="this.classList.toggle('active')">${se}</button>`).join('')}
          </div>
        </div>
        <div class="cal-form-group">
          <label>Active Peptides</label>
          <div class="journal-se-grid">
            ${getRegimen().map(r => `<button type="button" class="journal-se-btn journal-pep-btn ${existing && existing.activePeptides?.includes(r.peptideName) ? 'active' : ''}" onclick="this.classList.toggle('active')">${r.peptideName}</button>`).join('')}
            ${getRegimen().length === 0 ? '<p style="font-size:11px;color:var(--text-muted)">Add peptides to your Regimen Calendar first</p>' : ''}
          </div>
        </div>
        <div class="cal-form-group"><label>Notes</label><textarea id="journalNotes" class="cal-input" rows="3" placeholder="How you feel, what you noticed...">${existing && existing.notes ? existing.notes : ''}</textarea></div>
      </div>
      <div class="cal-modal-footer">
        ${existing ? `<button class="cal-btn-cancel" style="color:#ef4444" onclick="deleteJournalEntry('${date}')"><i class="fas fa-trash" style="margin-right:4px"></i>Delete</button>` : '<span></span>'}
        <div style="display:flex;gap:8px">
          <button class="cal-btn-cancel" onclick="document.getElementById('journalOverlay').remove()">Cancel</button>
          <button class="cal-btn-save" style="background:linear-gradient(135deg,#8b5cf6,#7c3aed)" onclick="saveJournalEntry('${date}')"><i class="fas fa-check" style="margin-right:5px"></i>Save</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('open'));
}

function saveJournalEntry(date) {
  const rating = parseInt(document.querySelector('.journal-rating-btn.active')?.dataset.rating || '3');
  const sideEffects = [...document.querySelectorAll('.journal-se-btn.active:not(.journal-pep-btn)')].map(b => b.textContent);
  const activePeptides = [...document.querySelectorAll('.journal-pep-btn.active')].map(b => b.textContent);
  const notes = document.getElementById('journalNotes')?.value.trim() || '';
  const journal = getJournal().filter(e => e.date !== date);
  journal.unshift({ date, rating, sideEffects, activePeptides, notes });
  journal.sort((a, b) => b.date.localeCompare(a.date));
  saveJournal(journal);
  document.getElementById('journalOverlay')?.remove();
  navigate('journal');
}

function deleteJournalEntry(date) {
  if (confirm('Delete this journal entry?')) {
    saveJournal(getJournal().filter(e => e.date !== date));
    document.getElementById('journalOverlay')?.remove();
    navigate('journal');
  }
}

// ============================================================
// FEATURE 14: RECONSTITUTION CALCULATOR PRO
// ============================================================
const VIALS_KEY = 'peptideai_vials';

function getVials() { try { return JSON.parse(localStorage.getItem(VIALS_KEY) || '[]'); } catch { return []; } }
function saveVials(v) { localStorage.setItem(VIALS_KEY, JSON.stringify(v)); }

function renderCalcPro(el) {
  const vials = getVials();
  el.innerHTML = `
    <div class="calc-view" style="max-width:800px">

      <!-- PAGE HERO -->
      <div class="page-hero page-hero-cyan">
        <div class="page-hero-bg">
          <div class="ph-orb ph-orb1" style="background:radial-gradient(circle,rgba(6,182,212,.35),rgba(8,145,178,.1))"></div>
          <div class="ph-orb ph-orb2" style="background:radial-gradient(circle,rgba(8,145,178,.25),rgba(6,182,212,.1))"></div>
          <div class="ph-orb ph-orb3" style="background:radial-gradient(circle,rgba(103,232,249,.2),rgba(6,182,212,.1))"></div>
          <div class="ph-grid"></div>
        </div>
        <div class="page-hero-body">
          <div class="ph-icon" style="background:rgba(6,182,212,.2);border-color:rgba(6,182,212,.3);color:#67e8f9"><i class="fas fa-flask-vial"></i></div>
          <div class="ph-text">
            <h1 class="ph-title">Recon Calculator Pro</h1>
            <p class="ph-sub">Multi-vial tracking, BAC water optimizer, expiration alerts, and precise dose calculations.</p>
          </div>
          <div class="ph-stats">
            <div class="ph-stat"><div class="ph-stat-n">${vials.length}</div><div class="ph-stat-l">Vials Tracked</div></div>
            <div class="ph-stat"><div class="ph-stat-n">${vials.filter(v => { const d = new Date(v.reconDate); const e = new Date(d.getTime() + (v.expiryDays||28)*86400000); return e > new Date(); }).length}</div><div class="ph-stat-l">Active</div></div>
            <div class="ph-stat"><div class="ph-stat-n">BAC</div><div class="ph-stat-l">Optimizer</div></div>
          </div>
        </div>
      </div>

      <!-- Quick Calculator -->
      <div class="calcpro-card">
        <div class="calcpro-card-title">Quick Calculate</div>
        <div class="cal-form-row" style="margin-bottom:12px">
          <div class="cal-form-group" style="flex:1"><label>Peptide Amount</label><input type="number" id="cpAmt" class="cal-input" placeholder="5" step="any" oninput="calcProUpdate()"> </div>
          <div class="cal-form-group" style="width:80px"><label>Unit</label><select id="cpAmtUnit" class="cal-input" onchange="calcProUpdate()"><option>mg</option><option>mcg</option></select></div>
          <div class="cal-form-group" style="flex:1"><label>BAC Water</label><input type="number" id="cpWater" class="cal-input" placeholder="2" step="any" oninput="calcProUpdate()"></div>
          <div class="cal-form-group" style="width:80px"><label>ml</label><div class="cal-input" style="background:var(--bg);display:flex;align-items:center;color:var(--text-muted)">mL</div></div>
        </div>
        <div class="cal-form-row" style="margin-bottom:16px">
          <div class="cal-form-group" style="flex:1"><label>Desired Dose</label><input type="number" id="cpDose" class="cal-input" placeholder="250" step="any" oninput="calcProUpdate()"></div>
          <div class="cal-form-group" style="width:80px"><label>Unit</label><select id="cpDoseUnit" class="cal-input" onchange="calcProUpdate()"><option>mcg</option><option>mg</option><option>IU</option></select></div>
        </div>
        <div class="calcpro-results" id="cpResults"></div>
      </div>

      <!-- BAC Water Optimizer -->
      <div class="calcpro-card">
        <div class="calcpro-card-title">BAC Water Optimizer</div>
        <p style="font-size:12px;color:var(--text-secondary);margin-bottom:12px">Find the ideal BAC water volume for easy-to-measure doses.</p>
        <div class="cal-form-row" style="margin-bottom:12px">
          <div class="cal-form-group" style="flex:1"><label>Vial Size (mg)</label><input type="number" id="optVial" class="cal-input" placeholder="5" step="any" oninput="calcOptimize()"></div>
          <div class="cal-form-group" style="flex:1"><label>Target Dose (mcg)</label><input type="number" id="optDose" class="cal-input" placeholder="250" step="any" oninput="calcOptimize()"></div>
          <div class="cal-form-group" style="flex:1"><label>Syringe Size (units)</label><select id="optSyringe" class="cal-input" onchange="calcOptimize()"><option value="100">100u (1mL)</option><option value="50">50u (0.5mL)</option><option value="30">30u (0.3mL)</option></select></div>
        </div>
        <div id="optResults"></div>
      </div>

      <!-- My Vials -->
      <div class="calcpro-card">
        <div class="calcpro-card-title" style="display:flex;justify-content:space-between;align-items:center">
          <span>My Vials</span>
          <button class="cal-action-btn" style="font-size:11px;padding:6px 12px" onclick="openVialForm()"><i class="fas fa-plus"></i> Add Vial</button>
        </div>
        ${vials.length > 0 ? `<div class="vial-list">
          ${vials.map((v, i) => {
            const reconDate = new Date(v.reconDate);
            const expDate = new Date(reconDate.getTime() + (v.expiryDays || 28) * 86400000);
            const now = new Date();
            const daysLeft = Math.ceil((expDate - now) / 86400000);
            const isExpired = daysLeft <= 0;
            const isWarning = daysLeft > 0 && daysLeft <= 5;
            const dosesUsed = v.dosesUsed || 0;
            const totalDoses = v.totalDoses || 0;
            const pctLeft = totalDoses > 0 ? Math.max(0, ((totalDoses - dosesUsed) / totalDoses) * 100) : 100;
            return `<div class="vial-card ${isExpired ? 'vial-expired' : isWarning ? 'vial-warning' : ''}">
              <div class="vial-top">
                <div class="vial-name">${esc(v.peptideName)}</div>
                <button class="cal-reg-del" onclick="getVials().splice(${i},1);saveVials(getVials().filter((_,idx)=>idx!==${i}));navigate('calc-pro')"><i class="fas fa-times"></i></button>
              </div>
              <div class="vial-meta">${v.amount}mg in ${v.water}mL BAC → ${(v.amount * 1000 / v.water).toFixed(0)} mcg/0.1mL</div>
              <div class="vial-meta">Reconstituted: ${reconDate.toLocaleDateString('en-US', {month:'short',day:'numeric'})}</div>
              <div class="vial-expiry ${isExpired ? 'text-red' : isWarning ? 'text-amber' : ''}">
                <i class="fas ${isExpired ? 'fa-skull-crossbones' : isWarning ? 'fa-exclamation-triangle' : 'fa-clock'}"></i>
                ${isExpired ? 'EXPIRED' : `${daysLeft} days left`}
              </div>
              <div class="cal-progress-bar" style="margin-top:6px"><div class="cal-progress-fill" style="width:${pctLeft}%;background:${isExpired ? '#3b82f6' : isWarning ? '#f59e0b' : '#06b6d4'}"></div></div>
              <div class="vial-meta">${dosesUsed}/${totalDoses} doses used</div>
            </div>`;
          }).join('')}
        </div>` : '<p style="font-size:12px;color:var(--text-muted);text-align:center;padding:20px">No vials tracked yet. Add your first vial above.</p>'}
      </div>
    </div>
  `;
  calcProUpdate();
  calcOptimize();
}

function calcProUpdate() {
  const amt = parseFloat(document.getElementById('cpAmt')?.value) || 0;
  const amtUnit = document.getElementById('cpAmtUnit')?.value || 'mg';
  const water = parseFloat(document.getElementById('cpWater')?.value) || 0;
  const dose = parseFloat(document.getElementById('cpDose')?.value) || 0;
  const doseUnit = document.getElementById('cpDoseUnit')?.value || 'mcg';
  const el = document.getElementById('cpResults');
  if (!el || !amt || !water || !dose) { if (el) el.innerHTML = ''; return; }

  let amtMcg = amtUnit === 'mg' ? amt * 1000 : amt;
  let doseMcg = doseUnit === 'mg' ? dose * 1000 : doseUnit === 'IU' ? dose : dose;
  const concentration = amtMcg / water; // mcg per mL
  const volumeML = doseMcg / concentration;
  const syringeUnits = volumeML * 100;
  const totalDoses = Math.floor(amtMcg / doseMcg);

  el.innerHTML = `
    <div class="calcpro-result-grid">
      <div class="calcpro-result"><div class="calcpro-result-label">Concentration</div><div class="calcpro-result-value">${concentration.toFixed(1)} mcg/mL</div></div>
      <div class="calcpro-result"><div class="calcpro-result-label">Draw Volume</div><div class="calcpro-result-value">${volumeML.toFixed(3)} mL</div></div>
      <div class="calcpro-result"><div class="calcpro-result-label">Syringe Units</div><div class="calcpro-result-value">${syringeUnits.toFixed(1)} units</div></div>
      <div class="calcpro-result"><div class="calcpro-result-label">Doses/Vial</div><div class="calcpro-result-value">${totalDoses}</div></div>
    </div>
  `;
}

function calcOptimize() {
  const vial = parseFloat(document.getElementById('optVial')?.value) || 0;
  const target = parseFloat(document.getElementById('optDose')?.value) || 0;
  const syringe = parseInt(document.getElementById('optSyringe')?.value) || 100;
  const el = document.getElementById('optResults');
  if (!el || !vial || !target) { if (el) el.innerHTML = ''; return; }

  const options = [1, 1.5, 2, 2.5, 3, 4, 5].map(water => {
    const conc = (vial * 1000) / water;
    const vol = target / conc;
    const units = vol * 100;
    const totalDoses = Math.floor((vial * 1000) / target);
    const isClean = units % 5 < 0.5 || units % 5 > 4.5;
    const fitsInSyringe = units <= syringe;
    return { water, conc, vol, units, totalDoses, isClean, fitsInSyringe };
  }).filter(o => o.fitsInSyringe);

  el.innerHTML = `<div class="opt-table"><table>
    <tr><th>BAC Water</th><th>Draw</th><th>Units</th><th>Doses/Vial</th><th></th></tr>
    ${options.map(o => `<tr class="${o.isClean ? 'opt-recommended' : ''}">
      <td>${o.water} mL</td><td>${o.vol.toFixed(3)} mL</td><td>${o.units.toFixed(1)}u</td><td>${o.totalDoses}</td>
      <td>${o.isClean ? '<span class="opt-badge">✓ Clean</span>' : ''}</td>
    </tr>`).join('')}
  </table></div>`;
}

function openVialForm() {
  const overlay = document.createElement('div');
  overlay.className = 'cal-modal-overlay';
  overlay.id = 'vialOverlay';
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  overlay.innerHTML = `
    <div class="cal-modal">
      <div class="cal-modal-header"><h3>Add Vial</h3><button class="cal-modal-close" onclick="document.getElementById('vialOverlay').remove()"><i class="fas fa-times"></i></button></div>
      <div class="cal-modal-body">
        <div class="cal-form-group"><label>Peptide</label><select id="vialPep" class="cal-input"><option value="">Select...</option>${peptides.map(p => `<option value="${p.name}">${p.name}</option>`).join('')}</select></div>
        <div class="cal-form-row">
          <div class="cal-form-group" style="flex:1"><label>Vial Amount (mg)</label><input type="number" id="vialAmt" class="cal-input" placeholder="5" step="any"></div>
          <div class="cal-form-group" style="flex:1"><label>BAC Water Added (mL)</label><input type="number" id="vialWater" class="cal-input" placeholder="2" step="any"></div>
        </div>
        <div class="cal-form-row">
          <div class="cal-form-group" style="flex:1"><label>Dose per injection (mcg)</label><input type="number" id="vialDose" class="cal-input" placeholder="250" step="any"></div>
          <div class="cal-form-group" style="flex:1"><label>Reconstitution Date</label><input type="date" id="vialDate" class="cal-input" value="${new Date().toISOString().split('T')[0]}"></div>
        </div>
        <div class="cal-form-group"><label>Expiry (days after recon)</label><select id="vialExpiry" class="cal-input"><option value="28">28 days (standard)</option><option value="14">14 days (conservative)</option><option value="42">42 days (with preservative)</option></select></div>
      </div>
      <div class="cal-modal-footer">
        <button class="cal-btn-cancel" onclick="document.getElementById('vialOverlay').remove()">Cancel</button>
        <button class="cal-btn-save" onclick="saveVialForm()"><i class="fas fa-check" style="margin-right:5px"></i>Add Vial</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('open'));
}

function saveVialForm() {
  const name = document.getElementById('vialPep').value;
  const amt = parseFloat(document.getElementById('vialAmt').value);
  const water = parseFloat(document.getElementById('vialWater').value);
  const dosePerInj = parseFloat(document.getElementById('vialDose').value);
  const reconDate = document.getElementById('vialDate').value;
  const expiryDays = parseInt(document.getElementById('vialExpiry').value);
  if (!name || !amt || !water || !dosePerInj) { alert('Please fill all required fields.'); return; }
  const totalDoses = Math.floor((amt * 1000) / dosePerInj);
  const vials = getVials();
  vials.push({ peptideName: name, amount: amt, water, dosePerInj, reconDate, expiryDays, totalDoses, dosesUsed: 0 });
  saveVials(vials);
  document.getElementById('vialOverlay')?.remove();
  navigate('calc-pro');
}

// ============================================================
// PEPTIDE INVENTORY TRACKER
// ============================================================
// Tracks what compounds you physically own: quantity on hand, vial size,
// purchase/expiry dates, supplier, cost, and storage location. Surfaces
// low-stock and expiring-soon alerts so you can reorder before running out.
// Persists to localStorage (peptideai_inventory) and syncs across devices
// for signed-in users via scheduleSyncPush().
const INVENTORY_KEY = 'peptideai_inventory';

function getInventory() {
  try { return JSON.parse(localStorage.getItem(INVENTORY_KEY) || '[]'); } catch { return []; }
}
function saveInventory(items) {
  localStorage.setItem(INVENTORY_KEY, JSON.stringify(items));
  if (typeof scheduleSyncPush === 'function') scheduleSyncPush();
}

// Days until an item expires (null if no expiry set). Negative = already expired.
function invDaysToExpiry(item) {
  if (!item.expiryDate) return null;
  const exp = new Date(item.expiryDate + 'T00:00:00');
  if (isNaN(exp.getTime())) return null;
  return Math.ceil((exp - new Date()) / 86400000);
}

// Status classification used for badges + sorting.
function invStatus(item) {
  const qty = Number(item.quantity) || 0;
  const low = Number(item.lowStockThreshold) || 0;
  const d = invDaysToExpiry(item);
  if (d !== null && d < 0) return { key: 'expired', label: 'Expired', color: '#ef4444', icon: 'fa-skull-crossbones' };
  if (qty <= 0) return { key: 'out', label: 'Out of stock', color: '#ef4444', icon: 'fa-circle-xmark' };
  if (d !== null && d <= 14) return { key: 'expiring', label: `Expires in ${d}d`, color: '#f59e0b', icon: 'fa-hourglass-half' };
  if (low > 0 && qty <= low) return { key: 'low', label: 'Low stock', color: '#f59e0b', icon: 'fa-triangle-exclamation' };
  return { key: 'ok', label: 'In stock', color: '#10b981', icon: 'fa-circle-check' };
}

function renderInventory(el) {
  const items = getInventory();
  const sorted = items.slice().sort((a, b) => {
    const rank = { expired: 0, out: 1, expiring: 2, low: 3, ok: 4 };
    return rank[invStatus(a).key] - rank[invStatus(b).key];
  });

  const totalVials = items.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
  const needsAttention = items.filter(i => ['expired', 'out', 'expiring', 'low'].includes(invStatus(i).key));
  const totalValue = items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unitCost) || 0), 0);

  el.innerHTML = `
    <div class="inv-view" style="max-width:860px">

      <!-- PAGE HERO -->
      <div class="page-hero page-hero-purple">
        <div class="page-hero-bg">
          <div class="ph-orb ph-orb1" style="background:radial-gradient(circle,rgba(168,85,247,.35),rgba(147,51,234,.1))"></div>
          <div class="ph-orb ph-orb2" style="background:radial-gradient(circle,rgba(147,51,234,.25),rgba(168,85,247,.1))"></div>
          <div class="ph-orb ph-orb3" style="background:radial-gradient(circle,rgba(192,132,252,.2),rgba(168,85,247,.1))"></div>
          <div class="ph-grid"></div>
        </div>
        <div class="page-hero-body">
          <div class="ph-icon" style="background:rgba(168,85,247,.2);border-color:rgba(168,85,247,.3);color:#c084fc"><i class="fas fa-boxes-stacked"></i></div>
          <div class="ph-text">
            <h1 class="ph-title">Inventory</h1>
            <p class="ph-sub">Track the compounds you own - quantities, expiry and suppliers - with low-stock and expiring-soon alerts so you reorder in time.</p>
          </div>
          <div class="ph-stats">
            <div class="ph-stat"><div class="ph-stat-n">${items.length}</div><div class="ph-stat-l">Items</div></div>
            <div class="ph-stat"><div class="ph-stat-n">${totalVials}</div><div class="ph-stat-l">Vials on hand</div></div>
            <div class="ph-stat"><div class="ph-stat-n">${needsAttention.length}</div><div class="ph-stat-l">Need attention</div></div>
          </div>
        </div>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;margin:18px 0 12px">
        <div style="font-size:13px;color:var(--text-secondary)">${totalValue > 0 ? `Estimated value: <strong style="color:var(--text)">$${totalValue.toFixed(2)}</strong>` : 'Keep tabs on your supply.'}</div>
        <button class="cal-action-btn" style="font-size:12px;padding:8px 14px" onclick="openInventoryForm()"><i class="fas fa-plus" style="margin-right:5px"></i>Add item</button>
      </div>

      ${needsAttention.length > 0 ? `
      <div class="inv-alert-banner" style="background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.3);border-radius:12px;padding:12px 14px;margin-bottom:14px;display:flex;align-items:center;gap:10px">
        <i class="fas fa-bell" style="color:#f59e0b"></i>
        <span style="font-size:13px;color:var(--text)">${needsAttention.length} item${needsAttention.length === 1 ? '' : 's'} need attention - low stock, out of stock, or expiring soon.</span>
      </div>` : ''}

      ${items.length > 0 ? `
      <div class="inv-list" style="display:flex;flex-direction:column;gap:10px">
        ${sorted.map(item => {
          const st = invStatus(item);
          const qty = Number(item.quantity) || 0;
          const d = invDaysToExpiry(item);
          const meta = [];
          if (item.vialSize) meta.push(esc(item.vialSize));
          if (item.supplier) meta.push('Supplier: ' + esc(item.supplier));
          if (item.location) meta.push(esc(item.location));
          if (item.expiryDate) meta.push('Expires ' + new Date(item.expiryDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + (d !== null && d >= 0 ? ` (${d}d)` : ''));
          return `
          <div class="inv-card" style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:14px 16px;border-left:4px solid ${st.color}">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
              <div style="min-width:0;flex:1">
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                  <span style="font-weight:700;font-size:15px;color:var(--text)">${esc(item.name)}</span>
                  <span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;color:${st.color};background:${st.color}1a;padding:3px 8px;border-radius:99px"><i class="fas ${st.icon}"></i>${st.label}</span>
                </div>
                ${meta.length ? `<div style="font-size:12px;color:var(--text-muted);margin-top:5px;line-height:1.6">${meta.join(' &nbsp;·&nbsp; ')}</div>` : ''}
                ${item.notes ? `<div style="font-size:12px;color:var(--text-secondary);margin-top:5px;font-style:italic">${esc(item.notes)}</div>` : ''}
              </div>
              <div style="display:flex;gap:6px;flex-shrink:0">
                <button class="inv-icon-btn" title="Edit" onclick="openInventoryForm('${item.id}')" style="background:var(--bg);border:1px solid var(--border);color:var(--text-secondary);width:32px;height:32px;border-radius:8px;cursor:pointer"><i class="fas fa-pen" style="font-size:12px"></i></button>
                <button class="inv-icon-btn" title="Delete" onclick="deleteInventoryItem('${item.id}')" style="background:var(--bg);border:1px solid var(--border);color:#ef4444;width:32px;height:32px;border-radius:8px;cursor:pointer"><i class="fas fa-trash" style="font-size:12px"></i></button>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:10px;margin-top:12px">
              <button class="inv-step-btn" onclick="adjustInventory('${item.id}', -1)" style="width:34px;height:34px;border-radius:9px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:16px;cursor:pointer">−</button>
              <div style="text-align:center;min-width:64px">
                <div style="font-size:22px;font-weight:800;color:var(--text);line-height:1">${qty}</div>
                <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em">${qty === 1 ? 'vial' : 'vials'}</div>
              </div>
              <button class="inv-step-btn" onclick="adjustInventory('${item.id}', 1)" style="width:34px;height:34px;border-radius:9px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:16px;cursor:pointer">+</button>
              ${Number(item.lowStockThreshold) > 0 ? `<span style="font-size:11px;color:var(--text-muted);margin-left:6px">Reorder at ${item.lowStockThreshold}</span>` : ''}
            </div>
          </div>`;
        }).join('')}
      </div>` : `
      <div style="text-align:center;padding:48px 20px;background:var(--surface);border:1px dashed var(--border);border-radius:16px">
        <i class="fas fa-boxes-stacked" style="font-size:36px;color:var(--text-muted);margin-bottom:14px;display:block"></i>
        <div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:6px">No inventory yet</div>
        <p style="font-size:13px;color:var(--text-muted);max-width:360px;margin:0 auto 18px">Add the compounds you have on hand to track quantities, expiry dates and get low-stock alerts.</p>
        <button class="cal-action-btn" style="font-size:13px;padding:9px 18px" onclick="openInventoryForm()"><i class="fas fa-plus" style="margin-right:5px"></i>Add your first item</button>
      </div>`}
    </div>
  `;
}

function openInventoryForm(id) {
  const items = getInventory();
  const item = id ? items.find(i => i.id === id) : null;
  const overlay = document.createElement('div');
  overlay.className = 'cal-modal-overlay';
  overlay.id = 'invOverlay';
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  const pepOptions = peptides.map(p => `<option value="${esc(p.name)}"${item && item.name === p.name ? ' selected' : ''}>${esc(p.name)}</option>`).join('');
  overlay.innerHTML = `
    <div class="cal-modal">
      <div class="cal-modal-header"><h3>${item ? 'Edit item' : 'Add inventory item'}</h3><button class="cal-modal-close" onclick="document.getElementById('invOverlay').remove()"><i class="fas fa-times"></i></button></div>
      <div class="cal-modal-body">
        <div class="cal-form-group"><label>Compound</label>
          <input list="invPepList" id="invName" class="cal-input" placeholder="e.g. BPC-157" value="${item ? esc(item.name) : ''}">
          <datalist id="invPepList">${pepOptions}</datalist>
        </div>
        <div class="cal-form-row">
          <div class="cal-form-group" style="flex:1"><label>Quantity (vials)</label><input type="number" id="invQty" class="cal-input" min="0" step="1" placeholder="2" value="${item ? (item.quantity ?? '') : ''}"></div>
          <div class="cal-form-group" style="flex:1"><label>Vial size</label><input type="text" id="invVialSize" class="cal-input" placeholder="5 mg" value="${item ? esc(item.vialSize || '') : ''}"></div>
        </div>
        <div class="cal-form-row">
          <div class="cal-form-group" style="flex:1"><label>Low-stock alert at</label><input type="number" id="invLow" class="cal-input" min="0" step="1" placeholder="1" value="${item ? (item.lowStockThreshold ?? '') : '1'}"></div>
          <div class="cal-form-group" style="flex:1"><label>Expiry date</label><input type="date" id="invExpiry" class="cal-input" value="${item ? (item.expiryDate || '') : ''}"></div>
        </div>
        <div class="cal-form-row">
          <div class="cal-form-group" style="flex:1"><label>Supplier (optional)</label><input type="text" id="invSupplier" class="cal-input" placeholder="Supplier name" value="${item ? esc(item.supplier || '') : ''}"></div>
          <div class="cal-form-group" style="flex:1"><label>Unit cost ($, optional)</label><input type="number" id="invCost" class="cal-input" min="0" step="any" placeholder="0.00" value="${item ? (item.unitCost ?? '') : ''}"></div>
        </div>
        <div class="cal-form-group"><label>Storage location (optional)</label><input type="text" id="invLocation" class="cal-input" placeholder="e.g. Fridge, drawer 2" value="${item ? esc(item.location || '') : ''}"></div>
        <div class="cal-form-group"><label>Notes (optional)</label><input type="text" id="invNotes" class="cal-input" placeholder="Batch #, lot, etc." value="${item ? esc(item.notes || '') : ''}"></div>
      </div>
      <div class="cal-modal-footer">
        <button class="cal-btn-cancel" onclick="document.getElementById('invOverlay').remove()">Cancel</button>
        <button class="cal-btn-save" onclick="saveInventoryForm('${item ? item.id : ''}')"><i class="fas fa-check" style="margin-right:5px"></i>${item ? 'Save changes' : 'Add item'}</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('open'));
}

function saveInventoryForm(id) {
  const name = (document.getElementById('invName').value || '').trim();
  if (!name) { alert('Please enter a compound name.'); return; }
  const qtyRaw = document.getElementById('invQty').value;
  const lowRaw = document.getElementById('invLow').value;
  const costRaw = document.getElementById('invCost').value;
  const record = {
    name,
    quantity: qtyRaw === '' ? 0 : Math.max(0, parseInt(qtyRaw, 10) || 0),
    vialSize: (document.getElementById('invVialSize').value || '').trim(),
    lowStockThreshold: lowRaw === '' ? 0 : Math.max(0, parseInt(lowRaw, 10) || 0),
    expiryDate: document.getElementById('invExpiry').value || '',
    supplier: (document.getElementById('invSupplier').value || '').trim(),
    unitCost: costRaw === '' ? 0 : Math.max(0, parseFloat(costRaw) || 0),
    location: (document.getElementById('invLocation').value || '').trim(),
    notes: (document.getElementById('invNotes').value || '').trim(),
  };
  const items = getInventory();
  if (id) {
    const idx = items.findIndex(i => i.id === id);
    if (idx !== -1) items[idx] = { ...items[idx], ...record };
  } else {
    record.id = 'inv_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    record.createdAt = new Date().toISOString();
    items.push(record);
  }
  saveInventory(items);
  document.getElementById('invOverlay')?.remove();
  navigate('inventory');
}

function adjustInventory(id, delta) {
  const items = getInventory();
  const idx = items.findIndex(i => i.id === id);
  if (idx === -1) return;
  items[idx].quantity = Math.max(0, (Number(items[idx].quantity) || 0) + delta);
  saveInventory(items);
  navigate('inventory');
}

function deleteInventoryItem(id) {
  if (!confirm('Remove this item from your inventory?')) return;
  const items = getInventory().filter(i => i.id !== id);
  saveInventory(items);
  navigate('inventory');
}

window.renderInventory = renderInventory;
window.openInventoryForm = openInventoryForm;
window.saveInventoryForm = saveInventoryForm;
window.adjustInventory = adjustInventory;
window.deleteInventoryItem = deleteInventoryItem;

// ============================================================
// FEATURE 17: BLOOD WORK TRACKER
// ============================================================
const BLOODWORK_KEY = 'peptideai_bloodwork';
const BLOOD_MARKERS = [
  { id: 'igf1', name: 'IGF-1', unit: 'ng/mL', range: '101-310', category: 'Hormones' },
  { id: 'gh', name: 'Growth Hormone', unit: 'ng/mL', range: '0.4-10', category: 'Hormones' },
  { id: 'glucose', name: 'Fasting Glucose', unit: 'mg/dL', range: '70-99', category: 'Metabolic' },
  { id: 'a1c', name: 'HbA1c', unit: '%', range: '4.0-5.6', category: 'Metabolic' },
  { id: 'insulin', name: 'Fasting Insulin', unit: 'uIU/mL', range: '2.6-24.9', category: 'Metabolic' },
  { id: 'totalT', name: 'Total Testosterone', unit: 'ng/dL', range: '264-916', category: 'Hormones' },
  { id: 'freeT', name: 'Free Testosterone', unit: 'pg/mL', range: '8.7-25.1', category: 'Hormones' },
  { id: 'estradiol', name: 'Estradiol (E2)', unit: 'pg/mL', range: '7.6-42.6', category: 'Hormones' },
  { id: 'tsh', name: 'TSH', unit: 'mIU/L', range: '0.27-4.2', category: 'Thyroid' },
  { id: 'freeT4', name: 'Free T4', unit: 'ng/dL', range: '0.93-1.7', category: 'Thyroid' },
  { id: 'freeT3', name: 'Free T3', unit: 'pg/mL', range: '2.0-4.4', category: 'Thyroid' },
  { id: 'alt', name: 'ALT', unit: 'U/L', range: '7-56', category: 'Liver' },
  { id: 'ast', name: 'AST', unit: 'U/L', range: '10-40', category: 'Liver' },
  { id: 'creatinine', name: 'Creatinine', unit: 'mg/dL', range: '0.74-1.35', category: 'Kidney' },
  { id: 'bun', name: 'BUN', unit: 'mg/dL', range: '6-20', category: 'Kidney' },
  { id: 'egfr', name: 'eGFR', unit: 'mL/min', range: '>60', category: 'Kidney' },
  { id: 'ldl', name: 'LDL Cholesterol', unit: 'mg/dL', range: '<100', category: 'Lipids' },
  { id: 'hdl', name: 'HDL Cholesterol', unit: 'mg/dL', range: '>40', category: 'Lipids' },
  { id: 'triglycerides', name: 'Triglycerides', unit: 'mg/dL', range: '<150', category: 'Lipids' },
  { id: 'totalChol', name: 'Total Cholesterol', unit: 'mg/dL', range: '<200', category: 'Lipids' },
  { id: 'crp', name: 'CRP (hs)', unit: 'mg/L', range: '<1.0', category: 'Inflammation' },
  { id: 'wbc', name: 'WBC', unit: 'K/uL', range: '3.4-10.8', category: 'Blood Count' },
  { id: 'rbc', name: 'RBC', unit: 'M/uL', range: '4.14-5.80', category: 'Blood Count' },
  { id: 'hemoglobin', name: 'Hemoglobin', unit: 'g/dL', range: '12.6-17.7', category: 'Blood Count' },
  { id: 'hematocrit', name: 'Hematocrit', unit: '%', range: '37.5-51.0', category: 'Blood Count' },
];

function getBloodwork() { try { return JSON.parse(localStorage.getItem(BLOODWORK_KEY) || '[]'); } catch { return []; } }
function saveBloodwork(b) { localStorage.setItem(BLOODWORK_KEY, JSON.stringify(b)); }

function renderBloodwork(el) {
  const _bwSaveBanner = !currentUser ? renderSaveBanner('Blood Work Tracker', '#3b82f6') : '';
  const bw = getBloodwork();
  const selectedMarker = window._bwMarker || 'igf1';
  const markerData = bw.map(entry => ({ date: entry.date, value: entry.values[selectedMarker] })).filter(d => d.value != null).sort((a, b) => a.date.localeCompare(b.date));
  const markerInfo = BLOOD_MARKERS.find(m => m.id === selectedMarker);

  el.innerHTML = `
    <div class="bw-view">
      <!-- PAGE HERO -->
      <div class="page-hero page-hero-blue" style="margin-bottom:20px">
        <div class="page-hero-bg">
          <div class="ph-orb ph-orb1" style="background:radial-gradient(circle,rgba(59,130,246,.35),rgba(37,99,235,.1))"></div>
          <div class="ph-orb ph-orb2" style="background:radial-gradient(circle,rgba(37,99,235,.25),rgba(96,165,250,.1))"></div>
          <div class="ph-orb ph-orb3" style="background:radial-gradient(circle,rgba(96,165,250,.2),rgba(59,130,246,.1))"></div>
          <div class="ph-grid"></div>
        </div>
        <div class="page-hero-body">
          <div class="ph-icon" style="background:rgba(59,130,246,.2);border-color:rgba(59,130,246,.3);color:#60a5fa"><i class="fas fa-droplet"></i></div>
          <div class="ph-text">
            <h1 class="ph-title">Blood Work Tracker</h1>
            <p class="ph-sub">Log lab results, visualize biomarker trends, and see how peptides affect your health markers.</p>
          </div>
          <div class="ph-actions">
            <button class="ph-action-btn" onclick="openBloodworkForm()"><i class="fas fa-plus"></i> Add Results</button>
          </div>
        </div>
      </div>

      ${_bwSaveBanner}

      <!-- Chart Section -->
      <div class="bw-chart-card">
        <div class="bw-chart-header">
          <select class="cal-input" style="width:auto;min-width:180px" onchange="window._bwMarker=this.value;navigate('bloodwork')">
            ${Object.entries(BLOOD_MARKERS.reduce((acc, m) => { (acc[m.category] = acc[m.category] || []).push(m); return acc; }, {})).map(([cat, markers]) =>
              `<optgroup label="${cat}">${markers.map(m => `<option value="${m.id}" ${m.id === selectedMarker ? 'selected' : ''}>${m.name} (${m.unit})</option>`).join('')}</optgroup>`
            ).join('')}
          </select>
          <span class="bw-range">Reference: ${markerInfo?.range || ''} ${markerInfo?.unit || ''}</span>
        </div>
        ${markerData.length >= 2 ? buildBloodworkChart(markerData, markerInfo) : `<p style="text-align:center;font-size:12px;color:var(--text-muted);padding:30px">Need at least 2 data points. Add blood work entries to see trends.</p>`}
      </div>

      <!-- History -->
      <div class="tracker-section">
        <div class="tracker-section-title"><i class="fas fa-history"></i> Lab History (${bw.length} entries)</div>
        ${bw.length > 0 ? bw.map((entry, i) => {
          const d = new Date(entry.date + 'T00:00:00');
          const filledCount = Object.values(entry.values).filter(v => v != null && v !== '').length;
          return `<div class="bw-entry-card" onclick="openBloodworkForm('${entry.date}')">
            <div class="bw-entry-date">${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
            <div class="bw-entry-count">${filledCount} markers</div>
            ${entry.notes ? `<div class="bw-entry-notes">${esc(entry.notes)}</div>` : ''}
            <button class="cal-reg-del" onclick="event.stopPropagation();deleteBloodwork(${i})"><i class="fas fa-times"></i></button>
          </div>`;
        }).join('') : `<div class="cal-empty-state" style="padding:30px"><i class="fas fa-droplet"></i><p class="cal-empty-title">No blood work logged</p><p class="cal-empty-text">Add your lab results to track biomarkers over time.</p></div>`}
      </div>
    </div>
  `;
}

function buildBloodworkChart(data, markerInfo) {
  const w = 500, h = 120, pad = 35;
  const vals = data.map(d => parseFloat(d.value));
  const min = Math.min(...vals) * 0.85;
  const max = Math.max(...vals) * 1.15;
  const range = max - min || 1;
  const stepX = (w - pad * 2) / Math.max(data.length - 1, 1);
  const points = data.map((d, i) => [pad + i * stepX, h - pad - ((parseFloat(d.value) - min) / range) * (h - pad * 2)]);
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ');

  return `<svg viewBox="0 0 ${w} ${h}" class="bw-chart-svg">
    <path d="${line}" fill="none" stroke="#3b82f6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    ${points.map((p, i) => `<g>
      <circle cx="${p[0]}" cy="${p[1]}" r="4" fill="#3b82f6" stroke="var(--surface)" stroke-width="2"/>
      <text x="${p[0]}" y="${p[1] - 8}" text-anchor="middle" font-size="9" fill="var(--text-secondary)" font-weight="600">${vals[i]}</text>
      <text x="${p[0]}" y="${h - 5}" text-anchor="middle" font-size="8" fill="var(--text-muted)">${data[i].date.slice(5)}</text>
    </g>`).join('')}
  </svg>`;
}

function openBloodworkForm(editDate) {
  const bw = getBloodwork();
  const existing = editDate ? bw.find(e => e.date === editDate) : null;
  const cats = BLOOD_MARKERS.reduce((acc, m) => { (acc[m.category] = acc[m.category] || []).push(m); return acc; }, {});

  const overlay = document.createElement('div');
  overlay.className = 'cal-modal-overlay';
  overlay.id = 'bwOverlay';
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  overlay.innerHTML = `
    <div class="cal-modal" style="max-width:640px">
      <div class="cal-modal-header"><h3>${existing ? 'Edit' : 'Add'} Blood Work</h3><button class="cal-modal-close" onclick="document.getElementById('bwOverlay').remove()"><i class="fas fa-times"></i></button></div>
      <div class="cal-modal-body" style="max-height:60vh;overflow-y:auto">
        <div class="cal-form-group"><label>Lab Date</label><input type="date" id="bwDate" class="cal-input" value="${editDate || new Date().toISOString().split('T')[0]}" ${editDate ? 'disabled' : ''}></div>
        ${Object.entries(cats).map(([cat, markers]) => `
          <div class="bw-cat-group">
            <div class="bw-cat-label">${cat}</div>
            <div class="bw-marker-grid">
              ${markers.map(m => `
                <div class="bw-marker-input">
                  <label>${m.name} <span class="bw-unit">(${m.unit})</span></label>
                  <input type="number" step="any" class="cal-input" id="bw_${m.id}" placeholder="${m.range}" value="${existing?.values?.[m.id] ?? ''}">
                </div>
              `).join('')}
            </div>
          </div>
        `).join('')}
        <div class="cal-form-group"><label>Notes</label><textarea id="bwNotes" class="cal-input" rows="2" placeholder="e.g., Fasted 12h, drawn at 8am...">${existing?.notes || ''}</textarea></div>
      </div>
      <div class="cal-modal-footer">
        <button class="cal-btn-cancel" onclick="document.getElementById('bwOverlay').remove()">Cancel</button>
        <button class="cal-btn-save" onclick="saveBloodworkForm('${editDate || ''}')"><i class="fas fa-check" style="margin-right:5px"></i>Save</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('open'));
}

function saveBloodworkForm(editDate) {
  const date = editDate || document.getElementById('bwDate').value;
  if (!date) { alert('Please select a date.'); return; }
  const values = {};
  BLOOD_MARKERS.forEach(m => {
    const val = document.getElementById('bw_' + m.id)?.value;
    if (val !== '' && val != null) values[m.id] = parseFloat(val);
  });
  const notes = document.getElementById('bwNotes')?.value.trim() || '';
  let bw = getBloodwork().filter(e => e.date !== date);
  bw.push({ date, values, notes });
  bw.sort((a, b) => b.date.localeCompare(a.date));
  saveBloodwork(bw);
  document.getElementById('bwOverlay')?.remove();
  navigate('bloodwork');
}

function deleteBloodwork(i) {
  if (confirm('Delete this blood work entry?')) {
    const bw = getBloodwork();
    bw.splice(i, 1);
    saveBloodwork(bw);
    navigate('bloodwork');
  }
}

// ============================================================
// FEATURE 19: DRUG INTERACTION CHECKER
// ============================================================
const DRUG_INTERACTIONS = {
  'Metformin': { interactsWith: ['Semaglutide','Tirzepatide','Retatrutide','Liraglutide','IGF-1 LR3','MK-677','Berberine'], severity: 'moderate', note: 'GLP-1 agonists + metformin may increase hypoglycemia risk and GI side effects. MK-677 raises blood glucose counteracting metformin. IGF-1 LR3 can cause hypoglycemia. Monitor blood glucose closely. Often used together clinically but requires dose adjustment.' },
  'Insulin': { interactsWith: ['Semaglutide','Tirzepatide','IGF-1 LR3','MK-677','CJC-1295','Ipamorelin','AOD-9604','MOTS-c'], severity: 'high', note: 'Combining insulin with GLP-1 agonists or GH peptides significantly increases hypoglycemia risk. IGF-1 LR3 has direct insulin-like activity. GH peptides raise blood glucose. MK-677 causes insulin resistance. Requires careful monitoring and likely dose reduction.' },
  'Testosterone (TRT)': { interactsWith: ['HCG','Enclomiphene','Gonadorelin','CJC-1295','Ipamorelin','MK-677','Clomiphene Citrate','Oxandrolone','Kisspeptin-10','Anastrozole','DHEA','Follistatin 344','LGD-4033'], severity: 'low', note: 'Often stacked in clinical settings. HCG/Gonadorelin maintain fertility on TRT. GH peptides complement TRT for body composition. Anastrozole controls estradiol. Do NOT combine TRT with SERMs (enclomiphene/clomiphene) or kisspeptin - choose one approach. Monitor hematocrit and estradiol.' },
  'Thyroid Medication (Levothyroxine)': { interactsWith: ['Semaglutide','Tirzepatide','Colostrum','Activated Charcoal','EDTA Chelation','NAC','Calcium'], severity: 'moderate', note: 'GLP-1 agonists slow gastric emptying affecting absorption. Charcoal/EDTA/Colostrum can bind levothyroxine. NAC chelates minerals. ALWAYS take thyroid medication alone, 60 minutes before anything else on empty stomach.' },
  'Blood Thinners (Warfarin/Heparin)': { interactsWith: ['BPC-157','TB-500','Thymosin Beta-4','Nattokinase','Serrapeptase','Omega-3 (EPA/DHA)','Pentosan','Vitamin E'], severity: 'high', note: 'Healing peptides promote angiogenesis. Nattokinase and serrapeptase have direct fibrinolytic activity. Omega-3 reduces platelet aggregation. Pentosan has heparin-like properties. Combining any of these with warfarin/heparin dramatically increases bleeding risk. Monitor INR closely.' },
  'SSRIs (Antidepressants)': { interactsWith: ['PT-141','Selank','DSIP','Oxytocin','5-HTP','St. Johns Wort','Semax'], severity: 'moderate', note: 'PT-141 works via melanocortin receptors - generally safe with SSRIs. Selank has GABAergic anxiolysis that may complement SSRIs. Semax boosts BDNF which may enhance SSRI effects. DSIP may improve sleep quality. Never combine SSRIs with 5-HTP (serotonin syndrome risk).' },
  'Blood Pressure Medication (ACE inhibitors/ARBs)': { interactsWith: ['PT-141','Melanotan II','Semaglutide','Tirzepatide','Minoxidil','Tadalafil','Nattokinase'], severity: 'moderate', note: 'PT-141 and MT-II can transiently alter blood pressure. GLP-1 agonists lower BP. Oral minoxidil is a vasodilator that further lowers BP. Tadalafil causes vasodilation. Nattokinase has mild antihypertensive effects. Monitor BP regularly - additive hypotension possible.' },
  'Immunosuppressants (Cyclosporine/Tacrolimus)': { interactsWith: ['Thymosin Alpha-1','LL-37','Thymulin','Defensin HBD-2','Colostrum','Lactoferrin','Low-Dose Naltrexone (LDN)'], severity: 'high', note: 'Immune-boosting peptides, colostrum IgG, and LDN\'s immune upregulation may counteract immunosuppressive therapy. CONTRAINDICATED in transplant recipients. Consult your transplant team / immunologist before using any immune-modulating compound.' },
  'Diabetes Medications (Sulfonylureas)': { interactsWith: ['Semaglutide','Tirzepatide','Retatrutide','Liraglutide','MK-677','IGF-1 LR3','Tesofensine'], severity: 'high', note: 'Sulfonylureas + GLP-1 agonists significantly increase hypoglycemia risk. MK-677 causes insulin resistance (antagonistic). IGF-1 LR3 has insulin-like effects. Tesofensine suppresses appetite intensely. Requires physician supervision and likely dose reduction of sulfonylurea.' },
  'Statins (Atorvastatin/Rosuvastatin)': { interactsWith: ['Semaglutide','Tirzepatide','Bergamot Extract','CoQ10','Omega-3 (EPA/DHA)','Rapamycin','Red Yeast Rice'], severity: 'low', note: 'Generally safe combinations. GLP-1 agonists improve lipid profiles. Bergamot has additive cholesterol-lowering (same pathway). CoQ10 offsets statin-induced depletion (recommended). Omega-3 complements statins for triglycerides. Rapamycin can worsen lipid profiles - monitor.' },
  'NSAIDs (Ibuprofen/Naproxen)': { interactsWith: ['BPC-157','Semaglutide','Nattokinase','Omega-3 (EPA/DHA)','Pentosan','Diclofenac Topical'], severity: 'low', note: 'BPC-157 may actually protect against NSAID-induced gastric damage. Semaglutide slows gastric emptying - take NSAIDs with food. Nattokinase + NSAIDs = slightly increased bleeding. Topical diclofenac + oral NSAIDs = increased total NSAID load. Generally manageable combinations.' },
  'Benzodiazepines (Xanax/Valium)': { interactsWith: ['DSIP','Selank','Oxytocin','Progesterone','GABA','Phenibut','GHB'], severity: 'high', note: 'DSIP enhances delta sleep. Selank and oral progesterone both have GABAergic activity. Combining multiple GABA-active compounds with benzodiazepines risks excessive sedation, respiratory depression, and CNS depression. Use extreme caution.' },
  'Finasteride/Dutasteride (5AR Inhibitors)': { interactsWith: ['Testosterone (TRT)','DHEA','Progesterone','Oxandrolone','Minoxidil','RU-58841','GHK-Cu Topical'], severity: 'low', note: 'Combining 5AR inhibitors with TRT/androgens is common in hair loss protocols. Progesterone naturally inhibits 5AR (additive). Minoxidil, RU-58841, and GHK-Cu work via different mechanisms and are synergistic. Monitor DHT and hormone levels.' },
  'Oral Contraceptives (Birth Control)': { interactsWith: ['Semaglutide','Tirzepatide','Letrozole','Anastrozole','Clomiphene Citrate','Progesterone','DHEA'], severity: 'high', note: 'GLP-1 agonists may reduce oral contraceptive absorption via delayed gastric emptying - use backup method. Aromatase inhibitors (letrozole/anastrozole) and SERMs directly counteract birth control. Exogenous progesterone alters the hormonal balance. DO NOT combine AIs/SERMs with BC.' },
  'Aromatase Inhibitors (Letrozole/Anastrozole)': { interactsWith: ['Testosterone (TRT)','HCG','DHEA','Clomiphene Citrate','Enclomiphene','Oxandrolone','Progesterone'], severity: 'low', note: 'Very commonly combined in TRT protocols. AIs control estradiol from aromatization of testosterone and HCG. DHEA can aromatize and may need AI coverage. Do not over-suppress estradiol (<15 pg/mL) - this causes joint pain, low libido, and bone loss.' },
  'Rapamycin (Sirolimus)': { interactsWith: ['CJC-1295','Ipamorelin','MK-677','IGF-1 LR3','Follistatin 344','Epithalon','NAD+'], severity: 'moderate', note: 'Rapamycin inhibits mTOR - directly antagonized by GH peptides and IGF-1 which activate mTOR. This creates a pharmacological conflict. Some biohackers pulse rapamycin (weekly) and use GH peptides on off-days. The longevity benefit of rapamycin may be reduced if mTOR is constantly reactivated.' },
  'Methotrexate': { interactsWith: ['Thymosin Alpha-1','LL-37','Follistatin 344','NAC','Low-Dose Naltrexone (LDN)','BPC-157'], severity: 'high', note: 'Methotrexate is an immunosuppressant - immune peptides may counteract its effects. NAC can affect methotrexate clearance. LDN upregulates immune function. BPC-157 may alter drug metabolism. Always consult your rheumatologist/oncologist.' },
  'Caffeine / Stimulants': { interactsWith: ['Tesofensine','Semax','MOTS-c','Selank','Ipamorelin'], severity: 'low', note: 'Tesofensine has stimulant properties - combining with high caffeine may increase heart rate, anxiety, and insomnia. Semax is mildly stimulating. Generally safe at moderate caffeine doses (<300mg). Take ipamorelin away from caffeine (may blunt GH release).' },
  'GLP-1 Agonists (Semaglutide/Tirzepatide)': { interactsWith: ['Metformin','Insulin','Oral Contraceptives','Levothyroxine','MK-677','BPC-157','5-Amino-1MQ'], severity: 'moderate', note: 'GLP-1 agonists slow gastric emptying affecting absorption of oral medications. Take oral meds 1h before injection day. MK-677 increases appetite (antagonistic to GLP-1 suppression). BPC-157 may help with GLP-1 induced nausea. 5-Amino-1MQ is synergistic for weight loss.' },
  'Prednisone / Corticosteroids': { interactsWith: ['BPC-157','TB-500','Thymosin Alpha-1','CJC-1295','Ipamorelin','DHEA','Testosterone (TRT)'], severity: 'moderate', note: 'Corticosteroids suppress healing - healing peptides (BPC-157, TB-500) may be partially antagonized. Steroids suppress the HPA axis and GH release (antagonizes GH peptides). Long-term prednisone depletes DHEA and testosterone. Often used in sequence rather than simultaneously.' },
  'Alcohol (Chronic/Heavy Use)': { interactsWith: ['NAC','Glutathione (IV/IM)','BPC-157','Semaglutide','Rapamycin','Metformin','Oxandrolone'], severity: 'moderate', note: 'NAC and glutathione help with alcohol-induced liver oxidative stress (beneficial). BPC-157 may protect gastric mucosa from alcohol damage. Semaglutide may reduce alcohol cravings (emerging data). Alcohol + rapamycin/metformin/oxandrolone increases hepatotoxicity risk. Limit alcohol on these compounds.' },
  'Opioids (Chronic Pain)': { interactsWith: ['Low-Dose Naltrexone (LDN)','DSIP','Selank','PEA','BPC-157','PT-141'], severity: 'high', note: 'LDN is an opioid receptor antagonist - ABSOLUTELY CONTRAINDICATED with opioid medications (precipitates acute withdrawal). Wait 7-10 days after last opioid before starting LDN. PEA and BPC-157 may help reduce opioid requirements over time. DSIP may help with opioid-disrupted sleep.' },
  'Anticoagulants (DOACs - Eliquis/Xarelto)': { interactsWith: ['Nattokinase','Serrapeptase','Omega-3 (EPA/DHA)','Pentosan','TB-500','BPC-157','Vitamin E'], severity: 'high', note: 'DOACs + fibrinolytic enzymes (nattokinase/serrapeptase) = extremely high bleeding risk. Omega-3 further reduces platelet aggregation. Pentosan has anticoagulant properties. Do NOT combine nattokinase with any prescription anticoagulant without physician guidance.' },
  'Lithium': { interactsWith: ['Semaglutide','Tirzepatide','NSAIDs','NAC','EDTA Chelation','Thyroid Support (T3)'], severity: 'high', note: 'GLP-1 agonists cause dehydration/nausea that concentrates lithium (toxicity risk). NSAIDs reduce renal lithium clearance. EDTA may chelate lithium. T3 is often used with lithium for thyroid but requires careful monitoring. Maintain hydration; monitor lithium levels frequently.' },
  'Gabapentin / Pregabalin': { interactsWith: ['DSIP','Selank','Progesterone','PEA','Phenibut'], severity: 'moderate', note: 'Gabapentinoids + GABAergic compounds (progesterone, selank) may cause additive sedation and dizziness. PEA is generally safe to combine (different mechanism). DSIP may cause excessive drowsiness. Monitor for CNS depression and fall risk.' },
  'Accutane (Isotretinoin)': { interactsWith: ['Oxandrolone','Testosterone (TRT)','Vitamin A','GHK-Cu','Collagen Peptides','NAC'], severity: 'moderate', note: 'Accutane + oral anabolics significantly increases liver stress (monitor LFTs). Do NOT supplement vitamin A (accutane IS vitamin A). GHK-Cu topical for skin healing during accutane is generally fine. NAC provides liver support (beneficial). Collagen peptides are safe.' },
  'Thyroid Medication (T3/Liothyronine)': { interactsWith: ['Semaglutide','Tirzepatide','Testosterone (TRT)','MK-677','CJC-1295','Caffeine'], severity: 'low', note: 'T3 + GLP-1 agonists: take T3 on empty stomach 60min before. GH peptides complement T3 by improving body composition. TRT may increase thyroid hormone clearance (minor). Caffeine does not significantly affect T3. Generally compatible combinations in biohacking protocols.' },
  'HCG (Human Chorionic Gonadotropin)': { interactsWith: ['Testosterone (TRT)','Enclomiphene','Gonadorelin','Clomiphene Citrate','Anastrozole','Kisspeptin-10','Letrozole'], severity: 'low', note: 'HCG is standard TRT adjunct for fertility/testicular preservation. Often combined with AI (anastrozole/letrozole) to control HCG-induced estradiol. Gonadorelin can supplement or replace HCG. Do not combine HCG with SERMs if also on TRT (redundant/conflicting). Monitor estradiol.' },
  'Antifungals (Fluconazole/Itraconazole)': { interactsWith: ['Rapamycin','Oxandrolone','Testosterone (TRT)','Progesterone','Statins'], severity: 'high', note: 'Azole antifungals potently inhibit CYP3A4. Rapamycin levels can increase 5-10x (toxic). Oxandrolone hepatotoxicity increases. Testosterone clearance is reduced. Progesterone levels rise. If on rapamycin, HOLD dose during antifungal courses and resume after washout.' },
};

function renderInteractions(el) {
  const selectedDrugs = window._ixDrugs || [];
  const selectedPeptides = window._ixPeptides || [];
  const results = checkInteractions(selectedDrugs, selectedPeptides);
  const totalSelected = selectedDrugs.length + selectedPeptides.length;
  const highCount = results.filter(r => r.severity === 'high').length;
  const modCount  = results.filter(r => r.severity === 'moderate').length;
  const lowCount  = results.filter(r => r.severity === 'low').length;

  const drugKeys = Object.keys(DRUG_INTERACTIONS);

  // Build selected summary chips
  const selChips = [
    ...selectedDrugs.map(d => `<span class="ix-chip ix-chip-drug"><i class="fas fa-pills"></i>${esc(d)}<button onclick="toggleIxDrug('${d.replace(/'/g,"\\'")}')"><i class="fas fa-times"></i></button></span>`),
    ...selectedPeptides.map(p => `<span class="ix-chip ix-chip-pep"><i class="fas fa-syringe"></i>${esc(p)}<button onclick="toggleIxPeptide('${p.replace(/'/g,"\\'")}')"><i class="fas fa-times"></i></button></span>`)
  ].join('');

  el.innerHTML = `
  <div class="ix-page">

    <!-- HERO -->
    <div class="ix-hero rsd-card">
      <div class="ix-hero-body">
        <div class="ix-hero-icon"><i class="fas fa-shield-halved"></i></div>
        <div class="ix-hero-text">
          <h1 class="ix-hero-title">Interaction Checker</h1>
          <p class="ix-hero-sub">Select your medications and research compounds to instantly check for known interactions and safety considerations.</p>
        </div>
        <div class="ix-hero-stats">
          <div class="ix-hstat"><div class="ix-hstat-n">${drugKeys.length}</div><div class="ix-hstat-l">Medications</div></div>
          <div class="ix-hstat"><div class="ix-hstat-n">${peptides.length}</div><div class="ix-hstat-l">Compounds</div></div>
          <div class="ix-hstat"><div class="ix-hstat-n">${Object.values(DRUG_INTERACTIONS).reduce((a,v)=>a+v.interactsWith.length,0)}</div><div class="ix-hstat-l">Known Pairs</div></div>
        </div>
      </div>
    </div>

    <!-- SELECTED SUMMARY BAR -->
    <div class="ix-summary-bar ${totalSelected === 0 ? 'ix-summary-empty' : ''}">
      ${totalSelected === 0
        ? `<span class="ix-summary-hint"><i class="fas fa-hand-pointer"></i> Select medications and research compounds below to check interactions</span>`
        : `<div class="ix-chips-wrap">${selChips}</div>
           <button class="ix-clear-btn" onclick="window._ixDrugs=[];window._ixPeptides=[];navigate('interactions')"><i class="fas fa-rotate-left"></i> Clear all</button>`
      }
    </div>

    <!-- RESULTS BANNER (shown when selections made) -->
    ${totalSelected > 0 ? `
    <div class="ix-results-banner ${results.length === 0 ? 'ix-banner-safe' : highCount > 0 ? 'ix-banner-danger' : 'ix-banner-warn'}">
      ${results.length === 0
        ? `<i class="fas fa-circle-check ix-banner-icon"></i>
           <div><strong>No known interactions found</strong><br><span>Your current combination appears safe based on available data.</span></div>`
        : `<i class="fas fa-triangle-exclamation ix-banner-icon"></i>
           <div><strong>${results.length} interaction${results.length!==1?'s':''} found</strong>
           ${highCount ? `&nbsp;·&nbsp;<span class="ix-cnt ix-cnt-high">${highCount} High</span>` : ''}
           ${modCount  ? `&nbsp;·&nbsp;<span class="ix-cnt ix-cnt-mod">${modCount} Moderate</span>` : ''}
           ${lowCount  ? `&nbsp;·&nbsp;<span class="ix-cnt ix-cnt-low">${lowCount} Low</span>` : ''}
           <br><span>Review the details below. Always consult your physician.</span></div>`
      }
    </div>` : ''}

    <!-- TWO COLUMN SELECTOR PANEL -->
    <div class="ix-panels">

      <!-- LEFT: MEDICATIONS -->
      <div class="ix-panel rsd-card">
        <div class="ix-panel-header">
          <div class="ix-panel-icon ix-panel-icon-drug"><i class="fas fa-pills"></i></div>
          <div>
            <div class="ix-panel-title">Medications</div>
            <div class="ix-panel-sub">${selectedDrugs.length > 0 ? `${selectedDrugs.length} selected` : 'None selected'}</div>
          </div>
        </div>
        <div class="ix-search-wrap">
          <i class="fas fa-search"></i>
          <input class="ix-search" id="ixDrugSearch" placeholder="Search medications…" oninput="ixFilterDrugs()" autocomplete="off">
        </div>
        <div class="ix-list" id="ixDrugList">
          ${drugKeys.map(drug => {
            const active = selectedDrugs.includes(drug);
            const interactCount = (DRUG_INTERACTIONS[drug]?.interactsWith || []).filter(p => selectedPeptides.includes(p)).length;
            return `<button type="button" class="ix-item ${active ? 'ix-item-active' : ''} ${interactCount > 0 ? 'ix-item-flagged' : ''}"
              onclick="toggleIxDrug('${drug.replace(/'/g,"\\'")}')">
              <span class="ix-item-check"><i class="fas ${active ? 'fa-square-check' : 'fa-square'}"></i></span>
              <span class="ix-item-name">${esc(drug)}</span>
              ${interactCount > 0 ? `<span class="ix-item-warn"><i class="fas fa-triangle-exclamation"></i>${interactCount}</span>` : ''}
              ${active ? '<span class="ix-item-active-dot"></span>' : ''}
            </button>`;
          }).join('')}
        </div>
      </div>

      <!-- RIGHT: RESEARCH COMPOUNDS -->
      <div class="ix-panel rsd-card">
        <div class="ix-panel-header">
          <div class="ix-panel-icon ix-panel-icon-pep"><i class="fas fa-syringe"></i></div>
          <div>
            <div class="ix-panel-title">Research Compounds</div>
            <div class="ix-panel-sub">${selectedPeptides.length > 0 ? `${selectedPeptides.length} selected` : 'None selected'}</div>
          </div>
        </div>
        <div class="ix-search-wrap">
          <i class="fas fa-search"></i>
          <input class="ix-search" id="ixPepSearch" placeholder="Search research compounds…" oninput="ixFilterPeptides()" autocomplete="off">
        </div>
        <div class="ix-list" id="ixPepList">
          ${peptides.map(p => {
            const active = selectedPeptides.includes(p.name);
            const hasFlag = selectedDrugs.some(d => DRUG_INTERACTIONS[d]?.interactsWith.includes(p.name));
            return `<button type="button" class="ix-item ${active ? 'ix-item-active' : ''} ${hasFlag ? 'ix-item-flagged' : ''}"
              onclick="toggleIxPeptide('${p.name.replace(/'/g,"\\'")}')">
              <span class="ix-item-check"><i class="fas ${active ? 'fa-square-check' : 'fa-square'}"></i></span>
              <span class="ix-item-name">${esc(p.name)}</span>
              <span class="ix-item-cat" style="color:${p.categoryColor}">${esc(p.category)}</span>
              ${hasFlag ? `<span class="ix-item-warn"><i class="fas fa-triangle-exclamation"></i></span>` : ''}
            </button>`;
          }).join('')}
        </div>
      </div>
    </div>

    <!-- DETAILED RESULTS -->
    ${results.length > 0 ? `
    <div class="ix-detail-results">
      <div class="ix-detail-title"><i class="fas fa-list-check"></i> Interaction Details</div>
      ${results.map(r => `
        <div class="ix-card ix-card-${r.severity}">
          <div class="ix-card-top">
            <span class="ix-badge ix-badge-${r.severity}">
              <i class="fas ${r.severity==='high' ? 'fa-circle-exclamation' : r.severity==='moderate' ? 'fa-triangle-exclamation' : 'fa-circle-info'}"></i>
              ${r.severity === 'high' ? 'High Risk' : r.severity === 'moderate' ? 'Moderate' : 'Low Risk'}
            </span>
            <div class="ix-card-pair">
              <span class="ix-pair-drug"><i class="fas fa-pills"></i>${esc(r.drug)}</span>
              <span class="ix-pair-arrow"><i class="fas fa-arrows-left-right"></i></span>
              <span class="ix-pair-pep"><i class="fas fa-syringe"></i>${esc(r.peptide)}</span>
            </div>
          </div>
          <p class="ix-card-note">${esc(r.note)}</p>
          <div class="ix-card-action">
            <i class="fas fa-user-doctor"></i> Discuss with your prescribing physician before combining.
          </div>
        </div>
      `).join('')}
    </div>` : ''}

    <!-- DISCLAIMER -->
    <div class="ix-disclaimer">
      <i class="fas fa-triangle-exclamation"></i>
      <div><strong>Educational purposes only - NOT medical advice.</strong> This tool does not replace professional medical consultation. Always inform your physician about all medications and supplements you are taking.</div>
    </div>

  </div>
  `;

  // Restore search state
  if (window._ixDrugSearch) { const el = document.getElementById('ixDrugSearch'); if(el){el.value=window._ixDrugSearch; ixFilterDrugs();} }
  if (window._ixPepSearch)  { const el = document.getElementById('ixPepSearch');  if(el){el.value=window._ixPepSearch;  ixFilterPeptides();} }
}

function ixFilterDrugs() {
  const q = (document.getElementById('ixDrugSearch')?.value || '').toLowerCase();
  window._ixDrugSearch = q;
  document.querySelectorAll('#ixDrugList .ix-item').forEach(btn => {
    const name = btn.querySelector('.ix-item-name')?.textContent?.toLowerCase() || '';
    btn.style.display = name.includes(q) ? '' : 'none';
  });
}

function ixFilterPeptides() {
  const q = (document.getElementById('ixPepSearch')?.value || '').toLowerCase();
  window._ixPepSearch = q;
  document.querySelectorAll('#ixPepList .ix-item').forEach(btn => {
    const name = btn.querySelector('.ix-item-name')?.textContent?.toLowerCase() || '';
    const cat  = btn.querySelector('.ix-item-cat')?.textContent?.toLowerCase()  || '';
    btn.style.display = (name.includes(q) || cat.includes(q)) ? '' : 'none';
  });
}

function toggleIxDrug(drug) {
  window._ixDrugs = window._ixDrugs || [];
  window._ixDrugSearch = '';
  if (window._ixDrugs.includes(drug)) window._ixDrugs = window._ixDrugs.filter(d => d !== drug);
  else window._ixDrugs.push(drug);
  navigate('interactions');
}

function toggleIxPeptide(pep) {
  window._ixPeptides = window._ixPeptides || [];
  window._ixPepSearch = '';
  if (window._ixPeptides.includes(pep)) window._ixPeptides = window._ixPeptides.filter(p => p !== pep);
  else window._ixPeptides.push(pep);
  navigate('interactions');
}

function checkInteractions(drugs, peps) {
  const results = [];
  drugs.forEach(drug => {
    const info = DRUG_INTERACTIONS[drug];
    if (!info) return;
    peps.forEach(pep => {
      if (info.interactsWith.includes(pep)) {
        results.push({ drug, peptide: pep, severity: info.severity, note: info.note });
      }
    });
  });
  results.sort((a, b) => { const order = { high: 0, moderate: 1, low: 2 }; return order[a.severity] - order[b.severity]; });
  return results;
}

// ============================================================
// LEGAL DISCLAIMER PAGE
// ============================================================
function renderReview(el) {
  el.innerHTML = `
    <div class="kb-view review-page">
      <div class="kb-header">
        <div class="kb-title"><i class="fas fa-people-group" style="color:var(--teal);margin-right:8px"></i>Community Review</div>
        <div class="kb-subtitle">Help decide what gets added to the knowledge base.</div>
      </div>

      <div class="review-explainer">
        <div class="review-explainer-title"><i class="fas fa-circle-info"></i> How this works</div>
        <ol class="review-steps">
          <li><strong>The AI spots a gap.</strong> When people ask questions our knowledge base can't answer well, the app logs the topic.</li>
          <li><strong>A draft is written.</strong> Our system drafts a research-style entry and pulls real citations from PubMed where it can. Nothing is published automatically.</li>
          <li><strong>You weigh in.</strong> Anyone can vote a draft up or down below. Your vote is a signal about whether the information looks accurate and useful.</li>
          <li><strong>A human makes the final call.</strong> A moderator reviews the community's votes and the citations, then approves or rejects each draft before it ever goes live.</li>
        </ol>
        <p class="review-disclaimer"><i class="fas fa-triangle-exclamation"></i> This is research/educational information, not medical advice. Vote on accuracy and quality - never treat drafts as guidance.</p>
      </div>

      <div id="reviewList" class="review-list">
        <div class="review-loading"><div class="rs-loading-spinner"></div><span>Loading drafts up for review…</span></div>
      </div>
    </div>`;
  loadReviewDrafts();
}

function loadReviewDrafts() {
  const list = document.getElementById('reviewList');
  if (!list) return;
  const headers = (typeof window.authHeaders === 'function') ? window.authHeaders() : { 'Content-Type': 'application/json' };
  fetch('/api/kb/review', { headers })
    .then(r => r.json())
    .then(data => {
      const items = (data && data.items) || [];
      if (!items.length) {
        list.innerHTML = `
          <div class="review-empty">
            <i class="fas fa-circle-check"></i>
            <h3>Nothing to review right now</h3>
            <p>There are no pending drafts. When the knowledge base needs to grow, proposed entries will show up here for the community to weigh in on.</p>
          </div>`;
        return;
      }
      list.innerHTML = items.map(renderReviewCard).join('');
    })
    .catch(() => {
      list.innerHTML = `<div class="review-empty"><i class="fas fa-circle-exclamation"></i><h3>Couldn't load drafts</h3><p>Please try again in a moment.</p></div>`;
    });
}

function renderReviewCard(d) {
  const kindLabel = { 'new': 'New compound', 'enrich': 'Update', 'correction': 'Correction' }[d.kind] || 'Proposal';
  const kindColor = { 'new': '#2563eb', 'enrich': '#7c3aed', 'correction': '#d97706' }[d.kind] || '#6b7280';
  const score = (d.votesUp || 0) - (d.votesDown || 0);
  const fields = (d.fields || []).filter(f => f.key !== '_correction');
  const fieldsHtml = fields.map(f => `
    <div class="review-field">
      <div class="review-field-key">${esc(f.key)}</div>
      ${f.current !== undefined && f.current !== null ? `<div class="review-field-old"><span class="review-tag">was</span> ${esc(reviewStr(f.current))}</div>` : ''}
      <div class="review-field-new">${f.current !== undefined ? `<span class="review-tag review-tag-add">proposed</span> ` : ''}${esc(reviewStr(f.proposed))}</div>
    </div>`).join('');
  const citesHtml = (d.citations && d.citations.length) ? `
    <div class="review-cites">
      <div class="review-cites-title"><i class="fas fa-book"></i> Sources</div>
      <ul>${d.citations.map(x => `<li><a href="${esc(x.url || '#')}" target="_blank" rel="noopener">${esc(x.title || ('PMID ' + x.pmid))}</a>${x.year ? ` <span class="review-cite-year">(${x.year})</span>` : ''}</li>`).join('')}</ul>
    </div>` : `<div class="review-cites review-cites-none"><i class="fas fa-circle-info"></i> No external citations - this draft is from the AI's general knowledge and needs extra scrutiny.</div>`;

  return `
    <div class="review-card" data-review="${esc(d.id)}">
      <div class="review-card-head">
        <div>
          <span class="review-kind" style="background:${kindColor}1a;color:${kindColor}">${kindLabel}</span>
          <span class="review-card-title">${esc(d.title)}</span>
          ${d.targetId ? `<a class="review-card-link" href="/peptides/${esc(d.targetId)}" onclick="event.preventDefault(); navigate('peptide-detail','${esc(d.targetId)}')">view current page</a>` : ''}
        </div>
      </div>
      ${d.rationale ? `<p class="review-rationale">${esc(d.rationale)}</p>` : ''}
      <div class="review-fields">${fieldsHtml || '<p class="review-rationale">No structured changes provided.</p>'}</div>
      ${citesHtml}
      <div class="review-vote-bar">
        <button class="review-vote-btn review-vote-up${d.myVote === 1 ? ' active' : ''}" title="This looks accurate and useful" onclick="castReviewVote('${esc(d.id)}', 1, this)">
          <i class="fas fa-thumbs-up"></i> <span class="review-vote-count">${d.votesUp || 0}</span>
        </button>
        <button class="review-vote-btn review-vote-down${d.myVote === -1 ? ' active' : ''}" title="This looks wrong or low quality" onclick="castReviewVote('${esc(d.id)}', -1, this)">
          <i class="fas fa-thumbs-down"></i> <span class="review-vote-count">${d.votesDown || 0}</span>
        </button>
        <span class="review-score" title="Net community score">net ${score >= 0 ? '+' : ''}${score}</span>
        <span class="review-vote-note"><i class="fas fa-user-shield"></i> A moderator makes the final decision</span>
      </div>
    </div>`;
}

function reviewStr(v) {
  if (v === null || v === undefined) return '';
  if (Array.isArray(v)) return v.map(reviewStr).join(' • ');
  if (typeof v === 'object') return Object.entries(v).map(([k, val]) => `${k}: ${reviewStr(val)}`).join(' · ');
  return String(v);
}

function castReviewVote(draftId, vote, btn) {
  const card = btn.closest('.review-card');
  if (!card) return;
  const up = card.querySelector('.review-vote-up');
  const down = card.querySelector('.review-vote-down');
  // Toggle off if clicking the already-active choice.
  const already = btn.classList.contains('active');
  const sendVote = already ? 0 : vote;
  const headers = (typeof window.authHeaders === 'function') ? window.authHeaders() : { 'Content-Type': 'application/json' };
  // Optimistic UI lock.
  up.disabled = down.disabled = true;
  fetch('/api/kb/review/' + encodeURIComponent(draftId) + '/vote', {
    method: 'POST', headers, body: JSON.stringify({ vote: sendVote })
  })
    .then(r => r.json())
    .then(res => {
      if (res && res.ok) {
        up.querySelector('.review-vote-count').textContent = res.votesUp;
        down.querySelector('.review-vote-count').textContent = res.votesDown;
        up.classList.toggle('active', res.myVote === 1);
        down.classList.toggle('active', res.myVote === -1);
        const score = (res.votesUp || 0) - (res.votesDown || 0);
        const scoreEl = card.querySelector('.review-score');
        if (scoreEl) scoreEl.textContent = 'net ' + (score >= 0 ? '+' : '') + score;
      }
    })
    .catch(() => {})
    .finally(() => { up.disabled = down.disabled = false; });
}
window.castReviewVote = castReviewVote;

function renderDisclaimer(el) {
  el.innerHTML = `
    <div class="kb-view disclaimer-page">
      <div class="kb-header">
        <div class="kb-title"><i class="fas fa-shield-halved" style="color:var(--teal);margin-right:8px"></i>Legal Disclaimer</div>
        <div class="kb-subtitle">Please read this disclaimer carefully before using PeptideSafe.</div>
      </div>

      <div class="legal-section">
        <div class="legal-badge legal-badge-red"><i class="fas fa-exclamation-triangle"></i></div>
        <h2 class="legal-heading">Not Medical Advice</h2>
        <p>PeptideSafe is an <strong>educational research tool only</strong>. Nothing on this website constitutes medical advice, diagnosis, or treatment recommendations. All information presented - including peptide profiles, dosing protocols, reconstitution calculations, stack suggestions, and protocol templates - is compiled from publicly available scientific literature and is intended solely for educational and informational purposes.</p>
        <p><strong>Do not</strong> use any information on this site to self-diagnose, self-treat, or make health-related decisions without consulting a qualified, licensed healthcare professional. Always seek the advice of your physician or other qualified health provider with any questions you may have regarding a medical condition or treatment.</p>
      </div>

      <div class="legal-section">
        <div class="legal-badge legal-badge-amber"><i class="fas fa-flask"></i></div>
        <h2 class="legal-heading">Research Compounds</h2>
        <p>The majority of peptides discussed on PeptideSafe are <strong>research compounds that are not approved by the U.S. Food and Drug Administration (FDA)</strong> or equivalent regulatory bodies for human therapeutic use. References to these compounds do not imply safety, efficacy, or suitability for any purpose.</p>
        <p>Peptides listed as "FDA Approved" (e.g., Semaglutide, Tirzepatide) are approved only for specific indications under medical supervision. Off-label use, dosing modifications, or unsupervised administration of any substance carries significant risk.</p>
        <ul class="legal-list">
          <li>BPC-157, TB-500, GHK-Cu, Epithalon, and similar peptides are <strong>not FDA-approved for human use</strong></li>
          <li>Animal study results do not guarantee equivalent human outcomes</li>
          <li>Self-administration of injectable substances poses serious infection, contamination, and dosing risks</li>
          <li>Peptide quality, purity, and identity from unregulated sources cannot be guaranteed</li>
        </ul>
      </div>

      <div class="legal-section">
        <div class="legal-badge legal-badge-blue"><i class="fas fa-calculator"></i></div>
        <h2 class="legal-heading">Calculators & Tools</h2>
        <p>Reconstitution calculators, dose trackers, cost estimators, and other tools are provided as <strong>mathematical utilities only</strong>. They do not account for individual health factors, contraindications, drug interactions, or the specific characteristics of any particular product lot.</p>
        <p>The Stack Builder, Interaction Checker, and Protocol Templates generate outputs based on generalized research data and should <strong>never be used as a substitute for professional medical guidance</strong>.</p>
      </div>

      <div class="legal-section">
        <div class="legal-badge legal-badge-purple"><i class="fas fa-user-shield"></i></div>
        <h2 class="legal-heading">User Responsibility</h2>
        <p>By using PeptideSafe, you acknowledge and agree that:</p>
        <ul class="legal-list">
          <li>You are solely responsible for how you use information obtained from this site</li>
          <li>PeptideSafe, its creators, and contributors are not liable for any harm, injury, or adverse outcome resulting from the use or misuse of any information presented</li>
          <li>You will consult a licensed medical professional before taking any action based on content found here</li>
          <li>The information may contain errors, omissions, or may be outdated despite our best efforts</li>
          <li>Third-party content (YouTube videos, research papers) is not created, endorsed, or verified by PeptideSafe</li>
        </ul>
      </div>

      <div class="legal-section">
        <div class="legal-badge legal-badge-teal"><i class="fas fa-database"></i></div>
        <h2 class="legal-heading">Data & Privacy</h2>
        <p>PeptideSafe currently stores all user data (favorites, dose logs, journal entries, regimens, blood work records) <strong>locally in your browser using localStorage</strong>. This data:</p>
        <ul class="legal-list">
          <li>Never leaves your device or is transmitted to any server</li>
          <li>Is not backed up - clearing browser data will erase it permanently</li>
          <li>Is not encrypted - anyone with access to your device can view it</li>
          <li>Should not be relied upon as a medical record</li>
        </ul>
        <p>If account features are added in the future, a separate Privacy Policy will be published detailing data collection, storage, retention, and your rights under applicable laws (GDPR, CCPA, etc.).</p>
      </div>

      <div class="legal-section">
        <div class="legal-badge legal-badge-gray"><i class="fas fa-globe"></i></div>
        <h2 class="legal-heading">Third-Party Content</h2>
        <p>PeptideSafe aggregates content from third-party sources including:</p>
        <ul class="legal-list">
          <li><strong>YouTube</strong> - Videos are embedded from YouTube and subject to YouTube's Terms of Service and privacy policies</li>
          <li><strong>Europe PMC / PubMed</strong> - Research articles are linked from public biomedical databases; abstracts are displayed under fair use</li>
        </ul>
        <p>PeptideSafe does not host, modify, or take responsibility for the accuracy of third-party content. Inclusion of any external content does not constitute endorsement.</p>
      </div>

      <div class="legal-section">
        <div class="legal-badge legal-badge-red"><i class="fas fa-gavel"></i></div>
        <h2 class="legal-heading">Regulatory Compliance</h2>
        <p>Peptide regulations vary significantly by jurisdiction. In many countries, certain peptides are:</p>
        <ul class="legal-list">
          <li>Classified as prescription-only medications</li>
          <li>Restricted or banned for sale, purchase, or possession</li>
          <li>Legal only for in-vitro research use, not human consumption</li>
        </ul>
        <p>It is <strong>your responsibility</strong> to understand and comply with the laws and regulations of your jurisdiction regarding peptide acquisition and use. PeptideSafe does not facilitate, encourage, or endorse the purchase or use of any controlled or regulated substance.</p>
      </div>

      <div class="legal-section legal-section-last">
        <div class="legal-badge legal-badge-gray"><i class="fas fa-sync-alt"></i></div>
        <h2 class="legal-heading">Changes to This Disclaimer</h2>
        <p>This disclaimer may be updated at any time without prior notice. Continued use of PeptideSafe after changes constitutes acceptance of the revised terms. Last updated: <strong>March 2026</strong>.</p>
      </div>

      <div class="legal-contact">
        <p><i class="fas fa-envelope" style="margin-right:6px;opacity:0.5"></i>For questions or concerns, contact us through the appropriate channels.</p>
      </div>
    </div>
  `;
}

// ============================================================
// FEATURE 20: PROGRESS DASHBOARD
// ============================================================
function getProgressStats() {
  const doseLog = getDoseLog();
  const journal = getJournal();
  const regimen = getRegimen();
  const favorites = getFavorites();
  const bloodwork = (function() { try { return JSON.parse(localStorage.getItem('peptideai_bloodwork') || '[]'); } catch { return []; } })();
  const builder = builderStack || [];

  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const weekAgo = new Date(now - 7 * 86400000);
  const monthAgo = new Date(now - 30 * 86400000);

  // Dose streak (consecutive days with at least one dose)
  let doseStreak = 0;
  if (doseLog.length > 0) {
    let checkDate = new Date(today);
    while (true) {
      const dateStr = checkDate.toISOString().split('T')[0];
      const hasEntry = doseLog.some(e => e.timestamp && e.timestamp.startsWith(dateStr));
      if (hasEntry) { doseStreak++; checkDate.setDate(checkDate.getDate() - 1); }
      else break;
    }
  }

  // Journal streak
  let journalStreak = 0;
  if (journal.length > 0) {
    let checkDate = new Date(today);
    while (true) {
      const dateStr = checkDate.toISOString().split('T')[0];
      const hasEntry = journal.some(e => e.date === dateStr);
      if (hasEntry) { journalStreak++; checkDate.setDate(checkDate.getDate() - 1); }
      else break;
    }
  }

  // Weekly doses
  const weeklyDoses = doseLog.filter(e => e.timestamp && new Date(e.timestamp) >= weekAgo);
  const monthlyDoses = doseLog.filter(e => e.timestamp && new Date(e.timestamp) >= monthAgo);

  // Compliance rate (doses logged vs scheduled)
  let complianceRate = 0;
  if (regimen.length > 0 && doseLog.length > 0) {
    const last7Days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      last7Days.push(d.toISOString().split('T')[0]);
    }
    let scheduled = 0, logged = 0;
    last7Days.forEach(dateStr => {
      regimen.forEach(item => {
        if (isScheduledOn(item, dateStr)) scheduled++;
      });
      logged += doseLog.filter(e => e.timestamp && e.timestamp.startsWith(dateStr)).length;
    });
    complianceRate = scheduled > 0 ? Math.min(100, Math.round((logged / scheduled) * 100)) : 0;
  }

  // Unique peptides used
  const uniquePeptides = new Set(doseLog.map(e => e.peptideName || e.peptideId)).size;

  // Average wellness (journal)
  const recentJournal = journal.filter(e => new Date(e.date) >= weekAgo);
  const avgWellness = recentJournal.length > 0 ? (recentJournal.reduce((sum, e) => sum + (e.rating || 0), 0) / recentJournal.length).toFixed(1) : null;

  // Activity heatmap (last 30 days)
  const heatmapData = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const doses = doseLog.filter(e => e.timestamp && e.timestamp.startsWith(dateStr)).length;
    const hasJournal = journal.some(e => e.date === dateStr) ? 1 : 0;
    heatmapData.push({ date: dateStr, doses, hasJournal, total: doses + hasJournal, day: d.getDay() });
  }

  // Dose chart data (last 14 days)
  const chartData = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const count = doseLog.filter(e => e.timestamp && e.timestamp.startsWith(dateStr)).length;
    const jEntry = journal.find(e => e.date === dateStr);
    chartData.push({ date: dateStr, label: (d.getMonth()+1)+'/'+d.getDate(), doses: count, wellness: jEntry ? jEntry.rating : null });
  }

  // Peptide breakdown (top 5 by dose count)
  const pepCount = {};
  doseLog.forEach(e => { const name = e.peptideName || e.peptideId; pepCount[name] = (pepCount[name] || 0) + 1; });
  const topPeptides = Object.entries(pepCount).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return {
    doseStreak, journalStreak, weeklyDoses: weeklyDoses.length, monthlyDoses: monthlyDoses.length,
    totalDoses: doseLog.length, totalJournals: journal.length, totalBloodwork: bloodwork.length,
    regimenCount: regimen.length, favoriteCount: favorites.length, builderCount: builder.length,
    uniquePeptides, complianceRate, avgWellness, heatmapData, chartData, topPeptides
  };
}

function buildDashboardChart(chartData) {
  const maxDose = Math.max(1, ...chartData.map(d => d.doses));
  const h = 120, w = 460, padL = 30, padB = 22;
  const stepX = (w - padL) / (chartData.length - 1 || 1);

  let dosePath = '', wellnessPath = '', doseDots = '', wellDots = '';
  chartData.forEach((d, i) => {
    const x = padL + i * stepX;
    const yD = h - padB - ((d.doses / maxDose) * (h - padB - 10));
    dosePath += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + yD.toFixed(1);
    doseDots += `<circle cx="${x.toFixed(1)}" cy="${yD.toFixed(1)}" r="3" fill="#3b82f6"/>`;
    if (d.wellness !== null) {
      const yW = h - padB - ((d.wellness / 10) * (h - padB - 10));
      wellnessPath += (wellnessPath === '' ? 'M' : 'L') + x.toFixed(1) + ',' + yW.toFixed(1);
      wellDots += `<circle cx="${x.toFixed(1)}" cy="${yW.toFixed(1)}" r="3" fill="#10b981"/>`;
    }
  });

  const labels = chartData.filter((_, i) => i % 3 === 0 || i === chartData.length - 1).map((d, _, arr) => {
    const idx = chartData.indexOf(d);
    const x = padL + idx * stepX;
    return `<text x="${x}" y="${h - 4}" text-anchor="middle" fill="var(--text-muted)" font-size="9">${d.label}</text>`;
  }).join('');

  return `<svg viewBox="0 0 ${w} ${h}" style="width:100%;height:auto;max-height:140px">
    <line x1="${padL}" y1="10" x2="${padL}" y2="${h-padB}" stroke="var(--border)" stroke-width="0.5"/>
    <line x1="${padL}" y1="${h-padB}" x2="${w}" y2="${h-padB}" stroke="var(--border)" stroke-width="0.5"/>
    <path d="${dosePath}" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    ${wellnessPath ? `<path d="${wellnessPath}" fill="none" stroke="#10b981" stroke-width="2" stroke-dasharray="4,3" stroke-linecap="round"/>` : ''}
    ${doseDots}${wellDots}${labels}
  </svg>`;
}

// ============================================================
// AI INSIGHTS DASHBOARD
// Learns about the user from their tracking data + chat logs and
// surfaces personalized, biohacker-focused insights.
// ============================================================
const INSIGHTS_CACHE_KEY = 'rs_ai_insights_cache';

// Pull the user's chat history from every chat thread stored locally.
function collectChatLogs() {
  const out = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key === 'rs_chat_detail_thread' || key.indexOf('rs_chat_') === 0) {
        try {
          const arr = JSON.parse(localStorage.getItem(key) || '[]');
          if (Array.isArray(arr)) {
            arr.forEach(m => {
              if (m && (m.role === 'user' || m.role === 'assistant') && m.content) {
                out.push({ role: m.role, content: String(m.content).slice(0, 600) });
              }
            });
          }
        } catch {}
      }
    }
  } catch {}
  return out.slice(-60);
}

// Selected research goals captured during onboarding (if any).
function getUserGoals() {
  try {
    const raw = localStorage.getItem('rs_user_goals');
    if (raw) { const a = JSON.parse(raw); if (Array.isArray(a)) return a; }
  } catch {}
  return [];
}

// Build a compact, structured profile of the user from local data.
function buildUserProfile() {
  const s = getProgressStats();
  const doseLog = getDoseLog();
  const journal = getJournal();
  const favorites = getFavorites();
  const chats = collectChatLogs();
  const goals = getUserGoals();

  // Topics the user asked the AI about (from their own messages).
  const questionTopics = chats
    .filter(m => m.role === 'user')
    .map(m => m.content)
    .slice(-25);

  // Recent side effects logged in the journal.
  const sideEffects = {};
  journal.forEach(j => {
    (j.sideEffects || []).forEach(se => { sideEffects[se] = (sideEffects[se] || 0) + 1; });
  });

  // Recently dosed compounds (by latest timestamp).
  const recentCompounds = [];
  const seen = new Set();
  doseLog.forEach(e => {
    const n = e.peptideName || e.peptideId;
    if (n && !seen.has(n)) { seen.add(n); recentCompounds.push(n); }
  });

  return {
    stats: {
      totalDoses: s.totalDoses, doseStreak: s.doseStreak, journalStreak: s.journalStreak,
      complianceRate: s.complianceRate, avgWellness: s.avgWellness, uniquePeptides: s.uniquePeptides,
      weeklyDoses: s.weeklyDoses, totalJournals: s.totalJournals, totalBloodwork: s.totalBloodwork,
      regimenCount: s.regimenCount, favoriteCount: s.favoriteCount,
    },
    topPeptides: s.topPeptides.map(([name, count]) => ({ name, count })),
    recentCompounds: recentCompounds.slice(0, 8),
    favorites: favorites.slice(0, 12),
    goals,
    questionTopics,
    sideEffects: Object.entries(sideEffects).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => ({ effect: k, count: v })),
    chatMessageCount: chats.length,
  };
}

// A signal score so the UI can tell the user how much the AI knows.
function profileSignalScore(p) {
  let score = 0;
  if (p.stats.totalDoses > 0) score += 18;
  if (p.stats.totalDoses >= 20) score += 10;
  if (p.stats.totalJournals > 0) score += 12;
  if (p.stats.totalBloodwork > 0) score += 12;
  if (p.favorites.length > 0) score += 10;
  if (p.goals.length > 0) score += 12;
  if (p.chatMessageCount > 0) score += 14;
  if (p.chatMessageCount >= 10) score += 8;
  if (p.topPeptides.length >= 3) score += 4;
  return Math.min(100, score);
}

// Minimal, safe markdown rendering for AI insight text (no em dashes added).
function insightMarkdown(text) {
  let html = esc(text || '');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/^\s*[-*]\s+(.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>');
  html = html.replace(/<\/ul>\s*<ul>/g, '');
  html = html.replace(/\n{2,}/g, '</p><p>');
  html = html.replace(/\n/g, '<br>');
  return '<p>' + html + '</p>';
}

// Parse the AI's structured insight payload. The model is asked to return a
// JSON object; if that fails we fall back to showing the raw narrative.
function parseInsightPayload(raw) {
  const cleaned = (raw || '').replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('{');
  if (start === -1) return { _raw: cleaned };
  const body = cleaned.slice(start);

  // Direct parse from first '{' to last '}'.
  const end = body.lastIndexOf('}');
  if (end > 0) {
    try {
      const obj = JSON.parse(body.slice(0, end + 1));
      if (obj && typeof obj === 'object') return obj;
    } catch {}
  }

  // Lenient repair for truncated streams: balance open braces/brackets and
  // drop any trailing partial token so we can salvage the structured output.
  try {
    let repaired = body;
    // Remove a dangling partial string at the very end (unterminated quote).
    const lastQuote = repaired.lastIndexOf('"');
    const openQuotes = (repaired.match(/"/g) || []).length;
    if (openQuotes % 2 !== 0 && lastQuote !== -1) {
      repaired = repaired.slice(0, lastQuote);
    }
    // Trim trailing comma/whitespace.
    repaired = repaired.replace(/[,\s]+$/, '');
    // Close any unbalanced brackets/braces.
    const stack = [];
    let inStr = false, esc2 = false;
    for (const ch of repaired) {
      if (inStr) { if (esc2) esc2 = false; else if (ch === '\\') esc2 = true; else if (ch === '"') inStr = false; continue; }
      if (ch === '"') inStr = true;
      else if (ch === '{' || ch === '[') stack.push(ch);
      else if (ch === '}' || ch === ']') stack.pop();
    }
    while (stack.length) { repaired += stack.pop() === '{' ? '}' : ']'; }
    const obj = JSON.parse(repaired);
    if (obj && typeof obj === 'object') return obj;
  } catch {}

  return { _raw: cleaned };
}

// Call the streaming AI endpoint and accumulate the full response text.
async function streamInsight(messages, onProgress) {
  const headers = (typeof window.authHeaders === 'function')
    ? window.authHeaders()
    : { 'Content-Type': 'application/json' };
  const userId = (window.currentUser && (window.currentUser.id || window.currentUser.email)) || null;
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 60000);
  let full = '';
  try {
    const res = await fetch('/ai/chat', {
      method: 'POST',
      headers,
      body: JSON.stringify({ messages, userId }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      let msg = 'AI request failed.';
      try { const j = await res.json(); if (j && j.error) msg = j.error; } catch {}
      throw new Error(msg);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith('data:')) continue;
        const data = t.slice(5).trim();
        if (data === '[DONE]') continue;
        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices && parsed.choices[0] && parsed.choices[0].delta && parsed.choices[0].delta.content;
          if (delta) { full += delta; if (onProgress) onProgress(full); }
        } catch {}
      }
    }
  } finally {
    clearTimeout(to);
  }
  return full;
}

function buildInsightPrompt(profile) {
  return `You are ResearchSafe AI, a sharp, encouraging biohacking research coach. Analyze the user's activity profile below and produce personalized insights for an advanced biohacker. Be specific, reference their actual data, and stay educational (research and harm-reduction framing, not medical advice).

Do not use em dashes anywhere in your output. Use regular hyphens or rewrite the sentence.

USER PROFILE (JSON):
${JSON.stringify(profile, null, 2)}

Return ONLY a JSON object with this exact shape and nothing else:
{
  "summary": "2 to 3 sentence read on who this user is as a biohacker and what they are optimizing for",
  "interests": ["short interest tag", "short interest tag"],
  "insights": [
    { "icon": "fa-bullseye", "title": "short title", "body": "1 to 2 sentences referencing their data" }
  ],
  "improvements": [
    { "title": "actionable step", "body": "why it helps, referencing their data" }
  ],
  "experiments": [
    { "title": "cool biohacker experiment or stack idea to research", "body": "what to look into and why it fits them" }
  ],
  "nextQuestions": ["a question they might want to ask the AI next", "another"]
}

Provide 3 to 5 items for insights, 2 to 4 for improvements, 2 to 3 for experiments, and 3 nextQuestions. If the user has little data, focus on getting started and what to track. Keep each body under 280 characters.`;
}

function renderDashboard(el) {
  const _dashSaveBanner = !currentUser ? renderSaveBanner('Progress Dashboard', '#10b981') : '';
  const s = getProgressStats();
  const profile = buildUserProfile();
  const signal = profileSignalScore(profile);
  const maxHeat = Math.max(1, ...s.heatmapData.map(d => d.total));

  const heatmapCells = s.heatmapData.map(d => {
    const intensity = d.total / maxHeat;
    const bgColor = d.total === 0 ? 'rgba(0,0,0,0.04)' : `rgba(15,157,110,${0.18 + intensity * 0.62})`;
    return `<div class="dash-heat-cell" title="${d.date}: ${d.doses} doses, ${d.hasJournal ? 'journal logged' : 'no journal'}" style="background:${bgColor}">
      <span class="dash-heat-num">${d.total || ''}</span>
    </div>`;
  }).join('');

  const topPepHTML = s.topPeptides.length > 0 ? s.topPeptides.map(([name, count], i) => {
    const pct = Math.round((count / s.totalDoses) * 100);
    const colors = ['#0f9d6e','#3b82f6','#8b5cf6','#f59e0b','#ef4444'];
    return `<div class="dash-pep-row">
      <span class="dash-pep-rank">${i+1}</span>
      <span class="dash-pep-name">${esc(name)}</span>
      <div class="dash-pep-bar"><div class="dash-pep-bar-fill" style="width:${pct}%;background:${colors[i]}"></div></div>
      <span class="dash-pep-count">${count}</span>
    </div>`;
  }).join('') : '<p style="font-size:12px;color:#6b7280;text-align:center;padding:20px">Log doses to see your compound breakdown</p>';

  const interestChips = profile.interests && profile.interests.length
    ? profile.interests
    : deriveInterestChips(profile);
  const interestChipsHTML = interestChips.map(t => `<span class="rsd-cat-pill" style="--cat:#0f9d6e"><span class="rsd-cat-dot"></span>${esc(t)}</span>`).join('');

  window.__rsInsightProfile = profile;

  el.innerHTML = `
    <div class="dash-view rsd-detail ai-dash">
      <!-- AI INSIGHTS HERO -->
      <div class="rsd-card aidash-hero">
        <div class="aidash-hero-main">
          <div class="aidash-hero-icon"><i class="fas fa-wand-magic-sparkles"></i></div>
          <div class="aidash-hero-text">
            <h1 class="aidash-hero-title">AI Insights</h1>
            <p class="aidash-hero-sub">The more you track and chat, the sharper these get. Personalized reads on your interests, how to improve, and experiments worth researching.</p>
            <div class="aidash-interests">${interestChipsHTML || '<span class="aidash-muted">Use the app to reveal your interests</span>'}</div>
          </div>
        </div>
        <div class="aidash-signal">
          <div class="aidash-ring" style="--pct:${signal}">
            <div class="aidash-ring-val">${signal}<span>%</span></div>
          </div>
          <div class="aidash-signal-label">AI knows you</div>
          <div class="aidash-signal-sub">${signalCopy(signal)}</div>
          <button class="aidash-wrapped-btn" onclick="shareResearchWrapped()"><i class="fas fa-share-nodes"></i> Share my research wrapped</button>
        </div>
      </div>

      ${_dashSaveBanner}

      <!-- TAB BAR -->
      <div class="aidash-tabs">
        <button class="aidash-tab is-active" data-tab="insights" onclick="switchDashTab(this,'insights')"><i class="fas fa-lightbulb"></i> Insights</button>
        <button class="aidash-tab" data-tab="activity" onclick="switchDashTab(this,'activity')"><i class="fas fa-chart-line"></i> Activity</button>
        <button class="aidash-tab" data-tab="memory" onclick="switchDashTab(this,'memory')"><i class="fas fa-brain"></i> What AI Knows</button>
      </div>

      <!-- INSIGHTS TAB -->
      <div class="aidash-pane" data-pane="insights">
        <div id="aiInsightsPanel"></div>
      </div>

      <!-- MEMORY TAB -->
      <div class="aidash-pane" data-pane="memory" style="display:none">
        ${renderMemoryPane(profile, signal)}
      </div>

      <!-- ACTIVITY TAB -->
      <div class="aidash-pane" data-pane="activity" style="display:none">
      <!-- Streak & Key Stats -->
      <div class="dash-streak-row">
        <div class="dash-streak-card dash-streak-fire">
          <div class="dash-streak-icon"><i class="fas fa-fire"></i></div>
          <div class="dash-streak-num">${s.doseStreak}</div>
          <div class="dash-streak-label">Day Dose Streak</div>
        </div>
        <div class="dash-streak-card dash-streak-journal">
          <div class="dash-streak-icon"><i class="fas fa-book-medical"></i></div>
          <div class="dash-streak-num">${s.journalStreak}</div>
          <div class="dash-streak-label">Day Journal Streak</div>
        </div>
        <div class="dash-streak-card dash-streak-compliance">
          <div class="dash-streak-icon"><i class="fas fa-bullseye"></i></div>
          <div class="dash-streak-num">${s.complianceRate}%</div>
          <div class="dash-streak-label">7-Day Compliance</div>
        </div>
        <div class="dash-streak-card dash-streak-wellness">
          <div class="dash-streak-icon"><i class="fas fa-heart-pulse"></i></div>
          <div class="dash-streak-num">${s.avgWellness || ' - '}</div>
          <div class="dash-streak-label">Avg Wellness</div>
        </div>
      </div>

      <!-- Quick Stats Grid -->
      <div class="dash-stats-grid">
        <div class="dash-stat-tile" onclick="navigate('tracker')">
          <div class="dash-stat-icon" style="color:#3b82f6"><i class="fas fa-syringe"></i></div>
          <div class="dash-stat-val">${s.totalDoses}</div>
          <div class="dash-stat-lbl">Total Doses</div>
        </div>
        <div class="dash-stat-tile" onclick="navigate('tracker')">
          <div class="dash-stat-icon" style="color:#8b5cf6"><i class="fas fa-calendar-week"></i></div>
          <div class="dash-stat-val">${s.weeklyDoses}</div>
          <div class="dash-stat-lbl">This Week</div>
        </div>
        <div class="dash-stat-tile" onclick="navigate('journal')">
          <div class="dash-stat-icon" style="color:#10b981"><i class="fas fa-book-medical"></i></div>
          <div class="dash-stat-val">${s.totalJournals}</div>
          <div class="dash-stat-lbl">Journal Entries</div>
        </div>
        <div class="dash-stat-tile" onclick="navigate('calendar')">
          <div class="dash-stat-icon" style="color:#f59e0b"><i class="fas fa-calendar-alt"></i></div>
          <div class="dash-stat-val">${s.regimenCount}</div>
          <div class="dash-stat-lbl">Active Peptides</div>
        </div>
        <div class="dash-stat-tile" onclick="navigate('knowledge')">
          <div class="dash-stat-icon" style="color:#06b6d4"><i class="fas fa-flask"></i></div>
          <div class="dash-stat-val">${s.uniquePeptides}</div>
          <div class="dash-stat-lbl">Unique Used</div>
        </div>
      </div>

      <!-- Activity Heatmap -->
      <div class="dash-section-card">
        <div class="dash-section-title"><i class="fas fa-th"></i> 30-Day Activity Heatmap</div>
        <div class="dash-heatmap">${heatmapCells}</div>
        <div class="dash-heatmap-legend">
          <span style="font-size:10px;color:var(--text-muted)">Less</span>
          <div class="dash-heat-legend-cell" style="background:var(--bg-secondary)"></div>
          <div class="dash-heat-legend-cell" style="background:rgba(37,99,235,0.2)"></div>
          <div class="dash-heat-legend-cell" style="background:rgba(37,99,235,0.45)"></div>
          <div class="dash-heat-legend-cell" style="background:rgba(37,99,235,0.7)"></div>
          <span style="font-size:10px;color:var(--text-muted)">More</span>
        </div>
      </div>

      <!-- Dose & Wellness Chart -->
      <div class="dash-section-card">
        <div class="dash-section-title"><i class="fas fa-chart-area"></i> 14-Day Trend</div>
        <div class="dash-chart-legend">
          <span class="dash-legend-dot" style="background:#3b82f6"></span> Doses
          <span class="dash-legend-dot" style="background:#10b981;margin-left:12px"></span> Wellness
        </div>
        ${s.chartData.some(d => d.doses > 0) ? buildDashboardChart(s.chartData) : '<p style="font-size:12px;color:var(--text-muted);text-align:center;padding:30px">Start logging doses to see your trend chart</p>'}
      </div>

      <!-- Peptide Breakdown -->
      <div class="dash-section-card">
        <div class="dash-section-title"><i class="fas fa-ranking-star"></i> Top Peptides</div>
        ${topPepHTML}
      </div>

      <!-- Quick Actions -->
      <div class="dash-actions">
        <button class="dash-action-btn" onclick="openDoseLogForm()"><i class="fas fa-plus"></i> Log Dose</button>
        <button class="dash-action-btn dash-action-journal" onclick="openJournalEntry(new Date().toISOString().split('T')[0])"><i class="fas fa-pen"></i> Journal Entry</button>
        <button class="dash-action-btn dash-action-achievements" onclick="navigate('achievements')"><i class="fas fa-trophy"></i> Achievements</button>
      </div>
      </div>
    </div>
  `;

  // Render the AI insights panel (from cache) then kick off generation.
  initAiInsightsPanel(profile, signal);
}

function signalCopy(signal) {
  if (signal >= 75) return 'Rich profile. Insights are highly tailored.';
  if (signal >= 45) return 'Good signal. Keep tracking to sharpen it.';
  if (signal >= 20) return 'Getting to know you. Log and chat for more.';
  return 'Just getting started. Track a few things to begin.';
}

// ── Research Wrapped: a shareable summary card of the user's research activity.
// We encode a small, non-identifying stats payload into a /wrapped URL. The
// server renders an unfurlable OG image + landing page from those params, so
// posting the link to Reddit / X / Discord shows a branded card with a CTA.
function buildWrappedPayload() {
  const p = (typeof buildUserProfile === 'function') ? buildUserProfile() : { stats: {}, topPeptides: [], goals: [] };
  const signal = (typeof profileSignalScore === 'function') ? profileSignalScore(p) : 0;
  const top = (p.topPeptides || []).slice(0, 3).map(t => t.name);
  return {
    v: 1,
    d: p.stats.totalDoses || 0,
    s: p.stats.doseStreak || 0,
    c: p.stats.complianceRate || 0,
    u: p.stats.uniquePeptides || 0,
    j: p.stats.totalJournals || 0,
    q: p.chatMessageCount || 0,
    k: signal,
    t: top,
  };
}

function encodeWrapped(payload) {
  try {
    const json = JSON.stringify(payload);
    // base64url so it is URL-safe.
    const b64 = btoa(unescape(encodeURIComponent(json)));
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  } catch (e) { return ''; }
}

function shareResearchWrapped() {
  const payload = buildWrappedPayload();
  const enc = encodeWrapped(payload);
  const url = window.location.origin + '/wrapped?d=' + enc;
  const shareText = 'My peptide research wrapped on ResearchSafe: ' +
    payload.d + ' doses logged, a ' + payload.s + '-day streak, and ' + payload.u + ' compounds tracked.';

  // Prefer the native share sheet on mobile; otherwise show a copy modal.
  if (navigator.share) {
    navigator.share({ title: 'My Research Wrapped', text: shareText, url: url })
      .catch(function () { showWrappedModal(url, shareText); });
    return;
  }
  showWrappedModal(url, shareText);
}

function showWrappedModal(url, shareText) {
  var old = document.getElementById('rsWrappedModal');
  if (old) old.remove();
  var overlay = document.createElement('div');
  overlay.id = 'rsWrappedModal';
  overlay.className = 'rs-wrapped-overlay';
  overlay.innerHTML =
    '<div class="rs-wrapped-modal">' +
      '<button class="rs-wrapped-close" onclick="this.closest(\'.rs-wrapped-overlay\').remove()" aria-label="Close"><i class="fas fa-xmark"></i></button>' +
      '<div class="rs-wrapped-head"><i class="fas fa-share-nodes"></i><h3>Share your research wrapped</h3></div>' +
      '<p class="rs-wrapped-sub">A branded summary card unfurls when you post this link. Friends who open it can start their own free research.</p>' +
      '<div class="rs-wrapped-preview"><img src="/wrapped-image.svg?d=' + encodeURIComponent(url.split('d=')[1] || '') + '" alt="Research wrapped preview" loading="lazy"></div>' +
      '<div class="rs-wrapped-link"><i class="fas fa-link"></i><span>' + esc(url) + '</span></div>' +
      '<div class="rs-wrapped-actions">' +
        '<button class="rs-wrapped-btn-primary" data-url="' + esc(url) + '"><i class="fas fa-copy"></i> Copy link</button>' +
        '<a class="rs-wrapped-btn-ghost" target="_blank" rel="noopener" href="https://twitter.com/intent/tweet?text=' + encodeURIComponent(shareText) + '&url=' + encodeURIComponent(url) + '"><i class="fab fa-x-twitter"></i> Post on X</a>' +
      '</div>' +
    '</div>';
  document.body.appendChild(overlay);
  requestAnimationFrame(function () { overlay.classList.add('is-open'); });
  overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });
  var copyBtn = overlay.querySelector('.rs-wrapped-btn-primary');
  if (copyBtn) copyBtn.addEventListener('click', function () {
    var u = copyBtn.getAttribute('data-url');
    navigator.clipboard.writeText(u).then(function () {
      copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied';
      setTimeout(function () { copyBtn.innerHTML = '<i class="fas fa-copy"></i> Copy link'; }, 1800);
    }).catch(function () {});
  });
}
window.shareResearchWrapped = shareResearchWrapped;
window.showWrappedModal = showWrappedModal;

// Heuristic interest tags used before the AI fills in real ones.
function deriveInterestChips(p) {
  const chips = [];
  const goalLabels = { 'fat-loss': 'Fat loss', 'muscle': 'Muscle growth', 'healing': 'Recovery & healing', 'cognitive': 'Cognition', 'longevity': 'Longevity', 'sleep': 'Sleep', 'skin': 'Skin & hair', 'libido': 'Libido' };
  (p.goals || []).forEach(g => { if (goalLabels[g]) chips.push(goalLabels[g]); else if (g) chips.push(String(g)); });
  (p.topPeptides || []).slice(0, 3).forEach(tp => chips.push(tp.name));
  if (!chips.length && p.favorites && p.favorites.length) chips.push('Exploring compounds');
  return chips.slice(0, 5);
}

function switchDashTab(btn, tab) {
  const root = btn.closest('.ai-dash');
  if (!root) return;
  root.querySelectorAll('.aidash-tab').forEach(b => b.classList.toggle('is-active', b === btn));
  root.querySelectorAll('.aidash-pane').forEach(p => {
    p.style.display = p.getAttribute('data-pane') === tab ? '' : 'none';
  });
}

function renderMemoryPane(p, signal) {
  const row = (label, val) => `<div class="rsd-kv"><span class="rsd-kv-k">${esc(label)}</span><span class="rsd-kv-v">${esc(String(val))}</span></div>`;
  const list = (arr, empty) => (arr && arr.length)
    ? `<ul class="rsd-check-list">${arr.map(x => `<li>${esc(typeof x === 'object' ? (x.name || x.effect || JSON.stringify(x)) : x)}</li>`).join('')}</ul>`
    : `<p class="aidash-muted" style="margin:6px 0 0">${esc(empty)}</p>`;

  return `
    <div class="rsd-grid3">
      <div class="rsd-card rsd-mini">
        <div class="rsd-mini-head"><i class="fas fa-database"></i> Signals collected</div>
        ${row('Doses logged', p.stats.totalDoses)}
        ${row('Journal entries', p.stats.totalJournals)}
        ${row('Blood panels', p.stats.totalBloodwork)}
        ${row('Favorites', p.stats.favoriteCount)}
        ${row('Chat messages', p.chatMessageCount)}
      </div>
      <div class="rsd-card rsd-mini">
        <div class="rsd-mini-head rsd-mini-head-pos"><i class="fas fa-flask"></i> Compounds you use</div>
        ${list(p.topPeptides.length ? p.topPeptides : p.recentCompounds, 'No doses logged yet.')}
      </div>
      <div class="rsd-card rsd-mini">
        <div class="rsd-mini-head rsd-mini-head-warn"><i class="fas fa-clipboard-question"></i> Topics you ask about</div>
        ${list((p.questionTopics || []).slice(-6).map(q => q.length > 60 ? q.slice(0, 57) + '...' : q), 'Chat with the AI to build this.')}
      </div>
    </div>
    <div class="rsd-card rsd-prose" style="margin-top:14px">
      <div class="rsd-prose-title"><i class="fas fa-shield-halved" style="margin-right:6px;opacity:.7"></i>Your data stays yours</div>
      <p class="rsd-prose-text">These signals live in your browser and are only sent to the AI when you generate insights. Nothing here is shared publicly. You can clear it any time.</p>
      <button class="rsd-btn rsd-btn-ghost" onclick="clearInsightMemory()" style="margin-top:10px"><i class="fas fa-eraser"></i> Clear AI memory</button>
    </div>
  `;
}

function clearInsightMemory() {
  try { localStorage.removeItem(INSIGHTS_CACHE_KEY); } catch {}
  if (typeof window.__rsClearDetailThread === 'function') window.__rsClearDetailThread();
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.indexOf('rs_chat_') === 0) localStorage.removeItem(k);
    }
  } catch {}
  if (typeof showToast === 'function') showToast('AI memory cleared');
  navigate('home');
}

// ── Insights panel: cache, generation, rendering ────────────────────────────
function initAiInsightsPanel(profile, signal) {
  const panel = document.getElementById('aiInsightsPanel');
  if (!panel) return;
  let cached = null;
  try { cached = JSON.parse(localStorage.getItem(INSIGHTS_CACHE_KEY) || 'null'); } catch {}

  if (cached && cached.data) {
    panel.innerHTML = renderInsightsContent(cached.data, cached.generatedAt);
  } else {
    panel.innerHTML = renderInsightsEmpty(signal);
  }
}

function renderInsightsEmpty(signal) {
  return `
    <div class="rsd-card aidash-generate">
      <div class="aidash-generate-icon"><i class="fas fa-wand-magic-sparkles"></i></div>
      <h3>Generate your AI insights</h3>
      <p>The AI will read your tracking data and chat history to surface your interests, where you can improve, and experiments worth researching.</p>
      <button class="rsd-btn rsd-btn-primary" onclick="generateAiInsights()"><i class="fas fa-bolt"></i> Generate insights</button>
    </div>
  `;
}

function renderInsightsLoading() {
  return `
    <div class="rsd-card aidash-loading">
      <div class="aidash-spinner"></div>
      <div class="aidash-loading-text" id="aiInsightStream">Analyzing your activity and chat history...</div>
    </div>
  `;
}

async function generateAiInsights() {
  const panel = document.getElementById('aiInsightsPanel');
  if (!panel) return;
  const profile = window.__rsInsightProfile || buildUserProfile();
  panel.innerHTML = renderInsightsLoading();
  const streamEl = document.getElementById('aiInsightStream');
  try {
    const prompt = buildInsightPrompt(profile);
    const raw = await streamInsight(
      [{ role: 'user', content: prompt }],
      (partial) => { if (streamEl) streamEl.textContent = 'Thinking... ' + partial.replace(/\s+/g, ' ').slice(-120); }
    );
    const data = parseInsightPayload(raw);
    const generatedAt = new Date().toISOString();
    try { localStorage.setItem(INSIGHTS_CACHE_KEY, JSON.stringify({ data, generatedAt })); } catch {}
    panel.innerHTML = renderInsightsContent(data, generatedAt);
  } catch (err) {
    panel.innerHTML = `
      <div class="rsd-card aidash-generate">
        <div class="aidash-generate-icon" style="color:#ef4444"><i class="fas fa-triangle-exclamation"></i></div>
        <h3>Could not generate insights</h3>
        <p>${esc(err.message || 'Something went wrong. Please try again.')}</p>
        <button class="rsd-btn rsd-btn-primary" onclick="generateAiInsights()"><i class="fas fa-rotate-right"></i> Try again</button>
      </div>`;
  }
}

function renderInsightsContent(data, generatedAt) {
  if (data && data._raw && !data.summary) {
    return `
      <div class="rsd-card rsd-prose">
        <div class="rsd-prose-title"><i class="fas fa-wand-magic-sparkles" style="margin-right:6px;opacity:.7"></i>Your insights</div>
        ${insightMarkdown(data._raw)}
        ${insightsToolbar(generatedAt)}
      </div>`;
  }

  const when = generatedAt ? new Date(generatedAt) : null;
  const summary = data.summary ? `
    <div class="rsd-card aidash-summary">
      <div class="aidash-summary-icon"><i class="fas fa-user-astronaut"></i></div>
      <div>
        <div class="aidash-summary-label">Your biohacker profile</div>
        <p class="aidash-summary-text">${esc(data.summary)}</p>
      </div>
    </div>` : '';

  const insights = (data.insights || []).map((it, i) => `
    <button class="rsd-card aidash-insight" onclick="toggleInsightCard(this)" style="animation-delay:${i * 60}ms">
      <div class="aidash-insight-icon"><i class="fas ${esc(it.icon || 'fa-lightbulb')}"></i></div>
      <div class="aidash-insight-body">
        <div class="aidash-insight-title">${esc(it.title || 'Insight')} <i class="fas fa-chevron-down aidash-chev"></i></div>
        <div class="aidash-insight-text">${esc(it.body || '')}</div>
      </div>
    </button>`).join('');

  const improvements = (data.improvements || []).map(it => `
    <div class="rsd-card rsd-mini">
      <div class="rsd-mini-head rsd-mini-head-pos"><i class="fas fa-arrow-trend-up"></i> ${esc(it.title || '')}</div>
      <p class="rsd-mini-note">${esc(it.body || '')}</p>
    </div>`).join('');

  const experiments = (data.experiments || []).map(it => `
    <div class="rsd-card rsd-mini">
      <div class="rsd-mini-head"><i class="fas fa-vials"></i> ${esc(it.title || '')}</div>
      <p class="rsd-mini-note">${esc(it.body || '')}</p>
    </div>`).join('');

  const nextQList = (data.nextQuestions || []);
  window.__rsInsightQ = nextQList;
  const nextQ = nextQList.map((q, i) => `
    <button class="aidash-q" onclick="askInsightQuestion(${i})"><i class="fas fa-comment-dots"></i> ${esc(q)}</button>`).join('');

  return `
    ${summary}
    ${insights ? `<div class="aidash-section-title"><i class="fas fa-lightbulb"></i> Key insights</div><div class="aidash-insight-grid">${insights}</div>` : ''}
    ${improvements ? `<div class="aidash-section-title"><i class="fas fa-arrow-trend-up"></i> How you can improve</div><div class="rsd-grid3">${improvements}</div>` : ''}
    ${experiments ? `<div class="aidash-section-title"><i class="fas fa-flask-vial"></i> Experiments to research</div><div class="rsd-grid3">${experiments}</div>` : ''}
    ${nextQ ? `<div class="aidash-section-title"><i class="fas fa-comments"></i> Ask the AI next</div><div class="aidash-q-row">${nextQ}</div>` : ''}
    <div class="rsd-card" style="padding:14px 18px">${insightsToolbar(generatedAt)}</div>
    <p class="rsd-disclaimer" style="margin-top:12px">For research and education only. Not medical advice. Insights are AI generated from your own logged data.</p>
  `;
}

function insightsToolbar(generatedAt) {
  const when = generatedAt ? new Date(generatedAt) : null;
  const ago = when ? when.toLocaleString() : '';
  return `
    <div class="aidash-toolbar">
      <span class="aidash-muted">${ago ? 'Generated ' + esc(ago) : ''}</span>
      <button class="rsd-btn rsd-btn-ghost" onclick="generateAiInsights()"><i class="fas fa-rotate-right"></i> Regenerate</button>
    </div>`;
}

function toggleInsightCard(card) {
  card.classList.toggle('is-open');
}

function askInsightQuestion(idx) {
  const list = window.__rsInsightQ || [];
  const q = typeof idx === 'number' ? list[idx] : idx;
  if (!q) return;
  try { sessionStorage.setItem('rs_pending_ai_q', q); } catch {}
  navigate('home');
  setTimeout(() => {
    try {
      const input = document.getElementById('rsChatInput_home');
      if (input) {
        input.value = q;
        input.dispatchEvent(new Event('input'));
        input.focus();
        if (window.__rsChat && typeof window.__rsChat.send === 'function') window.__rsChat.send('home');
      }
    } catch {}
  }, 600);
}

// ============================================================
// FEATURE 21: ACHIEVEMENT / GAMIFICATION SYSTEM
// ============================================================
const ACHIEVEMENTS_KEY = 'peptideai_achievements';

function getAchievements() {
  try { return JSON.parse(localStorage.getItem(ACHIEVEMENTS_KEY) || '{}'); } catch { return {}; }
}
function saveAchievements(a) { localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(a)); }

const ACHIEVEMENT_DEFS = [
  // Dose milestones
  { id: 'first_dose', name: 'First Pin', desc: 'Log your first dose', icon: 'fa-syringe', color: '#3b82f6', xp: 10, cat: 'Dosing' },
  { id: 'dose_10', name: 'Getting Started', desc: 'Log 10 total doses', icon: 'fa-syringe', color: '#3b82f6', xp: 25, cat: 'Dosing' },
  { id: 'dose_50', name: 'Committed', desc: 'Log 50 total doses', icon: 'fa-syringe', color: '#3b82f6', xp: 75, cat: 'Dosing' },
  { id: 'dose_100', name: 'Century Club', desc: 'Log 100 total doses', icon: 'fa-award', color: '#f59e0b', xp: 150, cat: 'Dosing' },
  { id: 'dose_500', name: 'Veteran', desc: 'Log 500 total doses', icon: 'fa-medal', color: '#ef4444', xp: 500, cat: 'Dosing' },
  // Streak milestones
  { id: 'streak_3', name: 'Three-Peat', desc: '3-day dosing streak', icon: 'fa-fire', color: '#f97316', xp: 15, cat: 'Streaks' },
  { id: 'streak_7', name: 'Week Warrior', desc: '7-day dosing streak', icon: 'fa-fire', color: '#f97316', xp: 50, cat: 'Streaks' },
  { id: 'streak_14', name: 'Fortnight Force', desc: '14-day dosing streak', icon: 'fa-fire-flame-curved', color: '#f97316', xp: 100, cat: 'Streaks' },
  { id: 'streak_30', name: 'Monthly Machine', desc: '30-day dosing streak', icon: 'fa-fire-flame-curved', color: '#ef4444', xp: 300, cat: 'Streaks' },
  { id: 'streak_90', name: 'Iron Discipline', desc: '90-day dosing streak', icon: 'fa-crown', color: '#f59e0b', xp: 1000, cat: 'Streaks' },
  // Journal milestones
  { id: 'first_journal', name: 'Self-Aware', desc: 'Log your first journal entry', icon: 'fa-book-medical', color: '#8b5cf6', xp: 10, cat: 'Journal' },
  { id: 'journal_7', name: 'Week Check', desc: 'Log 7 journal entries', icon: 'fa-book-medical', color: '#8b5cf6', xp: 30, cat: 'Journal' },
  { id: 'journal_30', name: 'Mindful Month', desc: 'Log 30 journal entries', icon: 'fa-brain', color: '#8b5cf6', xp: 100, cat: 'Journal' },
  { id: 'journal_streak_7', name: 'Journal Devotee', desc: '7-day journal streak', icon: 'fa-pen-fancy', color: '#ec4899', xp: 75, cat: 'Journal' },
  // Knowledge & exploration
  { id: 'first_fav', name: 'Bookworm', desc: 'Favorite your first peptide', icon: 'fa-star', color: '#f59e0b', xp: 10, cat: 'Explorer' },
  { id: 'fav_5', name: 'Curator', desc: 'Favorite 5 peptides', icon: 'fa-star', color: '#f59e0b', xp: 25, cat: 'Explorer' },
  { id: 'builder_3', name: 'Stack Master', desc: 'Add 3 peptides to your stack', icon: 'fa-layer-group', color: '#6366f1', xp: 20, cat: 'Explorer' },
  { id: 'regimen_1', name: 'Planner', desc: 'Create your first regimen', icon: 'fa-calendar-alt', color: '#10b981', xp: 15, cat: 'Explorer' },
  { id: 'regimen_5', name: 'Master Planner', desc: 'Create 5 regimen entries', icon: 'fa-calendar-check', color: '#10b981', xp: 50, cat: 'Explorer' },
  // Bloodwork
  { id: 'first_blood', name: 'Lab Rat', desc: 'Log your first blood test', icon: 'fa-droplet', color: '#ef4444', xp: 20, cat: 'Health' },
  { id: 'blood_3', name: 'Data Driven', desc: 'Log 3 blood test panels', icon: 'fa-vials', color: '#ef4444', xp: 50, cat: 'Health' },
  // Multi-feature
  { id: 'all_rounder', name: 'All-Rounder', desc: 'Use dose tracker, journal, calendar & bloodwork', icon: 'fa-trophy', color: '#f59e0b', xp: 100, cat: 'Special' },
  { id: 'compliance_100', name: 'Perfect Week', desc: '100% compliance for 7 days', icon: 'fa-check-double', color: '#10b981', xp: 150, cat: 'Special' },
  { id: 'wellness_8', name: 'Thriving', desc: 'Average wellness ≥ 8/10 for a week', icon: 'fa-heart', color: '#ec4899', xp: 75, cat: 'Special' },
  { id: 'peptide_5', name: 'Diversified', desc: 'Log doses for 5 different peptides', icon: 'fa-flask', color: '#06b6d4', xp: 60, cat: 'Special' },
  // Community
  { id: 'first_share', name: 'Contributor', desc: 'Share your first community protocol', icon: 'fa-share-nodes', color: '#14b8a6', xp: 30, cat: 'Community' },
  { id: 'first_upvote', name: 'Helpful', desc: 'Upvote a community protocol', icon: 'fa-thumbs-up', color: '#14b8a6', xp: 10, cat: 'Community' },
];

function checkAndUnlockAchievements() {
  const achieved = getAchievements();
  const doseLog = getDoseLog();
  const journal = getJournal();
  const regimen = getRegimen();
  const favorites = getFavorites();
  const bloodwork = (function() { try { return JSON.parse(localStorage.getItem('peptideai_bloodwork') || '[]'); } catch { return []; } })();
  const stats = getProgressStats();
  const newlyUnlocked = [];

  function unlock(id) {
    if (!achieved[id]) {
      achieved[id] = { unlockedAt: new Date().toISOString() };
      newlyUnlocked.push(id);
    }
  }

  // Dose milestones
  if (doseLog.length >= 1) unlock('first_dose');
  if (doseLog.length >= 10) unlock('dose_10');
  if (doseLog.length >= 50) unlock('dose_50');
  if (doseLog.length >= 100) unlock('dose_100');
  if (doseLog.length >= 500) unlock('dose_500');

  // Streaks
  if (stats.doseStreak >= 3) unlock('streak_3');
  if (stats.doseStreak >= 7) unlock('streak_7');
  if (stats.doseStreak >= 14) unlock('streak_14');
  if (stats.doseStreak >= 30) unlock('streak_30');
  if (stats.doseStreak >= 90) unlock('streak_90');

  // Journal
  if (journal.length >= 1) unlock('first_journal');
  if (journal.length >= 7) unlock('journal_7');
  if (journal.length >= 30) unlock('journal_30');
  if (stats.journalStreak >= 7) unlock('journal_streak_7');

  // Explorer
  if (favorites.length >= 1) unlock('first_fav');
  if (favorites.length >= 5) unlock('fav_5');
  if (builderStack.length >= 3) unlock('builder_3');
  if (regimen.length >= 1) unlock('regimen_1');
  if (regimen.length >= 5) unlock('regimen_5');

  // Health
  if (bloodwork.length >= 1) unlock('first_blood');
  if (bloodwork.length >= 3) unlock('blood_3');

  // Special
  if (doseLog.length > 0 && journal.length > 0 && regimen.length > 0 && bloodwork.length > 0) unlock('all_rounder');
  if (stats.complianceRate >= 100) unlock('compliance_100');
  if (stats.avgWellness && parseFloat(stats.avgWellness) >= 8) unlock('wellness_8');
  if (stats.uniquePeptides >= 5) unlock('peptide_5');

  if (newlyUnlocked.length > 0) {
    saveAchievements(achieved);
    newlyUnlocked.forEach(id => {
      const def = ACHIEVEMENT_DEFS.find(a => a.id === id);
      if (def) showAchievementToast(def);
    });
  }
  return achieved;
}

function showAchievementToast(def) {
  const toast = document.createElement('div');
  toast.className = 'achievement-toast';
  toast.innerHTML = `
    <div class="ach-toast-icon" style="color:${def.color}"><i class="fas ${def.icon}"></i></div>
    <div class="ach-toast-body">
      <div class="ach-toast-title">Achievement Unlocked!</div>
      <div class="ach-toast-name">${def.name}</div>
      <div class="ach-toast-xp">+${def.xp} XP</div>
    </div>
  `;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 400); }, 3500);
}

function getXPAndLevel() {
  const achieved = getAchievements();
  let totalXP = 0;
  ACHIEVEMENT_DEFS.forEach(def => {
    if (achieved[def.id]) totalXP += def.xp;
  });
  // Level formula: level = floor(sqrt(xp / 25)) + 1
  const level = Math.floor(Math.sqrt(totalXP / 25)) + 1;
  const xpForCurrentLevel = Math.pow(level - 1, 2) * 25;
  const xpForNextLevel = Math.pow(level, 2) * 25;
  const xpInLevel = totalXP - xpForCurrentLevel;
  const xpNeeded = xpForNextLevel - xpForCurrentLevel;
  return { totalXP, level, xpInLevel, xpNeeded, progress: Math.min(100, Math.round((xpInLevel / xpNeeded) * 100)) };
}

const LEVEL_TITLES = ['Novice','Apprentice','Researcher','Scientist','Scholar','Expert','Master','Grand Master','Legend','Mythic'];
function getLevelTitle(level) { return LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)]; }

function renderAchievements(el) {
  const _achSaveBanner = !currentUser ? renderSaveBanner('Achievements', '#f59e0b') : '';
  const achieved = checkAndUnlockAchievements();
  const { totalXP, level, xpInLevel, xpNeeded, progress } = getXPAndLevel();
  const title = getLevelTitle(level);
  const unlockedCount = Object.keys(achieved).length;
  const totalCount = ACHIEVEMENT_DEFS.length;

  const categories = [...new Set(ACHIEVEMENT_DEFS.map(a => a.cat))];

  el.innerHTML = `
    <div class="ach-view">

      <!-- PAGE HERO -->
      <div class="page-hero page-hero-amber" style="margin-bottom:20px">
        <div class="page-hero-bg">
          <div class="ph-orb ph-orb1" style="background:radial-gradient(circle,rgba(245,158,11,.35),rgba(217,119,6,.1))"></div>
          <div class="ph-orb ph-orb2" style="background:radial-gradient(circle,rgba(251,191,36,.25),rgba(245,158,11,.1))"></div>
          <div class="ph-orb ph-orb3" style="background:radial-gradient(circle,rgba(252,211,77,.2),rgba(251,191,36,.1))"></div>
          <div class="ph-grid"></div>
        </div>
        <div class="page-hero-body">
          <div class="ph-icon" style="background:rgba(245,158,11,.2);border-color:rgba(245,158,11,.3);color:#fbbf24"><i class="fas fa-trophy"></i></div>
          <div class="ph-text">
            <h1 class="ph-title">Achievements</h1>
            <p class="ph-sub">Earn XP and unlock badges as you build your tracking routine. Level up your peptide research.</p>
          </div>
          <div class="ph-stats">
            <div class="ph-stat"><div class="ph-stat-n">${level}</div><div class="ph-stat-l">Level</div></div>
            <div class="ph-stat"><div class="ph-stat-n">${unlockedCount}/${totalCount}</div><div class="ph-stat-l">Badges</div></div>
            <div class="ph-stat"><div class="ph-stat-n">${totalXP}</div><div class="ph-stat-l">Total XP</div></div>
          </div>
        </div>
      </div>

      ${_achSaveBanner}

      <!-- Level Card -->
      <div class="ach-level-card">
        <div class="ach-level-badge">
          <div class="ach-level-num">${level}</div>
        </div>
        <div class="ach-level-info">
          <div class="ach-level-title">${title}</div>
          <div class="ach-level-xp">${totalXP.toLocaleString()} XP Total · ${unlockedCount}/${totalCount} Badges</div>
          <div class="ach-xp-bar">
            <div class="ach-xp-bar-fill" style="width:${progress}%"></div>
          </div>
          <div class="ach-xp-label">${xpInLevel} / ${xpNeeded} XP to Level ${level + 1}</div>
        </div>
      </div>

      <!-- Badge Grid by Category -->
      ${categories.map(cat => {
        const badges = ACHIEVEMENT_DEFS.filter(a => a.cat === cat);
        return `
          <div class="ach-category">
            <div class="ach-category-title">${cat}</div>
            <div class="ach-badge-grid">
              ${badges.map(def => {
                const unlocked = !!achieved[def.id];
                const unlockedAt = unlocked ? new Date(achieved[def.id].unlockedAt).toLocaleDateString() : '';
                return `
                  <div class="ach-badge ${unlocked ? 'ach-unlocked' : 'ach-locked'}" title="${def.desc}${unlocked ? ' - Unlocked ' + unlockedAt : ''}">
                    <div class="ach-badge-icon" style="color:${unlocked ? def.color : 'var(--text-muted)'}">
                      <i class="fas ${def.icon}"></i>
                    </div>
                    <div class="ach-badge-name">${def.name}</div>
                    <div class="ach-badge-desc">${def.desc}</div>
                    <div class="ach-badge-xp">${unlocked ? '✓ ' : ''}${def.xp} XP</div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// Hook into data mutations to check achievements
const _origSaveDoseLog = saveDoseLog;
saveDoseLog = function(log) { _origSaveDoseLog(log); setTimeout(checkAndUnlockAchievements, 500); };
const _origSaveJournal = saveJournal;
saveJournal = function(j) { _origSaveJournal(j); setTimeout(checkAndUnlockAchievements, 500); };
const _origSaveRegimen = saveRegimen;
saveRegimen = function(items) { _origSaveRegimen(items); setTimeout(checkAndUnlockAchievements, 500); };

// ============================================================
// FEATURE 22: COMMUNITY PROTOCOLS
// ============================================================
let communityFilter = 'popular';
let communityGoal = 'all';

async function fetchCommunityProtocols(sort = 'popular', goal = 'all') {
  try {
    const params = new URLSearchParams({ sort, goal });
    const res = await fetch('/api/community/protocols?' + params, { headers: authHeaders() });
    return await res.json();
  } catch { return []; }
}

async function submitCommunityProtocol(data) {
  try {
    const res = await fetch('/api/community/protocols', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (result.error) { alert(result.error); return false; }
    // Unlock achievement
    const ach = getAchievements();
    if (!ach.first_share) { ach.first_share = { unlockedAt: new Date().toISOString() }; saveAchievements(ach); showAchievementToast(ACHIEVEMENT_DEFS.find(a => a.id === 'first_share')); }
    return true;
  } catch { alert('Failed to submit. Please try again.'); return false; }
}

async function voteCommunityProtocol(id, type) {
  try {
    const res = await fetch(`/api/community/protocols/${id}/vote`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ type }),
    });
    const result = await res.json();
    if (result.error) { return; }
    // Unlock achievement
    if (type === 'up') {
      const ach = getAchievements();
      if (!ach.first_upvote) { ach.first_upvote = { unlockedAt: new Date().toISOString() }; saveAchievements(ach); showAchievementToast(ACHIEVEMENT_DEFS.find(a => a.id === 'first_upvote')); }
    }
    navigate('community');
  } catch {}
}

function openShareProtocolModal() {
  if (!currentUser) { openAuthModal('login'); return; }
  const regimen = getRegimen();
  const overlay = document.createElement('div');
  overlay.id = 'shareProtocolOverlay';
  overlay.className = 'auth-modal-overlay';
  overlay.innerHTML = `
    <div class="auth-modal" style="max-width:520px">
      <button class="auth-modal-close" onclick="document.getElementById('shareProtocolOverlay').remove()"><i class="fas fa-times"></i></button>
      <div class="auth-modal-title" style="font-size:18px"><i class="fas fa-share-nodes" style="color:#14b8a6;margin-right:8px"></i>Share Protocol</div>
      <div class="auth-modal-subtitle">Share your peptide protocol anonymously with the community.</div>
      <form onsubmit="event.preventDefault(); submitShareProtocol()">
        <label class="auth-label">Protocol Title *</label>
        <input id="cpTitle" class="auth-input" placeholder="e.g. Fat Loss Stack - 12 Week" required maxlength="100">

        <label class="auth-label">Goal / Category *</label>
        <select id="cpGoal" class="auth-input" required>
          <option value="">Select a goal...</option>
          <option value="fat_loss">Fat Loss</option>
          <option value="muscle_growth">Muscle Growth</option>
          <option value="recovery">Recovery & Healing</option>
          <option value="anti_aging">Anti-Aging</option>
          <option value="cognitive">Cognitive Enhancement</option>
          <option value="sleep">Sleep & Recovery</option>
          <option value="immune">Immune Support</option>
          <option value="general">General Wellness</option>
        </select>

        <label class="auth-label">Description *</label>
        <textarea id="cpDesc" class="auth-input" rows="3" placeholder="Describe your protocol, goals, and experience..." required maxlength="500"></textarea>

        <label class="auth-label">Peptides & Dosing *</label>
        <textarea id="cpPeptides" class="auth-input" rows="4" placeholder="List each peptide with dose, frequency, and duration. E.g.:\nBPC-157: 250mcg 2x/day subQ\nTB-500: 2mg 2x/week subQ" required maxlength="1000"></textarea>

        <label class="auth-label">Duration</label>
        <input id="cpDuration" class="auth-input" placeholder="e.g. 12 weeks, 8 weeks, ongoing..." maxlength="50">

        <label class="auth-label">Notes (optional)</label>
        <textarea id="cpNotes" class="auth-input" rows="2" placeholder="Side effects, tips, what you'd change..." maxlength="500"></textarea>

        ${regimen.length > 0 ? `
          <div style="padding:10px 14px;border-radius:10px;background:rgba(20,184,166,0.06);border:1px solid rgba(20,184,166,0.15);margin:12px 0;font-size:12px;color:var(--text-secondary)">
            <i class="fas fa-magic" style="color:#14b8a6;margin-right:4px"></i>
            <a href="#" onclick="event.preventDefault(); autoFillFromRegimen()" style="color:#14b8a6;text-decoration:underline">Auto-fill from your current regimen</a>
          </div>
        ` : ''}

        <button type="submit" class="auth-submit" id="cpSubmitBtn" style="background:linear-gradient(135deg,#14b8a6,#0d9488)">
          <i class="fas fa-share-nodes" style="margin-right:6px"></i>Share Anonymously
        </button>
      </form>
    </div>
  `;
  document.body.appendChild(overlay);
}

function autoFillFromRegimen() {
  const regimen = getRegimen();
  const lines = regimen.map(r => `${r.peptideName}: ${r.dose}${r.unit} ${r.frequency} ${r.route || ''}`).join('\n');
  document.getElementById('cpPeptides').value = lines;
}

async function submitShareProtocol() {
  const btn = document.getElementById('cpSubmitBtn');
  btn.disabled = true;
  btn.textContent = 'Sharing...';
  const data = {
    title: document.getElementById('cpTitle').value.trim(),
    goal: document.getElementById('cpGoal').value,
    description: document.getElementById('cpDesc').value.trim(),
    peptides: document.getElementById('cpPeptides').value.trim(),
    duration: document.getElementById('cpDuration').value.trim(),
    notes: document.getElementById('cpNotes').value.trim(),
  };
  const ok = await submitCommunityProtocol(data);
  if (ok) {
    document.getElementById('shareProtocolOverlay')?.remove();
    navigate('community');
  } else {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-share-nodes" style="margin-right:6px"></i>Share Anonymously';
  }
}

const GOAL_LABELS = { all:'All', fat_loss:'Fat Loss', muscle_growth:'Muscle Growth', recovery:'Recovery', anti_aging:'Anti-Aging', cognitive:'Cognitive', sleep:'Sleep', immune:'Immune', general:'General' };
const GOAL_ICONS = { fat_loss:'fa-fire', muscle_growth:'fa-dumbbell', recovery:'fa-heart-pulse', anti_aging:'fa-hourglass-half', cognitive:'fa-brain', sleep:'fa-moon', immune:'fa-shield-halved', general:'fa-leaf' };

async function renderCommunity(el) {
  // Delegate to Reddit-style community module
  if (window._communityRender) {
    window._communityRender();
    return;
  }
  // Fallback: simple loading message
  el.innerHTML = '<div style="text-align:center;padding:60px;color:var(--text-muted)"><i class="fas fa-spinner fa-spin"></i> Loading community...</div>';
}

function timeAgo(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  if (diff < 2592000) return Math.floor(diff / 86400) + 'd ago';
  return d.toLocaleDateString();
}

// ============================================================
// PRIVACY POLICY PAGE
// ============================================================
function renderPrivacyPolicy(el) {
  el.innerHTML = `
    <div class="kb-view disclaimer-page">
      <div class="kb-header">
        <div class="kb-title"><i class="fas fa-lock" style="color:var(--teal);margin-right:8px"></i>Privacy Policy</div>
        <div class="kb-subtitle">Last updated: March 2026. This policy explains how PeptideSafe collects, uses, and protects your data.</div>
      </div>

      <div class="legal-section">
        <div class="legal-badge legal-badge-blue"><i class="fas fa-layer-group"></i></div>
        <h2 class="legal-heading">Data Collection Tiers</h2>
        <p>PeptideSafe collects data in clearly defined tiers. Higher tiers require increasing levels of consent.</p>
      </div>

      <div class="legal-section">
        <div class="legal-badge legal-badge-teal"><i class="fas fa-chart-bar"></i></div>
        <h2 class="legal-heading">Tier 1: Anonymous Analytics (Consent Required)</h2>
        <p>When you accept analytics tracking, we collect the following <strong>anonymized</strong> data:</p>
        <ul class="legal-list">
          <li><strong>Page views & navigation patterns</strong> - which sections you visit and for how long</li>
          <li><strong>Search queries</strong> - what you search for (anonymized, used for market intelligence)</li>
          <li><strong>Feature usage</strong> - which tools you use (calculator, interaction checker, stack builder)</li>
          <li><strong>Device & browser type</strong> - desktop/mobile/tablet, Chrome/Safari/etc.</li>
          <li><strong>Country/region</strong> - derived from Cloudflare's network (no IP addresses stored)</li>
          <li><strong>Session duration</strong> - how long you use PeptideSafe per visit</li>
          <li><strong>Referrer</strong> - how you found PeptideSafe (e.g., Google, social media link)</li>
          <li><strong>Peptide view analytics</strong> - which peptides get the most attention and view duration</li>
        </ul>
        <p><strong>This data is never linked to your identity unless you also have an account (Tier 2).</strong></p>
      </div>

      <div class="legal-section">
        <div class="legal-badge legal-badge-purple"><i class="fas fa-user-tag"></i></div>
        <h2 class="legal-heading">Tier 2: Account Data (Disclosed in This Policy)</h2>
        <p>When you create an account, we additionally collect and store:</p>
        <ul class="legal-list">
          <li><strong>Email address & display name</strong> - for authentication and account identification</li>
          <li><strong>Saved/bookmarked peptides</strong> - your research interests</li>
          <li><strong>Personal notes & annotations</strong> - attached to peptides or protocols</li>
          <li><strong>Per-user search history</strong> - for personalized recommendations</li>
          <li><strong>Calculator inputs</strong> - dosing calculator usage patterns (anonymized)</li>
          <li><strong>Interaction checks & stack builds</strong> - what combinations you research</li>
          <li><strong>Synced data</strong> - favorites, dose logs, journal entries, regimen schedules, blood work records</li>
          <li><strong>Peptide ratings & reviews</strong> - your feedback on peptide compounds</li>
        </ul>
        <p>This data enables personalization, saved research, and cross-device sync.</p>
      </div>

      <div class="legal-section">
        <div class="legal-badge legal-badge-amber"><i class="fas fa-hand-point-up"></i></div>
        <h2 class="legal-heading">Tier 3: Optional Profile Data (Explicit Opt-In)</h2>
        <p>You may optionally provide additional profile information. This requires <strong>explicit opt-in</strong> and is never required:</p>
        <ul class="legal-list">
          <li><strong>Role</strong> - researcher, biohacker, athlete, clinician, student, etc.</li>
          <li><strong>Research purpose</strong> - personal, academic, clinical, commercial</li>
          <li><strong>Experience level</strong> - beginner, intermediate, advanced, expert</li>
          <li><strong>Age range</strong> - (e.g., 25-34, 35-44) - never exact age</li>
          <li><strong>Category interests</strong> - which peptide categories interest you most</li>
          <li><strong>Newsletter opt-in</strong> - receive peptide research updates</li>
          <li><strong>Data sharing opt-in</strong> - consent to anonymized data use in market reports</li>
        </ul>
        <p>This data helps us understand our user base and improve the platform.</p>
      </div>

      <div class="legal-section">
        <div class="legal-badge legal-badge-red"><i class="fas fa-ban"></i></div>
        <h2 class="legal-heading">What We NEVER Collect</h2>
        <ul class="legal-list">
          <li>Personal health conditions or medical diagnoses</li>
          <li>Specific dosages you are personally taking</li>
          <li>Adverse effects you experience</li>
          <li>Identifiable health outcomes</li>
          <li>Exact IP addresses (we use Cloudflare country headers only)</li>
          <li>Payment or financial information</li>
          <li>Device fingerprints or cross-site tracking identifiers</li>
        </ul>
      </div>

      <div class="legal-section">
        <div class="legal-badge legal-badge-blue"><i class="fas fa-chart-pie"></i></div>
        <h2 class="legal-heading">How We Use Your Data</h2>
        <ul class="legal-list">
          <li><strong>Platform improvement</strong> - understanding which features are most useful</li>
          <li><strong>Peptide trend intelligence</strong> - aggregate, anonymized search and view trends may be compiled into market intelligence reports</li>
          <li><strong>Personalization</strong> - saved research, recommendations, and cross-device sync</li>
          <li><strong>Community insights</strong> - aggregate role/purpose breakdowns help us serve our users better</li>
        </ul>
        <p>We do <strong>NOT</strong> sell individual user data. Anonymized, aggregate trend data may be used in industry reports.</p>
      </div>

      <div class="legal-section">
        <div class="legal-badge legal-badge-indigo"><i class="fas fa-chart-bar"></i></div>
        <h2 class="legal-heading">Anonymized Data &amp; Market Trend Reports</h2>
        <p>By creating an account or using PeptideSafe, you acknowledge that <strong>anonymized, aggregate data</strong> derived from platform usage may be compiled into market trend intelligence reports. Here's exactly what that means:</p>
        <div class="legal-highlight-box">
          <div class="legal-highlight-row"><i class="fas fa-check-circle" style="color:#059669"></i><span><strong>What IS included:</strong> aggregate search trends (e.g., "BPC-157 is the most searched peptide"), popular peptide stacks, feature usage patterns, and general interest categories - all stripped of any personally identifying information.</span></div>
          <div class="legal-highlight-row"><i class="fas fa-times-circle" style="color:#dc2626"></i><span><strong>What is NEVER included:</strong> your name, email, account ID, health outcomes, personal dose logs, journal entries, or any data that could identify you as an individual.</span></div>
        </div>
        <ul class="legal-list">
          <li><strong>Anonymization standard:</strong> Data is aggregated to groups of at least 100 users before inclusion in any report - individual contributions are mathematically indistinguishable</li>
          <li><strong>No re-identification:</strong> We take technical and organizational measures to prevent re-identification of individuals from trend data</li>
          <li><strong>Purpose:</strong> These reports help educate the broader health and wellness industry about peptide research trends, supporting safer mainstream adoption</li>
          <li><strong>Opt-out:</strong> You can opt out at any time in Account Settings → Profile → Data Sharing. Opting out prevents your data from being included in future reports</li>
          <li><strong>No third-party sale:</strong> Trend reports are published or distributed by PeptideSafe only - we never sell raw or identified data to any third party</li>
        </ul>
        <p>This practice is disclosed at sign-up and is consistent with GDPR's "legitimate interests" basis and CCPA's category disclosures for business analytics.</p>
      </div>

      <div class="legal-section">
        <div class="legal-badge legal-badge-teal"><i class="fas fa-server"></i></div>
        <h2 class="legal-heading">Data Storage & Security</h2>
        <ul class="legal-list">
          <li>All data is stored in <strong>Cloudflare D1</strong> (globally distributed SQLite) and <strong>Supabase</strong> (authentication)</li>
          <li>Encrypted in transit (TLS 1.3) and at rest</li>
          <li>Passwords are hashed by Supabase using bcrypt - we never see or store plaintext passwords</li>
          <li>Data is not shared with any third parties except as described under Third-Party Services</li>
        </ul>
      </div>

      <div class="legal-section">
        <div class="legal-badge legal-badge-purple"><i class="fas fa-user-shield"></i></div>
        <h2 class="legal-heading">Your Rights</h2>
        <ul class="legal-list">
          <li><strong>Access</strong> - view all your synced data through Account Settings</li>
          <li><strong>Export</strong> - your data is stored in localStorage and visible in Account Settings</li>
          <li><strong>Delete</strong> - delete your account at any time, permanently removing all cloud data</li>
          <li><strong>Withdraw consent</strong> - change analytics consent in the cookie banner or stop using an account</li>
          <li><strong>Opt out of Tier 3</strong> - optional profile fields can be cleared at any time</li>
          <li><strong>Clear search history</strong> - delete your per-user search history from Account Settings</li>
        </ul>
        <p>These rights apply under GDPR, CCPA, and similar privacy regulations worldwide.</p>
      </div>

      <div class="legal-section">
        <div class="legal-badge legal-badge-amber"><i class="fas fa-key"></i></div>
        <h2 class="legal-heading">Authentication & Third-Party Services</h2>
        <ul class="legal-list">
          <li><strong>Supabase</strong> - Authentication provider (<a href="https://supabase.com/privacy" target="_blank" rel="noopener" style="color:var(--teal)">Supabase Privacy Policy</a>)</li>
          <li><strong>YouTube</strong> - Video embeds when playing videos (<a href="https://policies.google.com/privacy" target="_blank" rel="noopener" style="color:var(--teal)">Google Privacy Policy</a>)</li>
          <li><strong>Europe PMC</strong> - Research article data (no personal data transmitted)</li>
          <li><strong>Google Fonts</strong> & <strong>Font Awesome</strong> - Typeface and icons loaded from CDNs</li>
        </ul>
      </div>

      <div class="legal-section legal-section-last">
        <div class="legal-badge legal-badge-gray"><i class="fas fa-envelope"></i></div>
        <h2 class="legal-heading">Contact & Changes</h2>
        <p>This privacy policy may be updated periodically. Material changes will be reflected by updating the "Last updated" date. Continued use after changes constitutes acceptance.</p>
        <p>For privacy questions, data deletion requests, or to exercise your rights, contact us at <strong>privacy@peptidesafe.org</strong></p>
        <div style="margin-top:20px;display:flex;gap:12px;flex-wrap:wrap">
          <button onclick="navigate('terms')" class="btn-outline-sm"><i class="fas fa-file-contract" style="margin-right:6px"></i>Terms of Service</button>
          <button onclick="navigate('disclaimer')" class="btn-outline-sm"><i class="fas fa-shield-halved" style="margin-right:6px"></i>Medical Disclaimer</button>
        </div>
      </div>
    </div>
  `;
}

// ============================================================
// TERMS OF SERVICE
// ============================================================
function renderTermsOfService(el) {
  el.innerHTML = `
    <div class="kb-view disclaimer-page">
      <div class="kb-header">
        <div class="kb-title"><i class="fas fa-file-contract" style="color:var(--teal);margin-right:8px"></i>Terms of Service</div>
        <div class="kb-subtitle">Last updated: March 2026. By using PeptideSafe, you agree to these terms.</div>
      </div>

      <div class="legal-section">
        <div class="legal-badge legal-badge-blue"><i class="fas fa-handshake"></i></div>
        <h2 class="legal-heading">1. Acceptance of Terms</h2>
        <p>By accessing or using PeptideSafe ("the Service"), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service.</p>
      </div>

      <div class="legal-section">
        <div class="legal-badge legal-badge-teal"><i class="fas fa-microscope"></i></div>
        <h2 class="legal-heading">2. Nature of the Service</h2>
        <p>PeptideSafe is a <strong>research and educational information platform</strong>. It provides:</p>
        <ul class="legal-list">
          <li>Peptide compound profiles, dosing reference data, and protocol templates</li>
          <li>Research tools including calculators, interaction checkers, and comparison views</li>
          <li>Community-submitted protocols and discussion</li>
          <li>Aggregated research article and video references</li>
        </ul>
        <p><strong>PeptideSafe does NOT provide medical advice, diagnosis, or treatment recommendations.</strong> All information is for educational and research purposes only.</p>
      </div>

      <div class="legal-section">
        <div class="legal-badge legal-badge-amber"><i class="fas fa-user-check"></i></div>
        <h2 class="legal-heading">3. User Accounts</h2>
        <ul class="legal-list">
          <li>Account creation is optional - the platform works fully without one</li>
          <li>You are responsible for maintaining the security of your account credentials</li>
          <li>You may delete your account and all associated data at any time</li>
          <li>We reserve the right to suspend accounts that violate these terms</li>
        </ul>
      </div>

      <div class="legal-section">
        <div class="legal-badge legal-badge-purple"><i class="fas fa-database"></i></div>
        <h2 class="legal-heading">4. Data Collection & Analytics</h2>
        <p>By using PeptideSafe with analytics consent enabled, you acknowledge that:</p>
        <ul class="legal-list">
          <li>Anonymous usage analytics are collected to improve the platform</li>
          <li>Aggregated, anonymized data (e.g., search trends, peptide popularity) may be used in market intelligence reports</li>
          <li>Individual user data is never sold to third parties</li>
          <li>You may withdraw analytics consent at any time</li>
        </ul>
        <p>See our <a href="#" onclick="event.preventDefault();navigate('privacy')" style="color:var(--teal)">Privacy Policy</a> for complete details.</p>
      </div>

      <div class="legal-section">
        <div class="legal-badge legal-badge-red"><i class="fas fa-exclamation-triangle"></i></div>
        <h2 class="legal-heading">5. Medical Disclaimer</h2>
        <p><strong>PeptideSafe is NOT a medical service.</strong> The information provided:</p>
        <ul class="legal-list">
          <li>Does not constitute medical advice, diagnosis, or treatment</li>
          <li>Should not replace consultation with qualified healthcare professionals</li>
          <li>Is compiled from published research and may not be complete or current</li>
          <li>Includes information about compounds that may not be FDA-approved</li>
        </ul>
        <p>You assume all responsibility for how you use the information provided. PeptideSafe and its operators are not liable for any health outcomes.</p>
      </div>

      <div class="legal-section">
        <div class="legal-badge legal-badge-blue"><i class="fas fa-users"></i></div>
        <h2 class="legal-heading">6. Community Content</h2>
        <ul class="legal-list">
          <li>Community-submitted protocols are user-generated and not verified by PeptideSafe</li>
          <li>Users are responsible for the content they submit</li>
          <li>We reserve the right to remove content that violates these terms</li>
          <li>Do not submit personally identifiable health information in community posts</li>
        </ul>
      </div>

      <div class="legal-section">
        <div class="legal-badge legal-badge-teal"><i class="fas fa-copyright"></i></div>
        <h2 class="legal-heading">7. Intellectual Property</h2>
        <p>PeptideSafe's interface, design, and curated content are proprietary. Peptide data is compiled from publicly available research sources. You may not scrape, copy, or redistribute our curated database for commercial purposes without permission.</p>
      </div>

      <div class="legal-section">
        <div class="legal-badge legal-badge-amber"><i class="fas fa-gavel"></i></div>
        <h2 class="legal-heading">8. Limitation of Liability</h2>
        <p>PeptideSafe is provided "as is" without warranties of any kind. We are not liable for any damages arising from use of the Service, including but not limited to health outcomes, data loss, or service interruptions.</p>
      </div>

      <div class="legal-section legal-section-last">
        <div class="legal-badge legal-badge-gray"><i class="fas fa-sync-alt"></i></div>
        <h2 class="legal-heading">9. Changes to Terms</h2>
        <p>We may update these terms at any time. Material changes will be communicated via the platform. Continued use after changes constitutes acceptance.</p>
        <div style="margin-top:20px;display:flex;gap:12px;flex-wrap:wrap">
          <button onclick="navigate('privacy')" class="btn-outline-sm"><i class="fas fa-lock" style="margin-right:6px"></i>Privacy Policy</button>
          <button onclick="navigate('disclaimer')" class="btn-outline-sm"><i class="fas fa-shield-halved" style="margin-right:6px"></i>Medical Disclaimer</button>
        </div>
      </div>
    </div>
  `;
}

// ============================================================
// PARTNER SIGNUP / APPLICATION PAGE
// ============================================================
function renderPartnerApply(el) {
  // Premium partner landing page
  el.innerHTML = `
  <style>
    .pp-page{max-width:1100px;margin:0 auto;padding:0 20px 80px;}
    .pp-hero{position:relative;text-align:center;padding:60px 20px 48px;overflow:hidden;}
    .pp-hero::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse at 50% 0%,rgba(37,99,235,0.12) 0%,transparent 70%);pointer-events:none;}
    .pp-hero-badge{display:inline-flex;align-items:center;gap:6px;padding:6px 16px;border-radius:100px;background:rgba(37,99,235,0.1);border:1px solid rgba(37,99,235,0.2);font-size:12px;font-weight:700;color:#2563eb;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:20px;}
    .pp-hero h1{font-size:clamp(32px,5vw,52px);font-weight:900;margin:0 0 16px;line-height:1.1;color:var(--text-primary);letter-spacing:-0.5px;}
    .pp-hero h1 span{background:linear-gradient(135deg,#2563eb,#7c3aed);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
    .pp-hero-sub{font-size:18px;color:var(--text-secondary);line-height:1.7;max-width:640px;margin:0 auto 32px;}
    .pp-hero-cta{display:inline-flex;align-items:center;gap:10px;padding:16px 40px;background:linear-gradient(135deg,#2563eb,#7c3aed);color:#fff;border:none;border-radius:14px;font-size:17px;font-weight:700;cursor:pointer;transition:all 0.3s;box-shadow:0 8px 32px rgba(37,99,235,0.3);}
    .pp-hero-cta:hover{transform:translateY(-2px);box-shadow:0 12px 40px rgba(37,99,235,0.4);}
    .pp-hero-stats{display:flex;justify-content:center;gap:48px;margin-top:40px;flex-wrap:wrap;}
    .pp-hero-stat{text-align:center;}
    .pp-hero-stat strong{display:block;font-size:28px;font-weight:800;color:var(--text-primary);}
    .pp-hero-stat span{font-size:13px;color:var(--text-secondary);}

    .pp-section{margin-top:64px;}
    .pp-section-label{display:inline-flex;align-items:center;gap:6px;padding:5px 14px;border-radius:100px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:12px;}
    .pp-section-title{font-size:clamp(24px,3.5vw,36px);font-weight:800;margin:0 0 8px;line-height:1.2;color:var(--text-primary);}
    .pp-section-desc{font-size:16px;color:var(--text-secondary);line-height:1.6;max-width:600px;}

    .pp-features{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:20px;margin-top:32px;}
    .pp-feat{position:relative;padding:28px;border-radius:16px;background:var(--bg-secondary);border:1px solid var(--border-primary);transition:all 0.3s;overflow:hidden;}
    .pp-feat:hover{border-color:rgba(37,99,235,0.3);transform:translateY(-4px);box-shadow:0 12px 40px rgba(0,0,0,0.08);}
    .pp-feat-icon{width:48px;height:48px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:20px;color:#fff;margin-bottom:16px;}
    .pp-feat h3{font-size:17px;font-weight:700;margin:0 0 6px;color:var(--text-primary);}
    .pp-feat p{font-size:14px;color:var(--text-secondary);margin:0;line-height:1.6;}
    .pp-feat-tag{position:absolute;top:16px;right:16px;padding:3px 10px;border-radius:100px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;}

    .pp-dashboard-preview{margin-top:40px;padding:3px;border-radius:20px;background:linear-gradient(135deg,rgba(37,99,235,0.3),rgba(124,58,237,0.3));overflow:hidden;}
    .pp-dashboard-inner{background:var(--bg-secondary);border-radius:18px;padding:32px;position:relative;overflow:hidden;}
    .pp-dashboard-inner::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,transparent 40%,var(--bg-secondary));pointer-events:none;}
    .pp-dash-header{display:flex;align-items:center;gap:12px;margin-bottom:24px;}
    .pp-dash-dots{display:flex;gap:6px;}
    .pp-dash-dots span{width:12px;height:12px;border-radius:50%;}
    .pp-dash-tabs{display:flex;gap:4px;padding:4px;background:var(--bg-primary);border-radius:10px;margin-bottom:20px;flex-wrap:wrap;}
    .pp-dash-tab{padding:7px 14px;border-radius:8px;font-size:12px;font-weight:600;color:var(--text-secondary);background:transparent;}
    .pp-dash-tab.active{background:linear-gradient(135deg,#2563eb,#7c3aed);color:#fff;}
    .pp-dash-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px;}
    .pp-dash-metric{padding:16px;border-radius:12px;background:var(--bg-primary);border:1px solid var(--border-primary);}
    .pp-dash-metric-val{font-size:24px;font-weight:800;color:var(--text-primary);}
    .pp-dash-metric-label{font-size:11px;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;margin-top:2px;}
    .pp-dash-metric-change{font-size:11px;font-weight:600;margin-top:4px;}
    .pp-dash-chart{height:120px;background:var(--bg-primary);border-radius:12px;border:1px solid var(--border-primary);position:relative;overflow:hidden;}
    .pp-dash-chart svg{width:100%;height:100%;}

    .pp-tools{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px;margin-top:32px;}
    .pp-tool{padding:24px 20px;border-radius:14px;background:var(--bg-secondary);border:1px solid var(--border-primary);text-align:center;transition:all 0.3s;}
    .pp-tool:hover{border-color:rgba(37,99,235,0.3);transform:translateY(-3px);}
    .pp-tool-icon{width:44px;height:44px;border-radius:12px;display:inline-flex;align-items:center;justify-content:center;font-size:18px;margin-bottom:12px;}
    .pp-tool h4{font-size:14px;font-weight:700;margin:0 0 4px;color:var(--text-primary);}
    .pp-tool p{font-size:12px;color:var(--text-secondary);margin:0;line-height:1.5;}

    .pp-tiers{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:20px;margin-top:32px;}
    .pp-tier{padding:32px 28px;border-radius:18px;background:var(--bg-secondary);border:1px solid var(--border-primary);position:relative;transition:all 0.3s;}
    .pp-tier.featured{border-color:#2563eb;box-shadow:0 8px 40px rgba(37,99,235,0.15);}
    .pp-tier.featured::before{content:'MOST POPULAR';position:absolute;top:-12px;left:50%;transform:translateX(-50%);padding:4px 16px;border-radius:100px;background:linear-gradient(135deg,#2563eb,#7c3aed);color:#fff;font-size:10px;font-weight:800;letter-spacing:0.5px;}
    .pp-tier-name{font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:var(--text-secondary);margin:0 0 4px;}
    .pp-tier-price{font-size:36px;font-weight:900;color:var(--text-primary);margin:0;}
    .pp-tier-price span{font-size:14px;font-weight:500;color:var(--text-secondary);}
    .pp-tier-desc{font-size:14px;color:var(--text-secondary);margin:8px 0 20px;line-height:1.5;}
    .pp-tier-list{list-style:none;padding:0;margin:0 0 24px;}
    .pp-tier-list li{padding:8px 0;font-size:13px;color:var(--text-primary);display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--border-primary);}
    .pp-tier-list li:last-child{border:none;}
    .pp-tier-list li i{color:#059669;font-size:12px;flex-shrink:0;}
    .pp-tier-btn{display:block;width:100%;padding:13px;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;text-align:center;transition:all 0.2s;border:none;}

    .pp-testimonials{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:20px;margin-top:32px;}
    .pp-test{padding:28px;border-radius:16px;background:var(--bg-secondary);border:1px solid var(--border-primary);}
    .pp-test-quote{font-size:15px;color:var(--text-primary);line-height:1.7;margin:0 0 16px;font-style:italic;}
    .pp-test-author{display:flex;align-items:center;gap:12px;}
    .pp-test-avatar{width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;color:#fff;}
    .pp-test-name{font-size:14px;font-weight:700;color:var(--text-primary);}
    .pp-test-role{font-size:12px;color:var(--text-secondary);}

    .pp-apply-section{margin-top:64px;position:relative;}
    .pp-apply-wrap{background:var(--bg-secondary);border:1px solid var(--border-primary);border-radius:20px;padding:40px;position:relative;overflow:hidden;}
    .pp-apply-wrap::before{content:'';position:absolute;top:0;left:0;right:0;height:4px;background:linear-gradient(90deg,#2563eb,#7c3aed,#059669);}
    .pp-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
    .pp-form-field label{display:block;font-size:13px;font-weight:600;margin-bottom:6px;color:var(--text-primary);}
    .pp-form-field label .req{color:#dc2626;}
    .pp-form-field input,.pp-form-field select,.pp-form-field textarea{width:100%;padding:11px 16px;border:1px solid var(--border-primary);border-radius:12px;font-size:14px;background:var(--bg-primary);color:var(--text-primary);box-sizing:border-box;transition:border-color 0.2s;font-family:inherit;}
    .pp-form-field input:focus,.pp-form-field select:focus,.pp-form-field textarea:focus{outline:none;border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,0.1);}
    .pp-form-full{grid-column:1/-1;}

    .pp-faq{margin-top:64px;}
    .pp-faq-item{border:1px solid var(--border-primary);border-radius:14px;background:var(--bg-secondary);margin-bottom:8px;overflow:hidden;transition:all 0.2s;}
    .pp-faq-item:hover{border-color:rgba(37,99,235,0.2);}
    .pp-faq-item summary{padding:18px 24px;font-weight:600;cursor:pointer;font-size:15px;color:var(--text-primary);list-style:none;display:flex;align-items:center;justify-content:space-between;}
    .pp-faq-item summary::-webkit-details-marker{display:none;}
    .pp-faq-item summary::after{content:'\\f078';font-family:'Font Awesome 6 Free';font-weight:900;font-size:12px;color:var(--text-secondary);transition:transform 0.3s;}
    .pp-faq-item[open] summary::after{transform:rotate(180deg);}
    .pp-faq-item p{padding:0 24px 18px;margin:0;font-size:14px;color:var(--text-secondary);line-height:1.7;}

    .pp-cta-final{margin-top:64px;text-align:center;padding:60px 32px;border-radius:24px;background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#312e81 100%);color:#fff;position:relative;overflow:hidden;}
    .pp-cta-final::before{content:'';position:absolute;inset:0;background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60'%3E%3Cpath d='M0 30h60M30 0v60' stroke='%23ffffff08' stroke-width='1'/%3E%3C/svg%3E");pointer-events:none;}
    .pp-cta-final h2{font-size:clamp(24px,4vw,38px);font-weight:800;margin:0 0 12px;position:relative;}
    .pp-cta-final p{font-size:16px;opacity:0.8;margin:0 auto 28px;max-width:500px;line-height:1.6;position:relative;}

    @media(max-width:640px){
      .pp-form-grid{grid-template-columns:1fr;}
      .pp-hero-stats{gap:24px;}
      .pp-dash-metrics{grid-template-columns:repeat(2,1fr);}
      .pp-apply-wrap{padding:24px 20px;}
    }
  </style>
  <div class="pp-page">

    <!-- HERO -->
    <div class="pp-hero">
      <div class="pp-hero-badge"><i class="fas fa-gem"></i> Partner Program</div>
      <h1>Grow Your Audience.<br><span>Partner With PeptideSafe.</span></h1>
      <p class="pp-hero-sub">Join our partner program to earn commissions on lab testing referrals and get access to a full-featured CRM dashboard, real-time analytics, customer management tools, and referral tracking.</p>
      <button class="pp-hero-cta" onclick="document.getElementById('pp-apply-form').scrollIntoView({behavior:'smooth'})">
        <i class="fas fa-rocket"></i> Apply to Partner Program
      </button>
      <div class="pp-hero-stats">
        <div class="pp-hero-stat"><strong>82+</strong><span>Peptide Profiles</span></div>
        <div class="pp-hero-stat"><strong>15+</strong><span>CRM Tools</span></div>
        <div class="pp-hero-stat"><strong>Real-time</strong><span>Analytics</span></div>
        <div class="pp-hero-stat"><strong>24-48h</strong><span>Approval Time</span></div>
      </div>
    </div>

    <!-- CORE FEATURES -->
    <div class="pp-section">
      <div class="pp-section-label" style="background:rgba(37,99,235,0.08);color:#2563eb;"><i class="fas fa-star"></i> Core Features</div>
      <h2 class="pp-section-title">Everything you need to succeed</h2>
      <p class="pp-section-desc">Our partner CRM goes far beyond simple referral links. Access professional tools to manage, engage, and grow your audience.</p>
      <div class="pp-features">
        <div class="pp-feat">
          <div class="pp-feat-icon" style="background:linear-gradient(135deg,#2563eb,#3b82f6);"><i class="fas fa-chart-line"></i></div>
          <h3>Analytics Dashboard</h3>
          <p>Real-time overview of clicks, signups, active users, and engagement metrics. See exactly how your referrals are performing with beautiful charts.</p>
        </div>
        <div class="pp-feat">
          <div class="pp-feat-icon" style="background:linear-gradient(135deg,#7c3aed,#a78bfa);"><i class="fas fa-users-gear"></i></div>
          <h3>Customer CRM</h3>
          <p>Full customer management with profiles, notes, tags, activity timelines, health scores, and auto-status tracking. Know exactly where each referral stands.</p>
        </div>
        <div class="pp-feat">
          <div class="pp-feat-icon" style="background:linear-gradient(135deg,#059669,#34d399);"><i class="fas fa-chart-bar"></i></div>
          <h3>Referral Tracking</h3>
          <p>See exactly how your referral links are performing with click tracking, signup attribution, and engagement metrics over time.</p>
          <span class="pp-feat-tag" style="background:rgba(5,150,105,0.1);color:#059669;">Analytics</span>
        </div>
        <div class="pp-feat">
          <div class="pp-feat-icon" style="background:linear-gradient(135deg,#d97706,#fbbf24);"><i class="fas fa-wand-magic-sparkles"></i></div>
          <h3>AI Recommendations</h3>
          <p>Smart peptide suggestions based on customer interests and browsing behavior. Send relevant recommendations to help keep your audience engaged.</p>
          <span class="pp-feat-tag" style="background:rgba(217,119,6,0.1);color:#d97706;">AI-Powered</span>
        </div>
        <div class="pp-feat">
          <div class="pp-feat-icon" style="background:linear-gradient(135deg,#dc2626,#f87171);"><i class="fas fa-filter"></i></div>
          <h3>Sales Pipeline</h3>
          <p>Visual deal pipeline with drag-and-drop stages: Lead, Qualified, Proposal, Negotiation, Won/Lost. Track deal values and expected close dates.</p>
          <span class="pp-feat-tag" style="background:rgba(220,38,38,0.1);color:#dc2626;">Pro</span>
        </div>
        <div class="pp-feat">
          <div class="pp-feat-icon" style="background:linear-gradient(135deg,#0891b2,#67e8f9);"><i class="fas fa-bullseye"></i></div>
          <h3>Smart Segments</h3>
          <p>Create custom customer segments based on status, engagement, tags, and more. Target the right audience with the right message at the right time.</p>
        </div>
      </div>
    </div>

    <!-- DASHBOARD PREVIEW -->
    <div class="pp-section">
      <div class="pp-section-label" style="background:rgba(124,58,237,0.08);color:#7c3aed;"><i class="fas fa-desktop"></i> Dashboard Preview</div>
      <h2 class="pp-section-title">Your command center</h2>
      <p class="pp-section-desc">A powerful, intuitive dashboard that puts all your partner tools in one place.</p>
      <div class="pp-dashboard-preview">
        <div class="pp-dashboard-inner">
          <div class="pp-dash-header">
            <div class="pp-dash-dots">
              <span style="background:#ef4444;"></span>
              <span style="background:#f59e0b;"></span>
              <span style="background:#22c55e;"></span>
            </div>
            <span style="font-size:13px;color:var(--text-secondary);margin-left:12px;">Partner CRM Dashboard</span>
          </div>
          <div class="pp-dash-tabs">
            <div class="pp-dash-tab active">Overview</div>
            <div class="pp-dash-tab">Customers</div>
            <div class="pp-dash-tab">Pipeline</div>
            <div class="pp-dash-tab">Tasks</div>
            <div class="pp-dash-tab">Activity</div>
            <div class="pp-dash-tab">Segments</div>
            <div class="pp-dash-tab">Messages</div>
            <div class="pp-dash-tab">Goals</div>
            <div class="pp-dash-tab">Insights</div>
          </div>
          <div class="pp-dash-metrics">
            <div class="pp-dash-metric">
              <div class="pp-dash-metric-val">--</div>
              <div class="pp-dash-metric-label">Total Clicks</div>
              <div class="pp-dash-metric-change" style="color:var(--text-secondary);">Updated in real-time</div>
            </div>
            <div class="pp-dash-metric">
              <div class="pp-dash-metric-val">--</div>
              <div class="pp-dash-metric-label">Active Referrals</div>
              <div class="pp-dash-metric-change" style="color:var(--text-secondary);">Track your audience</div>
            </div>
            <div class="pp-dash-metric">
              <div class="pp-dash-metric-val">--</div>
              <div class="pp-dash-metric-label">Signups</div>
              <div class="pp-dash-metric-change" style="color:var(--text-secondary);">From your links</div>
            </div>
            <div class="pp-dash-metric">
              <div class="pp-dash-metric-val">--</div>
              <div class="pp-dash-metric-label">Engagement Score</div>
              <div class="pp-dash-metric-change" style="color:var(--text-secondary);">Per-customer metric</div>
            </div>
          </div>
          <div class="pp-dash-chart">
            <svg viewBox="0 0 600 120" preserveAspectRatio="none">
              <defs>
                <linearGradient id="ppChartGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" style="stop-color:#2563eb;stop-opacity:0.3"/>
                  <stop offset="100%" style="stop-color:#2563eb;stop-opacity:0.02"/>
                </linearGradient>
              </defs>
              <path d="M0,100 Q50,90 100,80 T200,60 T300,45 T400,50 T500,30 T600,20 L600,120 L0,120 Z" fill="url(#ppChartGrad)"/>
              <path d="M0,100 Q50,90 100,80 T200,60 T300,45 T400,50 T500,30 T600,20" fill="none" stroke="#2563eb" stroke-width="2.5"/>
              <circle cx="600" cy="20" r="4" fill="#2563eb"/>
            </svg>
          </div>
        </div>
      </div>
    </div>

    <!-- ALL TOOLS -->
    <div class="pp-section">
      <div class="pp-section-label" style="background:rgba(5,150,105,0.08);color:#059669;"><i class="fas fa-toolbox"></i> Complete Toolkit</div>
      <h2 class="pp-section-title">15+ professional tools included</h2>
      <p class="pp-section-desc">Every tool you need to manage, grow, and optimize your partner business.</p>
      <div class="pp-tools">
        <div class="pp-tool">
          <div class="pp-tool-icon" style="background:rgba(37,99,235,0.1);color:#2563eb;"><i class="fas fa-chart-pie"></i></div>
          <h4>Overview Analytics</h4>
          <p>Clicks, signups, conversions at a glance</p>
        </div>
        <div class="pp-tool">
          <div class="pp-tool-icon" style="background:rgba(124,58,237,0.1);color:#7c3aed;"><i class="fas fa-address-book"></i></div>
          <h4>Customer Management</h4>
          <p>Full profiles with notes, tags & history</p>
        </div>
        <div class="pp-tool">
          <div class="pp-tool-icon" style="background:rgba(220,38,38,0.1);color:#dc2626;"><i class="fas fa-filter"></i></div>
          <h4>Sales Pipeline</h4>
          <p>Visual deal tracking from lead to won</p>
        </div>
        <div class="pp-tool">
          <div class="pp-tool-icon" style="background:rgba(217,119,6,0.1);color:#d97706;"><i class="fas fa-list-check"></i></div>
          <h4>Task Manager</h4>
          <p>Follow-ups, reminders & to-do lists</p>
        </div>
        <div class="pp-tool">
          <div class="pp-tool-icon" style="background:rgba(5,150,105,0.1);color:#059669;"><i class="fas fa-chart-simple"></i></div>
          <h4>Referral Analytics</h4>
          <p>Clicks, signups & engagement over time</p>
        </div>
        <div class="pp-tool">
          <div class="pp-tool-icon" style="background:rgba(8,145,178,0.1);color:#0891b2;"><i class="fas fa-bullseye"></i></div>
          <h4>Custom Segments</h4>
          <p>Dynamic audience grouping & targeting</p>
        </div>
        <div class="pp-tool">
          <div class="pp-tool-icon" style="background:rgba(236,72,153,0.1);color:#ec4899;"><i class="fas fa-wand-magic-sparkles"></i></div>
          <h4>AI Recommendations</h4>
          <p>Smart peptide suggestions per customer</p>
        </div>
        <div class="pp-tool">
          <div class="pp-tool-icon" style="background:rgba(99,102,241,0.1);color:#6366f1;"><i class="fas fa-envelope"></i></div>
          <h4>Messaging System</h4>
          <p>Direct messaging & broadcast campaigns</p>
        </div>
        <div class="pp-tool">
          <div class="pp-tool-icon" style="background:rgba(245,158,11,0.1);color:#f59e0b;"><i class="fas fa-trophy"></i></div>
          <h4>Goals & KPIs</h4>
          <p>Set targets and track your progress</p>
        </div>
        <div class="pp-tool">
          <div class="pp-tool-icon" style="background:rgba(16,185,129,0.1);color:#10b981;"><i class="fas fa-chart-bar"></i></div>
          <h4>Cohort Analysis</h4>
          <p>Retention trends and period comparisons</p>
        </div>
        <div class="pp-tool">
          <div class="pp-tool-icon" style="background:rgba(139,92,246,0.1);color:#8b5cf6;"><i class="fas fa-link"></i></div>
          <h4>Tracking Links</h4>
          <p>Unique codes & shareable referral URLs</p>
        </div>
        <div class="pp-tool">
          <div class="pp-tool-icon" style="background:rgba(244,63,94,0.1);color:#f43f5e;"><i class="fas fa-file-csv"></i></div>
          <h4>CSV Export</h4>
          <p>Export customers & activity data</p>
        </div>
        <div class="pp-tool">
          <div class="pp-tool-icon" style="background:rgba(59,130,246,0.1);color:#3b82f6;"><i class="fas fa-timeline"></i></div>
          <h4>Activity Timeline</h4>
          <p>Full lifecycle history per customer</p>
        </div>
        <div class="pp-tool">
          <div class="pp-tool-icon" style="background:rgba(168,85,247,0.1);color:#a855f7;"><i class="fas fa-bell"></i></div>
          <h4>Notifications</h4>
          <p>Real-time alerts for key events</p>
        </div>
        <div class="pp-tool">
          <div class="pp-tool-icon" style="background:rgba(34,197,94,0.1);color:#22c55e;"><i class="fas fa-plug"></i></div>
          <h4>Webhooks</h4>
          <p>Connect to external tools & automations</p>
        </div>
      </div>
    </div>

    <!-- EARN COMMISSIONS -->
    <div class="pp-section">
      <div class="pp-section-label" style="background:rgba(5,150,105,0.08);color:#059669;"><i class="fas fa-dollar-sign"></i> Earn Commissions</div>
      <h2 class="pp-section-title">Get paid for testing referrals</h2>
      <p class="pp-section-desc">Earn commissions when your referrals order lab testing services. Blood work, peptide purity testing, and more. Commission rates will be announced once lab partnerships are finalized.</p>
      <div class="pp-features" style="margin-top:24px;">
        <div class="pp-feat">
          <div class="pp-feat-icon" style="background:linear-gradient(135deg,#2563eb,#3b82f6);"><i class="fas fa-vial"></i></div>
          <h3>Blood Work Panels</h3>
          <p>Earn per completed blood panel order, including basic, comprehensive, hormone, and metabolic panels.</p>
        </div>
        <div class="pp-feat">
          <div class="pp-feat-icon" style="background:linear-gradient(135deg,#7c3aed,#a78bfa);"><i class="fas fa-microscope"></i></div>
          <h3>Peptide Purity Testing</h3>
          <p>Earn on every purity or compound analysis test ordered through your referral link.</p>
        </div>
        <div class="pp-feat">
          <div class="pp-feat-icon" style="background:linear-gradient(135deg,#d97706,#fbbf24);"><i class="fas fa-rotate"></i></div>
          <h3>Recurring Subscriptions</h3>
          <p>Earn recurring commissions when referrals subscribe to monthly or quarterly lab testing plans.</p>
        </div>
      </div>
      <div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:24px;">
        <div style="flex:1;min-width:250px;padding:20px 24px;border-radius:14px;background:var(--bg-secondary);border:1px solid var(--border-primary);">
          <div style="font-size:13px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">How it works</div>
          <p style="font-size:14px;color:var(--text-primary);margin:0;line-height:1.7;">Your audience discovers peptide research on PeptideSafe, then uses your referral link to order lab tests (blood work or purity testing) from our vetted partner labs. You earn a commission on every completed order.</p>
        </div>
        <div style="flex:1;min-width:250px;padding:20px 24px;border-radius:14px;background:var(--bg-secondary);border:1px solid var(--border-primary);">
          <div style="font-size:13px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Payouts</div>
          <p style="font-size:14px;color:var(--text-primary);margin:0;line-height:1.7;">Commissions are tracked in your CRM dashboard in real time. Payout details and thresholds will be shared in your partner agreement upon approval.</p>
        </div>
      </div>
      <p style="font-size:12px;color:var(--text-secondary);margin-top:16px;line-height:1.6;">Commission rates and payout terms are currently being finalized and will be confirmed in your partner agreement upon approval. Testing services are provided by independent, CLIA-certified laboratories and third-party analytical testing providers.</p>
    </div>

    <!-- PARTNER TIERS -->
    <div class="pp-section">
      <div class="pp-section-label" style="background:rgba(245,158,11,0.08);color:#f59e0b;"><i class="fas fa-crown"></i> Partner Tiers</div>
      <h2 class="pp-section-title">Choose your path</h2>
      <p class="pp-section-desc">Start free and scale as your audience grows. Every tier includes the full CRM and commission earning.</p>
      <div class="pp-tiers">
        <div class="pp-tier">
          <div class="pp-tier-name">Starter</div>
          <div class="pp-tier-price">Free <span>to start</span></div>
          <p class="pp-tier-desc">Get started at no cost. Full CRM access and commissions included.</p>
          <ul class="pp-tier-list">
            <li><i class="fas fa-check"></i> Full CRM dashboard access</li>
            <li><i class="fas fa-check"></i> 1 partner tracking code</li>
            <li><i class="fas fa-check"></i> <strong>Lab testing commissions</strong></li>
            <li><i class="fas fa-check"></i> Customer management</li>
            <li><i class="fas fa-check"></i> Basic analytics</li>
            <li><i class="fas fa-check"></i> Email support</li>
          </ul>
          <button class="pp-tier-btn" style="background:var(--bg-primary);color:var(--text-primary);border:1px solid var(--border-primary);" onclick="document.getElementById('pp-apply-form').scrollIntoView({behavior:'smooth'})">Get Started Free</button>
        </div>
        <div class="pp-tier featured">
          <div class="pp-tier-name" style="color:#2563eb;">Growth</div>
          <div class="pp-tier-price">Free <span>full access</span></div>
          <p class="pp-tier-desc">For active partners looking to scale. Higher commission rates and advanced tools.</p>
          <ul class="pp-tier-list">
            <li><i class="fas fa-check"></i> Everything in Starter</li>
            <li><i class="fas fa-check"></i> <strong>Higher commission rates</strong></li>
            <li><i class="fas fa-check"></i> Multiple tracking codes</li>
            <li><i class="fas fa-check"></i> Sales pipeline & deals</li>
            <li><i class="fas fa-check"></i> Task management system</li>
            <li><i class="fas fa-check"></i> Custom segments & broadcasts</li>
            <li><i class="fas fa-check"></i> AI recommendations</li>
            <li><i class="fas fa-check"></i> Cohort analysis & insights</li>
            <li><i class="fas fa-check"></i> Priority support</li>
          </ul>
          <button class="pp-tier-btn" style="background:linear-gradient(135deg,#2563eb,#7c3aed);color:#fff;" onclick="document.getElementById('pp-apply-form').scrollIntoView({behavior:'smooth'})">Apply for Growth</button>
        </div>
        <div class="pp-tier">
          <div class="pp-tier-name">Enterprise</div>
          <div class="pp-tier-price">Custom</div>
          <p class="pp-tier-desc">For clinics, practices, and high-volume partners. Custom commission rates and dedicated support.</p>
          <ul class="pp-tier-list">
            <li><i class="fas fa-check"></i> Everything in Growth</li>
            <li><i class="fas fa-check"></i> <strong>Custom commission rates</strong></li>
            <li><i class="fas fa-check"></i> Custom partnership terms</li>
            <li><i class="fas fa-check"></i> Webhook integrations</li>
            <li><i class="fas fa-check"></i> CSV data exports</li>
            <li><i class="fas fa-check"></i> White-label options</li>
            <li><i class="fas fa-check"></i> Dedicated account manager</li>
            <li><i class="fas fa-check"></i> API access</li>
          </ul>
          <button class="pp-tier-btn" style="background:var(--bg-primary);color:var(--text-primary);border:1px solid var(--border-primary);" onclick="document.getElementById('pp-apply-form').scrollIntoView({behavior:'smooth'})">Contact Us</button>
        </div>
      </div>
    </div>

    <!-- IDEAL FOR -->
    <div class="pp-section">
      <div class="pp-section-label" style="background:rgba(236,72,153,0.08);color:#ec4899;"><i class="fas fa-heart"></i> Who It's For</div>
      <h2 class="pp-section-title">Built for creators & professionals</h2>
      <div class="pp-testimonials">
        <div class="pp-test">
          <div class="pp-test-quote" style="font-style:normal;"><strong>Content Creators</strong>: Use the CRM dashboard to understand your audience's peptide interests, send relevant recommendations, and track referral engagement across your channels.</div>
          <div class="pp-test-author">
            <div class="pp-test-avatar" style="background:linear-gradient(135deg,#2563eb,#3b82f6);"><i class="fas fa-video" style="font-size:16px;"></i></div>
            <div><div class="pp-test-name">YouTube, TikTok, Instagram</div><div class="pp-test-role">Health, Fitness & Biohacking creators</div></div>
          </div>
        </div>
        <div class="pp-test">
          <div class="pp-test-quote" style="font-style:normal;"><strong>Health Professionals</strong>: Use the pipeline and task management tools to organize client interest in peptide research. Track interactions and manage follow-ups from one dashboard.</div>
          <div class="pp-test-author">
            <div class="pp-test-avatar" style="background:linear-gradient(135deg,#059669,#34d399);"><i class="fas fa-stethoscope" style="font-size:16px;"></i></div>
            <div><div class="pp-test-name">Clinics & Practices</div><div class="pp-test-role">Integrative & functional medicine</div></div>
          </div>
        </div>
        <div class="pp-test">
          <div class="pp-test-quote" style="font-style:normal;"><strong>Newsletter & Blog Publishers</strong>: Use broadcast messaging and smart segments to share relevant peptide content with different subscriber groups based on their interests.</div>
          <div class="pp-test-author">
            <div class="pp-test-avatar" style="background:linear-gradient(135deg,#7c3aed,#a78bfa);"><i class="fas fa-newspaper" style="font-size:16px;"></i></div>
            <div><div class="pp-test-name">Newsletters & Blogs</div><div class="pp-test-role">Health, longevity & science writers</div></div>
          </div>
        </div>
      </div>
    </div>

    <!-- APPLICATION FORM -->
    <div class="pp-apply-section" id="pp-apply-form">
      <div style="text-align:center;margin-bottom:32px;">
        <div class="pp-section-label" style="background:rgba(37,99,235,0.08);color:#2563eb;display:inline-flex;"><i class="fas fa-pen-to-square"></i> Apply Now</div>
        <h2 class="pp-section-title">Ready to partner with us?</h2>
        <p class="pp-section-desc" style="margin:8px auto 0;">Fill out the form below and we'll review your application within 24-48 hours.</p>
      </div>
      <div class="pp-apply-wrap">
        <div id="affApplyError" style="display:none;padding:14px 18px;border-radius:12px;background:#fef2f2;border:1px solid #fecaca;color:#dc2626;font-size:14px;margin-bottom:20px;"></div>
        <div id="affApplySuccess" style="display:none;padding:28px;border-radius:14px;background:#ecfdf5;border:1px solid #a7f3d0;color:#059669;font-size:16px;margin-bottom:20px;text-align:center;"></div>
        <form id="affApplyForm" onsubmit="submitPartnerApplication(event)">
          <div class="pp-form-grid">
            <div class="pp-form-field">
              <label>Full Name <span class="req">*</span></label>
              <input id="affAppName" type="text" required placeholder="Your name">
            </div>
            <div class="pp-form-field">
              <label>Email <span class="req">*</span></label>
              <input id="affAppEmail" type="email" required placeholder="you@example.com">
            </div>
            <div class="pp-form-field">
              <label>Primary Platform <span class="req">*</span></label>
              <select id="affAppPlatform" required>
                <option value="">Select platform...</option>
                <option value="youtube">YouTube</option>
                <option value="instagram">Instagram</option>
                <option value="tiktok">TikTok</option>
                <option value="twitter">Twitter / X</option>
                <option value="blog">Blog / Website</option>
                <option value="podcast">Podcast</option>
                <option value="newsletter">Newsletter</option>
                <option value="clinic">Clinic / Practice</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div class="pp-form-field">
              <label>Platform URL</label>
              <input id="affAppPlatformUrl" type="url" placeholder="https://youtube.com/@yourchannel">
            </div>
            <div class="pp-form-field">
              <label>Audience Size</label>
              <select id="affAppAudience">
                <option value="">Select range...</option>
                <option value="0-1k">Less than 1,000</option>
                <option value="1k-10k">1,000 - 10,000</option>
                <option value="10k-50k">10,000 - 50,000</option>
                <option value="50k-100k">50,000 - 100,000</option>
                <option value="100k-500k">100,000 - 500,000</option>
                <option value="500k+">500,000+</option>
              </select>
            </div>
            <div class="pp-form-field">
              <label>Content Niche</label>
              <select id="affAppNiche">
                <option value="">Select niche...</option>
                <option value="peptides">Peptides</option>
                <option value="biohacking">Biohacking</option>
                <option value="fitness">Fitness & Bodybuilding</option>
                <option value="health">Health & Wellness</option>
                <option value="longevity">Longevity & Anti-Aging</option>
                <option value="medical">Medical / Clinical</option>
                <option value="nutrition">Nutrition & Supplements</option>
                <option value="science">Science Education</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div class="pp-form-field pp-form-full">
              <label>Why do you want to join? <span class="req">*</span></label>
              <textarea id="affAppReason" required placeholder="Tell us about your audience, how you'd promote PeptideSafe, and why you're interested in peptide research..." rows="4"></textarea>
            </div>
            <div class="pp-form-field pp-form-full">
              <label>Preferred Partner Code</label>
              <input id="affAppCode" type="text" placeholder="e.g. YOURNAME-VIP (optional, we'll assign one if blank)" maxlength="30" style="text-transform:uppercase;">
              <p style="font-size:12px;color:var(--text-secondary);margin:6px 0 0;">Letters, numbers, and hyphens only. This will appear in your referral URLs.</p>
            </div>
          </div>
          <button type="submit" id="affApplyBtn" class="pp-hero-cta" style="width:100%;justify-content:center;margin-top:24px;border-radius:14px;font-size:16px;">
            <i class="fas fa-paper-plane"></i>
            <span id="affApplyBtnText">Submit Application</span>
          </button>
        </form>
      </div>

      <!-- Check Status -->
      <div style="margin-top:20px;padding:24px;background:var(--bg-secondary);border:1px solid var(--border-primary);border-radius:16px;">
        <h3 style="font-size:15px;font-weight:700;margin:0 0 10px;"><i class="fas fa-clock" style="color:#d97706;margin-right:6px;"></i>Already applied?</h3>
        <div style="display:flex;gap:8px;align-items:center;">
          <input id="affStatusEmail" type="email" placeholder="Enter your email to check status..." style="flex:1;padding:11px 16px;border:1px solid var(--border-primary);border-radius:12px;font-size:14px;background:var(--bg-primary);color:var(--text-primary);">
          <button onclick="checkPartnerStatus()" style="padding:11px 24px;background:#2563eb;color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:600;cursor:pointer;white-space:nowrap;transition:background 0.2s;">Check Status</button>
        </div>
        <div id="affStatusResult" style="margin-top:10px;font-size:14px;"></div>
      </div>
    </div>

    <!-- FAQ -->
    <div class="pp-faq">
      <div style="text-align:center;margin-bottom:32px;">
        <div class="pp-section-label" style="background:rgba(99,102,241,0.08);color:#6366f1;display:inline-flex;"><i class="fas fa-circle-question"></i> FAQ</div>
        <h2 class="pp-section-title">Frequently asked questions</h2>
      </div>
      <details class="pp-faq-item">
        <summary>Who can become a partner?</summary>
        <p>Content creators, health professionals, coaches, clinic owners, researchers, and others with an audience interested in peptide research. All applications are reviewed and acceptance is not guaranteed.</p>
      </details>
      <details class="pp-faq-item">
        <summary>What tools do I get as a partner?</summary>
        <p>A full CRM dashboard with customer management, sales pipeline, task manager, AI recommendations, referral analytics, custom segments, broadcast messaging, goals & KPIs, cohort analysis, webhooks, CSV exports, activity timelines, and more. 15+ professional tools in total.</p>
      </details>
      <details class="pp-faq-item">
        <summary>Do partners earn commissions?</summary>
        <p>Yes. Partners earn commissions on lab testing referrals, including blood work panels and peptide purity testing ordered through their referral links. PeptideSafe does not sell peptides or any consumable products directly. All testing services are provided by independent, CLIA-certified laboratories and third-party analytical testing providers. Specific commission rates are currently being finalized and will be detailed in your partner agreement upon approval.</p>
      </details>
      <details class="pp-faq-item">
        <summary>How do payouts work?</summary>
        <p>Commissions are tracked in real time in your CRM dashboard. Payout schedule, minimum thresholds, and payment methods will be detailed in your partner agreement upon approval.</p>
      </details>
      <details class="pp-faq-item">
        <summary>What testing services can I refer?</summary>
        <p>Partners can refer their audience to blood work panels (basic and comprehensive), peptide purity and compound testing, and recurring lab subscriptions. All testing is performed by vetted, independent laboratories. You can track which services your referrals order and your earned commissions directly in the partner dashboard.</p>
      </details>
      <details class="pp-faq-item">
        <summary>How long does approval take?</summary>
        <p>Most applications are reviewed within 24-48 hours. You'll be notified by email once your application is approved and can immediately access the CRM dashboard.</p>
      </details>
      <details class="pp-faq-item">
        <summary>How do I access the CRM after approval?</summary>
        <p>Sign in with the same email you applied with (Google or email/password), then navigate to the Admin Dashboard. Your partner CRM with all tools will load automatically based on your role.</p>
      </details>
      <details class="pp-faq-item">
        <summary>Can I use the CRM on mobile?</summary>
        <p>Yes! The entire partner CRM is fully responsive and works on phones, tablets, and desktops. Manage your customers and track your referrals from anywhere.</p>
      </details>
      <details class="pp-faq-item">
        <summary>Is there a cost to join?</summary>
        <p>The Starter tier is completely free with no upfront costs and no monthly fees. You get full CRM access and commission earning from day one. Growth and Enterprise tiers unlock higher commission rates and additional features as your audience grows.</p>
      </details>
    </div>

    <!-- FINAL CTA -->
    <div class="pp-cta-final">
      <h2>Ready to share peptide research<br>with your audience?</h2>
      <p>Earn commissions on lab testing referrals and get access to our professional CRM tools.</p>
      <button class="pp-hero-cta" onclick="document.getElementById('pp-apply-form').scrollIntoView({behavior:'smooth'})" style="background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.3);backdrop-filter:blur(10px);">
        <i class="fas fa-rocket"></i> Apply Now - Free to Start
      </button>
    </div>

    <!-- LEGAL DISCLAIMER -->
    <div style="margin-top:32px;padding:20px 24px;border-radius:14px;background:var(--bg-secondary);border:1px solid var(--border-primary);font-size:12px;color:var(--text-secondary);line-height:1.7;">
      <strong style="color:var(--text-primary);">Disclaimer:</strong> PeptideSafe is a research information platform. Nothing on this site constitutes medical advice, diagnosis, or treatment. PeptideSafe does not sell peptides or any consumable products. Partner commissions are earned on qualifying lab testing referrals (blood work and peptide purity testing) provided by independent, CLIA-certified laboratories and third-party analytical testing providers. Commission rates and payout terms are currently being finalized and will be confirmed in your partner agreement upon approval. Commissions are not guaranteed and depend on completed, qualifying orders placed through your referral links. Program terms, commission rates, and available features may change at any time with notice. The dashboard preview shown above is for illustrative purposes only. All partner relationships are subject to the terms outlined in the partner agreement provided upon approval. PeptideSafe reserves the right to approve or reject applications and to modify or discontinue the commission program at its discretion. Material connections between PeptideSafe and its partners are disclosed in accordance with FTC guidelines.
    </div>

  </div>`;
}

async function submitPartnerApplication(e) {
  e.preventDefault();
  const btn = document.getElementById('affApplyBtn');
  const btnText = document.getElementById('affApplyBtnText');
  const errEl = document.getElementById('affApplyError');
  const successEl = document.getElementById('affApplySuccess');

  errEl.style.display = 'none';
  successEl.style.display = 'none';
  btn.disabled = true;
  btnText.textContent = 'Submitting...';

  try {
    const body = {
      name: document.getElementById('affAppName').value.trim(),
      email: document.getElementById('affAppEmail').value.trim(),
      platform: document.getElementById('affAppPlatform').value,
      platformUrl: document.getElementById('affAppPlatformUrl').value.trim(),
      audienceSize: document.getElementById('affAppAudience').value,
      niche: document.getElementById('affAppNiche').value,
      reason: document.getElementById('affAppReason').value.trim(),
      preferredCode: document.getElementById('affAppCode').value.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '') || null
    };

    const res = await fetch('/api/partner/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();

    if (!res.ok || data.error) {
      errEl.textContent = data.error || 'Something went wrong. Please try again.';
      errEl.style.display = 'block';
      btn.disabled = false;
      btnText.textContent = 'Submit Application';
      return;
    }

    // Success!
    successEl.innerHTML = '<i class="fas fa-check-circle" style="font-size:32px;display:block;margin-bottom:8px;"></i>' + (data.message || 'Application submitted successfully!');
    successEl.style.display = 'block';
    document.getElementById('affApplyForm').style.display = 'none';

  } catch (err) {
    errEl.textContent = 'Network error. Please check your connection and try again.';
    errEl.style.display = 'block';
    btn.disabled = false;
    btnText.textContent = 'Submit Application';
  }
}

async function checkPartnerStatus() {
  const email = document.getElementById('affStatusEmail').value.trim();
  const resultEl = document.getElementById('affStatusResult');
  if (!email) { resultEl.innerHTML = '<span style="color:#dc2626;">Please enter your email.</span>'; return; }

  try {
    const res = await fetch('/api/partner/apply/status?email=' + encodeURIComponent(email));
    const data = await res.json();

    if (!data.found) {
      resultEl.innerHTML = '<span style="color:var(--text-secondary);">No application found for this email. <a href="#" onclick="event.preventDefault();" style="color:#2563eb;">Apply above!</a></span>';
      return;
    }

    const statusBadge = {
      pending: '<span style="background:#fef3c7;color:#d97706;padding:3px 10px;border-radius:20px;font-size:13px;font-weight:600;"><i class="fas fa-clock"></i> Pending Review</span>',
      approved: '<span style="background:#d1fae5;color:#059669;padding:3px 10px;border-radius:20px;font-size:13px;font-weight:600;"><i class="fas fa-check-circle"></i> Approved</span>',
      rejected: '<span style="background:#fee2e2;color:#dc2626;padding:3px 10px;border-radius:20px;font-size:13px;font-weight:600;"><i class="fas fa-times-circle"></i> Not Approved</span>',
      waitlisted: '<span style="background:#ede9fe;color:#7c3aed;padding:3px 10px;border-radius:20px;font-size:13px;font-weight:600;"><i class="fas fa-hourglass-half"></i> Waitlisted</span>'
    };

    let html = statusBadge[data.status] || data.status;
    html += ` <span style="color:var(--text-secondary);font-size:13px;margin-left:8px;">Applied: ${new Date(data.appliedAt).toLocaleDateString()}</span>`;
    if (data.status === 'approved') {
      html += '<br><span style="color:#059669;font-size:13px;margin-top:4px;display:inline-block;">Sign in with your email to access the CRM dashboard!</span>';
    }
    if (data.status === 'rejected') {
      html += '<br><span style="color:var(--text-secondary);font-size:13px;margin-top:4px;display:inline-block;">You can re-apply by submitting the form above.</span>';
    }
    resultEl.innerHTML = html;
  } catch {
    resultEl.innerHTML = '<span style="color:#dc2626;">Failed to check status. Please try again.</span>';
  }
}

// ============================================================
// ADMIN ANALYTICS DASHBOARD
// ============================================================
function renderAdminDashboard(el) {
  // Delegate to the new admin panel module
  if (window._admin && window._admin.render) {
    window._admin.render(el);
    return;
  }
  el.innerHTML = '<div style="text-align:center;padding:60px;color:var(--text-muted)"><i class="fas fa-spinner fa-spin" style="font-size:24px"></i><p style="margin-top:12px">Loading admin panel...</p></div>';
  // admin.js is a large (260KB) bundle that loads lazily, so it may not be
  // ready when this view first renders. Make sure it's requested, then poll
  // until it registers window._admin (up to ~15s) instead of giving up.
  if (typeof window._loadAdminJs === 'function') window._loadAdminJs();
  let tries = 0;
  const timer = setInterval(() => {
    tries++;
    if (window._admin && window._admin.render) {
      clearInterval(timer);
      window._admin.render(el);
    } else if (tries > 60) {
      clearInterval(timer);
      el.innerHTML = '<div style="text-align:center;padding:60px;color:var(--text-muted)"><i class="fas fa-triangle-exclamation" style="font-size:24px"></i><p style="margin-top:12px">Could not load the admin panel. Please refresh the page.</p></div>';
    }
  }, 250);
}

// ============================================================
// MOBILE BOTTOM SHEET (Tracking & Tools)
// ============================================================
const MOBILE_SHEET_GROUPS = {
  tracking: {
    label: 'Tracking',
    items: [
      { view: 'dashboard',     icon: 'fas fa-chart-line',     color: '#2563eb', bg: 'rgba(37,99,235,0.1)',   label: 'Dashboard',    desc: 'Progress overview' },
      { view: 'achievements',  icon: 'fas fa-trophy',         color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  label: 'Achievements', desc: 'Unlock milestones' },
      { view: 'calendar',      icon: 'fas fa-calendar-alt',   color: '#0ea5e9', bg: 'rgba(14,165,233,0.1)',  label: 'Calendar',     desc: 'Regimen schedule' },
      { view: 'tracker',       icon: 'fas fa-syringe',        color: '#10b981', bg: 'rgba(16,185,129,0.1)',  label: 'Dose Log',     desc: 'Log injections' },
      { view: 'journal',       icon: 'fas fa-book-medical',   color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)',  label: 'Journal',      desc: 'Side effects diary' },
      { view: 'bloodwork',     icon: 'fas fa-droplet',        color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   label: 'Bloodwork',    desc: 'Lab results' },
    ]
  },
  tools: {
    label: 'Tools',
    items: [
      { view: 'calculator',    icon: 'fas fa-flask-vial',     color: '#2563eb', bg: 'rgba(37,99,235,0.1)',   label: 'Calculator',   desc: 'Reconstitution math' },
      { view: 'builder',       icon: 'fas fa-layer-group',    color: '#7c3aed', bg: 'rgba(124,58,237,0.1)',  label: 'Stack Builder',desc: 'Build peptide stacks' },
      { view: 'interactions',  icon: 'fas fa-shield-halved',  color: '#0ea5e9', bg: 'rgba(14,165,233,0.1)',  label: 'Interactions', desc: 'Check conflicts' },
      { view: 'compare',       icon: 'fas fa-scale-balanced', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  label: 'Compare',      desc: 'Side-by-side analysis' },
      { view: 'protocols',     icon: 'fas fa-clipboard-list', color: '#10b981', bg: 'rgba(16,185,129,0.1)',  label: 'Protocols',    desc: 'Dosing protocols' },
      { view: 'research',      icon: 'fas fa-newspaper',      color: '#6366f1', bg: 'rgba(99,102,241,0.1)',  label: 'Research',     desc: 'Latest papers' },
      { view: 'videos',        icon: 'fab fa-youtube',        color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   label: 'Videos',       desc: 'Educational content' },
    ]
  }
};

let _activeMobileSheet = null;

function openMobileSheet(groupId) {
  const group = MOBILE_SHEET_GROUPS[groupId];
  if (!group) return;

  // If same sheet is already open, close it
  if (_activeMobileSheet === groupId) {
    closeMobileSheet();
    return;
  }

  _activeMobileSheet = groupId;

  const overlay = document.getElementById('mobileSheetOverlay');
  const sheet   = document.getElementById('mobileSheet');
  const title   = document.getElementById('mobileSheetTitle');
  const items   = document.getElementById('mobileSheetItems');
  if (!overlay || !sheet || !title || !items) return;

  // Build items HTML
  const currentView = window.currentView || 'home';
  items.innerHTML = group.items.map(item => `
    <button class="mobile-sheet-item${item.view === currentView ? ' active' : ''}"
            onclick="closeMobileSheet(); navigate('${item.view}')">
      <span class="msi-icon" style="background:${item.bg};color:${item.color}">
        <i class="${item.icon}"></i>
      </span>
      <span class="msi-text">
        <span class="msi-label">${item.label}</span>
        <span class="msi-desc">${item.desc}</span>
      </span>
      <i class="fas fa-chevron-right msi-arrow"></i>
    </button>
  `).join('');

  title.textContent = group.label;

  // Mark nav button active
  document.querySelectorAll('#mobileTrackingBtn,#mobileToolsBtn').forEach(b => b.classList.remove('sheet-open'));
  const triggerBtn = document.getElementById(groupId === 'tracking' ? 'mobileTrackingBtn' : 'mobileToolsBtn');
  if (triggerBtn) triggerBtn.classList.add('sheet-open');

  // Show overlay + sheet
  overlay.style.display = 'block';
  sheet.style.display = 'block';
  // Force reflow for animation
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      overlay.classList.add('visible');
      sheet.classList.add('visible');
    });
  });
}

function closeMobileSheet() {
  const overlay = document.getElementById('mobileSheetOverlay');
  const sheet   = document.getElementById('mobileSheet');
  if (!overlay || !sheet) return;

  overlay.classList.remove('visible');
  sheet.classList.remove('visible');

  // Wait for transition to finish then hide
  setTimeout(() => {
    overlay.style.display = 'none';
    sheet.style.display = 'none';
    _activeMobileSheet = null;
  }, 340);

  // Remove active state on nav buttons
  document.querySelectorAll('#mobileTrackingBtn,#mobileToolsBtn').forEach(b => b.classList.remove('sheet-open'));
}

window.openMobileSheet = openMobileSheet;
window.closeMobileSheet = closeMobileSheet;
