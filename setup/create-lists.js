// สร้าง List, Library และคอลัมน์ทั้งหมดของ Site CEO-Tickets ให้ชื่อภายในตรงกับเอกสารและบอท
// วิธีใช้: ดู docs/guides/B-setup-lists.md
// ปลอดภัยที่จะรันซ้ำ: ข้าม List / คอลัมน์ / ค่าตั้ง ที่มีอยู่แล้ว ไม่ลบหรือแก้ของเดิม
const CEO_TICKETS_SCHEMA = [
  {
    title: 'Tickets', template: 100, fields: [
      '<Field Type="Text" Name="AssigneeEmail" DisplayName="AssigneeEmail" Required="TRUE" Indexed="TRUE" />',
      '<Field Type="User" Name="Assignee" DisplayName="Assignee" UserSelectionMode="PeopleOnly" />',
      '<Field Type="DateTime" Format="DateOnly" Name="DueDate" DisplayName="DueDate" Required="TRUE" Indexed="TRUE" />',
      choice('Priority', ['Low', 'Normal', 'High'], 'Normal', true),
      choice('Status', ['New', 'Acknowledged', 'InProgress', 'WaitingCEO', 'Done', 'Closed'], 'New', true, true),
      '<Field Type="Note" Name="Details" DisplayName="Details" RichText="FALSE" NumLines="6" />',
      bool('IsOpen', true, true),
      '<Field Type="DateTime" Format="DateTime" Name="AckedAt" DisplayName="AckedAt" />',
      '<Field Type="DateTime" Format="DateTime" Name="DoneAt" DisplayName="DoneAt" />',
      '<Field Type="DateTime" Format="DateTime" Name="ClosedAt" DisplayName="ClosedAt" />',
      bool('OverdueNotified', false),
      bool('NoAckNotified', false),
      choice('Source', ['App', 'LINE'], 'App', true),
      bool('PermsSet', false),
      bool('HasFiles', false),
    ],
  },
  {
    title: 'TicketHistory', template: 100, fields: [
      '<Field Type="Number" Name="TicketID" DisplayName="TicketID" Required="TRUE" Indexed="TRUE" Decimals="0" />',
      choice('Action', ['create', 'ack', 'start', 'wait', 'reply', 'done', 'reopen', 'close', 'cancel', 'comment', 'due_change'], null, true),
      '<Field Type="Text" Name="FromStatus" DisplayName="FromStatus" />',
      '<Field Type="Text" Name="ToStatus" DisplayName="ToStatus" />',
      '<Field Type="Note" Name="Comment" DisplayName="Comment" RichText="FALSE" NumLines="4" />',
      '<Field Type="Text" Name="ActorEmail" DisplayName="ActorEmail" />',
      choice('Source', ['App', 'LINE'], 'App', true),
      bool('Processed', true),
      bool('CEOPending', false, true),
    ],
  },
  {
    title: 'Employees', template: 100, fields: [
      '<Field Type="Text" Name="FirstName" DisplayName="FirstName" />',
      '<Field Type="Text" Name="LastName" DisplayName="LastName" />',
      '<Field Type="Text" Name="Nickname" DisplayName="Nickname" />',
      '<Field Type="Text" Name="Aliases" DisplayName="Aliases" />',
      '<Field Type="Text" Name="Email" DisplayName="Email" Required="TRUE" Indexed="TRUE" />',
      '<Field Type="Text" Name="Department" DisplayName="Department" />',
      bool('Active', true),
    ],
  },
  {
    title: 'Config', template: 100, fields: ['<Field Type="Text" Name="Value" DisplayName="Value" />'],
    items: [
      ['CEO_EMAIL', ''],
      ['OWNER_EMAIL', ''],
      ['BACKUP_EMAIL', ''],
      ['NOACK_HOURS', '24'],
      ['CEO_LINE_USER_ID', ''],
      ['QUICK_ASSIGNEES', ''],
      ['SP_WEBHOOK_EXPIRES', ''],
    ],
  },
  {
    title: 'Holidays', template: 100, fields: [
      '<Field Type="DateTime" Format="DateOnly" Name="Date" DisplayName="Date" Required="TRUE" />',
    ],
  },
  { title: 'TicketFiles', template: 101, fields: [] },
];

function choice(name, values, def, required, indexed) {
  return `<Field Type="Choice" Name="${name}" DisplayName="${name}" Format="Dropdown"${required ? ' Required="TRUE"' : ''}${indexed ? ' Indexed="TRUE"' : ''}>`
    + (def ? `<Default>${def}</Default>` : '')
    + `<CHOICES>${values.map((v) => `<CHOICE>${v}</CHOICE>`).join('')}</CHOICES></Field>`;
}
function bool(name, def, indexed) {
  return `<Field Type="Boolean" Name="${name}" DisplayName="${name}"${indexed ? ' Indexed="TRUE"' : ''}><Default>${def ? 1 : 0}</Default></Field>`;
}
function fieldName(xml) {
  return xml.match(/ Name="([^"]+)"/)[1];
}

async function setupCeoTickets(fetchImpl, siteUrl, log) {
  const api = `${siteUrl}/_api`;
  const accept = 'application/json;odata=nometadata';
  const verbose = 'application/json;odata=verbose';
  let digest = null;

  async function call(method, url, body) {
    const headers = { Accept: accept };
    if (method !== 'GET') {
      headers['Content-Type'] = verbose;
      if (digest) headers['X-RequestDigest'] = digest;
    }
    const res = await fetchImpl(url, { method, headers, body: body ? JSON.stringify(body) : undefined, credentials: 'same-origin' });
    if (!res.ok && res.status !== 404) throw new Error(`${method} ${url} -> ${res.status} ${await res.text()}`);
    return res;
  }
  const listUrl = (t) => `${api}/web/lists/getbytitle('${t}')`;
  digest = (await (await call('POST', `${api}/contextinfo`)).json()).FormDigestValue;

  for (const list of CEO_TICKETS_SCHEMA) {
    let res = await call('GET', `${listUrl(list.title)}?$select=Id,ListItemEntityTypeFullName`);
    if (res.status === 404) {
      await call('POST', `${api}/web/lists`, {
        __metadata: { type: 'SP.List' }, Title: list.title, BaseTemplate: list.template, EnableVersioning: true,
      });
      log(`สร้าง ${list.title}`);
      res = await call('GET', `${listUrl(list.title)}?$select=Id,ListItemEntityTypeFullName`);
    } else {
      log(`มี ${list.title} อยู่แล้ว`);
    }
    const info = await res.json();

    const existing = new Set(((await (await call('GET', `${listUrl(list.title)}/fields?$select=InternalName`)).json()).value || []).map((f) => f.InternalName));
    for (const xml of list.fields) {
      const name = fieldName(xml);
      if (existing.has(name)) {
        log(`  - ${name} มีอยู่แล้ว`);
        continue;
      }
      await call('POST', `${listUrl(list.title)}/fields/createfieldasxml`, {
        parameters: { __metadata: { type: 'SP.XmlSchemaFieldCreationInformation' }, SchemaXml: xml, Options: 8 | 16 },
      });
      log(`  + ${name}`);
    }

    if (list.items) {
      const have = new Set(((await (await call('GET', `${listUrl(list.title)}/items?$select=Title&$top=500`)).json()).value || []).map((i) => i.Title));
      for (const [key, value] of list.items) {
        if (have.has(key)) continue;
        await call('POST', `${listUrl(list.title)}/items`, { __metadata: { type: info.ListItemEntityTypeFullName }, Title: key, Value: value });
        log(`  + ค่าตั้ง ${key}`);
      }
    }
  }
  log('เสร็จแล้ว ตรวจชื่อคอลัมน์ตาม docs/01-data-model.md');
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { setupCeoTickets, CEO_TICKETS_SCHEMA };
} else {
  const siteUrl = (window._spPageContextInfo && window._spPageContextInfo.webAbsoluteUrl) || location.href.match(/^https:\/\/[^/]+\/sites\/[^/?#]+/)[0];
  console.log('Site:', siteUrl);
  setupCeoTickets(window.fetch.bind(window), siteUrl, console.log)
    .catch((e) => console.error('ไม่สำเร็จ:', e));
}
