const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// In Railway production, data is stored in the mounted volume at /app/data
const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/db.json');

function initializeDatabase() {
  if (!fs.existsSync(dbPath)) {
    const initialData = {
      users: [],
      highSchoolProfiles: [],
      collegeProfiles: [],
      opportunities: [],
      savedOpportunities: [],
      swipeEvents: [],
      applicationQuests: [],
      questTasks: [],
      deadlines: [],
      badges: [],
      userBadges: [],
      notifications: [],
      xpTransactions: [],
      resultTracking: [],
      subscriptionPlans: [],
      sources: [],
      capturedOpportunities: [],
      importLogs: [],
      captureLogs: [],
    };
    fs.writeFileSync(dbPath, JSON.stringify(initialData, null, 2));
    console.log('✅ Database initialized');
  }
}

function readDatabase() {
  try {
    const data = fs.readFileSync(dbPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading database:', error);
    return null;
  }
}

function writeDatabase(data) {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing database:', error);
    return false;
  }
}

function getCollection(name) {
  const db = readDatabase();
  return db ? db[name] || [] : [];
}

function addToCollection(name, item) {
  const db = readDatabase();
  if (!db) return null;
  
  const id = uuidv4();
  const newItem = { ...item, id };
  db[name].push(newItem);
  writeDatabase(db);
  return newItem;
}

function updateInCollection(name, id, updates) {
  const db = readDatabase();
  if (!db) return null;
  
  const index = db[name].findIndex(item => item.id === id);
  if (index === -1) return null;
  
  db[name][index] = { ...db[name][index], ...updates };
  writeDatabase(db);
  return db[name][index];
}

function deleteFromCollection(name, id) {
  const db = readDatabase();
  if (!db) return false;
  
  const index = db[name].findIndex(item => item.id === id);
  if (index === -1) return false;
  
  db[name].splice(index, 1);
  writeDatabase(db);
  return true;
}

module.exports = {
  initializeDatabase,
  readDatabase,
  writeDatabase,
  getCollection,
  addToCollection,
  updateInCollection,
  deleteFromCollection,
  dbPath
};
