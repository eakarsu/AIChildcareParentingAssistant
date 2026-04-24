const express = require('express');
const authRoutes = require('./auth');
const aiRoutes = require('./ai');
const createCrudRoutes = require('./crud');
const auth = require('../middleware/auth');
const exportRoutes = require('./export');
const profileRoutes = require('./profile');

const router = express.Router();

// Auth routes (public + protected)
router.use('/auth', authRoutes);

// AI routes (protected)
router.use('/ai', auth, aiRoutes);

// Children
router.use(
  '/children',
  createCrudRoutes(
    'children',
    ['user_id', 'name', 'date_of_birth', 'gender', 'blood_type', 'allergies', 'notes'],
    {
      required: ['name', 'date_of_birth'],
      searchFields: ['name', 'notes'],
    }
  )
);

// Milestones
router.use(
  '/milestones',
  createCrudRoutes(
    'milestones',
    ['child_id', 'title', 'description', 'category', 'achieved_date', 'expected_age_months', 'status'],
    {
      required: ['child_id', 'title'],
      searchFields: ['title', 'description', 'category'],
    }
  )
);

// Activities
router.use(
  '/activities',
  createCrudRoutes(
    'activities',
    ['child_id', 'title', 'description', 'category', 'scheduled_date', 'duration_minutes', 'status', 'location'],
    {
      required: ['child_id', 'title'],
      searchFields: ['title', 'description', 'category', 'location'],
    }
  )
);

// Health Records
router.use(
  '/health-records',
  createCrudRoutes(
    'health_records',
    ['child_id', 'title', 'description', 'record_type', 'record_date', 'provider', 'severity', 'notes'],
    {
      required: ['child_id', 'title', 'record_type'],
      searchFields: ['title', 'description', 'provider', 'notes'],
    }
  )
);

// Sleep Records
router.use(
  '/sleep-records',
  createCrudRoutes(
    'sleep_records',
    ['child_id', 'date', 'sleep_start', 'sleep_end', 'quality', 'notes'],
    {
      required: ['child_id', 'date'],
      searchFields: ['notes'],
    }
  )
);

// Feeding Records
router.use(
  '/feeding-records',
  createCrudRoutes(
    'feeding_records',
    ['child_id', 'meal_type', 'food_items', 'quantity', 'meal_time', 'calories', 'notes'],
    {
      required: ['child_id', 'meal_type'],
      searchFields: ['meal_type', 'food_items', 'notes'],
    }
  )
);

// Growth Records
router.use(
  '/growth-records',
  createCrudRoutes(
    'growth_records',
    ['child_id', 'measured_date', 'height_cm', 'weight_kg', 'head_circumference_cm', 'notes'],
    {
      required: ['child_id', 'measured_date'],
      searchFields: ['notes'],
    }
  )
);

// Vaccinations
router.use(
  '/vaccinations',
  createCrudRoutes(
    'vaccinations',
    ['child_id', 'vaccine_name', 'dose_number', 'administered_date', 'next_due_date', 'provider', 'notes'],
    {
      required: ['child_id', 'vaccine_name'],
      searchFields: ['vaccine_name', 'provider', 'notes'],
    }
  )
);

// Behavioral Notes
router.use(
  '/behavioral-notes',
  createCrudRoutes(
    'behavioral_notes',
    ['child_id', 'title', 'behavior', 'context', 'observed_date', 'mood', 'severity'],
    {
      required: ['child_id', 'title', 'behavior'],
      searchFields: ['title', 'behavior', 'context'],
    }
  )
);

// Journal Entries
router.use(
  '/journal-entries',
  createCrudRoutes(
    'journal_entries',
    ['child_id', 'title', 'content', 'mood', 'entry_date', 'tags'],
    {
      required: ['child_id', 'title'],
      searchFields: ['title', 'content', 'tags'],
    }
  )
);

// Medications
router.use(
  '/medications',
  createCrudRoutes(
    'medications',
    ['child_id', 'name', 'dosage', 'frequency', 'start_date', 'end_date', 'prescribed_by', 'notes'],
    {
      required: ['child_id', 'name', 'dosage'],
      searchFields: ['name', 'dosage', 'prescribed_by', 'notes'],
    }
  )
);

// Appointments
router.use(
  '/appointments',
  createCrudRoutes(
    'appointments',
    ['child_id', 'title', 'provider', 'location', 'appointment_date', 'appointment_type', 'status', 'notes'],
    {
      required: ['child_id', 'title', 'appointment_date'],
      searchFields: ['title', 'provider', 'location', 'notes'],
    }
  )
);

// Emergency Contacts (user-scoped, not child-scoped)
router.use(
  '/emergency-contacts',
  createCrudRoutes(
    'emergency_contacts',
    ['user_id', 'name', 'relationship', 'phone', 'email', 'address', 'is_primary'],
    {
      required: ['name', 'phone'],
      searchFields: ['name', 'relationship', 'phone', 'email'],
      userScoped: true,
    }
  )
);

// Learning Resources
router.use(
  '/learning-resources',
  createCrudRoutes(
    'learning_resources',
    ['child_id', 'title', 'description', 'resource_type', 'url', 'age_range_start', 'age_range_end', 'category'],
    {
      required: ['child_id', 'title'],
      searchFields: ['title', 'description', 'category', 'resource_type'],
    }
  )
);

// Diaper Records
router.use('/diaper-records', createCrudRoutes('diaper_records',
  ['child_id', 'change_time', 'type', 'notes'],
  { required: ['child_id', 'type'], searchFields: ['type', 'notes'] }
));

// Expenses (user-scoped)
router.use('/expenses', createCrudRoutes('expenses',
  ['user_id', 'child_id', 'title', 'amount', 'category', 'expense_date', 'payment_method', 'receipt_url', 'notes'],
  { required: ['title', 'amount', 'category'], searchFields: ['title', 'category', 'notes'], userScoped: true }
));

// Caregiver Logs (user-scoped)
router.use('/caregiver-logs', createCrudRoutes('caregiver_logs',
  ['user_id', 'child_id', 'caregiver_name', 'relationship', 'start_time', 'end_time', 'activities', 'notes', 'rating'],
  { required: ['child_id', 'caregiver_name'], searchFields: ['caregiver_name', 'activities', 'notes'], userScoped: true }
));

// Daily Routines
router.use('/daily-routines', createCrudRoutes('daily_routines',
  ['child_id', 'title', 'time_of_day', 'scheduled_time', 'duration_minutes', 'category', 'days_of_week', 'is_active', 'notes'],
  { required: ['child_id', 'title'], searchFields: ['title', 'category', 'notes'] }
));

// Tooth Records
router.use('/tooth-records', createCrudRoutes('tooth_records',
  ['child_id', 'tooth_name', 'tooth_position', 'event_type', 'event_date', 'notes'],
  { required: ['child_id', 'tooth_name', 'event_type'], searchFields: ['tooth_name', 'notes'] }
));

// Photo Memories
router.use('/photo-memories', createCrudRoutes('photo_memories',
  ['child_id', 'title', 'description', 'memory_date', 'category', 'location', 'people_in_photo'],
  { required: ['child_id', 'title'], searchFields: ['title', 'description', 'location', 'people_in_photo'] }
));

// Chores
router.use('/chores', createCrudRoutes('chores',
  ['child_id', 'title', 'description', 'frequency', 'assigned_date', 'due_date', 'status', 'reward', 'notes'],
  { required: ['child_id', 'title'], searchFields: ['title', 'description', 'notes'] }
));

// Allergy Logs
router.use('/allergy-logs', createCrudRoutes('allergy_logs',
  ['child_id', 'allergen', 'severity', 'reaction', 'first_observed', 'last_reaction', 'treatment', 'is_confirmed', 'notes'],
  { required: ['child_id', 'allergen', 'severity'], searchFields: ['allergen', 'reaction', 'treatment', 'notes'] }
));

// Playdates
router.use('/playdates', createCrudRoutes('playdates',
  ['child_id', 'friend_name', 'friend_age', 'playdate_date', 'start_time', 'end_time', 'location', 'activity', 'notes'],
  { required: ['child_id', 'friend_name', 'playdate_date'], searchFields: ['friend_name', 'location', 'activity', 'notes'] }
));

// Shopping Lists (user-scoped)
router.use('/shopping-lists', createCrudRoutes('shopping_lists',
  ['user_id', 'child_id', 'item_name', 'category', 'quantity', 'priority', 'is_purchased', 'estimated_cost', 'store', 'notes'],
  { required: ['item_name'], searchFields: ['item_name', 'category', 'store', 'notes'], userScoped: true }
));

// Export routes
router.use('/export', auth, exportRoutes);

// Profile routes
router.use('/profile', profileRoutes);

module.exports = router;
