# คู่มือ ฉ: พนักงานแนบไฟล์งานในแอป

ใช้เวลาประมาณ 2 ชั่วโมง ทำหลัง [คู่มือ ค](C-staff-app.md)
ผลลัพธ์: ในหน้ารายละเอียดงาน พนักงานกด **📎 เลือกไฟล์** (Excel, PDF, Word, รูป ฯลฯ ครั้งละไม่เกิน 5 ไฟล์ ไฟล์ละ 10 MB) → **ส่งไฟล์** ไฟล์เก็บใน `TicketFiles/T-<เลข>` ของ Site `CEO-Tickets` แล้ว CEO ได้ LINE พร้อมลิงก์เปิดโฟลเดอร์

ทำไมทำแบบนี้ (ตัดสินใจ 25 ต.ค. 2026)
- ไฟล์งานอยู่ใน M365 ของบริษัทที่เดียว ไม่หายเมื่อพนักงานลาออก และนำไปทำ RAG ได้
- พนักงานมีสิทธิ์อ่านอย่างเดียว แอปจึงส่งไฟล์ให้ Flow บันทึกแทน (Flow ตรวจว่าคนกดเป็นผู้รับงานหรือ CEO) ใช้ Connector มาตรฐาน ไม่ต้องซื้อ License เพิ่ม

> ⚠️ สร้างใน Environment `Digital Focus (default)` เท่านั้น · วิธีพิมพ์ Expression: คลิกช่อง → **fx** → วาง → **Add**

---

## ส่วนที่ 1: Flow `AttachTicketFile`

### 1.1 สร้าง Flow และ Input
1. make.powerautomate.com → **+ Create** → **Instant cloud flow** → ชื่อ `AttachTicketFile` · Trigger **When Power Apps calls a flow (V2)** → Create
2. คลิก Trigger → **+ Add an input** ตามลำดับ
   | ชนิด | ชื่อ |
   |---|---|
   | Number | `ticketId` |
   | File | `file` |

### 1.2 ตัวตนผู้กดและข้อมูลงาน (นอก Scope)
1. **Initialize variable** · Name `CallerEmail` · Type String · Value (Expression): `toLower(triggerOutputs()?['headers']?['x-ms-user-email'])`
2. **Compose** ชื่อ `In ticketId` ← (Dynamic content) ticketId
3. SharePoint **Get item** ชื่อ `Get ticket` · Site `CEO-Tickets` · List `Tickets` · Id (Expression): `outputs('In_ticketId')`
4. SharePoint **Get items** ชื่อ `Get ceo` · List `Config` · Filter Query: `Title eq 'CEO_EMAIL'`
5. **Compose** ชื่อ `Allowed` (Expression):
   ```
   and(equals(body('Get_ticket')?['IsOpen'], true), or(equals(variables('CallerEmail'), toLower(body('Get_ticket')?['AssigneeEmail'])), equals(variables('CallerEmail'), toLower(first(body('Get_ceo')?['value'])?['Value']))))
   ```
6. **Compose** ชื่อ `File name` (Expression): ใส่วันเวลาหน้าชื่อไฟล์ กันไฟล์ชื่อซ้ำทับกัน
   ```
   concat(formatDateTime(convertFromUtc(utcNow(), 'SE Asia Standard Time'), 'yyyyMMdd-HHmmss'), '-', triggerBody()?['file']?['name'])
   ```

### 1.3 Scope `Try`
**a) Condition** ชื่อ `Not allowed` · ช่องซ้าย (Expression) `outputs('Allowed')` · **is equal to** · ช่องขวา (Expression) `false`
- ฝั่ง True:
  1. **Respond to a PowerApp or flow** · Output แบบ Text 3 ตัว: `ok` = `false` · `id` = `outputs('In_ticketId')` · `message` = `แนบไฟล์ได้เฉพาะผู้รับงานของงานที่ยังไม่ปิด`
  2. **Terminate** · Status **Succeeded**
- ฝั่ง False: ว่าง

**b) SharePoint Create file** ชื่อ `Save file`
- Site Address `CEO-Tickets`
- Folder Path (Expression): `concat('/TicketFiles/T-', outputs('In_ticketId'))` (ถ้ายังไม่มีโฟลเดอร์ SharePoint สร้างให้เอง)
- File Name (Expression): `outputs('File_name')`
- File Content: เลือก Dynamic content **file** (ของ Trigger) ⚠️ ทดสอบเปิดไฟล์หลังอัปโหลด ถ้าไฟล์เสียหรือเปิดไม่ได้ ให้เปลี่ยนเป็น Expression `base64ToBinary(triggerBody()?['file']?['contentBytes'])`

**c) SharePoint Get folder metadata using path** ชื่อ `Get folder` · Folder Path (Expression): `concat('/TicketFiles/T-', outputs('In_ticketId'))`

**d) SharePoint** **Send an HTTP request to SharePoint** ชื่อ `Reset folder access` · Site Address: `CEO-Tickets` · Method: `POST` · Uri (Expression): `concat('_api/web/lists/getbytitle(''TicketFiles'')/items(', body('Get_folder')?['ItemId'], ')/resetroleinheritance')` · Headers: `Accept` = `application/json;odata=nometadata` (Stop sharing ใช้กับโฟลเดอร์ไม่ได้ ขั้นนี้ให้โฟลเดอร์กลับไปใช้สิทธิ์ของ Library = เฉพาะ Owner แทน)

**e) Grant access to an item or a folder** · Library `TicketFiles` · Id: เหมือน d) · Recipients (Expression): `body('Get_ticket')?['AssigneeEmail']` · Roles **Can view** · Notify recipients **No**
(ทำทุกครั้งที่แนบ โฟลเดอร์จึงเห็นได้เฉพาะ Owner กับผู้รับงานปัจจุบันเสมอ แม้เป็นโฟลเดอร์ใหม่)

**f) SharePoint Update item** ชื่อ `Mark has files` · List `Tickets` · Id `outputs('In_ticketId')`
- ช่องบังคับใช้ค่าเดิม (Expression): Title `body('Get_ticket')?['Title']` · AssigneeEmail `body('Get_ticket')?['AssigneeEmail']` · DueDate `body('Get_ticket')?['DueDate']` · Priority Value `body('Get_ticket')?['Priority']?['Value']` · Status Value `body('Get_ticket')?['Status']?['Value']` · Source Value `body('Get_ticket')?['Source']?['Value']`
- **HasFiles:** `Yes`

**g) SharePoint Create item** ชื่อ `Create history` · List `TicketHistory`
- Title `concat('T-', outputs('In_ticketId'))` · TicketID `outputs('In_ticketId')` · Action Value `comment`
- FromStatus / ToStatus `body('Get_ticket')?['Status']?['Value']`
- Comment (Expression): `concat('📎 แนบไฟล์: ', outputs('File_name'))` (บอทใช้ 📎 นำหน้าเพื่อแนบลิงก์โฟลเดอร์ให้ CEO)
- ActorEmail `variables('CallerEmail')` · Source Value `App` · **Processed** `Yes`
- **CEOPending** (Expression): `equals(variables('CallerEmail'), toLower(body('Get_ticket')?['AssigneeEmail']))`

**h) Stop sharing** · Library `TicketHistory` · Id `body('Create_history')?['ID']`
**i) Grant access** · List `TicketHistory` · Id เหมือน h) · Recipients `body('Get_ticket')?['AssigneeEmail']` · Can view · Notify No

**j) Respond to a PowerApp or flow** · `ok` = `true` (พิมพ์เป็นข้อความ ไม่ต้องกด fx) · `id` = `outputs('In_ticketId')` · `message` = `outputs('File_name')`

### 1.4 Scope `Catch`
เหมือน [คู่มือ ค ข้อ 1.4](C-staff-app.md) และ[คู่มือ ก ข้อ 4](A-flow-onlineevent.md) (Get admins → Select `Admin emails` แบบโหมดข้อความ → Send an email To = `join(body('Admin_emails'), ';')` · Run after: has failed, has timed out · อีเมลผู้ดูแล Subject `concat('[CEO-APP] AttachTicketFile ล้มเหลว T-', outputs('In_ticketId'))`) และ **Respond** `ok` = `false` · `id` = `outputs('In_ticketId')` · `message` = `ส่งไฟล์ไม่สำเร็จ ลองใหม่อีกครั้ง` ก่อน Terminate Failed
> Respond ทุกใบต้องมี `ok`, `id`, `message` ชนิด Text เหมือนกัน

### 1.5 สิทธิ์การรัน
หน้า Flow → **Run only users** → Connection ของ SharePoint และ Outlook เลือก **Use this connection** (ของเจ้าของ Flow)

---

## ส่วนที่ 2: ปุ่มแนบไฟล์ในแอป (หน้า `scrDetail`)

### 2.1 เพิ่ม Flow เข้าแอป
แผง **Power Automate** → **+ Add flow** → `AttachTicketFile`

### 2.2 เอาช่องแนบไฟล์มาใช้ (Power Apps ไม่มีให้ Insert ตรง ๆ ต้องคัดลอกจากฟอร์ม)
1. **Insert** → **Edit form** → Data source `Tickets`
2. แผงขวา **Fields** → **+ Add field** → ติ๊ก **Attachments** → Add
3. ในฟอร์ม คลิก**ช่องแนบไฟล์** (ตัวช่อง ไม่ใช่การ์ดทั้งใบ ชื่อประมาณ `DataCardValue…`) → **Ctrl+C**
4. คลิกพื้นที่ว่างของหน้าจอ → **Ctrl+V** → เปลี่ยนชื่อเป็น `attFiles`
5. ลบฟอร์มทิ้ง (คลิกขวาที่ฟอร์ม → Delete)
6. ตั้งค่า `attFiles`
   | Property | ค่า |
   |---|---|
   | Items | `Blank()` |
   | DisplayMode | `If(varTicket.IsOpen, DisplayMode.Edit, DisplayMode.Disabled)` |
   | MaxAttachments | `5` |
   | MaxAttachmentSize | `10` (MB · Microsoft แนะนำไม่เกิน 10 ไฟล์ใหญ่กว่านั้นให้ส่งลิงก์ OneDrive ในความเห็น) |
   | AddAttachmentText | `"เลือกไฟล์ (Excel, PDF, Word, รูป · สูงสุด 5 ไฟล์ ไฟล์ละ 10 MB)"` (ช่องนี้มีไอคอนคลิปของตัวเองแล้ว) |
   | NoAttachmentsText | `""` |
   | X · Y · Width · Height | `20` · `btnComment.Y + 60` · `Parent.Width - 40` · `160` |
   | Color · Size | `clrText` · `14` |
   ถ้ามี ❌ ที่ Property อื่นที่อ้าง `Parent.Default` หรือ `ThisItem` ให้ลบสูตรนั้นออก
7. คลิกขวา `attFiles` → **Reorder** → **Bring to front** (กันกรอบหรือพื้นหลังอื่นบังลิงก์)

> **ไม่เห็นลิงก์ "📎 เลือกไฟล์"** ลิงก์อยู่**ใต้**รายการไฟล์ในกล่อง ถ้ากล่องเตี้ยจะถูกดันออกนอกกรอบ (เห็นแค่กล่องว่างมีแถบเลื่อน) ให้เพิ่ม Height เป็น `160` ขึ้นไป ถ้ายังไม่เห็น ลองตั้ง DisplayMode เป็น `DisplayMode.Edit` ชั่วคราว (ถ้าเห็นแปลว่า `varTicket.IsOpen` ไม่เป็น true) และทดสอบใน **Preview (F5)** เพราะในหน้าแก้ไขต้องกด **Alt** ค้างแล้วคลิกลิงก์

### 2.3 ปุ่มส่งไฟล์และดูไฟล์
| Control | ชื่อ | Property |
|---|---|---|
| Button | `btnUpload` | Text `"ส่งไฟล์"` · X `330` · Y `attFiles.Y + attFiles.Height + 10` · Width `290` · Height `50` · สไตล์เดียวกับปุ่มสถานะ (แดง) |
| | | DisplayMode `If(varBusy \|\| IsEmpty(attFiles.Attachments) \|\| !varTicket.IsOpen, DisplayMode.Disabled, DisplayMode.Edit)` |
| `btnPhotos` (เดิม) | | Text `"📂 ดูไฟล์แนบ"` · X `20` · Y `btnUpload.Y` · Width `290` · Height `50` · Visible `varTicket.HasFiles` |
| | | OnSelect `Launch("https://digitalfocusth.sharepoint.com/sites/CEO-Tickets/TicketFiles/Forms/AllItems.aspx?id=" & EncodeUrl("/sites/CEO-Tickets/TicketFiles/T-" & varTicket.ID))` |

**btnUpload → OnSelect**
```powerfx
Set(varBusy, true);
Set(varUpload,
    ForAll(attFiles.Attachments As f,
        AttachTicketFile.Run(varTicket.ID, {contentBytes: f.Value, name: f.Name})));
Set(varBusy, false);
If(CountIf(varUpload, Lower(ok) = "true") = CountRows(varUpload),
    Notify("ส่งไฟล์แล้ว " & CountRows(varUpload) & " ไฟล์", NotificationType.Success); Reset(attFiles),
    Notify("ส่งไม่สำเร็จบางไฟล์: " & First(Filter(varUpload, Lower(ok) <> "true")).message, NotificationType.Error));
Refresh(Tickets);
Refresh(TicketHistory);
Set(varTicket, LookUp(Tickets, ID = varTicket.ID))
```
ใช้ตัวแปร `varUpload` (ไม่ใช่ Collection) เพราะผลการส่งไม่ต้องแก้ทีหลัง App checker จึงไม่เตือน "Collection is initialized but never updated"

⚠️ Input ของ Flow นี้เป็นแบบบังคับ จึงส่งค่าตามลำดับ (เลขงาน, ไฟล์) ถ้าขึ้น "Invalid number of arguments" ให้พิมพ์ `AttachTicketFile.Run(` แล้วดูกล่องคำแนะนำ ถ้าค่าอยู่ในวงเล็บปีกกา (Input ไม่บังคับ) ให้ใช้ `AttachTicketFile.Run({number: varTicket.ID, file: {contentBytes: f.Value, name: f.Name}})` แทน

### 2.4 ปรับตำแหน่ง
- `btnPhotos` ย้ายมาอยู่แถวเดียวกับ `btnUpload` แล้ว ให้แก้ `txtComment` → **Y** = `lblDDetails.Y + lblDDetails.Height + 10`
- `galHistory` → **Y** = `btnUpload.Y + 70`

ผลที่ได้
```
[ ✓ รับทราบแล้ว ] [ ✓ เริ่มทำแล้ว ]
[    ถาม CEO    ] [  ทำเสร็จแล้ว  ]
[            ส่งความเห็น            ]
┌──────────────────────────────────┐
│ 📎 เลือกไฟล์ (Excel, PDF, Word...) │
│ รายงานยอดขาย.xlsx  ✕              │
└──────────────────────────────────┘
[ 📂 ดูไฟล์แนบ ] [     ส่งไฟล์     ]
ประวัติ...
```

---

## ทดสอบ
| # | ทำ | ผลที่ต้องได้ |
|---|---|---|
| F1 | ผู้รับงานเลือกไฟล์ Excel + PDF → ส่งไฟล์ | "ส่งไฟล์แล้ว 2 ไฟล์" · `TicketFiles/T-<เลข>` มี 2 ไฟล์ชื่อขึ้นต้นด้วยวันเวลา · เปิดไฟล์ได้ไม่เสีย · `HasFiles = Yes` |
| F2 | ดูประวัติในแอป | มี 2 แถว `ความเห็น: 📎 แนบไฟล์: ...` |
| F3 | ตั้ง SharePoint webhook แล้ว | CEO ได้ LINE `📎 แนบไฟล์: ...` พร้อม `📂 เปิดไฟล์งาน: <ลิงก์>` และ CEO เปิดลิงก์ได้ |
| F4 | ผู้รับงานกด 📂 ดูไฟล์แนบ | เห็นไฟล์ในโฟลเดอร์ของงานตัวเอง |
| F5 | พนักงาน B เปิดลิงก์โฟลเดอร์ของงาน A | Access denied |
| F6 | เรียก Flow กับงานที่ปิดแล้ว หรืองานของคนอื่น | `แนบไฟล์ได้เฉพาะผู้รับงานของงานที่ยังไม่ปิด` และไม่มีไฟล์ใหม่ |
| F7 | ส่งไฟล์ชื่อเดิมซ้ำ 2 ครั้ง | ได้ 2 ไฟล์ (ชื่อวันเวลาต่างกัน) ไม่ทับกัน |
