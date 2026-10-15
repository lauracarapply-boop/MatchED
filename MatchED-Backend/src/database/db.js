// JSON-file database.
//
// The whole database lives in one JSON file (DB_PATH). It is kept in memory and
// re-read only when the file changes on disk, and every write goes to a temp file
// first and is then renamed, so a crash mid-write cannot corrupt the database.
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/db.json');

const COLLECTIONS = [
  'users', 'highSchoolProfiles', 'collegeProfiles', 'opportunities', 'savedOpportunities',
  'swipeEvents', 'applicationQuests', 'questTasks', 'deadlines', 'badges', 'userBadges',
  'notifications', 'xpTransactions', 'resultTracking', 'subscriptionPlans', 'sources',
  'capturedOpportunities', 'importLogs', 'captureLogs', 'pendingOpportunities',
  'opportunityReports', 'partners', 'checkEvents', 'reminderLog',
];

let cache = null;
let cacheMtime = 0;

function emptyDatabase() {
  const db = {};
  COLLECTIONS.forEach(c => { db[c] = []; });
  return db;
}

function ensureCollections(db) {
  COLLECTIONS.forEach(c => { if (!Array.isArray(db[c])) db[c] = []; });
  return db;
}

function initializeDatabase() {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  if (!fs.existsSync(dbPath)) {
    writeDatabase(emptyDatabase());
    console.log('✅ Database initialized at', dbPath);
  }
}

function readDatabase() {
  try {
    const { mtimeMs } = fs.statSync(dbPath);
    if (!cache || mtimeMs !== cacheMtime) {
      cache = ensureCollections(JSON.parse(fs.readFileSync(dbPath, 'utf8')));
      cacheMtime = mtimeMs;
    }
    // Callers mutate the object and pass it to writeDatabase; hand out the cached
    // object so reads stay cheap (Node runs one request handler at a time).
    return cache;
  } catch (error) {
    if (error.code === 'ENOENT') {
      initializeDatabase();
      return readDatabase();
    }
    console.error('Error reading database:', error.message);
    throw error;
  }
}

function writeDatabase(data) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const tmp = `${dbPath}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data));
  fs.renameSync(tmp, dbPath);
  cache = data;
  cacheMtime = fs.statSync(dbPath).mtimeMs;
  return true;
}

function getCollection(name) {
  return readDatabase()[name] || [];
}

function addToCollection(name, item) {
  const db = readDatabase();
  const newItem = { ...item, id: uuidv4() };
  db[name].push(newItem);
  writeDatabase(db);
  return newItem;
}

function updateInCollection(name, id, updates) {
  const db = readDatabase();
  const index = db[name].findIndex(item => item.id === id);
  if (index === -1) return null;
  db[name][index] = { ...db[name][index], ...updates };
  writeDatabase(db);
  return db[name][index];
}

function deleteFromCollection(name, id) {
  const db = readDatabase();
  const index = db[name].findIndex(item => item.id === id);
  if (index === -1) return false;
  db[name].splice(index, 1);
  writeDatabase(db);
  return true;
}

module.exports = {
  initializeDatabase, readDatabase, writeDatabase, getCollection,
  addToCollection, updateInCollection, deleteFromCollection, dbPath, emptyDatabase,
};
