/* Load after app.js so the calendar data and rows are initialized. */
(() => {
  const tabs = [...document.querySelectorAll('.analysis-tab')];
  const panes = [...document.querySelectorAll('.analysis-pane')];
  const activateTab = (tab) => {
    tabs.forEach((t) => {
      const on = t === tab;
      t.classList.toggle('is-selected', on);
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
    });
    panes.forEach((p) => { p.hidden = p.dataset.pane !== tab.dataset.analysisPane; });
  };
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => activateTab(tab));
    tab.addEventListener('keydown', (event) => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = tabs.length - 1;
      else return;
      event.preventDefault();
      activateTab(tabs[next]);
      tabs[next].focus();
    });
  });

  const body = document.getElementById('calendarMonthRows');
  const dataEl = document.getElementById('trade-data');
  if (!body || !dataEl) return;
  const trades = JSON.parse(dataEl.textContent);
  if (!Array.isArray(trades)) throw new TypeError('Calendar trade data must be an array.');
  const table = body.closest('table');
  const cell = (tag, text) => { const c = document.createElement(tag); c.textContent = text; return c; };

  function stats(list) {
    const w = list.filter((t) => t.outcome === 'WIN').length;
    const l = list.filter((t) => t.outcome === 'LOSS').length;
    const rec = list.filter((t) => t.followedPlan === true || t.followedPlan === false);
    const plan = rec.length ? Math.round(rec.filter((t) => t.followedPlan).length / rec.length * 100) + '%' : '—';
    return { wl: list.length ? w + ' / ' + l : '—', plan, pnl: list.reduce((s, t) => s + Number(t.pnl || 0), 0) };
  }

  function enhance() {
    const rows = [...body.rows];
    if (rows.length !== 12 || rows[0].dataset.mt) return;
    const year = document.getElementById('calendarTableYear').value;
    const currency = document.getElementById('calendarCurrency').value;
    const inYear = trades.filter((t) => (t.currency || 'USD') === currency && String(t.date).startsWith(year + '-'));
    const headRow = table.tHead && table.tHead.rows[0];
    if (headRow && headRow.cells.length === 4) {
      headRow.cells[1].after(cell('th', 'W / L'));
      headRow.cells[3].after(cell('th', 'Plan'));
      headRow.cells[2].scope = headRow.cells[4].scope = 'col';
    }
    const buttons = [...document.querySelectorAll('#monthlyPerformance .month-performance')];
    const per = rows.map((_, i) => stats(inYear.filter((t) => String(t.date).slice(5, 7) === String(i + 1).padStart(2, '0'))));
    const max = Math.max(1, ...per.map((s) => Math.abs(s.pnl)));
    rows.forEach((row, i) => {
      row.dataset.mt = '1';
      const s = per[i];
      const empty = row.cells[1].textContent.trim() === '0';
      row.cells[1].after(cell('td', s.wl));
      row.cells[3].after(cell('td', s.plan));
      const pl = row.cells[row.cells.length - 1];
      if (!empty) {
        const bar = document.createElement('span');
        bar.className = 'mt-bar ' + (s.pnl > 0 ? 'pos' : s.pnl < 0 ? 'neg' : '');
        const fill = document.createElement('i');
        fill.style.width = Math.max(4, Math.abs(s.pnl) / max * 100) + '%';
        bar.append(fill);
        pl.append(bar);
      }
      row.classList.toggle('is-empty', empty);
      row.classList.toggle('is-current', !!buttons[i] && buttons[i].classList.contains('is-selected'));
    });
    const foot = table.tFoot && table.tFoot.rows[0];
    if (foot) {
      const t = stats(inYear);
      if (foot.cells.length === 4) {
        foot.cells[1].after(cell('td', ''));
        foot.cells[3].after(cell('td', ''));
      }
      foot.cells[2].textContent = t.wl;
      foot.cells[4].textContent = t.plan;
    }
  }
  let queued = false;
  const schedule = () => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; enhance(); }); };
  new MutationObserver(schedule).observe(body, { childList: true });
  schedule();
})();
