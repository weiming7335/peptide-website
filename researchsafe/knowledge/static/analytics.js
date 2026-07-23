// ============================================================
// PeptideSafe Analytics & Data Collection Layer
// Tracks Tier 1 (anonymous) and Tier 2 (disclosed) data
// Requires user consent before tracking (GDPR/CCPA compliant)
// ============================================================

(function() {
  'use strict';

  // ── Session & Consent State ──
  const SESSION_KEY = 'ps_session_id';
  const CONSENT_KEY = 'ps_consent';
  const PROFILE_PROMPT_KEY = 'ps_profile_prompted';
  const EVENT_BUFFER_KEY = 'ps_event_buffer';
  const SESSION_DATA_KEY = 'ps_session_data';

  let sessionId = localStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = crypto.randomUUID ? crypto.randomUUID() : 'sid_' + Date.now() + '_' + Math.random().toString(36).substring(2, 10);
    localStorage.setItem(SESSION_KEY, sessionId);
  }

  // Consent levels: null = not decided, 'all' = full tracking, 'essential' = no analytics, 'denied' = no tracking
  // Consent is implicit - users opt in by signing up (Privacy Policy covers data use).
  // Auto-grant full analytics consent; no banner is shown.
  let consentLevel = localStorage.getItem(CONSENT_KEY);
  if (!consentLevel) {
    consentLevel = 'all';
    localStorage.setItem(CONSENT_KEY, 'all');
  }

  // Session-level counters
  let sessionData = JSON.parse(localStorage.getItem(SESSION_DATA_KEY) || '{}');
  if (!sessionData.pageViews) {
    sessionData = { pageViews: 0, searches: 0, peptidesViewed: 0, featuresUsed: [], startTime: Date.now() };
  }

  // Event buffer for batching
  let eventBuffer = [];
  let flushTimer = null;

  // ── Consent Banner ──
  function showConsentBanner() {
    const banner = document.getElementById('consentBanner');
    if (banner && !consentLevel) {
      banner.style.display = 'block';
    }
  }

  window.acceptConsent = function() {
    consentLevel = 'all';
    localStorage.setItem(CONSENT_KEY, 'all');
    document.getElementById('consentBanner').style.display = 'none';
    // Record consent
    sendConsent('analytics', true);
    sendConsent('personalization', true);
    // Flush any buffered events
    flushEvents();
    // Show research profile prompt after a delay for logged-in users
    setTimeout(maybeShowProfilePrompt, 5000);
  };

  window.essentialOnly = function() {
    consentLevel = 'essential';
    localStorage.setItem(CONSENT_KEY, 'essential');
    document.getElementById('consentBanner').style.display = 'none';
    sendConsent('analytics', false);
    sendConsent('personalization', false);
  };

  window.closeConsent = function() {
    document.getElementById('consentBanner').style.display = 'none';
  };

  // ── Tracking Helpers ──
  function canTrack() {
    return consentLevel === 'all';
  }

  function getAuthHeaders() {
    try {
      const token = typeof getAccessToken === 'function' ? getAccessToken() : null;
      if (token) return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token };
    } catch (e) {}
    return { 'Content-Type': 'application/json' };
  }

  function queueEvent(type, data) {
    if (!canTrack()) return;
    eventBuffer.push({
      type: type,
      data: data || {},
      page: window.location.hash || '/',
      referrer: document.referrer || '',
      ts: Date.now()
    });
    // Auto-flush every 5 seconds or when buffer hits 15 events
    if (eventBuffer.length >= 15) {
      flushEvents();
    } else if (!flushTimer) {
      flushTimer = setTimeout(flushEvents, 5000);
    }
  }

  function flushEvents() {
    if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
    if (eventBuffer.length === 0 || !canTrack()) return;
    const batch = eventBuffer.splice(0, 20);
    fetch('/api/analytics/events', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ session_id: sessionId, events: batch })
    }).catch(() => {});
  }

  function sendConsent(type, consented) {
    fetch('/api/analytics/consent', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ session_id: sessionId, consent_type: type, consented: consented })
    }).catch(() => {});
  }

  // ── Session Heartbeat ──
  function sendSessionUpdate() {
    if (!canTrack()) return;
    const duration = Math.round((Date.now() - (sessionData.startTime || Date.now())) / 1000);
    const params = new URLSearchParams(window.location.search);
    fetch('/api/analytics/session', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        session_id: sessionId,
        page_views: sessionData.pageViews || 0,
        searches: sessionData.searches || 0,
        peptides_viewed: sessionData.peptidesViewed || 0,
        features_used: sessionData.featuresUsed || [],
        duration: duration,
        referrer: document.referrer || '',
        utm_source: params.get('utm_source') || '',
        utm_medium: params.get('utm_medium') || '',
        utm_campaign: params.get('utm_campaign') || ''
      })
    }).catch(() => {});
    localStorage.setItem(SESSION_DATA_KEY, JSON.stringify(sessionData));
  }

  // ── Public Tracking API ──
  // These are called from app.js at key interaction points

  window.psTrackPageView = function(viewName) {
    sessionData.pageViews = (sessionData.pageViews || 0) + 1;
    queueEvent('page_view', { view: viewName });
  };

  window.psTrackSearch = function(query, resultsCount, clickedResult) {
    if (!canTrack()) return;
    sessionData.searches = (sessionData.searches || 0) + 1;
    fetch('/api/analytics/search', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        session_id: sessionId,
        query: query,
        results_count: resultsCount || 0,
        clicked_result: clickedResult || null
      })
    }).catch(() => {});
  };

  window.psTrackPeptideView = function(peptideId, source) {
    if (!canTrack()) return;
    sessionData.peptidesViewed = (sessionData.peptidesViewed || 0) + 1;
    // Track the start time so we can compute duration later
    window._currentPeptideView = { peptideId: peptideId, source: source || '', start: Date.now() };
    queueEvent('peptide_view', { peptide_id: peptideId, source: source || '' });
  };

  window.psTrackPeptideViewEnd = function() {
    if (!canTrack() || !window._currentPeptideView) return;
    const v = window._currentPeptideView;
    const duration = Math.round((Date.now() - v.start) / 1000);
    if (duration > 1) {
      fetch('/api/analytics/peptide-view', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          session_id: sessionId,
          peptide_id: v.peptideId,
          duration: duration,
          source: v.source
        })
      }).catch(() => {});
    }
    window._currentPeptideView = null;
  };

  window.psTrackFeatureUse = function(featureName, data) {
    if (!sessionData.featuresUsed) sessionData.featuresUsed = [];
    if (!sessionData.featuresUsed.includes(featureName)) {
      sessionData.featuresUsed.push(featureName);
    }
    queueEvent('feature_use', { feature: featureName, ...(data || {}) });
  };

  window.psTrackCalculator = function(peptideName, vialSize, waterMl, desiredDose) {
    if (!canTrack()) return;
    fetch('/api/analytics/calculator', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        session_id: sessionId,
        peptide_name: peptideName || '',
        vial_size_mg: vialSize || 0,
        water_ml: waterMl || 0,
        desired_dose_mcg: desiredDose || 0
      })
    }).catch(() => {});
    psTrackFeatureUse('calculator');
  };

  window.psTrackInteractionCheck = function(peptideIds) {
    if (!canTrack()) return;
    fetch('/api/analytics/interaction-check', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        session_id: sessionId,
        peptides: peptideIds || []
      })
    }).catch(() => {});
    psTrackFeatureUse('interaction_checker');
  };

  window.psTrackStackBuild = function(stackName, peptideIds, goal) {
    if (!canTrack()) return;
    fetch('/api/analytics/stack-build', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        session_id: sessionId,
        stack_name: stackName || '',
        peptides: peptideIds || [],
        goal: goal || ''
      })
    }).catch(() => {});
    psTrackFeatureUse('stack_builder');
  };

  window.psTrackClick = function(target, context) {
    queueEvent('click', { target: target, context: context || '' });
  };

  window.psTrackVideoView = function(videoId, title) {
    queueEvent('video_view', { video_id: videoId, title: title || '' });
    psTrackFeatureUse('videos');
  };

  window.psTrackResearchView = function(pmid, title) {
    queueEvent('research_view', { pmid: pmid, title: title || '' });
    psTrackFeatureUse('research');
  };

  window.psTrackProtocolView = function(protocolId) {
    queueEvent('protocol_view', { protocol_id: protocolId });
    psTrackFeatureUse('protocols');
  };

  // ── Research Profile Prompt ──
  function maybeShowProfilePrompt() {
    // Only show if logged in, has consent, and hasn't been prompted before
    if (!canTrack()) return;
    if (localStorage.getItem(PROFILE_PROMPT_KEY)) return;
    if (typeof currentUser === 'undefined' || !currentUser) return;

    localStorage.setItem(PROFILE_PROMPT_KEY, '1');

    // Create a non-intrusive prompt
    const prompt = document.createElement('div');
    prompt.id = 'profilePrompt';
    prompt.style.cssText = 'position:fixed;bottom:80px;right:24px;z-index:9999;background:white;border-radius:16px;padding:20px 24px;box-shadow:0 8px 32px rgba(0,0,0,0.15);max-width:340px;animation:slideUp 0.3s ease;border:1px solid #e5e7eb';
    prompt.innerHTML = `
      <div style="display:flex;align-items:flex-start;gap:12px">
        <div style="background:linear-gradient(135deg,#2563eb,#7c3aed);color:white;width:40px;height:40px;border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <i class="fas fa-user-graduate"></i>
        </div>
        <div>
          <strong style="font-size:14px;display:block;margin-bottom:4px">Complete Your Research Profile</strong>
          <p style="font-size:12px;color:#6b7280;margin:0 0 12px;line-height:1.5">Help us understand how PeptideSafe is used. Tell us about your research interests. Takes 30 seconds.</p>
          <div style="display:flex;gap:8px">
            <button onclick="navigate('account');document.getElementById('profilePrompt')?.remove()" style="background:#2563eb;color:white;border:none;padding:6px 14px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer">Set Up Profile</button>
            <button onclick="this.closest('#profilePrompt').remove()" style="background:none;border:1px solid #e5e7eb;padding:6px 12px;border-radius:8px;font-size:12px;color:#6b7280;cursor:pointer">Later</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(prompt);
    setTimeout(() => prompt.remove(), 15000);
  }

  // ── Auto-track navigation changes ──
  // The navigate() function in app.js is patched to call psTrackPageView
  const _origNavigate = window.navigate;
  if (typeof _origNavigate === 'function') {
    window.navigate = function(view, data) {
      // End any ongoing peptide view tracking
      if (typeof psTrackPeptideViewEnd === 'function') psTrackPeptideViewEnd();
      // Track the page view
      if (typeof psTrackPageView === 'function') psTrackPageView(view);
      // Call original
      return _origNavigate.call(this, view, data);
    };
  }

  // ── Heartbeat ──
  setInterval(sendSessionUpdate, 30000); // Every 30 seconds

  // ── Flush on unload ──
  window.addEventListener('beforeunload', function() {
    flushEvents();
    sendSessionUpdate();
  });

  // ── Init ──
  // No consent banner - users opt in via Privacy Policy on sign-up.

  // Initial page view
  setTimeout(function() {
    if (canTrack()) psTrackPageView('home');
  }, 500);

  // Track initial session
  setTimeout(sendSessionUpdate, 3000);

  // ── D1 Site Analytics Beacon ──
  // Sends real visitor data to Cloudflare D1 for admin dashboard
  const VISITOR_KEY = 'ps_visitor_id';
  const VISIT_COUNT_KEY = 'ps_visit_count';
  let visitorId = localStorage.getItem(VISITOR_KEY);
  let isNewVisitor = false;
  if (!visitorId) {
    visitorId = 'v_' + Date.now() + '_' + Math.random().toString(36).substring(2, 10);
    localStorage.setItem(VISITOR_KEY, visitorId);
    isNewVisitor = true;
  }
  let visitCount = parseInt(localStorage.getItem(VISIT_COUNT_KEY) || '0') + 1;
  localStorage.setItem(VISIT_COUNT_KEY, String(visitCount));

  // Detect device, browser, OS
  function detectDevice() {
    const ua = navigator.userAgent;
    let device = 'desktop';
    if (/Mobi|Android/i.test(ua)) device = 'mobile';
    else if (/Tablet|iPad/i.test(ua)) device = 'tablet';

    let browser = 'other';
    if (/Edg\//i.test(ua)) browser = 'Edge';
    else if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) browser = 'Chrome';
    else if (/Firefox/i.test(ua)) browser = 'Firefox';
    else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
    else if (/Opera|OPR/i.test(ua)) browser = 'Opera';

    let os = 'other';
    if (/Windows/i.test(ua)) os = 'Windows';
    else if (/Mac OS/i.test(ua)) os = 'macOS';
    else if (/Linux/i.test(ua) && !/Android/i.test(ua)) os = 'Linux';
    else if (/Android/i.test(ua)) os = 'Android';
    else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';

    return { device, browser, os };
  }

  const deviceInfo = detectDevice();
  const sessionStartTime = Date.now();
  let beaconPageCount = 0;
  let lastBeaconPage = '';

  // Get UTM params
  const urlParams = new URLSearchParams(window.location.search);
  const utmSource = urlParams.get('utm_source') || '';
  const utmMedium = urlParams.get('utm_medium') || '';
  const utmCampaign = urlParams.get('utm_campaign') || '';

  function sendBeacon(eventType, extra) {
    const payload = {
      session_id: sessionId,
      visitor_id: visitorId,
      event_type: eventType,
      page: extra?.page || window.location.hash.replace('#', '') || 'home',
      referrer: document.referrer || '',
      utm_source: utmSource,
      utm_medium: utmMedium,
      utm_campaign: utmCampaign,
      device_type: deviceInfo.device,
      browser: deviceInfo.browser,
      os: deviceInfo.os,
      screen_width: screen.width || 0,
      screen_height: screen.height || 0,
      is_new_visitor: isNewVisitor,
      duration_ms: extra?.duration_ms || 0
    };
    // Use sendBeacon API if available for reliability during unload
    if (navigator.sendBeacon && eventType === 'session_end') {
      navigator.sendBeacon('/api/analytics/collect', JSON.stringify(payload));
    } else {
      fetch('/api/analytics/collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(() => {});
    }
  }

  // Session start beacon
  setTimeout(() => sendBeacon('session_start'), 500);

  // Track page views to D1 (patched into navigate)
  const _origNav = window.navigate;
  if (typeof _origNav === 'function') {
    window.navigate = function(view, data) {
      const pageName = view || 'home';
      if (pageName !== lastBeaconPage) {
        beaconPageCount++;
        lastBeaconPage = pageName;
        sendBeacon('pageview', { page: pageName });
      }
      return _origNav.call(this, view, data);
    };
  }

  // Initial pageview beacon
  setTimeout(() => {
    lastBeaconPage = 'home';
    beaconPageCount++;
    sendBeacon('pageview', { page: 'home' });
  }, 800);

  // Session end + bounce detection on unload
  window.addEventListener('beforeunload', function() {
    const duration = Date.now() - sessionStartTime;
    sendBeacon('session_end', { duration_ms: duration });
    if (beaconPageCount <= 1) {
      sendBeacon('bounce');
    }
  });

  // After first new-visitor session, mark as returning
  if (isNewVisitor) {
    window.addEventListener('beforeunload', function() {
      isNewVisitor = false;
    });
  }

  // ── D1 Peptide Interest Tracking ──
  // Sends peptide interaction data to D1 for admin analytics
  function sendPeptideBeacon(eventType, data) {
    fetch('/api/analytics/peptide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        visitor_id: visitorId,
        event_type: eventType,
        peptide_id: data.peptide_id || '',
        peptide_name: data.peptide_name || '',
        category: data.category || '',
        source: data.source || '',
        duration_sec: data.duration_sec || 0,
        search_query: data.search_query || '',
        device_type: deviceInfo.device
      })
    }).catch(() => {});
  }

  function sendSearchBeacon(query, resultsCount, clickedId, clickedName) {
    fetch('/api/analytics/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        visitor_id: visitorId,
        query: query || '',
        results_count: resultsCount || 0,
        clicked_peptide_id: clickedId || '',
        clicked_peptide_name: clickedName || ''
      })
    }).catch(() => {});
  }

  // Override existing tracking functions to also send to D1
  const _origPeptideView = window.psTrackPeptideView;
  window.psTrackPeptideView = function(peptideId, source) {
    // Call original
    if (typeof _origPeptideView === 'function') _origPeptideView(peptideId, source);
    // Find peptide info from the global list
    const pep = (window.peptides || []).find(function(p) { return p.id === peptideId; });
    sendPeptideBeacon('view', {
      peptide_id: peptideId,
      peptide_name: pep ? pep.name : peptideId,
      category: pep ? pep.category : '',
      source: source || ''
    });
  };

  const _origPeptideViewEnd = window.psTrackPeptideViewEnd;
  window.psTrackPeptideViewEnd = function() {
    // Calculate duration and send
    if (window._currentPeptideView) {
      const v = window._currentPeptideView;
      const dur = Math.round((Date.now() - v.start) / 1000);
      if (dur > 1) {
        const pep = (window.peptides || []).find(function(p) { return p.id === v.peptideId; });
        sendPeptideBeacon('view', {
          peptide_id: v.peptideId,
          peptide_name: pep ? pep.name : v.peptideId,
          category: pep ? pep.category : '',
          source: v.source || '',
          duration_sec: dur
        });
      }
    }
    if (typeof _origPeptideViewEnd === 'function') _origPeptideViewEnd();
  };

  const _origTrackSearch = window.psTrackSearch;
  window.psTrackSearch = function(query, resultsCount, clickedResult) {
    if (typeof _origTrackSearch === 'function') _origTrackSearch(query, resultsCount, clickedResult);
    sendSearchBeacon(query, resultsCount, clickedResult?.id, clickedResult?.name);
  };

  const _origCalc = window.psTrackCalculator;
  window.psTrackCalculator = function(peptideName, vialSize, waterMl, desiredDose) {
    if (typeof _origCalc === 'function') _origCalc(peptideName, vialSize, waterMl, desiredDose);
    const pep = (window.peptides || []).find(function(p) { return p.name === peptideName; });
    sendPeptideBeacon('calculator', {
      peptide_id: pep ? pep.id : '',
      peptide_name: peptideName || '',
      category: pep ? pep.category : ''
    });
  };

  const _origStack = window.psTrackStackBuild;
  window.psTrackStackBuild = function(stackName, peptideIds, goal) {
    if (typeof _origStack === 'function') _origStack(stackName, peptideIds, goal);
    (peptideIds || []).forEach(function(pid) {
      const pep = (window.peptides || []).find(function(p) { return p.id === pid; });
      sendPeptideBeacon('stack_add', {
        peptide_id: pid,
        peptide_name: pep ? pep.name : pid,
        category: pep ? pep.category : ''
      });
    });
  };

  // Track favorites (hook into localStorage changes)
  const _origSetItem = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function(key, value) {
    _origSetItem(key, value);
    if (key === 'ps_favorites') {
      try {
        const favs = JSON.parse(value);
        if (Array.isArray(favs) && favs.length > 0) {
          const lastFav = favs[favs.length - 1];
          if (lastFav) {
            const pep = (window.peptides || []).find(function(p) { return p.id === lastFav; });
            sendPeptideBeacon('favorite', {
              peptide_id: lastFav,
              peptide_name: pep ? pep.name : lastFav,
              category: pep ? pep.category : ''
            });
          }
        }
      } catch(e) {}
    }
  };

  // ── Market Intelligence Behavioral Tracking ──

  function sendBehaviorBeacon(eventType, data) {
    fetch('/api/analytics/behavior', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        visitor_id: visitorId,
        event_type: eventType,
        device_type: deviceInfo.device,
        ...data
      })
    }).catch(() => {});
  }

  // Infer intent signals from user behavior
  const goalMap = {
    'Healing': 'healing', 'Recovery': 'healing', 'Injury': 'healing',
    'Weight Loss': 'weight_loss', 'Fat Loss': 'weight_loss', 'GLP-1': 'weight_loss',
    'Growth Hormone': 'muscle', 'Muscle': 'muscle', 'Performance': 'muscle',
    'Anti-Aging': 'anti_aging', 'Skin': 'anti_aging', 'Longevity': 'anti_aging', 'Skin & Anti-Aging': 'anti_aging',
    'Nootropic': 'cognitive', 'Cognitive': 'cognitive', 'Brain': 'cognitive',
    'Immune': 'immune', 'Immunity': 'immune',
    'Sexual Health': 'sexual_health',
    'Sleep': 'sleep'
  };

  function inferGoal(category) {
    return goalMap[category] || '';
  }

  // Track funnel stages automatically
  let funnelSent = {};

  function trackFunnel(stage, peptideId, category) {
    const key = stage + (peptideId || '');
    if (funnelSent[key]) return;
    funnelSent[key] = true;
    sendBehaviorBeacon('funnel', { stage, peptide_id: peptideId || '', category: category || '' });
  }

  // Patch navigate to track funnel stages
  const _origNavFunnel = window.navigate;
  if (typeof _origNavFunnel === 'function') {
    window.navigate = function(view, data) {
      // Infer funnel stage from navigation
      if (view === 'home') trackFunnel('landing');
      else if (view === 'knowledge' || view === 'discover') trackFunnel('browse');
      else if (view === 'community') trackFunnel('community_engage');
      else if (view === 'account') trackFunnel('account_create');
      return _origNavFunnel.call(this, view, data);
    };
  }

  // Track initial landing
  setTimeout(() => trackFunnel('landing'), 1000);

  // Enhanced peptide view: also send demand signal
  const _origPepViewMI = window.psTrackPeptideView;
  window.psTrackPeptideView = function(peptideId, source) {
    if (typeof _origPepViewMI === 'function') _origPepViewMI(peptideId, source);
    const pep = (window.peptides || []).find(function(p) { return p.id === peptideId; });
    if (pep) {
      trackFunnel('deep_research', peptideId, pep.category);
      sendBehaviorBeacon('demand', {
        peptide_id: peptideId,
        peptide_name: pep.name,
        category: pep.category,
        goal: inferGoal(pep.category),
        signal_type: 'research'
      });
    }
  };

  // Enhanced calculator: send dosing intent demand signal
  const _origCalcMI = window.psTrackCalculator;
  window.psTrackCalculator = function(peptideName, vialSize, waterMl, desiredDose) {
    if (typeof _origCalcMI === 'function') _origCalcMI(peptideName, vialSize, waterMl, desiredDose);
    const pep = (window.peptides || []).find(function(p) { return p.name === peptideName; });
    if (pep) {
      trackFunnel('dosing_calc', pep.id, pep.category);
      sendBehaviorBeacon('demand', {
        peptide_id: pep.id,
        peptide_name: pep.name,
        category: pep.category,
        goal: inferGoal(pep.category),
        signal_type: 'dosing'
      });
    }
  };

  // Enhanced stack build: send combination tracking + demand signal
  const _origStackMI = window.psTrackStackBuild;
  window.psTrackStackBuild = function(stackName, peptideIds, goal) {
    if (typeof _origStackMI === 'function') _origStackMI(stackName, peptideIds, goal);
    trackFunnel('stack_build');
    // Build combination data
    const peps = (peptideIds || []).map(function(pid) {
      const p = (window.peptides || []).find(function(pp) { return pp.id === pid; });
      return { id: pid, name: p ? p.name : pid, category: p ? p.category : '' };
    });
    if (peps.length >= 2) {
      sendBehaviorBeacon('combination', { peptides: peps, combo_type: 'stack' });
    }
    // Demand signals for each
    peps.forEach(function(pep) {
      sendBehaviorBeacon('demand', {
        peptide_id: pep.id, peptide_name: pep.name, category: pep.category,
        goal: inferGoal(pep.category), signal_type: 'purchase'
      });
    });
  };

  // Track protocol views as funnel stage
  const _origProtocol = window.psTrackProtocolView;
  window.psTrackProtocolView = function(protocolId) {
    if (typeof _origProtocol === 'function') _origProtocol(protocolId);
    trackFunnel('protocol_view');
  };

  // Send user profile update on session end
  window.addEventListener('beforeunload', function() {
    const pepViewed = sessionData.peptidesViewed || 0;
    let level = 'beginner';
    if (pepViewed > 15 || (sessionData.pageViews || 0) > 30) level = 'advanced';
    else if (pepViewed > 5 || (sessionData.pageViews || 0) > 15) level = 'intermediate';
    if ((sessionData.featuresUsed || []).length > 4) level = 'researcher';

    sendBehaviorBeacon('profile_update', {
      experience_level: level,
      pageviews: sessionData.pageViews || 0,
      peptides_count: pepViewed,
      category: '', // Will be inferred from most viewed
      goal: ''
    });
  });

  // Return visit detection
  if (visitCount > 1) {
    setTimeout(() => trackFunnel('return_visit'), 2000);
  }

  console.log('[PeptideSafe Analytics] Initialized. Session:', sessionId, 'Consent:', consentLevel || 'pending');

  // ── Bot Detection Layer ──
  // Collects behavioral signals to score sessions for bot likelihood.
  // Scores are sent with the session_start and session_end beacons.
  (function() {
    var botSignals = {
      hasMouseMove: false,
      hasScroll: false,
      hasKeydown: false,
      hasClick: false,
      firstInteractionMs: 0,
      webdriver: false,
      headlessChrome: false,
      noPlugins: false,
      touchOnly: false,
      consistentTimings: false,
      uaHasBot: false,
      noLocalStorage: false,
      noSessionStorage: false,
      straightLineMouse: false,
      interactionCount: 0,
      mouseMoveCount: 0,
      mouseSamples: []
    };

    // Static signals - detectable immediately
    try {
      botSignals.webdriver = !!(navigator.webdriver);
      botSignals.headlessChrome = /HeadlessChrome/.test(navigator.userAgent);
      botSignals.uaHasBot = /bot|crawl|spider|slurp|python|curl|wget|scrapy|headless/i.test(navigator.userAgent);
      botSignals.noPlugins = navigator.plugins && navigator.plugins.length === 0;
      botSignals.noLocalStorage = typeof localStorage === 'undefined';
      botSignals.noSessionStorage = typeof sessionStorage === 'undefined';
      // Timing consistency check - bots often have very precise performance.now() values
      var t1 = performance.now();
      var t2 = performance.now();
      botSignals.consistentTimings = (t2 - t1) === 0;
    } catch(e) {}

    // Behavioral signals - require user interaction
    function firstInteraction() {
      if (!botSignals.firstInteractionMs) {
        botSignals.firstInteractionMs = Math.round(performance.now());
      }
      botSignals.interactionCount++;
    }

    // Mouse movement - bots rarely move the mouse
    document.addEventListener('mousemove', function(e) {
      botSignals.hasMouseMove = true;
      botSignals.mouseMoveCount++;
      firstInteraction();
      // Sample mouse positions for straight-line detection (bots move in straight lines)
      if (botSignals.mouseSamples.length < 10) {
        botSignals.mouseSamples.push({ x: e.clientX, y: e.clientY });
      }
    }, { passive: true });

    document.addEventListener('scroll', function() {
      botSignals.hasScroll = true;
      firstInteraction();
    }, { passive: true });

    document.addEventListener('keydown', function() {
      botSignals.hasKeydown = true;
      firstInteraction();
    }, { passive: true });

    document.addEventListener('click', function() {
      botSignals.hasClick = true;
      firstInteraction();
    }, { passive: true });

    // Compute bot score (0-100, higher = more bot-like)
    function computeBotScore() {
      var score = 0;
      var flags = [];

      // Hard indicators (+30 each)
      if (botSignals.webdriver) { score += 30; flags.push('webdriver'); }
      if (botSignals.headlessChrome) { score += 30; flags.push('headless'); }
      if (botSignals.uaHasBot) { score += 30; flags.push('bot_ua'); }

      // Strong indicators (+15 each)
      if (!botSignals.hasMouseMove) { score += 15; flags.push('no_mouse'); }
      if (!botSignals.hasScroll) { score += 15; flags.push('no_scroll'); }
      if (!botSignals.hasClick) { score += 10; flags.push('no_click'); }

      // Moderate indicators (+10 each)
      if (botSignals.noPlugins) { score += 10; flags.push('no_plugins'); }
      if (botSignals.consistentTimings) { score += 10; flags.push('precise_timing'); }
      if (!botSignals.hasKeydown && !botSignals.hasClick && !botSignals.hasScroll) { score += 10; flags.push('no_interaction'); }

      // Duration check - sessions under 2s with no interaction are suspicious
      var duration = Date.now() - sessionStartTime;
      if (duration < 2000 && botSignals.interactionCount === 0) { score += 15; flags.push('ultra_short'); }

      // Straight-line mouse movement detection
      if (botSignals.mouseSamples.length >= 5) {
        var samples = botSignals.mouseSamples;
        var dxTotal = 0, dyTotal = 0, straightCount = 0;
        for (var i = 1; i < samples.length; i++) {
          var dx = samples[i].x - samples[i-1].x;
          var dy = samples[i].y - samples[i-1].y;
          dxTotal += Math.abs(dx);
          dyTotal += Math.abs(dy);
          // Check if consecutive movements are in exact same direction
          if (i > 1) {
            var prevDx = samples[i-1].x - samples[i-2].x;
            var prevDy = samples[i-1].y - samples[i-2].y;
            if (dx === prevDx && dy === prevDy) straightCount++;
          }
        }
        if (straightCount >= 3) { score += 10; flags.push('straight_mouse'); }
      }

      // Cap at 100
      return { score: Math.min(100, score), flags: flags };
    }

    // Determine if likely bot (score >= 40)
    function isSuspectedBot() {
      var result = computeBotScore();
      return result.score >= 40;
    }

    // Override sendBeacon to include bot score
    var _origSendBeacon = sendBeacon;
    sendBeacon = function(eventType, extra) {
      // Compute bot score for this session
      var botResult = computeBotScore();
      var payload = {
        session_id: sessionId,
        visitor_id: visitorId,
        event_type: eventType,
        page: extra?.page || window.location.hash.replace('#', '') || 'home',
        referrer: document.referrer || '',
        utm_source: utmSource,
        utm_medium: utmMedium,
        utm_campaign: utmCampaign,
        device_type: deviceInfo.device,
        browser: deviceInfo.browser,
        os: deviceInfo.os,
        screen_width: screen.width || 0,
        screen_height: screen.height || 0,
        is_new_visitor: isNewVisitor,
        duration_ms: extra?.duration_ms || 0,
        bot_score: botResult.score,
        bot_flags: botResult.flags.join(','),
        is_bot_suspected: botResult.score >= 40
      };
      if (navigator.sendBeacon && eventType === 'session_end') {
        navigator.sendBeacon('/api/analytics/collect', JSON.stringify(payload));
      } else {
        fetch('/api/analytics/collect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }).catch(function() {});
      }
    };

    // Expose bot score for debugging (non-enumerable, doesn't pollute namespace)
    Object.defineProperty(window, '__psBot', {
      get: function() { return computeBotScore(); },
      configurable: true
    });

    // Send bot_suspected event if score is high after 10 seconds
    setTimeout(function() {
      var result = computeBotScore();
      if (result.score >= 50) {
        fetch('/api/analytics/collect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionId,
            visitor_id: visitorId,
            event_type: 'bot_suspected',
            page: window.location.hash.replace('#', '') || 'home',
            referrer: document.referrer || '',
            utm_source: utmSource,
            utm_medium: utmMedium,
            utm_campaign: utmCampaign,
            device_type: deviceInfo.device,
            browser: deviceInfo.browser,
            os: deviceInfo.os,
            screen_width: screen.width || 0,
            screen_height: screen.height || 0,
            is_new_visitor: isNewVisitor,
            duration_ms: 0,
            bot_score: result.score,
            bot_flags: result.flags.join(','),
            is_bot_suspected: true
          })
        }).catch(function() {});
      }
    }, 10000);
  })();
})();
