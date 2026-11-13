// The built-in wallet. Your game account is a real NEAR account: receive NEAR and NFTs at its address,
// send spirits, badges and fish to anyone, and send NEAR out. The play key in this browser can only call the game;
// sending NEAR rebuilds the full key from your password (or 12 words) for that one transfer and forgets it.

const WAL = { tab: 'home', nfts: [], bal: null };
let qrMod = null;

async function openWallet(tab) {
  if (tab) WAL.tab = tab;
  const el = $('wallet');
  el.innerHTML = `<div class="gname">WALLET</div><div class="sub">loading...</div>`; el.classList.add('on'); sfx('menu');
  try { [WAL.bal, WAL.nfts] = await Promise.all([Backend.balance().catch(() => null), Backend.nfts().catch(() => [])]); } catch (e) {}
  renderWallet();
}
function closeWallet() { $('wallet').classList.remove('on'); }

function nftKind(t) {
  const m = t.metadata || {}, title = m.title || '';
  return title.startsWith('Badge') ? 'badge' : title.startsWith('Legendary fish') ? 'fish' : 'spirit';
}
function nftImg(t) {
  const media = (t.metadata && t.metadata.media) || '';
  const local = media.replace(/^https:\/\/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/[^/]+\//, ''); // served by the game too
  if (nftKind(t) === 'spirit') { const s = (S.spirits || []).find(x => x.token_id === t.token_id); if (s) return spiritFace(s.species); }
  return local || media;
}

async function renderWallet() {
  const el = $('wallet'), id = Backend.accountId, t = WAL.tab, b = WAL.bal;
  const tabs = [['home', 'MY WALLET'], ['items', `ITEMS · ${WAL.nfts.length}`], ['send', 'SEND NEAR']];
  let body = '';
  if (t === 'home') {
    body = `<div class="wHome"><div class="wQr" id="wQr"></div><div class="wInfo">
        <div class="sub">YOUR NEAR ADDRESS</div><div class="wAddr" id="wAddr">${esc(id)}</div>
        <div class="sBtns"><button class="btn" id="wCopy">COPY ADDRESS</button>${Backend.explorerAccount(id) ? `<a class="btn" target="_blank" rel="noopener" href="${Backend.explorerAccount(id)}">SEE ON EXPLORER</a>` : ''}</div>
        <div class="sub" style="margin-top:.8em">BALANCE</div><div class="wBal">${b ? `${b.total.toFixed(4)} NEAR` : '—'}</div>
        <div class="sub">${b ? `${b.available.toFixed(4)} free to send · the rest pays for your account's storage` : ''}${b && b.test ? ' · test mode' : ''}</div>
        <div class="wNote">RECEIVE: anyone can send NEAR, or Pixel Bazaar spirits, badges and fish, to this address from any NEAR wallet. NEAR you add here also pays your gas, so you never run dry.</div>
      </div></div>`;
  } else if (t === 'items') {
    body = WAL.nfts.length ? `<div class="sub" style="margin:.4em 0">Every item here is a NEP-171 NFT you own. Send it to a friend or to your own wallet (MyNearWallet, Meteor, HOT...).</div>
      <div class="wlGrid">${WAL.nfts.map(n => `<div class="wlItem"><img src="${nftImg(n)}" alt=""><b>${esc((n.metadata.title || '').replace(/^Badge: /, '').toUpperCase())}</b><span class="sub">${nftKind(n).toUpperCase()} · #${n.token_id}</span><button class="btn" data-sendnft="${n.token_id}">SEND</button></div>`).join('')}</div>`
      : '<div class="sub" style="margin:1.5em 0;line-height:1.7">No items yet. Catch a spirit (glowing wisps in the grass), earn a badge, or land a legendary fish.</div>';
  } else {
    body = `<div class="sub" style="margin:.4em 0 .8em;line-height:1.6">Send NEAR from your game account to any NEAR address. For safety, type your password (or your 12 words): the game rebuilds your full key for this one send and forgets it right after.</div>
      <div class="wForm"><label>TO<input id="wTo" placeholder="friend.testnet" autocomplete="off"></label>
      <label>AMOUNT (NEAR)<input id="wAmt" type="number" min="0" step="0.01" placeholder="0.10"></label>
      <label>PASSWORD OR 12 WORDS<input id="wPw" type="password" autocomplete="current-password"></label>
      <div class="sub">${b ? `You can send up to about ${Math.max(0, b.available - 0.01).toFixed(3)} NEAR (keep a little for gas).` : ''}</div>
      <button class="btn big gold" id="wSendNear">SEND NEAR</button></div>`;
  }
  el.innerHTML = `<div class="gname">WALLET</div><div class="sub">your game account is a real NEAR account</div>
    <div class="tabs">${tabs.map(([k, n]) => `<button class="tab ${t === k ? 'on' : ''}" data-wt="${k}">${n}</button>`).join('')}</div>
    <div class="wBody">${body}</div>
    <div style="text-align:right;margin-top:.8em"><button class="btn big" id="wClose">CLOSE</button></div>`;
  el.querySelectorAll('[data-wt]').forEach(x => x.onclick = () => { WAL.tab = x.dataset.wt; renderWallet(); });
  $('wClose').onclick = closeWallet;
  if ($('wCopy')) $('wCopy').onclick = () => { navigator.clipboard?.writeText(id).then(() => toast('Address copied.', 2), () => toast(id, 4)); };
  if ($('wQr')) {
    try { if (!qrMod) qrMod = await import('./vendor/qr.mjs'); $('wQr').innerHTML = qrMod.qrSvg(id); } catch (e) { $('wQr').textContent = ''; }
  }
  el.querySelectorAll('[data-sendnft]').forEach(x => x.onclick = () => sendItem(x.dataset.sendnft));
  if ($('wSendNear')) $('wSendNear').onclick = sendNearForm;
  el.querySelectorAll('input').forEach(i => i.onkeydown = e => e.stopPropagation()); // typing here does not move you
}

function sendItem(token) {
  const n = WAL.nfts.find(x => x.token_id === token); if (!n) return;
  const name = (n.metadata.title || '').replace(/^Badge: /, '');
  $('wallet').querySelector('.wBody').innerHTML = `<div class="wSendOne"><img src="${nftImg(n)}" alt=""><div class="gname">SEND ${esc(name.toUpperCase())}</div>
    <div class="sub" style="margin:.4em 0 .8em">NFT #${esc(token)} leaves your game account. ${nftKind(n) === 'spirit' ? 'If it is your companion, it stops following you.' : ''}</div>
    <label class="wForm">TO<input id="wTo1" placeholder="friend.testnet or your-wallet.testnet" autocomplete="off"></label>
    <div class="sBtns" style="justify-content:center;margin-top:.8em"><button class="btn big" id="wBack1">BACK</button><button class="btn big gold" id="wGo1">SEND</button></div></div>`;
  $('wTo1').onkeydown = e => e.stopPropagation(); $('wTo1').focus();
  $('wBack1').onclick = renderWallet;
  $('wGo1').onclick = () => {
    const to = $('wTo1').value.trim().toLowerCase();
    if (!/^[a-z0-9._-]{2,64}$/.test(to)) { toast('That does not look like a NEAR address.', 3); return; }
    if (to === Backend.accountId) { toast('That is your own address.', 3); return; }
    queue({ t: 'SendTo', token, to }, 'send ' + nftKind(n), true);
    flush.after = async () => {
      WAL.nfts = await Backend.nfts().catch(() => WAL.nfts);
      if (!WAL.nfts.find(x => x.token_id === token)) { sfx('success'); toast(`Sent ${name} to ${to}.`, 4); }
      WAL.tab = 'items'; renderWallet();
    };
  };
}

async function sendNearForm() {
  const to = $('wTo').value.trim().toLowerCase(), amt = $('wAmt').value, pw = $('wPw').value;
  if (!pw) { toast('Type your password or 12 words.', 3); return; }
  if (to === Backend.accountId) { toast('That is your own address.', 3); return; }
  busyN++; $('busy').textContent = 'Sending NEAR...'; $('busy').style.display = 'block';
  try {
    const tx = await Backend.sendNear(pw, to, amt);
    chainLog(`transfer · ${amt} NEAR to ${to}`, true, tx); sfx('success'); toast(`Sent ${amt} NEAR to ${to}.`, 4);
    WAL.bal = await Backend.balance().catch(() => WAL.bal); WAL.tab = 'home'; renderWallet();
  } catch (e) { chainLog('transfer', false); sfx('alert'); toast(niceErr(e.message || e), 5); }
  finally { if (--busyN === 0) $('busy').style.display = 'none'; const p = $('wPw'); if (p) p.value = ''; }
}
