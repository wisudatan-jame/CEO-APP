from yamlgen import *
from staff_screens import history_card, status_row, CARD_W, X2, CONTENT_END

CEO_TABS = [('Home', '"ภาพรวม"', 'Navigate(scrCeoHome)'), ('List', '"งานทั้งหมด"', 'Set(varFilter, "all"); Navigate(scrCeoTickets)'),
            ('New', '"สั่งงาน"', 'Navigate(scrCeoCreate)')]
HIST = '{Source: {Value: "App"}, Processed: false, CEOPending: false}'
NICK = 'Coalesce(LookUp(colEmp, Lower(Email) = {e}).Nickname, First(Split({e}, "@")).Value)'  # nickname, else the part before @
NAME = 'With({{n: LookUp(colEmp, Lower(Email) = {e}).Nickname}}, If(IsBlank(n), First(Split({e}, "@")).Value, "คุณ" & n))'
CHIP_W = '(Parent.Width - 48 - {g}) / {n}'
CEO_STATUS = 'Switch({s}, "New", "ยังไม่รับทราบ", "Acknowledged", "รับทราบแล้ว", "InProgress", "กำลังทำ", "WaitingCEO", "รอคุณตอบ", "Done", "รอคุณตรวจ", "Closed", "ปิดแล้ว", {s})'

def chip(text, cond, onselect, **p):
    return button(text, onselect, Fill=f'If({cond}, clrPrimary, Color.White)', Color=f'If({cond}, Color.White, clrPrimary)',
                  BorderColor='clrLine', BorderThickness=2, Size=14, Height=p.pop('Height', 52),
                  RadiusTopLeft=26, RadiusTopRight=26, RadiusBottomLeft=26, RadiusBottomRight=26, **p)

def scr_ceo_home():
    on_visible = '''ClearCollect(colAll, Filter(Tickets, IsOpen = true));
ClearCollect(colEmp, Filter(Employees, Active = true));
ClearCollect(colGroupTickets, Filter(Tickets, GroupID > 0));
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
    groups = '''Filter(
    AddColumns(GroupBy(colGroupTickets, GroupID, Rows),
        GTitle, First(Rows).Title,
        GCount, CountRows(Rows),
        GOpen, CountRows(Filter(Rows, IsOpen = true)),
        GDone, CountRows(Filter(Rows, Status.Value in ["Done", "Closed"])),
        GLate, CountRows(Filter(Rows, IsOpen = true, Status.Value <> "Done", DueDate < Today()))),
    GOpen > 0)'''
    emp = 'LookUp(colEmp, Lower(Email) = ThisItem.AssigneeEmail)'
    pname = NAME.format(e='ThisItem.AssigneeEmail')
    initial = f'With({{n: {NICK.format(e="ThisItem.AssigneeEmail")}}}, If(Left(n, 1) in ["เ", "แ", "โ", "ใ", "ไ"], Mid(n, 2, 1), Left(n, 1)))'
    sel = 'Select(Parent)'
    num = lambda **p: label(Y=0, Height='Parent.TemplateHeight - 1', Align='Align.Right', OnSelect=sel, **p)
    goto = lambda f: f'Set(varFilter, "{f}"); Navigate(scrCeoTickets)'
    group_row = 84
    groups_h = f'12 + 8 + 4 + Max(Min(CountRows(galCGroups.AllItems), 2), 1) * {group_row}'
    children = header('CH') + [
        ('lblCHello', label('"สวัสดีค่ะคุณสมชาย"', X=24, Y=108, Width='Parent.Width - 48', Height=46, Size=22, FontWeight='FontWeight.Bold', Color='clrPrimary')),
        ('lblCHelloSub', label('"วัน" & Text(Today(), "dddd d mmmm", "th-TH") & " · งานเปิดอยู่ " & CountRows(colAll) & " งาน"',
                               X=24, Y=154, Width='Parent.Width - 48', Height=32, Size=13, Color='clrMuted')),
    ] + kpi_card('CLate', '"เลยกำหนด"', 'CountRows(varCLate)', '"รวม " & Sum(varCLate, DateDiff(DueDate, Today())) & " วัน"',
                 goto('late'), 24, 196, CARD_W, hot=True) \
      + kpi_card('CWait', '"รอคุณตอบ"', 'CountRows(Filter(colAll, Status.Value = "WaitingCEO"))', '"พนักงานถามมา"', goto('wait'), X2, 196, CARD_W) \
      + kpi_card('CDone', '"เสร็จ รอคุณตรวจ"', 'CountRows(Filter(colAll, Status.Value = "Done"))', '"ผ่าน / ไม่ผ่าน"', goto('done'), 24, 348, CARD_W,
                 title_c='clrSuccess', num_c='clrSuccess') \
      + kpi_card('CNoAck', '"ยังไม่รับทราบ"', 'CountRows(Filter(colAll, Status.Value = "New", Created < DateAdd(Now(), -24, TimeUnit.Hours)))',
                 '"เกิน 24 ชม."', goto('noack'), X2, 348, CARD_W, title_c='clrMuted', num_c='clrText') + [
        ('conCPeople', panel([
            ('conCPeopleHead', in_box(hbox([
                ('lblCPeopleHead', in_box(label('"รายคน"', Height=34, Size=15, FontWeight='FontWeight.Bold'), 1)),
                ('lblCPeopleCols', in_box(label('"เปิด · ช้า · เฉลี่ย"', Width=220, Height=34, Size=12, Color='clrMuted', Align='Align.Right'), 0, LayoutMinWidth=220)),
            ], Height=34))),
            ('galCPeople', list_in(gallery(people, [
                ('btnCPInit', button(initial, sel, X=0, Y=10, Width=48, Height=48, Size=15, FontWeight='FontWeight.Bold',
                                     Fill='ColorFade(clrPrimary, 88%)', Color='clrPrimary', BorderThickness=0,
                                     RadiusTopLeft=24, RadiusTopRight=24, RadiusBottomLeft=24, RadiusBottomRight=24)),
                ('lblCPName', label(pname, X=62, Y=4, Width='Parent.TemplateWidth - 62 - 200', Height=32, Size=14, FontWeight='FontWeight.Semibold', Wrap='false', OnSelect=sel)),
                ('lblCPDept', label(f'Coalesce({emp}.Department, "ไม่พบในรายชื่อพนักงาน")', X=62, Y=34, Width='Parent.TemplateWidth - 62 - 200', Height=28,
                                    Size=12, Color='clrMuted', OnSelect=sel)),
                ('lblCPOpen', num(text='ThisItem.OpenCount', X='Parent.TemplateWidth - 196', Width=50, Size=13)),
                ('lblCPLate', num(text='ThisItem.LateCount', X='Parent.TemplateWidth - 140', Width=50, Size=13, FontWeight='FontWeight.Bold',
                                  Color='If(ThisItem.LateCount > 0, clrDanger, clrMuted)')),
                ('lblCPAvg', num(text='If(ThisItem.AvgDays > 0, Text(ThisItem.AvgDays, "0.0") & " วัน", "-")', X='Parent.TemplateWidth - 84', Width=84,
                                 Size=12, Color='clrMuted')),
                ('recCPLine', rect(X=0, Y='Parent.TemplateHeight - 1', Width='Parent.TemplateWidth', Height=1, Fill='clrLine', OnSelect=sel)),
            ], TemplateSize=68, OnSelect='Set(varFilter, "person"); Set(varPerson, ThisItem.AssigneeEmail); Navigate(scrCeoTickets)'))),
        ], 24, 500, 'Parent.Width - 48',
           f'Min(12 + 34 + 6 + Max(CountRows(galCPeople.AllItems), 1) * 68 + 8 + 4, {CONTENT_END} - conCGroups.Height - 12 - Self.Y)')),
        ('conCGroups', panel([
            ('lblCGroupsEmpty', in_box(label('"งานกลุ่ม: ยังไม่มี" & Char(10) & "สั่งหลายคนพร้อมกันได้ที่ปุ่มสั่งงาน หรือพิมพ์ใน LINE ว่า สั่งหัวหน้าทุกคน"',
                                             Height=group_row, Size=12, Color='clrMuted', Visible='IsEmpty(galCGroups.AllItems)'))),
            ('galCGroups', list_in(gallery(groups, [
                ('icoCGroup', {'type': 'Classic/Icon@2.5.0', 'props': {'Icon': 'Icon.People', 'Color': 'clrPrimary', 'OnSelect': sel,
                                                                      'X': 0, 'Y': f'({group_row} - 36) / 2', 'Width': 36, 'Height': 36}}),
                ('lblCGroup', label('"งานกลุ่ม: " & ThisItem.GTitle', X=52, Y=8, Width='Parent.TemplateWidth - 52 - 60', Height=36, Size=14,
                                    FontWeight='FontWeight.Semibold', Wrap='false', OnSelect=sel)),
                ('lblCGroupSub', label('ThisItem.GCount & " คน · ทำเสร็จ " & ThisItem.GDone & "/" & ThisItem.GCount & If(ThisItem.GLate > 0, " · ช้า " & ThisItem.GLate, "")',
                                       X=52, Y=42, Width='Parent.TemplateWidth - 52 - 60', Height=30, Size=12, Color='clrMuted', OnSelect=sel)),
                ('lblCGroupGo', label('"ดู"', X='Parent.TemplateWidth - 56', Y=0, Width=56, Height='Parent.TemplateHeight', Size=13, Align='Align.Right',
                                      FontWeight='FontWeight.Semibold', Color='clrPrimary', OnSelect=sel)),
                ('recCGLine', rect(X=0, Y='Parent.TemplateHeight - 1', Width='Parent.TemplateWidth', Height=1, Fill='clrLine', OnSelect=sel)),
            ], TemplateSize=group_row, ShowScrollbar='false',
               OnSelect='Set(varFilter, "group"); Set(varGroup, ThisItem.GroupID); Navigate(scrCeoTickets)'))),
        ], 24, 'conCPeople.Y + conCPeople.Height + 12', 'Parent.Width - 48', groups_h, PaddingTop=12, PaddingBottom=8)),
    ] + tabs('CH', CEO_TABS, 'Home')
    return screen('scrCeoHome', {'Fill': 'clrBg', 'OnVisible': on_visible}, children)

def scr_ceo_tickets():
    items = """SortByColumns(
    Filter(
        Switch(varFilter,
            "late", Filter(colAll, Status.Value <> "Done", DueDate < Today()),
            "wait", Filter(colAll, Status.Value = "WaitingCEO"),
            "done", Filter(colAll, Status.Value = "Done"),
            "noack", Filter(colAll, Status.Value = "New"),
            "person", Filter(colAll, AssigneeEmail = varPerson),
            "group", Filter(colAll, GroupID = varGroup),
            colAll),
        !varCSearch || IsBlank(Trim(txtCSearch.Text)) || Trim(txtCSearch.Text) in Title || Trim(txtCSearch.Text) in AssigneeEmail ||
            Trim(txtCSearch.Text) in LookUp(colEmp, Lower(Email) = AssigneeEmail).Nickname),
    "DueDate", SortOrder.Ascending)"""
    row_sub = (NAME.format(e='ThisItem.AssigneeEmail') + ' & " · " & If(ThisItem.DueDate < Today(), "เลย " & DateDiff(ThisItem.DueDate, Today()) & " วัน", "ส่ง " & Text(ThisItem.DueDate, "ddd d mmm", "th-TH"))')
    late = 'ThisItem.Status.Value <> "Done" && ThisItem.DueDate < Today()'
    status = f'If({late}, "เลยกำหนด", ' + CEO_STATUS.format(s='ThisItem.Status.Value') + ')'
    bar = (f'Switch(true, {late}, clrAccent, ThisItem.Status.Value = "WaitingCEO", clrPrimary, '
           'ThisItem.Status.Value = "Done", clrSuccess, ThisItem.Status.Value = "New", ColorValue("#8A94A6"), ColorValue("#C9CEDA"))')
    # chips sized to their text and packed left, three on the first row (as in the mockup)
    chips = [('all', 'ทั้งหมด'), ('late', 'เลยกำหนด'), ('wait', 'รอคุณตอบ'), ('done', 'รอคุณตรวจ'), ('noack', 'ยังไม่รับทราบ')]
    chip_ctrls = []
    for i, (k, t) in enumerate(chips):
        prev = f'btnF{chips[i - 1][0].capitalize()}'
        x = 24 if i in (0, 3) else f'{prev}.X + {prev}.Width + 12'
        chip_ctrls.append((f'btnF{k.capitalize()}', chip(f'"{t}"', f'varFilter = "{k}"', f'Set(varFilter, "{k}")',
                                                         X=x, Y=176 if i < 3 else 238, Width=f'Len(Self.Text) * 12 + 56')))
    note = 'If(varFilter = "person", "เฉพาะงานของ" & ' + NAME.format(e='varPerson') + ', varFilter = "group", "เฉพาะงานกลุ่ม T-" & varGroup, "")'
    children = header('CT') + [
        ('lblCListHead', label('"งานทั้งหมด"', X=24, Y=108, Width='Parent.Width - 48 - 76', Height=56, Size=20, FontWeight='FontWeight.Bold',
                               Color='clrPrimary', Visible='!varCSearch')),
        ('txtCSearch', {'type': 'Classic/TextInput@2.3.2', 'props': {
            'Default': '""', 'HintText': '"ค้นหาชื่องาน หรือชื่อคน"', 'X': 24, 'Y': 108, 'Width': 'Parent.Width - 48 - 76', 'Height': 56,
            'Font': FONT, 'Size': 14, 'BorderColor': 'clrLine', 'BorderThickness': 2, 'Fill': 'Color.White', 'HoverFill': 'Color.White',
            'RadiusTopLeft': 28, 'RadiusTopRight': 28, 'RadiusBottomLeft': 28, 'RadiusBottomRight': 28, 'PaddingLeft': 20,
            'Visible': 'varCSearch'}}),
        ('btnCSearch', button('""', 'Set(varCSearch, !varCSearch); Reset(txtCSearch)', X='Parent.Width - 24 - 64', Y=104, Width=64, Height=64,
                              Fill='If(varCSearch, clrPrimary, Color.White)', BorderColor='clrLine', BorderThickness=2,
                              RadiusTopLeft=32, RadiusTopRight=32, RadiusBottomLeft=32, RadiusBottomRight=32)),
        ('icoCSearch', {'type': 'Classic/Icon@2.5.0', 'props': {
            'Icon': 'If(varCSearch, Icon.Cancel, Icon.Search)', 'Color': 'If(varCSearch, Color.White, clrPrimary)',
            'OnSelect': 'Set(varCSearch, !varCSearch); Reset(txtCSearch)',
            'X': 'Parent.Width - 24 - 64 + 16', 'Y': 120, 'Width': 32, 'Height': 32}}),
    ] + chip_ctrls + [
        ('lblCFilterNote', label(note, X=24, Y=298, Width='Parent.Width - 48', Height=40, Size=13, Color='clrPrimary', FontWeight='FontWeight.Semibold',
                                 Visible='varFilter in ["person", "group"]')),
        ('conCAll', area([
            ('lblCListEmpty', in_box(label('"ไม่มีงานในหมวดนี้"', Height=50, Color='clrMuted', Visible='IsEmpty(galCAll.AllItems)'))),
            ('galCAll', list_in(gallery(items, [
                row_bg('btnCRowBg'),
                ('recCBar', rect(X=16, Y=18, Width=8, Height='Parent.TemplateHeight - 12 - 36', Fill=bar, OnSelect='Select(Parent)')),
                ('lblCRow', label('"T-" & ThisItem.ID & " " & ThisItem.Title', X=36, Y=10, Width='Parent.TemplateWidth - 36 - 16 - btnCRowPill.Width - 8',
                                  Height=38, Size=14, FontWeight='FontWeight.Semibold', Wrap='false', OnSelect='Select(Parent)')),
                ('lblCRowSub', label(row_sub, X=36, Y=48, Width='Parent.TemplateWidth - 36 - 16 - btnCRowPill.Width - 8', Height=32, Size=12,
                                     Color='clrMuted', Wrap='false', OnSelect='Select(Parent)')),
                ('btnCRowPill', pill(status, 'ThisItem.Status.Value', late, X='Parent.TemplateWidth - 16 - Self.Width', Y='(Parent.TemplateHeight - 12 - 40) / 2',
                                     Width='Len(Self.Text) * 11 + 36', Height=40)),
            ], TemplateSize=104, ShowScrollbar='false', OnSelect='Set(varTicket, ThisItem); Navigate(scrCeoDetail)'))),
        ], 24, 'If(lblCFilterNote.Visible, 346, 306)', 'Parent.Width - 48', f'{CONTENT_END} - Self.Y')),
    ] + tabs('CT', CEO_TABS, 'List')
    on_visible = """If(IsBlank(varFilter), Set(varFilter, "all"));
Set(varCSearch, false);
ClearCollect(colAll, Filter(Tickets, IsOpen = true));
ClearCollect(colEmp, Filter(Employees, Active = true))"""
    return screen('scrCeoTickets', {'Fill': 'clrBg', 'OnVisible': on_visible}, children)

def scr_ceo_detail():
    who = NAME.format(e='varTicket.AssigneeEmail')
    files = '''With({rows: Filter(galCDHistory.AllItems, StartsWith(Comment, "📎"))},
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
            ('btnCBack', back_button('scrCeoTickets')),
            ('lblCDTitle', in_box(label('"T-" & varTicket.ID & " " & varTicket.Title', Size=19, FontWeight='FontWeight.Bold', Color='clrPrimary', Height=60), 1, AlignInContainer='AlignInContainer.Center')),
        ], Height=64, LayoutAlignItems='LayoutAlignItems.Center', LayoutGap=14))),
        status_row('CDStatus', CEO_STATUS.format(s='varTicket.Status.Value')),
        ('conCDInfo', card([
            kv('CDWho', '"ผู้รับงาน"', who + ' & With({d: LookUp(colEmp, Lower(Email) = varTicket.AssigneeEmail).Department}, If(IsBlank(d), "", " (" & d & ")"))'),
            kv('CDWhen', '"สั่งเมื่อ"', 'Text(varTicket.Created, "d mmm hh:mm", "th-TH") & " ผ่าน " & varTicket.Source.Value'),
            kv('CDDetails', '"รายละเอียด"', 'varTicket.Details', visible='!IsBlank(varTicket.Details)'),
            kv('CDExtra', '"สั่งเพิ่ม"', 'varTicket.CEOExtra', fill='ColorFade(clrAccent, 92%)', key_color='clrDanger', visible='!IsBlank(varTicket.CEOExtra)'),
        ], 'conCDWho.Height + 6 + conCDWhen.Height + If(conCDDetails.Visible, 6 + conCDDetails.Height, 0) + If(conCDExtra.Visible, 6 + conCDExtra.Height, 0) + 28',
           LayoutGap=6)),
        ('conCDFiles', card([
            ('conCDFileHead', in_box(hbox([
                ('lblCDFilesHead', in_box(label('"ไฟล์งาน"', Height=34, Size=15, FontWeight='FontWeight.Bold'), 1)),
                ('btnCDFolder', link('"เปิดโฟลเดอร์"', folder, DisplayMode='If(varTicket.HasFiles, DisplayMode.Edit, DisplayMode.Disabled)')),
            ], Height=34))),
            ('lblCDFiles', in_box(label(files, AutoHeight='true', Size=13, Color='clrPrimary'))),
        ], 'conCDFileHead.Height + 8 + lblCDFiles.Height + 28', LayoutGap=8)),
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
    Collect(Tickets, ForAll(LastN(varWho, CountRows(varWho) - 1) As p,
        Patch(varBase, {{AssigneeEmail: Lower(p.Email), GroupID: varFirst.ID}})));
    ClearCollect(colMade, Filter(Tickets, GroupID = varFirst.ID)));
Collect(TicketHistory, ForAll(colMade As t,
    {{Title: "T-" & t.ID, TicketID: t.ID, Action: {{Value: "create"}}, ToStatus: "New", ActorEmail: Lower(User().Email),
      Source: {{Value: "App"}}, Processed: false, CEOPending: false}}));
ForAll(attNew.Attachments As f, ForAll(colMade As t, AttachTicketFile.Run(t.ID, {{contentBytes: f.Value, name: f.Name}})));
Set(varBusy, false);
Notify("สั่งงานแล้ว " & Concat(colMade, "T-" & ID, ", "), NotificationType.Success);
Reset(txtNTitle); Reset(txtNDetails); Reset(attNew); Clear(colPick); Set(varNMgr, false)'''
    picked = '!IsBlank(LookUp(colPick, Email = ThisItem.Email))'
    toggle = f'If({picked}, Remove(colPick, LookUp(colPick, Email = ThisItem.Email)), Collect(colPick, ThisItem))'
    summary = ('If(varNMgr, "สั่งหัวหน้าทุกคน " & CountRows(Filter(colEmp, IsManager = true)) & " คน", '
               'IsEmpty(colPick), "ยังไม่ได้เลือกคน", "สั่งคุณ" & Concat(colPick, Coalesce(Nickname, FirstName), ", คุณ")) & '
               '" · ส่ง " & Text(varNDue, "dddd d mmmm", "th-TH")')
    monday = 'DateAdd(Today(), If(Mod(9 - Weekday(Today()), 7) = 0, 7, Mod(9 - Weekday(Today()), 7)), TimeUnit.Days)'
    friday = 'DateAdd(Today(), Mod(6 - Weekday(Today()), 7), TimeUnit.Days)'
    w4 = CHIP_W.format(g=36, n=4)
    days = [('Today', '"วันนี้"', 'Today()'), ('Tmr', '"พรุ่งนี้"', 'DateAdd(Today(), 1, TimeUnit.Days)'), ('Fri', '"ศุกร์นี้"', friday), ('Mon', '"จันทร์หน้า"', monday)]
    day_ctrls = [(f'btnNDay{k}', chip(t, f'varNDue = {d}', f'Set(varNDue, {d})', X=f'24 + {i} * ({w4} + 12)', Y=716, Width=w4))
                 for i, (k, t, d) in enumerate(days)]
    tin = lambda hint, h: {'type': 'Classic/TextInput@2.3.2', 'props': {
        'Default': '""', 'HintText': hint, 'Height': h, 'Font': FONT, 'Size': 15, 'BorderColor': 'clrLine', 'BorderThickness': 2,
        'Fill': 'Color.White', 'HoverFill': 'Color.White', 'X': 24, 'Width': 'Parent.Width - 48',
        'RadiusTopLeft': 10, 'RadiusTopRight': 10, 'RadiusBottomLeft': 10, 'RadiusBottomRight': 10}}
    title_in = tin('"เช่น เตรียมสไลด์ประชุมบอร์ด"', 60); title_in['props']['Y'] = 248
    det_in = tin('""', 76); det_in['props'].update(Y=350, Mode='TextMode.MultiLine')
    att = {'type': 'Attachments@2.3.0', 'props': {
        'Items': 'Blank()', 'MaxAttachments': 5, 'MaxAttachmentSize': 10, 'NoAttachmentsText': '""', 'DisplayMode': 'DisplayMode.Edit',
        'AddAttachmentText': '"แนบรูปหรือไฟล์"', 'Font': FONT, 'Size': 13, 'Color': 'clrPrimary', 'Fill': 'Color.White',
        'BorderColor': 'clrLine', 'BorderThickness': 2, 'BorderStyle': 'BorderStyle.Dashed', 'ItemFill': 'clrBg', 'ItemColor': 'clrText',
        'ItemHoverFill': 'clrLine', 'HoverFill': 'clrBg', 'X': 24, 'Y': 782, 'Width': 'Parent.Width - 48', 'Height': 80}}
    children = header('CN') + [
        ('lblNHead', label('"สั่งงาน"', X=24, Y=104, Width='Parent.Width - 48', Height=46, Size=20, FontWeight='FontWeight.Bold', Color='clrPrimary')),
        ('lblNNote', label('"ปกติสั่งผ่าน LINE ได้เร็วกว่า หน้านี้ใช้เมื่อบอท LINE ไม่ตอบ"', X=24, Y=152, Width='Parent.Width - 48', Height=48, Size=12,
                           Color='clrMuted', Fill='Color.White', BorderColor='clrLine', BorderThickness=2, PaddingLeft=14, PaddingRight=14)),
        ('lblNTitleHead', label('"งานอะไร"', X=24, Y=212, Width=300, Height=32, Size=13, FontWeight='FontWeight.Semibold')),
        ('txtNTitle', title_in),
        ('lblNDetailsHead', label('"รายละเอียด (ไม่บังคับ)"', X=24, Y=314, Width=300, Height=32, Size=13, FontWeight='FontWeight.Semibold')),
        ('txtNDetails', det_in),
        ('lblNWhoHead', label('"สั่งใคร"', X=24, Y=440, Width=200, Height=34, Size=13, FontWeight='FontWeight.Semibold')),
        ('btnNMgr', chip('"หัวหน้าทุกคน (" & CountRows(Filter(colEmp, IsManager = true)) & ")"', 'varNMgr', 'Set(varNMgr, !varNMgr)',
                         X='Parent.Width - 284', Y=434, Width=260, Height=46)),
        ('conNWho', vbox([('galNWho', list_in(gallery('SortByColumns(colEmp, "Nickname", SortOrder.Ascending)', [
            ('btnNWho', button('Coalesce(ThisItem.Nickname, ThisItem.FirstName) & " · " & ThisItem.Department', toggle,
                               X=4, Y=4, Width='Parent.TemplateWidth - 8', Height='Parent.TemplateHeight - 8', Size=12,
                               Fill=f'If({picked}, clrPrimary, Color.White)', Color=f'If({picked}, Color.White, clrPrimary)',
                               BorderColor='clrLine', BorderThickness=2, RadiusTopLeft=24, RadiusTopRight=24, RadiusBottomLeft=24, RadiusBottomRight=24,
                               DisplayMode='If(varNMgr, DisplayMode.Disabled, DisplayMode.Edit)',
                               DisabledFill='clrBg', DisabledColor='clrMuted', DisabledBorderColor='clrLine')),
        ], TemplateSize=62, WrapCount=2, ShowScrollbar='false'))),
        ], LayoutGap=0, X=24, Y=486, Width='Parent.Width - 48', Height=186)),
        ('lblNWhenHead', label('"ส่งเมื่อไร"', X=24, Y=680, Width=200, Height=34, Size=13, FontWeight='FontWeight.Semibold')),
    ] + day_ctrls + [
        ('attNew', att),
        ('lblNSummary', label(summary, X=24, Y=868, Width='Parent.Width - 48', Height=60, Size=13, Color='clrPrimary', FontWeight='FontWeight.Semibold')),
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
