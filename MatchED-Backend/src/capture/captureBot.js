const { v4: uuidv4 } = require('uuid');
const { readDatabase, writeDatabase } = require('../database/db');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const EXTRACTION_MODEL = 'claude-haiku-4-5-20251001';

function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanUrl(url) {
  if (!url) return url;
  return url.split('#')[0];
}

function shouldCheckSource(source) {
  if (!source.active) return false;
  if (source.trust_tier === 'blocked') return false;
  if (source.review_status === 'blocked') return false;
  if (source.check_frequency === 'manual' || source.check_frequency === 'never') return false;
  if (!source.last_checked_at) return true;

  const diffH = (Date.now() - new Date(source.last_checked_at).getTime()) / 3600000;
  switch (source.check_frequency) {
    case 'daily':       return diffH >= 24;
    case 'every_3_days': return diffH >= 72;
    case 'weekly':      return diffH >= 168;
    case 'monthly':     return diffH >= 720;
    default:            return false;
  }
}

async function fetchPageContent(url) {
  const cleaned = cleanUrl(url);
  const res = await fetch(cleaned, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; MatchED-Bot/1.0; +https://matched.app/bot)',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9,pt-BR;q=0.8,pt;q=0.7',
    },
    signal: AbortSignal.timeout(20000),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  return htmlToText(html).slice(0, 15000);
}

async function extractOpportunitiesFromSource(source, pageContent) {
  if (!ANTHROPIC_API_KEY) {
    console.warn('[CaptureBot] ANTHROPIC_API_KEY not set — skipping AI extraction');
    return [];
  }

  const systemPrompt = `Você é um extrator de oportunidades educacionais para o MatchED.
Analise o conteúdo abaixo, vindo de uma fonte previamente cadastrada.
Identifique apenas oportunidades reais para estudantes, jovens profissionais ou jovens líderes: bolsas de estudo, summer programs, competições, estágios, fellowships, programas de liderança, conferências, intercâmbios, grants, cursos gratuitos ou seletivos, programas de pesquisa, mentoria, voluntariado, oportunidades de carreira inicial.
Não invente informações. Se algum campo não estiver claro, retorne null.
Responda SOMENTE com um array JSON válido. Nenhum texto fora do JSON.`;

  const userPrompt = `Fonte: ${source.name}
Tipo: ${source.source_type}
URL: ${source.monitored_url}

Conteúdo:
${pageContent}

Retorne um array JSON (máximo 25 itens). Cada item:
{"title":"","organization":"","short_description":"","opportunity_type":"","education_level":[],"focus_areas":[],"country":null,"format":null,"eligibility":null,"benefits":null,"cost":null,"deadline":null,"deadline_raw":null,"application_url":null,"official_url":null,"language":null,"tags":[],"confidence_score":0,"missing_fields":[],"status_suggestion":"needs_review"}

Regras:
- Só retorne oportunidades presentes no conteúdo.
- Não crie deadlines se não estiverem explícitos.
- Se expirada: status_suggestion="expired".
- Para fonte aggregator: preservar official_url (link para o site original da oportunidade, não do agregador).
- Se não há official_url: status_suggestion="needs_review".
- Responda APENAS com o array JSON.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: EXTRACTION_MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
    signal: AbortSignal.timeout(45000),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = (data.content?.[0]?.text || '[]').trim();

  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    const match = text.match(/\[[\s\S]*\]/);
    if (match) { try { return JSON.parse(match[0]); } catch {} }
    return [];
  }
}

function normalizeUrl(url) {
  if (!url) return '';
  return url.toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/[/?#]$/, '').trim();
}

function normalizeTitle(t) {
  if (!t) return '';
  return t.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function detectDuplicateCaptured(opp, db) {
  const existing = [...(db.capturedOpportunities || []), ...(db.opportunities || [])];
  for (const ex of existing) {
    const exUrl = ex.official_url || ex.monitored_url || ex.url || ex.websiteUrl || '';
    const oppUrl = opp.official_url || opp.application_url || '';
    if (oppUrl && exUrl && normalizeUrl(oppUrl) === normalizeUrl(exUrl)) {
      return { isDuplicate: true, existingId: ex.id };
    }
    const ta = normalizeTitle(opp.title);
    const tb = normalizeTitle(ex.title || ex.programName || ex.raw_title || '');
    if (ta && tb && ta.length > 8 && ta === tb) {
      return { isDuplicate: true, existingId: ex.id };
    }
  }
  return { isDuplicate: false };
}

function updateSourceReliability(sourceId, event, db) {
  const idx = (db.sources || []).findIndex(s => s.id === sourceId);
  if (idx === -1) return;
  const deltas = { approved: 2, rejected: -3, duplicate: -1, broken_link: -5, successful_check: 1 };
  const current = db.sources[idx].reliability_score || 50;
  db.sources[idx].reliability_score = Math.max(0, Math.min(100, current + (deltas[event] || 0)));
  db.sources[idx].updated_at = new Date().toISOString();
}

function determineStatus(aiOpp, source) {
  if (aiOpp.status_suggestion === 'expired') return 'inactive';
  if (source.source_type === 'newsletter' || source.source_type === 'social_media') return 'needs_review';
  return 'needs_review';
}

async function processSource(source, db) {
  const result = { sourceId: source.id, name: source.name, captured: 0, duplicates: 0, errors: [] };

  let pageContent;
  try {
    pageContent = await fetchPageContent(source.monitored_url);
  } catch (err) {
    updateSourceReliability(source.id, 'broken_link', db);
    throw new Error(`Fetch failed: ${err.message}`);
  }

  let aiOpps = [];
  try {
    aiOpps = await extractOpportunitiesFromSource(source, pageContent);
  } catch (err) {
    result.errors.push({ phase: 'ai_extraction', error: err.message });
    return result;
  }

  for (const aiOpp of aiOpps) {
    try {
      const dup = detectDuplicateCaptured(aiOpp, db);
      if (dup.isDuplicate) { result.duplicates++; continue; }

      db.capturedOpportunities.push({
        id: uuidv4(),
        source_id: source.id,
        source_name: source.name,
        source_type: source.source_type,
        raw_title: aiOpp.title || '',
        raw_url: aiOpp.official_url || aiOpp.application_url || '',
        title: aiOpp.title || '',
        organization: aiOpp.organization || '',
        short_description: aiOpp.short_description || '',
        opportunity_type: aiOpp.opportunity_type || null,
        education_levels: aiOpp.education_level || [],
        focus_areas: aiOpp.focus_areas || [],
        country: aiOpp.country || null,
        format: aiOpp.format || null,
        official_url: aiOpp.official_url || null,
        application_url: aiOpp.application_url || null,
        eligibility: aiOpp.eligibility || null,
        benefits: aiOpp.benefits || null,
        cost: aiOpp.cost || null,
        deadline: aiOpp.deadline || null,
        deadline_raw: aiOpp.deadline_raw || null,
        language: aiOpp.language || null,
        tags: aiOpp.tags || [],
        requirements: aiOpp.requirements || [],
        source_excerpt: aiOpp.source_excerpt || null,
        ai_confidence_score: typeof aiOpp.confidence_score === 'number' ? aiOpp.confidence_score : null,
        missing_fields: aiOpp.missing_fields || [],
        possible_duplicate_id: null,
        status: determineStatus(aiOpp, source),
        rejection_reason: null,
        notes: '',
        imported_from: 'capture_bot',
        captured_at: new Date().toISOString(),
        reviewed_at: null,
        reviewed_by: null,
      });
      result.captured++;
    } catch (err) {
      result.errors.push({ opp: aiOpp.title, error: err.message });
    }
  }

  updateSourceReliability(source.id, 'successful_check', db);
  return result;
}

async function importRecurringSources() {
  const SOURCES = require('./recurringSourcesList');
  const db = readDatabase();
  if (!db.sources) db.sources = [];

  let added = 0, updated = 0;
  for (const raw of SOURCES) {
    const existing = db.sources.find(s =>
      normalizeUrl(s.monitored_url) === normalizeUrl(raw.monitored_url)
    );
    if (existing) {
      const idx = db.sources.indexOf(existing);
      db.sources[idx] = { ...existing, ...raw, id: existing.id,
        last_checked_at: existing.last_checked_at,
        last_successful_check_at: existing.last_successful_check_at,
        failed_checks_count: existing.failed_checks_count,
        updated_at: new Date().toISOString(),
      };
      updated++;
    } else {
      db.sources.push({ ...raw, id: uuidv4(),
        last_checked_at: null, last_successful_check_at: null, failed_checks_count: 0,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      });
      added++;
    }
  }
  writeDatabase(db);
  return { added, updated, total: SOURCES.length };
}

async function captureOpportunities() {
  const log = {
    id: uuidv4(), type: 'capture_bot',
    started_at: new Date().toISOString(), finished_at: null,
    sources_checked: 0, sources_skipped: 0,
    total_captured: 0, total_duplicates: 0, total_errors: 0,
    status: 'running', details: [],
  };

  const db = readDatabase();
  if (!db.sources) db.sources = [];
  if (!db.capturedOpportunities) db.capturedOpportunities = [];
  if (!db.captureLogs) db.captureLogs = [];

  const toCheck = db.sources.filter(shouldCheckSource);

  for (const source of toCheck) {
    const srcIdx = db.sources.findIndex(s => s.id === source.id);
    db.sources[srcIdx].last_checked_at = new Date().toISOString();

    try {
      const result = await processSource(source, db);
      db.sources[srcIdx].last_successful_check_at = new Date().toISOString();
      db.sources[srcIdx].failed_checks_count = 0;
      log.sources_checked++;
      log.total_captured += result.captured;
      log.total_duplicates += result.duplicates;
      log.total_errors += result.errors.length;
      log.details.push({ ...result, success: true });
    } catch (err) {
      db.sources[srcIdx].failed_checks_count = (db.sources[srcIdx].failed_checks_count || 0) + 1;
      log.sources_checked++;
      log.total_errors++;
      log.details.push({ sourceId: source.id, name: source.name, success: false, error: err.message });
    }

    writeDatabase(db);
    await new Promise(r => setTimeout(r, 2000));
  }

  log.sources_skipped = (db.sources || []).length - log.sources_checked;
  log.finished_at = new Date().toISOString();
  log.status = 'success';

  const db2 = readDatabase();
  if (!db2.captureLogs) db2.captureLogs = [];
  db2.captureLogs.unshift(log);
  if (db2.captureLogs.length > 100) db2.captureLogs = db2.captureLogs.slice(0, 100);
  writeDatabase(db2);
  return log;
}

async function checkSource(sourceId) {
  const db = readDatabase();
  const source = (db.sources || []).find(s => s.id === sourceId);
  if (!source) throw new Error('Source not found');

  if (!db.capturedOpportunities) db.capturedOpportunities = [];

  const srcIdx = db.sources.findIndex(s => s.id === sourceId);
  db.sources[srcIdx].last_checked_at = new Date().toISOString();

  try {
    const result = await processSource(source, db);
    db.sources[srcIdx].last_successful_check_at = new Date().toISOString();
    db.sources[srcIdx].failed_checks_count = 0;
    writeDatabase(db);
    return result;
  } catch (err) {
    db.sources[srcIdx].failed_checks_count = (db.sources[srcIdx].failed_checks_count || 0) + 1;
    writeDatabase(db);
    throw err;
  }
}

module.exports = {
  importRecurringSources,
  captureOpportunities,
  checkSource,
  extractOpportunitiesFromSource,
  updateSourceReliability,
  shouldCheckSource,
};
