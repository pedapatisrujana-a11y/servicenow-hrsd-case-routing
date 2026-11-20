/**
 * Script Include: HRCaseRouter
 *
 * Routing and confidentiality logic for HR Service Delivery cases. Given a new HR case
 * (HR service, subject person's country, employee type, keywords), it decides:
 *   - the Center of Excellence (COE) and assignment group
 *   - whether the case is sensitive (restricted visibility / named-agent handling)
 *   - the target response time in business hours
 *
 * Rules are config (JSON in a system property or a table), so HR operations can tune
 * them without code changes. Called from a before-insert Business Rule on the HR case
 * table or from a Flow Designer "Run Script" step.
 *
 * Portfolio project: written independently with synthetic data. Not client code and
 * not a copy of any ServiceNow HRSD out-of-box script.
 */
var HRCaseRouter = Class.create();
HRCaseRouter.prototype = {

    initialize: function (rules) {
        this.rules = rules || JSON.parse(gs.getProperty('x_portfolio.hr.routing_rules', '{}'));
        this.sensitiveKeywords = this.rules.sensitiveKeywords ||
            ['harassment', 'discrimination', 'retaliation', 'medical', 'disability', 'investigation', 'whistleblow'];
    },

    /**
     * @param {Object} hrCase { hr_service, subject_country, employee_type, short_description, description, is_vip }
     * @returns {{coe:string, assignment_group:string, sensitive:boolean, restrict_to_group:boolean,
     *            response_hours:number, priority:string, matched_rule:string, reasons:string[]}}
     */
    route: function (hrCase) {
        var reasons = [];
        var service = String(hrCase.hr_service || '').toLowerCase();
        var country = String(hrCase.subject_country || '').toUpperCase();

        // 1. Most specific matching rule wins: service + country > service > default
        var rule = this._findRule(service, country);
        reasons.push('Matched rule: ' + rule.id);

        // 2. Sensitivity: rule flag OR keyword match in the text
        var text = (String(hrCase.short_description || '') + ' ' + String(hrCase.description || '')).toLowerCase();
        var hit = this._keywordHit(text);
        var sensitive = !!rule.sensitive || !!hit;
        if (hit) reasons.push('Sensitive keyword detected: "' + hit + '"');

        var group = rule.group;
        if (sensitive && this.rules.sensitiveGroup) {
            group = this.rules.sensitiveGroup;
            reasons.push('Re-routed to sensitive-case group');
        }

        // 3. Contingent workers are routed to the vendor-management COE for non-payroll topics
        if (hrCase.employee_type === 'contractor' && rule.coe !== 'Payroll' && this.rules.contractorGroup) {
            group = this.rules.contractorGroup;
            reasons.push('Contingent worker routing');
        }

        // 4. Priority / response time
        var hours = rule.response_hours || 24;
        var priority = '4';
        if (sensitive) { hours = Math.min(hours, 8); priority = '2'; }
        if (hrCase.is_vip === true || hrCase.is_vip === 'true') { hours = Math.min(hours, 4); priority = sensitive ? '1' : '2'; reasons.push('VIP handling'); }

        return {
            coe: rule.coe,
            assignment_group: group,
            sensitive: sensitive,
            restrict_to_group: sensitive,
            response_hours: hours,
            priority: priority,
            matched_rule: rule.id,
            reasons: reasons
        };
    },

    /**
     * Apply a routing decision to a GlideRecord (e.g. `current` in a before-insert BR).
     * Writes only the fields it owns; does not call update() (before BR semantics).
     */
    apply: function (gr) {
        var decision = this.route({
            hr_service: gr.getDisplayValue('hr_service'),
            subject_country: gr.getValue('u_subject_country'),
            employee_type: gr.getValue('u_employee_type'),
            short_description: gr.getValue('short_description'),
            description: gr.getValue('description'),
            is_vip: gr.getValue('u_vip')
        });
        gr.setValue('assignment_group', decision.assignment_group);
        gr.setValue('priority', decision.priority);
        gr.setValue('u_coe', decision.coe);
        gr.setValue('u_sensitive', decision.sensitive);
        gr.setValue('work_notes', 'Auto-routing: ' + decision.reasons.join('; '));
        return decision;
    },

    _findRule: function (service, country) {
        var list = this.rules.routes || [];
        var best = null, bestScore = -1;
        for (var i = 0; i < list.length; i++) {
            var r = list[i];
            var svcOk = r.service === '*' || String(r.service).toLowerCase() === service;
            var ctyOk = !r.country || r.country === country;
            if (!svcOk || !ctyOk) continue;
            var score = (r.service !== '*' ? 2 : 0) + (r.country ? 1 : 0);
            if (score > bestScore) { best = r; bestScore = score; }
        }
        return best || { id: 'default', coe: 'HR General', group: this.rules.defaultGroup || 'hr_tier1', response_hours: 24 };
    },

    _keywordHit: function (text) {
        for (var i = 0; i < this.sensitiveKeywords.length; i++) {
            var k = this.sensitiveKeywords[i];
            if (new RegExp('\\b' + k, 'i').test(text)) return k;
        }
        return null;
    },

    type: 'HRCaseRouter'
};
