// Import opportunities and sources from the "MatchED Apply - database" .xlsx file.
//
// Every tab whose header row has `name` and `monitored_url` is imported through
// the same pipeline as the Google Sheets importer (see importRows.js).
//
// The "opportunities - dataset" tab also carries 11 unlabeled columns (P–Z)
// merged in from older lists. Their meaning varies a little by origin list, so
// they are used conservatively: a value only fills a field when it clearly looks
// like that kind of data, and all 11 raw values are kept on the record in
// `sheet_extra` for admin review.

const ExcelJS = require('exceljs');
const { importRows } = require('./importRows');

function cellValue(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v;
  if (typeof v === 'object') {
    if (v.hyperlink) return v.hyperlink;               // keep the real link, not the display text
    if (v.richText) return v.richText.map(t => t.text).join('');
    if ('result' in v) return cellValue(v.result);     // formula
    if (v.text) return String(v.text);
    if (v.error) return '';
    return '';
  }
  return v;
}

const PT_MONTHS = { janeiro: 1, fevereiro: 2, 'março': 3, marco: 3, abril: 4, maio: 5, junho: 6, julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12 };

function isoDate(y, m, d) {
  if (!y || !m || !d || m > 12 || d > 31 || y < 2000 || y > 2100) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// Returns YYYY-MM-DD only for values that are clearly one specific date.
function parseDeadline(v) {
  if (v instanceof Date && !isNaN(v)) return isoDate(v.getUTCFullYear(), v.getUTCMonth() + 1, v.getUTCDate());
  const s = String(v || '').trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return isoDate(+m[1], +m[2], +m[3]);
  m = s.toLowerCase().match(/^(\d{1,2})\s+de\s+([a-zç]+)\s+de\s+(\d{4})$/);
  if (m && PT_MONTHS[m[2]]) return isoDate(+m[3], PT_MONTHS[m[2]], +m[1]);
  m = s.match(/^([A-Za-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})$/);
  if (m) {
    const d = new Date(`${m[1]} ${m[2]}, ${m[3]} UTC`);
    if (!isNaN(d)) return isoDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  return null;
}

function text(v) {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v == null ? '' : v).trim();
}

const looksLikeUrl = s => /^(https?:\/\/|www\.)/i.test(s) || /^[a-z0-9-]+(\.[a-z0-9-]+)+\/\S*$/i.test(s);
const looksLikeFile = s => /\.(csv|xlsx|xls|pdf)\b|\bPDF$/i.test(s);

function modalityFrom(...vals) {
  const s = vals.map(text).join(' ').toLowerCase();
  if (/h[ií]brid/.test(s)) return 'hybrid';
  if (/online ou presencial|online or in.person/.test(s)) return 'hybrid';
  if (/in.person|presencial/.test(s)) return 'in-person';
  if (/\bonline\b|remote|virtual/.test(s)) return 'online';
  return null;
}

function fundingFrom(...vals) {
  const s = vals.map(text).join(' ').toLowerCase();
  if (!s) return null;
  if (/full ride: sim|fully funded|full scholarship|bolsa integral|totalmente financiad/.test(s)) return 'full-scholarship';
  if (/funded\/paid: true|stipend: yes|ajuda financeira|bolsa parcial|partial (aid|scholarship)|financial aid/.test(s)) return 'partial-scholarship';
  if (/^free$|inscri[cç][aã]o gratuita|\bgratuit|application fee: no/.test(s)) return 'free';
  return null;
}

const EXTRA_LABELS = [
  'location_or_modality', 'deadline_text', 'funding_text', 'eligibility_text', 'description_text',
  'extra_notes', 'origin_or_modality', 'category_text', 'apply_link', 'category_key', 'requirements_text',
];

function enrichFromExtras(cells, notes) {
  const raw = cells.map(text);
  const [loc, dl, fund, elig, desc, , originA, , link, , reqs] = raw;
  const extra = {};
  EXTRA_LABELS.forEach((label, i) => { if (raw[i]) extra[label] = raw[i]; });

  const description = desc && desc.length > 25 && !looksLikeUrl(desc) && !/^Curated international resource/i.test(desc) ? desc : '';
  const orgMatch = (notes || '').match(/\(([^()]{3,80})\)\s*$/);

  // Past dates are usually last cycle's deadline for a recurring program; showing
  // them would mark the card "Expired", so they are kept separately.
  const parsed = parseDeadline(cells[1]);
  const today = new Date().toISOString().slice(0, 10);
  const cleanFund = fund.split(';').map(x => x.trim()).filter(x => x && x !== '-').join('; ');

  return {
    description,
    deadline: parsed && parsed >= today ? parsed : null,
    last_known_deadline: parsed && parsed < today ? parsed : null,
    deadline_text: dl || null,
    eligibility: elig && !/^Institution type:/i.test(elig) ? elig : '',
    location: loc && !modalityFrom(loc) ? loc : (loc && /,/.test(loc) ? loc : null),
    modality: modalityFrom(loc, looksLikeFile(originA) ? '' : originA),
    fundingType: fundingFrom(fund, dl),
    funding_text: cleanFund || null,
    apply_url: link && looksLikeUrl(link) ? link : '',
    requirements: reqs || null,
    organization: orgMatch ? orgMatch[1].trim() : '',
    sheet_extra: Object.keys(extra).length ? extra : null,
  };
}

async function readWorkbookRows(filePath) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const out = [];

  wb.eachSheet(ws => {
    const header = [];
    ws.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => {
      header[col] = text(cellValue(cell.value)).toLowerCase().replace(/\s+/g, '_');
    });
    if (!header.includes('name') || !header.includes('monitored_url')) return; // not a data tab

    const labeled = header.map((h, i) => (h ? i : null)).filter(i => i !== null);
    const lastLabeled = Math.max(...labeled);

    ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return;
      const raw = {};
      for (const col of labeled) raw[header[col]] = cellValue(row.getCell(col).value);
      if (!text(raw.name) && !text(raw.base_url)) return;
      for (const k of Object.keys(raw)) if (!(raw[k] instanceof Date) && typeof raw[k] !== 'boolean' && typeof raw[k] !== 'number') raw[k] = text(raw[k]);

      const extras = [];
      for (let c = lastLabeled + 1; c <= lastLabeled + EXTRA_LABELS.length; c++) extras.push(cellValue(row.getCell(c).value));
      const enrich = extras.some(v => text(v)) ? enrichFromExtras(extras, raw.notes) : {};
      enrich.sheet_name = ws.name;

      out.push({ raw, enrich });
    });
  });
  return out;
}

async function importFromXlsx(db, filePath, importedBy = 'cli') {
  const rows = await readWorkbookRows(filePath);
  const name = require('path').basename(filePath);
  return importRows(db, rows, { importSource: 'xlsx', sheetName: name, importedBy });
}

module.exports = { importFromXlsx, readWorkbookRows, parseDeadline };
