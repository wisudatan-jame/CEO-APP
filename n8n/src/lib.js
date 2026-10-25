// ===== CEO LINE Bot: shared logic (embedded into every n8n Code node by build.js) =====
// ctx = { http(opts), setting(name), store, now() }
//   http    -> this.helpers.httpRequest in n8n
//   setting -> secrets from n8n Variables / environment variables
//   store   -> $getWorkflowStaticData('global') (persists only for active workflows)

const TZ_OFFSET_MS = 7 * 3600 * 1000; // Asia/Bangkok, no DST
const DRAFT_TTL_MS = 30 * 60 * 1000;
const APPEND_WINDOW_MS = 60 * 1000; // forwarded messages arriving together become details
const SEEN_TTL_MS = 24 * 3600 * 1000;
const PENDING_IMAGES_TTL_MS = 10 * 60 * 1000; // photos sent before the task text wait this long for it
const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_IMAGES = 5;
const MAX_QUICK_PEOPLE = 8;
const PAGE_SIZE = 10;
const DONE_PAGE_SIZE = 5;
const GRAPH = 'https://graph.microsoft.com/v1.0';
const LINE_API = 'https://api.line.me/v2/bot';
const LINE_DATA_API = 'https://api-data.line.me/v2/bot';

// ---------- SHA-256 / HMAC (pure JS, so the Code node needs no require('crypto')) ----------
const K256 = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

function sha256(msg) {
  const len = msg.length;
  const total = Math.ceil((len + 9) / 64) * 64;
  const buf = new Uint8Array(total);
  buf.set(msg);
  buf[len] = 0x80;
  const dv = new DataView(buf.buffer);
  dv.setUint32(total - 8, Math.floor(len / 0x20000000));
  dv.setUint32(total - 4, (len << 3) >>> 0);
  const h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const w = new Uint32Array(64);
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  for (let off = 0; off < total; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const t1 = (hh + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K256[i] + w[i]) >>> 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h[0] = (h[0] + a) >>> 0; h[1] = (h[1] + b) >>> 0; h[2] = (h[2] + c) >>> 0; h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0; h[5] = (h[5] + f) >>> 0; h[6] = (h[6] + g) >>> 0; h[7] = (h[7] + hh) >>> 0;
  }
  const out = new Uint8Array(32);
  const odv = new DataView(out.buffer);
  h.forEach((v, i) => odv.setUint32(i * 4, v));
  return out;
}

function hmacSha256(key, msg) {
  if (key.length > 64) key = sha256(key);
  const k = new Uint8Array(64);
  k.set(key);
  const inner = new Uint8Array(64 + msg.length);
  const outer = new Uint8Array(64 + 32);
  for (let i = 0; i < 64; i++) {
    inner[i] = k[i] ^ 0x36;
    outer[i] = k[i] ^ 0x5c;
  }
  inner.set(msg, 64);
  outer.set(sha256(inner), 64);
  return sha256(outer);
}

function verifyLineSignature(secret, raw, signature) {
  if (!raw || !signature) return false;
  const expected = Buffer.from(hmacSha256(new Uint8Array(Buffer.from(secret, 'utf8')), new Uint8Array(raw))).toString('base64');
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

// ---------- Dates (all business dates are Bangkok YYYY-MM-DD strings) ----------
const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const TH_DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
const pad2 = (n) => String(n).padStart(2, '0');

function bkkYmd(instant) {
  const t = new Date(instant.getTime() + TZ_OFFSET_MS);
  return `${t.getUTCFullYear()}-${pad2(t.getUTCMonth() + 1)}-${pad2(t.getUTCDate())}`;
}
function ymdParts(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  return { y, m, d };
}
function addDays(ymd, n) {
  const { y, m, d } = ymdParts(ymd);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
function dayOfWeek(ymd) {
  const { y, m, d } = ymdParts(ymd);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}
// Same rule as the Power Apps button: this Friday; on Sat/Sun the next Friday
function fridayOf(ymd) {
  const w = dayOfWeek(ymd) || 7;
  return addDays(ymd, (5 - w + 7) % 7);
}
function mondayOf(ymd) {
  const w = dayOfWeek(ymd) || 7;
  return addDays(ymd, -(w - 1));
}
function bkkStartInstant(ymd) {
  const { y, m, d } = ymdParts(ymd);
  return new Date(Date.UTC(y, m - 1, d) - TZ_OFFSET_MS);
}
// SharePoint date-only values come back either as "YYYY-MM-DD" or as an instant
// (often 17:00Z of the previous day for a Bangkok site). Normalise to the Bangkok date.
function spDate(value) {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return bkkYmd(new Date(value));
}
function thaiDate(ymd) {
  const { m, d } = ymdParts(ymd);
  return `${TH_DAYS[dayOfWeek(ymd)]} ${d} ${TH_MONTHS[m - 1]}`;
}
function daysBetween(fromYmd, toYmd) {
  const a = ymdParts(fromYmd);
  const b = ymdParts(toYmd);
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86400000);
}

// ---------- Small helpers ----------
function chars(s) {
  return Array.from(String(s || ''));
}
function truncate(s, max) {
  const c = chars(s);
  return c.length <= max ? c.join('') : c.slice(0, max - 1).join('') + '…';
}
function encodeData(obj) {
  return Object.keys(obj).map((k) => `${k}=${encodeURIComponent(obj[k])}`).join('&');
}
function decodeData(str) {
  const out = {};
  for (const part of String(str || '').split('&')) {
    if (!part) continue;
    const i = part.indexOf('=');
    const k = i < 0 ? part : part.slice(0, i);
    out[k] = i < 0 ? '' : decodeURIComponent(part.slice(i + 1));
  }
  return out;
}
function parseJson(res) {
  if (typeof res === 'string') return res ? JSON.parse(res) : {};
  if (res && typeof res === 'object' && !Buffer.isBuffer(res)) return res;
  return {};
}
function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
const lower = (s) => String(s || '').trim().toLowerCase();

const STATUS_TH = {
  New: 'ใหม่',
  Acknowledged: 'รับทราบ',
  InProgress: 'กำลังทำ',
  WaitingCEO: 'รอคุณตอบ',
  Done: 'เสร็จ รอปิด',
  Closed: 'ปิดแล้ว',
};

// ---------- Microsoft Graph ----------
async function graphToken(ctx) {
  const st = ctx.store;
  const nowMs = ctx.now().getTime();
  if (st.graphToken && st.graphToken.exp > nowMs + 60000) return st.graphToken.token;
  const body = [
    `client_id=${encodeURIComponent(ctx.setting('MS_CLIENT_ID'))}`,
    `client_secret=${encodeURIComponent(ctx.setting('MS_CLIENT_SECRET'))}`,
    `scope=${encodeURIComponent('https://graph.microsoft.com/.default')}`,
    'grant_type=client_credentials',
  ].join('&');
  const res = parseJson(await ctx.http({
    method: 'POST',
    url: `https://login.microsoftonline.com/${ctx.setting('MS_TENANT_ID')}/oauth2/v2.0/token`,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  }));
  if (!res.access_token) throw new Error('ขอ Token ของ Microsoft Graph ไม่สำเร็จ');
  st.graphToken = { token: res.access_token, exp: nowMs + (res.expires_in || 3600) * 1000 };
  return res.access_token;
}

async function graph(ctx, method, path, body, extra) {
  const token = await graphToken(ctx);
  const headers = Object.assign({ Authorization: `Bearer ${token}` }, (extra && extra.headers) || {});
  // Binary uploads must not be JSON-encoded by n8n's httpRequest
  const json = !(extra && extra.raw);
  const opts = { method, url: path.startsWith('http') ? path : GRAPH + path, headers, json };
  if (body !== undefined) {
    opts.body = body;
    if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';
  }
  return parseJson(await ctx.http(opts));
}

async function siteId(ctx) {
  const st = ctx.store;
  if (st.siteId) return st.siteId;
  const res = await graph(ctx, 'GET', `/sites/${ctx.setting('SP_HOSTNAME')}:${ctx.setting('SP_SITE_PATH')}`);
  st.siteId = res.id;
  return res.id;
}

async function listItems(ctx, list) {
  const sid = await siteId(ctx);
  let url = `/sites/${sid}/lists/${list}/items?expand=fields&$top=500`;
  const out = [];
  while (url) {
    const res = await graph(ctx, 'GET', url);
    for (const it of res.value || []) {
      out.push({ id: Number(it.id), created: it.createdDateTime, fields: it.fields || {} });
    }
    url = res['@odata.nextLink'] || null;
  }
  return out;
}

async function createItem(ctx, list, fields) {
  const sid = await siteId(ctx);
  const res = await graph(ctx, 'POST', `/sites/${sid}/lists/${list}/items`, { fields });
  return Number(res.id);
}

async function getItem(ctx, list, id) {
  const sid = await siteId(ctx);
  const res = await graph(ctx, 'GET', `/sites/${sid}/lists/${list}/items/${id}?expand=fields`);
  return { id: Number(res.id), created: res.createdDateTime, fields: res.fields || {} };
}

async function updateFields(ctx, list, id, fields) {
  const sid = await siteId(ctx);
  return graph(ctx, 'PATCH', `/sites/${sid}/lists/${list}/items/${id}/fields`, fields);
}

async function uploadFile(ctx, folder, name, buffer, contentType) {
  const st = ctx.store;
  if (!st.filesDriveId) {
    const sid = await siteId(ctx);
    st.filesDriveId = (await graph(ctx, 'GET', `/sites/${sid}/lists/TicketFiles/drive`)).id;
  }
  return graph(ctx, 'PUT', `/drives/${st.filesDriveId}/root:/${folder}/${name}:/content`, buffer, {
    headers: { 'Content-Type': contentType },
    raw: true,
  });
}

async function cached(ctx, key, loader) {
  const st = ctx.store;
  st.cache = st.cache || {};
  const hit = st.cache[key];
  const nowMs = ctx.now().getTime();
  if (hit && nowMs - hit.at < CACHE_TTL_MS) return hit.value;
  const value = await loader();
  st.cache[key] = { at: nowMs, value };
  return value;
}

async function getConfig(ctx) {
  return cached(ctx, 'config', async () => {
    const map = {};
    for (const it of await listItems(ctx, 'Config')) map[it.fields.Title] = it.fields.Value;
    return map;
  });
}

async function getEmployees(ctx) {
  return cached(ctx, 'employees', async () => (await listItems(ctx, 'Employees'))
    .map((it) => ({
      email: lower(it.fields.Email),
      full: it.fields.Title || '',
      first: it.fields.FirstName || '',
      last: it.fields.LastName || '',
      nick: it.fields.Nickname || '',
      aliases: String(it.fields.Aliases || '').split(',').map((s) => s.trim()).filter(Boolean),
      dept: it.fields.Department || '',
      active: it.fields.Active !== false,
    }))
    .filter((e) => e.email));
}

async function getHolidays(ctx) {
  return cached(ctx, 'holidays', async () => (await listItems(ctx, 'Holidays'))
    .map((it) => spDate(it.fields.Date))
    .filter(Boolean));
}

async function getTickets(ctx) {
  return (await listItems(ctx, 'Tickets')).map((it) => ({
    id: it.id,
    created: it.created,
    title: it.fields.Title || '',
    assignee: lower(it.fields.AssigneeEmail),
    due: spDate(it.fields.DueDate),
    status: it.fields.Status,
    isOpen: it.fields.IsOpen === true,
    closedAt: it.fields.ClosedAt || null,
  }));
}

function personName(emp, email) {
  if (!emp) return email;
  return emp.nick ? `คุณ${emp.nick}` : `คุณ${emp.first || emp.full}`;
}
function personLabel(emp) {
  const name = emp.nick || emp.first || emp.full;
  return truncate(emp.dept ? `${name} (${emp.dept})` : name, 20);
}

// ---------- LINE ----------
function lineHeaders(ctx) {
  return { Authorization: `Bearer ${ctx.setting('LINE_CHANNEL_ACCESS_TOKEN')}`, 'Content-Type': 'application/json' };
}
function textMsg(text, quickItems) {
  const msg = { type: 'text', text: truncate(text, 5000) };
  if (quickItems && quickItems.length) msg.quickReply = { items: quickItems.slice(0, 13) };
  return msg;
}
function qrPostback(label, data, displayText) {
  const action = { type: 'postback', label: truncate(label, 20), data: encodeData(data) };
  if (displayText) action.displayText = truncate(displayText, 300);
  return { type: 'action', action };
}
function qrDatePicker(label, data, initial, min) {
  return { type: 'action', action: { type: 'datetimepicker', label: truncate(label, 20), data: encodeData(data), mode: 'date', initial, min } };
}

async function linePush(ctx, to, messages) {
  return ctx.http({ method: 'POST', url: `${LINE_API}/message/push`, headers: lineHeaders(ctx), body: { to, messages: messages.slice(0, 5) }, json: true });
}

// Reply is free; fall back to push when the reply token has expired.
async function lineReply(ctx, ev, messages) {
  if (!Array.isArray(messages)) messages = [messages];
  if (ev.replyToken) {
    try {
      return await ctx.http({ method: 'POST', url: `${LINE_API}/message/reply`, headers: lineHeaders(ctx), body: { replyToken: ev.replyToken, messages: messages.slice(0, 5) }, json: true });
    } catch (e) {
      // fall through to push
    }
  }
  return linePush(ctx, ev.source.userId, messages);
}

async function lineContent(ctx, messageId) {
  const res = await ctx.http({
    method: 'GET',
    url: `${LINE_DATA_API}/message/${messageId}/content`,
    headers: { Authorization: `Bearer ${ctx.setting('LINE_CHANNEL_ACCESS_TOKEN')}` },
    encoding: 'arraybuffer',
  });
  return Buffer.from(res);
}

// ---------- Webhook entry ----------
async function handleWebhook(ctx, raw, headers) {
  const sig = headers['x-line-signature'] || headers['X-Line-Signature'];
  if (!verifyLineSignature(ctx.setting('LINE_CHANNEL_SECRET'), raw, sig)) {
    return { ok: false, reason: 'bad-signature' };
  }
  const body = JSON.parse(Buffer.from(raw).toString('utf8'));
  const results = [];
  const errors = [];
  const events = body.events || [];
  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    // Several texts in one delivery (e.g. forwarded together): answer only the last one.
    ev.moreText = isText(events[i + 1]) && isText(ev) && events[i + 1].source.userId === ev.source.userId;
    try {
      results.push(await handleEvent(ctx, ev));
    } catch (e) {
      errors.push(e);
      results.push({ type: ev.type, error: String((e && e.message) || e) });
      try {
        await lineReply(ctx, ev, textMsg('❗ ระบบขัดข้อง คำสั่งนี้อาจยังไม่ถูกบันทึก กรุณาลองใหม่ หรือสั่งงานผ่านแอป Power Apps'));
      } catch (ignored) {
        // nothing more we can do; the failed execution alerts the admin
      }
    }
  }
  if (errors.length) {
    throw new Error(`CEO LINE Bot: ${errors.length} event(s) failed: ${results.filter((r) => r.error).map((r) => r.error).join(' | ')}`);
  }
  return { ok: true, results };
}

function isText(ev) {
  return !!(ev && ev.type === 'message' && ev.message && ev.message.type === 'text' && ev.source);
}

function alreadySeen(ctx, eventId) {
  if (!eventId) return false;
  const st = ctx.store;
  const nowMs = ctx.now().getTime();
  st.seen = st.seen || {};
  for (const k of Object.keys(st.seen)) if (nowMs - st.seen[k] > SEEN_TTL_MS) delete st.seen[k];
  if (st.seen[eventId]) return true;
  st.seen[eventId] = nowMs;
  return false;
}

async function handleEvent(ctx, ev) {
  if (!ev.source || ev.source.type !== 'user') return { skipped: 'not-1on1-chat' };
  if (alreadySeen(ctx, ev.webhookEventId)) return { skipped: 'duplicate' };
  const userId = ev.source.userId;
  const cfg = await getConfig(ctx);
  if (!cfg.CEO_LINE_USER_ID) {
    // Setup mode: tell whoever writes in their LINE user ID so it can be put into Config.
    if (ev.type === 'message' || ev.type === 'follow') {
      await lineReply(ctx, ev, textMsg(`โหมดตั้งค่า\nLINE user ID ของคุณคือ:\n${userId}\n\nนำค่านี้ไปใส่ใน List Config → CEO_LINE_USER_ID`));
    }
    return { setup: true, userId };
  }
  if (userId !== cfg.CEO_LINE_USER_ID) return { ignored: 'not-ceo', userId };

  if (ev.type === 'message') return onMessage(ctx, ev, cfg);
  if (ev.type === 'postback') return onPostback(ctx, ev, cfg);
  if (ev.type === 'follow') {
    await lineReply(ctx, ev, textMsg(helpText()));
    return { follow: true };
  }
  return { skipped: ev.type };
}

function helpText() {
  return [
    'วิธีสั่งงาน',
    '1) กดไมค์บนแป้นพิมพ์ แล้วพูดชื่องาน ตรวจข้อความแล้วกดส่ง',
    '2) แตะหรือพูดชื่อผู้รับผิดชอบ เช่น "สั่งแตนบัญชี"',
    '3) แตะหรือพูดวันส่ง เช่น "พรุ่งนี้" "ศุกร์นี้"',
    '',
    'ส่งรูปก่อนหรือหลังข้อความชื่องานก็ได้ (ก่อนเลือกวันส่ง)',
    'ส่งทีละข้อความ รอบอทตอบก่อนส่งข้อความถัดไป',
    'พิมพ์ "สรุป" เพื่อดูภาพรวม · "ยกเลิก" เพื่อยกเลิกงานที่กำลังสร้าง',
    'พิมพ์ "โอนงาน" เพื่อโอนงานของคนที่ลาออกให้คนอื่น',
  ].join('\n');
}

function drafts(ctx) {
  ctx.store.drafts = ctx.store.drafts || {};
  return ctx.store.drafts;
}
function takePendingImages(ctx, userId, nowMs) {
  const all = ctx.store.pendingImages || {};
  const p = all[userId];
  delete all[userId];
  return p && nowMs - p.at < PENDING_IMAGES_TTL_MS ? p.ids : [];
}
function currentDraft(ctx, userId) {
  const d = drafts(ctx)[userId];
  if (d && ctx.now().getTime() - d.createdAt > DRAFT_TTL_MS) {
    delete drafts(ctx)[userId];
    return null;
  }
  return d || null;
}

async function onMessage(ctx, ev, cfg) {
  const userId = ev.source.userId;
  const m = ev.message;
  const nowMs = ctx.now().getTime();
  let dr = currentDraft(ctx, userId);

  if (m.type === 'text') {
    const t = String(m.text || '').trim();
    if (!t) return { skipped: 'empty' };
    if (t === 'สรุป') return replySummary(ctx, ev, cfg);
    const pendingReply = currentReply(ctx);
    const transfer = currentTransfer(ctx);
    if (t === 'ยกเลิก' && transfer) {
      delete ctx.store.transfer;
      await lineReply(ctx, ev, textMsg('ยกเลิกการโอนงานแล้ว'));
      return { transferCancelled: transfer.id };
    }
    if (/^โอนงาน/.test(t)) return onTransferCommand(ctx, ev, t.replace(/^โอนงาน(ของ)?\s*/, '').trim());
    if (transfer) {
      const picked = await onTransferTo(ctx, ev, transfer, t);
      if (picked) return picked;
    }
    if (t === 'ยกเลิก' && pendingReply) {
      delete ctx.store.replyTo;
      await lineReply(ctx, ev, textMsg(`ยกเลิกการตอบ T-${pendingReply.ticketId} แล้ว`));
      return { replyCancelled: pendingReply.ticketId };
    }
    if (t === 'ยกเลิก') {
      if (dr) delete drafts(ctx)[userId];
      takePendingImages(ctx, userId, nowMs);
      await lineReply(ctx, ev, textMsg(dr ? `ยกเลิกแล้ว: "${truncate(dr.title, 60)}"` : 'ไม่มีงานที่กำลังสร้าง'));
      return { cancelled: !!dr };
    }
    if (/^(ช่วย|วิธีใช้|help)$/i.test(t)) {
      await lineReply(ctx, ev, textMsg(helpText()));
      return { help: true };
    }
    if (pendingReply) return sendReply(ctx, ev, cfg, pendingReply, t);
    if (dr && dr.stage === 'search') return onSearch(ctx, ev, dr, t);
    if (dr && dr.stage === 'who') {
      const picked = await onTypedWho(ctx, ev, dr, t);
      if (picked) return picked;
      if (nowMs - dr.lastTextAt < APPEND_WINDOW_MS) {
        dr.details.push(t);
        dr.lastTextAt = nowMs;
        // Quick-reply buttons vanish once the CEO sends anything, so offer them again.
        if (!ev.moreText) await askWho(ctx, ev, dr, `➕ เพิ่มเป็นรายละเอียดงานแล้ว (${dr.details.length} ข้อความ)\n\n`);
        return { appended: dr.id };
      }
    }
    if (dr && dr.stage === 'when') {
      const date = parseDueText(t, bkkYmd(ctx.now()));
      if (date) return createTicketFromDraft(ctx, ev, cfg, dr, date);
      if (/^ส่ง/.test(t) && chars(t).length <= 20) {
        const emp = (await getEmployees(ctx)).find((e) => e.email === dr.assignee);
        return askWhen(ctx, ev, dr, emp, `ไม่เข้าใจวันส่ง "${truncate(t, 20)}" แตะปุ่มหรือ 📅 เลือกวัน\n\n`);
      }
    }
    let notice = '';
    if (dr) notice = `ยกเลิกงานก่อนหน้า: "${truncate(dr.title, 60)}"\n\n`;
    const title = truncate(t.replace(/\s+/g, ' '), 255);
    dr = {
      id: newId(),
      title,
      details: chars(t).length > 255 ? [t] : [],
      images: takePendingImages(ctx, userId, nowMs),
      assignee: null,
      stage: 'who',
      createdAt: nowMs,
      lastTextAt: nowMs,
    };
    drafts(ctx)[userId] = dr;
    delete ctx.store.transfer; // a new task ends any half-finished transfer
    if (dr.images.length) notice += `📎 แนบรูปที่ส่งไว้ ${dr.images.length} รูป\n`;
    if (ev.moreText && !notice) return { draft: dr.id, stage: 'who' };
    return askWho(ctx, ev, dr, notice);
  }

  if (m.type === 'image') {
    const isLastOfSet = !m.imageSet || m.imageSet.index === m.imageSet.total;
    if (!dr) {
      // Photo first, text after: keep the photos for the next task.
      const all = (ctx.store.pendingImages = ctx.store.pendingImages || {});
      const p = all[userId] && nowMs - all[userId].at < PENDING_IMAGES_TTL_MS ? all[userId] : { ids: [] };
      if (p.ids.length >= MAX_IMAGES) {
        if (isLastOfSet) await lineReply(ctx, ev, textMsg(`แนบรูปได้สูงสุด ${MAX_IMAGES} รูปต่องาน`));
        return { image: 'limit' };
      }
      p.ids.push(m.id);
      p.at = nowMs;
      all[userId] = p;
      if (isLastOfSet) {
        const last = ctx.store.lastCreated;
        const justMade = last && last.at && nowMs - last.at < PENDING_IMAGES_TTL_MS ? `งาน T-${last.ticketId} สร้างไปแล้ว รูปนี้จะไม่แนบกับ T-${last.ticketId}\n` : '';
        await lineReply(ctx, ev, textMsg(`📎 รับรูปแล้ว (${p.ids.length} รูป)\n${justMade}พิมพ์หรือพูดชื่องานต่อได้เลย รูปจะแนบกับงานที่สั่งภายใน 10 นาที`));
      }
      return { image: 'pending', count: p.ids.length };
    }
    if (dr.images.length >= MAX_IMAGES) {
      if (isLastOfSet) await lineReply(ctx, ev, textMsg(`แนบรูปได้สูงสุด ${MAX_IMAGES} รูปต่องาน`));
      return { image: 'limit' };
    }
    dr.images.push(m.id);
    if (isLastOfSet) await lineReply(ctx, ev, textMsg(`📎 แนบรูปแล้ว (${dr.images.length} รูป)`));
    return { image: 'attached', count: dr.images.length };
  }

  if (m.type === 'audio') {
    await lineReply(ctx, ev, textMsg('กรุณากดไมค์บนแป้นพิมพ์แทนการกดค้างไมค์ของ LINE\nแล้วตรวจข้อความก่อนกดส่ง'));
    return { audio: 'rejected' };
  }

  await lineReply(ctx, ev, textMsg('รับเฉพาะข้อความและรูปภาพ\nพิมพ์ "วิธีใช้" เพื่อดูวิธีสั่งงาน'));
  return { skipped: m.type };
}

async function quickPeople(ctx, cfg) {
  const employees = (await getEmployees(ctx)).filter((e) => e.active);
  const byEmail = new Map(employees.map((e) => [e.email, e]));
  const counts = await cached(ctx, 'frequent', async () => {
    const since = ctx.now().getTime() - 30 * 86400000;
    const c = {};
    for (const t of await getTickets(ctx)) {
      if (t.assignee && new Date(t.created).getTime() >= since) c[t.assignee] = (c[t.assignee] || 0) + 1;
    }
    return c;
  });
  const ordered = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  const fallback = String(cfg.QUICK_ASSIGNEES || '').split(',').map(lower).filter(Boolean);
  const out = [];
  for (const email of ordered.concat(fallback)) {
    const e = byEmail.get(email);
    if (e && !out.includes(e)) out.push(e);
    if (out.length >= MAX_QUICK_PEOPLE) break;
  }
  return out;
}

async function askWho(ctx, ev, dr, notice) {
  const people = await quickPeople(ctx, await getConfig(ctx));
  const items = people.map((e) => qrPostback(personLabel(e), { a: 'who', d: dr.id, e: e.email }, `สั่ง${personName(e)}`));
  items.push(qrPostback('🔍 คนอื่น', { a: 'search', d: dr.id }, 'คนอื่น'));
  items.push(qrPostback('❌ ยกเลิก', { a: 'cancel', d: dr.id }, 'ยกเลิก'));
  await lineReply(ctx, ev, textMsg(`${notice || ''}📝 "${truncate(dr.title, 120)}"\nสั่งใคร?`, items));
  return { draft: dr.id, stage: 'who' };
}

const ASSIGN_PREFIX = /^(สั่งงาน|สั่ง|มอบหมายให้|มอบให้|ให้)\s*/;
const HONORIFIC = /^(คุณ|พี่|น้อง|นางสาว|นาย|นาง)\s*/;
const DEPT_WORDS = [
  ['บัญชี', 'account'], ['การเงิน', 'finance'], ['การตลาด', 'marketing', 'มาร์เก็ตติ้ง'],
  ['hr', 'เอชอาร์', 'บุคคล'], ['pm', 'พีเอ็ม'], ['product', 'โปรดักส์', 'โปรดักท์', 'โปรดัก'],
  ['iot', 'ไอโอที'], ['ขาย', 'sales', 'เซลส์', 'เซล'],
];

function deptMatches(rest, dept) {
  const r = lower(rest).replace(/^(ฝ่าย|แผนก|ทีม)/, '').replace(/\s+/g, '');
  const d = lower(dept).replace(/\s+/g, '');
  if (chars(r).length < 2 || !d) return false;
  if (d.includes(r) || r.includes(d)) return true;
  return DEPT_WORDS.some((w) => w.some((x) => d.includes(x)) && w.some((x) => r.includes(x)));
}

// "สั่งแตนบัญชี" -> name "แตน" + department "บัญชี". Thai has no spaces, so match names as prefixes.
function findAssignee(employees, text) {
  let q = lower(text).replace(/\s+/g, ' ').trim();
  const explicit = ASSIGN_PREFIX.test(q);
  q = q.replace(ASSIGN_PREFIX, '').replace(HONORIFIC, '').trim();
  const all = [];
  for (const e of employees) {
    if (!e.active) continue;
    let best = null;
    for (const raw of [e.nick, e.first, e.full].concat(e.aliases)) {
      const n = lower(raw).replace(HONORIFIC, '').trim();
      if (n && q.startsWith(n) && (!best || chars(n).length > best.len)) best = { len: chars(n).length, rest: q.slice(n.length).trim() };
    }
    if (best) all.push(Object.assign({ e }, best));
  }
  // "เอกบัญชี" also starts with "เอ": only the longest name counts, so the leftover is really the department.
  const longest = Math.max(0, ...all.map((h) => h.len));
  const hits = all.filter((h) => h.len === longest);
  const withDept = hits.filter((h) => h.rest && deptMatches(h.rest, h.e.dept));
  if (withDept.length) return { people: withDept.map((h) => h.e), exact: true, explicit, query: q };
  const nameOnly = hits.filter((h) => !h.rest);
  if (nameOnly.length) return { people: nameOnly.map((h) => h.e), exact: true, explicit, query: q };
  if (explicit && hits.length) return { people: hits.map((h) => h.e), exact: false, explicit, query: q };
  return { people: [], exact: false, explicit, query: q };
}

async function offerPeople(ctx, ev, dr, people, text) {
  const items = people.slice(0, 11).map((e) => qrPostback(personLabel(e), { a: 'who', d: dr.id, e: e.email }, `สั่ง${personName(e)}`));
  items.push(qrPostback('❌ ยกเลิก', { a: 'cancel', d: dr.id }, 'ยกเลิก'));
  await lineReply(ctx, ev, textMsg(text, items));
  return { search: people.length };
}

// Name typed or spoken while the bot is asking "สั่งใคร?". Returns null when the text is not a name.
async function onTypedWho(ctx, ev, dr, t) {
  const r = findAssignee(await getEmployees(ctx), t);
  if (r.people.length === 1 && r.exact) {
    dr.assignee = r.people[0].email;
    dr.stage = 'when';
    return askWhen(ctx, ev, dr, r.people[0]);
  }
  if (r.people.length) {
    const text = r.exact ? `พบ ${r.people.length} คน เลือกคนที่ต้องการ` : `ไม่พบ "${truncate(r.query, 40)}" ตรงทุกคำ คนที่ชื่อใกล้เคียง:`;
    return offerPeople(ctx, ev, dr, r.people, text);
  }
  if (r.explicit) {
    await askWho(ctx, ev, dr, `ไม่พบชื่อ "${truncate(r.query, 40)}" ในรายชื่อพนักงาน แตะเลือกด้านล่าง หรือ 🔍 คนอื่น\n\n`);
    return { search: 'none' };
  }
  return null;
}

const THAI_DAYS = [['อาทิตย์'], ['จันทร์'], ['อังคาร'], ['พุธ'], ['พฤหัสบดี', 'พฤหัส'], ['ศุกร์'], ['เสาร์']];

// "พรุ่งนี้", "ส่งศุกร์นี้", "วันจันทร์หน้า" -> YYYY-MM-DD, or null.
function parseDueText(text, today) {
  const q = String(text).replace(/\s+/g, '').replace(/^(ส่ง|ภายใน|ก่อน)+/, '');
  const simple = { 'วันนี้': 0, 'พรุ่งนี้': 1, 'มะรืน': 2, 'มะรืนนี้': 2 };
  if (Object.prototype.hasOwnProperty.call(simple, q)) return addDays(today, simple[q]);
  const m = q.replace(/^วัน/, '').match(/^(.+?)(นี้|หน้า)?$/);
  if (!m) return null;
  const day = THAI_DAYS.findIndex((names) => names.includes(m[1]));
  if (day < 0) return null;
  if (m[2] === 'หน้า') return addDays(mondayOf(addDays(today, 7)), (day + 6) % 7);
  return addDays(today, (day - dayOfWeek(today) + 7) % 7);
}

function matchEmployees(employees, query) {
  const q = lower(query).replace(/^(คุณ|พี่|น้อง|นาย|นางสาว|นาง)\s*/, '');
  if (!q) return [];
  const exact = [];
  const partial = [];
  for (const e of employees) {
    if (!e.active) continue;
    const names = [e.nick, e.first, e.last, e.full].concat(e.aliases).map(lower).filter(Boolean);
    if (names.includes(q)) exact.push(e);
    else if (names.some((n) => n.includes(q))) partial.push(e);
  }
  return exact.length ? exact : partial;
}

async function onSearch(ctx, ev, dr, query) {
  const employees = await getEmployees(ctx);
  const r = findAssignee(employees, query);
  const found = (r.people.length ? r.people : matchEmployees(employees, query)).slice(0, 11);
  const cancel = qrPostback('❌ ยกเลิก', { a: 'cancel', d: dr.id }, 'ยกเลิก');
  if (!found.length) {
    await lineReply(ctx, ev, textMsg(`ไม่พบ "${truncate(query, 40)}" ลองพิมพ์หรือพูดชื่อเล่นหรือชื่อจริงอีกครั้ง`, [cancel]));
    return { search: 'none' };
  }
  const items = found.map((e) => qrPostback(personLabel(e), { a: 'who', d: dr.id, e: e.email }, `สั่ง${personName(e)}`));
  items.push(cancel);
  await lineReply(ctx, ev, textMsg(found.length === 1 ? 'ใช่คนนี้ไหม?' : `พบ ${found.length} คน เลือกคนที่ต้องการ`, items));
  return { search: found.length };
}

async function askWhen(ctx, ev, dr, emp, notice) {
  const today = bkkYmd(ctx.now());
  const tomorrow = addDays(today, 1);
  const friday = fridayOf(today);
  const items = [
    qrPostback('วันนี้', { a: 'when', d: dr.id, v: today }, 'ส่งวันนี้'),
    qrPostback('พรุ่งนี้', { a: 'when', d: dr.id, v: tomorrow }, 'ส่งพรุ่งนี้'),
  ];
  if (friday !== today && friday !== tomorrow) items.push(qrPostback('ศุกร์นี้', { a: 'when', d: dr.id, v: friday }, 'ส่งศุกร์นี้'));
  items.push(qrDatePicker('📅 เลือกวัน', { a: 'date', d: dr.id }, tomorrow, today));
  items.push(qrPostback('❌ ยกเลิก', { a: 'cancel', d: dr.id }, 'ยกเลิก'));
  await lineReply(ctx, ev, textMsg(`${notice || ''}👤 ${personName(emp, dr.assignee)}\nส่งเมื่อไร?`, items));
  return { draft: dr.id, stage: 'when' };
}

async function onPostback(ctx, ev, cfg) {
  const userId = ev.source.userId;
  const p = decodeData(ev.postback && ev.postback.data);
  if (p.a === 'sum') return replySummary(ctx, ev, cfg);
  if (p.a === 'list') return replyList(ctx, ev, p.k, Number(p.p || 0));
  if (p.a === 'close' || p.a === 'reopen') return changeStatus(ctx, ev, cfg, p.a, Number(p.t), p.s);
  if (p.a === 'replyto') return startReply(ctx, ev, Number(p.t));
  if (p.a === 'xfer') return startTransfer(ctx, ev, p.f);
  if (p.a === 'xcancel') {
    delete ctx.store.transfer;
    await lineReply(ctx, ev, textMsg('ยกเลิกการโอนงานแล้ว'));
    return { transferCancelled: true };
  }
  if (p.a === 'xto' || p.a === 'xgo') {
    const x = currentTransfer(ctx);
    if (!x || x.id !== p.x) {
      await lineReply(ctx, ev, textMsg('รายการโอนนี้ทำไปแล้วหรือหมดอายุ พิมพ์ "โอนงาน" เพื่อเริ่มใหม่'));
      return { transferExpired: p.x };
    }
    return p.a === 'xto' ? confirmTransfer(ctx, ev, x, p.e) : runTransfer(ctx, ev, cfg, x, p.e);
  }
  if (p.a === 'replycancel') {
    delete ctx.store.replyTo;
    await lineReply(ctx, ev, textMsg(`ยกเลิกการตอบ T-${p.t} แล้ว`));
    return { replyCancelled: Number(p.t) };
  }

  const dr = currentDraft(ctx, userId);
  if (!dr || dr.id !== p.d) {
    const last = ctx.store.lastCreated;
    if (last && last.draftId === p.d) {
      await lineReply(ctx, ev, textMsg(`งานนี้สร้างแล้ว: T-${last.ticketId}`));
      return { duplicateTap: last.ticketId };
    }
    await lineReply(ctx, ev, textMsg('ปุ่มนี้หมดอายุแล้ว ส่งข้อความชื่องานใหม่ได้เลย'));
    return { expired: p.d };
  }

  if (p.a === 'cancel') {
    delete drafts(ctx)[userId];
    await lineReply(ctx, ev, textMsg(`ยกเลิกแล้ว: "${truncate(dr.title, 60)}"`));
    return { cancelled: dr.id };
  }
  if (p.a === 'search') {
    dr.stage = 'search';
    await lineReply(ctx, ev, textMsg('พิมพ์หรือพูดชื่อเล่นหรือชื่อจริงของผู้รับผิดชอบ', [qrPostback('❌ ยกเลิก', { a: 'cancel', d: dr.id }, 'ยกเลิก')]));
    return { draft: dr.id, stage: 'search' };
  }
  if (p.a === 'who') {
    const emp = (await getEmployees(ctx)).find((e) => e.email === lower(p.e) && e.active);
    if (!emp) {
      await lineReply(ctx, ev, textMsg('ไม่พบพนักงานคนนี้ในรายชื่อ (อาจลาออกแล้ว) เลือกใหม่อีกครั้ง'));
      return askWho(ctx, { source: ev.source }, dr, '');
    }
    dr.assignee = emp.email;
    dr.stage = 'when';
    return askWhen(ctx, ev, dr, emp);
  }
  if ((p.a === 'when' || p.a === 'date') && dr.stage === 'when') {
    const date = p.a === 'date' ? ev.postback.params && ev.postback.params.date : p.v;
    const today = bkkYmd(ctx.now());
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date < today) {
      await lineReply(ctx, ev, textMsg('เลือกวันที่ผ่านมาแล้วไม่ได้'));
      const emp = (await getEmployees(ctx)).find((e) => e.email === dr.assignee);
      return askWhen(ctx, { source: ev.source }, dr, emp);
    }
    return createTicketFromDraft(ctx, ev, cfg, dr, date);
  }
  await lineReply(ctx, ev, textMsg('ปุ่มนี้หมดอายุแล้ว ส่งข้อความชื่องานใหม่ได้เลย'));
  return { expired: p.d };
}

async function createTicketFromDraft(ctx, ev, cfg, dr, date) {
  const userId = ev.source.userId;
  const emp = (await getEmployees(ctx)).find((e) => e.email === dr.assignee);
  const fields = {
    Title: dr.title,
    AssigneeEmail: dr.assignee,
    DueDate: `${date}T00:00:00Z`,
    Priority: 'Normal',
    Status: 'New',
    IsOpen: true,
    OverdueNotified: false,
    NoAckNotified: false,
    Source: 'LINE',
    PermsSet: false,
    HasFiles: dr.images.length > 0,
  };
  if (dr.details.length) fields.Details = dr.details.join('\n\n');
  const ticketId = await createItem(ctx, 'Tickets', fields);
  // From here on the ticket exists: never let a later failure hide its number from the CEO.
  delete drafts(ctx)[userId];
  ctx.store.lastCreated = { draftId: dr.id, ticketId, at: ctx.now().getTime() };

  let uploaded = 0;
  let failedImages = 0;
  for (let i = 0; i < dr.images.length; i++) {
    try {
      const buf = await lineContent(ctx, dr.images[i]);
      await uploadFile(ctx, `T-${ticketId}`, `photo-${i + 1}.jpg`, buf, 'image/jpeg');
      uploaded++;
    } catch (e) {
      failedImages++;
    }
  }

  let historyError = null;
  try {
    const h = { Title: `T-${ticketId}`, TicketID: ticketId, Action: 'create', ToStatus: 'New', ActorEmail: lower(cfg.CEO_EMAIL), Source: 'LINE', Processed: false };
    if (uploaded) h.Comment = `แนบรูป ${uploaded} รูป`;
    await createItem(ctx, 'TicketHistory', h);
  } catch (e) {
    historyError = e;
  }

  const lines = [`✅ สั่ง${personName(emp, dr.assignee)}แล้ว · T-${ticketId}`, `📅 ส่ง ${thaiDate(date)}`];
  if (uploaded) lines.push(`📎 แนบรูป ${uploaded} รูป`);
  if (failedImages) lines.push(`⚠️ แนบรูปไม่สำเร็จ ${failedImages} รูป (รูปเก่าเกินไปหรือระบบขัดข้อง)`);
  lines.push(historyError ? '⚠️ ระบบแจ้งเตือนพนักงานขัดข้อง ผู้ดูแลจะได้รับแจ้ง กรุณาบอกพนักงานโดยตรงไปก่อน' : 'พนักงานจะได้รับแจ้งเตือนภายในไม่กี่นาที');
  await lineReply(ctx, ev, textMsg(lines.join('\n')));
  if (historyError) throw new Error(`T-${ticketId} created but history event failed: ${historyError.message}`);
  return { created: ticketId, images: uploaded, failedImages };
}

async function changeStatus(ctx, ev, cfg, action, ticketId, expected) {
  const it = await getItem(ctx, 'Tickets', ticketId);
  const current = it.fields.Status;
  if (current !== expected) {
    await lineReply(ctx, ev, textMsg(`T-${ticketId} เปลี่ยนเป็น "${STATUS_TH[current] || current}" ไปแล้ว ไม่ได้ทำรายการซ้ำ`));
    return { stale: ticketId, current };
  }
  const to = action === 'close' ? 'Closed' : 'InProgress';
  const patch = { Status: to };
  if (to === 'Closed') {
    patch.IsOpen = false;
    patch.ClosedAt = ctx.now().toISOString();
  }
  await updateFields(ctx, 'Tickets', ticketId, patch);
  await createItem(ctx, 'TicketHistory', {
    Title: `T-${ticketId}`, TicketID: ticketId, Action: action, FromStatus: expected, ToStatus: to,
    ActorEmail: lower(cfg.CEO_EMAIL), Source: 'LINE', Processed: false,
  });
  const emp = (await getEmployees(ctx)).find((e) => e.email === lower(it.fields.AssigneeEmail));
  const who = personName(emp, it.fields.AssigneeEmail);
  if (action === 'close') {
    await lineReply(ctx, ev, textMsg(`✅ ผ่าน ปิด T-${ticketId} แล้ว`));
    return { changed: ticketId, to };
  }
  // A rejected task needs a reason: the next text the CEO sends goes to the assignee as a comment.
  ctx.store.replyTo = { ticketId, at: ctx.now().getTime(), kind: 'reason' };
  await lineReply(ctx, ev, textMsg(`❌ ไม่ผ่าน ส่ง T-${ticketId} กลับให้${who}ทำต่อแล้ว\nพิมพ์หรือพูดสิ่งที่ต้องแก้ ส่งถึง${who}ได้เลย`, [
    qrPostback('ไม่ต้องบอกเหตุผล', { a: 'replycancel', t: ticketId }, 'ไม่ต้องบอกเหตุผล'),
  ]));
  return { changed: ticketId, to };
}

// ---------- Transfer the open work of someone who left ----------
const TRANSFER_TTL_MS = 30 * 60 * 1000;

function currentTransfer(ctx) {
  const x = ctx.store.transfer;
  if (x && ctx.now().getTime() - x.at > TRANSFER_TTL_MS) {
    delete ctx.store.transfer;
    return null;
  }
  return x || null;
}

// Open tickets whose assignee is no longer an active employee, grouped by person.
function leaverGroups(tickets, employees) {
  const active = new Set(employees.filter((e) => e.active).map((e) => e.email));
  const groups = new Map();
  for (const t of tickets) {
    if (!t.isOpen || !t.assignee || active.has(t.assignee)) continue;
    if (!groups.has(t.assignee)) groups.set(t.assignee, []);
    groups.get(t.assignee).push(t);
  }
  return [...groups.entries()].map(([email, list]) => ({ email, emp: employees.find((e) => e.email === email), tickets: list }));
}

function transferButton(g) {
  const name = g.emp ? g.emp.nick || g.emp.first || g.emp.full : g.email.split('@')[0];
  return qrPostback(`🔁 โอนงาน${name}`, { a: 'xfer', f: g.email }, `โอนงาน${personName(g.emp, g.email)}`);
}

// "โอนงาน" alone lists leavers; "โอนงานแตน" picks anyone, active or not.
async function onTransferCommand(ctx, ev, rest) {
  const employees = await getEmployees(ctx);
  const tickets = await getTickets(ctx);
  if (!rest) {
    const groups = leaverGroups(tickets, employees);
    if (!groups.length) {
      await lineReply(ctx, ev, textMsg('ไม่มีงานค้างของคนที่ลาออก\nถ้าจะโอนงานของคนที่ยังทำงานอยู่ พิมพ์ "โอนงาน" ตามด้วยชื่อ เช่น "โอนงานแตน"'));
      return { transfer: 'none' };
    }
    const lines = groups.map((g) => `• ${personName(g.emp, g.email)} ${g.tickets.length} งาน`);
    await lineReply(ctx, ev, textMsg(`👋 งานค้างของคนที่ลาออก\n${lines.join('\n')}\nโอนงานของใคร?`, groups.slice(0, 12).map(transferButton)));
    return { transfer: 'pick-from', groups: groups.length };
  }
  const everyone = employees.map((e) => Object.assign({}, e, { active: true }));
  const r = findAssignee(everyone, rest);
  if (r.people.length === 1 && r.exact) return startTransfer(ctx, ev, r.people[0].email);
  if (r.people.length) {
    const items = r.people.slice(0, 12).map((e) => transferButton({ email: e.email, emp: e }));
    await lineReply(ctx, ev, textMsg(`พบ ${r.people.length} คน โอนงานของใคร?`, items));
    return { transfer: 'pick-from', people: r.people.length };
  }
  await lineReply(ctx, ev, textMsg(`ไม่พบชื่อ "${truncate(rest, 40)}" ในรายชื่อพนักงาน`));
  return { transfer: 'not-found' };
}

async function startTransfer(ctx, ev, fromEmail) {
  const from = lower(fromEmail);
  const employees = await getEmployees(ctx);
  const fromEmp = employees.find((e) => e.email === from);
  const open = (await getTickets(ctx)).filter((t) => t.isOpen && t.assignee === from).sort((a, b) => a.id - b.id);
  if (!open.length) {
    await lineReply(ctx, ev, textMsg(`${personName(fromEmp, from)}ไม่มีงานค้าง`));
    return { transfer: 'nothing', from };
  }
  const x = { id: newId(), from, at: ctx.now().getTime() };
  ctx.store.transfer = x;
  const people = (await quickPeople(ctx, await getConfig(ctx))).filter((e) => e.email !== from);
  const items = people.map((e) => qrPostback(personLabel(e), { a: 'xto', x: x.id, e: e.email }, `โอนให้${personName(e)}`));
  items.push(qrPostback('❌ ยกเลิก', { a: 'xcancel' }, 'ยกเลิกการโอน'));
  const lines = open.slice(0, 10).map((t) => `T-${t.id} ${truncate(t.title, 40)}`);
  if (open.length > 10) lines.push(`... และอีก ${open.length - 10} งาน`);
  await lineReply(ctx, ev, textMsg(`🔁 งานค้างของ${personName(fromEmp, from)} ${open.length} งาน\n${lines.join('\n')}\n\nโอนให้ใคร? (แตะ หรือพิมพ์/พูดชื่อ)`, items));
  return { transfer: x.id, from, count: open.length };
}

// Name typed while the bot asks "โอนให้ใคร?". Returns null when the text is not a name.
async function onTransferTo(ctx, ev, x, text) {
  const r = findAssignee(await getEmployees(ctx), text);
  // Only a clean name counts here, so "สั่งแตนทำรายงาน" still starts a new task.
  const people = r.exact ? r.people.filter((e) => e.email !== x.from) : [];
  if (people.length === 1) return confirmTransfer(ctx, ev, x, people[0].email);
  if (people.length) {
    const items = people.slice(0, 11).map((e) => qrPostback(personLabel(e), { a: 'xto', x: x.id, e: e.email }, `โอนให้${personName(e)}`));
    items.push(qrPostback('❌ ยกเลิก', { a: 'xcancel' }, 'ยกเลิกการโอน'));
    await lineReply(ctx, ev, textMsg(`พบ ${people.length} คน โอนให้ใคร?`, items));
    return { transfer: x.id, search: people.length };
  }
  if (r.explicit && !r.people.length && chars(r.query).length <= 20) {
    await lineReply(ctx, ev, textMsg(`ไม่พบชื่อ "${truncate(r.query, 40)}" ในรายชื่อพนักงาน พิมพ์ชื่อใหม่ หรือ "ยกเลิก"`));
    return { transfer: x.id, search: 'none' };
  }
  return null;
}

async function confirmTransfer(ctx, ev, x, toEmail) {
  const employees = await getEmployees(ctx);
  const to = employees.find((e) => e.email === lower(toEmail) && e.active);
  if (!to || to.email === x.from) {
    await lineReply(ctx, ev, textMsg('โอนให้คนนี้ไม่ได้ (ลาออกแล้ว หรือเป็นคนเดิม) เลือกใหม่อีกครั้ง'));
    return { transfer: x.id, invalidTo: toEmail };
  }
  const count = (await getTickets(ctx)).filter((t) => t.isOpen && t.assignee === x.from).length;
  const fromEmp = employees.find((e) => e.email === x.from);
  await lineReply(ctx, ev, textMsg(
    `ยืนยันโอน ${count} งาน\nจาก ${personName(fromEmp, x.from)} → ${personName(to)}\n\nทุกงานเริ่มใหม่เป็น "ใหม่" (ผู้รับต้องกดรับทราบ) วันส่งเดิม และ${personName(fromEmp, x.from)}จะดูงานเหล่านี้ไม่ได้อีก`,
    [qrPostback('✅ ยืนยันโอน', { a: 'xgo', x: x.id, e: to.email }, 'ยืนยันโอน'), qrPostback('❌ ยกเลิก', { a: 'xcancel' }, 'ยกเลิกการโอน')],
  ));
  return { transfer: x.id, confirm: to.email, count };
}

async function runTransfer(ctx, ev, cfg, x, toEmail) {
  delete ctx.store.transfer; // a second tap on "ยืนยัน" finds nothing to do
  const to = lower(toEmail);
  const employees = await getEmployees(ctx);
  const fromEmp = employees.find((e) => e.email === x.from);
  const toEmp = employees.find((e) => e.email === to);
  const open = (await getTickets(ctx)).filter((t) => t.isOpen && t.assignee === x.from).sort((a, b) => a.id - b.id);
  const moved = [];
  const failed = [];
  for (const t of open) {
    try {
      await updateFields(ctx, 'Tickets', t.id, { AssigneeEmail: to, Status: 'New', PermsSet: false, NoAckNotified: false });
      await createItem(ctx, 'TicketHistory', {
        Title: `T-${t.id}`, TicketID: t.id, Action: 'reassign', FromStatus: t.status, ToStatus: 'New',
        Comment: `โอนจาก ${x.from} ให้ ${to}`, ActorEmail: lower(cfg.CEO_EMAIL), Source: 'LINE', Processed: false,
      });
      moved.push(t.id);
    } catch (e) {
      failed.push(t.id);
    }
  }
  const lines = [`✅ โอน ${moved.length} งานจาก${personName(fromEmp, x.from)}ให้${personName(toEmp, to)}แล้ว`];
  if (moved.length) lines.push(moved.map((id) => `T-${id}`).join(', '), `${personName(toEmp, to)}จะได้รับแจ้งเตือนภายในไม่กี่นาที`);
  if (failed.length) lines.push(`⚠️ โอนไม่สำเร็จ: ${failed.map((id) => `T-${id}`).join(', ')} ลองพิมพ์ "โอนงาน" อีกครั้ง`);
  await lineReply(ctx, ev, textMsg(lines.join('\n')));
  if (failed.length) throw new Error(`transfer ${x.from} -> ${to}: failed ${failed.join(',')}`);
  return { transferred: moved, from: x.from, to };
}

// ---------- Summaries ----------
function computeStats(tickets, now, noAckHours) {
  const today = bkkYmd(now);
  const weekStart = bkkStartInstant(mondayOf(today)).getTime();
  const noAckBefore = now.getTime() - noAckHours * 3600000;
  const open = tickets.filter((t) => t.isOpen);
  return {
    today,
    open,
    overdue: open.filter((t) => t.due && t.due < today),
    waiting: open.filter((t) => t.status === 'WaitingCEO'),
    done: open.filter((t) => t.status === 'Done'),
    noAck: open.filter((t) => t.status === 'New' && new Date(t.created).getTime() < noAckBefore),
    createdWeek: tickets.filter((t) => new Date(t.created).getTime() >= weekStart),
    closedWeek: tickets.filter((t) => t.status === 'Closed' && t.closedAt && new Date(t.closedAt).getTime() >= weekStart),
  };
}

function summaryMessage(s, heading) {
  const text = [
    heading,
    `📌 เปิดอยู่ ${s.open.length} งาน`,
    `🔴 เลยกำหนด ${s.overdue.length} · ⏳ รอคุณตอบ ${s.waiting.length} · ✅ เสร็จรอคุณปิด ${s.done.length}`,
    `🆕 ยังไม่รับทราบ ${s.noAck.length}`,
    `📈 สัปดาห์นี้ สั่ง ${s.createdWeek.length} · ปิดแล้ว ${s.closedWeek.length}`,
  ];
  const leavers = s.leavers || [];
  if (leavers.length) {
    text.push(`👋 งานค้างของคนที่ลาออก ${leavers.reduce((n, g) => n + g.tickets.length, 0)} งาน: ${leavers.map((g) => personName(g.emp, g.email)).join(', ')}`);
  }
  const items = [];
  if (s.overdue.length) items.push(qrPostback(`🔴 เลยกำหนด ${s.overdue.length}`, { a: 'list', k: 'overdue', p: 0 }, 'ดูงานเลยกำหนด'));
  if (s.waiting.length) items.push(qrPostback(`⏳ รอผม ${s.waiting.length}`, { a: 'list', k: 'waiting', p: 0 }, 'ดูงานรอผม'));
  if (s.done.length) items.push(qrPostback(`✅ รอปิด ${s.done.length}`, { a: 'list', k: 'done', p: 0 }, 'ดูงานรอปิด'));
  if (s.noAck.length) items.push(qrPostback(`🆕 ยังไม่รับทราบ ${s.noAck.length}`, { a: 'list', k: 'noack', p: 0 }, 'ดูงานยังไม่รับทราบ'));
  for (const g of leavers.slice(0, 8)) items.push(transferButton(g));
  return textMsg(text.join('\n'), items);
}

async function loadStats(ctx, cfg) {
  const tickets = await getTickets(ctx);
  const s = computeStats(tickets, ctx.now(), Number(cfg.NOACK_HOURS || 24));
  s.leavers = leaverGroups(tickets, await getEmployees(ctx));
  return s;
}

async function replySummary(ctx, ev, cfg) {
  const s = await loadStats(ctx, cfg);
  await lineReply(ctx, ev, summaryMessage(s, `📋 สรุปงาน ณ ${thaiDate(s.today)}`));
  return { summary: s.open.length };
}

async function replyList(ctx, ev, kind, page) {
  const cfg = await getConfig(ctx);
  const s = await loadStats(ctx, cfg);
  const pick = { overdue: s.overdue, waiting: s.waiting, done: s.done, noack: s.noAck }[kind] || [];
  const titles = { overdue: '🔴 งานเลยกำหนด', waiting: '⏳ งานรอคุณตอบ', done: '✅ งานเสร็จรอคุณปิด', noack: '🆕 งานที่ยังไม่รับทราบ' };
  const size = kind === 'done' ? DONE_PAGE_SIZE : PAGE_SIZE;
  const sorted = pick.slice().sort((a, b) => String(a.due).localeCompare(String(b.due)) || a.id - b.id);
  const rows = sorted.slice(page * size, page * size + size);
  if (!rows.length) {
    await lineReply(ctx, ev, textMsg(`${titles[kind] || 'รายการ'}: ไม่มีแล้ว`));
    return { list: kind, count: 0 };
  }
  const employees = await getEmployees(ctx);
  const lines = rows.map((t) => {
    const emp = employees.find((e) => e.email === t.assignee);
    const late = t.due && t.due < s.today ? ` · เลย ${daysBetween(t.due, s.today)} วัน` : (t.due ? ` · ส่ง ${thaiDate(t.due)}` : '');
    return `T-${t.id} ${personName(emp, t.assignee)} · ${truncate(t.title, 50)}${late}`;
  });
  const items = [];
  if (kind === 'done') {
    for (const t of rows) {
      items.push(qrPostback(`✅ ผ่าน T-${t.id}`, { a: 'close', t: t.id, s: 'Done' }, `ผ่าน ปิด T-${t.id}`));
      items.push(qrPostback(`❌ ไม่ผ่าน T-${t.id}`, { a: 'reopen', t: t.id, s: 'Done' }, `ไม่ผ่าน ส่งกลับ T-${t.id}`));
    }
  }
  if (sorted.length > (page + 1) * size) items.push(qrPostback('ดูเพิ่ม ▶', { a: 'list', k: kind, p: page + 1 }, 'ดูเพิ่ม'));
  const header = `${titles[kind]} (${page * size + 1}–${page * size + rows.length} จาก ${sorted.length})`;
  await lineReply(ctx, ev, textMsg(`${header}\n${lines.join('\n')}`, items));
  return { list: kind, count: rows.length };
}

// ---------- CEO replies to staff from LINE ----------
const REPLY_TTL_MS = 30 * 60 * 1000;

function currentReply(ctx) {
  const r = ctx.store.replyTo;
  if (r && ctx.now().getTime() - r.at > REPLY_TTL_MS) {
    delete ctx.store.replyTo;
    return null;
  }
  return r || null;
}

async function startReply(ctx, ev, ticketId) {
  const it = await getItem(ctx, 'Tickets', ticketId);
  if (!it.fields.IsOpen) {
    await lineReply(ctx, ev, textMsg(`T-${ticketId} ปิดไปแล้ว`));
    return { replyTo: 'closed' };
  }
  const emp = (await getEmployees(ctx)).find((e) => e.email === lower(it.fields.AssigneeEmail));
  ctx.store.replyTo = { ticketId, at: ctx.now().getTime() };
  await lineReply(ctx, ev, textMsg(`💬 พิมพ์หรือพูดคำตอบถึง${personName(emp, it.fields.AssigneeEmail)} (T-${ticketId}) แล้วกดส่ง`, [
    qrPostback('❌ ยกเลิก', { a: 'replycancel', t: ticketId }, 'ยกเลิก'),
  ]));
  return { replyTo: ticketId };
}

async function sendReply(ctx, ev, cfg, pending, text) {
  delete ctx.store.replyTo;
  const it = await getItem(ctx, 'Tickets', pending.ticketId);
  const status = it.fields.Status;
  if (!it.fields.IsOpen) {
    await lineReply(ctx, ev, textMsg(`T-${pending.ticketId} ปิดไปแล้ว ไม่ได้ส่งคำตอบ`));
    return { reply: 'closed' };
  }
  // Answering a question moves the task back to work; otherwise it is just a comment.
  const isAnswer = status === 'WaitingCEO';
  if (isAnswer) await updateFields(ctx, 'Tickets', pending.ticketId, { Status: 'InProgress' });
  await createItem(ctx, 'TicketHistory', {
    Title: `T-${pending.ticketId}`, TicketID: pending.ticketId, Action: isAnswer ? 'reply' : 'comment',
    FromStatus: status, ToStatus: isAnswer ? 'InProgress' : status, Comment: text,
    ActorEmail: lower(cfg.CEO_EMAIL), Source: 'LINE', Processed: false, CEOPending: false,
  });
  const emp = (await getEmployees(ctx)).find((e) => e.email === lower(it.fields.AssigneeEmail));
  const what = pending.kind === 'reason' ? 'สิ่งที่ต้องแก้' : 'คำตอบ';
  await lineReply(ctx, ev, textMsg(`✅ ส่ง${what}ให้${personName(emp, it.fields.AssigneeEmail)}แล้ว (T-${pending.ticketId})`));
  return { reply: pending.ticketId, answered: isAnswer };
}

// ---------- Staff updates -> CEO (triggered by the SharePoint webhook on TicketHistory) ----------
function checkSharePointCall(ctx, query, body) {
  if (query && query.validationtoken) return { respond: String(query.validationtoken), process: false };
  const expected = ctx.setting('SP_WEBHOOK_CLIENT_STATE');
  const notes = (body && body.value) || [];
  const valid = notes.length > 0 && notes.every((n) => n.clientState === expected);
  return { respond: '', process: valid };
}

async function pendingStaffUpdates(ctx) {
  const sid = await siteId(ctx);
  try {
    const out = [];
    let url = `/sites/${sid}/lists/TicketHistory/items?expand=fields&$filter=fields/CEOPending eq 1&$top=200`;
    while (url) {
      const res = await graph(ctx, 'GET', url, undefined, { headers: { Prefer: 'HonorNonIndexedQueriesWarningMayFailRandomly' } });
      for (const it of res.value || []) out.push({ id: Number(it.id), fields: it.fields || {} });
      url = res['@odata.nextLink'] || null;
    }
    return out;
  } catch (e) {
    // Filter syntax not accepted: fall back to a full scan (slower, same result).
    return (await listItems(ctx, 'TicketHistory')).filter((it) => it.fields.CEOPending === true);
  }
}

function ticketFilesUrl(ctx, id) {
  const site = ctx.setting('SP_SITE_PATH');
  return `https://${ctx.setting('SP_HOSTNAME')}${site}/TicketFiles/Forms/AllItems.aspx?id=${encodeURIComponent(`${site}/TicketFiles/T-${id}`)}`;
}

function staffUpdateMessage(h, ticket, emp, filesUrl) {
  const who = personName(emp, ticket.fields.AssigneeEmail);
  const id = h.fields.TicketID;
  const title = truncate(ticket.fields.Title, 80);
  // Files uploaded from the app arrive as a comment starting with 📎; finished work usually has them too.
  const showFiles = filesUrl && ticket.fields.HasFiles === true && (h.fields.Action === 'done' || /^📎/.test(h.fields.Comment || ''));
  const note = (h.fields.Comment ? `\n💬 ${truncate(h.fields.Comment, 1000)}` : '') + (showFiles ? `\n📂 เปิดไฟล์งาน: ${filesUrl}` : '');
  const replyBtn = qrPostback('💬 ตอบ', { a: 'replyto', t: id }, `ตอบ T-${id}`);
  if (h.fields.Action === 'wait') {
    return textMsg(`⏳ ${who} รอคำตอบจากคุณ\nT-${id} ${title}${note}`, [replyBtn]);
  }
  if (h.fields.Action === 'done') {
    return textMsg(`✅ ${who} ทำเสร็จแล้ว รอคุณตรวจ\nT-${id} ${title}${note}`, [
      qrPostback('✅ ผ่าน ปิดงาน', { a: 'close', t: id, s: 'Done' }, `ผ่าน ปิด T-${id}`),
      qrPostback('❌ ไม่ผ่าน ส่งกลับ', { a: 'reopen', t: id, s: 'Done' }, `ไม่ผ่าน ส่งกลับ T-${id}`),
      replyBtn,
    ]);
  }
  return textMsg(`💬 ${who} เรื่อง T-${id} ${title}${note}`, [replyBtn]);
}

async function notifyCeoOfStaffUpdates(ctx) {
  const cfg = await getConfig(ctx);
  if (!cfg.CEO_LINE_USER_ID) return { skipped: 'no-ceo-line-user-id' };
  const pending = (await pendingStaffUpdates(ctx)).sort((a, b) => a.id - b.id);
  const employees = await getEmployees(ctx);
  let sent = 0;
  for (const h of pending) {
    const ticket = await getItem(ctx, 'Tickets', h.fields.TicketID);
    const emp = employees.find((e) => e.email === lower(ticket.fields.AssigneeEmail));
    await linePush(ctx, cfg.CEO_LINE_USER_ID, [staffUpdateMessage(h, ticket, emp, ticketFilesUrl(ctx, h.fields.TicketID))]);
    await updateFields(ctx, 'TicketHistory', h.id, { CEOPending: false });
    sent++;
  }
  return { sent };
}

async function dailySummary(ctx) {
  const cfg = await getConfig(ctx);
  if (!cfg.CEO_LINE_USER_ID) return { skipped: 'no-ceo-line-user-id' };
  const today = bkkYmd(ctx.now());
  if ((await getHolidays(ctx)).includes(today)) return { skipped: 'holiday', today };
  const s = await loadStats(ctx, cfg);
  await linePush(ctx, cfg.CEO_LINE_USER_ID, [summaryMessage(s, `☀️ สรุปงาน ${thaiDate(today)}`)]);
  return { sent: true, open: s.open.length };
}

function weeklyLines(tickets, employees, now) {
  const today = bkkYmd(now);
  const monday = mondayOf(today);
  const weekStart = bkkStartInstant(monday).getTime();
  const people = {};
  const row = (email) => (people[email] = people[email] || { email, assigned: 0, closed: 0, open: 0, overdue: 0, days: [] });
  for (const t of tickets) {
    if (!t.assignee) continue;
    const createdMs = new Date(t.created).getTime();
    if (createdMs >= weekStart) row(t.assignee).assigned++;
    if (t.isOpen) {
      row(t.assignee).open++;
      if (t.due && t.due < today) row(t.assignee).overdue++;
    }
    if (t.status === 'Closed' && t.closedAt && new Date(t.closedAt).getTime() >= weekStart) {
      const r = row(t.assignee);
      r.closed++;
      r.days.push((new Date(t.closedAt).getTime() - createdMs) / 86400000);
    }
  }
  const rows = Object.values(people).sort((a, b) => b.overdue - a.overdue || b.open - a.open || b.assigned - a.assigned);
  const header = `📊 สรุปรายคน ${thaiDate(monday)} – ${thaiDate(today)}`;
  const lines = rows.map((r) => {
    const emp = employees.find((e) => e.email === r.email);
    const avg = r.days.length ? ` · เฉลี่ย ${(r.days.reduce((x, y) => x + y, 0) / r.days.length).toFixed(1)} วัน` : '';
    const dept = emp && emp.dept ? ` (${emp.dept})` : '';
    return `• ${personName(emp, r.email)}${dept}: สั่ง ${r.assigned} · ปิด ${r.closed} · เปิด ${r.open} · 🔴 ${r.overdue}${avg}`;
  });
  return { header, lines };
}

function chunkMessages(header, lines, limit) {
  const out = [];
  let cur = header;
  for (const line of lines) {
    if (chars(cur).length + 1 + chars(line).length > limit) {
      out.push(cur);
      cur = line;
    } else {
      cur += `\n${line}`;
    }
  }
  out.push(cur);
  return out;
}

async function weeklySummary(ctx) {
  const cfg = await getConfig(ctx);
  if (!cfg.CEO_LINE_USER_ID) return { skipped: 'no-ceo-line-user-id' };
  const tickets = await getTickets(ctx);
  const { header, lines } = weeklyLines(tickets, await getEmployees(ctx), ctx.now());
  const body = lines.length ? lines : ['ไม่มีงานในสัปดาห์นี้'];
  const chunks = chunkMessages(header, body, 4900).slice(0, 5);
  await linePush(ctx, cfg.CEO_LINE_USER_ID, chunks.map((c) => textMsg(c)));
  return { sent: true, people: lines.length };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    sha256, hmacSha256, verifyLineSignature, bkkYmd, addDays, fridayOf, mondayOf, spDate, thaiDate,
    encodeData, decodeData, matchEmployees, findAssignee, leaverGroups, parseDueText, computeStats, weeklyLines, chunkMessages, truncate,
    handleWebhook, dailySummary, weeklySummary, checkSharePointCall, notifyCeoOfStaffUpdates,
  };
}
