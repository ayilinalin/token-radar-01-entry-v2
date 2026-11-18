// Token Radar, model radar-3. Reads window.RADAR (written beside dashboard/ by main.ts)
// and renders the board: sortable, filterable, with a detail view for every protocol.
// All state lives in the URL hash, so a view can be linked and screenshotted as-is.
(function () {
  'use strict';
  var DATA = window.RADAR;
  var main = document.getElementById('board');
  var dialog = document.getElementById('detail');
  if (!DATA || !DATA.rows) {
    main.textContent = 'No radar data. Run main.ts to write data.js beside this dashboard.';
    main.removeAttribute('aria-busy');
    return;
  }

  var watchSet = {};
  (DATA.watchlist_slugs || []).forEach(function (s) { watchSet[s] = true; });
  function onWatch(r) { return !!watchSet[r.slug]; }

  function fmtUsd(n) {
    if (n === null || n === undefined) return '—';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(0) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + Math.round(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined) return '—';
    return (n >= 0 ? '+' : '') + n.toFixed(1) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return '—';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return days + 'd';
  }
  function fmtMult(n) { return n === null || n === undefined ? '—' : n.toFixed(3) + 'x'; }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'text') node.textContent = v;
      else if (k === 'class') node.className = v;
      else if (k === 'html') node.innerHTML = v;
      else if (k === 'style') node.setAttribute('style', v);
      else if (k.indexOf('aria-') === 0 || k.indexOf('data-') === 0) node.setAttribute(k, v);
      else if (k === 'onclick') node.addEventListener('click', v);
      else node[k] = v;
    });
    if (children !== undefined && children !== null) {
      if (!Array.isArray(children)) children = [children];
      children.forEach(function (c) { if (c) node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    }
    return node;
  }

  function readHash() {
    var params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    return {
      q: params.get('q') || '',
      category: params.get('category') || 'all',
      chain: params.get('chain') || 'all',
      minTvl: Number(params.get('minTvl')) || 0,
      watchOnly: params.get('watch') === '1',
      tab: params.get('tab') === 'live' ? 'live' : 'pre-token',
      sort: params.get('sort') || 'rank',
      dir: params.get('dir') === '-1' ? -1 : 1,
      detail: params.get('detail') || ''
    };
  }
  var state = readHash();
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.minTvl) params.set('minTvl', String(state.minTvl));
    if (state.watchOnly) params.set('watch', '1');
    if (state.tab === 'live') params.set('tab', 'live');
    if (state.sort !== 'rank') params.set('sort', state.sort);
    if (state.dir === -1) params.set('dir', '-1');
    if (state.detail) params.set('detail', state.detail);
    var h = params.toString();
    window.history.replaceState(null, '', h ? '#' + h : window.location.pathname + window.location.search);
  }
  window.addEventListener('hashchange', function () { state = readHash(); render(); });

  function filteredRows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.watchOnly && !onWatch(r)) return false;
      if (state.category !== 'all' && (r.category || 'Other') !== state.category) return false;
      if (state.chain !== 'all' && (r.chains || []).indexOf(state.chain) < 0) return false;
      if (state.minTvl && r.tvl_usd < state.minTvl) return false;
      if (q && (r.name + ' ' + r.slug + ' ' + (r.category || '')).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
  }
  function sortValue(r, key) {
    if (key === 'name') return r.name.toLowerCase();
    if (key === 'tvl') return r.tvl_usd;
    if (key === 'change') return r.change_7d === null ? -9999 : r.change_7d;
    if (key === 'age') return r.age_days === null ? -1 : r.age_days;
    if (key === 'implied') return r.implied_value_usd;
    return r.rank;
  }
  function sortedRows(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var va = sortValue(a, key), vb = sortValue(b, key);
      if (va < vb) return -state.dir;
      if (va > vb) return state.dir;
      return a.slug < b.slug ? -1 : 1;
    });
  }

  function topMeta() {
    var host = document.getElementById('top-meta');
    host.textContent = '';
    host.appendChild(el('span', null, ['Snapshot ', el('b', { text: DATA.as_of })]));
    host.appendChild(el('span', null, ['Model ', el('b', { text: DATA.model_version })]));
    host.appendChild(el('span', null, [el('b', { text: String(DATA.board_size) }), ' ranked']));
    host.appendChild(el('span', null, [el('b', { text: String(DATA.watchlist_size) }), ' on the watchlist']));
    document.getElementById('foot-date').textContent = DATA.as_of;
  }
  function facts() {
    var host = document.getElementById('facts');
    host.textContent = '';
    var top = DATA.rows[0];
    var items = [
      ['Top implied value', top ? fmtUsd(top.implied_value_usd) : '—'],
      ['Pre-token protocols ranked', String(DATA.board_size)],
      ['Watchlist covered', DATA.watchlist_size + ' / ' + DATA.watchlist_size],
      ['Set aside (wrapped / bridged / live)', String(DATA.excluded_size + DATA.live_size)]
    ];
    items.forEach(function (it) {
      host.appendChild(el('div', { class: 'fact' }, [el('span', { text: it[0] }), el('b', { text: it[1] })]));
    });
  }

  function controls() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var chains = Array.from(new Set(DATA.rows.reduce(function (acc, r) { return acc.concat(r.chains || []); }, []))).sort();
    var wrap = el('div', { class: 'controls' });
    var search = el('input', { type: 'search', value: state.q, placeholder: 'Search name or slug…', 'aria-label': 'Search protocols' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); render(); });
    wrap.appendChild(el('div', { class: 'field' }, [el('label', { text: 'Search' }), search]));
    var catSel = el('select', { 'aria-label': 'Filter by category' },
      [el('option', { value: 'all', text: 'All categories' })].concat(categories.map(function (c) {
        return el('option', { value: c, text: c, selected: c === state.category ? 'selected' : null });
      })));
    catSel.addEventListener('change', function () { state.category = catSel.value; writeHash(); render(); });
    wrap.appendChild(el('div', { class: 'field' }, [el('label', { text: 'Category' }), catSel]));
    var chainSel = el('select', { 'aria-label': 'Filter by chain' },
      [el('option', { value: 'all', text: 'All chains' })].concat(chains.map(function (c) {
        return el('option', { value: c, text: c, selected: c === state.chain ? 'selected' : null });
      })));
    chainSel.addEventListener('change', function () { state.chain = chainSel.value; writeHash(); render(); });
    wrap.appendChild(el('div', { class: 'field' }, [el('label', { text: 'Chain' }), chainSel]));
    var tvlSel = el('select', { 'aria-label': 'Minimum TVL' },
      [el('option', { value: '0', text: 'Any TVL' })].concat(
        [5e6, 5e7, 1e8, 5e8, 1e9].map(function (v) {
          return el('option', { value: String(v), text: 'TVL >= ' + fmtUsd(v), selected: state.minTvl === v ? 'selected' : null });
        })));
    tvlSel.addEventListener('change', function () { state.minTvl = Number(tvlSel.value) || 0; writeHash(); render(); });
    wrap.appendChild(el('div', { class: 'field' }, [el('label', { text: 'Size' }), tvlSel]));
    var watchBox = el('input', { type: 'checkbox', checked: state.watchOnly ? 'checked' : null });
    watchBox.addEventListener('change', function () { state.watchOnly = watchBox.checked; writeHash(); render(); });
    wrap.appendChild(el('label', { class: 'check' }, [watchBox, document.createTextNode(' Watchlist only')]));
    var tabs = el('div', { class: 'tabs' });
    var pre = el('button', { type: 'button', 'aria-pressed': state.tab === 'pre-token' ? 'true' : 'false', text: 'Pre-token', onclick: function () { state.tab = 'pre-token'; writeHash(); render(); } });
    var live = el('button', { type: 'button', 'aria-pressed': state.tab === 'live' ? 'true' : 'false', text: 'Live token', onclick: function () { state.tab = 'live'; writeHash(); render(); } });
    tabs.appendChild(pre);
    tabs.appendChild(live);
    wrap.appendChild(tabs);
    return wrap;
  }

  function sortHeader(key, label) {
    var arrow = state.sort === key ? (state.dir === 1 ? ' ▲' : ' ▼') : '';
    return el('th', null, [el('button', {
      type: 'button',
      onclick: function () { if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = 1; } writeHash(); render(); }
    }, label + arrow)]);
  }

  function boardTable() {
    var list = sortedRows(filteredRows());
    var panel = el('section', { class: 'panel' });
    var count = el('div', { class: 'count', text: list.length + ' of ' + DATA.rows.length + ' protocols' });
    var head = el('tr', null, [
      sortHeader('rank', 'Rank'),
      sortHeader('name', 'Protocol'),
      el('th', { text: 'Category' }),
      el('th', { text: 'Chains' }),
      sortHeader('tvl', 'TVL'),
      sortHeader('change', '7d'),
      sortHeader('age', 'Age'),
      sortHeader('implied', 'Implied value')
    ]);
    var body = el('tbody');
    if (list.length === 0) {
      panel.appendChild(el('div', { class: 'empty' }, [
        el('h2', { text: 'Nothing matches' }),
        el('p', { text: 'Loosen the filters to see the board again.' }),
        el('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; state.watchOnly = false; state.minTvl = 0; writeHash(); render(); } })
      ]));
      return { panel: panel, count: count };
    }
    var top = DATA.rows[0] ? DATA.rows[0].implied_value_usd : 1;
    list.forEach(function (r) {
      var row = el('tr', { 'data-selected': state.detail === r.slug ? 'true' : null, onclick: function () { openDetail(r.slug); } });
      row.appendChild(el('td', { class: 'num', text: '#' + r.rank }));
      var nameCell = el('td', { class: 'name' });
      nameCell.appendChild(el('b', { text: r.name }));
      var sub = r.slug + (onWatch(r) ? ' · watchlist' : '');
      nameCell.appendChild(el('span', { class: 'sub', text: sub }));
      row.appendChild(nameCell);
      row.appendChild(el('td', { text: r.category || '—' }));
      row.appendChild(el('td', { text: (r.chains || []).slice(0, 2).join(', ') + ((r.chains || []).length > 2 ? ' +' + ((r.chains || []).length - 2) : '') }));
      row.appendChild(el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }));
      var ch = el('td', { class: 'num ' + (r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) });
      row.appendChild(ch);
      row.appendChild(el('td', { class: 'num', text: fmtAge(r.age_days) }));
      var imp = el('td', { class: 'num' });
      var wrap = el('span', { class: 'implied' });
      wrap.appendChild(el('span', { class: 'bar' }, [el('i', { style: 'width:' + Math.max(2, Math.round(r.implied_value_usd / top * 100)) + '%' })]));
      wrap.appendChild(document.createTextNode(fmtUsd(r.implied_value_usd)));
      imp.appendChild(wrap);
      row.appendChild(imp);
      body.appendChild(row);
    });
    var table = el('table', null, [
      el('caption', { text: 'Ranked by implied launch value. Every row records no token in the snapshot.' }),
      el('thead', null, [head]),
      body
    ]);
    panel.appendChild(el('div', { class: 'table-wrap' }, [table]));
    return { panel: panel, count: count };
  }

  function liveTable() {
    var panel = el('section', { class: 'panel' });
    var count = el('div', { class: 'count', text: DATA.live.length + ' live-token protocols, by market cap' });
    var head = el('tr', null, [
      el('th', { text: '#' }), el('th', { text: 'Protocol' }), el('th', { text: 'Category' }),
      el('th', { text: 'Chains' }), el('th', { text: 'TVL' }), el('th', { text: 'Market cap' }),
      el('th', { text: 'Mcap / TVL' }), el('th', { text: '7d' })
    ]);
    var body = el('tbody');
    DATA.live.forEach(function (r, i) {
      var row = el('tr', { onclick: function () { openLiveDetail(r.slug); } });
      row.appendChild(el('td', { class: 'num', text: String(i + 1) }));
      var nameCell = el('td', { class: 'name' });
      nameCell.appendChild(el('b', { text: r.name }));
      nameCell.appendChild(el('span', { class: 'sub', text: r.slug }));
      row.appendChild(nameCell);
      row.appendChild(el('td', { text: r.category || '—' }));
      row.appendChild(el('td', { text: (r.chains || []).slice(0, 3).join(', ') }));
      row.appendChild(el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }));
      row.appendChild(el('td', { class: 'num', text: fmtUsd(r.mcap_usd) }));
      var ratio = r.mcap_usd !== null && r.tvl_usd > 0 ? (r.mcap_usd / r.tvl_usd).toFixed(2) + 'x' : '—';
      row.appendChild(el('td', { class: 'num', text: ratio }));
      row.appendChild(el('td', { class: 'num ' + (r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }));
      body.appendChild(row);
    });
    var table = el('table', null, [
      el('caption', { text: 'The market\'s own values: these tokens already trade, so they set the multiples the pre-token board is priced from.' }),
      el('thead', null, [head]),
      body
    ]);
    panel.appendChild(el('div', { class: 'table-wrap' }, [table]));
    return { panel: panel, count: count };
  }

  function kvRow(label, value) {
    return el('div', null, [el('span', { text: label }), el('b', { text: value })]);
  }
  function eqRow(label, value) {
    return el('div', null, [el('span', { text: label }), el('b', { text: value })]);
  }

  function openDetail(slug) {
    var r = null;
    for (var i = 0; i < DATA.rows.length; i++) if (DATA.rows[i].slug === slug) { r = DATA.rows[i]; break; }
    if (!r) return;
    state.detail = slug;
    writeHash();
    dialog.textContent = '';
    var head = el('div', { class: 'detail-head' });
    var title = el('div');
    title.appendChild(el('h2', { text: r.name }));
    title.appendChild(el('span', { class: 'sub', text: '#' + r.rank + ' · ' + r.slug + ' · ' + (onWatch(r) ? 'on the watchlist' : 'below the watchlist floor') }));
    head.appendChild(title);
    head.appendChild(el('button', { class: 'close', type: 'button', text: 'Close', onclick: closeDetail }));
    dialog.appendChild(head);
    var factsSec = el('div', { class: 'detail-section' });
    factsSec.appendChild(el('h3', { text: 'Snapshot record' }));
    var kv = el('div', { class: 'kv' });
    kv.appendChild(kvRow('TVL', fmtUsd(r.tvl_usd)));
    kv.appendChild(kvRow('7-day change', fmtPct(r.change_7d)));
    kv.appendChild(kvRow('Age', fmtAge(r.age_days)));
    kv.appendChild(kvRow('Listed', r.listed_at || '—'));
    kv.appendChild(kvRow('Category', r.category || '—'));
    kv.appendChild(kvRow('Chains', (r.chains || []).slice(0, 4).join(', ') + ((r.chains || []).length > 4 ? ' +' + ((r.chains || []).length - 4) : '') || '—'));
    factsSec.appendChild(kv);
    dialog.appendChild(factsSec);
    var modelSec = el('div', { class: 'detail-section' });
    modelSec.appendChild(el('h3', { text: 'Why it is worth ' + fmtUsd(r.implied_value_usd) }));
    var eq = el('div', { class: 'equation' });
    eq.appendChild(eqRow('TVL', fmtUsd(r.tvl_usd)));
    eq.appendChild(eqRow('Category multiple', fmtMult(r.category_multiple) + ' · ' + r.category_peers + ' live peer' + (r.category_peers === 1 ? '' : 's')));
    eq.appendChild(eqRow('Growth', fmtMult(r.growth_multiplier) + ' · ' + fmtPct(r.change_7d) + ' in 7 days'));
    eq.appendChild(eqRow('Maturity', fmtMult(r.maturity_multiplier) + ' · ' + fmtAge(r.age_days) + ' with no token'));
    eq.appendChild(eqRow('Chains', fmtMult(r.chain_multiplier) + ' · ' + (r.chains || []).length + ' chain' + ((r.chains || []).length === 1 ? '' : 's')));
    eq.appendChild(eqRow('Category depth', fmtMult(r.depth_multiplier) + ' · ' + r.category_peers + ' live peer' + (r.category_peers === 1 ? '' : 's')));
    modelSec.appendChild(eq);
    modelSec.appendChild(el('p', { class: 'sub', text: 'TVL x category multiple x growth x maturity x chains x depth, rounded to whole dollars. Multiples are derived from the snapshot\'s live-token peers at build time.' }));
    dialog.appendChild(modelSec);
    var farmSec = el('div', { class: 'detail-section' });
    farmSec.appendChild(el('h3', { text: 'Farm plan — seven steps' }));
    var steps = el('ol', { class: 'steps' });
    (r.farm_steps || []).forEach(function (s) { steps.appendChild(el('li', { text: s })); });
    farmSec.appendChild(steps);
    dialog.appendChild(farmSec);
    if (!dialog.open) dialog.showModal();
    render();
  }
  function openLiveDetail(slug) {
    var r = null;
    for (var i = 0; i < DATA.live.length; i++) if (DATA.live[i].slug === slug) { r = DATA.live[i]; break; }
    if (!r) return;
    state.detail = slug;
    writeHash();
    dialog.textContent = '';
    var head = el('div', { class: 'detail-head' });
    var title = el('div');
    title.appendChild(el('h2', { text: r.name }));
    title.appendChild(el('span', { class: 'sub', text: r.slug + ' · token already trades' }));
    head.appendChild(title);
    head.appendChild(el('button', { class: 'close', type: 'button', text: 'Close', onclick: closeDetail }));
    dialog.appendChild(head);
    var sec = el('div', { class: 'detail-section' });
    sec.appendChild(el('h3', { text: 'Market record' }));
    var kv = el('div', { class: 'kv' });
    kv.appendChild(kvRow('Market cap', fmtUsd(r.mcap_usd)));
    kv.appendChild(kvRow('TVL', fmtUsd(r.tvl_usd)));
    kv.appendChild(kvRow('Mcap / TVL', r.mcap_usd !== null && r.tvl_usd > 0 ? (r.mcap_usd / r.tvl_usd).toFixed(2) + 'x' : '—'));
    kv.appendChild(kvRow('7-day change', fmtPct(r.change_7d)));
    kv.appendChild(kvRow('Category', r.category || '—'));
    kv.appendChild(kvRow('Chains', (r.chains || []).slice(0, 4).join(', ') + ((r.chains || []).length > 4 ? ' +' + ((r.chains || []).length - 4) : '') || '—'));
    sec.appendChild(kv);
    sec.appendChild(el('p', { class: 'sub', text: 'Live-token protocols are benchmarks, not board rows: their market caps set the category multiples the pre-token board is priced from.' }));
    dialog.appendChild(sec);
    if (!dialog.open) dialog.showModal();
    render();
  }
  function closeDetail() {
    state.detail = '';
    writeHash();
    if (dialog.open) dialog.close();
    render();
  }
  dialog.addEventListener('click', function (e) { if (e.target === dialog) closeDetail(); });
  dialog.addEventListener('close', function () { if (state.detail) { state.detail = ''; writeHash(); render(); } });

  function render() {
    topMeta();
    facts();
    main.textContent = '';
    var ctl = controls();
    var out = state.tab === 'live' ? liveTable() : boardTable();
    ctl.appendChild(out.count);
    main.appendChild(ctl);
    main.appendChild(out.panel);
    main.removeAttribute('aria-busy');
  }
  render();
  if (state.detail) {
    if (state.tab === 'live') openLiveDetail(state.detail);
    else openDetail(state.detail);
  }
})();
