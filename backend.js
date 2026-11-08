// Where the game state lives.
//  - local: everything in this browser tab (shared/engine.js), no network. Used by the offline preview.
//  - mock:  the operator server with its JavaScript copy of the contract (for testing without NEAR).
//  - chain: real NEAR. The server creates your account and commits/reveals each day; your browser signs
//           your own moves with a function-call key that can only call this game contract.
'use strict';

const Backend = (() => {
  const cfg = window.PB_CONFIG || { mode: 'local' };
  const mode = cfg.mode || 'local';
  const KEY = 'pb_account_' + (cfg.contractId || 'local');
  const store = { get() { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } }, set(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} } };
  let me = null, near = null, account = null, provider = null, local = null;

  async function api(path, body) {
    const r = await fetch((cfg.api || '') + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}) });
    const j = await r.json().catch(() => ({ error: 'Server error' }));
    if (!r.ok || j.error) throw new Error(j.error || 'Server error');
    return j;
  }
  async function loadNear() {
    if (near) return near;
    near = await import(new URL('vendor/near-api-js.mjs', document.baseURI).href);
    provider = new near.JsonRpcProvider({ url: cfg.nodeUrl });
    return near;
  }

  // ---------- local mode: a full copy of the contract rules in the tab ----------
  function localSetup() {
    local = { engine: new BazaarEngine.Engine('operator', 'local'), acc: null, plan: null };
    local.engine.join('you.local');
    me = { accountId: 'you.local' };
  }

  return {
    mode, cfg,
    get accountId() { return me && me.accountId; },
    explorerTx(h) { return h && cfg.explorer ? cfg.explorer + '/txns/' + h : null; },
    explorerAccount(a) { return cfg.explorer ? cfg.explorer + '/address/' + a : null; },

    /** Make sure we have a player account. `askName` is called (once) in chain/mock mode. */
    async ensurePlayer(askName) {
      if (mode === 'local') { localSetup(); return me.accountId; }
      me = store.get();
      if (me && await this.player()) return me.accountId;
      for (;;) {
        const name = await askName();
        try {
          let publicKey = 'ed25519:' + '1'.repeat(44), secretKey = null;
          if (mode === 'chain') { await loadNear(); const kp = near.KeyPair.fromRandom('ed25519'); publicKey = kp.getPublicKey().toString(); secretKey = kp.toString(); }
          const r = await api('/api/register', { name, publicKey });
          me = { accountId: r.accountId, secretKey }; store.set(me);
          return me.accountId;
        } catch (e) { askName.error = e.message; }
      }
    },
    async player() {
      if (mode === 'local') return local.engine.get_player(me.accountId);
      if (mode === 'mock') return api('/mock/view', { method: 'get_player', args: { account_id: me.accountId } });
      await loadNear(); return provider.callFunction({ contractId: cfg.contractId, method: 'get_player', args: { account_id: me.accountId } });
    },
    async balances(ids) {
      if (mode === 'local') return ids.map(t => local.engine.mt_balance_of(me.accountId, t));
      if (mode === 'mock') return Promise.all(ids.map(t => api('/mock/view', { method: 'mt_balance_of', args: { account_id: me.accountId, token_id: t } })));
      await loadNear(); const r = await provider.callFunction({ contractId: cfg.contractId, method: 'mt_batch_balance_of', args: { account_id: me.accountId, token_ids: ids } });
      return r.map(Number);
    },
    async leaderboard() {
      if (mode === 'local') return local.engine.get_leaderboard();
      if (mode === 'mock') return api('/mock/view', { method: 'get_leaderboard' });
      await loadNear(); return provider.callFunction({ contractId: cfg.contractId, method: 'get_leaderboard', args: {} });
    },
    /** A player move. Returns the transaction hash in chain mode. */
    async call(method, args = {}) {
      if (mode === 'local') { local.engine[method](me.accountId, args); return null; }
      if (mode === 'mock') { await api('/mock/call', { accountId: me.accountId, method, args }); return null; }
      await loadNear();
      if (!account) account = new near.Account(me.accountId, provider, me.secretKey);
      const r = await account.callFunctionRaw({ contractId: cfg.contractId, methodName: method, args, gas: near.teraToGas('15'), deposit: 0n });
      const fail = r?.status?.Failure;
      if (fail) throw new Error(JSON.stringify(fail).replace(/.*panicked: ?/, '').replace(/["\\}]+$/g, '').slice(0, 160));
      return r?.transaction?.hash || null;
    },
    /** Start or resume today: the event is committed before you can trade. */
    async beginDay() {
      if (mode !== 'local') return api('/api/day', { accountId: me.accountId });
      const p = local.engine.get_player(me.accountId);
      if (p.finished) return { finished: true };
      if (!local.acc || local.season !== p.season) { local.acc = Rules.seasonAccuracy(Math.random); local.season = p.season; }
      if (!p.commitment || !local.plan || local.plan.day !== p.day) {
        const d = Rules.planDay(Math.random, local.acc);
        local.plan = { ...d, day: p.day };
        const r = d.rumors.rita;
        local.engine.commit_day('operator', { player: me.accountId, day: p.day, commitment: 'x'.repeat(64), weather: Rules.EVENTS[d.truth].weather || null,
          npc_move: r.lying ? { npc: 'rita.local', good: Rules.GOODS.findIndex(g => g.id === Rules.EVENTS[r.ev].good), long: false } : null });
      }
      return { season: p.season, day: p.day, rumors: local.plan.rumors, weather: Rules.EVENTS[local.plan.truth].weather || null };
    },
    /** Reveal the night's event and settle. */
    async settle() {
      if (mode !== 'local') return api('/api/settle', { accountId: me.accountId });
      const p = local.engine.get_player(me.accountId);
      const log = local.engine.settle_day('operator', { player: me.accountId, day: p.day, event: local.plan.truth, rumors: Rules.encodeRumors(local.plan.rumors), salt: '' });
      return { log };
    },
  };
})();
