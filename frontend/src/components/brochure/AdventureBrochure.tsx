import { forwardRef, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import type { PackageItineraryDay, TravelPackage } from '@/types';
import { ADVENTURE_CSS, ADVENTURE_FONTS_HREF } from './adventureCss';

/**
 * The "Adventure" package brochure — the agency's 1080×1350 group-trip design
 * (gold cover title, contents, about, gallery, brief + one page per day,
 * reviews, batch dates, inclusions / exclusions, costing, booking, policies,
 * things to carry, handbook, contact), filled from the package, the
 * organisation and the package's live departures.
 *
 * Pages without content are left out (it's a customer-facing document).
 * Built as an HTML string from the original template's markup — every value
 * goes through esc() first; **word** / __word__ are applied after escaping.
 * After render, a fit pass shrinks text that would overlap or run off a page.
 */

export interface AdventureOrg {
  name: string;
  logoUrl: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  ifscCode: string | null;
  contactEmail?: string | null;
  address?: string | null;
  phones?: string[];
  whatsappNumber?: string | null;
  socialLinks?: { label: string; url: string }[];
}
export interface AdventureReview {
  reviewerName: string;
  photoUrl: string | null;
  quote: string;
  rating: number | null;
}
export interface AdventureDeparture {
  departureDate: string;
  returnDate: string | null;
  full: boolean;
}

// --- text helpers ---------------------------------------------------------------
const esc = (s: unknown) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
/** Escaped text with **word** → blue bold and __word__ → bold italic. */
const fmt = (s: string | null | undefined) =>
  esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<b class="hl">$1</b>')
    .replace(/__(.+?)__/g, '<i class="b">$1</i>');
/** "- item" / "• item" / "* item" → "item" (but "**bold**" at the start is kept). */
const stripBullet = (l: string) => l.replace(/^\s*(?:[•\-–»]|\*(?!\*)|\d+[.)])\s+/, '').trim();
const lines = (s: string | null | undefined) =>
  (s ?? '')
    .split('\n')
    .map(stripBullet)
    .filter(Boolean);
const paragraphs = (s: string | null | undefined) =>
  (s ?? '')
    .split(/\n\s*\n|\n/)
    .map(stripBullet)
    .filter(Boolean);
const safeUrl = (u: string | null | undefined) => (u && /^https?:\/\//i.test(u) ? u : '');
const money = (n: number) => n.toLocaleString('en-IN');
const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('') || 'TR';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayMonth = (iso: string) => {
  const [, m, d] = iso.split('-').map(Number);
  return `${String(d).padStart(2, '0')} ${MONTHS[m - 1]}`;
};
const ord = (dm: string) => {
  const [n, m] = dm.split(' ');
  const x = Number(n);
  const s = x % 10 === 1 && x !== 11 ? 'st' : x % 10 === 2 && x !== 12 ? 'nd' : x % 10 === 3 && x !== 13 ? 'rd' : 'th';
  return `${n}<sup>${s}</sup> ${m}`;
};
const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** "Heading:" lines start a new group; "Heading: a, b, c" is a group in one line. */
function groups(text: string | null | undefined, fallback: string): { h: string; items: string[] }[] {
  const out: { h: string; items: string[] }[] = [];
  for (const raw of (text ?? '').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const head = line.match(/^([^:]{2,40}):\s*(.*)$/);
    if (head && !/^\W/.test(line) && (head[2] === '' || head[2].includes(','))) {
      out.push({ h: head[1].trim(), items: head[2] ? head[2].split(',').map((x) => x.trim()).filter(Boolean) : [] });
      continue;
    }
    if (!out.length) out.push({ h: fallback, items: [] });
    out[out.length - 1].items.push(stripBullet(line));
  }
  return out.filter((g) => g.items.length);
}

const socialTag = (label: string, url: string): string | null => {
  const u = url.toLowerCase();
  if (/instagram\.com/.test(u)) return 'ig';
  if (/facebook\.com|fb\.com/.test(u)) return 'f';
  if (/youtube\.com|youtu\.be/.test(u)) return 'yt';
  if (/(twitter|x)\.com/.test(u)) return 'X';
  if (/wa\.me|whatsapp/.test(u)) return 'wa';
  if (/linkedin\.com/.test(u)) return 'in';
  return label ? 'web' : null;
};

const dayPhoto = (d: PackageItineraryDay) => (d.images ?? []).find(Boolean) ?? d.activityBlocks?.find((b) => b.imageUrl)?.imageUrl ?? null;

// --- page builders ----------------------------------------------------------------
interface Ctx {
  pkg: TravelPackage;
  org: AdventureOrg | null;
  reviews: AdventureReview[];
  departures: AdventureDeparture[];
  bookingUrl: string;
  qrDataUrl: string | null;
}

function buildHtml(c: Ctx): string {
  const { pkg, org } = c;
  const brandName = org?.name || 'Our Travel Co.';
  const title = (pkg.bookingTitle || pkg.name).replace(/_/g, ' ');
  const duration = `${pkg.nights}N/${pkg.days}D`;
  const route = pkg.route?.trim() || '';
  const gallery = pkg.galleryImages.filter((u) => safeUrl(u)).slice(0, 5);
  const cover = safeUrl(pkg.bannerImageUrl) || gallery[0] || '';
  const tocImage = gallery[1] || gallery[0] || cover;
  const days = pkg.itinerary;
  const dayImages = days.map(dayPhoto).filter((u): u is string => !!safeUrl(u));
  const briefImages = [...gallery.slice(2), ...dayImages, ...gallery.slice(0, 2)].filter((u, i, a) => a.indexOf(u) === i).slice(0, 3);
  const socials = (org?.socialLinks ?? []).map((l) => socialTag(l.label, l.url)).filter((t, i, a): t is string => !!t && a.indexOf(t) === i);
  if (org?.whatsappNumber && !socials.includes('wa')) socials.push('wa');
  const ratings = c.reviews.filter((r) => r.rating);
  const avg = ratings.length ? (ratings.reduce((s, r) => s + (r.rating ?? 0), 0) / ratings.length).toFixed(1) : null;
  const highlights = pkg.highlights.filter(Boolean).slice(0, 3);

  const img = (src: string, cls = '') => `<div class="ph-img ${cls}">${src ? `<img src="${esc(src)}" alt="">` : ''}</div>`;
  const logo = () =>
    `<div class="logo-badge">${safeUrl(org?.logoUrl) ? `<img src="${esc(org!.logoUrl)}" alt="" data-fallback="${esc(initialsOf(brandName))}">` : esc(initialsOf(brandName))}</div>`;
  const mountains = (col = '#c9d6c0') => `<svg class="mountains" viewBox="0 0 1080 420" preserveAspectRatio="none">
  <path d="M0 420 L0 300 L120 200 L210 260 L330 120 L450 250 L540 190 L660 300 L780 150 L900 260 L1000 210 L1080 260 L1080 420Z" fill="${col}"/>
  <path d="M0 420 L0 350 L160 280 L300 340 L470 260 L620 350 L800 290 L960 350 L1080 320 L1080 420Z" fill="${col}" opacity=".8"/></svg>`;
  const page = (cls: string, html: string, name: string) => `<section class="page ${cls}" data-pdf-page data-name="${esc(name)}">${html}</section>`;

  const out: string[] = [];
  const sections: string[] = [];

  // --- Cover
  const flagC = ['#2a6fdb', '#ffffff', '#e23b3b', '#2fb44a', '#ffd21f'];
  out.push(
    page(
      'cover',
      `${img(cover, 'photo')}<div class="shade"></div>
      <div class="flags">${Array.from({ length: 12 }, (_, i) => `<span style="background:${flagC[i % 5]}"></span>`).join('')}</div>
      ${logo()}
      <div class="title-wrap">
        ${route ? `<div class="route">${esc(route.toUpperCase())}</div>` : ''}
        <h1>${esc(title.toUpperCase())}</h1>
        <div class="dur">${esc(duration)}</div>
      </div>
      ${socials.length ? `<div class="socials" style="${highlights.length ? '' : 'bottom:60px'}">${socials.map((s) => `<span>${esc(s)}</span>`).join('')}</div>` : ''}
      ${highlights.length ? `<div class="awards"><div class="lbl">TRIP HIGHLIGHTS</div>${highlights.map((h) => `<div class="a">${esc(h)}</div>`).join('')}</div>` : ''}`,
      'Cover',
    ),
  );

  // --- About
  const intro = paragraphs(pkg.description);
  const aboutHtml =
    intro.length || highlights.length
      ? page(
          'about bg-light',
          `${logo()}
          <div class="script">A Journey to</div>
          <div class="big">${esc(pkg.destination)}</div>
          ${route ? `<div class="via">${esc(route.toUpperCase())}</div>` : ''}
          ${intro.map((p) => `<p>${fmt(p)}</p>`).join('')}
          ${highlights.length ? `<div class="why">Why travel with <span>${esc(brandName)}</span>?</div>
          <div class="why-box">${highlights.map((h) => `<div><b>${esc(h)}</b></div>`).join('')}</div>` : ''}
          ${avg ? `<div class="ratings"><span>${avg} <em>★★★★★</em></span><span>${c.reviews.length} Reviews</span></div>` : ''}`,
          'About',
        )
      : '';
  if (aboutHtml) sections.push('About Us');

  // --- Gallery
  const galleryHtml = gallery.length
    ? page('bg-sky', `<div class="gallery">${gallery.map((g, i) => img(g, i === 0 ? 'wide' : '')).join('')}</div>${logo()}`, 'Gallery')
    : '';
  if (galleryHtml) sections.push('Group Pictures');

  // --- Brief itinerary + day pages
  const briefHtml = days.length
    ? page(
        'brief bg-sky',
        `${logo()}${mountains()}
        <h2>BRIEF ITINERARY</h2>${route ? `<div class="sub">${esc(route)}</div>` : ''}
        <div class="rows">${days
          .map((d) => {
            const t = esc(d.title).replace(/^(.+?) to (.+)$/, '<span class="r">$1</span> to <b class="hl">$2</b>');
            const km = d.distance?.trim();
            const small = !!km && km.length > 14;
            return `<div class="row"><span class="d">DAY ${d.day}</span>
              <div class="t">${t}${km && !small ? ` <small>(${esc(km)})</small>` : ''}${small ? `<span class="sub2">${esc(km)}</span>` : ''}</div></div>`;
          })
          .join('')}</div>
        ${briefImages.length ? `<div class="polaroids">${briefImages.map((s) => img(s)).join('')}</div>` : ''}`,
        'Brief itinerary',
      )
    : '';
  if (briefHtml) sections.push('Brief Itinerary');

  const dayHtml = days.map((d, i) => {
    const first = i === 0;
    const photo = safeUrl(dayPhoto(d));
    const top = first ? 130 : 46;
    const photoH = photo ? 560 : 0;
    const barTop = photo ? top + photoH + 50 : first ? 150 : 90;
    const km = d.distance?.trim();
    const points = [
      ...paragraphs(d.description),
      ...(d.activityBlocks ?? []).filter((b) => b.name?.trim()).map((b) => `**${b.name.trim()}**${b.description ? ` — ${b.description.trim()}` : ''}`),
      ...(d.stay ? [`**Stay:** ${d.stay}`] : []),
      ...(d.meals ? [`**Meals:** ${d.meals}`] : []),
    ];
    const notes = [...lines(d.notes), ...((d.activities ?? []).length ? [`__Highlight of the Day:__ ${(d.activities ?? []).join(', ')}`] : [])];
    return page(
      'dayp bg-sky',
      `${logo()}${mountains()}
      ${first ? `<div class="head">DETAILED ITINERARY</div>` : ''}
      ${photo ? `<div class="photo" style="top:${top}px">${img(photo)}</div>` : ''}
      <div class="bar" style="top:${barTop}px">
        <div class="dn">DAY ${d.day}</div>
        <div class="tt">${esc(d.title.toUpperCase())}</div>
        ${km ? `<div class="km ${km.length > 14 ? 'small' : ''}">${esc(km)}</div>` : ''}
      </div>
      <ul class="pts" style="top:${barTop + 96}px">${points.map((p) => `<li>${fmt(p)}</li>`).join('')}</ul>
      ${notes.length ? `<div class="note"><div class="tag">NOTE</div><ul class="note-list">${notes.map((n) => `<li>${fmt(n)}</li>`).join('')}</ul></div>` : ''}`,
      `Day ${d.day}`,
    );
  });
  if (dayHtml.length) sections.push('Detailed Itinerary');

  // --- Reviews
  const reviewsHtml = c.reviews.length
    ? page(
        'reviews bg-light',
        `${logo()}<h2>Reviews</h2><div class="sub">${esc(title.toUpperCase())}</div>
        <div class="grid">${c.reviews
          .slice(0, 6)
          .map(
            (r) => `<div class="card"><div class="who"><div class="av">${safeUrl(r.photoUrl) ? `<img src="${esc(r.photoUrl)}" alt="">` : esc((r.reviewerName || 'T')[0].toUpperCase())}</div>
            <div><div class="nm">${esc(r.reviewerName)}</div><div class="st">${'★'.repeat(Math.max(1, Math.min(5, r.rating ?? 5)))}</div></div></div><p>${esc(r.quote)}</p></div>`,
          )
          .join('')}</div>`,
        'Reviews',
      )
    : '';
  if (reviewsHtml) sections.push('Reviews');

  // --- Batches (live departures), 13 per page
  const batches = c.departures.map((d) => ({
    from: dayMonth(d.departureDate),
    to: dayMonth(d.returnDate ?? addDays(d.departureDate, Math.max(0, pkg.nights))),
    full: d.full,
  }));
  const batchHtml: string[] = [];
  for (let i = 0; i < batches.length; i += 13) {
    batchHtml.push(
      page(
        'batches bg-paper',
        `${logo()}${mountains('#d7dde3')}<h2>GROUP TOUR DATES</h2><div class="sub">${esc(title.toUpperCase())}</div>
        <div class="list">${batches
          .slice(i, i + 13)
          .map((b, j) => `<div class="b ${b.full ? 'full' : ''}"><div class="n">BATCH ${i + j + 1}</div><div class="dt">${ord(b.from)}&nbsp;to&nbsp;${ord(b.to)}</div></div>`)
          .join('')}</div>`,
        'Batches',
      ),
    );
  }
  if (batchHtml.length) sections.push('Batches');

  // --- Inclusions / exclusions
  const inc = lines(pkg.inclusions);
  const exc = lines(pkg.exclusions);
  const incHtml = inc.length ? page('incl in bg-paper', `${logo()}${mountains('#e3e3e3')}<h2><span>TRIP INCLUSIONS</span></h2><ul>${inc.map((x) => `<li>${fmt(x)}</li>`).join('')}</ul>`, 'Inclusions') : '';
  const excHtml = exc.length ? page('incl ex bg-paper', `${logo()}${mountains('#e3e3e3')}<h2><span>TRIP EXCLUSIONS</span></h2><ul>${exc.map((x) => `<li>${fmt(x)}</li>`).join('')}</ul>`, 'Exclusions') : '';
  if (incHtml || excHtml) sections.push('Inclusion & Exclusion');

  // --- Costing
  const cur = pkg.priceCurrency || 'INR';
  const options = pkg.pricingOptions.length
    ? [...pkg.pricingOptions].sort((a, b) => (a.season === 'PEAK' ? 1 : 0) - (b.season === 'PEAK' ? 1 : 0)).map((p) => ({ label: p.season === 'PEAK' ? `${p.label} (Peak)` : p.label, price: p.price, old: null as number | null }))
    : [{ label: 'Per Person', price: pkg.priceAmount, old: pkg.originalPrice && pkg.originalPrice > pkg.priceAmount ? pkg.originalPrice : null }];
  const onSale = !!pkg.originalPrice && pkg.originalPrice > pkg.priceAmount;
  const pickup = lines(pkg.pickupPoints);
  const costingHtml = page(
    'costing bg-light',
    `${logo()}
    ${onSale ? `<div class="sale">SALE IS LIVE</div>` : ''}
    <h2>COSTING</h2>${route ? `<div class="route">● ${esc(route)}</div>` : ''}
    <div class="cols ${options.length > 2 ? 'many' : ''}">${options
      .map(
        (o) => `<div class="col"><div class="lb">Offer Price<b>${esc(o.label)}</b></div>
        <div class="price">${esc(cur)} ${money(o.price)}/-</div>
        ${o.old ? `<div class="price old">${esc(cur)} ${money(o.old)}/-</div>` : ''}</div>`,
      )
      .join('')}</div>
    ${pickup.length ? `<div class="notes"><div class="t">✈ PICKUP POINTS ✈</div>${pickup.map((n) => `<p>${esc(n)}</p>`).join('')}</div>` : ''}
    <a class="book" href="${esc(c.bookingUrl)}" style="text-decoration:none"><span>BOOK NOW${pkg.bookingAmount ? ' @' : ''}</span><b>${pkg.bookingAmount ? `${esc(cur)} ${money(pkg.bookingAmount)}/- ` : ''}➜</b></a>
    ${socials.length ? `<div class="soc">${socials.slice(0, 6).map((s) => `<span>${esc(s)}</span>`).join('')}</div>` : ''}
    <div class="redir">This button will take you to the <b>Booking Page.</b></div>
    <div class="foot"><span>${esc(brandName.toUpperCase())}</span><span>${esc(brandName.toUpperCase())}</span><span>${esc(brandName.toUpperCase())}</span></div>`,
    'Costing',
  );
  sections.push('Costing');

  // --- Booking
  const hasBank = !!(org?.bankName || org?.bankAccountNumber || org?.ifscCode);
  const bookingHtml = page(
    'booking bg-blue',
    `${logo()}
    <div class="white-title"><h2>BOOKING</h2><small>PROCESS</small></div>
    <div class="phone">${img(cover || gallery[0] || '')}</div>
    <div class="bank"><div class="h">BOOK YOUR NEXT ADVENTURE!</div>
      ${hasBank
        ? `<p><b>Banking Details:</b><br>${esc(brandName)}${org?.bankName ? `<br>${esc(org.bankName)}` : ''}${org?.bankAccountNumber ? `<br>A/c No : <b>${esc(org.bankAccountNumber)}</b>` : ''}${org?.ifscCode ? `<br>IFSC : <b>${esc(org.ifscCode)}</b>` : ''}</p>`
        : `<p>Scan the code or open the link to see dates, pick your seat and book online.</p>`}
      ${(org?.phones ?? []).length ? `<div class="upi">📞 ${esc(org!.phones![0])}</div>` : ''}
      <div class="bn">BOOK NOW</div></div>
    <div class="pay">
      <div class="c"><div class="l">BOOK ONLINE</div><div class="gw">${esc(brandName.length > 14 ? 'Book Now' : brandName)}</div></div>
      ${c.qrDataUrl ? `<div class="c"><div class="l">SCAN TO BOOK</div><div>Opens this trip’s booking page</div><div class="qr"><img src="${c.qrDataUrl}" alt=""></div></div>` : ''}
    </div>
    ${pkg.bookingAmount ? `<div class="emi">Book your seat with just <b>${esc(cur)} ${money(pkg.bookingAmount)}</b></div>` : ''}`,
    'Booking',
  );
  sections.push('Booking Process');

  // --- Policies
  const pay = lines(pkg.paymentTerms);
  const cancel = lines(pkg.cancellationPolicy);
  const policyHtml =
    pay.length || cancel.length
      ? page(
          'policy bg-blue',
          `${logo()}
          ${pay.length ? `<div class="white-title"><h2>PAYMENT</h2><small>POLICY</small></div><ul class="pl">${pay.map((x) => `<li>${fmt(x)}</li>`).join('')}</ul>` : ''}
          ${cancel.length ? `<div class="white-title" style="${pay.length ? 'padding-top:50px' : ''}"><h2>CANCELLATION</h2><small>POLICY</small></div><ul class="pl">${cancel.map((x) => `<li>${fmt(x)}</li>`).join('')}</ul>` : ''}`,
          'Policies',
        )
      : '';
  if (policyHtml) sections.push('Payment & Cancellation');

  // --- Things to carry
  const carry = groups(pkg.thingsToCarry, 'Essentials');
  const carryHtml = carry.length
    ? page(
        'carry bg-light',
        `${logo()}<h2>THINGS TO CARRY</h2><div class="scr">${esc(title)}</div>
        <div class="cols">${carry.map((g) => `<div class="grp"><h3>${esc(g.h)}</h3><ul>${g.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></div>`).join('')}</div>`,
        'Things to carry',
      )
    : '';
  if (carryHtml) sections.push('Things to Carry');

  // --- Handbook (terms & conditions), 3 sections per page
  const hand = groups(pkg.termsConditions, 'Guidelines');
  const handHtml: string[] = [];
  for (let i = 0; i < hand.length; i += 3) {
    handHtml.push(
      page(
        'hand bg-sky',
        `${logo()}
        ${i === 0 ? `<h2>${esc(title.toUpperCase())}</h2><div class="s1">TRAVELLER HANDBOOK</div><div class="s2">GUIDELINES, EXPECTATIONS &amp; CODE OF CONDUCT</div>` : ''}
        ${hand
          .slice(i, i + 3)
          .map((s) => `<div class="sec"><h4>${esc(s.h.toUpperCase())}</h4><ul>${s.items.map((x) => `<li>${fmt(x)}</li>`).join('')}</ul></div>`)
          .join('')}`,
        'Handbook',
      ),
    );
  }
  if (handHtml.length) sections.push('Traveller Handbook');

  // --- Contact
  const phones = [pkg.contactNumber, ...(org?.phones ?? [])].filter((p, i, a): p is string => !!p?.trim() && a.indexOf(p) === i).slice(0, 2);
  const email = pkg.contactEmail || org?.contactEmail || '';
  const website = (org?.socialLinks ?? []).find((l) => socialTag(l.label, l.url) === 'web')?.url ?? '';
  const contactHtml = page(
    'contact bg-sky',
    `${logo()}${mountains()}
    <div class="vid">${img(cover || gallery[0] || '')}<div class="play"></div></div>
    <div class="brand">${esc(brandName)}</div>
    ${org?.address ? `<div class="addr">${esc(org.address).replace(/\n/g, '<br>')}</div>` : ''}
    <div class="chips">${website ? `<span>🌐 ${esc(website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''))}</span>` : ''}${phones.length ? `<span>📞 ${phones.map(esc).join('<br>')}</span>` : ''}${email ? `<span>✉ ${esc(email)}</span>` : ''}</div>
    ${avg ? `<div class="rate"><span>${avg} ★★★★★</span><span>${c.reviews.length} Reviews</span></div>` : ''}`,
    'Contact',
  );
  sections.push('Contact Us');

  const toc = page(
    'toc bg-paper',
    `<div class="side">${img(tocImage)}</div>
    <div class="panel"><h2><small>TABLE OF</small><span>CONTENTS</span></h2>
    <ol>${sections.map((s, i) => `<li><i>${i + 1}</i>${esc(s)}</li>`).join('')}</ol></div>${logo()}`,
    'Contents',
  );

  return [out[0], toc, aboutHtml, galleryHtml, briefHtml, ...dayHtml, reviewsHtml, ...batchHtml, incHtml, excHtml, costingHtml, bookingHtml, policyHtml, carryHtml, ...handHtml, contactHtml]
    .filter(Boolean)
    .join('');
}

// --- fit pass (same rules as the standalone template) ---------------------------------
const setSize = (els: HTMLElement[], px: number) => els.forEach((el) => (el.style.fontSize = `${px}px`));
function shrink(els: HTMLElement[], start: number, min: number, overflows: () => boolean, scale: [HTMLElement[], number][] = []) {
  let size = start;
  while (overflows() && size > min) {
    size = Math.max(min, +(size - 0.5).toFixed(1));
    setSize(els, size);
    scale.forEach(([more, base]) => setSize(more, +((base * size) / start).toFixed(1)));
  }
  return !overflows();
}
const bottomIn = (pg: HTMLElement, sel: string) =>
  Math.max(
    0,
    ...[...pg.querySelectorAll<HTMLElement>(sel)].map((el) => {
      let y = 0;
      let n: HTMLElement | null = el;
      while (n && n !== pg) {
        y += n.offsetTop;
        n = n.offsetParent as HTMLElement | null;
      }
      return y + el.offsetHeight;
    }),
  );

function fitDay(pg: HTMLElement) {
  const bar = pg.querySelector<HTMLElement>('.bar')!;
  const tt = pg.querySelector<HTMLElement>('.bar .tt')!;
  const barFits = () => bar.offsetLeft + bar.scrollWidth <= pg.clientWidth - 24;
  if (!shrink([tt], 38, 30, () => !barFits())) {
    bar.classList.add('two');
    const others = [...bar.children].filter((x) => x !== tt).reduce((w, x) => w + (x as HTMLElement).offsetWidth + 14, 0);
    tt.style.maxWidth = `${pg.clientWidth - 24 - bar.offsetLeft - others}px`;
    tt.style.fontSize = '32px';
    shrink([tt], 32, 24, () => !barFits() || tt.offsetHeight > 96);
  }
  const pts = pg.querySelector<HTMLElement>('ul.pts')!;
  const note = pg.querySelector<HTMLElement>('.note');
  const lis = [...pts.querySelectorAll<HTMLElement>('li')];
  const notes = note ? [...note.querySelectorAll<HTMLElement>('.note-list li')] : [];
  const limit = () => (note ? note.offsetTop - 18 : pg.clientHeight - 70);
  const overlaps = () => pts.offsetTop + pts.offsetHeight > limit();
  const place = () => (pts.style.top = `${bar.offsetTop + bar.offsetHeight + 30}px`);
  place();
  if (shrink(lis, 21, 16.5, overlaps, [[notes, 18.5]])) return;
  const photo = pg.querySelector<HTMLElement>('.photo');
  if (!photo) return;
  const top = photo.offsetTop;
  for (let h = 540; h >= 300 && overlaps(); h -= 20) {
    photo.style.height = `${h}px`;
    bar.style.top = `${top + h + 50}px`;
    place();
  }
}

function fitAll(root: HTMLElement) {
  for (const pg of root.querySelectorAll<HTMLElement>('.page')) {
    const H = pg.clientHeight;
    const all = (sel: string) => [...pg.querySelectorAll<HTMLElement>(sel)];
    if (pg.classList.contains('dayp')) fitDay(pg);
    else if (pg.classList.contains('about')) {
      const r = pg.querySelector<HTMLElement>('.ratings');
      const limit = r ? r.offsetTop - 16 : H - 40;
      shrink(all(':scope > p'), 19.5, 14, () => bottomIn(pg, ':scope > p, .why-box') > limit);
    } else if (pg.classList.contains('brief')) {
      if (!shrink(all('.row .t'), 24, 16, () => bottomIn(pg, '.rows') > H - 40)) all('.row').forEach((r) => (r.style.marginBottom = '10px'));
    } else if (pg.classList.contains('incl')) {
      const lis = all('li');
      const fits = () => bottomIn(pg, 'ul') <= H - 50;
      if (!shrink(lis, 21, 17, () => !fits())) {
        pg.querySelector('ul')!.classList.add('two');
        setSize(lis, 19);
        shrink(lis, 19, 14, () => !fits());
      }
    } else if (pg.classList.contains('carry')) shrink(all('.grp li'), 17, 13, () => bottomIn(pg, '.cols') > H - 40);
    else if (pg.classList.contains('hand')) shrink(all('.sec li'), 16, 12.5, () => bottomIn(pg, '.sec') > H - 40);
    else if (pg.classList.contains('reviews')) shrink(all('.card p'), 15.5, 12, () => bottomIn(pg, '.grid') > H - 40);
    else if (pg.classList.contains('costing')) shrink(all('.notes p'), 18, 13, () => bottomIn(pg, '.redir') > H - 58);
    else if (pg.classList.contains('policy')) shrink(all('.pl li'), 18, 13, () => bottomIn(pg, '.pl') > H - 40);
  }
}

/** Loads the design's Google Fonts once. */
function useAdventureFonts() {
  useEffect(() => {
    if (document.querySelector(`link[href="${ADVENTURE_FONTS_HREF}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = ADVENTURE_FONTS_HREF;
    document.head.appendChild(link);
  }, []);
}

/**
 * The pages, scaled down to fit narrow screens (the PDF capture reads each
 * page's own 1080×1350 box, so the on-screen scale never affects the file).
 * `onReady` fires once fonts and photos are in and the fit pass has run.
 */
export const AdventureBrochure = forwardRef<HTMLDivElement, {
  pkg: TravelPackage;
  org: AdventureOrg | null;
  reviews: AdventureReview[];
  departures: AdventureDeparture[];
  bookingUrl: string;
  onReady?: () => void;
}>(function AdventureBrochure({ pkg, org, reviews, departures, bookingUrl, onReady }, ref) {
  useAdventureFonts();
  const innerRef = useRef<HTMLDivElement | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    QRCode.toDataURL(bookingUrl, { margin: 1, width: 420, errorCorrectionLevel: 'M' }).then(setQr, () => setQr(null));
  }, [bookingUrl]);

  const html = useMemo(() => buildHtml({ pkg, org, reviews, departures, bookingUrl, qrDataUrl: qr }), [pkg, org, reviews, departures, bookingUrl, qr]);

  // After each render of new content: logo fallback, then wait for fonts + photos, then fit.
  useLayoutEffect(() => {
    const root = innerRef.current;
    if (!root) return;
    let cancelled = false;
    root.querySelectorAll<HTMLImageElement>('.logo-badge img').forEach((im) =>
      im.addEventListener('error', () => {
        if (im.parentElement) im.parentElement.textContent = im.dataset.fallback ?? '';
      }),
    );
    (async () => {
      await document.fonts.ready;
      await Promise.all(
        [...root.querySelectorAll('img')].map((im) => (im.complete ? null : new Promise((r) => { im.addEventListener('load', r); im.addEventListener('error', r); }))),
      );
      if (cancelled) return;
      fitAll(root);
      setHeight(root.offsetHeight);
      onReady?.();
    })();
    return () => {
      cancelled = true;
    };
  }, [html]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onResize = () => setScale(Math.min(1, (window.innerWidth - 24) / 1080));
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <div ref={ref} style={{ height: height ? height * scale : undefined }}>
      <style>{ADVENTURE_CSS}{`.advb{display:flex;flex-direction:column;align-items:center;gap:30px}`}</style>
      <div
        ref={innerRef}
        className="advb"
        style={{ width: 1080, margin: '0 auto', transform: scale < 1 ? `scale(${scale})` : undefined, transformOrigin: 'top left', marginLeft: scale < 1 ? 12 : 'auto' }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
});
