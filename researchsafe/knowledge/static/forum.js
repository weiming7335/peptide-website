// ============================================================
// ResearchSafe Forum - Reddit-style homepage feed
// Renders the 'home' view (feed + sidebar) and 'forum-post'
// (post detail with threaded comments). Backed by /api/forum/*.
// Reading is public; posting/commenting/voting require the
// existing Supabase account (openAuthModal from app-views.js).
// ============================================================
(function () {
  'use strict';

  // ── state ─────────────────────────────────────────────────
  var S = {
    sort: 'hot',
    community: '',
    q: '',
    offset: 0,
    limit: 25,
    posts: [],
    communities: [],
    me: null,          // { signedIn, id, karma, flair }
    endReached: false,
    loading: false
  };
  var PAGE_SIZE = 25;

  // ── utils ─────────────────────────────────────────────────
  function esc(s) {
    if (s === null || s === undefined) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Parse a timestamp to epoch ms, treating a bare SQL datetime
  // ("YYYY-MM-DD HH:MM:SS", no zone) as UTC - otherwise V8 reads it as LOCAL
  // time and every "ago" is off by the viewer's timezone offset. ISO strings
  // with T/Z (like the feed API returns) pass through unchanged.
  function parseTs(iso) {
    if (!iso) return NaN;
    var s = String(iso).trim();
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) s = s.replace(' ', 'T') + 'Z';
    return Date.parse(s);
  }
  function timeAgo(iso) {
    var t = parseTs(iso);
    if (!t) return '';
    var s = Math.max(0, (Date.now() - t) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    if (s < 2592000) return Math.floor(s / 86400) + 'd ago';
    if (s < 31536000) return Math.floor(s / 2592000) + 'mo ago';
    return Math.floor(s / 31536000) + 'y ago';
  }

  function fmtScore(n) {
    n = n || 0;
    if (Math.abs(n) >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return String(n);
  }

  // Minimal safe markdown: escape everything first, then re-introduce
  // **bold**, [text](same-site or http(s) link) and paragraphs/line breaks.
  function mdLite(raw) {
    var s = esc(raw || '');
    s = s.replace(/\*\*([^*\n]{1,200}?)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/\[([^\]\n]{1,120})\]\((\/[^)\s]{0,300}|https?:\/\/[^)\s]{1,300})\)/g, function (m, txt, url) {
      var ext = /^https?:/i.test(url) && url.indexOf(location.origin) !== 0;
      return '<a href="' + url + '"' + (ext ? ' target="_blank" rel="noopener nofollow ugc"' : '') + '>' + txt + '</a>';
    });
    var paras = s.split(/\n{2,}/).map(function (p) { return '<p>' + p.replace(/\n/g, '<br>') + '</p>'; });
    return autolinkCompounds(paras.join(''));
  }

  // Auto-link compound names in post/comment bodies to their KB pages.
  // Runs on already-escaped HTML; skips text inside <a> tags. Uses the global
  // `peptides` list from the data bundle (available on every page).
  var _compoundRe = null;
  var _compoundIds = null;
  // KB names bundle the alias in parentheses ("MK-677 (Ibutamoren)"), but people
  // type the bare identifier ("MK-677"). Build the match index from ALL the ways
  // a compound is written: the full name, the part before the first "(", and each
  // parenthetical alias - so real posts actually get linked.
  var _CPD_SKIP = { oral: 1, injectable: 1, acetate: 1, blend: 1, complex: 1, nasal: 1, spray: 1, peptide: 1, hormone: 1, sodium: 1 };
  function _compoundIndex() {
    if (_compoundRe) return _compoundRe;
    var list = (window.peptides || []).filter(function (p) { return p.name && p.id; });
    if (!list.length) return null; // data bundle not ready yet — retry next call
    _compoundIds = {};
    var cands = [];
    list.forEach(function (p) {
      var full = String(p.name);
      var variants = [full, full.split('(')[0]]; // whole name + text before first paren
      var m, re = /\(([^)]+)\)/g;
      while ((m = re.exec(full))) variants.push(m[1]); // each parenthetical alias
      if (p.fullName) variants.push(String(p.fullName));
      variants.forEach(function (nm) {
        nm = nm.replace(/\s+/g, ' ').trim();
        var key = nm.toLowerCase();
        if (nm.length < 3 || _CPD_SKIP[key] || !/[a-z]/i.test(nm)) return;
        if (_compoundIds[key] === undefined) { _compoundIds[key] = p.id; cands.push(nm); }
      });
    });
    var esc = cands.map(function (n) { return n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); })
      .sort(function (a, b) { return b.length - a.length; }); // longest first: "BPC-157" before "BPC"
    _compoundRe = new RegExp('(^|[\\s(,;:!?"\'])(' + esc.join('|') + ')(?=[\\s),/.;:!?"\']|$)', 'gi');
    return _compoundRe;
  }
  function autolinkCompounds(html) {
    var re = _compoundIndex();
    if (!re) return html;
    var count = 0;
    return html.split(/(<a\b[^>]*>[\s\S]*?<\/a>)/).map(function (seg) {
      if (seg.lastIndexOf('<a', 0) === 0) return seg;
      return seg.replace(re, function (m, pre, name) {
        var id = _compoundIds[name.toLowerCase()];
        if (!id || count >= 10) return m;
        count++;
        return pre + '<a href="/peptides/' + id + '" data-compound-id="' + id + '" class="fr-compound-link" title="Quick look: ' + name + '">' + name + '</a>';
      });
    }).join('');
  }

  // Compound quick-look popup: clicking an auto-linked compound opens an in-place
  // preview (a centered modal on desktop, a bottom sheet that slides up on
  // mobile) so the reader never leaves the discussion. The <a href> is kept for
  // accessibility, open-in-new-tab, and no-JS fallback; we intercept the click.
  function _cpdEsc(e) { if (e.key === 'Escape') closeCompoundPopup(); }
  function closeCompoundPopup() {
    var ov = document.getElementById('frCpdOverlay');
    if (ov) ov.classList.remove('open');
    document.body.classList.remove('fr-cpd-open');
    document.removeEventListener('keydown', _cpdEsc);
  }
  function openCompoundPopup(id, name) {
    var ov = document.getElementById('frCpdOverlay');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'frCpdOverlay';
      ov.className = 'fr-cpd-overlay';
      ov.innerHTML = '<div class="fr-cpd-sheet" role="dialog" aria-modal="true" aria-label="Compound details">' +
        '<div class="fr-cpd-grip" aria-hidden="true"></div>' +
        '<button type="button" class="fr-cpd-close" aria-label="Close">&times;</button>' +
        '<div class="fr-cpd-body"></div></div>';
      document.body.appendChild(ov);
      ov.addEventListener('click', function (e) {
        if (e.target === ov) { closeCompoundPopup(); return; }
        // "Open full profile" should navigate (SPA) and dismiss the sheet.
        if (e.target.closest && e.target.closest('.fr-cpd-foot a')) closeCompoundPopup();
      });
      ov.querySelector('.fr-cpd-close').addEventListener('click', closeCompoundPopup);
    }
    var body = ov.querySelector('.fr-cpd-body');
    body.innerHTML = '<div class="fr-cpd-loading"><div class="fr-cpd-spin"></div><span>Loading ' + esc(name) + '…</span></div>';
    document.body.classList.add('fr-cpd-open');
    // rAF so the slide-up transition runs from the closed state.
    requestAnimationFrame(function () { ov.classList.add('open'); });
    document.addEventListener('keydown', _cpdEsc);
    var found = (window.peptides || []).filter(function (x) { return x.id === id; })[0];
    function render(p) { body.innerHTML = compoundCardHtml(p); loadCompoundReviews(id); }
    fetch('/api/peptides/' + encodeURIComponent(id)).then(function (r) { return r.ok ? r.json() : Promise.reject(); })
      .then(function (d) { render(d.peptide || d); })
      .catch(function () {
        if (found) render(found);
        else body.innerHTML = '<div class="fr-cpd-loading"><p>Could not load this compound. <a href="/peptides/' + esc(id) + '">Open the full page</a>.</p></div>';
      });
  }
  function compoundCardHtml(p) {
    var color = p.categoryColor || '#0E7C5A';
    var dosing = p.dosing || {};
    var out = [];
    out.push('<div class="fr-cpd-head"><span class="fr-cpd-dot" style="background:' + color + '"></span>' +
      '<div class="fr-cpd-headtext"><h3 class="fr-cpd-name">' + esc(p.name || '') + '</h3>' +
      (p.fullName ? '<div class="fr-cpd-full">' + esc(p.fullName) + '</div>' : '') + '</div></div>');
    var tags = '';
    if (p.category) tags += '<span class="fr-cpd-tag" style="color:' + color + ';border-color:' + color + '55">' + esc(p.category) + '</span>';
    if (p.status) tags += '<span class="fr-cpd-tag">' + esc(p.status) + '</span>';
    if (tags) out.push('<div class="fr-cpd-tags">' + tags + '</div>');
    // Rating row (filled async by loadCompoundReviews once reviews load).
    out.push('<div class="fr-cpd-rating" id="frCpdRating"></div>');
    if (p.description) out.push('<p class="fr-cpd-desc">' + esc(p.description) + '</p>');
    if (p.mechanism) out.push('<div class="fr-cpd-sec"><h4>How it works</h4><p>' + esc(p.mechanism) + '</p></div>');
    var g = [];
    if (dosing.typical) g.push(['Typical', dosing.typical]);
    if (dosing.frequency) g.push(['Frequency', dosing.frequency]);
    if (dosing.duration) g.push(['Duration', dosing.duration]);
    if (dosing.route) g.push(['Route', dosing.route]);
    if (p.halfLife) g.push(['Half-life', p.halfLife]);
    if (g.length) out.push('<div class="fr-cpd-sec"><h4>Dosing &amp; kinetics</h4><div class="fr-cpd-grid">' +
      g.map(function (x) { return '<div><span>' + esc(x[0]) + '</span><b>' + esc(x[1]) + '</b></div>'; }).join('') + '</div></div>');
    var benefits = (p.benefits || []).slice(0, 4);
    if (benefits.length) out.push('<div class="fr-cpd-sec"><h4>Reported benefits</h4><ul class="fr-cpd-list">' +
      benefits.map(function (b) { return '<li>' + esc(b) + '</li>'; }).join('') + '</ul></div>');
    if (p.sideEffects) {
      var se = Array.isArray(p.sideEffects) ? p.sideEffects.slice(0, 4).join(' · ') : String(p.sideEffects);
      out.push('<div class="fr-cpd-sec"><h4>Safety notes</h4><p>' + esc(se) + '</p></div>');
    }
    // Member reviews (filled async by loadCompoundReviews).
    out.push('<div class="fr-cpd-sec fr-cpd-reviews" id="frCpdReviews"></div>');
    out.push('<div class="fr-cpd-foot"><a class="fr-btn fr-btn-primary" href="/peptides/' + esc(p.id) + '" data-noquick="1">Open full profile</a>' +
      '<span class="fr-cpd-note">Educational only, not medical advice.</span></div>');
    return out.join('');
  }
  function frStars(avg) {
    var out = '', full = Math.round(avg || 0);
    for (var i = 1; i <= 5; i++) out += '<i class="fa' + (i <= full ? 's' : 'r') + ' fa-star"></i>';
    return '<span class="fr-cpd-stars">' + out + '</span>';
  }
  // Pull the compound's rating summary + a couple of member reviews into the
  // popup once the card is on screen.
  function loadCompoundReviews(id) {
    fetch('/api/reviews/' + encodeURIComponent(id)).then(function (r) { return r.json(); }).then(function (d) {
      var s = d.summary || {}, items = d.items || [];
      var rEl = document.getElementById('frCpdRating');
      if (rEl && s.count) {
        rEl.innerHTML = frStars(s.avg) + '<b class="fr-cpd-avg">' + s.avg + '</b>' +
          '<span class="fr-cpd-rcount">' + s.count + ' review' + (s.count === 1 ? '' : 's') + '</span>' +
          (s.recommendPct != null ? '<span class="fr-cpd-rec"><i class="fas fa-thumbs-up"></i> ' + s.recommendPct + '% recommend</span>' : '');
      }
      var cEl = document.getElementById('frCpdReviews');
      if (cEl && items.length) {
        var top = items.slice(0, 3).map(function (r) {
          var badge = r.isAi ? '<span class="fr-ai-badge fr-ai-badge-sm">AI</span>' : '';
          return '<div class="fr-cpd-rev">' +
            '<div class="fr-cpd-rev-top">' + frStars(r.rating) +
              '<span class="fr-cpd-rev-author">' + esc(r.authorName) + badge + '</span>' +
              (r.duration ? '<span class="fr-cpd-rev-dur">· ' + esc(r.duration) + '</span>' : '') + '</div>' +
            (r.title ? '<div class="fr-cpd-rev-title">' + esc(r.title) + '</div>' : '') +
            '<p class="fr-cpd-rev-body">' + esc(r.body) + '</p></div>';
        }).join('');
        cEl.innerHTML = '<h4>How members rated it' + (s.count > 3 ? ' <a class="fr-cpd-rev-all" href="/peptides/' + esc(id) + '" data-noquick="1">See all ' + s.count + '</a>' : '') + '</h4>' + top;
      }
    }).catch(function () { /* reviews are optional chrome */ });
  }
  // One capture-phase delegate: beats app-boot's global anchor interceptor.
  if (!window.__frCpdBound) {
    window.__frCpdBound = true;
    document.addEventListener('click', function (e) {
      var a = e.target.closest ? e.target.closest('.fr-compound-link') : null;
      if (!a || !a.getAttribute('data-compound-id')) return;
      e.preventDefault();
      e.stopPropagation();
      openCompoundPopup(a.getAttribute('data-compound-id'), a.textContent || '');
    }, true);
  }

  function hostOf(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return ''; }
  }

  // Rich link-preview card: thumbnail image + title + description + host, like
  // Reddit/Slack unfurls. Falls back to a compact link chip when there's no
  // cached OG metadata yet.
  function linkPreviewHtml(p) {
    var url = p.link_url;
    if (!url) return '';
    var host = esc(hostOf(url));
    var hasCard = p.link_title || p.link_image || p.link_desc;
    if (!hasCard) {
      return '<a class="fr-post-link" href="' + esc(url) + '" target="_blank" rel="noopener nofollow ugc" onclick="event.stopPropagation()"><i class="fas fa-arrow-up-right-from-square"></i>' + host + '</a>';
    }
    var img = p.link_image
      ? '<div class="fr-link-thumb"><img src="' + esc(p.link_image) + '" alt="" loading="lazy" onerror="this.parentNode.style.display=\'none\'"></div>'
      : '';
    var title = p.link_title ? '<div class="fr-link-title">' + esc(p.link_title) + '</div>' : '';
    var desc = p.link_desc ? '<div class="fr-link-desc">' + esc(String(p.link_desc).slice(0, 160)) + '</div>' : '';
    return '<a class="fr-link-card" href="' + esc(url) + '" target="_blank" rel="noopener nofollow ugc" onclick="event.stopPropagation()">' +
      img +
      '<div class="fr-link-body">' +
        '<div class="fr-link-host"><i class="fas fa-arrow-up-right-from-square"></i> ' + host + '</div>' +
        title + desc +
      '</div></a>';
  }

  // ── auth ──────────────────────────────────────────────────
  var SB_KEY = 'sb-pqhpgfwhvhezlpqgrxmz-auth-token';
  function getToken() {
    try {
      var raw = localStorage.getItem(SB_KEY);
      if (!raw) return null;
      var j = JSON.parse(raw);
      return (j && j.access_token) || null;
    } catch (e) { return null; }
  }
  function authHeaders() {
    var h = { 'Content-Type': 'application/json' };
    var t = getToken();
    if (t) h['Authorization'] = 'Bearer ' + t;
    return h;
  }
  function signedIn() { return !!getToken(); }
  function requireAuth(context) {
    if (signedIn()) return true;
    if (typeof window.openAuthModal === 'function') window.openAuthModal('register', context || 'forum');
    toast('Create a free account to ' + (context === 'vote' ? 'vote' : context === 'comment' ? 'comment' : 'post') + ' — it takes 20 seconds.');
    return false;
  }

  // Public display handle. Signed-in users get their ACCOUNT username (random
  // at signup, admin-editable, returned by /api/forum/me — the server also
  // derives it authoritatively when posting). The localStorage handle is only
  // a guest-side placeholder until /me loads.
  var ANON_ADJ = ['Curious', 'Careful', 'Methodic', 'Quiet', 'Sharp', 'Steady', 'Bright', 'Patient', 'Bold', 'Precise'];
  var ANON_NOUN = ['Researcher', 'Analyst', 'Scholar', 'Observer', 'Scientist', 'Peptide', 'Molecule', 'Lab', 'Citizen', 'Explorer'];
  function displayName() {
    if (S.me && S.me.signedIn && S.me.username) return S.me.username;
    var n = localStorage.getItem('ps-anon-name');
    if (!n) {
      n = ANON_ADJ[Math.floor(Math.random() * ANON_ADJ.length)] + '-' +
          ANON_NOUN[Math.floor(Math.random() * ANON_NOUN.length)] + '-' +
          Math.floor(1000 + Math.random() * 9000);
      localStorage.setItem('ps-anon-name', n);
    }
    return n;
  }

  // ── admin moderation ──────────────────────────────────────
  // /api/forum/me returns is_admin for staff/moderator accounts; the delete
  // endpoint re-checks server-side, so these controls are a convenience only.
  function isAdmin() { return !!(S.me && S.me.is_admin); }
  function adminDeleteAction(postId) {
    if (!isAdmin()) return '';
    return '<button type="button" class="fr-action fr-action-danger fr-admin-del" data-del="' + postId + '"><i class="fas fa-trash-can"></i>Delete</button>';
  }
  // Confirm, then hard-delete the post (cascades to its comments server-side).
  function deletePost(postId, onDone) {
    if (!isAdmin()) return;
    if (!window.confirm('Delete this post and all of its comments? This cannot be undone.')) return;
    api('/api/forum/posts/' + postId, { method: 'DELETE' })
      .then(function () { toast('Post deleted'); if (typeof onDone === 'function') onDone(); })
      .catch(function (e) { toast((e && e.message) || 'Could not delete post'); });
  }

  // ── api ───────────────────────────────────────────────────
  function api(path, opts) {
    opts = opts || {};
    opts.headers = authHeaders();
    return fetch(path, opts).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok) throw Object.assign(new Error((j && j.error) || ('HTTP ' + r.status)), { status: r.status, body: j });
        return j;
      });
    });
  }

  function fetchFeed(append) {
    var p = '/api/forum/posts?sort=' + S.sort + '&limit=' + PAGE_SIZE + '&offset=' + (append ? S.offset : 0);
    if (S.community) p += '&community=' + encodeURIComponent(S.community);
    if (S.q) p += '&q=' + encodeURIComponent(S.q);
    return api(p);
  }

  function fetchCommunities() {
    if (S.communities.length) return Promise.resolve(S.communities);
    return api('/api/forum/communities').then(function (list) { S.communities = list || []; return S.communities; });
  }

  function fetchMe() {
    if (!signedIn()) { S.me = null; return Promise.resolve(null); }
    return api('/api/forum/me').then(function (m) { S.me = m; return m; }).catch(function () { return null; });
  }

  function communityMeta(slug) {
    for (var i = 0; i < S.communities.length; i++) if (S.communities[i].slug === slug) return S.communities[i];
    return { slug: slug, name: slug, icon: 'fa-comments', color: '#6b7280' };
  }

  // ── notifications bell ────────────────────────────────────
  function bellHtml() {
    return '<div class="fr-bell-wrap">' +
      '<button type="button" class="fr-bell" id="frBell" aria-label="Notifications" title="Notifications">' +
        '<i class="far fa-bell"></i><span class="fr-bell-badge" id="frBellBadge" style="display:none"></span>' +
      '</button>' +
      '<div class="fr-notif-panel" id="frNotifPanel" style="display:none"></div>' +
    '</div>';
  }

  function notifTypeText(t) {
    return t === 'comment_reply' ? 'replied to your comment on' : 'replied to your post';
  }

  function refreshBell() {
    var badge = document.getElementById('frBellBadge');
    if (!badge || !signedIn()) return;
    api('/api/forum/notifications').then(function (r) {
      S.notifications = r;
      var badges = document.querySelectorAll('.fr-bell-badge');
      badges.forEach(function (bd) {
        bd.textContent = r.unread > 9 ? '9+' : String(r.unread);
        bd.style.display = r.unread > 0 ? 'flex' : 'none';
      });
    }).catch(function () {});
  }

  // Poll the bell every 60s so a reply notification lights up the badge while
  // the user is reading, instead of only on navigation. Set up once.
  var _bellPoll = null;
  function startBellPolling() {
    if (_bellPoll || !signedIn()) return;
    _bellPoll = setInterval(function () {
      if (document.visibilityState === 'visible' && signedIn()) refreshBell();
    }, 60000);
  }

  function bindBells() {
    document.querySelectorAll('.fr-bell').forEach(function (btn) {
      btn.onclick = function (ev) {
        ev.stopPropagation();
        if (!requireAuth('see replies')) return;
        var panel = btn.parentElement.querySelector('.fr-notif-panel');
        if (panel.style.display !== 'none') { panel.style.display = 'none'; return; }
        var data = S.notifications || { items: [], unread: 0 };
        panel.innerHTML = '<div class="fr-notif-head">Notifications</div>' +
          ((data.items || []).length
            ? data.items.map(function (n) {
                return '<button type="button" class="fr-notif-item' + (n.is_read ? '' : ' unread') + '" data-post="' + (n.post_id || '') + '">' +
                  '<span class="fr-notif-text"><strong>' + esc(n.actor_name || 'Someone') + '</strong> ' + notifTypeText(n.type) +
                  ' <em>' + esc((n.post_title || 'a thread')) + '</em></span>' +
                  (n.snippet ? '<span class="fr-notif-snippet">“' + esc(n.snippet) + '”</span>' : '') +
                  '<span class="fr-notif-time">' + timeAgo(n.created_at) + '</span>' +
                '</button>';
              }).join('')
            : '<div class="fr-notif-empty">No notifications yet. When someone replies to you, it shows up here.</div>');
        panel.style.display = 'block';
        panel.querySelectorAll('.fr-notif-item').forEach(function (item) {
          item.onclick = function () {
            panel.style.display = 'none';
            var pid = parseInt(item.getAttribute('data-post'), 10);
            if (pid) openPost(pid);
          };
        });
        // Opening the panel marks everything read.
        if (data.unread > 0) {
          api('/api/forum/notifications/read', { method: 'POST', body: '{}' }).then(function () {
            document.querySelectorAll('.fr-bell-badge').forEach(function (bd) { bd.style.display = 'none'; });
            if (S.notifications) {
              S.notifications.unread = 0;
              (S.notifications.items || []).forEach(function (n) { n.is_read = true; });
            }
          }).catch(function () {});
        }
      };
    });
    if (!window.__frBellCloser) {
      window.__frBellCloser = true;
      document.addEventListener('click', function (e) {
        if (!e.target.closest || !e.target.closest('.fr-bell-wrap')) {
          document.querySelectorAll('.fr-notif-panel').forEach(function (pl) { pl.style.display = 'none'; });
        }
      });
    }
  }

  // ── toast ─────────────────────────────────────────────────
  function toast(msg) {
    var t = document.createElement('div');
    t.className = 'fr-toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.classList.add('show'); }, 10);
    setTimeout(function () { t.classList.remove('show'); setTimeout(function () { t.remove(); }, 300); }, 3200);
  }

  // ── sharing (shared by feed + detail) ─────────────────────
  // Native share sheet where the platform has one (mobile - offers whatever
  // apps the user actually uses, in their language); otherwise a small
  // platform menu anchored to the button.
  function sharePost(p, anchor) {
    var url = location.origin + '/forum/' + p.id;
    var title = p.title || 'ResearchSafe discussion';
    if (navigator.share) {
      navigator.share({ title: title, url: url }).catch(function () { /* user dismissed */ });
      return;
    }
    var existing = document.getElementById('frShareMenu');
    if (existing) { existing.remove(); return; }
    var eu = encodeURIComponent(url), et = encodeURIComponent(title);
    var menu = document.createElement('div');
    menu.id = 'frShareMenu';
    menu.setAttribute('role', 'menu');
    menu.style.cssText = 'position:absolute;z-index:1000;background:var(--bg-card,#1c1f26);border:1px solid var(--border,#2a2e37);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.35);padding:6px;min-width:170px';
    var items = [
      { icon: 'fa-brands fa-x-twitter', label: 'Share on X', href: 'https://twitter.com/intent/tweet?text=' + et + '&url=' + eu },
      { icon: 'fa-brands fa-reddit-alien', label: 'Share on Reddit', href: 'https://www.reddit.com/submit?url=' + eu + '&title=' + et },
      { icon: 'fa-brands fa-whatsapp', label: 'WhatsApp', href: 'https://wa.me/?text=' + et + '%20' + eu },
      { icon: 'fa-brands fa-telegram', label: 'Telegram', href: 'https://t.me/share/url?url=' + eu + '&text=' + et },
    ];
    menu.innerHTML = items.map(function (it) {
      return '<a role="menuitem" href="' + it.href + '" target="_blank" rel="noopener" style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:7px;color:inherit;text-decoration:none;font-size:13px"><i class="' + it.icon + '" style="width:16px"></i>' + it.label + '</a>';
    }).join('') +
      '<button type="button" id="frShareCopy" role="menuitem" style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:7px;background:none;border:none;color:inherit;width:100%;cursor:pointer;font-size:13px;text-align:left"><i class="fas fa-link" style="width:16px"></i>Copy link</button>';
    document.body.appendChild(menu);
    var r = anchor.getBoundingClientRect();
    menu.style.left = Math.max(8, Math.min(window.innerWidth - menu.offsetWidth - 8, r.left + window.scrollX)) + 'px';
    menu.style.top = (r.bottom + window.scrollY + 6) + 'px';
    menu.querySelector('#frShareCopy').onclick = function () {
      (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject())
        .then(function () { toast('Link copied'); }, function () { prompt('Copy link:', url); });
      menu.remove();
    };
    menu.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', function (ev) { ev.stopPropagation(); menu.remove(); }); });
    setTimeout(function () {
      document.addEventListener('click', function close(ev) {
        if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener('click', close); }
      });
    }, 0);
  }

  // ── reporting ─────────────────────────────────────────────
  // Reddit-style report: pick a reason, lands in the admin moderation queue.
  function reportContent(type, id, anchor) {
    var existing = document.getElementById('frReportMenu');
    if (existing) { existing.remove(); return; }
    var reasons = [
      { k: 'spam', label: 'Spam or self-promotion' },
      { k: 'sourcing', label: 'Sourcing / vendor links' },
      { k: 'harassment', label: 'Harassment or abuse' },
      { k: 'misinformation', label: 'Dangerous misinformation' },
      { k: 'other', label: 'Something else' },
    ];
    var menu = document.createElement('div');
    menu.id = 'frReportMenu';
    menu.setAttribute('role', 'menu');
    menu.style.cssText = 'position:absolute;z-index:1000;background:var(--bg-card,#1c1f26);border:1px solid var(--border,#2a2e37);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.35);padding:6px;min-width:200px';
    menu.innerHTML = '<div style="padding:6px 10px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;opacity:.6">Report</div>' +
      reasons.map(function (r) {
        return '<button type="button" role="menuitem" data-reason="' + r.k + '" style="display:block;padding:8px 10px;border-radius:7px;background:none;border:none;color:inherit;width:100%;cursor:pointer;font-size:13px;text-align:left">' + r.label + '</button>';
      }).join('');
    document.body.appendChild(menu);
    var rct = anchor.getBoundingClientRect();
    menu.style.left = Math.max(8, Math.min(window.innerWidth - menu.offsetWidth - 8, rct.left + window.scrollX)) + 'px';
    menu.style.top = (rct.bottom + window.scrollY + 6) + 'px';
    menu.querySelectorAll('button[data-reason]').forEach(function (b) {
      b.onclick = function (ev) {
        ev.stopPropagation();
        menu.remove();
        api('/api/forum/report', { method: 'POST', body: JSON.stringify({ target_type: type, target_id: id, reason: b.getAttribute('data-reason') }) })
          .then(function (r) { toast(r.duplicate ? 'You already reported this' : 'Reported - thanks, a moderator will take a look'); })
          .catch(function (e) { if (e.status === 401) requireAuth('report'); else toast(e.message || 'Could not report'); });
      };
    });
    setTimeout(function () {
      document.addEventListener('click', function close(ev) {
        if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener('click', close); }
      });
    }, 0);
  }

  // ── voting (shared by feed + detail) ──────────────────────
  // el: the .fr-vote container; type: 'post'|'comment'
  function bindVote(el, type, id) {
    var up = el.querySelector('.fr-vote-up');
    var down = el.querySelector('.fr-vote-down');
    var scoreEl = el.querySelector('.fr-vote-score');
    function current() { return parseInt(el.getAttribute('data-vote') || '0', 10) || 0; }
    function paint(vote, score) {
      el.setAttribute('data-vote', String(vote));
      scoreEl.textContent = fmtScore(score);
      up.classList.toggle('active', vote === 1);
      down.classList.toggle('active', vote === -1);
    }
    function cast(dir) {
      if (!requireAuth('vote')) return;
      var prev = current();
      var next = prev === dir ? 0 : dir;
      var score = parseInt(el.getAttribute('data-score') || '0', 10) || 0;
      var optimistic = score - prev + next;
      el.setAttribute('data-score', String(optimistic));
      paint(next, optimistic);
      api('/api/forum/vote', { method: 'POST', body: JSON.stringify({ target_type: type, target_id: id, vote: next }) })
        .then(function (r) { el.setAttribute('data-score', String(r.score)); paint(r.viewer_vote, r.score); })
        .catch(function (e) {
          el.setAttribute('data-score', String(score));
          paint(prev, score);
          if (e.status === 401) requireAuth('vote'); else toast(e.message || 'Vote failed');
        });
    }
    up.onclick = function (ev) { ev.stopPropagation(); cast(1); };
    down.onclick = function (ev) { ev.stopPropagation(); cast(-1); };
  }

  function voteColHtml(score, viewerVote, small) {
    return '<div class="fr-vote' + (small ? ' fr-vote-sm' : '') + '" data-vote="' + (viewerVote || 0) + '" data-score="' + (score || 0) + '">' +
      '<button type="button" class="fr-vote-btn fr-vote-up' + (viewerVote === 1 ? ' active' : '') + '" aria-label="Upvote"><i class="fas fa-arrow-up"></i></button>' +
      '<span class="fr-vote-score">' + fmtScore(score || 0) + '</span>' +
      '<button type="button" class="fr-vote-btn fr-vote-down' + (viewerVote === -1 ? ' active' : '') + '" aria-label="Downvote"><i class="fas fa-arrow-down"></i></button>' +
      '</div>';
  }

  // ── feed page ─────────────────────────────────────────────
  function renderForumHome(area) {
    // Two shapes share this shell: the /community directory-led home (no active
    // community) and the rich /community/<slug> hub (community preset).
    var hub = !!S.community;
    document.title = hub ? (communityMeta(S.community).name + ' | ResearchSafe Community') : 'Community Forum | ResearchSafe';
    area.innerHTML =
      '<div class="fr-page' + (hub ? ' fr-page-hub' : '') + '">' +
        '<div class="fr-main">' +
          (hub
            ? '<div id="frHubBanner" class="fr-hub-banner-wrap">' + hubBannerSkeleton() + '</div>'
            : '<div class="fr-hero">' +
                '<h1 class="fr-hero-title">ResearchSafe Community</h1>' +
                '<p class="fr-hero-sub">Peptide &amp; research-compound discussion — questions, protocols, experiences and evidence.</p>' +
              '</div>') +
          (hub ? '' : '<div class="fr-stats" id="frStats" aria-label="Community stats"></div>') +
          (hub ? '' :
            '<section class="fr-directory" aria-label="Communities">' +
              '<div class="fr-dir-head"><h2 class="fr-dir-title"><i class="fas fa-compass"></i> Browse communities</h2>' +
                '<span class="fr-dir-sub">Jump into a topic board</span></div>' +
              '<div class="fr-dir-grid" id="frDirGrid">' + dirSkeletons(6) + '</div>' +
            '</section>') +
          '<div class="fr-composer-bar">' +
            '<div class="fr-composer-avatar"><i class="fas fa-user-astronaut"></i></div>' +
            '<button type="button" class="fr-composer-input" id="frComposerOpen">' + (hub ? 'Post in ' + esc(communityMeta(S.community).name) + '…' : 'Create a post…') + '</button>' +
            '<button type="button" class="fr-btn fr-btn-primary" id="frCreateBtn"><i class="fas fa-plus"></i><span>Create Post</span></button>' +
          '</div>' +
          (hub ? '' : '<h2 class="fr-feed-heading"><i class="fas fa-fire-flame-curved"></i> Recent across all communities</h2>') +
          '<div class="fr-toolbar">' +
            '<div class="fr-sort-tabs" role="tablist">' +
              sortTab('hot', 'fa-fire', 'Hot') + sortTab('new', 'fa-certificate', 'New') + sortTab('top', 'fa-ranking-star', 'Top') +
            '</div>' +
            '<div class="fr-search"><i class="fas fa-magnifying-glass"></i>' +
              '<input id="frSearch" type="search" placeholder="' + (hub ? 'Search this community…' : 'Search posts…') + '" value="' + esc(S.q) + '" autocomplete="off">' +
            '</div>' +
            bellHtml() +
          '</div>' +
          '<div class="fr-feed" id="frFeed">' + skeletons(4) + '</div>' +
          '<div class="fr-loadmore"><button type="button" class="fr-btn fr-btn-ghost" id="frMore" style="display:none">Load more</button></div>' +
          '<div id="frSentinel" aria-hidden="true" style="height:1px"></div>' +
        '</div>' +
        '<aside class="fr-rail">' +
          (hub
            ? '<div class="fr-card fr-about" id="frHubAbout">' + hubAboutSkeleton() + '</div>' +
              '<div class="fr-card" id="frRelatedCard"><div class="fr-card-title"><i class="fas fa-layer-group"></i> Other communities</div><div class="fr-communities" id="frCommunities"><div class="fr-skel-line"></div><div class="fr-skel-line"></div></div></div>'
            : railAboutHtml() +
              '<div class="fr-card" id="frCommunityCard"><div class="fr-card-title"><i class="fas fa-users"></i> Communities</div><div class="fr-communities" id="frCommunities"><div class="fr-skel-line"></div><div class="fr-skel-line"></div></div></div>') +
          railRulesHtml() +
          railToolsHtml() +
        '</aside>' +
      '</div>';

    // events (composer open is delegated below so it survives re-renders)
    area.querySelectorAll('.fr-sort-tab').forEach(function (b) {
      b.onclick = function () {
        S.sort = b.getAttribute('data-sort');
        area.querySelectorAll('.fr-sort-tab').forEach(function (x) { x.classList.toggle('active', x === b); });
        loadFeed(false);
      };
    });
    var searchEl = document.getElementById('frSearch');
    var deb = null;
    searchEl.oninput = function () {
      clearTimeout(deb);
      deb = setTimeout(function () { S.q = searchEl.value.trim(); loadFeed(false); }, 350);
    };
    document.getElementById('frMore').onclick = function () { loadFeed(true); };
    setupInfiniteScroll();

    fetchCommunities().then(function () {
      paintCommunities();
      if (hub) { paintHubBanner(); paintHubAbout(); }
      else { paintDirectory(); }
      // Homepage hero "Ask a question" hands off here once communities exist.
      if (window.__forumComposeIntent) {
        window.__forumComposeIntent = false;
        showComposer();
      }
    });
    fetchMe().then(function () {
      paintRailIdentity();
      // /me resolves in parallel with the feed; once we learn the viewer is an
      // admin, repaint so moderation controls appear on already-drawn cards.
      if (isAdmin() && S.posts.length) paintFeed();
    });
    bindBells();
    refreshBell();
    startBellPolling();
    loadStats();
    loadFeed(false);
  }

  // ── communities directory (the /community landing grid) ───
  function dirSkeletons(n) {
    var out = '';
    for (var i = 0; i < n; i++) out += '<div class="fr-dir-card fr-dir-skel"><div class="fr-skel-line w40"></div><div class="fr-skel-line w80"></div></div>';
    return out;
  }

  function paintDirectory() {
    var grid = document.getElementById('frDirGrid');
    if (!grid) return;
    if (!S.communities.length) { grid.innerHTML = '<p class="fr-card-text">Communities are loading…</p>'; return; }
    grid.innerHTML = S.communities.map(function (cm) {
      return '<a class="fr-dir-card" href="/community/' + esc(cm.slug) + '" data-slug="' + esc(cm.slug) + '" style="--cc:' + esc(cm.color) + '">' +
        '<span class="fr-dir-ic"><i class="fas ' + esc(cm.icon) + '"></i></span>' +
        '<span class="fr-dir-body">' +
          '<span class="fr-dir-name">' + esc(cm.name) + '</span>' +
          '<span class="fr-dir-desc">' + esc(cm.description || '') + '</span>' +
          '<span class="fr-dir-meta"><i class="fas fa-note-sticky"></i> ' + fmtCount(cm.post_count || 0) + ' post' + ((cm.post_count === 1) ? '' : 's') +
            ' · <i class="fas fa-reply"></i> ' + fmtCount(cm.comment_count || 0) + '</span>' +
        '</span>' +
        '<i class="fas fa-chevron-right fr-dir-go"></i>' +
      '</a>';
    }).join('');
    grid.querySelectorAll('.fr-dir-card').forEach(function (a) {
      a.onclick = function (ev) {
        // Intercept so we SPA-navigate to the hub (avoids double-render from the
        // global anchor handler firing alongside a full page load).
        ev.preventDefault();
        ev.stopPropagation();
        setCommunity(a.getAttribute('data-slug'));
      };
    });
  }

  // ── rich per-community hub banner + rail ──────────────────
  function hubBannerSkeleton() {
    return '<div class="fr-hub-banner fr-hub-skel"><div class="fr-skel-line w40"></div><div class="fr-skel-line w80"></div></div>';
  }
  function hubAboutSkeleton() {
    return '<div class="fr-card-title"><i class="fas fa-circle-info"></i> About</div><div class="fr-skel-line"></div><div class="fr-skel-line w60"></div>';
  }

  function paintHubBanner() {
    var el = document.getElementById('frHubBanner');
    if (!el) return;
    var cm = communityMeta(S.community);
    var last = cm.last_post_at ? timeAgo(cm.last_post_at) : '';
    el.innerHTML =
      '<div class="fr-hub-banner" style="--cc:' + esc(cm.color || '#14b8a6') + '">' +
        '<nav class="fr-hub-crumbs" aria-label="Breadcrumb">' +
          '<a href="/community" class="fr-hub-back" data-allposts><i class="fas fa-arrow-left"></i> All communities</a>' +
        '</nav>' +
        '<div class="fr-hub-id">' +
          '<span class="fr-hub-ic"><i class="fas ' + esc(cm.icon || 'fa-comments') + '"></i></span>' +
          '<div class="fr-hub-idtext">' +
            '<h1 class="fr-hub-name">' + esc(cm.name || S.community) + '</h1>' +
            '<p class="fr-hub-desc">' + esc(cm.description || 'Peptide & research-compound discussion in this community.') + '</p>' +
          '</div>' +
        '</div>' +
        '<div class="fr-hub-metastrip">' +
          '<span class="fr-hub-stat"><i class="fas fa-note-sticky"></i> ' + fmtCount(cm.post_count || 0) + ' post' + ((cm.post_count === 1) ? '' : 's') + '</span>' +
          '<span class="fr-hub-stat"><i class="fas fa-reply"></i> ' + fmtCount(cm.comment_count || 0) + ' comment' + ((cm.comment_count === 1) ? '' : 's') + '</span>' +
          (last ? '<span class="fr-hub-stat"><i class="fas fa-clock"></i> active ' + esc(last) + '</span>' : '') +
          '<button type="button" class="fr-btn fr-btn-primary fr-hub-cta" onclick="window._forumCompose&&window._forumCompose()"><i class="fas fa-plus"></i> <span>Create post</span></button>' +
        '</div>' +
      '</div>';
    var back = el.querySelector('[data-allposts]');
    if (back) back.onclick = function (ev) { ev.preventDefault(); ev.stopPropagation(); setCommunity(''); };
  }

  function paintHubAbout() {
    var el = document.getElementById('frHubAbout');
    if (!el) return;
    var cm = communityMeta(S.community);
    el.innerHTML =
      '<div class="fr-card-title"><i class="fas ' + esc(cm.icon || 'fa-comments') + '" style="color:' + esc(cm.color || 'var(--rs-accent,#6c8cff)') + '"></i> ' + esc(cm.name || S.community) + '</div>' +
      '<p class="fr-card-text">' + esc(cm.description || 'Peptide & research-compound discussion in this community.') + '</p>' +
      '<div class="fr-hub-about-stats">' +
        '<div class="fr-hub-about-stat"><span class="fr-hub-about-n">' + fmtCount(cm.post_count || 0) + '</span><span class="fr-hub-about-l">posts</span></div>' +
        '<div class="fr-hub-about-stat"><span class="fr-hub-about-n">' + fmtCount(cm.comment_count || 0) + '</span><span class="fr-hub-about-l">comments</span></div>' +
      '</div>' +
      '<button type="button" class="fr-btn fr-btn-primary fr-btn-block" onclick="window._forumCompose&&window._forumCompose()"><i class="fas fa-plus"></i> Create Post</button>';
  }

  function fmtCount(n) {
    n = n || 0;
    if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'k';
    return String(n);
  }

  function loadStats() {
    var el = document.getElementById('frStats');
    if (!el) return;
    fetch('/api/forum/stats').then(function (r) { return r.json(); }).then(function (s) {
      if (!el.isConnected) return;
      var items = [
        ['fa-comments', s.discussions, 'discussions'],
        ['fa-note-sticky', s.posts, 'posts'],
        ['fa-reply', s.comments, 'replies'],
        ['fa-users', s.members, 'members'],
      ];
      if (s.posts_today > 0) items.push(['fa-bolt', s.posts_today, 'today']);
      el.innerHTML = items.map(function (it) {
        return '<div class="fr-stat"><i class="fas ' + it[0] + '"></i><span class="fr-stat-n">' + fmtCount(it[1]) + '</span><span class="fr-stat-l">' + it[2] + '</span></div>';
      }).join('');
    }).catch(function () { if (el) el.innerHTML = ''; });
  }

  function sortTab(key, icon, label) {
    return '<button type="button" class="fr-sort-tab' + (S.sort === key ? ' active' : '') + '" data-sort="' + key + '"><i class="fas ' + icon + '"></i>' + label + '</button>';
  }

  function skeletons(n) {
    var out = '';
    for (var i = 0; i < n; i++) out += '<div class="fr-post fr-skel"><div class="fr-skel-line w40"></div><div class="fr-skel-line w80"></div><div class="fr-skel-line w60"></div></div>';
    return out;
  }

  function loadFeed(append) {
    if (S.loading) return;
    S.loading = true;
    if (!append) { S.offset = 0; S.endReached = false; }
    var feed = document.getElementById('frFeed');
    if (!feed) { S.loading = false; return; }
    if (!append) feed.innerHTML = skeletons(4);
    fetchFeed(append).then(function (r) {
      var posts = (r && r.posts) || [];
      if (append) S.posts = S.posts.concat(posts); else S.posts = posts;
      S.offset = S.posts.length;
      S.endReached = posts.length < PAGE_SIZE;
      paintFeed();
      S.loading = false;
    }).catch(function () {
      if (feed) feed.innerHTML = '<div class="fr-empty"><i class="fas fa-plug-circle-xmark"></i><p>Could not load the feed. Please try again.</p></div>';
      S.loading = false;
    });
  }

  // Infinite scroll: auto-load the next page as the sentinel below the feed
  // nears view. The feed scrolls inside #contentArea (which has overflow-y),
  // so the observer root is that container, not the window. The "Load more"
  // button stays as a fallback for browsers without IntersectionObserver.
  function setupInfiniteScroll() {
    if (S._io) { S._io.disconnect(); S._io = null; }
    var sentinel = document.getElementById('frSentinel');
    if (!sentinel || typeof IntersectionObserver === 'undefined') return;
    var root = document.getElementById('contentArea') || null;
    S._io = new IntersectionObserver(function (entries) {
      if (entries[0] && entries[0].isIntersecting) maybeLoadMore();
    }, { root: root, rootMargin: '700px 0px' });
    S._io.observe(sentinel);
  }
  function maybeLoadMore() {
    if (S.loading || S.endReached || !S.posts.length) return;
    loadFeed(true);
  }

  function paintFeed() {
    var feed = document.getElementById('frFeed');
    if (!feed) return;
    if (!S.posts.length) {
      var msg = S.q ? 'No posts match “' + esc(S.q) + '”.' : 'No posts here yet — be the first to start a discussion!';
      feed.innerHTML = '<div class="fr-empty"><i class="fas fa-wind"></i><p>' + msg + '</p><button type="button" class="fr-btn fr-btn-primary" onclick="window._forumCompose&&window._forumCompose()">Create Post</button></div>';
    } else {
      feed.innerHTML = S.posts.map(postCardHtml).join('');
      S.posts.forEach(function (p) {
        var card = feed.querySelector('.fr-post[data-id="' + p.id + '"]');
        if (!card) return;
        bindVote(card.querySelector('.fr-vote'), 'post', p.id);
        card.querySelectorAll('[data-open]').forEach(function (el) {
          el.onclick = function (ev) {
            // stopPropagation: app-boot has a global same-host link interceptor
            // that would also call navigate() and double-render the view.
            ev.preventDefault();
            ev.stopPropagation();
            openPost(p.id);
          };
        });
        var chip = card.querySelector('.fr-community-chip');
        if (chip) chip.onclick = function (ev) { ev.stopPropagation(); setCommunity(p.community); };
        var share = card.querySelector('.fr-share');
        if (share) share.onclick = function (ev) {
          ev.stopPropagation();
          sharePost(p, share);
        };
        var del = card.querySelector('.fr-admin-del');
        if (del) del.onclick = function (ev) {
          ev.preventDefault();
          ev.stopPropagation();
          deletePost(p.id, function () {
            S.posts = S.posts.filter(function (x) { return x.id !== p.id; });
            paintFeed();
          });
        };
      });
    }
    var more = document.getElementById('frMore');
    if (more) more.style.display = (S.endReached || !S.posts.length) ? 'none' : 'inline-flex';
  }

  function postCardHtml(p) {
    var cm = communityMeta(p.community);
    var isLink = p.post_type === 'link' && p.link_url;
    var preview = '';
    if (isLink) {
      preview = linkPreviewHtml(p);
    } else if (p.body) {
      var txt = String(p.body).replace(/\*\*/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
      if (txt.length > 260) txt = txt.slice(0, 260) + '…';
      preview = '<div class="fr-post-preview" data-open>' + esc(txt) + '</div>';
    }
    return '<article class="fr-post" data-id="' + p.id + '">' +
      voteColHtml(p.score, p.viewer_vote) +
      '<div class="fr-post-main">' +
        '<div class="fr-post-meta">' +
          '<button type="button" class="fr-community-chip" style="--cc:' + esc(cm.color) + '"><i class="fas ' + esc(cm.icon) + '"></i>' + esc(cm.name) + '</button>' +
          '<span class="fr-meta-dim">by ' + authorLink(p.author_name, p.author_flag) + ' · ' + timeAgo(p.created_at) + '</span>' +
          (p.is_pinned ? '<span class="fr-pin"><i class="fas fa-thumbtack"></i> Pinned</span>' : '') +
        '</div>' +
        '<h2 class="fr-post-title"><a href="/forum/' + p.id + '" data-open>' + esc(p.title) + '</a>' + (isLink ? ' <i class="fas fa-link fr-title-link-ic"></i>' : '') + '</h2>' +
        (p.image_url ? '<a class="fr-post-img" href="/forum/' + p.id + '" data-open><img src="' + esc(p.image_url) + '" alt="" loading="lazy"></a>' : '') +
        preview +
        '<div class="fr-post-actions">' +
          '<a class="fr-action" href="/forum/' + p.id + '" data-open><i class="fas fa-comment-dots"></i>' + (p.comment_count || 0) + ' comment' + (p.comment_count === 1 ? '' : 's') + '</a>' +
          '<button type="button" class="fr-action fr-share"><i class="fas fa-share-nodes"></i>Share</button>' +
          adminDeleteAction(p.id) +
        '</div>' +
      '</div>' +
    '</article>';
  }

  // ── sidebar ───────────────────────────────────────────────
  // Conversion CTA shown to logged-out readers at the point of peak interest -
  // right under a thread they just read. This is where search / AI-answer
  // traffic lands, so it's the moment to invite them in.
  function guestJoinCta() {
    return '<div class="fr-card fr-join-cta">' +
      '<div class="fr-join-icon"><i class="fas fa-comments"></i></div>' +
      '<div class="fr-join-body">' +
        '<div class="fr-join-title">Got something to add?</div>' +
        '<p class="fr-join-text">Create a free account to reply, upvote what helps, and ask your own questions. Takes about 20 seconds, and you keep your history.</p>' +
        '<div class="fr-join-actions">' +
          '<button type="button" class="fr-btn fr-btn-primary" onclick="(window.openAuthModal||function(){})(\'register\',\'forum\')"><i class="fas fa-user-plus"></i> Create free account</button>' +
          '<button type="button" class="fr-linklike" onclick="(window.openAuthModal||function(){})(\'login\',\'forum\')">Already a member? Sign in</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function railAboutHtml() {
    return '<div class="fr-card fr-about" id="frAboutCard">' +
      '<div class="fr-card-title"><i class="fas fa-flask"></i> ResearchSafe Community</div>' +
      '<p class="fr-card-text">The discussion home for peptide &amp; research-compound science. Ask questions, share protocols and experiences, vote on what helps.</p>' +
      '<div id="frRailIdentity"></div>' +
      '<button type="button" class="fr-btn fr-btn-primary fr-btn-block" onclick="window._forumCompose&&window._forumCompose()"><i class="fas fa-plus"></i> Create Post</button>' +
    '</div>';
  }

  function paintRailIdentity() {
    var el = document.getElementById('frRailIdentity');
    if (!el) return;
    if (S.me && S.me.signedIn) {
      el.innerHTML = '<div class="fr-identity">' +
        '<div class="fr-identity-row"><i class="fas fa-user-check"></i><span>' + esc(displayName()) + (S.me.flag ? ' <span class="fr-flag">' + S.me.flag + '</span>' : '') + '</span>' +
          '<button type="button" class="fr-linklike fr-country-edit" title="Set your country" style="margin-left:auto;padding:2px 6px"><i class="fas fa-earth-americas" style="font-size:11px"></i></button>' +
          '<button type="button" class="fr-linklike fr-name-edit" title="Change username" style="padding:2px 6px"><i class="fas fa-pen" style="font-size:11px"></i></button>' +
        '</div>' +
        '<div class="fr-name-edit-slot"></div>' +
        '<div class="fr-country-edit-slot"></div>' +
        '<div class="fr-identity-stats">' +
          '<span title="Post karma + comment karma"><i class="fas fa-bolt"></i> ' + fmtScore(S.me.karma.total) + ' karma</span>' +
          '<span class="fr-flair-badge">' + esc(S.me.flair) + '</span>' +
        '</div></div>';
      var countryBtn = el.querySelector('.fr-country-edit');
      if (countryBtn) countryBtn.onclick = function () {
        var slot = el.querySelector('.fr-country-edit-slot');
        if (slot.innerHTML) { slot.innerHTML = ''; return; }
        slot.innerHTML = '<div style="display:flex;gap:6px;margin:6px 0">' +
          countrySelectHtml('frCountrySel', S.me.country) +
          '<button type="button" class="fr-btn fr-btn-primary fr-country-save" style="padding:6px 10px">Save</button></div>';
        slot.querySelector('.fr-country-save').onclick = function () {
          var v = slot.querySelector('#frCountrySel').value;
          api('/api/forum/me/country', { method: 'PATCH', body: JSON.stringify({ country: v }) })
            .then(function (r) { S.me.country = r.country; S.me.flag = r.flag; toast('Country updated'); paintRailIdentity(); })
            .catch(function (e) { toast(e.message || 'Could not update country'); });
        };
      };
      var editBtn = el.querySelector('.fr-name-edit');
      if (editBtn) editBtn.onclick = function () {
        var slot = el.querySelector('.fr-name-edit-slot');
        if (slot.innerHTML) { slot.innerHTML = ''; return; }
        slot.innerHTML = '<div style="display:flex;gap:6px;margin:6px 0">' +
          '<input class="fr-input" maxlength="20" placeholder="new-username" value="' + esc(S.me.username || '') + '" style="flex:1;min-width:0">' +
          '<button type="button" class="fr-btn fr-btn-primary fr-name-save" style="padding:6px 10px">Save</button></div>' +
          '<p class="fr-meta-dim" style="margin:0 0 4px;font-size:11px">3-20 characters (letters, numbers, - or _). One change per 14 days. Applies to all your past posts too.</p>';
        var input = slot.querySelector('input');
        input.focus();
        var save = function () {
          var v = input.value.trim();
          if (!v) return;
          api('/api/forum/me', { method: 'PATCH', body: JSON.stringify({ username: v }) })
            .then(function (r) {
              S.me.username = r.username;
              toast('Username changed to ' + r.username);
              paintRailIdentity();
            })
            .catch(function (e) { toast(e.message || 'Could not change username'); });
        };
        slot.querySelector('.fr-name-save').onclick = save;
        input.onkeydown = function (ev) { if (ev.key === 'Enter') save(); };
      };
    } else {
      el.innerHTML = '<div class="fr-identity fr-identity-guest">' +
        '<p>You\'re browsing as a guest. Create a free account to post, comment and vote.</p>' +
        '<button type="button" class="fr-btn fr-btn-outline fr-btn-block" onclick="(window.openAuthModal||function(){})(\'register\',\'forum\')"><i class="fas fa-user-plus"></i> Create free account</button>' +
        '<button type="button" class="fr-linklike" onclick="(window.openAuthModal||function(){})(\'login\',\'forum\')">Already have one? Sign in</button>' +
      '</div>';
    }
  }

  function paintCommunities() {
    var el = document.getElementById('frCommunities');
    if (!el) return;
    // On a hub the card is "Other communities": lead with a back-to-all row and
    // drop the community you're already in. On home it's the full switcher.
    var html = '<button type="button" class="fr-community-row' + (!S.community ? ' active' : '') + '" data-slug="">' +
      '<span class="fr-community-ic" style="--cc:#8b8b94"><i class="fas fa-layer-group"></i></span>' +
      '<span class="fr-community-name">' + (S.community ? 'All communities' : 'All posts') + '</span></button>';
    html += S.communities.filter(function (cm) { return !S.community || cm.slug !== S.community; }).map(function (cm) {
      return '<button type="button" class="fr-community-row' + (S.community === cm.slug ? ' active' : '') + '" data-slug="' + esc(cm.slug) + '" title="' + esc(cm.description) + '">' +
        '<span class="fr-community-ic" style="--cc:' + esc(cm.color) + '"><i class="fas ' + esc(cm.icon) + '"></i></span>' +
        '<span class="fr-community-name">' + esc(cm.name) + '</span>' +
        '<span class="fr-community-count">' + (cm.post_count || 0) + '</span>' +
      '</button>';
    }).join('');
    el.innerHTML = html;
    el.querySelectorAll('.fr-community-row').forEach(function (b) {
      b.onclick = function () { setCommunity(b.getAttribute('data-slug') || ''); };
    });
  }

  // Switch communities by SPA-navigating to the hub (empty slug → the /community
  // directory home). navigate() re-enters _forumRender, which re-renders the
  // whole page in the right shape (directory vs. rich hub) and syncs the URL.
  function setCommunity(slug) {
    if (typeof window.navigate === 'function') { window.navigate('community', slug || ''); return; }
    // Fallback if the router isn't available: filter in place.
    S.community = slug || '';
    S.q = '';
    paintCommunities();
    loadFeed(false);
  }

  function railRulesHtml() {
    var rules = [
      ['Research context only', 'Nothing here is medical advice.'],
      ['No sourcing', 'No vendor asks, offers or links.'],
      ['Be evidence-minded', 'Cite studies; separate anecdote from evidence.'],
      ['Be respectful', 'No harassment, spam or self-promotion.'],
      ['Protect privacy', 'No personal information.']
    ];
    return '<div class="fr-card"><div class="fr-card-title"><i class="fas fa-scale-balanced"></i> Community rules</div>' +
      '<ol class="fr-rules">' + rules.map(function (r) {
        return '<li><strong>' + r[0] + '.</strong> ' + r[1] + '</li>';
      }).join('') + '</ol>' +
      '<a class="fr-linklike" href="/" onclick="event.preventDefault();event.stopPropagation();window._forumOpenWelcome&&window._forumOpenWelcome()">Read the full welcome post →</a></div>';
  }

  function railToolsHtml() {
    var tools = [
      ['/', 'fa-book-open', 'Knowledge base'],
      ['/calculator', 'fa-calculator', 'Reconstitution calculator'],
      ['/interactions', 'fa-shield-halved', 'Interaction checker'],
      ['/builder', 'fa-layer-group', 'Stack builder']
    ];
    return '<div class="fr-card"><div class="fr-card-title"><i class="fas fa-toolbox"></i> Research tools</div>' +
      '<div class="fr-tools">' + tools.map(function (t) {
        return '<a class="fr-tool" href="' + t[0] + '"><i class="fas ' + t[1] + '"></i>' + t[2] + '</a>';
      }).join('') + '</div></div>';
  }

  // ── post detail ───────────────────────────────────────────
  function openPost(id) {
    if (typeof window.navigate === 'function') window.navigate('forum-post', String(id));
    else location.href = '/forum/' + id;
  }

  // "More in <community>": keep readers going after the comments with other
  // threads from the same board (session depth + internal links for SEO).
  function loadMoreInCommunity(p) {
    var el = document.getElementById('frMoreIn');
    if (!el || !p || !p.community) return;
    var cm = communityMeta(p.community);
    api('/api/forum/posts?community=' + encodeURIComponent(p.community) + '&sort=hot&limit=8').then(function (r) {
      var posts = ((r && r.posts) || []).filter(function (x) { return x.id !== p.id; }).slice(0, 5);
      if (!posts.length) { el.innerHTML = ''; return; }
      el.innerHTML = '<div class="fr-card fr-more-card">' +
        '<div class="fr-card-title"><i class="fas ' + esc(cm.icon) + '"></i> More in ' + esc(cm.name) + '</div>' +
        posts.map(function (x) {
          return '<a class="fr-teaser-row" href="/forum/' + x.id + '" style="display:flex;gap:10px;align-items:center">' +
            '<span class="fr-teaser-score"><i class="fas fa-arrow-up"></i>' + (x.score || 0) + '</span>' +
            '<span class="fr-teaser-title">' + esc(x.title) + '</span>' +
            '<span class="fr-teaser-meta">' + (x.comment_count || 0) + ' <i class="far fa-comment"></i></span></a>';
        }).join('') +
        '</div>';
    }).catch(function () { if (el) el.innerHTML = ''; });
  }

  function renderForumPost(area, id) {
    id = parseInt(id, 10);
    area.innerHTML = '<div class="fr-page"><div class="fr-main">' + skeletons(2) + '</div></div>';
    Promise.all([api('/api/forum/posts/' + id), fetchCommunities(), fetchMe()]).then(function (rs) {
      paintPostDetail(area, rs[0]);
    }).catch(function (e) {
      area.innerHTML = '<div class="fr-page"><div class="fr-main"><div class="fr-empty"><i class="fas fa-ghost"></i><p>' +
        (e.status === 404 ? 'This post does not exist (or was removed).' : 'Could not load this post.') +
        '</p><button type="button" class="fr-btn fr-btn-primary" onclick="navigate(\'community\')">Back to the forum</button></div></div></div>';
    });
  }

  function paintPostDetail(area, p) {
    document.title = p.title + ' | ResearchSafe Community';
    var cm = communityMeta(p.community);
    var isLink = p.post_type === 'link' && p.link_url;
    area.innerHTML =
      '<div class="fr-page">' +
        '<div class="fr-main">' +
          '<div class="fr-detail-topbar"><button type="button" class="fr-back" onclick="navigate(\'community\')"><i class="fas fa-arrow-left"></i> Back to feed</button>' + bellHtml() + '</div>' +
          '<article class="fr-post fr-post-detail" data-id="' + p.id + '">' +
            voteColHtml(p.score, p.viewer_vote) +
            '<div class="fr-post-main">' +
              '<div class="fr-post-meta">' +
                '<button type="button" class="fr-community-chip" style="--cc:' + esc(cm.color) + '" onclick="navigate(\'community\')"><i class="fas ' + esc(cm.icon) + '"></i>' + esc(cm.name) + '</button>' +
                '<span class="fr-meta-dim">by ' + authorLink(p.author_name, p.author_flag) + '</span>' +
                (p.author_flair ? ' <span class="fr-flair-badge" title="' + esc(p.author_karma) + ' karma">' + esc(p.author_flair) + '</span>' : '') +
                ' · ' + timeAgo(p.created_at) + '</span>' +
                (p.is_pinned ? '<span class="fr-pin"><i class="fas fa-thumbtack"></i> Pinned</span>' : '') +
                (p.is_locked ? '<span class="fr-pin"><i class="fas fa-lock"></i> Locked</span>' : '') +
              '</div>' +
              '<h1 class="fr-post-title fr-post-title-lg">' + esc(p.title) + '</h1>' +
              (isLink ? linkPreviewHtml(p) : '') +
              (p.image_url ? '<div class="fr-post-img fr-post-img-lg"><img src="' + esc(p.image_url) + '" alt=""></div>' : '') +
              (p.body ? '<div class="fr-post-body">' + mdLite(p.body) + '</div>' : '') +
              '<div class="fr-post-actions">' +
                '<span class="fr-action"><i class="fas fa-comment-dots"></i>' + (p.comment_count || 0) + ' comment' + (p.comment_count === 1 ? '' : 's') + '</span>' +
                '<button type="button" class="fr-action fr-share"><i class="fas fa-share-nodes"></i>Share</button>' +
                '<button type="button" class="fr-action fr-report"><i class="far fa-flag"></i>Report</button>' +
                adminDeleteAction(p.id) +
              '</div>' +
            '</div>' +
          '</article>' +
          (p.is_locked
            ? '<div class="fr-card fr-comment-box"><p class="fr-card-text"><i class="fas fa-lock"></i> Comments are locked on this post.</p></div>'
            : signedIn()
              ? '<div class="fr-card fr-comment-box">' +
                '<div class="fr-composer-head">Comment as <strong>' + esc(displayName()) + '</strong></div>' +
                '<textarea id="frCommentBody" class="fr-textarea" rows="4" maxlength="10000" placeholder="Share your thoughts… (be evidence-minded, no sourcing)"></textarea>' +
                '<div class="fr-composer-foot"><button type="button" class="fr-btn fr-btn-primary" id="frCommentSubmit">Comment</button></div>' +
                '</div>'
              : guestJoinCta()) +
          '<div class="fr-comments" id="frComments"></div>' +
          '<div id="frMoreIn"></div>' +
        '</div>' +
        '<aside class="fr-rail">' + railAboutHtml() + railRulesHtml() + railToolsHtml() + '</aside>' +
      '</div>';
    loadMoreInCommunity(p);

    bindVote(area.querySelector('.fr-post-detail .fr-vote'), 'post', p.id);
    var share = area.querySelector('.fr-post-detail .fr-share');
    if (share) share.onclick = function () { sharePost(p, share); };
    var report = area.querySelector('.fr-post-detail .fr-report');
    if (report) report.onclick = function () { reportContent('post', p.id, report); };
    var del = area.querySelector('.fr-post-detail .fr-admin-del');
    if (del) del.onclick = function () {
      // Post is gone → return to the feed for its community.
      deletePost(p.id, function () { navigate('community', p.community || ''); });
    };
    fetchMe().then(paintRailIdentity);
    bindBells();
    refreshBell();

    var submit = document.getElementById('frCommentSubmit');
    if (submit) submit.onclick = function () {
      var ta = document.getElementById('frCommentBody');
      var body = (ta.value || '').trim();
      if (!body) { toast('Write a comment first.'); return; }
      if (!requireAuth('comment')) return;
      submit.disabled = true;
      api('/api/forum/posts/' + p.id + '/comments', { method: 'POST', body: JSON.stringify({ body: body, author_name: displayName() }) })
        .then(function (r) {
          ta.value = '';
          p.comments.push(r.comment);
          p.comment_count++;
          paintComments(p);
          toast('Comment posted');
        })
        .catch(function (e) { if (e.status === 401) requireAuth('comment'); else toast(e.message || 'Could not post comment'); })
        .then(function () { submit.disabled = false; });
    };

    paintComments(p);
  }

  function paintComments(p) {
    var el = document.getElementById('frComments');
    if (!el) return;
    var comments = p.comments || [];
    if (!comments.length) {
      el.innerHTML = '<div class="fr-empty fr-empty-sm"><i class="far fa-comments"></i><p>No comments yet — start the discussion!</p></div>';
      return;
    }
    // build tree
    var byParent = {};
    comments.forEach(function (cmt) {
      var k = cmt.parent_id || 0;
      (byParent[k] = byParent[k] || []).push(cmt);
    });
    // Reddit-style ranking: show the best TOP-LEVEL comments first so the
    // strongest takes rise to the top; keep threaded replies in chronological
    // order under their parent so conversations still read naturally.
    Object.keys(byParent).forEach(function (k) {
      if (k === '0') {
        byParent[k].sort(function (a, b) {
          return (b.score || 0) - (a.score || 0) || (parseTs(a.created_at) - parseTs(b.created_at));
        });
      } else {
        byParent[k].sort(function (a, b) { return parseTs(a.created_at) - parseTs(b.created_at); });
      }
    });
    function renderLevel(parentId, depth) {
      var list = byParent[parentId] || [];
      return list.map(function (cmt) {
        var kids = renderLevel(cmt.id, depth + 1);
        return '<div class="fr-comment" data-id="' + cmt.id + '" style="--depth:' + Math.min(depth, 8) + '">' +
          '<div class="fr-comment-head">' +
            '<button type="button" class="fr-collapse" title="Collapse thread"><i class="fas fa-minus"></i></button>' +
            authorLink(cmt.author_name, cmt.author_flag) +
            '<span class="fr-meta-dim">· ' + timeAgo(cmt.created_at) + '</span>' +
          '</div>' +
          '<div class="fr-comment-body">' + mdLite(cmt.body) + '</div>' +
          '<div class="fr-comment-foot">' +
            voteColHtml(cmt.score, cmt.viewer_vote, true) +
            (p.is_locked ? '' : '<button type="button" class="fr-action fr-reply-btn"><i class="fas fa-reply"></i>Reply</button>') +
            '<button type="button" class="fr-action fr-c-report" title="Report comment"><i class="far fa-flag"></i></button>' +
          '</div>' +
          '<div class="fr-reply-slot"></div>' +
          (kids ? '<div class="fr-children">' + kids + '</div>' : '') +
        '</div>';
      }).join('');
    }
    el.innerHTML = '<div class="fr-comments-title">' + comments.length + ' comment' + (comments.length === 1 ? '' : 's') + '</div>' + renderLevel(0, 0);

    el.querySelectorAll('.fr-comment').forEach(function (node) {
      var cid = parseInt(node.getAttribute('data-id'), 10);
      var vote = node.querySelector(':scope > .fr-comment-foot .fr-vote');
      if (vote) bindVote(vote, 'comment', cid);
      var collapse = node.querySelector(':scope > .fr-comment-head .fr-collapse');
      if (collapse) collapse.onclick = function () {
        node.classList.toggle('collapsed');
        collapse.innerHTML = node.classList.contains('collapsed') ? '<i class="fas fa-plus"></i>' : '<i class="fas fa-minus"></i>';
      };
      var reportBtn = node.querySelector(':scope > .fr-comment-foot .fr-c-report');
      if (reportBtn) reportBtn.onclick = function () { reportContent('comment', cid, reportBtn); };
      var replyBtn = node.querySelector(':scope > .fr-comment-foot .fr-reply-btn');
      if (replyBtn) replyBtn.onclick = function () {
        var slot = node.querySelector(':scope > .fr-reply-slot');
        if (slot.innerHTML) { slot.innerHTML = ''; return; }
        slot.innerHTML = '<textarea class="fr-textarea" rows="3" maxlength="10000" placeholder="Write a reply…"></textarea>' +
          '<div class="fr-composer-foot"><button type="button" class="fr-btn fr-btn-ghost fr-cancel">Cancel</button>' +
          '<button type="button" class="fr-btn fr-btn-primary fr-send">Reply</button></div>';
        slot.querySelector('.fr-cancel').onclick = function () { slot.innerHTML = ''; };
        slot.querySelector('.fr-send').onclick = function () {
          var body = (slot.querySelector('textarea').value || '').trim();
          if (!body) { toast('Write a reply first.'); return; }
          if (!requireAuth('comment')) return;
          api('/api/forum/posts/' + p.id + '/comments', { method: 'POST', body: JSON.stringify({ body: body, parent_id: cid, author_name: displayName() }) })
            .then(function (r) { p.comments.push(r.comment); p.comment_count++; paintComments(p); toast('Reply posted'); })
            .catch(function (e) { if (e.status === 401) requireAuth('comment'); else toast(e.message || 'Could not post reply'); });
        };
        slot.querySelector('textarea').focus();
      };
    });
  }

  // One-tap topic starters: pre-fill the composer so a blank box never blocks
  // a first post. Each sets a community, a title stub, and an optional body
  // scaffold. Titles end with a space so the caret lands ready to type.
  var POST_STARTERS = [
    { label: 'Beginner question', icon: 'fa-circle-question', community: 'beginners', title: 'Beginner question: ', body: '' },
    { label: 'Share an experience', icon: 'fa-clipboard-check', community: 'general', title: 'My experience with ', body: 'Compound:\nDose & frequency:\nHow long:\nWhat I noticed:\nWhat I would change:\n' },
    { label: 'Dosing / timing', icon: 'fa-clock', community: 'protocols-stacks', title: 'Dosing question: ', body: '' },
    { label: 'Reconstitution help', icon: 'fa-flask', community: 'beginners', title: 'Reconstitution help: ', body: 'Vial size (mg):\nBAC water added (ml):\nTarget dose:\nWhat I am trying to figure out:\n' },
    { label: 'Side effects', icon: 'fa-triangle-exclamation', community: 'safety', title: 'Side effects of ', body: '' },
    { label: 'Compare two compounds', icon: 'fa-code-compare', community: 'general', title: ' vs ', body: 'What I am weighing them for:\nWhat I have found so far:\n' },
    { label: 'Share a study', icon: 'fa-microscope', community: 'research-news', title: 'Study: ', body: 'What it looked at:\nKey finding:\nWhy it matters (or does not):\n' },
    { label: 'Post a protocol', icon: 'fa-layer-group', community: 'protocols-stacks', title: 'My protocol: ', body: 'Goal:\nCompounds & doses:\nDuration:\nHow it is going:\n' },
  ];

  function applyStarter(s) {
    var t = document.getElementById('frcTitle');
    var body = document.getElementById('frcBody');
    var sel = document.getElementById('frcCommunity');
    if (sel && s.community && sel.querySelector('option[value="' + s.community + '"]')) sel.value = s.community;
    if (t) { t.value = s.title || ''; t.focus(); t.setSelectionRange(t.value.length, t.value.length); }
    if (body && s.body) body.value = s.body;
  }

  // ── create-post modal ─────────────────────────────────────
  function showComposer() {
    if (!requireAuth('post')) {
      // Logged-out reader (e.g. arrived from a KB "Ask the community" starter):
      // stash their draft so it survives signup - even an OAuth page redirect -
      // and reopens automatically once they're authed. See _resumePendingCompose.
      try {
        if (window.__forumComposePrefill) sessionStorage.setItem('rs_pending_compose', JSON.stringify(window.__forumComposePrefill));
      } catch (e) {}
      return;
    }
    var old = document.getElementById('frComposerModal');
    if (old) old.remove();
    var wrap = document.createElement('div');
    wrap.id = 'frComposerModal';
    wrap.className = 'fr-modal-overlay';
    var options = S.communities.filter(function (cm) { return cm.slug !== 'announcements'; }).map(function (cm) {
      return '<option value="' + esc(cm.slug) + '"' + (S.community === cm.slug ? ' selected' : '') + '>' + esc(cm.name) + '</option>';
    }).join('');
    wrap.innerHTML =
      '<div class="fr-modal" role="dialog" aria-modal="true" aria-label="Create post">' +
        '<div class="fr-modal-head"><h3><i class="fas fa-pen-to-square"></i> Create a post</h3>' +
          '<button type="button" class="fr-modal-close" aria-label="Close"><i class="fas fa-times"></i></button></div>' +
        '<div class="fr-type-tabs">' +
          '<button type="button" class="fr-type-tab active" data-type="text"><i class="fas fa-align-left"></i> Text</button>' +
          '<button type="button" class="fr-type-tab" data-type="link"><i class="fas fa-link"></i> Link</button>' +
        '</div>' +
        '<div class="fr-starters"><span class="fr-starters-label">Not sure where to start?</span>' +
          POST_STARTERS.map(function (s, i) { return '<button type="button" class="fr-starter" data-starter="' + i + '"><i class="fas ' + s.icon + '"></i>' + esc(s.label) + '</button>'; }).join('') +
        '</div>' +
        '<label class="fr-label">Community</label>' +
        '<select id="frcCommunity" class="fr-select">' + options + '</select>' +
        '<label class="fr-label">Title</label>' +
        '<input id="frcTitle" class="fr-input" maxlength="300" placeholder="An interesting, specific title">' +
        '<div id="frcBodyWrap"><label class="fr-label">Body</label>' +
          '<textarea id="frcBody" class="fr-textarea" rows="7" maxlength="40000" placeholder="Your text post. **bold** and [links](https://…) supported."></textarea>' +
          '<div class="fr-img-attach">' +
            '<button type="button" class="fr-btn fr-btn-ghost" id="frcImgBtn"><i class="fas fa-image"></i> Add image</button>' +
            '<input type="file" id="frcImgInput" accept="image/*" style="display:none">' +
            '<div id="frcImgPreview" style="display:none;position:relative;margin-top:8px">' +
              '<img id="frcImgPreviewImg" style="max-width:100%;max-height:220px;border-radius:10px;display:block">' +
              '<button type="button" id="frcImgRemove" title="Remove image" style="position:absolute;top:6px;right:6px;background:rgba(0,0,0,.6);color:#fff;border:none;border-radius:50%;width:26px;height:26px;cursor:pointer">×</button>' +
              '<div id="frcImgStatus" style="font-size:12px;color:var(--text-muted);margin-top:4px"></div>' +
            '</div>' +
          '</div></div>' +
        '<div id="frcUrlWrap" style="display:none"><label class="fr-label">URL</label>' +
          '<input id="frcUrl" class="fr-input" type="url" placeholder="https://…"></div>' +
        '<p class="fr-modal-note">Posting as <strong>' + esc(displayName()) + '</strong> · No sourcing · Not medical advice</p>' +
        '<div class="fr-composer-foot">' +
          '<button type="button" class="fr-btn fr-btn-ghost fr-modal-cancel">Cancel</button>' +
          '<button type="button" class="fr-btn fr-btn-primary" id="frcSubmit"><i class="fas fa-paper-plane"></i> Post</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(wrap);
    // Prefill handoff from KB compound pages ("Ask the community about X").
    var pre = window.__forumComposePrefill;
    var preBodyFilled = false;
    if (pre) {
      window.__forumComposePrefill = null;
      if (pre.title) document.getElementById('frcTitle').value = pre.title;
      if (pre.body) { document.getElementById('frcBody').value = pre.body; preBodyFilled = true; }
      if (pre.community) {
        var sel = document.getElementById('frcCommunity');
        if (sel && sel.querySelector('option[value="' + pre.community + '"]')) sel.value = pre.community;
      }
    }
    // Starter chips: one tap scaffolds the post (switches to Text if needed).
    wrap.querySelectorAll('.fr-starter').forEach(function (chip) {
      chip.onclick = function () {
        var s = POST_STARTERS[parseInt(chip.getAttribute('data-starter'), 10)];
        if (!s) return;
        if (type !== 'text') { type = 'text'; wrap.querySelectorAll('.fr-type-tab').forEach(function (x) { x.classList.toggle('active', x.getAttribute('data-type') === 'text'); }); document.getElementById('frcBodyWrap').style.display = ''; document.getElementById('frcUrlWrap').style.display = 'none'; }
        wrap.querySelectorAll('.fr-starter').forEach(function (x) { x.classList.toggle('active', x === chip); });
        applyStarter(s);
      };
    });
    var type = 'text';
    wrap.querySelectorAll('.fr-type-tab').forEach(function (b) {
      b.onclick = function () {
        type = b.getAttribute('data-type');
        wrap.querySelectorAll('.fr-type-tab').forEach(function (x) { x.classList.toggle('active', x === b); });
        document.getElementById('frcBodyWrap').style.display = type === 'text' ? '' : 'none';
        document.getElementById('frcUrlWrap').style.display = type === 'link' ? '' : 'none';
      };
    });
    function close() { wrap.remove(); }
    wrap.querySelector('.fr-modal-close').onclick = close;
    wrap.querySelector('.fr-modal-cancel').onclick = close;
    wrap.onclick = function (e) { if (e.target === wrap) close(); };
    // If we arrived with a ready-made question + scaffold, drop the cursor at the
    // end of the body so the reader just adds their specifics and posts.
    if (preBodyFilled) {
      var bodyEl = document.getElementById('frcBody');
      bodyEl.focus();
      bodyEl.setSelectionRange(bodyEl.value.length, bodyEl.value.length);
    } else {
      document.getElementById('frcTitle').focus();
    }

    // Image attach: resize client-side (keeps it under D1's size cap) and upload.
    var attachedImage = null;
    var imgBtn = document.getElementById('frcImgBtn');
    var imgInput = document.getElementById('frcImgInput');
    var imgPrev = document.getElementById('frcImgPreview');
    var imgStatus = document.getElementById('frcImgStatus');
    if (imgBtn) imgBtn.onclick = function () { imgInput.click(); };
    if (document.getElementById('frcImgRemove')) document.getElementById('frcImgRemove').onclick = function () {
      attachedImage = null; imgPrev.style.display = 'none'; imgInput.value = ''; imgBtn.style.display = '';
    };
    if (imgInput) imgInput.onchange = function () {
      var file = imgInput.files && imgInput.files[0];
      if (!file) return;
      var img = new Image();
      var reader = new FileReader();
      reader.onload = function () {
        img.onload = function () {
          // Resize longest side to 1200px, encode JPEG to stay well under 900KB.
          var max = 1200, w = img.width, h = img.height;
          if (w > h && w > max) { h = Math.round(h * max / w); w = max; }
          else if (h > max) { w = Math.round(w * max / h); h = max; }
          var canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          var dataUrl = canvas.toDataURL('image/jpeg', 0.82);
          document.getElementById('frcImgPreviewImg').src = dataUrl;
          imgPrev.style.display = ''; imgBtn.style.display = 'none';
          imgStatus.textContent = 'Uploading…';
          api('/api/forum/upload-image', { method: 'POST', body: JSON.stringify({ data: dataUrl }) })
            .then(function (r) { attachedImage = r.url; imgStatus.textContent = 'Image attached ✓'; })
            .catch(function (e) { imgStatus.textContent = e.message || 'Upload failed'; attachedImage = null; });
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    };

    document.getElementById('frcSubmit').onclick = function () {
      var btn = this;
      var title = document.getElementById('frcTitle').value.trim();
      var body = document.getElementById('frcBody').value;
      var url = document.getElementById('frcUrl').value.trim();
      var community = document.getElementById('frcCommunity').value;
      if (title.length < 3) { toast('Title must be at least 3 characters.'); return; }
      if (type === 'text' && !body.trim() && !attachedImage) { toast('Add some text or an image.'); return; }
      if (type === 'link' && !/^https?:\/\//i.test(url)) { toast('Link posts need a valid http(s) URL.'); return; }
      btn.disabled = true;
      api('/api/forum/posts', {
        method: 'POST',
        body: JSON.stringify({ title: title, body: type === 'text' ? body : '', link_url: type === 'link' ? url : null, image_url: type === 'text' ? attachedImage : null, post_type: type, community: community, author_name: displayName() })
      }).then(function (r) {
        close();
        toast('Posted!');
        openPost(r.post.id);
      }).catch(function (e) {
        btn.disabled = false;
        if (e.status === 401) { close(); requireAuth('post'); }
        else toast(e.message || 'Could not create post');
      });
    };
  }

  // Delegated composer trigger: robust against view re-renders/transitions.
  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('#frCreateBtn, #frComposerOpen')) {
      e.preventDefault();
      showComposer();
    }
  });

  // ── exports / router hooks ────────────────────────────────
  var _lastForumView = null;
  window._forumRender = function (view, data, area) {
    _lastForumView = { view: view, data: data, area: area };
    if (view === 'forum-post') { renderForumPost(area, data); return; }
    if (view === 'profile') { renderProfile(area, data); return; }
    // /community/<slug> deep-links preset the community filter. Reset the
    // search when the board changes so a stale query never leaks across hubs.
    var nextCommunity = (typeof data === 'string' && data) ? data : '';
    if (nextCommunity !== S.community) S.q = '';
    S.community = nextCommunity;
    renderForumHome(area);
  };
  // Called by the app on ANY auth state change (sign in / sign out). Drop the
  // cached viewer identity and re-render the current forum view so admin-gated
  // controls (Delete, Pin, Lock) match the new auth state immediately - a
  // signed-out admin must not keep seeing delete buttons on stale cards.
  window._forumOnAuth = function () {
    S.me = signedIn() ? undefined : null;
    if (!_lastForumView) return;
    var area = _lastForumView.area && document.body.contains(_lastForumView.area)
      ? _lastForumView.area : document.getElementById('contentArea');
    if (!area || !area.querySelector('.fr-wrap')) return; // forum not on screen
    fetchMe().then(function () { window._forumRender(_lastForumView.view, _lastForumView.data, area); });
  };
  // Country list for the picker (mirrors SELECTABLE_COUNTRIES on the server).
  // Flags are derived from the ISO-2 code via regional-indicator symbols.
  var COUNTRIES = [
    ['US','United States'],['GB','United Kingdom'],['CA','Canada'],['AU','Australia'],['IE','Ireland'],['NZ','New Zealand'],
    ['DE','Germany'],['FR','France'],['NL','Netherlands'],['SE','Sweden'],['NO','Norway'],['DK','Denmark'],['FI','Finland'],['PL','Poland'],
    ['ES','Spain'],['IT','Italy'],['PT','Portugal'],['CH','Switzerland'],['AT','Austria'],['BE','Belgium'],['CZ','Czechia'],['GR','Greece'],
    ['RO','Romania'],['HU','Hungary'],['UA','Ukraine'],['RU','Russia'],['TR','Turkey'],['HR','Croatia'],['RS','Serbia'],['SK','Slovakia'],['BG','Bulgaria'],['IS','Iceland'],
    ['BR','Brazil'],['MX','Mexico'],['AR','Argentina'],['CL','Chile'],['CO','Colombia'],['PE','Peru'],
    ['JP','Japan'],['KR','South Korea'],['CN','China'],['IN','India'],['SG','Singapore'],['PH','Philippines'],['ID','Indonesia'],
    ['TH','Thailand'],['VN','Vietnam'],['MY','Malaysia'],['HK','Hong Kong'],['TW','Taiwan'],['PK','Pakistan'],['BD','Bangladesh'],
    ['ZA','South Africa'],['NG','Nigeria'],['EG','Egypt'],['KE','Kenya'],['MA','Morocco'],['IL','Israel'],['AE','UAE'],['SA','Saudi Arabia']
  ];
  function codeToFlag(code) {
    if (!/^[A-Za-z]{2}$/.test(code || '')) return '';
    return String.fromCodePoint.apply(null, code.toUpperCase().split('').map(function (ch) { return 0x1F1E6 + ch.charCodeAt(0) - 65; }));
  }
  function countrySelectHtml(id, selected) {
    return '<select id="' + id + '" class="fr-input" style="flex:1;min-width:0">' +
      '<option value="">— No country —</option>' +
      COUNTRIES.map(function (c) {
        return '<option value="' + c[0] + '"' + (c[0] === (selected || '') ? ' selected' : '') + '>' + codeToFlag(c[0]) + ' ' + c[1] + '</option>';
      }).join('') + '</select>';
  }

  // Author names link to /u/<name> profiles when the handle can have one
  // (skips multi-word/system names like "ResearchSafe AI" and anonymous).
  // A country flag (if known) is shown right after the name.
  function authorLink(name, flag) {
    var n = String(name || '');
    var f = flag ? ' <span class="fr-flag" title="Country">' + flag + '</span>' : '';
    if (!/^[A-Za-z0-9_-]{3,20}$/.test(n) || /^(anonymous|deleted|system)$/i.test(n)) {
      return '<span class="fr-author">' + esc(n) + '</span>' + f;
    }
    return '<a class="fr-author" href="/u/' + encodeURIComponent(n) + '" onclick="event.stopPropagation()">' + esc(n) + '</a>' + f;
  }

  // ── public profile view (/u/<username>) ───────────────────
  function renderProfile(area, username) {
    area.innerHTML = '<div class="fr-wrap"><div class="fr-empty"><i class="fas fa-spinner fa-spin"></i><p>Loading profile…</p></div></div>';
    api('/api/forum/user/' + encodeURIComponent(username))
      .then(function (pr) {
        var initial = (pr.username || '?').charAt(0).toUpperCase();
        var aiBadge = pr.is_ai ? ' <span class="fr-ai-badge" title="Clearly-labeled AI community member">AI</span>' : '';
        function ago(iso) {
          var t = parseTs(iso);
          if (!t) return '';
          var s = Math.max(0, (Date.now() - t) / 1000);
          if (s < 60) return 'just now';
          if (s < 3600) return Math.max(1, Math.floor(s / 60)) + 'm ago';
          if (s < 86400) return Math.floor(s / 3600) + 'h ago';
          if (s < 2592000) return Math.floor(s / 86400) + 'd ago';
          if (s < 31536000) return Math.floor(s / 2592000) + 'mo ago';
          return Math.floor(s / 31536000) + 'y ago';
        }
        var posts = pr.posts || [], comments = pr.comments || [];
        area.innerHTML =
          '<div class="fr-wrap"><div class="fr-main" style="max-width:820px;margin:0 auto">' +
          '<div class="fr-card" style="padding:18px;display:flex;gap:14px;align-items:center;margin-bottom:14px">' +
            '<div style="width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#14b8a6,#6366f1);display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:800;color:#fff;flex-shrink:0">' + esc(initial) + '</div>' +
            '<div style="min-width:0">' +
              '<h1 style="margin:0;font-size:20px">u/' + esc(pr.username) + (pr.flag ? ' <span class="fr-flag" style="font-size:18px">' + pr.flag + '</span>' : '') + aiBadge + '</h1>' +
              (pr.bio ? '<p class="fr-meta-dim" style="margin:3px 0 0">' + esc(pr.bio) + '</p>' : '') +
              '<p class="fr-meta-dim" style="margin:4px 0 0"><i class="fas fa-bolt"></i> ' + (pr.karma && pr.karma.total || 0) + ' karma · <span class="fr-flair-badge">' + esc(pr.flair || '') + '</span>' + (pr.joined ? ' · joined ' + ago(pr.joined) : '') + '</p>' +
            '</div>' +
          '</div>' +
          '<h2 style="font-size:15px;margin:0 0 8px">Posts (' + posts.length + ')</h2>' +
          (posts.length ? posts.map(function (p) {
            return '<a class="fr-teaser-row" href="/forum/' + p.id + '" style="display:flex;gap:10px;align-items:center">' +
              '<span class="fr-teaser-score"><i class="fas fa-arrow-up"></i>' + (p.score || 0) + '</span>' +
              '<span class="fr-teaser-title">' + esc(p.title) + '</span>' +
              '<span class="fr-teaser-meta">' + (p.comment_count || 0) + ' <i class="far fa-comment"></i> · ' + ago(p.created_at) + '</span></a>';
          }).join('') : '<p class="fr-meta-dim">No posts yet.</p>') +
          '<h2 style="font-size:15px;margin:16px 0 8px">Recent comments (' + comments.length + ')</h2>' +
          (comments.length ? comments.map(function (cm) {
            return '<a class="fr-teaser-row" href="/forum/' + cm.post_id + '" style="display:block">' +
              '<span class="fr-teaser-meta">on "' + esc(cm.post_title) + '" · ' + ago(cm.created_at) + '</span><br>' +
              '<span class="fr-teaser-title" style="font-weight:400">' + esc(cm.snippet || '') + '</span></a>';
          }).join('') : '<p class="fr-meta-dim">No comments yet.</p>') +
          '<p style="margin-top:16px"><a href="/community" class="fr-linklike"><i class="fas fa-arrow-left"></i> Back to the forum</a></p>' +
          '</div></div>';
      })
      .catch(function () {
        area.innerHTML = '<div class="fr-wrap"><div class="fr-empty"><i class="far fa-face-frown"></i><p>No researcher named u/' + esc(username) + ' here.</p><button type="button" class="fr-btn fr-btn-primary" onclick="navigate(\'community\')">Browse the forum</button></div></div>';
      });
  }
  window._forumCompose = showComposer;
  window._forumOpenPost = openPost;
  // The sticky welcome post's id differs per environment — find it live.
  window._forumOpenWelcome = function () {
    var pinned = S.posts.filter(function (p) { return p.is_pinned; })[0];
    if (pinned) { openPost(pinned.id); return; }
    api('/api/forum/posts?sort=hot&limit=5').then(function (r) {
      var pin = ((r && r.posts) || []).filter(function (p) { return p.is_pinned; })[0];
      if (pin) openPost(pin.id);
    }).catch(function () {});
  };
})();
