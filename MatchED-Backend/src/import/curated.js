// Curated opportunities open to Brazilian students (seed-data/brazil-opportunities.json).
// Each one was checked against its official page; they fill the biggest gap in the
// spreadsheet data (very few opportunities made for Brazilian public-school students).
//
// importCurated(db) is safe to run again: records are matched by their fixed id,
// refreshed from the file, and an admin's archive decision is kept. A spreadsheet
// record for the same program (same site, or same name) is archived so students
// don't see it twice.
const path = require('path');
const fs = require('fs');

const FILE = path.join(__dirname, '..', 'seed-data', 'brazil-opportunities.json');

const host = u => { try { return new URL(u).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; } };
const nameKey = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

function loadCurated(file = FILE) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function importCurated(db, { file = FILE, now = new Date() } = {}) {
  const data = loadCurated(file);
  const stamp = now.toISOString();
  const log = { added: 0, updated: 0, duplicatesArchived: 0 };
  db.opportunities = db.opportunities || [];

  for (const item of data.opportunities) {
    const record = {
      ...item,
      source: 'matched-curated',
      verified_at: data.verifiedAt,
      trust_tier: 'verified',
      updated_at: stamp,
    };
    const existing = db.opportunities.find(o => o.id === item.id);
    if (existing) {
      const keepArchived = existing.status === 'archived' || existing.active === false;
      Object.assign(existing, record, keepArchived ? { status: 'archived', active: false } : { status: 'published', active: true });
      log.updated++;
    } else {
      db.opportunities.push({ ...record, status: 'published', active: true, createdAt: stamp });
      log.added++;
    }

    // Archive a spreadsheet copy of the same program
    const h = host(item.websiteUrl);
    const sameHost = db.opportunities.filter(o => o.id !== item.id && o.source !== 'matched-curated' && o.active !== false
      && host(o.websiteUrl || o.url) === h);
    const sameName = db.opportunities.filter(o => o.id !== item.id && o.source !== 'matched-curated' && o.active !== false
      && nameKey(o.programName || o.title) === nameKey(item.programName));
    const dups = new Set(sameName);
    if (h && sameHost.length === 1) dups.add(sameHost[0]);
    for (const d of dups) {
      d.active = false; d.status = 'archived'; d.superseded_by = item.id; d.updated_at = stamp;
      log.duplicatesArchived++;
    }
  }
  return log;
}

module.exports = { importCurated, loadCurated, FILE };
