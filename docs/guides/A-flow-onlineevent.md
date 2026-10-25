# คู่มือ ก: สร้าง Flow `OnLineEvent` ทีละคลิก

Flow นี้รับต่อจากบอท LINE: ตั้งสิทธิ์ให้ผู้รับผิดชอบเห็นงาน และแจ้งเตือนพนักงาน ถ้าไม่มี Flow นี้ **งานที่ CEO สั่งผ่าน LINE จะไม่ถึงพนักงาน**
ใช้เวลาประมาณ 45–60 นาที ทำหลังจาก [คู่มือ ข](B-setup-lists.md) เสร็จแล้ว
รายละเอียดเชิงออกแบบอยู่ที่ [../03-flows.md](../03-flows.md) หัวข้อ Flow 2b

> ⚠️ ชื่อเมนูอ้างอิงหน้าจอ Power Automate รุ่นใหม่ (New designer) ถ้าหน้าจอของคุณต่างไป ให้ค้นหาชื่อ Action ตามตัวหนังสือในคู่มือ
> ช่องที่ต้องใส่ **Expression** ให้คลิกช่องนั้น → กดไอคอน **fx** (หรือกด `/` → Insert expression) → วางข้อความ → **Add**
> **ห้ามพิมพ์หรือวางสูตรลงในช่องตรง ๆ** ถ้าใส่ถูก ช่องจะเป็น **ป้ายสี** (มี `fx` หรือไอคอน SharePoint นำหน้า) ถ้าเห็นเป็นตัวหนังสือธรรมดา แปลว่าผิด (จะขึ้นเช่น "Enter a valid integer")
> ค่าที่มีใน **Dynamic content (⚡)** เช่น `TicketID`, `ID`, `Title` ของ Trigger หรือ `AssigneeEmail` ของ Get ticket เลือกจาก ⚡ ได้เลย ได้ผลเหมือน Expression และพลาดน้อยกว่า

> **สร้างใน Environment หลักของบริษัทเท่านั้น:** มุมขวาบนของ make.powerautomate.com / make.powerapps.com ต้องเป็น Environment ชื่อ `Digital Focus (default)` หรือชื่อบริษัทที่มีคำว่า default **ห้ามสร้างใน Environment ส่วนตัวแบบ Developer** (ชื่อมักเป็น `<ชื่อคุณ>'s Environment`) เพราะ Microsoft ประกาศยกเลิก Developer environment แบบ unmanaged และ Power Apps Developer Plan: เริ่มระงับ 15 ธ.ค. 2026 และเริ่มลบ 15 ม.ค. 2027 ⚠️ ตรวจชื่อ Environment ก่อนเริ่มทุกครั้ง

## การแจ้งเตือน: ใช้ Teams ไปก่อน
แอป Power Apps ของพนักงาน ([คู่มือ ค](C-staff-app.md)) ยังไม่มี จึงส่งแจ้งเตือนผ่าน **Microsoft Teams (Flow bot)** ซึ่งพนักงานทุกคนมีอยู่แล้วและแจ้งเตือนบนมือถือได้ทันที เมื่อมีแอปแล้วค่อยเพิ่มลิงก์เปิดแอปในข้อความ

## 1. สร้าง Flow
1. เปิด **https://make.powerautomate.com** ด้วยบัญชีของคุณ
2. เมนูซ้าย **+ Create** → **Automated cloud flow** (ไม่ใช้ Solution เพราะ Default environment ไม่มี Dataverse)
3. Flow name: `OnLineEvent`
4. ช่องค้นหา Trigger พิมพ์ `When an item is created` → เลือกตัวที่เป็น **SharePoint** → **Create**

## 2. ตั้ง Trigger
1. คลิกการ์ด Trigger
   - **Site Address:** เลือก `CEO-Tickets` (ถ้าไม่มีในรายการ เลือก Enter custom value แล้ววาง `https://digitalfocusth.sharepoint.com/sites/CEO-Tickets`)
   - **List Name:** `TicketHistory`
2. แท็บ **Settings** ของการ์ดเดียวกัน → หัวข้อ **Trigger conditions** → **+ Add** → วาง:
   ```
   @and(equals(triggerBody()?['Source']?['Value'], 'LINE'), equals(triggerBody()?['Processed'], false))
   ```
   เงื่อนไขนี้ทำให้ Flow ทำงานเฉพาะเหตุการณ์จากบอทที่ยังไม่ได้ทำ (กันการทำงานซ้ำและไม่ไปยุ่งกับงานจากแอป)
   > เมื่อทำหน้า CEO ใน Power Apps ([คู่มือ ซ](H-ceo-app.md)) ให้เปลี่ยนเป็น `@equals(triggerBody()?['Processed'], false)` เพื่อรับงานที่ CEO สั่งหรือตอบจากแอปด้วย

## 3. Scope "Try"
**+ (ใต้ Trigger)** → **Add an action** → ค้นหา `Scope` → เลือก **Scope** → เปลี่ยนชื่อเป็น `Try` (คลิกชื่อการ์ดแล้วพิมพ์)
Action ข้อ 3.1–3.7 ทั้งหมดใส่ **ภายใน** Scope `Try`

### 3.1 Get item (อ่าน Ticket)
SharePoint → **Get item** → เปลี่ยนชื่อเป็น `Get ticket`
- Site Address: `CEO-Tickets` · List Name: `Tickets`
- Id (Expression): `triggerBody()?['TicketID']`

### 3.2 Condition: งานใหม่หรือไม่
> ถ้าจะใช้การโอนงาน ให้ทำตามข้อ 6 ด้วย (เปลี่ยนเงื่อนไขนี้ให้รับ `reassign`)

Control → **Condition**
- ช่องซ้าย (Expression): `triggerBody()?['Action']?['Value']`
- ตัวเปรียบเทียบ: **is equal to**
- ช่องขวา: `create`

#### ฝั่ง True (งานใหม่จาก LINE) ใส่ตามลำดับ
**a) Stop sharing an item or a file** (SharePoint)
- Site Address: `CEO-Tickets` · Library Name: `Tickets` · Id (Expression): `triggerBody()?['TicketID']`

**b) Grant access to an item or a folder** (SharePoint) เปลี่ยนชื่อเป็น `Grant assignee`
- Site Address: `CEO-Tickets` · Library or List: `Tickets` · Id (Expression): `triggerBody()?['TicketID']`
- Recipients (Expression): `body('Get_ticket')?['AssigneeEmail']`
- Roles: **Can view**
- เปิด **Show all** / Advanced parameters: **Notify recipients = No** (ไม่ให้ SharePoint ส่งอีเมลแชร์ลิงก์)

**c) Condition** ชื่อ `Has files`
- ช่องซ้าย (Expression): `body('Get_ticket')?['HasFiles']` · **is equal to** · ช่องขวา (Expression): `true`
- ฝั่ง True ใส่ 3 Action:
  1. SharePoint **Get folder metadata using path** ชื่อ `Get photo folder`
     - Site Address: `CEO-Tickets` · Folder Path (Expression): `concat('/TicketFiles/T-', triggerBody()?['TicketID'])`
  2. **Send an HTTP request to SharePoint** ชื่อ `Reset photo folder` · Site Address: `CEO-Tickets` · Method: `POST` · Uri (Expression): `concat('_api/web/lists/getbytitle(''TicketFiles'')/items(', body('Get_photo_folder')?['ItemId'], ')/resetroleinheritance')` · Headers: `Accept` = `application/json;odata=nometadata` (Stop sharing ใช้กับโฟลเดอร์ไม่ได้ ขั้นนี้ให้โฟลเดอร์กลับไปใช้สิทธิ์ของ Library = เฉพาะ Owner แทน)
  3. **Grant access to an item or a folder** · Library or List: `TicketFiles` · Id: เหมือนข้อ 2 · Recipients: เหมือน b) · Roles: Can view · Notify recipients: No
- ฝั่ง False: ว่าง

**d) Post message in a chat or channel** (Microsoft Teams) ชื่อ `Notify new task`
- Post as: **Flow bot** · Post in: **Chat with Flow bot**
- Recipient (Expression): `body('Get_ticket')?['AssigneeEmail']`
- Message (Expression):
  ```
  concat('📌 งานใหม่จาก CEO: T-', triggerBody()?['TicketID'], ' (ส่ง ', formatDateTime(addHours(body('Get_ticket')?['DueDate'], 7), 'dd/MM/yyyy'), ') <a href="https://apps.powerapps.com/play/e/default-9070e17c-15e0-49fd-acef-7e1f07a4952b/a/c5f95180-fe46-4693-84e9-4fa61118040e?tenantId=9070e17c-15e0-49fd-acef-7e1f07a4952b&ticketId=', triggerBody()?['TicketID'], '">เปิดในแอป</a>')
  ```
  ข้อความมีแค่เลขงาน วันส่ง และลิงก์ **ไม่ใส่ชื่องาน** เพราะแจ้งเตือนแสดงบนหน้าจอล็อก ลิงก์เปิดรายการใน SharePoint ซึ่งพนักงานดูได้เพราะ b) ให้สิทธิ์ Can view ไว้แล้ว (เปิดหน้าแรกของ Site ไม่ได้ ต้องเปิดผ่านลิงก์นี้) เมื่อมีแอปพนักงานแล้วให้เปลี่ยนเป็นลิงก์แอปตาม[คู่มือ ค](C-staff-app.md) ⚠️ ตรวจในการทดสอบว่าวันที่ตรง ถ้าเลื่อน 1 วัน ให้ลบ `addHours(..., 7)` ออก

**e) Update item** (SharePoint) ชื่อ `Mark ticket ready`
- Site Address: `CEO-Tickets` · List Name: `Tickets` · Id (Expression): `triggerBody()?['TicketID']`
- ช่องบังคับ (ใช้ค่าเดิม ทุกช่องเป็น Expression):
  - Title: `body('Get_ticket')?['Title']`
  - AssigneeEmail: `body('Get_ticket')?['AssigneeEmail']`
  - DueDate: `body('Get_ticket')?['DueDate']`
  - Priority Value: `body('Get_ticket')?['Priority']?['Value']`
  - Status Value: `body('Get_ticket')?['Status']?['Value']`
  - Source Value: `body('Get_ticket')?['Source']?['Value']`
- ช่องที่ตั้งใหม่ (เปิด Show all):
  - **Assignee Claims** (Expression): `body('Get_ticket')?['AssigneeEmail']`
  - **PermsSet:** `Yes`

#### ฝั่ง False (CEO ปิดงาน ส่งกลับ ตอบคำถาม หรือเขียนความเห็นจาก LINE)
**Post message in a chat or channel** (Microsoft Teams) ชื่อ `Notify status change`
- Post as: Flow bot · Post in: Chat with Flow bot · Recipient: `body('Get_ticket')?['AssigneeEmail']`
- Message (Expression):
  ```
  concat('🔔 T-', triggerBody()?['TicketID'], ': ', json('{"close":"CEO ปิดงานแล้ว","reopen":"CEO ส่งกลับให้ทำต่อ","reply":"CEO ตอบคำถามแล้ว","comment":"CEO มีความเห็น"}')?[triggerBody()?['Action']?['Value']], ' <a href="https://apps.powerapps.com/play/e/default-9070e17c-15e0-49fd-acef-7e1f07a4952b/a/c5f95180-fe46-4693-84e9-4fa61118040e?tenantId=9070e17c-15e0-49fd-acef-7e1f07a4952b&ticketId=', triggerBody()?['TicketID'], '">เปิดในแอป</a>')
  ```
  ไม่ใส่ข้อความที่ CEO ตอบในแจ้งเตือน (แสดงบนหน้าจอล็อก) ให้พนักงานเปิดอ่านในแอป

### 3.3 Stop sharing รายการประวัติ (ใต้ Condition ยังอยู่ใน Try)
**Stop sharing an item or a file** · Library Name: `TicketHistory` · Id (Expression): `triggerBody()?['ID']`

### 3.4 Grant access รายการประวัติ
**Grant access to an item or a folder** · Library or List: `TicketHistory` · Id: `triggerBody()?['ID']` · Recipients: `body('Get_ticket')?['AssigneeEmail']` · Roles: Can view · Notify recipients: No

### 3.5 Update item: ทำแล้ว
SharePoint **Update item** ชื่อ `Mark processed`
- List Name: `TicketHistory` · Id: `triggerBody()?['ID']`
- Title: `triggerBody()?['Title']` · TicketID: `triggerBody()?['TicketID']` · Action Value: `triggerBody()?['Action']?['Value']` · Source Value: `LINE`
- **Processed:** `Yes`

ต้องเป็น Action สุดท้ายใน Try เสมอ ถ้ามีขั้นไหนล้มเหลว รายการจะยังเป็น `Processed = No` และรันซ้ำได้

## 4. Scope "Catch" (แจ้งผู้ดูแลเมื่อพัง)
1. **+ ใต้ Scope Try (ด้านนอก)** → Scope → ชื่อ `Catch`
2. คลิก Catch → แท็บ **Settings** → **Run after** → ติ๊ก **has failed** และ **has timed out** · เอา **is successful** ออก
3. ใน Catch ใส่:
   1. SharePoint **Get items** ชื่อ `Get admins` · List Name: `Config` · Filter Query: `Title eq 'OWNER_EMAIL' or Title eq 'BACKUP_EMAIL'`
   2. Data Operation → **Select** ชื่อ `Admin emails` · From: `body('Get_admins')?['value']` · Map: **สลับเป็นโหมดข้อความก่อน** (ไอคอน **T** ขวาของช่อง Map ให้เหลือช่องเดียว ไม่ใช่ช่อง Key/Value) แล้วใส่ Expression `item()?['Value']` ⚠️ ถ้าใส่ในช่อง Key/Value ผลจะเป็น Object และ Send an email ขึ้น Error `'emailMessage/To' is required to be of type 'String/email'`
   3. Office 365 Outlook → **Send an email (V2)**
      - To (Expression): `join(body('Admin_emails'), ';')`
      - Subject (Expression): `concat('[CEO-APP] OnLineEvent ล้มเหลว T-', triggerBody()?['TicketID'])`
      - Body (Expression):
        ```
        concat('พนักงานอาจยังไม่เห็นงานนี้ เปิดดู Run: https://make.powerautomate.com/environments/', workflow()?['tags']?['environmentName'], '/flows/', workflow()?['name'], '/runs/', workflow()?['run']?['name'])
        ```
   4. Control → **Terminate** · Status: **Failed** (ให้ Run แสดงเป็นล้มเหลวใน Run history)

## 5. บันทึกและทดสอบ
1. **Save**
2. ทดสอบโดยไม่ต้องใช้บอท:
   1. ใน List `Tickets` สร้างรายการทดสอบ: Title `ทดสอบ Flow`, AssigneeEmail = อีเมลพนักงานทดสอบ, DueDate พรุ่งนี้, Source `LINE`, PermsSet `No` · จด ID
   2. ใน List `TicketHistory` สร้างรายการ: Title `T-<ID>`, TicketID `<ID>`, Action `create`, Source `LINE`, **Processed `No`**
   3. รอไม่เกิน 5 นาที แล้วเปิด **Run history** ของ Flow
3. ผลที่ต้องได้
   - [ ] Run สำเร็จ
   - [ ] พนักงานทดสอบได้ข้อความใน Teams จาก Flow bot และวันที่ถูกต้อง
   - [ ] รายการ Ticket: Manage access มีพนักงานทดสอบแบบ Can view และไม่มีกลุ่มอื่น · `Assignee` มีชื่อ · `PermsSet = Yes`
   - [ ] รายการประวัติ: `Processed = Yes`
   - [ ] พนักงานทดสอบเปิด List `Tickets` ใน SharePoint แล้วเห็นเฉพาะรายการนี้
4. ทดสอบกรณีล้มเหลว: สร้างรายการประวัติที่ `TicketID = 999999` (ไม่มีจริง) → ต้องได้อีเมล `[CEO-APP] OnLineEvent ล้มเหลว` และรายการยังเป็น `Processed = No`
5. ลบรายการทดสอบทั้งหมด

## 6. หลังสร้างเสร็จ
- เพิ่มคุณ Suchada เป็น **Co-owner** ของ Flow: หน้า Flow → **Share** / **Edit** ส่วน Owners
- เมื่อแก้ Flow ที่ล้มเหลวแล้ว รายการที่ยังเป็น `Processed = No` จะไม่ถูกทำใหม่เอง (Trigger ทำงานเฉพาะตอนสร้าง) ให้ไปที่ Run ที่ล้มเหลว → **Resubmit**

## 6. เพิ่มการโอนงาน (`reassign`)
CEO โอนงานค้างของคนที่ลาออกให้คนอื่นจาก LINE ได้ (พิมพ์ "โอนงาน" หรือแตะปุ่มในสรุปเช้า) บอทเปลี่ยน `AssigneeEmail` เป็นคนใหม่ ตั้ง `Status = New`, `PermsSet = No` แล้วเขียนประวัติ `Action = reassign` Flow นี้ต้องย้ายสิทธิ์ให้คนใหม่และตัดสิทธิ์คนเดิม ทำครั้งเดียว ใช้เวลาประมาณ 20 นาที

### 6.1 เพิ่มตัวเลือกในคอลัมน์ (ทำก่อนใช้งาน มิฉะนั้นบอทเขียนประวัติไม่ได้)
List `TicketHistory` → คลิกหัวคอลัมน์ **Action** → **Column settings** → **Edit** → **+ Add choice** → พิมพ์ `reassign` → **Save**

### 6.2 แก้ Flow `OnLineEvent`
1. **Condition ข้อ 3.2** (งานใหม่หรือไม่) เปลี่ยนเป็น
   - ช่องซ้าย (Expression): `contains(createArray('create','reassign'), triggerBody()?['Action']?['Value'])`
   - ตัวเปรียบเทียบ: **is equal to** · ช่องขวา (Expression): `true`

   ฝั่ง True เดิม (a–e) ใช้กับการโอนได้เลย: Stop sharing ตัดสิทธิ์คนเดิมออกทั้งหมด แล้ว Grant ให้คนใหม่ ทั้งงานและโฟลเดอร์รูป
2. **หลัง b) Grant assignee** (ยังอยู่ฝั่ง True) เพิ่ม **Condition** ชื่อ `Is reassign`
   - ช่องซ้าย (Expression): `triggerBody()?['Action']?['Value']` · **is equal to** · ช่องขวา: `reassign`
   - ฝั่ง True ใส่ตามลำดับ:
     1. SharePoint **Get items** ชื่อ `Get old history` · List Name: `TicketHistory` · Filter Query (Expression): `concat('TicketID eq ', triggerBody()?['TicketID'])` · Top Count: `500`
     2. Control **Apply to each** ชื่อ `Reshare history` · Select an output (Expression): `body('Get_old_history')?['value']` ข้างในใส่:
        - **Stop sharing an item or a file** · Library Name: `TicketHistory` · Id (Expression): `items('Reshare_history')?['ID']`
        - **Grant access to an item or a folder** · Library or List: `TicketHistory` · Id: เหมือนข้างบน · Recipients (Expression): `body('Get_ticket')?['AssigneeEmail']` · Roles: Can view · Notify recipients: No
   - ฝั่ง False: ว่าง

   คนใหม่จึงเห็นประวัติเดิมทั้งหมดของงาน และคนเดิมเห็นไม่ได้อีก
3. **d) Notify new task** เปลี่ยน Message (Expression) เป็น
   ```
   concat(if(equals(triggerBody()?['Action']?['Value'], 'reassign'), '🔁 CEO โอนงานให้คุณ: T-', '📌 งานใหม่จาก CEO: T-'), triggerBody()?['TicketID'], ' (ส่ง ', formatDateTime(addHours(body('Get_ticket')?['DueDate'], 7), 'dd/MM/yyyy'), ') <a href="https://apps.powerapps.com/play/e/default-9070e17c-15e0-49fd-acef-7e1f07a4952b/a/c5f95180-fe46-4693-84e9-4fa61118040e?tenantId=9070e17c-15e0-49fd-acef-7e1f07a4952b&ticketId=', triggerBody()?['TicketID'], '">เปิดในแอป</a>')
   ```
4. **Save**

### 6.3 ทดสอบ
1. สั่งงานให้พนักงานทดสอบ A (ส่งรูปแนบด้วย) รอให้ `PermsSet = Yes`
2. ใน List `Employees` ตั้ง A เป็น `Active = No` แล้วรอ 5 นาที
3. LINE พิมพ์ "สรุป" ต้องเห็น `👋 งานค้างของคนที่ลาออก` และปุ่ม `🔁 โอนงาน...`
4. แตะปุ่ม → แตะหรือพูดชื่อ B → **✅ ยืนยันโอน**
5. ผลที่ต้องได้ภายใน 5 นาที
   - [ ] B ได้ข้อความ Teams `🔁 CEO โอนงานให้คุณ: T-...` และเปิดลิงก์ได้ เห็นประวัติเดิมและรูป
   - [ ] งานนั้น: Manage access มีแค่ B (ไม่มี A) · `Status = New` · `PermsSet = Yes` · `Assignee` เป็น B
   - [ ] A เปิดลิงก์เดิมแล้วขึ้น Access denied
6. ตั้ง A กลับเป็น `Active = Yes` ถ้าเป็นบัญชีทดสอบ

## 7. คำสั่งเพิ่มเติม รูป การติดตาม และการเลื่อนวันส่งจาก CEO
CEO พิมพ์ "เพิ่มเติม ..." ใน LINE หรือส่งรูปหลังสร้างงาน บอทถามว่าเป็นของงานไหน ให้ CEO ยืนยัน แล้วทำ 3 อย่าง
- ต่อท้ายข้อความในคอลัมน์ `CEOExtra` ของงาน
- อัปโหลดรูปไปที่ `TicketFiles/T-<เลข>`
- เขียนประวัติ `Action = comment` โดย `Comment` ขึ้นต้นด้วย `➕ คำสั่งเพิ่มเติม:` หรือ `📎 CEO แนบรูปเพิ่ม`

ส่วนปุ่ม 📣 ติดตาม และ 📅 เลื่อนวันส่ง (จากคำถาม "งานคุณแตนถึงไหน") เขียนประวัติ `comment` ที่ขึ้นต้นด้วย `📣 CEO ติดตามงาน:` และ `📅 CEO เลื่อนวันส่ง...`

Flow นี้ต้องทำ 2 อย่างให้ คือแจ้งพนักงานให้ชัด และตั้งสิทธิ์โฟลเดอร์รูป (งานที่ตอนสร้างไม่มีรูป บอทจะสร้างโฟลเดอร์ใหม่ซึ่งพนักงานยังเปิดไม่ได้) ใช้เวลาประมาณ 15 นาที

### 7.1 เพิ่มคอลัมน์ (ทำก่อนอัปเดตบอท) ชื่อต้องตรงทุกตัวอักษร ห้ามมีเว้นวรรค
1. List `Tickets` → **+ Add column** → **Multiple lines of text** → Name: `CEOExtra` → ปิด **Use enhanced rich text** → **Save**
2. List `Tickets` → **+ Add column** → **Number** → Name: `GroupID` → More options: Number of decimal places = **0** → **Save** (ผูกงานที่สั่งหลายคนพร้อมกันเป็นกลุ่ม)
3. List `Employees` → **+ Add column** → **Yes/No** → Name: `IsManager` → Default value: **No** → **Save** แล้วให้ HR ติ๊ก **Yes** ให้หัวหน้า/ผู้จัดการทุกคน (บอทจำรายชื่อไว้ไม่เกิน 5 นาที)

Flow ไม่ต้องแก้เพิ่มสำหรับงานกลุ่ม เพราะแต่ละคนได้ใบของตัวเองและมีประวัติ `create` ของตัวเอง Flow จึงตั้งสิทธิ์และแจ้ง Teams ทีละคนเหมือนงานปกติ

### 7.2 แก้ Flow `OnLineEvent` ฝั่ง False ของข้อ 3.2
1. **Notify status change** เปลี่ยน Message (Expression) เป็น
   ```
   concat(if(startsWith(coalesce(triggerBody()?['Comment'], ''), '📣'), '📣 T-', '🔔 T-'), triggerBody()?['TicketID'], ': ', if(startsWith(coalesce(triggerBody()?['Comment'], ''), '➕'), 'CEO สั่งงานเพิ่มเติม', if(startsWith(coalesce(triggerBody()?['Comment'], ''), '📎'), 'CEO แนบรูปเพิ่ม', if(startsWith(coalesce(triggerBody()?['Comment'], ''), '📣'), 'CEO ติดตามงาน', if(startsWith(coalesce(triggerBody()?['Comment'], ''), '📅'), 'CEO เลื่อนวันส่ง', json('{"close":"CEO ปิดงานแล้ว","reopen":"CEO ส่งกลับให้ทำต่อ","reply":"CEO ตอบคำถามแล้ว","comment":"CEO มีความเห็น"}')?[triggerBody()?['Action']?['Value']])))), ' <a href="https://apps.powerapps.com/play/e/default-9070e17c-15e0-49fd-acef-7e1f07a4952b/a/c5f95180-fe46-4693-84e9-4fa61118040e?tenantId=9070e17c-15e0-49fd-acef-7e1f07a4952b&ticketId=', triggerBody()?['TicketID'], '">เปิดในแอป</a>')
   ```
2. **ใต้ Notify status change** (ยังอยู่ฝั่ง False) เพิ่ม **Condition** ชื่อ `CEO added photos`
   - ช่องซ้าย (Expression): `contains(coalesce(triggerBody()?['Comment'], ''), '📎 CEO แนบรูปเพิ่ม')` · **is equal to** · ช่องขวา (Expression): `true`
   - ฝั่ง True ใส่ 3 Action (เหมือนข้อ c แต่ชื่อใหม่):
     1. SharePoint **Get folder metadata using path** ชื่อ `Get added photo folder` · Site Address: `CEO-Tickets` · Folder Path (Expression): `concat('/TicketFiles/T-', triggerBody()?['TicketID'])`
     2. **Send an HTTP request to SharePoint** ชื่อ `Reset added photo folder` · Site Address: `CEO-Tickets` · Method: `POST` · Uri (Expression): `concat('_api/web/lists/getbytitle(''TicketFiles'')/items(', body('Get_added_photo_folder')?['ItemId'], ')/resetroleinheritance')` · Headers: `Accept` = `application/json;odata=nometadata` (Stop sharing ใช้กับโฟลเดอร์ไม่ได้ ขั้นนี้ให้โฟลเดอร์กลับไปใช้สิทธิ์ของ Library = เฉพาะ Owner แทน)
     3. **Grant access to an item or a folder** · Library or List: `TicketFiles` · Id: เหมือนข้อ 2 · Recipients (Expression): `body('Get_ticket')?['AssigneeEmail']` · Roles: Can view · Notify recipients: No
   - ฝั่ง False: ว่าง
3. **Save**

### 7.3 ทดสอบ
1. สั่งงานใหม่**ไม่แนบรูป** ให้พนักงานทดสอบ A รอให้ `PermsSet = Yes`
2. ส่งรูป 1 รูปใน LINE → บอทถาม `📎 แนบรูป 1 รูปกับงานก่อนหน้าใช่หรือไม่?` → แตะ **✅ ใช่**
3. พิมพ์ `เพิ่มเติม ขอสไลด์ 5 หน้า` → แตะ **ล่าสุด T-...** → แตะ **✅ ใช่**
4. ผลที่ต้องได้ภายใน 5 นาที
   - [ ] A ได้ Teams `🔔 T-...: CEO แนบรูปเพิ่ม` และ `🔔 T-...: CEO สั่งงานเพิ่มเติม`
   - [ ] A เปิดโฟลเดอร์ `TicketFiles/T-...` เห็นรูป (Manage access ของโฟลเดอร์มีแค่ A)
   - [ ] งานนั้นมีช่อง `CEOExtra` = `[วันที่ เวลา] ขอสไลด์ 5 หน้า`
5. พิมพ์ `งานคุณ<ชื่อ A>ถึงไหน` → แตะ **🔍 T-...** → **📣 ติดตาม** → แตะ `ขออัปเดตความคืบหน้าภายในวันนี้` → A ได้ Teams `📣 T-...: CEO ติดตามงาน`
6. แตะ **📅 เลื่อนวันส่ง** → **ศุกร์นี้** → A ได้ Teams `🔔 T-...: CEO เลื่อนวันส่ง` และวันส่งในแอปเปลี่ยน
7. ติ๊ก `IsManager` ให้พนักงานทดสอบ 2 คน → LINE ส่งชื่องาน → แตะ **👥 หัวหน้าทุกคน** → **พรุ่งนี้**
   - [ ] ได้งาน 2 ใบ `GroupID` เท่ากับเลขใบแรก และทั้งสองคนได้ Teams ของตัวเอง
   - [ ] คนที่ 1 เปิดลิงก์งานของคนที่ 2 แล้ว Access denied
   - [ ] พิมพ์ `กลุ่ม T-<เลขใบแรก> ถึงไหน` ได้ `ทำเสร็จ 0/2`

