/* ==========================================================================
   Sisihin — interaksi website (vanilla JavaScript, tanpa dependency)
   ========================================================================== */

(function () {
  'use strict';

  var RELEASE_API = 'https://api.github.com/repos/mhafizhibrahim/sisihin/releases/latest';
  var RELEASE_PAGE = 'https://github.com/mhafizhibrahim/sisihin/releases/latest';
  // Sumber: app/build.gradle.kts -> versionName = "1.1.3"
  var FALLBACK_VERSION = '1.1.3';
  // Sumber: UpdateChecker.kt -> FALLBACK_CHANGELOG
  var FALLBACK_CHANGELOG = 'Perbaikan bug dan peningkatan performa.';

  var $ = function (id) { return document.getElementById(id); };
  var all = function (selector) { return Array.prototype.slice.call(document.querySelectorAll(selector)); };
  var number = function (value) { return Math.round(value).toLocaleString('id-ID'); };
  var rupiah = function (value) { return 'Rp' + number(value); };
  var clamp = function (value, min, max) { return Math.max(min, Math.min(max, value)); };

  /* ---------- Tema instan ---------- */

  function currentTheme() {
    return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('sisihin-theme', theme); } catch (e) {}
    all('[data-theme-choice]').forEach(function (button) {
      button.setAttribute('aria-pressed', String(button.getAttribute('data-theme-choice') === theme));
    });
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#000000' : '#FFFFFF');
  }

  all('[data-theme-choice]').forEach(function (button) {
    button.addEventListener('click', function () {
      applyTheme(button.getAttribute('data-theme-choice'));
    });
  });
  applyTheme(currentTheme());

  /* ---------- Tab mini di phone mockup ---------- */

  all('[data-phone-tab]').forEach(function (tab) {
    tab.addEventListener('click', function () {
      var name = tab.getAttribute('data-phone-tab');
      all('[data-phone-tab]').forEach(function (item) {
        var active = item === tab;
        item.classList.toggle('is-active', active);
        item.setAttribute('aria-selected', String(active));
      });
      all('.phone-panel').forEach(function (panel) {
        var active = panel.id === 'panel-' + name;
        panel.classList.toggle('is-active', active);
        panel.hidden = !active;
      });
    });
  });

  /* ---------- Simulasi Detail Celengan ---------- */

  var TARGET = 500000;
  var INITIAL_COLLECTED = 205000;

  var sim = {
    collected: INITIAL_COLLECTED,
    plan: 15000,
    selected: 15000,
    previous: null
  };

  var RING_CIRCUMFERENCE = 2 * Math.PI * 26;

  function formatDaysText(days) {
    return days === 1 ? '1 Hari Lagi' : number(days) + ' Hari Lagi';
  }

  function renderSim() {
    var remaining = Math.max(0, TARGET - sim.collected);
    var percent = clamp(Math.round((sim.collected / TARGET) * 100), 0, 100);
    var days = sim.plan > 0 ? Math.ceil(remaining / sim.plan) : 0;

    $('sim-percent').textContent = percent + '%';
    $('sim-ring-progress').setAttribute('stroke-dasharray', RING_CIRCUMFERENCE.toFixed(2));
    $('sim-ring-progress').setAttribute('stroke-dashoffset', (RING_CIRCUMFERENCE * (1 - percent / 100)).toFixed(2));
    $('sim-collected').textContent = rupiah(sim.collected);
    $('sim-remaining').textContent = rupiah(remaining);
    $('sim-plan').textContent = rupiah(sim.plan) + ' Perhari';
    $('sim-estimate').textContent = remaining === 0 ? 'Target Tercapai' : formatDaysText(days);

    var achieved = remaining === 0;
    $('sim-status').hidden = !achieved;
    $('sim-add').disabled = achieved;
    $('sim-withdraw').disabled = achieved || sim.collected === 0;
    all('#sim-chips .sim-chip').forEach(function (chip) { chip.disabled = achieved; });
    if (achieved) $('sim-feedback').hidden = true;
  }

  var undoAction = null;

  function showFeedback(text, undo) {
    var bar = $('sim-feedback');
    $('sim-feedback-text').textContent = text;
    undoAction = typeof undo === 'function' ? undo : null;
    $('sim-undo').hidden = !undoAction;
    bar.hidden = false;
  }

  function changeCollected(delta, verb) {
    var next = clamp(sim.collected + delta, 0, TARGET);
    if (next === sim.collected) return;
    sim.previous = sim.collected;
    sim.collected = next;
    renderSim();
    showFeedback((delta > 0 ? '+' : '-') + rupiah(Math.abs(delta)) + ' ' + verb, function () {
      sim.collected = sim.previous;
      sim.previous = null;
      renderSim();
      showFeedback('Perubahan diurungkan.');
    });
  }

  all('#sim-chips .sim-chip').forEach(function (chip) {
    chip.addEventListener('click', function () {
      sim.selected = parseInt(chip.getAttribute('data-sim-amount'), 10);
      all('#sim-chips .sim-chip').forEach(function (item) {
        var active = item === chip;
        item.classList.toggle('is-selected', active);
        item.setAttribute('aria-pressed', String(active));
      });
      // Di aplikasi asli, mengetuk chip langsung mencatat setoran.
      changeCollected(sim.selected, 'ditambahkan');
    });
  });

  $('sim-add').addEventListener('click', function () {
    changeCollected(sim.selected, 'ditambahkan');
  });

  $('sim-withdraw').addEventListener('click', function () {
    changeCollected(-sim.selected, 'dikurangi');
  });

  $('sim-reset').addEventListener('click', function () {
    sim.collected = INITIAL_COLLECTED;
    sim.plan = 15000;
    sim.selected = 15000;
    sim.previous = null;
    all('#sim-chips .sim-chip').forEach(function (item) {
      var active = item.getAttribute('data-sim-amount') === '15000';
      item.classList.toggle('is-selected', active);
      item.setAttribute('aria-pressed', String(active));
    });
    $('sim-feedback').hidden = true;
    $('sim-status').hidden = true;
    renderSim();
  });

  $('sim-undo').addEventListener('click', function () {
    if (undoAction) undoAction();
  });

  renderSim();

  /* ---------- Kalkulator Target di dalam mockup ---------- */

  var FREQUENCIES = [
    { label: 'Harian', unit: 'Hari', lower: 'hari', days: 1, quick: [7, 14, 30, 90] },
    { label: 'Mingguan', unit: 'Minggu', lower: 'minggu', days: 7, quick: [4, 8, 12, 24] },
    { label: 'Bulanan', unit: 'Bulan', lower: 'bulan', days: 30, quick: [3, 6, 12, 24] }
  ];
  var QUICK_AMOUNTS = [10000, 20000, 50000, 100000];

  var calc = { mode: 0, frequency: 0, input: 20 };
  var calcPlanAmount = 0;

  function dateText(daysFromNow) {
    var date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
  }

  function digitsOf(text) {
    return parseInt(String(text).replace(/\D/g, ''), 10) || 0;
  }

  function renderCalc() {
    var frequency = FREQUENCIES[calc.frequency];
    var value = calc.input;
    var periods = 0;
    var estimateDays = 0;

    if (calc.mode === 0) {
      periods = value;
      calcPlanAmount = periods > 0 ? Math.ceil(TARGET / periods) : 0;
      estimateDays = periods * frequency.days;
      $('calc-amount-label').textContent = 'Jumlah ' + frequency.unit;
      $('calc-amount-unit').textContent = frequency.unit;
      $('calc-result-value').textContent = calcPlanAmount > 0
        ? rupiah(calcPlanAmount) + ' / ' + frequency.lower
        : 'Isi dulu jumlah ' + frequency.lower;
    } else {
      calcPlanAmount = value;
      periods = value > 0 ? Math.ceil(TARGET / value) : 0;
      estimateDays = periods * frequency.days;
      $('calc-amount-label').textContent = 'Nominal per ' + frequency.unit + ' (Rp)';
      $('calc-amount-unit').textContent = 'Rp';
      $('calc-result-value').textContent = periods > 0
        ? number(periods) + ' ' + frequency.unit
        : 'Isi dulu nominal per ' + frequency.lower;
    }

    $('calc-result-date').textContent = periods > 0
      ? 'Estimasi tercapai: ' + dateText(estimateDays)
      : 'Estimasi tercapai: —';

    all('#calc-mode [data-calc-mode]').forEach(function (button) {
      var active = parseInt(button.getAttribute('data-calc-mode'), 10) === calc.mode;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    all('#calc-freq [data-calc-freq]').forEach(function (button) {
      var active = parseInt(button.getAttribute('data-calc-freq'), 10) === calc.frequency;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });

    var quick = calc.mode === 0 ? frequency.quick : QUICK_AMOUNTS;
    var container = $('calc-quick');
    container.textContent = '';
    quick.forEach(function (amount) {
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.textContent = calc.mode === 0 ? amount + ' ' + frequency.unit : number(amount);
      if (amount === calc.input) chip.classList.add('is-selected');
      chip.addEventListener('click', function () {
        calc.input = amount;
        $('calc-amount').value = number(amount);
        renderCalc();
      });
      container.appendChild(chip);
    });
  }

  all('#calc-mode [data-calc-mode]').forEach(function (button) {
    button.addEventListener('click', function () {
      calc.mode = parseInt(button.getAttribute('data-calc-mode'), 10);
      calc.input = calc.mode === 0 ? 20 : 15000;
      $('calc-amount').value = number(calc.input);
      renderCalc();
    });
  });

  all('#calc-freq [data-calc-freq]').forEach(function (button) {
    button.addEventListener('click', function () {
      calc.frequency = parseInt(button.getAttribute('data-calc-freq'), 10);
      calc.input = FREQUENCIES[calc.frequency].quick[2];
      $('calc-amount').value = number(calc.input);
      renderCalc();
    });
  });

  $('calc-amount').addEventListener('input', function (event) {
    calc.input = digitsOf(event.target.value);
    event.target.value = calc.input > 0 ? number(calc.input) : '';
    renderCalc();
  });

  $('calc-apply').addEventListener('click', function () {
    if (calcPlanAmount <= 0) return;
    var frequency = FREQUENCIES[calc.frequency];
    sim.plan = Math.max(1, Math.ceil(calcPlanAmount / frequency.days));
    renderSim();
    document.querySelector('[data-phone-tab="detail"]').click();
    showFeedback('Rencana diperbarui jadi ' + rupiah(sim.plan) + ' Perhari.');
  });

  $('calc-amount').value = number(calc.input);
  renderCalc();

  /* ---------- Rilis terbaru dari GitHub API ---------- */

  function setVersion(version) {
    all('[data-release-version]').forEach(function (node) { node.textContent = 'v' + version; });
  }

  function renderRelease(data) {
    setVersion(data.version);
    document.querySelector('[data-release-date]').textContent = data.date;
    document.querySelector('[data-release-title]').textContent = data.title;
    document.querySelector('[data-release-size]').textContent = data.size;
    document.querySelector('[data-release-changelog]').textContent = data.changelog;
    document.querySelector('#release-note').textContent = data.note;
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

  function isValidRelease(json) {
    return json && typeof json === 'object' && typeof json.tag_name === 'string' && json.tag_name.trim() !== '';
  }

  function parseRelease(json) {
    var version = json.tag_name.trim().replace(/^[vV]/, '') || FALLBACK_VERSION;
    var apk = null;
    if (Array.isArray(json.assets)) {
      apk = json.assets.find(function (asset) {
        return asset && typeof asset.name === 'string' && /\.apk$/i.test(asset.name);
      });
    }
    var sizeText = 'Ukuran APK —';
    if (apk && typeof apk.size === 'number' && apk.size > 0) {
      sizeText = 'Ukuran APK ' + (apk.size / 1024 / 1024).toFixed(1) + ' MB';
    }
    var dateText = 'Rilis terbaru di GitHub';
    if (json.published_at) {
      var parsed = new Date(json.published_at);
      if (!isNaN(parsed.getTime())) {
        dateText = 'Dirilis ' + new Intl.DateTimeFormat('id-ID', {
          day: 'numeric', month: 'short', year: 'numeric'
        }).format(parsed);
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
        if (!isValidRelease(json)) throw new Error('Format rilis tidak dikenal');
        renderRelease(parseRelease(json));
      })
      .catch(function () {
        clearTimeout(timeout);
        useFallback();
      });
  }

  loadRelease();
})();
