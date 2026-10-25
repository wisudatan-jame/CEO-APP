from yamlgen import *

STAFF_TABS = [('Home', '"ภาพรวม"', 'Navigate(scrHome)'), ('List', '"งานจาก CEO"', 'Navigate(scrTickets)')]
CARD_W = '(Parent.Width - 60) / 2'

def kpi(text, onselect, fill, color, border, x, y):
    return button(text, onselect, X=x, Y=y, Width=CARD_W, Height=130, Fill=fill, Color=color, BorderColor=border,
                  BorderThickness=2, Align='Align.Left', VerticalAlign='VerticalAlign.Top', PaddingLeft=18, PaddingTop=14,
                  Size=16, FontWeight='FontWeight.Bold',
                  RadiusTopLeft=20, RadiusTopRight=20, RadiusBottomLeft=20, RadiusBottomRight=20)

def scr_home():
    on_visible = '''ClearCollect(colMine, Filter(Tickets, AssigneeEmail = varMe));
Set(varOpen, Filter(colMine, IsOpen = true));
Set(varLate, Filter(varOpen, Status.Value <> "Done", DueDate < Today()));
Set(varDone30, Filter(colMine, !IsBlank(DoneAt), DoneAt >= DateAdd(Today(), -30, TimeUnit.Days)))'''
    stats = '''"ผลงาน 30 วันที่ผ่านมา" & Char(10) &
"ได้รับ " & CountRows(Filter(colMine, Created >= DateAdd(Today(), -30, TimeUnit.Days))) & " งาน · " &
"เสร็จทันกำหนด " & CountIf(varDone30, DoneAt < DateAdd(DueDate, 1, TimeUnit.Days)) & "/" & CountRows(varDone30) &
If(CountRows(varDone30) > 0, " · เฉลี่ย " & Round(Average(varDone30, DateDiff(Created, DoneAt, TimeUnit.Hours)) / 24, 1) & " วัน/งาน", "")'''
    todo_text = '''"T-" & ThisItem.ID & " " & ThisItem.Title & Char(10) &
If(ThisItem.DueDate < Today(), "เลย " & DateDiff(ThisItem.DueDate, Today()) & " วัน", "ส่ง " & Text(ThisItem.DueDate, "ddd d mmm", "th-TH")) &
" · " & Switch(ThisItem.Status.Value, "New", "ใหม่ ยังไม่รับทราบ", "Acknowledged", "รับทราบ", "InProgress", "กำลังทำ", "WaitingCEO", "รอ CEO ตอบ", ThisItem.Status.Value)'''
    x2 = '36 + (Parent.Width - 60) / 2'
    children = header('H') + [
        ('lblHello', label('"สวัสดีค่ะคุณ" & First(Split(User().FullName, " ")).Value', X=24, Y=108, Width='Parent.Width - 48', Height=46,
                           Size=22, FontWeight='FontWeight.Bold', Color='clrPrimary')),
        ('lblHelloSub', label('Text(Today(), "dddd d mmmm", "th-TH") & " · งานจาก CEO เปิดอยู่ " & CountRows(varOpen) & " งาน"',
                              X=24, Y=154, Width='Parent.Width - 48', Height=32, Size=13, Color='clrMuted')),
        ('btnKLate', kpi('"เลยกำหนด" & Char(10) & CountRows(varLate)', 'Navigate(scrTickets)', 'clrAccent', 'Color.White', 'clrAccent', 24, 196)),
        ('btnKNew', kpi('"ยังไม่รับทราบ" & Char(10) & CountRows(Filter(varOpen, Status.Value = "New"))', 'Navigate(scrTickets)', 'Color.White', 'clrPrimary', 'clrLine', x2, 196)),
        ('btnKWait', kpi('"รอ CEO ตอบ" & Char(10) & CountRows(Filter(varOpen, Status.Value = "WaitingCEO"))', 'Navigate(scrTickets)', 'Color.White', 'clrMuted', 'clrLine', 24, 338)),
        ('btnKDone', kpi('"รอ CEO ตรวจ" & Char(10) & CountRows(Filter(varOpen, Status.Value = "Done"))', 'Navigate(scrTickets)', 'Color.White', 'clrSuccess', 'clrLine', x2, 338)),
        ('lblTodoHead', label('"ต้องทำก่อน"', X=24, Y=482, Width='Parent.Width - 48', Height=36, Size=16, FontWeight='FontWeight.Bold')),
        ('galTodo', gallery('FirstN(SortByColumns(Filter(varOpen, Status.Value <> "Done"), "DueDate", SortOrder.Ascending), 4)', [
            ('recTodoBar', rect(X=0, Y=10, Width=8, Height='Parent.TemplateHeight - 20',
                                Fill='If(ThisItem.DueDate < Today(), clrAccent, clrPrimary)', OnSelect='Select(Parent)')),
            ('lblTodo', label(todo_text, X=20, Y=4, Width='Parent.TemplateWidth - 28', Height='Parent.TemplateHeight - 8', Size=13,
                              Color='If(ThisItem.DueDate < Today(), clrDanger, clrText)', OnSelect='Select(Parent)')),
            ('recTodoLine', rect(X=20, Y='Parent.TemplateHeight - 1', Width='Parent.TemplateWidth - 20', Height=1, Fill='clrLine', OnSelect='Select(Parent)')),
        ], X=24, Y=522, Width='Parent.Width - 48', Height=288, TemplateSize=72, Fill='Color.White',
           BorderColor='clrLine', BorderThickness=2, OnSelect='Set(varTicket, ThisItem); Navigate(scrDetail)')),
        ('lblTodoEmpty', label('"ไม่มีงานค้าง"', X=24, Y=522, Width='Parent.Width - 48', Height=60, Color='clrMuted',
                               Visible='IsEmpty(galTodo.AllItems)')),
        ('lblStats', label(stats, X=24, Y=826, Width='Parent.Width - 48', AutoHeight='true', Size=13, Fill='Color.White',
                           BorderColor='clrLine', BorderThickness=2, PaddingTop=14, PaddingBottom=14, PaddingLeft=18, PaddingRight=18)),
    ] + tabs('H', STAFF_TABS, 'Home')
    return screen('scrHome', {'Fill': 'clrBg', 'OnVisible': on_visible}, children)

def scr_tickets():
    status = 'Switch(ThisItem.Status.Value, "New", "ใหม่", "Acknowledged", "รับทราบ", "InProgress", "กำลังทำ", "WaitingCEO", "รอ CEO ตอบ", "Done", "รอ CEO ตรวจ", ThisItem.Status.Value)'
    meta = ('"T-" & ThisItem.ID & " · " & If(ThisItem.DueDate < Today(), "เลยกำหนด " & DateDiff(ThisItem.DueDate, Today()) & " วัน", '
            '"ส่ง " & Text(ThisItem.DueDate, "ddd d mmm", "th-TH"))')
    children = header('') + [
        ('lblHeader', label('"งานจาก CEO"', X=24, Y=104, Width='Parent.Width - 48', Height=52, Size=20, FontWeight='FontWeight.Bold', Color='clrPrimary')),
        ('galTickets', gallery('SortByColumns(Filter(Tickets, IsOpen = true, AssigneeEmail = varMe), "DueDate", SortOrder.Ascending)', [
            ('lblTitle', label('ThisItem.Title', X=16, Y=10, Width='Parent.TemplateWidth - 32', Height=36, Size=16, FontWeight='FontWeight.Semibold', OnSelect='Select(Parent)')),
            ('lblMeta', label(meta, X=16, Y=48, Width='Parent.TemplateWidth - 230', Height=30, Size=13,
                              Color='If(ThisItem.DueDate < Today(), clrDanger, clrMuted)', OnSelect='Select(Parent)')),
            ('lblStatus', label(status, X='Parent.TemplateWidth - 216', Y=48, Width=200, Height=30, Size=13, Align='Align.Right',
                                FontWeight='FontWeight.Semibold', Color='clrPrimary', OnSelect='Select(Parent)')),
            ('recTicketLine', rect(X=16, Y='Parent.TemplateHeight - 1', Width='Parent.TemplateWidth - 32', Height=1, Fill='clrLine', OnSelect='Select(Parent)')),
        ], X=24, Y=160, Width='Parent.Width - 48', Height=f'Parent.Height - {TAB_H} - 104 - Self.Y', TemplateSize=90, Fill='Color.White',
           BorderColor='clrLine', BorderThickness=2, OnSelect='Set(varTicket, ThisItem); Navigate(scrDetail)')),
        ('lblEmpty', label('"ไม่มีงานค้าง"', X=40, Y=180, Width='Parent.Width - 80', Height=50, Color='clrMuted', Visible='IsEmpty(galTickets.AllItems)')),
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
Set(varTicket, LookUp(Tickets, ID = varTicket.ID))'''
    big = dict(Height=64, Size=16, FontWeight='FontWeight.Bold', RadiusTopLeft=16, RadiusTopRight=16, RadiusBottomLeft=16, RadiusBottomRight=16)
    small = dict(Height=56, Size=14, Fill='Color.White', Color='clrPrimary', BorderColor='clrLine', BorderThickness=2)
    done_set = 'varTicket.Status.Value in ["Done", "Closed"]'
    btnDone = button(f'If({done_set}, "✓ ทำเสร็จแล้ว", "ทำเสร็จแล้ว")', run('done'),
                     DisplayMode=f'If(varBusy || {done_set}, DisplayMode.Disabled, DisplayMode.Edit)',
                     DisabledFill=f'If({done_set}, Color.White, ColorFade(clrAccent, 60%))',
                     DisabledColor=f'If({done_set}, clrAccent, Color.White)',
                     DisabledBorderColor='clrAccent', BorderThickness=2, **big)
    btnWait = button('If(varTicket.Status.Value = "WaitingCEO", "⏳ รอ CEO ตอบ", "ถาม CEO")', run('wait'),
                     DisplayMode='If(varBusy || IsBlank(Trim(txtComment.Text)) || !(varTicket.Status.Value in ["New", "Acknowledged", "InProgress"]), DisplayMode.Disabled, DisplayMode.Edit)',
                     Fill='Color.White', Color='clrAccent', BorderColor='clrAccent', BorderThickness=3,
                     DisabledFill='Color.White', DisabledColor='ColorFade(clrAccent, 50%)', DisabledBorderColor='ColorFade(clrAccent, 50%)', **big)
    start_set = 'varTicket.Status.Value in ["InProgress", "Done", "Closed"]'
    btnAck = button('If(varTicket.Status.Value = "New", "รับทราบ", "✓ รับทราบ")', run('ack'),
                    DisplayMode='If(varBusy || varTicket.Status.Value <> "New", DisplayMode.Disabled, DisplayMode.Edit)',
                    DisabledFill='clrBg', DisabledColor='clrMuted', DisabledBorderColor='clrLine', **small)
    btnStart = button(f'If({start_set}, "✓ เริ่มทำ", "เริ่มทำ")', run('start'),
                      DisplayMode='If(varBusy || !(varTicket.Status.Value in ["New", "Acknowledged", "WaitingCEO"]), DisplayMode.Disabled, DisplayMode.Edit)',
                      DisabledFill='clrBg', DisabledColor='clrMuted', DisabledBorderColor='clrLine', **small)
    btnComment = button('"ส่งความเห็น"', run('comment'),
                        DisplayMode='If(varBusy || IsBlank(Trim(txtComment.Text)) || varTicket.Status.Value = "Closed", DisplayMode.Disabled, DisplayMode.Edit)',
                        DisabledFill='Color.White', DisabledColor='ColorFade(clrPrimary, 50%)', DisabledBorderColor='clrLine', **small)
    return [(n, in_box(c, 1)) for n, c in [('btnDone', btnDone), ('btnWait', btnWait)]], \
           [(n, in_box(c, 1)) for n, c in [('btnAck', btnAck), ('btnStart', btnStart), ('btnComment', btnComment)]]

def history_card(gal_name, line_name, lbl_name, head_name, card_name):
    hist_text = '''Text(ThisItem.Created, "d mmm hh:mm", "th-TH") & " · " & Switch(ThisItem.Action.Value, "create", "CEO สั่งงาน", "ack", "รับทราบ", "start", "เริ่มทำ", "wait", "ถาม CEO", "reply", "CEO ตอบ", "done", "ทำเสร็จ", "reopen", "CEO ส่งกลับ", "close", "CEO ปิดงาน", "cancel", "ยกเลิกงาน", "comment", "ความเห็น", "due_change", "เลื่อนวันส่ง", "reassign", "โอนงาน", ThisItem.Action.Value) & If(IsBlank(ThisItem.Comment), "", ": " & ThisItem.Comment)'''
    gal = gallery('SortByColumns(Filter(TicketHistory, TicketID = varTicket.ID), "ID", SortOrder.Descending)', [
        (lbl_name, label(hist_text, X=0, Y=0, Width='Parent.TemplateWidth', Height='Parent.TemplateHeight - 1', Size=12, Color='clrMuted', OnSelect='Select(Parent)')),
        (line_name, rect(X=0, Y='Parent.TemplateHeight - 1', Width='Parent.TemplateWidth', Height=1, Fill='clrLine', OnSelect='Select(Parent)')),
    ], TemplateSize=50, Fill='Color.Transparent', Height=200)
    return (card_name, card([
        (head_name, in_box(label('"ความเคลื่อนไหวล่าสุด"', Height=34, Size=15, FontWeight='FontWeight.Bold'))),
        (gal_name, in_box(gal)),
    ], '34 + 10 + 200 + 28'))

def scr_detail():
    details = '''"ผู้สั่ง: คุณสมชาย (CEO)" & Char(10) &
"สั่งเมื่อ: " & Text(varTicket.Created, "d mmm hh:mm", "th-TH") &
If(IsBlank(varTicket.Details), "", Char(10) & "รายละเอียด: " & varTicket.Details)'''
    due = '''Switch(varTicket.Status.Value, "New", "ใหม่", "Acknowledged", "รับทราบ", "InProgress", "กำลังทำ", "WaitingCEO", "รอ CEO ตอบ", "Done", "รอ CEO ตรวจ", "Closed", "ปิดแล้ว") &
" · ส่ง " & Text(varTicket.DueDate, "dddd d mmm", "th-TH") & If(varTicket.IsOpen && varTicket.DueDate < Today(), " · เลย " & DateDiff(varTicket.DueDate, Today()) & " วัน", "")'''
    sent = '''"ไฟล์ที่ส่งแล้ว" & Char(10) &
Concat(
    Filter(galHistory.AllItems, StartsWith(Comment, "📎 แนบไฟล์")),
    "• " & Mid(Comment, Find(": ", Comment) + 18) & "  (" & Text(Created, "d mmm hh:mm", "th-TH") & ")",
    Char(10))'''
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
Set(varTicket, LookUp(Tickets, ID = varTicket.ID))'''
    folder = 'Launch("https://digitalfocusth.sharepoint.com/sites/CEO-Tickets/TicketFiles/Forms/AllItems.aspx?id=" & EncodeUrl("/sites/CEO-Tickets/TicketFiles/T-" & varTicket.ID))'
    att = {'type': 'Attachments@2.3.0', 'props': {
        'Items': 'Blank()', 'MaxAttachments': 5, 'MaxAttachmentSize': 10, 'NoAttachmentsText': '""',
        'AddAttachmentText': '"เลือกไฟล์ (Excel, PDF, Word, รูป · สูงสุด 5 ไฟล์ ไฟล์ละ 10 MB)"',
        'DisplayMode': 'If(varTicket.IsOpen, DisplayMode.Edit, DisplayMode.Disabled)',
        'Font': FONT, 'Size': 13, 'Color': 'clrText', 'Fill': 'Color.White', 'BorderColor': 'clrLine', 'BorderThickness': 2,
        'BorderStyle': 'BorderStyle.Dashed', 'Height': 110,
        'ItemFill': 'clrBg', 'ItemColor': 'clrText', 'ItemHoverFill': 'clrLine', 'HoverFill': 'clrBg',
        'PaddingTop': 5, 'PaddingBottom': 5, 'PaddingLeft': 5, 'PaddingRight': 5}}
    big, small = status_buttons()
    body = vbox([
        ('conDTitle', in_box(hbox([
            ('icoBack', in_box({'type': 'Classic/Icon@2.5.0', 'props': {
                'Icon': 'Icon.ChevronLeft', 'Color': 'clrPrimary', 'BorderColor': 'clrPrimary', 'BorderThickness': 3,
                'PaddingTop': 12, 'PaddingBottom': 12, 'PaddingLeft': 12, 'PaddingRight': 12,
                'Width': 60, 'Height': 60, 'OnSelect': 'Navigate(scrTickets)'}}, 0, LayoutMinWidth=60)),
            ('lblDTitle', in_box(label('"T-" & varTicket.ID & " " & varTicket.Title', Size=19, FontWeight='FontWeight.Bold', Color='clrPrimary', Height=60), 1)),
        ], Height=64, LayoutAlignItems='LayoutAlignItems.Center', LayoutGap=14))),
        ('lblDDue', in_box(label(due, Height=40, Size=14, FontWeight='FontWeight.Bold',
                                 Color='If(varTicket.IsOpen && varTicket.DueDate < Today(), clrDanger, clrPrimary)'))),
        ('conDInfo', card([
            ('lblDDetails', in_box(label(details, AutoHeight='true', Size=14))),
            ('lblDExtra', in_box(label('"สั่งเพิ่ม" & Char(10) & varTicket.CEOExtra', AutoHeight='true', Size=14,
                                       Visible='!IsBlank(varTicket.CEOExtra)', Fill='ColorFade(clrAccent, 92%)', BorderColor='ColorFade(clrAccent, 50%)',
                                       BorderThickness=2, PaddingTop=10, PaddingBottom=10, PaddingLeft=12, PaddingRight=12))),
        ], 'lblDDetails.Height + If(lblDExtra.Visible, lblDExtra.Height + 10, 0) + 28')),
        ('conDFiles', card([
            ('lblSentFiles', in_box(label(sent, AutoHeight='true', Size=13, Visible='CountRows(Filter(galHistory.AllItems, StartsWith(Comment, "📎 แนบไฟล์"))) > 0'))),
            ('attFiles', in_box(att)),
            ('conDFileBtns', in_box(hbox([
                ('btnPhotos', in_box(button('"เปิดโฟลเดอร์"', folder, Height=60, Size=14, Fill='Color.White', Color='clrPrimary',
                                            BorderColor='clrLine', BorderThickness=2,
                                            DisplayMode='If(varTicket.HasFiles, DisplayMode.Edit, DisplayMode.Disabled)',
                                            DisabledFill='Color.White', DisabledColor='ColorFade(clrPrimary, 50%)', DisabledBorderColor='clrLine'), 1)),
                ('btnUpload', in_box(button('"ส่งไฟล์"', upload, Height=60, Size=14,
                                            DisplayMode='If(varBusy || IsEmpty(attFiles.Attachments) || !varTicket.IsOpen, DisplayMode.Disabled, DisplayMode.Edit)',
                                            DisabledFill='ColorFade(clrAccent, 60%)', DisabledColor='Color.White'), 1)),
            ], Height=60))),
        ], 'If(lblSentFiles.Visible, lblSentFiles.Height + 10, 0) + 110 + 10 + 60 + 28')),
        history_card('galHistory', 'recHistLine', 'lblHist', 'lblHistHead', 'conDHist'),
        ('conDAction', card([
            ('txtComment', in_box({'type': 'Classic/TextInput@2.3.2', 'props': {
                'Default': '""', 'Mode': 'TextMode.MultiLine', 'Height': 70, 'Font': FONT, 'Size': 14,
                'HintText': '"ข้อความถึง CEO (ถาม CEO / ส่งความเห็น ต้องพิมพ์ก่อน) เช่น รับทราบค่ะ จะเริ่มพรุ่งนี้"',
                'BorderColor': 'clrLine', 'BorderThickness': 2, 'Fill': 'Color.White', 'HoverFill': 'Color.White',
                'RadiusTopLeft': 10, 'RadiusTopRight': 10, 'RadiusBottomLeft': 10, 'RadiusBottomRight': 10}})),
            ('conDBig', in_box(hbox(big, Height=64))),
            ('conDSmall', in_box(hbox(small, Height=56))),
        ], '70 + 64 + 56 + 2 * 10 + 28')),
    ], X=0, Y=94, Width='Parent.Width', Height=f'Parent.Height - 94 - {TAB_H}', Fill='clrBg', LayoutGap=12,
       PaddingTop=12, PaddingBottom=16, PaddingLeft=20, PaddingRight=20, LayoutOverflowY='LayoutOverflow.Scroll')
    children = [
        ('recHeader', rect(Fill='clrPrimary', Height=90, Width='Parent.Width')),
        ('recHeaderLine', rect(Fill='clrAccent', Height=4, Width='Parent.Width', Y=90)),
        ('imgLogoD', image("'df-logo-white'", X=16, Y=12, Width=150, Height=66)),
        ('imgCEOD', image("'ceo-avatar-sangngan'", X='Parent.Width - 80', Y=4, Width=64, Height=83)),
        ('conDBody', body),
    ] + tabs('D', STAFF_TABS, 'List')
    return screen('scrDetail', {'Fill': 'clrBg', 'OnVisible': 'Refresh(TicketHistory)'}, children)

if __name__ == '__main__':
    import sys
    out = sys.argv[1]
    for name, fn in [('scrHome', scr_home), ('scrTickets', scr_tickets), ('scrDetail', scr_detail)]:
        open(f'{out}/{name}.yaml', 'w', encoding='utf-8').write(fn())
