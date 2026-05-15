const express = require('express');
const { getCollection, readDatabase, writeDatabase, addToCollection, updateInCollection } = require('../database/db');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

router.post('/', (req, res) => {
  try {
    const { userId, opportunityId, saveType } = req.body;
    const db = readDatabase();

    const saved = {
      id: uuidv4(),
      userId,
      opportunityId,
      saveType,
      status: 'pending',
      notesFromUser: '',
      savedDate: new Date().toISOString()
    };

    db.savedOpportunities.push(saved);
    writeDatabase(db);

    res.json(saved);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/', (req, res) => {
  try {
    const { userId } = req.query;
    const db = readDatabase();
    
    const saved = db.savedOpportunities.filter(s => s.userId === userId);
    res.json({ savedOpportunities: saved });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const updated = updateInCollection('savedOpportunities', id, { status });
    if (!updated) {
      return res.status(404).json({ error: 'Saved opportunity not found' });
    }

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
