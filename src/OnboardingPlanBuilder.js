/**
 * Script Include: OnboardingPlanBuilder
 *
 * Builds the activity plan for an onboarding lifecycle event from a worker profile
 * (location type, job family, employee type, start date). Each activity gets an owner
 * group and a due date offset in business days from the start date, so a flow can
 * create HR tasks / catalog requests in one loop.
 *
 * Portfolio project: written independently with synthetic data. Not client code.
 */
var OnboardingPlanBuilder = Class.create();
OnboardingPlanBuilder.prototype = {

    initialize: function (catalog) {
        // Activity catalog: when = condition on the worker profile; offset = business days vs start date
        this.catalog = catalog || [
            { id: 'welcome_email', owner: 'hr_tier1', offset: -5, when: {} },
            { id: 'i9_verification', owner: 'hr_compliance', offset: 3, when: { country: 'US', employee_type: 'employee' } },
            { id: 'payroll_setup', owner: 'hr_payroll', offset: -3, when: { employee_type: 'employee' } },
            { id: 'benefits_enrollment', owner: 'hr_benefits', offset: 10, when: { employee_type: 'employee' } },
            { id: 'laptop_request', owner: 'it_fulfillment', offset: -5, when: {} },
            { id: 'badge_access', owner: 'facilities', offset: -2, when: { location_type: 'office' } },
            { id: 'home_office_kit', owner: 'it_fulfillment', offset: -7, when: { location_type: 'remote' } },
            { id: 'dev_tool_access', owner: 'it_access', offset: -1, when: { job_family: 'engineering' } },
            { id: 'contractor_nda', owner: 'legal_ops', offset: -5, when: { employee_type: 'contractor' } },
            { id: 'manager_30day_checkin', owner: 'people_manager', offset: 22, when: {} }
        ];
    },

    /**
     * @param {Object} w { start_date:'YYYY-MM-DD', country, employee_type, location_type, job_family }
     * @returns {{activities:Array<{id:string, owner:string, due:string}>, warnings:string[]}}
     */
    build: function (w) {
        var warnings = [];
        if (!w || !/^\d{4}-\d{2}-\d{2}$/.test(w.start_date || '')) throw new Error('start_date (YYYY-MM-DD) is required');
        var start = new Date(w.start_date + 'T00:00:00Z');
        var today = new Date(gs.nowDateTime().substring(0, 10) + 'T00:00:00Z');

        var out = [];
        for (var i = 0; i < this.catalog.length; i++) {
            var a = this.catalog[i];
            if (!this._matches(a.when, w)) continue;
            var due = this._addBusinessDays(start, a.offset);
            if (due < today) warnings.push(a.id + ' due date ' + this._fmt(due) + ' is already past');
            out.push({ id: a.id, owner: a.owner, due: this._fmt(due) });
        }
        out.sort(function (x, y) { return x.due < y.due ? -1 : x.due > y.due ? 1 : 0; });
        return { activities: out, warnings: warnings };
    },

    _matches: function (when, w) {
        for (var k in when) if (when.hasOwnProperty(k) && when[k] !== w[k]) return false;
        return true;
    },

    _addBusinessDays: function (date, days) {
        var d = new Date(date.getTime());
        var step = days < 0 ? -1 : 1;
        var left = Math.abs(days);
        while (left > 0) {
            d.setUTCDate(d.getUTCDate() + step);
            var dow = d.getUTCDay();
            if (dow !== 0 && dow !== 6) left--;
        }
        return d;
    },

    _fmt: function (d) { return d.toISOString().substring(0, 10); },

    type: 'OnboardingPlanBuilder'
};
