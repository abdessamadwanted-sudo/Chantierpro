/* SiteTeam — Feature Matrix V2: pure, read-only model.
 * Takes existing PLANS / MODS / PREMIUM / Team.FLAG_DEFS; never defines a
 * second commercial registry and NEVER authorizes Firestore/Drive operations.
 */
(function (root) {
  'use strict';
  const PACKS = Object.freeze(['basic', 'pro', 'business', 'enterprise']);
  const STAGES = Object.freeze(['absent', 'dev', 'test', 'pub']);
  const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj || {}, key);
  const keys = (rows) => Array.isArray(rows) ? rows.filter(r => Array.isArray(r) && typeof r[0] === 'string') : [];
  const stage = (value) => ['dev', 'test', 'pub'].includes(value) ? value : 'absent';
  const isValidPack = key => PACKS.includes(key);

  function makeRows({ plans, mods, premium, flagDefs, fp, scope = 'organisation' } = {}) {
    const names = Object.keys(flagDefs || {});
    const one = (type, key, label, forPack) => ({
      id: type + ':' + key, kind: type, key, label,
      packs: Object.fromEntries(PACKS.map(pack => [pack, forPack(pack)]))
    });
    const current = (p) => {
      if (!has(plans, p)) return null;
      const base = plans[p];
      if (!base || typeof base !== 'object') return null;
      if (scope === 'personnel' && base.perso !== true) return null;
      if (scope === 'organisation' && base.orgOffer === false) return null;
      return scope === 'organisation' ? { ...base, ...(base.org || {}) } : base;
    };
    const modules = keys(mods).map(([key, label]) => one('module', key, label, pack => {
      const P = current(pack);
      return P && (P.modules === '*' || (Array.isArray(P.modules) && P.modules.includes(key))) ? 'included' : 'excluded';
    }));
    const premiums = keys(premium).map(([key, label]) => one('premium', key, label, pack => {
      const P = current(pack);
      // null means legacy unrestricted, NOT a live server permission.
      return P && (P.feats == null || P.feats === '*' || (Array.isArray(P.feats) && P.feats.includes(key))) ? 'included' : 'excluded';
    }));
    const releases = names.map(key => one('release', key, flagDefs[key], pack =>
      current(pack) ? stage(fp && fp[key] && fp[key][pack]) : 'absent'));
    return [...modules, ...premiums, ...releases];
  }

  function audit({ plans, mods, premium, flagDefs, fp, testersByPack } = {}) {
    const errs = [], ids = new Set();
    for (const [kind, data] of [['module', keys(mods)], ['premium', keys(premium)]]) {
      for (const [key] of data) { const id = kind + ':' + key; if (ids.has(id)) errs.push('duplicate ' + id); ids.add(id); }
    }
    for (const k of Object.keys(flagDefs || {})) {
      const id = 'release:' + k;
      if (ids.has(id)) errs.push('duplicate ' + id);
      ids.add(id);
    }
    for (const [key, value] of Object.entries(fp || {})) {
      if (!has(flagDefs, key)) errs.push('unknown release flag ' + key);
      for (const [pack, setting] of Object.entries(value || {})) {
        if (!isValidPack(pack)) errs.push('unknown pack ' + pack + ' on ' + key);
        if (stage(setting) === 'absent') errs.push('invalid stage ' + key + '/' + pack);
      }
    }
    for (const pack of Object.keys(testersByPack || {})) if (!isValidPack(pack)) errs.push('invalid tester pack ' + pack);
    for (const pack of PACKS) if (!has(plans, pack)) errs.push('missing pack ' + pack);
    return errs;
  }

  // Stage is an additional rollout restriction, never a replacement for
  // subscription, member permissions, project scope or server-side rules.
  function rolloutAllows({ setting, isSuper = false, tester = false } = {}) {
    const s = stage(setting);
    if (s === 'absent') return false;
    if (s === 'dev') return isSuper;
    if (s === 'test') return isSuper || tester;
    return s === 'pub';
  }

  const api = Object.freeze({ PACKS, STAGES, stage, makeRows, audit, rolloutAllows });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.STFeatureMatrixV2 = api;
})(typeof globalThis === 'object' ? globalThis : null);
