// Shared import pipeline used by the Google Sheets importer and the .xlsx importer.
// Takes plain row objects (keys = sheet headers) and routes each row to
// sources / opportunities / capturedOpportunities in the JSON database.

const { v4: uuidv4 } = require('uuid');
const { normalizeRow, normalizeUrl } = require('./normalizer');
const { calculateQualityScore, calculateReliabilityScore } = require('./scorer');
const { detectDuplicateOpportunity, detectDuplicateSource } = require('./deduplication');

const AGGREGATOR_DOMAINS = ['profellow', 'scholars4dev', 'youthop', 'opportunitydesk', 'greatyop', 'estudarfora', 'partiuintercambio', 'scholarshipsinternational', 'leadersoftoday', 'globalopportunitydesk', 'opportunitiesforafricans', 'afterschoolafrica', 'aiesec'];

function inferSourceScope(row) {
  if (row.source_scope && row.source_scope !== 'needs_review') return row.source_scope;
  const url = (row.monitored_url || row.base_url || '').toLowerCase();
  if (AGGREGATOR_DOMAINS.some(d => url.includes(d))) return 'recurring_source';
  return 'specific_opportunity';
}

// A row only goes live if it is marked ready, is active and has a real link.
function routeRow(row) {
  const scope = inferSourceScope(row);
  if (['recurring_source', 'category_source', 'newsletter_source'].includes(scope)) return 'sources';
  if (row.review_status === 'ready' && row.active !== false && (row.monitored_url || row.apply_url)) return 'opportunities';
  return 'captured_opportunities';
}

// The frontend's filter chips and card labels use hyphenated keys.
const CATEGORY_PRIORITY = ['summer_program', 'scholarship', 'fellowship', 'internship'];
function primaryCategory(types) {
  const list = types || [];
  const hit = CATEGORY_PRIORITY.find(c => list.includes(c));
  return (hit || list[0] || 'scholarship').replace(/_/g, '-');
}

function audienceFor(levels) {
  const l = levels || [];
  const hs = l.includes('high_school') || l.includes('middle_school');
  const col = l.some(x => ['undergraduate', 'graduate', 'gap_year', 'young_professional'].includes(x));
  if (hs && col) return 'both';
  if (hs) return 'high-school';
  if (col) return 'college';
  return 'both';
}

// Fill only empty fields, so the first (usually richest) row for a program wins.
function fillGaps(target, extra) {
  for (const [k, v] of Object.entries(extra)) {
    const cur = target[k];
    const empty = cur === undefined || cur === null || cur === '' || (Array.isArray(cur) && cur.length === 0);
    if (empty && v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0)) target[k] = v;
  }
  return target;
}

function buildOpportunity(row, enrich, meta, now) {
  const url = row.monitored_url || enrich.apply_url || row.base_url || '';
  const category = primaryCategory(row.opportunity_types);
  const description = enrich.description || row.notes || '';
  return {
    id: uuidv4(),
    // fields the app's cards and matching read
    title: row.name,
    programName: row.name,
    organization: enrich.organization || '',
    organizationName: enrich.organization || '',
    category,
    description,
    tags: row.focus_areas || [],
    deadline: enrich.deadline || null,
    deadline_text: enrich.deadline_text || null,
    last_known_deadline: enrich.last_known_deadline || null,
    eligibility: enrich.eligibility || '',
    location: enrich.location || null,
    modality: enrich.modality || 'varies',
    fundingType: enrich.fundingType || null,
    fundingAmount: enrich.funding_text || null,
    competitionLevel: 'medium',
    audience: audienceFor(row.education_levels),
    url,
    official_url: url,
    // source metadata
    focus_areas: row.focus_areas || [],
    education_levels: row.education_levels || [],
    opportunity_types: row.opportunity_types || [],
    trust_tier: row.trust_tier,
    reliability_score: row.reliability_score || 70,
    quality_score: calculateQualityScore({ ...row, short_description: description }),
    source_type: row.source_type || 'official',
    base_url: row.base_url || '',
    monitored_url: row.monitored_url || url,
    notes: row.notes || '',
    requirements: enrich.requirements || null,
    active: row.active !== false,
    status: 'published',
    review_status: 'ready',
    source_scope: 'specific_opportunity',
    imported_from: meta.importSource,
    imported_sheet_name: enrich.sheet_name || meta.sheetName,
    sheet_extra: enrich.sheet_extra || null,
    createdAt: now,
    updated_at: now,
  };
}

function buildCaptured(row, enrich, meta, now, dupCheck) {
  const url = row.monitored_url || enrich.apply_url || '';
  let status = 'needs_review';
  if (row.review_status === 'inactive_or_legacy' || row.active === false) status = 'inactive';
  else if (!url || row.review_status === 'needs_url_validation') status = 'needs_url_validation';
  const description = enrich.description || row.notes || '';
  return {
    id: uuidv4(),
    source_id: null,
    raw_title: row.name,
    raw_url: url,
    title: row.name,
    organization: enrich.organization || '',
    short_description: description,
    opportunity_type: (row.opportunity_types || [])[0] || null,
    category: primaryCategory(row.opportunity_types),
    education_levels: row.education_levels || [],
    focus_areas: row.focus_areas || [],
    base_url: row.base_url || '',
    monitored_url: url,
    official_url: url,
    deadline: enrich.deadline || null,
    deadline_text: enrich.deadline_text || null,
    last_known_deadline: enrich.last_known_deadline || null,
    eligibility: enrich.eligibility || '',
    location: enrich.location || null,
    modality: enrich.modality || null,
    fundingType: enrich.fundingType || null,
    source_type: row.source_type || 'official',
    trust_tier: row.trust_tier,
    reliability_score: row.reliability_score || 70,
    quality_score: calculateQualityScore({ ...row, short_description: description }),
    ai_confidence_score: null,
    possible_duplicate_id: dupCheck.isPossibleDuplicate ? dupCheck.existingId : null,
    status,
    rejection_reason: null,
    notes: row.notes || '',
    imported_from: meta.importSource,
    imported_sheet_name: enrich.sheet_name || meta.sheetName,
    sheet_extra: enrich.sheet_extra || null,
    captured_at: now,
    reviewed_at: null,
    reviewed_by: null,
  };
}

/**
 * @param db      database object (mutated in place; caller writes it)
 * @param rows    array of { raw, enrich } — raw = header-keyed row, enrich = optional extra fields
 * @param meta    { importSource, sheetName, spreadsheetId, importedBy }
 */
function importRows(db, rows, meta) {
  for (const key of ['sources', 'opportunities', 'capturedOpportunities', 'importLogs']) {
    if (!db[key]) db[key] = [];
  }
  const now = new Date().toISOString();
  const log = {
    id: uuidv4(),
    import_source: meta.importSource,
    spreadsheet_id: meta.spreadsheetId || null,
    sheet_name: meta.sheetName,
    started_at: now,
    finished_at: null,
    total_rows: rows.length,
    imported_rows: 0,
    updated_rows: 0,
    skipped_rows: 0,
    duplicate_rows: 0,
    error_rows: 0,
    by_destination: { sources: 0, opportunities: 0, captured_opportunities: 0 },
    status: 'running',
    error_details: [],
    created_by: meta.importedBy || 'system',
  };

  for (const { raw, enrich: rawEnrich } of rows) {
    const enrich = rawEnrich || {};
    try {
      const row = normalizeRow(raw);
      if (!row.name && !row.base_url) { log.skipped_rows++; continue; }
      if (enrich.apply_url) enrich.apply_url = normalizeUrl(enrich.apply_url);

      const destination = routeRow({ ...row, apply_url: enrich.apply_url });

      if (destination === 'sources') {
        const dup = detectDuplicateSource(row, db.sources);
        if (dup.isDuplicate) {
          const existing = db.sources.find(s => s.id === dup.existingId);
          fillGaps(existing, row);
          existing.updated_at = now;
          log.duplicate_rows++;
        } else {
          db.sources.push({
            id: uuidv4(), ...row,
            reliability_score: calculateReliabilityScore(row),
            last_checked_at: null, last_successful_check_at: null, failed_checks_count: 0,
            imported_from: meta.importSource, imported_sheet_name: enrich.sheet_name || meta.sheetName,
            created_at: now, updated_at: now,
          });
          log.imported_rows++;
          log.by_destination.sources++;
        }
        continue;
      }

      // Check against both live and captured lists so a program isn't in both.
      const pool = [...db.opportunities, ...db.capturedOpportunities];
      const dup = detectDuplicateOpportunity({ ...row, monitored_url: row.monitored_url || enrich.apply_url }, pool);
      if (dup.isDuplicate) {
        const existing = pool.find(o => o.id === dup.existingId);
        const candidate = destination === 'opportunities'
          ? buildOpportunity(row, enrich, meta, now)
          : buildCaptured(row, enrich, meta, now, dup);
        delete candidate.id;
        fillGaps(existing, candidate);
        existing.updated_at = now;
        log.duplicate_rows++;
        continue;
      }

      if (destination === 'opportunities') {
        db.opportunities.push(buildOpportunity(row, enrich, meta, now));
        log.by_destination.opportunities++;
      } else {
        db.capturedOpportunities.push(buildCaptured(row, enrich, meta, now, dup));
        log.by_destination.captured_opportunities++;
      }
      log.imported_rows++;
    } catch (err) {
      log.error_rows++;
      log.error_details.push({ row: raw && raw.name ? String(raw.name) : '?', error: err.message });
    }
  }

  log.finished_at = new Date().toISOString();
  log.status = log.error_rows ? 'partial' : 'success';
  db.importLogs.unshift(log);
  return log;
}

module.exports = { importRows, routeRow, primaryCategory };
