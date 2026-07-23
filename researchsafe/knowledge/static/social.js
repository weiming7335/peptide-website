// ============================================
// PeptideSafe Social Features
// ============================================

(function() {
  'use strict';

  // Social state
  const socialState = {
    userId: null,
    userName: null,
    userAvatar: null,
    isLoggedIn: false
  };

  // Update social state from auth
  function updateSocialAuth() {
    if (typeof currentUser !== 'undefined' && currentUser) {
      socialState.userId = currentUser.id || currentUser.email;
      socialState.userName = currentUser.name || currentUser.email?.split('@')[0] || 'Anonymous';
      socialState.userAvatar = currentUser.avatar_url;
      socialState.isLoggedIn = true;
    } else {
      socialState.userId = 'guest-' + (localStorage.getItem('ps-guest-id') || (() => {
        const id = Math.random().toString(36).substring(2, 10);
        localStorage.setItem('ps-guest-id', id);
        return id;
      })());
      socialState.userName = 'Guest';
      socialState.isLoggedIn = false;
    }
  }

  // ============================================
  // 1. COMMUNITY HUB (Shared Protocols + Ratings)
  // ============================================

  async function renderCommunityHub() {
    updateSocialAuth();
    const area = document.getElementById('contentArea');
    if (!area) return;

    area.innerHTML = `
      <div style="max-width:960px;margin:0 auto;padding:28px 20px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;flex-wrap:wrap;gap:12px">
          <div>
            <h1 style="font-size:26px;font-weight:800;margin:0;display:flex;align-items:center;gap:10px">
              <i class="fas fa-users" style="color:#2563eb"></i> Community Hub
            </h1>
            <p style="margin:4px 0 0;opacity:0.6;font-size:14px">Share protocols, discuss research, and learn from the community</p>
          </div>
          <div style="display:flex;gap:8px">
            <button onclick="window._social.showShareModal()" class="social-btn-primary">
              <i class="fas fa-share-nodes"></i> Share Protocol
            </button>
            <button onclick="window._social.showProfiles()" class="social-btn-secondary">
              <i class="fas fa-user-group"></i> Researchers
            </button>
          </div>
        </div>

        <!-- Tabs -->
        <div class="social-tabs" id="communityTabs">
          <button class="social-tab active" onclick="window._social.switchCommunityTab('protocols')">
            <i class="fas fa-flask"></i> Shared Protocols
          </button>
          <button class="social-tab" onclick="window._social.switchCommunityTab('bookmarks')">
            <i class="fas fa-bookmark"></i> My Bookmarks
          </button>
          <button class="social-tab" onclick="window._social.switchCommunityTab('myshared')">
            <i class="fas fa-share"></i> My Shared
          </button>
        </div>

        <!-- Filters -->
        <div class="social-filters" id="communityFilters">
          <div class="social-search-wrap">
            <i class="fas fa-search"></i>
            <input type="text" id="communitySearch" placeholder="Search protocols..." oninput="window._social.filterProtocols()">
          </div>
          <select id="communitySort" onchange="window._social.filterProtocols()" class="social-select">
            <option value="popular">Most Popular</option>
            <option value="newest">Newest</option>
            <option value="most-bookmarked">Most Bookmarked</option>
          </select>
          <select id="communityTag" onchange="window._social.filterProtocols()" class="social-select">
            <option value="">All Tags</option>
            <option value="healing">Healing</option>
            <option value="recovery">Recovery</option>
            <option value="growth-hormone">Growth Hormone</option>
            <option value="anti-aging">Anti-Aging</option>
            <option value="nootropic">Nootropic</option>
            <option value="cognitive">Cognitive</option>
            <option value="immune">Immune</option>
            <option value="skin">Skin</option>
            <option value="body-composition">Body Composition</option>
            <option value="beginner-friendly">Beginner Friendly</option>
          </select>
        </div>

        <div id="communityContent"></div>
      </div>
    `;

    loadCommunityProtocols();
  }

  async function loadCommunityProtocols() {
    const sort = document.getElementById('communitySort')?.value || 'popular';
    const tag = document.getElementById('communityTag')?.value || '';
    const search = document.getElementById('communitySearch')?.value || '';

    let url = `/api/social/protocols?sort=${sort}`;
    if (tag) url += `&tag=${tag}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;

    try {
      const res = await fetch(url);
      const protocols = await res.json();
      renderProtocolCards(protocols);
    } catch (e) {
      document.getElementById('communityContent').innerHTML = '<p style="text-align:center;opacity:0.5;padding:40px">Failed to load protocols</p>';
    }
  }

  function renderProtocolCards(protocols) {
    const container = document.getElementById('communityContent');
    if (!container) return;

    if (!protocols.length) {
      container.innerHTML = `
        <div style="text-align:center;padding:60px 20px;opacity:0.5">
          <i class="fas fa-flask" style="font-size:48px;margin-bottom:16px;display:block"></i>
          <p style="font-size:16px;font-weight:600">No protocols found</p>
          <p style="font-size:14px">Be the first to share a protocol!</p>
        </div>`;
      return;
    }

    container.innerHTML = protocols.map(p => `
      <div class="social-protocol-card" onclick="window._social.openProtocol('${p.id}')">
        <div class="social-protocol-header">
          <div class="social-protocol-avatar">
            ${p.userAvatar ? `<img src="${p.userAvatar}" alt="">` : `<span>${(p.userName || '?')[0].toUpperCase()}</span>`}
          </div>
          <div class="social-protocol-meta">
            <span class="social-protocol-author" onclick="event.stopPropagation();window._social.viewProfile('${p.userId}')">${escapeHtml(p.userName)}</span>
            <span class="social-protocol-date">${timeAgo(p.createdAt)}</span>
          </div>
          <div class="social-protocol-score">
            <span class="social-score-value ${(p.upvotes - p.downvotes) > 0 ? 'positive' : ''}">${p.upvotes - p.downvotes > 0 ? '+' : ''}${p.upvotes - p.downvotes}</span>
          </div>
        </div>
        <h3 class="social-protocol-title">${escapeHtml(p.title)}</h3>
        <p class="social-protocol-desc">${escapeHtml(p.description).substring(0, 160)}${p.description.length > 160 ? '...' : ''}</p>
        <div class="social-protocol-peptides">
          ${p.peptides.map(pep => `<span class="social-peptide-chip"><i class="fas fa-flask"></i> ${escapeHtml(pep.name)}</span>`).join('')}
        </div>
        <div class="social-protocol-footer">
          <span class="social-protocol-goal"><i class="fas fa-bullseye"></i> ${escapeHtml(p.goal)}</span>
          <span class="social-protocol-duration"><i class="fas fa-clock"></i> ${escapeHtml(p.duration)}</span>
        </div>
        <div class="social-protocol-actions" onclick="event.stopPropagation()">
          <button class="social-vote-btn" onclick="window._social.vote('${p.id}','up')" title="Upvote">
            <i class="fas fa-arrow-up"></i> ${p.upvotes}
          </button>
          <button class="social-vote-btn" onclick="window._social.vote('${p.id}','down')" title="Downvote">
            <i class="fas fa-arrow-down"></i> ${p.downvotes}
          </button>
          <button class="social-bookmark-btn" onclick="window._social.toggleBookmark('${p.id}')" title="Bookmark">
            <i class="fas fa-bookmark"></i> ${p.bookmarkCount}
          </button>
          <button class="social-share-link-btn" onclick="window._social.copyShareLink('${p.shareCode}')" title="Copy share link">
            <i class="fas fa-link"></i> Share
          </button>
          ${p.tags.map(t => `<span class="social-tag">${t}</span>`).join('')}
        </div>
      </div>
    `).join('');
  }

  // Open protocol detail
  async function openProtocol(id) {
    try {
      const res = await fetch(`/api/social/protocols/${id}`);
      const p = await res.json();
      if (p.error) return;

      const modal = document.createElement('div');
      modal.className = 'social-modal-overlay';
      modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
      modal.innerHTML = `
        <div class="social-modal social-modal-lg">
          <button class="social-modal-close" onclick="this.closest('.social-modal-overlay').remove()"><i class="fas fa-times"></i></button>
          <div class="social-protocol-detail">
            <div class="social-protocol-detail-header">
              <div class="social-protocol-avatar-lg">
                ${p.userAvatar ? `<img src="${p.userAvatar}" alt="">` : `<span>${(p.userName || '?')[0].toUpperCase()}</span>`}
              </div>
              <div>
                <h2 style="margin:0;font-size:22px;font-weight:700">${escapeHtml(p.title)}</h2>
                <p style="margin:4px 0 0;opacity:0.6;font-size:13px">
                  by <a href="#" onclick="event.preventDefault();this.closest('.social-modal-overlay').remove();window._social.viewProfile('${p.userId}')" style="color:#2563eb;font-weight:600">${escapeHtml(p.userName)}</a>
                  &middot; ${timeAgo(p.createdAt)} &middot; Updated ${timeAgo(p.updatedAt)}
                </p>
              </div>
            </div>

            <p style="margin:16px 0;line-height:1.6;font-size:14px">${escapeHtml(p.description)}</p>

            <div style="margin:20px 0">
              <h4 style="margin:0 0 12px;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;opacity:0.5">
                <i class="fas fa-flask"></i> Peptides in this Protocol
              </h4>
              <div class="social-peptide-table">
                ${p.peptides.map(pep => `
                  <div class="social-peptide-row">
                    <span class="social-peptide-name">${escapeHtml(pep.name)}</span>
                    <span class="social-peptide-info"><i class="fas fa-syringe"></i> ${escapeHtml(pep.dose)}</span>
                    <span class="social-peptide-info"><i class="fas fa-repeat"></i> ${escapeHtml(pep.frequency)}</span>
                    <span class="social-peptide-info"><i class="fas fa-route"></i> ${escapeHtml(pep.route)}</span>
                  </div>
                `).join('')}
              </div>
            </div>

            <div style="display:flex;gap:16px;margin:16px 0;flex-wrap:wrap">
              <div class="social-info-chip"><i class="fas fa-bullseye"></i> Goal: ${escapeHtml(p.goal)}</div>
              <div class="social-info-chip"><i class="fas fa-clock"></i> Duration: ${escapeHtml(p.duration)}</div>
            </div>

            <div class="social-protocol-detail-actions">
              <button class="social-vote-btn-lg" onclick="window._social.vote('${p.id}','up')">
                <i class="fas fa-arrow-up"></i> Upvote (${p.upvotes})
              </button>
              <button class="social-vote-btn-lg downvote" onclick="window._social.vote('${p.id}','down')">
                <i class="fas fa-arrow-down"></i> (${p.downvotes})
              </button>
              <button class="social-bookmark-btn-lg" onclick="window._social.toggleBookmark('${p.id}')">
                <i class="fas fa-bookmark"></i> Bookmark (${p.bookmarkCount})
              </button>
              <button class="social-share-btn-lg" onclick="window._social.copyShareLink('${p.shareCode}')">
                <i class="fas fa-link"></i> Copy Link
              </button>
            </div>

            <div style="margin-top:16px;padding:12px;background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.2);border-radius:10px;font-size:12px;color:#92400e">
              <i class="fas fa-triangle-exclamation"></i>
              <strong>Research Disclaimer:</strong> This is a community-shared research protocol, not medical advice. Always consult qualified healthcare professionals.
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    } catch(e) { console.error('Failed to open protocol', e); }
  }

  // Vote on protocol
  async function vote(protocolId, voteType) {
    updateSocialAuth();
    try {
      const res = await fetch(`/api/social/protocols/${protocolId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: socialState.userId, vote: voteType })
      });
      const data = await res.json();
      showToast(`Vote recorded! Score: ${data.upvotes - data.downvotes}`);
      loadCommunityProtocols();
    } catch(e) { showToast('Failed to vote', 'error'); }
  }

  // Toggle bookmark
  async function toggleBookmark(protocolId) {
    updateSocialAuth();
    try {
      const res = await fetch('/api/social/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: socialState.userId, protocolId })
      });
      const data = await res.json();
      showToast(data.bookmarked ? 'Protocol bookmarked!' : 'Bookmark removed');
      loadCommunityProtocols();
    } catch(e) { showToast('Failed to toggle bookmark', 'error'); }
  }

  // Copy share link
  function copyShareLink(shareCode) {
    const url = `${window.location.origin}/?shared=${shareCode}`;
    navigator.clipboard.writeText(url).then(() => {
      showToast('Share link copied to clipboard!');
    }).catch(() => {
      // Fallback
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      showToast('Share link copied!');
    });
  }

  // Share protocol modal
  function showShareModal() {
    updateSocialAuth();
    if (!socialState.isLoggedIn) {
      showToast('Please sign in to share protocols', 'warning');
      if (typeof openAuthModal === 'function') openAuthModal('login');
      return;
    }

    const modal = document.createElement('div');
    modal.className = 'social-modal-overlay';
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    modal.innerHTML = `
      <div class="social-modal">
        <button class="social-modal-close" onclick="this.closest('.social-modal-overlay').remove()"><i class="fas fa-times"></i></button>
        <h2 style="margin:0 0 4px;font-size:20px;font-weight:700"><i class="fas fa-share-nodes" style="color:#2563eb"></i> Share a Protocol</h2>
        <p style="margin:0 0 20px;opacity:0.6;font-size:13px">Share your research protocol with the community</p>

        <form id="shareProtocolForm" onsubmit="event.preventDefault();window._social.submitProtocol()">
          <label class="social-form-label">Protocol Title *</label>
          <input type="text" id="spTitle" class="social-form-input" placeholder="e.g., My Healing Stack" required>

          <label class="social-form-label">Description *</label>
          <textarea id="spDescription" class="social-form-textarea" placeholder="Describe your protocol, goals, and experience..." required></textarea>

          <label class="social-form-label">Goal</label>
          <input type="text" id="spGoal" class="social-form-input" placeholder="e.g., Tissue repair & recovery">

          <label class="social-form-label">Duration</label>
          <input type="text" id="spDuration" class="social-form-input" placeholder="e.g., 6 weeks">

          <label class="social-form-label">Peptides</label>
          <div id="spPeptideList"></div>
          <button type="button" onclick="window._social.addPeptideRow()" class="social-btn-secondary" style="margin:8px 0 16px;font-size:13px">
            <i class="fas fa-plus"></i> Add Peptide
          </button>

          <label class="social-form-label">Tags (comma separated)</label>
          <input type="text" id="spTags" class="social-form-input" placeholder="e.g., healing, recovery, beginner-friendly">

          <div style="display:flex;gap:10px;margin-top:20px">
            <button type="submit" class="social-btn-primary" style="flex:1"><i class="fas fa-share"></i> Share Protocol</button>
            <button type="button" onclick="this.closest('.social-modal-overlay').remove()" class="social-btn-secondary">Cancel</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
    addPeptideRow();
  }

  let peptideRowCount = 0;
  function addPeptideRow() {
    const list = document.getElementById('spPeptideList');
    if (!list) return;
    const row = document.createElement('div');
    row.className = 'social-peptide-form-row';
    row.innerHTML = `
      <input type="text" placeholder="Peptide name" class="social-form-input sp-pep-name" style="flex:2">
      <input type="text" placeholder="Dose" class="social-form-input sp-pep-dose" style="flex:1">
      <input type="text" placeholder="Frequency" class="social-form-input sp-pep-freq" style="flex:1">
      <input type="text" placeholder="Route" class="social-form-input sp-pep-route" style="flex:1">
      <button type="button" onclick="this.parentElement.remove()" class="social-btn-remove"><i class="fas fa-times"></i></button>
    `;
    list.appendChild(row);
    peptideRowCount++;
  }

  async function submitProtocol() {
    const title = document.getElementById('spTitle')?.value?.trim();
    const description = document.getElementById('spDescription')?.value?.trim();
    const goal = document.getElementById('spGoal')?.value?.trim() || '';
    const duration = document.getElementById('spDuration')?.value?.trim() || '';
    const tags = (document.getElementById('spTags')?.value || '').split(',').map(t => t.trim()).filter(Boolean);

    const peptideRows = document.querySelectorAll('.social-peptide-form-row');
    const peptides = Array.from(peptideRows).map(row => ({
      name: row.querySelector('.sp-pep-name')?.value?.trim() || '',
      dose: row.querySelector('.sp-pep-dose')?.value?.trim() || '',
      frequency: row.querySelector('.sp-pep-freq')?.value?.trim() || '',
      route: row.querySelector('.sp-pep-route')?.value?.trim() || ''
    })).filter(p => p.name);

    if (!title || !description) {
      showToast('Please fill in title and description', 'error');
      return;
    }

    try {
      updateSocialAuth();
      const res = await fetch('/api/social/protocols', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: socialState.userId,
          userName: socialState.userName,
          userAvatar: socialState.userAvatar,
          title, description, goal, duration, peptides, tags
        })
      });
      const data = await res.json();
      document.querySelector('.social-modal-overlay')?.remove();
      showToast('Protocol shared! Share code: ' + data.shareCode);
      loadCommunityProtocols();
    } catch(e) {
      showToast('Failed to share protocol', 'error');
    }
  }

  // Switch community tabs
  async function switchCommunityTab(tab) {
    document.querySelectorAll('.social-tab').forEach(t => t.classList.remove('active'));
    event.target.closest('.social-tab').classList.add('active');

    const content = document.getElementById('communityContent');
    const filters = document.getElementById('communityFilters');

    if (tab === 'protocols') {
      filters.style.display = '';
      loadCommunityProtocols();
    } else if (tab === 'bookmarks') {
      filters.style.display = 'none';
      updateSocialAuth();
      try {
        const res = await fetch(`/api/social/bookmarks/${socialState.userId}`);
        const bookmarked = await res.json();
        renderProtocolCards(bookmarked);
      } catch(e) {
        content.innerHTML = '<p style="text-align:center;padding:40px;opacity:0.5">Failed to load bookmarks</p>';
      }
    } else if (tab === 'myshared') {
      filters.style.display = 'none';
      updateSocialAuth();
      try {
        const res = await fetch(`/api/social/protocols?search=`);
        const all = await res.json();
        const mine = all.filter(p => p.userId === socialState.userId);
        if (mine.length === 0) {
          content.innerHTML = `
            <div style="text-align:center;padding:60px 20px;opacity:0.5">
              <i class="fas fa-share-nodes" style="font-size:48px;margin-bottom:16px;display:block"></i>
              <p style="font-size:16px;font-weight:600">You haven't shared any protocols yet</p>
              <button onclick="window._social.showShareModal()" class="social-btn-primary" style="margin-top:12px">Share Your First Protocol</button>
            </div>`;
        } else {
          renderProtocolCards(mine);
        }
      } catch(e) { content.innerHTML = '<p style="text-align:center;padding:40px;opacity:0.5">Error loading</p>'; }
    }
  }

  function filterProtocols() {
    loadCommunityProtocols();
  }

  // ============================================
  // 3. PUBLIC PROFILES
  // ============================================

  async function showProfiles() {
    const area = document.getElementById('contentArea');
    if (!area) return;

    area.innerHTML = `
      <div style="max-width:960px;margin:0 auto;padding:28px 20px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:24px">
          <button onclick="navigate('community')" class="social-btn-back"><i class="fas fa-arrow-left"></i></button>
          <div>
            <h1 style="font-size:24px;font-weight:800;margin:0"><i class="fas fa-user-group" style="color:#2563eb"></i> Community Researchers</h1>
            <p style="margin:4px 0 0;opacity:0.6;font-size:14px">Explore public profiles of active community members</p>
          </div>
        </div>
        <div id="profilesList">Loading...</div>
      </div>
    `;

    try {
      const res = await fetch('/api/social/profiles');
      const profiles = await res.json();
      const container = document.getElementById('profilesList');
      container.innerHTML = profiles.map(p => `
        <div class="social-profile-card" onclick="window._social.viewProfile('${p.userId}')">
          <div class="social-profile-avatar-wrap">
            ${p.avatar ? `<img src="${p.avatar}" class="social-profile-avatar">` : `<div class="social-profile-avatar-placeholder">${(p.displayName || '?')[0].toUpperCase()}</div>`}
          </div>
          <div class="social-profile-info">
            <h3 style="margin:0;font-size:16px;font-weight:700">${escapeHtml(p.displayName)}</h3>
            <p style="margin:4px 0 0;font-size:13px;opacity:0.6;line-height:1.4">${escapeHtml(p.bio || '').substring(0, 120)}</p>
            <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">
              ${(p.interests || []).slice(0, 4).map(i => `<span class="social-interest-chip">${escapeHtml(i)}</span>`).join('')}
            </div>
          </div>
          <div class="social-profile-stats">
            <span><i class="fas fa-flask"></i> ${p.protocols || p.sharedProtocolCount || 0} protocols</span>
            <span><i class="fas fa-clock"></i> Joined ${timeAgo(p.joinedAt)}</span>
          </div>
        </div>
      `).join('');
    } catch(e) {
      document.getElementById('profilesList').innerHTML = '<p style="opacity:0.5">Failed to load profiles</p>';
    }
  }

  async function viewProfile(userId) {
    const area = document.getElementById('contentArea');
    if (!area) return;

    area.innerHTML = '<div style="text-align:center;padding:60px"><div class="social-spinner"></div></div>';

    try {
      const res = await fetch(`/api/social/profiles/${userId}`);
      const profile = await res.json();
      if (profile.error) {
        area.innerHTML = '<div style="text-align:center;padding:60px;opacity:0.5"><p>Profile not found</p></div>';
        return;
      }

      area.innerHTML = `
        <div style="max-width:960px;margin:0 auto;padding:28px 20px">
          <button onclick="navigate('community')" class="social-btn-back" style="margin-bottom:16px"><i class="fas fa-arrow-left"></i> Back to Community</button>

          <div class="social-profile-header">
            <div class="social-profile-avatar-xl">
              ${profile.avatar ? `<img src="${profile.avatar}">` : `<span>${(profile.displayName || '?')[0].toUpperCase()}</span>`}
            </div>
            <div class="social-profile-header-info">
              <h1 style="margin:0;font-size:24px;font-weight:800">${escapeHtml(profile.displayName)}</h1>
              <p style="margin:6px 0;opacity:0.6;font-size:14px;line-height:1.5">${escapeHtml(profile.bio || 'No bio yet')}</p>
              <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
                ${(profile.interests || []).map(i => `<span class="social-interest-chip">${escapeHtml(i)}</span>`).join('')}
              </div>
              <div style="margin-top:12px;font-size:13px;opacity:0.5">
                <i class="fas fa-clock"></i> Joined ${timeAgo(profile.joinedAt)}
                &middot; <i class="fas fa-flask"></i> ${(profile.protocols || []).length} shared protocols
              </div>
            </div>
          </div>

          <h3 style="margin:28px 0 16px;font-size:18px;font-weight:700"><i class="fas fa-flask"></i> Shared Protocols</h3>
          <div id="profileProtocols"></div>
        </div>
      `;

      if (profile.protocols && profile.protocols.length) {
        setTimeout(() => renderProtocolCards(profile.protocols), 0);
        // Redirect output to profileProtocols
        setTimeout(() => {
          const communityContent = document.getElementById('communityContent');
          const profileProtocols = document.getElementById('profileProtocols');
          if (communityContent && profileProtocols) {
            profileProtocols.innerHTML = communityContent.innerHTML;
          }
        }, 100);
      } else {
        document.getElementById('profileProtocols').innerHTML = '<p style="opacity:0.5;padding:20px 0">No shared protocols yet</p>';
      }

      // Re-render protocol cards into the profile section
      const profileSection = document.getElementById('profileProtocols');
      if (profileSection && profile.protocols?.length) {
        profileSection.innerHTML = profile.protocols.map(p => `
          <div class="social-protocol-card" onclick="window._social.openProtocol('${p.id}')">
            <h3 class="social-protocol-title">${escapeHtml(p.title)}</h3>
            <p class="social-protocol-desc">${escapeHtml(p.description).substring(0, 160)}</p>
            <div class="social-protocol-peptides">
              ${p.peptides.map(pep => `<span class="social-peptide-chip"><i class="fas fa-flask"></i> ${escapeHtml(pep.name)}</span>`).join('')}
            </div>
            <div class="social-protocol-actions" onclick="event.stopPropagation()">
              <button class="social-vote-btn" onclick="window._social.vote('${p.id}','up')"><i class="fas fa-arrow-up"></i> ${p.upvotes}</button>
              <button class="social-vote-btn" onclick="window._social.vote('${p.id}','down')"><i class="fas fa-arrow-down"></i> ${p.downvotes}</button>
              <button class="social-bookmark-btn" onclick="window._social.toggleBookmark('${p.id}')"><i class="fas fa-bookmark"></i> ${p.bookmarkCount}</button>
            </div>
          </div>
        `).join('');
      }
    } catch(e) {
      area.innerHTML = '<div style="text-align:center;padding:60px;opacity:0.5"><p>Failed to load profile</p></div>';
    }
  }

  // ============================================
  // 5. DISCUSSION THREADS
  // ============================================

  async function loadDiscussions(peptideId) {
    const container = document.getElementById('discussionSection');
    if (!container) return;

    try {
      const res = await fetch(`/api/social/discussions/${peptideId}`);
      const data = await res.json();

      container.innerHTML = `
        <div class="social-discussion-header">
          <h3 style="margin:0;font-size:18px;font-weight:700"><i class="fas fa-comments" style="color:#2563eb"></i> Community Discussion</h3>
          <span style="font-size:13px;opacity:0.5">${data.totalCount} comment${data.totalCount !== 1 ? 's' : ''}</span>
        </div>

        <div class="social-discussion-compose">
          <textarea id="discussionInput" class="social-form-textarea" placeholder="Share your thoughts, experience, or questions about this peptide..." style="min-height:80px"></textarea>
          <button onclick="window._social.postDiscussion('${peptideId}')" class="social-btn-primary" style="margin-top:8px;align-self:flex-end">
            <i class="fas fa-paper-plane"></i> Post Comment
          </button>
        </div>

        <div class="social-discussion-sort">
          <button class="social-sort-btn active" onclick="window._social.sortDiscussions('${peptideId}','newest',this)">Newest</button>
          <button class="social-sort-btn" onclick="window._social.sortDiscussions('${peptideId}','popular',this)">Most Popular</button>
        </div>

        <div id="discussionThreads">
          ${data.threads.map(t => renderThread(t, peptideId)).join('')}
        </div>

        ${data.threads.length === 0 ? `
          <div style="text-align:center;padding:40px;opacity:0.4">
            <i class="fas fa-comments" style="font-size:36px;margin-bottom:12px;display:block"></i>
            <p>No discussions yet. Be the first to start one!</p>
          </div>
        ` : ''}
      `;
    } catch(e) {
      container.innerHTML = '<p style="opacity:0.5;padding:16px">Failed to load discussions</p>';
    }
  }

  function renderThread(thread, peptideId) {
    return `
      <div class="social-thread">
        <div class="social-thread-main">
          <div class="social-thread-avatar">
            ${thread.userAvatar ? `<img src="${thread.userAvatar}">` : `<span>${(thread.userName || '?')[0].toUpperCase()}</span>`}
          </div>
          <div class="social-thread-body">
            <div class="social-thread-header">
              <span class="social-thread-author">${escapeHtml(thread.userName)}</span>
              <span class="social-thread-time">${timeAgo(thread.createdAt)}</span>
            </div>
            <p class="social-thread-content">${escapeHtml(thread.content)}</p>
            <div class="social-thread-actions">
              <button onclick="window._social.voteDiscussion('${thread.id}')" class="social-thread-action-btn">
                <i class="fas fa-arrow-up"></i> ${thread.upvotes}
              </button>
              <button onclick="window._social.toggleReplyForm('${thread.id}','${peptideId}')" class="social-thread-action-btn">
                <i class="fas fa-reply"></i> Reply
              </button>
            </div>
            <div id="replyForm-${thread.id}" style="display:none" class="social-reply-form">
              <textarea id="replyInput-${thread.id}" class="social-form-textarea" placeholder="Write a reply..." style="min-height:60px;font-size:13px"></textarea>
              <button onclick="window._social.postReply('${peptideId}','${thread.id}')" class="social-btn-primary" style="font-size:12px;padding:6px 14px;margin-top:6px">Reply</button>
            </div>
          </div>
        </div>
        ${(thread.replies || []).length > 0 ? `
          <div class="social-thread-replies">
            ${thread.replies.map(r => `
              <div class="social-thread-reply">
                <div class="social-thread-avatar-sm">
                  ${r.userAvatar ? `<img src="${r.userAvatar}">` : `<span>${(r.userName || '?')[0].toUpperCase()}</span>`}
                </div>
                <div class="social-thread-body">
                  <div class="social-thread-header">
                    <span class="social-thread-author">${escapeHtml(r.userName)}</span>
                    <span class="social-thread-time">${timeAgo(r.createdAt)}</span>
                  </div>
                  <p class="social-thread-content">${escapeHtml(r.content)}</p>
                  <div class="social-thread-actions">
                    <button onclick="window._social.voteDiscussion('${r.id}')" class="social-thread-action-btn">
                      <i class="fas fa-arrow-up"></i> ${r.upvotes}
                    </button>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }

  async function postDiscussion(peptideId) {
    updateSocialAuth();
    const input = document.getElementById('discussionInput');
    const content = input?.value?.trim();
    if (!content) { showToast('Please write something', 'warning'); return; }

    if (!socialState.isLoggedIn) {
      showToast('Please sign in to post comments', 'warning');
      if (typeof openAuthModal === 'function') openAuthModal('login');
      return;
    }

    try {
      await fetch(`/api/social/discussions/${peptideId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: socialState.userId,
          userName: socialState.userName,
          userAvatar: socialState.userAvatar,
          content
        })
      });
      input.value = '';
      showToast('Comment posted!');
      loadDiscussions(peptideId);
    } catch(e) { showToast('Failed to post', 'error'); }
  }

  function toggleReplyForm(threadId) {
    const form = document.getElementById(`replyForm-${threadId}`);
    if (form) form.style.display = form.style.display === 'none' ? 'block' : 'none';
  }

  async function postReply(peptideId, parentId) {
    updateSocialAuth();
    const input = document.getElementById(`replyInput-${parentId}`);
    const content = input?.value?.trim();
    if (!content) return;

    if (!socialState.isLoggedIn) {
      showToast('Please sign in to reply', 'warning');
      if (typeof openAuthModal === 'function') openAuthModal('login');
      return;
    }

    try {
      await fetch(`/api/social/discussions/${peptideId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: socialState.userId,
          userName: socialState.userName,
          userAvatar: socialState.userAvatar,
          content,
          parentId
        })
      });
      showToast('Reply posted!');
      loadDiscussions(peptideId);
    } catch(e) { showToast('Failed to reply', 'error'); }
  }

  async function voteDiscussion(discussionId) {
    updateSocialAuth();
    try {
      await fetch(`/api/social/discussions/${discussionId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: socialState.userId, vote: 'up' })
      });
      // Reload active discussions
      const peptideId = document.querySelector('[data-active-peptide]')?.dataset?.activePeptide;
      if (peptideId) loadDiscussions(peptideId);
    } catch(e) {}
  }

  async function sortDiscussions(peptideId, sort, btn) {
    document.querySelectorAll('.social-sort-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    // Reload with sort
    try {
      const res = await fetch(`/api/social/discussions/${peptideId}?sort=${sort}`);
      const data = await res.json();
      const container = document.getElementById('discussionThreads');
      if (container) {
        container.innerHTML = data.threads.map(t => renderThread(t, peptideId)).join('');
      }
    } catch(e) {}
  }

  // ============================================
  // UTILITIES
  // ============================================

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function timeAgo(dateStr) {
    const now = new Date();
    const date = new Date(dateStr);
    const seconds = Math.floor((now - date) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
    if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
    if (seconds < 2592000) return Math.floor(seconds / 86400) + 'd ago';
    if (seconds < 31536000) return Math.floor(seconds / 2592000) + 'mo ago';
    return Math.floor(seconds / 31536000) + 'y ago';
  }

  function showToast(msg, type = 'success') {
    const existing = document.querySelector('.social-toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = `social-toast social-toast-${type}`;
    toast.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i> ${msg}`;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 3000);
  }

  // ============================================
  // Hook into existing navigation
  // ============================================

  // NOTE: Community view is now handled by community.js (Reddit-style)
  // social.js no longer overrides navigate('community')
  // Keep the discussion injection and share link handling below

  // Hook into peptide detail view to inject discussion section
  const originalContent = document.getElementById('contentArea');
  if (originalContent) {
    const observer = new MutationObserver(() => {
      // Check if we're on a peptide detail view
      const detailView = document.querySelector('.peptide-detail, [data-peptide-id]');
      if (detailView) {
        const peptideId = detailView.dataset?.peptideId || detailView.querySelector('[data-peptide-id]')?.dataset?.peptideId;
        if (peptideId && !document.getElementById('discussionSection')) {
          const section = document.createElement('div');
          section.id = 'discussionSection';
          section.dataset.activePeptide = peptideId;
          section.style.marginTop = '32px';
          detailView.appendChild(section);
          loadDiscussions(peptideId);
        }
      }
    });
    observer.observe(originalContent, { childList: true, subtree: true });
  }

  // Check for shared protocol on page load
  window.addEventListener('load', () => {
    const params = new URLSearchParams(window.location.search);
    const shared = params.get('shared');
    if (shared) {
      fetch(`/api/social/protocols/share/${shared}`)
        .then(r => r.json())
        .then(p => {
          if (!p.error) {
            navigate('community');
            setTimeout(() => openProtocol(p.id), 500);
          }
        })
        .catch(() => {});
    }
  });

  // Expose social functions globally
  window._social = {
    renderCommunityHub,
    loadCommunityProtocols,
    openProtocol,
    vote,
    toggleBookmark,
    copyShareLink,
    showShareModal,
    addPeptideRow,
    submitProtocol,
    switchCommunityTab,
    filterProtocols,
    showProfiles,
    viewProfile,
    loadDiscussions,
    postDiscussion,
    toggleReplyForm,
    postReply,
    voteDiscussion,
    sortDiscussions
  };

})();
