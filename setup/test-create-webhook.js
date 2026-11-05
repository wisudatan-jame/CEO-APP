// Run: node setup/test-create-webhook.js
const assert = require('node:assert/strict');
const { setupTicketHistoryWebhook } = require('./create-webhook.js');

(async () => {
  const subs = [{ id: 'old', notificationUrl: 'https://n8n.example/webhook/ceo-sp-hook' }, { id: 'other', notificationUrl: 'https://else' }];
  const config = [];
  const calls = [];
  const ok = (body) => ({ ok: true, status: 200, json: async () => body, text: async () => '' });
  async function fetch(url, o) {
    calls.push(`${o.method} ${url.replace('https://t.sharepoint.com/sites/CEO-Tickets/_api', '')}`);
    if (o.method !== 'GET' && !url.endsWith('/contextinfo')) assert.equal(o.headers['X-RequestDigest'], 'd');
    if (url.endsWith('/contextinfo')) return ok({ FormDigestValue: 'd' });
    if (url.endsWith("getbytitle('TicketHistory')?$select=Id")) return ok({ Id: 'list-guid' });
    if (url.endsWith('/subscriptions') && o.method === 'GET') return ok({ value: subs });
    if (url.includes('/subscriptions(') && o.method === 'DELETE') return ok({});
    if (url.endsWith('/subscriptions') && o.method === 'POST') {
      const b = JSON.parse(o.body);
      assert.equal(b.resource, "https://t.sharepoint.com/sites/CEO-Tickets/_api/web/lists('list-guid')");
      assert.equal(b.clientState, 'a-long-client-state-123');
      assert.equal(b.expirationDateTime, '2027-04-15T03:00:00.000Z');
      return ok({ id: 'new' });
    }
    if (url.includes('ListItemEntityTypeFullName')) return ok({ ListItemEntityTypeFullName: 'SP.Data.ConfigListItem' });
    if (url.includes("$filter=Title eq 'SP_WEBHOOK_EXPIRES'")) return ok({ value: config });
    if (url.endsWith("getbytitle('Config')/items") && o.method === 'POST') {
      config.push({ Id: 7, ...JSON.parse(o.body) });
      return ok({});
    }
    if (url.endsWith("getbytitle('Config')/items(7)")) {
      assert.equal(o.headers['X-HTTP-Method'], 'MERGE');
      return ok({});
    }
    throw new Error(`unexpected ${o.method} ${url}`);
  }
  const now = new Date('2026-10-18T03:00:00Z');
  await setupTicketHistoryWebhook(fetch, 'https://t.sharepoint.com/sites/CEO-Tickets', 'https://n8n.example/webhook/ceo-sp-hook', 'a-long-client-state-123', now, () => {});
  assert.ok(calls.includes("DELETE /web/lists/getbytitle('TicketHistory')/subscriptions('old')"));
  assert.ok(!calls.some((c) => c.includes("subscriptions('other')")));
  assert.equal(config[0].Value, '2027-04-15');
  await setupTicketHistoryWebhook(fetch, 'https://t.sharepoint.com/sites/CEO-Tickets', 'https://n8n.example/webhook/ceo-sp-hook', 'a-long-client-state-123', now, () => {});
  assert.ok(calls.includes("POST /web/lists/getbytitle('Config')/items(7)"));
  await assert.rejects(() => setupTicketHistoryWebhook(fetch, 'x', 'http://insecure', 'a-long-client-state-123', now, () => {}), /https/);
  await assert.rejects(() => setupTicketHistoryWebhook(fetch, 'x', 'https://ok', 'short', now, () => {}), /16/);
  console.log('create-webhook: all checks passed');
})().catch((e) => { console.error(e); process.exit(1); });
