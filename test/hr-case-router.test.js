'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { createPlatform } = require('./glide-mock');
const rules = require('../data/routing-rules.json');
const { cases } = require('../data/sample-cases.json');

const p = createPlatform({}, { properties: { 'x_portfolio.hr.routing_rules': JSON.stringify(rules) } });
p.load(path.join(__dirname, '../src/HRCaseRouter.js'));
const router = new p.context.HRCaseRouter();
const byId = (id) => router.route(cases.find((c) => c.id === id));

test('service + country rule beats service-only rule', () => {
  assert.equal(byId('c1').assignment_group, 'hr_payroll_us');
  assert.equal(byId('c2').assignment_group, 'hr_payroll_global');
});

test('sensitive keyword re-routes to employee relations and restricts visibility', () => {
  const r = byId('c3');
  assert.equal(r.sensitive, true);
  assert.equal(r.restrict_to_group, true);
  assert.equal(r.assignment_group, 'hr_employee_relations');
  assert.equal(r.priority, '2');
  assert.ok(r.response_hours <= 8);
});

test('rule-level sensitivity applies without keywords', () => {
  assert.equal(byId('c4').sensitive, true);
});

test('contractor non-payroll case goes to vendor management', () => {
  assert.equal(byId('c5').assignment_group, 'hr_vendor_mgmt');
  assert.equal(byId('c5').coe, 'HR General');
});

test('VIP + sensitive case gets P1 and 4-hour response', () => {
  const r = byId('c6');
  assert.equal(r.priority, '1');
  assert.equal(r.response_hours, 4);
});

test('keyword match uses word boundaries (no false positive on "premedical")', () => {
  assert.equal(router.route({ hr_service: 'Policy question', short_description: 'premedical course reimbursement' }).sensitive, false);
});

test('falls back to default when no rules are configured', () => {
  const p2 = createPlatform();
  p2.load(path.join(__dirname, '../src/HRCaseRouter.js'));
  const r = new p2.context.HRCaseRouter().route({ hr_service: 'Anything' });
  assert.equal(r.matched_rule, 'default');
  assert.equal(r.assignment_group, 'hr_tier1');
});

test('apply() writes routing fields onto a GlideRecord', () => {
  const p3 = createPlatform({ sn_hr_core_case: [{ sys_id: 'hr1', hr_service: 'Payroll inquiry', u_subject_country: 'US', short_description: 'Overtime missing' }] },
    { properties: { 'x_portfolio.hr.routing_rules': JSON.stringify(rules) } });
  p3.load(path.join(__dirname, '../src/HRCaseRouter.js'));
  const gr = new p3.context.GlideRecord('sn_hr_core_case');
  gr.get('hr1');
  new p3.context.HRCaseRouter().apply(gr);
  assert.equal(gr.getValue('assignment_group'), 'hr_payroll_us');
  assert.match(gr.getValue('work_notes'), /Auto-routing/);
});
