// Run: node --test n8n/test
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const lib = require('../src/lib.js');

const SECRET = 'line-channel-secret';
const CEO = 'Uceo000000000000000000000000000001';
const SETTINGS = {
  LINE_CHANNEL_SECRET: SECRET,
  LINE_CHANNEL_ACCESS_TOKEN: 'line-token',
  MS_TENANT_ID: 'tenant',
  MS_CLIENT_ID: 'client',
  MS_CLIENT_SECRET: 'secret',
  SP_HOSTNAME: 'digitalfocusth.sharepoint.com',
  SP_SITE_PATH: '/sites/CEO-Tickets',
  SP_WEBHOOK_CLIENT_STATE: 'sp-state-secret',
};

// ---------- fakes ----------
function fakeWorld(opts = {}) {
  const lists = {
    Config: [
      { Title: 'CEO_EMAIL', Value: 'Ceo@DigitalFocus.co.th' },
      { Title: 'CEO_LINE_USER_ID', Value: opts.ceoId === undefined ? CEO : opts.ceoId },
      { Title: 'NOACK_HOURS', Value: '24' },
      { Title: 'QUICK_ASSIGNEES', Value: 'pm@df.co.th,mkt@df.co.th' },
    ],
    Employees: [
      { Title: 'อนันต์ ใจดี', FirstName: 'อนันต์', LastName: 'ใจดี', Nickname: 'เอ', Aliases: 'พี่เอ,เอ Sales', Email: 'A@df.co.th', Department: 'Sales', Active: true },
      { Title: 'เอกชัย มั่นคง', FirstName: 'เอกชัย', LastName: 'มั่นคง', Nickname: 'เอก', Email: 'ek@df.co.th', Department: 'Presales', Active: true },
      { Title: 'ปิยะ พีเอ็ม', FirstName: 'ปิยะ', Nickname: 'ปิ', Email: 'pm@df.co.th', Department: 'PM', Active: true },
      { Title: 'มาลี การตลาด', FirstName: 'มาลี', Nickname: 'มะลิ', Email: 'mkt@df.co.th', Department: 'Marketing', Active: true },
      { Title: 'อดีต พนักงาน', FirstName: 'อดีต', Nickname: 'เอ', Email: 'left@df.co.th', Department: 'Sales', Active: false },
    ],
    Holidays: (opts.holidays || []).map((d) => ({ Title: 'หยุด', Date: d })),
    Tickets: [],
    TicketHistory: [],
  };
  const items = {};
  let nextId = 100;
  for (const [name, rows] of Object.entries(lists)) {
    items[name] = rows.map((fields) => ({ id: String(nextId++), createdDateTime: '2026-10-01T00:00:00Z', fields }));
  }
  if (opts.tickets) items.Tickets = opts.tickets;
  const calls = { replies: [], pushes: [], uploads: [], tokenRequests: 0 };
  const now = { value: opts.now || new Date('2026-10-19T03:00:00Z') }; // Mon 10:00 Bangkok

  async function http(o) {
    const url = o.url;
    if (url.includes('login.microsoftonline.com')) {
      calls.tokenRequests++;
      assert.match(o.body, /grant_type=client_credentials/);
      return JSON.stringify({ access_token: 'graph-token', expires_in: 3600 });
    }
    if (url.startsWith('https://api.line.me/v2/bot/message/reply')) {
      if (opts.replyFails) throw new Error('Invalid reply token');
      calls.replies.push(o.body);
      return {};
    }
    if (url.startsWith('https://api.line.me/v2/bot/message/push')) {
      calls.pushes.push(o.body);
      return {};
    }
    if (url.startsWith('https://api-data.line.me/')) {
      if (opts.contentFails) throw new Error('gone');
      return new Uint8Array([1, 2, 3]).buffer;
    }
    assert.equal(o.headers.Authorization, 'Bearer graph-token');
    const g = url.replace('https://graph.microsoft.com/v1.0', '');
    if (g === '/sites/digitalfocusth.sharepoint.com:/sites/CEO-Tickets') return { id: 'site1' };
    if (g === '/sites/site1/lists/TicketFiles/drive') return { id: 'drive1' };
    let m = g.match(/^\/drives\/drive1\/root:\/(.+):\/content$/);
    if (m) {
      assert.equal(o.json, false);
      calls.uploads.push({ path: m[1], type: o.headers['Content-Type'], size: o.body.length });
      return { id: 'file' };
    }
    m = g.match(/^\/sites\/site1\/lists\/(\w+)\/items(\/(\d+))?(\/fields)?(\?.*)?$/);
    if (!m) throw new Error(`unexpected url ${url}`);
    const [, list, , id, fieldsPath] = m;
    if (opts.failCreate === list && o.method === 'POST') throw new Error(`create ${list} failed`);
    const rows = items[list];
    const query = m[5] || '';
    if (o.method === 'GET' && !id && query.includes('$filter=')) {
      if (opts.filterFails) throw new Error('filter not supported');
      assert.equal(o.headers.Prefer, 'HonorNonIndexedQueriesWarningMayFailRandomly');
      assert.match(query, /fields\/CEOPending eq 1/);
      return { value: rows.filter((r) => r.fields.CEOPending === true) };
    }
    if (o.method === 'GET' && !id) return { value: rows };
    if (o.method === 'GET') return rows.find((r) => r.id === id);
    if (o.method === 'POST') {
      const row = { id: String(nextId++), createdDateTime: now.value.toISOString(), fields: Object.assign({}, o.body.fields) };
      rows.push(row);
      return row;
    }
    if (o.method === 'PATCH' && fieldsPath) {
      const row = rows.find((r) => r.id === id);
      Object.assign(row.fields, o.body);
      return row.fields;
    }
    throw new Error(`unhandled ${o.method} ${url}`);
  }

  const ctx = { http, setting: (k) => SETTINGS[k], store: {}, now: () => now.value };
  return { ctx, items, calls, now };
}

let eventSeq = 0;
function signed(events) {
  const raw = Buffer.from(JSON.stringify({ destination: 'Ubot', events }), 'utf8');
  const sig = crypto.createHmac('sha256', SECRET).update(raw).digest('base64');
  return { raw, headers: { 'x-line-signature': sig } };
}
function ev(type, extra, userId = CEO) {
  eventSeq++;
  return Object.assign({ type, webhookEventId: `E${eventSeq}`, replyToken: `R${eventSeq}`, source: { type: 'user', userId }, timestamp: 0 }, extra);
}
const textEv = (text, userId) => ev('message', { message: { type: 'text', id: `m${eventSeq}`, text } }, userId);
const postbackEv = (data, params) => ev('postback', { postback: Object.assign({ data: lib.encodeData(data) }, params ? { params } : {}) });
async function send(world, ...events) {
  const { raw, headers } = signed(events);
  return lib.handleWebhook(world.ctx, raw, headers);
}
const lastReply = (w) => w.calls.replies[w.calls.replies.length - 1].messages[0];
const quick = (msg) => msg.quickReply.items.map((i) => i.action);
const actionData = (a) => lib.decodeData(a.data);

// ---------- crypto & dates ----------
test('sha256 and HMAC match node crypto', () => {
  for (const s of ['', 'abc', 'ภาษาไทย'.repeat(50), 'x'.repeat(1000)]) {
    const b = Buffer.from(s);
    assert.equal(Buffer.from(lib.sha256(new Uint8Array(b))).toString('hex'), crypto.createHash('sha256').update(b).digest('hex'));
  }
  const longKey = Buffer.from('k'.repeat(100));
  const msg = Buffer.from('hello');
  assert.equal(Buffer.from(lib.hmacSha256(new Uint8Array(longKey), new Uint8Array(msg))).toString('hex'), crypto.createHmac('sha256', longKey).update(msg).digest('hex'));
});

test('date helpers use Bangkok dates', () => {
  assert.equal(lib.bkkYmd(new Date('2026-10-18T17:30:00Z')), '2026-10-19'); // 00:30 Bangkok
  assert.equal(lib.spDate('2026-10-18T17:00:00Z'), '2026-10-19');
  assert.equal(lib.spDate('2026-10-19T00:00:00Z'), '2026-10-19');
  assert.equal(lib.spDate('2026-10-19'), '2026-10-19');
  assert.equal(lib.fridayOf('2026-10-19'), '2026-10-23'); // Mon
  assert.equal(lib.fridayOf('2026-10-23'), '2026-10-23'); // Fri
  assert.equal(lib.fridayOf('2026-10-24'), '2026-10-30'); // Sat
  assert.equal(lib.fridayOf('2026-10-25'), '2026-10-30'); // Sun
  assert.equal(lib.mondayOf('2026-10-25'), '2026-10-19');
  assert.equal(lib.thaiDate('2026-10-19'), 'จันทร์ 19 ต.ค.');
});

// ---------- security ----------
test('rejects bad signature without calling anything', async () => {
  const w = fakeWorld();
  const { raw } = signed([textEv('x')]);
  const r = await lib.handleWebhook(w.ctx, raw, { 'x-line-signature': 'forged' });
  assert.deepEqual(r, { ok: false, reason: 'bad-signature' });
  assert.equal(w.calls.tokenRequests, 0);
  const r2 = await lib.handleWebhook(w.ctx, null, {});
  assert.equal(r2.ok, false);
});

test('setup mode tells the sender their LINE user ID', async () => {
  const w = fakeWorld({ ceoId: '' });
  const r = await send(w, textEv('hello', 'Usomeone'));
  assert.equal(r.results[0].setup, true);
  assert.match(lastReply(w).text, /Usomeone/);
});

test('ignores anyone who is not the CEO', async () => {
  const w = fakeWorld();
  const r = await send(w, textEv('สั่งงานปลอม', 'Ustranger'));
  assert.equal(r.results[0].ignored, 'not-ceo');
  assert.equal(w.calls.replies.length, 0);
  assert.equal(w.items.Tickets.length, 0);
});

test('duplicate webhook event is processed once', async () => {
  const w = fakeWorld();
  const e = textEv('งาน A');
  await send(w, e);
  const r = await send(w, e);
  assert.equal(r.results[0].skipped, 'duplicate');
  assert.equal(w.calls.replies.length, 1);
});

// ---------- happy path ----------
test('text -> who -> when -> ticket created with history', async () => {
  const w = fakeWorld();
  await send(w, textEv('ส่งใบเสนอราคา Hikvision ให้ลูกค้า'));
  let msg = lastReply(w);
  assert.match(msg.text, /สั่งใคร/);
  const people = quick(msg);
  assert.equal(people[0].label, 'ปิ (PM)'); // from QUICK_ASSIGNEES fallback
  assert.ok(people.some((a) => a.label === '🔍 คนอื่น'));
  const draftId = actionData(people[0]).d;

  await send(w, postbackEv({ a: 'who', d: draftId, e: 'pm@df.co.th' }));
  msg = lastReply(w);
  assert.match(msg.text, /คุณปิ/);
  const when = quick(msg);
  assert.deepEqual(when.map((a) => a.label), ['วันนี้', 'พรุ่งนี้', 'ศุกร์นี้', '📅 เลือกวัน', '❌ ยกเลิก']);
  assert.equal(actionData(when[1]).v, '2026-10-20');
  assert.equal(when[3].type, 'datetimepicker');
  assert.equal(when[3].min, '2026-10-19');

  const r = await send(w, postbackEv({ a: 'when', d: draftId, v: '2026-10-20' }));
  const ticketId = r.results[0].created;
  const t = w.items.Tickets.find((x) => Number(x.id) === ticketId).fields;
  assert.equal(t.Title, 'ส่งใบเสนอราคา Hikvision ให้ลูกค้า');
  assert.equal(t.AssigneeEmail, 'pm@df.co.th');
  assert.equal(t.DueDate, '2026-10-20T00:00:00Z');
  assert.equal(t.Status, 'New');
  assert.equal(t.IsOpen, true);
  assert.equal(t.Source, 'LINE');
  assert.equal(t.PermsSet, false);
  const h = w.items.TicketHistory[0].fields;
  assert.deepEqual([h.TicketID, h.Action, h.Source, h.Processed, h.ActorEmail], [ticketId, 'create', 'LINE', false, 'ceo@digitalfocus.co.th']);
  assert.match(lastReply(w).text, new RegExp(`✅ สั่งคุณปิแล้ว · T-${ticketId}`));
  assert.match(lastReply(w).text, /อังคาร 20 ต.ค./);

  // double tap on the same date button
  await send(w, postbackEv({ a: 'when', d: draftId, v: '2026-10-20' }));
  assert.equal(lastReply(w).text, `งานนี้สร้างแล้ว: T-${ticketId}`);
  assert.equal(w.items.Tickets.length, 1);
});

test('date picker rejects past dates and accepts future ones', async () => {
  const w = fakeWorld();
  await send(w, textEv('งาน B'));
  const d = actionData(quick(lastReply(w))[0]).d;
  await send(w, postbackEv({ a: 'who', d, e: 'mkt@df.co.th' }));
  await send(w, postbackEv({ a: 'date', d }, { date: '2026-10-01' }));
  assert.equal(w.items.Tickets.length, 0);
  assert.ok(w.calls.replies.some((b) => b.messages[0].text === 'เลือกวันที่ผ่านมาแล้วไม่ได้'));
  await send(w, postbackEv({ a: 'date', d }, { date: '2026-11-02' }));
  assert.equal(w.items.Tickets[0].fields.DueDate, '2026-11-02T00:00:00Z');
});

test('forwarded messages within 60s become details; later text starts a new task', async () => {
  const w = fakeWorld();
  await send(w, textEv('ตามงานลูกค้า ABC'), textEv('ข้อความที่ forward 1'), textEv('ข้อความที่ forward 2'));
  assert.equal(w.calls.replies.length, 1);
  w.now.value = new Date(w.now.value.getTime() + 120000);
  await send(w, textEv('งานใหม่'));
  assert.match(lastReply(w).text, /^ยกเลิกงานก่อนหน้า: "ตามงานลูกค้า ABC"/);
  const d = actionData(quick(lastReply(w))[0]).d;
  await send(w, postbackEv({ a: 'who', d, e: 'pm@df.co.th' }));
  await send(w, postbackEv({ a: 'when', d, v: '2026-10-19' }));
  assert.equal(w.items.Tickets[0].fields.Title, 'งานใหม่');
  assert.equal(w.items.Tickets[0].fields.Details, undefined);
});

test('details keep forwarded text', async () => {
  const w = fakeWorld();
  await send(w, textEv('ตามงานลูกค้า ABC'), textEv('รายละเอียด 1'));
  const d = actionData(quick(lastReply(w))[0]).d;
  await send(w, postbackEv({ a: 'who', d, e: 'pm@df.co.th' }));
  await send(w, postbackEv({ a: 'when', d, v: '2026-10-19' }));
  assert.equal(w.items.Tickets[0].fields.Details, 'รายละเอียด 1');
});

test('search by nickname; prefixes stripped; inactive staff excluded', async () => {
  const w = fakeWorld();
  await send(w, textEv('ส่งเอกสารสเปกให้ลูกค้า'));
  const d = actionData(quick(lastReply(w))[0]).d;
  await send(w, postbackEv({ a: 'search', d }));
  await send(w, textEv('พี่เอ'));
  const found = quick(lastReply(w)).filter((a) => actionData(a).a === 'who');
  assert.deepEqual(found.map((a) => actionData(a).e), ['a@df.co.th']); // exact nickname, not "เอก", not the inactive "เอ"
  await send(w, textEv('ไม่มีคนนี้'));
  assert.match(lastReply(w).text, /^ไม่พบ/);
});

test('images attach to the draft and upload after ticket creation', async () => {
  const w = fakeWorld();
  await send(w, textEv('ดูหน้างานตามรูป'));
  const d = actionData(quick(lastReply(w))[0]).d;
  await send(w, ev('message', { message: { type: 'image', id: 'img1', imageSet: { id: 's', index: 1, total: 2 } } }),
    ev('message', { message: { type: 'image', id: 'img2', imageSet: { id: 's', index: 2, total: 2 } } }));
  assert.equal(lastReply(w).text, '📎 แนบรูปแล้ว (2 รูป)');
  await send(w, postbackEv({ a: 'who', d, e: 'a@df.co.th' }));
  const r = await send(w, postbackEv({ a: 'when', d, v: '2026-10-21' }));
  const id = r.results[0].created;
  assert.deepEqual(w.calls.uploads.map((u) => u.path), [`T-${id}/photo-1.jpg`, `T-${id}/photo-2.jpg`]);
  assert.equal(w.items.Tickets[0].fields.HasFiles, true);
  assert.match(lastReply(w).text, /แนบรูป 2 รูป/);
});

test('photos sent before the text attach to the next task; voice messages get guidance', async () => {
  const w = fakeWorld();
  await send(w, ev('message', { message: { type: 'image', id: 'i1', imageSet: { id: 's', index: 1, total: 2 } } }),
    ev('message', { message: { type: 'image', id: 'i2', imageSet: { id: 's', index: 2, total: 2 } } }));
  assert.match(lastReply(w).text, /^📎 รับรูปแล้ว \(2 รูป\)/);
  await send(w, textEv('หาข้อมูลจากรูป'));
  assert.match(lastReply(w).text, /^📎 แนบรูปที่ส่งไว้ 2 รูป/);
  const d = actionData(quick(lastReply(w))[0]).d;
  await send(w, postbackEv({ a: 'who', d, e: 'pm@df.co.th' }));
  const r = await send(w, postbackEv({ a: 'when', d, v: '2026-10-20' }));
  assert.equal(r.results[0].images, 2);
  assert.equal(w.items.Tickets[0].fields.HasFiles, true);

  // a photo right after a ticket: asked whether it belongs to that ticket; a task name instead keeps it for the new task
  await send(w, ev('message', { message: { type: 'image', id: 'i3' } }));
  assert.match(lastReply(w).text, new RegExp(`แนบรูป 1 รูปกับงานก่อนหน้าใช่หรือไม่\\?\n\nT-${r.results[0].created} สั่งงานคุณปิ`));
  await send(w, textEv('งานใหม่มีรูป'));
  assert.match(lastReply(w).text, /^📎 แนบรูปที่ส่งไว้ 1 รูป\n📝 "งานใหม่มีรูป"/);
  await send(w, textEv('ยกเลิก'));
  // stale photos are dropped (2 hours later nothing is offered either)
  w.now.value = new Date(w.now.value.getTime() + 3 * 3600000);
  await send(w, ev('message', { message: { type: 'image', id: 'i4' } }));
  assert.match(lastReply(w).text, /^📎 รับรูปแล้ว \(1 รูป\)/);
  w.now.value = new Date(w.now.value.getTime() + 11 * 60000);
  await send(w, textEv('งานไม่มีรูป'));
  assert.doesNotMatch(lastReply(w).text, /📎/);

  await send(w, ev('message', { message: { type: 'audio', id: 'a' } }));
  assert.match(lastReply(w).text, /ไมค์บนแป้นพิมพ์/);
});

test('name typed or spoken at "สั่งใคร?": exact, with department, wrong department, unknown', async () => {
  const w = fakeWorld();
  await send(w, textEv('งาน 1'));
  await send(w, textEv('สั่งคุณมะลิ'));
  assert.match(lastReply(w).text, /คุณมะลิ\nส่งเมื่อไร/);

  await send(w, textEv('งาน 2'));
  await send(w, textEv('สั่งเอกพรีเซล'));
  assert.match(lastReply(w).text, /คุณเอก\nส่งเมื่อไร/); // not "เอ" although "เอกพรีเซล" starts with "เอ"

  await send(w, textEv('งาน 3'));
  await send(w, textEv('สั่งเอบัญชี')); // เอ is in Sales, not accounting
  let msg = lastReply(w);
  assert.match(msg.text, /ไม่พบ "เอบัญชี" ตรงทุกคำ/);
  assert.deepEqual(quick(msg).filter((a) => actionData(a).a === 'who').map((a) => actionData(a).e), ['a@df.co.th']);

  await send(w, textEv('สั่งสมศรี'));
  msg = lastReply(w);
  assert.match(msg.text, /^ไม่พบชื่อ "สมศรี"/);
  assert.ok(quick(msg).some((a) => a.label === '🔍 คนอื่น'));

  // a detail that merely starts like a nickname is not a person
  const r = await send(w, textEv('เอกสารแนบตามที่คุยกัน'));
  assert.equal(r.results[0].appended !== undefined, true);
  assert.match(lastReply(w).text, /^➕ เพิ่มในรายละเอียดของงานนี้แล้ว/);
  // a due date before a person is chosen is remembered, and picking the person creates the task
  await send(w, textEv('พรุ่งนี้'));
  assert.match(lastReply(w).text, /^📅 ส่งอังคาร 20 ต\.ค\.\n\n📝 "งาน 3"\nสั่งใคร\?/);
  const before = w.items.Tickets.length;
  await send(w, textEv('สั่งเอก'));
  assert.equal(w.items.Tickets.length, before + 1);
  assert.equal(w.items.Tickets[before].fields.DueDate, '2026-10-20T00:00:00Z');
});

// ---------- add to a ticket that already exists ----------
async function makeTicket(w, title, email) {
  await send(w, textEv(title));
  const d = actionData(quick(lastReply(w))[0]).d;
  await send(w, postbackEv({ a: 'who', d, e: email }));
  const r = await send(w, postbackEv({ a: 'when', d, v: '2026-10-20' }));
  return r.results[0].created;
}

test('photo after a ticket: CEO confirms, it uploads to that ticket and the assignee is told', async () => {
  const w = fakeWorld();
  const id = await makeTicket(w, 'เตรียมประชุมพรุ่งนี้', 'mkt@df.co.th');
  await send(w, ev('message', { message: { type: 'image', id: 'p1' } }));
  const msg = lastReply(w);
  assert.match(msg.text, new RegExp(`T-${id} สั่งงานคุณมะลิ\n📝 เรื่อง "เตรียมประชุมพรุ่งนี้"`));
  const yes = quick(msg).find((a) => actionData(a).a === 'addyes');
  assert.equal(yes.label, `✅ ใช่ T-${id}`);
  w.calls.uploads.length = 0;
  await send(w, postbackEv(actionData(yes)));
  assert.equal(w.calls.uploads.length, 1);
  assert.match(w.calls.uploads[0].path, new RegExp(`^T-${id}/photo-20261019-100000-1\\.jpg$`));
  const h = w.items.TicketHistory[w.items.TicketHistory.length - 1].fields;
  assert.deepEqual([h.TicketID, h.Action, h.Comment, h.Processed], [id, 'comment', '📎 CEO แนบรูปเพิ่ม 1 รูป', false]);
  assert.match(lastReply(w).text, new RegExp(`^✅ แนบรูป 1 รูปให้ T-${id} เรียบร้อย\nคุณมะลิจะได้รับแจ้งเตือน`));
  // a second tap does nothing
  await send(w, postbackEv(actionData(yes)));
  assert.equal(w.calls.uploads.length, 1);
  assert.match(lastReply(w).text, /หมดอายุ/);
});

test('"เพิ่มเติม ..." asks which ticket, confirms, then saves to CEOExtra and history', async () => {
  const w = fakeWorld();
  const first = await makeTicket(w, 'งานแรก', 'pm@df.co.th');
  const latest = await makeTicket(w, 'เตรียมประชุมพรุ่งนี้', 'mkt@df.co.th');
  await send(w, textEv('เพิ่มเติม ขอสไลด์ 5 หน้า'));
  let msg = lastReply(w);
  assert.match(msg.text, /^➕ เพิ่มรายละเอียดให้งานไหน\?/);
  assert.match(msg.text, /"ขอสไลด์ 5 หน้า"/);
  assert.deepEqual(quick(msg).slice(0, 2).map((a) => a.label), [`ล่าสุด T-${latest}`, `T-${first} ปิ`]);
  // typed number of the wrong ticket, then "ไม่ใช่", then "ล่าสุด", then "ใช่"
  await send(w, textEv(`ticket ${first}`));
  assert.match(lastReply(w).text, new RegExp(`T-${first} สั่งงานคุณปิ\n📝 เรื่อง "งานแรก"`));
  await send(w, textEv('ไม่ใช่'));
  assert.match(lastReply(w).text, /^เลือกงานอีกครั้ง/);
  await send(w, textEv('ล่าสุด'));
  assert.match(lastReply(w).text, new RegExp(`T-${latest} สั่งงานคุณมะลิ`));
  await send(w, textEv('ใช่ครับ'));
  assert.match(lastReply(w).text, new RegExp(`^✅ เพิ่มรายละเอียดให้ T-${latest} เรียบร้อย`));
  const t = w.items.Tickets.find((x) => Number(x.id) === latest).fields;
  assert.equal(t.CEOExtra, '[19/10 10:00] ขอสไลด์ 5 หน้า');
  const h = w.items.TicketHistory[w.items.TicketHistory.length - 1].fields;
  assert.deepEqual([h.TicketID, h.Action, h.Comment], [latest, 'comment', '➕ คำสั่งเพิ่มเติม: ขอสไลด์ 5 หน้า']);
  // a second addition is appended
  await send(w, textEv('เพิ่มเติม'));
  await send(w, textEv(String(latest)));
  await send(w, textEv('ใช่'));
  assert.match(lastReply(w).text, new RegExp(`^พิมพ์หรือพูดรายละเอียดที่ต้องการเพิ่มให้ T-${latest}`));
  await send(w, textEv('ใส่กราฟยอดขายด้วย'));
  assert.equal(t.CEOExtra, '[19/10 10:00] ขอสไลด์ 5 หน้า\n\n[19/10 10:00] ใส่กราฟยอดขายด้วย');
});

test('"เพิ่มให้งานเดิม" turns the draft into details of an old ticket; "เป็นงานใหม่" turns it back', async () => {
  const w = fakeWorld();
  const id = await makeTicket(w, 'เตรียมประชุมพรุ่งนี้', 'mkt@df.co.th');
  await send(w, textEv('ใช้รูปที่ส่งประกอบการประชุม'));
  let old = quick(lastReply(w)).find((a) => actionData(a).a === 'addold');
  await send(w, postbackEv(actionData(old)));
  let msg = lastReply(w);
  assert.match(msg.text, /^➕ เพิ่มรายละเอียดให้งานไหน\?/);
  await send(w, postbackEv(actionData(quick(msg).find((a) => actionData(a).a === 'addnew'))));
  assert.match(lastReply(w).text, /📝 "ใช้รูปที่ส่งประกอบการประชุม"\nสั่งใคร\?/);
  old = quick(lastReply(w)).find((a) => actionData(a).a === 'addold');
  await send(w, postbackEv(actionData(old)));
  await send(w, postbackEv(actionData(quick(lastReply(w))[0])));
  await send(w, postbackEv(actionData(quick(lastReply(w)).find((a) => actionData(a).a === 'addyes'))));
  assert.match(w.items.Tickets.find((x) => Number(x.id) === id).fields.CEOExtra, /ใช้รูปที่ส่งประกอบการประชุม$/);
});

test('a name or a date alone starts a new task that asks for its name', async () => {
  const w = fakeWorld();
  // name first: asks "new task for คุณมะลิ?", then the task name goes straight to the due date
  let r = await send(w, textEv('สั่งมะลิ'));
  assert.equal(r.results[0].stage, 'what');
  assert.match(lastReply(w).text, /^📝 สั่งงานใหม่ ให้คุณมะลิ ใช่ไหม\?\nพิมพ์หรือพูดชื่องานได้เลย/);
  await send(w, textEv('เตรียมประชุม'));
  assert.match(lastReply(w).text, /^📝 "เตรียมประชุม"\n👤 คุณมะลิ\nส่งเมื่อไร\?/);
  await send(w, textEv('พรุ่งนี้'));
  assert.equal(w.items.Tickets.length, 1);
  assert.deepEqual([w.items.Tickets[0].fields.Title, w.items.Tickets[0].fields.AssigneeEmail], ['เตรียมประชุม', 'mkt@df.co.th']);

  // date first: asks "new task due tomorrow?", then name -> who -> created without asking the date again
  r = await send(w, textEv('พรุ่งนี้'));
  assert.equal(r.results[0].due, '2026-10-20');
  assert.match(lastReply(w).text, /^📝 สั่งงานใหม่ ส่งอังคาร 20 ต\.ค\. ใช่ไหม\?/);
  await send(w, textEv('สรุปยอดขาย'));
  assert.match(lastReply(w).text, /^📅 ส่งอังคาร 20 ต\.ค\.\n\n📝 "สรุปยอดขาย"\nสั่งใคร\?/);
  await send(w, textEv('สั่งปิ'));
  assert.equal(w.items.Tickets.length, 2);
  assert.equal(w.items.Tickets[1].fields.DueDate, '2026-10-20T00:00:00Z');

  // "ไม่ใช่" cancels
  await send(w, textEv('สั่งเอก'));
  await send(w, postbackEv(actionData(quick(lastReply(w))[0])));
  assert.equal(lastReply(w).text, 'ยกเลิกแล้ว: งานใหม่');
  assert.equal(w.items.Tickets.length, 2);
});

test('background runs never write the shared state, so they cannot undo the CEO chat', async () => {
  const wf = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'ceo-line-bot.json'), 'utf8'));
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  for (const name of ['Daily summary', 'Weekly summary', 'Check SharePoint call', 'Notify CEO of staff updates']) {
    const node = wf.nodes.find((n) => n.name === name);
    const w = fakeWorld();
    const shared = { drafts: { [CEO]: { id: 'x' } } };
    const writes = [];
    const guard = new Proxy(shared, { set(t, k, v) { writes.push(k); t[k] = v; return true; }, deleteProperty(t, k) { writes.push(k); delete t[k]; return true; } });
    const fn = new AsyncFunction('$input', '$vars', '$getWorkflowStaticData', node.parameters.jsCode);
    const self = { helpers: { httpRequest: w.ctx.http } };
    const input = { first: () => ({ json: { process: true, query: {}, body: { value: [{ clientState: 'sp-state-secret' }] } } }) };
    await fn.call(self, input, SETTINGS, () => guard);
    assert.deepEqual(writes, [], name);
  }
});

test('due date typed or spoken at "ส่งเมื่อไร?"', async () => {
  const w = fakeWorld(); // Mon 19 Oct 2026
  await send(w, textEv('งาน A'));
  await send(w, textEv('สั่งปิ'));
  await send(w, textEv('ส่งวันพุธหน้า'));
  assert.equal(w.items.Tickets[0].fields.DueDate, '2026-10-28T00:00:00Z');
  await send(w, textEv('งาน B'));
  await send(w, textEv('สั่งปิ'));
  await send(w, textEv('ส่งเมื่อไหร่ก็ได้'));
  assert.match(lastReply(w).text, /^ไม่เข้าใจวันส่ง/);
  assert.equal(w.items.Tickets.length, 1);
  const y = '2026-10-19';
  assert.equal(lib.parseDueText('พรุ่งนี้', y), '2026-10-20');
  assert.equal(lib.parseDueText('ศุกร์นี้', y), '2026-10-23');
  assert.equal(lib.parseDueText('วันจันทร์', y), '2026-10-19');
  assert.equal(lib.parseDueText('ส่งพฤหัส', y), '2026-10-22');
  assert.equal(lib.parseDueText('จันทร์หน้า', y), '2026-10-26');
  assert.equal(lib.parseDueText('เดือนหน้า', y), null);
});

test('leaver: summary flags their open work; CEO transfers all of it to someone else', async () => {
  const w = fakeWorld();
  const old = '2026-10-01T00:00:00Z';
  w.items.Tickets = [
    { id: '1', createdDateTime: old, fields: { Title: 'งาน 1', AssigneeEmail: 'left@df.co.th', Status: 'InProgress', IsOpen: true, DueDate: '2026-10-25T00:00:00Z' } },
    { id: '2', createdDateTime: old, fields: { Title: 'งาน 2', AssigneeEmail: 'left@df.co.th', Status: 'WaitingCEO', IsOpen: true } },
    { id: '3', createdDateTime: old, fields: { Title: 'ปิดแล้ว', AssigneeEmail: 'left@df.co.th', Status: 'Closed', IsOpen: false } },
    { id: '4', createdDateTime: old, fields: { Title: 'ของคนอื่น', AssigneeEmail: 'pm@df.co.th', Status: 'New', IsOpen: true } },
  ];
  await send(w, textEv('สรุป'));
  let msg = lastReply(w);
  assert.match(msg.text, /👋 งานค้างของคนที่ลาออก 2 งาน: คุณเอ/);
  const btn = quick(msg).find((a) => actionData(a).a === 'xfer');
  assert.equal(actionData(btn).f, 'left@df.co.th');

  await send(w, postbackEv(actionData(btn)));
  msg = lastReply(w);
  assert.match(msg.text, /งานค้างของคุณเอ 2 งาน\nT-1 งาน 1\nT-2 งาน 2/);
  const x = actionData(quick(msg)[0]).x;

  await send(w, textEv('มะลิ')); // typed name
  msg = lastReply(w);
  assert.match(msg.text, /^ยืนยันโอน 2 งาน\nจาก คุณเอ → คุณมะลิ/);
  const go = quick(msg)[0];
  assert.deepEqual(actionData(go), { a: 'xgo', x, e: 'mkt@df.co.th' });

  const r = await send(w, postbackEv(actionData(go)));
  assert.deepEqual(r.results[0].transferred, [1, 2]);
  const t1 = w.items.Tickets.find((t) => t.id === '1').fields;
  assert.deepEqual([t1.AssigneeEmail, t1.Status, t1.PermsSet, t1.DueDate], ['mkt@df.co.th', 'New', false, '2026-10-25T00:00:00Z']);
  assert.equal(w.items.Tickets.find((t) => t.id === '3').fields.AssigneeEmail, 'left@df.co.th');
  assert.equal(w.items.Tickets.find((t) => t.id === '4').fields.AssigneeEmail, 'pm@df.co.th');
  const h = w.items.TicketHistory.map((i) => i.fields);
  assert.deepEqual(h.map((f) => [f.TicketID, f.Action, f.FromStatus, f.ToStatus, f.Source, f.Processed]),
    [[1, 'reassign', 'InProgress', 'New', 'LINE', false], [2, 'reassign', 'WaitingCEO', 'New', 'LINE', false]]);
  assert.match(lastReply(w).text, /✅ โอน 2 งานจากคุณเอให้คุณมะลิแล้ว\nT-1, T-2/);

  // double tap on confirm does nothing
  await send(w, postbackEv(actionData(go)));
  assert.match(lastReply(w).text, /ทำไปแล้วหรือหมดอายุ/);
  assert.equal(w.items.TicketHistory.length, 2);
  await send(w, textEv('โอนงาน'));
  assert.match(lastReply(w).text, /^ไม่มีงานค้างของคนที่ลาออก/);
});

test('transfer by name, cancel, and a new task is not mistaken for the transfer target', async () => {
  const w = fakeWorld();
  w.items.Tickets = [{ id: '7', createdDateTime: '2026-10-01T00:00:00Z', fields: { Title: 'x', AssigneeEmail: 'pm@df.co.th', Status: 'New', IsOpen: true } }];
  await send(w, textEv('โอนงานปิ'));
  assert.match(lastReply(w).text, /งานค้างของคุณปิ 1 งาน/);
  assert.ok(quick(lastReply(w)).every((a) => actionData(a).e !== 'pm@df.co.th')); // cannot transfer to the same person
  await send(w, textEv('ยกเลิก'));
  assert.equal(lastReply(w).text, 'ยกเลิกการโอนงานแล้ว');

  await send(w, textEv('โอนงานของปิ'));
  await send(w, textEv('สั่งมะลิทำสไลด์ขาย')); // a task, not a name
  assert.match(lastReply(w).text, /สั่งใคร\?/);
  assert.equal(w.items.Tickets[0].fields.AssigneeEmail, 'pm@df.co.th');
  await send(w, textEv('โอนงานสมศรี'));
  assert.match(lastReply(w).text, /^ไม่พบชื่อ "สมศรี"/);
});

test('expired and cancelled buttons do nothing harmful', async () => {
  const w = fakeWorld();
  await send(w, postbackEv({ a: 'who', d: 'old', e: 'pm@df.co.th' }));
  assert.match(lastReply(w).text, /หมดอายุ/);
  await send(w, textEv('งาน C'));
  const d = actionData(quick(lastReply(w))[0]).d;
  await send(w, postbackEv({ a: 'cancel', d }));
  await send(w, postbackEv({ a: 'who', d, e: 'pm@df.co.th' }));
  assert.match(lastReply(w).text, /หมดอายุ/);
  w.now.value = new Date(w.now.value.getTime() + 31 * 60000);
  await send(w, textEv('งาน D'));
  assert.doesNotMatch(lastReply(w).text, /ยกเลิกงานก่อนหน้า/);
});

test('falls back to push when the reply token has expired', async () => {
  const w = fakeWorld({ replyFails: true });
  await send(w, textEv('งาน E'));
  assert.equal(w.calls.pushes.length, 1);
  assert.equal(w.calls.pushes[0].to, CEO);
});

test('history failure still tells the CEO the ticket number, then fails the execution', async () => {
  const w = fakeWorld({ failCreate: 'TicketHistory' });
  await send(w, textEv('งาน F'));
  const d = actionData(quick(lastReply(w))[0]).d;
  await send(w, postbackEv({ a: 'who', d, e: 'pm@df.co.th' }));
  await assert.rejects(() => send(w, postbackEv({ a: 'when', d, v: '2026-10-19' })), /history event failed/);
  const texts = w.calls.replies.map((b) => b.messages[0].text);
  assert.ok(texts.some((t) => /T-\d+/.test(t) && /ขัดข้อง/.test(t)));
});

// ---------- summaries ----------
function ticket(id, f, created = '2026-10-19T01:00:00Z') {
  return { id: String(id), createdDateTime: created, fields: Object.assign({ Title: `งาน ${id}`, IsOpen: true, Status: 'InProgress' }, f) };
}
function summaryWorld(extra) {
  return fakeWorld(Object.assign({
    tickets: [
      ticket(1, { AssigneeEmail: 'a@df.co.th', DueDate: '2026-10-16T17:00:00Z' }), // due 17 Oct -> overdue
      ticket(2, { AssigneeEmail: 'a@df.co.th', DueDate: '2026-10-18T17:00:00Z' }), // due today -> not overdue
      ticket(3, { AssigneeEmail: 'pm@df.co.th', Status: 'WaitingCEO', DueDate: '2026-10-22' }),
      ticket(4, { AssigneeEmail: 'pm@df.co.th', Status: 'Done', DueDate: '2026-10-22' }),
      ticket(5, { AssigneeEmail: 'mkt@df.co.th', Status: 'New', DueDate: '2026-10-25' }, '2026-10-17T01:00:00Z'), // no ack > 24h
      ticket(6, { AssigneeEmail: 'mkt@df.co.th', Status: 'Closed', IsOpen: false, ClosedAt: '2026-10-19T02:00:00Z' }, '2026-10-17T02:00:00Z'),
    ],
  }, extra));
}

test('summary counts overdue, waiting, done, no-ack and weekly totals', async () => {
  const w = summaryWorld();
  await send(w, textEv('สรุป'));
  const msg = lastReply(w);
  assert.match(msg.text, /เปิดอยู่ 5 งาน/);
  assert.match(msg.text, /เลยกำหนด 1 · ⏳ รอคุณตอบ 1 · ✅ เสร็จรอคุณปิด 1/);
  assert.match(msg.text, /ยังไม่รับทราบ 1/);
  assert.match(msg.text, /สั่ง 4 · ปิดแล้ว 1/);
  assert.equal(quick(msg).length, 4);
});

test('done list offers close/reopen, and stale status is refused', async () => {
  const w = summaryWorld();
  await send(w, postbackEv({ a: 'list', k: 'done', p: 0 }));
  const acts = quick(lastReply(w));
  assert.deepEqual(acts.map((a) => a.label), ['✅ ผ่าน T-4', '❌ ไม่ผ่าน T-4']);
  await send(w, postbackEv(actionData(acts[0])));
  const t4 = w.items.Tickets.find((t) => t.id === '4').fields;
  assert.equal(t4.Status, 'Closed');
  assert.equal(t4.IsOpen, false);
  assert.ok(t4.ClosedAt);
  assert.equal(w.items.TicketHistory[0].fields.Action, 'close');
  await send(w, postbackEv(actionData(acts[1])));
  assert.match(lastReply(w).text, /ไปแล้ว/);
  assert.equal(t4.Status, 'Closed');
});

test('overdue list shows days late', async () => {
  const w = summaryWorld();
  await send(w, postbackEv({ a: 'list', k: 'overdue', p: 0 }));
  assert.match(lastReply(w).text, /T-1 คุณเอ · งาน 1 · เลย 2 วัน/);
});

test('daily summary pushes to the CEO and skips holidays', async () => {
  const w = summaryWorld();
  const r = await lib.dailySummary(w.ctx);
  assert.equal(r.sent, true);
  assert.equal(w.calls.pushes[0].to, CEO);
  assert.match(w.calls.pushes[0].messages[0].text, /☀️ สรุปงาน จันทร์ 19 ต.ค./);
  const h = summaryWorld({ holidays: ['2026-10-19'] });
  assert.equal((await lib.dailySummary(h.ctx)).skipped, 'holiday');
  assert.equal(h.calls.pushes.length, 0);
});

test('weekly summary lists people ordered by overdue', async () => {
  const w = summaryWorld({ now: new Date('2026-10-23T10:00:00Z') }); // Fri 17:00 Bangkok
  await lib.weeklySummary(w.ctx);
  const text = w.calls.pushes[0].messages[0].text;
  const lines = text.split('\n');
  assert.match(lines[0], /สรุปรายคน จันทร์ 19 ต.ค. – ศุกร์ 23 ต.ค./);
  assert.match(lines[1], /^• คุณเอ \(Sales\): สั่ง 2 · ปิด 0 · เปิด 2 · 🔴 2/);
  assert.ok(lines.some((l) => /คุณมะลิ.*ปิด 1.*เฉลี่ย 2.0 วัน/.test(l)));
});

test('long messages are chunked under the LINE limit', () => {
  const chunks = lib.chunkMessages('H', Array.from({ length: 300 }, (_, i) => `บรรทัด ${i} ${'ก'.repeat(30)}`), 4900);
  assert.ok(chunks.length > 1);
  for (const c of chunks) assert.ok(Array.from(c).length <= 4900);
});

// ---------- built workflow runs as an n8n Code node ----------
test('built workflow code runs in a simulated n8n Code node', async () => {
  const wfPath = path.join(__dirname, '..', 'ceo-line-bot.json');
  const wf = JSON.parse(fs.readFileSync(wfPath, 'utf8'));
  const node = wf.nodes.find((n) => n.name === 'Handle LINE events');
  const w = fakeWorld();
  const { raw, headers } = signed([textEv('งานจาก n8n')]);
  const staticData = {};
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const fn = new AsyncFunction('$input', '$vars', '$getWorkflowStaticData', node.parameters.jsCode);
  const self = { helpers: { httpRequest: w.ctx.http, getBinaryDataBuffer: async () => raw } };
  const out = await fn.call(self, { first: () => ({ json: { headers }, binary: { data: {} } }) }, SETTINGS, () => staticData);
  assert.equal(out[0].json.ok, true);
  assert.ok(staticData.drafts && Object.keys(staticData.drafts).length === 1);
  assert.match(lastReply(w).text, /งานจาก n8n/);
  assert.deepEqual(Object.keys(wf.connections).sort(), ['Check SharePoint call', 'Friday 17:00', 'LINE Webhook', 'Respond to SharePoint', 'SharePoint Webhook', 'Weekdays 07:00']);
});

test('on n8n Cloud Starter the code reads secrets from the Settings node', async () => {
  const wf = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'ceo-line-bot.json'), 'utf8'));
  const settingsNode = wf.nodes.find((n) => n.name === 'Settings');
  const names = settingsNode.parameters.assignments.assignments.map((a) => a.name);
  assert.deepEqual(names.sort(), Object.keys(SETTINGS).sort());
  assert.equal(Object.keys(wf.connections).includes('Settings'), false); // never runs
  // fill it in as the user would in the editor
  for (const a of settingsNode.parameters.assignments.assignments) a.value = SETTINGS[a.name];
  const node = wf.nodes.find((n) => n.name === 'Handle LINE events');
  const w = fakeWorld();
  const { raw, headers } = signed([textEv('งานจาก Cloud')]);
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const fn = new AsyncFunction('$input', '$vars', '$getWorkflowStaticData', '$', node.parameters.jsCode);
  const $ = (name) => {
    const n = wf.nodes.find((x) => x.name === name);
    if (!n) throw new Error("Referenced node doesn't exist");
    return { params: n.parameters };
  };
  const self = { helpers: { httpRequest: w.ctx.http, getBinaryDataBuffer: async () => raw } };
  const out = await fn.call(self, { first: () => ({ json: { headers }, binary: { data: {} } }) }, undefined, () => ({}), $);
  assert.equal(out[0].json.ok, true);
  assert.match(lastReply(w).text, /งานจาก Cloud/);

  const upd = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'ceo-line-bot-update.json'), 'utf8'));
  assert.equal(upd.nodes.some((n) => n.name === 'Settings' || n.name === 'Settings warning'), false);
  assert.equal(upd.nodes.length, wf.nodes.length - 2);
});

// ---------- staff updates -> CEO, and CEO replies ----------
function staffHistory(world, ticketId, action, comment, pending = true) {
  const row = { id: String(900 + world.items.TicketHistory.length), createdDateTime: '2026-10-19T03:00:00Z',
    fields: { Title: `T-${ticketId}`, TicketID: ticketId, Action: action, Comment: comment, Source: 'App', Processed: true, CEOPending: pending } };
  world.items.TicketHistory.push(row);
  return row;
}

test('SharePoint webhook: echoes validation token and checks clientState', () => {
  const w = fakeWorld();
  assert.deepEqual(lib.checkSharePointCall(w.ctx, { validationtoken: 'abc' }, {}), { respond: 'abc', process: false });
  assert.equal(lib.checkSharePointCall(w.ctx, {}, { value: [{ clientState: 'sp-state-secret' }] }).process, true);
  assert.equal(lib.checkSharePointCall(w.ctx, {}, { value: [{ clientState: 'forged' }] }).process, false);
  assert.equal(lib.checkSharePointCall(w.ctx, {}, {}).process, false);
});

test('staff question and done are pushed to the CEO once, with action buttons', async () => {
  const w = summaryWorld();
  staffHistory(w, 3, 'wait', 'ลูกค้าขอส่วนลด 10% ได้ไหม');
  staffHistory(w, 4, 'done', 'ส่งแล้ว');
  staffHistory(w, 1, 'ack', null, false);
  const r = await lib.notifyCeoOfStaffUpdates(w.ctx);
  assert.equal(r.sent, 2);
  const [q, d] = w.calls.pushes.map((p) => p.messages[0]);
  assert.match(q.text, /⏳ คุณปิ รอคำตอบจากคุณ\nT-3 งาน 3\n💬 ลูกค้าขอส่วนลด 10% ได้ไหม/);
  assert.deepEqual(quick(q).map((a) => a.label), ['💬 ตอบ']);
  assert.match(d.text, /✅ คุณปิ ทำเสร็จแล้ว รอคุณตรวจ/);
  assert.deepEqual(quick(d).map((a) => a.label), ['✅ ผ่าน ปิดงาน', '❌ ไม่ผ่าน ส่งกลับ', '💬 ตอบ']);
  assert.ok(w.items.TicketHistory.every((h) => h.fields.CEOPending !== true));
  assert.equal((await lib.notifyCeoOfStaffUpdates(w.ctx)).sent, 0);
});

test('files uploaded from the app reach the CEO with a link to the ticket folder', async () => {
  const w = summaryWorld();
  w.items.Tickets.find((t) => t.id === '4').fields.HasFiles = true;
  staffHistory(w, 4, 'comment', '📎 แนบไฟล์: 20261025-1630-รายงาน.xlsx');
  staffHistory(w, 3, 'comment', 'ความเห็นธรรมดา');
  await lib.notifyCeoOfStaffUpdates(w.ctx);
  const [f, c] = w.calls.pushes.map((p) => p.messages[0].text);
  assert.match(f, /💬 📎 แนบไฟล์: 20261025-1630-รายงาน\.xlsx\n📂 เปิดไฟล์งาน: https:\/\/digitalfocusth\.sharepoint\.com\/sites\/CEO-Tickets\/TicketFiles\/Forms\/AllItems\.aspx\?id=%2Fsites%2FCEO-Tickets%2FTicketFiles%2FT-4$/);
  assert.doesNotMatch(c, /📂/);
});

test('falls back to a full scan when the filter query is rejected', async () => {
  const w = summaryWorld({ filterFails: true });
  staffHistory(w, 3, 'comment', 'อัปเดตครับ');
  assert.equal((await lib.notifyCeoOfStaffUpdates(w.ctx)).sent, 1);
  assert.match(w.calls.pushes[0].messages[0].text, /💬 คุณปิ เรื่อง T-3/);
});

test('CEO answers a question from LINE: status back to InProgress, history for the flow', async () => {
  const w = summaryWorld();
  await send(w, postbackEv({ a: 'replyto', t: 3 }));
  assert.match(lastReply(w).text, /คำตอบถึงคุณปิ \(T-3\)/);
  await send(w, textEv('ให้ได้ไม่เกิน 5%'));
  const t3 = w.items.Tickets.find((t) => t.id === '3').fields;
  assert.equal(t3.Status, 'InProgress');
  const h = w.items.TicketHistory[w.items.TicketHistory.length - 1].fields;
  assert.deepEqual([h.Action, h.Comment, h.Source, h.Processed, h.FromStatus, h.ToStatus], ['reply', 'ให้ได้ไม่เกิน 5%', 'LINE', false, 'WaitingCEO', 'InProgress']);
  assert.match(lastReply(w).text, /ส่งคำตอบให้คุณปิแล้ว/);
  assert.equal(w.items.Tickets.length, 6); // the reply did not become a new task
  await send(w, textEv('งานใหม่หลังตอบ'));
  assert.match(lastReply(w).text, /สั่งใคร/);
});

test('reject sends the task back and the next text becomes the reason for the assignee', async () => {
  const w = summaryWorld();
  const before = w.items.Tickets.length;
  await send(w, postbackEv({ a: 'reopen', t: 4, s: 'Done' }));
  const t4 = w.items.Tickets.find((t) => t.id === '4').fields;
  assert.equal(t4.Status, 'InProgress');
  let msg = lastReply(w);
  assert.match(msg.text, /^❌ ไม่ผ่าน ส่ง T-4 กลับให้.*\nพิมพ์หรือพูดสิ่งที่ต้องแก้/);
  assert.equal(quick(msg)[0].label, 'ไม่ต้องบอกเหตุผล');
  await send(w, textEv('ตัวเลขยอดขายไม่ตรงกับ SAP แก้แล้วส่งใหม่'));
  const h = w.items.TicketHistory.map((i) => i.fields);
  assert.deepEqual(h.map((f) => [f.Action, f.Comment]), [['reopen', undefined], ['comment', 'ตัวเลขยอดขายไม่ตรงกับ SAP แก้แล้วส่งใหม่']]);
  assert.match(lastReply(w).text, /^✅ ส่งสิ่งที่ต้องแก้ให้/);
  assert.equal(w.items.Tickets.length, before); // the reason did not become a new task
});

test('reply on a task that is not waiting becomes a comment; cancel works', async () => {
  const w = summaryWorld();
  await send(w, postbackEv({ a: 'replyto', t: 1 }));
  await send(w, textEv('เร่งหน่อยนะ'));
  const h = w.items.TicketHistory[w.items.TicketHistory.length - 1].fields;
  assert.equal(h.Action, 'comment');
  assert.equal(w.items.Tickets.find((t) => t.id === '1').fields.Status, 'InProgress');
  await send(w, postbackEv({ a: 'replyto', t: 2 }));
  await send(w, textEv('ยกเลิก'));
  assert.match(lastReply(w).text, /ยกเลิกการตอบ T-2/);
  await send(w, postbackEv({ a: 'replyto', t: 6 }));
  assert.match(lastReply(w).text, /ปิดไปแล้ว/);
});

test('built workflow wires the SharePoint webhook chain', () => {
  const wf = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'ceo-line-bot.json'), 'utf8'));
  assert.equal(wf.connections['SharePoint Webhook'].main[0][0].node, 'Check SharePoint call');
  assert.equal(wf.connections['Check SharePoint call'].main[0][0].node, 'Respond to SharePoint');
  assert.equal(wf.connections['Respond to SharePoint'].main[0][0].node, 'Notify CEO of staff updates');
  const hook = wf.nodes.find((n) => n.name === 'SharePoint Webhook');
  assert.equal(hook.parameters.responseMode, 'responseNode');
});
