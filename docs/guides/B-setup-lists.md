# คู่มือ ข: สร้าง List และนำเข้าข้อมูล

ใช้เวลาประมาณ 30 นาที (ไม่รวมเวลาที่ HR กรอกรายชื่อ)
ผลลัพธ์: Site `CEO-Tickets` มี List `Tickets`, `TicketHistory`, `Employees`, `Config`, `Holidays` และ Library `TicketFiles` ครบ ชื่อคอลัมน์ตรงกับบอทและ Flow ทุกตัว

> ทำไมใช้สคริปต์แทนการสร้างด้วยมือ: SharePoint ตั้ง "ชื่อภายใน" ของคอลัมน์ตอนสร้างครั้งแรกและเปลี่ยนทีหลังไม่ได้ ถ้าพิมพ์ผิดหรือสร้างด้วยชื่อภาษาไทยก่อน บอทและ Flow จะหาคอลัมน์ไม่เจอ สคริปต์สร้างให้ตรงทุกตัวอักษร

## 1. สร้าง Site
ทำตามที่ตกลงไว้: **Communication site → Blank** ชื่อ `CEO-Tickets` ภาษา English
URL ต้องเป็น `https://digitalfocusth.sharepoint.com/sites/CEO-Tickets` (ถ้า SharePoint ตั้ง URL ต่างไปจากนี้ ต้องแก้ `SP_SITE_PATH` ของบอทให้ตรง)

ตรวจสิทธิ์ทันทีหลังสร้าง: ⚙️ → **Site permissions** → **Advanced permissions settings**
- กลุ่ม **Members** และ **Visitors** ว่าง
- ไม่มีกลุ่ม **Everyone** หรือ **Everyone except external users**

## 2. รันสคริปต์สร้าง List
1. เปิดไฟล์ [`setup/create-lists.js`](../../setup/create-lists.js) อ่านให้เข้าใจก่อน (สคริปต์เพิ่มของใหม่อย่างเดียว ไม่ลบหรือแก้ของเดิม) แล้วคัดลอกเนื้อหาทั้งไฟล์
2. เปิด Site `CEO-Tickets` ด้วย Edge หรือ Chrome ล็อกอินด้วยบัญชีที่เป็น Owner ของ Site
3. กด **F12** → แท็บ **Console**
4. ถ้าเบราว์เซอร์เตือนเรื่องการวางโค้ด ให้พิมพ์ `allow pasting` แล้วกด Enter (เป็นกลไกกันคนหลอกให้วางโค้ด ให้ทำเฉพาะกับไฟล์นี้ที่อ่านแล้ว)
5. วางโค้ด แล้วกด **Enter**
6. รอจนเห็นข้อความ `เสร็จแล้ว ตรวจชื่อคอลัมน์ตาม docs/01-data-model.md`
   - ถ้าเห็น `ไม่สำเร็จ:` ให้คัดลอกข้อความ Error มาให้ผม
   - รันซ้ำได้ปลอดภัย ของที่สร้างแล้วจะถูกข้าม
7. รีเฟรชหน้า แล้วเปิด **Site contents** ต้องเห็นทั้ง 6 รายการ

⚠️ สคริปต์ทดสอบกับ SharePoint จำลองแล้ว (`node setup/test-create-lists.js`) แต่ยังไม่เคยรันกับ SharePoint จริง ถ้าคอลัมน์ใดไม่ถูกสร้าง ให้แจ้งผม อย่าสร้างแทนด้วยมือ

## 2-ทางเลือก: นำเข้าจาก Excel (แทนข้อ 2)
ใช้เมื่อไม่สะดวกรันสคริปต์ ไฟล์อยู่ที่ [`setup/import/`](../../setup/import/) 1 ไฟล์ต่อ 1 List ในแต่ละไฟล์ แท็บ `Data` คือตารางที่นำเข้า ส่วนแท็บ `วิธีใช้` บอกชนิดคอลัมน์ที่ต้องเลือก
> ⚠️ การนำเข้าของ SharePoint **ตั้งค่าเริ่มต้น ช่องบังคับ และ Index ให้ไม่ได้** ต้องทำรายการตรวจด้านล่างให้ครบ ถ้าข้ามไป บอทและ Flow จะทำงานผิดแบบเงียบ ๆ (เช่น งานใหม่ไม่มีสถานะ) สคริปต์ในข้อ 2 ตั้งค่าเหล่านี้ให้ครบในครั้งเดียว

### นำเข้าทีละไฟล์
ลำดับ: `Config` → `Holidays` → `Employees` → `TicketHistory` → `Tickets`
1. ก่อนนำเข้า `Tickets.xlsx`: เปิดไฟล์ แทนที่ `example@digitalfocus.co.th` ในคอลัมน์ `Assignee` ด้วยอีเมลของคุณเอง (คอลัมน์ Person ต้องเป็นผู้ใช้จริง) แล้วบันทึก
2. Site `CEO-Tickets` → **+ New** → **List** → **Import from: Excel** → อัปโหลดไฟล์
3. เลือกตาราง (Table) ที่ชื่อเดียวกับไฟล์
4. ในหน้าตรวจคอลัมน์ ให้เลือก **ชนิดคอลัมน์ตามแท็บ `วิธีใช้`** ทุกคอลัมน์ (โดยเฉพาะ Choice, Yes/No, Person, Number)
5. ตั้งชื่อ List ให้ตรงกับชื่อไฟล์ทุกตัวอักษร เช่น `TicketHistory` → **Create**
6. สร้าง Library รูปแนบ: **+ New** → **Document library** → ชื่อ `TicketFiles`

### รายการตรวจหลังนำเข้า (ทำให้ครบทุกข้อ)
เข้าไปที่ List → ⚙️ → **List settings** แล้วคลิกชื่อคอลัมน์เพื่อแก้

**ทุก List**
- [ ] **ชื่อภายในตรง:** คลิกชื่อคอลัมน์ แล้วดูท้าย URL `...&Field=<ชื่อภายใน>` ต้องตรงกับหัวคอลัมน์ทุกตัวอักษร ถ้า SharePoint สร้างคอลัมน์ชื่อ `Title0` หรือ `field_1` แทน `Title` **ให้ลบ List นั้นแล้วใช้สคริปต์ในข้อ 2**
- [ ] **Versioning settings** → Create a version each time you edit = **Yes**
- [ ] ลบแถวตัวอย่างสีเหลืองทั้งหมด (ทำ **หลัง** ตรวจตัวเลือก Choice แล้ว)

**`Tickets`**
- [ ] `Status` (Choice) มี 6 ตัวเลือก `New, Acknowledged, InProgress, WaitingCEO, Done, Closed` · Default = `New` · Require = Yes
- [ ] `Priority` มี `Low, Normal, High` · Default = `Normal` · Require = Yes
- [ ] `Source` มี `App, LINE` · Default = `App`
- [ ] `IsOpen` Default = **Yes** · `OverdueNotified`, `NoAckNotified`, `PermsSet`, `HasFiles` Default = **No**
- [ ] `AssigneeEmail` Require = Yes · `DueDate` เป็น **Date only** และ Require = Yes
- [ ] `Assignee` เป็น **Person** และ **Require = No**
- [ ] `Details` เป็น **Plain text** (ไม่ใช่ Rich text)
- [ ] **Indexed columns** → Create a new index ทีละคอลัมน์: `AssigneeEmail`, `DueDate`, `Status`, `IsOpen`

**`TicketHistory`**
- [ ] `Action` มี 11 ตัวเลือก `create, ack, start, wait, reply, done, reopen, close, cancel, comment, due_change` · Require = Yes
- [ ] `Source` มี `App, LINE` · Default = `App`
- [ ] `Processed` Default = **Yes** · `CEOPending` Default = **No**
- [ ] `TicketID` เป็น Number ทศนิยม 0 · Require = Yes
- [ ] Indexed columns: `TicketID`, `CEOPending`

**`Employees`**
- [ ] `Active` Default = **Yes** · `Email` Require = Yes · Indexed columns: `Email`

**`Config` และ `Holidays`**
- [ ] `Config` มี 7 แถว (ข้อมูลจริง ไม่ต้องลบ) · `Holidays` คอลัมน์ `Date` เป็น **Date only**

เมื่อตรวจครบ ข้ามไปข้อ 3

## 3. กรอกค่าตั้งใน `Config`
เปิด List `Config` แล้วแก้คอลัมน์ `Value`

| Title | ใส่อะไร |
|---|---|
| `CEO_EMAIL` | อีเมล M365 ของ CEO |
| `OWNER_EMAIL` | อีเมลของคุณ |
| `BACKUP_EMAIL` | อีเมลของคุณ Suchada |
| `NOACK_HOURS` | `24` (ปล่อยไว้) |
| `CEO_LINE_USER_ID` | **เว้นว่างไว้ก่อน** บอทจะบอกค่าให้ตอนตั้งค่า ([../../n8n/README.md](../../n8n/README.md)) |
| `QUICK_ASSIGNEES` | อีเมลของ PM, การตลาด, Presales, Sales ที่ CEO สั่งบ่อย คั่นด้วยจุลภาค ไม่เว้นวรรค |

## 4. รายชื่อพนักงาน (HR)
1. ส่งไฟล์ [`setup/templates/Employees.csv`](../../setup/templates/Employees.csv) ให้ HR เปิดด้วย Excel
2. HR ลบแถวตัวอย่าง แล้วกรอกพนักงานทุกคน 1 แถวต่อคน

| คอลัมน์ | กติกา |
|---|---|
| `Title` | ชื่อ-นามสกุล |
| `Nickname` | ชื่อเล่นที่ CEO ใช้เรียกจริง จะแสดงบนปุ่มใน LINE |
| `Aliases` | ชื่อเรียกอื่นคั่นด้วยจุลภาค เช่น `พี่เอ,เอ Sales` (ไม่บังคับ) |
| `Email` | อีเมล M365 ตัวพิมพ์เล็ก ต้องตรงกับที่ใช้ล็อกอิน |
| `Department` | สั้น ๆ เช่น `Sales`, `Presales`, `PM`, `Marketing` (ปุ่มใน LINE แสดงได้ไม่เกิน 20 ตัวอักษรรวมชื่อเล่น) |
| `Active` | `Yes` หรือ `No` |

3. นำเข้า: เปิด List `Employees` → **Edit in grid view** → คัดลอกแถวข้อมูลจาก Excel (ไม่รวมหัวตาราง) → คลิกช่องแรกของแถวว่าง → วาง → ตรวจ → **Exit grid view**
4. ตรวจว่าไม่มีชื่อเล่นที่ซ้ำกันในแผนกเดียวกัน ถ้ามี ให้เพิ่ม `Aliases` ที่ต่างกัน

**ต่อจากนี้ HR แก้ใน List `Employees` โดยตรง** (คนเข้าใหม่เพิ่มแถว คนลาออกเปลี่ยน `Active` เป็น `No` ห้ามลบแถว เพราะงานเก่ายังอ้างถึง)

## 5. วันหยุด
[`setup/templates/Holidays.csv`](../../setup/templates/Holidays.csv) มีวันหยุดราชการแบบวันที่คงที่ที่เหลือของปี 2026 เท่านั้น
- ⚠️ **HR ต้องตรวจกับประกาศวันหยุดของบริษัท** เพิ่มวันหยุดชดเชยและวันหยุดพิเศษ และเพิ่มปี 2027 เมื่อบริษัทประกาศ (วันหยุดทางพุทธศาสนาเปลี่ยนวันทุกปี)
- นำเข้าแบบเดียวกับข้อ 4

## 6. ตรวจขั้นสุดท้าย
- [ ] Site contents มี 6 รายการ
- [ ] `Tickets` มีคอลัมน์ `AssigneeEmail`, `Status`, `IsOpen`, `Source`, `PermsSet`, `HasFiles`
- [ ] `Config` มี 7 แถว และกรอก `CEO_EMAIL`, `OWNER_EMAIL`, `BACKUP_EMAIL`, `QUICK_ASSIGNEES` แล้ว
- [ ] `Employees` มีพนักงานครบ และอีเมลของคนใน `QUICK_ASSIGNEES` อยู่ในรายชื่อ
- [ ] Members/Visitors ของ Site ยังว่าง
