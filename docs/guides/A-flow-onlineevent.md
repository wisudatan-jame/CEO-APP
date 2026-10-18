# คู่มือ ก: สร้าง Flow `OnLineEvent` ทีละคลิก

Flow นี้รับต่อจากบอท LINE: ตั้งสิทธิ์ให้ผู้รับผิดชอบเห็นงาน และแจ้งเตือนพนักงาน ถ้าไม่มี Flow นี้ **งานที่ CEO สั่งผ่าน LINE จะไม่ถึงพนักงาน**
ใช้เวลาประมาณ 45–60 นาที ทำหลังจาก [คู่มือ ข](B-setup-lists.md) เสร็จแล้ว
รายละเอียดเชิงออกแบบอยู่ที่ [../03-flows.md](../03-flows.md) หัวข้อ Flow 2b

> ⚠️ ชื่อเมนูอ้างอิงหน้าจอ Power Automate รุ่นใหม่ (New designer) ถ้าหน้าจอของคุณต่างไป ให้ค้นหาชื่อ Action ตามตัวหนังสือในคู่มือ
> ช่องที่ต้องใส่ **Expression** ให้คลิกช่องนั้น → กดไอคอน **fx** (หรือ "Insert expression") → วางข้อความ → **Add**

## การแจ้งเตือน: ใช้ Teams ไปก่อน
แอป Power Apps ของพนักงาน ([คู่มือ ค](C-staff-app.md)) ยังไม่มี จึงส่งแจ้งเตือนผ่าน **Microsoft Teams (Flow bot)** ซึ่งพนักงานทุกคนมีอยู่แล้วและแจ้งเตือนบนมือถือได้ทันที เมื่อมีแอปแล้วค่อยเพิ่มลิงก์เปิดแอปในข้อความ

## 1. สร้าง Flow
1. เปิด **https://make.powerautomate.com** ด้วยบัญชีของคุณ
2. ถ้าใช้ Solution ได้ (ข้อ 10 ของต้นแบบ): **Solutions** → **+ New solution** ชื่อ `CEO-APP` → เปิด Solution → **+ New** → **Automation** → **Cloud flow** → **Automated**
   ถ้าไม่ได้: เมนูซ้าย **+ Create** → **Automated cloud flow**
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

## 3. Scope "Try"
**+ (ใต้ Trigger)** → **Add an action** → ค้นหา `Scope` → เลือก **Scope** → เปลี่ยนชื่อเป็น `Try` (คลิกชื่อการ์ดแล้วพิมพ์)
Action ข้อ 3.1–3.7 ทั้งหมดใส่ **ภายใน** Scope `Try`

### 3.1 Get item (อ่าน Ticket)
SharePoint → **Get item** → เปลี่ยนชื่อเป็น `Get ticket`
- Site Address: `CEO-Tickets` · List Name: `Tickets`
- Id (Expression): `triggerBody()?['TicketID']`

### 3.2 Condition: งานใหม่หรือไม่
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
  2. **Stop sharing an item or a file** · Library Name: `TicketFiles` · Id (Expression): `body('Get_photo_folder')?['ItemId']`
  3. **Grant access to an item or a folder** · Library or List: `TicketFiles` · Id: เหมือนข้อ 2 · Recipients: เหมือน b) · Roles: Can view · Notify recipients: No
- ฝั่ง False: ว่าง

**d) Post message in a chat or channel** (Microsoft Teams) ชื่อ `Notify new task`
- Post as: **Flow bot** · Post in: **Chat with Flow bot**
- Recipient (Expression): `body('Get_ticket')?['AssigneeEmail']`
- Message (Expression):
  ```
  concat('📌 งานใหม่จาก CEO: T-', triggerBody()?['TicketID'], ' (ส่ง ', formatDateTime(addHours(body('Get_ticket')?['DueDate'], 7), 'dd/MM/yyyy'), ')')
  ```
  ข้อความมีแค่เลขงานและวันส่ง **ไม่ใส่ชื่องาน** เพราะแจ้งเตือนแสดงบนหน้าจอล็อก ⚠️ ตรวจในการทดสอบว่าวันที่ตรง ถ้าเลื่อน 1 วัน ให้ลบ `addHours(..., 7)` ออก

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
  concat('🔔 T-', triggerBody()?['TicketID'], ': ', json('{"close":"CEO ปิดงานแล้ว","reopen":"CEO ส่งกลับให้ทำต่อ","reply":"CEO ตอบคำถามแล้ว เปิดดูในแอป","comment":"CEO มีความเห็น เปิดดูในแอป"}')?[triggerBody()?['Action']?['Value']])
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
   2. Data Operation → **Select** ชื่อ `Admin emails` · From: `body('Get_admins')?['value']` · Map: สลับเป็นโหมดข้อความ (ไอคอน T) แล้วใส่ Expression `item()?['Value']`
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
