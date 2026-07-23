/**
 * ResearchSafe AI Chat - Supports homepage chat + contextual detail popup chat
 * Features: persistence, voice input, response actions, AI spotlight
 */
(function() {
  'use strict';

  // Mirror the server's authoritative AI freewall count into the meter. Called
  // after every successful /ai/chat response using the X-AI-* headers.
  function syncAiMeter(response) {
    try {
      if (!response || !response.headers) return;
      var rem = response.headers.get('X-AI-Remaining');
      var lim = response.headers.get('X-AI-Limit');
      var li = response.headers.get('X-AI-LoggedIn') === '1';
      var bonus = response.headers.get('X-AI-Bonus');
      var bonusLeft = response.headers.get('X-AI-BonusLeft');
      if (rem !== null && window.__referral && window.__referral.syncFromServer) {
        window.__referral.syncFromServer(rem, lim, li, bonus, bonusLeft);
      }
    } catch (e) {}
  }

  // ─── Chat Persistence ─────────────────────────────────────────────────────
  function saveChatState(id) {
    try {
      const state = chatState[id];
      if (state && state.messages.length > 0) {
        localStorage.setItem(`rs_chat_${id}`, JSON.stringify(state.messages.slice(-20)));
      }
    } catch {}
  }
  function loadChatState(id) {
    try {
      const saved = localStorage.getItem(`rs_chat_${id}`);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  }
  function clearChatStorage(id) {
    try { localStorage.removeItem(`rs_chat_${id}`); } catch {}
  }

  // ─── Resizable chat sidebar ───────────────────────────────────────────────
  // Lets the user drag the left edge of a right-anchored chat sidebar to set its
  // width. The chosen width is shared across all chat sidebars and persisted.
  const CHAT_WIDTH_KEY = 'rs_chat_width';
  const CHAT_WIDTH_MIN = 300;
  const CHAT_WIDTH_DEFAULT = 360;

  function chatWidthMax() {
    // Never let the chat eat the whole screen; leave room for the page content.
    return Math.max(CHAT_WIDTH_MIN, Math.min(720, Math.round(window.innerWidth * 0.7)));
  }

  function clampChatWidth(w) {
    return Math.max(CHAT_WIDTH_MIN, Math.min(chatWidthMax(), Math.round(w)));
  }

  function getStoredChatWidth() {
    try {
      const v = parseInt(localStorage.getItem(CHAT_WIDTH_KEY) || '', 10);
      if (!isNaN(v)) return clampChatWidth(v);
    } catch {}
    return CHAT_WIDTH_DEFAULT;
  }

  function applyChatWidth(w) {
    const width = clampChatWidth(w);
    // Drive a CSS variable so the sidebar AND the reserved content margin stay
    // in sync (see bridge.css --rs-chat-width usages).
    document.documentElement.style.setProperty('--rs-chat-width', width + 'px');
  }

  function makeChatSidebarResizable(sidebarEl) {
    if (!sidebarEl || sidebarEl.querySelector('.rs-chat-resize-handle')) return;
    // Don't make it resizable on mobile, where sidebars are full-width / hidden.
    if (window.matchMedia('(max-width: 768px)').matches) return;

    // Apply any previously stored width up front (drives the shared CSS var).
    applyChatWidth(getStoredChatWidth());

    const handle = document.createElement('div');
    handle.className = 'rs-chat-resize-handle';
    handle.setAttribute('role', 'separator');
    handle.setAttribute('aria-orientation', 'vertical');
    handle.setAttribute('aria-label', 'Resize chat width');
    handle.title = 'Drag to resize · double-click to reset';
    sidebarEl.appendChild(handle);

    let startX = 0;
    let startWidth = 0;

    function onMove(clientX) {
      // Sidebar is anchored to the right, so dragging left widens it.
      const delta = startX - clientX;
      applyChatWidth(startWidth + delta);
    }
    function onPointerMove(e) { onMove(e.clientX); }
    function onPointerUp() {
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
      document.body.classList.remove('rs-chat-resizing');
      try {
        localStorage.setItem(CHAT_WIDTH_KEY, String(sidebarEl.getBoundingClientRect().width | 0));
      } catch {}
    }
    handle.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      startX = e.clientX;
      startWidth = sidebarEl.getBoundingClientRect().width;
      document.body.classList.add('rs-chat-resizing');
      document.addEventListener('pointermove', onPointerMove);
      document.addEventListener('pointerup', onPointerUp);
    });
    // Double-click the handle to reset to the default width.
    handle.addEventListener('dblclick', () => {
      applyChatWidth(CHAT_WIDTH_DEFAULT);
      try { localStorage.setItem(CHAT_WIDTH_KEY, String(CHAT_WIDTH_DEFAULT)); } catch {}
    });
  }

  // ─── Resizable detail-popup chat panel ────────────────────────────────────
  // The detail modal lays the chat panel out as a flex child (chat on the right,
  // detail content on the left). Dragging the handle widens the chat and shrinks
  // the detail content, driven by --rs-detail-chat-width.
  const DETAIL_CHAT_WIDTH_KEY = 'rs_detail_chat_width';
  const DETAIL_CHAT_WIDTH_MIN = 280;
  const DETAIL_CHAT_WIDTH_DEFAULT = 340;

  function detailChatWidthMax() {
    return Math.max(DETAIL_CHAT_WIDTH_MIN, Math.min(640, Math.round(window.innerWidth * 0.55)));
  }
  function clampDetailChatWidth(w) {
    return Math.max(DETAIL_CHAT_WIDTH_MIN, Math.min(detailChatWidthMax(), Math.round(w)));
  }
  function getStoredDetailChatWidth() {
    try {
      const v = parseInt(localStorage.getItem(DETAIL_CHAT_WIDTH_KEY) || '', 10);
      if (!isNaN(v)) return clampDetailChatWidth(v);
    } catch {}
    return DETAIL_CHAT_WIDTH_DEFAULT;
  }
  function applyDetailChatWidth(w) {
    document.documentElement.style.setProperty('--rs-detail-chat-width', clampDetailChatWidth(w) + 'px');
  }

  function makeDetailChatResizable(panelEl) {
    if (!panelEl || panelEl.querySelector('.rs-chat-resize-handle')) return;
    // Below 900px the modal stacks vertically (chat full-width), so no resize.
    if (window.matchMedia('(max-width: 900px)').matches) return;

    applyDetailChatWidth(getStoredDetailChatWidth());

    const handle = document.createElement('div');
    handle.className = 'rs-chat-resize-handle';
    handle.setAttribute('role', 'separator');
    handle.setAttribute('aria-orientation', 'vertical');
    handle.setAttribute('aria-label', 'Resize chat width');
    handle.title = 'Drag to resize · double-click to reset';
    panelEl.appendChild(handle);

    let startX = 0;
    let startWidth = 0;
    function onPointerMove(e) {
      const delta = startX - e.clientX;
      applyDetailChatWidth(startWidth + delta);
    }
    function onPointerUp() {
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
      document.body.classList.remove('rs-chat-resizing');
      try { localStorage.setItem(DETAIL_CHAT_WIDTH_KEY, String(panelEl.getBoundingClientRect().width | 0)); } catch {}
    }
    handle.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      startX = e.clientX;
      startWidth = panelEl.getBoundingClientRect().width;
      document.body.classList.add('rs-chat-resizing');
      document.addEventListener('pointermove', onPointerMove);
      document.addEventListener('pointerup', onPointerUp);
    });
    handle.addEventListener('dblclick', () => {
      applyDetailChatWidth(DETAIL_CHAT_WIDTH_DEFAULT);
      try { localStorage.setItem(DETAIL_CHAT_WIDTH_KEY, String(DETAIL_CHAT_WIDTH_DEFAULT)); } catch {}
    });
  }

  // ─── Onboarding Quiz ────────────────────────────────────────────────────────
  const QUIZ_GOALS = [
    { id: 'healing', label: 'Injury Recovery & Healing', icon: 'fa-band-aid' },
    { id: 'fat-loss', label: 'Fat Loss & Body Composition', icon: 'fa-fire' },
    { id: 'muscle', label: 'Muscle Growth & Recovery', icon: 'fa-dumbbell' },
    { id: 'longevity', label: 'Longevity & Anti-Aging', icon: 'fa-hourglass-half' },
    { id: 'cognitive', label: 'Cognitive Enhancement', icon: 'fa-brain' },
    { id: 'sleep', label: 'Sleep & Relaxation', icon: 'fa-moon' },
    { id: 'immunity', label: 'Immune Support', icon: 'fa-shield-virus' },
    { id: 'skin', label: 'Skin & Hair', icon: 'fa-spa' },
  ];

  function injectOnboardingQuiz(insertAfter) {
    if (localStorage.getItem('rs_onboarding_done')) return;
    if (document.getElementById('rsOnboardingQuiz')) return;

    const quiz = document.createElement('div');
    quiz.id = 'rsOnboardingQuiz';
    quiz.className = 'rs-onboarding';
    quiz.innerHTML = `
      <div class="rs-onboarding-header">
        <div class="rs-onboarding-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>
          What brings you to peptide research?
        </div>
        <p class="rs-onboarding-subtitle">Select your goals and we'll recommend personalized starting points</p>
      </div>
      <div class="rs-onboarding-goals">
        ${QUIZ_GOALS.map(g => `
          <button class="rs-onboarding-goal" data-goal="${g.id}" onclick="window.__rsChat.toggleGoal(this)">
            <i class="fas ${g.icon}"></i>
            <span>${g.label}</span>
          </button>
        `).join('')}
      </div>
      <div class="rs-onboarding-actions">
        <button class="rs-onboarding-submit" onclick="window.__rsChat.submitQuiz()" disabled>Get Recommendations</button>
        <button class="rs-onboarding-skip" onclick="window.__rsChat.skipQuiz()">Skip for now</button>
      </div>
      <div class="rs-onboarding-result" id="rsQuizResult" style="display:none"></div>
    `;

    insertAfter.insertAdjacentElement('afterend', quiz);
  }

  function toggleGoal(btn) {
    btn.classList.toggle('selected');
    const submitBtn = btn.closest('.rs-onboarding')?.querySelector('.rs-onboarding-submit');
    const anySelected = btn.closest('.rs-onboarding-goals')?.querySelector('.selected');
    if (submitBtn) submitBtn.disabled = !anySelected;
  }

  function skipQuiz() {
    localStorage.setItem('rs_onboarding_done', '1');
    const quiz = document.getElementById('rsOnboardingQuiz');
    if (quiz) quiz.remove();
  }

  async function submitQuiz() {
    const quiz = document.getElementById('rsOnboardingQuiz');
    if (!quiz) return;
    const selected = Array.from(quiz.querySelectorAll('.rs-onboarding-goal.selected'))
      .map(b => b.dataset.goal);

    if (selected.length === 0) return;

    localStorage.setItem('rs_onboarding_done', '1');
    localStorage.setItem('rs_user_goals', JSON.stringify(selected));

    // Hide goals/actions, show result
    quiz.querySelector('.rs-onboarding-goals').style.display = 'none';
    quiz.querySelector('.rs-onboarding-actions').style.display = 'none';
    quiz.querySelector('.rs-onboarding-subtitle').textContent = 'Generating your personalized recommendations...';
    const resultEl = quiz.querySelector('#rsQuizResult');
    resultEl.style.display = 'block';
    resultEl.innerHTML = '<span class="rs-chat-typing"><span></span><span></span><span></span></span>';

    const goalNames = selected.map(id => QUIZ_GOALS.find(g => g.id === id)?.label).join(', ');
    const prompt = `The user is new to peptide research. Their goals are: ${goalNames}. Give a brief personalized welcome (1-2 sentences) and recommend 3-4 specific peptides to explore, with a one-line explanation for each. Link to their detail pages using markdown [Name](/peptides/id).`;

    let attempts = 0;
    const maxAttempts = 2;

    while (attempts < maxAttempts) {
      attempts++;
      try {
        let fullText = '';
        const response = await fetch('/ai/chat', {
          method: 'POST',
          headers: (typeof window.authHeaders === 'function') ? window.authHeaders() : { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: [{ role: 'user', content: prompt }] }),
        });

        if (!response.ok) {
          if (attempts < maxAttempts) { await new Promise(r => setTimeout(r, 1500)); continue; }
          throw new Error('unavailable');
        }

        syncAiMeter(response);
      const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.choices && parsed.choices[0]?.delta?.content) {
                fullText += parsed.choices[0].delta.content;
                resultEl.innerHTML = renderMarkdown(fullText);
              }
            } catch {}
          }
        }
        if (fullText) return; // Success, exit
        if (attempts < maxAttempts) { await new Promise(r => setTimeout(r, 1500)); continue; }
      } catch {
        if (attempts < maxAttempts) { await new Promise(r => setTimeout(r, 1500)); continue; }
      }
    }

    // Final fallback with useful content
    const goalMap = {
      'healing': '[BPC-157](/peptides/bpc-157) for tissue repair, [TB-500](/peptides/tb-500) for systemic healing',
      'fat-loss': '[Semaglutide](/peptides/semaglutide) for appetite regulation, [AOD-9604](/peptides/aod-9604) for fat metabolism',
      'muscle': '[CJC-1295](/peptides/cjc-1295) + [Ipamorelin](/peptides/ipamorelin) for growth hormone release',
      'longevity': '[Epithalon](/peptides/epithalon) for telomere support, [MOTS-c](/peptides/mots-c) for mitochondrial health',
      'cognitive': '[Semax](/peptides/semax) for neuroprotection, [Selank](/peptides/selank) for focus & anxiety',
      'sleep': '[DSIP](/peptides/dsip) for sleep quality, [Selank](/peptides/selank) for relaxation',
      'immunity': '[Thymosin Alpha-1](/peptides/thymosin-alpha-1) for immune modulation, [LL-37](/peptides/ll-37) for antimicrobial defense',
      'skin': '[GHK-Cu](/peptides/ghk-cu) for collagen production, [Epithalon](/peptides/epithalon) for cellular renewal',
    };
    const recs = selected.map(g => goalMap[g] || '').filter(Boolean).join('. ');
    resultEl.innerHTML = renderMarkdown(`Based on your goals, here are some great starting points:\n\n${recs}.\n\nExplore each peptide's detail page for full research profiles and dosing information.`);
  }

  const CHAT_SUGGESTIONS = [
    'What is BPC-157 and how does it work?',
    'Compare Semaglutide vs Tirzepatide',
    'Explain the CJC-1295 + Ipamorelin stack',
    'What are the safety concerns with Melanotan II?',
    'How do I reconstitute a peptide?',
  ];

  // State per chat instance
  const chatState = {
    home: { messages: [], streaming: false, abort: null },
    mobile: { messages: [], streaming: false, abort: null },
    detail: { messages: [], streaming: false, abort: null, peptideName: '' },
    fullpage: { messages: [], streaming: false, abort: null, peptideName: '' },
    mobiledetail: { messages: [], streaming: false, abort: null, peptideName: '' },
    calc: { messages: [], streaming: false, abort: null },
    kb: { messages: [], streaming: false, abort: null },
    protocols: { messages: [], streaming: false, abort: null },
    builder: { messages: [], streaming: false, abort: null },
    research: { messages: [], streaming: false, abort: null },
  };

  function getDetailSuggestions(name) {
    return [
      `What are the benefits of ${name} for humans?`,
      `What is the recommended dosing protocol for ${name}?`,
      `What are the side effects of ${name}?`,
      `Can ${name} be stacked with other peptides?`,
      `What does the research say about ${name}?`,
    ];
  }

  // The desktop sidebar ('fullpage') and the mobile sheet ('mobiledetail')
  // share one running conversation thread so it persists across compounds and
  // across reloads. This holds the shared messages + the last peptide we set
  // context for, so we can detect a compound switch and insert a divider.
  const DETAIL_THREAD_KEY = 'rs_chat_detail_thread';
  let _detailThread = (function () {
    try {
      const raw = localStorage.getItem(DETAIL_THREAD_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.slice(-40);
      }
    } catch (e) {}
    return [];
  })();
  let _detailLastPeptide = null;

  function saveDetailThread() {
    try { localStorage.setItem(DETAIL_THREAD_KEY, JSON.stringify(_detailThread.slice(-40))); } catch (e) {}
  }
  window.__rsClearDetailThread = function () {
    _detailThread.length = 0;
    _detailLastPeptide = null;
    saveDetailThread();
  };

  // Called by both detail-chat injectors on every compound page load. Keeps the
  // running conversation instead of wiping it and points the AI context at the
  // current compound. The compound-switch divider is inserted lazily (only when
  // the user actually sends the next message) so we never render empty or
  // stacked dividers for compounds that were merely visited.
  function prepareDetailChatState(id, peptideName) {
    const state = chatState[id];
    if (!state) return;
    // Point both detail chats at the shared thread + current compound.
    chatState.fullpage.messages = _detailThread;
    chatState.mobiledetail.messages = _detailThread;
    chatState.fullpage.peptideName = peptideName;
    chatState.mobiledetail.peptideName = peptideName;
    saveDetailThread();
  }

  // Records which peptide the last real message belonged to, so send() can tell
  // when to drop a "now asking about X" divider in front of the next message.
  function lastThreadPeptide() {
    for (let i = _detailThread.length - 1; i >= 0; i--) {
      const m = _detailThread[i];
      if (m && m.role === 'divider') return m.content;
      if (m && m.role === 'user' && m._peptide) return m._peptide;
    }
    return null;
  }

  function createChatHTML(id, suggestions, placeholder, title) {
    const suggestionsHTML = suggestions.map(s =>
      `<button class="rs-chat-suggestion" onclick="window.__rsChat.sendSuggestion(this, '${id}')">${s}</button>`
    ).join('');

    return `
      <div class="rs-chat-container rs-chat-${id}" id="rsChatContainer_${id}">
        <div class="rs-chat-header">
          <div class="rs-chat-header-left">
            <div class="rs-chat-avatar">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>
            </div>
            <div class="rs-chat-header-text">
              <span class="rs-chat-header-title">${title || 'ResearchSafe AI'}</span>
              <span class="rs-chat-header-badge">AI</span>
            </div>
          </div>
          <button class="rs-chat-clear" onclick="window.__rsChat.clear('${id}')" title="Clear conversation">
            <i class="fas fa-rotate-right"></i>
          </button>
          <button class="rs-chat-minimize" onclick="window.__rsChat.togglePanel('${id}')" title="Minimize">
            <i class="fas fa-minus"></i>
          </button>
        </div>
        <div class="rs-chat-messages" id="rsChatMessages_${id}">
          <div class="rs-chat-welcome">
            <div class="rs-chat-welcome-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>
            </div>
            <p class="rs-chat-welcome-text">${(id === 'detail' || id === 'fullpage' || id === 'mobiledetail') ? 'Ask questions about this peptide - benefits, dosing, safety, stacking, and more.'
      : id === 'calc' ? 'Ask about reconstitution, syringe measurements, storage, or peptide preparation.'
      : id === 'kb' ? 'Ask which peptide is right for your research goals.'
      : id === 'protocols' ? 'Ask about protocols, loading phases, cycling, and scheduling.'
      : id === 'builder' ? 'Ask about stack compatibility, synergies, and timing.'
      : id === 'research' ? 'Ask about studies, clinical trials, and evidence quality.'
      : 'Ask me anything about peptides, protocols, dosing, interactions, or safety research.'}</p>
            <div class="rs-chat-suggestions">${suggestionsHTML}</div>
          </div>
        </div>
        <div class="rs-chat-input-area">
          <div class="rs-chat-input-wrapper">
            <textarea
              id="rsChatInput_${id}"
              class="rs-chat-input"
              placeholder="${placeholder || 'Ask about peptides...'}"
              rows="1"
              onkeydown="window.__rsChat.handleKey(event, '${id}')"
              oninput="window.__rsChat.autoResize(this, '${id}')"
            ></textarea>
            <button class="rs-chat-voice" id="rsChatVoice_${id}" onclick="window.__rsChat.toggleVoice('${id}')" title="Voice input">
              <i class="fas fa-microphone"></i>
            </button>
            <button class="rs-chat-send" id="rsChatSend_${id}" onclick="window.__rsChat.send('${id}')" disabled>
              <i class="fas fa-arrow-up"></i>
            </button>
          </div>
          <div class="rs-chat-disclaimer">Research & education only - not medical advice</div>
          <button type="button" class="rs-chat-earn" data-ai-earn><i class="fas fa-bolt"></i> Earn more AI credits</button>
          <div class="rs-ai-meter" id="rsAiMeter_${id}"></div>
        </div>
      </div>
    `;
  }

  // ─── Homepage chat injection ──────────────────────────────────────────────
  function injectHomeChat() {
    const contentArea = document.getElementById('contentArea');
    if (!contentArea) return;
    const homeView = contentArea.querySelector('.home-view');
    if (!homeView) return;
    if (document.getElementById('rsChatContainer_home')) return;
    const pageHero = homeView.querySelector('.home-chat-anchor') || homeView.querySelector('.page-hero');
    if (!pageHero) return;

    // Inject onboarding quiz for first-time visitors
    injectOnboardingQuiz(pageHero);

    const chatWrapper = document.createElement('div');
    chatWrapper.className = 'rs-chat-wrapper rs-chat-wrapper-home';
    chatWrapper.innerHTML = createChatHTML('home', CHAT_SUGGESTIONS, 'Ask about peptides, dosing, protocols...', 'ResearchSafe AI');
    pageHero.insertAdjacentElement('afterend', chatWrapper);

    // Restore persisted messages
    const saved = loadChatState('home');
    if (saved.length > 0) {
      chatState.home.messages = saved;
      const messagesEl = document.getElementById('rsChatMessages_home');
      if (messagesEl) {
        const welcome = messagesEl.querySelector('.rs-chat-welcome');
        if (welcome) welcome.remove();
        saved.forEach(msg => {
          const msgEl = document.createElement('div');
          msgEl.className = `rs-chat-msg rs-chat-msg-${msg.role}`;
          if (msg.role === 'assistant') {
            msgEl.innerHTML = `
              <div class="rs-chat-msg-avatar">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>
              </div>
              <div class="rs-chat-msg-body">
                <div class="rs-chat-msg-content">${renderMarkdown(splitFollowups(msg.content).answer)}</div>
                <div class="rs-chat-msg-actions">
                  <button onclick="window.__rsChat.copyMsg(this)" title="Copy"><i class="fas fa-copy"></i></button>
                  <button onclick="window.__rsChat.regenerate('home')" title="Regenerate"><i class="fas fa-rotate-right"></i></button>
                  <button class="rs-fb-btn" data-fb="up" onclick="window.__rsChat.feedback(this,'up')" title="Helpful"><i class="far fa-thumbs-up"></i></button>
                  <button class="rs-fb-btn" data-fb="down" onclick="window.__rsChat.feedback(this,'down')" title="Not helpful / suggest a correction"><i class="far fa-thumbs-down"></i></button>
                </div>
              </div>
            `;
          } else {
            msgEl.innerHTML = `<div class="rs-chat-msg-content">${escapeHtml(msg.content)}</div>`;
          }
          messagesEl.appendChild(msgEl);
        });
        messagesEl.scrollTop = messagesEl.scrollHeight;
      }
    }

    const input = document.getElementById('rsChatInput_home');
    if (input) {
      input.addEventListener('input', () => {
        const btn = document.getElementById('rsChatSend_home');
        if (btn) btn.disabled = !input.value.trim();
      });
    }
  }

  // ─── Detail popup chat injection ──────────────────────────────────────────
  function injectDetailChat() {
    const overlay = document.getElementById('detailOverlay');
    if (!overlay || !overlay.classList.contains('open')) return;
    if (overlay.querySelector('.rs-chat-detail-panel')) return;

    const panel = overlay.querySelector('.detail-panel');
    if (!panel) return;

    // Get peptide name from the panel header
    const nameEl = panel.querySelector('h2');
    const peptideName = nameEl ? nameEl.textContent.trim() : 'this peptide';

    // Reset detail chat state for new peptide
    chatState.detail.messages = [];
    chatState.detail.peptideName = peptideName;

    // Enrich detail panel with additional human-use data
    enrichDetailPanel(panel, peptideName);

    // Wrap existing panel and add chat panel to the right
    const wrapper = document.createElement('div');
    wrapper.className = 'rs-detail-with-chat';

    // Move the existing panel into the wrapper
    panel.parentNode.insertBefore(wrapper, panel);
    wrapper.appendChild(panel);

    // Create chat panel
    const chatPanel = document.createElement('div');
    chatPanel.className = 'rs-chat-detail-panel';
    chatPanel.innerHTML = createChatHTML(
      'detail',
      getDetailSuggestions(peptideName),
      `Ask about ${peptideName}...`,
      `Ask about ${peptideName}`
    );
    wrapper.appendChild(chatPanel);
    makeDetailChatResizable(chatPanel);

    const input = document.getElementById('rsChatInput_detail');
    if (input) {
      input.addEventListener('input', () => {
        const btn = document.getElementById('rsChatSend_detail');
        if (btn) btn.disabled = !input.value.trim();
      });
    }
  }

  function enrichDetailPanel(panel, peptideName) {
    const enrich = window.__peptideEnrich;
    if (!enrich) return;

    // Find matching peptide data by normalizing the name to ID format
    const id = peptideName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    const data = enrich[id];
    if (!data) return;

    const body = panel.querySelector('.detail-body');
    if (!body) return;

    // Find the right spot to inject (after existing mechanism or after overview)
    const sections = body.querySelectorAll('.detail-section');
    let insertAfter = sections[0]; // After overview

    // Check if mechanism already exists
    let hasMechanism = false;
    sections.forEach(s => {
      const title = s.querySelector('.detail-section-title');
      if (title && title.textContent.includes('Mechanism')) hasMechanism = true;
    });

    // Add mechanism if not already present
    if (!hasMechanism && data.mechanism) {
      const mechSection = document.createElement('div');
      mechSection.className = 'detail-section';
      mechSection.innerHTML = `<div class="detail-section-title">Mechanism of Action</div><p class="detail-text">${data.mechanism}</p>`;
      insertAfter.insertAdjacentElement('afterend', mechSection);
      insertAfter = mechSection;
    }

    // Add Human Benefits section
    if (data.humanBenefits && data.humanBenefits.length > 0) {
      const benefitsSection = document.createElement('div');
      benefitsSection.className = 'detail-section';
      benefitsSection.innerHTML = `<div class="detail-section-title"><i class="fas fa-heart-pulse" style="margin-right:6px;opacity:0.7"></i>Human Benefits & Applications</div><ul class="detail-list">${data.humanBenefits.map(b => `<li>${b}</li>`).join('')}</ul>`;
      // Insert before the action buttons (last sections)
      const actionBtns = body.querySelector('.research-detail-btn');
      if (actionBtns) {
        actionBtns.closest('.detail-section').insertAdjacentElement('beforebegin', benefitsSection);
      } else {
        body.appendChild(benefitsSection);
      }
    }

    // Add Side Effects section if not present
    let hasSideEffects = false;
    sections.forEach(s => {
      const title = s.querySelector('.detail-section-title');
      if (title && title.textContent.includes('Side Effect')) hasSideEffects = true;
    });

    if (!hasSideEffects && data.sideEffects && data.sideEffects.length > 0) {
      const seSection = document.createElement('div');
      seSection.className = 'detail-section';
      seSection.innerHTML = `<div class="detail-section-title"><i class="fas fa-triangle-exclamation" style="margin-right:6px;opacity:0.7"></i>Side Effects & Safety</div><ul class="detail-list">${data.sideEffects.map(s => `<li>${s}</li>`).join('')}</ul>`;
      const actionBtns = body.querySelector('.research-detail-btn');
      if (actionBtns) {
        actionBtns.closest('.detail-section').insertAdjacentElement('beforebegin', seSection);
      } else {
        body.appendChild(seSection);
      }
    }

    // Add Research Status section if not present
    let hasResearch = false;
    sections.forEach(s => {
      const title = s.querySelector('.detail-section-title');
      if (title && title.textContent.includes('Research Status')) hasResearch = true;
    });

    if (!hasResearch && data.researchStatus && data.researchStatus.length > 0) {
      const rsSection = document.createElement('div');
      rsSection.className = 'detail-section';
      rsSection.innerHTML = `<div class="detail-section-title"><i class="fas fa-flask-vial" style="margin-right:6px;opacity:0.7"></i>Research Status</div><ul class="detail-list">${data.researchStatus.map(r => `<li>${r}</li>`).join('')}</ul>`;
      const actionBtns = body.querySelector('.research-detail-btn');
      if (actionBtns) {
        actionBtns.closest('.detail-section').insertAdjacentElement('beforebegin', rsSection);
      } else {
        body.appendChild(rsSection);
      }
    }
  }

  // ─── Related Peptides ("You might also like") ──────────────────────────────
  function injectRelatedPeptides(container, peptideName) {
    if (container.querySelector('.rs-related')) return;
    const allPeptides = window.peptides;
    if (!allPeptides || allPeptides.length === 0) return;

    const id = peptideName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    const current = allPeptides.find(p => p.id === id);
    if (!current) return;

    // Score each peptide by relevance
    const scored = allPeptides
      .filter(p => p.id !== id)
      .map(p => {
        let score = 0;
        if (p.category === current.category) score += 3;
        const sharedTags = (p.tags || []).filter(t => (current.tags || []).includes(t));
        score += sharedTags.length * 2;
        if ((current.stacksWith || []).includes(p.name)) score += 5;
        if ((p.stacksWith || []).includes(current.name)) score += 4;
        return { ...p, score };
      })
      .filter(p => p.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);

    if (scored.length === 0) return;

    const section = document.createElement('div');
    section.className = 'rs-related';
    section.innerHTML = `
      <div class="rs-related-title">
        <i class="fas fa-diagram-project"></i>
        You might also like
      </div>
      <div class="rs-related-grid">
        ${scored.map(p => `
          <button class="rs-related-card" onclick="navigate('peptide-detail','${p.id}')">
            <span class="rs-related-badge" style="background:${p.categoryColor || '#6b7280'}">${p.category}</span>
            <span class="rs-related-name">${p.name}</span>
            <span class="rs-related-desc">${(p.description || '').slice(0, 60)}${(p.description || '').length > 60 ? '...' : ''}</span>
          </button>
        `).join('')}
      </div>
    `;

    // Insert before the disclaimer at the bottom
    const disclaimer = container.querySelector('[style*="eff6ff"], [style*="educational"]');
    if (disclaimer) {
      disclaimer.insertAdjacentElement('beforebegin', section);
    } else {
      container.appendChild(section);
    }
  }

  // ─── Full-page peptide detail chat ─────────────────────────────────────────
  // ─── Auto TL;DR Summary ─────────────────────────────────────────────────────
  // Mobile peptide-detail chat uses a bottom-sheet + floating launcher. This
  // MUST match the CSS media query in bridge.css that styles the FAB/sheet,
  // otherwise the launcher renders but the sheet has no styling and tapping it
  // appears to do nothing. Keep these two in sync.
  function isMobileDetailChat() {
    try {
      return window.matchMedia('(max-width: 768px), (pointer: coarse) and (max-width: 1023px)').matches;
    } catch (e) {
      return window.innerWidth <= 768 || ('ontouchstart' in window && window.innerWidth < 1024);
    }
  }

  function injectTLDR(container, peptideName) {
    // The sheet now lives on <body> (see below), so guard globally rather than
    // scoping the check to the detail container.
    if (document.querySelector('.rs-mobile-detail-chat')) return;
    const isMobile = isMobileDetailChat();

    // On desktop, skip - the sidebar chat handles everything
    if (!isMobile) return;

    // On mobile, inject a collapsible chat that lives behind a floating button
    // centered above the bottom-nav AI button. The chat stays out of the page
    // flow until the user taps the button.
    const chatBox = document.createElement('div');
    chatBox.className = 'rs-mobile-detail-chat rs-mobile-detail-collapsed';
    chatBox.innerHTML = createChatHTML(
      'mobiledetail',
      getDetailSuggestions(peptideName),
      `Ask about ${peptideName}...`,
      `Ask about ${peptideName}`
    );

    // Insert the sheet as a direct child of <body>. It is position:fixed, and
    // nesting it inside the detail container breaks fixed positioning because
    // the detail container keeps a residual transform from its entrance
    // animation (.p-enter), which makes "fixed" relative to that element and
    // pushes the sheet far off-screen (the bug where only the dim backdrop
    // showed). Appending to <body> keeps it anchored to the viewport.
    document.body.appendChild(chatBox);

    // Keep the running conversation across compounds (shared with the desktop
    // sidebar); add a divider when switching to a different compound.
    prepareDetailChatState('mobiledetail', peptideName);

    // Re-render history into the freshly-created sheet DOM.
    renderStoredDetailMessages('mobiledetail');

    const input = document.getElementById('rsChatInput_mobiledetail');
    if (input) {
      input.addEventListener('input', () => {
        const btn = document.getElementById('rsChatSend_mobiledetail');
        if (btn) btn.disabled = !input.value.trim();
      });
    }

    // Build the floating action button (centered above the AI nav button).
    mountMobileDetailFab(peptideName);
  }

  // Floating launcher for the mobile peptide-detail chat. Centered horizontally
  // and sits just above the bottom navigation (over the AI button).
  function mountMobileDetailFab(peptideName) {
    let fab = document.getElementById('rsMobileDetailFab');
    if (!fab) {
      fab = document.createElement('button');
      fab.id = 'rsMobileDetailFab';
      fab.type = 'button';
      fab.className = 'rs-mobile-detail-fab';
      fab.onclick = () => toggleMobileDetailChat(true);
      document.body.appendChild(fab);
    }
    fab.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg><span></span>';
    const label = fab.querySelector('span');
    if (label) label.textContent = 'Ask AI about ' + (peptideName || 'this');
    fab.style.display = 'flex';
  }

  // Open/close the mobile peptide-detail chat sheet.
  function toggleMobileDetailChat(open) {
    const chatBox = document.querySelector('.rs-mobile-detail-chat');
    const fab = document.getElementById('rsMobileDetailFab');
    if (!chatBox) return;
    const willOpen = (typeof open === 'boolean') ? open : chatBox.classList.contains('rs-mobile-detail-collapsed');
    chatBox.classList.toggle('rs-mobile-detail-collapsed', !willOpen);
    document.body.classList.toggle('rs-mobile-chat-open', willOpen);
    if (fab) fab.style.display = willOpen ? 'none' : 'flex';
    if (willOpen) {
      const input = document.getElementById('rsChatInput_mobiledetail');
      if (input) setTimeout(() => { try { input.focus({ preventScroll: true }); } catch (e) {} }, 250);
      // Tap on the dimmed backdrop (outside the sheet) to close.
      if (!_mobileChatBackdropHandler) {
        _mobileChatBackdropHandler = (e) => {
          const sheet = document.querySelector('.rs-mobile-detail-chat');
          if (sheet && document.body.classList.contains('rs-mobile-chat-open') && !sheet.contains(e.target)) {
            toggleMobileDetailChat(false);
          }
        };
        setTimeout(() => document.addEventListener('click', _mobileChatBackdropHandler, true), 0);
      }
    } else if (_mobileChatBackdropHandler) {
      document.removeEventListener('click', _mobileChatBackdropHandler, true);
      _mobileChatBackdropHandler = null;
    }
  }
  let _mobileChatBackdropHandler = null;
  window.toggleMobileDetailChat = toggleMobileDetailChat;

  async function generateTLDR(peptideName, elId) {
    const contentEl = document.getElementById(elId);
    if (!contentEl) return;

    const prompt = `Give a 2-sentence TL;DR summary of ${peptideName} for someone new to peptide research. What is it and what's it primarily used for? Be direct and concise.`;
    let fullText = '';

    try {
      const response = await fetch('/ai/chat', {
        method: 'POST',
        headers: (typeof window.authHeaders === 'function') ? window.authHeaders() : { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: prompt }] }),
      });

      if (!response.ok) throw new Error('unavailable');

      syncAiMeter(response);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed.choices && parsed.choices[0]?.delta?.content) {
              fullText += parsed.choices[0].delta.content;
              if (contentEl) contentEl.innerHTML = renderMarkdown(splitFollowups(fullText).answer);
            }
          } catch {}
        }
      }
      if (!fullText && contentEl) contentEl.parentElement.remove();
      else if (fullText && window.__referral) window.__referral.onAiAnswer();
    } catch {
      if (contentEl) contentEl.parentElement.remove();
    }
  }

  // ─── Full-page peptide detail chat ─────────────────────────────────────────
  function injectFullPageChat() {
    const contentArea = document.getElementById('contentArea');
    if (!contentArea) return;
    if (document.getElementById('rsChatContainer_fullpage')) return;

    const detailContainer = contentArea.querySelector('.protocol-detail');
    if (!detailContainer) return;

    // Get peptide name. The redesigned detail page uses <h1 class="rsd-hero-name">;
    // the legacy page uses <h2>. Support both.
    const nameEl = detailContainer.querySelector('.rsd-hero-name, h2, h1');
    const peptideName = nameEl ? nameEl.textContent.trim() : 'this peptide';

    chatState.fullpage.peptideName = peptideName;

    // Keep the running conversation across compounds (and reloads); add a
    // context divider if we switched to a different compound.
    prepareDetailChatState('fullpage', peptideName);

    // Enrich with additional data
    enrichDetailPanel(detailContainer, peptideName);

    // Inject related peptides
    injectRelatedPeptides(detailContainer, peptideName);

    // Auto-generate TL;DR summary
    injectTLDR(detailContainer, peptideName);

    // Create a wrapper that holds the detail content + chat side by side
    const wrapper = document.createElement('div');
    wrapper.className = 'rs-fullpage-with-chat';

    detailContainer.parentNode.insertBefore(wrapper, detailContainer);
    wrapper.appendChild(detailContainer);

    // Create chat sidebar
    const chatSidebar = document.createElement('div');
    chatSidebar.className = 'rs-fullpage-chat-sidebar';
    chatSidebar.innerHTML = createChatHTML(
      'fullpage',
      getDetailSuggestions(peptideName),
      `Ask about ${peptideName}...`,
      `Ask about ${peptideName}`
    );
    wrapper.appendChild(chatSidebar);
    makeChatSidebarResizable(chatSidebar);

    // Re-render the running conversation into the freshly-created chat DOM.
    renderStoredDetailMessages('fullpage');

    const input = document.getElementById('rsChatInput_fullpage');
    if (input) {
      input.addEventListener('input', () => {
        const btn = document.getElementById('rsChatSend_fullpage');
        if (btn) btn.disabled = !input.value.trim();
      });
    }
  }

  // ─── Calculator chat injection ──────────────────────────────────────────────
  const CALC_SUGGESTIONS = [
    'How do I reconstitute a peptide step by step?',
    'What is bacteriostatic water vs sterile water?',
    'How do I read insulin syringe markings?',
    'How should I store reconstituted peptides?',
    'What happens if I add too much water?',
  ];

  function injectCalcChat() {
    const contentArea = document.getElementById('contentArea');
    if (!contentArea) return;
    if (document.getElementById('rsChatContainer_calc')) return;

    const calcView = contentArea.querySelector('.calc-view');
    if (!calcView) return;

    chatState.calc.messages = [];

    // Create wrapper for side-by-side layout
    const wrapper = document.createElement('div');
    wrapper.className = 'rs-calc-with-chat';

    calcView.parentNode.insertBefore(wrapper, calcView);
    wrapper.appendChild(calcView);

    // Create chat sidebar
    const chatSidebar = document.createElement('div');
    chatSidebar.className = 'rs-calc-chat-sidebar';
    chatSidebar.innerHTML = createChatHTML(
      'calc',
      CALC_SUGGESTIONS,
      'Ask about reconstitution, storage, syringes...',
      'Reconstitution Guide'
    );
    wrapper.appendChild(chatSidebar);
    makeChatSidebarResizable(chatSidebar);

    const input = document.getElementById('rsChatInput_calc');
    if (input) {
      input.addEventListener('input', () => {
        const btn = document.getElementById('rsChatSend_calc');
        if (btn) btn.disabled = !input.value.trim();
      });
    }
  }

  // ─── Knowledge Base chat ────────────────────────────────────────────────────
  const KB_SUGGESTIONS = [
    'Which peptide is best for fat loss?',
    'What peptides help with sleep?',
    'Recommend a beginner-friendly peptide',
    'Which peptides are FDA-approved?',
    'What category should I look at for anti-aging?',
  ];

  function injectKBChat() {
    const contentArea = document.getElementById('contentArea');
    if (!contentArea || document.getElementById('rsChatContainer_kb')) return;
    const kbView = contentArea.querySelector('.kb-view');
    if (!kbView) return;

    chatState.kb.messages = [];
    const wrapper = document.createElement('div');
    wrapper.className = 'rs-page-with-chat';
    kbView.parentNode.insertBefore(wrapper, kbView);
    wrapper.appendChild(kbView);

    const chatSidebar = document.createElement('div');
    chatSidebar.className = 'rs-page-chat-sidebar';
    chatSidebar.innerHTML = createChatHTML('kb', KB_SUGGESTIONS, 'Ask which peptide is right for you...', 'Peptide Advisor');
    wrapper.appendChild(chatSidebar);
    makeChatSidebarResizable(chatSidebar);

    const input = document.getElementById('rsChatInput_kb');
    if (input) input.addEventListener('input', () => {
      const btn = document.getElementById('rsChatSend_kb');
      if (btn) btn.disabled = !input.value.trim();
    });
  }

  // ─── Protocols chat ────────────────────────────────────────────────────────
  const PROTOCOLS_SUGGESTIONS = [
    'How do I choose the right protocol?',
    'Can I modify a protocol for my needs?',
    'What is a loading phase?',
    'How long should I cycle peptides?',
    'What does PCT mean for peptides?',
  ];

  function injectProtocolsChat() {
    const contentArea = document.getElementById('contentArea');
    if (!contentArea || document.getElementById('rsChatContainer_protocols')) return;
    const view = contentArea.querySelector('.protocols-view');
    if (!view) return;

    chatState.protocols.messages = [];
    const wrapper = document.createElement('div');
    wrapper.className = 'rs-page-with-chat';
    view.parentNode.insertBefore(wrapper, view);
    wrapper.appendChild(view);

    const chatSidebar = document.createElement('div');
    chatSidebar.className = 'rs-page-chat-sidebar';
    chatSidebar.innerHTML = createChatHTML('protocols', PROTOCOLS_SUGGESTIONS, 'Ask about protocols, cycling, dosing...', 'Protocol Advisor');
    wrapper.appendChild(chatSidebar);
    makeChatSidebarResizable(chatSidebar);

    const input = document.getElementById('rsChatInput_protocols');
    if (input) input.addEventListener('input', () => {
      const btn = document.getElementById('rsChatSend_protocols');
      if (btn) btn.disabled = !input.value.trim();
    });
  }

  // ─── Stack Builder chat ────────────────────────────────────────────────────
  const BUILDER_SUGGESTIONS = [
    'Is my current stack safe?',
    'What peptides synergize well together?',
    'Should I take these at the same time?',
    'What is the best healing stack?',
    'How many peptides can I stack at once?',
  ];

  function injectBuilderChat() {
    const contentArea = document.getElementById('contentArea');
    if (!contentArea || document.getElementById('rsChatContainer_builder')) return;
    const view = contentArea.querySelector('.protocols-view');
    if (!view) return;
    const title = contentArea.querySelector('.ph-title');
    if (!title || !title.textContent.includes('Stack Builder')) return;

    chatState.builder.messages = [];
    const wrapper = document.createElement('div');
    wrapper.className = 'rs-page-with-chat';
    view.parentNode.insertBefore(wrapper, view);
    wrapper.appendChild(view);

    const chatSidebar = document.createElement('div');
    chatSidebar.className = 'rs-page-chat-sidebar';
    chatSidebar.innerHTML = createChatHTML('builder', BUILDER_SUGGESTIONS, 'Ask about stack compatibility, timing...', 'Stack Advisor');
    wrapper.appendChild(chatSidebar);
    makeChatSidebarResizable(chatSidebar);

    const input = document.getElementById('rsChatInput_builder');
    if (input) input.addEventListener('input', () => {
      const btn = document.getElementById('rsChatSend_builder');
      if (btn) btn.disabled = !input.value.trim();
    });
  }

  // ─── Research chat ─────────────────────────────────────────────────────────
  const RESEARCH_SUGGESTIONS = [
    'Summarize the latest BPC-157 research',
    'Are there human clinical trials for TB-500?',
    'What does the evidence say about GLP-1 peptides?',
    'How reliable are animal peptide studies?',
    'What are the most promising peptides in trials?',
  ];

  function injectResearchChat() {
    const contentArea = document.getElementById('contentArea');
    if (!contentArea || document.getElementById('rsChatContainer_research')) return;
    const view = contentArea.querySelector('.research-view');
    if (!view) return;

    chatState.research.messages = [];
    const wrapper = document.createElement('div');
    wrapper.className = 'rs-page-with-chat';
    view.parentNode.insertBefore(wrapper, view);
    wrapper.appendChild(view);

    const chatSidebar = document.createElement('div');
    chatSidebar.className = 'rs-page-chat-sidebar';
    chatSidebar.innerHTML = createChatHTML('research', RESEARCH_SUGGESTIONS, 'Ask about studies, evidence, trials...', 'Research Assistant');
    wrapper.appendChild(chatSidebar);
    makeChatSidebarResizable(chatSidebar);

    const input = document.getElementById('rsChatInput_research');
    if (input) input.addEventListener('input', () => {
      const btn = document.getElementById('rsChatSend_research');
      if (btn) btn.disabled = !input.value.trim();
    });
  }

  // ─── Shared chat functions ────────────────────────────────────────────────

  function autoResize(textarea, id) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  }

  function handleKey(e, id) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(id);
    }
  }

  function sendSuggestion(btn, id) {
    const input = document.getElementById(`rsChatInput_${id}`);
    if (input) {
      input.value = btn.textContent;
      input.dispatchEvent(new Event('input'));
      send(id);
    }
  }

  // Scroll a chat's message list to the very bottom. The detail chat HTML is
  // injected fresh on every compound page (and lives inside an animated
  // container), so the list often has no height yet on the first synchronous
  // pass. Retry across a few frames + a short timeout so the newest output and
  // the starter prompt are visible once layout settles.
  function scrollChatToBottom(id, attempts) {
    const messagesEl = document.getElementById(`rsChatMessages_${id}`);
    if (!messagesEl) return;
    messagesEl.scrollTop = messagesEl.scrollHeight;
    const left = (typeof attempts === 'number') ? attempts : 6;
    if (left > 0) {
      requestAnimationFrame(() => scrollChatToBottom(id, left - 1));
    }
  }

  function appendMessage(id, role, content) {
    const messagesEl = document.getElementById(`rsChatMessages_${id}`);
    if (!messagesEl) return null;

    const welcome = messagesEl.querySelector('.rs-chat-welcome');
    if (welcome) welcome.remove();

    const msgEl = document.createElement('div');
    msgEl.className = `rs-chat-msg rs-chat-msg-${role}`;

    if (role === 'assistant') {
      msgEl.innerHTML = `
        <div class="rs-chat-msg-avatar">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>
        </div>
        <div class="rs-chat-msg-body">
          <div class="rs-chat-msg-content">${content || '<span class="rs-chat-typing"><span></span><span></span><span></span></span>'}</div>
          <div class="rs-chat-msg-actions" style="display:none">
            <button onclick="window.__rsChat.copyMsg(this)" title="Copy"><i class="fas fa-copy"></i></button>
            <button onclick="window.__rsChat.regenerate('${id}')" title="Regenerate"><i class="fas fa-rotate-right"></i></button>
            <button class="rs-fb-btn" data-fb="up" onclick="window.__rsChat.feedback(this,'up')" title="Helpful"><i class="far fa-thumbs-up"></i></button>
            <button class="rs-fb-btn" data-fb="down" onclick="window.__rsChat.feedback(this,'down')" title="Not helpful / suggest a correction"><i class="far fa-thumbs-down"></i></button>
          </div>
        </div>
      `;
    } else {
      msgEl.innerHTML = `<div class="rs-chat-msg-content">${escapeHtml(content)}</div>`;
    }

    messagesEl.appendChild(msgEl);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return msgEl;
  }

  // Append a visible "now asking about X" divider when the user switches
  // compounds mid-conversation, so the running chat reads naturally.
  function appendContextDivider(id, peptideName) {
    const messagesEl = document.getElementById(`rsChatMessages_${id}`);
    if (!messagesEl) return;
    const welcome = messagesEl.querySelector('.rs-chat-welcome');
    if (welcome) welcome.remove();
    const div = document.createElement('div');
    div.className = 'rs-chat-context-divider';
    div.innerHTML = `<span>Now asking about ${escapeHtml(peptideName)}</span>`;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  // A starter prompt shown at the bottom of an ongoing detail chat when the user
  // lands on a new compound: a small heading plus clickable starter questions so
  // they can keep the conversation going about the new compound.
  function appendStarterPrompt(id, peptideName) {
    const messagesEl = document.getElementById(`rsChatMessages_${id}`);
    if (!messagesEl) return;
    const old = messagesEl.querySelector('.rs-chat-starter');
    if (old) old.remove();
    const chips = getDetailSuggestions(peptideName).map(s =>
      `<button class="rs-chat-suggestion" onclick="window.__rsChat.sendSuggestion(this, '${id}')">${escapeHtml(s)}</button>`
    ).join('');
    const block = document.createElement('div');
    block.className = 'rs-chat-starter';
    block.innerHTML = `
      <div class="rs-chat-context-divider"><span>Now asking about ${escapeHtml(peptideName)}</span></div>
      <div class="rs-chat-starter-suggestions">${chips}</div>
    `;
    messagesEl.appendChild(block);
    scrollChatToBottom(id);
  }

  // ─── In-chat related videos ────────────────────────────────────────────────
  // Heuristic: decide whether an answer would benefit from related videos. We
  // attach videos automatically when the topic is the kind of thing people
  // watch (techniques, how-tos, overviews, reviews) rather than every reply.
  const VIDEO_TRIGGER_RE = /\b(video|videos|watch|tutorial|tutorials|how to|how do i|how does|demonstrat|reconstitut|inject|injection|pin|technique|protocol|dose|dosing|guide|overview|explain|review|results|before and after|stack|cycle|mix|draw|syringe|administer)\b/i;

  function isVideoRelevant(id, userMessage, answer) {
    // Only for the educational/detail/home chats, not calculators/builders.
    if (!['fullpage', 'mobiledetail', 'detail', 'home', 'kb', 'protocols'].includes(id)) return false;
    const hay = ((userMessage || '') + ' ' + (answer || '')).toLowerCase();
    return VIDEO_TRIGGER_RE.test(hay);
  }

  function videoQueryFor(id, state, userMessage) {
    const peptide = (state && state.peptideName) ? state.peptideName : '';
    if (peptide && peptide !== 'this peptide') {
      return (peptide + ' peptide').trim();
    }
    // Derive a short query from the user's question for non-detail chats.
    const cleaned = (userMessage || '').replace(/[^\w\s-]/g, ' ').trim();
    const words = cleaned.split(/\s+/).filter(Boolean).slice(0, 6).join(' ');
    return (words || 'peptide research') + ' peptide';
  }

  async function maybeAttachVideos(id, state, assistantEl, msgObj, userMessage, fullText) {
    if (!isVideoRelevant(id, userMessage, fullText)) return;
    if (!assistantEl) return;
    const query = videoQueryFor(id, state, userMessage);

    // Loading placeholder.
    const body = assistantEl.querySelector('.rs-chat-msg-body') || assistantEl;
    const wrap = document.createElement('div');
    wrap.className = 'rs-chat-videos rs-chat-videos-loading';
    wrap.innerHTML = `<div class="rs-chat-videos-head"><i class="fab fa-youtube"></i> Finding related videos...</div>`;
    body.appendChild(wrap);

    let videos = [];
    try {
      let res = await fetch(`/api/videos?q=${encodeURIComponent(query)}&sort=relevance`);
      if (!res.ok) res = await fetch(`https://researchsafe.org/api/videos?q=${encodeURIComponent(query)}&sort=relevance`);
      const data = await res.json();
      if (data && Array.isArray(data.videos)) {
        videos = data.videos.slice(0, 4).map(v => ({
          id: v.id, title: v.title, channel: v.channel || v.channelTitle || '',
          thumb: v.thumbnail || v.thumb || (v.id ? `https://i.ytimg.com/vi/${v.id}/mqdefault.jpg` : ''),
          duration: v.length || v.duration || '',
        }));
      }
    } catch (e) {}

    wrap.remove();
    if (!videos.length) return;
    if (msgObj) {
      msgObj._videos = videos;
      if (id === 'fullpage' || id === 'mobiledetail') saveDetailThread();
      else saveChatState(id);
    }
    attachVideosToMessage(assistantEl, videos);
    const messagesEl = assistantEl.closest('.rs-chat-messages');
    if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function attachVideosToMessage(assistantEl, videos) {
    if (!assistantEl || !videos || !videos.length) return;
    const body = assistantEl.querySelector('.rs-chat-msg-body') || assistantEl;
    const existing = body.querySelector('.rs-chat-videos');
    if (existing) existing.remove();

    const cards = videos.map(v => `
      <button class="rs-chat-video" data-vid="${escapeHtml(v.id)}" onclick="window.__rsChat.playInChatVideo(this)">
        <span class="rs-chat-video-thumb" style="background-image:url('${escapeHtml(v.thumb)}')">
          <span class="rs-chat-video-play"><i class="fas fa-play"></i></span>
          ${v.duration ? `<span class="rs-chat-video-dur">${escapeHtml(v.duration)}</span>` : ''}
        </span>
        <span class="rs-chat-video-meta">
          <span class="rs-chat-video-title">${escapeHtml(v.title || 'Video')}</span>
          ${v.channel ? `<span class="rs-chat-video-channel">${escapeHtml(v.channel)}</span>` : ''}
        </span>
      </button>
    `).join('');

    const wrap = document.createElement('div');
    wrap.className = 'rs-chat-videos';
    wrap.innerHTML = `
      <div class="rs-chat-videos-head"><i class="fab fa-youtube"></i> Related videos <span class="rs-chat-videos-hint">tap to play here</span></div>
      <div class="rs-chat-video-list">${cards}</div>
    `;
    body.appendChild(wrap);
  }

  // Play a selected video inline inside the chat. The sidebar/sheet stays put;
  // we embed a YouTube iframe right under the video list so it never leaves the
  // site. Clicking the same video again collapses it.
  function playInChatVideo(btn) {
    const vid = btn.getAttribute('data-vid');
    if (!vid) return;
    const wrap = btn.closest('.rs-chat-videos');
    if (!wrap) return;

    const open = wrap.querySelector('.rs-chat-video-embed');
    const wasThis = open && open.getAttribute('data-vid') === vid;
    if (open) open.remove();
    wrap.querySelectorAll('.rs-chat-video.is-playing').forEach(b => b.classList.remove('is-playing'));
    if (wasThis) return;

    btn.classList.add('is-playing');
    const embed = document.createElement('div');
    embed.className = 'rs-chat-video-embed';
    embed.setAttribute('data-vid', vid);
    embed.innerHTML = `
      <div class="rs-chat-video-frame">
        <iframe src="https://www.youtube.com/embed/${encodeURIComponent(vid)}?autoplay=1&rel=0" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
      </div>
      <button class="rs-chat-video-collapse" onclick="window.__rsChat.playInChatVideo(this.closest('.rs-chat-videos').querySelector('.rs-chat-video.is-playing'))"><i class="fas fa-times"></i> Close video</button>
    `;
    // Insert directly after the clicked card's list for a natural reading order.
    const list = wrap.querySelector('.rs-chat-video-list');
    list.insertAdjacentElement('afterend', embed);
    embed.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // Rebuild the chat message DOM from persisted state (the detail chat HTML is
  // recreated on every page load, so we re-render history into the new nodes).
  function renderStoredDetailMessages(id) {
    const state = chatState[id];
    if (!state || !Array.isArray(state.messages) || !state.messages.length) return;
    const messagesEl = document.getElementById(`rsChatMessages_${id}`);
    if (!messagesEl) return;
    const welcome = messagesEl.querySelector('.rs-chat-welcome');
    if (welcome) welcome.remove();

    const msgs = state.messages;
    msgs.forEach((msg, idx) => {
      if (msg.role === 'divider') {
        // Collapse consecutive dividers (keep only the last in a run) and skip
        // a divider that has no real message after it.
        const next = msgs[idx + 1];
        if (next && next.role === 'divider') return;
        const hasFollowing = msgs.slice(idx + 1).some(m => m.role === 'user' || m.role === 'assistant');
        if (!hasFollowing) return;
        appendContextDivider(id, msg.content);
        return;
      }
      if (msg.role === 'user') {
        appendMessage(id, 'user', msg.content);
      } else if (msg.role === 'assistant') {
        const el = appendMessage(id, 'assistant', renderMarkdown(splitFollowups(msg.content).answer));
        const actions = el && el.querySelector('.rs-chat-msg-actions');
        if (actions) actions.style.display = '';
        if (msg._videos && msg._videos.length && el) attachVideosToMessage(el, msg._videos);
      }
    });

    // If the running conversation is about a different compound than the one
    // the user just opened, prompt them with starter questions for this one.
    const prev = lastThreadPeptide();
    if (state.peptideName && prev && prev !== state.peptideName) {
      appendStarterPrompt(id, state.peptideName);
    }
    // Defer scroll so it lands at the bottom once the freshly-injected chat has
    // its real layout height (sidebar animation, fonts, thumbnails).
    scrollChatToBottom(id);
    setTimeout(() => scrollChatToBottom(id, 0), 250);
    setTimeout(() => scrollChatToBottom(id, 0), 600);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Replace em dashes so they never reach the UI or stored history.
  function stripEmDash(s) {
    return String(s == null ? '' : s).replace(/ \u2014 /g, ' - ').replace(/\u2014/g, '-');
  }

  // Split a raw streamed answer into the visible prose and any follow-up questions.
  // The model appends a block like:
  //   <<FOLLOWUPS>>\n- q1?\n- q2?\n<<END>>
  // We strip it from the visible text and parse the questions out.
  function splitFollowups(raw) {
    const text = stripEmDash(raw);
    const start = text.indexOf('<<FOLLOWUPS>>');
    if (start === -1) {
      // Hide a partially-streamed opening marker so it never flashes.
      const partial = text.search(/<<F?O?L?L?O?W?U?P?S?>?>?$/);
      if (partial > 0 && /<<F/.test(text.slice(partial))) {
        return { answer: text.slice(0, partial).trimEnd(), questions: [] };
      }
      return { answer: text, questions: [] };
    }
    const answer = text.slice(0, start).trimEnd();
    let block = text.slice(start + '<<FOLLOWUPS>>'.length);
    const end = block.indexOf('<<END>>');
    if (end !== -1) block = block.slice(0, end);
    const questions = block
      .split('\n')
      .map(l => l.replace(/^\s*[-*\d.)]+\s*/, '').trim())
      .filter(q => q.length > 2 && q.length < 160)
      .slice(0, 4);
    return { answer, questions };
  }

  // Render clickable follow-up chips under an assistant message.
  function renderFollowups(assistantEl, id, questions) {
    if (!assistantEl || !Array.isArray(questions) || !questions.length) return;
    const body = assistantEl.querySelector('.rs-chat-msg-body');
    if (!body) return;
    const existing = body.querySelector('.rs-chat-followups');
    if (existing) existing.remove();
    const wrap = document.createElement('div');
    wrap.className = 'rs-chat-followups';
    wrap.innerHTML =
      `<div class="rs-chat-followups-label"><i class="fas fa-circle-question"></i> Suggested follow-ups</div>` +
      `<div class="rs-chat-followups-chips">` +
      questions.map(q =>
        `<button class="rs-chat-followup-chip" onclick="window.__rsChat.askFollowup(this, '${id}')">${escapeHtml(q)}</button>`
      ).join('') +
      `</div>`;
    body.appendChild(wrap);
  }

  // Context-aware fallback follow-ups for when the model omits the
  // <<FOLLOWUPS>> block (free models do this inconsistently). Guarantees the
  // user always gets clickable next-step questions after an answer.
  function fallbackFollowups(id, state, userMessage) {
    const name = (state && state.peptideName) ? state.peptideName : null;
    const asked = (userMessage || '').toLowerCase();
    let pool;
    if (name && (id === 'detail' || id === 'fullpage' || id === 'mobiledetail')) {
      pool = [
        `What is the typical dosing protocol for ${name}?`,
        `What are the main side effects of ${name}?`,
        `Can ${name} be stacked with other peptides?`,
        `What does the research say about ${name}?`,
        `How long until ${name} shows results?`,
        `How should ${name} be stored and reconstituted?`,
      ];
    } else if (id === 'calc') {
      pool = [
        'How do I reconstitute a peptide step by step?',
        'How do I read insulin syringe markings?',
        'How should I store reconstituted peptides?',
        'What is bacteriostatic vs sterile water?',
      ];
    } else if (id === 'kb') {
      pool = [
        'Which peptide is best for beginners?',
        'What peptides help with fat loss?',
        'What peptides support recovery and healing?',
        'Which peptides are FDA-approved?',
      ];
    } else if (id === 'protocols') {
      pool = [
        'How long should I cycle a peptide?',
        'What is a loading phase?',
        'Can I customize a protocol for my goals?',
        'How do I avoid common protocol mistakes?',
      ];
    } else if (id === 'builder') {
      pool = [
        'Is this combination safe to stack?',
        'What peptides synergize well together?',
        'Should I take these at the same time?',
        'What is a good healing stack?',
      ];
    } else if (id === 'research') {
      pool = [
        'How reliable is the current evidence?',
        'Are there human clinical trials?',
        'What are the most promising peptides in trials?',
        'How do I interpret study quality?',
      ];
    } else {
      pool = [
        'How does this work in the body?',
        'What are the safety considerations?',
        'What is a typical dosing approach?',
        'What does the research say?',
      ];
    }
    // Drop anything too similar to what was just asked, then take up to 3.
    return pool.filter(q => q.toLowerCase() !== asked).slice(0, 3);
  }

  function askFollowup(btn, id) {
    const input = document.getElementById(`rsChatInput_${id}`);
    if (!input) return;
    // Remove all visible follow-up chips for this chat so they don't pile up.
    const messagesEl = document.getElementById(`rsChatMessages_${id}`);
    if (messagesEl) messagesEl.querySelectorAll('.rs-chat-followups').forEach(el => el.remove());
    input.value = btn.textContent;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    send(id);
  }

  function renderMarkdown(text) {
    // Safety net: never display em dashes in AI output. Spaced separators become
    // " - "; any remaining em dash becomes a plain hyphen.
    text = String(text == null ? '' : text)
      .replace(/ \u2014 /g, ' - ')
      .replace(/\u2014/g, '-');
    let html = escapeHtml(text);
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    // Markdown links - internal navigation: [text](/path)
    // escapeHtml() already neutralized < > &; strip quotes/backslash from the
    // path so model output can't break out of the href / navigate('…') attrs.
    html = html.replace(/\[([^\]]+)\]\(\/([^)]+)\)/g, (_m, label, path) => {
      const safe = path.replace(/['"\\]/g, '');
      return `<a href="/${safe}" class="rs-chat-link" onclick="event.preventDefault();navigate('${safe}')">${label}</a>`;
    });
    // External links
    html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, (_m, label, url) => {
      const safe = url.replace(/['"\\]/g, '');
      return `<a href="${safe}" class="rs-chat-link" target="_blank" rel="noopener">${label}</a>`;
    });
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    // GitHub-flavored markdown tables. Parse before line-break handling so the
    // row/separator structure is still intact. Pull each table out into a
    // placeholder, render it to <table> HTML, then splice it back at the end.
    const tableBlocks = [];
    html = html.replace(
      /(^|\n)([^\n]*\|[^\n]*)\n[ \t]*\|?[ \t]*:?-{2,}:?[ \t]*(\|[ \t]*:?-{2,}:?[ \t]*)+\|?[ \t]*\n((?:[^\n]*\|[^\n]*(?:\n|$))*)/g,
      (_m, lead, headerLine, _sepCell, bodyLines) => {
        const splitRow = (line) =>
          line.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim());
        const headers = splitRow(headerLine);
        const rows = (bodyLines || '')
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l && l.indexOf('|') !== -1)
          .map(splitRow);
        const thead =
          '<thead><tr>' + headers.map((h) => `<th>${h}</th>`).join('') + '</tr></thead>';
        const tbody =
          '<tbody>' +
          rows
            .map((cells) => {
              const tds = headers
                .map((_h, i) => `<td>${cells[i] !== undefined ? cells[i] : ''}</td>`)
                .join('');
              return `<tr>${tds}</tr>`;
            })
            .join('') +
          '</tbody>';
        const tableHtml = `<div class="rs-chat-table-wrap"><table class="rs-chat-table">${thead}${tbody}</table></div>`;
        tableBlocks.push(tableHtml);
        return `${lead}\u0000TABLE${tableBlocks.length - 1}\u0000`;
      }
    );
    html = html.replace(/^[-•] (.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');
    html = html.replace(/<\/ul>\s*<ul>/g, '');
    html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
    html = html.replace(/^### (.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^## (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/\n\n/g, '</p><p>');
    html = html.replace(/\n/g, '<br>');
    html = '<p>' + html + '</p>';
    html = html.replace(/<p><\/p>/g, '');
    // Re-insert rendered tables. Unwrap any <p>…</p> / <br> that the line
    // handling wrapped around the placeholder so block-level <table> is valid.
    if (tableBlocks.length) {
      html = html.replace(/<p>\s*(?:<br>\s*)*\u0000TABLE(\d+)\u0000\s*(?:<br>\s*)*<\/p>/g, (_m, i) => tableBlocks[+i] || '');
      html = html.replace(/(?:<br>\s*)*\u0000TABLE(\d+)\u0000(?:\s*<br>)*/g, (_m, i) => tableBlocks[+i] || '');
      html = html.replace(/\u0000TABLE(\d+)\u0000/g, (_m, i) => tableBlocks[+i] || '');
      // A <div><table> is not valid inside a <p>; close the paragraph before
      // the table block and reopen one after it so the markup stays clean.
      html = html.replace(/<p>((?:(?!<\/p>).)*?)(<div class="rs-chat-table-wrap">)/gs, (_m, before, tbl) => (before.trim() ? `<p>${before}</p>${tbl}` : tbl));
      html = html.replace(/(<\/table><\/div>)((?:(?!<p>).)*?)<\/p>/gs, (_m, tbl, after) => (after.trim() ? `${tbl}<p>${after}</p>` : tbl));
      html = html.replace(/<p>\s*<\/p>/g, '');
    }
    // Auto-link unlinked peptide names
    html = autoLinkPeptides(html);
    return html;
  }

  const KNOWN_PEPTIDES = [
    { name: 'BPC-157', id: 'bpc-157' },
    { name: 'TB-500', id: 'tb-500' },
    { name: 'GHK-Cu', id: 'ghk-cu' },
    { name: 'Semaglutide', id: 'semaglutide' },
    { name: 'Tirzepatide', id: 'tirzepatide' },
    { name: 'CJC-1295', id: 'cjc-1295' },
    { name: 'Ipamorelin', id: 'ipamorelin' },
    { name: 'DSIP', id: 'dsip' },
    { name: 'Selank', id: 'selank' },
    { name: 'Semax', id: 'semax' },
    { name: 'PT-141', id: 'pt-141' },
    { name: 'Melanotan II', id: 'melanotan-ii' },
    { name: 'AOD-9604', id: 'aod-9604' },
    { name: 'MOTS-c', id: 'mots-c' },
    { name: 'Epithalon', id: 'epithalon' },
    { name: 'Thymosin Alpha-1', id: 'thymosin-alpha-1' },
    { name: 'LL-37', id: 'll-37' },
    { name: 'KPV', id: 'kpv' },
    { name: 'Humanin', id: 'humanin' },
    { name: 'MGF', id: 'mgf' },
  ];

  function autoLinkPeptides(html) {
    for (const p of KNOWN_PEPTIDES) {
      // Only link if not already inside a link tag
      const regex = new RegExp(`(?<![">\/])\\b(${p.name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})\\b(?![^<]*<\\/a>)`, 'g');
      html = html.replace(regex, `<a href="/peptides/${p.id}" class="rs-chat-link" onclick="event.preventDefault();navigate('peptides/${p.id}')">$1</a>`);
    }
    return html;
  }

  async function send(id) {
    const state = chatState[id];
    const input = document.getElementById(`rsChatInput_${id}`);
    if (!input || !input.value.trim() || state.streaming) return;

    // Anonymous freewall: block + prompt sign-up once free messages are used up.
    if (window.__referral && window.__referral.aiGateBlocked && window.__referral.aiGateBlocked()) return;

    const userMessage = input.value.trim();
    input.value = '';
    input.style.height = 'auto';
    const sendBtn = document.getElementById(`rsChatSend_${id}`);
    if (sendBtn) sendBtn.disabled = true;

    // Clear any starter prompt block (it is a visual-only hint; the real
    // divider is inserted into the thread below).
    const _msgsEl = document.getElementById(`rsChatMessages_${id}`);
    const _starter = _msgsEl && _msgsEl.querySelector('.rs-chat-starter');
    if (_starter) _starter.remove();

    // For detail chats: if the user switched compounds since the last message,
    // drop a single "now asking about X" divider in front of this message so
    // the running thread stays readable (lazy, so visited-but-unused compounds
    // never leave empty or stacked dividers).
    if (id === 'fullpage' || id === 'mobiledetail') {
      const current = state.peptideName;
      const prev = lastThreadPeptide();
      if (current && prev && prev !== current) {
        const last = state.messages[state.messages.length - 1];
        if (!last || last.role !== 'divider' || last.content !== current) {
          state.messages.push({ role: 'divider', content: current });
          appendContextDivider(id, current);
        }
      }
    }

    const _userMsg = { role: 'user', content: userMessage };
    if (id === 'fullpage' || id === 'mobiledetail') _userMsg._peptide = state.peptideName;
    state.messages.push(_userMsg);
    if (id === 'fullpage' || id === 'mobiledetail') saveDetailThread();
    appendMessage(id, 'user', userMessage);

    const assistantEl = appendMessage(id, 'assistant', '');
    const contentEl = assistantEl?.querySelector('.rs-chat-msg-content');

    state.streaming = true;
    toggleInputState(id, true);
    state.abort = new AbortController();

    let fullText = '';
    let _assistantMsgObj = null;

    // Build messages with context for detail/fullpage/calc chat. Strip any
    // non-API entries (e.g. compound-switch dividers) and cap history length.
    const cleanHistory = state.messages
      .filter(m => m && (m.role === 'user' || m.role === 'assistant'))
      .slice(-20);
    let messagesToSend = [...cleanHistory];
    if ((id === 'detail' || id === 'fullpage' || id === 'mobiledetail') && state.peptideName) {
      messagesToSend = [
        { role: 'user', content: `[Context: The user is viewing the peptide "${state.peptideName}" detail page. The conversation may include earlier questions about other compounds; for the user's latest question, answer specifically about "${state.peptideName}" unless they clearly reference a different compound. Cover benefits for human use, mechanisms, dosing, safety profile, and research status. Be thorough and helpful.]` },
        { role: 'assistant', content: `I'll help you with information about ${state.peptideName}. What would you like to know?` },
        ...cleanHistory,
      ];
    } else if (id === 'calc') {
      messagesToSend = [
        { role: 'user', content: `[Context: The user is on the Reconstitution Calculator page. They are calculating peptide reconstitution volumes. Help them understand how to properly reconstitute peptides, use bacteriostatic water, draw correct volumes with insulin syringes, and store reconstituted peptides safely. Be practical, step-by-step, and safety-focused.]` },
        { role: 'assistant', content: `I'm here to help you with reconstitution. What would you like to know?` },
        ...cleanHistory,
      ];
    } else if (id === 'kb') {
      messagesToSend = [
        { role: 'user', content: `[Context: The user is browsing the Knowledge Base - a library of peptide profiles. Help them find the right peptide for their goals. You can suggest peptides by category (healing, fat loss, cognitive, anti-aging, sleep, GH secretagogue, etc.) and recommend they click on specific profiles to learn more.]` },
        { role: 'assistant', content: `I can help you find the right peptide. What are your research goals?` },
        ...cleanHistory,
      ];
    } else if (id === 'protocols') {
      messagesToSend = [
        { role: 'user', content: `[Context: The user is viewing Protocol Templates - structured dosing schedules for peptide research. Help them understand protocols, loading phases, cycling, frequency, and how to customize protocols for their needs. Explain terminology and best practices.]` },
        { role: 'assistant', content: `I can help you understand peptide protocols. What would you like to know?` },
        ...cleanHistory,
      ];
    } else if (id === 'builder') {
      messagesToSend = [
        { role: 'user', content: `[Context: The user is using the Stack Builder to create a custom peptide stack. Help them understand synergies between peptides, safe combinations, timing (AM/PM, with/without food), and potential interactions. Flag any risky combinations.]` },
        { role: 'assistant', content: `I can advise on your peptide stack. What combinations are you considering?` },
        ...cleanHistory,
      ];
    } else if (id === 'research') {
      messagesToSend = [
        { role: 'user', content: `[Context: The user is viewing the Latest Research page with PubMed articles on peptides. Help them interpret studies, understand methodology, assess evidence quality, and explain clinical significance. Be scientifically rigorous.]` },
        { role: 'assistant', content: `I can help you understand the research. What would you like to explore?` },
        ...cleanHistory,
      ];
    }

    try {
      // Add a 25s timeout so users aren't waiting forever
      const timeoutId = setTimeout(() => { if (state.abort) state.abort.abort(); }, 25000);

      const response = await fetch('/ai/chat', {
        method: 'POST',
        headers: (typeof window.authHeaders === 'function')
          ? window.authHeaders()
          : { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: messagesToSend, userId: (window.currentUser && (window.currentUser.id || window.currentUser.email)) || null }),
        signal: state.abort.signal,
      });

      clearTimeout(timeoutId);

      if (response.status === 402) {
        const err = await response.json().catch(() => ({}));
        // Remove the empty assistant bubble we optimistically added.
        if (assistantEl) assistantEl.remove();
        if (window.__referral && window.__referral.updateMeters) window.__referral.updateMeters();
        if (err.code === 'signup_required') {
          // Guest out of free preview messages → show ways to earn more.
          if (window.__referral && window.__referral.showEarnCreditsPopup) {
            window.__referral.showEarnCreditsPopup('out');
          } else if (typeof window.openAuthModal === 'function') {
            window.openAuthModal('register', 'ai-limit');
          }
        } else {
          // Logged-in user hit the daily cap → show how to earn more credits.
          if (window.__referral && window.__referral.showEarnCreditsPopup) {
            window.__referral.showEarnCreditsPopup('limit');
          } else if (contentEl) {
            contentEl.innerHTML = `<span class="rs-chat-error"><i class="fas fa-clock"></i> ${escapeHtml(err.error || 'Daily limit reached. Try again tomorrow.')}</span>`;
          }
        }
        state.streaming = false;
        toggleInputState(id, false);
        if (sendBtn) sendBtn.disabled = false;
        return;
      }

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Request failed');
      }

      syncAiMeter(response);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.choices && parsed.choices[0]?.delta?.content) {
              fullText += parsed.choices[0].delta.content;
              if (contentEl) contentEl.innerHTML = renderMarkdown(splitFollowups(fullText).answer);
            }
          } catch {}
        }
      }

      if (fullText) {
        const cleaned = splitFollowups(fullText).answer;
        _assistantMsgObj = { role: 'assistant', content: cleaned };
        state.messages.push(_assistantMsgObj);
        if (id === 'fullpage' || id === 'mobiledetail') saveDetailThread();
        if (window.__referral) window.__referral.onAiAnswer();
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        if (contentEl && !fullText) {
          contentEl.innerHTML = `<span class="rs-chat-error"><i class="fas fa-clock"></i> AI is busy right now. Try again in a moment.</span>`;
        }
      } else {
        if (contentEl) {
          contentEl.innerHTML = `<span class="rs-chat-error"><i class="fas fa-exclamation-circle"></i> ${escapeHtml(err.message || 'Something went wrong. Try again.')}</span>`;
        }
      }
    } finally {
      state.streaming = false;
      state.abort = null;
      toggleInputState(id, false);
      const messagesEl = document.getElementById(`rsChatMessages_${id}`);
      if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
      // Show actions on the last assistant message
      if (assistantEl) {
        const actions = assistantEl.querySelector('.rs-chat-msg-actions');
        if (actions) actions.style.display = '';
        // Stamp Q&A context for the feedback buttons.
        try {
          const cleaned = splitFollowups(fullText).answer;
          assistantEl.dataset.fbQuestion = userMessage || '';
          assistantEl.dataset.fbAnswer = cleaned || '';
          if (state.peptideId) assistantEl.dataset.fbPeptide = state.peptideId;
        } catch (e) {}
        // Render clickable follow-up question chips parsed from the answer.
        // Free models inconsistently emit the <<FOLLOWUPS>> block, so fall back
        // to context-aware questions when none were parsed - this guarantees
        // the user always sees tappable follow-ups after an answer.
        try {
          let fu = splitFollowups(fullText).questions;
          if (!fu || !fu.length) fu = fallbackFollowups(id, state, userMessage);
          if (fu.length) renderFollowups(assistantEl, id, fu);
        } catch (e) {}

        // If the question/answer is video-relevant, surface a few related
        // on-site videos the user can pick from and play inline.
        try {
          maybeAttachVideos(id, state, assistantEl, _assistantMsgObj, userMessage, fullText);
        } catch (e) {}
      }
      if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
      // Persist
      saveChatState(id);
    }
  }

  function toggleInputState(id, streaming) {
    const input = document.getElementById(`rsChatInput_${id}`);
    const sendBtn = document.getElementById(`rsChatSend_${id}`);
    if (input) input.disabled = streaming;
    if (sendBtn) {
      sendBtn.disabled = streaming;
      sendBtn.innerHTML = streaming
        ? '<i class="fas fa-stop"></i>'
        : '<i class="fas fa-arrow-up"></i>';
    }
  }

  function clear(id) {
    const state = chatState[id];
    // Detail chats share one persistent running thread; reset it in place so
    // both the desktop sidebar and mobile sheet clear together and keep the
    // shared array reference intact.
    if (id === 'fullpage' || id === 'mobiledetail' || id === 'detail') {
      if (typeof window.__rsClearDetailThread === 'function') window.__rsClearDetailThread();
    } else {
      state.messages = [];
    }
    clearChatStorage(id);
    const messagesEl = document.getElementById(`rsChatMessages_${id}`);
    if (!messagesEl) return;

    const suggestions = (id === 'detail' || id === 'fullpage') ? getDetailSuggestions(state.peptideName)
      : id === 'calc' ? CALC_SUGGESTIONS
      : id === 'kb' ? KB_SUGGESTIONS
      : id === 'protocols' ? PROTOCOLS_SUGGESTIONS
      : id === 'builder' ? BUILDER_SUGGESTIONS
      : id === 'research' ? RESEARCH_SUGGESTIONS
      : CHAT_SUGGESTIONS;
    const suggestionsHTML = suggestions.map(s =>
      `<button class="rs-chat-suggestion" onclick="window.__rsChat.sendSuggestion(this, '${id}')">${s}</button>`
    ).join('');
    messagesEl.innerHTML = `
      <div class="rs-chat-welcome">
        <div class="rs-chat-welcome-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>
        </div>
        <p class="rs-chat-welcome-text">${(id === 'detail' || id === 'fullpage') ? 'Ask questions about this peptide - benefits, dosing, safety, stacking, and more.'
      : id === 'calc' ? 'Ask about reconstitution, syringe measurements, storage, or peptide preparation.'
      : id === 'kb' ? 'Ask which peptide is right for your research goals.'
      : id === 'protocols' ? 'Ask about protocols, loading phases, cycling, and scheduling.'
      : id === 'builder' ? 'Ask about stack compatibility, synergies, and timing.'
      : id === 'research' ? 'Ask about studies, clinical trials, and evidence quality.'
      : 'Ask me anything about peptides, protocols, dosing, interactions, or safety research.'}</p>
        <div class="rs-chat-suggestions">${suggestionsHTML}</div>
      </div>
    `;
  }

  // ─── Interactions Page AI Analysis ──────────────────────────────────────────
  function injectInteractionsAI() {
    const contentArea = document.getElementById('contentArea');
    if (!contentArea) return;
    const ixPage = contentArea.querySelector('.ix-page');
    if (!ixPage || ixPage.querySelector('.rs-ix-ai')) return;

    // Gather selected items
    const chips = ixPage.querySelectorAll('.ix-chip');
    if (chips.length < 2) return; // Need at least 2 selections

    const drugs = [];
    const peptides = [];
    chips.forEach(chip => {
      const name = chip.textContent.replace(/×/g, '').trim();
      if (chip.classList.contains('ix-chip-drug')) drugs.push(name);
      else peptides.push(name);
    });

    if (drugs.length === 0 && peptides.length === 0) return;

    // Gather interaction details from cards
    const interactionCards = ixPage.querySelectorAll('.ix-card');
    const interactions = [];
    interactionCards.forEach(card => {
      const severity = card.classList.contains('ix-card-high') ? 'HIGH' : card.classList.contains('ix-card-moderate') ? 'MODERATE' : 'LOW';
      const note = card.querySelector('.ix-card-note')?.textContent?.trim() || '';
      const drugEl = card.querySelector('.ix-pair-drug');
      const pepEl = card.querySelector('.ix-pair-pep');
      interactions.push({
        drug: drugEl?.textContent?.trim() || '',
        peptide: pepEl?.textContent?.trim() || '',
        severity,
        note
      });
    });

    // Insert AI section
    const disclaimer = ixPage.querySelector('.ix-disclaimer');
    const aiSection = document.createElement('div');
    aiSection.className = 'rs-ix-ai rs-compare-ai';
    aiSection.innerHTML = `
      <div class="rs-compare-ai-header">
        <div class="rs-compare-ai-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>
        </div>
        <span class="rs-compare-ai-title">AI Safety Analysis</span>
        <span class="rs-compare-ai-badge">Powered by AI</span>
      </div>
      <div class="rs-compare-ai-content" id="rsIxAIContent">
        <span class="rs-chat-typing"><span></span><span></span><span></span></span>
      </div>
    `;

    if (disclaimer) {
      disclaimer.insertAdjacentElement('beforebegin', aiSection);
    } else {
      ixPage.appendChild(aiSection);
    }

    generateInteractionsAnalysis(drugs, peptides, interactions);
  }

  async function generateInteractionsAnalysis(drugs, peptides, interactions) {
    const contentEl = document.getElementById('rsIxAIContent');
    if (!contentEl) return;

    const interactionSummary = interactions.length > 0
      ? `\nKnown interactions found:\n${interactions.map(i => `- ${i.drug} + ${i.peptide}: ${i.severity} - ${i.note}`).join('\n')}`
      : '\nNo known interactions were found in the database.';

    const prompt = `The user is checking drug-peptide interactions for this combination:
Medications: ${drugs.join(', ') || 'None'}
Peptides: ${peptides.join(', ') || 'None'}
${interactionSummary}

Provide a concise safety analysis (under 200 words):
1. **Overall Risk Assessment** - is this combination generally safe?
2. **Key Concerns** - what should they watch out for?
3. **Timing Recommendations** - any spacing/timing considerations?
4. **Monitoring Advice** - what to monitor?

End with a reminder to consult a physician. Be practical and specific.`;

    let fullText = '';

    try {
      const response = await fetch('/ai/chat', {
        method: 'POST',
        headers: (typeof window.authHeaders === 'function') ? window.authHeaders() : { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: prompt }] }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'AI analysis unavailable');
      }

      syncAiMeter(response);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed.choices && parsed.choices[0]?.delta?.content) {
              fullText += parsed.choices[0].delta.content;
              if (contentEl) contentEl.innerHTML = renderMarkdown(splitFollowups(fullText).answer);
            }
          } catch {}
        }
      }

      if (!fullText && contentEl) {
        contentEl.innerHTML = '<span class="rs-chat-error">Analysis could not be generated.</span>';
      }
    } catch (err) {
      if (contentEl) {
        contentEl.innerHTML = `<span class="rs-chat-error"><i class="fas fa-exclamation-circle"></i> ${escapeHtml(err.message)}</span>`;
      }
    }
  }

  // ─── Voice Input (Web Speech API) ───────────────────────────────────────────
  let activeRecognition = null;

  function toggleVoice(id) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }

    const voiceBtn = document.getElementById(`rsChatVoice_${id}`);
    if (activeRecognition) {
      activeRecognition.stop();
      activeRecognition = null;
      if (voiceBtn) voiceBtn.classList.remove('rs-chat-voice-active');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    activeRecognition = recognition;

    if (voiceBtn) voiceBtn.classList.add('rs-chat-voice-active');

    const input = document.getElementById(`rsChatInput_${id}`);

    recognition.onresult = (event) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      if (input) {
        input.value = transcript;
        input.dispatchEvent(new Event('input'));
        autoResize(input, id);
      }
    };

    recognition.onend = () => {
      activeRecognition = null;
      if (voiceBtn) voiceBtn.classList.remove('rs-chat-voice-active');
      // Auto-send if we got text
      if (input && input.value.trim()) {
        const sendBtn = document.getElementById(`rsChatSend_${id}`);
        if (sendBtn) sendBtn.disabled = false;
      }
    };

    recognition.onerror = () => {
      activeRecognition = null;
      if (voiceBtn) voiceBtn.classList.remove('rs-chat-voice-active');
    };

    recognition.start();
  }

  // ─── Response Actions ──────────────────────────────────────────────────────
  function feedback(btn, rating) {
    const msgEl = btn.closest('.rs-chat-msg-assistant');
    const actions = btn.closest('.rs-chat-msg-actions');
    if (!msgEl || !actions) return;
    if (actions.dataset.fbDone) return; // one rating per answer

    const question = msgEl.dataset.fbQuestion || '';
    const answer = msgEl.dataset.fbAnswer || (msgEl.querySelector('.rs-chat-msg-content')?.innerText || '');
    const peptideId = msgEl.dataset.fbPeptide || null;

    const post = function (correction) {
      const headers = (typeof window.authHeaders === 'function')
        ? window.authHeaders()
        : { 'Content-Type': 'application/json' };
      fetch('/api/kb/feedback', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ question: question, answer: answer, rating: rating, correction: correction || '', peptideId: peptideId }),
      }).catch(function () {});
    };

    if (rating === 'down') {
      const correction = window.prompt('Thanks - what was wrong, or what should the answer have said? (optional)') || '';
      post(correction);
    } else {
      post('');
    }

    actions.dataset.fbDone = rating;
    btn.classList.add('rs-fb-active');
    btn.innerHTML = rating === 'up' ? '<i class="fas fa-thumbs-up"></i>' : '<i class="fas fa-thumbs-down"></i>';
  }

  function copyMsg(btn) {
    const content = btn.closest('.rs-chat-msg-body')?.querySelector('.rs-chat-msg-content');
    if (content) {
      const text = content.innerText || content.textContent;
      navigator.clipboard.writeText(text).then(() => {
        btn.innerHTML = '<i class="fas fa-check"></i>';
        setTimeout(() => { btn.innerHTML = '<i class="fas fa-copy"></i>'; }, 1500);
      });
    }
  }

  function regenerate(id) {
    const state = chatState[id];
    if (!state || state.streaming) return;
    // Remove last assistant message from state and DOM
    if (state.messages.length > 0 && state.messages[state.messages.length - 1].role === 'assistant') {
      state.messages.pop();
    }
    const messagesEl = document.getElementById(`rsChatMessages_${id}`);
    if (messagesEl) {
      const lastMsg = messagesEl.querySelector('.rs-chat-msg-assistant:last-child');
      if (lastMsg) lastMsg.remove();
    }
    // Re-send the last user message
    if (state.messages.length > 0 && state.messages[state.messages.length - 1].role === 'user') {
      const lastUserMsg = state.messages[state.messages.length - 1].content;
      state.messages.pop(); // remove it so send() re-adds it
      const input = document.getElementById(`rsChatInput_${id}`);
      if (input) {
        input.value = lastUserMsg;
        input.dispatchEvent(new Event('input'));
        send(id);
      }
    }
  }

  // ─── AI Spotlight Enhancement ──────────────────────────────────────────────
  function enhanceSpotlight() {
    const originalOnInput = window.onSpotlightInput;
    if (!originalOnInput && typeof onSpotlightInput === 'undefined') return;

    const origFn = window.onSpotlightInput || onSpotlightInput;
    window.onSpotlightInput = function(query) {
      origFn(query);
      if (!query.trim()) return;

      const results = document.getElementById('spotlightResults');
      if (!results) return;

      // Add "Ask AI" option at the bottom
      const existingAI = results.querySelector('.spotlight-ai-option');
      if (existingAI) existingAI.remove();

      const aiOption = document.createElement('div');
      aiOption.className = 'spotlight-ai-option';
      aiOption.innerHTML = `
        <div class="spotlight-group-label">AI Assistant</div>
        <button class="spotlight-result spotlight-ai-btn" onclick="window.__rsChat.spotlightAsk('${query.replace(/'/g, "\\'")}')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>
          <span class="spotlight-result-name">Ask AI: "${query.length > 40 ? query.slice(0,40)+'...' : query}"</span>
          <i class="fas fa-arrow-right spotlight-result-arrow"></i>
        </button>
      `;
      results.appendChild(aiOption);
    };
  }

  function spotlightAsk(query) {
    // Close spotlight and navigate to home with the question
    if (typeof closeSpotlight === 'function') closeSpotlight();
    navigate('home');
    setTimeout(() => {
      const input = document.getElementById('rsChatInput_home');
      if (input) {
        input.value = query;
        input.dispatchEvent(new Event('input'));
        send('home');
        // Scroll to chat
        const chatEl = document.getElementById('rsChatContainer_home');
        if (chatEl) chatEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 300);
  }

  // ─── Floating Panel Toggle ──────────────────────────────────────────────────
  const isMobile = () => window.innerWidth <= 600;

  function autoCollapseOnMobile(id, sidebar) {
    if (isMobile()) {
      sidebar.classList.add('rs-chat-collapsed');
      let fab = document.getElementById(`rsChatFab_${id}`);
      if (!fab) {
        fab = document.createElement('button');
        fab.id = `rsChatFab_${id}`;
        fab.className = 'rs-chat-fab';
        fab.title = 'Open AI Assistant';
        fab.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>';
        fab.onclick = () => togglePanel(id);
        document.body.appendChild(fab);
      }
      fab.style.display = 'flex';
    }
  }

  function togglePanel(id) {
    // The mobile peptide-detail chat is a bottom sheet with its own launcher.
    if (id === 'mobiledetail') { toggleMobileDetailChat(false); return; }
    const sidebar = document.getElementById(`rsChatContainer_${id}`)?.closest('.rs-page-chat-sidebar, .rs-calc-chat-sidebar, .rs-fullpage-chat-sidebar');
    if (!sidebar) return;

    const isHidden = sidebar.classList.toggle('rs-chat-collapsed');

    // Create or show/hide the floating toggle button
    let fab = document.getElementById(`rsChatFab_${id}`);
    if (!fab) {
      fab = document.createElement('button');
      fab.id = `rsChatFab_${id}`;
      fab.className = 'rs-chat-fab';
      fab.title = 'Open AI Assistant';
      fab.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>';
      fab.onclick = () => togglePanel(id);
      document.body.appendChild(fab);
    }
    fab.style.display = isHidden ? 'flex' : 'none';
  }

  // Expose API
  // ─── Open the home chat full screen (used by the mobile AI nav button) ──────
  // Mobile: tapping "AI" in the bottom nav slides a chat panel up from the
  // bottom (the old homepage chat embed it used to jump to was removed). The
  // panel is built once and reused; the '#rsChatContainer_mobile' chat wires
  // itself through the global __rsChat handlers.
  function buildMobileChatSheet() {
    if (document.getElementById('rsMobileChatSheet')) return;
    const backdrop = document.createElement('div');
    backdrop.id = 'rsMobileChatBackdrop';
    backdrop.className = 'rs-mchat-backdrop';
    backdrop.onclick = closeMobileChatSheet;

    const sheet = document.createElement('div');
    sheet.id = 'rsMobileChatSheet';
    sheet.className = 'rs-mchat-sheet';
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-label', 'AI assistant');
    sheet.innerHTML =
      '<div class="rs-mchat-grip" id="rsMchatGrip"></div>' +
      '<button type="button" class="rs-mchat-close" aria-label="Close" onclick="window.closeMobileChat&&window.closeMobileChat()"><i class="fas fa-chevron-down"></i></button>' +
      createChatHTML('mobile', CHAT_SUGGESTIONS, 'Ask about peptides, dosing, protocols...', 'ResearchSafe AI');
    document.body.appendChild(backdrop);
    document.body.appendChild(sheet);

    // Restore any prior mobile conversation.
    try {
      const saved = loadChatState('mobile');
      if (saved && saved.length) { chatState.mobile.messages = saved; renderRestoredMessages('mobile', saved); }
    } catch (e) { /* fresh */ }

    // Swipe-down on the grip to dismiss.
    let startY = null;
    const grip = document.getElementById('rsMchatGrip');
    if (grip) {
      grip.addEventListener('touchstart', function (e) { startY = e.touches[0].clientY; }, { passive: true });
      grip.addEventListener('touchmove', function (e) {
        if (startY === null) return;
        const dy = e.touches[0].clientY - startY;
        if (dy > 0) sheet.style.transform = 'translateY(' + dy + 'px)';
      }, { passive: true });
      grip.addEventListener('touchend', function (e) {
        const dy = (e.changedTouches[0].clientY - (startY || 0));
        sheet.style.transform = '';
        if (dy > 90) closeMobileChatSheet();
        startY = null;
      });
    }
  }

  function renderRestoredMessages(id, saved) {
    const messagesEl = document.getElementById('rsChatMessages_' + id);
    if (!messagesEl) return;
    const welcome = messagesEl.querySelector('.rs-chat-welcome');
    if (welcome && saved.length) welcome.remove();
    saved.forEach(msg => {
      const el = document.createElement('div');
      el.className = 'rs-chat-msg rs-chat-msg-' + msg.role;
      const content = msg.role === 'assistant' ? renderMarkdown(splitFollowups(msg.content).answer) : escapeHtml(msg.content);
      el.innerHTML = '<div class="rs-chat-msg-body"><div class="rs-chat-msg-content">' + content + '</div></div>';
      messagesEl.appendChild(el);
    });
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function openMobileChatSheet() {
    buildMobileChatSheet();
    const sheet = document.getElementById('rsMobileChatSheet');
    const backdrop = document.getElementById('rsMobileChatBackdrop');
    if (!sheet) return;
    document.body.classList.add('rs-mchat-open');
    // next frame so the transition runs
    requestAnimationFrame(function () {
      backdrop.classList.add('open');
      sheet.classList.add('open');
    });
    setTimeout(function () {
      const input = document.getElementById('rsChatInput_mobile');
      if (input) { try { input.focus({ preventScroll: true }); } catch (e) { input.focus(); } }
    }, 320);
  }

  function closeMobileChatSheet() {
    const sheet = document.getElementById('rsMobileChatSheet');
    const backdrop = document.getElementById('rsMobileChatBackdrop');
    if (sheet) sheet.classList.remove('open');
    if (backdrop) backdrop.classList.remove('open');
    document.body.classList.remove('rs-mchat-open');
    const input = document.getElementById('rsChatInput_mobile');
    if (input) input.blur();
  }

  // Kept for callers that expect openFullscreen; on mobile it's the slide-up sheet.
  function openFullscreen() { openMobileChatSheet(); }
  window.openMobileChat = openMobileChatSheet;
  window.closeMobileChat = closeMobileChatSheet;

  window.__rsChat = { send, clear, handleKey, autoResize, sendSuggestion, askFollowup, toggleVoice, copyMsg, regenerate, feedback, spotlightAsk, toggleGoal, skipQuiz, submitQuiz, togglePanel, openFullscreen, playInChatVideo };

  // ─── Compare Page AI Analysis ─────────────────────────────────────────────
  let compareObserver = null;

  function watchCompareResult() {
    const compareResult = document.getElementById('compareResult');
    if (!compareResult) return;
    if (compareObserver) compareObserver.disconnect();

    compareObserver = new MutationObserver(() => {
      const table = compareResult.querySelector('.compare-table');
      if (table && !compareResult.querySelector('.rs-compare-ai')) {
        injectCompareAI(compareResult);
      }
    });
    compareObserver.observe(compareResult, { childList: true });
  }

  function injectCompareAI(container) {
    const table = container.querySelector('.compare-table');
    if (!table) return;

    // Extract peptide names from table headers
    const headers = table.querySelectorAll('thead th');
    const name1 = headers[1]?.querySelector('span')?.textContent?.trim() || 'Peptide 1';
    const name2 = headers[2]?.querySelector('span')?.textContent?.trim() || 'Peptide 2';

    // Create the AI analysis section
    const aiSection = document.createElement('div');
    aiSection.className = 'rs-compare-ai';
    aiSection.innerHTML = `
      <div class="rs-compare-ai-header">
        <div class="rs-compare-ai-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>
        </div>
        <span class="rs-compare-ai-title">AI Analysis</span>
        <span class="rs-compare-ai-badge">Powered by AI</span>
      </div>
      <div class="rs-compare-ai-content" id="rsCompareAIContent">
        <span class="rs-chat-typing"><span></span><span></span><span></span></span>
      </div>
    `;
    container.appendChild(aiSection);

    // Fire the AI request
    generateCompareAnalysis(name1, name2);
  }

  async function generateCompareAnalysis(name1, name2) {
    const contentEl = document.getElementById('rsCompareAIContent');
    if (!contentEl) return;

    const prompt = `Compare ${name1} vs ${name2} for a researcher. Cover:
1. **Key Differences** - what makes each unique
2. **Best Use Cases** - when to choose one over the other
3. **Synergy Potential** - can they be stacked together?
4. **Safety Comparison** - which has a better safety profile?

Be concise (under 250 words), use bullet points, and highlight practical takeaways.`;

    let fullText = '';

    try {
      const response = await fetch('/ai/chat', {
        method: 'POST',
        headers: (typeof window.authHeaders === 'function') ? window.authHeaders() : { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }]
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'AI analysis unavailable');
      }

      syncAiMeter(response);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed.choices && parsed.choices[0]?.delta?.content) {
              fullText += parsed.choices[0].delta.content;
              if (contentEl) contentEl.innerHTML = renderMarkdown(splitFollowups(fullText).answer);
            }
          } catch {}
        }
      }

      if (!fullText && contentEl) {
        contentEl.innerHTML = '<span class="rs-chat-error">Analysis could not be generated. Try again later.</span>';
      }
    } catch (err) {
      if (contentEl) {
        contentEl.innerHTML = `<span class="rs-chat-error"><i class="fas fa-exclamation-circle"></i> ${escapeHtml(err.message)}</span>`;
      }
    }
  }

  // ─── Observers ────────────────────────────────────────────────────────────

  let _homeObserverTimer = null;
  function _homeObserverHandler() {
    const contentArea = document.getElementById('contentArea');
    if (!contentArea) return;
    if (contentArea.querySelector('.home-view') && !document.getElementById('rsChatContainer_home')) {
      setTimeout(injectHomeChat, 50);
    }
    if (contentArea.querySelector('.compare-view')) {
      setTimeout(watchCompareResult, 50);
    }
    if (contentArea.querySelector('.protocol-detail') && !document.getElementById('rsChatContainer_fullpage')) {
      setTimeout(injectFullPageChat, 100);
    }
    // Remove the mobile detail chat launcher + sheet when we navigate off a peptide page.
    if (!contentArea.querySelector('.protocol-detail')) {
      const fab = document.getElementById('rsMobileDetailFab');
      if (fab) fab.remove();
      const orphanSheet = document.querySelector('.rs-mobile-detail-chat');
      if (orphanSheet) orphanSheet.remove();
      document.body.classList.remove('rs-mobile-chat-open');
    }
    if (contentArea.querySelector('.calc-view') && !document.getElementById('rsChatContainer_calc')) {
      setTimeout(injectCalcChat, 100);
    }
    if (contentArea.querySelector('.kb-view') && !document.getElementById('rsChatContainer_kb')) {
      setTimeout(injectKBChat, 100);
    }
    if (contentArea.querySelector('.protocols-view') && !contentArea.querySelector('.protocol-detail') && !document.getElementById('rsChatContainer_protocols')) {
      setTimeout(injectProtocolsChat, 100);
    }
    if (contentArea.querySelector('.builder-stack, .protocols-view .ph-title') && !document.getElementById('rsChatContainer_builder')) {
      const title = contentArea.querySelector('.ph-title');
      if (title && title.textContent.includes('Stack Builder')) {
        setTimeout(injectBuilderChat, 100);
      }
    }
    if (contentArea.querySelector('.research-view') && !document.getElementById('rsChatContainer_research')) {
      setTimeout(injectResearchChat, 100);
    }
    if (contentArea.querySelector('.ix-page') && !contentArea.querySelector('.rs-ix-ai')) {
      const results = contentArea.querySelector('.ix-detail-results');
      const banner = contentArea.querySelector('.ix-results-banner');
      if (results || banner) {
        setTimeout(injectInteractionsAI, 100);
      }
    }
  }

  // Watch for home page - debounced to avoid thrashing during heavy renders
  const homeObserver = new MutationObserver(() => {
    if (_homeObserverTimer) return;
    _homeObserverTimer = setTimeout(() => { _homeObserverTimer = null; _homeObserverHandler(); }, 200);
  });

  // Watch for detail overlay opening
  let _detailObsTimer = null;
  const detailObserver = new MutationObserver(() => {
    if (_detailObsTimer) return;
    _detailObsTimer = setTimeout(() => {
      _detailObsTimer = null;
      const overlay = document.getElementById('detailOverlay');
      if (overlay && overlay.classList.contains('open') && !overlay.querySelector('.rs-chat-detail-panel')) {
        setTimeout(injectDetailChat, 100);
      }
    }, 150);
  });

  function init() {
    const contentArea = document.getElementById('contentArea');
    if (contentArea) {
      homeObserver.observe(contentArea, { childList: true, subtree: true });
      if (contentArea.querySelector('.home-view')) {
        injectHomeChat();
      }
    } else {
      setTimeout(init, 100);
      return;
    }

    // Observe body for detail overlay - scoped to direct children only to reduce overhead
    const body = document.body;
    detailObserver.observe(body, { childList: true, attributes: true, attributeFilter: ['class'] });

    // Enhance spotlight with AI option
    setTimeout(enhanceSpotlight, 500);

    // Load persisted chat for home
    const savedHome = loadChatState('home');
    if (savedHome.length > 0) {
      chatState.home.messages = savedHome;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
