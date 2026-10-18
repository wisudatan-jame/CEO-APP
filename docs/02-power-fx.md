# สูตร Power Fx (Canvas App)

> ⚠️ ชื่อฟังก์ชันของ Connector อาจต่างกันตามเวอร์ชัน ให้ตรวจจาก IntelliSense หลังเพิ่ม Connector แล้ว สูตรในไฟล์นี้เป็นแนวทาง
> ทุกสูตรที่ดึงข้อมูลจาก SharePoint ต้อง **ไม่มีสามเหลี่ยมเตือน Delegation สีเหลือง** ถ้ามี ห้ามปล่อยขึ้นใช้งานจริง

## Data sources และ Connector ที่ใช้ (มาตรฐานทั้งหมด)
- SharePoint: `Tickets`, `TicketHistory`, `Config`
- Office 365 Users (ค้นหาพนักงาน)
- Office 365 Outlook (ปฏิทินของผู้ใช้ที่ล็อกอิน)
- Flow: `CreateTicket`, `UpdateTicket` (ดู [03-flows.md](03-flows.md))

## App.OnStart (หรือ App.Formulas)
```powerfx
Set(varMe, Lower(User().Email));
Set(varCeoEmail, Lower(LookUp(Config, Title = "CEO_EMAIL", Value)));
Set(varIsCEO, varMe = varCeoEmail);
```
`varIsCEO` ใช้ **แค่ซ่อนหรือแสดงปุ่ม** สิทธิ์จริงตรวจซ้ำใน Flow ทุกครั้ง
พนักงานอ่าน `Config` ไม่ได้ จึงได้ `varCeoEmail` เป็นค่าว่าง ซึ่งให้ผลถูกต้อง (`varIsCEO = false`)

## หน้ารายการ Ticket (`scrTickets`)
ใช้สูตรเดียวกันทั้ง CEO และพนักงาน เพราะสิทธิ์ SharePoint กรองให้แล้วว่าแต่ละคนเห็นใบไหน
```powerfx
// galTickets.Items
SortByColumns(
    Filter(Tickets, IsOpen = true),
    "DueDate", SortOrder.Ascending
)
```
- `IsOpen = true` เป็นการกรองแบบ Delegable ห้ามเปลี่ยนเป็น `Status.Value <> "Closed"` เพราะอาจไม่ Delegable
- ตัวกรองย่อยตามสถานะ: `Filter(Tickets, IsOpen = true, Status.Value = drpStatus.Selected.Value)`
- CEO กรองตามพนักงาน: `Filter(Tickets, IsOpen = true, Assignee.Email = drpPerson.Selected.Mail)` ⚠️ ตรวจคำเตือน Delegation
- ป้ายเกินกำหนด: `If(ThisItem.DueDate < Today(), "เกินกำหนด", "")`

## ฟอร์มสร้างงาน (`scrNew`) — เป้าหมาย: เร็วพอ ๆ กับพิมพ์ LINE

ปัจจุบัน CEO สั่งงานทาง LINE เป็นหลัก ถ้าแอปช้ากว่า LINE จะกลับไปใช้ LINE
เกณฑ์: **จากปลดล็อกมือถือถึงสั่งงานสำเร็จ ไม่เกิน 15 วินาที** (วัดจริงในสัปดาห์ทดลอง)

- เปิดแอปแล้วเข้าหน้า `scrNew` ทันทีสำหรับ CEO: `App.StartScreen = If(varIsCEO, scrNew, scrTickets)` ⚠️ ถ้า `varIsCEO` คำนวณไม่ทันใน StartScreen ให้ใช้ `App.Formulas` แทน `OnStart`
- บังคับกรอกแค่ **ชื่องาน + ผู้รับผิดชอบ** ค่าเริ่มต้น: กำหนดส่ง = พรุ่งนี้, ความสำคัญ = ปกติ
- **ปุ่มลัดผู้รับผิดชอบ** แถวบนสุด แสดงคนที่ CEO สั่งบ่อย (PM, การตลาด, Presales, Sales) แตะครั้งเดียวเลือกได้ ไม่ต้องค้นหา
  `galQuickPeople.Items = FirstN(SortByColumns(AddColumns(GroupBy(Filter(Tickets, Created >= DateAdd(Today(), -30, TimeUnit.Days)), "Assignee", "Rows"), "Cnt", CountRows(Rows)), "Cnt", SortOrder.Descending), 6)` ⚠️ GroupBy ไม่ Delegable ใช้ได้เพราะกรองแค่ 30 วัน แต่ถ้าช้า ให้ใช้รายชื่อคงที่ใน `Config` แทน
- โฟกัสช่องชื่องานทันทีที่เปิดหน้า (`txtTitle` → `SetFocus` ใน `OnVisible`) เพื่อให้แป้นพิมพ์ขึ้นและกดไมโครโฟนได้เลย
```powerfx
// scrNew.OnVisible
Set(varDue, DateAdd(Today(), 1, TimeUnit.Days)); SetFocus(txtTitle)

// ปุ่มลัดกำหนดส่ง
btnToday.OnSelect    = Set(varDue, Today())
btnTomorrow.OnSelect = Set(varDue, DateAdd(Today(), 1, TimeUnit.Days))
// สิ้นสัปดาห์ = วันศุกร์นี้ (ถ้าวันนี้เลยวันศุกร์ไปแล้ว จะเป็นวันศุกร์หน้า)
btnFriday.OnSelect   = Set(varDue, DateAdd(Today(), Mod(5 - Weekday(Today(), StartOfWeek.Monday) + 7, 7), TimeUnit.Days))

// ค้นหาผู้รับผิดชอบ
cmbAssignee.Items = Office365Users.SearchUserV2({searchTerm: cmbAssignee.SearchText, top: 15}).value

// ปุ่มบันทึก
btnCreate.DisplayMode = If(
    IsBlank(Trim(txtTitle.Text)) || IsBlank(cmbAssignee.Selected) || varBusy,
    DisplayMode.Disabled, DisplayMode.Edit)
btnCreate.OnSelect =
    Set(varBusy, true);
    Set(varResult, CreateTicket.Run(
        Trim(txtTitle.Text),
        cmbAssignee.Selected.Mail,
        Text(varDue, "yyyy-mm-dd", "en-US"),
        drpPriority.Selected.Value,
        txtDetails.Text));
    Set(varBusy, false);
    If(varResult.ok = "true",
        Notify("สั่งงานแล้ว T-" & varResult.id, NotificationType.Success);
        Reset(txtTitle); Reset(txtDetails); Reset(cmbAssignee); Set(varDue, DateAdd(Today(), 1, TimeUnit.Days));
        Refresh(Tickets); Back(),
        Notify("สร้างไม่สำเร็จ: " & varResult.message, NotificationType.Error))
```
- `varBusy` ป้องกันการกดซ้ำแล้วได้ Ticket ซ้ำ
- **ส่งวันที่เป็น `yyyy-mm-dd` ด้วย locale `en-US` เสมอ** ถ้าเครื่องตั้งภาษาไทย การแปลงวันที่แบบอื่นอาจได้ปี พ.ศ. (เช่น 2569) แล้วบันทึกผิด
- การพิมพ์ด้วยเสียง: ใช้ปุ่มไมโครโฟนบนคีย์บอร์ดของมือถือในช่อง `txtTitle` ได้เลย ไม่ต้องเขียนเพิ่ม

## หน้ารายละเอียด (`scrDetail`)
```powerfx
// ปุ่มตามสิทธิ์และสถานะ (ซ่อนปุ่มเท่านั้น Flow ตรวจซ้ำ)
btnAck.Visible   = !varIsCEO && galTickets.Selected.Status.Value = "New"
btnStart.Visible = !varIsCEO && galTickets.Selected.Status.Value in ["New", "Acknowledged"]
btnWait.Visible  = !varIsCEO && galTickets.Selected.Status.Value in ["New", "Acknowledged", "InProgress"]
btnDone.Visible  = !varIsCEO && galTickets.Selected.Status.Value = "InProgress"
btnReply.Visible = varIsCEO && galTickets.Selected.Status.Value = "WaitingCEO"
btnClose.Visible = varIsCEO && galTickets.Selected.Status.Value = "Done"
btnReopen.Visible = varIsCEO && galTickets.Selected.Status.Value = "Done"

// ทุกปุ่มเรียกรูปแบบเดียวกัน ส่งสถานะที่เห็นอยู่ไปให้ Flow ตรวจว่ายังไม่มีใครเปลี่ยนก่อน
btnAck.OnSelect =
    Set(varBusy, true);
    Set(varResult, UpdateTicket.Run(galTickets.Selected.ID, "ack", galTickets.Selected.Status.Value, txtComment.Text));
    Set(varBusy, false);
    If(varResult.ok = "true",
        Notify("อัปเดตแล้ว", NotificationType.Success); Reset(txtComment),
        Notify(varResult.message, NotificationType.Error));
    Refresh(Tickets)

// ประวัติ
galHistory.Items = SortByColumns(Filter(TicketHistory, TicketID = galTickets.Selected.ID), "Created", SortOrder.Descending)
```
เมื่อ Flow ตอบ `STALE` (มีคนเปลี่ยนสถานะไปก่อนแล้ว) ให้แสดง "ข้อมูลเปลี่ยนไปแล้ว กำลังโหลดใหม่" แล้ว `Refresh(Tickets)`

## หน้าปฏิทิน CEO (`scrCalendar`) — แสดงเฉพาะเมื่อ `varIsCEO`
```powerfx
// ดึงปฏิทินหลักของผู้ใช้ที่ล็อกอิน
Set(varCalId, First(Office365Outlook.CalendarGetTablesV2().value).name);

// นัดหมาย 7 วันข้างหน้า
ClearCollect(colEvents,
    Office365Outlook.GetEventsCalendarViewV3(
        varCalId,
        Text(Today(), "yyyy-mm-ddT00:00:00", "en-US"),
        Text(DateAdd(Today(), 7, TimeUnit.Days), "yyyy-mm-ddT00:00:00", "en-US")
    ).value);

// วันกำหนดส่งของ Ticket แสดงเฉพาะในแอป (ไม่เขียนลงปฏิทิน M365)
ClearCollect(colDue,
    Filter(Tickets, IsOpen = true, DueDate >= Today(), DueDate <= DateAdd(Today(), 7, TimeUnit.Days)));

// สร้างนัดหมายส่วนตัว (Private)
Office365Outlook.V4CalendarPostItem(
    varCalId,
    txtSubject.Text,
    Text(dtStart, "yyyy-mm-ddThh:mm:ss", "en-US"),
    Text(dtEnd, "yyyy-mm-ddThh:mm:ss", "en-US"),
    "SE Asia Standard Time",
    {sensitivity: "private", showAs: "busy"})
```
⚠️ ชื่อฟังก์ชัน (`CalendarGetTablesV2`, `GetEventsCalendarViewV3`, `V4CalendarPostItem`) และชื่อพารามิเตอร์ต้องตรวจกับ Connector จริง
ปฏิทินหลักอาจไม่ใช่รายการแรกเสมอ ⚠️ ตรวจว่าเลือก `Calendar` ถูกต้องในต้นแบบ

## หน้า Dashboard ของ CEO (`scrDashboard`) — แสดงเฉพาะเมื่อ `varIsCEO`
```powerfx
// ดึงงานที่เปิดอยู่ครั้งเดียว แล้วนับจาก Collection (CountRows บน SharePoint ตรง ๆ ไม่ Delegable)
ClearCollect(colOpen, Filter(Tickets, IsOpen = true));
lblOverdue.Text  = CountRows(Filter(colOpen, DueDate < Today()))
lblWaiting.Text  = CountRows(Filter(colOpen, Status.Value = "WaitingCEO"))
lblDone.Text     = CountRows(Filter(colOpen, Status.Value = "Done"))
lblNoAck.Text    = CountRows(Filter(colOpen, Status.Value = "New", Created < DateAdd(Now(), -24, TimeUnit.Hours)))

// ตารางรายคน
galByPerson.Items = SortByColumns(
    AddColumns(GroupBy(colOpen, "Assignee", "Rows"),
        "OpenCount", CountRows(Rows),
        "OverdueCount", CountRows(Filter(Rows, DueDate < Today()))),
    "OverdueCount", SortOrder.Descending)
```
- งานที่เปิดอยู่พร้อมกันคาดว่าไม่ถึง 2,000 รายการ จึงนับจาก Collection ได้ ⚠️ ตั้ง Data row limit ใน Settings เป็น 2000
- สถิติย้อนหลัง (ปิดแล้วรายเดือน/รายปี) ให้ n8n คำนวณในสรุปวันศุกร์แทน ไม่คำนวณในแอป
- แตะการ์ด → ไปหน้า `scrTickets` พร้อมตัวกรองนั้น

## หน้าจอทั่วไป
- เปิดแอปครั้งแรกไม่มีอินเทอร์เน็ต: แสดงข้อความ `If(!Connection.Connected, "ไม่มีอินเทอร์เน็ต", "")` และปิดปุ่มบันทึกทั้งหมด
- ภาษา UI เป็นภาษาไทยทั้งหมด แสดงวันที่ด้วย `Text(d, "d mmm yyyy", "th-TH")` เฉพาะตอนแสดงผล
