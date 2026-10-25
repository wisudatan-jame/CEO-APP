from yamlgen import *
from staff_screens import kpi, history_card

CEO_TABS = [('Home', '"ภาพรวม"', 'Navigate(scrCeoHome)'), ('List', '"งานทั้งหมด"', 'Set(varFilter, "all"); Navigate(scrCeoTickets)'),
            ('New', '"สั่งงาน"', 'Navigate(scrCeoCreate)')]
HIST = '{Source: {Value: "App"}, Processed: false, CEOPending: false}'
NAME = 'Coalesce(LookUp(colEmp, Lower(Email) = {e}).Nickname, {e})'
CHIP_W = '(Parent.Width - 48 - {g}) / {n}'

def chip(text, cond, onselect, **p):
    return button(text, onselect, Fill=f'If({cond}, clrPrimary, Color.White)', Color=f'If({cond}, Color.White, clrPrimary)',
                  BorderColor='clrLine', BorderThickness=2, Size=14, Height=p.pop('Height', 52),
                  RadiusTopLeft=26, RadiusTopRight=26, RadiusBottomLeft=26, RadiusBottomRight=26, **p)

def scr_ceo_home():
    on_visible = '''ClearCollect(colAll, Filter(Tickets, IsOpen = true));
ClearCollect(colEmp, Filter(Employees, Active = true));
Set(varClosed30, Filter(Tickets, IsOpen = false, ClosedAt >= DateAdd(Today(), -30, TimeUnit.Days)));
Set(varCLate, Filter(colAll, Status.Value <> "Done", DueDate < Today()))'''
    people = '''SortByColumns(
    AddColumns(GroupBy(colAll, AssigneeEmail, Rows),
        OpenCount, CountRows(Rows),
        LateCount, CountRows(Filter(Rows, Status.Value <> "Done", DueDate < Today())),
        AvgDays, With({who: AssigneeEmail},
            With({d: Filter(varClosed30, AssigneeEmail = who, !IsBlank(DoneAt))},
                If(CountRows(d) > 0, Average(d, DateDiff(Created, DoneAt, TimeUnit.Hours)) / 24, 0)))),
    "LateCount", SortOrder.Descending, "OpenCount", SortOrder.Descending)'''
    groups = '''AddColumns(GroupBy(Filter(colAll, !IsBlank(GroupID)), GroupID, Rows),
    GTitle, First(Rows).Title,
    GOpen, CountRows(Rows),
    GDone, CountRows(Filter(Rows, Status.Value = "Done")))'''
    person_name = NAME.format(e='ThisItem.AssigneeEmail') + ' & " (" & LookUp(colEmp, Lower(Email) = ThisItem.AssigneeEmail).Department & ")"'
    x2 = '36 + (Parent.Width - 60) / 2'
    children = header('CH') + [
        ('lblCHello', label('"สวัสดีค่ะคุณสมชาย"', X=24, Y=108, Width='Parent.Width - 48', Height=46, Size=22, FontWeight='FontWeight.Bold', Color='clrPrimary')),
        ('lblCHelloSub', label('Text(Today(), "dddd d mmmm", "th-TH") & " · งานเปิดอยู่ " & CountRows(colAll) & " งาน"',
                               X=24, Y=154, Width='Parent.Width - 48', Height=32, Size=13, Color='clrMuted')),
        ('btnCLate', kpi('"เลยกำหนด" & Char(10) & CountRows(varCLate) & Char(10) & "รวม " & Sum(varCLate, DateDiff(DueDate, Today())) & " วัน"',
                         'Set(varFilter, "late"); Navigate(scrCeoTickets)', 'clrAccent', 'Color.White', 'clrAccent', 24, 196)),
        ('btnCWait', kpi('"รอคุณตอบ" & Char(10) & CountRows(Filter(colAll, Status.Value = "WaitingCEO"))',
                         'Set(varFilter, "wait"); Navigate(scrCeoTickets)', 'Color.White', 'clrPrimary', 'clrLine', x2, 196)),
        ('btnCDone', kpi('"เสร็จ รอคุณตรวจ" & Char(10) & CountRows(Filter(colAll, Status.Value = "Done"))',
                         'Set(varFilter, "done"); Navigate(scrCeoTickets)', 'Color.White', 'clrSuccess', 'clrLine', 24, 338)),
        ('btnCNoAck', kpi('"ยังไม่รับทราบ" & Char(10) & CountRows(Filter(colAll, Status.Value = "New", Created < DateAdd(Now(), -24, TimeUnit.Hours)))',
                          'Set(varFilter, "noack"); Navigate(scrCeoTickets)', 'Color.White', 'clrText', 'clrLine', x2, 338)),
        ('lblCPeopleHead', label('"รายคน"', X=24, Y=482, Width=200, Height=36, Size=16, FontWeight='FontWeight.Bold')),
        ('lblCPeopleCols', label('"เปิด · ช้า · เฉลี่ยทำ"', X='Parent.Width - 284', Y=482, Width=260, Height=36, Size=12, Color='clrMuted', Align='Align.Right')),
        ('galCPeople', gallery(people, [
            ('lblCPerson', label(person_name, X=16, Y=0, Width='Parent.TemplateWidth - 200', Height='Parent.TemplateHeight - 1', Size=14, OnSelect='Select(Parent)')),
            ('lblCPersonNums', label('ThisItem.OpenCount & " · " & ThisItem.LateCount & " · " & If(ThisItem.AvgDays > 0, Text(ThisItem.AvgDays, "0.0") & " วัน", "-")',
                                     X='Parent.TemplateWidth - 186', Y=0, Width=170, Height='Parent.TemplateHeight - 1', Size=14, Align='Align.Right',
                                     FontWeight='FontWeight.Semibold', Color='If(ThisItem.LateCount > 0, clrDanger, clrText)', OnSelect='Select(Parent)')),
            ('recCPLine', rect(X=16, Y='Parent.TemplateHeight - 1', Width='Parent.TemplateWidth - 32', Height=1, Fill='clrLine', OnSelect='Select(Parent)')),
        ], X=24, Y=520, Width='Parent.Width - 48', Height=300, TemplateSize=60, Fill='Color.White', BorderColor='clrLine', BorderThickness=2,
           OnSelect='Set(varFilter, "person"); Set(varPerson, ThisItem.AssigneeEmail); Navigate(scrCeoTickets)')),
        ('galCGroups', gallery(groups, [
            ('lblCGroup', label('"กลุ่ม T-" & ThisItem.GroupID & " · " & ThisItem.GTitle & Char(10) & "ยังเปิด " & ThisItem.GOpen & " คน · เสร็จรอตรวจ " & ThisItem.GDone',
                                X=16, Y=0, Width='Parent.TemplateWidth - 32', Height='Parent.TemplateHeight - 1', Size=13, OnSelect='Select(Parent)')),
            ('recCGLine', rect(X=16, Y='Parent.TemplateHeight - 1', Width='Parent.TemplateWidth - 32', Height=1, Fill='clrLine', OnSelect='Select(Parent)')),
        ], X=24, Y=832, Width='Parent.Width - 48', Height=140, TemplateSize=70, Fill='Color.White', BorderColor='clrLine', BorderThickness=2,
           Visible='!IsEmpty(Self.AllItems)', OnSelect='Set(varFilter, "group"); Set(varGroup, ThisItem.GroupID); Navigate(scrCeoTickets)')),
    ] + tabs('CH', CEO_TABS, 'Home')
    return screen('scrCeoHome', {'Fill': 'clrBg', 'OnVisible': on_visible}, children)

def scr_ceo_tickets():
    items = '''SortByColumns(
    Switch(varFilter,
        "late", Filter(colAll, Status.Value <> "Done", DueDate < Today()),
        "wait", Filter(colAll, Status.Value = "WaitingCEO"),
        "done", Filter(colAll, Status.Value = "Done"),
        "noack", Filter(colAll, Status.Value = "New"),
        "person", Filter(colAll, AssigneeEmail = varPerson),
        "group", Filter(colAll, GroupID = varGroup),
        colAll),
    "DueDate", SortOrder.Ascending)'''
    row = ('"T-" & ThisItem.ID & " " & ThisItem.Title & Char(10) & ' + NAME.format(e='ThisItem.AssigneeEmail') +
           ' & " · " & If(ThisItem.DueDate < Today(), "เลย " & DateDiff(ThisItem.DueDate, Today()) & " วัน", "ส่ง " & Text(ThisItem.DueDate, "ddd d mmm", "th-TH"))')
    status = 'Switch(ThisItem.Status.Value, "New", "ใหม่", "Acknowledged", "รับทราบ", "InProgress", "กำลังทำ", "WaitingCEO", "รอคุณตอบ", "Done", "รอคุณตรวจ", ThisItem.Status.Value)'
    bar = ('Switch(true, ThisItem.Status.Value <> "Done" && ThisItem.DueDate < Today(), clrAccent, ThisItem.Status.Value = "WaitingCEO", clrPrimary, '
           'ThisItem.Status.Value = "Done", clrSuccess, clrLine)')
    w3 = CHIP_W.format(g=24, n=3)
    chips = [('all', '"ทั้งหมด"', 0, 0), ('late', '"เลยกำหนด"', 1, 0), ('wait', '"รอคุณตอบ"', 2, 0), ('done', '"รอคุณตรวจ"', 0, 1), ('noack', '"ยังไม่รับทราบ"', 1, 1)]
    chip_ctrls = [(f'btnF{k.capitalize()}', chip(t, f'varFilter = "{k}"', f'Set(varFilter, "{k}")', X=f'24 + {c} * ({w3} + 12)', Y=160 + r * 62, Width=w3))
                  for k, t, c, r in chips]
    note = 'If(varFilter = "person", "เฉพาะงานของ" & ' + NAME.format(e='varPerson') + ', varFilter = "group", "เฉพาะงานกลุ่ม T-" & varGroup, "")'
    children = header('CT') + [
        ('lblCListHead', label('"งานทั้งหมด"', X=24, Y=104, Width='Parent.Width - 48', Height=52, Size=20, FontWeight='FontWeight.Bold', Color='clrPrimary')),
    ] + chip_ctrls + [
        ('lblCFilterNote', label(note, X=24, Y=284, Width='Parent.Width - 48', Height=40, Size=13, Color='clrPrimary', FontWeight='FontWeight.Semibold',
                                 Visible='varFilter in ["person", "group"]')),
        ('galCAll', gallery(items, [
            ('recCBar', rect(X=0, Y=10, Width=8, Height='Parent.TemplateHeight - 20', Fill=bar, OnSelect='Select(Parent)')),
            ('lblCRow', label(row, X=20, Y=4, Width='Parent.TemplateWidth - 190', Height='Parent.TemplateHeight - 8', Size=13, OnSelect='Select(Parent)')),
            ('lblCRowStatus', label(status, X='Parent.TemplateWidth - 166', Y=0, Width=150, Height='Parent.TemplateHeight - 1', Size=13, Align='Align.Right',
                                    FontWeight='FontWeight.Semibold', Color='clrPrimary', OnSelect='Select(Parent)')),
            ('recCRowLine', rect(X=20, Y='Parent.TemplateHeight - 1', Width='Parent.TemplateWidth - 20', Height=1, Fill='clrLine', OnSelect='Select(Parent)')),
        ], X=24, Y=330, Width='Parent.Width - 48', Height=f'Parent.Height - {TAB_H} - 16 - Self.Y', TemplateSize=84, Fill='Color.White',
           BorderColor='clrLine', BorderThickness=2, OnSelect='Set(varTicket, ThisItem); Navigate(scrCeoDetail)')),
        ('lblCListEmpty', label('"ไม่มีงานในหมวดนี้"', X=40, Y=350, Width='Parent.Width - 80', Height=50, Color='clrMuted', Visible='IsEmpty(galCAll.AllItems)')),
    ] + tabs('CT', CEO_TABS, 'List')
    on_visible = 'ClearCollect(colAll, Filter(Tickets, IsOpen = true));\nClearCollect(colEmp, Filter(Employees, Active = true))'
    return screen('scrCeoTickets', {'Fill': 'clrBg', 'OnVisible': on_visible}, children)

def scr_ceo_detail():
    who = NAME.format(e='varTicket.AssigneeEmail')
    status = '''Switch(varTicket.Status.Value, "New", "ใหม่", "Acknowledged", "รับทราบ", "InProgress", "กำลังทำ", "WaitingCEO", "รอคุณตอบ", "Done", "ทำเสร็จ รอคุณตรวจ", "Closed", "ปิดแล้ว") &
" · ส่ง " & Text(varTicket.DueDate, "dddd d mmm", "th-TH") & If(varTicket.IsOpen && varTicket.DueDate < Today(), " · เลย " & DateDiff(varTicket.DueDate, Today()) & " วัน", "")'''
    info = f'''"ผู้รับงาน: " & {who} & Char(10) &
"สั่งเมื่อ: " & Text(varTicket.Created, "d mmm hh:mm", "th-TH") & " ผ่าน " & varTicket.Source.Value &
If(IsBlank(varTicket.Details), "", Char(10) & "รายละเอียด: " & varTicket.Details)'''
    files = '''With({rows: Filter(galCDHistory.AllItems, StartsWith(Comment, "📎"))},
    "ไฟล์งาน" & Char(10) &
    If(IsEmpty(rows),
        If(varTicket.HasFiles, "มีไฟล์ในโฟลเดอร์งาน (รูปที่สั่งผ่าน LINE)", "ยังไม่มีไฟล์"),
        Concat(rows, "• " & If(StartsWith(Comment, "📎 แนบไฟล์"), Mid(Comment, Find(": ", Comment) + 18), Trim(Mid(Comment, 3))) & "  (" & Text(Created, "d mmm hh:mm", "th-TH") & ")", Char(10))))'''
    folder = 'Launch("https://digitalfocusth.sharepoint.com/sites/CEO-Tickets/TicketFiles/Forms/AllItems.aspx?id=" & EncodeUrl("/sites/CEO-Tickets/TicketFiles/T-" & varTicket.ID))'
    hist = lambda action, frm, to, comment: (f'Patch(TicketHistory, Defaults(TicketHistory), {HIST}, {{Title: "T-" & varTicket.ID, TicketID: varTicket.ID, '
                                              f'Action: {{Value: {action}}}, FromStatus: {frm}, ToStatus: {to}, Comment: {comment}, ActorEmail: Lower(User().Email)}})')
    tail = 'Set(varTicket, LookUp(Tickets, ID = varTicket.ID));\nRefresh(TicketHistory)'
    pass_ = f'''Set(varNow, LookUp(Tickets, ID = varTicket.ID));
If(varNow.Status.Value <> "Done",
    Notify("สถานะเปลี่ยนเป็น " & varNow.Status.Value & " ไปแล้ว", NotificationType.Warning),
    Patch(Tickets, varNow, {{Status: {{Value: "Closed"}}, IsOpen: false, ClosedAt: Now()}});
    {hist('"close"', '"Done"', '"Closed"', 'Trim(txtCeo.Text)')};
    Reset(txtCeo); Notify("ผ่าน ปิดงานแล้ว", NotificationType.Success));
{tail}'''
    reject = f'''Set(varNow, LookUp(Tickets, ID = varTicket.ID));
If(varNow.Status.Value <> "Done",
    Notify("สถานะเปลี่ยนเป็น " & varNow.Status.Value & " ไปแล้ว", NotificationType.Warning),
    Patch(Tickets, varNow, {{Status: {{Value: "InProgress"}}}});
    {hist('"reopen"', '"Done"', '"InProgress"', 'Trim(txtCeo.Text)')};
    Reset(txtCeo); Notify("ส่งกลับให้ทำต่อแล้ว", NotificationType.Success));
{tail}'''
    reply = f'''Set(varNow, LookUp(Tickets, ID = varTicket.ID));
Set(varAnswer, varNow.Status.Value = "WaitingCEO");
If(varAnswer, Patch(Tickets, varNow, {{Status: {{Value: "InProgress"}}}}));
{hist('If(varAnswer, "reply", "comment")', 'varNow.Status.Value', 'If(varAnswer, "InProgress", varNow.Status.Value)', 'Trim(txtCeo.Text)')};
Reset(txtCeo); Notify("ส่งถึงพนักงานแล้ว", NotificationType.Success);
{tail}'''
    follow = f'''{hist('"comment"', 'varTicket.Status.Value', 'varTicket.Status.Value', '"📣 CEO ติดตามงาน: " & Coalesce(Trim(txtCeo.Text), "ขออัปเดตความคืบหน้าภายในวันนี้")')};
Reset(txtCeo); Notify("ส่งข้อความติดตามแล้ว", NotificationType.Success);
Refresh(TicketHistory)'''
    def due(date_expr):
        return f'''With({{d: {date_expr}}},
    If(d < Today() || d = varTicket.DueDate,
        Notify("เลือกวันส่งใหม่ที่ยังไม่ผ่านมา", NotificationType.Warning),
        Patch(Tickets, LookUp(Tickets, ID = varTicket.ID), {{DueDate: d, OverdueNotified: false}});
        {hist('"comment"', 'varTicket.Status.Value', 'varTicket.Status.Value', '"📅 CEO เลื่อนวันส่งจาก " & Text(varTicket.DueDate, "ddd d mmm", "th-TH") & " เป็น " & Text(d, "ddd d mmm", "th-TH")')};
        Notify("เลื่อนวันส่งแล้ว", NotificationType.Success)));
Set(varPickDue, false);
{tail}'''
    friday = 'DateAdd(Today(), Mod(6 - Weekday(Today()), 7), TimeUnit.Days)'
    big = dict(Height=64, Size=16, FontWeight='FontWeight.Bold', RadiusTopLeft=16, RadiusTopRight=16, RadiusBottomLeft=16, RadiusBottomRight=16,
               DisplayMode='If(varTicket.Status.Value = "Done", DisplayMode.Edit, DisplayMode.Disabled)',
               DisabledFill='Color.White', DisabledColor='ColorFade(clrMuted, 40%)', DisabledBorderColor='clrLine')
    small = dict(Height=56, Size=14, Fill='Color.White', Color='clrPrimary', BorderColor='clrLine', BorderThickness=2,
                 DisabledFill='Color.White', DisabledColor='ColorFade(clrPrimary, 50%)', DisabledBorderColor='clrLine')
    open_mode = 'If(varTicket.IsOpen, DisplayMode.Edit, DisplayMode.Disabled)'
    body = vbox([
        ('conCDTitle', in_box(hbox([
            ('icoCBack', in_box({'type': 'Classic/Icon@2.5.0', 'props': {
                'Icon': 'Icon.ChevronLeft', 'Color': 'clrPrimary', 'BorderColor': 'clrPrimary', 'BorderThickness': 3,
                'PaddingTop': 12, 'PaddingBottom': 12, 'PaddingLeft': 12, 'PaddingRight': 12,
                'Width': 60, 'Height': 60, 'OnSelect': 'Navigate(scrCeoTickets)'}}, 0, LayoutMinWidth=60)),
            ('lblCDTitle', in_box(label('"T-" & varTicket.ID & " " & varTicket.Title', Size=19, FontWeight='FontWeight.Bold', Color='clrPrimary', Height=60), 1)),
        ], Height=64, LayoutAlignItems='LayoutAlignItems.Center', LayoutGap=14))),
        ('lblCDStatus', in_box(label(status, Height=40, Size=14, FontWeight='FontWeight.Bold',
                                     Color='If(varTicket.Status.Value = "Done", clrSuccess, varTicket.IsOpen && varTicket.DueDate < Today(), clrDanger, clrPrimary)'))),
        ('conCDInfo', card([
            ('lblCDInfo', in_box(label(info, AutoHeight='true', Size=14))),
            ('lblCDExtra', in_box(label('"สั่งเพิ่ม" & Char(10) & varTicket.CEOExtra', AutoHeight='true', Size=14,
                                        Visible='!IsBlank(varTicket.CEOExtra)', Fill='ColorFade(clrAccent, 92%)', BorderColor='ColorFade(clrAccent, 50%)',
                                        BorderThickness=2, PaddingTop=10, PaddingBottom=10, PaddingLeft=12, PaddingRight=12))),
        ], 'lblCDInfo.Height + If(lblCDExtra.Visible, lblCDExtra.Height + 10, 0) + 28')),
        ('conCDFiles', card([
            ('lblCDFiles', in_box(label(files, AutoHeight='true', Size=13))),
            ('btnCDFolder', in_box(button('"เปิดโฟลเดอร์"', folder, Height=60, Size=14, Fill='Color.White', Color='clrPrimary', BorderColor='clrLine',
                                          BorderThickness=2, DisplayMode='If(varTicket.HasFiles, DisplayMode.Edit, DisplayMode.Disabled)',
                                          DisabledFill='Color.White', DisabledColor='ColorFade(clrPrimary, 50%)', DisabledBorderColor='clrLine'))),
        ], 'lblCDFiles.Height + 10 + 60 + 28')),
        history_card('galCDHistory', 'recCDHistLine', 'lblCDHist', 'lblCDHistHead', 'conCDHist'),
        ('conCDAction', card([
            ('txtCeo', in_box({'type': 'Classic/TextInput@2.3.2', 'props': {
                'Default': '""', 'Mode': 'TextMode.MultiLine', 'Height': 70, 'Font': FONT, 'Size': 14,
                'HintText': f'"ข้อความถึง" & {who} & " (ไม่ผ่าน / ตอบ / ติดตาม ใส่ได้) เช่น ขอเพิ่มเงื่อนไขการต่ออายุสัญญา"',
                'BorderColor': 'clrLine', 'BorderThickness': 2, 'Fill': 'Color.White', 'HoverFill': 'Color.White',
                'RadiusTopLeft': 10, 'RadiusTopRight': 10, 'RadiusBottomLeft': 10, 'RadiusBottomRight': 10}})),
            ('conCDDue', in_box(hbox([
                ('btnCDue1', in_box(button('"พรุ่งนี้"', due('DateAdd(Today(), 1, TimeUnit.Days)'), **small), 1)),
                ('btnCDue2', in_box(button('"ศุกร์นี้"', due(friday), **small), 1)),
                ('btnCDue3', in_box(button('"+7 วัน"', due('DateAdd(varTicket.DueDate, 7, TimeUnit.Days)'), **small), 1)),
            ], Height=56, Visible='varPickDue'))),
            ('conCDBig', in_box(hbox([
                ('btnCPass', in_box(button('"ผ่าน ปิดงาน"', pass_, Fill='clrSuccess', BorderColor='clrSuccess', **big), 1)),
                ('btnCReject', in_box(button('"ไม่ผ่าน ส่งกลับ"', reject, Fill='Color.White', Color='clrAccent', BorderColor='clrAccent', BorderThickness=3, **big), 1)),
            ], Height=64))),
            ('conCDSmall', in_box(hbox([
                ('btnCReply', in_box(button('"ตอบ"', reply, DisplayMode='If(varTicket.IsOpen && !IsBlank(Trim(txtCeo.Text)), DisplayMode.Edit, DisplayMode.Disabled)', **small), 1)),
                ('btnCFollow', in_box(button('"ติดตาม"', follow, DisplayMode=open_mode, **small), 1)),
                ('btnCDue', in_box(button('If(varPickDue, "ปิดเลือกวัน", "เลื่อนวันส่ง")', 'Set(varPickDue, !varPickDue)', DisplayMode=open_mode, **small), 1)),
            ], Height=56))),
        ], '70 + If(varPickDue, 56 + 10, 0) + 64 + 56 + 2 * 10 + 28')),
    ], X=0, Y=94, Width='Parent.Width', Height=f'Parent.Height - 94 - {TAB_H}', Fill='clrBg', LayoutGap=12,
       PaddingTop=12, PaddingBottom=16, PaddingLeft=20, PaddingRight=20, LayoutOverflowY='LayoutOverflow.Scroll')
    children = header('CD') + [('conCDBody', body)] + tabs('CD', CEO_TABS, 'List')
    on_visible = 'Set(varPickDue, false);\nIf(IsEmpty(colEmp), ClearCollect(colEmp, Filter(Employees, Active = true)));\nRefresh(TicketHistory)'
    return screen('scrCeoDetail', {'Fill': 'clrBg', 'OnVisible': on_visible}, children)

def scr_ceo_create():
    on_visible = '''ClearCollect(colEmp, Filter(Employees, Active = true));
If(IsBlank(varNDue), Set(varNDue, DateAdd(Today(), 1, TimeUnit.Days)))'''
    create = f'''Set(varBusy, true);
Set(varWho, If(varNMgr, Filter(colEmp, IsManager = true), colPick));
Set(varBase, {{Title: Trim(txtNTitle.Text), Details: Trim(txtNDetails.Text), DueDate: varNDue,
    Priority: {{Value: "Normal"}}, Status: {{Value: "New"}}, IsOpen: true, OverdueNotified: false, NoAckNotified: false,
    Source: {{Value: "App"}}, PermsSet: false, HasFiles: false}});
Set(varFirst, Patch(Tickets, Defaults(Tickets), varBase, {{AssigneeEmail: Lower(First(varWho).Email)}}));
ClearCollect(colMade, varFirst);
If(CountRows(varWho) > 1,
    Patch(Tickets, varFirst, {{GroupID: varFirst.ID}});
    ForAll(LastN(varWho, CountRows(varWho) - 1) As p,
        Collect(colMade, Patch(Tickets, Defaults(Tickets), varBase, {{AssigneeEmail: Lower(p.Email), GroupID: varFirst.ID}}))));
ForAll(colMade As t,
    Patch(TicketHistory, Defaults(TicketHistory), {HIST}, {{Title: "T-" & t.ID, TicketID: t.ID, Action: {{Value: "create"}}, ToStatus: "New", ActorEmail: Lower(User().Email)}}));
ForAll(attNew.Attachments As f, ForAll(colMade As t, AttachTicketFile.Run(t.ID, {{contentBytes: f.Value, name: f.Name}})));
Set(varBusy, false);
Notify("สั่งงานแล้ว " & Concat(colMade, "T-" & ID, ", "), NotificationType.Success);
Reset(txtNTitle); Reset(txtNDetails); Reset(attNew); Clear(colPick); Set(varNMgr, false)'''
    picked = '!IsBlank(LookUp(colPick, Email = ThisItem.Email))'
    toggle = f'If({picked}, Remove(colPick, LookUp(colPick, Email = ThisItem.Email)), Collect(colPick, ThisItem))'
    who_text = ('If(varNMgr, "หัวหน้าทุกคน " & CountRows(Filter(colEmp, IsManager = true)) & " คน", '
                'IsEmpty(colPick), "ยังไม่ได้เลือกคน", Concat(colPick, Coalesce(Nickname, FirstName), ", "))')
    monday = 'DateAdd(Today(), If(Mod(9 - Weekday(Today()), 7) = 0, 7, Mod(9 - Weekday(Today()), 7)), TimeUnit.Days)'
    friday = 'DateAdd(Today(), Mod(6 - Weekday(Today()), 7), TimeUnit.Days)'
    w4 = CHIP_W.format(g=36, n=4)
    days = [('Today', '"วันนี้"', 'Today()'), ('Tmr', '"พรุ่งนี้"', 'DateAdd(Today(), 1, TimeUnit.Days)'), ('Fri', '"ศุกร์นี้"', friday), ('Mon', '"จันทร์หน้า"', monday)]
    day_ctrls = [(f'btnNDay{k}', chip(t, f'varNDue = {d}', f'Set(varNDue, {d})', X=f'24 + {i} * ({w4} + 12)', Y=672, Width=w4))
                 for i, (k, t, d) in enumerate(days)]
    tin = lambda hint, h: {'type': 'Classic/TextInput@2.3.2', 'props': {
        'Default': '""', 'HintText': hint, 'Height': h, 'Font': FONT, 'Size': 15, 'BorderColor': 'clrLine', 'BorderThickness': 2,
        'Fill': 'Color.White', 'HoverFill': 'Color.White', 'X': 24, 'Width': 'Parent.Width - 48',
        'RadiusTopLeft': 10, 'RadiusTopRight': 10, 'RadiusBottomLeft': 10, 'RadiusBottomRight': 10}}
    title_in = tin('"งานอะไร เช่น เตรียมสไลด์ประชุมบอร์ด"', 60); title_in['props']['Y'] = 190
    det_in = tin('"รายละเอียด (ไม่บังคับ)"', 76); det_in['props'].update(Y=258, Mode='TextMode.MultiLine')
    att = {'type': 'Attachments@2.3.0', 'props': {
        'Items': 'Blank()', 'MaxAttachments': 5, 'MaxAttachmentSize': 10, 'NoAttachmentsText': '""', 'DisplayMode': 'DisplayMode.Edit',
        'AddAttachmentText': '"แนบรูปหรือไฟล์ (ไม่บังคับ)"', 'Font': FONT, 'Size': 13, 'Color': 'clrPrimary', 'Fill': 'Color.White',
        'BorderColor': 'clrLine', 'BorderThickness': 2, 'BorderStyle': 'BorderStyle.Dashed', 'ItemFill': 'clrBg', 'ItemColor': 'clrText',
        'ItemHoverFill': 'clrLine', 'HoverFill': 'clrBg', 'X': 24, 'Y': 736, 'Width': 'Parent.Width - 48', 'Height': 96}}
    children = header('CN') + [
        ('lblNHead', label('"สั่งงาน"', X=24, Y=104, Width='Parent.Width - 48', Height=46, Size=20, FontWeight='FontWeight.Bold', Color='clrPrimary')),
        ('lblNNote', label('"ปกติสั่งผ่าน LINE ได้เร็วกว่า หน้านี้ใช้เมื่อบอท LINE ไม่ตอบ"', X=24, Y=148, Width='Parent.Width - 48', Height=34, Size=12, Color='clrMuted')),
        ('txtNTitle', title_in),
        ('txtNDetails', det_in),
        ('lblNWhoHead', label('"สั่งใคร"', X=24, Y=344, Width=200, Height=34, Size=14, FontWeight='FontWeight.Bold')),
        ('btnNMgr', chip('"หัวหน้าทุกคน (" & CountRows(Filter(colEmp, IsManager = true)) & ")"', 'varNMgr', 'Set(varNMgr, !varNMgr)',
                         X='Parent.Width - 284', Y=338, Width=260, Height=46)),
        ('galNWho', gallery('SortByColumns(colEmp, "Nickname", SortOrder.Ascending)', [
            ('btnNWho', button('Coalesce(ThisItem.Nickname, ThisItem.FirstName) & " · " & ThisItem.Department', toggle,
                               X=4, Y=4, Width='Parent.TemplateWidth - 8', Height='Parent.TemplateHeight - 8', Size=12,
                               Fill=f'If({picked}, clrPrimary, Color.White)', Color=f'If({picked}, Color.White, clrPrimary)',
                               BorderColor='clrLine', BorderThickness=2, RadiusTopLeft=24, RadiusTopRight=24, RadiusBottomLeft=24, RadiusBottomRight=24,
                               DisplayMode='If(varNMgr, DisplayMode.Disabled, DisplayMode.Edit)',
                               DisabledFill='clrBg', DisabledColor='clrMuted', DisabledBorderColor='clrLine')),
        ], X=24, Y=390, Width='Parent.Width - 48', Height=186, TemplateSize=62, WrapCount=2, Fill='Color.Transparent')),
        ('lblNWhenHead', label('"ส่งเมื่อไร"', X=24, Y=632, Width=200, Height=34, Size=14, FontWeight='FontWeight.Bold')),
        ('lblNWho', label(who_text, X=24, Y=584, Width='Parent.Width - 48', Height=40, Size=13, Color='clrPrimary', FontWeight='FontWeight.Semibold')),
    ] + day_ctrls + [
        ('attNew', att),
        ('lblNSummary', label('"ส่ง " & Text(varNDue, "dddd d mmmm", "th-TH")', X=24, Y=840, Width='Parent.Width - 48', Height=36, Size=13, Color='clrMuted')),
        ('btnNCreate', button('"สั่งงาน"', create, X=24, Y=f'Parent.Height - {TAB_H} - 92', Width='Parent.Width - 48', Height=80, Size=16, FontWeight='FontWeight.Bold',
                              RadiusTopLeft=16, RadiusTopRight=16, RadiusBottomLeft=16, RadiusBottomRight=16,
                              DisplayMode='If(varBusy || IsBlank(Trim(txtNTitle.Text)) || (!varNMgr && IsEmpty(colPick)) || varNDue < Today(), DisplayMode.Disabled, DisplayMode.Edit)',
                              DisabledFill='ColorFade(clrAccent, 60%)', DisabledColor='Color.White')),
    ] + tabs('CN', CEO_TABS, 'New')
    return screen('scrCeoCreate', {'Fill': 'clrBg', 'OnVisible': on_visible}, children)

if __name__ == '__main__':
    import sys
    out = sys.argv[1]
    for name, fn in [('scrCeoHome', scr_ceo_home), ('scrCeoTickets', scr_ceo_tickets), ('scrCeoDetail', scr_ceo_detail), ('scrCeoCreate', scr_ceo_create)]:
        open(f'{out}/{name}.yaml', 'w', encoding='utf-8').write(fn())
