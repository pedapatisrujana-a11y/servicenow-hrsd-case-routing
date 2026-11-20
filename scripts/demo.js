'use strict';
const path = require('path');
const { createPlatform } = require('../test/glide-mock');
const rules = require('../data/routing-rules.json');
const { cases } = require('../data/sample-cases.json');
const p = createPlatform({}, { now: '2026-11-20T12:00:00Z', properties: { 'x_portfolio.hr.routing_rules': JSON.stringify(rules) } });
p.load(path.join(__dirname, '../src/HRCaseRouter.js'));
p.load(path.join(__dirname, '../src/OnboardingPlanBuilder.js'));
const router = new p.context.HRCaseRouter();
console.log('HR case routing');
for (const c of cases) {
  const r = router.route(c);
  console.log(`  ${c.id} ${c.hr_service.padEnd(19)} -> ${r.assignment_group.padEnd(22)} P${r.priority} ${String(r.response_hours).padStart(2)}h${r.sensitive ? '  [restricted]' : ''}`);
}
console.log('\nOnboarding plan: US, remote, engineering, start 2026-12-07');
const plan = new p.context.OnboardingPlanBuilder().build({ start_date: '2026-12-07', country: 'US', employee_type: 'employee', location_type: 'remote', job_family: 'engineering' });
plan.activities.forEach((a) => console.log(`  ${a.due}  ${a.id.padEnd(22)} ${a.owner}`));
