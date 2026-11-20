'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { createPlatform } = require('./glide-mock');

const p = createPlatform({}, { now: '2026-11-20T12:00:00Z' });
p.load(path.join(__dirname, '../src/OnboardingPlanBuilder.js'));
const b = new p.context.OnboardingPlanBuilder();
const ids = (plan) => plan.activities.map((a) => a.id);

test('US remote engineer gets I-9, home kit and dev access, no badge', () => {
  const plan = b.build({ start_date: '2026-12-07', country: 'US', employee_type: 'employee', location_type: 'remote', job_family: 'engineering' });
  const list = ids(plan);
  ['i9_verification', 'home_office_kit', 'dev_tool_access', 'payroll_setup'].forEach((x) => assert.ok(list.includes(x), x));
  assert.ok(!list.includes('badge_access'));
  assert.ok(!list.includes('contractor_nda'));
});

test('contractor gets NDA and no payroll/benefits', () => {
  const list = ids(b.build({ start_date: '2026-12-07', country: 'US', employee_type: 'contractor', location_type: 'office' }));
  assert.ok(list.includes('contractor_nda'));
  assert.ok(!list.includes('payroll_setup'));
  assert.ok(!list.includes('benefits_enrollment'));
});

test('due dates skip weekends and are sorted', () => {
  const plan = b.build({ start_date: '2026-12-07', country: 'US', employee_type: 'employee', location_type: 'office' });
  const welcome = plan.activities.find((a) => a.id === 'welcome_email');
  assert.equal(welcome.due, '2026-11-30'); // Mon Dec 7 minus 5 business days
  const dues = plan.activities.map((a) => a.due);
  assert.equal(dues.join(), [...dues].sort().join());
});

test('warns when the start date is too close for lead-time tasks', () => {
  const plan = b.build({ start_date: '2026-11-23', country: 'US', employee_type: 'employee', location_type: 'remote' });
  assert.ok(plan.warnings.some((w) => /home_office_kit/.test(w)));
});

test('invalid start date throws a clear error', () => {
  assert.throws(() => b.build({ start_date: '12/07/2026' }), /start_date/);
});
