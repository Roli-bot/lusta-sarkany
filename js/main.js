/* ================================================================
   LUSTA SÁRKÁNY MASSZÁZS ÉS MOZGÁS
   Jenei Zsolt – Aldea Stúdió, Budapest
   Fő JavaScript fájl · main.js

   KONFIGURÁCIÓ:
   ─────────────────────────────────────────────────────────────
   • CFG.availableDays  – elérhető hétköznapok (0=V, 1=H…6=Szo)
   • CFG.sundaySlots    – vasárnapi időpontok
   • CFG.weekdaySlots   – hétköznapi időpontok
   • CFG.bookedSlots    – foglalt időpontok (YYYY-MM-DD: ['HH:MM'])

   BACKEND INTEGRÁCIÓ:
   • Keresse a "TODO: BACKEND" megjegyzéseket
   ================================================================ */

'use strict';

/* ── KONFIGURÁCIÓ ─────────────────────────────────────────────── */
const CFG = {
  /*
   * Elérhető napok a héten.
   * 0 = Vasárnap (fő ajánlat!), 1 = Hétfő … 6 = Szombat
   * TODO: Igény szerint módosítsa az elérhető napokat.
   */
  availableDays: [0, 4, 5, 6],   // Vasárnap, Csütörtök, Péntek, Szombat

  /*
   * Vasárnapi időpontok (fő ajánlat – 60 vagy 90 perces kezelések)
   * TODO: Módosítsa a valódi nyitvatartáshoz.
   */
  sundaySlots: ['10:00', '11:30', '13:00', '14:30', '16:00', '17:30'],

  /*
   * Hétköznapi időpontok
   * TODO: Módosítsa a valódi nyitvatartáshoz.
   */
  weekdaySlots: ['14:00', '15:30', '17:00', '18:30'],

  /*
   * Foglalt időpontok – szótár: 'YYYY-MM-DD': ['HH:MM', ...]
   * TODO: BACKEND – Cserélje le API hívásra:
   *   GET /api/booked-slots?month=2026-05
   *   Válasz: { "2026-05-18": ["10:00", "11:30"], ... }
   */
  bookedSlots: {
    // Példa: '2026-05-18': ['10:00'],
  },
};

/* ── SEGÉDFÜGGVÉNYEK ──────────────────────────────────────────── */
const HU_MONTHS = [
  'Január','Február','Március','Április','Május','Június',
  'Július','Augusztus','Szeptember','Október','November','December',
];
const HU_DAYS  = ['H','K','Sze','Cs','P','Szo','V'];   // Hétfőtől vasárnapig
const HU_DAYS_FULL = ['vasárnap','hétfő','kedd','szerda','csütörtök','péntek','szombat'];

function pad2(n) { return String(n).padStart(2, '0'); }
function toDS(y, m, d) { return `${y}-${pad2(m)}-${pad2(d)}`; }

function huDateFull(ds) {
  const [y, m, d] = ds.split('-').map(Number);
  const dayIdx = new Date(y, m - 1, d).getDay();
  return `${y}. ${HU_MONTHS[m - 1]} ${d}., ${HU_DAYS_FULL[dayIdx]}`;
}

function isSunday(date) { return date.getDay() === 0; }

/* ── NAVIGÁCIÓ ────────────────────────────────────────────────── */
function initNav() {
  const navbar = document.querySelector('.navbar');
  const burger = document.querySelector('.nav-burger');
  const mMenu  = document.querySelector('.mobile-menu');
  const page   = location.pathname.split('/').pop() || 'index.html';

  /* Scroll árnyék */
  if (navbar) {
    const onScroll = () => navbar.classList.toggle('scrolled', scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* Hamburger */
  if (burger && mMenu) {
    burger.addEventListener('click', () => {
      const open = mMenu.classList.toggle('open');
      burger.classList.toggle('open', open);
      burger.setAttribute('aria-expanded', String(open));
    });
    mMenu.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        mMenu.classList.remove('open');
        burger.classList.remove('open');
        burger.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* Aktív nav link */
  document.querySelectorAll('.nav-links a, .mobile-menu a').forEach(a => {
    const href = a.getAttribute('href') || '';
    if (href === page || (page === '' && href === 'index.html')) {
      a.classList.add('active');
    }
  });

  /* URL paraméter: ?tab=foglalas → automatikusan a foglalás fülre ugrik */
  const params = new URLSearchParams(location.search);
  if (params.get('tab') === 'foglalas') {
    const tabBtn = document.querySelector('.tab-btn[data-tab="panel-booking"]');
    if (tabBtn) tabBtn.click();
  }

  /* URL paraméter: ?szolgaltatas=xxx → előre kiválasztja a szolgáltatást */
  const svc = params.get('szolgaltatas');
  if (svc) {
    const sel = document.getElementById('bf-service');
    if (sel) {
      const opt = [...sel.options].find(o => o.value.includes(svc));
      if (opt) sel.value = opt.value;
    }
    const cSel = document.getElementById('c-service');
    if (cSel) {
      const opt = [...cSel.options].find(o => o.value.includes(svc));
      if (opt) cSel.value = opt.value;
    }
  }
}

/* ── NAPTÁR ───────────────────────────────────────────────────── */
const CAL = {
  year:   new Date().getFullYear(),
  month:  new Date().getMonth(),   // 0-indexed
  picked: null,   // 'YYYY-MM-DD'
  time:   null,   // 'HH:MM'
};

function initCalendar() {
  if (!document.getElementById('cal-grid')) return;
  renderCal();
  document.getElementById('cal-prev').addEventListener('click', () => {
    if (--CAL.month < 0) { CAL.month = 11; CAL.year--; }
    renderCal();
  });
  document.getElementById('cal-next').addEventListener('click', () => {
    if (++CAL.month > 11) { CAL.month = 0; CAL.year++; }
    renderCal();
  });
}

function renderCal() {
  const { year, month, picked } = CAL;
  const today = new Date(); today.setHours(0, 0, 0, 0);

  document.getElementById('cal-month-lbl').textContent =
    `${HU_MONTHS[month]} ${year}`;

  const grid = document.getElementById('cal-grid');

  /* Nap fejlécek: H K Sze Cs P Szo V */
  let html = HU_DAYS.map((d, i) =>
    `<div class="cal-dn">${d}</div>`
  ).join('');

  /* Eltolás: hétfőtől számítva */
  const firstDay = new Date(year, month, 1);
  let offset = firstDay.getDay() - 1;
  if (offset < 0) offset = 6;   // vasárnap → 6. pozíció
  for (let i = 0; i < offset; i++) html += '<div class="cal-d empty"></div>';

  const days = new Date(year, month + 1, 0).getDate();

  for (let d = 1; d <= days; d++) {
    const date  = new Date(year, month, d);
    const ds    = toDS(year, month + 1, d);
    const sun   = isSunday(date);
    const past  = date < today;
    const avail = !past && CFG.availableDays.includes(date.getDay());
    const sel   = ds === picked;

    let cls = 'cal-d';
    if (sun)   cls += ' sun-day';
    if (past)  cls += ' past';
    else if (avail) cls += ' avail';
    else       cls += ' unavail';
    if (sel)   cls += ' picked';

    const ariaLbl = `${d} ${HU_MONTHS[month]}${sun ? ' (vasárnap)' : ''}${avail ? ', elérhető' : past ? ', múltbeli' : ', nem elérhető'}`;
    const attrs   = avail ? `role="button" tabindex="0" data-date="${ds}"` : '';

    html += `<div class="${cls}" ${attrs} aria-label="${ariaLbl}">${d}</div>`;
  }

  grid.innerHTML = html;

  /* Kattintás és billentyűzet */
  grid.querySelectorAll('.cal-d.avail').forEach(el => {
    el.addEventListener('click', () => pickDate(el.dataset.date));
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pickDate(el.dataset.date); }
    });
  });
}

function pickDate(ds) {
  CAL.picked = ds;
  CAL.time   = null;
  clearCalErr();
  renderCal();
  renderSlots(ds);
  syncPill();
  syncHidden();
}

function renderSlots(ds) {
  const wrap = document.getElementById('time-wrap');
  const grid = document.getElementById('time-grid');
  if (!wrap || !grid) return;

  const date   = new Date(ds);
  const sun    = isSunday(date);
  const slots  = sun ? CFG.sundaySlots : CFG.weekdaySlots;
  const booked = CFG.bookedSlots[ds] || [];

  document.getElementById('time-subhead').textContent =
    sun
      ? `Vasárnapi időpontok – ${huDateFull(ds)}`
      : `Elérhető időpontok – ${huDateFull(ds)}`;

  grid.innerHTML = slots.map(t => {
    const isBooked = booked.includes(t);
    const isPicked = t === CAL.time;
    let cls = 'time-slot';
    if (isBooked) cls += ' ts-booked';
    if (isPicked) cls += ' ts-picked';
    return isBooked
      ? `<button class="${cls}" disabled aria-disabled="true" aria-label="${t}, foglalt">${t}</button>`
      : `<button class="${cls}" data-time="${t}" aria-label="${t}">${t}</button>`;
  }).join('');

  grid.querySelectorAll('.time-slot:not(.ts-booked)').forEach(btn => {
    btn.addEventListener('click', () => pickTime(btn.dataset.time));
  });

  wrap.classList.add('show');
}

function pickTime(t) {
  CAL.time = t;
  renderSlots(CAL.picked);
  syncPill();
  syncHidden();
}

function clearBooking() {
  CAL.picked = null;
  CAL.time   = null;
  renderCal();
  const tw = document.getElementById('time-wrap');
  if (tw) tw.classList.remove('show');
  syncPill();
  syncHidden();
}

function syncPill() {
  const pill = document.getElementById('booking-pill');
  const txt  = document.getElementById('pill-text');
  if (!pill) return;
  if (CAL.picked && CAL.time) {
    txt.innerHTML = `<strong>${huDateFull(CAL.picked)} – ${CAL.time}</strong>`;
    pill.classList.add('show');
  } else if (CAL.picked) {
    txt.innerHTML = `${huDateFull(CAL.picked)} – <em>válasszon időpontot</em>`;
    pill.classList.add('show');
  } else {
    pill.classList.remove('show');
  }
}

function syncHidden() {
  const df = document.getElementById('hf-date');
  const tf = document.getElementById('hf-time');
  if (df) df.value = CAL.picked ? huDateFull(CAL.picked) : '';
  if (tf) tf.value = CAL.time || '';
}

function clearCalErr() {
  document.getElementById('cal-err')?.classList.remove('show');
}
function showCalErr() {
  document.getElementById('cal-err')?.classList.add('show');
}

/* ── FORM VALIDÁCIÓ ───────────────────────────────────────────── */
function isValidEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
function isValidPhone(v) { return /^[\+\d\s\-\(\)]{7,}$/.test(v.trim()); }

function validateForm(form) {
  let ok = true;
  form.querySelectorAll('[required]').forEach(f => {
    clearErr(f);
    const v = f.value.trim();
    if (!v) { setErr(f, 'Ez a mező kötelező.'); ok = false; }
    else if (f.type === 'email' && !isValidEmail(v))  { setErr(f, 'Adjon meg érvényes e-mail címet.'); ok = false; }
    else if (f.type === 'tel'   && !isValidPhone(v))  { setErr(f, 'Adjon meg érvényes telefonszámot.'); ok = false; }
  });
  return ok;
}

function setErr(field, msg) {
  field.style.borderColor = 'var(--color-error)';
  const g = field.closest('.form-group');
  if (!g) return;
  clearErr(field);
  field.style.borderColor = 'var(--color-error)';
  const el = document.createElement('span');
  el.className = 'form-error';
  el.textContent = msg;
  g.appendChild(el);
}
function clearErr(field) {
  field.style.borderColor = '';
  field.closest('.form-group')?.querySelector('.form-error')?.remove();
}

function setBtnLoading(btn, loading, label) {
  btn.disabled     = loading;
  btn.textContent  = label;
  btn.style.opacity = loading ? '.65' : '1';
}

/* Szimulált kérés – törölje, ha van valódi backend */
const fakeReq = () => new Promise(r => setTimeout(r, 1200));

/* ── KAPCSOLATŰRLAP ───────────────────────────────────────────── */
function initContactForm() {
  const form = document.getElementById('contact-form');
  if (!form) return;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!validateForm(form)) return;
    const btn = form.querySelector('[type="submit"]');
    setBtnLoading(btn, true, 'Küldés…');
    /*
     * TODO: BACKEND – Üzenet küldése e-mailben:
     * await fetch('/api/contact', {
     *   method: 'POST',
     *   headers: { 'Content-Type': 'application/json' },
     *   body: JSON.stringify(Object.fromEntries(new FormData(form))),
     * });
     * Ajánlott integráció: EmailJS, Resend, Nodemailer, Formspree
     */
    await fakeReq();
    setBtnLoading(btn, false, 'Üzenet küldése');
    form.style.display = 'none';
    document.getElementById('contact-success').classList.add('show');
  });
}

/* ── FOGLALÁSŰRLAP ────────────────────────────────────────────── */
function initBookingForm() {
  const form = document.getElementById('booking-form');
  if (!form) return;
  form.addEventListener('submit', async e => {
    e.preventDefault();

    if (!CAL.picked || !CAL.time) {
      showCalErr();
      document.getElementById('cal-wrap')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (!validateForm(form)) return;

    const btn = form.querySelector('[type="submit"]');
    setBtnLoading(btn, true, 'Foglalás…');
    /*
     * TODO: BACKEND – Foglalás adatainak küldése:
     * const data = {
     *   name:        form.querySelector('#bf-name').value,
     *   email:       form.querySelector('#bf-email').value,
     *   phone:       form.querySelector('#bf-phone').value,
     *   service:     form.querySelector('#bf-service').value,
     *   date:        CAL.picked,
     *   time:        CAL.time,
     *   dateLabel:   huDateFull(CAL.picked),
     *   note:        form.querySelector('#bf-note').value,
     * };
     * await fetch('/api/booking', {
     *   method: 'POST',
     *   headers: { 'Content-Type': 'application/json' },
     *   body: JSON.stringify(data),
     * });
     *
     * Ajánlott integráció:
     * • Google Calendar API – az időpont beírása Jenei Zsolt naptárába
     * • Calendly / Cal.com – teljes foglalórendszer
     * • EmailJS / Resend – visszaigazoló e-mail küldése az ügyfélnek
     */
    await fakeReq();
    setBtnLoading(btn, false, 'Foglalás elküldése');
    document.getElementById('booking-form-wrap').style.display = 'none';
    document.getElementById('booking-success').classList.add('show');
  });
}

/* ── FÜLEK ────────────────────────────────────────────────────── */
function initTabs() {
  const tabs = document.querySelectorAll('.tab-btn');
  if (!tabs.length) return;
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => {
        t.classList.remove('active');
        document.getElementById(t.dataset.tab)?.classList.remove('active');
      });
      tab.classList.add('active');
      document.getElementById(tab.dataset.tab)?.classList.add('active');
    });
  });
}

/* ── SCROLL REVEAL ────────────────────────────────────────────── */
function initReveal() {
  const els = document.querySelectorAll('.reveal');
  if (!els.length) return;

  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  els.forEach(el => io.observe(el));
}

/* ── HERO PARALLAX ────────────────────────────────────────────── */
function initHeroParallax() {
  const img = document.getElementById('hero-parallax-img');
  if (!img) return;

  /* Disable on reduced-motion or touch-only devices */
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (window.matchMedia('(hover: none)').matches) return;

  const onScroll = () => {
    const scrollY = window.scrollY;
    /* Subtle: image moves at 30% of scroll speed downward */
    img.style.transform = `translateY(${scrollY * 0.28}px)`;
  };

  window.addEventListener('scroll', onScroll, { passive: true });
}

/* ── INIT ─────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initNav();
  initCalendar();
  initContactForm();
  initBookingForm();
  initTabs();
  initReveal();
  initHeroParallax();
});
