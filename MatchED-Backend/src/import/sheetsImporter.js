const { v4: uuidv4 } = require('uuid');
const { readDatabase, writeDatabase } = require('../database/db');
const { normalizeRow } = require('./normalizer');
const { calculateQualityScore, calculateReliabilityScore } = require('./scorer');
const { detectDuplicateOpportunity, detectDuplicateSource } = require('./deduplication');

const SHEET_ID = '1qm81DqE78HDC9KKaQAhZnDklOGNuLZvtVe9in5XHEW4';
const SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;

// Simple CSV parser that handles quoted fields with commas/newlines
function parseCSV(text) {
  const rows = [];
  let i = 0;
  const n = text.length;

  while (i < n) {
    const row = [];
    while (i < n && text[i] !== '\n') {
      if (text[i] === '"') {
        // Quoted field
        i++; // skip opening quote
        let field = '';
        while (i < n) {
          if (text[i] === '"' && text[i + 1] === '"') {
            field += '"'; i += 2;
          } else if (text[i] === '"') {
            i++; break;
          } else {
            field += text[i++];
          }
        }
        row.push(field);
        if (text[i] === ',') i++;
      } else {
        // Unquoted field
        let field = '';
        while (i < n && text[i] !== ',' && text[i] !== '\n') field += text[i++];
        row.push(field.trim());
        if (text[i] === ',') i++;
      }
    }
    if (text[i] === '\n') i++;
    if (row.length > 0 && row.some(f => f !== '')) rows.push(row);
  }
  return rows;
}

function rowsToObjects(rows) {
  if (rows.length < 2) return [];
  const headers = rows[0].map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
  return rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (row[i] || '').trim(); });
    return obj;
  });
}

async function fetchCSV() {
  const res = await fetch(SHEET_CSV_URL, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Failed to fetch sheet: ${res.status}`);
  return res.text();
}

function inferSourceScope(row) {
  // If source_scope is set, use it
  if (row.source_scope) return row.source_scope;

  // Infer from opportunity_types and URL pattern
  const types = Array.isArray(row.opportunity_types) ? row.opportunity_types.join(',').toLowerCase() : (row.opportunity_types || '').toLowerCase();
  const url = (row.monitored_url || row.base_url || '').toLowerCase();

  const aggregatorDomains = ['profellow', 'scholars4dev', 'youthop', 'opportunitydesk', 'greatyop', 'estudarfora', 'partiuintercambio', 'scholarshipsinternational', 'leadersoftoday', 'globalopportunitydesk', 'opportunitiesforafricans', 'afterschoolafrica', 'aiesec'];
  const isAggregator = aggregatorDomains.some(d => url.includes(d));

  if (isAggregator) return 'recurring_source';
  return 'specific_opportunity';
}

function routeRow(normalized) {
  const scope = normalized.source_scope || inferSourceScope(normalized);
  const status = normalized.review_status;

  const isSource = ['recurring_source', 'category_source', 'newsletter_source'].includes(scope);
  if (isSource) return 'sources';

  // specific_opportunity
  if (status === 'ready') return 'opportunities';
  return 'captured_opportunities';
}

async function importFromSheets(importedBy = 'system') {
  const startedAt = new Date().toISOString();
  const log = {
    id: uuidv4(),
    import_source: 'google_sheets',
    spreadsheet_id: SHEET_ID,
    sheet_name: 'Sheet1',
    started_at: startedAt,
    finished_at: null,
    total_rows: 0,
    imported_rows: 0,
    updated_rows: 0,
    skipped_rows: 0,
    duplicate_rows: 0,
    error_rows: 0,
    status: 'running',
    error_details: [],
    created_by: importedBy,
  };

  const db = readDatabase();
  if (!db.sources) db.sources = [];
  if (!db.capturedOpportunities) db.capturedOpportunities = [];
  if (!db.importLogs) db.importLogs = [];

  try {
    const csv = await fetchCSV();
    const rawRows = parseCSV(csv);
    const rows = rowsToObjects(rawRows);
    log.total_rows = rows.length;

    for (const rawRow of rows) {
      try {
        const row = normalizeRow(rawRow);
        if (!row.name && !row.base_url) { log.skipped_rows++; continue; }

        const destination = routeRow(row);

        if (destination === 'sources') {
          const dupCheck = detectDuplicateSource(row, db.sources);
          if (dupCheck.isDuplicate) {
            // Update existing
            const idx = db.sources.findIndex(s => s.id === dupCheck.existingId);
            if (idx >= 0) {
              db.sources[idx] = { ...db.sources[idx], ...row, updated_at: new Date().toISOString() };
              log.updated_rows++;
            } else log.skipped_rows++;
          } else {
            const reliability_score = calculateReliabilityScore(row);
            db.sources.push({
              id: uuidv4(), ...row, reliability_score,
              last_checked_at: null, last_successful_check_at: null, failed_checks_count: 0,
              imported_from: 'google_sheets', imported_sheet_name: 'Sheet1',
              created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
            });
            log.imported_rows++;
          }

        } else if (destination === 'opportunities') {
          const existing = db.opportunities || [];
          const dupCheck = detectDuplicateOpportunity(row, existing);
          if (dupCheck.isDuplicate) {
            const idx = existing.findIndex(o => o.id === dupCheck.existingId);
            if (idx >= 0) {
              db.opportunities[idx] = { ...db.opportunities[idx], ...row, updated_at: new Date().toISOString() };
              log.updated_rows++;
            } else log.skipped_rows++;
          } else {
            const quality_score = calculateQualityScore(row);
            const opp = {
              id: uuidv4(),
              title: row.name,
              organization: '',
              category: (row.opportunity_types || [])[0] || 'scholarship',
              description: row.notes || '',
              tags: row.focus_areas || [],
              deadline: null,
              url: row.monitored_url || row.base_url || '',
              official_url: row.monitored_url || '',
              focus_areas: row.focus_areas || [],
              education_levels: row.education_levels || [],
              opportunity_types: row.opportunity_types || [],
              trust_tier: row.trust_tier,
              reliability_score: row.reliability_score || 70,
              quality_score,
              source_type: row.source_type || 'official',
              base_url: row.base_url || '',
              monitored_url: row.monitored_url || '',
              notes: row.notes || '',
              active: row.active !== false,
              status: 'published',
              review_status: 'ready',
              source_scope: 'specific_opportunity',
              imported_from: 'google_sheets',
              imported_sheet_name: 'Sheet1',
              audience: row.education_levels && row.education_levels.includes('high_school') ? 'high-school'
                : row.education_levels && row.education_levels.includes('undergraduate') ? 'college' : 'both',
              location: null, modality: 'remote', competitionLevel: 'medium', fundingType: 'free',
              createdAt: new Date().toISOString(), updated_at: new Date().toISOString(),
            };
            if (!db.opportunities) db.opportunities = [];
            db.opportunities.push(opp);
            log.imported_rows++;
          }

        } else {
          // captured_opportunities
          const dupCheck = detectDuplicateOpportunity(row, [
            ...db.capturedOpportunities,
            ...(db.opportunities || []),
          ]);
          if (dupCheck.isDuplicate) {
            log.duplicate_rows++;
          } else {
            const quality_score = calculateQualityScore(row);
            db.capturedOpportunities.push({
              id: uuidv4(),
              source_id: null,
              raw_title: row.name,
              raw_url: row.monitored_url || row.base_url || '',
              title: row.name,
              organization: '',
              short_description: row.notes || '',
              opportunity_type: (row.opportunity_types || [])[0] || null,
              education_levels: row.education_levels || [],
              focus_areas: row.focus_areas || [],
              base_url: row.base_url || '',
              monitored_url: row.monitored_url || '',
              official_url: row.monitored_url || '',
              source_type: row.source_type || 'official',
              trust_tier: row.trust_tier,
              reliability_score: row.reliability_score || 70,
              quality_score,
              ai_confidence_score: null,
              possible_duplicate_id: dupCheck.isPossibleDuplicate ? dupCheck.existingId : null,
              status: row.review_status === 'inactive_or_legacy' ? 'inactive' : 'needs_review',
              rejection_reason: null,
              notes: row.notes || '',
              imported_from: 'google_sheets',
              imported_sheet_name: 'Sheet1',
              captured_at: new Date().toISOString(),
              reviewed_at: null,
              reviewed_by: null,
            });
            log.imported_rows++;
          }
        }

      } catch (rowErr) {
        log.error_rows++;
        log.error_details.push({ row: rawRow.name || '?', error: rowErr.message });
      }
    }

    writeDatabase(db);
    log.finished_at = new Date().toISOString();
    log.status = 'success';

  } catch (err) {
    log.finished_at = new Date().toISOString();
    log.status = 'error';
    log.error_details.push({ error: err.message });
  }

  // Save log
  const db2 = readDatabase();
  if (!db2.importLogs) db2.importLogs = [];
  db2.importLogs.unshift(log);
  writeDatabase(db2);

  return log;
}

module.exports = { importFromSheets, SHEET_ID };
