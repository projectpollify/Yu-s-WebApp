const express = require('express');
const router = express.Router();
const Waitlist = require('../models/waitlist.model');

// Get all waitlist entries
router.get('/', async (req, res) => {
  try {
    const { status, programType } = req.query;
    const filter = {};
    
    if (status) filter.status = status;
    if (programType) filter.programType = programType;
    
    const entries = await Waitlist.find(filter).sort({ receivedDate: -1 });
    res.json(entries);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get waitlist statistics
router.get('/stats', async (req, res) => {
  try {
    const total = await Waitlist.countDocuments();
    const pending = await Waitlist.countDocuments({ status: 'pending' });
    const contacted = await Waitlist.countDocuments({ status: 'contacted' });
    const enrolled = await Waitlist.countDocuments({ status: 'enrolled' });
    
    const byProgram = await Waitlist.aggregate([
      { $group: { _id: '$programType', count: { $sum: 1 } } }
    ]);
    
    const byMonth = await Waitlist.aggregate([
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$preferredStartDate' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    res.json({
      total,
      pending,
      contacted,
      enrolled,
      byProgram,
      byMonth
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get single waitlist entry
router.get('/:id', async (req, res) => {
  try {
    const entry = await Waitlist.findById(req.params.id);
    if (!entry) {
      return res.status(404).json({ message: 'Entry not found' });
    }
    res.json(entry);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update waitlist entry
router.put('/:id', async (req, res) => {
  try {
    const { status, priority, notes } = req.body;
    
    const entry = await Waitlist.findByIdAndUpdate(
      req.params.id,
      { status, priority, notes },
      { new: true }
    );
    
    if (!entry) {
      return res.status(404).json({ message: 'Entry not found' });
    }
    
    res.json(entry);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete waitlist entry
router.delete('/:id', async (req, res) => {
  try {
    const entry = await Waitlist.findByIdAndDelete(req.params.id);
    
    if (!entry) {
      return res.status(404).json({ message: 'Entry not found' });
    }
    
    res.json({ message: 'Entry deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;