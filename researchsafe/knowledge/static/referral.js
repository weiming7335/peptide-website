// Referral frontend - share card (both phases), attribution through OAuth,
// peak-satisfaction trigger, native share + copy, analytics. The reward copy
// switches automatically on the server flag; nothing here changes at Pro launch.
(function () {
  'use strict';

  var cfg = window.__REF_CONFIG__ || { rewardsEnabled: false, referredPerkEnabled: false, referredAllowance: 15, baseAllowance: 20 };
  var GOOD_ANSWERS_TO_PROMPT = 3;
  var DISMISS_COOLDOWN_DAYS = 7;
  var sessionAnswers = 0;
  var cardShownThisSession = false;
  var me = null; // cached /api/referral/me

  function userId() {
    var u = window.currentUser;
    return u ? (u.id || u.email || null) : null;
  }
  function getCookie(name) {
    var m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]+)'));
    return m ? decodeURIComponent(m[1]) : null;
  }
  function post(path, body) {
    return fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) })
      .then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
  }
  function track(event, extra) {
    post('/api/referral/event', Object.assign({ event: event, userId: userId() }, extra || {}));
  }

  // ── Referred-user perk: bump the early AI allowance when arriving via a valid
  //    referral link. Costs nothing, so it can be on in Phase 1.
  function applyReferredPerk() {
    if (!cfg.referredPerkEnabled) return;
    if (!getCookie('rs_ref')) return;
    try { localStorage.setItem('rs_ai_allowance', String(cfg.referredAllowance)); } catch (e) {}
  }

  // ── Attribution: link referred user -> referrer after the OAuth round-trip.
  function attributeIfNeeded() {
    var id = userId();
    var ref = getCookie('rs_ref');
    if (!id || !ref) return;
    var key = 'rs_ref_attributed_' + id;
    try { if (localStorage.getItem(key)) return; } catch (e) {}
    post('/api/referral/attribute', { userId: id, code: ref }).then(function (res) {
      try { if (res) localStorage.setItem(key, '1'); } catch (e) {}
    });
  }

  // ── Activation signal + peak-satisfaction trigger. chat.js calls this after a
  //    good AI answer renders. Server enforces the 2-question activation gate.
  function onAiAnswer() {
    var id = userId();
    if (id) post('/api/referral/ai-question', { userId: id });   // server-side activation
    // Anonymous freewall counting is handled by syncFromServer() using the
    // server's authoritative X-AI-Remaining header (chat.js), so we don't
    // increment locally here to avoid double-counting.
    updateMeters();
    sessionAnswers++;
    if (!cardShownThisSession && id && sessionAnswers >= GOOD_ANSWERS_TO_PROMPT && !recentlyDismissed()) {
      cardShownThisSession = true;
      showShareCard();
    }
  }

  // ── Anonymous AI freewall: count + remaining indicator + sign-up gate ───────
  // The server (IP-keyed D1) is the source of truth; we mirror its count locally
  // for display. Allowance = 20 by default, or the referred-link perk when set.
  function isLoggedIn() { return !!userId(); }
  function aiAllowance() {
    var perk = 0;
    try { perk = parseInt(localStorage.getItem('rs_ai_allowance') || '0', 10) || 0; } catch (e) {}
    return Math.max(perk, cfg.baseAllowance || 20);
  }
  function aiUsed() {
    try { return parseInt(localStorage.getItem('rs_ai_used') || '0', 10) || 0; } catch (e) { return 0; }
  }
  function aiRemaining() { return Math.max(0, aiAllowance() - aiUsed()); }
  function consumeAiMessage() {
    if (isLoggedIn()) return;
    try { localStorage.setItem('rs_ai_used', String(aiUsed() + 1)); } catch (e) {}
  }

  // Sync the client meter from the server's authoritative count. chat.js passes
  // the X-AI-Remaining / X-AI-Limit headers from a successful /ai/chat response.
  // The server (IP-keyed D1) is the source of truth; we mirror it into
  // rs_ai_used so the meter survives reloads and can't drift from reality.
  function syncFromServer(remaining, limit, loggedIn, bonus, bonusLeft) {
    // Stash the referral bonus pool (sent for logged-in users) so meters can show it.
    try {
      var b = parseInt(bonus, 10);
      var bl = parseInt(bonusLeft, 10);
      if (!isNaN(b)) localStorage.setItem('rs_ai_bonus_total', String(b));
      if (!isNaN(bl)) localStorage.setItem('rs_ai_bonus_left', String(bl));
    } catch (e) {}
    if (loggedIn) { updateMeters(); return; }
    try {
      var lim = parseInt(limit, 10);
      var rem = parseInt(remaining, 10);
      if (!isNaN(lim) && !isNaN(rem)) {
        var used = Math.max(0, lim - rem);
        localStorage.setItem('rs_ai_used', String(used));
      }
    } catch (e) {}
    updateMeters();
  }

  function aiBonusInfo() {
    var total = 0, left = 0;
    try {
      total = parseInt(localStorage.getItem('rs_ai_bonus_total') || '0', 10) || 0;
      left = parseInt(localStorage.getItem('rs_ai_bonus_left') || '0', 10) || 0;
    } catch (e) {}
    return { total: total, left: left };
  }

  // Refresh the logged-in user's referral bonus from the server so the meter can
  // show it before the first chat response arrives.
  function refreshBonus() {
    var id = userId();
    if (!id) return;
    var u = window.currentUser || {};
    var q = '/api/referral/me?userId=' + encodeURIComponent(id) +
      (u.email ? '&email=' + encodeURIComponent(u.email) : '');
    fetch(q).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      if (!d) return;
      try { localStorage.setItem('rs_ai_bonus_total', String(d.aiBonusDaily || 0)); } catch (e) {}
      updateMeters();
    }).catch(function () {});
  }

  // Called by chat.js before sending. Returns true (and prompts sign-up) when an
  // anonymous user is out of free messages.
  function aiGateBlocked() {
    if (isLoggedIn()) return false;
    if (aiRemaining() > 0) return false;
    showEarnCreditsPopup('out');
    updateMeters();
    return true;
  }

  function injectMeterStyles() {
    if (document.getElementById('rs-ai-meter-styles')) return;
    var s = document.createElement('style');
    s.id = 'rs-ai-meter-styles';
    s.textContent = [
      '.rs-ai-meter{margin-top:6px;font-size:11px;font-weight:600;color:#7E7E7E;text-align:center;display:none}',
      '[data-theme="light"] .rs-ai-meter{color:#8B98AC}',
      '.rs-ai-meter.show{display:block}',
      '.rs-ai-meter b{color:#EDEDED;font-variant-numeric:tabular-nums}',
      '[data-theme="light"] .rs-ai-meter b{color:#16191E}',
      '.rs-ai-meter .rs-ai-meter-link{color:#EDEDED;text-decoration:underline;text-underline-offset:2px;cursor:pointer}',
      '[data-theme="light"] .rs-ai-meter .rs-ai-meter-link{color:#0F1B2D}',
      '.rs-ai-meter.empty b{color:#EDEDED}',
    ].join('');
    document.head.appendChild(s);
  }

  function meterHtml() {
    var rem = aiRemaining(), allow = aiAllowance();
    if (rem <= 0) {
      return 'Free preview used up - <span class="rs-ai-meter-link" data-ai-signin>create a free account</span> for 50 messages/day'
        + '<br><span style="opacity:.7">Free models always free · Pro (premium models) coming soon - $4.99/mo</span>';
    }
    if (rem === 1) {
      return '<b>1</b> free message left - <span class="rs-ai-meter-link" data-ai-signin>sign in</span> for 50/day';
    }
    return '<b>' + rem + '</b> of <b>' + allow + '</b> free AI messages left - <span class="rs-ai-meter-link" data-ai-signin>sign in</span> for 50/day';
  }

  function updateMeters() {
    injectMeterStyles();
    var meters = document.querySelectorAll('.rs-ai-meter');
    for (var i = 0; i < meters.length; i++) {
      var el = meters[i];
      var nextClass, nextHtml;
      if (isLoggedIn()) {
        var b = aiBonusInfo();
        if (b.total > 0) {
          nextClass = 'rs-ai-meter show';
          nextHtml = '<i class="fas fa-bolt" style="margin-right:4px;opacity:.8"></i><b>+' + b.total +
            '</b> bonus AI messages/day from referrals - <span class="rs-ai-meter-link" data-ai-invite>invite more</span>';
        } else {
          nextClass = 'rs-ai-meter';
          nextHtml = '';
        }
      } else {
        nextClass = 'rs-ai-meter show' + (aiRemaining() <= 0 ? ' empty' : '');
        nextHtml = meterHtml();
      }
      // Only touch the DOM when something actually changed - writing innerHTML
      // unconditionally re-triggers the contentArea MutationObserver and loops.
      if (el.className !== nextClass) el.className = nextClass;
      if (el.innerHTML !== nextHtml) el.innerHTML = nextHtml;
    }
  }

  // Sign-in links inside meters (event delegation; survives chat re-renders).
  // Use closest() so clicks on any descendant (text node, <b>, underline) still
  // resolve to the link, and always go through window.openAuthModal which is
  // bootstrapped in app-boot.js (lazy-loads app-views.js if needed).
  document.addEventListener('click', function (e) {
    var t = e.target;
    var earn = t && t.closest ? t.closest('[data-ai-earn]') : null;
    if (earn) {
      e.preventDefault();
      showEarnCreditsPopup('learn');
      return;
    }
    var invite = t && t.closest ? t.closest('[data-ai-invite]') : null;
    if (invite) {
      e.preventDefault();
      showShareCard();
      return;
    }
    var link = t && t.closest ? t.closest('[data-ai-signin]') : null;
    if (!link && t && t.getAttribute && t.getAttribute('data-ai-signin') !== null) link = t;
    if (link) {
      e.preventDefault();
      if (typeof window.openAuthModal === 'function') {
        window.openAuthModal('register', 'ai-meter');
      }
    }
  });

  // Repaint meters whenever chat UI (re)renders. Debounced and self-suppressing:
  // updateMeters() can itself mutate the subtree, which would otherwise feed back
  // into this observer and lock up the main thread.
  var _meterObserver = null;
  var _meterTimer = null;
  function scheduleMeterUpdate() {
    if (_meterTimer) return;
    _meterTimer = setTimeout(function () {
      _meterTimer = null;
      if (_meterObserver) _meterObserver.disconnect();
      try { updateMeters(); } catch (e) {}
      if (_meterObserver && contentArea) {
        _meterObserver.observe(contentArea, { childList: true, subtree: true });
      }
    }, 250);
  }
  var contentArea = document.getElementById('contentArea');
  if (contentArea && window.MutationObserver) {
    _meterObserver = new MutationObserver(scheduleMeterUpdate);
    _meterObserver.observe(contentArea, { childList: true, subtree: true });
  }

  function recentlyDismissed() {
    try {
      var t = parseInt(localStorage.getItem('rs_share_dismissed_at') || '0', 10);
      return t && (Date.now() - t) < DISMISS_COOLDOWN_DAYS * 86400000;
    } catch (e) { return false; }
  }

  // ── Share card ───────────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('rs-ref-styles')) return;
    var s = document.createElement('style');
    s.id = 'rs-ref-styles';
    s.textContent = [
      '.rs-ref-card{position:fixed;z-index:140;right:20px;bottom:20px;width:340px;max-width:calc(100vw - 32px);',
      'background:#1F1F1F;border:1px solid #2C2C2C;border-radius:16px;padding:18px;color:#EDEDED;',
      'box-shadow:inset 0 1px 0 rgba(255,255,255,.045),0 2px 4px rgba(0,0,0,.4),0 24px 56px -20px rgba(0,0,0,.65);',
      'font-family:"Instrument Sans",-apple-system,sans-serif;opacity:0;transform:translateY(10px);',
      'transition:opacity .3s cubic-bezier(.22,1,.36,1),transform .3s cubic-bezier(.22,1,.36,1)}',
      '.rs-ref-card.in{opacity:1;transform:translateY(0)}',
      '[data-theme="light"] .rs-ref-card{background:#fff;border-color:#E4E7EC;color:#16191E;box-shadow:0 2px 4px rgba(16,20,28,.06),0 22px 50px -18px rgba(16,20,28,.2)}',
      '.rs-ref-head{display:flex;align-items:flex-start;gap:10px;margin-bottom:8px}',
      '.rs-ref-icon{width:34px;height:34px;border-radius:10px;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:#EDEDED;color:#111}',
      '[data-theme="light"] .rs-ref-icon{background:#0F1B2D;color:#fff}',
      '.rs-ref-title{font-family:"Sora",sans-serif;font-weight:700;font-size:14.5px;line-height:1.3;letter-spacing:-.01em}',
      '.rs-ref-body{font-size:12.5px;line-height:1.55;color:#9E9E9E;margin:6px 0 12px}',
      '[data-theme="light"] .rs-ref-body{color:#5C6470}',
      '.rs-ref-progress{font-size:11.5px;font-weight:600;color:#EDEDED;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);border-radius:9px;padding:8px 10px;margin-bottom:12px;display:flex;align-items:center;gap:7px}',
      '[data-theme="light"] .rs-ref-progress{color:#16191E;background:#F2F3F6;border-color:#E4E7EC}',
      '.rs-ref-actions{display:flex;gap:8px}',
      '.rs-ref-btn{flex:1;border:none;border-radius:10px;padding:10px 12px;font-size:12.5px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;font-family:inherit;transition:background .15s,transform .12s}',
      '.rs-ref-btn:active{transform:scale(.97)}',
      '.rs-ref-btn-primary{background:#EDEDED;color:#111}',
      '.rs-ref-btn-primary:hover{background:#fff}',
      '[data-theme="light"] .rs-ref-btn-primary{background:#0F1B2D;color:#fff}',
      '.rs-ref-btn-ghost{background:rgba(255,255,255,.05);color:#C9C9C9;border:1px solid #3A3A3A}',
      '.rs-ref-btn-ghost:hover{background:rgba(255,255,255,.09)}',
      '[data-theme="light"] .rs-ref-btn-ghost{background:#fff;color:#3D434C;border-color:#D5DAE1}',
      '.rs-ref-close{position:absolute;top:12px;right:12px;width:24px;height:24px;border:none;background:none;color:#6F6F6F;cursor:pointer;border-radius:6px;font-size:13px}',
      '.rs-ref-close:hover{background:rgba(255,255,255,.08);color:#EDEDED}',
      '.rs-ref-disc{font-size:10px;color:#6F6F6F;margin-top:10px;text-align:center}',
      '@media(max-width:560px){.rs-ref-card{right:12px;left:12px;width:auto;bottom:calc(76px + env(safe-area-inset-bottom))}}',
    ].join('');
    document.head.appendChild(s);
  }

  // ── Welcome popup (shown once, right after a new account is created) ─────────
  function injectWelcomeStyles() {
    if (document.getElementById('rs-welcome-styles')) return;
    var s = document.createElement('style');
    s.id = 'rs-welcome-styles';
    s.textContent = [
      '.rs-wel-overlay{position:fixed;inset:0;z-index:200;display:flex;align-items:center;justify-content:center;padding:20px;',
      'background:rgba(8,10,14,.62);backdrop-filter:blur(4px);opacity:0;transition:opacity .25s ease}',
      '.rs-wel-overlay.in{opacity:1}',
      '.rs-wel{width:420px;max-width:100%;background:#1F1F1F;border:1px solid #2C2C2C;border-radius:18px;padding:26px 24px 22px;',
      'color:#EDEDED;font-family:"Instrument Sans",-apple-system,sans-serif;box-shadow:0 30px 70px -24px rgba(0,0,0,.7);',
      'transform:translateY(12px) scale(.98);transition:transform .28s cubic-bezier(.22,1,.36,1)}',
      '.rs-wel-overlay.in .rs-wel{transform:translateY(0) scale(1)}',
      '[data-theme="light"] .rs-wel{background:#fff;border-color:#E4E7EC;color:#16191E;box-shadow:0 30px 70px -24px rgba(16,20,28,.35)}',
      '.rs-wel-badge{width:46px;height:46px;border-radius:13px;display:flex;align-items:center;justify-content:center;',
      'background:linear-gradient(135deg,#FBBF24,#F59E0B);color:#1a1206;font-size:20px;margin-bottom:14px}',
      '.rs-wel-title{font-family:"Sora",sans-serif;font-weight:700;font-size:20px;line-height:1.25;letter-spacing:-.015em;margin-bottom:8px}',
      '.rs-wel-body{font-size:13.5px;line-height:1.6;color:#A8A8A8;margin-bottom:16px}',
      '[data-theme="light"] .rs-wel-body{color:#5C6470}',
      '.rs-wel-body b{color:#EDEDED}',
      '[data-theme="light"] .rs-wel-body b{color:#16191E}',
      '.rs-wel-steps{list-style:none;margin:0 0 18px;padding:0;display:flex;flex-direction:column;gap:10px}',
      '.rs-wel-step{display:flex;align-items:flex-start;gap:10px;font-size:13px;line-height:1.45;color:#C9C9C9}',
      '[data-theme="light"] .rs-wel-step{color:#3D434C}',
      '.rs-wel-step i{color:#F59E0B;font-size:13px;margin-top:2px;flex-shrink:0}',
      '.rs-wel-link{display:flex;align-items:center;gap:8px;background:rgba(255,255,255,.05);border:1px solid #3A3A3A;border-radius:10px;',
      'padding:9px 11px;font-size:12px;color:#C9C9C9;margin-bottom:14px;word-break:break-all}',
      '[data-theme="light"] .rs-wel-link{background:#F2F3F6;border-color:#E4E7EC;color:#3D434C}',
      '.rs-wel-link i{color:#7E7E7E;flex-shrink:0}',
      '.rs-wel-actions{display:flex;gap:8px}',
      '.rs-wel-btn{flex:1;border:none;border-radius:11px;padding:11px 12px;font-size:13px;font-weight:600;cursor:pointer;',
      'display:flex;align-items:center;justify-content:center;gap:7px;font-family:inherit;transition:background .15s,transform .12s}',
      '.rs-wel-btn:active{transform:scale(.97)}',
      '.rs-wel-btn-primary{background:#EDEDED;color:#111}.rs-wel-btn-primary:hover{background:#fff}',
      '[data-theme="light"] .rs-wel-btn-primary{background:#0F1B2D;color:#fff}',
      '.rs-wel-btn-ghost{background:rgba(255,255,255,.05);color:#C9C9C9;border:1px solid #3A3A3A}.rs-wel-btn-ghost:hover{background:rgba(255,255,255,.09)}',
      '[data-theme="light"] .rs-wel-btn-ghost{background:#fff;color:#3D434C;border-color:#D5DAE1}',
      '.rs-wel-skip{display:block;width:100%;margin-top:12px;background:none;border:none;color:#7E7E7E;font-size:12px;cursor:pointer;font-family:inherit}',
      '.rs-wel-skip:hover{color:#C9C9C9}',
      '@media(max-width:560px){.rs-wel{padding:22px 18px 18px}.rs-wel-title{font-size:18px}}',
    ].join('');
    document.head.appendChild(s);
  }

  // Shows a one-time, centered welcome explaining the referral perk. Guarded by a
  // per-user localStorage key so it never appears twice.
  function showWelcomePopup(force) {
    var id = userId();
    if (!id) return;
    var seenKey = 'rs_welcome_seen_' + id;
    if (!force) {
      try { if (localStorage.getItem(seenKey)) return; } catch (e) {}
    }
    if (document.getElementById('rsWelcome')) return;
    try { localStorage.setItem(seenKey, '1'); } catch (e) {}

    var perReferral = (cfg.aiBonusPerReferral || 50);

    // Ensure a link exists, then render.
    post('/api/referral/link', { userId: id }).then(function (res) {
      var link = res && res.link;
      if (!link) {
        // Fall back to /me which also creates a code.
        return fetch('/api/referral/me?userId=' + encodeURIComponent(id))
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (d) { if (d && d.link) renderWelcome(d.link, perReferral); });
      }
      renderWelcome(link, perReferral);
    }).catch(function () {});
  }

  function renderWelcome(link, perReferral) {
    injectWelcomeStyles();
    if (document.getElementById('rsWelcome')) return;

    var overlay = document.createElement('div');
    overlay.className = 'rs-wel-overlay';
    overlay.id = 'rsWelcome';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Welcome to ResearchSafe');
    overlay.innerHTML =
      '<div class="rs-wel">' +
        '<div class="rs-wel-badge"><i class="fas fa-bolt"></i></div>' +
        '<div class="rs-wel-title">You\'re in. Want more free AI?</div>' +
        '<div class="rs-wel-body">Your free account includes <b>50 AI messages a day</b>. Invite friends and you\'ll earn even more every day, automatically.</div>' +
        '<ul class="rs-wel-steps">' +
          '<li class="rs-wel-step"><i class="fas fa-share-nodes"></i><span>Share your personal invite link below.</span></li>' +
          '<li class="rs-wel-step"><i class="fas fa-user-plus"></i><span>A friend creates their own free account with it.</span></li>' +
          '<li class="rs-wel-step"><i class="fas fa-bolt"></i><span>You get <b>+' + perReferral + ' AI messages every day</b>, on top of your daily limit. No limit on how many you can earn.</span></li>' +
        '</ul>' +
        '<div class="rs-wel-link"><i class="fas fa-link"></i><span id="rsWelLinkText">' + link + '</span></div>' +
        '<div class="rs-wel-actions">' +
          '<button class="rs-wel-btn rs-wel-btn-primary" data-act="share"><i class="fas fa-share-nodes"></i> Share invite</button>' +
          '<button class="rs-wel-btn rs-wel-btn-ghost" data-act="copy"><i class="fas fa-copy"></i> Copy link</button>' +
        '</div>' +
        '<button class="rs-wel-skip" data-act="skip">Maybe later</button>' +
      '</div>';

    document.body.appendChild(overlay);
    requestAnimationFrame(function () { overlay.classList.add('in'); });
    track('share_card_shown', { code: me && me.code, meta: { source: 'welcome' } });

    var shareData = { title: 'ResearchSafe', text: 'Compound research, organized - peptide profiles, dosing math and safety in one place.', url: link };

    function close() {
      overlay.classList.remove('in');
      setTimeout(function () { overlay.remove(); }, 250);
    }

    overlay.querySelector('[data-act="share"]').addEventListener('click', function () {
      if (navigator.share) {
        navigator.share(shareData).then(function () { track('share_card_native_shared', { code: me && me.code, meta: { source: 'welcome' } }); })
          .catch(function () {});
      } else {
        copyWelcomeLink(link);
      }
    });
    overlay.querySelector('[data-act="copy"]').addEventListener('click', function () { copyWelcomeLink(link); });
    overlay.querySelector('[data-act="skip"]').addEventListener('click', close);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
  }

  function copyWelcomeLink(link) {
    var done = function () {
      track('share_card_copied', { code: me && me.code, meta: { source: 'welcome' } });
      var btn = document.querySelector('#rsWelcome [data-act="copy"]');
      if (btn) btn.innerHTML = '<i class="fas fa-check"></i> Copied';
    };
    if (navigator.clipboard) navigator.clipboard.writeText(link).then(done).catch(function () { prompt('Copy your invite link:', link); });
    else { prompt('Copy your invite link:', link); done(); }
  }

  // ── "Earn more AI credits" popup ────────────────────────────────────────────
  // Reused by the chat meter link AND the out-of-credits / daily-limit gates.
  // reason: 'learn' (clicked the link) | 'out' (guest used up preview) |
  //         'limit' (logged-in hit daily cap).
  function showEarnCreditsPopup(reason) {
    injectWelcomeStyles();
    if (document.getElementById('rsEarn')) return;
    var loggedIn = isLoggedIn();
    var perReferral = (cfg.aiBonusPerReferral || 50);

    function render(link) {
      if (document.getElementById('rsEarn')) return;
      var title, intro, steps = [], linkBlock = '', actions, skipLabel;

      if (!loggedIn) {
        // Guests: the biggest, instant win is creating a free account.
        title = (reason === 'out') ? 'Out of free messages' : 'Get more free AI';
        intro = (reason === 'out')
          ? 'You\'ve used your free preview messages. Create a <b>free account</b> to keep going - no card required.'
          : 'Want more AI? Here are two free ways to unlock more messages.';
        steps = [
          '<li class="rs-wel-step"><i class="fas fa-user-plus"></i><span><b>Create a free account</b> - jump from 20 to <b>50 AI messages every day</b>.</span></li>',
          '<li class="rs-wel-step"><i class="fas fa-bolt"></i><span>Then <b>invite friends</b> - earn <b>+' + perReferral + ' messages every day</b> for each one who joins.</span></li>',
        ];
        actions =
          '<button class="rs-wel-btn rs-wel-btn-primary" data-act="signup"><i class="fas fa-user-plus"></i> Create free account</button>' +
          '<button class="rs-wel-btn rs-wel-btn-ghost" data-act="signin"><i class="fas fa-right-to-bracket"></i> Sign in</button>';
        skipLabel = 'Maybe later';
      } else {
        title = (reason === 'limit') ? 'You\'ve hit today\'s limit' : 'Earn more AI credits';
        intro = (reason === 'limit')
          ? 'You\'ve used your <b>AI messages</b> for today. They reset tomorrow - or unlock more right now by inviting friends.'
          : 'You get <b>50 AI messages a day</b> free. Invite friends to earn even more every day, automatically.';
        steps = [
          '<li class="rs-wel-step"><i class="fas fa-share-nodes"></i><span>Share your personal invite link below.</span></li>',
          '<li class="rs-wel-step"><i class="fas fa-user-plus"></i><span>A friend creates their own free account with it.</span></li>',
          '<li class="rs-wel-step"><i class="fas fa-bolt"></i><span>You earn <b>+' + perReferral + ' AI messages every day</b>, on top of your daily limit. No cap on how many you can earn.</span></li>',
        ];
        if (link) linkBlock = '<div class="rs-wel-link"><i class="fas fa-link"></i><span id="rsEarnLinkText">' + link + '</span></div>';
        actions =
          '<button class="rs-wel-btn rs-wel-btn-primary" data-act="share"><i class="fas fa-share-nodes"></i> Share invite</button>' +
          '<button class="rs-wel-btn rs-wel-btn-ghost" data-act="copy"><i class="fas fa-copy"></i> Copy link</button>';
        skipLabel = (reason === 'limit') ? 'I\'ll wait for tomorrow' : 'Close';
      }

      var overlay = document.createElement('div');
      overlay.className = 'rs-wel-overlay';
      overlay.id = 'rsEarn';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-label', 'Earn more AI credits');
      overlay.innerHTML =
        '<div class="rs-wel">' +
          '<div class="rs-wel-badge"><i class="fas fa-bolt"></i></div>' +
          '<div class="rs-wel-title">' + title + '</div>' +
          '<div class="rs-wel-body">' + intro + '</div>' +
          '<ul class="rs-wel-steps">' + steps.join('') + '</ul>' +
          linkBlock +
          '<div class="rs-wel-actions">' + actions + '</div>' +
          '<button class="rs-wel-skip" data-act="skip">' + skipLabel + '</button>' +
        '</div>';

      document.body.appendChild(overlay);
      requestAnimationFrame(function () { overlay.classList.add('in'); });
      track('share_card_shown', { code: me && me.code, meta: { source: 'earn-' + (reason || 'learn') } });

      function close() {
        overlay.classList.remove('in');
        setTimeout(function () { overlay.remove(); }, 250);
      }

      var shareData = { title: 'ResearchSafe', text: 'Compound research, organized - peptide profiles, dosing math and safety in one place.', url: link };

      var btnSignup = overlay.querySelector('[data-act="signup"]');
      if (btnSignup) btnSignup.addEventListener('click', function () { close(); if (typeof window.openAuthModal === 'function') window.openAuthModal('register', 'earn-credits'); });
      var btnSignin = overlay.querySelector('[data-act="signin"]');
      if (btnSignin) btnSignin.addEventListener('click', function () { close(); if (typeof window.openAuthModal === 'function') window.openAuthModal('login', 'earn-credits'); });
      var btnShare = overlay.querySelector('[data-act="share"]');
      if (btnShare) btnShare.addEventListener('click', function () {
        if (navigator.share && link) navigator.share(shareData).then(function () { track('share_card_native_shared', { code: me && me.code, meta: { source: 'earn' } }); }).catch(function () {});
        else if (link) copyEarnLink(link);
      });
      var btnCopy = overlay.querySelector('[data-act="copy"]');
      if (btnCopy) btnCopy.addEventListener('click', function () { if (link) copyEarnLink(link); });
      overlay.querySelector('[data-act="skip"]').addEventListener('click', close);
      overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    }

    if (loggedIn) {
      var id = userId();
      post('/api/referral/link', { userId: id }).then(function (res) {
        render(res && res.link);
      }).catch(function () { render(null); });
    } else {
      render(null);
    }
  }

  function copyEarnLink(link) {
    var done = function () {
      track('share_card_copied', { code: me && me.code, meta: { source: 'earn' } });
      var btn = document.querySelector('#rsEarn [data-act="copy"]');
      if (btn) btn.innerHTML = '<i class="fas fa-check"></i> Copied';
    };
    if (navigator.clipboard) navigator.clipboard.writeText(link).then(done).catch(function () { prompt('Copy your invite link:', link); });
    else { prompt('Copy your invite link:', link); done(); }
  }

  function showShareCard() {
    injectStyles();
    if (document.getElementById('rsRefCard')) return;
    var id = userId();
    if (!id) return; // share card is for registered users (peak-satisfaction moment)

    // Ensure a link exists, fetch stats for Phase-2 progress, then render.
    Promise.all([
      post('/api/referral/link', { userId: id }),
      fetch('/api/referral/me?userId=' + encodeURIComponent(id)).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }),
    ]).then(function (res) {
      var link = (res[0] && res[0].link) || (res[1] && res[1].link);
      me = res[1];
      if (!link) return;
      render(link);
    });
  }

  function render(link) {
    var rewards = cfg.rewardsEnabled;
    var perReferral = (cfg.aiBonusPerReferral || (me && me.aiBonusPerReferral) || 50);
    var title, body, progressHtml = '';

    // The AI-usage bonus is always live (it costs nothing, like the referred
    // perk), so it leads the copy. The Pro-month reward is layered on when the
    // rewards flag is enabled.
    title = 'Invite a friend - get more free AI';
    body = 'For every friend who creates a free account with your link, you earn <b>+' + perReferral +
      ' AI messages every day</b>, on top of your daily limit. They get a head start too.';
    if (rewards) {
      body += ' Plus a free month of Pro for each one who signs up and starts researching - up to a year free.';
    }

    if (me) {
      var qualifying = me.qualifyingSignups || 0;
      var dailyBonus = me.aiBonusDaily || (qualifying * perReferral);
      if (qualifying > 0) {
        progressHtml = '<div class="rs-ref-progress"><i class="fas fa-bolt"></i>' +
          qualifying + ' friend' + (qualifying === 1 ? '' : 's') + ' joined - <b>+' + dailyBonus +
          ' AI messages/day</b> for you' +
          (rewards && me.earnedMonths > 0 ? ' · ' + me.earnedMonths + ' free month' + (me.earnedMonths === 1 ? '' : 's') + ' of Pro' : '') +
          '</div>';
      }
    }

    var card = document.createElement('div');
    card.className = 'rs-ref-card';
    card.id = 'rsRefCard';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-label', 'Invite a friend to ResearchSafe');
    card.innerHTML =
      '<button class="rs-ref-close" aria-label="Dismiss"><i class="fas fa-xmark"></i></button>' +
      '<div class="rs-ref-head">' +
        '<div class="rs-ref-icon"><i class="fas fa-paper-plane" style="font-size:14px"></i></div>' +
        '<div class="rs-ref-title">' + title + '</div>' +
      '</div>' +
      '<div class="rs-ref-body">' + body + '</div>' +
      progressHtml +
      '<div class="rs-ref-actions">' +
        '<button class="rs-ref-btn rs-ref-btn-primary" data-act="share"><i class="fas fa-share-nodes"></i> Share</button>' +
        '<button class="rs-ref-btn rs-ref-btn-ghost" data-act="copy"><i class="fas fa-link"></i> Copy link</button>' +
      '</div>' +
      '<div class="rs-ref-disc">Research &amp; education only - not medical advice.</div>';

    document.body.appendChild(card);
    requestAnimationFrame(function () { card.classList.add('in'); });
    track('share_card_shown', { code: me && me.code });

    var shareData = { title: 'ResearchSafe', text: 'Compound research, organized - peptide profiles, dosing math and safety in one place.', url: link };

    card.querySelector('[data-act="share"]').addEventListener('click', function () {
      if (navigator.share) {
        navigator.share(shareData).then(function () {
          track('share_card_native_shared', { code: me && me.code });
        }).catch(function () { /* user cancelled - no event */ });
      } else {
        copyLink(link);
      }
    });
    card.querySelector('[data-act="copy"]').addEventListener('click', function () { copyLink(link); });
    card.querySelector('.rs-ref-close').addEventListener('click', function () { dismiss(card); });
  }

  function copyLink(link) {
    var done = function () {
      track('share_card_copied', { code: me && me.code });
      var btn = document.querySelector('#rsRefCard [data-act="copy"]');
      if (btn) { btn.innerHTML = '<i class="fas fa-check"></i> Copied'; }
    };
    if (navigator.clipboard) navigator.clipboard.writeText(link).then(done).catch(function () { prompt('Copy your invite link:', link); });
    else { prompt('Copy your invite link:', link); done(); }
  }

  function dismiss(card) {
    track('share_card_dismissed', { code: me && me.code });
    try { localStorage.setItem('rs_share_dismissed_at', String(Date.now())); } catch (e) {}
    card.classList.remove('in');
    setTimeout(function () { card.remove(); }, 250);
  }

  // ── init ──────────────────────────────────────────────────────────────────
  // Pull live config (which copy to show, perk allowance, rewards on/off) so the
  // flag flip at Pro launch needs zero frontend changes.
  fetch('/api/referral/config').then(function (r) { return r.ok ? r.json() : null; })
    .then(function (c) { if (c) cfg = c; })
    .catch(function () {})
    .then(function () { applyReferredPerk(); attributeIfNeeded(); refreshBonus(); updateMeters(); maybeAutoOpenSignup(); });

  // When a referred visitor taps "Create my free account" on the /r/:code
  // landing, they arrive at /?ref=code&signup=1. Auto-open the signup modal so
  // the path from invite -> account is a single tap.
  function maybeAutoOpenSignup() {
    try {
      var params = new URLSearchParams(window.location.search);
      if (params.get('signup') !== '1') return;
      if (userId()) return; // already signed in
      var tries = 0;
      var iv = setInterval(function () {
        tries++;
        if (typeof window.openAuthModal === 'function') {
          clearInterval(iv);
          window.openAuthModal('register', { source: 'referral_landing' });
          // Clean the URL so a refresh doesn't reopen the modal.
          try {
            params.delete('signup');
            var qs = params.toString();
            window.history.replaceState({}, '', window.location.pathname + (qs ? '?' + qs : ''));
          } catch (e) {}
        } else if (tries > 40) {
          clearInterval(iv);
        }
      }, 150);
    } catch (e) {}
  }

  // Attribution + meter re-checks once auth settles (Supabase fires after load).
  setTimeout(function () { attributeIfNeeded(); refreshBonus(); updateMeters(); }, 1200);
  setTimeout(function () { attributeIfNeeded(); refreshBonus(); updateMeters(); }, 4000);
  document.addEventListener('rs-auth-changed', function () { attributeIfNeeded(); refreshBonus(); updateMeters(); });

  window.__referral = {
    onAiAnswer: onAiAnswer,
    showShareCard: showShareCard,   // exposed for manual trigger / testing
    showWelcomePopup: showWelcomePopup, // called after a brand-new account is created
    showEarnCreditsPopup: showEarnCreditsPopup, // chat link + out-of-credits gates
    aiGateBlocked: aiGateBlocked,   // chat.js calls this before sending
    updateMeters: updateMeters,
    aiRemaining: aiRemaining,
    syncFromServer: syncFromServer, // chat.js calls with server X-AI-* headers
    config: cfg,
  };
})();
