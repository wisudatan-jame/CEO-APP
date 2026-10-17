# Power Automate Flows

ทุก Flow:
- อยู่ใน Solution เดียวกับแอป ⚠️ (ถ้าข้อ 10 ของต้นแบบผ่าน)
- ใช้เฉพาะ Connector มาตรฐาน: SharePoint, Power Apps, Power Apps Notification, Office 365 Outlook, Office 365 Users, Microsoft Teams
- ใช้ Connection ของเจ้าของ Flow (ไม่ใช่ของผู้กด) สำหรับ SharePoint เพื่อให้พนักงานไม่ต้องมีสิทธิ์เขียน List
- มีโครงสร้าง **Try / Catch** ด้วย Scope: `Scope Try` → `Scope Catch` (Configure run after = has failed, has timed out) → ส่งอีเมลหา `OWNER_EMAIL` และ `BACKUP_EMAIL` พร้อมลิงก์ Run
- ตอบกลับแอปเสมอด้วย **Respond to a PowerApp or flow** ฟิลด์ `ok` (`"true"`/`"false"`), `id`, `message`

## ตัวตนของผู้กด
⚠️ **ห้ามเชื่ออีเมลที่แอปส่งมาเป็นพารามิเตอร์** เพราะปลอมได้
ใช้ข้อมูลผู้เรียกจากตัวกระตุ้น Power Apps (V2) เอง เช่น expression `triggerOutputs()?['headers']?['x-ms-user-email']` ⚠️ ชื่อ Header ต้องตรวจในต้นแบบ (ดูจาก Raw outputs ของ Run จริง) ถ้าไม่มี ให้ใช้ Office 365 Users `Get my profile` ไม่ได้ เพราะจะได้ข้อมูลเจ้าของ Connection แทน
เก็บค่าที่ได้เป็นตัวแปร `CallerEmail` (ตัวพิมพ์เล็ก)

## Flow 1: `CreateTicket`
Trigger: Power Apps (V2) — Inputs: `title` (text), `assigneeEmail` (text), `dueDate` (text yyyy-mm-dd), `priority` (text), `details` (text)

1. Get `Config` → `CEO_EMAIL`
2. **ตรวจ:** `CallerEmail` = `CEO_EMAIL` ถ้าไม่ใช่ → ตอบ `ok=false`, `message="ไม่มีสิทธิ์สั่งงาน"` แล้วจบ
3. **ตรวจข้อมูล:** `title` ไม่ว่าง และยาวไม่เกิน 255, `priority` อยู่ใน Low/Normal/High, `dueDate` แปลงเป็นวันที่ได้และไม่ใช่อดีต, `assigneeEmail` มีอยู่จริง (Office 365 Users `Get user profile`) ถ้าไม่ผ่าน → ตอบ `ok=false` พร้อมเหตุผล
4. Create item ใน `Tickets` (Status=`New`, IsOpen=`true`, OverdueNotified=`false`, NoAckNotified=`false`)
5. **Stop sharing an item or a file** (Tickets, ID จากข้อ 4)
6. **Grant access to an item or a folder** → ผู้รับผิดชอบ, Role = **Can view**
7. **Grant access to an item or a folder** → CEO, Role = Can view (ถ้า CEO เป็น Site Owner อยู่แล้ว ข้ามได้)
8. Create item ใน `TicketHistory` (Action=`create`, ToStatus=`New`, ActorEmail=`CallerEmail`) แล้วตั้งสิทธิ์แบบเดียวกับข้อ 5–7
9. แจ้งเตือนผู้รับผิดชอบ: ⚠️ Power Apps Notification `Send push notification (V2)` ข้อความ `งานใหม่จาก CEO: T-<ID> (<priority>)` และเปิดแอปไปที่ Ticket นั้น (ส่งพารามิเตอร์ `ticketId`)
   - **ไม่ใส่รายละเอียดงานในข้อความแจ้งเตือน** เพราะแสดงบนหน้าจอล็อก
10. ตอบ `ok=true`, `id=<ID>`

**ถ้าล้มเหลวหลังข้อ 4:** ใน Scope Catch ให้ลบรายการที่สร้างไปแล้ว (ถ้ามี ID) เพื่อไม่ให้มี Ticket ครึ่ง ๆ กลาง ๆ ที่สิทธิ์ยังไม่ถูกตั้ง แล้วตอบ `ok=false`
**ช่วงเวลาระหว่างข้อ 4 กับ 5:** รายการสืบทอดสิทธิ์จาก List ชั่วคราว ปลอดภัยเพราะ Members/Visitors ของ Site ว่าง ห้ามเพิ่มกลุ่มพนักงานเข้า Site

## Flow 2: `UpdateTicket`
Trigger: Power Apps (V2) — Inputs: `ticketId` (number), `action` (text), `expectedStatus` (text), `comment` (text)

1. Get item `Tickets` ตาม `ticketId` (ถ้าไม่พบ → `ok=false`)
2. **ตรวจผู้กด:**
   - Action ของผู้รับผิดชอบ (`ack`, `start`, `wait`, `done`): `CallerEmail` ต้องเท่ากับ `Assignee.Email` (ตัวพิมพ์เล็ก)
   - Action ของ CEO (`reply`, `close`, `reopen`, `cancel`): `CallerEmail` ต้องเท่ากับ `CEO_EMAIL`
   - `comment`: เป็นได้ทั้งสองฝ่าย
3. **ตรวจความขัดแย้ง:** ถ้า `Status` ปัจจุบัน ≠ `expectedStatus` → `ok=false`, `message="STALE"` (มีคนเปลี่ยนไปก่อนแล้ว หรือกดซ้ำ)
4. **ตรวจเส้นทางสถานะ** ตามตารางใน [01-data-model.md](01-data-model.md) ใช้ Switch ตาม `action` ถ้าไม่อยู่ในตาราง → `ok=false`
5. Update item: `Status` ใหม่ และเวลาที่เกี่ยวข้อง (`AckedAt`, `DoneAt`, `ClosedAt`) ถ้าเป็น `close`/`cancel` ตั้ง `IsOpen=false`
6. Create item `TicketHistory` (FromStatus, ToStatus, Comment, ActorEmail=`CallerEmail`) และตั้งสิทธิ์เหมือน Ticket
7. แจ้งเตือนอีกฝ่าย: ผู้รับผิดชอบกด → แจ้ง CEO, CEO กด → แจ้งผู้รับผิดชอบ ข้อความสั้น เช่น `T-<ID>: รับทราบแล้ว`
8. ตอบ `ok=true`

ตั้ง **Concurrency control** ของ Flow นี้ไม่จำเป็น เพราะข้อ 3 ป้องกันการเขียนทับแล้ว แต่ ⚠️ ทดสอบกดพร้อมกันสองเครื่องตามแผนทดสอบ

## Flow 3: `DailyReminders` (ตามเวลา)
Trigger: Recurrence ทุกวัน 08:00 Time zone = **(UTC+07:00) Bangkok, Hanoi, Jakarta**

1. Get items `Tickets` Filter Query: `IsOpen eq 1 and OverdueNotified eq 0 and DueDate lt '<วันนี้ yyyy-MM-dd>'`
   - เปิด **Pagination** ใน Settings ของ Action ตั้ง Threshold 5000
2. ต่อแต่ละใบ: แจ้งผู้รับผิดชอบและ CEO ว่าเกินกำหนด แล้วตั้ง `OverdueNotified = true`
3. Get items Filter Query: `Status eq 'New' and NoAckNotified eq 0 and Created lt '<ตอนนี้ลบ NOACK_HOURS ชั่วโมง>'`
4. ต่อแต่ละใบ: เตือนผู้รับผิดชอบ และสรุปรายการให้ CEO **รวมเป็นข้อความเดียว** (ไม่ส่งทีละใบ) แล้วตั้ง `NoAckNotified = true`
5. ถ้า CEO เลื่อนกำหนดส่งในอนาคต (`due_change`) ต้องรีเซ็ต `OverdueNotified = false`

## Flow 4: `HealthCheck` (รายสัปดาห์)
Trigger: Recurrence ทุกวันจันทร์ 08:30 (เวลาไทย)
- นับ Ticket ที่เปิดอยู่ จำนวนที่เกินกำหนด และส่งอีเมลสรุปให้ผู้ดูแล
- ถ้า Flow นี้ไม่ส่งอีเมลมาในวันจันทร์ แปลว่า Connection หรือ Flow มีปัญหา (ใช้เป็นสัญญาณชีพของระบบ)

## ช่องทางแจ้งเตือนสำรอง
ถ้าข้อ 5 ของต้นแบบพบว่า Push ผ่าน Power Apps Notification ใช้ไม่ได้หรือไม่เสถียร ให้เปลี่ยนข้อความแจ้งเตือนในทุก Flow เป็น:
1. Microsoft Teams `Post message in a chat or channel` (Post as: Flow bot, Post in: Chat with bot) — มีแจ้งเตือนบนมือถือผ่านแอป Teams
2. อีเมล (Office 365 Outlook `Send an email (V2)`) เป็นทางสุดท้าย
แยกส่วนส่งแจ้งเตือนเป็น Child flow `Notify` (Inputs: email, message, ticketId) เพื่อเปลี่ยนช่องทางได้จุดเดียว ⚠️ Child flow ต้องอยู่ใน Solution
