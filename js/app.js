/*
 * JobBoard · Nabintou S. Fofana · 2025
 * MIT-licensed code · https://github.com/NabintouSFofana/JobBoard
 */

/* ============================================================
   JOBBOARD
   Editorial classifieds · vanilla JS · no framework
   ============================================================ */

(() => {
  'use strict';

  const STORAGE_KEY = 'jobboard.bookmarks.v2';

  // ── Detect which page we're on ────────────────────────────
  const isBookmarksPage = document.body.dataset.page === 'bookmarks';

  // ── Shared DOM refs ───────────────────────────────────────
  const $ = (id) => document.getElementById(id);
  const navBookmarkCount = $('navBookmarkCount');
  const toast = $('toast');
  const toastText = $('toastText');
  const resultsCount = $('resultsCount');
  const emptyState = $('emptyState');

  // ── Storage helpers ───────────────────────────────────────
  function loadBookmarks() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
    catch { return []; }
  }
  function saveBookmarks(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    updateNavCount();
  }
  function updateNavCount() {
    if (!navBookmarkCount) return;
    const n = loadBookmarks().length;
    navBookmarkCount.textContent = String(n);
    navBookmarkCount.dataset.empty = n === 0 ? 'true' : 'false';
  }
  updateNavCount();

  // ── Toast ─────────────────────────────────────────────────
  let toastTimer;
  function showToast(message) {
    if (!toast) return;
    toastText.textContent = message;
    toast.hidden = false;
    requestAnimationFrame(() => toast.classList.add('is-visible'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('is-visible');
      setTimeout(() => { toast.hidden = true; }, 250);
    }, 2200);
  }

  // ── Render a job item (shared) ────────────────────────────
  function renderJobItem(job, index, { savedSet, onToggle }) {
    const li = document.createElement('li');
    li.className = 'job-item';
    li.dataset.id = job.id;

    // Number
    const num = document.createElement('span');
    num.className = 'job-num';
    num.textContent = String(index + 1).padStart(2, '0');

    // Body
    const body = document.createElement('div');
    body.className = 'job-body';

    const title = document.createElement('h3');
    title.className = 'job-title';
    title.textContent = job.title;

    const meta = document.createElement('p');
    meta.className = 'job-meta';
    const company = document.createElement('span');
    company.className = 'job-company';
    company.textContent = job.company;
    const sep1 = document.createElement('span'); sep1.className = 'sep'; sep1.textContent = '·';
    const location = document.createElement('span');
    location.textContent = job.location;
    meta.append(company, sep1, location);
    if (job.salary) {
      const sep2 = document.createElement('span'); sep2.className = 'sep'; sep2.textContent = '·';
      const salary = document.createElement('span');
      salary.textContent = job.salary;
      meta.append(sep2, salary);
    }
    if (job.posted) {
      const sep3 = document.createElement('span'); sep3.className = 'sep'; sep3.textContent = '·';
      const posted = document.createElement('span');
      posted.className = 'posted';
      posted.textContent = job.posted;
      meta.append(sep3, posted);
    }

    const tags = document.createElement('div');
    tags.className = 'job-tags';
    const typeTag = document.createElement('span');
    typeTag.className = `tag type-${job.type.toLowerCase().replace(/\s+/g, '-')}`;
    typeTag.textContent = job.type;
    tags.append(typeTag);

    const desc = document.createElement('p');
    desc.className = 'job-desc';
    desc.textContent = job.description;

    body.append(title, meta, tags, desc);

    // Actions column = just the save button
    const actions = document.createElement('div');
    actions.className = 'job-actions';

    const bookmarkBtn = document.createElement('button');
    bookmarkBtn.type = 'button';
    bookmarkBtn.className = 'bookmark-btn';
    const isSaved = savedSet.has(job.id);
    if (isSaved) bookmarkBtn.classList.add('is-saved');
    bookmarkBtn.innerHTML = `
      <svg class="bookmark-icon" viewBox="0 0 14 16" fill="none" aria-hidden="true">
        <path d="M2 1 h10 v14 l-5 -3.5 l-5 3.5z" stroke="currentColor" stroke-width="1.4" fill="${isSaved ? 'currentColor' : 'none'}" stroke-linejoin="round"/>
      </svg>
      <span class="bookmark-label">${isSaved ? 'Saved' : 'Save'}</span>
    `;
    bookmarkBtn.setAttribute('aria-pressed', String(isSaved));
    bookmarkBtn.setAttribute('aria-label', isSaved ? `Unsave "${job.title}"` : `Save "${job.title}"`);
    bookmarkBtn.addEventListener('click', () => onToggle(job, bookmarkBtn, li));

    actions.append(bookmarkBtn);

    li.append(num, body, actions);
    return li;
  }

  function setBookmarkUI(btn, saved) {
    btn.classList.toggle('is-saved', saved);
    btn.setAttribute('aria-pressed', String(saved));
    const label = btn.querySelector('.bookmark-label');
    const svgPath = btn.querySelector('.bookmark-icon path');
    if (label) label.textContent = saved ? 'Saved' : 'Save';
    if (svgPath) svgPath.setAttribute('fill', saved ? 'currentColor' : 'none');
  }

  // ─── LISTINGS PAGE ────────────────────────────────────────
  if (!isBookmarksPage) {
    const jobList = $('jobList');
    const searchTitle = $('searchTitle');
    const locationFilter = $('locationFilter');
    const typeFilter = $('typeFilter');
    const clearFilters = $('clearFilters');
    const errorState = $('errorState');

    let allJobs = [];

    async function loadJobs() {
      try {
        allJobs = readInlineJobs() ?? await fetchJobs();
        populateFilters(allJobs);
        render();
      } catch (err) {
        console.error('JobBoard: load failed', err);
        errorState.hidden = false;
      }
    }

    // Primary: read the inline <script type="application/json" id="jobsData"> block.
    // This works from file:// (no server needed), GitHub Pages, or any host.
    function readInlineJobs() {
      const tag = document.getElementById('jobsData');
      if (!tag) return null;
      try {
        const parsed = JSON.parse(tag.textContent);
        return Array.isArray(parsed) && parsed.length ? parsed : null;
      } catch {
        return null;
      }
    }

    // Fallback: fetch the same data from the standalone JSON file.
    // Only used if the inline block is missing or malformed.
    async function fetchJobs() {
      const res = await fetch('data/jobs.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    }

    function populateFilters(jobs) {
      const locs = [...new Set(jobs.map(j => j.location))].sort();
      const types = [...new Set(jobs.map(j => j.type))].sort();
      for (const loc of locs) {
        const opt = document.createElement('option');
        opt.value = loc; opt.textContent = loc;
        locationFilter.appendChild(opt);
      }
      for (const t of types) {
        const opt = document.createElement('option');
        opt.value = t; opt.textContent = t;
        typeFilter.appendChild(opt);
      }
    }

    function render() {
      const q = searchTitle.value.trim().toLowerCase();
      const loc = locationFilter.value;
      const type = typeFilter.value;

      const filtered = allJobs.filter(job => {
        const matchesTitle = !q
          || job.title.toLowerCase().includes(q)
          || job.company.toLowerCase().includes(q)
          || (job.description || '').toLowerCase().includes(q);
        const matchesLoc = !loc || job.location === loc;
        const matchesType = !type || job.type === type;
        return matchesTitle && matchesLoc && matchesType;
      });

      jobList.innerHTML = '';
      const savedSet = new Set(loadBookmarks().map(b => b.id));

      if (!filtered.length) {
        emptyState.hidden = false;
      } else {
        emptyState.hidden = true;
        filtered.forEach((job, i) => {
          const li = renderJobItem(job, i, {
            savedSet,
            onToggle: (job, btn) => toggleBookmark(job, btn),
          });
          jobList.appendChild(li);
        });
      }

      resultsCount.textContent = `${filtered.length} listing${filtered.length === 1 ? '' : 's'}`;
    }

    function toggleBookmark(job, btn) {
      const list = loadBookmarks();
      const idx = list.findIndex(b => b.id === job.id);
      if (idx === -1) {
        list.push(job);
        saveBookmarks(list);
        setBookmarkUI(btn, true);
        showToast(`Saved "${truncate(job.title, 36)}"`);
      } else {
        list.splice(idx, 1);
        saveBookmarks(list);
        setBookmarkUI(btn, false);
        showToast(`Removed "${truncate(job.title, 36)}"`);
      }
    }

    function truncate(s, n) { return s.length > n ? s.slice(0, n - 1) + '…' : s; }

    searchTitle.addEventListener('input', debounce(render, 120));
    locationFilter.addEventListener('change', render);
    typeFilter.addEventListener('change', render);
    clearFilters.addEventListener('click', () => {
      searchTitle.value = '';
      locationFilter.value = '';
      typeFilter.value = '';
      render();
      searchTitle.focus();
    });

    loadJobs();
  }

  // ─── BOOKMARKS PAGE ───────────────────────────────────────
  if (isBookmarksPage) {
    const bookmarkList = $('bookmarkList');
    const clearAllBtn = $('clearAllBtn');

    function renderSaved() {
      const list = loadBookmarks();
      bookmarkList.innerHTML = '';

      if (!list.length) {
        emptyState.hidden = false;
        clearAllBtn.hidden = true;
        resultsCount.textContent = '0 saved';
        return;
      }
      emptyState.hidden = true;
      clearAllBtn.hidden = false;
      resultsCount.textContent = `${list.length} saved`;

      const savedSet = new Set(list.map(b => b.id));
      list.forEach((job, i) => {
        const li = renderJobItem(job, i, {
          savedSet,
          onToggle: (job, btn, li) => removeOne(job, li),
        });
        bookmarkList.appendChild(li);
      });
    }

    function removeOne(job, li) {
      const list = loadBookmarks().filter(b => b.id !== job.id);
      saveBookmarks(list);
      li.style.transition = 'opacity .25s, transform .25s';
      li.style.opacity = '0';
      li.style.transform = 'translateX(-8px)';
      setTimeout(() => {
        renderSaved();
        showToast(`Removed "${job.title}"`);
      }, 240);
    }

    clearAllBtn.addEventListener('click', () => {
      const n = loadBookmarks().length;
      if (!n) return;
      if (!confirm(`Clear all ${n} saved listing${n === 1 ? '' : 's'}? This can't be undone.`)) return;
      saveBookmarks([]);
      renderSaved();
      showToast('Cleared saved listings');
    });

    renderSaved();
  }

  // ── Utils ─────────────────────────────────────────────────
  function debounce(fn, ms) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }
})();
