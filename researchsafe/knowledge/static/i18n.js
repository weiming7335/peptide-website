/* ============================================================
   i18n.js - Site-wide translation via Google Translate.
   We load Google's widget into a hidden mount and drive it from
   our own styled language picker, so the UI matches the design.
   The chosen language persists across reloads via the googtrans
   cookie (which the widget reads on load) + localStorage.
   ============================================================ */
(function () {
  'use strict';

  var STORAGE_KEY = 'rs-lang';
  var SOURCE_LANG = 'en';

  // Quick-pick languages surfaced at the top, then the full list below.
  var QUICK = ['es', 'pt', 'fr', 'de', 'zh-CN', 'ja', 'ar', 'hi'];

  var LANGS = [
    { code: 'en', name: 'English', native: 'English', flag: '🇬🇧' },
    { code: 'es', name: 'Spanish', native: 'Español', flag: '🇪🇸' },
    { code: 'pt', name: 'Portuguese', native: 'Português', flag: '🇧🇷' },
    { code: 'fr', name: 'French', native: 'Français', flag: '🇫🇷' },
    { code: 'de', name: 'German', native: 'Deutsch', flag: '🇩🇪' },
    { code: 'zh-CN', name: 'Chinese (Simplified)', native: '简体中文', flag: '🇨🇳' },
    { code: 'zh-TW', name: 'Chinese (Traditional)', native: '繁體中文', flag: '🇹🇼' },
    { code: 'ja', name: 'Japanese', native: '日本語', flag: '🇯🇵' },
    { code: 'ko', name: 'Korean', native: '한국어', flag: '🇰🇷' },
    { code: 'ar', name: 'Arabic', native: 'العربية', flag: '🇸🇦' },
    { code: 'hi', name: 'Hindi', native: 'हिन्दी', flag: '🇮🇳' },
    { code: 'ru', name: 'Russian', native: 'Русский', flag: '🇷🇺' },
    { code: 'it', name: 'Italian', native: 'Italiano', flag: '🇮🇹' },
    { code: 'nl', name: 'Dutch', native: 'Nederlands', flag: '🇳🇱' },
    { code: 'pl', name: 'Polish', native: 'Polski', flag: '🇵🇱' },
    { code: 'tr', name: 'Turkish', native: 'Türkçe', flag: '🇹🇷' },
    { code: 'vi', name: 'Vietnamese', native: 'Tiếng Việt', flag: '🇻🇳' },
    { code: 'th', name: 'Thai', native: 'ไทย', flag: '🇹🇭' },
    { code: 'id', name: 'Indonesian', native: 'Bahasa Indonesia', flag: '🇮🇩' },
    { code: 'ms', name: 'Malay', native: 'Bahasa Melayu', flag: '🇲🇾' },
    { code: 'fa', name: 'Persian', native: 'فارسی', flag: '🇮🇷' },
    { code: 'he', name: 'Hebrew', native: 'עברית', flag: '🇮🇱' },
    { code: 'uk', name: 'Ukrainian', native: 'Українська', flag: '🇺🇦' },
    { code: 'el', name: 'Greek', native: 'Ελληνικά', flag: '🇬🇷' },
    { code: 'sv', name: 'Swedish', native: 'Svenska', flag: '🇸🇪' },
    { code: 'no', name: 'Norwegian', native: 'Norsk', flag: '🇳🇴' },
    { code: 'da', name: 'Danish', native: 'Dansk', flag: '🇩🇰' },
    { code: 'fi', name: 'Finnish', native: 'Suomi', flag: '🇫🇮' },
    { code: 'cs', name: 'Czech', native: 'Čeština', flag: '🇨🇿' },
    { code: 'ro', name: 'Romanian', native: 'Română', flag: '🇷🇴' },
    { code: 'hu', name: 'Hungarian', native: 'Magyar', flag: '🇭🇺' },
    { code: 'bn', name: 'Bengali', native: 'বাংলা', flag: '🇧🇩' },
    { code: 'ur', name: 'Urdu', native: 'اردو', flag: '🇵🇰' },
    { code: 'ta', name: 'Tamil', native: 'தமிழ்', flag: '🇮🇳' },
    { code: 'te', name: 'Telugu', native: 'తెలుగు', flag: '🇮🇳' },
    { code: 'fil', name: 'Filipino', native: 'Filipino', flag: '🇵🇭' },
    { code: 'sw', name: 'Swahili', native: 'Kiswahili', flag: '🇰🇪' },
  ];

  var byCode = {};
  LANGS.forEach(function (l) { byCode[l.code] = l; });

  // ---- Cookie helpers (Google reads `googtrans=/source/target`) ----
  function setTransCookie(target) {
    var val = target === SOURCE_LANG ? '' : '/' + SOURCE_LANG + '/' + target;
    var host = location.hostname;
    var bases = ['googtrans=' + val + ';path=/;'];
    // Set for both bare host and the dotted root so subdomains agree.
    var attrs = 'path=/;';
    document.cookie = 'googtrans=' + val + ';' + attrs;
    document.cookie = 'googtrans=' + val + ';' + attrs + 'domain=' + host + ';';
    var parts = host.split('.');
    if (parts.length > 1) {
      document.cookie = 'googtrans=' + val + ';' + attrs + 'domain=.' + parts.slice(-2).join('.') + ';';
    }
  }

  function getStored() {
    try { return localStorage.getItem(STORAGE_KEY) || SOURCE_LANG; } catch (e) { return SOURCE_LANG; }
  }
  function store(code) {
    try { localStorage.setItem(STORAGE_KEY, code); } catch (e) {}
  }

  // ---- Google widget bootstrap ----
  var widgetLoaded = false;
  window.googleTranslateElementInit = function () {
    if (!window.google || !window.google.translate) return;
    /* eslint-disable no-new */
    new window.google.translate.TranslateElement(
      { pageLanguage: SOURCE_LANG, autoDisplay: false },
      'google_translate_element'
    );
    widgetLoaded = true;
  };

  function loadWidget(cb) {
    if (widgetLoaded) { cb && cb(); return; }
    if (document.getElementById('rs-gtranslate-script')) {
      // already loading; poll for readiness
      var tries = 0;
      var iv = setInterval(function () {
        if (widgetLoaded || ++tries > 40) { clearInterval(iv); cb && cb(); }
      }, 150);
      return;
    }
    var s = document.createElement('script');
    s.id = 'rs-gtranslate-script';
    s.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
    s.onerror = function () { cb && cb(); };
    document.head.appendChild(s);
    var t = 0;
    var poll = setInterval(function () {
      if (widgetLoaded || ++t > 60) { clearInterval(poll); cb && cb(); }
    }, 150);
  }

  // Apply a target language by driving the hidden Google <select>.
  function applyViaSelect(code, attempt) {
    attempt = attempt || 0;
    var combo = document.querySelector('select.goog-te-combo');
    if (combo) {
      combo.value = code === SOURCE_LANG ? '' : code;
      combo.dispatchEvent(new Event('change'));
      return true;
    }
    if (attempt < 30) {
      setTimeout(function () { applyViaSelect(code, attempt + 1); }, 200);
    }
    return false;
  }

  function setLanguage(code) {
    store(code);
    setTransCookie(code);
    updateLabel(code);
    highlightActive(code);
    if (code === SOURCE_LANG) {
      // Easiest reliable way back to original is a reload with cleared cookie.
      location.reload();
      return;
    }
    loadWidget(function () { applyViaSelect(code); });
  }

  function updateLabel(code) {
    var l = byCode[code] || byCode[SOURCE_LANG];
    var el = document.getElementById('rsLangLabel');
    if (el) el.textContent = code === SOURCE_LANG ? 'Language' : l.name;
  }

  // ---- Picker UI ----
  function langItem(l, activeCode) {
    var active = l.code === activeCode ? ' active' : '';
    return '<button class="rs-lang-item' + active + '" data-code="' + l.code + '" onclick="window.__rsPickLang(\'' + l.code + '\')">' +
      '<span class="rs-lang-flag">' + l.flag + '</span>' +
      '<span class="rs-lang-name">' + l.name + '</span>' +
      '<span class="rs-lang-native">' + l.native + '</span>' +
      '<i class="fas fa-check rs-lang-check"></i></button>';
  }

  function buildList(filter) {
    var list = document.getElementById('rsLangList');
    if (!list) return;
    var active = getStored();
    var q = (filter || '').trim().toLowerCase();
    var match = function (l) {
      if (!q) return true;
      return l.name.toLowerCase().indexOf(q) >= 0 ||
        (l.native && l.native.toLowerCase().indexOf(q) >= 0) ||
        l.code.toLowerCase().indexOf(q) >= 0;
    };
    var html = '';
    if (!q) {
      html += '<div class="rs-lang-group-title">Suggested</div>';
      html += langItem(byCode.en, active);
      QUICK.forEach(function (c) { if (byCode[c]) html += langItem(byCode[c], active); });
      html += '<div class="rs-lang-group-title">All languages</div>';
      LANGS.forEach(function (l) {
        if (l.code === 'en' || QUICK.indexOf(l.code) >= 0) return;
        html += langItem(l, active);
      });
    } else {
      var hits = LANGS.filter(match);
      html = hits.length ? hits.map(function (l) { return langItem(l, active); }).join('')
        : '<div style="padding:24px 12px;text-align:center;color:#7F7A6E;font-size:13px">No languages match.</div>';
    }
    list.innerHTML = html;
  }

  function highlightActive(code) {
    document.querySelectorAll('.rs-lang-item').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-code') === code);
    });
  }

  window.__rsPickLang = function (code) {
    setLanguage(code);
    closePicker();
  };

  window.openLanguagePicker = function () {
    var ov = document.getElementById('rsLangOverlay');
    if (!ov) return;
    buildList('');
    var search = document.getElementById('rsLangSearch');
    if (search) search.value = '';
    ov.classList.add('open');
    document.body.style.overflow = 'hidden';
    // Warm up the widget so the first switch is snappy.
    loadWidget();
    setTimeout(function () { search && search.focus(); }, 60);
  };

  function closePicker() {
    var ov = document.getElementById('rsLangOverlay');
    if (!ov) return;
    ov.classList.remove('open');
    document.body.style.overflow = '';
  }
  window.closeLanguagePicker = function (e) {
    if (e && e.target && e.target.id && e.target.id !== 'rsLangOverlay') return;
    closePicker();
  };

  window.filterLanguages = function () {
    var s = document.getElementById('rsLangSearch');
    buildList(s ? s.value : '');
  };

  // Esc closes the picker.
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closePicker();
  });

  // ---- On load: restore previously chosen language ----
  function init() {
    var saved = getStored();
    updateLabel(saved);
    if (saved && saved !== SOURCE_LANG) {
      setTransCookie(saved);
      loadWidget(function () { applyViaSelect(saved); });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose for the mobile More sheet entry.
  window.rsLanguages = { open: window.openLanguagePicker, set: setLanguage, current: getStored };
})();
