# คู่มือ ค: แอป Power Apps สำหรับพนักงาน

พนักงานใช้แอปนี้ดูงานที่ CEO สั่ง กดรับทราบ อัปเดตสถานะ และเขียนความเห็น
มี 2 ส่วน ต้องทำตามลำดับ: **ส่วนที่ 1 Flow `UpdateTicket`** (แอปเรียกใช้ทุกครั้งที่กดปุ่ม) แล้วจึง **ส่วนที่ 2 ตัวแอป**
ใช้เวลาประมาณ 3–4 ชั่วโมง ทำหลัง [คู่มือ ก](A-flow-onlineevent.md) และ [คู่มือ ข](B-setup-lists.md)

หน้าจอของ CEO (Dashboard, สร้างงาน, ปฏิทิน) อยู่ใน [../02-power-fx.md](../02-power-fx.md) เพิ่มทีหลังในแอปเดียวกันได้ ตอนนี้ CEO สั่งงานและดูสรุปผ่าน LINE อยู่แล้ว

> ⚠️ วิธีพิมพ์ Expression เหมือนคู่มือ ก: คลิกช่อง → ไอคอน **fx** → วาง → **Add**

---

## ส่วนที่ 1: Flow `UpdateTicket`

แอปห้ามแก้ SharePoint เอง (พนักงานมีสิทธิ์แค่อ่าน) ทุกการเปลี่ยนสถานะต้องผ่าน Flow นี้ ซึ่งตรวจว่า **ใครกด** และ **เปลี่ยนจากสถานะไหนไปไหนได้**

### 1.1 สร้าง Flow และ Input
1. make.powerautomate.com → (ใน Solution `CEO-APP` ถ้ามี) **+ New** → **Cloud flow** → **Instant**
2. ชื่อ `UpdateTicket` · Trigger: **When Power Apps calls a flow (V2)** → Create
3. คลิก Trigger → **+ Add an input** สร้างตามลำดับนี้
   | ชนิด | ชื่อ | บังคับ |
   |---|---|---|
   | Number | `ticketId` | ใช่ |
   | Text | `action` | ใช่ |
   | Text | `expectedStatus` | ใช่ |
   | Text | `comment` | ไม่ (คลิก … ของ Input → Make the field optional) |

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
  "New|wait|A": "WaitingCEO",
  "Acknowledged|wait|A": "WaitingCEO",
  "InProgress|wait|A": "WaitingCEO",
  "WaitingCEO|reply|C": "InProgress",
  "InProgress|done|A": "Done",
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
- **AckedAt:** `if(and(equals(outputs('Current'), 'New'), contains(createArray('ack', 'start', 'wait'), outputs('In_action'))), utcNow(), body('Get_ticket')?['AckedAt'])`
- **DoneAt:** `if(equals(outputs('NewStatus'), 'Done'), utcNow(), body('Get_ticket')?['DoneAt'])`
- **ClosedAt:** `if(equals(outputs('NewStatus'), 'Closed'), utcNow(), body('Get_ticket')?['ClosedAt'])`

**i) Create item** ชื่อ `Create history` · List `TicketHistory`
- Title `concat('T-', outputs('In_ticketId'))` · TicketID `outputs('In_ticketId')` · Action Value `outputs('In_action')`
- FromStatus `outputs('Current')` · ToStatus `outputs('NewStatus')` · Comment `outputs('In_comment')`
- ActorEmail `variables('CallerEmail')` · Source Value `App` · **Processed `Yes`**

**j) Stop sharing an item or a file** · Library `TicketHistory` · Id `body('Create_history')?['ID']`

**k) Grant access to an item or a folder** · List `TicketHistory` · Id `body('Create_history')?['ID']` · Recipients `body('Get_ticket')?['AssigneeEmail']` · Roles Can view · Notify recipients No

**l) Post message in a chat or channel** (Teams) · Post as Flow bot · Chat with Flow bot
- Recipient (Expression) แจ้งอีกฝ่ายเสมอ:
  `if(equals(outputs('Role'), 'A'), first(body('Get_ceo')?['value'])?['Value'], body('Get_ticket')?['AssigneeEmail'])`
- Message (Expression):
  ```
  concat('🔔 T-', outputs('In_ticketId'), ': ', if(equals(outputs('In_action'), 'comment'), 'มีความเห็นใหม่', json('{"Acknowledged":"รับทราบแล้ว","InProgress":"กำลังทำ","WaitingCEO":"รอคุณ CEO ตอบ","Done":"ทำเสร็จแล้ว รอตรวจ","Closed":"ปิดงานแล้ว"}')?[outputs('NewStatus')]))
  ```

**m) Respond to a PowerApp or flow** · `ok` = `true` · `id` = `outputs('In_ticketId')` · `message` = `outputs('NewStatus')`

### 1.4 Scope `Catch`
เหมือนคู่มือ ก ข้อ 4 (Run after: has failed, has timed out) เปลี่ยน Subject เป็น `concat('[CEO-APP] UpdateTicket ล้มเหลว T-', outputs('In_ticketId'))` และเพิ่ม **Respond to a PowerApp or flow** (`ok` = `false`, `message` = `ระบบขัดข้อง ลองใหม่อีกครั้ง`) **ก่อน** Terminate Failed

### 1.5 สิทธิ์การรัน
หน้า Flow → **Run only users** → Connections ของ SharePoint, Teams และ Outlook เลือก **Use this connection** (ของเจ้าของ Flow) ไม่ใช่ "Provided by run-only user" เพื่อให้พนักงานที่มีสิทธิ์อ่านอย่างเดียวยังอัปเดตงานผ่าน Flow ได้

---

## ส่วนที่ 2: สร้างแอป

### 2.1 สร้างแอปเปล่า
1. **https://make.powerapps.com** → (ใน Solution `CEO-APP` ถ้ามี) **+ New** → **App** → **Canvas app** → รูปแบบ **Phone** · ชื่อ `CEO-APP`
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
| Label | `lblDDue` | Text | `"ส่ง " & Text(varTicket.DueDate, "dddd d mmmm", "th-TH") & If(varTicket.DueDate < Today(), " (เลยกำหนด)", "")` |
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
Set(varResult, UpdateTicket.Run(varTicket.ID, "ack", varTicket.Status.Value, txtComment.Text));
Set(varBusy, false);
If(varResult.ok = "true",
    Notify("บันทึกแล้ว", NotificationType.Success); Reset(txtComment),
    Notify(If(varResult.message = "STALE", "ข้อมูลเปลี่ยนไปแล้ว กำลังโหลดใหม่", varResult.message), NotificationType.Error));
Refresh(Tickets);
Set(varTicket, LookUp(Tickets, ID = varTicket.ID))
```
ตั้ง **DisplayMode** ของทุกปุ่มเป็น `If(varBusy, DisplayMode.Disabled, DisplayMode.Edit)` กันการกดซ้ำ

`btnWait` ควรบังคับให้พิมพ์คำถาม: ตั้ง DisplayMode เป็น `If(varBusy || IsBlank(Trim(txtComment.Text)), DisplayMode.Disabled, DisplayMode.Edit)`

### 2.5 บันทึก เผยแพร่ และแชร์
1. **Save** → **Publish**
2. **Share** → เพิ่มพนักงานกลุ่มทดลองก่อน (PM, การตลาด, Presales, Sales, คุณ Suchada) แบบ **User** (ไม่ใช่ Co-owner ยกเว้นคุณ Suchada)
   การแชร์แอป **ไม่ได้** ให้สิทธิ์เห็นข้อมูลใน SharePoint เพิ่ม พนักงานเห็นเฉพาะงานที่ Flow ให้สิทธิ์
3. คัดลอก **Web link** ของแอป (หน้า Details) ไว้ใช้ข้อ 2.6

### 2.6 ใส่ลิงก์เปิดแอปในข้อความ Teams
แก้ Message ใน Flow `OnLineEvent` (คู่มือ ก ข้อ d) และ `UpdateTicket` (ข้อ l) ต่อท้ายด้วย:
```
, ' เปิดงาน: <Web link>&ticketId=', <เลขงาน>
```
ตัวอย่างใน `OnLineEvent`: `concat('📌 งานใหม่จาก CEO: T-', triggerBody()?['TicketID'], ' เปิดงาน: https://apps.powerapps.com/play/e/.../a/...?tenantId=...&ticketId=', triggerBody()?['TicketID'])`

### 2.7 ติดตั้งบนมือถือพนักงาน
1. ติดตั้งแอป **Power Apps** จาก App Store / Google Play แล้วล็อกอินด้วยบัญชีบริษัท
2. เปิดแอป `CEO-APP` → ปุ่ม **…** → **Pin to home screen** / **Add to home screen**
3. เปิดการแจ้งเตือนของแอป **Teams** บนมือถือ (ช่องทางแจ้งเตือนตอนนี้)

## ทดสอบ
ใช้แผนทดสอบ [../04-test-plan.md](../04-test-plan.md) หมวด 1 (ความลับ) และ 2 (เส้นทางสถานะ) โดยเฉพาะ
- S6: พนักงาน A แก้งานของ B ผ่าน Flow ต้องถูกปฏิเสธ
- W5: กด "ทำเสร็จแล้ว" ตอนสถานะ `New` ต้องไม่มีปุ่มนี้ และถ้าเรียก Flow ตรงต้องถูกปฏิเสธ
- W6: กดรับทราบสองครั้งเร็ว ๆ ครั้งที่สองต้องได้ "ข้อมูลเปลี่ยนไปแล้ว"
