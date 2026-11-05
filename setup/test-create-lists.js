// Run: node setup/test-create-lists.js
const assert = require('node:assert/strict');
const { setupCeoTickets, CEO_TICKETS_SCHEMA } = require('./create-lists.js');

function fakeSharePoint(existingLists) {
  const lists = {};
  for (const t of existingLists) lists[t] = { fields: new Set(['Title']), items: [] };
  const calls = [];
  const ok = (body, status = 200) => ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body) });
  async function fetch(url, opts) {
    calls.push({ url, ...opts });
    if (url.endsWith('/_api/contextinfo')) return ok({ FormDigestValue: 'digest' });
    assert.equal(opts.credentials, 'same-origin');
    if (opts.method !== 'GET') assert.equal(opts.headers['X-RequestDigest'], 'digest');
    if (url.endsWith('/_api/web/lists') && opts.method === 'POST') {
      const b = JSON.parse(opts.body);
      lists[b.Title] = { fields: new Set(['Title']), items: [] };
      return ok({});
    }
    const m = url.match(/getbytitle\('([^']+)'\)(\/[a-z]+)?(\/createfieldasxml)?/);
    const l = lists[m[1]];
    if (!l) return ok({ error: 'missing' }, 404);
    if (!m[2]) return ok({ Id: 'x', ListItemEntityTypeFullName: `SP.Data.${m[1]}ListItem` });
    if (m[2] === '/fields' && m[3]) {
      const xml = JSON.parse(opts.body).parameters.SchemaXml;
      l.fields.add(xml.match(/ Name="([^"]+)"/)[1]);
      return ok({});
    }
    if (m[2] === '/fields') return ok({ value: [...l.fields].map((n) => ({ InternalName: n })) });
    if (m[2] === '/items' && opts.method === 'GET') return ok({ value: l.items.map((t) => ({ Title: t })) });
    if (m[2] === '/items') {
      const b = JSON.parse(opts.body);
      assert.equal(b.__metadata.type, `SP.Data.${m[1]}ListItem`);
      l.items.push(b.Title);
      return ok({});
    }
    throw new Error(`unexpected ${url}`);
  }
  return { fetch, lists, calls };
}

(async () => {
  const sp = fakeSharePoint(['Employees']);
  const logs = [];
  await setupCeoTickets(sp.fetch, 'https://t.sharepoint.com/sites/CEO-Tickets', (s) => logs.push(s));
  for (const list of CEO_TICKETS_SCHEMA) {
    assert.ok(sp.lists[list.title], list.title);
    for (const xml of list.fields) assert.ok(sp.lists[list.title].fields.has(xml.match(/ Name="([^"]+)"/)[1]));
  }
  assert.deepEqual(sp.lists.Config.items, ['CEO_EMAIL', 'OWNER_EMAIL', 'BACKUP_EMAIL', 'NOACK_HOURS', 'CEO_LINE_USER_ID', 'QUICK_ASSIGNEES', 'SP_WEBHOOK_EXPIRES']);
  assert.ok(logs.includes('มี Employees อยู่แล้ว'));
  // Fields the bot and flows rely on
  for (const f of ['AssigneeEmail', 'Status', 'IsOpen', 'Source', 'PermsSet', 'HasFiles', 'DueDate', 'ClosedAt']) assert.ok(sp.lists.Tickets.fields.has(f), f);
  for (const f of ['TicketID', 'Processed', 'Source', 'ActorEmail', 'CEOPending']) assert.ok(sp.lists.TicketHistory.fields.has(f), f);
  // Second run creates nothing new
  const before = sp.calls.filter((c) => c.method === 'POST').length;
  await setupCeoTickets(sp.fetch, 'https://t.sharepoint.com/sites/CEO-Tickets', () => {});
  const after = sp.calls.filter((c) => c.method === 'POST').length;
  assert.equal(after - before, 1); // only the contextinfo call
  // XML is well-formed enough for SharePoint: every Field closes
  for (const list of CEO_TICKETS_SCHEMA) for (const xml of list.fields) assert.match(xml, /(\/>|<\/Field>)$/);
  console.log('create-lists: all checks passed');
})().catch((e) => { console.error(e); process.exit(1); });
