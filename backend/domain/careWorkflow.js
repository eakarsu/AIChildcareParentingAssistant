'use strict';

const STATES = Object.freeze({ draft: ['review'], review: ['approved', 'changes_requested'], changes_requested: ['review'], approved: ['active'], active: ['paused', 'closed'], paused: ['active'], closed: [] });
const PROFESSIONAL_ROLES = new Set(['care_professional', 'safeguarding_lead', 'tenant_admin']);
function text(v, f, max = 500) { if (typeof v !== 'string' || !v.trim() || v.trim().length > max) throw new Error(`${f} is required`); return v.trim(); }
function validateCarePlan(input) {
  if (!input || typeof input !== 'object') throw new Error('care plan must be an object');
  if (!Array.isArray(input.caregivers) || !input.caregivers.length) throw new Error('at least one authorized caregiver is required');
  if (!Array.isArray(input.escalationRules) || !input.escalationRules.length) throw new Error('human escalation rules are required');
  for (const rule of input.escalationRules) if (!rule.trigger || !rule.humanContact || !rule.responseMinutes || rule.responseMinutes < 1) throw new Error('each escalation rule requires trigger, humanContact and positive responseMinutes');
  if (input.consent?.guardian !== true || !input.consent?.capturedAt) throw new Error('documented guardian consent is required');
  return { childRef: text(input.childRef, 'childRef', 100), assessment: input.assessment || {}, schedule: Array.isArray(input.schedule) ? input.schedule : [], caregivers: input.caregivers, emergencyContacts: Array.isArray(input.emergencyContacts) ? input.emergencyContacts : [], escalationRules: input.escalationRules, consent: input.consent };
}
function transition(current, next, role, record, note) {
  if (!STATES[current]?.includes(next)) throw new Error(`transition ${current} -> ${next} is not allowed`);
  if (next === 'approved' && (!PROFESSIONAL_ROLES.has(role) || !note || note.trim().length < 10)) throw new Error('documented qualified human review is required');
  return next;
}
function classifyIncident(incident, rules) {
  if (!incident || typeof incident !== 'object') throw new Error('incident is required');
  const severity = ['low', 'moderate', 'high', 'emergency'].includes(incident.severity) ? incident.severity : null;
  if (!severity) throw new Error('incident severity is invalid');
  const matching = rules.filter(r => r.trigger === severity || r.trigger === incident.type);
  return { severity, requiresImmediateHumanEscalation: severity === 'emergency' || severity === 'high', contacts: matching.map(r => r.humanContact) };
}
module.exports = { STATES, validateCarePlan, transition, classifyIncident };
