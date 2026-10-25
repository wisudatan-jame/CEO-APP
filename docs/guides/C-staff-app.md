# คู่มือ ค: แอป Power Apps สำหรับพนักงาน

พนักงานใช้แอปนี้ดูงานที่ CEO สั่ง กดรับทราบ อัปเดตสถานะ และเขียนความเห็น
มี 2 ส่วน ต้องทำตามลำดับ: **ส่วนที่ 1 Flow `UpdateTicket`** (แอปเรียกใช้ทุกครั้งที่กดปุ่ม) แล้วจึง **ส่วนที่ 2 ตัวแอป**
ใช้เวลาประมาณ 3–4 ชั่วโมง ทำหลัง [คู่มือ ก](A-flow-onlineevent.md) และ [คู่มือ ข](B-setup-lists.md)

หน้าจอของ CEO (Dashboard, สร้างงาน, ปฏิทิน) อยู่ใน [../02-power-fx.md](../02-power-fx.md) เพิ่มทีหลังในแอปเดียวกันได้ ตอนนี้ CEO สั่งงานและดูสรุปผ่าน LINE อยู่แล้ว

> ⚠️ วิธีพิมพ์ Expression เหมือนคู่มือ ก: คลิกช่อง → ไอคอน **fx** → วาง → **Add**

> **สร้างใน Environment หลักของบริษัทเท่านั้น:** มุมขวาบนของ make.powerautomate.com / make.powerapps.com ต้องเป็น Environment ชื่อ `Digital Focus (default)` หรือชื่อบริษัทที่มีคำว่า default **ห้ามสร้างใน Environment ส่วนตัวแบบ Developer** (ชื่อมักเป็น `<ชื่อคุณ>'s Environment`) เพราะ Microsoft ประกาศยกเลิก Developer environment แบบ unmanaged และ Power Apps Developer Plan: เริ่มระงับ 15 ธ.ค. 2026 และเริ่มลบ 15 ม.ค. 2027 ⚠️ ตรวจชื่อ Environment ก่อนเริ่มทุกครั้ง

---

## ส่วนที่ 1: Flow `UpdateTicket`

แอปห้ามแก้ SharePoint เอง (พนักงานมีสิทธิ์แค่อ่าน) ทุกการเปลี่ยนสถานะต้องผ่าน Flow นี้ ซึ่งตรวจว่า **ใครกด** และ **เปลี่ยนจากสถานะไหนไปไหนได้**

### 1.1 สร้าง Flow และ Input
1. make.powerautomate.com → **+ Create** → **Instant cloud flow**
2. ชื่อ `UpdateTicket` · Trigger: **When Power Apps calls a flow (V2)** → Create
3. คลิก Trigger → **+ Add an input** สร้างตามลำดับนี้
   | ชนิด | ชื่อ | บังคับ |
   |---|---|---|
   | Number | `ticketId` | ใช่ |
   | Text | `action` | ใช่ |
   | Text | `expectedStatus` | ใช่ |
   | Text | `comment` | ไม่บังคับก็ได้ |

   > แอปเรียก Flow แบบระบุชื่อค่าทุกตัวในวงเล็บปีกกา (ข้อ 2.4) จึงไม่ขึ้นกับว่าแต่ละ Input ติ๊ก **Make the field required** หรือไม่ ชื่อที่แอปเห็นเป็นชื่อภายในตามลำดับที่สร้าง: `number` = ticketId, `text` = action, `text_1` = expectedStatus, `text_2` = comment ⚠️ ถ้าสร้าง Input ต่างลำดับ ให้พิมพ์ `UpdateTicket.Run(` ในแอปแล้วดูชื่อจากกล่องคำแนะนำ

### 1.2 อ่านค่า Input และตัวตนผู้กด (นอก Scope)
1. **Initialize variable** · Name `CallerEmail` · Type String · Value (Expression):
   `toLower(triggerOutputs()?['headers']?['x-ms-user-email'])`
   ⚠️ **ต้องตรวจ:** หลังรันครั้งแรก เปิด Run → คลิก Trigger → **Show raw outputs** ดูว่ามี Header `x-ms-user-email` และเป็นอีเมลของคนที่กดในแอป ถ้าชื่อ Header ต่างไป ให้แก้ Expression ตามนั้น **ห้ามรับอีเมลจากแอปเป็น Input** เพราะปลอมได้
2. **Compose** 4 ตัว (เลือกค่าจาก **Dynamic content** ของ Trigger) แล้วเปลี่ยนชื่อการ์ดตามนี้
   - `In ticketId` ← ticketId
   - `In action` ← action
   - `In expected` ← expectedStatus
   - `In comment` ← comment

### 1.3 Scope `Try`
**Scope** ชื่อ `Try` แล้วใส่ Action ต่อไปนี้ข้างใน

**a) Get item** ชื่อ `Get ticket` · List `Tickets` · Id: `outputs('In_ticketId')`

**b) Get items** ชื่อ `Get ceo` · List `Config` · Filter Query: `Title eq 'CEO_EMAIL'`

**c) Compose** ชื่อ `Role` (Expression):
```
if(equals(variables('CallerEmail'), toLower(first(body('Get_ceo')?['value'])?['Value'])), 'C', if(equals(variables('CallerEmail'), toLower(body('Get_ticket')?['AssigneeEmail'])), 'A', 'X'))
```
`C` = CEO, `A` = ผู้รับผิดชอบใบนี้, `X` = คนอื่น (จะถูกปฏิเสธทุกกรณี)

**d) Compose** ชื่อ `Current` (Expression): `body('Get_ticket')?['Status']?['Value']`

**e) Compose** ชื่อ `Transitions` วางข้อความนี้ตรง ๆ (ไม่ใช่ Expression) เป็นตารางเดียวกับ [../01-data-model.md](../01-data-model.md) รูปแบบ `สถานะปัจจุบัน|action|role` → `สถานะใหม่`
```json
{
  "New|ack|A": "Acknowledged",
  "New|start|A": "InProgress",
  "Acknowledged|start|A": "InProgress",
  "WaitingCEO|start|A": "InProgress",
  "New|wait|A": "WaitingCEO",
  "Acknowledged|wait|A": "WaitingCEO",
  "InProgress|wait|A": "WaitingCEO",
  "WaitingCEO|reply|C": "InProgress",
  "New|done|A": "Done",
  "Acknowledged|done|A": "Done",
  "InProgress|done|A": "Done",
  "WaitingCEO|done|A": "Done",
  "Done|close|C": "Closed",
  "Done|reopen|C": "InProgress",
  "New|cancel|C": "Closed",
  "Acknowledged|cancel|C": "Closed",
  "InProgress|cancel|C": "Closed",
  "WaitingCEO|cancel|C": "Closed",
  "Done|cancel|C": "Closed",
  "New|comment|A": "New",
  "Acknowledged|comment|A": "Acknowledged",
  "InProgress|comment|A": "InProgress",
  "WaitingCEO|comment|A": "WaitingCEO",
  "Done|comment|A": "Done",
  "New|comment|C": "New",
  "Acknowledged|comment|C": "Acknowledged",
  "InProgress|comment|C": "InProgress",
  "WaitingCEO|comment|C": "WaitingCEO",
  "Done|comment|C": "Done"
}
```

**f) Compose** ชื่อ `NewStatus` (Expression):
```
outputs('Transitions')?[concat(outputs('Current'), '|', outputs('In_action'), '|', outputs('Role'))]
```

**g) Condition** ชื่อ `Rejected` · ใช้โหมด Expression ของ Condition (หรือ Compose ผลก่อนแล้วเทียบกับ `true`):
```
or(not(equals(outputs('Current'), outputs('In_expected'))), empty(outputs('NewStatus')), and(equals(outputs('In_action'), 'comment'), empty(outputs('In_comment'))))
```
- **ฝั่ง True:**
  1. **Respond to a PowerApp or flow** · เพิ่ม Output แบบ Text 3 ตัว: `ok` = `false` · `id` = `outputs('In_ticketId')` · `message` (Expression):
     `if(not(equals(outputs('Current'), outputs('In_expected'))), 'STALE', 'ทำรายการนี้ไม่ได้ (สิทธิ์หรือสถานะไม่ถูกต้อง)')`
  2. **Terminate** · Status **Succeeded**
- **ฝั่ง False:** ว่าง

**h) Update item** ชื่อ `Save ticket` · List `Tickets` · Id: `outputs('In_ticketId')`
- ช่องบังคับใช้ค่าเดิม (Expression): Title `body('Get_ticket')?['Title']` · AssigneeEmail `body('Get_ticket')?['AssigneeEmail']` · DueDate `body('Get_ticket')?['DueDate']` · Priority Value `body('Get_ticket')?['Priority']?['Value']` · Source Value `body('Get_ticket')?['Source']?['Value']`
- **Status Value:** `outputs('NewStatus')`
- **IsOpen:** `not(equals(outputs('NewStatus'), 'Closed'))`
- **AckedAt:** `if(and(equals(outputs('Current'), 'New'), contains(createArray('ack', 'start', 'wait', 'done'), outputs('In_action'))), utcNow(), body('Get_ticket')?['AckedAt'])`
- **DoneAt:** `if(equals(outputs('NewStatus'), 'Done'), utcNow(), body('Get_ticket')?['DoneAt'])`
- **ClosedAt:** `if(equals(outputs('NewStatus'), 'Closed'), utcNow(), body('Get_ticket')?['ClosedAt'])`

**i) Create item** ชื่อ `Create history` · List `TicketHistory`
- Title `concat('T-', outputs('In_ticketId'))` · TicketID `outputs('In_ticketId')` · Action Value `outputs('In_action')`
- FromStatus `outputs('Current')` · ToStatus `outputs('NewStatus')` · Comment `outputs('In_comment')`
- ActorEmail `variables('CallerEmail')` · Source Value `App` · **Processed `Yes`**
- **CEOPending** (Expression): `and(equals(outputs('Role'), 'A'), contains(createArray('wait', 'done', 'comment'), outputs('In_action')))`
  (พนักงานถาม / ทำเสร็จ / เขียนความเห็น → บอทส่งเข้า LINE ของ CEO ทันที)

**j) Stop sharing an item or a file** · Library `TicketHistory` · Id `body('Create_history')?['ID']`

**k) Grant access to an item or a folder** · List `TicketHistory` · Id `body('Create_history')?['ID']` · Recipients `body('Get_ticket')?['AssigneeEmail']` · Roles Can view · Notify recipients No

**l) Condition** ชื่อ `CEO acted` · ช่องซ้าย `outputs('Role')` · is equal to · `C`
ฝั่ง True ใส่ **Post message in a chat or channel** (Teams) · Post as Flow bot · Chat with Flow bot · ฝั่ง False ว่าง
(เมื่อพนักงานกด CEO ไม่ได้รับ Teams: เรื่องที่ต้องตอบหรือปิดงานไปทาง LINE ผ่าน `CEOPending` ส่วนรับทราบ/กำลังทำ ดูในสรุปเช้า)
- Recipient (Expression): `body('Get_ticket')?['AssigneeEmail']`
- Message (Expression):
  ```
  concat('🔔 T-', outputs('In_ticketId'), ': ', if(equals(outputs('In_action'), 'comment'), 'มีความเห็นใหม่', json('{"Acknowledged":"รับทราบแล้ว","InProgress":"กำลังทำ","WaitingCEO":"รอคุณ CEO ตอบ","Done":"ทำเสร็จแล้ว รอตรวจ","Closed":"ปิดงานแล้ว"}')?[outputs('NewStatus')]))
  ```

**m) Respond to a PowerApp or flow** · `ok` = `true` · `id` = `outputs('In_ticketId')` · `message` = `outputs('NewStatus')`

### 1.4 Scope `Catch`
เหมือนคู่มือ ก ข้อ 4 (Run after: has failed, has timed out) เปลี่ยน Subject เป็น `concat('[CEO-APP] UpdateTicket ล้มเหลว T-', outputs('In_ticketId'))` และเพิ่ม **Respond to a PowerApp or flow** (`ok` = `false`, `id` = `outputs('In_ticketId')`, `message` = `ระบบขัดข้อง ลองใหม่อีกครั้ง`) **ก่อน** Terminate Failed

> ⚠️ ทุกการ์ด **Respond to a PowerApp or flow** ใน Flow เดียวกัน (ใน Rejected, ท้าย Try และใน Catch) ต้องมี Output **ชื่อและชนิดเหมือนกันทุกใบ**: `ok`, `id`, `message` เป็น Text ทั้ง 3 ตัว เรียงลำดับเดียวกัน ถ้าใบใดขาดหรือชนิดต่าง Power Automate จะไม่ยอมบันทึก

### 1.5 สิทธิ์การรัน
หน้า Flow → **Run only users** → Connections ของ SharePoint, Teams และ Outlook เลือก **Use this connection** (ของเจ้าของ Flow) ไม่ใช่ "Provided by run-only user" เพื่อให้พนักงานที่มีสิทธิ์อ่านอย่างเดียวยังอัปเดตงานผ่าน Flow ได้

---

## ส่วนที่ 2: สร้างแอป

### 2.1 สร้างแอปเปล่า
1. **https://make.powerapps.com** → **+ Create** → **Blank app** → **Blank canvas app** → รูปแบบ **Phone** · ชื่อ `CEO-APP`
2. **Data** (ไอคอนทรงกระบอก) → **Add data** → SharePoint → Site `CEO-Tickets` → ติ๊ก `Tickets`, `TicketHistory` → Connect
3. **Power Automate** (ไอคอนด้านซ้าย) → **Add flow** → เลือก `UpdateTicket`
4. **Settings** → **General** → **Data row limit** = `2000`

### 2.2 App
เลือก `App` ในแผง Tree view
- **OnStart:**
  ```powerfx
  Set(varMe, Lower(User().Email));
  If(!IsBlank(Param("ticketId")),
      Set(varTicket, LookUp(Tickets, ID = Value(Param("ticketId")))))
  ```
- **StartScreen:** `If(!IsBlank(Param("ticketId")), scrDetail, scrTickets)`
  (เปิดจากลิงก์ในข้อความ Teams แล้วไปที่งานนั้นทันที)

### 2.3 หน้า `scrTickets` (งานของฉัน)
เปลี่ยนชื่อ Screen1 เป็น `scrTickets` แล้วเพิ่ม
| Control | ชื่อ | Property | ค่า |
|---|---|---|---|
| Label | `lblHeader` | Text | `"งานจาก CEO"` |
| Vertical gallery (Blank) | `galTickets` | Items | `SortByColumns(Filter(Tickets, IsOpen = true, AssigneeEmail = varMe), "DueDate", SortOrder.Ascending)` |
| | | OnSelect | `Set(varTicket, ThisItem); Navigate(scrDetail)` |
| Label (ในแกลเลอรี) | `lblTitle` | Text | `ThisItem.Title` |
| Label (ในแกลเลอรี) | `lblMeta` | Text | `"T-" & ThisItem.ID & " · ส่ง " & Text(ThisItem.DueDate, "d mmm", "th-TH")` |
| Label (ในแกลเลอรี) | `lblStatus` | Text | `Switch(ThisItem.Status.Value, "New", "🆕 ใหม่", "Acknowledged", "👀 รับทราบ", "InProgress", "🔧 กำลังทำ", "WaitingCEO", "⏳ รอ CEO", "Done", "✅ รอ CEO ตรวจ")` |
| | | Color | `If(ThisItem.DueDate < Today(), Color.Red, Color.Black)` |
| Label | `lblEmpty` | Text / Visible | `"ไม่มีงานค้าง"` / `IsEmpty(galTickets.AllItems)` |
| Button | `btnRefresh` | Text / OnSelect | `"รีเฟรช"` / `Refresh(Tickets)` |

ตรวจว่าสูตร `Items` **ไม่มีสามเหลี่ยมเตือน Delegation** (ทั้ง `IsOpen = true` และ `AssigneeEmail = varMe` เป็นแบบ Delegable)

### 2.4 หน้า `scrDetail`
**New screen** → Blank → ชื่อ `scrDetail`
| Control | ชื่อ | Property | ค่า |
|---|---|---|---|
| Icon (Back) | `icoBack` | OnSelect | `Navigate(scrTickets)` |
| Label | `lblDTitle` | Text | `"T-" & varTicket.ID & " " & varTicket.Title` |
| Label | `lblDDue` | Text | `Switch(varTicket.Status.Value, "New", "🆕 ใหม่", "Acknowledged", "👀 รับทราบ", "InProgress", "🔧 กำลังทำ", "WaitingCEO", "⏳ รอ CEO", "Done", "✅ รอ CEO ตรวจ", "Closed", "🔒 ปิดแล้ว") & " · ส่ง " & Text(varTicket.DueDate, "dddd d mmmm", "th-TH") & If(varTicket.DueDate < Today(), " (เลยกำหนด)", "")` |
| Label | `lblDDetails` | Text | `varTicket.Details` |
| Button | `btnPhotos` | Text / Visible | `"ดูรูปที่แนบ"` / `varTicket.HasFiles` |
| | | OnSelect | `Launch("https://digitalfocusth.sharepoint.com/sites/CEO-Tickets/TicketFiles/T-" & varTicket.ID)` ⚠️ ตรวจว่าลิงก์เปิดโฟลเดอร์ได้ |
| Text input (Multiline) | `txtComment` | HintText | `"ความเห็นหรือคำถามถึง CEO"` |
| Button | `btnAck` | Text / Visible | `"รับทราบ"` / `varTicket.Status.Value = "New"` |
| Button | `btnStart` | Text / Visible | `"เริ่มทำ"` / `varTicket.Status.Value in ["New", "Acknowledged"]` |
| Button | `btnWait` | Text / Visible | `"ถาม CEO"` / `varTicket.Status.Value in ["New", "Acknowledged", "InProgress"]` |
| Button | `btnDone` | Text / Visible | `"ทำเสร็จแล้ว"` / `varTicket.Status.Value = "InProgress"` |
| Button | `btnComment` | Text / Visible | `"ส่งความเห็น"` / `!IsBlank(Trim(txtComment.Text))` |
| Vertical gallery | `galHistory` | Items | `SortByColumns(Filter(TicketHistory, TicketID = varTicket.ID), "Created", SortOrder.Descending)` |
| Label (ในแกลเลอรี) | | Text | `Text(ThisItem.Created, "d mmm hh:mm", "th-TH") & " · " & ThisItem.Action.Value & If(IsBlank(ThisItem.Comment), "", ": " & ThisItem.Comment)` |

**OnSelect ของปุ่มสถานะ** ใช้รูปแบบเดียวกัน เปลี่ยนแค่คำใน `"ack"`:
- `btnAck` → `"ack"` · `btnStart` → `"start"` · `btnWait` → `"wait"` · `btnDone` → `"done"` · `btnComment` → `"comment"`
```powerfx
Set(varBusy, true);
Set(varResult, UpdateTicket.Run({number: varTicket.ID, text: "ack", text_1: varTicket.Status.Value, text_2: txtComment.Text}));
Set(varBusy, false);
If(varResult.ok = "true",
    Notify("บันทึกแล้ว", NotificationType.Success); Reset(txtComment),
    Notify(If(varResult.message = "STALE", "ข้อมูลเปลี่ยนไปแล้ว กำลังโหลดใหม่", varResult.message), NotificationType.Error));
Refresh(Tickets);
Refresh(TicketHistory);
Set(varTicket, LookUp(Tickets, ID = varTicket.ID))
```
ตั้ง **DisplayMode** ของทุกปุ่มเป็น `If(varBusy, DisplayMode.Disabled, DisplayMode.Edit)` กันการกดซ้ำ

`btnWait` ควรบังคับให้พิมพ์คำถาม: ตั้ง DisplayMode เป็น `If(varBusy || IsBlank(Trim(txtComment.Text)), DisplayMode.Disabled, DisplayMode.Edit)`

### 2.4.0 ปุ่มสถานะ: แดงทั้งหมด กดแล้วเป็นพื้นขาวมี ✓ ไม่บังคับลำดับ
ทุกปุ่มแสดงตลอด (**Visible** = `true`) สไตล์เดียวกันทั้ง 5 ปุ่ม
- **กดได้:** พื้นแดงทึบ ตัวอักษรขาว
- **กดแล้ว:** พื้นขาว ขอบและตัวอักษรแดง มี ✓ กดซ้ำไม่ได้
- **กดไม่ได้ตอนนี้** (เช่น ยังไม่พิมพ์ข้อความ หรืองานปิดแล้ว): พื้นแดงจาง ตัวอักษรขาว

ไม่บังคับลำดับ กด "ทำเสร็จแล้ว" ได้เลยโดยไม่ต้องรับทราบก่อน ขั้นที่ข้ามไปจะขึ้นทึบเอง (ถือว่าผ่านแล้ว) · "ส่งความเห็น" กดได้ไม่จำกัดจนกว่างานปิด · "ถาม CEO" กดได้อีกหลัง CEO ตอบ (งานกลับเป็น "กำลังทำ")

**ทุกปุ่ม (เลือกพร้อมกันแล้วตั้งครั้งเดียว):** Visible `true` · Fill `clrAccent` · Color `Color.White` · BorderColor `clrAccent` · BorderThickness `2` · HoverFill `ColorFade(clrAccent, -15%)` · PressedFill `ColorFade(clrAccent, -25%)`

| ปุ่ม | Text | DisplayMode | สถานะ "กดแล้ว" (ใช้ในสูตรสี) |
|---|---|---|---|
| `btnAck` | `If(varTicket.Status.Value = "New", "รับทราบ", "✓ รับทราบแล้ว")` | `If(varBusy \|\| varTicket.Status.Value <> "New", DisplayMode.Disabled, DisplayMode.Edit)` | `varTicket.Status.Value <> "New"` |
| `btnStart` | `If(varTicket.Status.Value in ["InProgress", "Done", "Closed"], "✓ เริ่มทำแล้ว", "เริ่มทำ")` | `If(varBusy \|\| !(varTicket.Status.Value in ["New", "Acknowledged", "WaitingCEO"]), DisplayMode.Disabled, DisplayMode.Edit)` | `varTicket.Status.Value in ["InProgress", "Done", "Closed"]` |
| `btnDone` | `If(varTicket.Status.Value in ["Done", "Closed"], "✓ ทำเสร็จแล้ว", "ทำเสร็จแล้ว")` | `If(varBusy \|\| varTicket.Status.Value in ["Done", "Closed"], DisplayMode.Disabled, DisplayMode.Edit)` | `varTicket.Status.Value in ["Done", "Closed"]` |
| `btnWait` | `If(varTicket.Status.Value = "WaitingCEO", "⏳ รอ CEO ตอบ", "ถาม CEO")` | `If(varBusy \|\| IsBlank(Trim(txtComment.Text)) \|\| !(varTicket.Status.Value in ["New", "Acknowledged", "InProgress"]), DisplayMode.Disabled, DisplayMode.Edit)` | `varTicket.Status.Value = "WaitingCEO"` |
| `btnComment` | `"ส่งความเห็น"` | `If(varBusy \|\| IsBlank(Trim(txtComment.Text)) \|\| varTicket.Status.Value = "Closed", DisplayMode.Disabled, DisplayMode.Edit)` | `false` (กดได้หลายครั้ง ไม่ทึบ) |

**สูตรสีเมื่อกดไม่ได้** ใส่ทุกปุ่ม โดยแทน `<กดแล้ว>` ด้วยค่าคอลัมน์ขวาสุดของปุ่มนั้น
- DisabledFill: `If(<กดแล้ว>, Color.White, ColorFade(clrAccent, 60%))`
- DisabledColor: `If(<กดแล้ว>, clrAccent, Color.White)`
- DisabledBorderColor: `If(<กดแล้ว>, clrAccent, ColorFade(clrAccent, 60%))`

`galHistory` Y = `btnComment.Y + 70` · ต้องแก้ Flow `UpdateTicket` ให้รับลำดับอิสระด้วย (Transitions ข้อ e และ AckedAt ข้อ h ด้านบน)

**ถาม CEO ต่างจากส่งความเห็นอย่างไร**
| | ถาม CEO | ส่งความเห็น |
|---|---|---|
| ใช้เมื่อ | ติดปัญหา ต้องให้ CEO ตัดสินใจก่อนทำต่อ | แจ้งความคืบหน้าหรือข้อมูลเพิ่ม ไม่ต้องรอคำตอบ |
| สถานะงาน | เปลี่ยนเป็น ⏳ รอ CEO (งานหยุดรอ) | ไม่เปลี่ยน |
| CEO ได้รับ | LINE พร้อมปุ่ม [💬 ตอบ] และนับใน "รอคุณตอบ" ของสรุปเช้า | LINE แจ้งให้ทราบ |
| หลัง CEO ตอบ | งานกลับเป็น 🔧 กำลังทำ อัตโนมัติ | – |

### 2.4.1 รูปแบบหน้าตา
ตั้งสีไว้ที่เดียวด้วย Named formulas แล้วทุก Control อ้างชื่อสี เปลี่ยนสีทั้งแอปได้ในจุดเดียว (เปลี่ยน `clrPrimary` เป็นสีแบรนด์ Digital Focus เมื่อได้รหัสสีจริง)

**App → Formulas**
```powerfx
clrPrimary = ColorValue("#1F4E79");
clrBg = ColorValue("#F3F5F8");
clrText = ColorValue("#1B1B1B");
clrMuted = ColorValue("#6B7280");
clrLine = ColorValue("#E2E6EB");
clrDanger = ColorValue("#C62828");
clrSuccess = ColorValue("#2E7D32");
```

**หน้า `scrDetail`** (ใช้กับ `scrTickets` แบบเดียวกันได้)
| Control | Property |
|---|---|
| `scrDetail` | Fill `clrBg` |
| Rectangle ใหม่ `recHeader` (Insert → Shapes → Rectangle) ส่งไปหลังสุด: คลิกขวา → Reorder → Send to back | X `0` · Y `0` · Width `Parent.Width` · Height `100` · Fill `clrPrimary` |
| `icoBack` | Color `Color.White` · Width/Height `40` · Y `30` |
| `lblDTitle` | Color `Color.White` · Size `18` · FontWeight `FontWeight.Semibold` · Y `10` · Height `80` · VerticalAlign `VerticalAlign.Middle` |
| `lblDDue` | Size `14` · FontWeight `FontWeight.Semibold` · Color `If(varTicket.DueDate < Today(), clrDanger, clrMuted)` |
| `lblDDetails` | Size `14` · Color `clrText` · Fill `Color.White` · PaddingLeft/Right/Top/Bottom `12` · BorderColor `clrLine` · BorderThickness `1` |
| `txtComment` | Size `14` · BorderColor `clrLine` · Fill `Color.White` |
| ปุ่มหลัก `btnAck` `btnStart` | Fill `clrPrimary` · Color `Color.White` · Size `15` · Height `50` |
| `btnDone` | Fill `clrSuccess` · Color `Color.White` · Size `15` · Height `50` |
| ปุ่มรอง `btnWait` `btnComment` `btnPhotos` | Fill `Color.White` · Color `clrPrimary` · BorderColor `clrPrimary` · BorderThickness `2` · Size `15` · Height `50` |
| ทุกปุ่ม | DisabledFill `ColorFade(Self.Fill, 60%)` · มุมโค้ง: RadiusTopLeft/TopRight/BottomLeft/BottomRight `10` |
| `galHistory` | Fill `Color.White` · TemplatePadding `0` |
| `lblHist` | Size `12` · Color `clrMuted` · Height `Parent.TemplateHeight - 1` |
| Rectangle ในแกลเลอรี `recHistLine` | X `16` · Y `Parent.TemplateHeight - 1` · Width `Parent.TemplateWidth - 32` · Height `1` · Fill `clrLine` |

> Control แบบ **Modern** ใช้ชื่อ Property ต่างจากตาราง: สีตัวอักษร `FontColor` · ขนาด `FontSize` · มุมโค้ง `BorderRadius` · ปุ่มใช้ `Appearance` (Primary / Secondary / Outline) และ `BasePaletteColor` = `clrPrimary` แทน Fill · Text input ใช้ `.Value` แทน `.Text`

### 2.4.2 ใช้สีและโลโก้ของบริษัท
สีจากชุดสีเว็บไซต์บริษัท (กรมท่าเป็นพื้นหลัก ปุ่มหลักสีแดง เส้นแดงใต้แถบหัว ปุ่มรองพื้นขาวขอบเทา มุมโค้งแบบแคปซูล)

**App → Formulas** (แทนชุดเดิมใน 2.4.1)
```powerfx
clrPrimary = ColorValue("#262679");   // กรมท่า: แถบหัว หัวข้อ
clrIndigo = ColorValue("#2F3192");    // ตัวอักษรปุ่มรอง ลิงก์
clrAccent = ColorValue("#E3262B");    // แดง: ปุ่มหลัก เส้นใต้แถบหัว
clrBg = ColorValue("#F4F4F9");
clrText = ColorValue("#0D1726");
clrMuted = ColorValue("#4A586C");
clrLine = ColorValue("#E2E2EC");
clrDanger = ColorValue("#E3262B");
clrSuccess = ColorValue("#1F9A4B");   // เขียวจากโลโก้
```

**ฟอนต์:** เว็บใช้ Anuphan และ IBM Plex Sans Thai ซึ่ง Canvas app ใช้ไม่ได้ (เลือกได้เฉพาะฟอนต์ในรายการของ Power Apps) ใช้ `Font.'Segoe UI'` ทุก Control ตัวไทยจะแสดงด้วยฟอนต์ไทยของเครื่อง หัวข้อใช้ `FontWeight.Semibold` · วิธีเร็ว: คลิกพื้นที่ว่างของหน้าจอ → **Ctrl+A** → Font = `Font.'Segoe UI'` ทำทีละหน้าจอ

**ปุ่ม** (มุมโค้ง `25` = ครึ่งหนึ่งของความสูง 50 ได้ทรงแคปซูลแบบเว็บ)
| ปุ่ม | Fill | Color | Border |
|---|---|---|---|
| หลัก: `btnAck` `btnStart` | `clrAccent` | `Color.White` | 0 |
| `btnDone` | `clrPrimary` | `Color.White` | 0 |
| รอง: `btnWait` `btnComment` `btnPhotos` `btnRefresh` | `Color.White` | `clrIndigo` | BorderColor `clrLine` · BorderThickness `1` |

**ไฟล์ภาพ** (อยู่ในชุดไฟล์เว็บไซต์: `img/logo.png`, `img/logo-white.png`, `img/ceo.jpg`) แถบซ้าย **Media** → **Upload**
- `df-logo-white` โลโก้ตัวอักษรขาว ใช้บนแถบกรมท่า
- `df-app-icon` 512×512 พื้นขาว สำหรับไอคอนแอป
- `ceo-avatar` 300×300 วงกลม (ใช้เมื่อ CEO อนุญาต)

**แถบหัวทั้ง 2 หน้า (แบบหน้าแรกของเว็บ: พื้นกรมท่า + เส้นแดงด้านล่าง)**
| Control | ชื่อ | Property |
|---|---|---|
| Rectangle | `recTop` (scrTickets) / `recHeader` (scrDetail) | X `0` · Y `0` · Width `Parent.Width` · Height `90` · Fill `clrPrimary` · ส่งไปหลังสุด |
| Rectangle | `recTopLine` / `recHeaderLine` | X `0` · Y `90` · Width `Parent.Width` · Height `4` · Fill `clrAccent` |
| Image (scrTickets) | `imgLogo` | X `16` · Y `12` · Width `150` · Height `66` · Image `'df-logo-white'` · ImagePosition `ImagePosition.Fit` |
| Image (scrTickets ไม่บังคับ) | `imgCEO` | X `Parent.Width - 76` · Y `15` · Width/Height `60` · Image `'ceo-avatar'` |
| `lblHeader` (เดิม) | | X `20` · Y `110` · Size `20` · FontWeight `FontWeight.Semibold` · Color `clrPrimary` |
| `galTickets` (เดิม) | | Y `155` · Height `Parent.Height - 235` · Fill `Color.White` |

`scrTickets` และ `scrDetail` Fill `clrBg` · ใน scrDetail ปรับ `lblDDue` Y เป็น `110` เพื่อเว้นเส้นแดง

**ไอคอนแอป:** Settings → General → **Icon** → อัปโหลด `df-app-icon` · Background fill = ขาว

**รูป CEO:** ต้องได้รับอนุญาตจาก CEO ก่อน เพราะรูปจะอยู่บนเครื่องพนักงานทุกคน ใช้เป็นรูปวงกลมเล็กบนแถบหัวเท่านั้น ไม่ใช้เป็นไอคอนแอป (ไอคอนเล็กมาก ดูไม่ออกว่าเป็นแอปบริษัท และข้อตกลงคือไอคอนเป็นโลโก้ Digital Focus)

### 2.4.4 ช่องคำสั่งเพิ่มเติมจาก CEO
CEO เพิ่มรายละเอียดให้งานที่สั่งไปแล้วผ่าน LINE ได้ บอทเก็บไว้ในคอลัมน์ `CEOExtra` (สร้างตาม[คู่มือ ก ข้อ 7.1](A-flow-onlineevent.md) ก่อน)
1. แถบซ้าย **Data** → `Tickets` → **⋯** → **Refresh** (ให้แอปเห็นคอลัมน์ใหม่)
2. หน้า `scrDetail` → Insert → **Text label** ชื่อ `lblDExtra`

| Property | ค่า |
|---|---|
| Text | `"➕ คำสั่งเพิ่มเติมจาก CEO" & Char(10) & varTicket.CEOExtra` |
| Visible | `!IsBlank(varTicket.CEOExtra)` |
| X / Width | เหมือน `lblDDetails` |
| Y | `lblDDetails.Y + lblDDetails.Height + 10` |
| AutoHeight | `true` |
| Size · Color | `14` · `clrText` |
| Fill · BorderColor · BorderThickness | `ColorFade(clrAccent, 92%)` · `clrAccent` · `1` |
| PaddingLeft/Right/Top/Bottom | `12` |

3. แก้ `txtComment` → Y ให้อยู่ใต้ช่องนี้เมื่อมีข้อความ:
   ```
   If(lblDExtra.Visible, lblDExtra.Y + lblDExtra.Height, lblDDetails.Y + lblDDetails.Height) + 10
   ```
4. ทดสอบ: เปิดงานที่ CEO เพิ่มรายละเอียดแล้ว ต้องเห็นกรอบสีชมพูอ่อน **➕ คำสั่งเพิ่มเติมจาก CEO** พร้อมวันเวลา ส่วนงานที่ไม่มี กรอบต้องไม่แสดงและช่องพิมพ์ข้อความต่อจากรายละเอียดเหมือนเดิม

### 2.4.5 หน้าภาพรวม `scrHome` (หน้าแรกของพนักงาน)
หน้าตาตามภาพตัวอย่าง "พนักงาน: ภาพรวม" ใน Artifact ออกแบบ (หัวแอปมีโลโก้และรูปคุณสมชายสั่งงานเหมือนหน้าอื่น) เห็นเฉพาะงานของตัวเอง ใช้เวลาประมาณ 45 นาที

1. **New screen** → Blank → ชื่อ `scrHome` → ลากขึ้นเป็นหน้าแรกใน Tree view
2. คัดลอก `recTop` `recTopLine` `imgLogo` `imgCEO` จาก `scrTickets` มาวาง (Ctrl+C / Ctrl+V)
3. **scrHome → OnVisible** โหลดงานของตัวเองครั้งเดียว (Filter ด้วยอีเมลเป็นแบบ Delegable)
   ```powerfx
   ClearCollect(colMine, Filter(Tickets, AssigneeEmail = varMe))
   ```
4. **App → Formulas** เพิ่มต่อท้าย
   ```powerfx
   myOpen = Filter(colMine, IsOpen = true);
   myLate = Filter(myOpen, Status.Value <> "Done", DueDate < Today());
   myDone30 = Filter(colMine, !IsBlank(DoneAt), DoneAt >= DateAdd(Today(), -30, TimeUnit.Days));
   ```
5. ใส่ Control

| Control | ชื่อ | ค่า |
|---|---|---|
| Label | `lblHello` | Text `"สวัสดีค่ะคุณ" & First(Split(User().FullName, " ")).Value` · Size `22` · Bold · Color `clrPrimary` · X `20` · Y `110` |
| Label | `lblHelloSub` | Text `Text(Today(), "dddd d mmmm", "th-TH") & " · งานจาก CEO เปิดอยู่ " & CountRows(myOpen) & " งาน"` · Size `13` · Color `clrMuted` · Y `lblHello.Y + 34` |
| Button ×4 (การ์ด) | `btnKLate` `btnKNew` `btnKWait` `btnKDone` | Width `(Parent.Width - 50) / 2` · Height `88` · RadiusTopLeft…BottomRight `14` · Align `Align.Left` · VerticalAlign `VerticalAlign.Top` · PaddingLeft/Top `14` · X `20` และ `30 + (Parent.Width - 50) / 2` · Y `lblHelloSub.Y + 36` และ `+ 98` |
| | `btnKLate` | Text `"เลยกำหนด" & Char(10) & CountRows(myLate)` · Fill `clrAccent` · Color `Color.White` |
| | `btnKNew` | Text `"ยังไม่รับทราบ" & Char(10) & CountRows(Filter(myOpen, Status.Value = "New"))` · Fill `Color.White` · Color `clrPrimary` · BorderColor `clrLine` |
| | `btnKWait` | Text `"รอ CEO ตอบ" & Char(10) & CountRows(Filter(myOpen, Status.Value = "WaitingCEO"))` · สไตล์เดียวกับ `btnKNew` · Color `clrMuted` |
| | `btnKDone` | Text `"รอ CEO ตรวจ" & Char(10) & CountRows(Filter(myOpen, Status.Value = "Done"))` · สไตล์เดียวกับ `btnKNew` · Color `clrSuccess` |
| | ทั้ง 4 ปุ่ม | OnSelect `Navigate(scrTickets)` |
| Label | `lblTodoHead` | Text `"ต้องทำก่อน"` · Bold · Y `btnKDone.Y + 100` |
| Vertical gallery (Blank) | `galTodo` | Items `FirstN(SortByColumns(Filter(myOpen, Status.Value <> "Done"), "DueDate", SortOrder.Ascending), 4)` · TemplateSize `52` · Height `210` · Y `lblTodoHead.Y + 30` · OnSelect `Set(varTicket, ThisItem); Navigate(scrDetail)` |
| Label ในแกลเลอรี | `lblTodo` | Text `"T-" & ThisItem.ID & " " & ThisItem.Title & Char(10) & If(ThisItem.DueDate < Today(), "เลย " & DateDiff(ThisItem.DueDate, Today()) & " วัน", "ส่ง " & Text(ThisItem.DueDate, "ddd d mmm", "th-TH"))` · Color `If(ThisItem.DueDate < Today(), clrDanger, clrText)` |
| Label | `lblStats` | Text ด้านล่าง · Fill `Color.White` · BorderColor `clrLine` · Padding `12` · AutoHeight · Y `galTodo.Y + galTodo.Height + 10` |

`lblStats` Text:
```powerfx
"ผลงาน 30 วันที่ผ่านมา" & Char(10) &
"ได้รับ " & CountRows(Filter(colMine, Created >= DateAdd(Today(), -30, TimeUnit.Days))) & " งาน · " &
"เสร็จทันกำหนด " & CountIf(myDone30, DoneAt < DateAdd(DueDate, 1, TimeUnit.Days)) & "/" & CountRows(myDone30) &
If(CountRows(myDone30) > 0, " · เฉลี่ย " & Round(Average(myDone30, DateDiff(Created, DoneAt, TimeUnit.Hours)) / 24, 1) & " วัน/งาน", "")
```

6. **แถบล่าง 2 ปุ่ม** (ใส่ทั้ง `scrHome` และ `scrTickets`): `btnTabHome` "ภาพรวม" → `Navigate(scrHome)` · `btnTabList` "งานจาก CEO" → `Navigate(scrTickets)` · Y `Parent.Height - 66` · Height `66` · Width `Parent.Width / 2` · หน้าที่เปิดอยู่ใช้ Color `clrAccent` อีกปุ่ม `clrMuted` · แล้วลด `galTickets.Height` ลง 66
7. **App → StartScreen** = `If(!IsBlank(Param("ticketId")), scrDetail, scrHome)` (ลิงก์จาก Teams ยังเปิดหน้างานโดยตรง)
8. ทดสอบด้วยบัญชีพนักงาน: ตัวเลขตรงกับงานของตัวเองเท่านั้น · แตะงานใน "ต้องทำก่อน" แล้วเปิดหน้ารายละเอียด · ส่งไฟล์หรือเปลี่ยนสถานะแล้วกลับมา ตัวเลขอัปเดต (OnVisible โหลดใหม่ทุกครั้งที่เข้าหน้า)

### 2.4.3 แสดงสวยทั้งมือถือและคอมพิวเตอร์ (Responsive)
บนคอม แถบหัวกว้างเต็มจอ เนื้อหาเป็นคอลัมน์กว้างไม่เกิน 720 อยู่กลางจอแบบหน้าเว็บ บนมือถือเต็มจอเหมือนเดิม

1. **Settings** → **Display** → **Scale to fit** = Off (Lock aspect ratio จะปิดตามเอง) · Lock orientation = Off
2. **App → Formulas** เพิ่มต่อท้าย
   ```powerfx
   colW = Min(App.Width, 720);          // ความกว้างคอลัมน์เนื้อหา
   colX = (App.Width - colW) / 2;       // ระยะจากขอบซ้ายให้อยู่กลางจอ
   halfW = (colW - 50) / 2;             // ปุ่มครึ่งแถว
   ```
3. ตั้ง X และ Width ใหม่ (Y และ Height เดิมใช้ได้)

| หน้าจอ | Control | X | Width |
|---|---|---|---|
| ทั้งสอง | `recTop` `recTopLine` `recHeader` `recHeaderLine` | `0` | `Parent.Width` |
| scrTickets | `imgLogo` | `colX + 16` | (เดิม) |
| | `imgCEO` | `colX + colW - 76` | (เดิม) |
| | `lblHeader` `galTickets` | `colX` | `colW` |
| | `btnRefresh` | `colX + 20` | `colW - 40` |
| scrDetail | `icoBack` | `colX + 10` | (เดิม) |
| | `lblDTitle` | `colX + 60` | `colW - 80` |
| | `lblDDue` `lblDDetails` `lblDExtra` `txtComment` `lblCommentHelp` `btnComment` `attFiles` | `colX + 20` | `colW - 40` |
| | `btnAck` `btnWait` `btnPhotos` | `colX + 20` | `halfW` |
| | `btnStart` `btnDone` `btnUpload` | `colX + 30 + halfW` | `halfW` |
| | `galHistory` | `colX` | `colW` |

ตัวใน Gallery (`lblTitle` `lblMeta` `lblStatus` `lblHist` `recHistLine`) อ้าง `Parent.TemplateWidth` อยู่แล้ว ไม่ต้องแก้
ทดสอบ: แถบล่างของ Studio เปลี่ยนขนาดจอ (ไอคอนมือถือ / แท็บเล็ต / คอม) ทุกขนาดต้องไม่มีปุ่มล้นหรือซ้อน

### 2.5 บันทึก เผยแพร่ และแชร์
1. **Save** → **Publish**
2. **Share** → เพิ่มพนักงานกลุ่มทดลองก่อน (PM, การตลาด, Presales, Sales, คุณ Suchada) แบบ **User** (ไม่ใช่ Co-owner ยกเว้นคุณ Suchada)
   การแชร์แอป **ไม่ได้** ให้สิทธิ์เห็นข้อมูลใน SharePoint เพิ่ม พนักงานเห็นเฉพาะงานที่ Flow ให้สิทธิ์
3. คัดลอก **Web link** ของแอป (หน้า Details) ไว้ใช้ข้อ 2.6

### 2.6 ใส่ลิงก์เปิดแอปในข้อความ Teams
แทนลิงก์ SharePoint ในข้อความ Teams ของ Flow `OnLineEvent` (คู่มือ ก ข้อ d, 6.2 ข้อ 3 และ 7.2) ด้วยลิงก์แอป แอปเปิดหน้างานนั้นเองเพราะ `StartScreen` อ่าน `Param("ticketId")` (ข้อ 2.2)
- ลิงก์ต้องเป็นแบบ `<a href>` (ข้อความธรรมดา Teams ไม่ทำให้กดได้)
- Web link มี `?tenantId=...` อยู่แล้ว จึงต่อด้วย `&ticketId=`

ในสูตรของคู่มือ ก ให้เปลี่ยนส่วนท้าย
```
' <a href="https://digitalfocusth.sharepoint.com/sites/CEO-Tickets/Lists/Tickets/DispForm.aspx?ID=', triggerBody()?['TicketID'], '">เปิดดูงาน</a>'
```
เป็น (แทน `<Web link>` ด้วยลิงก์จากข้อ 2.5)
```
' <a href="<Web link>&ticketId=', triggerBody()?['TicketID'], '">เปิดในแอป</a>'
```
ทดสอบ: พนักงานกด **เปิดในแอป** ใน Teams แล้วแอปต้องเปิดหน้างานนั้นทันที (ไม่ใช่หน้ารายการ)

### 2.7 ติดตั้งบนมือถือพนักงาน
1. ติดตั้งแอป **Power Apps** จาก App Store / Google Play แล้วล็อกอินด้วยบัญชีบริษัท
2. เปิดแอป `CEO-APP` → ปุ่ม **…** → **Pin to home screen** / **Add to home screen**
3. เปิดการแจ้งเตือนของแอป **Teams** บนมือถือ (ช่องทางแจ้งเตือนตอนนี้)

## ทดสอบ
ใช้แผนทดสอบ [../04-test-plan.md](../04-test-plan.md) หมวด 1 (ความลับ) และ 2 (เส้นทางสถานะ) โดยเฉพาะ
- S6: พนักงาน A แก้งานของ B ผ่าน Flow ต้องถูกปฏิเสธ
- W5: กด "ทำเสร็จแล้ว" ตอนสถานะ `New` ต้องไม่มีปุ่มนี้ และถ้าเรียก Flow ตรงต้องถูกปฏิเสธ
- W6: กดรับทราบสองครั้งเร็ว ๆ ครั้งที่สองต้องได้ "ข้อมูลเปลี่ยนไปแล้ว"
