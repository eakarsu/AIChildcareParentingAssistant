/**
 * Record types for the Anna App.
 *
 * This mirrors `CHILD_TABLES` in the standalone backend
 * (`backend/routes/aiChildcare.js`) so the same field names and date columns
 * survive the port. Anything the handoff prompt asks for is represented here.
 *
 * `dateCol` drives both client-side sorting (replacing SQL ORDER BY) and the
 * default ordering of the list.
 */

export const RECORD_TYPES = [
  {
    key: 'milestones',
    label: 'Milestones',
    prefix: 'milestones/',
    dateCol: 'achieved_date',
    icon: '🏆',
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'category', label: 'Category', type: 'select', options: ['Physical', 'Cognitive', 'Social', 'Language', 'Emotional', 'Self-Care'] },
      { name: 'achieved_date', label: 'Achieved on', type: 'date' },
      { name: 'expected_age_months', label: 'Expected age (months)', type: 'number' },
      { name: 'status', label: 'Status', type: 'select', options: ['Achieved', 'In Progress', 'Not Started'] },
      { name: 'description', label: 'Description', type: 'textarea' },
    ],
    // Shown in the collapsed list row.
    summary: (r) => [r.title, r.status].filter(Boolean).join(' · '),
  },
  {
    key: 'medications',
    label: 'Medications',
    prefix: 'medications/',
    dateCol: 'start_date',
    icon: '💊',
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true, handoffImportant: true },
      { name: 'dosage', label: 'Dosage', type: 'text', handoffImportant: true },
      { name: 'frequency', label: 'Frequency', type: 'text', handoffImportant: true },
      { name: 'start_date', label: 'Start date', type: 'date' },
      { name: 'end_date', label: 'End date', type: 'date' },
      { name: 'prescribed_by', label: 'Prescribed by', type: 'text' },
      { name: 'notes', label: 'Notes', type: 'textarea' },
    ],
    summary: (r) => [r.name, r.dosage, r.frequency].filter(Boolean).join(' · '),
  },
  {
    key: 'allergy_logs',
    label: 'Allergies',
    prefix: 'allergies/',
    dateCol: 'last_reaction',
    icon: '⚠️',
    fields: [
      { name: 'allergen', label: 'Allergen', type: 'text', required: true, handoffImportant: true },
      { name: 'severity', label: 'Severity', type: 'select', options: ['Mild', 'Moderate', 'Severe'], handoffImportant: true },
      { name: 'reaction', label: 'Reaction', type: 'text' },
      { name: 'treatment', label: 'Treatment', type: 'text', handoffImportant: true },
      { name: 'is_confirmed', label: 'Confirmed by a clinician', type: 'checkbox' },
      { name: 'last_reaction', label: 'Last reaction', type: 'date' },
      { name: 'notes', label: 'Notes', type: 'textarea' },
    ],
    summary: (r) => [r.allergen, r.severity].filter(Boolean).join(' · '),
  },
  {
    key: 'appointments',
    label: 'Appointments',
    prefix: 'appointments/',
    dateCol: 'appointment_date',
    icon: '📅',
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'provider', label: 'Provider', type: 'text' },
      { name: 'location', label: 'Location', type: 'text' },
      { name: 'appointment_date', label: 'Date', type: 'datetime-local', handoffImportant: true },
      { name: 'appointment_type', label: 'Type', type: 'select', options: ['Checkup', 'Vaccine', 'Follow-up', 'Dental', 'Specialist'] },
      { name: 'status', label: 'Status', type: 'select', options: ['Scheduled', 'Completed', 'Cancelled'] },
      { name: 'notes', label: 'Notes', type: 'textarea' },
    ],
    summary: (r) => [r.title, r.provider, r.status].filter(Boolean).join(' · '),
  },
  {
    key: 'sleep_records',
    label: 'Sleep',
    prefix: 'logs/sleep/',
    dateCol: 'date',
    icon: '😴',
    fields: [
      { name: 'date', label: 'Date', type: 'date', required: true },
      { name: 'sleep_start', label: 'Slept at', type: 'time' },
      { name: 'sleep_end', label: 'Woke at', type: 'time' },
      { name: 'quality', label: 'Quality', type: 'select', options: ['Excellent', 'Good', 'Fair', 'Poor'] },
      { name: 'notes', label: 'Notes', type: 'textarea' },
    ],
    summary: (r) => [r.date, r.sleep_start && `${r.sleep_start}–${r.sleep_end || '?'}`, r.quality].filter(Boolean).join(' · '),
  },
  {
    key: 'feeding_records',
    label: 'Feeding',
    prefix: 'logs/feeding/',
    dateCol: 'meal_time',
    icon: '🍽️',
    fields: [
      { name: 'meal_type', label: 'Meal', type: 'select', options: ['Breakfast', 'Lunch', 'Dinner', 'Snack'], required: true },
      { name: 'food_items', label: 'Foods', type: 'text' },
      { name: 'quantity', label: 'Quantity', type: 'text' },
      { name: 'meal_time', label: 'Time', type: 'datetime-local' },
      { name: 'calories', label: 'Calories', type: 'number' },
      { name: 'notes', label: 'Notes', type: 'textarea' },
    ],
    summary: (r) => [r.meal_type, r.food_items].filter(Boolean).join(' · '),
  },
  {
    key: 'diaper_records',
    label: 'Diapers',
    prefix: 'logs/diaper/',
    dateCol: 'change_time',
    icon: '🧷',
    fields: [
      { name: 'change_time', label: 'Time', type: 'datetime-local', required: true },
      { name: 'type', label: 'Type', type: 'select', options: ['Wet', 'Dirty', 'Mixed', 'Dry'], required: true },
      { name: 'notes', label: 'Notes', type: 'textarea' },
    ],
    summary: (r) => [r.change_time, r.type].filter(Boolean).join(' · '),
  },
  {
    key: 'behavioral_notes',
    label: 'Behavior notes',
    prefix: 'notes/behavior/',
    dateCol: 'observed_date',
    icon: '🧠',
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'behavior', label: 'What happened', type: 'textarea' },
      { name: 'context', label: 'Context', type: 'text' },
      { name: 'observed_date', label: 'Observed on', type: 'date' },
      { name: 'mood', label: 'Mood', type: 'select', options: ['Happy', 'Calm', 'Excited', 'Tired', 'Frustrated', 'Angry', 'Anxious'] },
      { name: 'severity', label: 'Severity', type: 'select', options: ['Low', 'Moderate', 'High'] },
    ],
    summary: (r) => [r.title, r.mood].filter(Boolean).join(' · '),
  },
];

/** Prefix map used by the handoff reader (kept in sync with readAll targets). */
export const HANDOFF_PREFIXES = {
  milestones: 'milestones/',
  medications: 'medications/',
  allergy_logs: 'allergies/',
  appointments: 'appointments/',
  sleep_records: 'logs/sleep/',
  feeding_records: 'logs/feeding/',
  diaper_records: 'logs/diaper/',
  behavioral_notes: 'notes/behavior/',
};

/** Convert a datetime-local / date value into something sortable and displayable. */
export function normaliseTemporal(value) {
  if (!value) return null;
  return String(value);
}

/** Deterministic sort by the type's date column, newest first. */
export function sortRecords(rows, dateCol) {
  return [...rows].sort((a, b) => {
    const av = a?.[dateCol] ?? '';
    const bv = b?.[dateCol] ?? '';
    return String(bv).localeCompare(String(av));
  });
}
