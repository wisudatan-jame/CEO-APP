// สร้าง (หรือสร้างใหม่เพื่อต่ออายุ) SharePoint webhook ของ List TicketHistory ให้เรียก n8n
// วิธีใช้: ดู n8n/README.md หัวข้อ "SharePoint webhook" · ต้องรันใหม่ทุก 5 เดือน (webhook อยู่ได้ไม่เกิน 180 วัน)
// n8n ต้องเปิด Workflow ไว้ (Active) ก่อนรัน เพราะ SharePoint จะเรียก URL เพื่อยืนยันทันที
const WEBHOOK_DAYS = 179;

async function setupTicketHistoryWebhook(fetchImpl, siteUrl, notificationUrl, clientState, now, log) {
  if (!/^https:\/\//.test(notificationUrl)) throw new Error('notificationUrl ต้องขึ้นต้นด้วย https://');
  if (!clientState || clientState.length < 16) throw new Error('clientState ต้องยาวอย่างน้อย 16 ตัวอักษร');
  const api = `${siteUrl}/_api`;
  let digest = null;
  async function call(method, url, body, extra) {
    const headers = Object.assign({ Accept: 'application/json;odata=nometadata' }, extra || {});
    if (method !== 'GET') {
      if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';
      if (digest) headers['X-RequestDigest'] = digest;
    }
    const res = await fetchImpl(url, { method, headers, body: body ? JSON.stringify(body) : undefined, credentials: 'same-origin' });
    if (!res.ok) throw new Error(`${method} ${url} -> ${res.status} ${await res.text()}`);
    return res;
  }
  digest = (await (await call('POST', `${api}/contextinfo`)).json()).FormDigestValue;

  const listUrl = `${api}/web/lists/getbytitle('TicketHistory')`;
  const listId = (await (await call('GET', `${listUrl}?$select=Id`)).json()).Id;
  const subs = (await (await call('GET', `${listUrl}/subscriptions`)).json()).value || [];
  for (const s of subs.filter((x) => x.notificationUrl === notificationUrl)) {
    await call('DELETE', `${listUrl}/subscriptions('${s.id}')`);
    log(`ลบ webhook เดิม ${s.id}`);
  }
  const expires = new Date(now.getTime() + WEBHOOK_DAYS * 86400000).toISOString();
  const created = await (await call('POST', `${listUrl}/subscriptions`, {
    resource: `${siteUrl}/_api/web/lists('${listId}')`,
    notificationUrl,
    expirationDateTime: expires,
    clientState,
  })).json();
  log(`สร้าง webhook ${created.id || ''} หมดอายุ ${expires}`);

  // Record the expiry so the DailyReminders flow can warn the admins before it lapses.
  const cfgUrl = `${api}/web/lists/getbytitle('Config')`;
  const type = (await (await call('GET', `${cfgUrl}?$select=ListItemEntityTypeFullName`)).json()).ListItemEntityTypeFullName;
  const found = (await (await call('GET', `${cfgUrl}/items?$select=Id&$filter=Title eq 'SP_WEBHOOK_EXPIRES'`)).json()).value || [];
  const verbose = { 'Content-Type': 'application/json;odata=verbose' };
  const body = { __metadata: { type }, Title: 'SP_WEBHOOK_EXPIRES', Value: expires.slice(0, 10) };
  if (found.length) {
    await call('POST', `${cfgUrl}/items(${found[0].Id})`, body, Object.assign({ 'X-HTTP-Method': 'MERGE', 'IF-MATCH': '*' }, verbose));
  } else {
    await call('POST', `${cfgUrl}/items`, body, verbose);
  }
  log(`บันทึก Config → SP_WEBHOOK_EXPIRES = ${expires.slice(0, 10)}`);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { setupTicketHistoryWebhook };
} else {
  const url = prompt('URL ของ SharePoint Webhook ใน n8n (…/webhook/ceo-sp-hook)');
  const state = prompt('ค่า SP_WEBHOOK_CLIENT_STATE (ต้องตรงกับใน n8n)');
  const siteUrl = (window._spPageContextInfo && window._spPageContextInfo.webAbsoluteUrl) || location.href.match(/^https:\/\/[^/]+\/sites\/[^/?#]+/)[0];
  setupTicketHistoryWebhook(window.fetch.bind(window), siteUrl, url, state, new Date(), console.log)
    .then(() => console.log('เสร็จแล้ว'))
    .catch((e) => console.error('ไม่สำเร็จ:', e));
}
