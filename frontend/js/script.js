(function () {
  const CURRENCY = '₹';
  const API = '/api/entries';

  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  let today = new Date();
  let viewYear = today.getFullYear();
  let viewMonth = today.getMonth(); // 0-indexed
  let activeFilter = 'all';
  let currentEntries = [];

  function monthKey(y, m) {
    return `${y}-${String(m + 1).padStart(2, '0')}`;
  }

  // ---------- API calls ----------
  async function apiGetEntries(month) {
    const res = await fetch(`${API}?month=${month}`);
    if (!res.ok) throw new Error('Failed to load entries');
    return res.json();
  }

  async function apiAddEntry(payload) {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to add entry');
    }
    return res.json();
  }

  async function apiToggleEntry(id, paid) {
    const res = await fetch(`${API}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paid })
    });
    if (!res.ok) throw new Error('Failed to update entry');
    return res.json();
  }

  async function apiDeleteEntry(id) {
    const res = await fetch(`${API}/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete entry');
  }

  async function apiClearMonth(month) {
    const res = await fetch(`${API}/month/${month}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to clear month');
  }

  // ---------- DOM refs ----------
  const currentMonthEl = document.getElementById('currentMonth');
  const ledgerBody = document.getElementById('ledgerBody');
  const emptyState = document.getElementById('emptyState');
  const ledgerTable = document.getElementById('ledgerTable');
  const entryForm = document.getElementById('entryForm');
  const entryName = document.getElementById('entryName');
  const entryCategory = document.getElementById('entryCategory');
  const entryAmount = document.getElementById('entryAmount');
  const entryDue = document.getElementById('entryDue');
  const totalDueEl = document.getElementById('totalDue');
  const totalPaidEl = document.getElementById('totalPaid');
  const totalOutstandingEl = document.getElementById('totalOutstanding');
  const entryCountEl = document.getElementById('entryCount');
  const filterChips = document.querySelectorAll('.filter-chip');
  const clearMonthBtn = document.getElementById('clearMonth');
  const btnAdd = entryForm.querySelector('.btn-add');

  // ---------- Rendering helpers ----------
  function formatMoney(n) {
    return CURRENCY + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  }

  function formatDue(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function applyFilter(entries) {
    return entries.filter(e => {
      if (activeFilter === 'paid') return e.paid;
      if (activeFilter === 'unpaid') return !e.paid;
      return true;
    });
  }

  function renderRows() {
    const filtered = applyFilter(currentEntries);
    ledgerBody.innerHTML = '';

    if (filtered.length === 0) {
      emptyState.style.display = 'block';
      ledgerTable.style.display = currentEntries.length === 0 ? 'none' : 'table';
    } else {
      emptyState.style.display = 'none';
      ledgerTable.style.display = 'table';
    }

    filtered
      .slice()
      .sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'))
      .forEach(entry => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><button class="status-toggle ${entry.paid ? 'paid' : ''}" data-id="${entry.id}" aria-label="Toggle paid"></button></td>
          <td class="row-name ${entry.paid ? 'is-paid' : ''}">${escapeHtml(entry.name)}</td>
          <td class="row-cat"><span class="cat-tag">${escapeHtml(entry.category)}</span></td>
          <td class="row-due row-due-cell">${formatDue(entry.due)}</td>
          <td class="row-amt">${formatMoney(entry.amount)}</td>
          <td class="row-actions"><button class="btn-del" data-id="${entry.id}" aria-label="Delete">✕</button></td>
        `;
        ledgerBody.appendChild(tr);
      });

    const total = currentEntries.reduce((sum, e) => sum + Number(e.amount), 0);
    const paid = currentEntries.filter(e => e.paid).reduce((sum, e) => sum + Number(e.amount), 0);
    const outstanding = total - paid;

    totalDueEl.textContent = formatMoney(total);
    totalPaidEl.textContent = formatMoney(paid);
    totalOutstandingEl.textContent = formatMoney(outstanding);
    entryCountEl.textContent = currentEntries.length;
  }

  async function loadAndRender() {
    currentMonthEl.textContent = `${monthNames[viewMonth]} ${viewYear}`;
    try {
      currentEntries = await apiGetEntries(monthKey(viewYear, viewMonth));
    } catch (e) {
      console.error(e);
      currentEntries = [];
    }
    renderRows();
  }

  // ---------- Events ----------
  entryForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    const name = entryName.value.trim();
    const amount = parseFloat(entryAmount.value);
    if (!name || isNaN(amount)) return;

    btnAdd.disabled = true;
    try {
      await apiAddEntry({
        name,
        category: entryCategory.value,
        amount,
        due: entryDue.value || '',
        month: monthKey(viewYear, viewMonth)
      });
      entryForm.reset();
      entryName.focus();
      await loadAndRender();
    } catch (err) {
      alert(err.message || 'Could not add entry');
    } finally {
      btnAdd.disabled = false;
    }
  });

  ledgerBody.addEventListener('click', async function (e) {
    const toggleBtn = e.target.closest('.status-toggle');
    const delBtn = e.target.closest('.btn-del');

    if (toggleBtn) {
      const id = toggleBtn.dataset.id;
      const entry = currentEntries.find(x => x.id === id);
      if (!entry) return;
      try {
        await apiToggleEntry(id, !entry.paid);
        await loadAndRender();
      } catch (err) {
        console.error(err);
      }
    }

    if (delBtn) {
      const id = delBtn.dataset.id;
      try {
        await apiDeleteEntry(id);
        await loadAndRender();
      } catch (err) {
        console.error(err);
      }
    }
  });

  filterChips.forEach(chip => {
    chip.addEventListener('click', function () {
      filterChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeFilter = chip.dataset.filter;
      renderRows();
    });
  });

  document.getElementById('prevMonth').addEventListener('click', function () {
    viewMonth--;
    if (viewMonth < 0) { viewMonth = 11; viewYear--; }
    loadAndRender();
  });

  document.getElementById('nextMonth').addEventListener('click', function () {
    viewMonth++;
    if (viewMonth > 11) { viewMonth = 0; viewYear++; }
    loadAndRender();
  });

  clearMonthBtn.addEventListener('click', async function () {
    if (confirm(`Clear all entries for ${monthNames[viewMonth]} ${viewYear}? This cannot be undone.`)) {
      try {
        await apiClearMonth(monthKey(viewYear, viewMonth));
        await loadAndRender();
      } catch (err) {
        console.error(err);
      }
    }
  });

  // ---------- Init ----------
  loadAndRender();
})();
