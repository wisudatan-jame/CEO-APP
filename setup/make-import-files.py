# Builds setup/import/*.xlsx for SharePoint "New list -> Import from Excel".
# Run: python3 setup/make-import-files.py
from datetime import date, datetime
from pathlib import Path
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.worksheet.table import Table, TableStyleInfo

OUT = Path(__file__).parent / "import"
FONT = Font(name="Arial", size=10)
BOLD = Font(name="Arial", size=10, bold=True)
EXAMPLE_FILL = PatternFill("solid", start_color="FFF2CC")
D = date(2026, 10, 20)
T = datetime(2026, 10, 19, 9, 30)

# (list name, [(column, type to pick in the import wizard)], rows, rows_are_examples, notes)
LISTS = [
    ("Tickets", [
        ("Title", "Single line of text"), ("AssigneeEmail", "Single line of text"), ("Assignee", "Person"),
        ("DueDate", "Date and time (date only)"), ("Priority", "Choice"), ("Status", "Choice"),
        ("Details", "Multiple lines of text"), ("IsOpen", "Yes/No"), ("AckedAt", "Date and time"),
        ("DoneAt", "Date and time"), ("ClosedAt", "Date and time"), ("OverdueNotified", "Yes/No"),
        ("NoAckNotified", "Yes/No"), ("Source", "Choice"), ("PermsSet", "Yes/No"), ("HasFiles", "Yes/No"),
    ], [
        # one row per Status value so the Choice column gets every option
        [f"ตัวอย่าง-ลบหลังนำเข้า {s}", "example@digitalfocus.co.th", "example@digitalfocus.co.th", D, p, s,
         "รายละเอียดตัวอย่าง", s != "Closed", T, T, T, False, False, src, True, False]
        for s, p, src in [("New", "Low", "App"), ("Acknowledged", "Normal", "LINE"), ("InProgress", "High", "App"),
                          ("WaitingCEO", "Normal", "App"), ("Done", "Normal", "App"), ("Closed", "Normal", "App")]
    ], True),
    ("TicketHistory", [
        ("Title", "Single line of text"), ("TicketID", "Number"), ("Action", "Choice"),
        ("FromStatus", "Single line of text"), ("ToStatus", "Single line of text"), ("Comment", "Multiple lines of text"),
        ("ActorEmail", "Single line of text"), ("Source", "Choice"), ("Processed", "Yes/No"), ("CEOPending", "Yes/No"),
    ], [
        [f"ตัวอย่าง-ลบหลังนำเข้า {a}", 1, a, "New", "New", "ความเห็นตัวอย่าง", "example@digitalfocus.co.th",
         "LINE" if i % 2 else "App", True, False]
        for i, a in enumerate(["create", "ack", "start", "wait", "reply", "done", "reopen", "close", "cancel", "comment", "due_change"])
    ], True),
    ("Employees", [
        ("Title", "Single line of text"), ("FirstName", "Single line of text"), ("LastName", "Single line of text"),
        ("Nickname", "Single line of text"), ("Aliases", "Single line of text"), ("Email", "Single line of text"),
        ("Department", "Single line of text"), ("Active", "Yes/No"),
    ], [["ตัวอย่าง ใจดี", "ตัวอย่าง", "ใจดี", "เอ", "พี่เอ,เอ Sales", "example.a@digitalfocus.co.th", "Sales", True]], True),
    ("Config", [("Title", "Single line of text"), ("Value", "Single line of text")], [
        ["CEO_EMAIL", ""], ["OWNER_EMAIL", ""], ["BACKUP_EMAIL", ""], ["NOACK_HOURS", "24"],
        ["CEO_LINE_USER_ID", ""], ["QUICK_ASSIGNEES", ""], ["SP_WEBHOOK_EXPIRES", ""],
    ], False),
    ("Holidays", [("Title", "Single line of text"), ("Date", "Date and time (date only)")], [
        ["วันปิยมหาราช", date(2026, 10, 23)],
        ["วันคล้ายวันพระบรมราชสมภพ ร.9 / วันชาติ / วันพ่อแห่งชาติ", date(2026, 12, 5)],
        ["วันรัฐธรรมนูญ", date(2026, 12, 10)],
        ["วันสิ้นปี", date(2026, 12, 31)],
    ], False),
]

def build(name, cols, rows, examples):
    wb = Workbook()
    ws = wb.active
    ws.title = "Data"
    ws.append([c for c, _ in cols])
    for r in rows:
        ws.append(r)
    for cell in ws[1]:
        cell.font = BOLD
    for row in ws.iter_rows(min_row=2):
        for cell in row:
            cell.font = FONT
            if isinstance(cell.value, datetime):
                cell.number_format = "yyyy-mm-dd hh:mm"
            elif isinstance(cell.value, date):
                cell.number_format = "yyyy-mm-dd"
            if examples:
                cell.fill = EXAMPLE_FILL
    for i, (c, _) in enumerate(cols, start=1):
        ws.column_dimensions[ws.cell(row=1, column=i).column_letter].width = max(14, len(c) + 4)
    if name == "Config":
        ws.column_dimensions["B"].width = 50
    ref = f"A1:{ws.cell(row=1, column=len(cols)).column_letter}{len(rows) + 1}"
    table = Table(displayName=name, ref=ref)
    table.tableStyleInfo = TableStyleInfo(name="TableStyleLight9", showRowStripes=True)
    ws.add_table(table)

    guide = wb.create_sheet("วิธีใช้")
    lines = [
        (f"ไฟล์นำเข้า List: {name}", BOLD),
        ("SharePoint → Site CEO-Tickets → + New → List → Import from Excel → เลือกไฟล์นี้ → ตาราง (Table) ชื่อ " + name, FONT),
        (f"ตั้งชื่อ List เป็น {name} ตรงตัวพิมพ์ ห้ามเปลี่ยนชื่อหัวคอลัมน์", FONT),
        ("แถวสีเหลือง = ตัวอย่างเพื่อให้ SharePoint เดาชนิดคอลัมน์และตัวเลือก Choice ได้ครบ ลบทิ้งหลังนำเข้า" if examples
         else "ข้อมูลในไฟล์นี้เป็นข้อมูลจริง ไม่ต้องลบหลังนำเข้า", FONT),
        ("", FONT),
        ("คอลัมน์", BOLD),
        ("ชนิดที่ต้องเลือกในหน้านำเข้า", BOLD),
    ]
    for text, font in lines[:5]:
        guide.append([text])
        guide.cell(row=guide.max_row, column=1).font = font
    guide.append([lines[5][0], lines[6][0]])
    for cell in guide[guide.max_row]:
        cell.font = BOLD
    for c, t in cols:
        guide.append([c, t])
        for cell in guide[guide.max_row]:
            cell.font = FONT
    guide.append([])
    guide.append(["หลังนำเข้า ทำตามรายการตรวจใน docs/guides/B-setup-lists.md หัวข้อ 'ทางเลือก: นำเข้าจาก Excel'"])
    guide.cell(row=guide.max_row, column=1).font = BOLD
    guide.column_dimensions["A"].width = 28
    guide.column_dimensions["B"].width = 34
    for row in guide.iter_rows():
        for cell in row:
            cell.alignment = Alignment(wrap_text=False, vertical="top")
    wb.save(OUT / f"{name}.xlsx")

OUT.mkdir(exist_ok=True)
for spec in LISTS:
    build(*spec)
    print("wrote", OUT / f"{spec[0]}.xlsx")
