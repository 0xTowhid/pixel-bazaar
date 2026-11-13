// Where the game state lives.
//  - local: everything in this browser tab (shared/engine.js), no network. Used by the offline preview.
//  - mock:  the operator server with its JavaScript copy of the contract (for testing without NEAR).
//  - chain: real NEAR. The server creates your account and commits/reveals each day; your browser signs
//           your own moves with a function-call key that can only call this game contract.
// Login: your name + password (or your 12-word recovery code) rebuild the same game key on any device.
'use strict';

const Backend = (() => {
  const cfg = window.PB_CONFIG || { mode: 'local' };
  const mode = cfg.mode || 'local';
  const KEY = 'pb_account_' + (cfg.contractId || 'local');
  const store = { get() { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } }, set(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} }, clear() { try { localStorage.removeItem(KEY); } catch (e) {} } };
  // same shape as the server's callsFor(): who made a call today, and the call itself only if you peeked
  function localCalls(p) {
    const moves = (local && local.plan && local.plan.moves) || [];
    const calls = Rules.AGENTS.map((a, k) => { const m = moves.find(x => Rules.agentOf(x.npc) === k), open = !!(p.peeked & (1 << k)); return { agent: k, has: !!m, open, ...(m && open ? { good: m.good, long: m.long } : {}) }; });
    const seen = k => calls[k].open && calls[k].has, agents = {};
    for (const k of [2, 3, 4]) if (seen(k)) agents[Rules.AGENTS[k].id] = { good: calls[k].good, long: calls[k].long };
    return { calls, kaito: seen(0) ? { good: calls[0].good, long: calls[0].long } : null, agents };
  }
  let me = null, near = null, keys = null, account = null, provider = null, local = null, lastNonce = 0n, relayOff = false;
  const url = f => new URL(f, document.baseURI).href;

  async function api(path, body) {
    const r = await fetch((cfg.api || '') + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}) });
    const j = await r.json().catch(() => ({ error: 'Server error' }));
    if (!r.ok || (j && j.error)) throw new Error((j && j.error) || 'Server error');
    return j;
  }
  async function loadNear() {
    if (near) return near;
    near = await import(url('vendor/near-api-js.mjs'));
    provider = new near.JsonRpcProvider({ url: cfg.nodeUrl });
    return near;
  }
  async function loadKeys() { if (!keys) keys = await import(url('vendor/keys.mjs')); return keys; }
  /** name + password -> 12 words (PBKDF2, 210k rounds, salted with the account id) */
  async function phraseFromPassword(accountId, password) {
    await loadKeys();
    if (!crypto.subtle) throw new Error('Login needs a secure page (https or localhost).');
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode('pixel-bazaar|' + accountId), iterations: 210000 }, base, 128);
    return keys.phraseFromEntropy(new Uint8Array(bits));
  }

  function localSetup() {
    local = { engine: new BazaarEngine.Engine('operator', 'local'), acc: null, plan: null };
    for (const a of Rules.AGENTS) local.engine.create_npc('operator', a.id);
    local.engine.register_player('operator', 'you');
    me = { accountId: 'you.local' };
  }

  return {
    mode, cfg,
    get accountId() { return me && me.accountId; },
    explorerTx(h) { return h && cfg.explorer ? cfg.explorer + '/txns/' + h : null; },
    explorerAccount(a) { return cfg.explorer ? cfg.explorer + '/address/' + a : null; },
    logout() { store.clear(); me = null; account = null; },

    /**
     * Make sure we have a player. `ask()` shows the login card and resolves to
     * { kind: 'new' | 'login' | 'code', name, password, phrase }. Returns { accountId, phrase? } (phrase only for new traders).
     */
    async ensurePlayer(ask) {
      if (mode === 'local') { localSetup(); return { accountId: me.accountId }; }
      me = store.get();
      if (me && await this.player().catch(() => null)) return { accountId: me.accountId };
      for (;;) {
        const a = await ask();
        try {
          const name = String(a.name || '').trim().toLowerCase();
          if (!/^[a-z0-9][a-z0-9_-]{1,30}$/.test(name)) throw new Error('Names use 2-31 lowercase letters, numbers, - or _.');
          const accountId = `${name}.${cfg.contractId}`;
          let phrase;
          if (a.kind === 'code') phrase = String(a.phrase || '').trim().toLowerCase().split(/\s+/).join(' ');
          else {
            if (String(a.password || '').length < 8) throw new Error('Passwords need at least 8 characters.');
            phrase = await phraseFromPassword(accountId, a.password);
          }
          await loadKeys();
          // two keys from the same 12 words: the play key (kept here, can only call the game)
          // and the full wallet key (standard NEAR path; never stored, only rebuilt from the password for a send)
          const kp = keys.keyFromPhrase(phrase, 1), full = keys.keyFromPhrase(phrase, 0);
          if (a.kind === 'new') await api('/api/register', { name, publicKey: kp.publicKey, fullKey: full.publicKey });
          else await api('/api/check-key', { accountId, publicKey: kp.publicKey });
          me = { accountId, secretKey: kp.secretKey }; store.set(me); account = null;
          return { accountId, phrase: a.kind === 'new' ? phrase : null };
        } catch (e) { ask.error = e.message; }
      }
    },
    async player() {
      if (mode === 'local') return local.engine.get_player(me.accountId);
      if (mode === 'mock') return api('/mock/view', { method: 'get_player', args: { account_id: me.accountId } });
      await loadNear(); return provider.callFunction({ contractId: cfg.contractId, method: 'get_player', args: { account_id: me.accountId } });
    },
    /** [barn counts by good, owned items and badges] */
    async inventory() {
      if (mode === 'local') return local.engine.get_inventory(me.accountId);
      if (mode === 'mock') return api('/mock/view', { method: 'get_inventory', args: { account_id: me.accountId } });
      await loadNear(); return provider.callFunction({ contractId: cfg.contractId, method: 'get_inventory', args: { account_id: me.accountId } });
    },
    async npcs() {
      if (mode === 'local') return local.engine.get_npcs();
      if (mode === 'mock') return api('/mock/view', { method: 'get_npcs' });
      await loadNear(); return provider.callFunction({ contractId: cfg.contractId, method: 'get_npcs', args: {} });
    },
    async leaderboard() {
      if (mode === 'local') return local.engine.get_leaderboard();
      if (mode === 'mock') return api('/mock/view', { method: 'get_leaderboard' });
      await loadNear(); return provider.callFunction({ contractId: cfg.contractId, method: 'get_leaderboard', args: {} });
    },
    /** Any read-only contract method (spirits, NFTs, wallet link requests). */
    async view(method, args = {}) {
      if (mode === 'local') { const e = local.engine; return e[method](...Object.values(args)); }
      if (mode === 'mock') return api('/mock/view', { method, args });
      await loadNear(); return provider.callFunction({ contractId: cfg.contractId, method, args });
    },
    spirits() { return this.view('get_spirits', { account_id: me.accountId }); },
    /** NEAR on the player's account: { total, available } in NEAR (numbers). */
    async balance() {
      if (mode === 'local') return { total: 0.05, available: 0.05, test: true };
      if (mode === 'mock') return { total: 0.05, available: 0.05, test: true };
      await loadNear();
      const a = await provider.viewAccount({ accountId: me.accountId });
      const total = Number(BigInt(a.amount) / 10n ** 18n) / 1e6, locked = Number(a.storage_usage) * 1e-5;
      return { total, available: Math.max(0, total - locked) };
    },
    /** Send NEAR out. The full key is rebuilt from the password (or the 12 words) just for this, then dropped. */
    async sendNear(secret, to, amount) {
      if (!/^[a-z0-9._-]{2,64}$/.test(to) || !(to.endsWith('.near') || to.endsWith('.testnet') || /^[0-9a-f]{64}$/.test(to))) throw new Error('That does not look like a NEAR address.');
      const n = Number(amount); if (!(n > 0)) throw new Error('Enter an amount.');
      if (mode !== 'chain') { await new Promise(r => setTimeout(r, 400)); return 'test-' + Date.now(); }
      await loadKeys(); await loadNear();
      const words = secret.trim().split(/\s+/).length === 12 ? secret.trim().toLowerCase().split(/\s+/).join(' ') : await phraseFromPassword(me.accountId, secret);
      const full = keys.keyFromPhrase(words, 0);
      const keyOk = await provider.viewAccessKey({ accountId: me.accountId, publicKey: full.publicKey }).then(() => true, () => false);
      if (!keyOk) throw new Error('Wrong password, or this account has no wallet key.');
      const acc = new near.Account(me.accountId, provider, full.secretKey);
      const yocto = BigInt(Math.round(n * 1e6)) * 10n ** 18n;
      const r = await acc.transfer({ receiverId: to, amount: yocto });
      const fail = r?.status?.Failure; if (fail) throw new Error(JSON.stringify(fail).slice(0, 160));
      return r?.transaction?.hash || null;
    },
    nfts() { return this.view('nft_tokens_for_owner', { account_id: me.accountId }); },
    linkRequest() { return this.view('get_link_request', { game_account: me.accountId }); },
    get network() { return cfg.network || 'testnet'; },
    localEngine() { return local && local.engine; },
    get contractId() { return local ? 'local' : cfg.contractId; },
    /** A player move. Returns the transaction hash in chain mode. */
    async call(method, args = {}) {
      if (mode === 'local') { local.engine[method](me.accountId, args); return null; }
      if (mode === 'mock') { await api('/mock/call', { accountId: me.accountId, method, args }); return null; }
      await loadNear();
      if (!account) account = new near.Account(me.accountId, provider, me.secretKey);
      // Gasless: sign the move here, the game server submits it and pays the gas (NEP-366). Your account needs no NEAR.
      const gas = near.teraToGas(method === 'act' ? '50' : '15');
      const relayed = async () => {
        const pk = await account.signer.getPublicKey();
        const [ak, block] = await Promise.all([provider.viewAccessKey({ accountId: me.accountId, publicKey: pk.toString() }), provider.viewBlock({ finality: 'final' })]);
        let nonce = BigInt(ak.nonce) + 1n; if (nonce <= lastNonce) nonce = lastNonce + 1n;
        const da = near.buildDelegateAction({ senderId: me.accountId, receiverId: cfg.contractId, nonce, maxBlockHeight: BigInt(block.header.height) + 120n, publicKey: pk,
          actions: [near.actions.functionCall(method, args, gas, 0n)] });
        const { signedDelegate } = await account.signer.signDelegateAction(da);
        const bytes = near.encodeSignedDelegate(signedDelegate);
        let bin = ''; for (const b of bytes) bin += String.fromCharCode(b);
        try { return (await api('/api/relay', { accountId: me.accountId, delegate: btoa(bin) })).tx || null; }
        finally { lastNonce = nonce; } // a refused move can still use up its nonce on chain
      };
      if (!relayOff) {
        try { return await relayed(); }
        catch (e) {
          const m = String(e && e.message || e);
          if (/InvalidNonce|nonce/i.test(m)) { lastNonce = 0n; return await relayed(); } // a stale nonce: read it again once
          if (!/RELAY_OFF|RELAY_LIMIT|Server error|Failed to fetch|NetworkError/i.test(m)) throw e; // the game said no: show why
          if (/RELAY_OFF/.test(m)) relayOff = true;
          console.warn('relay unavailable, paying gas from your own account:', m);
        }
      }
      const send = async () => {
        const r = await account.callFunctionRaw({ contractId: cfg.contractId, methodName: method, args, gas, deposit: 0n });
        const fail = r?.status?.Failure;
        if (fail) { const raw = JSON.stringify(fail); const err = new Error(raw.replace(/.*panicked: ?/, '').replace(/["\\}]+$/g, '').slice(0, 160)); err.raw = raw; throw err; }
        return r?.transaction?.hash || null;
      };
      try { return await send(); }
      catch (e) {
        // NEAR refused the move because an account could not pay: not a game rule, so fix it instead of telling the player off
        const raw = `${e && e.raw || ''} ${e && e.message || e} ${e && e.type || ''}`;
        if (!/NotEnoughBalance|LackBalanceForState|not have enough balance/i.test(raw)) throw e;
        console.warn('gas problem:', raw.slice(0, 400));
        const who = (raw.match(/"(?:account_id|signer_id)"\s*:\s*"([^"]+)"/) || [])[1];
        if (who && who === cfg.contractId) throw new Error('GAME_STORAGE_LOW');
        let t; try { t = await api('/api/topup', { accountId: me.accountId }); } catch (x) { t = { sent: false, reason: 'server' }; }
        if (!t.sent) throw new Error('GAS_LOW:' + (t.reason || ''));
        await new Promise(r => setTimeout(r, 1500));
        try { return await send(); }
        catch (e2) { if (/NotEnoughBalance|LackBalanceForState|not have enough balance/i.test(`${e2 && e2.raw || ''} ${e2 && e2.message || e2}`)) throw new Error('GAS_LOW:again'); throw e2; }
      }
    },
    /** Start or resume today: the event (and the agents' sealed calls) are committed before you can act. */
    async beginDay() {
      if (mode !== 'local') return api('/api/day', { accountId: me.accountId });
      const p = local.engine.get_player(me.accountId);
      if (p.finished) return { finished: true };
      if (!local.acc || local.season !== p.season) { local.acc = Rules.seasonAccuracy(Math.random); local.season = p.season; }
      if (!p.commitment || !local.plan || local.plan.day !== p.day) {
        const d = Rules.planDay(Math.random, local.acc);
        local.plan = { ...d, day: p.day };
        const r = d.rumors.rita, moves = [{ npc: 'kaito.local', good: d.kaito.good, long: d.kaito.long }];
        if (r.lying) moves.push({ npc: 'rita.local', good: Rules.EVENTS[r.ev].fx[0][0], long: false });
        local.plan.agents = Rules.agentMoves(Math.random, d.truth, d.rumors, d.kaito);
        for (const [id, m] of Object.entries(local.plan.agents)) moves.push({ npc: id + '.local', good: m.good, long: m.long });
        local.plan.moves = moves;
        local.engine.commit_day('operator', { player: me.accountId, day: p.day, commitment: Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('') });
      }
      const lp = local.plan;
      return { season: p.season, day: p.day, rumors: lp.rumors, weather: lp.weather || null, ...localCalls(p), stormWarning: p.projects[1] ? lp.truth === 0 : null };
    },
    /** Today's agent calls: sealed unless you peeked (paid on chain). */
    async calls() {
      if (mode !== 'local') return api('/api/calls', { accountId: me.accountId });
      const p = local.engine.get_player(me.accountId);
      return p.commitment && local.plan ? localCalls(p) : { calls: [], kaito: null, agents: {} };
    },
    /** Reveal the night's event and settle. */
    async settle(day) {
      if (mode !== 'local') return api('/api/settle', { accountId: me.accountId, day });
      const p = local.engine.get_player(me.accountId);
      const log = local.engine.settle_day('operator', { player: me.accountId, day: p.day, event: local.plan.truth, rumors: Rules.encodeRumors(local.plan.rumors), salt: '', npc_moves: local.plan.moves || [] });
      return { log };
    },
  };
})();
