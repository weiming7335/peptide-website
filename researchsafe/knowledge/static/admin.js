// ============================================
// PeptideSafe Admin Dashboard
// ============================================

(function() {
  'use strict';

  let adminUser = null;
  let currentTab = 'overview';

  // Shared color palette for charts
  const colors = ['#2563eb','#7c3aed','#06b6d4','#f59e0b','#ef4444','#10b981','#ec4899','#6366f1','#14b8a6','#f97316'];

  // Chart.js global defaults
  if (typeof Chart !== 'undefined') {
    Chart.defaults.font.family = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
    Chart.defaults.font.size = 11;
    Chart.defaults.color = '#64748b';
    Chart.defaults.plugins.legend.display = false;
    Chart.defaults.animation.duration = 800;
    Chart.defaults.animation.easing = 'easeOutQuart';
    Chart.defaults.elements.bar.borderRadius = 6;
    Chart.defaults.elements.line.tension = 0.4;
    Chart.defaults.scale.grid = { color: 'rgba(0,0,0,0.04)', drawBorder: false };
  }

  // Track active Chart.js instances for cleanup
  const chartInstances = {};
  function destroyChart(id) { if (chartInstances[id]) { chartInstances[id].destroy(); delete chartInstances[id]; } }
  function createChart(canvasId, config) {
    destroyChart(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    const chart = new Chart(canvas, config);
    chartInstances[canvasId] = chart;
    return chart;
  }

  // Animated number counter
  function animateCounter(el, target, duration = 1200, prefix = '', suffix = '') {
    if (!el) return;
    const start = 0;
    const startTime = performance.now();
    function step(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4); // easeOutQuart
      const current = Math.round(start + (target - start) * eased);
      el.textContent = prefix + current.toLocaleString() + suffix;
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // Initialize counters after DOM updates
  function initCounters(container) {
    if (!container) return;
    const counters = container.querySelectorAll('[data-counter]');
    counters.forEach(el => {
      const target = parseFloat(el.dataset.counter);
      const prefix = el.dataset.prefix || '';
      const suffix = el.dataset.suffix || '';
      animateCounter(el, target, 1200, prefix, suffix);
    });
  }

  // Country flag emoji helper
  function countryFlag(code) {
    if (!code || code.length !== 2) return '<i class="fas fa-globe"></i>';
    const c = code.toUpperCase();
    return String.fromCodePoint(...[...c].map(l => 0x1F1E6 + l.charCodeAt(0) - 65));
  }

  // ============================================
  // INIT + AUTH
  // ============================================
  function getAdminHeaders() {
    if (!window.currentUser) return {};
    var h = {
      'Content-Type': 'application/json',
      'X-Admin-Email': window.currentUser.email || '',
      'X-Supabase-Uid': window.currentUser.id || ''
    };
    var token = (typeof window.getAccessToken === 'function') ? window.getAccessToken() : null;
    if (token) h['Authorization'] = 'Bearer ' + token;
    return h;
  }

  async function checkAdminAccess() {
    if (!window.currentUser?.email) return null;
    try {
      const res = await fetch('/api/admin/me', { headers: getAdminHeaders() });
      const data = await res.json();
      if (data.isAdmin || data.isInfluencer) {
        adminUser = data;
        return data;
      }
    } catch(e) { console.log('Admin check failed:', e); }
    return null;
  }

  // ============================================
  // RENDER ADMIN PANEL
  // ============================================
  async function renderAdminPanel(container) {
    const user = await checkAdminAccess();
    if (!user) {
      container.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;min-height:60vh;padding:40px 20px">
          <div style="text-align:center;max-width:400px">
            <div style="width:64px;height:64px;border-radius:16px;background:linear-gradient(135deg,#fef2f2,#fee2e2);display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:28px;color:#dc2626">
              <i class="fas fa-lock"></i>
            </div>
            <h2 style="font-size:20px;font-weight:700;margin:0 0 8px;color:var(--text-primary)">Access Denied</h2>
            <p style="color:var(--text-secondary);font-size:14px;line-height:1.6;margin:0">
              You need to be logged in with an authorized admin account to access this page.
              ${!window.currentUser ? '<br><br>Please sign in first.' : '<br><br>Your account (' + window.currentUser.email + ') does not have admin privileges.'}
            </p>
          </div>
        </div>`;
      return;
    }

    // Pick up any tab requested by the sidebar nav buttons
    if (window._adminStartTab) {
      currentTab = window._adminStartTab;
      window._adminStartTab = null;
    }

    // Influencers get their own dashboard
    if (user.isInfluencer && !user.isAdmin) {
      return renderInfluencerDashboard(container);
    }

    const tabs = [
      { id: 'overview', icon: 'fa-chart-line', label: 'Overview' },
      { id: 'analytics', icon: 'fa-chart-pie', label: 'Analytics' },  // sub-tabs: Traffic | Peptides | Bots
      { id: 'users', icon: 'fa-users-gear', label: 'Users' },
      { id: 'partners', icon: 'fa-link', label: 'Partners' },
      { id: 'applications', icon: 'fa-inbox', label: 'Applications' },
      // 'crm' and 'moderation' tabs removed 2026-07: the CRM backend
      // (/api/partner/*) no longer exists and nothing writes moderation_queue.
      // Forum moderation lives in the 'forum' tab; influencer accounts still
      // get renderInfluencerDashboard directly.
      { id: 'agents', icon: 'fa-robot', label: 'AI Agents' },
      { id: 'personas', icon: 'fa-users-rectangle', label: 'Forum Personas' },
      { id: 'forum', icon: 'fa-comments', label: 'Forum' },
      { id: 'knowledge', icon: 'fa-book-medical', label: 'Knowledge Base' },
      { id: 'audit', icon: 'fa-clipboard-list', label: 'Audit Log' },
      { id: 'market', icon: 'fa-building-columns', label: 'Market Intel' },
    ];
    // API key management is sensitive - super admins only.
    if (user.isSuperAdmin) {
      tabs.push({ id: 'apikeys', icon: 'fa-key', label: 'API Keys' });
    }

    container.innerHTML = `
      <div class="adm-wrap">
        <div class="adm-header">
          <div class="adm-header-left">
            <div class="adm-logo"><i class="fas fa-shield-halved"></i></div>
            <div>
              <h1 class="adm-title">Admin Dashboard</h1>
              <p class="adm-subtitle">${esc(user.name)} &middot; ${user.role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
            </div>
          </div>
          <button class="adm-back-btn" onclick="navigate('home')"><i class="fas fa-arrow-left"></i> Back to Site</button>
        </div>
        <div class="adm-tabs">
          ${tabs.map(t => `
            <button class="adm-tab ${t.id === currentTab ? 'active' : ''}" onclick="window._admin.switchTab('${t.id}')">
              <i class="fas ${t.icon}"></i> ${t.label}
            </button>
          `).join('')}
        </div>
        <div class="adm-content" id="admContent"></div>
      </div>`;

    loadTab(currentTab);
  }

  function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.adm-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.adm-tab[onclick*="${tab}"]`)?.classList.add('active');
    loadTab(tab);
  }

  async function loadTab(tab) {
    const container = document.getElementById('admContent');
    if (!container) return;
    container.innerHTML = '<div style="text-align:center;padding:60px"><i class="fas fa-spinner fa-spin" style="font-size:24px;color:var(--text-muted)"></i></div>';

    try {
      switch(tab) {
        case 'overview': await renderOverview(container); break;
        case 'analytics': await renderAnalytics(container); break;
        case 'users': await renderUsers(container); break;
        case 'partners': await renderPartners(container); break;
        case 'applications': await renderApplications(container); break;
        case 'crm': await renderInfluencerDashboard(container); break;
        case 'moderation': await renderModeration(container); break;
        case 'agents': await renderAgents(container); break;
        case 'personas': await renderPersonas(container); break;
        case 'forum': await renderForumAdmin(container); break;
        case 'knowledge': await renderKnowledge(container); break;
        case 'audit': await renderAuditLog(container); break;
        case 'market': await renderMarketIntel(container); break;
        case 'apikeys': await renderApiKeys(container); break;
      }
    } catch(e) {
      container.innerHTML = `<div style="padding:40px;text-align:center;color:#dc2626"><i class="fas fa-exclamation-triangle"></i> Error loading: ${esc(e.message)}</div>`;
    }
  }

  // ============================================
  // OVERVIEW TAB
  // ============================================
  async function renderOverview(container) {
    const res = await fetch('/api/admin/overview', { headers: getAdminHeaders() });
    const data = await res.json();
    if (data.error) { container.innerHTML = `<div class="adm-error">${esc(data.error)}</div>`; return; }

    const stats = [
      { label: 'Total Users', value: data.totalUsers, icon: 'fa-users', color: '#2563eb' },
      { label: 'Influencers', value: data.totalInfluencers, icon: 'fa-star', color: '#f59e0b' },
      { label: 'Active Codes', value: data.activePartnerCodes, icon: 'fa-link', color: '#8b5cf6' },
      { label: 'Events (30d)', value: data.eventsLast30Days, icon: 'fa-chart-bar', color: '#06b6d4' },
      { label: 'Pending Mod', value: data.pendingModeration, icon: 'fa-flag', color: '#ef4444' },
    ];

    container.innerHTML = `
      <div class="adm-stats-grid">
        ${stats.map(s => `
          <div class="adm-stat-card">
            <div class="adm-stat-icon" style="background:${s.color}15;color:${s.color}"><i class="fas ${s.icon}"></i></div>
            <div class="adm-stat-num">${s.value}</div>
            <div class="adm-stat-label">${s.label}</div>
          </div>
        `).join('')}
      </div>

      ${data.trend.length > 0 ? (() => {
        const trendChartId = 'admOverviewTrend_' + Date.now();
        setTimeout(() => {
          if (typeof Chart === 'undefined') return;
          createChart(trendChartId, {
            type: 'line',
            data: {
              labels: data.trend.map(d => d.date.slice(5)),
              datasets: [
                {
                  label: 'Clicks',
                  data: data.trend.map(d => d.clicks || 0),
                  borderColor: '#2563eb',
                  backgroundColor: 'rgba(37,99,235,0.08)',
                  fill: true,
                  pointRadius: 4,
                  pointHoverRadius: 7,
                  pointBackgroundColor: '#2563eb',
                  borderWidth: 2.5,
                },
                {
                  label: 'Signups',
                  data: data.trend.map(d => d.signups || 0),
                  borderColor: '#10b981',
                  backgroundColor: 'rgba(16,185,129,0.08)',
                  fill: true,
                  pointRadius: 4,
                  pointHoverRadius: 7,
                  pointBackgroundColor: '#10b981',
                  borderWidth: 2.5,
                }
              ]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              interaction: { mode: 'index', intersect: false },
              plugins: {
                legend: { display: true, position: 'top', align: 'start', labels: { usePointStyle: true, pointStyle: 'circle', padding: 16, font: { size: 11, weight: 600 } } },
                tooltip: { backgroundColor: 'rgba(15,23,42,0.92)', padding: 10, cornerRadius: 8 }
              },
              scales: {
                x: { grid: { display: false }, ticks: { font: { size: 10 } } },
                y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.04)' } }
              }
            }
          });
        }, 50);
        return `
        <div class="adm-card adm-chart-card" style="margin-top:20px">
          <h3 class="adm-card-title"><i class="fas fa-chart-area"></i> Partner Traffic (14 days)</h3>
          <div style="position:relative;height:200px;width:100%">
            <canvas id="${trendChartId}"></canvas>
          </div>
        </div>`;
      })() : ''}

      <div class="adm-two-col" style="margin-top:20px">
        <div class="adm-card">
          <h3 class="adm-card-title"><i class="fas fa-trophy"></i> Top Partners (30d)</h3>
          ${data.topPartners.length ? data.topPartners.map((a, i) => `
            <div class="adm-list-item">
              <span class="adm-rank">#${i+1}</span>
              <div class="adm-list-info">
                <strong>${esc(a.code)}</strong>
                <span class="adm-list-sub">${esc(a.influencer_name || 'Unknown')}</span>
              </div>
              <div class="adm-list-stats">
                <span title="Clicks">${a.total_clicks || 0} <i class="fas fa-mouse-pointer"></i></span>
                <span title="Signups">${a.total_signups || 0} <i class="fas fa-user-plus"></i></span>
              </div>
            </div>
          `).join('') : '<p class="adm-empty">No partner data yet</p>'}
        </div>

        <div class="adm-card">
          <h3 class="adm-card-title"><i class="fas fa-clock-rotate-left"></i> Recent Activity</h3>
          ${data.recentActivity.length ? data.recentActivity.map(a => `
            <div class="adm-list-item">
              <div class="adm-list-info">
                <strong>${esc(a.admin_name)}</strong>
                <span class="adm-list-sub">${esc(a.action)} &middot; ${timeAgo(a.created_at)}</span>
              </div>
            </div>
          `).join('') : '<p class="adm-empty">No recent activity</p>'}
        </div>
      </div>`;
  }

  // ============================================
  // ANALYTICS TAB - sub-tabs: Traffic | Peptides | Bots
  // ============================================
  let analyticsPeriod = 30;
  let analyticsTab = 'traffic'; // active sub-tab

  async function renderAnalytics(container) {
    // Render the sub-tab shell first so the user sees structure immediately
    container.innerHTML = `
      <div class="adm-analytics-wrap">
        <!-- Sub-tab bar -->
        <div class="adm-sub-tabs" id="analyticsSubTabs">
          ${[
            { id: 'traffic',  icon: 'fa-chart-area',       label: 'Traffic' },
            { id: 'peptides', icon: 'fa-flask-vial',        label: 'Peptides & Search' },
            { id: 'bots',     icon: 'fa-robot',             label: 'Bot Detection' },
          ].map(t => `
            <button class="adm-sub-tab ${t.id === analyticsTab ? 'active' : ''}"
                    onclick="window._admin.switchAnalyticsTab('${t.id}')">
              <i class="fas ${t.icon}"></i> ${t.label}
            </button>
          `).join('')}
        </div>
        <!-- Period selector + refresh -->
        <div class="adm-toolbar" style="margin-bottom:16px;margin-top:4px">
          <div style="display:flex;align-items:center;gap:8px">
            <i class="fas fa-calendar" style="color:var(--text-muted)"></i>
            <select class="adm-filter" onchange="window._admin.changeAnalyticsPeriod(this.value)" style="min-width:140px">
              <option value="7"  ${analyticsPeriod===7  ?'selected':''}>Last 7 days</option>
              <option value="14" ${analyticsPeriod===14 ?'selected':''}>Last 14 days</option>
              <option value="30" ${analyticsPeriod===30 ?'selected':''}>Last 30 days</option>
              <option value="60" ${analyticsPeriod===60 ?'selected':''}>Last 60 days</option>
              <option value="90" ${analyticsPeriod===90 ?'selected':''}>Last 90 days</option>
            </select>
          </div>
          <button class="adm-btn" onclick="window._admin.refreshAnalytics()"><i class="fas fa-sync-alt"></i> Refresh</button>
        </div>
        <div id="analyticsContent">
          <div style="text-align:center;padding:60px"><i class="fas fa-spinner fa-spin" style="font-size:24px;color:var(--text-muted)"></i></div>
        </div>
      </div>`;

    await _loadAnalyticsTab(analyticsTab);
  }

  function switchAnalyticsTab(tab) {
    analyticsTab = tab;
    document.querySelectorAll('.adm-sub-tab').forEach(b => b.classList.remove('active'));
    document.querySelector(`.adm-sub-tab[onclick*="${tab}"]`)?.classList.add('active');
    _loadAnalyticsTab(tab);
  }

  async function _loadAnalyticsTab(tab) {
    const ct = document.getElementById('analyticsContent');
    if (!ct) return;
    ct.innerHTML = '<div style="text-align:center;padding:60px"><i class="fas fa-spinner fa-spin" style="font-size:24px;color:var(--text-muted)"></i></div>';
    try {
      if (tab === 'traffic')  await _renderAnalyticsTraffic(ct);
      if (tab === 'peptides') await _renderAnalyticsPeptides(ct);
      if (tab === 'bots')     await _renderAnalyticsBots(ct);
    } catch(e) {
      ct.innerHTML = `<div style="padding:40px;text-align:center;color:#dc2626"><i class="fas fa-exclamation-triangle"></i> Error: ${esc(e.message)}</div>`;
    }
  }

  // ── Traffic sub-tab ──────────────────────────────────────────────────────
  async function _renderAnalyticsTraffic(ct) {
    const [overviewRes, recentRes, hourlyRes] = await Promise.all([
      fetch(`/api/admin/analytics/overview?days=${analyticsPeriod}`, { headers: getAdminHeaders() }),
      fetch('/api/admin/analytics/recent?limit=30', { headers: getAdminHeaders() }),
      fetch('/api/admin/analytics/hourly', { headers: getAdminHeaders() }),
    ]);
    const data      = await overviewRes.json();
    const recentData = await recentRes.json();
    const hourlyData = await hourlyRes.json();

    if (data.error) { ct.innerHTML = `<div class="adm-error">${esc(data.error)}</div>`; return; }

    const t = data.totals || {};
    const today = data.today || {};
    const avgDurSec    = Math.round((t.avg_duration_ms || 0) / 1000);
    const avgDurMin    = Math.floor(avgDurSec / 60);
    const avgDurRemSec = avgDurSec % 60;
    const todayDurSec  = Math.round((today.avg_duration_ms || 0) / 1000);

    ct.innerHTML = `
      <div>
        <!-- Today's Live Stats -->
        <div class="adm-card" style="margin-bottom:16px;background:linear-gradient(135deg,#eff6ff,#f0f9ff);border:1px solid #bfdbfe">
          <h3 class="adm-card-title" style="color:#1e40af"><i class="fas fa-bolt" style="color:#f59e0b"></i> Live Today</h3>
          <div class="adm-stats-grid" style="grid-template-columns:repeat(auto-fit,minmax(120px,1fr))">
            <div class="adm-mini-stat"><span class="adm-mini-num">${today.pageviews||0}</span><span class="adm-mini-label">Pageviews</span></div>
            <div class="adm-mini-stat"><span class="adm-mini-num">${today.unique_visitors||0}</span><span class="adm-mini-label">Visitors</span></div>
            <div class="adm-mini-stat"><span class="adm-mini-num">${today.sessions||0}</span><span class="adm-mini-label">Sessions</span></div>
            <div class="adm-mini-stat"><span class="adm-mini-num">${today.new_visitors||0}</span><span class="adm-mini-label">New</span></div>
            <div class="adm-mini-stat"><span class="adm-mini-num">${todayDurSec}s</span><span class="adm-mini-label">Avg Duration</span></div>
          </div>
        </div>

        <!-- Period Summary Cards -->
        <div class="adm-stats-grid" style="margin-bottom:20px">
          <div class="adm-stat-card">
            <div class="adm-stat-icon" style="background:#2563eb15;color:#2563eb"><i class="fas fa-eye"></i></div>
            <div class="adm-stat-num">${(t.pageviews||0).toLocaleString()}</div>
            <div class="adm-stat-label">Pageviews</div>
          </div>
          <div class="adm-stat-card">
            <div class="adm-stat-icon" style="background:#7c3aed15;color:#7c3aed"><i class="fas fa-users"></i></div>
            <div class="adm-stat-num">${(t.unique_visitors||0).toLocaleString()}</div>
            <div class="adm-stat-label">Unique Visitors</div>
          </div>
          <div class="adm-stat-card">
            <div class="adm-stat-icon" style="background:#06b6d415;color:#06b6d4"><i class="fas fa-arrows-rotate"></i></div>
            <div class="adm-stat-num">${(t.sessions||0).toLocaleString()}</div>
            <div class="adm-stat-label">Sessions</div>
          </div>
          <div class="adm-stat-card">
            <div class="adm-stat-icon" style="background:#10b98115;color:#10b981"><i class="fas fa-user-plus"></i></div>
            <div class="adm-stat-num">${(t.new_visitors||0).toLocaleString()}</div>
            <div class="adm-stat-label">New Visitors</div>
          </div>
          <div class="adm-stat-card">
            <div class="adm-stat-icon" style="background:#f59e0b15;color:#f59e0b"><i class="fas fa-clock"></i></div>
            <div class="adm-stat-num">${avgDurMin > 0 ? avgDurMin + 'm ' : ''}${avgDurRemSec}s</div>
            <div class="adm-stat-label">Avg Duration</div>
          </div>
          <div class="adm-stat-card">
            <div class="adm-stat-icon" style="background:#ef444415;color:#ef4444"><i class="fas fa-door-open"></i></div>
            <div class="adm-stat-num">${t.bounceRate||'0.0'}%</div>
            <div class="adm-stat-label">Bounce Rate</div>
          </div>
        </div>

        <!-- Traffic Chart -->
        ${renderTrafficChart(data.daily || [])}

        <!-- Hourly Breakdown -->
        ${renderHourlyChart(hourlyData.hourly || [])}

        <!-- 3-Column Breakdown -->
        <div class="adm-three-col" style="margin-top:20px">
          <!-- Top Pages -->
          <div class="adm-card">
            <h3 class="adm-card-title"><i class="fas fa-file-alt"></i> Top Pages</h3>
            ${(data.topPages||[]).length ? `
              <div class="adm-breakdown-list">
                ${(data.topPages||[]).map((p, i) => {
                  const maxViews = Math.max(...(data.topPages||[]).map(x => x.total_views || 0));
                  const pct = maxViews > 0 ? ((p.total_views / maxViews) * 100) : 0;
                  return `
                    <div class="adm-breakdown-item">
                      <div class="adm-breakdown-bar" style="width:${pct}%;background:${colors[i % colors.length]}20"></div>
                      <span class="adm-breakdown-label">${esc(p.page || '/')}</span>
                      <span class="adm-breakdown-value">${(p.total_views||0).toLocaleString()}</span>
                    </div>`;
                }).join('')}
              </div>
            ` : '<p class="adm-empty">No page data yet</p>'}
          </div>

          <!-- Top Referrers -->
          <div class="adm-card">
            <h3 class="adm-card-title"><i class="fas fa-share-nodes"></i> Top Referrers</h3>
            ${(data.topReferrers||[]).length ? `
              <div class="adm-breakdown-list">
                ${(data.topReferrers||[]).map((r, i) => {
                  const maxVis = Math.max(...(data.topReferrers||[]).map(x => x.total_visits || 0));
                  const pct = maxVis > 0 ? ((r.total_visits / maxVis) * 100) : 0;
                  return `
                    <div class="adm-breakdown-item">
                      <div class="adm-breakdown-bar" style="width:${pct}%;background:${colors[(i+2) % colors.length]}20"></div>
                      <span class="adm-breakdown-label">${esc(r.referrer)}</span>
                      <span class="adm-breakdown-value">${(r.total_visits||0).toLocaleString()}</span>
                    </div>`;
                }).join('')}
              </div>
            ` : '<p class="adm-empty">No referrer data yet. Traffic is direct.</p>'}
          </div>

          <!-- Top Countries -->
          <div class="adm-card">
            <h3 class="adm-card-title"><i class="fas fa-globe"></i> Top Countries</h3>
            ${(data.topCountries||[]).length ? `
              <div class="adm-breakdown-list">
                ${(data.topCountries||[]).map((ct, i) => {
                  const maxVis = Math.max(...(data.topCountries||[]).map(x => x.total_visits || 0));
                  const pct = maxVis > 0 ? ((ct.total_visits / maxVis) * 100) : 0;
                  return `
                    <div class="adm-breakdown-item">
                      <div class="adm-breakdown-bar" style="width:${pct}%;background:${colors[(i+4) % colors.length]}20"></div>
                      <span class="adm-breakdown-label">${countryFlag(ct.country)} ${esc(ct.country || 'Unknown')}</span>
                      <span class="adm-breakdown-value">${(ct.total_visits||0).toLocaleString()}</span>
                    </div>`;
                }).join('')}
              </div>
            ` : '<p class="adm-empty">No country data yet</p>'}
          </div>
        </div>

        <!-- Device, Browser, OS -->
        <div class="adm-three-col" style="margin-top:20px">
          <!-- Devices -->
          <div class="adm-card">
            <h3 class="adm-card-title"><i class="fas fa-laptop-mobile"></i> Devices</h3>
            ${renderDonutBreakdown(data.devices || [], 'device_type', 'total_visits')}
          </div>
          <!-- Browsers -->
          <div class="adm-card">
            <h3 class="adm-card-title"><i class="fas fa-compass"></i> Browsers</h3>
            ${renderDonutBreakdown(data.browsers || [], 'browser', 'total_visits')}
          </div>
          <!-- Operating Systems -->
          <div class="adm-card">
            <h3 class="adm-card-title"><i class="fas fa-desktop"></i> Operating Systems</h3>
            ${renderDonutBreakdown(data.osList || [], 'os', 'total_visits')}
          </div>
        </div>

        <!-- Recent Visitors Feed -->
        <div class="adm-card" style="margin-top:20px">
          <h3 class="adm-card-title"><i class="fas fa-stream"></i> Recent Visitors</h3>
          <div class="adm-table-wrap" style="max-height:350px;overflow-y:auto">
            <table class="adm-table adm-table-compact">
              <thead>
                <tr><th>Time</th><th>Page</th><th>Visitor</th><th>Country</th><th>Device</th><th>Browser</th><th>OS</th><th>Type</th></tr>
              </thead>
              <tbody>
                ${(recentData.events||[]).filter(e => e.event_type === 'pageview' || e.event_type === 'session_start').map(e => `
                  <tr>
                    <td style="white-space:nowrap;font-size:11px">${timeAgo(e.created_at)}</td>
                    <td><span class="adm-page-badge">${esc(e.page || '/')}</span></td>
                    <td style="font-size:11px;font-family:monospace;color:var(--text-muted)">${esc((e.visitor_id||'').substring(0,12))}...</td>
                    <td>${e.country ? countryFlag(e.country) + ' ' + esc(e.country) : '<span style="color:var(--text-muted)">-</span>'}</td>
                    <td><span class="adm-device-badge adm-device-${(e.device_type||'').toLowerCase()}">${esc(e.device_type || '-')}</span></td>
                    <td style="font-size:11px">${esc(e.browser || '-')}</td>
                    <td style="font-size:11px">${esc(e.os || '-')}</td>
                    <td>${e.is_new_visitor ? '<span class="adm-new-badge">New</span>' : '<span class="adm-ret-badge">Returning</span>'}</td>
                  </tr>
                `).join('') || '<tr><td colspan="8" class="adm-empty">No recent visitors yet</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    `;
  }

  // ── Peptides & Search sub-tab ────────────────────────────────────────────
  async function _renderAnalyticsPeptides(ct) {
    const pepRes = await fetch(`/api/admin/analytics/peptides?days=${analyticsPeriod}`, { headers: getAdminHeaders() });
    const pepData = await pepRes.json();

    ct.innerHTML = `
      <div>
        <!-- Trending Peptides -->
        ${(pepData.trendingPeptides||[]).length ? `
          <div class="adm-card" style="margin-bottom:16px;background:linear-gradient(135deg,#faf5ff,#f5f3ff);border:1px solid #ddd6fe">
            <h3 class="adm-card-title" style="color:#6d28d9"><i class="fas fa-fire" style="color:#ef4444"></i> Trending Peptides (7-day momentum)</h3>
            <div style="display:flex;flex-wrap:wrap;gap:8px">
              ${(pepData.trendingPeptides||[]).map((p, i) => {
                const growth = (p.prior_views||0) > 0 ? Math.round(((p.recent_views - p.prior_views) / p.prior_views) * 100) : (p.recent_views > 0 ? 100 : 0);
                const arrow = growth > 0 ? '<i class="fas fa-arrow-up" style="color:#10b981;font-size:10px"></i>' : growth < 0 ? '<i class="fas fa-arrow-down" style="color:#ef4444;font-size:10px"></i>' : '';
                return `<div class="adm-trend-pill">
                  <span class="adm-trend-rank">#${i+1}</span>
                  <strong>${esc(p.peptide_name || p.peptide_id)}</strong>
                  <span class="adm-trend-cat">${esc(p.category || '')}</span>
                  <span class="adm-trend-views">${p.recent_views} views</span>
                  ${growth !== 0 ? `<span class="adm-trend-growth ${growth > 0 ? 'up' : 'down'}">${arrow} ${Math.abs(growth)}%</span>` : ''}
                </div>`;
              }).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Top Peptides + Interaction Types -->
        <div class="adm-two-col" style="margin-bottom:16px">
          <div class="adm-card">
            <h3 class="adm-card-title"><i class="fas fa-ranking-star"></i> Most Viewed Peptides</h3>
            ${(pepData.topPeptides||[]).length ? `
              <div class="adm-table-wrap" style="max-height:400px;overflow-y:auto">
                <table class="adm-table adm-table-compact">
                  <thead><tr><th>#</th><th>Peptide</th><th>Category</th><th>Views</th><th>Searches</th><th>Calc</th><th>Stacks</th><th>Favs</th><th>Score</th></tr></thead>
                  <tbody>
                    ${(pepData.topPeptides||[]).map((p, i) => `
                      <tr>
                        <td style="font-weight:700;color:${i < 3 ? '#f59e0b' : 'var(--text-muted)'}">${i+1}</td>
                        <td><strong>${esc(p.peptide_name || p.peptide_id)}</strong></td>
                        <td><span class="adm-cat-badge">${esc(p.category || '-')}</span></td>
                        <td style="font-variant-numeric:tabular-nums">${(p.total_views||0).toLocaleString()}</td>
                        <td style="font-variant-numeric:tabular-nums">${p.total_searches||0}</td>
                        <td style="font-variant-numeric:tabular-nums">${p.total_calc||0}</td>
                        <td style="font-variant-numeric:tabular-nums">${p.total_stacks||0}</td>
                        <td style="font-variant-numeric:tabular-nums">${p.total_favorites||0}</td>
                        <td><strong style="color:#7c3aed">${(p.engagement_score||0).toLocaleString()}</strong></td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            ` : '<p class="adm-empty">No peptide data yet. Data populates as visitors browse peptides.</p>'}
          </div>

          <div class="adm-card">
            <h3 class="adm-card-title"><i class="fas fa-hand-pointer"></i> Interaction Types</h3>
            ${(pepData.interactionTypes||[]).length ? `
              <div class="adm-donut-breakdown">
                ${(pepData.interactionTypes||[]).map((item, i) => {
                  const total = (pepData.interactionTypes||[]).reduce((s, x) => s + (x.count || 0), 0);
                  const pct = total > 0 ? ((item.count / total) * 100).toFixed(1) : '0.0';
                  const typeLabels = { view:'Peptide Views', search:'Searches', favorite:'Favorites', calculator:'Calculator', stack_add:'Stack Adds', comparison:'Comparisons', protocol_view:'Protocol Views' };
                  const typeIcons  = { view:'fa-eye', search:'fa-search', favorite:'fa-heart', calculator:'fa-calculator', stack_add:'fa-layer-group', comparison:'fa-code-compare', protocol_view:'fa-clipboard-list' };
                  return `<div class="adm-donut-row">
                    <div class="adm-donut-color" style="background:${colors[i % colors.length]}"></div>
                    <i class="fas ${typeIcons[item.event_type]||'fa-circle'}" style="color:${colors[i % colors.length]};width:16px;text-align:center;font-size:12px"></i>
                    <span class="adm-donut-label">${esc(typeLabels[item.event_type]||item.event_type)}</span>
                    <span class="adm-donut-bar"><span style="width:${pct}%;background:${colors[i % colors.length]}"></span></span>
                    <span class="adm-donut-pct">${pct}%</span>
                    <span class="adm-donut-val">${(item.count||0).toLocaleString()}</span>
                  </div>`;
                }).join('')}
              </div>
            ` : '<p class="adm-empty">No interaction data yet</p>'}

            <h3 class="adm-card-title" style="margin-top:24px"><i class="fas fa-tags"></i> Top Categories</h3>
            ${(pepData.topCategories||[]).length ? `
              <div class="adm-breakdown-list">
                ${(pepData.topCategories||[]).map((cat, i) => {
                  const maxV = Math.max(...(pepData.topCategories||[]).map(x => x.total_views || 0));
                  const pct = maxV > 0 ? ((cat.total_views / maxV) * 100) : 0;
                  return `<div class="adm-breakdown-item">
                    <div class="adm-breakdown-bar" style="width:${pct}%;background:${colors[(i+3) % colors.length]}20"></div>
                    <span class="adm-breakdown-label">${esc(cat.category)}</span>
                    <span class="adm-breakdown-value">${(cat.total_views||0).toLocaleString()}</span>
                  </div>`;
                }).join('')}
              </div>
            ` : '<p class="adm-empty">No category data yet</p>'}
          </div>
        </div>

        <!-- Search Analytics -->
        <div class="adm-two-col">
          <div class="adm-card">
            <h3 class="adm-card-title"><i class="fas fa-magnifying-glass-chart"></i> Top Search Queries</h3>
            ${(pepData.topSearches||[]).length ? `
              <div class="adm-table-wrap" style="max-height:350px;overflow-y:auto">
                <table class="adm-table adm-table-compact">
                  <thead><tr><th>#</th><th>Query</th><th>Searches</th><th>Clicks</th><th>CTR</th></tr></thead>
                  <tbody>
                    ${(pepData.topSearches||[]).map((s, i) => {
                      const ctr = s.total_searches > 0 ? ((s.total_clicks / s.total_searches) * 100).toFixed(1) : '0.0';
                      return `<tr>
                        <td style="font-weight:700;color:${i < 3 ? '#f59e0b' : 'var(--text-muted)'}">${i+1}</td>
                        <td><code style="background:#f3f4f6;padding:2px 8px;border-radius:4px;font-size:12px">${esc(s.query)}</code></td>
                        <td style="font-variant-numeric:tabular-nums">${(s.total_searches||0).toLocaleString()}</td>
                        <td style="font-variant-numeric:tabular-nums">${s.total_clicks||0}</td>
                        <td><span style="color:${parseFloat(ctr) > 50 ? '#10b981' : parseFloat(ctr) > 20 ? '#f59e0b' : '#ef4444'};font-weight:600">${ctr}%</span></td>
                      </tr>`;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            ` : '<p class="adm-empty">No search data yet. Data populates as visitors search.</p>'}
          </div>

          <div class="adm-card">
            <h3 class="adm-card-title"><i class="fas fa-clock-rotate-left"></i> Recent Searches</h3>
            ${(pepData.recentSearches||[]).length ? `
              <div style="max-height:350px;overflow-y:auto">
                ${(pepData.recentSearches||[]).map(s => `
                  <div class="adm-search-item">
                    <code class="adm-search-query">${esc(s.query)}</code>
                    <div class="adm-search-meta">
                      <span>${s.results_count||0} results</span>
                      ${s.clicked_peptide_name ? `<span class="adm-search-clicked"><i class="fas fa-mouse-pointer"></i> ${esc(s.clicked_peptide_name)}</span>` : ''}
                      ${s.country ? `<span>${countryFlag(s.country)}</span>` : ''}
                      <span>${timeAgo(s.created_at)}</span>
                    </div>
                  </div>
                `).join('')}
              </div>
            ` : '<p class="adm-empty">No searches yet</p>'}
          </div>
        </div>
      </div>
    `;
  }

  // ── Bot Detection sub-tab ────────────────────────────────────────────────
  async function _renderAnalyticsBots(ct) {
    ct.innerHTML = '<div style="text-align:center;padding:60px"><i class="fas fa-spinner fa-spin" style="font-size:24px;color:var(--text-muted)"></i></div>';
    const botRes = await fetch(`/api/admin/analytics/bots?days=${analyticsPeriod}`, { headers: getAdminHeaders() });
    const botData = await botRes.json().catch(() => ({ totalSessions:0, botSessions:0, botPct:'0.0', humanSessions:0, byScore:[], topFlags:[], recentBots:[], byDay:[] }));
    ct.innerHTML = renderBotDetection(botData);
  }

  function renderTrafficChart(daily) {
    if (!daily.length) return '<div class="adm-card" style="margin-top:0"><h3 class="adm-card-title"><i class="fas fa-chart-area"></i> Traffic Trend</h3><p class="adm-empty">No traffic data yet. Data will appear as visitors arrive.</p></div>';

    const chartId = 'admTrafficChart_' + Date.now();
    setTimeout(() => {
      if (typeof Chart === 'undefined') return;
      const labels = daily.map(d => d.date.slice(5));
      createChart(chartId, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'Pageviews',
              data: daily.map(d => d.pageviews || 0),
              backgroundColor: 'rgba(37,99,235,0.7)',
              hoverBackgroundColor: '#2563eb',
              borderRadius: 4,
              borderSkipped: false,
              order: 2
            },
            {
              label: 'Visitors',
              data: daily.map(d => d.unique_visitors || 0),
              backgroundColor: 'rgba(124,58,237,0.7)',
              hoverBackgroundColor: '#7c3aed',
              borderRadius: 4,
              borderSkipped: false,
              order: 3
            },
            {
              label: 'Sessions',
              data: daily.map(d => d.sessions || 0),
              type: 'line',
              borderColor: '#10b981',
              backgroundColor: 'rgba(16,185,129,0.08)',
              fill: true,
              pointRadius: 3,
              pointHoverRadius: 6,
              pointBackgroundColor: '#10b981',
              borderWidth: 2.5,
              order: 1
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: {
              display: true,
              position: 'top',
              align: 'start',
              labels: { usePointStyle: true, pointStyle: 'rectRounded', padding: 16, font: { size: 11, weight: 600 } }
            },
            tooltip: {
              backgroundColor: 'rgba(15,23,42,0.92)',
              titleFont: { weight: 700 },
              bodyFont: { size: 12 },
              padding: 12,
              cornerRadius: 10,
              displayColors: true,
              callbacks: {
                afterBody: function(items) {
                  const idx = items[0].dataIndex;
                  const d = daily[idx];
                  return ['New: ' + (d.new_visitors||0), 'Bounce: ' + (d.bounce_count||0)];
                }
              }
            }
          },
          scales: {
            x: { grid: { display: false }, ticks: { maxRotation: 45, font: { size: 10 } } },
            y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { size: 10 } } }
          }
        }
      });
    }, 50);

    return `
      <div class="adm-card adm-chart-card" style="margin-top:0">
        <h3 class="adm-card-title"><i class="fas fa-chart-area"></i> Traffic Trend</h3>
        <div style="position:relative;height:260px;width:100%">
          <canvas id="${chartId}"></canvas>
        </div>
      </div>`;
  }

  function renderHourlyChart(hourly) {
    if (!hourly.length) return '';
    const allHours = [];
    for (let i = 0; i < 24; i++) {
      const hStr = String(i).padStart(2, '0');
      const found = hourly.find(h => h.hour === hStr);
      allHours.push({ hour: hStr, events: found ? found.events : 0, unique_visitors: found ? found.unique_visitors : 0 });
    }
    const nowHour = new Date().getHours();
    const chartId = 'admHourlyChart_' + Date.now();

    setTimeout(() => {
      if (typeof Chart === 'undefined') return;
      createChart(chartId, {
        type: 'bar',
        data: {
          labels: allHours.map(h => h.hour + ':00'),
          datasets: [{
            label: 'Events',
            data: allHours.map(h => h.events),
            backgroundColor: allHours.map((h, i) => i === nowHour ? 'rgba(245,158,11,0.85)' : 'rgba(37,99,235,0.6)'),
            hoverBackgroundColor: allHours.map((h, i) => i === nowHour ? '#f59e0b' : '#2563eb'),
            borderRadius: 4,
            borderSkipped: false
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            tooltip: {
              backgroundColor: 'rgba(15,23,42,0.92)',
              padding: 10,
              cornerRadius: 8,
              callbacks: {
                afterLabel: function(ctx) {
                  return 'Visitors: ' + allHours[ctx.dataIndex].unique_visitors;
                }
              }
            }
          },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 9 }, maxRotation: 0, callback: function(v, i) { return i % 3 === 0 ? allHours[i].hour : ''; } } },
            y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.03)' }, ticks: { font: { size: 10 } } }
          }
        }
      });
    }, 50);

    return `
      <div class="adm-card" style="margin-top:16px">
        <h3 class="adm-card-title"><i class="fas fa-clock"></i> Today Hourly Breakdown</h3>
        <div style="position:relative;height:140px;width:100%">
          <canvas id="${chartId}"></canvas>
        </div>
        <p style="font-size:11px;color:var(--text-muted);margin:8px 0 0"><span style="display:inline-block;width:8px;height:8px;background:#f59e0b;border-radius:2px;margin-right:4px"></span>Current hour</p>
      </div>`;
  }

  function renderDonutBreakdown(items, labelKey, valueKey) {
    if (!items.length) return '<p class="adm-empty">No data yet</p>';
    const total = items.reduce((s, i) => s + (i[valueKey] || 0), 0);
    const chartId = 'admDonut_' + labelKey + '_' + Date.now();

    const deviceIcons = {
      desktop: 'fa-desktop', mobile: 'fa-mobile-screen', tablet: 'fa-tablet-screen-button',
      Chrome: 'fa-chrome', Firefox: 'fa-firefox-browser', Safari: 'fa-safari', Edge: 'fa-edge', Opera: 'fa-opera',
      Windows: 'fa-windows', macOS: 'fa-apple', Linux: 'fa-linux', Android: 'fa-android', iOS: 'fa-apple'
    };

    setTimeout(() => {
      if (typeof Chart === 'undefined') return;
      createChart(chartId, {
        type: 'doughnut',
        data: {
          labels: items.map(item => item[labelKey] || 'Unknown'),
          datasets: [{
            data: items.map(item => item[valueKey] || 0),
            backgroundColor: items.map((_, i) => colors[i % colors.length] + 'cc'),
            hoverBackgroundColor: items.map((_, i) => colors[i % colors.length]),
            borderWidth: 2,
            borderColor: 'rgba(255,255,255,0.9)',
            hoverBorderColor: '#fff',
            hoverOffset: 8
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          cutout: '62%',
          plugins: {
            tooltip: {
              backgroundColor: 'rgba(15,23,42,0.92)',
              padding: 10,
              cornerRadius: 8,
              callbacks: {
                label: function(ctx) {
                  const pct = total > 0 ? ((ctx.raw / total) * 100).toFixed(1) : '0';
                  return ctx.label + ': ' + ctx.raw.toLocaleString() + ' (' + pct + '%)';
                }
              }
            }
          }
        }
      });
    }, 50);

    return `
      <div style="display:flex;align-items:center;gap:20px;flex-wrap:wrap">
        <div style="width:140px;height:140px;flex-shrink:0">
          <canvas id="${chartId}"></canvas>
        </div>
        <div class="adm-donut-breakdown" style="flex:1;min-width:140px">
          ${items.map((item, i) => {
            const val = item[valueKey] || 0;
            const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0.0';
            const label = item[labelKey] || 'unknown';
            const icon = deviceIcons[label] || 'fa-circle';
            return `
              <div class="adm-donut-row">
                <div class="adm-donut-color" style="background:${colors[i % colors.length]}"></div>
                <i class="fab ${icon}" style="color:${colors[i % colors.length]};width:16px;text-align:center;font-size:12px"></i>
                <span class="adm-donut-label">${esc(label)}</span>
                <span class="adm-donut-pct">${pct}%</span>
                <span class="adm-donut-val">${val.toLocaleString()}</span>
              </div>`;
          }).join('')}
        </div>
      </div>`;
  }

  function changeAnalyticsPeriod(days) {
    analyticsPeriod = parseInt(days);
    _loadAnalyticsTab(analyticsTab);
  }

  function refreshAnalytics() {
    _loadAnalyticsTab(analyticsTab);
  }

  // ── Bot Detection Section ─────────────────────────────────────
  function renderBotDetection(botData) {
    const total = botData.totalSessions || 0;
    const bots = botData.botSessions || 0;
    const humans = botData.humanSessions || 0;
    const botPct = parseFloat(botData.botPct || 0);
    const humanPct = total > 0 ? (100 - botPct).toFixed(1) : '100.0';

    // Score breakdown
    const scoreRows = (botData.byScore || []);
    const scoreMap = {};
    for (const r of scoreRows) { scoreMap[r.risk || 'human'] = r.cnt || 0; }

    // Risk color map
    const riskColors = { high: '#ef4444', medium: '#f59e0b', low: '#06b6d4', human: '#10b981' };
    const riskIcons = { high: 'fa-robot', medium: 'fa-exclamation-triangle', low: 'fa-question-circle', human: 'fa-user-check' };
    const riskLabels = { high: 'High Risk (80+)', medium: 'Medium Risk (50-79)', low: 'Low Risk (30-49)', human: 'Human (<30)' };

    // Top bot flags explanation
    const flagExplanations = {
      'webdriver': 'Browser automation (Selenium/Playwright)',
      'headless': 'Headless Chrome detected',
      'bot_ua': 'Bot user-agent string',
      'no_mouse': 'No mouse movement',
      'no_scroll': 'No scroll events',
      'no_click': 'No click events',
      'no_plugins': 'Zero browser plugins',
      'precise_timing': 'Perfect timing (non-human)',
      'no_interaction': 'Zero interactions',
      'ultra_short': 'Session < 2 seconds',
      'straight_mouse': 'Straight-line mouse movement',
    };

    // Bot trend chart data
    const byDay = botData.byDay || [];
    const botTrendChartId = 'botTrendChart_' + Date.now();

    if (byDay.length > 1) {
      setTimeout(() => {
        if (typeof Chart === 'undefined') return;
        createChart(botTrendChartId, {
          type: 'line',
          data: {
            labels: byDay.map(d => d.date.slice(5)),
            datasets: [
              {
                label: 'Total Sessions',
                data: byDay.map(d => d.total || 0),
                borderColor: '#2563eb',
                backgroundColor: 'rgba(37,99,235,0.06)',
                fill: true,
                pointRadius: 3,
                borderWidth: 2,
                tension: 0.35
              },
              {
                label: 'Bot Sessions',
                data: byDay.map(d => d.bots || 0),
                borderColor: '#ef4444',
                backgroundColor: 'rgba(239,68,68,0.08)',
                fill: true,
                pointRadius: 3,
                borderWidth: 2,
                tension: 0.35
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
              legend: { display: true, position: 'top', align: 'start', labels: { usePointStyle: true, pointStyle: 'circle', padding: 14, font: { size: 11, weight: 600 } } },
              tooltip: { backgroundColor: 'rgba(15,23,42,0.92)', padding: 10, cornerRadius: 8 }
            },
            scales: {
              x: { grid: { display: false }, ticks: { font: { size: 10 } } },
              y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { size: 10 } } }
            }
          }
        });
      }, 50);
    }

    const botRiskLevel = botPct >= 30 ? 'high' : botPct >= 15 ? 'medium' : botPct >= 5 ? 'low' : 'clean';
    const botRiskColor = botRiskLevel === 'high' ? '#ef4444' : botRiskLevel === 'medium' ? '#f59e0b' : botRiskLevel === 'low' ? '#06b6d4' : '#10b981';
    const botRiskBg = botRiskLevel === 'high' ? 'linear-gradient(135deg,#fef2f2,#fff5f5)' : botRiskLevel === 'medium' ? 'linear-gradient(135deg,#fffbeb,#fefce8)' : 'linear-gradient(135deg,#f0fdf4,#ecfdf5)';
    const botRiskBorder = botRiskLevel === 'high' ? '#fecaca' : botRiskLevel === 'medium' ? '#fde68a' : '#86efac';

    return `
      <div style="margin-top:32px;padding-top:24px;border-top:2px solid var(--border-color,#e5e7eb)">
        <h2 style="font-size:18px;font-weight:800;margin:0 0 20px;display:flex;align-items:center;gap:10px;color:var(--text-primary)">
          <span style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#ef4444,#dc2626);display:flex;align-items:center;justify-content:center;color:#fff;font-size:16px"><i class="fas fa-robot"></i></span>
          Bot Traffic Detection
          <span style="font-size:12px;font-weight:600;padding:3px 10px;border-radius:20px;background:${botRiskBg};color:${botRiskColor};border:1px solid ${botRiskBorder}">
            ${botRiskLevel === 'clean' ? '✓ Clean' : botRiskLevel === 'low' ? '⚠ Low Bot' : botRiskLevel === 'medium' ? '⚠ Medium Bot' : '🤖 High Bot'}
          </span>
        </h2>

        <!-- Bot Summary Cards -->
        <div class="adm-stats-grid" style="margin-bottom:20px">
          <div class="adm-stat-card" style="border-left:3px solid #10b981">
            <div class="adm-stat-icon" style="background:#10b98115;color:#10b981"><i class="fas fa-user-check"></i></div>
            <div class="adm-stat-num">${humans.toLocaleString()}</div>
            <div class="adm-stat-label">Human Sessions</div>
            <div style="font-size:11px;color:#10b981;font-weight:600;margin-top:2px">${humanPct}%</div>
          </div>
          <div class="adm-stat-card" style="border-left:3px solid ${botRiskColor}">
            <div class="adm-stat-icon" style="background:${botRiskColor}15;color:${botRiskColor}"><i class="fas fa-robot"></i></div>
            <div class="adm-stat-num">${bots.toLocaleString()}</div>
            <div class="adm-stat-label">Bot Sessions</div>
            <div style="font-size:11px;color:${botRiskColor};font-weight:600;margin-top:2px">${botPct}% of traffic</div>
          </div>
          <div class="adm-stat-card" style="border-left:3px solid ${riskColors.high}">
            <div class="adm-stat-icon" style="background:${riskColors.high}15;color:${riskColors.high}"><i class="fas fa-exclamation-triangle"></i></div>
            <div class="adm-stat-num">${(scoreMap.high || 0).toLocaleString()}</div>
            <div class="adm-stat-label">High Risk (80+ score)</div>
          </div>
          <div class="adm-stat-card" style="border-left:3px solid ${riskColors.medium}">
            <div class="adm-stat-icon" style="background:${riskColors.medium}15;color:${riskColors.medium}"><i class="fas fa-question-circle"></i></div>
            <div class="adm-stat-num">${(scoreMap.medium || 0).toLocaleString()}</div>
            <div class="adm-stat-label">Medium Risk (50-79)</div>
          </div>
        </div>

        <!-- Bot vs Human bar -->
        <div class="adm-card" style="margin-bottom:20px">
          <h3 class="adm-card-title"><i class="fas fa-chart-bar"></i> Traffic Quality</h3>
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
            <div style="flex:1">
              <div style="display:flex;justify-content:space-between;margin-bottom:6px">
                <span style="font-size:12px;font-weight:600;color:#10b981"><i class="fas fa-user-check" style="margin-right:4px"></i>Human ${humanPct}%</span>
                <span style="font-size:12px;font-weight:600;color:${botRiskColor}"><i class="fas fa-robot" style="margin-right:4px"></i>Bot ${botPct}%</span>
              </div>
              <div style="height:20px;border-radius:10px;overflow:hidden;background:#f3f4f6;display:flex">
                <div style="width:${humanPct}%;background:linear-gradient(90deg,#10b981,#34d399);transition:width 0.8s ease;border-radius:10px 0 0 10px"></div>
                <div style="width:${botPct}%;background:linear-gradient(90deg,${botRiskColor},#fca5a5);transition:width 0.8s ease;border-radius:0 10px 10px 0;min-width:${bots > 0 ? '4px' : '0'}"></div>
              </div>
            </div>
          </div>
          ${byDay.length > 1 ? `
            <div style="position:relative;height:160px;width:100%;margin-top:12px">
              <canvas id="${botTrendChartId}"></canvas>
            </div>
          ` : `<p class="adm-empty">Not enough data for trend chart yet. Data will appear as visitors arrive.</p>`}
        </div>

        <!-- Bot Details: Flags + Recent Bots -->
        <div class="adm-two-col" style="margin-bottom:20px">
          <!-- Top Bot Signals -->
          <div class="adm-card">
            <h3 class="adm-card-title"><i class="fas fa-flag"></i> Top Bot Signals</h3>
            ${(botData.topFlags || []).length ? `
              <div class="adm-breakdown-list">
                ${(botData.topFlags || []).map((item, i) => {
                  const maxCnt = Math.max(...(botData.topFlags || []).map(x => x.cnt || 0));
                  const pct = maxCnt > 0 ? ((item.cnt / maxCnt) * 100) : 0;
                  const explanation = flagExplanations[item.flag] || item.flag;
                  return `
                    <div class="adm-breakdown-item" style="flex-direction:column;align-items:flex-start;gap:2px">
                      <div style="width:100%;display:flex;justify-content:space-between;margin-bottom:4px">
                        <span style="font-size:12px;font-weight:600;color:var(--text-primary)">${esc(explanation)}</span>
                        <span class="adm-breakdown-value" style="color:#ef4444">${(item.cnt||0).toLocaleString()}</span>
                      </div>
                      <div style="width:100%;height:6px;border-radius:3px;background:#f3f4f6;overflow:hidden">
                        <div style="width:${pct}%;height:100%;background:linear-gradient(90deg,#ef4444,#fca5a5);border-radius:3px"></div>
                      </div>
                      <code style="font-size:10px;color:var(--text-muted)">${esc(item.flag)}</code>
                    </div>`;
                }).join('')}
              </div>
            ` : `
              <div style="text-align:center;padding:32px 16px">
                <i class="fas fa-shield-check" style="font-size:32px;color:#10b981;opacity:0.6;margin-bottom:12px;display:block"></i>
                <p style="font-size:13px;color:var(--text-muted);margin:0">No bot signals detected yet.<br>Bot data accumulates as sessions are scored.</p>
              </div>
            `}
          </div>

          <!-- Risk Score Distribution -->
          <div class="adm-card">
            <h3 class="adm-card-title"><i class="fas fa-gauge-high"></i> Risk Score Distribution</h3>
            ${(botData.byScore || []).length ? `
              <div class="adm-breakdown-list">
                ${['high', 'medium', 'low', 'human'].map(risk => {
                  const cnt = scoreMap[risk] || 0;
                  const totalAll = Object.values(scoreMap).reduce((s, v) => s + v, 0) || 1;
                  const pct = ((cnt / totalAll) * 100).toFixed(1);
                  const color = riskColors[risk];
                  const icon = riskIcons[risk];
                  return `
                    <div class="adm-breakdown-item">
                      <div class="adm-breakdown-bar" style="width:${pct}%;background:${color}20"></div>
                      <i class="fas ${icon}" style="color:${color};width:16px;text-align:center;font-size:12px;flex-shrink:0"></i>
                      <span class="adm-breakdown-label">${riskLabels[risk]}</span>
                      <span class="adm-breakdown-value" style="color:${color}">${cnt.toLocaleString()}</span>
                    </div>`;
                }).join('')}
              </div>
              <div style="margin-top:16px;padding:12px;background:var(--bg-secondary,#f9fafb);border-radius:10px">
                <p style="font-size:12px;color:var(--text-muted);margin:0;line-height:1.6">
                  <strong>Score key:</strong> 0-29 = human, 30-49 = low risk, 50-79 = medium, 80+ = high.<br>
                  Scores are calculated from 11 behavioral signals tracked client-side.
                </p>
              </div>
            ` : '<p class="adm-empty">No score data yet. Bot scores are recorded with each session.</p>'}
          </div>
        </div>

        <!-- Recent Suspected Bots -->
        <div class="adm-card" style="margin-bottom:20px">
          <h3 class="adm-card-title"><i class="fas fa-list-ul"></i> Recent Suspected Bots</h3>
          ${(botData.recentBots || []).length ? `
            <div class="adm-table-wrap" style="max-height:280px;overflow-y:auto">
              <table class="adm-table adm-table-compact">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Session</th>
                    <th>Page</th>
                    <th>Device</th>
                    <th>Browser</th>
                    <th>Score</th>
                    <th>Signals</th>
                  </tr>
                </thead>
                <tbody>
                  ${(botData.recentBots || []).map(bot => {
                    const score = bot.bot_score || 0;
                    const scoreColor = score >= 80 ? '#ef4444' : score >= 50 ? '#f59e0b' : '#06b6d4';
                    const flags = (bot.bot_flags || '').split(',').filter(Boolean);
                    return `
                      <tr>
                        <td style="white-space:nowrap;font-size:11px">${timeAgo(bot.created_at)}</td>
                        <td style="font-size:11px;font-family:monospace;color:var(--text-muted)">${esc((bot.session_id||'').substring(0,10))}…</td>
                        <td><span class="adm-page-badge">${esc(bot.page || '/')}</span></td>
                        <td><span class="adm-device-badge adm-device-${(bot.device_type||'').toLowerCase()}">${esc(bot.device_type || '-')}</span></td>
                        <td style="font-size:11px">${esc(bot.browser || '-')}</td>
                        <td>
                          <span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700;background:${scoreColor}15;color:${scoreColor}">
                            <i class="fas fa-robot" style="font-size:9px"></i> ${score}
                          </span>
                        </td>
                        <td style="font-size:10px;color:var(--text-muted);max-width:180px">
                          ${flags.slice(0,3).map(f => `<span style="display:inline-block;padding:1px 5px;background:var(--bg-secondary,#f3f4f6);border-radius:4px;margin:1px">${esc(f)}</span>`).join('')}
                          ${flags.length > 3 ? `<span style="color:var(--text-muted)">+${flags.length-3}</span>` : ''}
                        </td>
                      </tr>`;
                  }).join('')}
                </tbody>
              </table>
            </div>
          ` : `
            <div style="text-align:center;padding:32px 16px">
              <i class="fas fa-shield-check" style="font-size:36px;color:#10b981;opacity:0.5;margin-bottom:12px;display:block"></i>
              <p style="font-size:14px;color:var(--text-muted);margin:0">No suspected bots in this period.</p>
              <p style="font-size:12px;color:var(--text-muted);margin:6px 0 0">Bot data accumulates as sessions are tracked with behavioral signals.</p>
            </div>
          `}
        </div>

        <!-- How it Works -->
        <div class="adm-card" style="background:linear-gradient(135deg,#f0f9ff,#e0f2fe);border:1px solid #bae6fd;margin-bottom:20px">
          <h3 class="adm-card-title" style="color:#0369a1"><i class="fas fa-info-circle"></i> How Bot Detection Works</h3>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px">
            <div style="background:rgba(255,255,255,0.7);border-radius:10px;padding:12px">
              <div style="font-size:12px;font-weight:700;color:#0369a1;margin-bottom:6px"><i class="fas fa-mouse-pointer" style="margin-right:4px"></i>Behavioral Signals</div>
              <p style="font-size:12px;color:#0c4a6e;margin:0;line-height:1.6">Tracks mouse movement, scrolling, clicking, and keyboard events. Real users interact; bots don't.</p>
            </div>
            <div style="background:rgba(255,255,255,0.7);border-radius:10px;padding:12px">
              <div style="font-size:12px;font-weight:700;color:#0369a1;margin-bottom:6px"><i class="fas fa-fingerprint" style="margin-right:4px"></i>Browser Fingerprint</div>
              <p style="font-size:12px;color:#0c4a6e;margin:0;line-height:1.6">Checks for <code>navigator.webdriver</code>, headless Chrome, bot user-agents, and zero plugins.</p>
            </div>
            <div style="background:rgba(255,255,255,0.7);border-radius:10px;padding:12px">
              <div style="font-size:12px;font-weight:700;color:#0369a1;margin-bottom:6px"><i class="fas fa-stopwatch" style="margin-right:4px"></i>Timing Analysis</div>
              <p style="font-size:12px;color:#0c4a6e;margin:0;line-height:1.6">Ultra-short sessions (&lt;2s), perfect timing precision, and straight-line mouse movement indicate automation.</p>
            </div>
            <div style="background:rgba(255,255,255,0.7);border-radius:10px;padding:12px">
              <div style="font-size:12px;font-weight:700;color:#0369a1;margin-bottom:6px"><i class="fas fa-gauge" style="margin-right:4px"></i>Scoring (0-100)</div>
              <p style="font-size:12px;color:#0c4a6e;margin:0;line-height:1.6">11 weighted signals combine into a bot score. Sessions scoring ≥40 are flagged as "suspected bot".</p>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ============================================
  // USERS TAB
  // ============================================
  async function renderUsers(container) {
    const res = await fetch('/api/admin/users?limit=50', { headers: getAdminHeaders() });
    const data = await res.json();

    container.innerHTML = `
      <div class="adm-toolbar">
        <input class="adm-search" placeholder="Search users..." oninput="window._admin.searchUsers(this.value)">
        <select class="adm-filter" onchange="window._admin.filterUsers(this.value)">
          <option value="">All roles</option>
          <option value="super_admin">Super Admin</option>
          <option value="staff">Staff</option>
          <option value="moderator">Moderator</option>
          <option value="influencer">Influencer</option>
          <option value="user">User</option>
        </select>
        <button class="adm-btn adm-btn-primary" onclick="window._admin.showAddUser()"><i class="fas fa-plus"></i> Add User</button>
      </div>
      <div class="adm-table-wrap">
        <table class="adm-table">
          <thead>
            <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th>Actions</th></tr>
          </thead>
          <tbody id="admUsersList">
            ${renderUserRows(data.users || [])}
          </tbody>
        </table>
      </div>
      <div id="admUserModal"></div>`;
  }

  const ROLE_META = {
    user:        { label: 'User',        color: '#6b7280', bg: '#f3f4f6', icon: 'fa-user',          desc: 'Standard account, no admin access' },
    moderator:   { label: 'Moderator',   color: '#7c3aed', bg: '#ede9fe', icon: 'fa-shield-halved',  desc: 'Can moderate content and posts' },
    staff:       { label: 'Staff',       color: '#d97706', bg: '#fef3c7', icon: 'fa-user-tie',       desc: 'Full analytics and CRM access' },
    influencer:  { label: 'Partner',     color: '#059669', bg: '#d1fae5', icon: 'fa-star',           desc: 'Partner dashboard and CRM access' },
    super_admin: { label: 'Super Admin', color: '#dc2626', bg: '#fee2e2', icon: 'fa-crown',          desc: 'Full system access - assign with care' },
  };

  function renderUserRows(users) {
    if (!users.length) return '<tr><td colspan="6" class="adm-empty">No users found</td></tr>';
    return users.map(u => {
      const rm = ROLE_META[u.role] || ROLE_META.user;
      // Encode id safely as data attribute to handle UUIDs
      const safeId = encodeURIComponent(u.id || '');
      return `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:8px">
            <div style="width:32px;height:32px;border-radius:50%;background:${rm.bg};color:${rm.color};display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;flex-shrink:0">
              ${esc((u.name||u.email||'?').charAt(0).toUpperCase())}
            </div>
            <div style="min-width:0">
              <strong style="font-size:13px;display:block">${esc(u.name || ', ')}</strong>
              ${u.username ? `<span style="font-size:11px;color:var(--text-muted)">@${esc(u.username)}</span>` : ''}
            </div>
          </div>
        </td>
        <td style="font-size:12px;color:var(--text-secondary)">${esc(u.email)}</td>
        <td>
          <span style="display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;background:${rm.bg};color:${rm.color}">
            <i class="fas ${rm.icon}" style="font-size:10px"></i> ${rm.label}
          </span>
        </td>
        <td>${u.is_banned ? '<span class="adm-status-banned"><i class="fas fa-ban" style="font-size:10px"></i> Banned</span>' : '<span class="adm-status-active"><i class="fas fa-circle" style="font-size:8px"></i> Active</span>'}</td>
        <td style="font-size:12px;color:var(--text-muted)">${u.created_at ? new Date(u.created_at).toLocaleDateString() : ', '}</td>
        <td>
          <div style="display:flex;gap:4px">
            <button class="adm-action-btn" onclick="window._admin.editUser(decodeURIComponent('${safeId}'))" title="Edit role &amp; details" style="gap:4px">
              <i class="fas fa-user-gear"></i>
            </button>
            ${u.role !== 'super_admin' ? `
            <button class="adm-action-btn ${u.is_banned ? '' : 'adm-action-danger'}" onclick="window._admin.toggleBan(decodeURIComponent('${safeId}'), ${u.is_banned ? 0 : 1})" title="${u.is_banned ? 'Unban user' : 'Ban user'}">
              <i class="fas fa-${u.is_banned ? 'unlock' : 'ban'}"></i>
            </button>` : ''}
          </div>
        </td>
      </tr>`;
    }).join('');
  }

  async function searchUsers(q) {
    const res = await fetch(`/api/admin/users?search=${encodeURIComponent(q)}&limit=50`, { headers: getAdminHeaders() });
    const data = await res.json();
    document.getElementById('admUsersList').innerHTML = renderUserRows(data.users || []);
  }

  async function filterUsers(role) {
    const res = await fetch(`/api/admin/users?role=${role}&limit=50`, { headers: getAdminHeaders() });
    const data = await res.json();
    document.getElementById('admUsersList').innerHTML = renderUserRows(data.users || []);
  }

  function showAddUser() {
    document.getElementById('admUserModal').innerHTML = `
      <div class="adm-modal-overlay" onclick="if(event.target===this)this.remove()">
        <div class="adm-modal">
          <h3 class="adm-modal-title"><i class="fas fa-user-plus"></i> Add User</h3>
          <div class="adm-form-group">
            <label>Name</label>
            <input id="addUserName" class="adm-input" placeholder="Full name">
          </div>
          <div class="adm-form-group">
            <label>Email</label>
            <input id="addUserEmail" class="adm-input" placeholder="email@example.com" type="email">
          </div>
          <div class="adm-form-group">
            <label>Role</label>
            <select id="addUserRole" class="adm-input">
              <option value="user">User</option>
              <option value="moderator">Moderator</option>
              <option value="staff">Staff</option>
              <option value="influencer">Influencer</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>
          <div class="adm-modal-actions">
            <button class="adm-btn" onclick="this.closest('.adm-modal-overlay').remove()">Cancel</button>
            <button class="adm-btn adm-btn-primary" onclick="window._admin.submitAddUser()">Add User</button>
          </div>
          <div id="addUserError" class="adm-form-error"></div>
        </div>
      </div>`;
  }

  async function submitAddUser() {
    const name = document.getElementById('addUserName').value.trim();
    const email = document.getElementById('addUserEmail').value.trim();
    const role = document.getElementById('addUserRole').value;
    const errorEl = document.getElementById('addUserError');

    if (!name || !email) { errorEl.textContent = 'Name and email are required'; return; }

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST', headers: getAdminHeaders(),
        body: JSON.stringify({ name, email, role })
      });
      const data = await res.json();
      if (data.error) { errorEl.textContent = data.error; return; }
      document.querySelector('.adm-modal-overlay')?.remove();
      loadTab('users');
      showToast('User added successfully');
    } catch(e) { errorEl.textContent = e.message; }
  }

  async function editUser(id) {
    const res = await fetch(`/api/admin/users?limit=200`, { headers: getAdminHeaders() });
    const data = await res.json();
    const user = (data.users || []).find(u => String(u.id) === String(id));
    if (!user) { showToast('User not found'); return; }

    const roles = ['user','moderator','staff','influencer','super_admin'];
    const roleOptions = roles.map(r => {
      const rm = ROLE_META[r];
      return `<option value="${r}" ${user.role === r ? 'selected' : ''}>${rm.label} - ${rm.desc}</option>`;
    }).join('');

    document.getElementById('admUserModal').innerHTML = `
      <div class="adm-modal-overlay" onclick="if(event.target===this)this.remove()">
        <div class="adm-modal" style="max-width:480px">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
            <div style="width:44px;height:44px;border-radius:50%;background:${ROLE_META[user.role]?.bg||'#f3f4f6'};color:${ROLE_META[user.role]?.color||'#6b7280'};display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:800;flex-shrink:0">
              ${esc((user.name||user.email||'?').charAt(0).toUpperCase())}
            </div>
            <div>
              <h3 style="margin:0;font-size:16px;font-weight:700">${esc(user.name||'Unknown')}</h3>
              <span style="font-size:12px;color:var(--text-muted)">${esc(user.email)}</span>
            </div>
          </div>

          <div class="adm-form-group">
            <label style="font-weight:600">Display Name</label>
            <input id="editUserName" class="adm-input" value="${esc(user.name||'')}" placeholder="Full name">
          </div>

          <div class="adm-form-group">
            <label style="font-weight:600">Forum Username</label>
            <input id="editUserUsername" class="adm-input" value="${esc(user.username||'')}" placeholder="${user.source === 'admin' && !user.username ? 'No account row yet (user must sign in once)' : 'e.g. Curious-Peptide-1234'}" maxlength="30">
            <div style="margin-top:6px;font-size:11px;color:var(--text-muted)">Public name on forum posts &amp; comments (assigned randomly at signup). 3-30 chars: letters, numbers, - or _. Renames apply to all their past posts.</div>
          </div>

          <div class="adm-form-group">
            <label style="font-weight:600">Role</label>
            <select id="editUserRole" class="adm-input" onchange="window._admin._previewRole(this.value)">
              ${roleOptions}
            </select>
            <div id="rolePreview" style="margin-top:8px;padding:10px 14px;border-radius:10px;font-size:12px;display:flex;align-items:center;gap:8px;background:${ROLE_META[user.role]?.bg||'#f3f4f6'};color:${ROLE_META[user.role]?.color||'#6b7280'}">
              <i class="fas ${ROLE_META[user.role]?.icon||'fa-user'}"></i>
              <span id="rolePreviewText">${ROLE_META[user.role]?.desc||''}</span>
            </div>
          </div>

          <div id="superAdminWarning" style="display:${user.role==='super_admin'?'none':'none'};padding:10px 14px;border-radius:10px;background:#fff1f2;color:#dc2626;font-size:12px;margin-bottom:12px;border:1px solid #fecaca">
            <i class="fas fa-triangle-exclamation"></i> <strong>Warning:</strong> Super Admin has full system access including the ability to manage all users and data.
          </div>

          <div class="adm-modal-actions">
            <button class="adm-btn" onclick="this.closest('.adm-modal-overlay').remove()">Cancel</button>
            <button class="adm-btn adm-btn-primary" onclick="window._admin.submitEditUser('${encodeURIComponent(id)}')"><i class="fas fa-save"></i> Save Changes</button>
          </div>
          <div id="editUserError" style="margin-top:10px;color:#dc2626;font-size:13px"></div>
        </div>
      </div>`;
  }

  function _previewRole(role) {
    const rm = ROLE_META[role] || ROLE_META.user;
    const preview = document.getElementById('rolePreview');
    const warn = document.getElementById('superAdminWarning');
    if (preview) {
      preview.style.background = rm.bg;
      preview.style.color = rm.color;
      const icon = preview.querySelector('i');
      if (icon) icon.className = `fas ${rm.icon}`;
      const txt = document.getElementById('rolePreviewText');
      if (txt) txt.textContent = rm.desc;
    }
    if (warn) warn.style.display = role === 'super_admin' ? 'block' : 'none';
  }

  async function submitEditUser(encodedId) {
    const id = decodeURIComponent(encodedId);
    const name = document.getElementById('editUserName').value.trim();
    const username = (document.getElementById('editUserUsername')?.value || '').trim();
    const role = document.getElementById('editUserRole').value;
    const errorEl = document.getElementById('editUserError');

    if (username && !/^[A-Za-z0-9][A-Za-z0-9_-]{2,29}$/.test(username)) {
      errorEl.textContent = 'Username must be 3-30 chars: letters, numbers, - or _';
      return;
    }

    // Confirm sensitive role changes
    if (role === 'super_admin') {
      if (!confirm('Grant Super Admin access? This user will have full control over the system.')) return;
    }

    const payload = { name, role };
    if (username) payload.username = username;
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(id)}`, {
        method: 'PUT', headers: getAdminHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.error) { errorEl.textContent = data.error; return; }
      document.querySelector('.adm-modal-overlay')?.remove();
      loadTab('users');
      showToast(`✅ ${name || 'User'} role updated to ${ROLE_META[role]?.label || role}`);
    } catch(e) { errorEl.textContent = e.message; }
  }

  async function toggleBan(id, ban) {
    if (!confirm(ban ? 'Ban this user? They will lose access immediately.' : 'Unban this user and restore access?')) return;
    const res = await fetch(`/api/admin/users/${encodeURIComponent(id)}`, {
      method: 'PUT', headers: getAdminHeaders(),
      body: JSON.stringify({ is_banned: ban ? 1 : 0, ban_reason: ban ? 'Banned by admin' : null })
    });
    const data = await res.json();
    if (data.error) { showToast('Error: ' + data.error); return; }
    loadTab('users');
    showToast(ban ? '🚫 User banned' : '✅ User unbanned');
  }

  // ============================================
  // APPLICATIONS TAB - Review partner applications
  // ============================================
  let appFilterStatus = 'pending';

  async function renderApplications(container) {
    try {
      const res = await fetch(`/api/admin/partner-applications?status=${appFilterStatus}`, { headers: getAdminHeaders() });
      const data = await res.json();
      const apps = data.applications || [];
      const counts = data.counts || {};
      const total = (counts.pending || 0) + (counts.approved || 0) + (counts.rejected || 0) + (counts.waitlisted || 0);

      container.innerHTML = `
        <div class="adm-section">
          <div class="adm-section-header" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
            <div>
              <h2 class="adm-section-title"><i class="fas fa-inbox" style="color:#7c3aed;margin-right:8px;"></i>Partner Applications</h2>
              <p style="font-size:13px;color:var(--text-secondary);margin:4px 0 0;">${total} total applications</p>
            </div>
            <a href="/partner" target="_blank" style="font-size:13px;color:#2563eb;text-decoration:none;"><i class="fas fa-external-link-alt"></i> View public signup page</a>
          </div>

          <!-- Status filters -->
          <div style="display:flex;gap:8px;margin:16px 0;flex-wrap:wrap;">
            ${['pending', 'approved', 'rejected', 'waitlisted', 'all'].map(s => `
              <button onclick="window._admin.filterApps('${s}')" style="padding:6px 16px;border-radius:20px;font-size:13px;font-weight:600;cursor:pointer;border:1px solid ${appFilterStatus === s ? '#2563eb' : 'var(--border-primary)'};background:${appFilterStatus === s ? '#2563eb' : 'var(--bg-primary)'};color:${appFilterStatus === s ? '#fff' : 'var(--text-secondary)'};">
                ${s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                ${s !== 'all' && counts[s] ? ` (${counts[s]})` : s === 'all' ? ` (${total})` : ''}
              </button>
            `).join('')}
          </div>

          ${apps.length === 0 ? `
            <div style="text-align:center;padding:40px;color:var(--text-secondary);">
              <i class="fas fa-inbox" style="font-size:32px;margin-bottom:12px;opacity:0.4;display:block;"></i>
              No ${appFilterStatus === 'all' ? '' : appFilterStatus} applications.
            </div>
          ` : `
            <div style="display:flex;flex-direction:column;gap:12px;">
              ${apps.map(a => `
                <div style="padding:20px;background:var(--bg-primary);border:1px solid var(--border-primary);border-radius:14px;${a.status === 'pending' ? 'border-left:4px solid #d97706;' : a.status === 'approved' ? 'border-left:4px solid #059669;' : a.status === 'rejected' ? 'border-left:4px solid #dc2626;' : 'border-left:4px solid #7c3aed;'}">
                  <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;">
                    <div style="flex:1;min-width:200px;">
                      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                        <span style="font-size:16px;font-weight:700;color:var(--text-primary);">${esc(a.name)}</span>
                        <span style="font-size:12px;padding:2px 8px;border-radius:10px;font-weight:600;${
                          a.status === 'pending' ? 'background:#fef3c7;color:#d97706;' :
                          a.status === 'approved' ? 'background:#d1fae5;color:#059669;' :
                          a.status === 'rejected' ? 'background:#fee2e2;color:#dc2626;' :
                          'background:#ede9fe;color:#7c3aed;'
                        }">${a.status}</span>
                      </div>
                      <div style="font-size:13px;color:var(--text-secondary);display:flex;flex-wrap:wrap;gap:12px;">
                        <span><i class="fas fa-envelope" style="margin-right:4px;"></i>${esc(a.email)}</span>
                        ${a.platform ? `<span><i class="fas fa-globe" style="margin-right:4px;"></i>${esc(a.platform)}${a.audience_size ? ' (' + esc(a.audience_size) + ')' : ''}</span>` : ''}
                        ${a.niche ? `<span><i class="fas fa-tag" style="margin-right:4px;"></i>${esc(a.niche)}</span>` : ''}
                        <span><i class="fas fa-calendar" style="margin-right:4px;"></i>${new Date(a.created_at).toLocaleDateString()}</span>
                      </div>
                      ${a.platform_url ? `<div style="margin-top:4px;font-size:13px;"><a href="${esc(a.platform_url)}" target="_blank" style="color:#2563eb;text-decoration:none;"><i class="fas fa-external-link-alt" style="margin-right:4px;"></i>${esc(a.platform_url)}</a></div>` : ''}
                      ${a.reason ? `<div style="margin-top:8px;font-size:13px;color:var(--text-secondary);line-height:1.5;background:var(--bg-secondary);padding:10px 14px;border-radius:8px;">"${esc(a.reason)}"</div>` : ''}
                      ${a.preferred_code ? `<div style="margin-top:6px;font-size:13px;color:var(--text-secondary);">Preferred code: <strong>${esc(a.preferred_code)}</strong></div>` : ''}
                      ${a.reviewer_notes ? `<div style="margin-top:6px;font-size:12px;color:#7c3aed;"><i class="fas fa-comment" style="margin-right:4px;"></i>Admin note: ${esc(a.reviewer_notes)}${a.reviewer_name ? ' - ' + esc(a.reviewer_name) : ''}</div>` : ''}
                    </div>

                    ${a.status === 'pending' ? `
                      <div style="display:flex;gap:8px;flex-shrink:0;">
                        <button onclick="window._admin.approveApp(${a.id}, '${esc(a.preferred_code || a.name.split(' ')[0].toUpperCase())}')" style="padding:8px 16px;background:#059669;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;"><i class="fas fa-check"></i> Approve</button>
                        <button onclick="window._admin.waitlistApp(${a.id})" style="padding:8px 16px;background:#7c3aed;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;"><i class="fas fa-hourglass-half"></i> Waitlist</button>
                        <button onclick="window._admin.rejectApp(${a.id})" style="padding:8px 16px;background:#dc2626;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;"><i class="fas fa-times"></i> Reject</button>
                      </div>
                    ` : ''}
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      `;
    } catch(e) {
      container.innerHTML = `<div style="padding:40px;text-align:center;color:#dc2626;"><i class="fas fa-exclamation-triangle"></i> Failed to load applications</div>`;
    }
  }

  async function approveApp(id, suggestedCode) {
    const code = prompt(`Partner code for this user:`, suggestedCode);
    if (!code) return;
    const notes = prompt('Admin notes (optional):', '');

    try {
      const res = await fetch(`/api/admin/partner-applications/${id}/approve`, {
        method: 'POST',
        headers: { ...getAdminHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ customCode: code.toUpperCase().replace(/[^A-Z0-9-]/g, ''), notes })
      });
      const data = await res.json();
      if (data.error) { alert(data.error); return; }
      showToast(data.message || 'Approved!', 'success');
      loadTab('applications');
    } catch { alert('Failed to approve.'); }
  }

  async function rejectApp(id) {
    const notes = prompt('Rejection reason (optional):');
    try {
      await fetch(`/api/admin/partner-applications/${id}/reject`, {
        method: 'POST',
        headers: { ...getAdminHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes })
      });
      showToast('Application rejected.', 'info');
      loadTab('applications');
    } catch { alert('Failed to reject.'); }
  }

  async function waitlistApp(id) {
    const notes = prompt('Waitlist reason (optional):');
    try {
      await fetch(`/api/admin/partner-applications/${id}/waitlist`, {
        method: 'POST',
        headers: { ...getAdminHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes })
      });
      showToast('Application waitlisted.', 'info');
      loadTab('applications');
    } catch { alert('Failed to waitlist.'); }
  }

  function filterApps(status) {
    appFilterStatus = status;
    loadTab('applications');
  }

  // ============================================
  // PARTNERS TAB
  // ============================================
  async function renderPartners(container) {
    const [affRes, usersRes] = await Promise.all([
      fetch('/api/admin/partners', { headers: getAdminHeaders() }),
      fetch('/api/admin/users?role=influencer&limit=100', { headers: getAdminHeaders() })
    ]);
    const affData = await affRes.json();
    const usersData = await usersRes.json();
    const partners = affData.partners || [];
    const influencers = usersData.users || [];

    container.innerHTML = `
      <div class="adm-toolbar">
        <div class="adm-toolbar-info">
          <span><strong>${partners.length}</strong> partner codes</span>
        </div>
        <button class="adm-btn adm-btn-primary" onclick="window._admin.showCreatePartner()"><i class="fas fa-plus"></i> Generate Code</button>
      </div>

      <div class="adm-aff-grid" id="admAffList">
        ${partners.length ? partners.map(a => renderPartnerCard(a)).join('') : '<p class="adm-empty" style="grid-column:1/-1">No partner codes yet. Create one to get started.</p>'}
      </div>
      <div id="admAffModal"></div>`;

    // Store influencers for the create modal
    window._admin._influencers = influencers;
    window._admin._allUsers = []; // Will fetch all users for the dropdown
  }

  function renderPartnerCard(a) {
    const totalClicks = a.total_clicks || 0;
    const totalSignups = a.total_signups || 0;
    const totalActive = a.total_active || 0;
    const totalJoins = a.total_joins || 0;
    const convRate = totalClicks > 0 ? ((totalSignups / totalClicks) * 100).toFixed(1) : '0.0';

    return `
      <div class="adm-aff-card ${!a.is_active ? 'adm-aff-inactive' : ''}">
        <div class="adm-aff-header">
          <div class="adm-aff-code">${esc(a.code)}</div>
          <span class="adm-aff-status ${a.is_active ? 'active' : 'inactive'}">${a.is_active ? 'Active' : 'Inactive'}</span>
        </div>
        <div class="adm-aff-meta">
          <span><i class="fas fa-user"></i> ${esc(a.influencer_name || 'Unknown')}</span>
          ${a.label ? `<span><i class="fas fa-tag"></i> ${esc(a.label)}</span>` : ''}
        </div>
        <div class="adm-aff-stats">
          <div class="adm-aff-stat"><div class="adm-aff-stat-num">${totalClicks}</div><div class="adm-aff-stat-label">Clicks</div></div>
          <div class="adm-aff-stat"><div class="adm-aff-stat-num">${totalSignups}</div><div class="adm-aff-stat-label">Signups</div></div>
          <div class="adm-aff-stat"><div class="adm-aff-stat-num">${totalActive}</div><div class="adm-aff-stat-label">Active</div></div>
          <div class="adm-aff-stat"><div class="adm-aff-stat-num">${convRate}%</div><div class="adm-aff-stat-label">Conv.</div></div>
        </div>
        <div class="adm-aff-link">
          <code>peptidesafe.org?ref=${esc(a.code)}</code>
          <button class="adm-copy-btn" onclick="navigator.clipboard.writeText('https://peptidesafe.org?ref=${esc(a.code)}');this.innerHTML='<i class=\\'fas fa-check\\'></i>';setTimeout(()=>this.innerHTML='<i class=\\'fas fa-copy\\'></i>',1500)" title="Copy link"><i class="fas fa-copy"></i></button>
        </div>
        <div class="adm-aff-actions">
          <button class="adm-btn adm-btn-sm" onclick="window._admin.viewPartnerStats(${a.id})"><i class="fas fa-chart-line"></i> Stats</button>
          <button class="adm-btn adm-btn-sm" onclick="window._admin.togglePartner(${a.id}, ${a.is_active ? 0 : 1})">${a.is_active ? '<i class="fas fa-pause"></i> Pause' : '<i class="fas fa-play"></i> Activate'}</button>
        </div>
      </div>`;
  }

  async function showCreatePartner() {
    // Fetch all users (not just influencers) for assignment
    const res = await fetch('/api/admin/users?limit=200', { headers: getAdminHeaders() });
    const data = await res.json();
    const users = data.users || [];

    document.getElementById('admAffModal').innerHTML = `
      <div class="adm-modal-overlay" onclick="if(event.target===this)this.remove()">
        <div class="adm-modal">
          <h3 class="adm-modal-title"><i class="fas fa-link"></i> Generate Partner Code</h3>
          <div class="adm-form-group">
            <label>Assign to User</label>
            <select id="affUserId" class="adm-input">
              <option value="">Select a user...</option>
              ${users.map(u => `<option value="${u.id}">${esc(u.name)} (${esc(u.email)}) - ${u.role}</option>`).join('')}
            </select>
          </div>
          <div class="adm-form-group">
            <label>Partner Code</label>
            <div style="display:flex;gap:8px">
              <input id="affCode" class="adm-input" placeholder="e.g. DRPEPTIDE15" style="text-transform:uppercase">
              <button class="adm-btn" onclick="document.getElementById('affCode').value=window._admin.generateCode()" title="Auto-generate"><i class="fas fa-dice"></i></button>
            </div>
            <small style="color:var(--text-muted);font-size:11px">3-30 characters, letters, numbers, hyphens only</small>
          </div>
          <div class="adm-form-group">
            <label>Label (optional)</label>
            <input id="affLabel" class="adm-input" placeholder="e.g. YouTube Campaign Q1">
          </div>
          <div class="adm-modal-actions">
            <button class="adm-btn" onclick="this.closest('.adm-modal-overlay').remove()">Cancel</button>
            <button class="adm-btn adm-btn-primary" onclick="window._admin.submitCreatePartner()">Generate Code</button>
          </div>
          <div id="affError" class="adm-form-error"></div>
        </div>
      </div>`;
  }

  function generateCode() {
    const words = ['PEPTIDE','SAFE','BIO','HACK','HEALTH','REGEN','HEAL','BOOST','PEAK','NEURO'];
    const w = words[Math.floor(Math.random() * words.length)];
    const n = Math.floor(Math.random() * 90) + 10;
    return w + n;
  }

  async function submitCreatePartner() {
    const user_id = document.getElementById('affUserId').value;
    const code = document.getElementById('affCode').value.trim();
    const label = document.getElementById('affLabel').value.trim();
    const errorEl = document.getElementById('affError');

    if (!user_id) { errorEl.textContent = 'Select a user'; return; }
    if (!code) { errorEl.textContent = 'Enter a code'; return; }

    try {
      const res = await fetch('/api/admin/partners', {
        method: 'POST', headers: getAdminHeaders(),
        body: JSON.stringify({ user_id: parseInt(user_id), code, label })
      });
      const data = await res.json();
      if (data.error) { errorEl.textContent = data.error; return; }
      document.querySelector('.adm-modal-overlay')?.remove();
      loadTab('partners');
      showToast('Partner code created: ' + data.code);
    } catch(e) { errorEl.textContent = e.message; }
  }

  async function togglePartner(id, activate) {
    await fetch(`/api/admin/partners/${id}`, {
      method: 'PUT', headers: getAdminHeaders(),
      body: JSON.stringify({ is_active: activate })
    });
    loadTab('partners');
    showToast(activate ? 'Code activated' : 'Code paused');
  }

  async function viewPartnerStats(id) {
    const res = await fetch(`/api/admin/partners/${id}/stats?days=30`, { headers: getAdminHeaders() });
    const data = await res.json();

    document.getElementById('admAffModal').innerHTML = `
      <div class="adm-modal-overlay" onclick="if(event.target===this)this.remove()">
        <div class="adm-modal adm-modal-lg">
          <h3 class="adm-modal-title"><i class="fas fa-chart-line"></i> Partner Stats (30 days)</h3>
          <div class="adm-stats-grid" style="margin-bottom:20px">
            <div class="adm-stat-card"><div class="adm-stat-num">${data.totals?.clicks || 0}</div><div class="adm-stat-label">Total Clicks</div></div>
            <div class="adm-stat-card"><div class="adm-stat-num">${data.totals?.signups || 0}</div><div class="adm-stat-label">Signups</div></div>
            <div class="adm-stat-card"><div class="adm-stat-num">${data.totals?.active_users || 0}</div><div class="adm-stat-label">Active Users</div></div>
            <div class="adm-stat-card"><div class="adm-stat-num">${data.totals?.joins || 0}</div><div class="adm-stat-label">Community Joins</div></div>
          </div>

          ${data.daily?.length ? `
            <h4 style="font-size:13px;font-weight:600;margin:0 0 10px;color:var(--text-secondary)">Daily Breakdown</h4>
            <div class="adm-table-wrap" style="max-height:250px;overflow-y:auto">
              <table class="adm-table">
                <thead><tr><th>Date</th><th>Clicks</th><th>Signups</th><th>Active</th><th>Joins</th></tr></thead>
                <tbody>
                  ${data.daily.map(d => `<tr><td>${d.date}</td><td>${d.clicks}</td><td>${d.signups}</td><td>${d.active_users}</td><td>${d.community_joins}</td></tr>`).join('')}
                </tbody>
              </table>
            </div>
          ` : '<p class="adm-empty">No data for this period</p>'}

          <div class="adm-modal-actions" style="margin-top:16px">
            <button class="adm-btn adm-btn-primary" onclick="this.closest('.adm-modal-overlay').remove()">Close</button>
          </div>
        </div>
      </div>`;
  }

  // ============================================
  // MODERATION TAB
  // ============================================
  async function renderModeration(container) {
    const res = await fetch('/api/admin/moderation?status=pending', { headers: getAdminHeaders() });
    const data = await res.json();
    const items = data.items || [];

    container.innerHTML = `
      <div class="adm-toolbar">
        <select class="adm-filter" onchange="window._admin.filterModeration(this.value)">
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <span class="adm-toolbar-info">${items.length} items</span>
      </div>
      <div id="admModList">
        ${items.length ? items.map(item => `
          <div class="adm-mod-item">
            <div class="adm-mod-header">
              <span class="adm-mod-type">${esc(item.content_type)}</span>
              <span class="adm-mod-date">${timeAgo(item.created_at)}</span>
            </div>
            <div class="adm-mod-reason"><strong>Reason:</strong> ${esc(item.reason || 'No reason given')}</div>
            <div class="adm-mod-actions">
              <button class="adm-btn adm-btn-sm adm-btn-success" onclick="window._admin.moderateItem(${item.id}, 'approved')"><i class="fas fa-check"></i> Approve</button>
              <button class="adm-btn adm-btn-sm adm-btn-danger" onclick="window._admin.moderateItem(${item.id}, 'rejected')"><i class="fas fa-times"></i> Reject</button>
            </div>
          </div>
        `).join('') : '<p class="adm-empty">No pending items. All clear!</p>'}
      </div>`;
  }

  async function filterModeration(status) {
    const res = await fetch(`/api/admin/moderation?status=${status}`, { headers: getAdminHeaders() });
    const data = await res.json();
    const items = data.items || [];
    document.getElementById('admModList').innerHTML = items.length ? items.map(item => `
      <div class="adm-mod-item">
        <div class="adm-mod-header">
          <span class="adm-mod-type">${esc(item.content_type)}</span>
          <span class="adm-mod-date">${timeAgo(item.created_at)}</span>
        </div>
        <div class="adm-mod-reason"><strong>Reason:</strong> ${esc(item.reason || 'No reason given')}</div>
        ${item.status !== 'pending' ? `<div class="adm-mod-reviewed">Reviewed by ${esc(item.reviewer_name || 'Unknown')}: ${esc(item.review_note || '')}</div>` : ''}
      </div>
    `).join('') : '<p class="adm-empty">No items with status: ' + status + '</p>';
  }

  async function moderateItem(id, status) {
    const note = prompt('Add a note (optional):') || '';
    await fetch(`/api/admin/moderation/${id}`, {
      method: 'PUT', headers: getAdminHeaders(),
      body: JSON.stringify({ status, note })
    });
    loadTab('moderation');
    showToast('Item ' + status);
  }

  // ============================================
  // AUDIT LOG TAB
  // ============================================
  async function renderAuditLog(container) {
    const res = await fetch('/api/admin/audit-log?limit=100', { headers: getAdminHeaders() });
    const data = await res.json();
    const logs = data.logs || [];

    container.innerHTML = `
      <div class="adm-table-wrap">
        <table class="adm-table">
          <thead><tr><th>Admin</th><th>Action</th><th>Target</th><th>Details</th><th>When</th></tr></thead>
          <tbody>
            ${logs.length ? logs.map(l => `
              <tr>
                <td><strong>${esc(l.admin_name)}</strong></td>
                <td><span class="adm-action-badge">${esc(l.action)}</span></td>
                <td style="font-size:12px">${esc(l.target_type || '')} ${esc(l.target_id || '')}</td>
                <td style="font-size:12px;max-width:200px;overflow:hidden;text-overflow:ellipsis" title="${esc(l.details || '')}">${esc(l.details || '')}</td>
                <td style="font-size:12px">${timeAgo(l.created_at)}</td>
              </tr>
            `).join('') : '<tr><td colspan="5" class="adm-empty">No audit logs yet</td></tr>'}
          </tbody>
        </table>
      </div>`;
  }

  // ============================================
  // MARKET INTELLIGENCE TAB (Pharma/Telehealth)
  // ============================================
  let marketPeriod = 30;

  async function renderMarketIntel(container) {
    container.innerHTML = '<div style="text-align:center;padding:60px"><i class="fas fa-spinner fa-spin" style="font-size:24px;color:var(--text-muted)"></i><p style="margin-top:12px;color:var(--text-secondary);font-size:13px">Loading market intelligence...</p></div>';

    const res = await fetch(`/api/admin/analytics/market?days=${marketPeriod}`, { headers: getAdminHeaders() });
    const data = await res.json();
    if (data.error) { container.innerHTML = `<div class="adm-error">${esc(data.error)}</div>`; return; }

    const demandPeps = data.demandByPeptide || [];
    const goals = data.demandByGoal || {};
    const geo = data.demandByGeo || [];
    const segments = data.userSegments || [];
    const combos = data.topCombinations || [];
    const funnel = data.funnel || [];
    const depth = data.contentDepth || [];
    const totalAudience = data.audienceSize || 0;

    // Goal labels for chart
    const goalLabels = { healing: 'Healing/Recovery', weight_loss: 'Weight Loss', muscle: 'Muscle Growth', anti_aging: 'Anti-Aging', cognitive: 'Cognitive/Nootropic', immune: 'Immune Support', sexual_health: 'Sexual Health', sleep: 'Sleep/Recovery' };
    const goalColors = { healing: '#10b981', weight_loss: '#ef4444', muscle: '#3b82f6', anti_aging: '#a855f7', cognitive: '#06b6d4', immune: '#f59e0b', sexual_health: '#ec4899', sleep: '#6366f1' };

    // Build goal bars
    const goalEntries = Object.entries(goalLabels).map(([k, label]) => ({ key: k, label, value: goals[k] || 0 })).sort((a, b) => b.value - a.value);
    const maxGoal = Math.max(...goalEntries.map(g => g.value), 1);

    // Funnel totals for conversion calculation
    const funnelMax = funnel.length > 0 ? Math.max(...funnel.map(s => s.users || 0), 1) : 1;
    const funnelLabels = { landing: 'Site Visit', browse: 'Browse Peptides', deep_research: 'Deep Research', dosing_calc: 'Dosing Calculator', protocol_view: 'View Protocol', stack_build: 'Build Stack', community_engage: 'Community Engage', account_create: 'Create Account', return_visit: 'Return Visit' };
    const funnelColors = ['#3b82f6','#2563eb','#1d4ed8','#7c3aed','#6d28d9','#a855f7','#ec4899','#10b981','#059669'];

    container.innerHTML = `
      <div class="adm-analytics-wrap">
        <!-- Header Banner -->
        <div style="background:linear-gradient(135deg,#0f172a,#1e293b);border-radius:16px;padding:28px 32px;margin-bottom:24px;color:#fff;position:relative;overflow:hidden">
          <div style="position:absolute;top:-20px;right:-20px;width:160px;height:160px;background:linear-gradient(135deg,rgba(99,102,241,0.2),rgba(168,85,247,0.1));border-radius:50%"></div>
          <div style="position:absolute;bottom:-30px;right:60px;width:100px;height:100px;background:linear-gradient(135deg,rgba(6,182,212,0.15),rgba(59,130,246,0.1));border-radius:50%"></div>
          <div style="position:relative;z-index:1">
            <div style="display:flex;align-items:center;gap:14px;margin-bottom:8px">
              <span style="width:42px;height:42px;border-radius:12px;background:linear-gradient(135deg,#6366f1,#8b5cf6);display:flex;align-items:center;justify-content:center;font-size:18px"><i class="fas fa-building-columns"></i></span>
              <div>
                <h2 style="margin:0;font-size:22px;font-weight:800;letter-spacing:-0.5px">Market Intelligence</h2>
                <p style="margin:2px 0 0;font-size:13px;color:#94a3b8">Anonymized behavioral data for telehealth & pharmaceutical analytics</p>
              </div>
            </div>
            <div style="display:flex;gap:24px;margin-top:16px;flex-wrap:wrap">
              <div style="background:rgba(255,255,255,0.08);border-radius:10px;padding:10px 16px;backdrop-filter:blur(8px)">
                <div style="font-size:24px;font-weight:800">${totalAudience.toLocaleString()}</div>
                <div style="font-size:11px;color:#94a3b8;margin-top:2px">Research Profiles</div>
              </div>
              <div style="background:rgba(255,255,255,0.08);border-radius:10px;padding:10px 16px;backdrop-filter:blur(8px)">
                <div style="font-size:24px;font-weight:800">${demandPeps.length}</div>
                <div style="font-size:11px;color:#94a3b8;margin-top:2px">Active Compounds</div>
              </div>
              <div style="background:rgba(255,255,255,0.08);border-radius:10px;padding:10px 16px;backdrop-filter:blur(8px)">
                <div style="font-size:24px;font-weight:800">${geo.length}</div>
                <div style="font-size:11px;color:#94a3b8;margin-top:2px">Countries</div>
              </div>
              <div style="background:rgba(255,255,255,0.08);border-radius:10px;padding:10px 16px;backdrop-filter:blur(8px)">
                <div style="font-size:24px;font-weight:800">${combos.length}</div>
                <div style="font-size:11px;color:#94a3b8;margin-top:2px">Tracked Combos</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Period & Refresh -->
        <div class="adm-toolbar" style="margin-bottom:20px">
          <div style="display:flex;align-items:center;gap:8px">
            <i class="fas fa-calendar" style="color:var(--text-muted)"></i>
            <select class="adm-filter" onchange="window._admin.changeMarketPeriod(this.value)" style="min-width:140px">
              <option value="7" ${marketPeriod===7?'selected':''}>Last 7 days</option>
              <option value="14" ${marketPeriod===14?'selected':''}>Last 14 days</option>
              <option value="30" ${marketPeriod===30?'selected':''}>Last 30 days</option>
              <option value="60" ${marketPeriod===60?'selected':''}>Last 60 days</option>
              <option value="90" ${marketPeriod===90?'selected':''}>Last 90 days</option>
            </select>
          </div>
          <button class="adm-btn" onclick="window._admin.refreshMarket()"><i class="fas fa-sync-alt"></i> Refresh</button>
        </div>

        <!-- ============================== -->
        <!-- 1. COMPOUND DEMAND RANKINGS    -->
        <!-- ============================== -->
        <div class="adm-card" style="margin-bottom:20px">
          <h3 class="adm-card-title"><i class="fas fa-ranking-star" style="color:#f59e0b"></i> Compound Demand Rankings</h3>
          <p style="font-size:12px;color:var(--text-secondary);margin:-4px 0 16px">Purchase intent, dosing research, safety inquiries, and comparison shopping signals scored and ranked.</p>
          ${demandPeps.length ? `
            <div class="adm-table-wrap" style="max-height:500px;overflow-y:auto">
              <table class="adm-table adm-table-compact">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Compound</th>
                    <th>Category</th>
                    <th title="General research browsing">Research</th>
                    <th title="Dosing calculator usage">Dosing</th>
                    <th title="Purchase-intent signals (bookmarks, external links)">Purchase</th>
                    <th title="Compared with other compounds">Compare</th>
                    <th title="Side effect / safety searches">Safety</th>
                    <th title="Weighted demand score">Demand Score</th>
                  </tr>
                </thead>
                <tbody>
                  ${demandPeps.map((p, i) => {
                    const maxScore = demandPeps[0]?.demand_score || 1;
                    const barPct = Math.max(4, (p.demand_score / maxScore) * 100);
                    return `
                      <tr>
                        <td style="font-weight:700;color:${i < 3 ? '#f59e0b' : 'var(--text-muted)'};font-size:13px">${i+1}</td>
                        <td><strong style="font-size:13px">${esc(p.peptide_name || p.peptide_id)}</strong></td>
                        <td><span class="adm-cat-badge">${esc(p.category || '-')}</span></td>
                        <td style="font-variant-numeric:tabular-nums;font-size:13px">${p.research || 0}</td>
                        <td style="font-variant-numeric:tabular-nums;font-size:13px">${p.dosing || 0}</td>
                        <td style="font-variant-numeric:tabular-nums;font-size:13px;color:#059669;font-weight:600">${p.purchase || 0}</td>
                        <td style="font-variant-numeric:tabular-nums;font-size:13px">${p.comparison || 0}</td>
                        <td style="font-variant-numeric:tabular-nums;font-size:13px;color:#ef4444">${p.safety || 0}</td>
                        <td>
                          <div style="display:flex;align-items:center;gap:8px">
                            <div style="flex:1;height:8px;background:#f1f5f9;border-radius:4px;overflow:hidden;min-width:60px">
                              <div style="width:${barPct}%;height:100%;background:linear-gradient(90deg,#6366f1,#8b5cf6);border-radius:4px"></div>
                            </div>
                            <strong style="color:#6366f1;font-size:13px;min-width:32px;text-align:right">${Math.round(p.demand_score || 0)}</strong>
                          </div>
                        </td>
                      </tr>`;
                  }).join('')}
                </tbody>
              </table>
            </div>
          ` : '<p class="adm-empty">No demand data yet. Signals populate as users research compounds.</p>'}
        </div>

        <!-- ============================== -->
        <!-- 2. THERAPEUTIC GOAL DEMAND     -->
        <!-- ============================== -->
        <div class="adm-two-col" style="margin-bottom:20px">
          <div class="adm-card">
            <h3 class="adm-card-title"><i class="fas fa-bullseye" style="color:#ec4899"></i> Therapeutic Goal Demand</h3>
            <p style="font-size:12px;color:var(--text-secondary);margin:-4px 0 16px">What health goals are driving peptide research interest.</p>
            ${goalEntries.some(g => g.value > 0) ? `
              <div style="display:flex;flex-direction:column;gap:10px">
                ${goalEntries.map(g => {
                  const pct = maxGoal > 0 ? ((g.value / maxGoal) * 100) : 0;
                  return `
                    <div style="display:flex;align-items:center;gap:10px">
                      <span style="width:130px;font-size:12px;font-weight:600;color:var(--text-primary);text-align:right;flex-shrink:0">${esc(g.label)}</span>
                      <div style="flex:1;height:20px;background:#f1f5f9;border-radius:6px;overflow:hidden;position:relative">
                        <div style="width:${pct}%;height:100%;background:${goalColors[g.key] || '#6366f1'};border-radius:6px;transition:width 0.4s ease"></div>
                      </div>
                      <span style="width:36px;font-size:13px;font-weight:700;color:var(--text-primary);text-align:right">${g.value}</span>
                    </div>`;
                }).join('')}
              </div>
            ` : '<p class="adm-empty">No therapeutic goal data yet</p>'}
          </div>

          <!-- User Research Segments -->
          <div class="adm-card">
            <h3 class="adm-card-title"><i class="fas fa-user-group" style="color:#06b6d4"></i> User Research Segments</h3>
            <p style="font-size:12px;color:var(--text-secondary);margin:-4px 0 16px">Behavioral segmentation by experience level and engagement depth.</p>
            ${segments.length ? `
              <div style="display:flex;flex-direction:column;gap:12px">
                ${segments.map((seg, i) => {
                  const levelColors = { beginner: '#3b82f6', intermediate: '#f59e0b', advanced: '#ef4444', researcher: '#8b5cf6' };
                  const levelIcons = { beginner: 'fa-seedling', intermediate: 'fa-flask', advanced: 'fa-microscope', researcher: 'fa-atom' };
                  const c = levelColors[seg.experience_level] || '#6b7280';
                  const ic = levelIcons[seg.experience_level] || 'fa-user';
                  return `
                    <div style="background:#f8fafc;border-radius:12px;padding:14px 16px;border:1px solid #e2e8f0">
                      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
                        <div style="display:flex;align-items:center;gap:8px">
                          <span style="width:28px;height:28px;border-radius:8px;background:${c}15;color:${c};display:flex;align-items:center;justify-content:center;font-size:12px"><i class="fas ${ic}"></i></span>
                          <strong style="text-transform:capitalize;font-size:13px">${esc(seg.experience_level)}</strong>
                        </div>
                        <span style="background:${c}15;color:${c};padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700">${seg.count} users</span>
                      </div>
                      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px">
                        <div style="text-align:center;padding:6px;background:#fff;border-radius:8px">
                          <div style="font-size:14px;font-weight:700;color:var(--text-primary)">${Math.round(seg.avg_pageviews || 0)}</div>
                          <div style="font-size:10px;color:var(--text-muted)">Avg Pages</div>
                        </div>
                        <div style="text-align:center;padding:6px;background:#fff;border-radius:8px">
                          <div style="font-size:14px;font-weight:700;color:var(--text-primary)">${Math.round(seg.avg_peptides || 0)}</div>
                          <div style="font-size:10px;color:var(--text-muted)">Avg Peptides</div>
                        </div>
                        <div style="text-align:center;padding:6px;background:#fff;border-radius:8px">
                          <div style="font-size:14px;font-weight:700;color:var(--text-primary)">${Math.round(seg.avg_calc || 0)}</div>
                          <div style="font-size:10px;color:var(--text-muted)">Avg Calc</div>
                        </div>
                        <div style="text-align:center;padding:6px;background:#fff;border-radius:8px">
                          <div style="font-size:14px;font-weight:700;color:var(--text-primary)">${Math.round(seg.avg_duration || 0)}s</div>
                          <div style="font-size:10px;color:var(--text-muted)">Avg Duration</div>
                        </div>
                      </div>
                    </div>`;
                }).join('')}
              </div>
            ` : '<p class="adm-empty">No user segment data yet. Profiles build automatically as users browse.</p>'}
          </div>
        </div>

        <!-- ============================== -->
        <!-- 3. RESEARCH FUNNEL             -->
        <!-- ============================== -->
        <div class="adm-card" style="margin-bottom:20px">
          <h3 class="adm-card-title"><i class="fas fa-filter" style="color:#7c3aed"></i> Research Engagement Funnel</h3>
          <p style="font-size:12px;color:var(--text-secondary);margin:-4px 0 16px">User journey from initial visit through deep research engagement. Shows where users drop off and conversion rates between stages.</p>
          ${funnel.length ? `
            <div style="display:flex;flex-direction:column;gap:4px;max-width:700px;margin:0 auto">
              ${funnel.map((s, i) => {
                const width = Math.max(20, (s.users / funnelMax) * 100);
                const prevUsers = i > 0 ? (funnel[i-1].users || 1) : s.users;
                const convRate = prevUsers > 0 ? ((s.users / prevUsers) * 100).toFixed(1) : '100.0';
                const dropOff = i > 0 ? (100 - parseFloat(convRate)).toFixed(1) : '0.0';
                return `
                  <div style="display:flex;align-items:center;gap:12px">
                    <span style="width:130px;font-size:11px;font-weight:600;text-align:right;color:var(--text-secondary);flex-shrink:0">${funnelLabels[s.stage] || s.stage}</span>
                    <div style="flex:1;position:relative">
                      <div style="width:${width}%;height:32px;background:${funnelColors[i] || '#6366f1'};border-radius:6px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:700;min-width:40px;transition:width 0.4s ease">
                        ${s.users}
                      </div>
                    </div>
                    <div style="width:80px;text-align:right;flex-shrink:0">
                      ${i > 0 ? `<span style="font-size:11px;font-weight:600;color:${parseFloat(convRate) >= 50 ? '#10b981' : parseFloat(convRate) >= 25 ? '#f59e0b' : '#ef4444'}">${convRate}%</span>
                      <span style="font-size:10px;color:var(--text-muted);display:block">${dropOff}% drop</span>` : '<span style="font-size:11px;color:var(--text-muted)">entry</span>'}
                    </div>
                  </div>`;
              }).join('')}
            </div>
          ` : '<p class="adm-empty">No funnel data yet. Data auto-populates as visitors navigate the site.</p>'}
        </div>

        <!-- ============================== -->
        <!-- 4. COMPOUND COMBINATIONS       -->
        <!-- ============================== -->
        <div class="adm-two-col" style="margin-bottom:20px">
          <div class="adm-card">
            <h3 class="adm-card-title"><i class="fas fa-link" style="color:#f59e0b"></i> Top Compound Combinations</h3>
            <p style="font-size:12px;color:var(--text-secondary);margin:-4px 0 16px">Peptide pairs frequently stacked, compared, or researched together.</p>
            ${combos.length ? `
              <div style="display:flex;flex-direction:column;gap:8px;max-height:400px;overflow-y:auto">
                ${combos.map((c, i) => {
                  const maxCount = combos[0]?.total_count || 1;
                  const pct = Math.max(8, (c.total_count / maxCount) * 100);
                  const typeIcon = c.combination_type === 'stack' ? 'fa-layer-group' : c.combination_type === 'comparison' ? 'fa-code-compare' : c.combination_type === 'protocol' ? 'fa-clipboard-list' : 'fa-comments';
                  const typeColor = c.combination_type === 'stack' ? '#3b82f6' : c.combination_type === 'comparison' ? '#f59e0b' : c.combination_type === 'protocol' ? '#10b981' : '#8b5cf6';
                  return `
                    <div style="background:#f8fafc;border-radius:10px;padding:12px 14px;border:1px solid #e2e8f0">
                      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                          <span style="background:#eff6ff;color:#2563eb;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:700">${esc(c.peptide_a_name || c.peptide_a)}</span>
                          <i class="fas fa-plus" style="font-size:8px;color:var(--text-muted)"></i>
                          <span style="background:#f0fdf4;color:#059669;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:700">${esc(c.peptide_b_name || c.peptide_b)}</span>
                        </div>
                        <div style="display:flex;align-items:center;gap:6px">
                          <span style="background:${typeColor}15;color:${typeColor};padding:2px 8px;border-radius:12px;font-size:10px;font-weight:600"><i class="fas ${typeIcon}" style="margin-right:3px"></i>${esc(c.combination_type)}</span>
                          <strong style="font-size:13px;color:var(--text-primary)">${c.total_count}x</strong>
                        </div>
                      </div>
                      <div style="height:4px;background:#e2e8f0;border-radius:2px;overflow:hidden">
                        <div style="width:${pct}%;height:100%;background:${typeColor};border-radius:2px"></div>
                      </div>
                    </div>`;
                }).join('')}
              </div>
            ` : '<p class="adm-empty">No combination data yet. Stacks and comparisons populate automatically.</p>'}
          </div>

          <!-- Geographic Demand -->
          <div class="adm-card">
            <h3 class="adm-card-title"><i class="fas fa-earth-americas" style="color:#10b981"></i> Geographic Demand Heatmap</h3>
            <p style="font-size:12px;color:var(--text-secondary);margin:-4px 0 16px">Research interest by country with category breakdown and engagement metrics.</p>
            ${geo.length ? `
              <div style="display:flex;flex-direction:column;gap:8px;max-height:400px;overflow-y:auto">
                ${geo.map((g, i) => {
                  const maxVisits = geo[0]?.total_visits || 1;
                  const pct = Math.max(8, (g.total_visits / maxVisits) * 100);
                  const cats = (g.categories || '').split(',').filter(Boolean).slice(0, 3);
                  return `
                    <div style="background:#f8fafc;border-radius:10px;padding:12px 14px;border:1px solid #e2e8f0">
                      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                        <div style="display:flex;align-items:center;gap:8px">
                          <span style="font-size:18px">${countryFlag(g.country)}</span>
                          <strong style="font-size:13px">${esc(g.country || 'Unknown')}</strong>
                        </div>
                        <div style="display:flex;align-items:center;gap:12px">
                          ${g.calc_uses > 0 ? `<span style="font-size:11px;color:#7c3aed"><i class="fas fa-calculator" style="margin-right:3px"></i>${g.calc_uses} calc</span>` : ''}
                          <strong style="font-size:14px;color:var(--text-primary)">${g.total_visits} visits</strong>
                        </div>
                      </div>
                      <div style="height:6px;background:#e2e8f0;border-radius:3px;overflow:hidden;margin-bottom:6px">
                        <div style="width:${pct}%;height:100%;background:${colors[i % colors.length]};border-radius:3px"></div>
                      </div>
                      ${cats.length ? `<div style="display:flex;gap:4px;flex-wrap:wrap">${cats.map(cat => `<span style="font-size:10px;background:#f1f5f9;padding:2px 6px;border-radius:4px;color:var(--text-secondary)">${esc(cat.trim())}</span>`).join('')}</div>` : ''}
                    </div>`;
                }).join('')}
              </div>
            ` : '<p class="adm-empty">No geographic data yet. Country detection uses Cloudflare CF-IPCountry header.</p>'}
          </div>
        </div>

        <!-- ============================== -->
        <!-- 5. CONTENT ENGAGEMENT DEPTH    -->
        <!-- ============================== -->
        <div class="adm-card" style="margin-bottom:20px">
          <h3 class="adm-card-title"><i class="fas fa-chart-bar" style="color:#2563eb"></i> Content Engagement Depth</h3>
          <p style="font-size:12px;color:var(--text-secondary);margin:-4px 0 16px">Average time spent on different content types. Longer engagement indicates higher research intent and potential clinical interest.</p>
          ${depth.length ? `
            <div class="adm-table-wrap" style="max-height:400px;overflow-y:auto">
              <table class="adm-table adm-table-compact">
                <thead>
                  <tr>
                    <th>Content Type</th>
                    <th>Content</th>
                    <th>Views</th>
                    <th>Avg Time</th>
                    <th>Return Views</th>
                    <th>Engagement</th>
                  </tr>
                </thead>
                <tbody>
                  ${depth.map((d, i) => {
                    const maxTime = Math.max(...depth.map(x => x.avg_time || 0), 1);
                    const timePct = Math.max(4, ((d.avg_time || 0) / maxTime) * 100);
                    const typeIcons = { peptide_profile: 'fa-flask', protocol: 'fa-clipboard-list', research_article: 'fa-newspaper', community_post: 'fa-comments', video: 'fa-play', calculator: 'fa-calculator' };
                    const avgMin = Math.floor((d.avg_time || 0) / 60);
                    const avgSec = Math.round((d.avg_time || 0) % 60);
                    return `
                      <tr>
                        <td>
                          <span style="display:inline-flex;align-items:center;gap:6px">
                            <i class="fas ${typeIcons[d.content_type] || 'fa-file'}" style="color:${colors[i % colors.length]};font-size:12px"></i>
                            <span style="text-transform:capitalize;font-size:12px">${esc((d.content_type || '').replace(/_/g, ' '))}</span>
                          </span>
                        </td>
                        <td><strong style="font-size:12px">${esc(d.content_name || '-')}</strong></td>
                        <td style="font-variant-numeric:tabular-nums">${(d.total_views || 0).toLocaleString()}</td>
                        <td style="font-weight:600;color:#2563eb">${avgMin > 0 ? avgMin + 'm ' : ''}${avgSec}s</td>
                        <td style="font-variant-numeric:tabular-nums">${d.returns || 0}</td>
                        <td>
                          <div style="width:80px;height:6px;background:#f1f5f9;border-radius:3px;overflow:hidden">
                            <div style="width:${timePct}%;height:100%;background:${colors[i % colors.length]};border-radius:3px"></div>
                          </div>
                        </td>
                      </tr>`;
                  }).join('')}
                </tbody>
              </table>
            </div>
          ` : '<p class="adm-empty">No content depth data yet. Engagement tracking auto-populates as users browse content.</p>'}
        </div>

        <!-- ============================== -->
        <!-- 6. DATA PRODUCTS SUMMARY       -->
        <!-- ============================== -->
        <div class="adm-card" style="background:linear-gradient(135deg,#faf5ff,#f0f9ff);border:1px solid #c7d2fe">
          <h3 class="adm-card-title" style="color:#4338ca"><i class="fas fa-box-open" style="color:#6366f1"></i> Available Data Products</h3>
          <p style="font-size:12px;color:var(--text-secondary);margin:-4px 0 16px">Anonymized, HIPAA-safe data packages ready for enterprise licensing.</p>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px">
            ${[
              { title: 'Compound Demand Index', icon: 'fa-chart-trending-up', color: '#ef4444', desc: 'Real-time rankings of peptide research interest by purchase intent, dosing research, safety inquiries. Updated daily.', metrics: ['Top 20 compounds by demand', 'Intent signal breakdown', 'Week-over-week trends'] },
              { title: 'Therapeutic Goal Insights', icon: 'fa-bullseye', color: '#ec4899', desc: 'Which health outcomes are driving consumer research. Maps compound interest to therapeutic categories.', metrics: ['8 therapeutic categories tracked', 'Goal-compound correlations', 'Seasonal demand patterns'] },
              { title: 'Geographic Market Map', icon: 'fa-earth-americas', color: '#10b981', desc: 'Country-level demand data with category breakdowns. Identify high-potential markets for peptide therapeutics.', metrics: ['Per-country demand signals', 'Regional category preferences', 'Calculator engagement by region'] },
              { title: 'Research Funnel Analytics', icon: 'fa-filter', color: '#7c3aed', desc: 'Full user journey from casual browsing to deep research. Shows conversion rates between engagement stages.', metrics: ['9-stage research funnel', 'Stage conversion rates', 'Drop-off analysis'] },
              { title: 'Combination Intelligence', icon: 'fa-link', color: '#f59e0b', desc: 'Which compounds are being researched, stacked, and compared together. Identifies real-world protocol patterns.', metrics: ['Pair frequency analysis', 'Stack vs comparison patterns', 'Cross-category combinations'] },
              { title: 'Audience Segmentation', icon: 'fa-user-group', color: '#06b6d4', desc: 'Behavioral cohorts from beginner to researcher. Engagement depth, content preferences, and retention patterns.', metrics: ['4 experience-level cohorts', 'Per-segment engagement metrics', 'Avg session depth & duration'] },
            ].map(prod => `
              <div style="background:#fff;border-radius:12px;padding:16px;border:1px solid #e2e8f0;display:flex;flex-direction:column">
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
                  <span style="width:32px;height:32px;border-radius:8px;background:${prod.color}15;color:${prod.color};display:flex;align-items:center;justify-content:center;font-size:14px"><i class="fas ${prod.icon}"></i></span>
                  <strong style="font-size:13px;color:var(--text-primary)">${prod.title}</strong>
                </div>
                <p style="font-size:12px;color:var(--text-secondary);line-height:1.5;margin:0 0 12px;flex:1">${prod.desc}</p>
                <div style="display:flex;flex-direction:column;gap:4px">
                  ${prod.metrics.map(m => `<span style="font-size:11px;color:var(--text-muted);display:flex;align-items:center;gap:6px"><i class="fas fa-check" style="color:#10b981;font-size:9px"></i>${m}</span>`).join('')}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  function changeMarketPeriod(days) {
    marketPeriod = parseInt(days);
    loadTab('market');
  }

  function refreshMarket() {
    loadTab('market');
  }

  // ============================================
  // INFLUENCER CRM DASHBOARD
  // ============================================
  let affTab = 'overview';
  let affCustFilter = '';
  let affCustSearch = '';
  let affCustSort = 'upsell_score';
  let affCustTagFilter = '';
  let bulkSelected = new Set();

  async function renderInfluencerDashboard(container) {
    // Pick up any tab requested by the sidebar nav buttons
    if (window._adminStartTab) {
      const tabMap = { analytics: 'overview', crm: 'customers' };
      affTab = tabMap[window._adminStartTab] || window._adminStartTab;
      window._adminStartTab = null;
    }
    const crmTabs = [
      { id: 'overview',        icon: 'fa-chart-line',         label: 'Overview' },
      { id: 'customers',       icon: 'fa-users',              label: 'Customers' },
      { id: 'pipeline',        icon: 'fa-filter',             label: 'Pipeline' },
      { id: 'tasks',           icon: 'fa-list-check',         label: 'Tasks' },
      { id: 'earnings',        icon: 'fa-dollar-sign',        label: 'Earnings' },
      { id: 'segments',        icon: 'fa-bullseye',           label: 'Segments' },
      { id: 'recommendations', icon: 'fa-wand-magic-sparkles',label: 'Recs' },
      { id: 'messages',        icon: 'fa-envelope',           label: 'Messages' },
      { id: 'goals',           icon: 'fa-trophy',             label: 'Goals' },
      { id: 'insights',        icon: 'fa-lightbulb',          label: 'Insights' },
      { id: 'links',           icon: 'fa-link',               label: 'Links' },
    ];
    container.innerHTML = `
      <div>
        <!-- CRM section header (inside the main admin content area) -->
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;padding-bottom:16px;border-bottom:2px solid var(--border-color,#e5e7eb)">
          <div style="width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg,#f59e0b,#d97706);display:flex;align-items:center;justify-content:center;color:#fff;font-size:18px;flex-shrink:0">
            <i class="fas fa-handshake"></i>
          </div>
          <div>
            <h2 style="margin:0;font-size:17px;font-weight:800;color:var(--text-primary)">Partner CRM</h2>
            <p style="margin:0;font-size:12px;color:var(--text-muted)">Customer management, earnings & engagement</p>
          </div>
        </div>
        <!-- CRM sub-tab bar -->
        <div class="adm-sub-tabs" id="crmSubTabs">
          ${crmTabs.map(t => `
            <button class="adm-sub-tab ${t.id === affTab ? 'active' : ''}" onclick="window._admin.switchAffTab('${t.id}')">
              <i class="fas ${t.icon}"></i> ${t.label}
            </button>
          `).join('')}
        </div>
        <div id="affContent" style="margin-top:16px">
          <div style="text-align:center;padding:60px"><i class="fas fa-spinner fa-spin" style="font-size:24px;color:var(--text-muted)"></i></div>
        </div>
      </div>`;
    loadAffTab(affTab);

    // Load unread message badge
    try {
      const ubRes = await fetch('/api/partner/messages/unread-count', { headers: getAdminHeaders() });
      const ubData = await ubRes.json();
      if (ubData.unread > 0) {
        const msgTab = document.querySelector('.adm-tab[onclick*="messages"]');
        if (msgTab) {
          msgTab.innerHTML += ` <span style="background:#ef4444;color:#fff;padding:1px 6px;border-radius:10px;font-size:10px;font-weight:700;margin-left:2px">${ubData.unread}</span>`;
        }
      }
    } catch {}
  }

  function switchAffTab(tab) {
    affTab = tab;
    document.querySelectorAll('#crmSubTabs .adm-sub-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`#crmSubTabs .adm-sub-tab[onclick*="${tab}"]`)?.classList.add('active');
    loadAffTab(tab);
  }

  async function loadAffTab(tab) {
    const ct = document.getElementById('affContent');
    if (!ct) return;
    ct.innerHTML = '<div style="text-align:center;padding:60px"><i class="fas fa-spinner fa-spin" style="font-size:24px;color:var(--text-muted)"></i></div>';
    try {
      switch(tab) {
        case 'overview': await renderAffOverview(ct); break;
        case 'customers': await renderAffCustomers(ct); break;
        case 'pipeline': await renderAffPipeline(ct); break;
        case 'tasks': await renderAffTasks(ct); break;
        case 'earnings': await renderAffEarnings(ct); break;
        case 'segments': await renderAffSegments(ct); break;
        case 'recommendations': await renderAffRecommendations(ct); break;
        case 'messages': await renderAffMessages(ct); break;
        case 'goals': await renderAffGoals(ct); break;
        case 'insights': await renderAffInsights(ct); break;
        case 'links': await renderAffLinks(ct); break;
      }
    } catch(e) {
      ct.innerHTML = `<div style="padding:40px;text-align:center;color:#dc2626"><i class="fas fa-exclamation-triangle"></i> Error: ${esc(e.message)}</div>`;
    }
  }

  async function renderAffOverview(ct) {
    const [crmRes, statsRes] = await Promise.all([
      fetch('/api/partner/crm-overview', { headers: getAdminHeaders() }),
      fetch('/api/partner/my-stats', { headers: getAdminHeaders() })
    ]);
    const crm = await crmRes.json();
    const link = await statsRes.json();
    if (crm.error) { ct.innerHTML = `<div class="adm-error">${esc(crm.error)}</div>`; return; }
    const s = crm.stats || {};
    const codes = link.codes || [];
    const totalClicks = codes.reduce((a, c) => a + (c.total_clicks || 0), 0);
    const statusColors = { lead: '#94a3b8', engaged: '#3b82f6', active: '#10b981', power_user: '#f59e0b', churned: '#ef4444' };

    ct.innerHTML = `
      <div class="adm-stats-grid" style="grid-template-columns:repeat(auto-fit,minmax(140px,1fr));margin-bottom:20px">
        <div class="adm-stat-card"><div class="adm-stat-icon" style="background:#2563eb15;color:#2563eb"><i class="fas fa-users"></i></div><div class="adm-stat-num">${s.total_customers||0}</div><div class="adm-stat-label">Customers</div></div>
        <div class="adm-stat-card"><div class="adm-stat-icon" style="background:#10b98115;color:#10b981"><i class="fas fa-bolt"></i></div><div class="adm-stat-num">${s.active_count||0}</div><div class="adm-stat-label">Active</div></div>
        <div class="adm-stat-card"><div class="adm-stat-icon" style="background:#f59e0b15;color:#f59e0b"><i class="fas fa-crown"></i></div><div class="adm-stat-num">${s.power_users||0}</div><div class="adm-stat-label">Power Users</div></div>
        <div class="adm-stat-card"><div class="adm-stat-icon" style="background:#ef444415;color:#ef4444"><i class="fas fa-exclamation-triangle"></i></div><div class="adm-stat-num">${s.at_risk||0}</div><div class="adm-stat-label">At Risk</div></div>
        <div class="adm-stat-card"><div class="adm-stat-icon" style="background:#8b5cf615;color:#8b5cf6"><i class="fas fa-mouse-pointer"></i></div><div class="adm-stat-num">${totalClicks}</div><div class="adm-stat-label">Link Clicks</div></div>
        <div class="adm-stat-card"><div class="adm-stat-icon" style="background:#06b6d415;color:#06b6d4"><i class="fas fa-chart-line"></i></div><div class="adm-stat-num">${Math.round(s.avg_upsell_score||0)}</div><div class="adm-stat-label">Avg Upsell</div></div>
      </div>
      <div class="adm-card" style="margin-bottom:20px">
        <h3 class="adm-card-title"><i class="fas fa-filter" style="color:#7c3aed"></i> Customer Pipeline</h3>
        <div style="display:flex;gap:4px;height:50px;border-radius:10px;overflow:hidden">
          ${['lead','engaged','active','power_user','churned'].map(st => {
            const count = s[st === 'active' ? 'active_count' : st === 'power_user' ? 'power_users' : st + 's'] || s[st] || 0;
            const total = s.total_customers || 1;
            const pct = Math.max(2, (count / total) * 100);
            return `<div style="width:${pct}%;background:${statusColors[st]};display:flex;align-items:center;justify-content:center;flex-direction:column;cursor:pointer" onclick="window._admin.switchAffTab('customers')" title="${st.replace('_',' ')}: ${count}">
              <span style="color:#fff;font-size:14px;font-weight:800">${count}</span>
              <span style="color:rgba(255,255,255,0.8);font-size:9px;text-transform:capitalize">${st.replace('_',' ')}</span>
            </div>`;
          }).join('')}
        </div>
      </div>
      <div class="adm-two-col" style="margin-bottom:20px">
        <div class="adm-card">
          <h3 class="adm-card-title"><i class="fas fa-bell" style="color:#ef4444"></i> Needs Attention</h3>
          ${(crm.atRiskCustomers||[]).length ? `<div style="display:flex;flex-direction:column;gap:8px;max-height:300px;overflow-y:auto">
            ${(crm.atRiskCustomers||[]).map(c => `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:12px;cursor:pointer" onclick="window._admin.viewCustomer(${c.id})">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
                <strong style="font-size:13px">${esc(c.display_name||c.email||'Anonymous')}</strong>
                <span style="font-size:11px;color:#ef4444;font-weight:600">${c.days_since_last_active}d inactive</span>
              </div>
              <div style="font-size:11px;color:var(--text-secondary)">Last: <strong>${esc(c.last_peptide_viewed||'N/A')}</strong>${c.upsell_score>0?' | Upsell: <strong style="color:#f59e0b">'+c.upsell_score+'</strong>':''}</div>
            </div>`).join('')}
          </div>` : '<p class="adm-empty">No at-risk customers</p>'}
        </div>
        <div class="adm-card">
          <h3 class="adm-card-title"><i class="fas fa-flask-vial" style="color:#7c3aed"></i> Popular With Your Customers</h3>
          ${(crm.topPeptides||[]).length ? `<div style="display:flex;flex-direction:column;gap:6px;max-height:300px;overflow-y:auto">
            ${(crm.topPeptides||[]).map((p,i) => `<div style="display:flex;align-items:center;gap:10px;padding:8px;background:#f8fafc;border-radius:8px">
              <span style="width:22px;height:22px;border-radius:6px;background:${colors[i%colors.length]}15;color:${colors[i%colors.length]};display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800">${i+1}</span>
              <div style="flex:1;min-width:0"><strong style="font-size:12px">${esc(p.peptide_name)}</strong><br><span style="font-size:10px;color:var(--text-muted)">${esc(p.category)} | ${p.unique_customers} customers</span></div>
              <div style="display:flex;gap:8px;font-size:10px;color:var(--text-secondary)"><span><i class="fas fa-eye"></i> ${p.total_views||0}</span><span><i class="fas fa-calculator"></i> ${p.total_calc||0}</span></div>
            </div>`).join('')}
          </div>` : '<p class="adm-empty">No peptide data yet</p>'}
        </div>
      </div>
      <div class="adm-card">
        <h3 class="adm-card-title"><i class="fas fa-wand-magic-sparkles" style="color:#f59e0b"></i> Recent Recommendations</h3>
        ${(crm.recentRecommendations||[]).length ? `<div class="adm-table-wrap" style="max-height:300px;overflow-y:auto"><table class="adm-table adm-table-compact"><thead><tr><th>Customer</th><th>Peptide</th><th>Reason</th><th>Status</th><th>Sent</th></tr></thead><tbody>
          ${(crm.recentRecommendations||[]).map(r => {const sc={sent:'#94a3b8',viewed:'#3b82f6',clicked:'#f59e0b',converted:'#10b981',dismissed:'#ef4444'};return `<tr><td><strong style="font-size:12px">${esc(r.customer_name||'Anon')}</strong></td><td><span style="background:#eff6ff;color:#2563eb;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:600">${esc(r.peptide_name)}</span></td><td style="font-size:11px;max-width:200px;overflow:hidden;text-overflow:ellipsis">${esc(r.reason||'-')}</td><td><span style="background:${sc[r.status]||'#94a3b8'}15;color:${sc[r.status]||'#94a3b8'};padding:2px 8px;border-radius:12px;font-size:10px;font-weight:600;text-transform:capitalize">${r.status}</span></td><td style="font-size:11px">${timeAgo(r.sent_at)}</td></tr>`;}).join('')}
        </tbody></table></div>` : '<p class="adm-empty">No recommendations sent yet.</p>'}
      </div>`;
  }

  async function renderAffCustomers(ct) {
    const params = new URLSearchParams({sort:affCustSort,limit:'50'});
    if(affCustFilter) params.set('status',affCustFilter);
    if(affCustSearch) params.set('search',affCustSearch);
    const [custRes, tagRes] = await Promise.all([
      fetch(`/api/partner/customers?${params}`,{headers:getAdminHeaders()}),
      fetch('/api/partner/tags',{headers:getAdminHeaders()})
    ]);
    const data = await custRes.json();
    const tagData = await tagRes.json();
    if(data.error){ct.innerHTML=`<div class="adm-error">${esc(data.error)}</div>`;return;}
    let customers=data.customers||[];
    const allTags = tagData.tags||[];
    // Client-side tag filter
    if(affCustTagFilter){
      const tagCustIds = new Set();
      for(const c of customers){
        const custTags = await fetch(`/api/partner/customers/${c.id}`,{headers:getAdminHeaders()}).then(r=>r.json()).then(d=>(d.tags||[]).map(t=>t.tag));
      }
    }
    const sc={lead:'#94a3b8',engaged:'#3b82f6',active:'#10b981',power_user:'#f59e0b',churned:'#ef4444'};
    bulkSelected.clear();
    ct.innerHTML=`
      <div class="adm-toolbar" style="margin-bottom:16px;flex-wrap:wrap;gap:8px">
        <input class="adm-search" placeholder="Search customers..." value="${esc(affCustSearch)}" oninput="window._admin._affCustSearch=this.value" onkeydown="if(event.key==='Enter')window._admin.affSearchCustomers()" style="flex:1;min-width:200px">
        <select class="adm-filter" onchange="window._admin.affFilterStatus(this.value)">
          <option value="">All Statuses</option>
          <option value="lead" ${affCustFilter==='lead'?'selected':''}>Leads</option>
          <option value="engaged" ${affCustFilter==='engaged'?'selected':''}>Engaged</option>
          <option value="active" ${affCustFilter==='active'?'selected':''}>Active</option>
          <option value="power_user" ${affCustFilter==='power_user'?'selected':''}>Power Users</option>
          <option value="churned" ${affCustFilter==='churned'?'selected':''}>Churned</option>
        </select>
        <select class="adm-filter" onchange="window._admin.affSortCustomers(this.value)">
          <option value="upsell_score" ${affCustSort==='upsell_score'?'selected':''}>Upsell Score</option>
          <option value="last_active" ${affCustSort==='last_active'?'selected':''}>Last Active</option>
          <option value="sessions" ${affCustSort==='sessions'?'selected':''}>Most Sessions</option>
          <option value="signup" ${affCustSort==='signup'?'selected':''}>Newest</option>
        </select>
        <button class="adm-btn" style="background:#10b981;color:#fff;font-size:11px;padding:6px 14px;border-radius:8px" onclick="window._admin.exportCSV('customers')"><i class="fas fa-download" style="margin-right:4px"></i> CSV</button>
        <button class="adm-btn" id="bulkRecBtn" style="background:#7c3aed;color:#fff;font-size:11px;padding:6px 14px;border-radius:8px;display:none" onclick="window._admin.showBulkRecommend()"><i class="fas fa-wand-magic-sparkles" style="margin-right:4px"></i> Bulk Recommend (<span id="bulkCount">0</span>)</button>
      </div>
      <div class="adm-table-wrap"><table class="adm-table"><thead><tr><th style="width:30px"><input type="checkbox" onchange="window._admin.toggleBulkAll(this.checked,${JSON.stringify(customers.map(c=>c.id)).replace(/"/g,'&quot;')})"></th><th>Customer</th><th>Tags</th><th>Status</th><th>Sessions</th><th>Peptides</th><th>Calc</th><th>Upsell</th><th>Last Active</th><th>Actions</th></tr></thead><tbody>
        ${customers.length?customers.map(c=>{const uc=(c.upsell_score||0)>=70?'#10b981':(c.upsell_score||0)>=40?'#f59e0b':'#94a3b8';return `<tr style="cursor:pointer" onclick="window._admin.viewCustomer(${c.id})">
          <td onclick="event.stopPropagation()"><input type="checkbox" class="bulk-check" data-id="${c.id}" onchange="window._admin.toggleBulk(${c.id},this.checked)"></td>
          <td><div><strong style="font-size:13px">${esc(c.display_name||c.email||'Anonymous')}</strong></div><div style="font-size:10px;color:var(--text-muted)">${esc(c.partner_code)}${c.country?' | '+countryFlag(c.country):''}</div></td>
          <td><div id="tags-${c.id}" style="display:flex;gap:3px;flex-wrap:wrap;max-width:150px"></div></td>
          <td><span style="background:${sc[c.status]||'#94a3b8'}15;color:${sc[c.status]||'#94a3b8'};padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600;text-transform:capitalize;white-space:nowrap">${(c.status||'lead').replace('_',' ')}</span></td>
          <td>${c.total_sessions||0}</td><td>${c.peptides_viewed||0}</td><td>${c.calculator_uses||0}</td>
          <td><div style="display:flex;align-items:center;gap:6px"><div style="width:40px;height:6px;background:#f1f5f9;border-radius:3px;overflow:hidden"><div style="width:${Math.min(100,c.upsell_score||0)}%;height:100%;background:${uc};border-radius:3px"></div></div><strong style="color:${uc};font-size:12px">${c.upsell_score||0}</strong></div></td>
          <td style="font-size:11px;white-space:nowrap">${c.is_at_risk?'<i class="fas fa-exclamation-circle" style="color:#ef4444;margin-right:3px"></i>':''}${timeAgo(c.last_active)}</td>
          <td onclick="event.stopPropagation()"><button class="adm-action-btn" onclick="window._admin.viewCustomer(${c.id})" title="View"><i class="fas fa-eye"></i></button><button class="adm-action-btn" onclick="window._admin.messageCustomer(${c.id},'${esc(c.display_name||c.email||'')}')" title="Message"><i class="fas fa-envelope"></i></button><button class="adm-action-btn" onclick="window._admin.showRecModal(${c.id},'${esc(c.display_name||c.email||'')}')" title="Recommend"><i class="fas fa-wand-magic-sparkles"></i></button></td>
        </tr>`;}).join(''):'<tr><td colspan="10" class="adm-empty">No customers yet.</td></tr>'}
      </tbody></table></div><div id="affCustomerModal"></div>`;
    // Load tags for each customer async
    customers.forEach(async c => {
      try{const r=await fetch(`/api/partner/customers/${c.id}`,{headers:getAdminHeaders()});const d=await r.json();const el=document.getElementById('tags-'+c.id);if(el&&d.tags){el.innerHTML=d.tags.slice(0,3).map(t=>`<span style="background:${t.color}20;color:${t.color};padding:1px 6px;border-radius:4px;font-size:9px;font-weight:600;white-space:nowrap">${esc(t.tag)}</span>`).join('');}}catch{}
    });
  }

  function affFilterStatus(v){affCustFilter=v;loadAffTab('customers');}
  function affSortCustomers(v){affCustSort=v;loadAffTab('customers');}
  function affSearchCustomers(){affCustSearch=window._admin._affCustSearch||'';loadAffTab('customers');}
  function toggleBulk(id,checked){if(checked)bulkSelected.add(id);else bulkSelected.delete(id);const btn=document.getElementById('bulkRecBtn'),cnt=document.getElementById('bulkCount');if(btn)btn.style.display=bulkSelected.size>0?'inline-flex':'none';if(cnt)cnt.textContent=bulkSelected.size;}
  function toggleBulkAll(checked,ids){ids.forEach(id=>{toggleBulk(id,checked)});document.querySelectorAll('.bulk-check').forEach(cb=>cb.checked=checked);}

  function exportCSV(type){
    const url=type==='earnings'?'/api/partner/export/earnings':'/api/partner/export/customers';
    const a=document.createElement('a');a.href=url;a.download=type+'.csv';
    // We need to add headers, so use fetch
    fetch(url,{headers:getAdminHeaders()}).then(r=>r.blob()).then(b=>{const u=URL.createObjectURL(b);a.href=u;a.click();URL.revokeObjectURL(u);showToast(type+' exported');});
  }

  // ============================================
  // CUSTOMER DETAIL MODAL (upgraded with timeline, tags, edit/delete notes)
  // ============================================
  async function viewCustomer(custId) {
    const modal=document.getElementById('affCustomerModal')||document.createElement('div');
    modal.id='affCustomerModal';if(!modal.parentElement)document.body.appendChild(modal);
    modal.innerHTML=`<div style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px" onclick="if(event.target===this)this.parentElement.innerHTML=''"><div style="background:var(--bg-primary,#fff);border-radius:16px;width:100%;max-width:900px;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.3);padding:24px;text-align:center"><i class="fas fa-spinner fa-spin" style="font-size:20px;color:var(--text-muted)"></i></div></div>`;
    const res=await fetch(`/api/partner/customers/${custId}`,{headers:getAdminHeaders()});
    const data=await res.json();
    if(data.error){modal.innerHTML='';showToast('Error: '+data.error);return;}
    const c=data.customer,interests=data.interests||[],notes=data.notes||[],recs=data.recommendations||[],suggestions=data.upsellSuggestions||[],tags=data.tags||[],activity=data.recentActivity||[];
    const sc={lead:'#94a3b8',engaged:'#3b82f6',active:'#10b981',power_user:'#f59e0b',churned:'#ef4444'};
    const actIcons={visit:'fa-globe',pageview:'fa-file',peptide_view:'fa-flask',search:'fa-search',calculator_use:'fa-calculator',protocol_view:'fa-clipboard-list',stack_build:'fa-layer-group',stack_add:'fa-plus',favorite:'fa-heart',compare:'fa-arrows-left-right',signup:'fa-user-plus',return_visit:'fa-rotate',deep_research:'fa-book',video_watch:'fa-video'};
    const actColors={visit:'#6b7280',peptide_view:'#7c3aed',search:'#2563eb',calculator_use:'#f59e0b',protocol_view:'#06b6d4',stack_build:'#10b981',stack_add:'#10b981',favorite:'#ef4444',compare:'#8b5cf6',deep_research:'#1e40af',video_watch:'#ec4899'};
    modal.innerHTML=`<div style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px" onclick="if(event.target===this)this.parentElement.innerHTML=''">
      <div style="background:var(--bg-primary,#fff);border-radius:16px;width:100%;max-width:900px;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.3);padding:0">
        <div style="padding:20px 24px;border-bottom:1px solid var(--border-color,#e5e7eb);display:flex;justify-content:space-between;align-items:center">
          <div><h3 style="margin:0;font-size:18px;font-weight:700">${esc(c.display_name||c.email||'Anonymous')}</h3>
          <div style="display:flex;gap:8px;align-items:center;margin-top:4px;flex-wrap:wrap"><span style="background:${sc[c.status]}15;color:${sc[c.status]};padding:2px 10px;border-radius:12px;font-size:11px;font-weight:600;text-transform:capitalize">${(c.status||'lead').replace('_',' ')}</span>${c.country?`<span style="font-size:12px">${countryFlag(c.country)} ${esc(c.country)}</span>`:''}<span style="font-size:11px;color:var(--text-muted)">via <span style="font-weight:600">${esc(c.partner_code)}</span></span>
          ${tags.map(t=>`<span style="background:${t.color}20;color:${t.color};padding:2px 8px;border-radius:6px;font-size:10px;font-weight:600;cursor:pointer" onclick="event.stopPropagation();window._admin.removeTag(${custId},'${esc(t.tag)}');return false;" title="Click to remove">${esc(t.tag)} <i class="fas fa-xmark" style="font-size:8px;opacity:0.7"></i></span>`).join('')}
          <button style="background:none;border:1px dashed var(--border-color,#ccc);border-radius:6px;padding:2px 8px;font-size:10px;color:var(--text-muted);cursor:pointer" onclick="event.stopPropagation();window._admin.addTag(${custId})"><i class="fas fa-plus" style="margin-right:2px"></i>Tag</button>
          </div></div>
          <div style="display:flex;gap:8px;align-items:center">
            <button onclick="event.stopPropagation();window._admin.messageCustomer(${custId},'${esc(c.display_name||c.email||'Customer')}')" style="background:linear-gradient(135deg,#3b82f6,#2563eb);color:#fff;border:none;border-radius:8px;padding:6px 14px;cursor:pointer;font-size:12px;font-weight:600;white-space:nowrap"><i class="fas fa-envelope" style="margin-right:4px"></i>Message</button>
            <button onclick="this.closest('#affCustomerModal').innerHTML=''" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text-muted);padding:4px 8px"><i class="fas fa-xmark"></i></button>
          </div>
        </div>
        <div style="padding:20px 24px">
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(90px,1fr));gap:8px;margin-bottom:20px">
            ${[{v:c.total_sessions||0,l:'Sessions'},{v:c.peptides_viewed||0,l:'Peptides'},{v:c.calculator_uses||0,l:'Calc Uses'},{v:c.stacks_built||0,l:'Stacks'},{v:c.protocols_viewed||0,l:'Protocols'},{v:(c.upsell_score||0),l:'Upsell',color:'#f59e0b'},{v:(c.lifetime_days||0)+'d',l:'Lifetime'}].map(s=>`<div style="text-align:center;padding:8px;background:#f8fafc;border-radius:10px"><div style="font-size:18px;font-weight:800${s.color?';color:'+s.color:''}">${s.v}</div><div style="font-size:9px;color:var(--text-muted)">${s.l}</div></div>`).join('')}
          </div>

          ${activity.length?`<h4 style="font-size:14px;font-weight:700;margin:0 0 10px;display:flex;align-items:center;gap:6px"><i class="fas fa-clock-rotate-left" style="color:#2563eb"></i> Recent Activity</h4>
          <div style="display:flex;flex-direction:column;gap:0;margin-bottom:20px;max-height:220px;overflow-y:auto;border:1px solid var(--border-color,#e5e7eb);border-radius:10px;padding:8px">
            ${activity.map((a,i)=>{const ic=actIcons[a.activity_type]||'fa-circle';const col=actColors[a.activity_type]||'#6b7280';return `<div style="display:flex;gap:10px;padding:6px 8px;${i<activity.length-1?'border-bottom:1px solid #f1f5f9;':''}">
              <div style="width:26px;height:26px;border-radius:50%;background:${col}15;display:flex;align-items:center;justify-content:center;flex-shrink:0"><i class="fas ${ic}" style="font-size:10px;color:${col}"></i></div>
              <div style="flex:1;min-width:0"><div style="font-size:12px"><strong>${a.activity_type.replace(/_/g,' ')}</strong>${a.peptide_name?` <span style="background:#eff6ff;color:#2563eb;padding:1px 6px;border-radius:4px;font-size:10px;font-weight:600">${esc(a.peptide_name)}</span>`:''}</div>
              ${a.detail?`<div style="font-size:10px;color:var(--text-secondary);margin-top:2px">${esc(a.detail)}</div>`:''}
              </div><div style="font-size:10px;color:var(--text-muted);white-space:nowrap;flex-shrink:0">${timeAgo(a.created_at)}${a.duration_sec?` <span style="color:var(--text-secondary)">(${a.duration_sec>=60?Math.round(a.duration_sec/60)+'m':a.duration_sec+'s'})</span>`:''}</div>
            </div>`;}).join('')}
          </div>`:``}

          <h4 style="font-size:14px;font-weight:700;margin:0 0 10px;display:flex;align-items:center;gap:6px"><i class="fas fa-flask-vial" style="color:#7c3aed"></i> Peptide Interests</h4>
          ${interests.length?`<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:20px">${interests.map(p=>`<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0"><div style="flex:1;min-width:0"><strong style="font-size:12px">${esc(p.peptide_name)}</strong><span style="font-size:10px;color:var(--text-muted);margin-left:6px">${esc(p.category)}</span></div><div style="display:flex;gap:10px;font-size:10px;color:var(--text-secondary);flex-shrink:0"><span title="Views"><i class="fas fa-eye"></i> ${p.views}</span><span title="Calc uses"><i class="fas fa-calculator"></i> ${p.calculator_uses}</span><span title="Time spent">${p.time_spent_sec>=60?Math.round(p.time_spent_sec/60)+'m':p.time_spent_sec+'s'}</span>${p.added_to_stack?'<span style="color:#10b981" title="In stack"><i class="fas fa-layer-group"></i></span>':''}${p.favorited?'<span style="color:#ef4444" title="Favorited"><i class="fas fa-heart"></i></span>':''}${p.viewed_protocol?'<span style="color:#06b6d4" title="Viewed protocol"><i class="fas fa-clipboard-list"></i></span>':''}</div><button class="adm-action-btn" style="flex-shrink:0" onclick="window._admin.showRecModal(${custId},'${esc(c.display_name||'')}','${esc(p.peptide_id)}','${esc(p.peptide_name)}','${esc(p.category)}')" title="Recommend related"><i class="fas fa-wand-magic-sparkles"></i></button></div>`).join('')}</div>`:'<p class="adm-empty" style="margin-bottom:20px">No interests yet</p>'}

          ${suggestions.length?`<h4 style="font-size:14px;font-weight:700;margin:0 0 10px;display:flex;align-items:center;gap:6px"><i class="fas fa-wand-magic-sparkles" style="color:#f59e0b"></i> Upsell Suggestions</h4><p style="font-size:11px;color:var(--text-secondary);margin:-4px 0 10px">They haven't explored these yet:</p><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px;margin-bottom:20px">${suggestions.map(s=>`<div style="background:linear-gradient(135deg,#fffbeb,#fef3c7);border:1px solid #fde68a;border-radius:10px;padding:12px"><div style="display:flex;justify-content:space-between;align-items:center"><strong style="font-size:12px">${esc(s.name)}</strong><span style="font-size:10px;background:#f59e0b15;color:#d97706;padding:2px 6px;border-radius:6px">${esc(s.category)}</span></div><p style="font-size:11px;color:var(--text-secondary);margin:6px 0;line-height:1.4">${esc(s.description)}</p><button class="adm-btn adm-btn-primary" style="font-size:11px;padding:4px 10px" onclick="window._admin.showRecModal(${custId},'${esc(c.display_name||'')}','${esc(s.id)}','${esc(s.name)}','${esc(s.category)}')"><i class="fas fa-paper-plane" style="margin-right:4px"></i> Recommend</button></div>`).join('')}</div>`:``}

          <h4 style="font-size:14px;font-weight:700;margin:0 0 10px;display:flex;align-items:center;gap:6px"><i class="fas fa-sticky-note" style="color:#06b6d4"></i> Notes</h4>
          <div style="display:flex;gap:8px;margin-bottom:12px">
            <input id="affNoteInput" placeholder="Add a note..." style="flex:1;padding:8px 12px;border:1px solid var(--border-color,#e5e7eb);border-radius:8px;font-size:12px;background:var(--bg-secondary,#f9fafb);color:var(--text-primary,#1f2937)">
            <select id="affNoteType" style="padding:6px 10px;border:1px solid var(--border-color,#e5e7eb);border-radius:8px;font-size:11px;background:var(--bg-secondary,#f9fafb);color:var(--text-primary,#1f2937)"><option value="general">General</option><option value="follow_up">Follow Up</option><option value="upsell">Upsell</option><option value="concern">Concern</option><option value="milestone">Milestone</option></select>
            <button class="adm-btn adm-btn-primary" onclick="window._admin.addNote(${custId})"><i class="fas fa-plus"></i></button>
          </div>
          ${notes.length?`<div style="display:flex;flex-direction:column;gap:6px;max-height:200px;overflow-y:auto;margin-bottom:16px">${notes.map(n=>{const tc={general:'#6b7280',follow_up:'#3b82f6',upsell:'#f59e0b',concern:'#ef4444',milestone:'#10b981'};return `<div style="padding:8px 12px;background:#f8fafc;border-radius:8px;border-left:3px solid ${tc[n.note_type]||'#6b7280'}"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><span style="font-size:10px;font-weight:600;text-transform:capitalize;color:${tc[n.note_type]||'#6b7280'}">${(n.note_type||'general').replace('_',' ')}${n.is_pinned?' <i class="fas fa-thumbtack" style="color:#f59e0b"></i>':''}</span><div style="display:flex;align-items:center;gap:6px"><span style="font-size:10px;color:var(--text-muted)">${timeAgo(n.created_at)}</span><button style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:10px;padding:2px" onclick="event.stopPropagation();window._admin.deleteNote(${n.id},${custId})" title="Delete"><i class="fas fa-trash"></i></button></div></div><div style="font-size:12px;color:var(--text-primary)">${esc(n.note)}</div></div>`;}).join('')}</div>`:'<p class="adm-empty" style="margin-bottom:16px">No notes yet</p>'}
          <div style="display:flex;align-items:center;gap:8px;padding-top:16px;border-top:1px solid var(--border-color,#e5e7eb)">
            <span style="font-size:12px;font-weight:600;color:var(--text-secondary)">Status:</span>
            ${['lead','engaged','active','power_user','churned'].map(st=>`<button style="padding:4px 12px;border-radius:8px;border:1px solid ${c.status===st?sc[st]:'#e5e7eb'};background:${c.status===st?sc[st]+'15':'transparent'};color:${c.status===st?sc[st]:'var(--text-muted)'};font-size:11px;font-weight:600;cursor:pointer;text-transform:capitalize" onclick="window._admin.updateCustStatus(${custId},'${st}')">${st.replace('_',' ')}</button>`).join('')}
          </div>
        </div>
      </div>
    </div>`;
  }

  // Note/Tag/Status actions
  async function addNote(custId){const i=document.getElementById('affNoteInput'),t=document.getElementById('affNoteType');if(!i||!i.value.trim())return;await fetch(`/api/partner/customers/${custId}/notes`,{method:'POST',headers:getAdminHeaders(),body:JSON.stringify({note:i.value.trim(),note_type:t?.value||'general'})});showToast('Note added');viewCustomer(custId);}
  async function deleteNote(noteId,custId){if(!confirm('Delete this note?'))return;await fetch(`/api/partner/notes/${noteId}`,{method:'DELETE',headers:getAdminHeaders()});showToast('Note deleted');viewCustomer(custId);}
  async function addTag(custId){const tag=prompt('Enter tag name:');if(!tag)return;const tagColors=['#10b981','#2563eb','#7c3aed','#f59e0b','#ef4444','#ec4899','#06b6d4','#8b5cf6','#f97316','#6366f1'];const color=tagColors[Math.floor(Math.random()*tagColors.length)];await fetch(`/api/partner/customers/${custId}/tags`,{method:'POST',headers:getAdminHeaders(),body:JSON.stringify({tag:tag.trim(),color})});showToast('Tag added');viewCustomer(custId);}
  async function removeTag(custId,tag){await fetch(`/api/partner/customers/${custId}/tags/${encodeURIComponent(tag)}`,{method:'DELETE',headers:getAdminHeaders()});showToast('Tag removed');viewCustomer(custId);}
  async function updateCustStatus(custId,status){await fetch(`/api/partner/customers/${custId}/status`,{method:'PUT',headers:getAdminHeaders(),body:JSON.stringify({status})});showToast('Updated');viewCustomer(custId);}

  // ============================================
  // RECOMMENDATION MODAL (with templates)
  // ============================================
  async function showRecModal(custId, custName, pepId, pepName, category) {
    const tplRes = await fetch('/api/partner/templates',{headers:getAdminHeaders()});
    const tplData = await tplRes.json();
    const templates = tplData.templates||[];
    const modal=document.getElementById('affCustomerModal')||document.createElement('div');
    modal.id='affCustomerModal';if(!modal.parentElement)document.body.appendChild(modal);
    modal.innerHTML=`<div style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px" onclick="if(event.target===this)this.parentElement.innerHTML=''">
      <div style="background:var(--bg-primary,#fff);border-radius:16px;width:100%;max-width:500px;box-shadow:0 20px 60px rgba(0,0,0,0.3);padding:24px">
        <h3 style="margin:0 0 16px;font-size:16px;font-weight:700"><i class="fas fa-wand-magic-sparkles" style="color:#f59e0b;margin-right:8px"></i>Recommend to ${esc(custName||'Customer')}</h3>
        <div style="margin-bottom:12px"><label style="font-size:11px;font-weight:600;color:var(--text-secondary);margin-bottom:4px;display:block">Peptide</label><input id="recPepName" value="${esc(pepName||'')}" placeholder="Peptide name" style="width:100%;padding:8px 12px;border:1px solid var(--border-color,#e5e7eb);border-radius:8px;font-size:13px;background:var(--bg-secondary,#f9fafb);color:var(--text-primary,#1f2937);box-sizing:border-box"></div>
        <div style="margin-bottom:12px"><label style="font-size:11px;font-weight:600;color:var(--text-secondary);margin-bottom:4px;display:block">Category</label><input id="recCategory" value="${esc(category||'')}" placeholder="Category" style="width:100%;padding:8px 12px;border:1px solid var(--border-color,#e5e7eb);border-radius:8px;font-size:13px;background:var(--bg-secondary,#f9fafb);color:var(--text-primary,#1f2937);box-sizing:border-box"></div>
        ${templates.length?`<div style="margin-bottom:8px"><label style="font-size:11px;font-weight:600;color:var(--text-secondary);margin-bottom:4px;display:block">Use Template</label><select id="recTemplate" onchange="document.getElementById('recReason').value=this.value;if(this.options[this.selectedIndex].dataset.pep){document.getElementById('recPepName').value=this.options[this.selectedIndex].dataset.pep;document.getElementById('recCategory').value=this.options[this.selectedIndex].dataset.cat;}" style="width:100%;padding:8px 12px;border:1px solid var(--border-color,#e5e7eb);border-radius:8px;font-size:13px;background:var(--bg-secondary,#f9fafb);color:var(--text-primary,#1f2937);box-sizing:border-box"><option value="">-- Select template --</option>${templates.map(t=>`<option value="${esc(t.reason_template)}" data-pep="${esc(t.peptide_name)}" data-cat="${esc(t.category)}">${esc(t.name)}</option>`).join('')}</select></div>`:``}
        <div style="margin-bottom:16px"><label style="font-size:11px;font-weight:600;color:var(--text-secondary);margin-bottom:4px;display:block">Reason / Message</label><textarea id="recReason" rows="3" placeholder="Why should they try this peptide?" style="width:100%;padding:8px 12px;border:1px solid var(--border-color,#e5e7eb);border-radius:8px;font-size:13px;resize:vertical;background:var(--bg-secondary,#f9fafb);color:var(--text-primary,#1f2937);box-sizing:border-box"></textarea></div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button class="adm-btn" style="background:#f1f5f9;color:var(--text-primary)" onclick="document.getElementById('affCustomerModal').innerHTML=''">Cancel</button>
          <button class="adm-btn adm-btn-primary" onclick="window._admin.submitRec(${custId},'${esc(pepId||'')}')"><i class="fas fa-paper-plane" style="margin-right:4px"></i> Send</button>
        </div>
      </div>
    </div>`;
  }

  async function submitRec(custId, defaultPepId){
    const pepName=document.getElementById('recPepName')?.value||'';
    const category=document.getElementById('recCategory')?.value||'';
    const reason=document.getElementById('recReason')?.value||'';
    const pepId=defaultPepId||pepName.toLowerCase().replace(/\s+/g,'-');
    if(!pepName){showToast('Please enter a peptide name');return;}
    await fetch(`/api/partner/customers/${custId}/recommend`,{method:'POST',headers:getAdminHeaders(),body:JSON.stringify({peptide_id:pepId,peptide_name:pepName,category,reason})});
    document.getElementById('affCustomerModal').innerHTML='';
    showToast('Recommendation sent to customer');
  }

  // ============================================
  // BULK RECOMMEND MODAL
  // ============================================
  async function showBulkRecommend(){
    const ids=[...bulkSelected];
    if(!ids.length){showToast('Select customers first');return;}
    const tplRes = await fetch('/api/partner/templates',{headers:getAdminHeaders()});
    const tplData = await tplRes.json();
    const templates = tplData.templates||[];
    const modal=document.getElementById('affCustomerModal')||document.createElement('div');
    modal.id='affCustomerModal';if(!modal.parentElement)document.body.appendChild(modal);
    modal.innerHTML=`<div style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px" onclick="if(event.target===this)this.parentElement.innerHTML=''">
      <div style="background:var(--bg-primary,#fff);border-radius:16px;width:100%;max-width:500px;box-shadow:0 20px 60px rgba(0,0,0,0.3);padding:24px">
        <h3 style="margin:0 0 4px;font-size:16px;font-weight:700"><i class="fas fa-users" style="color:#7c3aed;margin-right:8px"></i>Bulk Recommend</h3>
        <p style="font-size:12px;color:var(--text-secondary);margin:0 0 16px">Sending to <strong>${ids.length} customers</strong></p>
        <div style="margin-bottom:12px"><input id="bulkPepName" placeholder="Peptide name" style="width:100%;padding:8px 12px;border:1px solid var(--border-color,#e5e7eb);border-radius:8px;font-size:13px;background:var(--bg-secondary,#f9fafb);color:var(--text-primary,#1f2937);box-sizing:border-box"></div>
        <div style="margin-bottom:12px"><input id="bulkCategory" placeholder="Category" style="width:100%;padding:8px 12px;border:1px solid var(--border-color,#e5e7eb);border-radius:8px;font-size:13px;background:var(--bg-secondary,#f9fafb);color:var(--text-primary,#1f2937);box-sizing:border-box"></div>
        ${templates.length?`<div style="margin-bottom:8px"><select id="bulkTemplate" onchange="document.getElementById('bulkReason').value=this.value;if(this.options[this.selectedIndex].dataset.pep){document.getElementById('bulkPepName').value=this.options[this.selectedIndex].dataset.pep;document.getElementById('bulkCategory').value=this.options[this.selectedIndex].dataset.cat;}" style="width:100%;padding:8px 12px;border:1px solid var(--border-color,#e5e7eb);border-radius:8px;font-size:13px;background:var(--bg-secondary,#f9fafb);color:var(--text-primary,#1f2937);box-sizing:border-box"><option value="">-- Use template --</option>${templates.map(t=>`<option value="${esc(t.reason_template)}" data-pep="${esc(t.peptide_name)}" data-cat="${esc(t.category)}">${esc(t.name)}</option>`).join('')}</select></div>`:``}
        <div style="margin-bottom:16px"><textarea id="bulkReason" rows="3" placeholder="Why recommend this?" style="width:100%;padding:8px 12px;border:1px solid var(--border-color,#e5e7eb);border-radius:8px;font-size:13px;resize:vertical;background:var(--bg-secondary,#f9fafb);color:var(--text-primary,#1f2937);box-sizing:border-box"></textarea></div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button class="adm-btn" style="background:#f1f5f9;color:var(--text-primary)" onclick="document.getElementById('affCustomerModal').innerHTML=''">Cancel</button>
          <button class="adm-btn" style="background:#7c3aed;color:#fff" onclick="window._admin.submitBulkRec()"><i class="fas fa-paper-plane" style="margin-right:4px"></i> Send to ${ids.length}</button>
        </div>
      </div>
    </div>`;
  }

  async function submitBulkRec(){
    const pepName=document.getElementById('bulkPepName')?.value||'';
    const category=document.getElementById('bulkCategory')?.value||'';
    const reason=document.getElementById('bulkReason')?.value||'';
    if(!pepName){showToast('Enter a peptide name');return;}
    const ids=[...bulkSelected];
    const res=await fetch('/api/partner/bulk-recommend',{method:'POST',headers:getAdminHeaders(),body:JSON.stringify({customer_ids:ids,peptide_id:pepName.toLowerCase().replace(/\s+/g,'-'),peptide_name:pepName,category,reason})});
    const data=await res.json();
    document.getElementById('affCustomerModal').innerHTML='';
    showToast(`Sent to ${data.sent||0} customers`);
    bulkSelected.clear();
    loadAffTab('customers');
  }

  // ============================================
  // EARNINGS TAB
  // ============================================
  async function renderAffEarnings(ct) {
    const res=await fetch('/api/partner/earnings',{headers:getAdminHeaders()});
    const data=await res.json();
    if(data.error){ct.innerHTML=`<div class="adm-error">${esc(data.error)}</div>`;return;}
    const s=data.summary||{};
    const monthly=data.monthly||[];
    const recent=data.recent||[];
    const byCode=data.byCode||[];
    const statusColors={pending:'#f59e0b',approved:'#3b82f6',paid:'#10b981',rejected:'#ef4444'};
    const typeIcons={click_bonus:'fa-mouse-pointer',signup_bonus:'fa-user-plus',conversion:'fa-check-double',recurring:'fa-rotate',bonus:'fa-gift',adjustment:'fa-sliders'};

    ct.innerHTML=`
      <div class="adm-stats-grid" style="grid-template-columns:repeat(auto-fit,minmax(140px,1fr));margin-bottom:20px">
        <div class="adm-stat-card"><div class="adm-stat-icon" style="background:#10b98115;color:#10b981"><i class="fas fa-dollar-sign"></i></div><div class="adm-stat-num">$${(s.total_earned||0).toFixed(2)}</div><div class="adm-stat-label">Total Earned</div></div>
        <div class="adm-stat-card"><div class="adm-stat-icon" style="background:#2563eb15;color:#2563eb"><i class="fas fa-wallet"></i></div><div class="adm-stat-num">$${(s.total_paid||0).toFixed(2)}</div><div class="adm-stat-label">Paid Out</div></div>
        <div class="adm-stat-card"><div class="adm-stat-icon" style="background:#f59e0b15;color:#f59e0b"><i class="fas fa-clock"></i></div><div class="adm-stat-num">$${((s.total_pending||0)+(s.total_approved||0)).toFixed(2)}</div><div class="adm-stat-label">Pending</div></div>
        <div class="adm-stat-card"><div class="adm-stat-icon" style="background:#7c3aed15;color:#7c3aed"><i class="fas fa-chart-line"></i></div><div class="adm-stat-num">$${(s.last_30_days||0).toFixed(2)}</div><div class="adm-stat-label">Last 30 Days</div></div>
        <div class="adm-stat-card"><div class="adm-stat-icon" style="background:#06b6d415;color:#06b6d4"><i class="fas fa-rotate"></i></div><div class="adm-stat-num">$${(s.recurring_revenue||0).toFixed(2)}</div><div class="adm-stat-label">Recurring</div></div>
        <div class="adm-stat-card"><div class="adm-stat-icon" style="background:#ec489915;color:#ec4899"><i class="fas fa-check-double"></i></div><div class="adm-stat-num">${s.total_conversions||0}</div><div class="adm-stat-label">Conversions</div></div>
      </div>
      <div class="adm-two-col" style="margin-bottom:20px">
        <div class="adm-card">
          <h3 class="adm-card-title"><i class="fas fa-chart-bar" style="color:#10b981"></i> Monthly Earnings</h3>
          ${monthly.length?(() => {
            const earnChartId = 'admEarningsChart_' + Date.now();
            setTimeout(() => {
              if (typeof Chart === 'undefined') return;
              const uniqueMonths = [...new Set(monthly.map(m => m.month))];
              const monthTotals = uniqueMonths.map(month => monthly.filter(m => m.month === month).reduce((a, m) => a + (m.total_earned || 0), 0));
              createChart(earnChartId, {
                type: 'bar',
                data: {
                  labels: uniqueMonths,
                  datasets: [{
                    label: 'Earned',
                    data: monthTotals,
                    backgroundColor: monthTotals.map((_, i) => {
                      const gradient = ['rgba(16,185,129,0.85)', 'rgba(6,182,212,0.85)', 'rgba(37,99,235,0.85)', 'rgba(124,58,237,0.85)'];
                      return gradient[i % gradient.length];
                    }),
                    borderRadius: 8,
                    borderSkipped: false,
                    maxBarThickness: 48
                  }]
                },
                options: {
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    tooltip: {
                      backgroundColor: 'rgba(15,23,42,0.92)',
                      padding: 10,
                      cornerRadius: 8,
                      callbacks: { label: function(ctx) { return '$' + ctx.raw.toFixed(2); } }
                    }
                  },
                  scales: {
                    x: { grid: { display: false }, ticks: { font: { size: 10 } } },
                    y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { callback: function(v) { return '$' + v; } } }
                  }
                }
              });
            }, 50);
            return `<div style="position:relative;height:200px;width:100%;margin-bottom:12px"><canvas id="${earnChartId}"></canvas></div>
            <div style="display:flex;flex-direction:column;gap:6px">${monthly.map(m => `<div style="display:flex;justify-content:space-between;font-size:12px;padding:6px 8px;background:#f8fafc;border-radius:6px"><span><strong>${esc(m.month)}</strong> (${esc(m.code)})</span><span style="display:flex;gap:12px"><span style="color:var(--text-muted)">${m.clicks||0} clicks</span><span style="color:var(--text-muted)">${m.signups||0} signups</span><strong style="color:#10b981">$${(m.total_earned||0).toFixed(2)}</strong></span></div>`).join('')}</div>`;
          })():'<p class="adm-empty">No earnings yet</p>'}
        </div>
        <div class="adm-card">
          <h3 class="adm-card-title"><i class="fas fa-link" style="color:#2563eb"></i> Earnings by Code</h3>
          ${byCode.length?`<div style="display:flex;flex-direction:column;gap:10px">${byCode.map(c=>`<div style="background:#f8fafc;border-radius:10px;padding:12px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><strong style="font-size:13px">${esc(c.code)}</strong><span style="font-size:14px;font-weight:800;color:#10b981">$${(c.total_earned||0).toFixed(2)}</span></div><div style="display:flex;gap:16px;font-size:11px;color:var(--text-secondary)"><span>Paid: $${(c.paid||0).toFixed(2)}</span><span>Conversions: ${c.conversions||0}</span></div></div>`).join('')}</div>`:'<p class="adm-empty">No data</p>'}
          <button class="adm-btn" style="background:#10b981;color:#fff;font-size:11px;padding:6px 14px;border-radius:8px;margin-top:12px;width:100%" onclick="window._admin.exportCSV('earnings')"><i class="fas fa-download" style="margin-right:4px"></i> Export Earnings CSV</button>
        </div>
      </div>
      <div class="adm-card">
        <h3 class="adm-card-title"><i class="fas fa-receipt" style="color:#f59e0b"></i> Recent Transactions</h3>
        ${recent.length?`<div class="adm-table-wrap" style="max-height:400px;overflow-y:auto"><table class="adm-table"><thead><tr><th>Type</th><th>Amount</th><th>Customer</th><th>Description</th><th>Status</th><th>Date</th></tr></thead><tbody>
          ${recent.map(e=>`<tr><td><span style="display:inline-flex;align-items:center;gap:4px;font-size:12px"><i class="fas ${typeIcons[e.event_type]||'fa-circle'}" style="color:var(--text-secondary)"></i>${e.event_type.replace(/_/g,' ')}</span></td>
            <td style="font-weight:700;color:#10b981">$${(e.amount||0).toFixed(2)}</td>
            <td style="font-size:12px">${esc(e.customer_name||'-')}</td>
            <td style="font-size:12px;max-width:200px;overflow:hidden;text-overflow:ellipsis">${esc(e.description||'-')}</td>
            <td><span style="background:${statusColors[e.status]||'#94a3b8'}15;color:${statusColors[e.status]||'#94a3b8'};padding:3px 10px;border-radius:12px;font-size:10px;font-weight:600;text-transform:capitalize">${e.status}</span></td>
            <td style="font-size:11px">${timeAgo(e.created_at)}</td></tr>`).join('')}
        </tbody></table></div>`:'<p class="adm-empty">No transactions yet</p>'}
      </div>`;
  }

  // ============================================
  // SMART SEGMENTS TAB
  // ============================================
  async function renderAffSegments(ct) {
    const res=await fetch('/api/partner/segments',{headers:getAdminHeaders()});
    const data=await res.json();
    if(data.error){ct.innerHTML=`<div class="adm-error">${esc(data.error)}</div>`;return;}
    const segments=data.segments||[];
    const sc={lead:'#94a3b8',engaged:'#3b82f6',active:'#10b981',power_user:'#f59e0b',churned:'#ef4444'};
    ct.innerHTML=`
      <div style="display:flex;flex-direction:column;gap:16px">
        ${segments.map(seg=>`<div class="adm-card">
          <h3 class="adm-card-title" style="display:flex;align-items:center;gap:8px"><i class="fas ${seg.icon}" style="color:${seg.color}"></i> ${esc(seg.name)} <span style="background:${seg.color}15;color:${seg.color};padding:2px 10px;border-radius:12px;font-size:12px;font-weight:700;margin-left:4px">${seg.customers.length}</span></h3>
          <p style="font-size:12px;color:var(--text-secondary);margin:-8px 0 12px">${esc(seg.description)}</p>
          ${seg.customers.length?`<div class="adm-table-wrap"><table class="adm-table adm-table-compact"><thead><tr><th style="width:30px"><input type="checkbox" onchange="window._admin.toggleSegBulk(this.checked,${JSON.stringify(seg.customers.map(c=>c.id)).replace(/"/g,'&quot;')})"></th><th>Customer</th><th>Key Metric</th><th>Upsell</th><th>Actions</th></tr></thead><tbody>
            ${seg.customers.map(c=>{
              const metric=c.calculator_uses!==undefined?`Calc: ${c.calculator_uses}, Proto: ${c.protocols_viewed||0}`:
                c.total_sessions!==undefined&&c.stacks_built!==undefined?`${c.total_sessions} sessions, ${c.stacks_built||0} stacks`:
                c.days_since_last_active!==undefined?`${c.days_since_last_active}d inactive`:
                c.peptides_viewed!==undefined?`${c.peptides_viewed} peptides in ${c.lifetime_days||0}d`:
                '';
              return `<tr><td><input type="checkbox" class="seg-check" data-id="${c.id}" onchange="window._admin.toggleBulk(${c.id},this.checked)"></td><td style="cursor:pointer" onclick="window._admin.viewCustomer(${c.id})"><strong style="font-size:12px">${esc(c.display_name||c.email||'Anon')}</strong></td><td style="font-size:11px;color:var(--text-secondary)">${metric}</td><td><strong style="color:#f59e0b;font-size:12px">${c.upsell_score||0}</strong></td><td><button class="adm-action-btn" onclick="window._admin.viewCustomer(${c.id})" title="View"><i class="fas fa-eye"></i></button><button class="adm-action-btn" onclick="window._admin.showRecModal(${c.id},'${esc(c.display_name||c.email||'')}')" title="Recommend"><i class="fas fa-wand-magic-sparkles"></i></button></td></tr>`;}).join('')}
          </tbody></table></div>
          <button class="adm-btn" style="background:${seg.color};color:#fff;font-size:11px;padding:6px 14px;border-radius:8px;margin-top:8px" onclick="window._admin.bulkRecSegment(${JSON.stringify(seg.customers.map(c=>c.id)).replace(/"/g,'&quot;')})"><i class="fas fa-paper-plane" style="margin-right:4px"></i> Recommend to all ${seg.customers.length}</button>
          `:'<p class="adm-empty">No customers in this segment</p>'}
        </div>`).join('')}
      </div>`;
  }

  function toggleSegBulk(checked,ids){ids.forEach(id=>toggleBulk(id,checked));document.querySelectorAll('.seg-check').forEach(cb=>{if(ids.includes(parseInt(cb.dataset.id)))cb.checked=checked;});}
  function bulkRecSegment(ids){ids.forEach(id=>bulkSelected.add(id));showBulkRecommend();}

  // ============================================
  // RECOMMENDATIONS TAB (unchanged logic, kept)
  // ============================================
  async function renderAffRecommendations(ct) {
    const res=await fetch('/api/partner/crm-overview',{headers:getAdminHeaders()});const data=await res.json();const recs=data.recentRecommendations||[];
    const sb={sent:'#94a3b8',viewed:'#3b82f6',clicked:'#f59e0b',converted:'#10b981',dismissed:'#ef4444'};
    ct.innerHTML=`
      <div class="adm-stats-grid" style="grid-template-columns:repeat(auto-fit,minmax(130px,1fr));margin-bottom:20px">
        <div class="adm-stat-card"><div class="adm-stat-icon" style="background:#94a3b815;color:#94a3b8"><i class="fas fa-paper-plane"></i></div><div class="adm-stat-num">${recs.length}</div><div class="adm-stat-label">Sent</div></div>
        <div class="adm-stat-card"><div class="adm-stat-icon" style="background:#3b82f615;color:#3b82f6"><i class="fas fa-eye"></i></div><div class="adm-stat-num">${recs.filter(r=>r.status==='viewed').length}</div><div class="adm-stat-label">Viewed</div></div>
        <div class="adm-stat-card"><div class="adm-stat-icon" style="background:#f59e0b15;color:#f59e0b"><i class="fas fa-mouse-pointer"></i></div><div class="adm-stat-num">${recs.filter(r=>r.status==='clicked').length}</div><div class="adm-stat-label">Clicked</div></div>
        <div class="adm-stat-card"><div class="adm-stat-icon" style="background:#10b98115;color:#10b981"><i class="fas fa-check-double"></i></div><div class="adm-stat-num">${recs.filter(r=>r.status==='converted').length}</div><div class="adm-stat-label">Converted</div></div>
      </div>
      <div class="adm-card"><h3 class="adm-card-title"><i class="fas fa-wand-magic-sparkles" style="color:#f59e0b"></i> All Recommendations</h3>
      ${recs.length?`<div class="adm-table-wrap"><table class="adm-table"><thead><tr><th>Customer</th><th>Peptide</th><th>Category</th><th>Reason</th><th>Status</th><th>Sent</th></tr></thead><tbody>${recs.map(r=>`<tr style="cursor:pointer" onclick="window._admin.viewCustomer(${r.customer_id})"><td><strong>${esc(r.customer_name||'Anon')}</strong></td><td><span style="background:#eff6ff;color:#2563eb;padding:3px 10px;border-radius:6px;font-size:11px;font-weight:600">${esc(r.peptide_name)}</span></td><td style="font-size:12px">${esc(r.category||'-')}</td><td style="font-size:12px;max-width:200px;overflow:hidden;text-overflow:ellipsis">${esc(r.reason||'-')}</td><td><span style="background:${sb[r.status]}15;color:${sb[r.status]};padding:3px 10px;border-radius:12px;font-size:10px;font-weight:600;text-transform:capitalize">${r.status}</span></td><td style="font-size:11px">${timeAgo(r.sent_at)}</td></tr>`).join('')}</tbody></table></div>`:'<p class="adm-empty">No recommendations yet.</p>'}
      </div>`;
  }

  async function renderAffInsights(ct) {
    const res=await fetch('/api/partner/crm-overview',{headers:getAdminHeaders()});const data=await res.json();
    const tp=data.topPeptides||[],tc=data.topCategories||[],s=data.stats||{};
    ct.innerHTML=`<div class="adm-two-col" style="margin-bottom:20px">
      <div class="adm-card"><h3 class="adm-card-title"><i class="fas fa-tags" style="color:#7c3aed"></i> Top Categories</h3>
        ${tc.length?`<div style="display:flex;flex-direction:column;gap:8px">${tc.map((cat,i)=>{const mx=tc[0]?.customers||1;const pct=Math.max(8,(cat.customers/mx)*100);return `<div><div style="display:flex;justify-content:space-between;margin-bottom:4px"><strong style="font-size:12px">${esc(cat.category)}</strong><span style="font-size:11px;color:var(--text-muted)">${cat.customers} customers | ${cat.total_views} views</span></div><div style="height:8px;background:#f1f5f9;border-radius:4px;overflow:hidden"><div style="width:${pct}%;height:100%;background:${colors[i%colors.length]};border-radius:4px"></div></div></div>`;}).join('')}</div>`:'<p class="adm-empty">No data yet</p>'}
      </div>
      <div class="adm-card"><h3 class="adm-card-title"><i class="fas fa-chart-pie" style="color:#06b6d4"></i> Engagement Summary</h3>
        <div style="display:flex;flex-direction:column;gap:12px">
          <div style="display:flex;justify-content:space-between;padding:10px;background:#f0fdf4;border-radius:10px;border:1px solid #bbf7d0"><span style="font-size:13px;font-weight:600;color:#166534">Calculator Uses</span><strong style="font-size:18px;color:#166534">${s.total_calc_uses||0}</strong></div>
          <div style="display:flex;justify-content:space-between;padding:10px;background:#eff6ff;border-radius:10px;border:1px solid #bfdbfe"><span style="font-size:13px;font-weight:600;color:#1e40af">Stacks Built</span><strong style="font-size:18px;color:#1e40af">${s.total_stacks||0}</strong></div>
          <div style="display:flex;justify-content:space-between;padding:10px;background:#faf5ff;border-radius:10px;border:1px solid #ddd6fe"><span style="font-size:13px;font-weight:600;color:#6d28d9">Avg Upsell Score</span><strong style="font-size:18px;color:#6d28d9">${Math.round(s.avg_upsell_score||0)}</strong></div>
        </div>
      </div>
    </div>
    <div class="adm-card"><h3 class="adm-card-title"><i class="fas fa-ranking-star" style="color:#f59e0b"></i> Most Popular Peptides</h3>
      ${tp.length?`<div class="adm-table-wrap"><table class="adm-table"><thead><tr><th>#</th><th>Peptide</th><th>Category</th><th>Customers</th><th>Views</th><th>Calc</th><th>Stacks</th><th>Favs</th></tr></thead><tbody>${tp.map((p,i)=>`<tr><td style="font-weight:700;color:${i<3?'#f59e0b':'var(--text-muted)'}">${i+1}</td><td><strong>${esc(p.peptide_name)}</strong></td><td><span class="adm-cat-badge">${esc(p.category)}</span></td><td style="font-weight:600">${p.unique_customers}</td><td>${p.total_views||0}</td><td>${p.total_calc||0}</td><td>${p.total_stacks||0}</td><td>${p.total_favs||0}</td></tr>`).join('')}</tbody></table></div>`:'<p class="adm-empty">No data yet</p>'}
    </div>`;
  }

  async function renderAffLinks(ct) {
    const res=await fetch('/api/partner/my-stats',{headers:getAdminHeaders()});const data=await res.json();
    const codes=data.codes||[],trend=data.trend||[];
    ct.innerHTML=`
      <div class="adm-stats-grid" style="grid-template-columns:repeat(auto-fit,minmax(130px,1fr));margin-bottom:20px">
        <div class="adm-stat-card"><div class="adm-stat-icon" style="background:#2563eb15;color:#2563eb"><i class="fas fa-link"></i></div><div class="adm-stat-num">${codes.length}</div><div class="adm-stat-label">Active Links</div></div>
        <div class="adm-stat-card"><div class="adm-stat-icon" style="background:#8b5cf615;color:#8b5cf6"><i class="fas fa-mouse-pointer"></i></div><div class="adm-stat-num">${codes.reduce((a,c)=>a+(c.total_clicks||0),0)}</div><div class="adm-stat-label">Clicks</div></div>
        <div class="adm-stat-card"><div class="adm-stat-icon" style="background:#10b98115;color:#10b981"><i class="fas fa-user-plus"></i></div><div class="adm-stat-num">${codes.reduce((a,c)=>a+(c.total_signups||0),0)}</div><div class="adm-stat-label">Signups</div></div>
      </div>
      ${trend.length>3?(() => {
        const linkChartId = 'admLinkTrend_' + Date.now();
        setTimeout(() => {
          if (typeof Chart === 'undefined') return;
          createChart(linkChartId, {
            type: 'line',
            data: {
              labels: trend.map(d => d.date.slice(5)),
              datasets: [{
                label: 'Clicks',
                data: trend.map(d => d.clicks || 0),
                borderColor: '#2563eb',
                backgroundColor: 'rgba(37,99,235,0.1)',
                fill: true,
                pointRadius: 2,
                pointHoverRadius: 5,
                pointBackgroundColor: '#2563eb',
                borderWidth: 2.5,
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                tooltip: { backgroundColor: 'rgba(15,23,42,0.92)', padding: 10, cornerRadius: 8 }
              },
              scales: {
                x: { grid: { display: false }, ticks: { font: { size: 9 }, maxTicksLimit: 10 } },
                y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.04)' } }
              }
            }
          });
        }, 50);
        return `<div class="adm-card adm-chart-card" style="margin-bottom:20px"><h3 class="adm-card-title"><i class="fas fa-chart-area"></i> Click Trend (30 days)</h3><div style="position:relative;height:160px;width:100%"><canvas id="${linkChartId}"></canvas></div></div>`;
      })():``}
      <div class="adm-aff-grid">${codes.length?codes.map(c=>`<div class="adm-aff-card"><div class="adm-aff-header"><div class="adm-aff-code">${esc(c.code)}</div></div>${c.label?`<div class="adm-aff-meta"><span><i class="fas fa-tag"></i> ${esc(c.label)}</span></div>`:''}<div class="adm-aff-stats"><div class="adm-aff-stat"><div class="adm-aff-stat-num">${c.total_clicks||0}</div><div class="adm-aff-stat-label">Clicks</div></div><div class="adm-aff-stat"><div class="adm-aff-stat-num">${c.total_signups||0}</div><div class="adm-aff-stat-label">Signups</div></div><div class="adm-aff-stat"><div class="adm-aff-stat-num">${c.total_active||0}</div><div class="adm-aff-stat-label">Active</div></div></div><div class="adm-aff-link"><code>peptidesafe.org?ref=${esc(c.code)}</code><button class="adm-copy-btn" onclick="navigator.clipboard.writeText('https://peptidesafe.org?ref=${esc(c.code)}');this.innerHTML='<i class=\\'fas fa-check\\'></i>';setTimeout(()=>this.innerHTML='<i class=\\'fas fa-copy\\'></i>',1500)"><i class="fas fa-copy"></i></button></div></div>`).join(''):'<p class="adm-empty" style="grid-column:1/-1">No partner codes yet.</p>'}</div>`;
  }

  // ============================================
  // PIPELINE (DEALS) TAB
  // ============================================
  async function renderAffPipeline(ct) {
    const res = await fetch('/api/partner/deals', { headers: getAdminHeaders() });
    const data = await res.json();
    const deals = data.deals || [];
    const pipeline = data.pipeline || [];
    const stageColors = { lead: '#94a3b8', qualified: '#3b82f6', proposal: '#7c3aed', negotiation: '#f59e0b', won: '#10b981', lost: '#ef4444' };
    const stageIcons = { lead: 'fa-seedling', qualified: 'fa-check', proposal: 'fa-file-alt', negotiation: 'fa-handshake', won: 'fa-trophy', lost: 'fa-times-circle' };
    const stages = ['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost'];
    const totalValue = pipeline.reduce((a, s) => a + (s.total_value || 0), 0);

    ct.innerHTML = `
      <div class="adm-toolbar" style="margin-bottom:16px">
        <h3 style="font-size:16px;font-weight:700;margin:0"><i class="fas fa-filter" style="color:#7c3aed;margin-right:8px"></i>Sales Pipeline</h3>
        <button class="adm-btn adm-btn-primary" onclick="window._admin.showAddDeal()"><i class="fas fa-plus"></i> New Deal</button>
      </div>
      <div class="adm-stats-grid" style="grid-template-columns:repeat(auto-fit,minmax(100px,1fr));margin-bottom:20px">
        ${stages.map(s => {
          const p = pipeline.find(x => x.stage === s) || { count: 0, total_value: 0 };
          return `<div class="adm-stat-card" style="cursor:pointer" onclick="window._admin.filterDeals('${s}')">
            <div class="adm-stat-icon" style="background:${stageColors[s]}15;color:${stageColors[s]}"><i class="fas ${stageIcons[s]}"></i></div>
            <div class="adm-stat-num">${p.count}</div>
            <div class="adm-stat-label" style="text-transform:capitalize">${s}</div>
            <div style="font-size:10px;color:var(--text-muted)">$${(p.total_value || 0).toLocaleString()}</div>
          </div>`;
        }).join('')}
      </div>
      <div class="adm-card"><h3 class="adm-card-title"><i class="fas fa-list"></i> All Deals <span style="font-size:12px;color:var(--text-muted);font-weight:400">Total: $${totalValue.toLocaleString()}</span></h3>
        ${deals.length ? `<div class="adm-table-wrap"><table class="adm-table"><thead><tr><th>Deal</th><th>Customer</th><th>Stage</th><th>Value</th><th>Expected Close</th><th>Actions</th></tr></thead><tbody>
          ${deals.map(d => `<tr>
            <td><strong style="font-size:13px">${esc(d.title)}</strong>${d.description ? `<div style="font-size:11px;color:var(--text-muted);max-width:200px;overflow:hidden;text-overflow:ellipsis">${esc(d.description)}</div>` : ''}</td>
            <td>${d.customer_name ? esc(d.customer_name) : '<span style="color:var(--text-muted)">-</span>'}</td>
            <td><span style="background:${stageColors[d.stage] || '#94a3b8'}15;color:${stageColors[d.stage] || '#94a3b8'};padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600;text-transform:capitalize">${d.stage}</span></td>
            <td style="font-weight:700;color:#10b981">$${(d.value || 0).toLocaleString()}</td>
            <td style="font-size:12px">${d.expected_close_date || '-'}</td>
            <td>
              <select onchange="window._admin.updateDealStage(${d.id},this.value)" style="padding:4px 8px;border-radius:6px;border:1px solid var(--border);font-size:11px;background:var(--bg);color:var(--text)">
                ${stages.map(s => `<option value="${s}" ${d.stage === s ? 'selected' : ''}>${s}</option>`).join('')}
              </select>
              <button class="adm-action-btn adm-action-danger" onclick="window._admin.deleteDeal(${d.id})" title="Delete"><i class="fas fa-trash"></i></button>
            </td>
          </tr>`).join('')}
        </tbody></table></div>` : '<p class="adm-empty">No deals yet. Create your first deal to start tracking your pipeline.</p>'}
      </div>
      <div id="dealModal"></div>`;
  }

  async function showAddDeal() {
    const custRes = await fetch('/api/partner/customers?limit=100', { headers: getAdminHeaders() });
    const custData = await custRes.json();
    const customers = custData.customers || [];
    const modal = document.getElementById('dealModal') || document.createElement('div');
    modal.id = 'dealModal';
    modal.innerHTML = `<div class="adm-modal-overlay" onclick="if(event.target===this)this.remove()"><div class="adm-modal"><h3 class="adm-modal-title"><i class="fas fa-plus"></i> New Deal</h3>
      <div class="adm-form-group"><label>Title</label><input id="dealTitle" class="adm-input" placeholder="e.g. Clinic Partnership Q2"></div>
      <div class="adm-form-group"><label>Customer (optional)</label><select id="dealCustomer" class="adm-input"><option value="">None</option>${customers.map(c => `<option value="${c.id}">${esc(c.display_name || c.email || 'Anon')}</option>`).join('')}</select></div>
      <div class="adm-form-group"><label>Value ($)</label><input id="dealValue" class="adm-input" type="number" placeholder="0" min="0"></div>
      <div class="adm-form-group"><label>Stage</label><select id="dealStage" class="adm-input"><option value="lead">Lead</option><option value="qualified">Qualified</option><option value="proposal">Proposal</option><option value="negotiation">Negotiation</option></select></div>
      <div class="adm-form-group"><label>Description</label><textarea id="dealDesc" class="adm-input" rows="2" placeholder="Notes about this deal..."></textarea></div>
      <div class="adm-form-group"><label>Expected Close Date</label><input id="dealClose" class="adm-input" type="date"></div>
      <div class="adm-modal-actions"><button class="adm-btn" onclick="this.closest('.adm-modal-overlay').remove()">Cancel</button><button class="adm-btn adm-btn-primary" onclick="window._admin.submitDeal()">Create Deal</button></div>
    </div></div>`;
  }

  async function submitDeal() {
    const title = document.getElementById('dealTitle')?.value?.trim();
    if (!title) { showToast('Title is required'); return; }
    await fetch('/api/partner/deals', {
      method: 'POST', headers: getAdminHeaders(),
      body: JSON.stringify({
        title,
        customer_id: document.getElementById('dealCustomer')?.value || null,
        value: parseFloat(document.getElementById('dealValue')?.value) || 0,
        stage: document.getElementById('dealStage')?.value || 'lead',
        description: document.getElementById('dealDesc')?.value || '',
        expected_close_date: document.getElementById('dealClose')?.value || null
      })
    });
    document.querySelector('.adm-modal-overlay')?.remove();
    showToast('Deal created');
    loadAffTab('pipeline');
  }

  async function updateDealStage(id, stage) {
    await fetch(`/api/partner/deals/${id}`, { method: 'PUT', headers: getAdminHeaders(), body: JSON.stringify({ stage }) });
    showToast('Deal updated');
  }

  async function deleteDeal(id) {
    if (!confirm('Delete this deal?')) return;
    await fetch(`/api/partner/deals/${id}`, { method: 'DELETE', headers: getAdminHeaders() });
    showToast('Deal deleted');
    loadAffTab('pipeline');
  }

  // ============================================
  // TASKS TAB
  // ============================================
  async function renderAffTasks(ct) {
    const res = await fetch('/api/partner/tasks', { headers: getAdminHeaders() });
    const data = await res.json();
    const tasks = data.tasks || [];
    const overdue = data.overdue || 0;
    const priorityColors = { urgent: '#ef4444', high: '#f59e0b', medium: '#3b82f6', low: '#94a3b8' };
    const typeIcons = { follow_up: 'fa-phone', call: 'fa-phone-volume', email: 'fa-envelope', meeting: 'fa-users', review: 'fa-eye', custom: 'fa-circle' };

    ct.innerHTML = `
      <div class="adm-toolbar" style="margin-bottom:16px">
        <div style="display:flex;align-items:center;gap:12px">
          <h3 style="font-size:16px;font-weight:700;margin:0"><i class="fas fa-list-check" style="color:#2563eb;margin-right:8px"></i>Tasks</h3>
          ${overdue > 0 ? `<span style="background:#fef2f2;color:#ef4444;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600"><i class="fas fa-exclamation-triangle" style="margin-right:4px"></i>${overdue} overdue</span>` : ''}
        </div>
        <button class="adm-btn adm-btn-primary" onclick="window._admin.showAddTask()"><i class="fas fa-plus"></i> New Task</button>
      </div>
      ${tasks.length ? `<div style="display:flex;flex-direction:column;gap:8px">
        ${tasks.map(t => {
          const isOverdue = t.status !== 'completed' && t.due_date && new Date(t.due_date) < new Date();
          return `<div class="adm-card" style="padding:14px 18px;border-left:4px solid ${priorityColors[t.priority] || '#94a3b8'};${isOverdue ? 'background:#fef2f2;' : ''}${t.status === 'completed' ? 'opacity:0.6;' : ''}">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
              <div style="flex:1">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                  <input type="checkbox" ${t.status === 'completed' ? 'checked' : ''} onchange="window._admin.toggleTask(${t.id},this.checked)" style="width:16px;height:16px;cursor:pointer">
                  <strong style="font-size:14px;${t.status === 'completed' ? 'text-decoration:line-through;color:var(--text-muted)' : ''}">${esc(t.title)}</strong>
                  <span style="background:${priorityColors[t.priority]}15;color:${priorityColors[t.priority]};padding:2px 8px;border-radius:6px;font-size:10px;font-weight:600;text-transform:capitalize">${t.priority}</span>
                  <i class="fas ${typeIcons[t.task_type] || 'fa-circle'}" style="color:var(--text-muted);font-size:11px" title="${t.task_type}"></i>
                </div>
                <div style="font-size:12px;color:var(--text-secondary);display:flex;gap:12px;flex-wrap:wrap">
                  ${t.customer_name ? `<span><i class="fas fa-user" style="margin-right:3px"></i>${esc(t.customer_name)}</span>` : ''}
                  ${t.deal_title ? `<span><i class="fas fa-briefcase" style="margin-right:3px"></i>${esc(t.deal_title)}</span>` : ''}
                  ${t.due_date ? `<span style="color:${isOverdue ? '#ef4444' : 'inherit'}"><i class="fas fa-calendar" style="margin-right:3px"></i>${isOverdue ? 'OVERDUE: ' : ''}${new Date(t.due_date).toLocaleDateString()}</span>` : ''}
                </div>
              </div>
              <button class="adm-action-btn adm-action-danger" onclick="window._admin.deleteTask(${t.id})" title="Delete"><i class="fas fa-trash"></i></button>
            </div>
          </div>`;
        }).join('')}
      </div>` : '<div class="adm-empty" style="padding:40px;text-align:center"><i class="fas fa-clipboard-check" style="font-size:28px;color:var(--text-muted);margin-bottom:12px;display:block"></i>No tasks yet. Stay organized by creating follow-ups!</div>'}
      <div id="taskModal"></div>`;
  }

  async function showAddTask() {
    const custRes = await fetch('/api/partner/customers?limit=100', { headers: getAdminHeaders() });
    const custs = (await custRes.json()).customers || [];
    const modal = document.getElementById('taskModal') || document.createElement('div');
    modal.id = 'taskModal';
    modal.innerHTML = `<div class="adm-modal-overlay" onclick="if(event.target===this)this.remove()"><div class="adm-modal"><h3 class="adm-modal-title"><i class="fas fa-plus"></i> New Task</h3>
      <div class="adm-form-group"><label>Title</label><input id="taskTitle" class="adm-input" placeholder="e.g. Follow up with Sarah about BPC-157"></div>
      <div class="adm-form-group"><label>Customer (optional)</label><select id="taskCustomer" class="adm-input"><option value="">None</option>${custs.map(c => `<option value="${c.id}">${esc(c.display_name || c.email || 'Anon')}</option>`).join('')}</select></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="adm-form-group"><label>Type</label><select id="taskType" class="adm-input"><option value="follow_up">Follow Up</option><option value="call">Call</option><option value="email">Email</option><option value="meeting">Meeting</option><option value="review">Review</option></select></div>
        <div class="adm-form-group"><label>Priority</label><select id="taskPriority" class="adm-input"><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option><option value="low">Low</option></select></div>
      </div>
      <div class="adm-form-group"><label>Due Date</label><input id="taskDue" class="adm-input" type="datetime-local"></div>
      <div class="adm-modal-actions"><button class="adm-btn" onclick="this.closest('.adm-modal-overlay').remove()">Cancel</button><button class="adm-btn adm-btn-primary" onclick="window._admin.submitTask()">Create Task</button></div>
    </div></div>`;
  }

  async function submitTask() {
    const title = document.getElementById('taskTitle')?.value?.trim();
    if (!title) { showToast('Title is required'); return; }
    await fetch('/api/partner/tasks', {
      method: 'POST', headers: getAdminHeaders(),
      body: JSON.stringify({
        title,
        customer_id: document.getElementById('taskCustomer')?.value || null,
        task_type: document.getElementById('taskType')?.value || 'follow_up',
        priority: document.getElementById('taskPriority')?.value || 'medium',
        due_date: document.getElementById('taskDue')?.value || null
      })
    });
    document.querySelector('.adm-modal-overlay')?.remove();
    showToast('Task created');
    loadAffTab('tasks');
  }

  async function toggleTask(id, completed) {
    await fetch(`/api/partner/tasks/${id}`, {
      method: 'PUT', headers: getAdminHeaders(),
      body: JSON.stringify({ status: completed ? 'completed' : 'pending' })
    });
    showToast(completed ? 'Task completed!' : 'Task reopened');
    loadAffTab('tasks');
  }

  async function deleteTask(id) {
    if (!confirm('Delete this task?')) return;
    await fetch(`/api/partner/tasks/${id}`, { method: 'DELETE', headers: getAdminHeaders() });
    showToast('Task deleted');
    loadAffTab('tasks');
  }

  // ============================================
  // GOALS TAB
  // ============================================
  async function renderAffGoals(ct) {
    const res = await fetch('/api/partner/goals', { headers: getAdminHeaders() });
    const data = await res.json();
    const goals = data.goals || [];
    const typeColors = { customers: '#2563eb', conversions: '#10b981', revenue: '#f59e0b', engagement: '#7c3aed', custom: '#6b7280' };
    const typeIcons = { customers: 'fa-users', conversions: 'fa-check-double', revenue: 'fa-dollar-sign', engagement: 'fa-chart-line', custom: 'fa-bullseye' };

    ct.innerHTML = `
      <div class="adm-toolbar" style="margin-bottom:16px">
        <h3 style="font-size:16px;font-weight:700;margin:0"><i class="fas fa-trophy" style="color:#f59e0b;margin-right:8px"></i>Goals & KPIs</h3>
        <button class="adm-btn adm-btn-primary" onclick="window._admin.showAddGoal()"><i class="fas fa-plus"></i> New Goal</button>
      </div>
      ${goals.length ? `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px">
        ${goals.map(g => {
          const pct = g.target_value > 0 ? Math.min(100, (g.current_value / g.target_value) * 100) : 0;
          const color = typeColors[g.goal_type] || '#6b7280';
          return `<div class="adm-card" style="border-top:3px solid ${color}">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
              <div style="display:flex;align-items:center;gap:8px">
                <span style="width:32px;height:32px;border-radius:8px;background:${color}15;color:${color};display:flex;align-items:center;justify-content:center"><i class="fas ${typeIcons[g.goal_type] || 'fa-bullseye'}"></i></span>
                <div>
                  <strong style="font-size:14px">${esc(g.title)}</strong>
                  <div style="font-size:11px;color:var(--text-muted);text-transform:capitalize">${g.period} | ${g.goal_type}</div>
                </div>
              </div>
              ${g.is_achieved ? '<span style="background:#d1fae5;color:#059669;padding:4px 10px;border-radius:12px;font-size:11px;font-weight:700"><i class="fas fa-check" style="margin-right:3px"></i>Achieved!</span>' : ''}
            </div>
            <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px">
              <span style="font-size:24px;font-weight:800;color:${color}">${g.current_value}</span>
              <span style="font-size:13px;color:var(--text-muted)">/ ${g.target_value} target</span>
            </div>
            <div style="height:10px;background:#f1f5f9;border-radius:5px;overflow:hidden;margin-bottom:8px">
              <div style="width:${pct}%;height:100%;background:${color};border-radius:5px;transition:width 0.4s"></div>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span style="font-size:12px;color:var(--text-secondary)">${pct.toFixed(1)}% complete</span>
              <div style="display:flex;gap:4px">
                <input type="number" id="goalVal${g.id}" value="${g.current_value}" style="width:60px;padding:4px 8px;border:1px solid var(--border);border-radius:6px;font-size:11px;text-align:center;background:var(--bg);color:var(--text)" min="0">
                <button class="adm-btn" style="font-size:10px;padding:4px 8px" onclick="window._admin.updateGoalValue(${g.id})"><i class="fas fa-save"></i></button>
              </div>
            </div>
          </div>`;
        }).join('')}
      </div>` : '<div class="adm-empty" style="padding:40px;text-align:center"><i class="fas fa-trophy" style="font-size:28px;color:var(--text-muted);margin-bottom:12px;display:block"></i>No goals set. Track your progress by setting goals!</div>'}
      <div id="goalModal"></div>`;
  }

  async function showAddGoal() {
    const modal = document.getElementById('goalModal') || document.createElement('div');
    modal.id = 'goalModal';
    modal.innerHTML = `<div class="adm-modal-overlay" onclick="if(event.target===this)this.remove()"><div class="adm-modal"><h3 class="adm-modal-title"><i class="fas fa-trophy"></i> New Goal</h3>
      <div class="adm-form-group"><label>Goal Title</label><input id="goalTitle" class="adm-input" placeholder="e.g. Reach 50 Active Customers"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="adm-form-group"><label>Type</label><select id="goalType" class="adm-input"><option value="customers">Customers</option><option value="conversions">Conversions</option><option value="revenue">Revenue</option><option value="engagement">Engagement</option><option value="custom">Custom</option></select></div>
        <div class="adm-form-group"><label>Target Value</label><input id="goalTarget" class="adm-input" type="number" placeholder="50" min="1"></div>
      </div>
      <div class="adm-form-group"><label>Period</label><select id="goalPeriod" class="adm-input"><option value="monthly">Monthly</option><option value="weekly">Weekly</option><option value="quarterly">Quarterly</option><option value="yearly">Yearly</option></select></div>
      <div class="adm-modal-actions"><button class="adm-btn" onclick="this.closest('.adm-modal-overlay').remove()">Cancel</button><button class="adm-btn adm-btn-primary" onclick="window._admin.submitGoal()">Create Goal</button></div>
    </div></div>`;
  }

  async function submitGoal() {
    const title = document.getElementById('goalTitle')?.value?.trim();
    const target = parseFloat(document.getElementById('goalTarget')?.value);
    if (!title || !target) { showToast('Title and target required'); return; }
    await fetch('/api/partner/goals', {
      method: 'POST', headers: getAdminHeaders(),
      body: JSON.stringify({
        title, target_value: target,
        goal_type: document.getElementById('goalType')?.value || 'custom',
        period: document.getElementById('goalPeriod')?.value || 'monthly'
      })
    });
    document.querySelector('.adm-modal-overlay')?.remove();
    showToast('Goal created');
    loadAffTab('goals');
  }

  async function updateGoalValue(id) {
    const val = parseFloat(document.getElementById('goalVal' + id)?.value);
    if (isNaN(val)) return;
    await fetch(`/api/partner/goals/${id}`, {
      method: 'PUT', headers: getAdminHeaders(),
      body: JSON.stringify({ current_value: val, is_achieved: false })
    });
    showToast('Goal updated');
    loadAffTab('goals');
  }

  // ============================================
  // UTILITIES
  // ============================================
  function esc(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = String(s); return d.innerHTML; }

  function timeAgo(date) {
    if (!date) return '';
    const now = Date.now();
    const d = new Date(date).getTime();
    const diff = (now - d) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
    return new Date(date).toLocaleDateString();
  }

  // ============================================
  // MESSAGES TAB
  // ============================================
  let _msgConvId = null; // currently open conversation
  let _msgComposeTo = null; // customer_id for new message

  async function renderAffMessages(ct) {
    const res = await fetch('/api/partner/messages', { headers: getAdminHeaders() });
    const data = await res.json();
    const convs = data.conversations || [];
    const totalUnread = data.totalUnread || 0;

    ct.innerHTML = `
      <div class="adm-stats-grid" style="grid-template-columns:repeat(auto-fit,minmax(140px,1fr));margin-bottom:20px">
        <div class="adm-stat-card">
          <div class="adm-stat-icon" style="background:#3b82f615;color:#3b82f6"><i class="fas fa-envelope"></i></div>
          <div class="adm-stat-num">${convs.length}</div>
          <div class="adm-stat-label">Conversations</div>
        </div>
        <div class="adm-stat-card">
          <div class="adm-stat-icon" style="background:#ef444415;color:#ef4444"><i class="fas fa-bell"></i></div>
          <div class="adm-stat-num">${totalUnread}</div>
          <div class="adm-stat-label">Unread</div>
        </div>
      </div>

      <div class="adm-card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <h3 class="adm-card-title" style="margin:0"><i class="fas fa-comments" style="color:#3b82f6"></i> Conversations</h3>
          <button class="adm-btn" style="background:#3b82f6;color:#fff;font-size:12px;padding:8px 16px;border-radius:8px" onclick="window._admin.composeMessage()">
            <i class="fas fa-pen-to-square" style="margin-right:4px"></i> New Message
          </button>
        </div>
        ${convs.length ? `
          <div style="display:flex;flex-direction:column;gap:8px">
            ${convs.map(c => {
              const unread = c.partner_unread || 0;
              return `
                <div class="msg-conv-row" style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:10px;border:1px solid var(--border);cursor:pointer;transition:all .15s;background:${unread ? '#eff6ff' : 'var(--bg-card)'}" onclick="window._admin.openConversation(${c.id})" onmouseover="this.style.borderColor='#3b82f6'" onmouseout="this.style.borderColor='var(--border)'">
                  <div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#3b82f6,#2563eb);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:14px;flex-shrink:0">
                    ${(c.customer_name || c.customer_email || '?')[0].toUpperCase()}
                  </div>
                  <div style="flex:1;min-width:0">
                    <div style="display:flex;justify-content:space-between;align-items:center">
                      <strong style="font-size:13px">${esc(c.customer_name || c.customer_email || 'Anonymous')}</strong>
                      <span style="font-size:11px;color:var(--text-muted)">${timeAgo(c.last_message_at)}</span>
                    </div>
                    ${c.subject ? `<div style="font-size:11px;font-weight:600;color:#3b82f6;margin:2px 0">${esc(c.subject)}</div>` : ''}
                    <div style="font-size:12px;color:var(--text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:400px">${esc(c.last_message_preview || 'No messages yet')}</div>
                  </div>
                  <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
                    <span class="adm-badge" style="background:${statusColors[c.customer_status] || '#94a3b8'}15;color:${statusColors[c.customer_status] || '#94a3b8'};padding:3px 8px;border-radius:6px;font-size:10px;font-weight:600;text-transform:capitalize">${c.customer_status || 'lead'}</span>
                    ${unread ? `<span style="background:#ef4444;color:#fff;padding:2px 8px;border-radius:12px;font-size:10px;font-weight:700;min-width:20px;text-align:center">${unread}</span>` : ''}
                  </div>
                </div>`;
            }).join('')}
          </div>
        ` : `
          <div class="adm-empty" style="padding:40px;text-align:center">
            <i class="fas fa-envelope-open" style="font-size:32px;color:var(--text-muted);margin-bottom:12px;display:block"></i>
            <p style="font-size:14px;color:var(--text-muted);margin-bottom:8px">No conversations yet</p>
            <p style="font-size:12px;color:var(--text-muted)">Send your first message from a customer's profile or click "New Message" above.</p>
          </div>
        `}
      </div>

      <!-- Message thread modal placeholder -->
      <div id="msgThreadModal"></div>
      <div id="msgComposeModal"></div>
    `;
  }

  const statusColors = {
    lead: '#94a3b8', engaged: '#3b82f6', active: '#10b981', power_user: '#7c3aed', churned: '#ef4444'
  };

  async function openConversation(convId) {
    _msgConvId = convId;
    const res = await fetch(`/api/partner/messages/${convId}`, { headers: getAdminHeaders() });
    const data = await res.json();
    const conv = data.conversation;
    const msgs = data.messages || [];

    const modal = document.getElementById('msgThreadModal') || document.createElement('div');
    modal.id = 'msgThreadModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center';
    modal.innerHTML = `
      <div style="background:var(--bg-card);border-radius:16px;width:95%;max-width:600px;max-height:85vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.3)">
        <div style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
          <div>
            <h3 style="font-size:15px;font-weight:700;margin:0;color:var(--text)">${esc(conv.customer_name || conv.customer_email || 'Customer')}</h3>
            ${conv.subject ? `<p style="font-size:12px;color:#3b82f6;margin:2px 0 0;font-weight:500">${esc(conv.subject)}</p>` : ''}
          </div>
          <div style="display:flex;gap:8px;align-items:center">
            <button class="adm-action-btn" onclick="window._admin.archiveConv(${convId})" title="Archive" style="color:var(--text-muted)"><i class="fas fa-archive"></i></button>
            <button class="adm-action-btn" onclick="document.getElementById('msgThreadModal').style.display='none'" style="font-size:18px;color:var(--text-muted)">&times;</button>
          </div>
        </div>
        <div id="msgThreadBody" style="flex:1;overflow-y:auto;padding:16px 20px;display:flex;flex-direction:column;gap:8px;max-height:50vh">
          ${msgs.length ? msgs.map(m => {
            const isAff = m.sender_type === 'partner';
            return `
              <div style="display:flex;${isAff ? 'justify-content:flex-end' : 'justify-content:flex-start'}">
                <div style="max-width:80%;padding:10px 14px;border-radius:${isAff ? '14px 14px 4px 14px' : '14px 14px 14px 4px'};background:${isAff ? 'linear-gradient(135deg,#3b82f6,#2563eb)' : '#f1f5f9'};color:${isAff ? '#fff' : 'var(--text)'};font-size:13px;line-height:1.5">
                  <div>${esc(m.message)}</div>
                  ${m.attached_peptide_name ? `<div style="margin-top:6px;padding:6px 10px;border-radius:8px;background:${isAff ? 'rgba(255,255,255,0.15)' : '#dbeafe'};font-size:11px"><i class="fas fa-pills" style="margin-right:4px"></i>${esc(m.attached_peptide_name)}</div>` : ''}
                  <div style="font-size:10px;opacity:0.7;margin-top:4px;text-align:${isAff ? 'right' : 'left'}">${timeAgo(m.created_at)}${m.is_read ? ' <i class="fas fa-check-double"></i>' : ''}</div>
                </div>
              </div>`;
          }).join('') : '<div style="text-align:center;padding:30px;color:var(--text-muted);font-size:13px">No messages yet. Start the conversation!</div>'}
        </div>
        <div style="padding:12px 20px;border-top:1px solid var(--border);display:flex;gap:8px;align-items:flex-end">
          <textarea id="msgReplyInput" placeholder="Type your message..." style="flex:1;resize:none;border:1px solid var(--border);border-radius:10px;padding:10px 12px;font-size:13px;font-family:inherit;min-height:40px;max-height:120px;background:var(--bg);color:var(--text)" rows="1" oninput="this.style.height='auto';this.style.height=Math.min(this.scrollHeight,120)+'px'"></textarea>
          <button onclick="window._admin.sendReply(${convId})" style="background:linear-gradient(135deg,#3b82f6,#2563eb);color:#fff;border:none;border-radius:10px;padding:10px 16px;cursor:pointer;font-size:13px;font-weight:600;white-space:nowrap" title="Send">
            <i class="fas fa-paper-plane"></i>
          </button>
        </div>
      </div>
    `;
    if (!modal.parentNode) document.body.appendChild(modal);

    // Scroll to bottom
    setTimeout(() => {
      const body = document.getElementById('msgThreadBody');
      if (body) body.scrollTop = body.scrollHeight;
    }, 100);
  }

  async function sendReply(convId) {
    const input = document.getElementById('msgReplyInput');
    const msg = input?.value?.trim();
    if (!msg) return;
    input.value = '';
    input.style.height = 'auto';

    try {
      // Get the conversation's customer_id
      const convRes = await fetch(`/api/partner/messages/${convId}`, { headers: getAdminHeaders() });
      const convData = await convRes.json();
      const custId = convData.conversation?.customer_id;
      if (!custId) { showToast('Error: customer not found'); return; }

      await fetch('/api/partner/messages/send', {
        method: 'POST',
        headers: { ...getAdminHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: custId, message: msg })
      });
      // Refresh the thread
      await openConversation(convId);
    } catch(e) {
      showToast('Failed to send message');
    }
  }

  async function archiveConv(convId) {
    if (!confirm('Archive this conversation?')) return;
    await fetch(`/api/partner/messages/${convId}/archive`, {
      method: 'PUT', headers: getAdminHeaders()
    });
    document.getElementById('msgThreadModal').style.display = 'none';
    showToast('Conversation archived');
    const ct = document.getElementById('affContent');
    if (ct) await renderAffMessages(ct);
  }

  // Compose new message to a customer (shows customer picker)
  async function composeMessage(presetCustId, presetCustName) {
    // If called from customer detail, skip the picker
    if (presetCustId) {
      showComposeForm(presetCustId, presetCustName || 'Customer');
      return;
    }

    // Fetch customers list for picker
    const res = await fetch('/api/partner/customers?limit=200', { headers: getAdminHeaders() });
    const data = await res.json();
    const custs = data.customers || [];

    const modal = document.getElementById('msgComposeModal') || document.createElement('div');
    modal.id = 'msgComposeModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center';
    modal.innerHTML = `
      <div style="background:var(--bg-card);border-radius:16px;width:95%;max-width:500px;max-height:80vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.3)">
        <div style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
          <h3 style="font-size:15px;font-weight:700;margin:0;color:var(--text)"><i class="fas fa-pen-to-square" style="color:#3b82f6;margin-right:6px"></i>New Message</h3>
          <button onclick="document.getElementById('msgComposeModal').style.display='none'" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text-muted)">&times;</button>
        </div>
        <div style="padding:12px 20px">
          <input id="msgCustSearch" type="text" placeholder="Search customers..." style="width:100%;padding:10px 14px;border:1px solid var(--border);border-radius:10px;font-size:13px;background:var(--bg);color:var(--text);box-sizing:border-box" oninput="window._admin.filterMsgCustomers(this.value)">
        </div>
        <div id="msgCustList" style="flex:1;overflow-y:auto;padding:0 20px 16px;max-height:50vh">
          ${custs.map(c => `
            <div class="msg-cust-item" data-name="${esc((c.display_name||'')+(c.email||'')).toLowerCase()}" style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:8px;cursor:pointer;transition:background .15s" onclick="window._admin.showComposeForm(${c.id},'${esc(c.display_name || c.email || 'Anonymous')}')" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='transparent'">
              <div style="width:32px;height:32px;border-radius:50%;background:#3b82f6;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:12px;flex-shrink:0">${(c.display_name || c.email || '?')[0].toUpperCase()}</div>
              <div style="flex:1;min-width:0">
                <div style="font-size:13px;font-weight:600;color:var(--text)">${esc(c.display_name || 'Anonymous')}</div>
                <div style="font-size:11px;color:var(--text-muted)">${esc(c.email || c.visitor_id || '')}</div>
              </div>
              <span class="adm-badge" style="background:${statusColors[c.status] || '#94a3b8'}15;color:${statusColors[c.status] || '#94a3b8'};padding:2px 8px;border-radius:6px;font-size:10px;font-weight:600;text-transform:capitalize">${c.status || 'lead'}</span>
            </div>
          `).join('')}
          ${!custs.length ? '<div style="text-align:center;padding:30px;color:var(--text-muted)">No customers found</div>' : ''}
        </div>
      </div>
    `;
    if (!modal.parentNode) document.body.appendChild(modal);
  }

  function filterMsgCustomers(q) {
    const items = document.querySelectorAll('.msg-cust-item');
    const search = q.toLowerCase();
    items.forEach(item => {
      item.style.display = item.dataset.name.includes(search) ? 'flex' : 'none';
    });
  }

  function showComposeForm(custId, custName) {
    // Close the picker if open
    const pickerModal = document.getElementById('msgComposeModal');
    if (pickerModal) pickerModal.style.display = 'none';

    const modal = document.createElement('div');
    modal.id = 'msgComposeFormModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center';
    modal.innerHTML = `
      <div style="background:var(--bg-card);border-radius:16px;width:95%;max-width:500px;box-shadow:0 20px 60px rgba(0,0,0,0.3)">
        <div style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
          <h3 style="font-size:15px;font-weight:700;margin:0;color:var(--text)"><i class="fas fa-paper-plane" style="color:#3b82f6;margin-right:6px"></i>Message ${esc(custName)}</h3>
          <button onclick="this.closest('#msgComposeFormModal').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text-muted)">&times;</button>
        </div>
        <div style="padding:20px;display:flex;flex-direction:column;gap:12px">
          <input id="msgSubjectInput" type="text" placeholder="Subject (optional)" style="width:100%;padding:10px 14px;border:1px solid var(--border);border-radius:10px;font-size:13px;background:var(--bg);color:var(--text);box-sizing:border-box">
          <textarea id="msgBodyInput" placeholder="Write your message..." rows="4" style="width:100%;resize:vertical;border:1px solid var(--border);border-radius:10px;padding:10px 14px;font-size:13px;font-family:inherit;min-height:100px;background:var(--bg);color:var(--text);box-sizing:border-box"></textarea>
          <div style="font-size:11px;color:var(--text-muted)"><i class="fas fa-info-circle" style="margin-right:4px"></i>Max 2000 characters. The user will see this in their account inbox.</div>
          <div style="display:flex;gap:8px;justify-content:flex-end">
            <button onclick="this.closest('#msgComposeFormModal').remove()" style="background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:8px;padding:8px 16px;cursor:pointer;font-size:12px">Cancel</button>
            <button id="msgSendBtn" onclick="window._admin.submitMessage(${custId})" style="background:linear-gradient(135deg,#3b82f6,#2563eb);color:#fff;border:none;border-radius:8px;padding:8px 20px;cursor:pointer;font-size:12px;font-weight:600"><i class="fas fa-paper-plane" style="margin-right:4px"></i>Send</button>
          </div>
        </div>
      </div>
    `;
    // Remove existing if any
    const existing = document.getElementById('msgComposeFormModal');
    if (existing) existing.remove();
    document.body.appendChild(modal);
  }

  async function submitMessage(custId) {
    const subject = document.getElementById('msgSubjectInput')?.value?.trim() || '';
    const message = document.getElementById('msgBodyInput')?.value?.trim();
    if (!message) { showToast('Please enter a message'); return; }
    if (message.length > 2000) { showToast('Message too long (max 2000 chars)'); return; }

    const btn = document.getElementById('msgSendBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...'; }

    try {
      const res = await fetch('/api/partner/messages/send', {
        method: 'POST',
        headers: { ...getAdminHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: custId, message, subject })
      });
      const data = await res.json();
      if (data.ok) {
        const modal = document.getElementById('msgComposeFormModal');
        if (modal) modal.remove();
        showToast('Message sent!');
        // If we're on the messages tab, refresh it
        const ct = document.getElementById('affContent');
        if (ct && affTab === 'messages') await renderAffMessages(ct);
      } else {
        showToast(data.error || 'Failed to send');
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane" style="margin-right:4px"></i>Send'; }
      }
    } catch(e) {
      showToast('Failed to send message');
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane" style="margin-right:4px"></i>Send'; }
    }
  }

  // Send message from customer detail view
  async function messageCustomer(custId, custName) {
    showComposeForm(custId, custName);
  }

  function showToast(msg) {
    if (window.showToast) { window.showToast(msg); return; }
    const t = document.createElement('div');
    t.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#1f2937;color:#fff;padding:12px 20px;border-radius:10px;font-size:13px;z-index:999999;box-shadow:0 4px 12px rgba(0,0,0,0.3)';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }

  // ============================================
  // PUBLIC API
  // ============================================
  // ============================================
  // AI AGENTS TAB (disclosed helper agents + moderation queue)
  // ============================================
  let agentsState = { agents: [], selectedId: null, pending: [] };

  async function renderAgents(container) {
    const [agentsRes, pendingRes] = await Promise.all([
      fetch('/ai/agents', { headers: getAdminHeaders() }),
      fetch('/ai/agents/drafts?status=pending', { headers: getAdminHeaders() }),
    ]);
    if (agentsRes.status === 401) {
      container.innerHTML = `<div class="adm-error">Admin session required to manage agents.</div>`;
      return;
    }
    agentsState.agents = await agentsRes.json().catch(() => []);
    agentsState.pending = pendingRes.ok ? await pendingRes.json().catch(() => []) : [];
    if (!agentsState.selectedId && agentsState.agents.length) {
      agentsState.selectedId = agentsState.agents[0].id;
    }
    _renderAgentsView(container);
  }

  function _renderAgentsView(container) {
    const a = agentsState.agents;
    const sel = a.find(x => x.id === agentsState.selectedId) || null;

    const roster = a.length ? a.map(ag => `
      <button class="adm-agent-row ${ag.id === agentsState.selectedId ? 'active' : ''}"
        onclick="window._admin.selectAgent('${ag.id}')">
        <span class="adm-agent-avatar">${esc(ag.avatar || '🤖')}</span>
        <span style="display:flex;flex-direction:column;gap:1px;min-width:0;flex:1">
          <span style="font-weight:700;font-size:13px;color:var(--text-primary);display:flex;align-items:center;gap:6px">
            ${esc(ag.name)} <span class="adm-ai-badge">AI</span>
          </span>
          <span style="font-size:11px;color:var(--text-muted)">@${esc(ag.handle)} · ${esc(ag.specialty || ', ')}</span>
        </span>
        <span class="adm-agent-mode adm-agent-mode-${ag.mode}">${ag.mode === 'auto' ? 'AUTO' : 'QUEUE'}</span>
      </button>
    `).join('') : `<div style="padding:24px;text-align:center;color:var(--text-muted);font-size:13px">No agents yet. Create one →</div>`;

    container.innerHTML = `
      <div class="adm-card" style="margin-bottom:16px;display:flex;align-items:flex-start;gap:12px">
        <i class="fas fa-circle-info" style="color:#2563eb;margin-top:2px"></i>
        <div style="font-size:13px;color:var(--text-secondary);line-height:1.55">
          <strong style="color:var(--text-primary)">Every agent is a disclosed AI helper.</strong>
          Replies always post under an <span class="adm-ai-badge">AI</span> label and never appear as human members.
          Safety guardrails (research-only framing, no personalized dosing, no vendor recommendations) are enforced server-side and can't be edited away.
        </div>
      </div>

      <div class="adm-agents-grid">
        <!-- ROSTER -->
        <div class="adm-card" style="padding:14px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
            <div style="font-weight:700;font-size:13px;color:var(--text-primary)">Roster <span style="color:var(--text-muted);font-weight:500">(${a.length})</span></div>
            <button class="adm-btn adm-btn-sm" onclick="window._admin.newAgent()"><i class="fas fa-plus"></i> New</button>
          </div>
          <div class="adm-agent-roster">${roster}</div>
        </div>

        <!-- EDITOR + TEST -->
        <div class="adm-card" id="admAgentEditor">${sel ? _agentEditorHTML(sel) : '<div style="padding:40px;text-align:center;color:var(--text-muted)">Select or create an agent.</div>'}</div>
      </div>

      <!-- MODERATION QUEUE -->
      <div class="adm-card" style="margin-top:16px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
          <i class="fas fa-clipboard-check" style="color:#f59e0b"></i>
          <div style="font-weight:700;font-size:14px;color:var(--text-primary)">Moderation queue</div>
          <span class="adm-ai-badge" style="background:#f59e0b">${agentsState.pending.length} pending</span>
        </div>
        <div id="admAgentQueue">${_queueHTML(agentsState.pending)}</div>
      </div>
    `;
  }

  function _agentEditorHTML(ag) {
    const isNew = ag.__new === true;
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
        <div style="font-weight:700;font-size:14px;color:var(--text-primary)">${isNew ? 'New agent' : 'Edit agent'}</div>
        ${isNew ? '' : `<button class="adm-btn adm-btn-sm adm-btn-danger" onclick="window._admin.deleteAgent('${ag.id}')"><i class="fas fa-trash"></i></button>`}
      </div>
      <div class="adm-agent-form">
        <div style="display:grid;grid-template-columns:64px 1fr;gap:10px">
          <div><label class="adm-flabel">Avatar</label><input class="adm-input" id="agAvatar" value="${esc(ag.avatar || '🤖')}" maxlength="4" style="text-align:center;font-size:20px"></div>
          <div><label class="adm-flabel">Name</label><input class="adm-input" id="agName" value="${esc(ag.name || '')}" placeholder="Reconstitution Helper"></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div><label class="adm-flabel">Handle</label><input class="adm-input" id="agHandle" value="${esc(ag.handle || '')}" placeholder="recon-helper"></div>
          <div><label class="adm-flabel">Specialty</label><input class="adm-input" id="agSpecialty" value="${esc(ag.specialty || '')}" placeholder="Reconstitution & dosing math"></div>
        </div>
        <div>
          <label class="adm-flabel">System prompt <span style="color:var(--text-muted);font-weight:400">(persona + scope; guardrails are added automatically)</span></label>
          <textarea class="adm-input" id="agPrompt" rows="5" placeholder="You are…">${esc(ag.system_prompt || '')}</textarea>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
          <div><label class="adm-flabel">Model <span style="color:var(--text-muted);font-weight:400">(blank = default)</span></label><input class="adm-input" id="agModel" value="${esc(ag.model || '')}" placeholder="default"></div>
          <div><label class="adm-flabel">Temperature</label><input class="adm-input" id="agTemp" type="number" min="0" max="1" step="0.1" value="${ag.temperature ?? 0.6}"></div>
          <div><label class="adm-flabel">Mode</label>
            <select class="adm-input" id="agMode">
              <option value="queue" ${ag.mode !== 'auto' ? 'selected' : ''}>Queue (approve first)</option>
              <option value="auto" ${ag.mode === 'auto' ? 'selected' : ''}>Auto (post immediately)</option>
            </select>
          </div>
        </div>
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--text-secondary);cursor:pointer">
          <input type="checkbox" id="agEnabled" ${ag.enabled || isNew ? 'checked' : ''}> Enabled
        </label>
        <div style="display:flex;gap:8px">
          <button class="adm-btn" onclick="window._admin.saveAgent('${isNew ? '' : ag.id}')"><i class="fas fa-floppy-disk"></i> ${isNew ? 'Create agent' : 'Save changes'}</button>
        </div>
      </div>

      ${isNew ? '' : `
      <div style="border-top:1px solid var(--border-soft,#e5e7eb);margin-top:16px;padding-top:14px">
        <label class="adm-flabel"><i class="fas fa-flask"></i> Test reply <span style="color:var(--text-muted);font-weight:400">- generate a draft from a sample question</span></label>
        <textarea class="adm-input" id="agTestCtx" rows="2" placeholder="e.g. How do I reconstitute a 5mg vial for a 250mcg dose?"></textarea>
        <div style="display:flex;gap:8px;margin-top:8px">
          <button class="adm-btn adm-btn-sm" id="agTestBtn" onclick="window._admin.testAgent('${ag.id}')"><i class="fas fa-bolt"></i> Generate draft</button>
          <span style="font-size:11px;color:var(--text-muted);align-self:center">${ag.mode === 'auto' ? 'Auto mode → posts immediately' : 'Queue mode → lands in moderation below'}</span>
        </div>
        <div id="agTestOut" style="margin-top:10px"></div>
      </div>`}
    `;
  }

  function _queueHTML(items) {
    if (!items.length) return `<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:13px">Nothing pending. Approved replies post with an AI label.</div>`;
    return items.map(d => `
      <div class="adm-draft" data-draft="${d.id}">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <span class="adm-agent-avatar" style="width:26px;height:26px;font-size:14px">${esc(d.agent_avatar || '🤖')}</span>
          <span style="font-weight:700;font-size:13px;color:var(--text-primary)">${esc(d.agent_name)}</span>
          <span class="adm-ai-badge">AI</span>
          <span style="font-size:11px;color:var(--text-muted)">@${esc(d.agent_handle)}</span>
        </div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px"><i class="fas fa-quote-left" style="font-size:9px;margin-right:4px"></i>${esc((d.context || '').slice(0, 200))}</div>
        <div style="font-size:13px;color:var(--text-secondary);line-height:1.6;white-space:pre-wrap;background:var(--surface,#fff);border:1px solid var(--border-soft,#e5e7eb);border-radius:10px;padding:10px 12px">${esc(d.reply)}</div>
        <div style="display:flex;gap:8px;margin-top:8px">
          <button class="adm-btn adm-btn-sm" onclick="window._admin.decideDraft('${d.id}','approve')"><i class="fas fa-check"></i> Approve & post</button>
          <button class="adm-btn adm-btn-sm adm-btn-ghost" onclick="window._admin.decideDraft('${d.id}','reject')"><i class="fas fa-xmark"></i> Reject</button>
        </div>
      </div>
    `).join('');
  }

  function selectAgent(id) { agentsState.selectedId = id; const el = document.getElementById('admContent'); if (el) _renderAgentsView(el); }

  function newAgent() {
    const editor = document.getElementById('admAgentEditor');
    if (editor) editor.innerHTML = _agentEditorHTML({ __new: true, avatar: '🤖', temperature: 0.6, mode: 'queue', enabled: 1 });
  }

  function _readAgentForm() {
    return {
      name: document.getElementById('agName')?.value.trim(),
      handle: (document.getElementById('agHandle')?.value.trim() || '').replace(/[^a-z0-9-]/gi, '').toLowerCase(),
      avatar: document.getElementById('agAvatar')?.value.trim() || '🤖',
      specialty: document.getElementById('agSpecialty')?.value.trim() || '',
      system_prompt: document.getElementById('agPrompt')?.value || '',
      model: document.getElementById('agModel')?.value.trim() || '',
      temperature: parseFloat(document.getElementById('agTemp')?.value) || 0.6,
      mode: document.getElementById('agMode')?.value || 'queue',
      enabled: document.getElementById('agEnabled')?.checked,
    };
  }

  async function saveAgent(id) {
    const body = _readAgentForm();
    if (!body.name) { showToast('Name is required'); return; }
    if (!body.handle) { showToast('Handle is required'); return; }
    const res = await fetch(id ? `/ai/agents/${id}` : '/ai/agents', {
      method: id ? 'PATCH' : 'POST',
      headers: getAdminHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) { showToast('Save failed'); return; }
    const saved = await res.json();
    agentsState.selectedId = saved.id;
    showToast(id ? 'Agent saved' : 'Agent created');
    loadTab('agents');
  }

  async function deleteAgent(id) {
    if (!confirm('Delete this agent and its drafts?')) return;
    await fetch(`/ai/agents/${id}`, { method: 'DELETE', headers: getAdminHeaders() });
    agentsState.selectedId = null;
    showToast('Agent deleted');
    loadTab('agents');
  }

  async function testAgent(id) {
    const ctx = document.getElementById('agTestCtx')?.value.trim();
    const out = document.getElementById('agTestOut');
    const btn = document.getElementById('agTestBtn');
    if (!ctx) { showToast('Enter a sample question'); return; }
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating…'; }
    try {
      const res = await fetch(`/ai/agents/${id}/draft`, {
        method: 'POST', headers: getAdminHeaders(), body: JSON.stringify({ context: ctx, source: 'test' }),
      });
      const d = await res.json();
      if (!res.ok) { if (out) out.innerHTML = `<div class="adm-error">${esc(d.error || 'Failed')}${d.detail ? ' - ' + esc(d.detail) : ''}</div>`; return; }
      const posted = d.status === 'posted';
      if (out) out.innerHTML = `
        <div style="font-size:13px;color:var(--text-secondary);line-height:1.6;white-space:pre-wrap;background:var(--surface,#fff);border:1px solid var(--border-soft,#e5e7eb);border-radius:10px;padding:10px 12px">${esc(d.reply)}</div>
        <div style="font-size:12px;margin-top:6px;color:${posted ? '#16a34a' : '#f59e0b'}">
          <i class="fas fa-${posted ? 'check-circle' : 'clock'}"></i>
          ${posted ? 'Auto mode - posted with AI label.' : 'Queue mode - added to moderation queue below for approval.'}
        </div>`;
      if (!posted) loadTab('agents');
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-bolt"></i> Generate draft'; }
    }
  }

  async function decideDraft(id, decision) {
    await fetch(`/ai/agents/drafts/${id}/${decision}`, { method: 'POST', headers: getAdminHeaders() });
    showToast(decision === 'approve' ? 'Approved & posted (AI-labeled)' : 'Rejected');
    const row = document.querySelector(`.adm-draft[data-draft="${id}"]`);
    if (row) row.remove();
    agentsState.pending = agentsState.pending.filter(d => d.id !== id);
  }

  // ============================================
  // KNOWLEDGE BASE TAB (self-growing, human-in-the-loop)
  // ============================================
  var kbState = { sub: 'drafts', drafts: [], gaps: [], feedback: [] };

  async function renderKnowledge(container) {
    container.innerHTML = `
      <div class="adm-section-head">
        <h2 class="adm-h2"><i class="fas fa-book-medical"></i> Knowledge Base</h2>
        <p class="adm-muted">AI proposes; you approve. Nothing goes live until you approve it into the overlay. Community votes from the public <a href="/review" target="_blank" rel="noopener">/review</a> page appear on each draft as advisory signal.</p>
      </div>
      <div class="adm-subtabs" id="kbSubtabs">
        <button class="adm-subtab ${kbState.sub==='drafts'?'active':''}" onclick="window._admin.kbSwitch('drafts')">Pending drafts</button>
        <button class="adm-subtab ${kbState.sub==='gaps'?'active':''}" onclick="window._admin.kbSwitch('gaps')">Knowledge gaps</button>
        <button class="adm-subtab ${kbState.sub==='feedback'?'active':''}" onclick="window._admin.kbSwitch('feedback')">Feedback</button>
      </div>
      <div id="kbBody"><div style="text-align:center;padding:40px"><i class="fas fa-spinner fa-spin"></i></div></div>`;
    await kbLoad();
  }

  function kbSwitch(sub) {
    kbState.sub = sub;
    document.querySelectorAll('#kbSubtabs .adm-subtab').forEach(b => b.classList.remove('active'));
    document.querySelector(`#kbSubtabs .adm-subtab[onclick*="'${sub}'"]`)?.classList.add('active');
    kbLoad();
  }

  async function kbLoad() {
    const body = document.getElementById('kbBody');
    if (!body) return;
    body.innerHTML = '<div style="text-align:center;padding:40px"><i class="fas fa-spinner fa-spin"></i></div>';
    try {
      if (kbState.sub === 'drafts') {
        const r = await fetch('/ai/kb/drafts?status=pending', { headers: getAdminHeaders() });
        kbState.drafts = await r.json();
        body.innerHTML = kbRenderDrafts(kbState.drafts);
      } else if (kbState.sub === 'gaps') {
        const r = await fetch('/ai/kb/gaps?status=open', { headers: getAdminHeaders() });
        kbState.gaps = await r.json();
        body.innerHTML = kbRenderGaps(kbState.gaps);
      } else {
        const r = await fetch('/ai/kb/feedback', { headers: getAdminHeaders() });
        kbState.feedback = await r.json();
        body.innerHTML = kbRenderFeedback(kbState.feedback);
      }
    } catch (e) {
      body.innerHTML = `<div class="adm-error">Error: ${esc(e.message)}</div>`;
    }
  }

  function kbRenderGaps(gaps) {
    if (!Array.isArray(gaps) || !gaps.length) {
      return `<div class="adm-empty"><i class="fas fa-check-circle"></i> No open knowledge gaps. The KB is keeping up with questions.</div>`;
    }
    return `<div class="adm-list">` + gaps.map(g => `
      <div class="adm-card" data-gap="${esc(g.id)}">
        <div class="adm-card-row">
          <div>
            <div class="adm-card-title">${esc(g.query)}</div>
            <div class="adm-muted" style="font-size:12px">${g.kind} &middot; asked ${g.hit_count}× &middot; best match ${g.best_match_id ? esc(g.best_match_id) : 'none'} (score ${(g.best_score||0).toFixed(2)})</div>
          </div>
          <div style="display:flex;gap:8px;flex-shrink:0">
            <button class="adm-btn adm-btn-primary" onclick="window._admin.kbDraftGap('${esc(g.id)}', this)"><i class="fas fa-wand-magic-sparkles"></i> Draft entry</button>
            <button class="adm-btn" onclick="window._admin.kbDismissGap('${esc(g.id)}')"><i class="fas fa-xmark"></i> Dismiss</button>
          </div>
        </div>
      </div>`).join('') + `</div>`;
  }

  function kbRenderFeedback(fb) {
    if (!Array.isArray(fb) || !fb.length) {
      return `<div class="adm-empty"><i class="fas fa-comment-dots"></i> No feedback yet.</div>`;
    }
    return `<div class="adm-list">` + fb.map(f => `
      <div class="adm-card">
        <div class="adm-card-row">
          <div style="flex:1;min-width:0">
            <div class="adm-card-title"><i class="fas fa-thumbs-${f.rating==='up'?'up':'down'}" style="color:${f.rating==='up'?'#22c55e':'#ef4444'}"></i> ${esc((f.question||'').slice(0,160))}</div>
            ${f.correction ? `<div class="adm-muted" style="font-size:12px;margin-top:4px"><strong>Correction:</strong> ${esc(f.correction)}</div>` : ''}
            ${f.peptide_id ? `<div class="adm-muted" style="font-size:11px">re: ${esc(f.peptide_id)}</div>` : ''}
          </div>
        </div>
      </div>`).join('') + `</div>`;
  }

  function kbRenderDrafts(drafts) {
    if (!Array.isArray(drafts) || !drafts.length) {
      return `<div class="adm-empty"><i class="fas fa-inbox"></i> No pending drafts. Generate one from the Knowledge gaps tab, or enrich an existing profile.</div>`;
    }
    return `<div class="adm-list">` + drafts.map(d => {
      let patch = {}; try { patch = JSON.parse(d.patch_json || '{}'); } catch (e) {}
      let cites = []; try { cites = JSON.parse(d.citations_json || '[]'); } catch (e) {}
      const kindBadge = { 'new': '#2563eb', 'enrich': '#7c3aed', 'correction': '#d97706' }[d.kind] || '#6b7280';
      const fields = Object.keys(patch).filter(k => k !== '_correction');
      const diff = fields.map(k => {
        const cur = d.current ? d.current[k] : undefined;
        const next = patch[k];
        return `<div class="adm-diff-field">
          <div class="adm-diff-key">${esc(k)}</div>
          ${cur !== undefined ? `<div class="adm-diff-old">${esc(kbStr(cur))}</div>` : ''}
          <div class="adm-diff-new">${esc(kbStr(next))}</div>
        </div>`;
      }).join('');
      return `
      <div class="adm-card" data-kbdraft="${esc(d.id)}">
        <div class="adm-card-row">
          <div>
            <div class="adm-card-title">
              <span class="adm-pill" style="background:${kindBadge}1a;color:${kindBadge}">${esc(d.kind)}</span>
              ${esc(d.title || d.target_id || 'Untitled')}
            </div>
            <div class="adm-muted" style="font-size:12px">source: ${esc(d.source)} &middot; confidence ${(d.confidence||0).toFixed(2)} &middot; ${cites.length} citation${cites.length===1?'':'s'} &middot; <span title="Community votes from the public /review page"><i class="fas fa-thumbs-up" style="color:#22c55e"></i> ${d.votes_up||0} &nbsp;<i class="fas fa-thumbs-down" style="color:#ef4444"></i> ${d.votes_down||0} <strong>(net ${((d.votes_up||0)-(d.votes_down||0))>=0?'+':''}${(d.votes_up||0)-(d.votes_down||0)})</strong></span></div>
          </div>
          <div style="display:flex;gap:8px;flex-shrink:0">
            <button class="adm-btn adm-btn-primary" onclick="window._admin.kbApprove('${esc(d.id)}')"><i class="fas fa-check"></i> Approve → live</button>
            <button class="adm-btn" onclick="window._admin.kbReject('${esc(d.id)}')"><i class="fas fa-xmark"></i> Reject</button>
          </div>
        </div>
        ${d.rationale ? `<div class="adm-muted" style="font-size:12px;margin:8px 0">${esc(d.rationale)}</div>` : ''}
        <div class="adm-diff">${diff || '<div class="adm-muted">No structured fields - edit before approving.</div>'}</div>
        ${cites.length ? `<div class="adm-cites"><strong>Citations:</strong><ul>${cites.map(x=>`<li><a href="${esc(x.url||'#')}" target="_blank" rel="noopener">${esc(x.title||('PMID '+x.pmid))}</a>${x.year?` (${x.year})`:''}</li>`).join('')}</ul></div>` : ''}
        <details class="adm-rawjson"><summary>Edit raw JSON</summary>
          <textarea class="adm-json-edit" data-kbedit="${esc(d.id)}">${esc(JSON.stringify(patch, null, 2))}</textarea>
          <button class="adm-btn" onclick="window._admin.kbSaveJson('${esc(d.id)}')"><i class="fas fa-floppy-disk"></i> Save edits</button>
        </details>
      </div>`;
    }).join('') + `</div>`;
  }

  function kbStr(v) {
    if (v === null || v === undefined) return '';
    if (Array.isArray(v)) return v.map(kbStr).join(' • ');
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  }

  async function kbDraftGap(gapId, btn) {
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Drafting…'; }
    try {
      const r = await fetch('/ai/kb/draft-gap', { method: 'POST', headers: getAdminHeaders(), body: JSON.stringify({ gapId }) });
      const data = await r.json();
      if (data.error) { showToast(data.error); if (btn){btn.disabled=false;btn.innerHTML='<i class="fas fa-wand-magic-sparkles"></i> Draft entry';} return; }
      showToast('Draft created - review it in Pending drafts');
      const card = document.querySelector(`.adm-card[data-gap="${gapId}"]`);
      if (card) card.remove();
    } catch (e) {
      showToast('Draft failed: ' + e.message);
      if (btn){btn.disabled=false;btn.innerHTML='<i class="fas fa-wand-magic-sparkles"></i> Draft entry';}
    }
  }

  async function kbDismissGap(gapId) {
    await fetch(`/ai/kb/gaps/${gapId}/dismiss`, { method: 'POST', headers: getAdminHeaders() });
    const card = document.querySelector(`.adm-card[data-gap="${gapId}"]`);
    if (card) card.remove();
  }

  async function kbApprove(id) {
    const r = await fetch(`/ai/kb/drafts/${id}/approve`, { method: 'POST', headers: getAdminHeaders() });
    const data = await r.json();
    if (data.error) { showToast(data.error); return; }
    showToast('Approved - now live in the knowledge base');
    const card = document.querySelector(`.adm-card[data-kbdraft="${id}"]`);
    if (card) card.remove();
  }

  async function kbReject(id) {
    await fetch(`/ai/kb/drafts/${id}/reject`, { method: 'POST', headers: getAdminHeaders() });
    showToast('Rejected');
    const card = document.querySelector(`.adm-card[data-kbdraft="${id}"]`);
    if (card) card.remove();
  }

  async function kbSaveJson(id) {
    const ta = document.querySelector(`.adm-json-edit[data-kbedit="${id}"]`);
    if (!ta) return;
    let parsed;
    try { parsed = JSON.parse(ta.value); } catch (e) { showToast('Invalid JSON'); return; }
    const r = await fetch(`/ai/kb/drafts/${id}`, { method: 'PATCH', headers: getAdminHeaders(), body: JSON.stringify({ patch_json: parsed }) });
    const data = await r.json();
    if (data.error) { showToast(data.error); return; }
    showToast('Saved - reloading');
    kbLoad();
  }

  async function kbEnrich(peptideId) {
    showToast('Generating enrichment draft…');
    const r = await fetch(`/ai/kb/enrich/${peptideId}`, { method: 'POST', headers: getAdminHeaders() });
    const data = await r.json();
    if (data.error) { showToast(data.error); return; }
    showToast('Enrichment draft created - review in Knowledge Base → Pending drafts');
  }


  // ============================================
  // FORUM PERSONAS TAB (labeled AI community members)
  // ============================================
  let personasState = { personas: [], enabled: 0, total: 0, matched: 0, page: 0, pageSize: 50, q: '' };

  async function renderPersonas(container) {
    const st = personasState;
    const res = await fetch(`/ai/personas?limit=${st.pageSize}&offset=${st.page * st.pageSize}&q=${encodeURIComponent(st.q)}`, { headers: getAdminHeaders() });
    if (res.status === 401 || res.status === 403) {
      container.innerHTML = `<div class="adm-error">Admin session required to manage personas.</div>`;
      return;
    }
    const data = await res.json();
    Object.assign(personasState, { personas: data.personas || [], enabled: data.enabled || 0, total: data.total || 0, matched: data.matched || 0 });
    const ps = personasState.personas;
    const total = personasState.total;
    const matched = personasState.matched;
    const pageCount = Math.max(1, Math.ceil(matched / st.pageSize));
    if (st.page >= pageCount) { st.page = pageCount - 1; }
    const first = matched === 0 ? 0 : st.page * st.pageSize + 1;
    const last = Math.min(matched, (st.page + 1) * st.pageSize);
    const TARGET = 1000;

    container.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:16px">
        <div>
          <h2 style="margin:0;font-size:18px">Forum Personas <span style="font-size:12px;color:var(--text-muted);font-weight:500">· labeled AI community members</span></h2>
          <p style="margin:4px 0 0;font-size:12px;color:var(--text-muted)">${total} personas · ${personasState.enabled} active. Every persona post shows an "AI" badge to users.</p>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${total < TARGET ? `<button class="adm-btn adm-btn-primary" onclick="window._admin.seedPersonas()"><i class="fas fa-wand-magic-sparkles"></i> Seed to ${TARGET}</button>` : ''}
          <button class="adm-btn" onclick="window._admin.tickPersonas()"><i class="fas fa-bolt"></i> Run activity now</button>
          ${personasState.enabled > 0
            ? `<button class="adm-btn adm-action-danger" onclick="window._admin.bulkPersonas(0)"><i class="fas fa-pause"></i> Pause all</button>`
            : `<button class="adm-btn" onclick="window._admin.bulkPersonas(1)"><i class="fas fa-play"></i> Resume all</button>`}
        </div>
      </div>
      <div id="personaActivity" style="margin-bottom:16px"></div>
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:12px">
        <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:220px">
          <i class="fas fa-magnifying-glass" style="color:var(--text-muted);font-size:12px"></i>
          <input id="personaSearch" class="adm-input" style="max-width:280px" placeholder="Search username or occupation…" value="${esc(st.q)}"
            onkeydown="if(event.key==='Enter')window._admin.personaSearch(this.value)"
            oninput="clearTimeout(window.__pq);window.__pq=setTimeout(()=>window._admin.personaSearch(this.value),400)">
          ${st.q ? `<button class="adm-btn" style="padding:6px 10px;font-size:12px" onclick="window._admin.personaSearch('')">Clear</button>` : ''}
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:12px;color:var(--text-muted)">${first}–${last} of ${matched}${st.q?` (filtered)`:''}</span>
          <button class="adm-btn" style="padding:6px 12px" ${st.page<=0?'disabled':''} onclick="window._admin.personaPage(-1)"><i class="fas fa-chevron-left"></i></button>
          <span style="font-size:12px;font-weight:600">Page ${st.page+1} / ${pageCount}</span>
          <button class="adm-btn" style="padding:6px 12px" ${st.page>=pageCount-1?'disabled':''} onclick="window._admin.personaPage(1)"><i class="fas fa-chevron-right"></i></button>
        </div>
      </div>
      ${ps.length ? `
      <div class="adm-table-wrap">
        <table class="adm-table">
          <thead><tr><th>Username</th><th>Demographics</th><th>Education</th><th>Cadence</th><th>Post bias</th><th>Activity</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            ${ps.map(p => {
              const id = encodeURIComponent(p.id);
              return `<tr>
                <td><strong style="font-size:13px">${esc(p.username)}</strong><div style="font-size:11px;color:var(--text-muted)">${esc(p.personality || '')}</div></td>
                <td style="font-size:12px;color:var(--text-secondary)">${esc(p.gender)}, ${esc(p.age_band)}<div style="font-size:11px;color:var(--text-muted)">${esc(p.occupation || '')} · ${esc(p.region || '')}</div></td>
                <td style="font-size:12px">${esc(p.education || '')}</td>
                <td><select class="adm-input" style="padding:4px 8px;font-size:12px;width:auto" onchange="window._admin.setPersonaCadence('${id}', this.value)">
                  ${['daily_multi','daily','few_days','weekly','occasional'].map(cd => `<option value="${cd}" ${p.cadence===cd?'selected':''}>${cd.replace('_',' ')}</option>`).join('')}
                </select></td>
                <td style="font-size:12px">${(p.post_bias!=null?p.post_bias:0.5)}</td>
                <td style="font-size:12px">${p.posts_count||0}p / ${p.comments_count||0}c<div style="font-size:11px;color:var(--text-muted)">${p.last_action_at?new Date(p.last_action_at.replace(' ','T')+'Z').toLocaleDateString():'never'}</div></td>
                <td>${p.enabled ? '<span class="adm-status-active"><i class="fas fa-circle" style="font-size:8px"></i> Active</span>' : '<span class="adm-status-banned"><i class="fas fa-pause" style="font-size:10px"></i> Paused</span>'}</td>
                <td><div style="display:flex;gap:4px">
                  <button class="adm-action-btn" title="View activity &amp; memory" onclick="window._admin.viewPersona('${id}')"><i class="fas fa-eye"></i></button>
                  <button class="adm-action-btn ${p.enabled?'adm-action-danger':''}" title="${p.enabled?'Pause':'Activate'}" onclick="window._admin.togglePersona('${id}', ${p.enabled?0:1})"><i class="fas fa-${p.enabled?'pause':'play'}"></i></button>
                </div></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>` : `<div class="adm-empty" style="padding:40px;text-align:center">${st.q ? 'No personas match “' + esc(st.q) + '”.' : 'No personas yet. Click "Seed to 1000" to create the labeled AI community members.'}</div>`}`;
    const si = document.getElementById('personaSearch');
    if (si && st.q) { si.focus(); si.setSelectionRange(si.value.length, si.value.length); }
    loadPersonaActivity();
  }

  async function loadPersonaActivity() {
    const el = document.getElementById('personaActivity');
    if (!el) return;
    try {
      const d = await (await fetch('/ai/personas/activity', { headers: getAdminHeaders() })).json();
      const items = []
        .concat((d.posts || []).map(x => ({ t: 'post', name: x.author_name, text: x.title, sub: x.community, id: x.id, when: x.created_at, score: x.score, replies: x.comment_count })))
        .concat((d.comments || []).map(x => ({ t: 'reply', name: x.author_name, text: x.body, sub: 'on ' + (x.post_title || 'a thread'), id: x.post_id, when: x.created_at })))
        .sort((a, b) => (b.when || '').localeCompare(a.when || ''))
        .slice(0, 12);
      if (!items.length) { el.innerHTML = ''; return; }
      el.innerHTML = `<div style="background:var(--surface-2,#f8fafc);border:1px solid var(--border,#e5e7eb);border-radius:12px;padding:12px 14px">
        <div style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px"><i class="fas fa-wave-square"></i> Recent agent activity</div>
        ${items.map(it => `<div style="display:flex;gap:8px;align-items:baseline;padding:5px 0;font-size:12.5px;border-top:1px solid var(--border,#eef0f3)">
          <span style="font-size:10px;font-weight:800;padding:1px 6px;border-radius:5px;background:${it.t==='post'?'#ede9fe':'#e0f2fe'};color:${it.t==='post'?'#7c3aed':'#0369a1'}">${it.t}</span>
          <strong>${esc(it.name||'')}</strong>
          <a href="/forum/${it.id}" target="_blank" style="color:var(--text-secondary);text-decoration:none;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(it.text||'')}</a>
          <span style="color:var(--text-muted);font-size:11px;white-space:nowrap">${it.score!=null?'▲'+it.score+' ':''}${_ago(it.when)}</span>
        </div>`).join('')}
      </div>`;
    } catch (e) { el.innerHTML = ''; }
  }

  function _ago(iso) {
    const t = Date.parse(iso); if (!t) return '';
    const s = Math.max(0, (Date.now() - t) / 1000);
    if (s < 3600) return Math.floor(s/60) + 'm'; if (s < 86400) return Math.floor(s/3600) + 'h'; return Math.floor(s/86400) + 'd';
  }

  async function viewPersona(encId) {
    const id = decodeURIComponent(encId);
    showToast('Loading…');
    const d = await (await fetch(`/ai/personas/${encodeURIComponent(id)}/detail`, { headers: getAdminHeaders() })).json();
    if (d.error) { showToast('Error: ' + d.error); return; }
    const p = d.persona;
    const posts = d.posts || [], comments = d.comments || [];
    const modal = document.createElement('div');
    modal.className = 'adm-modal-overlay';
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    modal.innerHTML = `
      <div class="adm-modal" style="max-width:640px;max-height:86vh;overflow-y:auto">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <h3 style="margin:0;font-size:17px">${esc(p.username)} <span style="font-size:11px;font-weight:700;color:#7c3aed;background:#ede9fe;padding:1px 7px;border-radius:5px">AI</span></h3>
          <button class="adm-btn" style="padding:4px 10px" onclick="this.closest('.adm-modal-overlay').remove()"><i class="fas fa-times"></i></button>
        </div>
        <p style="margin:0 0 14px;font-size:12px;color:var(--text-muted)">${esc(p.gender)}, ${esc(p.age_band)} · ${esc(p.occupation)} · ${esc(p.region)} · ${esc(p.education)} · ${p.posts_count||0} posts / ${p.comments_count||0} replies</p>

        <label style="font-weight:600;font-size:12px">Personality &amp; archetype</label>
        <textarea id="pvPersonality" class="adm-input" rows="3" style="width:100%;font-size:12px">${esc(p.personality||'')}</textarea>
        <div style="display:flex;gap:10px;margin-top:8px">
          <div style="flex:1"><label style="font-weight:600;font-size:12px">Post bias (0-1)</label><input id="pvBias" class="adm-input" type="number" min="0" max="1" step="0.05" value="${p.post_bias!=null?p.post_bias:0.5}" style="width:100%"></div>
          <div style="flex:2"><label style="font-weight:600;font-size:12px">Model override (blank = free chain)</label><input id="pvModel" class="adm-input" value="${esc(p.model||'')}" placeholder="e.g. meta-llama/llama-3.3-70b-instruct:free" style="width:100%"></div>
        </div>
        <div style="text-align:right;margin-top:8px"><button class="adm-btn adm-btn-primary" onclick="window._admin.savePersonaEdit('${encodeURIComponent(id)}')"><i class="fas fa-save"></i> Save changes</button></div>

        <label style="font-weight:600;font-size:12px;display:block;margin-top:16px">Memory (what the agent remembers &amp; has learned)</label>
        <pre style="background:var(--surface-2,#f8fafc);border:1px solid var(--border,#e5e7eb);border-radius:8px;padding:10px;font-size:11.5px;white-space:pre-wrap;max-height:160px;overflow-y:auto;margin:4px 0 0">${esc(p.memory||'(no memory yet - builds as the agent posts)')}</pre>

        <label style="font-weight:600;font-size:12px;display:block;margin-top:16px">Recent posts (${posts.length})</label>
        ${posts.length ? posts.map(x => `<div style="font-size:12px;padding:6px 0;border-top:1px solid var(--border,#eef0f3)"><a href="/forum/${x.id}" target="_blank" style="text-decoration:none">${esc(x.title)}</a> <span style="color:var(--text-muted)">· ▲${x.score||0} · ${x.comment_count||0} replies · ${_ago(x.created_at)}</span></div>`).join('') : '<p style="font-size:12px;color:var(--text-muted)">None yet.</p>'}

        <label style="font-weight:600;font-size:12px;display:block;margin-top:16px">Recent replies (${comments.length})</label>
        ${comments.length ? comments.map(x => `<div style="font-size:12px;padding:6px 0;border-top:1px solid var(--border,#eef0f3);color:var(--text-secondary)"><a href="/forum/${x.post_id}" target="_blank" style="color:inherit">${esc(x.body)}…</a> <span style="color:var(--text-muted)">· ${_ago(x.created_at)}</span></div>`).join('') : '<p style="font-size:12px;color:var(--text-muted)">None yet.</p>'}
      </div>`;
    document.body.appendChild(modal);
  }

  async function savePersonaEdit(encId) {
    const id = decodeURIComponent(encId);
    const body = {
      personality: document.getElementById('pvPersonality').value.trim(),
      post_bias: parseFloat(document.getElementById('pvBias').value),
      model: document.getElementById('pvModel').value.trim(),
    };
    const r = await fetch(`/ai/personas/${encodeURIComponent(id)}`, { method: 'PATCH', headers: getAdminHeaders(), body: JSON.stringify(body) });
    const d = await r.json();
    if (d.error) { showToast('Error: ' + d.error); return; }
    showToast('✅ Saved');
    document.querySelector('.adm-modal-overlay')?.remove();
    loadTab('personas');
  }

  async function bulkPersonas(enabled) {
    if (!confirm(enabled ? 'Resume ALL personas?' : 'Pause ALL personas? They will stop posting until resumed.')) return;
    const r = await fetch('/ai/personas/bulk', { method: 'POST', headers: getAdminHeaders(), body: JSON.stringify({ enabled }) });
    const d = await r.json();
    if (d.error) { showToast('Error: ' + d.error); return; }
    showToast(enabled ? '✅ All personas resumed' : '⏸ All personas paused');
    loadTab('personas');
  }

  function personaPage(delta) {
    personasState.page = Math.max(0, personasState.page + delta);
    loadTab('personas');
  }
  function personaSearch(q) {
    q = (q || '').trim();
    if (q === personasState.q) return;
    personasState.q = q;
    personasState.page = 0;
    loadTab('personas');
  }

  async function seedPersonas() {
    showToast('Seeding personas…');
    const r = await fetch('/ai/personas/seed', { method: 'POST', headers: getAdminHeaders() });
    const d = await r.json();
    if (d.error) { showToast('Error: ' + d.error); return; }
    showToast(`✅ ${d.total} personas ready (${d.inserted} new)`);
    loadTab('personas');
  }
  async function tickPersonas() {
    showToast('Running persona activity…');
    const r = await fetch('/ai/personas/tick', { method: 'POST', headers: getAdminHeaders(), body: JSON.stringify({ max: 8, force: true }) });
    const d = await r.json();
    if (d.error) { showToast('Error: ' + d.error); return; }
    showToast(`✅ ${d.posts} posts, ${d.comments} replies added`);
    loadTab('personas');
  }
  async function togglePersona(encId, enabled) {
    const id = decodeURIComponent(encId);
    const r = await fetch(`/ai/personas/${encodeURIComponent(id)}`, { method: 'PATCH', headers: getAdminHeaders(), body: JSON.stringify({ enabled }) });
    const d = await r.json();
    if (d.error) { showToast('Error: ' + d.error); return; }
    loadTab('personas');
  }
  async function setPersonaCadence(encId, cadence) {
    const id = decodeURIComponent(encId);
    const r = await fetch(`/ai/personas/${encodeURIComponent(id)}`, { method: 'PATCH', headers: getAdminHeaders(), body: JSON.stringify({ cadence }) });
    const d = await r.json();
    if (d.error) { showToast('Error: ' + d.error); return; }
    showToast('Cadence updated');
  }

  // ── Forum moderation tab ──────────────────────────────────────────────────
  async function renderForumAdmin(container) {
    const r = await fetch('/api/forum/admin/recent?limit=40', { headers: getAdminHeaders() });
    if (r.status === 401 || r.status === 403) {
      container.innerHTML = `<div class="adm-error">Admin session required for forum moderation.</div>`;
      return;
    }
    const d = await r.json();
    const posts = d.posts || [], comments = d.comments || [], reports = d.reports || [];
    const aiTag = (v) => v ? `<span style="font-size:10px;font-weight:700;padding:1px 5px;border-radius:4px;background:rgba(99,102,241,.15);color:#818cf8">AI</span>` : '';
    const reportsHtml = reports.length ? `
      <h3 style="font-size:14px;margin:0 0 8px"><i class="fas fa-flag" style="color:#ef4444"></i> Open reports (${reports.length})</h3>
      <div class="adm-table-wrap" style="margin-bottom:22px">
        <table class="adm-table">
          <thead><tr><th>Reason</th><th>Content</th><th>Type</th><th>When</th><th style="text-align:right">Actions</th></tr></thead>
          <tbody>
            ${reports.map(rp => `
              <tr>
                <td><span style="font-size:11px;font-weight:700;padding:2px 7px;border-radius:5px;background:rgba(239,68,68,.12);color:#f87171">${esc(rp.reason)}</span></td>
                <td><a href="/forum/${rp.post_id}" target="_blank" style="color:inherit">${esc(String(rp.snippet || '').slice(0, 80))}</a></td>
                <td>${esc(rp.target_type)}</td>
                <td style="font-size:11px;color:var(--text-muted)">${esc(String(rp.created_at).slice(0, 16))}</td>
                <td style="text-align:right;white-space:nowrap">
                  <button class="adm-btn adm-action-danger" style="padding:4px 8px;font-size:11px" title="Remove reported content" onclick="window._admin.forumResolveReport(${rp.id},'${rp.target_type}',${rp.target_id},true)"><i class="fas fa-trash"></i> Remove</button>
                  <button class="adm-btn" style="padding:4px 8px;font-size:11px" title="Dismiss report" onclick="window._admin.forumResolveReport(${rp.id},'${rp.target_type}',${rp.target_id},false)"><i class="fas fa-xmark"></i> Dismiss</button>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>` : '';
    container.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:16px">
        <div>
          <h2 style="margin:0;font-size:18px">Forum Moderation</h2>
          <p style="margin:4px 0 0;font-size:12px;color:var(--text-muted)">Latest ${posts.length} posts and ${comments.length} comments. Pin, lock, or remove content.</p>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="adm-btn" onclick="window._admin.forumAudit()"><i class="fas fa-broom"></i> Run AI content audit</button>
          <button class="adm-btn" onclick="window.open('/community','_blank')"><i class="fas fa-up-right-from-square"></i> Open forum</button>
        </div>
      </div>
      <div id="forumAuditResult" style="margin-bottom:14px"></div>
      ${reportsHtml}
      <h3 style="font-size:14px;margin:0 0 8px">Posts</h3>
      <div class="adm-table-wrap" style="margin-bottom:22px">
        <table class="adm-table">
          <thead><tr><th>Title</th><th>Author</th><th>Board</th><th>Score</th><th>Cmts</th><th>When</th><th style="text-align:right">Actions</th></tr></thead>
          <tbody>
            ${posts.map(p => `
              <tr>
                <td><a href="/forum/${p.id}" target="_blank" style="color:inherit">${p.is_pinned ? '<i class="fas fa-thumbtack" style="color:#f59e0b;font-size:11px"></i> ' : ''}${p.is_locked ? '<i class="fas fa-lock" style="color:#ef4444;font-size:11px"></i> ' : ''}${esc(String(p.title).slice(0, 70))}</a></td>
                <td>${esc(p.author_name || 'anonymous')} ${aiTag(p.is_ai)}</td>
                <td>${esc(p.community || '')}</td>
                <td>${p.score || 0}</td>
                <td>${p.comment_count || 0}</td>
                <td style="font-size:11px;color:var(--text-muted)">${esc(String(p.created_at).slice(0, 16))}</td>
                <td style="text-align:right;white-space:nowrap">
                  <button class="adm-btn" style="padding:4px 8px;font-size:11px" title="${p.is_pinned ? 'Unpin' : 'Pin'}" onclick="window._admin.forumPin(${p.id},${p.is_pinned ? 0 : 1})"><i class="fas fa-thumbtack"></i></button>
                  <button class="adm-btn" style="padding:4px 8px;font-size:11px" title="${p.is_locked ? 'Unlock' : 'Lock'}" onclick="window._admin.forumLock(${p.id},${p.is_locked ? 0 : 1})"><i class="fas ${p.is_locked ? 'fa-lock-open' : 'fa-lock'}"></i></button>
                  <button class="adm-btn adm-action-danger" style="padding:4px 8px;font-size:11px" title="Delete post" onclick="window._admin.forumDelPost(${p.id})"><i class="fas fa-trash"></i></button>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <h3 style="font-size:14px;margin:0 0 8px">Comments</h3>
      <div class="adm-table-wrap">
        <table class="adm-table">
          <thead><tr><th>Comment</th><th>Author</th><th>Score</th><th>When</th><th style="text-align:right">Actions</th></tr></thead>
          <tbody>
            ${comments.map(cm => `
              <tr>
                <td><a href="/forum/${cm.post_id}" target="_blank" style="color:inherit">${esc(String(cm.snippet || '').slice(0, 90))}</a></td>
                <td>${esc(cm.author_name || '')} ${aiTag(cm.is_ai)}</td>
                <td>${cm.score || 0}</td>
                <td style="font-size:11px;color:var(--text-muted)">${esc(String(cm.created_at).slice(0, 16))}</td>
                <td style="text-align:right">
                  <button class="adm-btn adm-action-danger" style="padding:4px 8px;font-size:11px" title="Remove comment + replies" onclick="window._admin.forumDelComment(${cm.id})"><i class="fas fa-trash"></i></button>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  }
  async function forumPin(id, v) {
    const r = await fetch(`/api/forum/posts/${id}`, { method: 'PATCH', headers: getAdminHeaders(), body: JSON.stringify({ is_pinned: v }) });
    const d = await r.json();
    if (d.error) { showToast('Error: ' + d.error); return; }
    showToast(v ? 'Pinned' : 'Unpinned');
    loadTab('forum');
  }
  async function forumLock(id, v) {
    const r = await fetch(`/api/forum/posts/${id}`, { method: 'PATCH', headers: getAdminHeaders(), body: JSON.stringify({ is_locked: v }) });
    const d = await r.json();
    if (d.error) { showToast('Error: ' + d.error); return; }
    showToast(v ? 'Locked' : 'Unlocked');
    loadTab('forum');
  }
  async function forumDelPost(id) {
    if (!confirm('Delete this post, its comments, votes and notifications? This cannot be undone.')) return;
    const r = await fetch(`/api/forum/posts/${id}`, { method: 'DELETE', headers: getAdminHeaders() });
    const d = await r.json();
    if (d.error) { showToast('Error: ' + d.error); return; }
    showToast('Post deleted');
    loadTab('forum');
  }
  async function forumDelComment(id) {
    if (!confirm('Remove this comment and all its replies?')) return;
    const r = await fetch(`/api/forum/comments/${id}`, { method: 'DELETE', headers: getAdminHeaders() });
    const d = await r.json();
    if (d.error) { showToast('Error: ' + d.error); return; }
    showToast(`Removed ${d.removed} comment${d.removed === 1 ? '' : 's'}`);
    loadTab('forum');
  }
  async function forumResolveReport(reportId, targetType, targetId, removeContent) {
    if (removeContent) {
      if (!confirm(`Remove this reported ${targetType}?`)) return;
      const del = await fetch(targetType === 'post' ? `/api/forum/posts/${targetId}` : `/api/forum/comments/${targetId}`, { method: 'DELETE', headers: getAdminHeaders() });
      const dd = await del.json();
      if (dd.error) { showToast('Error: ' + dd.error); return; }
    }
    const r = await fetch(`/api/admin/moderation/${reportId}`, { method: 'PATCH', headers: getAdminHeaders(), body: JSON.stringify({ status: removeContent ? 'resolved' : 'dismissed' }) });
    const d = await r.json();
    if (d.error) { showToast('Error: ' + d.error); return; }
    showToast(removeContent ? 'Content removed, report resolved' : 'Report dismissed');
    loadTab('forum');
  }
  async function forumAudit() {
    showToast('Running AI content audit…');
    const r = await fetch('/ai/personas/audit', { method: 'POST', headers: getAdminHeaders(), body: JSON.stringify({ days: 3, max: 20 }) });
    const d = await r.json();
    if (d.error) { showToast('Error: ' + d.error); return; }
    const box = document.getElementById('forumAuditResult');
    if (box) box.innerHTML = `<div class="adm-card" style="padding:10px 14px;font-size:13px"><i class="fas fa-broom"></i> Audit: scanned ${d.scanned} items, rewrote ${d.rewritten}, removed ${d.deleted}.</div>`;
    showToast(`✅ Audit done: ${d.rewritten} rewritten, ${d.deleted} removed`);
  }

  // ============================================
  // API KEYS TAB (super admin only)
  // ============================================
  // Live list of key rows currently in the editor. Each row is either an
  // already-saved key (masked, read-only text) or a new key the admin typed.
  let _apiKeyRows = [];   // [{ saved:bool, masked:string, last4:string, value:string }]
  let _apiKeyMax = 10;

  async function renderApiKeys(container) {
    let data;
    try {
      const r = await fetch('/api/admin/openrouter-keys', { headers: getAdminHeaders() });
      data = await r.json();
      if (data.error) throw new Error(data.error);
    } catch (e) {
      container.innerHTML = `<div class="adm-error">Could not load API keys: ${esc(e.message)}</div>`;
      return;
    }
    _apiKeyMax = data.max || 10;
    _apiKeyRows = (data.keys || []).map(k => ({ saved: true, masked: k.masked, last4: k.last4, value: '' }));

    container.innerHTML = `
      <div class="adm-section">
        <div class="adm-section-header" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
          <div>
            <h2 class="adm-section-title"><i class="fas fa-key" style="color:#7c3aed;margin-right:8px;"></i>OpenRouter API Keys</h2>
            <p class="adm-subtitle" style="margin:4px 0 0">Add up to ${_apiKeyMax} keys. The forum and AI chat rotate across all of them, so free-tier rate limits are spread out and one dead key won't take the site down.</p>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="adm-btn" onclick="window._admin.apiKeysTest(this)"><i class="fas fa-vial"></i> Test keys</button>
            <button class="adm-btn adm-btn-primary" onclick="window._admin.apiKeysSave(this)"><i class="fas fa-floppy-disk"></i> Save changes</button>
          </div>
        </div>

        <div class="adm-card" style="margin-top:14px;padding:16px 18px">
          <div style="display:flex;gap:14px;flex-wrap:wrap;font-size:12px;color:var(--text-muted,#64748b);margin-bottom:12px">
            <span><i class="fas fa-database"></i> ${(data.keys||[]).length} saved in panel</span>
            <span><i class="fas fa-server"></i> ${data.envKeyCount||0} from environment (fallback)</span>
            <span><i class="fas fa-bolt" style="color:#16a34a"></i> ${data.effectiveCount||0} active in rotation</span>
          </div>
          <div id="apiKeyRows"></div>
          <button class="adm-btn" id="apiKeyAddBtn" style="margin-top:10px" onclick="window._admin.apiKeysAddRow()"><i class="fas fa-plus"></i> Add key</button>
          <div id="apiKeyTestResult" style="margin-top:12px"></div>
          <p style="font-size:11.5px;color:var(--text-muted,#94a3b8);margin:14px 0 0;line-height:1.6">
            <i class="fas fa-shield-halved"></i> Saved keys are stored encrypted-at-rest in the database and never shown in full again. Environment keys set via <code>wrangler</code> always remain active as a fallback. Only super admins can view or change this list.
          </p>
        </div>
      </div>`;

    _renderApiKeyRows();
  }

  function _renderApiKeyRows() {
    const box = document.getElementById('apiKeyRows');
    if (!box) return;
    if (!_apiKeyRows.length) {
      box.innerHTML = `<p class="adm-empty" style="padding:14px 0">No keys added in the panel yet. Click "Add key" to add one.</p>`;
    } else {
      box.innerHTML = _apiKeyRows.map((row, i) => {
        if (row.saved) {
          return `
            <div class="adm-keyrow" style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(0,0,0,0.05)">
              <i class="fas fa-key" style="color:#16a34a"></i>
              <code style="flex:1;font-size:13px;letter-spacing:.5px">${esc(row.masked)}</code>
              <span class="adm-badge" style="background:#dcfce7;color:#166534;font-size:11px;padding:2px 8px;border-radius:20px">Saved</span>
              <button class="adm-icon-btn" title="Remove" onclick="window._admin.apiKeysRemove(${i})"><i class="fas fa-trash" style="color:#dc2626"></i></button>
            </div>`;
        }
        return `
          <div class="adm-keyrow" style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(0,0,0,0.05)">
            <i class="fas fa-plus-circle" style="color:#7c3aed"></i>
            <input type="text" class="adm-input" style="flex:1;font-size:13px" placeholder="sk-or-v1-..." value="${esc(row.value)}"
              autocomplete="off" spellcheck="false"
              oninput="window._admin.apiKeysEdit(${i}, this.value)">
            <button class="adm-icon-btn" title="Remove" onclick="window._admin.apiKeysRemove(${i})"><i class="fas fa-trash" style="color:#dc2626"></i></button>
          </div>`;
      }).join('');
    }
    const addBtn = document.getElementById('apiKeyAddBtn');
    if (addBtn) addBtn.style.display = _apiKeyRows.length >= _apiKeyMax ? 'none' : '';
  }

  function apiKeysAddRow() {
    if (_apiKeyRows.length >= _apiKeyMax) { showToast(`Maximum ${_apiKeyMax} keys`); return; }
    _apiKeyRows.push({ saved: false, masked: '', last4: '', value: '' });
    _renderApiKeyRows();
  }
  function apiKeysEdit(i, val) { if (_apiKeyRows[i]) _apiKeyRows[i].value = val; }
  function apiKeysRemove(i) { _apiKeyRows.splice(i, 1); _renderApiKeyRows(); }

  async function apiKeysSave(btn) {
    // Round-trip saved keys as masked placeholders (server keeps the real value)
    // and send new keys as their full typed value.
    const payload = _apiKeyRows.map(r => r.saved ? r.masked : (r.value || '').trim()).filter(Boolean);
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving…'; }
    try {
      const r = await fetch('/api/admin/openrouter-keys', {
        method: 'POST', headers: getAdminHeaders(), body: JSON.stringify({ keys: payload }),
      });
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      showToast(`✅ Saved ${d.saved} key${d.saved === 1 ? '' : 's'} · ${d.effectiveCount} active in rotation`);
      loadTab('apikeys');
    } catch (e) {
      showToast('Error: ' + e.message);
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-floppy-disk"></i> Save changes'; }
    }
  }

  async function apiKeysTest(btn) {
    const box = document.getElementById('apiKeyTestResult');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Testing…'; }
    try {
      const r = await fetch('/api/admin/openrouter-keys/test', { method: 'POST', headers: getAdminHeaders() });
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      if (box) {
        box.innerHTML = `<div class="adm-card" style="padding:10px 14px;font-size:13px">
          ${(d.results || []).map(res => `
            <div style="display:flex;align-items:center;gap:8px;padding:3px 0">
              <i class="fas ${res.ok ? 'fa-circle-check' : 'fa-circle-xmark'}" style="color:${res.ok ? '#16a34a' : '#dc2626'}"></i>
              <code>…${esc(res.last4)}</code>
              <span style="color:var(--text-muted,#64748b)">${res.ok ? 'working' : ('failed (HTTP ' + res.status + ')')}</span>
            </div>`).join('') || '<span>No keys to test.</span>'}
        </div>`;
      }
      showToast(`Tested ${d.tested} key${d.tested === 1 ? '' : 's'}`);
    } catch (e) {
      showToast('Error: ' + e.message);
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-vial"></i> Test keys'; }
    }
  }

  window._admin = {
    render: renderAdminPanel,
    switchTab,
    apiKeysAddRow,
    apiKeysEdit,
    apiKeysRemove,
    apiKeysSave,
    apiKeysTest,
    renderForumAdmin,
    forumPin,
    forumLock,
    forumDelPost,
    forumDelComment,
    forumResolveReport,
    forumAudit,
    seedPersonas,
    tickPersonas,
    togglePersona,
    setPersonaCadence,
    personaPage,
    personaSearch,
    viewPersona,
    savePersonaEdit,
    bulkPersonas,
    selectAgent,
    newAgent,
    kbSwitch,
    kbDraftGap,
    kbDismissGap,
    kbApprove,
    kbReject,
    kbSaveJson,
    kbEnrich,
    saveAgent,
    deleteAgent,
    testAgent,
    decideDraft,
    searchUsers,
    filterUsers,
    showAddUser,
    submitAddUser,
    editUser,
    submitEditUser,
    toggleBan,
    _previewRole,
    showCreatePartner,
    submitCreatePartner,
    generateCode,
    togglePartner,
    viewPartnerStats,
    filterModeration,
    moderateItem,
    changeAnalyticsPeriod,
    refreshAnalytics,
    switchAnalyticsTab,
    changeMarketPeriod,
    refreshMarket,
    switchAffTab,
    viewCustomer,
    addNote,
    deleteNote,
    addTag,
    removeTag,
    sendRec: submitRec,
    quickRecommend: showRecModal,
    showRecModal,
    submitRec,
    showBulkRecommend,
    submitBulkRec,
    updateCustStatus,
    affFilterStatus,
    affSortCustomers,
    affSearchCustomers,
    toggleBulk,
    toggleBulkAll,
    toggleSegBulk,
    bulkRecSegment,
    approveApp,
    rejectApp,
    waitlistApp,
    filterApps,
    openConversation,
    sendReply,
    archiveConv,
    composeMessage,
    filterMsgCustomers,
    showComposeForm,
    submitMessage,
    messageCustomer,
    exportCSV,
    // Pipeline
    showAddDeal,
    submitDeal,
    updateDealStage,
    deleteDeal,
    filterDeals: (stage) => { /* filter can reload tab */ loadAffTab('pipeline'); },
    // Tasks
    showAddTask,
    submitTask,
    toggleTask,
    deleteTask,
    // Goals
    showAddGoal,
    submitGoal,
    updateGoalValue,
    _affCustSearch: '',
    checkAccess: checkAdminAccess,
    _influencers: []
  };

})();
