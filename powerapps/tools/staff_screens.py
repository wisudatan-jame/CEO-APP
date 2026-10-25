from yamlgen import *
from yamlgen import HIST_LOAD

STAFF_TABS = [('Home', '"ภาพรวม"', 'Navigate(scrHome)'), ('List', '"งานจาก CEO"', 'Navigate(scrTickets)')]
CARD_W = '(Parent.Width - 60) / 2'
X2 = '36 + (Parent.Width - 60) / 2'
CONTENT_END = f'Parent.Height - {TAB_H} - 12'  # bottom edge for boxes that sit above the tab bar

def scr_home():
    on_visible = """Set(varMeEmp, LookUp(Employees, Email = varMe || Email = User().Email));
Set(varMine, Filter(Tickets, AssigneeEmail = varMe));
Set(varOpen, Filter(varMine, IsOpen = true));
Set(varLate, Filter(varOpen, Status.Value <> "Done", DueDate < Today()));
Set(varDone30, Filter(varMine, !IsBlank(DoneAt), DoneAt >= DateAdd(Today(), -30, TimeUnit.Days)))"""
    todo_sub = """If(ThisItem.DueDate < Today(), "เลย " & DateDiff(ThisItem.DueDate, Today()) & " วัน", "ส่ง " & (Text(ThisItem.DueDate, "ddd", "th-TH") & " " & Day(ThisItem.DueDate) & " " & Index(["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."], Month(ThisItem.DueDate)).Value)) &
" · " & Switch(ThisItem.Status.Value, "New", "ใหม่ ยังไม่รับทราบ", "Acknowledged", "รับทราบ", "InProgress", "กำลังทำ", "WaitingCEO", "รอ CEO ตอบ", ThisItem.Status.Value)"""
    late = 'ThisItem.DueDate < Today()'
    to_list = 'Navigate(scrTickets)'
    stat = lambda key, num, cap, color: (f'conS{key}', in_box(vbox([
        (f'lblS{key}N', in_box(label(num, Height=44, Size=22, FontWeight='FontWeight.Bold', Color=color, Align='Align.Center'))),
        (f'lblS{key}C', in_box(label(cap, Height=26, Size=12, Color='clrMuted', Align='Align.Center'))),
    ], LayoutGap=0), 1))
    stats_h = 140
    children = header('H') + [
        ('lblHello', label('"สวัสดีค่ะคุณ" & Coalesce(varMeEmp.Nickname, First(Split(User().FullName, " ")).Value)',
                           X=24, Y=108, Width='Parent.Width - 48', Height=46, Size=22, FontWeight='FontWeight.Bold', Color='clrPrimary')),
        ('lblHelloSub', label('"วัน" & Text(Today(), "dddd d mmmm", "th-TH") & " · งานจาก CEO เปิดอยู่ " & CountRows(varOpen) & " งาน"',
                              X=24, Y=154, Width='Parent.Width - 48', Height=32, Size=13, Color='clrMuted')),
    ] + kpi_card('KLate', '"เลยกำหนด"', 'CountRows(varLate)', '"รีบทำก่อน"', to_list, 24, 196, CARD_W, hot=True) \
      + kpi_card('KNew', '"ยังไม่รับทราบ"', 'CountRows(Filter(varOpen, Status.Value = "New"))', '"งานใหม่จาก CEO"', to_list, X2, 196, CARD_W) \
      + kpi_card('KWait', '"รอ CEO ตอบ"', 'CountRows(Filter(varOpen, Status.Value = "WaitingCEO"))', '"ที่คุณถามไป"', to_list, 24, 348, CARD_W,
                 title_c='clrMuted', num_c='clrText') \
      + kpi_card('KDone', '"รอ CEO ตรวจ"', 'CountRows(Filter(varOpen, Status.Value = "Done"))', '"ทำเสร็จแล้ว"', to_list, X2, 348, CARD_W,
                 title_c='clrSuccess', num_c='clrSuccess') + [
        ('conTodo', panel([
            ('lblTodoHead', in_box(label('"ต้องทำก่อน"', Height=34, Size=15, FontWeight='FontWeight.Bold'))),
            ('lblTodoEmpty', in_box(label('"ไม่มีงานค้าง"', Height=40, Size=13, Color='clrMuted', Visible='IsEmpty(galTodo.AllItems)'))),
            ('galTodo', list_in(gallery('FirstN(SortByColumns(Filter(varOpen, Status.Value <> "Done"), "DueDate", SortOrder.Ascending), 4)', [
                ('recTodoBar', rect(X=0, Y=16, Width=8, Height='Parent.TemplateHeight - 32',
                                    Fill=f'If({late}, clrAccent, clrPrimary)', OnSelect='Select(Parent)')),
                ('lblTodo', label('"T-" & ThisItem.ID & " " & ThisItem.Title', X=22, Y=6, Width='Parent.TemplateWidth - 22', Height=34,
                                  Size=14, FontWeight='FontWeight.Semibold', OnSelect='Select(Parent)')),
                ('lblTodoSub', label(todo_sub, X=22, Y=38, Width='Parent.TemplateWidth - 22', Height=28, Size=12,
                                     Color=f'If({late}, clrDanger, clrMuted)', OnSelect='Select(Parent)')),
                ('recTodoLine', rect(X=0, Y='Parent.TemplateHeight - 1', Width='Parent.TemplateWidth', Height=1, Fill='clrLine', OnSelect='Select(Parent)')),
            ], TemplateSize=72, ShowScrollbar='false', OnSelect='Set(varTicket, ThisItem); Navigate(scrDetail)'))),
        ], 24, 500, 'Parent.Width - 48', f'{CONTENT_END} - {stats_h} - 12 - Self.Y')),
        ('conStats', panel([
            ('lblStatsHead', in_box(label('"ผลงาน 30 วันที่ผ่านมา"', Height=30, Size=15, FontWeight='FontWeight.Bold'))),
            ('conStatsRow', in_box(hbox([
                stat('Got', 'CountRows(Filter(varMine, Created >= DateAdd(Today(), -30, TimeUnit.Days)))', '"ได้รับ"', 'clrPrimary'),
                stat('OnTime', 'CountIf(varDone30, DoneAt < DateAdd(DueDate, 1, TimeUnit.Days)) & "/" & CountRows(varDone30)', '"เสร็จทันกำหนด"', 'clrSuccess'),
                stat('Avg', 'If(CountRows(varDone30) > 0, Text(Average(varDone30, DateDiff(Created, DoneAt, TimeUnit.Hours)) / 24, "0.0"), "-")',
                     '"วันเฉลี่ย/งาน"', 'clrPrimary'),
            ], Height=70, LayoutGap=8))),
        ], 24, f'{CONTENT_END} - {stats_h}', 'Parent.Width - 48', stats_h)),
    ] + tabs('H', STAFF_TABS, 'Home')
    return screen('scrHome', {'Fill': 'clrBg', 'OnVisible': on_visible}, children)

def scr_tickets():
    status = 'Switch(ThisItem.Status.Value, "New", "ใหม่", "Acknowledged", "รับทราบ", "InProgress", "กำลังทำ", "WaitingCEO", "รอ CEO ตอบ", "Done", "รอ CEO ตรวจ", ThisItem.Status.Value)'
    meta = ('If(ThisItem.DueDate < Today(), "เลยกำหนด " & DateDiff(ThisItem.DueDate, Today()) & " วัน", '
            '"ส่ง " & (Text(ThisItem.DueDate, "ddd", "th-TH") & " " & Day(ThisItem.DueDate) & " " & Index(["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."], Month(ThisItem.DueDate)).Value))')
    children = header('') + [
        ('lblHeader', label('"งานจาก CEO"', X=24, Y=104, Width='Parent.Width - 48', Height=52, Size=20, FontWeight='FontWeight.Bold', Color='clrPrimary')),
        ('conTickets', area([
            ('lblEmpty', in_box(label('"ไม่มีงานค้าง"', Height=50, Color='clrMuted', Visible='IsEmpty(galTickets.AllItems)'))),
            ('galTickets', list_in(gallery('SortByColumns(Filter(Tickets, IsOpen = true, AssigneeEmail = varMe), "DueDate", SortOrder.Ascending)', [
                row_bg('btnTicketRow'),
                ('lblTitle', label('"T-" & ThisItem.ID & " " & ThisItem.Title', X=20, Y=10, Width='Parent.TemplateWidth - 40', Height=36, Size=15,
                                   FontWeight='FontWeight.Semibold', OnSelect='Select(Parent)')),
                ('lblMeta', label(meta, X=20, Y=48, Width='Parent.TemplateWidth - 230', Height=30, Size=12, FontWeight='FontWeight.Semibold',
                                  Color='If(ThisItem.DueDate < Today(), clrDanger, clrMuted)', OnSelect='Select(Parent)')),
                ('lblStatus', label(status, X='Parent.TemplateWidth - 210', Y=48, Width=190, Height=30, Size=12, Align='Align.Right',
                                    FontWeight='FontWeight.Semibold', Color='clrPrimary', OnSelect='Select(Parent)')),
            ], TemplateSize=102, OnSelect='Set(varTicket, ThisItem); Navigate(scrDetail)'))),
        ], 24, 160, 'Parent.Width - 48', f'Parent.Height - {TAB_H} - 104 - Self.Y')),
        ('btnRefresh', button('"รีเฟรช"', 'Refresh(Tickets)', X=24, Y=f'Parent.Height - {TAB_H} - 92', Width='Parent.Width - 48', Height=80,
                              Size=16, FontWeight='FontWeight.Bold',
                              RadiusTopLeft=16, RadiusTopRight=16, RadiusBottomLeft=16, RadiusBottomRight=16)),
    ] + tabs('T', STAFF_TABS, 'List')
    return screen('scrTickets', {'Fill': 'clrBg'}, children)

def status_buttons():
    run = lambda action: f'''Set(varBusy, true);
Set(varResult, UpdateTicket.Run({{number: varTicket.ID, text: "{action}", text_1: varTicket.Status.Value, text_2: txtComment.Text}}));
Set(varBusy, false);
If(varResult.ok = "true", Notify("บันทึกแล้ว", NotificationType.Success); Reset(txtComment), Notify(If(varResult.message = "STALE", "ข้อมูลเปลี่ยนไปแล้ว กำลังโหลดใหม่", varResult.message), NotificationType.Error));
Refresh(Tickets);
Refresh(TicketHistory);
Set(varTicket, LookUp(Tickets, ID = varTicket.ID));
Set(varHist, SortByColumns(Filter(TicketHistory, TicketID = varTicket.ID), "ID", SortOrder.Descending)); Set(varHistPos, 0)'''
    big = dict(Height=56, Size=16, FontWeight='FontWeight.Bold', RadiusTopLeft=16, RadiusTopRight=16, RadiusBottomLeft=16, RadiusBottomRight=16)
    small = dict(Height=50, Size=14, Fill='Color.White', Color='clrPrimary', BorderColor='clrLine', BorderThickness=2)
    done_set = 'varTicket.Status.Value in ["Done", "Closed"]'
    btnDone = button(f'If({done_set}, "✓ ทำเสร็จแล้ว", "ทำเสร็จแล้ว")', run('done'),
                     DisplayMode=f'If(varBusy || {done_set}, DisplayMode.Disabled, DisplayMode.Edit)',
                     DisabledFill=f'If({done_set}, ColorFade(clrAccent, 88%), ColorFade(clrAccent, 60%))',
                     DisabledColor=f'If({done_set}, clrAccent, Color.White)',
                     BorderThickness=0, **big)
    btnWait = button('If(varTicket.Status.Value = "WaitingCEO", "⏳ รอ CEO ตอบ", "ถาม CEO")', run('wait'),
                     DisplayMode='If(varBusy || IsBlank(Trim(txtComment.Text)) || !(varTicket.Status.Value in ["New", "Acknowledged", "InProgress"]), DisplayMode.Disabled, DisplayMode.Edit)',
                     Fill='Color.White', Color='clrAccent', BorderColor='clrAccent', BorderThickness=2,
                     # greyed-out buttons are a plain fill: thin outlines on rounded buttons rendered unevenly
                     DisabledFill='clrBg', DisabledColor='clrMuted', DisabledBorderColor='clrBg', **big)
    start_set = 'varTicket.Status.Value in ["InProgress", "Done", "Closed"]'
    btnAck = button('If(varTicket.Status.Value = "New", "รับทราบ", "✓ รับทราบ")', run('ack'),
                    DisplayMode='If(varBusy || varTicket.Status.Value <> "New", DisplayMode.Disabled, DisplayMode.Edit)',
                    DisabledFill='clrBg', DisabledColor='clrMuted', DisabledBorderColor='clrBg', **small)
    btnStart = button(f'If({start_set}, "✓ เริ่มทำ", "เริ่มทำ")', run('start'),
                      DisplayMode='If(varBusy || !(varTicket.Status.Value in ["New", "Acknowledged", "WaitingCEO"]), DisplayMode.Disabled, DisplayMode.Edit)',
                      DisabledFill='clrBg', DisabledColor='clrMuted', DisabledBorderColor='clrBg', **small)
    btnComment = button('"ส่งความเห็น"', run('comment'),
                        DisplayMode='If(varBusy || IsBlank(Trim(txtComment.Text)) || varTicket.Status.Value = "Closed", DisplayMode.Disabled, DisplayMode.Edit)',
                        DisabledFill='clrBg', DisabledColor='clrMuted', DisabledBorderColor='clrBg', **small)
    return [(n, in_box(c, 1)) for n, c in [('btnDone', btnDone), ('btnWait', btnWait)]], \
           [(n, in_box(c, 1)) for n, c in [('btnAck', btnAck), ('btnStart', btnStart), ('btnComment', btnComment)]]

HIST_ROW = 54

def history_card(gal_name, line_name, lbl_name, head_name, card_name, ceo_word, assignee_word):
    """Latest activity. The card takes the page's leftover height (so the last button row ends at the bottom edge);
    it shows as many rows as fit and the up/down arrows page by that many instead of a scrollbar."""
    staff_acts = '["ack", "start", "wait", "done"]'
    who = f'''With({{a: Lower(ThisItem.ActorEmail)}},
    If(a = Lower(varTicket.AssigneeEmail) || (IsBlank(a) && ThisItem.Action.Value in {staff_acts}), {assignee_word},
        IsBlank(a) || a in ceoEmails, "{ceo_word}",
        With({{n: LookUp(Employees, Email = ThisItem.ActorEmail).Nickname}}, If(IsBlank(n), First(Split(a, "@")).Value, "คุณ" & n))) & ": ")'''
    what = '''With({c: ThisItem.Comment},
    If(StartsWith(c, "📎 แนบไฟล์"), "แนบไฟล์ " & Mid(c, Find(": ", c) + 18),
        ThisItem.Action.Value = "comment", c,
        Switch(ThisItem.Action.Value, "create", "สั่งงาน", "ack", "รับทราบ", "start", "เริ่มทำ", "wait", "ถาม", "reply", "ตอบ", "done", "ทำเสร็จแล้ว",
            "reopen", "ส่งกลับให้ทำต่อ", "close", "ผ่าน ปิดงาน", "cancel", "ยกเลิกงาน", "due_change", "เลื่อนวันส่ง", "reassign", "โอนงาน", ThisItem.Action.Value) &
        If(IsBlank(c), "", " """ & c & """")))'''
    k = f'Max(1, RoundDown({gal_name}.Height / {HIST_ROW}, 0))'  # rows that fit
    page = f'LastN(FirstN(varHist, varHistPos + {k}), Max(Min({k}, CountRows(varHist) - varHistPos), 0))'
    up_ok, down_ok = 'varHistPos > 0', f'varHistPos + {k} < CountRows(varHist)'
    arrow = lambda key, icon, ok, onselect: (f'ico{card_name}{key}', in_box({'type': 'Classic/Icon@2.5.0', 'props': {
        'Icon': icon, 'Color': f'If({ok}, clrPrimary, clrLine)', 'OnSelect': f'If({ok}, {onselect})',
        'Width': 40, 'Height': 34, 'PaddingTop': 6, 'PaddingBottom': 6, 'PaddingLeft': 8, 'PaddingRight': 8}}, 0, LayoutMinWidth=40))
    gal = gallery(page, [
        (f'{lbl_name}When', label('(Day(ThisItem.Created) & " " & Index(["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."], Month(ThisItem.Created)).Value & " " & Text(ThisItem.Created, "hh:mm"))', X=0, Y=0, Width=150, Height='Parent.TemplateHeight - 1', Size=12,
                                  Color='clrMuted', VerticalAlign='VerticalAlign.Top', PaddingTop=8, OnSelect='Select(Parent)')),
        (lbl_name, label(who + ' & ' + what, X=158, Y=0, Width='Parent.TemplateWidth - 158', Height='Parent.TemplateHeight - 1', Size=12,
                         VerticalAlign='VerticalAlign.Top', PaddingTop=8, OnSelect='Select(Parent)')),
        (line_name, rect(X=0, Y=0, Width='Parent.TemplateWidth', Height=1, Fill='clrLine', OnSelect='Select(Parent)')),
    ], TemplateSize=HIST_ROW, Fill='Color.Transparent', ShowScrollbar='false')
    min_h = 34 + 10 + 2 * HIST_ROW + 24 + 4
    return (card_name, card([
        (f'con{card_name}Head', in_box(hbox([
            (head_name, in_box(label('"ความเคลื่อนไหวล่าสุด"', Height=34, Size=15, FontWeight='FontWeight.Bold', VerticalAlign='VerticalAlign.Top', PaddingTop=2), 1)),
            (f'{head_name}Count', in_box(label(f'If(CountRows(varHist) > {k}, (varHistPos + 1) & "–" & Min(varHistPos + {k}, CountRows(varHist)) & " / " & CountRows(varHist), "")',
                                               Width=110, Height=34, Size=12, Color='clrMuted', Align='Align.Right', VerticalAlign='VerticalAlign.Top', PaddingTop=6),
                                         0, LayoutMinWidth=110)),
            arrow('Up', 'Icon.ChevronUp', up_ok, f'Set(varHistPos, Max(0, varHistPos - {k}))'),
            arrow('Down', 'Icon.ChevronDown', down_ok, f'Set(varHistPos, varHistPos + {k})'),
        ], Height=34, LayoutGap=4))),
        (gal_name, list_in(gal)),
    ], min_h - 4, FillPortions=1, LayoutMinHeight=min_h))

STAFF_STATUS = 'Switch({s}, "New", "ใหม่", "Acknowledged", "รับทราบแล้ว", "InProgress", "กำลังทำ", "WaitingCEO", "รอ CEO ตอบ", "Done", "รอ CEO ตรวจ", "Closed", "ปิดแล้ว", {s})'

def due_text(t):
    """"ส่ง อังคาร 27 ต.ค. · อีก 1 วัน" (or "· เลย 2 วัน" / "· วันนี้"; finished work: "· ทันกำหนด" / "· ช้า n วัน")."""
    return (f'"ส่ง " & (Text({t}.DueDate, "dddd", "th-TH") & " " & Day({t}.DueDate) & " " & Index(["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."], Month({t}.DueDate)).Value) & If({t}.Status.Value in ["Done", "Closed"], '
            f'If(IsBlank({t}.DoneAt) || {t}.DoneAt < DateAdd({t}.DueDate, 1, TimeUnit.Days), " · ทันกำหนด", " · ช้า " & DateDiff({t}.DueDate, {t}.DoneAt) & " วัน"), '
            f'!{t}.IsOpen, "", {t}.DueDate < Today(), " · เลย " & DateDiff({t}.DueDate, Today()) & " วัน", '
            f'{t}.DueDate = Today(), " · วันนี้", " · อีก " & DateDiff(Today(), {t}.DueDate) & " วัน")')

def status_row(name, status_text):
    """Status pill followed by the due date, as at the top of the mockup's detail pages."""
    late = 'varTicket.IsOpen && varTicket.Status.Value <> "Done" && varTicket.DueDate < Today()'
    return (f'con{name}', in_box(hbox([
        (f'btn{name}Pill', in_box(pill(status_text, 'varTicket.Status.Value', late, OnSelect='false', Width='Len(Self.Text) * 11 + 40', Height=40, Size=13),
                                   0, AlignInContainer='AlignInContainer.Center')),
        (f'lbl{name}Due', in_box(label(due_text('varTicket'), Height=40, Size=13, Color=f'If({late}, clrDanger, clrMuted)'), 1,
                                   AlignInContainer='AlignInContainer.Center')),
    ], Height=40, LayoutGap=12, LayoutAlignItems='LayoutAlignItems.Center')))

def scr_detail():
    upload = '''Set(varBusy, true);
Set(varUpload,
    ForAll(attFiles.Attachments As f,
        AttachTicketFile.Run(varTicket.ID, {contentBytes: f.Value, name: f.Name})));
Set(varBusy, false);
If(CountIf(varUpload, Lower(ok) = "true") = CountRows(varUpload),
    Notify("ส่งไฟล์แล้ว " & CountRows(varUpload) & " ไฟล์", NotificationType.Success); Reset(attFiles),
    Notify("ส่งไม่สำเร็จบางไฟล์: " & First(Filter(varUpload, Lower(ok) <> "true")).message, NotificationType.Error));
Refresh(Tickets);
Refresh(TicketHistory);
Set(varTicket, LookUp(Tickets, ID = varTicket.ID));
Set(varHist, SortByColumns(Filter(TicketHistory, TicketID = varTicket.ID), "ID", SortOrder.Descending)); Set(varHistPos, 0)'''
    folder = 'Launch("https://digitalfocusth.sharepoint.com/sites/CEO-Tickets/TicketFiles/Forms/AllItems.aspx?id=" & EncodeUrl("/sites/CEO-Tickets/TicketFiles/T-" & varTicket.ID))'
    att = {'type': 'Attachments@2.3.0', 'props': {
        'Items': 'Blank()', 'MaxAttachments': 5, 'MaxAttachmentSize': 10, 'NoAttachmentsText': '""',
        'AddAttachmentText': '"เลือกไฟล์"',
        'DisplayMode': 'If(varTicket.IsOpen, DisplayMode.Edit, DisplayMode.Disabled)',
        'Font': FONT, 'Size': 14, 'FontWeight': 'FontWeight.Bold', 'Color': 'clrPrimary', 'Fill': 'Color.White',
        'BorderColor': 'ColorValue("#8A94A6")', 'BorderThickness': 2, 'BorderStyle': 'BorderStyle.Dashed',
        # grows to list the chosen files; while empty the box is just the add link, centred by the left padding
        'Height': 'If(IsEmpty(Self.Attachments), 56, 52 + CountRows(Self.Attachments) * 40)',
        'ItemFill': 'clrBg', 'ItemColor': 'clrText', 'ItemHoverFill': 'clrLine', 'HoverFill': 'clrBg',
        # no top/bottom padding while empty: any padding left less room than the link needs and showed a scrollbar
        'PaddingTop': 'If(IsEmpty(Self.Attachments), 0, 6)', 'PaddingBottom': 'If(IsEmpty(Self.Attachments), 0, 6)', 'PaddingRight': 8,
        'PaddingLeft': 'If(IsEmpty(Self.Attachments), (Self.Width - 110) / 2, 8)'}}
    big, small = status_buttons()
    sent_rows = 'Filter(varHist, StartsWith(Comment, "📎 แนบไฟล์"))'
    body = vbox([
        ('conDTitle', in_box(hbox([
            ('btnBack', back_button('scrTickets')),
            ('lblDTitle', in_box(label('"T-" & varTicket.ID & " " & varTicket.Title', Size=19, FontWeight='FontWeight.Bold', Color='clrPrimary', Height=60), 1, AlignInContainer='AlignInContainer.Center')),
        ], Height=58, LayoutAlignItems='LayoutAlignItems.Center', LayoutGap=14))),
        status_row('DStatus', STAFF_STATUS.format(s='varTicket.Status.Value')),
        ('conDInfo', card([
            kv('DFrom', '"ผู้สั่ง"', '"คุณสมชาย (CEO)"'),
            kv('DWhen', '"สั่งเมื่อ"', '(Day(varTicket.Created) & " " & Index(["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."], Month(varTicket.Created)).Value & " " & Text(varTicket.Created, "hh:mm"))'),
            kv('DDetails', '"รายละเอียด"', 'varTicket.Details', visible='!IsBlank(varTicket.Details)'),
            kv('DExtra', '"สั่งเพิ่ม"', 'varTicket.CEOExtra', fill='ColorFade(clrAccent, 92%)', key_color='clrDanger', visible='!IsBlank(varTicket.CEOExtra)'),
        ], 'conDFrom.Height + 6 + conDWhen.Height + If(conDDetails.Visible, 6 + conDDetails.Height, 0) + If(conDExtra.Visible, 6 + conDExtra.Height, 0) + 24',
           LayoutGap=6)),
        ('conDFiles', card([
            card_head('DFiles', f'"ไฟล์ที่ส่งแล้ว (" & CountRows({sent_rows}) & ")"',
                      ('btnPhotos', link('"เปิดโฟลเดอร์"', folder, DisplayMode=f'If(varTicket.HasFiles || !IsEmpty({sent_rows}), DisplayMode.Edit, DisplayMode.Disabled)'))),
            file_list('galSentFiles', sent_rows, 'Mid(ThisItem.Comment, Find(": ", ThisItem.Comment) + 18)'),
            ('conDUpload', in_box(hbox([
                ('attFiles', in_box(att, 1)),
                ('btnUpload', in_box(button('"ส่งไฟล์"', upload, Height=56, Size=15, FontWeight='FontWeight.Bold', BorderThickness=0,
                                            DisplayMode='If(varBusy || IsEmpty(attFiles.Attachments) || !varTicket.IsOpen, DisplayMode.Disabled, DisplayMode.Edit)',
                                            DisabledFill='ColorFade(clrAccent, 60%)', DisabledColor='Color.White'), 1)),
            ], Height='attFiles.Height', LayoutGap=12))),
        ], '34 + 8 + If(galSentFiles.Visible, galSentFiles.Height + 8, 0) + attFiles.Height + 24', LayoutGap=8)),
        history_card('galHistory', 'recHistLine', 'lblHist', 'lblHistHead', 'conDHist', 'CEO', '"คุณ"'),
        ('conDAction', card([
            ('txtComment', in_box({'type': 'Classic/TextInput@2.3.2', 'props': {
                'Default': '""', 'Mode': 'TextMode.MultiLine', 'Height': 52, 'Font': FONT, 'Size': 14,
                'HintText': '"ข้อความถึง CEO (ถาม CEO / ส่งความเห็น ต้องพิมพ์ก่อน) เช่น รับทราบค่ะ จะเริ่มพรุ่งนี้"',
                'BorderColor': 'clrLine', 'BorderThickness': 2, 'Fill': 'Color.White', 'HoverFill': 'Color.White',
                'RadiusTopLeft': 10, 'RadiusTopRight': 10, 'RadiusBottomLeft': 10, 'RadiusBottomRight': 10}})),
            ('conDBig', in_box(hbox(big, Height=56))),
            ('conDSmall', in_box(hbox(small, Height=50))),
        ], '52 + 56 + 50 + 2 * 10 + 24')),
    ], X=0, Y=94, Width='Parent.Width', Height=f'Parent.Height - 94 - {TAB_H}', Fill='clrBg', LayoutGap=10,
       PaddingTop=12, PaddingBottom=12, PaddingLeft=20, PaddingRight=20, LayoutOverflowY='LayoutOverflow.Scroll')
    children = [
        ('recHeader', rect(Fill='clrPrimary', Height=90, Width='Parent.Width')),
        ('recHeaderLine', rect(Fill='clrAccent', Height=4, Width='Parent.Width', Y=90)),
        ('imgLogoD', image("'df-logo-white'", X=16, Y=12, Width=150, Height=66)),
        ('imgCEOD', image("'ceo-avatar-sangngan'", X='Parent.Width - 80', Y=4, Width=64, Height=83)),
        ('conDBody', body),
    ] + tabs('D', STAFF_TABS, 'List')
    return screen('scrDetail', {'Fill': 'clrBg', 'OnVisible': 'Refresh(TicketHistory);\n' + HIST_LOAD}, children)

if __name__ == '__main__':
    import sys
    out = sys.argv[1]
    for name, fn in [('scrHome', scr_home), ('scrTickets', scr_tickets), ('scrDetail', scr_detail)]:
        open(f'{out}/{name}.yaml', 'w', encoding='utf-8').write(fn())
