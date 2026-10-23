// Import the "Banco de Oportunidades" spreadsheet (tab "Mestre").
//
// The Banco is the curated master list Laura keeps in Google Sheets: one row per
// opportunity, already de-duplicated, with levels (Antes do EM → Mestrado),
// deadline, how often it opens, value and source. It can arrive two ways:
//   - as an .xlsx upload (Admin → Importar, `npm run import:xlsx`, data-import/)
//   - straight from Google Sheets (BANCO_SHEET_ID, Admin button or daily sync)
// Both paths turn the tab into header-keyed objects and call importBanco().
//
// Rules (same spirit as importRows.js):
//   - a row goes live only with a real link; rows whose link is a Google search
//     (the Banco had no link) go to the review queue ("Capturadas");
//   - rows marked "Cuidado" (looks paid/commercial) go to review, never live;
//   - "Recurso" rows (newsletters, lists, aggregators) become recurring sources;
//   - re-importing updates the rows that came from the Banco (the Banco is the
//     source of truth for them) and only fills gaps in records from elsewhere.

const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { normalizeUrlForCompare } = require('./deduplication');

const LEVEL_COLUMNS = [
  ['Antes do EM', 'P'], ['EM ano 1', 'E1'], ['EM ano 2', 'E2'], ['EM ano 3', 'E3'], ['Senior EM', 'S'], ['Gap year', 'G'],
  ['Freshman', 'F'], ['Sophomore', 'So'], ['Junior', 'J'], ['Senior grad', 'Sr'], ['Mestrado', 'M'],
];
const LEVEL_TO_EDU = { P: 'middle_school', E1: 'high_school', E2: 'high_school', E3: 'high_school', S: 'high_school', G: 'gap_year',
  F: 'undergraduate', So: 'undergraduate', J: 'undergraduate', Sr: 'undergraduate', M: 'graduate' };

// Portuguese "Tipo" → the hyphenated category keys the site's filters use.
const CATEGORY_RULES = [
  [/aux[ií]lio financeiro|financial aid|bolsa|scholarship/i, 'scholarship'],
  [/programa de ver[aã]o|summer|escola de ver[aã]o|winter school|programa de f[ée]rias/i, 'summer-program'],
  [/olimp[ií]ada|competi[cç][aã]o|concurso|hackathon|desafio|feira de ci/i, 'competition'],
  [/fellowship/i, 'fellowship'],
  [/est[aá]gio|internship|trainee/i, 'internship'],
  [/interc[aâ]mbio|exchange/i, 'exchange'],
  [/pesquisa|research|reu\b/i, 'research-program'],
  [/grant|fundo|financiamento|microgrant/i, 'grant'],
  [/confer[eê]ncia|c[uú]pula|summit|f[oó]rum|evento/i, 'conference'],
  [/curso|course|workshop/i, 'online-course'],
  [/mentoria|mentorship/i, 'mentorship'],
  [/voluntari/i, 'volunteer'],
  [/acelera/i, 'accelerator'],
  [/pr[eê]mio|award/i, 'award'],
  [/emprego|vaga|job|freelance|consultoria/i, 'job'],
  [/embaixador|ambassador|carreira|career|programa/i, 'career-program'],
];

function categoryFor(tipo) {
  const t = String(tipo || '');
  for (const [rx, key] of CATEGORY_RULES) if (rx.test(t)) return key;
  return 'scholarship';
}

function str(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).trim();
}

function isoDate(y, m, d) {
  if (!y || !m || !d || m > 12 || d > 31 || y < 2000 || y > 2100) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// Accepts a Date, 2026-11-03, 03/11/2026 (Brazilian order, as the Banco shows dates)
// or an Excel serial number. Anything else is free text, not a date.
function parseBancoDate(v) {
  if (v instanceof Date && !isNaN(v)) return isoDate(v.getUTCFullYear(), v.getUTCMonth() + 1, v.getUTCDate());
  if (typeof v === 'number' && v > 30000 && v < 80000) {
    const d = new Date(Math.round((v - 25569) * 864e5));
    return isoDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  const s = str(v);
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return isoDate(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return isoDate(+m[3], +m[2], +m[1]);
  return null;
}

function parseUsd(v) {
  if (typeof v === 'number') return v > 0 ? Math.round(v) : null;
  const digits = str(v).replace(/[^\d]/g, '');
  return digits ? Number(digits) : null;
}

function fundingTypeFrom(text) {
  const s = String(text || '').toLowerCase();
  if (/integral|totalmente financiad|fully funded|full ride|100% da necessidade|tudo pago|matr[ií]cula integral/.test(s)) return 'full-scholarship';
  if (/gratuit|free|sem custo/.test(s)) return 'free';
  if (/parcial|bolsa|stipend|aux[ií]lio|remunerad|sal[aá]rio|us\$|r\$|€/.test(s)) return 'partial-scholarship';
  return null;
}

// Stable key for a Banco row, so re-imports update the same record.
function bancoKey(name) {
  const n = String(name || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/\b20\d\d(\s*[-/–]\s*\d{2,4})?\b/g, ' ').replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
  return crypto.createHash('sha1').update(n).digest('hex').slice(0, 16);
}

const normTitle = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// Facts in the notes that the matching engine must respect.
function flagsFrom(notes) {
  const t = String(notes || '');
  const flags = {};
  if (/cidad[aã](os|ania) (dos |norte-?americana|americana)?\s*(eua|estados unidos)|residentes (permanentes )?(dos|nos) eua|s[oó] para (alunos|estudantes|escolas) dos eua|us citizens? only/i.test(t)) flags.requiresUSCitizenship = true;
  if (/autoriza[cç][aã]o de trabalho (nos )?eua|\bF-1\b|\bCPT\b/i.test(t)) { flags.requiresUSCitizenship = true; flags.requiresUSWorkAuth = true; }
  // "Só para Canadá", "Só para a Califórnia", "Exige ser indígena"…: a person should check before applying.
  if (!flags.requiresUSCitizenship && /\bs[oó] (para|cidad)|apenas para|exclusiv[oa] para|exige (ser|morar|residir)|verificar (elegibilidade|se aceita)/i.test(t)) flags.checkNationality = true;
  return flags;
}

// The Banco's notes column mixes facts ("Só cidadãos dos EUA", "13–18 anos") with the
// curator's own notes ("PRIORIDADE (Gov) — …", "MatchED se qualifica"). Students only
// see the facts; the full text stays on the record as `banco_notes` for admins.
const CURATOR_NOTE = /prioridade|\bvoc[eê]\b|\bsuas?\b|\bseus?\b|matched|\blaura\b|v[oô]c[eê] ?l[aá] ?fora|vocelafora|\b(gov|dcs)\b|bowdoin|duplicado|^\s*recurso\b|status na base|class of 2030|mentorad|divulgar|\bmagis\b|bears match|\blala\b|hastings|\bproponha\b|\benvie\b|\binscreva\b|\btente\b|digital \+ legal|government & legal|digital & computational|\bfuturo\b|tema exato|\bdesinforma[cç][aã]o\b|verdade ilus[oó]ria/i;
function publicNotes(notes) {
  return String(notes || '').split(/\s*\|\s*/).map(seg => {
    seg = seg.trim();
    if (!seg || !CURATOR_NOTE.test(seg)) return seg;
    return seg.split(/\s+[—–-]\s+/).filter(part => part && !CURATOR_NOTE.test(part)).join(' — ');
  }).filter(Boolean).filter((s, i, a) => a.indexOf(s) === i).join(' | ');
}

// Summaries are mostly neutral, but some were written to the curator
// ("Você já tinha anotado…", "maior fit com sua pesquisa") — those sentences are dropped.
const CURATOR_SENTENCE = /\bvoc[eê]\b|\blaura\b|maior fit|sua pesquisa|sua prioridade|aten[cç][aã]o estrat[eé]gica|seu perfil|conex[aã]o bowdoin|\bmatched\b|como abordar/i;
function publicDescription(text) {
  const t = str(text).replace(/\s*Como abordar:[\s\S]*$/, '');
  return t.split(/(?<=[.!?])\s+/).filter(sentence => !CURATOR_SENTENCE.test(sentence)).join(' ').trim();
}

/** Turn header-keyed Banco rows (from xlsx or CSV) into normalized records. */
function parseBancoRows(objects) {
  const out = [];
  for (const o of objects) {
    const name = str(o['Programa']);
    if (!name) continue;
    const levels = LEVEL_COLUMNS.filter(([col]) => /^sim$/i.test(str(o[col]))).map(([, code]) => code);
    const link = str(o['Link']);
    const notes = str(o['Observações / elegibilidade']);
    const tipo = str(o['Tipo']);
    const dl = parseBancoDate(o['Prazo (próximo)']);
    out.push({
      key: bancoKey(name),
      name,
      organization: str(o['Instituição / organização']),
      // "Como abordar: …" is outreach advice for the curator, not a description.
      description: publicDescription(o['Resumo']),
      tipo,
      category: categoryFor(tipo),
      isResource: /^recurso/i.test(tipo),
      tags: str(o['Tags / áreas (majors p/ universidades)']).split(/;\s*/).map(s => s.trim()).filter(Boolean),
      grade_levels: levels,
      education_levels: [...new Set(levels.map(l => LEVEL_TO_EDU[l]))],
      deadline: dl,
      deadline_text: dl ? null : (str(o['Prazo (próximo)']) || null),
      opens: str(o['Costuma abrir']) || null,
      closes: str(o['Costuma fechar']) || null,
      link: /^https?:\/\//i.test(link) ? link : '',
      hasOfficialLink: /^https?:\/\//i.test(link) && !/google\.[a-z.]+\/search/i.test(link),
      linkIsSocialPost: /instagram\.com|linkedin\.com|lnkd\.in/i.test(link),
      source: str(o['Fonte(s)']),
      country: str(o['País']),
      fundingAmount: str(o['Valor (moeda original)']) || null,
      funding_usd_max: parseUsd(o['Valor máximo (US$)']),
      notes,
      // "Cuidado" = looks paid/commercial. Lab contacts are the curator's own research leads.
      caution: /\bcuidado\b/i.test(notes) || /aba (Labs|Europa RA)/i.test(str(o['Fonte(s)'])),
      flags: flagsFrom(notes),
    });
  }
  return out;
}

function buildRecord(r, now, today) {
  const future = r.deadline && r.deadline >= today;
  const typeKey = r.category.replace(/-/g, '_');
  return {
    title: r.name,
    programName: r.name,
    organization: r.organization,
    organizationName: r.organization,
    category: r.category,
    description: r.description,
    tags: r.tags,
    focus_areas: r.tags,
    education_levels: r.education_levels,
    grade_levels: r.grade_levels,
    opportunity_types: [typeKey],
    deadline: future ? r.deadline : null,
    last_known_deadline: r.deadline && !future ? r.deadline : null,
    deadline_text: r.deadline_text || ([r.opens && `Costuma abrir: ${r.opens}`, r.closes && `costuma fechar: ${r.closes}`].filter(Boolean).join(' · ') || null),
    usually_opens: r.opens,
    usually_closes: r.closes,
    eligibility: publicNotes(r.notes),
    banco_notes: r.notes,
    location: r.country || null,
    fundingType: fundingTypeFrom(r.fundingAmount),
    fundingAmount: r.fundingAmount,
    funding_usd_max: r.funding_usd_max,
    url: r.link,
    official_url: r.link,
    monitored_url: r.link,
    websiteUrl: r.link,
    flags: Object.keys(r.flags).length ? r.flags : undefined,
    banco_key: r.key,
    banco_source: r.source,
    needs_official_link: r.linkIsSocialPost || undefined,
    imported_from: 'banco',
    updated_at: now,
  };
}

/**
 * @param db    database object (mutated; the caller writes it)
 * @param rows  output of parseBancoRows()
 * @param meta  { importSource: 'banco-xlsx' | 'banco-sheets', sheetName, importedBy }
 */
function importBanco(db, rows, meta = {}) {
  for (const k of ['sources', 'opportunities', 'capturedOpportunities', 'importLogs']) if (!db[k]) db[k] = [];
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  const log = {
    id: uuidv4(), import_source: meta.importSource || 'banco', spreadsheet_id: meta.spreadsheetId || null, sheet_name: meta.sheetName || 'Mestre',
    started_at: now, finished_at: null, total_rows: rows.length, imported_rows: 0, updated_rows: 0, skipped_rows: 0,
    duplicate_rows: 0, error_rows: 0, by_destination: { sources: 0, opportunities: 0, captured_opportunities: 0 },
    status: 'running', error_details: [], created_by: meta.importedBy || 'system',
  };

  // Indexes built once: matching 5,000+ rows one by one against the whole
  // database with fuzzy titles would take minutes.
  const byKey = new Map();
  const byTitle = new Map();
  const byUrl = new Map();
  const index = (rec, list) => {
    if (rec.banco_key) byKey.set(rec.banco_key, { rec, list });
    const t = normTitle(rec.programName || rec.title || rec.raw_title || rec.name);
    if (t && !byTitle.has(t)) byTitle.set(t, { rec, list });
    const u = normalizeUrlForCompare(rec.official_url || rec.monitored_url || rec.url);
    if (u && !/instagram\.com|linkedin\.com|lnkd\.in|google\./.test(u) && !byUrl.has(u)) byUrl.set(u, { rec, list });
  };
  db.opportunities.forEach(r => index(r, 'opportunities'));
  db.capturedOpportunities.forEach(r => index(r, 'capturedOpportunities'));
  const sourceByUrl = new Set(db.sources.map(s => normalizeUrlForCompare(s.monitored_url || s.base_url)));

  for (const r of rows) {
    try {
      if (r.isResource) {
        const u = normalizeUrlForCompare(r.link);
        if (!r.hasOfficialLink || sourceByUrl.has(u)) { log.duplicate_rows++; continue; }
        db.sources.push({
          id: uuidv4(), name: r.name, base_url: r.link, monitored_url: r.link, source_type: 'aggregator',
          focus_areas: r.tags, education_levels: r.education_levels, opportunity_types: [], trust_tier: 'approved',
          check_frequency: 'weekly', extraction_method: 'html', active: true, source_scope: 'recurring_source',
          review_status: 'ready', notes: [r.description, r.notes].filter(Boolean).join(' — '), reliability_score: 70,
          last_checked_at: null, last_successful_check_at: null, failed_checks_count: 0,
          imported_from: 'banco', banco_key: r.key, created_at: now, updated_at: now,
        });
        sourceByUrl.add(u);
        log.imported_rows++; log.by_destination.sources++;
        continue;
      }

      const record = buildRecord(r, now, today);
      const live = r.hasOfficialLink && !r.caution;
      const hit = byKey.get(r.key) || byTitle.get(normTitle(r.name)) || (r.hasOfficialLink && byUrl.get(normalizeUrlForCompare(r.link)));

      if (hit) {
        const ex = hit.rec;
        if (ex.reviewed_at) {
          // An admin checked this record by hand: their edits win. The Banco only fills
          // empty fields and moves the deadline forward to the next cycle.
          for (const [k, v] of Object.entries(record)) {
            const cur = ex[k];
            const empty = cur === undefined || cur === null || cur === '' || (Array.isArray(cur) && !cur.length);
            if (empty && v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && !v.length)) ex[k] = v;
          }
          if (record.deadline && (!ex.deadline || ex.deadline < today)) ex.deadline = record.deadline;
          ex.banco_key = r.key;
          ex.updated_at = now;
          log.updated_rows++;
        } else if (ex.imported_from === 'banco' || ex.banco_key === r.key) {
          // The Banco owns this record: refresh it, but never undo an admin's decisions.
          const keep = { id: ex.id, status: ex.status, active: ex.active, review_status: ex.review_status, createdAt: ex.createdAt, captured_at: ex.captured_at, flags: ex.flags_checked_by_admin ? ex.flags : record.flags };
          Object.assign(ex, record, Object.fromEntries(Object.entries(keep).filter(([, v]) => v !== undefined)));
          log.updated_rows++;
        } else {
          for (const [k, v] of Object.entries(record)) {
            const cur = ex[k];
            const empty = cur === undefined || cur === null || cur === '' || (Array.isArray(cur) && !cur.length);
            if (empty && v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && !v.length)) ex[k] = v;
          }
          ex.banco_key = r.key;
          ex.updated_at = now;
          log.duplicate_rows++;
        }
        continue;
      }

      if (live) {
        const rec = { id: uuidv4(), ...record, status: 'published', active: true, review_status: 'ready', source_scope: 'specific_opportunity',
          trust_tier: 'approved', reliability_score: 75, competitionLevel: 'medium', modality: 'varies',
          audience: record.education_levels.some(l => ['middle_school', 'high_school'].includes(l))
            ? (record.education_levels.some(l => !['middle_school', 'high_school'].includes(l)) ? 'both' : 'high-school') : 'college',
          createdAt: now };
        db.opportunities.push(rec); index(rec, 'opportunities');
        log.by_destination.opportunities++;
      } else {
        const rec = { id: uuidv4(), ...record, raw_title: r.name, raw_url: r.link, short_description: r.description,
          opportunity_type: record.opportunity_types[0], status: r.caution ? 'needs_review' : 'needs_url_validation',
          rejection_reason: null, captured_at: now, reviewed_at: null, reviewed_by: null };
        db.capturedOpportunities.push(rec); index(rec, 'capturedOpportunities');
        log.by_destination.captured_opportunities++;
      }
      log.imported_rows++;
    } catch (err) {
      log.error_rows++;
      log.error_details.push({ row: r.name, error: err.message });
    }
  }

  log.finished_at = new Date().toISOString();
  log.status = log.error_rows ? 'partial' : 'success';
  db.importLogs.unshift(log);
  return log;
}

// ---- reading the Banco ----

// .xlsx: returns header-keyed rows of the "Mestre" tab, or null if the workbook isn't a Banco.
// Streams the file: the Banco has 15 tabs and ~40,000 rows in total, and loading
// it whole needs ~700 MB of memory; streaming keeps it near 200 MB.
async function readBancoXlsx(filePath) {
  const ExcelJS = require('exceljs');
  const reader = new ExcelJS.stream.xlsx.WorkbookReader(filePath, { sharedStrings: 'cache', hyperlinks: 'ignore', styles: 'ignore', worksheets: 'emit' });
  let rows = null;
  for await (const ws of reader) {
    if (ws.name !== 'Mestre' || rows) { for await (const _ of ws) { /* skip other tabs */ } continue; }
    let header = null;
    const found = [];
    for await (const row of ws) {
      const vals = row.values || [];
      if (!header) {
        header = vals.map(v => str(cellText(v)));
        if (!header.includes('Programa') || !header.includes('Link')) { header = []; }
        continue;
      }
      if (!header.length) continue;
      const o = {};
      header.forEach((h, col) => { if (h) o[h] = cellText(vals[col]); });
      found.push(o);
    }
    if (header && header.length) rows = found;
  }
  return rows;
}

function cellText(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date || typeof v === 'number' || typeof v === 'boolean') return v;
  if (typeof v === 'object') {
    if (v.hyperlink) return v.hyperlink;
    if (v.richText) return v.richText.map(t => t.text).join('');
    if ('result' in v) return cellText(v.result);
    if (v.text) return String(v.text);
    return '';
  }
  return v;
}

// Google Sheets: the sheet must be shared as "anyone with the link can view".
function bancoCsvUrl(sheetId) {
  return `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/gviz/tq?tqx=out:csv&sheet=Mestre`;
}

function parseCsv(text) {
  const rows = []; let row = []; let field = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') q = false;
      else field += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some(f => f !== '')) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some(f => f !== '')) rows.push(row);
  return rows;
}

function csvToObjects(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const header = rows[0].map(h => h.trim());
  return rows.slice(1).map(r => Object.fromEntries(header.map((h, i) => [h, (r[i] || '').trim()])));
}

async function importBancoFromSheets(db, sheetId, importedBy = 'system') {
  if (!sheetId) throw new Error('BANCO_SHEET_ID não configurado');
  const res = await fetch(bancoCsvUrl(sheetId), { redirect: 'follow' });
  const body = await res.text();
  if (!res.ok || /^\s*</.test(body)) throw new Error('Não consegui ler a planilha. Ela está compartilhada como "qualquer pessoa com o link pode ver"?');
  const objects = csvToObjects(body);
  if (!objects.length || !('Programa' in objects[0])) throw new Error('A aba "Mestre" não foi encontrada ou mudou de formato.');
  return importBanco(db, parseBancoRows(objects), { importSource: 'banco-sheets', spreadsheetId: sheetId, sheetName: 'Mestre', importedBy });
}

module.exports = { publicNotes, publicDescription, parseBancoRows, importBanco, readBancoXlsx, importBancoFromSheets, csvToObjects, bancoCsvUrl, parseBancoDate, categoryFor, bancoKey };
