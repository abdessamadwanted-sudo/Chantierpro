/* SiteTeam — Pack Manager foundation (client-side presentation only).
 * No Firestore authorization can rely on this module. Server rules remain authoritative.
 * The commercial plan registry is provided by the existing team.js PLANS object.
 */
(function (root) {
  'use strict';
  const OWN = Object.prototype.hasOwnProperty;
  const ALIASES = Object.freeze({ personnel: 'pro', entreprise: 'enterprise' });
  const KEYS = Object.freeze(['basic', 'pro', 'business', 'enterprise']);

  function keyOf(value) {
    const raw = typeof value === 'string' ? value : (value && value.k);
    return OWN.call(ALIASES, raw) ? ALIASES[raw] : raw;
  }

  function getPlan(catalog, value) {
    const key = keyOf(value);
    return catalog && OWN.call(catalog, key) ? catalog[key] : null;
  }

  function contextPlan(catalog, value, context) {
    const plan = getPlan(catalog, value);
    if (!plan) return null; // fail closed on unknown packs
    const org = context === 'organisation';
    return Object.assign({}, plan, org ? (plan.org || {}) : {});
  }

  function features(catalog, value, context, moduleIds) {
    const plan = contextPlan(catalog, value, context);
    if (!plan) return [];
    if (plan.modules === '*') return Array.from(new Set(moduleIds || []));
    return Array.isArray(plan.modules) ? Array.from(new Set(plan.modules)) : [];
  }

  function includesModule(catalog, value, context, moduleId, moduleIds) {
    return typeof moduleId === 'string' && features(catalog, value, context, moduleIds).includes(moduleId);
  }

  function matrix(catalog, moduleIds, context) {
    return Array.from(new Set(moduleIds || [])).map(moduleId => ({
      module: moduleId,
      ...Object.fromEntries(KEYS.map(key => [key, includesModule(catalog, key, context, moduleId, moduleIds)]))
    }));
  }

  function quota(catalog, value, context, field) {
    const plan = contextPlan(catalog, value, context);
    return plan && OWN.call(plan, field) ? plan[field] : null;
  }

  const api = Object.freeze({ keys: KEYS, keyOf, getPlan, contextPlan, features, includesModule, matrix, quota });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SiteTeamPacks = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
