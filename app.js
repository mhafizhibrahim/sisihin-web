/* ==========================================================================
   Sisihin — website + replika interaktif aplikasi (vanilla JavaScript)
   ========================================================================== */

(function () {
  'use strict';

  var RELEASE_API = 'https://api.github.com/repos/mhafizhibrahim/sisihin/releases/latest';
  var RELEASE_PAGE = 'https://github.com/mhafizhibrahim/sisihin/releases/latest';
  var FALLBACK_VERSION = '1.1.3'; // fallback = tag rilis GitHub terbaru saat ini (app/build.gradle.kts -> versionName)
  var FALLBACK_CHANGELOG = 'Perbaikan bug dan peningkatan performa.'; // UpdateChecker.kt

  var $ = function (id) { return document.getElementById(id); };
  var all = function (selector) { return Array.prototype.slice.call(document.querySelectorAll(selector)); };
  var number = function (value) { return Math.round(value).toLocaleString('id-ID'); };
  var digitsOf = function (text) { return parseInt(String(text).replace(/\D/g, ''), 10) || 0; };
  var clamp = function (value, min, max) { return Math.max(min, Math.min(max, value)); };
  var make = function (tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  };

  /* ---------- Tema website (instan) ---------- */

  function currentTheme() {
    return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  }

  var inAppThemeMode = 'dark';

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('sisihin-theme', theme); } catch (e) {}
    all('[data-theme-choice]').forEach(function (button) {
      button.setAttribute('aria-pressed', String(button.getAttribute('data-theme-choice') === theme));
    });
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#000000' : '#ffffff');
    if (inAppThemeMode === 'system') applyAppTheme('system');
  }

  all('[data-theme-choice]').forEach(function (button) {
    button.addEventListener('click', function () {
      applyTheme(button.getAttribute('data-theme-choice'));
    });
  });

  /* ---------- Model data simulasi ---------- */

  var FREQUENCIES = [
    { label: 'Harian', unit: 'Hari', lower: 'hari', days: 1, quick: [7, 14, 30, 90] },
    { label: 'Mingguan', unit: 'Minggu', lower: 'minggu', days: 7, quick: [4, 8, 12, 24] },
    { label: 'Bulanan', unit: 'Bulan', lower: 'bulan', days: 30, quick: [3, 6, 12, 24] }
  ];

  var CURRENCIES = [
    { code: 'IDR', symbol: 'Rp', label: 'Indonesia Rupiah (Rp)' },
    { code: 'USD', symbol: '$', label: 'US Dollar ($)' },
    { code: 'JPY', symbol: '¥', label: 'Japanese Yen (¥)' },
    { code: 'EUR', symbol: '€', label: 'Euro (€)' },
    { code: 'SGD', symbol: 'S$', label: 'Singapore Dollar (S$)' },
    { code: 'MYR', symbol: 'RM', label: 'Malaysian Ringgit (RM)' },
    { code: 'KRW', symbol: '₩', label: 'South Korean Won (₩)' },
    { code: 'GBP', symbol: '£', label: 'British Pound (£)' },
    { code: 'AUD', symbol: 'A$', label: 'Australian Dollar (A$)' },
    { code: 'SAR', symbol: '﷼', label: 'Saudi Riyal (﷼)' }
  ];

  var MAX_GOALS = 5;
  var goals = [];
  var currentGoalId = null;
  var currentTab = 0;
  var formMode = 'create';
  var formEditingId = null;
  var formCurrency = 'IDR';
  var formFreq = 0;
  var recordMode = 'deposit';
  var snackUndo = null;
  var snackTimer = null;
  var snackHideTimer = null;
  var latestVersion = FALLBACK_VERSION; // satu state global versi, dipakai semua tampilan di simulasi
  var RING_CIRCUMFERENCE = 2 * Math.PI * 25; // detail ring: r=25 di viewBox 56

  function money(value, symbol) {
    return (symbol || 'Rp') + number(value);
  }

  function goalMoney(goal, value) {
    var currency = CURRENCIES.filter(function (item) { return item.code === goal.currency; })[0] || CURRENCIES[0];
    return money(value, currency.symbol);
  }

  function initialsOf(name) {
    var words = String(name).trim().split(/\s+/);
    return (words[0] && words.length > 1 ? words[0][0] + words[1][0] : String(name).slice(0, 2)).toUpperCase();
  }

  function makeHistory(type, amount, note) {
    return {
      type: type,
      amount: amount,
      note: note || (type === 'deposit' ? 'Setoran' : 'Penarikan'),
      date: new Date()
    };
  }

  function seedGoals() {
    goals = [
      {
        id: 'keyboard', title: 'Keyboard', target: 500000, collected: 205000,
        plan: 15000, freq: 0, currency: 'IDR', created: '1 Jan 2026', reminder: true, achieved: false,
        history: [
          makeHistory('deposit', 100000, 'Setoran'),
          makeHistory('deposit', 55000, 'Uang sisa'),
          makeHistory('deposit', 50000, 'Setoran')
        ]
      },
      {
        id: 'sepatu', title: 'Sepatu Lari', target: 750000, collected: 300000,
        plan: 25000, freq: 0, currency: 'IDR', created: '12 Jan 2026', reminder: true, achieved: false,
        history: [makeHistory('deposit', 200000, 'Setoran'), makeHistory('deposit', 100000, 'Bonus')]
      },
      {
        id: 'headset', title: 'Headset TWS', target: 350000, collected: 350000,
        plan: 0, freq: 0, currency: 'IDR', created: '3 Nov 2025', reminder: false, achieved: true,
        history: [makeHistory('deposit', 350000, 'Target tercapai')]
      }
    ];
  }

  function getGoal(id) {
    return goals.filter(function (goal) { return goal.id === id; })[0] || null;
  }

  function percentOf(goal) {
    return goal.target > 0 ? clamp(Math.round((goal.collected / goal.target) * 100), 0, 100) : 0;
  }

  function planText(goal) {
    var suffix = ['Perhari', 'Perminggu', 'Perbulan'][goal.freq];
    return goal.plan > 0 ? goalMoney(goal, goal.plan) + ' ' + suffix : 'Belum ada rencana';
  }

  function daysText(goal) {
    var remaining = Math.max(0, goal.target - goal.collected);
    if (remaining === 0) return 'Target Tercapai';
    var perPeriod = goal.plan > 0 ? goal.plan : 1;
    var periods = Math.ceil(remaining / perPeriod);
    var days = periods * FREQUENCIES[goal.freq].days;
    if (days <= 1) return '1 Hari Lagi';
    return number(days) + ' Hari Lagi';
  }

  /* ---------- Navigasi layar di dalam HP ---------- */

  var SCREENS = ['screen-tabungan', 'screen-tercapai', 'screen-pengaturan'];

  /* Tutup semua overlay (termasuk snackbar) supaya tidak pernah bertumpuk saat pindah layar. */
  function closeAllOverlays() {
    all('.app-overlay').forEach(function (overlay) {
      overlay.hidden = true;
      overlay.classList.remove('is-visible');
    });
    if (snackTimer) { clearTimeout(snackTimer); snackTimer = null; }
    if (snackHideTimer) { clearTimeout(snackHideTimer); snackHideTimer = null; }
    snackUndo = null;
  }

  function showOnly(screenId) {
    all('.app-screen').forEach(function (screen) {
      screen.hidden = screen.id !== screenId;
    });
  }

  function showTab(index) {
    currentTab = index;
    currentGoalId = null;
    closeAllOverlays();
    showOnly(SCREENS[index]);
    $('app-bottomnav').hidden = false;
    all('[data-nav-tab]').forEach(function (button) {
      button.setAttribute('aria-pressed', String(parseInt(button.getAttribute('data-nav-tab'), 10) === index));
    });
    renderHome();
  }

  function showDetail(id) {
    currentGoalId = id;
    closeAllOverlays();
    showOnly('screen-detail');
    $('app-bottomnav').hidden = true;
    renderDetail();
  }

  function showForm(mode, id) {
    formMode = mode;
    formEditingId = id || null;
    closeAllOverlays();
    showOnly('screen-form');
    $('app-bottomnav').hidden = true;
    renderForm();
  }

  all('[data-nav-tab]').forEach(function (button) {
    button.addEventListener('click', function () {
      showTab(parseInt(button.getAttribute('data-nav-tab'), 10));
    });
  });

  /* ---------- Tema di dalam HP ---------- */

  function applyAppTheme(mode) {
    inAppThemeMode = mode;
    var resolved = mode === 'system' ? currentTheme() : mode;
    $('phone-screen').setAttribute('data-phone-theme', resolved);
    all('[data-inapp-theme]').forEach(function (button) {
      button.setAttribute('aria-pressed', String(button.getAttribute('data-inapp-theme') === mode));
    });
  }

  all('[data-inapp-theme]').forEach(function (button) {
    button.addEventListener('click', function () {
      applyAppTheme(button.getAttribute('data-inapp-theme'));
    });
  });

  /* ---------- Overlay (dialog, sheet, snackbar) ---------- */

  function openOverlay(id) {
    var overlay = $(id);
    if (overlay) overlay.hidden = false;
  }

  function closeOverlay(id) {
    var overlay = $(id);
    if (overlay) overlay.hidden = true;
  }

  function hideSnack() {
    var overlay = $('overlay-snack');
    overlay.classList.remove('is-visible');
    if (snackHideTimer) clearTimeout(snackHideTimer);
    snackHideTimer = setTimeout(function () {
      overlay.hidden = true;
      snackUndo = null;
    }, 160);
  }

  function openSnack(text, undo) {
    var overlay = $('overlay-snack');
    if (snackTimer) clearTimeout(snackTimer);
    if (snackHideTimer) clearTimeout(snackHideTimer);
    $('snack-text').textContent = text;
    snackUndo = typeof undo === 'function' ? undo : null;
    $('snack-action').hidden = !snackUndo;
    if (overlay.hidden) {
      overlay.hidden = false;
      void overlay.offsetWidth; // paksa reflow agar transisi masuk tetap jalan
    }
    overlay.classList.add('is-visible');
    // Notifikasi lama langsung ditimpa; tidak pernah menumpuk.
    snackTimer = setTimeout(hideSnack, snackUndo ? 3500 : 2500);
  }

  all('[data-close-overlay]').forEach(function (backdrop) {
    backdrop.addEventListener('click', function () {
      closeOverlay(backdrop.parentElement.id);
    });
  });

  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;
    var open = all('.app-overlay:not(#overlay-snack)').filter(function (overlay) { return !overlay.hidden; });
    if (open.length) closeOverlay(open[open.length - 1].id);
  });

  $('snack-action').addEventListener('click', function () {
    if (snackUndo) snackUndo();
  });

  /* ---------- Tabungan & Tercapai ---------- */

  function goalCard(goal) {
    var card = make('button', 'goal-card');
    card.type = 'button';
    var thumb = make('span', 'goal-thumb', initialsOf(goal.title));
    var info = make('span', 'goal-info');
    var header = make('span', 'goal-info-header');
    header.appendChild(make('strong', null, goal.title));
    header.appendChild(make('span', null, percentOf(goal) + '%'));
    info.appendChild(header);
    info.appendChild(make('span', 'goal-money', goalMoney(goal, goal.collected) + ' / ' + goalMoney(goal, goal.target)));
    info.appendChild(make('span', 'goal-plan', daysText(goal)));
    var bar = make('span', 'progress-line');
    var fill = make('span');
    fill.style.width = percentOf(goal) + '%';
    bar.appendChild(fill);
    info.appendChild(bar);
    card.appendChild(thumb);
    card.appendChild(info);
    card.addEventListener('click', function () { showDetail(goal.id); });
    return card;
  }

  function renderHome() {
    var ongoing = goals.filter(function (goal) { return !goal.achieved; });
    var achieved = goals.filter(function (goal) { return goal.achieved; });
    var total = ongoing.reduce(function (sum, goal) { return sum + goal.collected; }, 0);
    $('summary-total').textContent = money(total);
    $('summary-count').textContent = String(ongoing.length);

    var list = $('goal-list');
    list.textContent = '';
    if (!ongoing.length) list.appendChild(make('p', 'goal-empty', 'Belum ada tabungan berjalan. Ketuk + untuk membuat celengan.'));
    else ongoing.forEach(function (goal) { list.appendChild(goalCard(goal)); });

    var done = $('achieved-list');
    done.textContent = '';
    if (!achieved.length) done.appendChild(make('p', 'goal-empty', 'Belum ada tabungan yang tercapai.'));
    else achieved.forEach(function (goal) { done.appendChild(goalCard(goal)); });
  }

  /* ---------- Detail celengan ---------- */

  function renderDetail() {
    var goal = getGoal(currentGoalId);
    if (!goal) { showTab(0); return; }
    var percent = percentOf(goal);
    var remaining = Math.max(0, goal.target - goal.collected);

    $('detail-title').textContent = goal.title;
    $('detail-initials').textContent = initialsOf(goal.title);
    $('detail-target').textContent = goalMoney(goal, goal.target);
    $('detail-plan').textContent = planText(goal);
    $('detail-percent').textContent = percent + '%';
    $('detail-ring').setAttribute('stroke-dasharray', RING_CIRCUMFERENCE.toFixed(2));
    $('detail-ring').setAttribute('stroke-dashoffset', (RING_CIRCUMFERENCE * (1 - percent / 100)).toFixed(2));
    $('detail-estimate').textContent = daysText(goal);
    $('detail-collected').textContent = goalMoney(goal, goal.collected);
    $('detail-remaining').textContent = goalMoney(goal, remaining);
    $('detail-reminder').setAttribute('aria-checked', String(!!goal.reminder));
    $('detail-withdraw').disabled = goal.collected <= 0;

    var readOnly = !!goal.achieved;
    $('detail-actions').hidden = readOnly;
    $('detail-celebration').hidden = !readOnly;
    $('detail-edit').hidden = readOnly;
    $('detail-delete').hidden = readOnly;
    $('history-label').textContent = readOnly ? 'RIWAYAT TABUNGAN (ARSIP)' : 'RIWAYAT TABUNGAN';

    var chips = $('detail-chips');
    chips.textContent = '';
    [15000, 30000, 45000].forEach(function (amount) {
      var chip = make('button', null, number(amount));
      chip.type = 'button';
      chip.addEventListener('click', function () {
        addTransaction('deposit', amount, 'Setoran cepat');
      });
      chips.appendChild(chip);
    });

    var history = $('detail-history');
    history.textContent = '';
    if (!goal.history.length) {
      history.appendChild(make('p', 'history-empty', 'Belum ada transaksi tercatat.'));
    } else {
      goal.history.slice().reverse().forEach(function (item) {
        var row = make('div', 'history-row');
        var left = make('span', null, item.note + ' • ' + new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(item.date));
        var value = make('strong', item.type === 'deposit' ? 'text-green' : 'text-red', (item.type === 'deposit' ? '+' : '-') + goalMoney(goal, item.amount));
        row.appendChild(left);
        row.appendChild(value);
        history.appendChild(row);
      });
    }
  }

  function addTransaction(type, amount, note) {
    var goal = getGoal(currentGoalId);
    if (!goal || goal.achieved || amount <= 0) return;
    if (type === 'withdraw' && amount > goal.collected) {
      openSnack('Saldo tidak cukup.');
      return;
    }
    var snapshot = {
      collected: goal.collected, achieved: goal.achieved, history: goal.history.slice()
    };
    goal.collected = type === 'deposit' ? Math.min(goal.target, goal.collected + amount) : goal.collected - amount;
    goal.history.push(makeHistory(type, amount, note));
    var reached = goal.collected >= goal.target && !snapshot.achieved;
    if (reached) goal.achieved = true;
    renderDetail();
    renderHome();
    if (reached) {
      openSnack('Target tercapai! Pindah ke Tercapai', function () {
        goal.collected = snapshot.collected;
        goal.achieved = snapshot.achieved;
        goal.history = snapshot.history;
        renderDetail();
        renderHome();
      });
    } else {
      openSnack((type === 'deposit' ? '+' : '-') + goalMoney(goal, amount) + ' ' + (type === 'deposit' ? 'ditambahkan' : 'dikurangi'), function () {
        goal.collected = snapshot.collected;
        goal.achieved = snapshot.achieved;
        goal.history = snapshot.history;
        renderDetail();
        renderHome();
      });
    }
  }

  $('detail-back').addEventListener('click', function () { showTab(currentGoalId && getGoal(currentGoalId) && getGoal(currentGoalId).achieved ? 1 : 0); });
  $('detail-add').addEventListener('click', function () { openRecord('deposit'); });
  $('detail-withdraw').addEventListener('click', function () {
    var goal = getGoal(currentGoalId);
    if (!goal || goal.collected <= 0) return;
    openRecord('withdraw');
  });
  $('detail-edit').addEventListener('click', function () { showForm('edit', currentGoalId); });
  $('detail-delete').addEventListener('click', function () { openOverlay('overlay-confirm'); });
  $('confirm-cancel').addEventListener('click', function () { closeOverlay('overlay-confirm'); });
  $('confirm-delete').addEventListener('click', function () {
    var goal = getGoal(currentGoalId);
    if (!goal) return;
    goals = goals.filter(function (item) { return item.id !== goal.id; });
    closeOverlay('overlay-confirm');
    showTab(goal.achieved ? 1 : 0);
    openSnack('Celengan dihapus.');
  });
  $('detail-reminder').addEventListener('click', function () {
    var goal = getGoal(currentGoalId);
    if (!goal || goal.achieved) return;
    goal.reminder = !goal.reminder;
    this.setAttribute('aria-checked', String(goal.reminder));
    openSnack(goal.reminder ? 'Pengingat 12:00 aktif.' : 'Pengingat dimatikan.');
  });

  /* ---------- Modal Catat Tabungan ---------- */

  function openRecord(mode) {
    setRecordMode(mode);
    $('record-amount').value = '';
    $('record-note').value = '';
    renderRecordPreview();
    openOverlay('overlay-record');
  }

  function setRecordMode(mode) {
    recordMode = mode;
    all('[data-record-type]').forEach(function (button) {
      button.setAttribute('aria-pressed', String(button.getAttribute('data-record-type') === mode));
    });
    $('record-save').style.background = mode === 'withdraw' ? 'var(--app-red)' : 'var(--app-blue)';
  }

  function renderRecordPreview() {
    var goal = getGoal(currentGoalId);
    if (!goal) return;
    var amount = digitsOf($('record-amount').value);
    var preview = $('record-preview');
    if (recordMode === 'withdraw' && amount > goal.collected) {
      preview.textContent = 'Nominal melebihi saldo tersedia (' + goalMoney(goal, goal.collected) + ').';
      preview.classList.add('is-error');
      return;
    }
    preview.classList.remove('is-error');
    var next = recordMode === 'deposit' ? Math.min(goal.target, goal.collected + amount) : goal.collected - amount;
    var label = recordMode === 'deposit' ? 'Saldo setelahnya' : 'Sisa saldo';
    preview.textContent = label + ': ' + goalMoney(goal, next) + ' (' + percentOf({ target: goal.target, collected: next }) + '%)';
  }

  all('[data-record-type]').forEach(function (button) {
    button.addEventListener('click', function () {
      setRecordMode(button.getAttribute('data-record-type'));
      renderRecordPreview();
    });
  });

  $('record-amount').addEventListener('input', function (event) {
    var value = digitsOf(event.target.value);
    event.target.value = value > 0 ? number(value) : '';
    renderRecordPreview();
  });

  var recordQuick = $('record-quick');
  [15000, 30000, 45000, 100000].forEach(function (amount) {
    var chip = make('button', null, number(amount));
    chip.type = 'button';
    chip.addEventListener('click', function () {
      $('record-amount').value = number(amount);
      renderRecordPreview();
    });
    recordQuick.appendChild(chip);
  });

  $('record-cancel').addEventListener('click', function () { closeOverlay('overlay-record'); });
  $('record-save').addEventListener('click', function () {
    var amount = digitsOf($('record-amount').value);
    if (amount <= 0) { openSnack('Isi nominal dulu.'); return; }
    var goal = getGoal(currentGoalId);
    if (!goal) return;
    if (recordMode === 'withdraw' && amount > goal.collected) { openSnack('Saldo tidak cukup.'); return; }
    var note = $('record-note').value.trim() || (recordMode === 'deposit' ? 'Setoran' : 'Penarikan');
    closeOverlay('overlay-record');
    addTransaction(recordMode, amount, note);
  });

  /* ---------- Form tambah/edit tabungan ---------- */

  function renderForm() {
    var goal = formMode === 'edit' ? getGoal(formEditingId) : null;
    $('form-name').value = goal ? goal.title : '';
    $('form-target').value = goal ? number(goal.target) : '';
    $('form-plan').value = goal && goal.plan > 0 ? number(goal.plan) : '';
    formCurrency = goal ? goal.currency : 'IDR';
    formFreq = goal ? goal.freq : 0;
    $('form-currency').textContent = currencyByCode(formCurrency).label;
    $('form-reminder').setAttribute('aria-checked', String(goal ? !!goal.reminder : true));
    $('form-save').textContent = formMode === 'edit' ? 'Simpan' : 'Simpan';
    renderFormFreq();
  }

  function currencyByCode(code) {
    return CURRENCIES.filter(function (item) { return item.code === code; })[0] || CURRENCIES[0];
  }

  function renderFormFreq() {
    all('[data-form-freq]').forEach(function (button) {
      button.setAttribute('aria-pressed', String(parseInt(button.getAttribute('data-form-freq'), 10) === formFreq));
    });
    $('form-plan-label').textContent = 'Nominal Pengisian';
    $('form-period-hint').textContent = 'Disisihkan setiap ' + FREQUENCIES[formFreq].lower;
  }

  all('[data-form-freq]').forEach(function (button) {
    button.addEventListener('click', function () {
      formFreq = parseInt(button.getAttribute('data-form-freq'), 10);
      renderFormFreq();
    });
  });

  function formatRupiahInput(input) {
    var value = digitsOf(input.value);
    input.value = value > 0 ? number(value) : '';
  }

  $('form-target').addEventListener('input', function (event) { formatRupiahInput(event.target); });
  $('form-plan').addEventListener('input', function (event) { formatRupiahInput(event.target); });

  $('form-currency-open').addEventListener('click', function () { openCurrencySheet(); });
  $('form-currency-open').addEventListener('keydown', function (event) {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openCurrencySheet(); }
  });

  function openCurrencySheet() {
    var list = $('currency-list');
    list.textContent = '';
    CURRENCIES.forEach(function (currency) {
      var option = make('button', 'currency-option');
      option.type = 'button';
      option.setAttribute('aria-pressed', String(currency.code === formCurrency));
      option.appendChild(make('strong', null, currency.label));
      option.appendChild(make('span', null, currency.symbol));
      option.addEventListener('click', function () {
        formCurrency = currency.code;
        $('form-currency').textContent = currency.label;
        closeOverlay('overlay-currency');
      });
      list.appendChild(option);
    });
    openOverlay('overlay-currency');
  }

  $('form-reminder').addEventListener('click', function () {
    this.setAttribute('aria-checked', String(this.getAttribute('aria-checked') !== 'true'));
  });

  $('form-back').addEventListener('click', function () {
    if (formMode === 'edit' && formEditingId) showDetail(formEditingId);
    else showTab(0);
  });

  $('form-save').addEventListener('click', function () {
    var name = $('form-name').value.trim();
    var target = digitsOf($('form-target').value);
    var plan = digitsOf($('form-plan').value);
    if (!name) { openSnack('Nama wajib diisi.'); return; }
    if (target <= 0) { openSnack('Target wajib diisi.'); return; }
    var goal = formMode === 'edit' ? getGoal(formEditingId) : null;
    if (goal) {
      goal.title = name;
      goal.target = target;
      goal.plan = plan;
      goal.freq = formFreq;
      goal.currency = formCurrency;
      goal.reminder = $('form-reminder').getAttribute('aria-checked') === 'true';
      if (goal.collected >= goal.target && !goal.achieved) goal.achieved = true;
      renderDetail();
      renderHome();
      openSnack('Tabungan diperbarui.');
    } else {
      if (goals.length >= MAX_GOALS) {
        openSnack('Batas simulasi 5 celengan');
        return;
      }
      var created = {
        id: 'goal-' + Date.now(), title: name, target: target, collected: 0,
        plan: plan, freq: formFreq, currency: formCurrency,
        created: new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date()),
        reminder: $('form-reminder').getAttribute('aria-checked') === 'true',
        achieved: false, history: []
      };
      goals.unshift(created);
      renderHome();
      showDetail(created.id);
      openSnack('Celengan dibuat.');
    }
  });

  $('open-form').addEventListener('click', function () {
    if (goals.length >= MAX_GOALS) {
      openSnack('Batas simulasi 5 celengan');
      return;
    }
    showForm('create', null);
  });

  /* ---------- Bottom sheet kalkulator target ---------- */

  var calc2 = { mode: 0, freq: 0, input: 20, planAmount: 0 };

  function dateText(daysFromNow) {
    var date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
  }

  function renderCalc2() {
    var frequency = FREQUENCIES[calc2.freq];
    var target = digitsOf($('form-target').value);
    $('calc2-target').textContent = money(target);
    var periods = 0;
    var days = 0;

    if (calc2.mode === 0) {
      periods = calc2.input;
      calc2.planAmount = periods > 0 ? Math.ceil(target / periods) : 0;
      days = periods * frequency.days;
      $('calc2-amount-label').textContent = 'Jumlah ' + frequency.unit;
      $('calc2-unit').textContent = frequency.unit;
      $('calc2-result').textContent = calc2.planAmount > 0 ? money(calc2.planAmount) + ' / ' + frequency.lower : 'Isi dulu jumlah ' + frequency.lower;
    } else {
      calc2.planAmount = calc2.input;
      periods = calc2.planAmount > 0 ? Math.ceil(target / calc2.planAmount) : 0;
      days = periods * frequency.days;
      $('calc2-amount-label').textContent = 'Nominal per ' + frequency.unit + ' (Rp)';
      $('calc2-unit').textContent = 'Rp';
      $('calc2-result').textContent = periods > 0 ? number(periods) + ' ' + frequency.unit : 'Isi dulu nominal per ' + frequency.lower;
    }
    $('calc2-date').textContent = periods > 0 ? 'Estimasi tercapai: ' + dateText(days) : 'Estimasi tercapai: —';

    all('[data-calc2-mode]').forEach(function (button) {
      button.setAttribute('aria-pressed', String(parseInt(button.getAttribute('data-calc2-mode'), 10) === calc2.mode));
    });
    all('[data-calc2-freq]').forEach(function (button) {
      button.setAttribute('aria-pressed', String(parseInt(button.getAttribute('data-calc2-freq'), 10) === calc2.freq));
    });

    var quickValues = calc2.mode === 0 ? frequency.quick : [10000, 20000, 50000, 100000];
    var container = $('calc2-quick');
    container.textContent = '';
    quickValues.forEach(function (value) {
      var chip = make('button', null, calc2.mode === 0 ? value + ' ' + frequency.unit : number(value));
      chip.type = 'button';
      chip.addEventListener('click', function () {
        calc2.input = value;
        $('calc2-amount').value = number(value);
        renderCalc2();
      });
      container.appendChild(chip);
    });
  }

  all('[data-calc2-mode]').forEach(function (button) {
    button.addEventListener('click', function () {
      calc2.mode = parseInt(button.getAttribute('data-calc2-mode'), 10);
      calc2.input = calc2.mode === 0 ? 20 : 15000;
      $('calc2-amount').value = number(calc2.input);
      renderCalc2();
    });
  });

  all('[data-calc2-freq]').forEach(function (button) {
    button.addEventListener('click', function () {
      calc2.freq = parseInt(button.getAttribute('data-calc2-freq'), 10);
      calc2.input = FREQUENCIES[calc2.freq].quick[2];
      $('calc2-amount').value = number(calc2.input);
      renderCalc2();
    });
  });

  $('calc2-amount').addEventListener('input', function (event) {
    calc2.input = digitsOf(event.target.value);
    event.target.value = calc2.input > 0 ? number(calc2.input) : '';
    renderCalc2();
  });

  $('form-calc-open').addEventListener('click', function () {
    calc2.input = 20;
    calc2.mode = 0;
    calc2.freq = formFreq;
    $('calc2-amount').value = number(calc2.input);
    renderCalc2();
    openOverlay('overlay-calc');
  });

  $('calc2-apply').addEventListener('click', function () {
    if (calc2.planAmount <= 0) { openSnack('Isi perhitungannya dulu.'); return; }
    formFreq = calc2.freq;
    $('form-plan').value = number(calc2.planAmount);
    renderFormFreq();
    closeOverlay('overlay-calc');
    openSnack('Rencana diterapkan.');
  });

  /* ---------- Pengaturan ---------- */

  $('biometric-switch').addEventListener('click', function () {
    var active = this.getAttribute('aria-checked') !== 'true';
    this.setAttribute('aria-checked', String(active));
    $('biometric-caption').textContent = active ? 'Aktif di simulasi' : 'Nonaktif secara default';
    if (active) openSnack('Tersedia di aplikasi Android');
  });

  all('[data-demo-snackbar]').forEach(function (button) {
    button.addEventListener('click', function () {
      openSnack(button.getAttribute('data-demo-snackbar'));
    });
  });

  $('about-row').addEventListener('click', function () { openOverlay('overlay-about'); });
  $('about-close').addEventListener('click', function () { closeOverlay('overlay-about'); });
  $('check-update').addEventListener('click', function () {
    openSnack('Sudah versi terbaru (v' + latestVersion + ')');
  });

  /* ---------- Reset simulasi ---------- */

  $('reset-sim').addEventListener('click', function () {
    seedGoals();
    applyAppTheme('dark');
    closeAllOverlays();
    $('biometric-switch').setAttribute('aria-checked', 'false');
    $('biometric-caption').textContent = 'Nonaktif secara default';
    showTab(0);
    openSnack('Simulasi direset.');
  });

  /* ---------- Rilis terbaru dari GitHub API ---------- */

  /* Satu-satunya sumber versi di simulasi: semua tampilan ikut state global ini. */
  function setVersion(version) {
    latestVersion = String(version).trim().replace(/^[vV]/, '') || FALLBACK_VERSION;
    all('[data-release-version]').forEach(function (node) { node.textContent = 'v' + latestVersion; });
    $('settings-version').textContent = 'Sisihin v' + latestVersion;
    $('about-version').textContent = 'Versi terpasang: v' + latestVersion;
  }

  function renderRelease(data) {
    setVersion(data.version);
    document.querySelector('[data-release-date]').textContent = data.date;
    document.querySelector('[data-release-title]').textContent = data.title;
    document.querySelector('[data-release-size]').textContent = data.size;
    document.querySelector('[data-release-changelog]').textContent = data.changelog;
    $('release-note').textContent = data.note;
    all('.download-link').forEach(function (link) { link.href = data.url; });
  }

  function useFallback() {
    renderRelease({
      version: FALLBACK_VERSION,
      date: 'Rilis terbaru di GitHub',
      title: 'Sisihin v' + FALLBACK_VERSION,
      size: 'Ukuran APK —',
      changelog: FALLBACK_CHANGELOG + '\n\nLihat catatan lengkap di halaman Releases GitHub.',
      url: RELEASE_PAGE,
      note: 'GitHub sedang nggak bisa diakses. Tombol tetap menuju halaman Releases.'
    });
  }

  function parseRelease(json) {
    var version = json.tag_name.trim().replace(/^[vV]/, '') || FALLBACK_VERSION;
    var apk = Array.isArray(json.assets) ? json.assets.filter(function (asset) {
      return asset && typeof asset.name === 'string' && /\.apk$/i.test(asset.name);
    })[0] : null;
    var sizeText = 'Ukuran APK —';
    if (apk && typeof apk.size === 'number' && apk.size > 0) {
      sizeText = 'Ukuran APK ' + (apk.size / 1024 / 1024).toFixed(1) + ' MB';
    }
    var dateText = 'Rilis terbaru di GitHub';
    if (json.published_at) {
      var parsed = new Date(json.published_at);
      if (!isNaN(parsed.getTime())) {
        dateText = 'Dirilis ' + new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(parsed);
      }
    }
    return {
      version: version,
      date: dateText,
      title: typeof json.name === 'string' && json.name.trim() ? json.name.trim() : 'Versi ' + version,
      size: sizeText,
      changelog: typeof json.body === 'string' && json.body.trim() ? json.body.trim() : FALLBACK_CHANGELOG,
      url: (apk && apk.browser_download_url) || json.html_url || RELEASE_PAGE,
      note: 'File diambil langsung dari rilis GitHub. Versi terpasang bisa dicek di Pengaturan > Tentang.'
    };
  }

  function loadRelease() {
    if (!window.fetch) { useFallback(); return; }
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timeout = setTimeout(function () { if (controller) controller.abort(); }, 7000);
    fetch(RELEASE_API, {
      headers: { 'Accept': 'application/vnd.github+json' },
      signal: controller ? controller.signal : undefined
    })
      .then(function (response) {
        if (!response.ok) throw new Error('GitHub API: ' + response.status);
        return response.json();
      })
      .then(function (json) {
        clearTimeout(timeout);
        if (!json || typeof json.tag_name !== 'string' || !json.tag_name.trim()) throw new Error('Format rilis tidak dikenal');
        renderRelease(parseRelease(json));
      })
      .catch(function () {
        clearTimeout(timeout);
        useFallback();
      });
  }

  /* ---------- Init ---------- */

  applyTheme(currentTheme());
  applyAppTheme('dark');
  seedGoals();
  closeAllOverlays();
  setVersion(FALLBACK_VERSION);
  showTab(0); // layar awal murni tab Tabungan, tanpa modal/snackbar terbuka
  loadRelease();
})();
