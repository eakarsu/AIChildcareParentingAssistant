'use strict';const test=require('node:test');const assert=require('node:assert/strict');const {validateCarePlan,transition,classifyIncident}=require('../domain/careWorkflow');
const valid=()=>({childRef:'child-pseudonym-1',caregivers:[{id:'cg-1'}],escalationRules:[{trigger:'emergency',humanContact:'guardian-on-call',responseMinutes:1}],consent:{guardian:true,capturedAt:'2026-07-18'}});
test('requires guardian consent',()=>assert.throws(()=>validateCarePlan({...valid(),consent:{guardian:false}}),/consent/));
test('requires a human escalation contact',()=>assert.throws(()=>validateCarePlan({...valid(),escalationRules:[{trigger:'high'}]}),/humanContact/));
test('approval requires qualified reviewer and note',()=>{const p=validateCarePlan(valid());assert.throws(()=>transition('review','approved','caregiver',p,'review complete'),/qualified/);assert.equal(transition('review','approved','care_professional',p,'assessment reviewed with guardian'),'approved');});
test('emergency incident mandates human escalation',()=>assert.deepEqual(classifyIncident({severity:'emergency'},valid().escalationRules),{severity:'emergency',requiresImmediateHumanEscalation:true,contacts:['guardian-on-call']}));
