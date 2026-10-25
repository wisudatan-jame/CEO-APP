# โครงสร้างข้อมูล (SharePoint)

Site: `CEO-Tickets` เป็น Communication site (ไม่ผูก Microsoft 365 Group) ภาษา English
- **Owners:** CEO, เจ้าของโปรเจกต์, ผู้ดูแลสำรอง
- **Members / Visitors:** เว้นว่างไว้ พนักงานเข้าถึงข้อมูลผ่านสิทธิ์ระดับรายการที่ Flow ตั้งให้เท่านั้น

> หลักการ: Power Apps ซ่อนข้อมูลจากหน้าจอได้เท่านั้น **ไม่ใช่ตัวกั้นความปลอดภัย** ความปลอดภัยจริงอยู่ที่สิทธิ์ SharePoint

## List: `Tickets`
| คอลัมน์ (ชื่อภายใน) | ชนิด | บังคับ | หมายเหตุ |
|---|---|---|---|
| `Title` | Single line text | ใช่ | ชื่องาน |
| `Assignee` | Person (เลือกได้ 1 คน) | ไม่ | ผู้รับผิดชอบ 1 คนต่อ 1 ใบ Flow ตั้งค่าจาก `AssigneeEmail` (Graph ตั้งคอลัมน์ Person ด้วยอีเมลไม่ได้ จึงห้ามตั้งเป็นบังคับ) |
| `AssigneeEmail` | Single line text | ใช่ | อีเมลผู้รับผิดชอบ (ตัวพิมพ์เล็ก) **เป็นค่าหลัก** ที่ทุกช่องทางเขียน ตั้ง Index ด้วย |
| `DueDate` | Date only | ใช่ | **ต้องเป็น Date only** เพื่อเลี่ยงบั๊กวันที่เลื่อนข้ามวันจากโซนเวลา |
| `Priority` | Choice: `Low`, `Normal`, `High` | ใช่ | ค่าเริ่มต้น `Normal` แสดงผลเป็น ต่ำ/ปกติ/สูง |
| `Status` | Choice (ดูตารางด้านล่าง) | ใช่ | ค่าเริ่มต้น `New` |
| `Details` | Multiple lines (Plain text) | ไม่ | ห้ามเปิด Rich text เพื่อลดความเสี่ยงและความซับซ้อน |
| `CEOExtra` | Multiple lines (Plain text) | ไม่ | คำสั่งเพิ่มเติมจาก CEO หลังสร้างงานแล้ว บอทต่อท้ายทีละข้อความพร้อมเวลา `[dd/MM HH:mm] ข้อความ` ห้ามแก้ด้วยมือ |
| `IsOpen` | Yes/No | ใช่ | Flow เป็นคนตั้งค่า `true` ตอนสร้าง และ `false` ตอนปิดงาน ใช้กรองรายการเพื่อให้ Delegation ทำงานได้ |
| `AckedAt` | Date and time | ไม่ | เวลารับทราบ |
| `DoneAt` | Date and time | ไม่ | เวลาที่พนักงานกดเสร็จ |
| `ClosedAt` | Date and time | ไม่ | เวลาที่ CEO ปิดงาน |
| `OverdueNotified` | Yes/No | ใช่ | ค่าเริ่มต้น `false` กันการเตือนซ้ำ |
| `NoAckNotified` | Yes/No | ใช่ | ค่าเริ่มต้น `false` กันการเตือนซ้ำกรณีไม่กดรับทราบ |
| `Source` | Choice: `App`, `LINE` | ใช่ | ช่องทางที่สร้าง Ticket |
| `PermsSet` | Yes/No | ใช่ | Flow ตั้งเป็น `true` หลังตั้งสิทธิ์และแจ้งเตือนเสร็จ ใช้กันทำซ้ำ |
| `HasFiles` | Yes/No | ใช่ | มีรูปแนบในโฟลเดอร์ `TicketFiles/T-<ID>` |

ตั้ง **Require that items are checked out** = ปิด และเปิด **Item-level version history** (Versioning) เพื่อกู้ข้อมูลที่ถูกแก้ผิด
อย่าใช้ Advanced settings → Item-level permissions แบบ **Only their own** เพราะกติกานั้นอิงจาก "ผู้สร้างรายการ" ซึ่งในระบบนี้คือ Flow/CEO ไม่ใช่ผู้รับผิดชอบ ให้คงค่าเริ่มต้นไว้ แล้วใช้สิทธิ์เฉพาะรายการที่ Flow ตั้งแทน

### สถานะและการเปลี่ยนสถานะ
| ค่า `Status` | ความหมาย |
|---|---|
| `New` | CEO สร้างแล้ว ผู้รับผิดชอบยังไม่รับทราบ |
| `Acknowledged` | รับทราบแล้ว |
| `InProgress` | กำลังทำ |
| `WaitingCEO` | ผู้รับผิดชอบรอคำตอบหรือการตัดสินใจจาก CEO |
| `Done` | ผู้รับผิดชอบทำเสร็จ รอ CEO ตรวจ |
| `Closed` | CEO ปิดงาน (สถานะสุดท้าย) |

| จาก | ไป | ผู้ทำได้ | Action |
|---|---|---|---|
| `New` | `Acknowledged` | ผู้รับผิดชอบ | `ack` |
| `New`, `Acknowledged`, `WaitingCEO` | `InProgress` | ผู้รับผิดชอบ | `start` (ถ้ามาจาก `New` ให้ตั้ง `AckedAt` ด้วย) |
| `New`, `Acknowledged`, `InProgress` | `WaitingCEO` | ผู้รับผิดชอบ | `wait` |
| `WaitingCEO` | `InProgress` | CEO | `reply` |
| `New`, `Acknowledged`, `InProgress`, `WaitingCEO` | `Done` | ผู้รับผิดชอบ | `done` (ถ้ามาจาก `New` ให้ตั้ง `AckedAt` ด้วย) |
| `Done` | `Closed` | CEO | `close` |
| `Done` | `InProgress` | CEO | `reopen` |
| ทุกสถานะที่ยังไม่ `Closed` | `Closed` | CEO | `cancel` |
| ทุกสถานะที่ยังไม่ `Closed` | (ไม่เปลี่ยน) | CEO หรือผู้รับผิดชอบ | `comment` |

พนักงาน**ไม่ต้องกดตามลำดับ** (ตัดสินใจ 25 ต.ค. 2026) เช่น กด "ทำเสร็จแล้ว" ได้เลยโดยไม่ต้องรับทราบหรือเริ่มทำก่อน แต่ย้อนกลับไม่ได้ (ทำเสร็จแล้วกดเริ่มทำไม่ได้ จนกว่า CEO ส่งกลับ) · ส่งความเห็นได้ไม่จำกัดจนกว่างานปิด · ถาม CEO ได้อีกหลัง CEO ตอบ

การเปลี่ยนสถานะที่ไม่อยู่ในตาราง **ต้องถูก Flow ปฏิเสธ** (ดู [03-flows.md](03-flows.md))

## List: `TicketHistory` (บันทึกเหตุการณ์ แก้ย้อนหลังไม่ได้)
| คอลัมน์ | ชนิด | หมายเหตุ |
|---|---|---|
| `Title` | Single line text | ตั้งเป็น `T-<TicketID>` |
| `TicketID` | Number | ID ของ Ticket |
| `Action` | Choice: `create`, `ack`, `start`, `wait`, `reply`, `done`, `reopen`, `close`, `cancel`, `comment`, `due_change`, `reassign` (CEO โอนงานจาก LINE) | |
| `FromStatus` | Single line text | |
| `ToStatus` | Single line text | |
| `Comment` | Multiple lines (Plain text) | |
| `ActorEmail` | Single line text | อีเมลที่ Flow ตรวจสอบเอง **ไม่รับค่าที่แอปส่งมาตรง ๆ** (จาก LINE = อีเมล CEO หลังตรวจ LINE user ID แล้ว) |
| `Source` | Choice: `App`, `LINE` | ช่องทางของเหตุการณ์ |
| `Processed` | Yes/No | เหตุการณ์จาก LINE รอ Flow `OnLineEvent` ตั้งสิทธิ์และแจ้งเตือน (`false`) / ทำแล้ว (`true`) |
| `CEOPending` | Yes/No (Index) | `true` = พนักงานถาม CEO / ทำเสร็จ / เขียนความเห็น และบอทยังไม่ได้ส่งเข้า LINE ของ CEO (Flow `UpdateTicket` ตั้ง, บอทล้างหลังส่ง) |

เฉพาะ Flow เท่านั้นที่เขียนได้ ผู้ใช้ทั่วไปไม่มีสิทธิ์เขียนหรือแก้ไข สิทธิ์รายการตั้งเหมือน Ticket ที่เกี่ยวข้อง

## List: `Employees` (HR เป็นเจ้าของ)
| คอลัมน์ | ชนิด | หมายเหตุ |
|---|---|---|
| `Title` | Single line text | ชื่อ-นามสกุล |
| `FirstName` | Single line text | |
| `LastName` | Single line text | |
| `Nickname` | Single line text | ชื่อเล่นหลัก ใช้แสดงบนปุ่ม |
| `Aliases` | Single line text | ชื่อเรียกอื่นคั่นด้วยจุลภาค เช่น `พี่เอ,เอ Sales` |
| `Email` | Single line text | อีเมล M365 |
| `Department` | Single line text | แสดงในปุ่ม เช่น `เอ (Sales)` เพื่อแยกชื่อเล่นซ้ำ |
| `Active` | Yes/No | `false` เมื่อลาออก (บอทจะไม่ให้เลือก) |

## Document library: `TicketFiles`
รูปที่ CEO ส่งใน LINE เก็บที่โฟลเดอร์ `T-<ID>/photo-1.jpg` ... Flow `OnLineEvent` ให้สิทธิ์โฟลเดอร์กับผู้รับผิดชอบแบบเดียวกับ Ticket

## List: `Holidays`
| คอลัมน์ | ชนิด | หมายเหตุ |
|---|---|---|
| `Title` | Single line text | ชื่อวันหยุด |
| `Date` | Date only | |

HR อัปเดตปีละครั้ง ใช้ข้ามวันหยุดในสรุปเช้าของ CEO และการเตือนงานเลยกำหนด

## List: `Config`
| `Title` (key) | `Value` | ตัวอย่าง |
|---|---|---|
| `CEO_EMAIL` | อีเมลของ CEO | |
| `OWNER_EMAIL` | อีเมลผู้ดูแลหลัก | ใช้ส่งแจ้งเตือนเมื่อ Flow ล้มเหลว |
| `BACKUP_EMAIL` | อีเมลผู้ดูแลสำรอง | |
| `NOACK_HOURS` | 24 | เตือนถ้าไม่รับทราบภายในกี่ชั่วโมง |
| `CEO_LINE_USER_ID` | LINE user ID ของ CEO (`U...`) | บอทตอบเฉพาะคนนี้ เว้นว่างไว้ระหว่างตั้งค่า บอทจะบอก ID ของผู้ส่ง |
| `QUICK_ASSIGNEES` | อีเมลคั่นด้วยจุลภาค | ปุ่มลัดช่วงแรกก่อนมีสถิติ (PM, การตลาด, Presales, Sales) |
| `SP_WEBHOOK_EXPIRES` | `YYYY-MM-DD` | วันหมดอายุของ SharePoint webhook ที่แจ้ง n8n สคริปต์ `setup/create-webhook.js` เขียนให้ |

เก็บค่าตั้งไว้ที่เดียว เปลี่ยนคนโดยไม่ต้องแก้แอปและ Flow Config อ่านได้เฉพาะ Owners และ Flow

## กติกาสิทธิ์ของ Ticket หนึ่งใบ
Flow `CreateTicket` ตั้งให้ทุกใบ:
1. ตัดสิทธิ์ที่สืบทอดจาก List ออก (Stop sharing)
2. ให้ CEO สิทธิ์อ่านและส่วนผู้ดูแลระบบเข้าถึงผ่านความเป็น Site Owner
3. ให้ผู้รับผิดชอบสิทธิ์ **อ่านอย่างเดียว** (Read) เท่านั้น

พนักงานไม่มีสิทธิ์แก้ไขรายการโดยตรง การเปลี่ยนสถานะทั้งหมดต้องผ่าน Flow `UpdateTicket` ซึ่งตรวจสิทธิ์และเส้นทางเปลี่ยนสถานะให้ ป้องกันพนักงานแก้ฟิลด์เองผ่านหน้า SharePoint

ข้อควรระวัง
- Site Owners เห็นทุกใบเสมอ จึงต้องจำกัดจำนวน Owners และตรวจรายชื่อเป็นประจำ
- SharePoint มีขีดจำกัดจำนวนรายการที่ตั้งสิทธิ์เฉพาะต่อ List (ราว 50,000 ใบ ⚠️ ตรวจเอกสารทางการ) และประสิทธิภาพลดลงเมื่อมีมาก ให้ย้ายใบที่ปิดแล้วไป List ประวัติรายปี (ดู [05-handover.md](05-handover.md))
- เมื่อเปลี่ยนผู้รับผิดชอบ (ถ้าอนุญาตในอนาคต) Flow ต้องถอนสิทธิ์คนเก่าและให้สิทธิ์คนใหม่ในขั้นตอนเดียว
