# คู่มือ ซ: หน้าของ CEO ในแอป `CEO-APP`

ใช้เวลาประมาณ 4–5 ชั่วโมง (ทำทีละหน้าได้) · ทำหลัง[คู่มือ ค](C-staff-app.md) และ[คู่มือ ฉ](F-attach-files.md)
หน้าตาตามภาพตัวอย่าง "CEO-APP หน้าของ CEO" (Artifact ออกแบบ) ใช้**แอปเดียวกับพนักงาน** เพิ่ม 4 หน้าที่เปิดเฉพาะเมื่อผู้เปิดคือ CEO

| หน้า | ชื่อ | ทำอะไร |
|---|---|---|
| ภาพรวม | `scrCeoHome` | การ์ด เลยกำหนด / รอคุณตอบ / เสร็จรอตรวจ / ยังไม่รับทราบ + ตารางรายคน + งานกลุ่ม |
| งานทั้งหมด | `scrCeoTickets` | งานที่เปิดอยู่ทุกคน กรองตามสถานะ |
| รายละเอียดงาน | `scrCeoDetail` | ข้อมูลงาน ไฟล์ ประวัติ + ผ่าน / ไม่ผ่าน / ตอบ / ติดตาม / สั่งเพิ่ม / เลื่อนวันส่ง |
| สั่งงาน | `scrCeoCreate` | สั่งงานเมื่อบอท LINE ไม่ตอบ (คนเดียว หลายคน หรือหัวหน้าทุกคน) แนบไฟล์ได้ |

**หลักการ:** CEO เป็น Owner ของ Site จึงแก้ List ได้เองโดยไม่ต้องผ่าน Flow แอปเขียน `Tickets` และเขียนประวัติลง `TicketHistory` แบบ `Processed = No` เหมือนบอท LINE แล้ว Flow `OnLineEvent` ตั้งสิทธิ์และแจ้ง Teams ให้พนักงานเหมือนเดิม จึงไม่ต้องสร้าง Flow ใหม่
> การซ่อนหน้าเป็นแค่ความสะดวก ไม่ใช่ความปลอดภัย ถ้าพนักงานเข้าหน้า CEO ได้ก็ยังเห็นเฉพาะงานของตัวเอง เพราะสิทธิ์จริงอยู่ที่ SharePoint

---

## ส่วนที่ 1: ให้ `OnLineEvent` รับงานจากแอปของ CEO ด้วย (10 นาที · ทำก่อน)
1. เปิด Flow `OnLineEvent` → **Edit** → คลิก Trigger → **Settings** → **Trigger conditions** แก้เป็น
   ```
   @equals(triggerBody()?['Processed'], false)
   ```
   (Flow ของพนักงาน `UpdateTicket` และ `AttachTicketFile` เขียน `Processed = Yes` เสมอ จึงไม่ซ้ำ)
2. ข้อ 3.5 **Mark processed** → ช่อง **Source Value** เปลี่ยนเป็น Expression `triggerBody()?['Source']?['Value']` (เดิมพิมพ์ `LINE`)
3. **Save**

## ส่วนที่ 2: ตั้งค่าแอป (15 นาที)
1. แถบซ้าย **Data** → **Add data** → SharePoint → `CEO-Tickets` → ติ๊ก `Employees` → Connect (พนักงานอ่าน List นี้ไม่ได้ แต่ใช้เฉพาะในหน้า CEO จึงไม่กระทบ)
2. **App → Formulas** เพิ่มต่อท้าย (ใส่อีเมลจริงแทน `<...>` ตัวพิมพ์เล็ก ผู้พัฒนาใส่ของตัวเองไว้ทดสอบได้ แล้วลบออกก่อนใช้จริง)
   ```powerfx
   ceoEmails = ["<อีเมล CEO>", "<อีเมลผู้พัฒนา>"];
   isCEO = Lower(User().Email) in ceoEmails;
   ```
3. **App → StartScreen**
   ```powerfx
   If(!IsBlank(Param("ticketId")), scrDetail, isCEO, scrCeoHome, scrHome)
   ```
4. **Settings → General → Data row limit** = `2000`

### ส่วนหัวและแถบล่างของทุกหน้า CEO
- หัวแอป: คัดลอก `recTop` `recTopLine` `imgLogo` `imgCEO` จาก `scrTickets` มาวางทุกหน้า (โลโก้ซ้าย รูปคุณสมชายสั่งงานขวา)
- แถบล่าง 3 ปุ่ม (ทุกหน้า ยกเว้น `scrCeoDetail`): Y `Parent.Height - 66` · Height `66` · Width `Parent.Width / 3` · Fill `Color.White` · BorderColor `clrLine`

| ปุ่ม | Text | X | OnSelect |
|---|---|---|---|
| `btnCTabHome` | `"ภาพรวม"` | `0` | `Navigate(scrCeoHome)` |
| `btnCTabList` | `"งานทั้งหมด"` | `Parent.Width / 3` | `Set(varFilter, "all"); Navigate(scrCeoTickets)` |
| `btnCTabNew` | `"สั่งงาน"` | `Parent.Width * 2 / 3` | `Navigate(scrCeoCreate)` |

  ปุ่มของหน้าที่เปิดอยู่: Color `clrAccent` + FontWeight Bold · ปุ่มอื่น Color `clrMuted`
- คัดลอกทั้งชุด (4 ชิ้นหัวแอป + 3 ปุ่ม) ไปหน้าถัดไปด้วย Ctrl+C / Ctrl+V แล้วแก้สีปุ่มที่ active

---

## ส่วนที่ 3: `scrCeoHome` ภาพรวม (60 นาที)
1. **New screen** → Blank → ชื่อ `scrCeoHome`
2. **OnVisible** (โหลดครั้งเดียวแล้วนับจากข้อมูลในเครื่อง ตัวกรองทุกตัวเป็นแบบ Delegable)
   ```powerfx
   ClearCollect(colAll, Filter(Tickets, IsOpen = true));
   ClearCollect(colEmp, Filter(Employees, Active = true));
   Set(varClosed30, Filter(Tickets, IsOpen = false, ClosedAt >= DateAdd(Today(), -30, TimeUnit.Days)));
   Set(varLate, Filter(colAll, Status.Value <> "Done", DueDate < Today()))
   ```
3. Control

| Control | ชื่อ | ค่า |
|---|---|---|
| Label | `lblCHello` | Text `"สวัสดีค่ะคุณสมชาย"` · Size `22` · Bold · Color `clrPrimary` · X `20` · Y `110` |
| Label | `lblCHelloSub` | Text `Text(Today(), "dddd d mmmm", "th-TH") & " · งานเปิดอยู่ " & CountRows(colAll) & " งาน"` · Size `13` · Color `clrMuted` · Y `lblCHello.Y + 34` |
| Button ×4 | การ์ด | Width `(Parent.Width - 50) / 2` · Height `92` · Radius `14` · Align `Align.Left` · VerticalAlign `VerticalAlign.Top` · PaddingLeft/Top `14` · X `20` / `30 + (Parent.Width - 50) / 2` · Y `lblCHelloSub.Y + 36` / `+ 102` |
| | `btnCLate` | Text `"เลยกำหนด" & Char(10) & CountRows(varLate) & Char(10) & "รวม " & Sum(varLate, DateDiff(DueDate, Today())) & " วัน"` · Fill `clrAccent` · Color `Color.White` · OnSelect `Set(varFilter, "late"); Navigate(scrCeoTickets)` |
| | `btnCWait` | Text `"รอคุณตอบ" & Char(10) & CountRows(Filter(colAll, Status.Value = "WaitingCEO"))` · Fill `Color.White` · Color `clrPrimary` · BorderColor `clrLine` · OnSelect `Set(varFilter, "wait"); Navigate(scrCeoTickets)` |
| | `btnCDone` | Text `"เสร็จ รอคุณตรวจ" & Char(10) & CountRows(Filter(colAll, Status.Value = "Done"))` · สไตล์เดียวกับ `btnCWait` · Color `clrSuccess` · OnSelect `Set(varFilter, "done"); Navigate(scrCeoTickets)` |
| | `btnCNoAck` | Text `"ยังไม่รับทราบ" & Char(10) & CountRows(Filter(colAll, Status.Value = "New", Created < DateAdd(Now(), -24, TimeUnit.Hours)))` · สไตล์เดียวกับ `btnCWait` · Color `clrText` · OnSelect `Set(varFilter, "noack"); Navigate(scrCeoTickets)` |
| Label | `lblCPeopleHead` | Text `"รายคน          เปิด · ช้า · เฉลี่ยทำ"` · Bold · Y `btnCNoAck.Y + 102` |
| Vertical gallery (Blank) | `galCPeople` | Items ด้านล่าง · TemplateSize `50` · Height `220` · Y `lblCPeopleHead.Y + 28` · OnSelect `Set(varFilter, "person"); Set(varPerson, ThisItem.AssigneeEmail); Navigate(scrCeoTickets)` |
| Label ในแกลเลอรี | `lblCPerson` | Text `Coalesce(LookUp(colEmp, Lower(Email) = ThisItem.AssigneeEmail).Nickname, ThisItem.AssigneeEmail) & " (" & LookUp(colEmp, Lower(Email) = ThisItem.AssigneeEmail).Department & ")"` · Width `Parent.TemplateWidth - 150` |
| Label ในแกลเลอรี | `lblCPersonNums` | Text `ThisItem.OpenCount & " · " & ThisItem.LateCount & " · " & If(ThisItem.AvgDays > 0, Text(ThisItem.AvgDays, "0.0") & " วัน", "-")` · X `Parent.TemplateWidth - 140` · Width `130` · Align `Align.Right` · Color `If(ThisItem.LateCount > 0, clrDanger, clrText)` |

`galCPeople` Items:
```powerfx
SortByColumns(
    AddColumns(GroupBy(colAll, AssigneeEmail, Rows) As g,
        OpenCount, CountRows(g.Rows),
        LateCount, CountRows(Filter(g.Rows, Status.Value <> "Done", DueDate < Today())),
        AvgDays, With({d: Filter(varClosed30, AssigneeEmail = g.AssigneeEmail, !IsBlank(DoneAt))},
            If(CountRows(d) > 0, Average(d, DateDiff(Created, DoneAt, TimeUnit.Hours)) / 24, 0))),
    "LateCount", SortOrder.Descending, "OpenCount", SortOrder.Descending)
```
⚠️ ถ้า `GroupBy` / `AddColumns` ขึ้นเส้นแดงที่ชื่อคอลัมน์ (แอปรุ่นเก่า) ให้ใส่ชื่อในเครื่องหมายคำพูด เช่น `GroupBy(colAll, "AssigneeEmail", "Rows")` และ `"OpenCount", CountRows(g.Rows)` · `As g` ใช้แยก "คนในแถวนี้" ออกจากแถวใน `Filter` ด้านใน ห้ามตัดทิ้ง

4. งานกลุ่ม (ไม่บังคับ): Vertical gallery `galCGroups` · Items
   ```powerfx
   AddColumns(GroupBy(Filter(colAll, !IsBlank(GroupID)), GroupID, Rows),
       GTitle, First(Rows).Title,
       GOpen, CountRows(Rows),
       GDone, CountRows(Filter(Rows, Status.Value = "Done")))
   ```
   Label ในแกลเลอรี: `"กลุ่ม T-" & ThisItem.GroupID & " · " & ThisItem.GTitle & Char(10) & "ยังเปิด " & ThisItem.GOpen & " คน · เสร็จรอตรวจ " & ThisItem.GDone` · OnSelect `Set(varFilter, "group"); Set(varGroup, ThisItem.GroupID); Navigate(scrCeoTickets)`
   (นับเฉพาะใบที่ยังเปิด ภาพรวมเต็มของกลุ่มดูใน LINE: "กลุ่ม T-30 ถึงไหน")

## ส่วนที่ 4: `scrCeoTickets` งานทั้งหมด (40 นาที)
1. **New screen** → `scrCeoTickets` · **OnVisible** `ClearCollect(colAll, Filter(Tickets, IsOpen = true)); ClearCollect(colEmp, Filter(Employees, Active = true))`
2. Label `lblCListHead` Text `"งานทั้งหมด"` · Size `20` · Bold · Color `clrPrimary` · Y `106`
3. ปุ่มกรอง 5 ปุ่ม (Height `36` · Radius `18` · Size `13` · แถวเดียวหรือสองแถว)

| ปุ่ม | Text | OnSelect |
|---|---|---|
| `btnFAll` | `"ทั้งหมด"` | `Set(varFilter, "all")` |
| `btnFLate` | `"เลยกำหนด"` | `Set(varFilter, "late")` |
| `btnFWait` | `"รอคุณตอบ"` | `Set(varFilter, "wait")` |
| `btnFDone` | `"รอคุณตรวจ"` | `Set(varFilter, "done")` |
| `btnFNoAck` | `"ยังไม่รับทราบ"` | `Set(varFilter, "noack")` |

   ทุกปุ่ม: Fill `If(varFilter = "<ค่าของปุ่ม>", clrPrimary, Color.White)` · Color `If(varFilter = "<ค่าของปุ่ม>", Color.White, clrPrimary)` · BorderColor `clrLine`
4. Vertical gallery `galCAll` · TemplateSize `64` · Y ใต้ปุ่มกรอง · Height `Parent.Height - Self.Y - 70`
   - Items:
     ```powerfx
     SortByColumns(
         Switch(varFilter,
             "late", Filter(colAll, Status.Value <> "Done", DueDate < Today()),
             "wait", Filter(colAll, Status.Value = "WaitingCEO"),
             "done", Filter(colAll, Status.Value = "Done"),
             "noack", Filter(colAll, Status.Value = "New"),
             "person", Filter(colAll, AssigneeEmail = varPerson),
             "group", Filter(colAll, GroupID = varGroup),
             colAll),
         "DueDate", SortOrder.Ascending)
     ```
   - OnSelect `Set(varTicket, ThisItem); Navigate(scrCeoDetail)`
   - Rectangle `recCBar` (แถบสีซ้าย) X `0` · Width `6` · Height `Parent.TemplateHeight - 10` · Fill `Switch(true, ThisItem.Status.Value <> "Done" && ThisItem.DueDate < Today(), clrAccent, ThisItem.Status.Value = "WaitingCEO", clrPrimary, ThisItem.Status.Value = "Done", clrSuccess, clrLine)`
   - Label `lblCRow` Text `"T-" & ThisItem.ID & " " & ThisItem.Title & Char(10) & Coalesce(LookUp(colEmp, Lower(Email) = ThisItem.AssigneeEmail).Nickname, ThisItem.AssigneeEmail) & " · " & If(ThisItem.DueDate < Today(), "เลย " & DateDiff(ThisItem.DueDate, Today()) & " วัน", "ส่ง " & Text(ThisItem.DueDate, "ddd d mmm", "th-TH"))`
   - Label `lblCRowStatus` (ขวา) Text `Switch(ThisItem.Status.Value, "New", "ใหม่", "Acknowledged", "รับทราบ", "InProgress", "กำลังทำ", "WaitingCEO", "รอคุณตอบ", "Done", "รอคุณตรวจ", ThisItem.Status.Value)`

## ส่วนที่ 5: `scrCeoDetail` รายละเอียดและตรวจงาน (90 นาที)
1. **New screen** → `scrCeoDetail` (หัวแอปเหมือนหน้าอื่น ไม่มีแถบล่าง)
2. ส่วนบน
   - Icon Back `icoCBack` OnSelect `Navigate(scrCeoTickets)` · Label `lblCDTitle` Text `"T-" & varTicket.ID & " " & varTicket.Title` · Color `clrPrimary` · Bold
   - Label `lblCDInfo` (AutoHeight) Text:
     ```powerfx
     Switch(varTicket.Status.Value, "New", "ใหม่", "Acknowledged", "รับทราบ", "InProgress", "กำลังทำ", "WaitingCEO", "รอคุณตอบ", "Done", "ทำเสร็จ รอคุณตรวจ", "Closed", "ปิดแล้ว") &
     " · ส่ง " & Text(varTicket.DueDate, "dddd d mmm", "th-TH") & If(varTicket.IsOpen && varTicket.DueDate < Today(), " (เลย " & DateDiff(varTicket.DueDate, Today()) & " วัน)", "") & Char(10) &
     "ผู้รับงาน: " & Coalesce(LookUp(colEmp, Lower(Email) = varTicket.AssigneeEmail).Nickname, varTicket.AssigneeEmail) & Char(10) &
     If(IsBlank(varTicket.Details), "", "รายละเอียด: " & varTicket.Details)
     ```
   - Label `lblCDExtra` เหมือน `lblDExtra` ในคู่มือ ค ข้อ 2.4.4 (Visible `!IsBlank(varTicket.CEOExtra)`)
   - Label `lblCDFiles` เหมือน `lblSentFiles` ในคู่มือ ฉ ข้อ 2.2.1 แต่อ้าง `galCDHistory.AllItems` และเพิ่มปุ่ม `btnCDFolder` "📂 เปิดไฟล์งาน" OnSelect เดียวกับ `btnPhotos`
3. ช่องพิมพ์และปุ่ม
   - Text input (Multiline) `txtCeo` · HintText `"พิมพ์ข้อความถึงพนักงาน (คำตอบ / สิ่งที่ต้องแก้ / ข้อความติดตาม / คำสั่งเพิ่มเติม)"`
   - Date picker `dpCDue` · DefaultDate `varTicket.DueDate` · Format `"dd/mm/yyyy"`
   - ปุ่มแถวบน (ครึ่งจอ สูง 48): `btnCPass` "ผ่าน ปิดงาน" (Fill `clrSuccess`) · `btnCReject` "ไม่ผ่าน ส่งกลับ" (Fill ขาว ขอบ `clrAccent`) · DisplayMode ทั้งคู่ `If(varTicket.Status.Value = "Done", DisplayMode.Edit, DisplayMode.Disabled)`
   - ปุ่มแถวล่าง (1/4 จอ สูง 44 · Fill ขาว ขอบ `clrLine` · Color `clrPrimary`): `btnCReply` "ตอบ" · `btnCFollow` "ติดตาม" · `btnCExtra` "สั่งเพิ่ม" · `btnCDue` "เลื่อนวันส่ง" · DisplayMode `If(varTicket.IsOpen, DisplayMode.Edit, DisplayMode.Disabled)` (`btnCReply` และ `btnCExtra` ต้องมีข้อความด้วย: `If(varTicket.IsOpen && !IsBlank(Trim(txtCeo.Text)), DisplayMode.Edit, DisplayMode.Disabled)`)
4. **App → Formulas** เพิ่ม (ค่าคงที่ของประวัติที่ CEO เขียน)
   ```powerfx
   ceoHist = {Source: {Value: "App"}, Processed: false, CEOPending: false};
   ```
5. OnSelect ของแต่ละปุ่ม · ทุกปุ่มอ่านสถานะล่าสุดก่อนแก้ (กันกดซ้ำหรือพนักงานเปลี่ยนไปแล้ว) แล้วเขียนประวัติให้ `OnLineEvent` แจ้งพนักงาน

**btnCPass**
```powerfx
Set(varNow, LookUp(Tickets, ID = varTicket.ID));
If(varNow.Status.Value <> "Done",
    Notify("สถานะเปลี่ยนเป็น " & varNow.Status.Value & " ไปแล้ว", NotificationType.Warning),
    Patch(Tickets, varNow, {Status: {Value: "Closed"}, IsOpen: false, ClosedAt: Now()});
    Patch(TicketHistory, Defaults(TicketHistory), ceoHist, {Title: "T-" & varTicket.ID, TicketID: varTicket.ID, Action: {Value: "close"}, FromStatus: "Done", ToStatus: "Closed", ActorEmail: Lower(User().Email)});
    Notify("ผ่าน ปิดงานแล้ว", NotificationType.Success));
Set(varTicket, LookUp(Tickets, ID = varTicket.ID))
```

**btnCReject** (ข้อความในช่องพิมพ์ = สิ่งที่ต้องแก้ ไม่บังคับ)
```powerfx
Set(varNow, LookUp(Tickets, ID = varTicket.ID));
If(varNow.Status.Value <> "Done",
    Notify("สถานะเปลี่ยนเป็น " & varNow.Status.Value & " ไปแล้ว", NotificationType.Warning),
    Patch(Tickets, varNow, {Status: {Value: "InProgress"}});
    Patch(TicketHistory, Defaults(TicketHistory), ceoHist, {Title: "T-" & varTicket.ID, TicketID: varTicket.ID, Action: {Value: "reopen"}, FromStatus: "Done", ToStatus: "InProgress", Comment: Trim(txtCeo.Text), ActorEmail: Lower(User().Email)});
    Reset(txtCeo); Notify("ส่งกลับให้ทำต่อแล้ว", NotificationType.Success));
Set(varTicket, LookUp(Tickets, ID = varTicket.ID))
```

**btnCReply** (ถ้าพนักงานรอคำตอบอยู่ งานกลับเป็น "กำลังทำ" · ถ้าไม่ เป็นความเห็น)
```powerfx
Set(varNow, LookUp(Tickets, ID = varTicket.ID));
Set(varAnswer, varNow.Status.Value = "WaitingCEO");
If(varAnswer, Patch(Tickets, varNow, {Status: {Value: "InProgress"}}));
Patch(TicketHistory, Defaults(TicketHistory), ceoHist, {Title: "T-" & varTicket.ID, TicketID: varTicket.ID, Action: {Value: If(varAnswer, "reply", "comment")}, FromStatus: varNow.Status.Value, ToStatus: If(varAnswer, "InProgress", varNow.Status.Value), Comment: Trim(txtCeo.Text), ActorEmail: Lower(User().Email)});
Reset(txtCeo); Notify("ส่งถึงพนักงานแล้ว", NotificationType.Success);
Set(varTicket, LookUp(Tickets, ID = varTicket.ID))
```

**btnCFollow** (ไม่พิมพ์ = ข้อความมาตรฐาน)
```powerfx
Patch(TicketHistory, Defaults(TicketHistory), ceoHist, {Title: "T-" & varTicket.ID, TicketID: varTicket.ID, Action: {Value: "comment"}, FromStatus: varTicket.Status.Value, ToStatus: varTicket.Status.Value, Comment: "📣 CEO ติดตามงาน: " & Coalesce(Trim(txtCeo.Text), "ขออัปเดตความคืบหน้าภายในวันนี้"), ActorEmail: Lower(User().Email)});
Reset(txtCeo); Notify("ส่งข้อความติดตามแล้ว", NotificationType.Success)
```

**btnCExtra** (ต่อท้ายช่องคำสั่งเพิ่มเติม รูปแบบเดียวกับบอท)
```powerfx
Set(varNow, LookUp(Tickets, ID = varTicket.ID));
Set(varLine, "[" & Text(Now(), "dd/mm hh:mm") & "] " & Trim(txtCeo.Text));
Patch(Tickets, varNow, {CEOExtra: If(IsBlank(varNow.CEOExtra), varLine, varNow.CEOExtra & Char(10) & Char(10) & varLine)});
Patch(TicketHistory, Defaults(TicketHistory), ceoHist, {Title: "T-" & varTicket.ID, TicketID: varTicket.ID, Action: {Value: "comment"}, FromStatus: varNow.Status.Value, ToStatus: varNow.Status.Value, Comment: "➕ คำสั่งเพิ่มเติม: " & Trim(txtCeo.Text), ActorEmail: Lower(User().Email)});
Reset(txtCeo); Notify("เพิ่มรายละเอียดแล้ว", NotificationType.Success);
Set(varTicket, LookUp(Tickets, ID = varTicket.ID))
```

**btnCDue**
```powerfx
If(dpCDue.SelectedDate < Today() || dpCDue.SelectedDate = varTicket.DueDate,
    Notify("เลือกวันส่งใหม่ที่ยังไม่ผ่านมา", NotificationType.Warning),
    Patch(Tickets, LookUp(Tickets, ID = varTicket.ID), {DueDate: dpCDue.SelectedDate, OverdueNotified: false});
    Patch(TicketHistory, Defaults(TicketHistory), ceoHist, {Title: "T-" & varTicket.ID, TicketID: varTicket.ID, Action: {Value: "comment"}, FromStatus: varTicket.Status.Value, ToStatus: varTicket.Status.Value, Comment: "📅 CEO เลื่อนวันส่งจาก " & Text(varTicket.DueDate, "ddd d mmm", "th-TH") & " เป็น " & Text(dpCDue.SelectedDate, "ddd d mmm", "th-TH"), ActorEmail: Lower(User().Email)});
    Notify("เลื่อนวันส่งแล้ว", NotificationType.Success));
Set(varTicket, LookUp(Tickets, ID = varTicket.ID))
```

6. ประวัติ: Vertical gallery `galCDHistory` เหมือน `galHistory` ของพนักงาน (Items `SortByColumns(Filter(TicketHistory, TicketID = varTicket.ID), "Created", SortOrder.Descending)`) · ทุกปุ่มด้านบนต่อท้ายด้วย `Refresh(TicketHistory)` ถ้าอยากเห็นทันที

## ส่วนที่ 6: `scrCeoCreate` สั่งงาน (60 นาที)
1. **New screen** → `scrCeoCreate` · **OnVisible** `ClearCollect(colEmp, Filter(Employees, Active = true))`
2. Control

| Control | ชื่อ | ค่า |
|---|---|---|
| Label | `lblNHead` | `"สั่งงาน"` · Bold · Color `clrPrimary` |
| Label | `lblNNote` | `"ปกติสั่งผ่าน LINE ได้เร็วกว่า หน้านี้ใช้เมื่อบอท LINE ไม่ตอบ"` · Size `12` · Color `clrMuted` |
| Text input | `txtNTitle` | HintText `"งานอะไร"` |
| Text input (Multiline) | `txtNDetails` | HintText `"รายละเอียด (ไม่บังคับ)"` |
| Toggle | `tglNMgr` | OnText/ OffText `"หัวหน้าทุกคน"` · Visible `!IsEmpty(Filter(colEmp, IsManager = true))` |
| Combo box | `cmbNWho` | Items `colEmp` · DisplayFields `["Nickname", "Department"]` · SearchFields `["Nickname", "FirstName", "Title", "Aliases"]` · SelectMultiple `true` · DisplayMode `If(tglNMgr.Value, DisplayMode.Disabled, DisplayMode.Edit)` |
| Date picker | `dpNDue` | DefaultDate `DateAdd(Today(), 1, TimeUnit.Days)` |
| Attachments | `attNew` | คัดลอก `attFiles` จาก `scrDetail` (Items `Blank()`, MaxAttachments `5`) · DisplayMode `DisplayMode.Edit` |
| Button | `btnNCreate` | Text `"สั่งงาน"` · Fill `clrAccent` · DisplayMode `If(varBusy \|\| IsBlank(Trim(txtNTitle.Text)) \|\| (!tglNMgr.Value && IsEmpty(cmbNWho.SelectedItems)) \|\| dpNDue.SelectedDate < Today(), DisplayMode.Disabled, DisplayMode.Edit)` |

3. **btnNCreate → OnSelect** (คนเดียวหรือหลายคน หลายคนผูกเป็นกลุ่มด้วย `GroupID` เหมือนบอท)
```powerfx
Set(varBusy, true);
Set(varWho, If(tglNMgr.Value, Filter(colEmp, IsManager = true), cmbNWho.SelectedItems));
Set(varBase, {Title: Trim(txtNTitle.Text), Details: Trim(txtNDetails.Text), DueDate: dpNDue.SelectedDate,
    Priority: {Value: "Normal"}, Status: {Value: "New"}, IsOpen: true, OverdueNotified: false, NoAckNotified: false,
    Source: {Value: "App"}, PermsSet: false, HasFiles: false});
Set(varFirst, Patch(Tickets, Defaults(Tickets), varBase, {AssigneeEmail: Lower(First(varWho).Email)}));
ClearCollect(colMade, varFirst);
If(CountRows(varWho) > 1,
    Patch(Tickets, varFirst, {GroupID: varFirst.ID});
    ForAll(LastN(varWho, CountRows(varWho) - 1) As p,
        Collect(colMade, Patch(Tickets, Defaults(Tickets), varBase, {AssigneeEmail: Lower(p.Email), GroupID: varFirst.ID}))));
ForAll(colMade As t,
    Patch(TicketHistory, Defaults(TicketHistory), ceoHist, {Title: "T-" & t.ID, TicketID: t.ID, Action: {Value: "create"}, ToStatus: "New", ActorEmail: Lower(User().Email)}));
ForAll(attNew.Attachments As f, ForAll(colMade As t, AttachTicketFile.Run(t.ID, {contentBytes: f.Value, name: f.Name})));
Set(varBusy, false);
Notify("สั่งงานแล้ว " & Concat(colMade, "T-" & ID, ", "), NotificationType.Success);
Reset(txtNTitle); Reset(txtNDetails); Reset(cmbNWho); Reset(tglNMgr); Reset(attNew)
```
- ถ้า `ForAll` ที่มี `Collect` ขึ้นเตือนเรื่องลำดับ ไม่เป็นไร งานถูกสร้างทีละใบตามรายชื่อ
- Flow `OnLineEvent` (ส่วนที่ 1) ตั้งสิทธิ์ ส่ง Teams และตั้ง `PermsSet = Yes` ให้ทุกใบภายในไม่กี่นาที · ไฟล์แนบผ่าน `AttachTicketFile` (CEO ได้รับอนุญาตอยู่แล้ว)

---

## ทดสอบ
| # | ทำ | ผลที่ต้องได้ |
|---|---|---|
| H1 | CEO เปิดแอป | เปิดที่ `scrCeoHome` ตัวเลขการ์ดตรงกับ "สรุป" ใน LINE |
| H2 | พนักงานเปิดแอป | เปิดที่ `scrHome` ไม่เห็นหน้า CEO |
| H3 | แตะการ์ด "เลยกำหนด" | `scrCeoTickets` กรองเฉพาะงานเลยกำหนด |
| H4 | งานที่ Done → **ผ่าน ปิดงาน** | งานหายจากรายการ พนักงานได้ Teams "CEO ปิดงานแล้ว" |
| H5 | งานที่ Done → พิมพ์ "แก้หน้า 3" → **ไม่ผ่าน** | สถานะกำลังทำ พนักงานได้ Teams "CEO ส่งกลับให้ทำต่อ" และเห็นข้อความในประวัติ |
| H6 | **ติดตาม** / **สั่งเพิ่ม** / **เลื่อนวันส่ง** | พนักงานได้ Teams `📣 CEO ติดตามงาน` / `CEO สั่งงานเพิ่มเติม` / `CEO เลื่อนวันส่ง` (คู่มือ ก ข้อ 7.2) · `CEOExtra` และ `DueDate` เปลี่ยน |
| H7 | สั่งงานให้ 2 คน + แนบไฟล์ 1 ไฟล์ | ได้ 2 ใบ `GroupID` เดียวกัน แต่ละคนเห็นเฉพาะใบตัวเองและไฟล์ในโฟลเดอร์ของใบตัวเอง |
| H8 | กด **ผ่าน** ซ้ำเร็ว ๆ 2 ครั้ง | ครั้งที่ 2 ขึ้น "สถานะเปลี่ยนเป็น Closed ไปแล้ว" ไม่มีประวัติซ้ำ |
| H9 | ใน List `TicketHistory` | รายการที่ CEO ทำจากแอปเป็น `Source = App`, `Processed = Yes` หลัง Flow ทำงาน |
