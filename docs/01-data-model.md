# โครงสร้างข้อมูล (SharePoint)

Site: `CEO-Tickets` เป็น Communication site (ไม่ผูก Microsoft 365 Group) ภาษา English
- **Owners:** CEO, เจ้าของโปรเจกต์, ผู้ดูแลสำรอง
- **Members / Visitors:** เว้นว่างไว้ พนักงานเข้าถึงข้อมูลผ่านสิทธิ์ระดับรายการที่ Flow ตั้งให้เท่านั้น

> หลักการ: Power Apps ซ่อนข้อมูลจากหน้าจอได้เท่านั้น **ไม่ใช่ตัวกั้นความปลอดภัย** ความปลอดภัยจริงอยู่ที่สิทธิ์ SharePoint

## List: `Tickets`
| คอลัมน์ (ชื่อภายใน) | ชนิด | บังคับ | หมายเหตุ |
|---|---|---|---|
| `Title` | Single line text | ใช่ | ชื่องาน |
| `Assignee` | Person (เลือกได้ 1 คน) | ใช่ | ผู้รับผิดชอบ 1 คนต่อ 1 ใบ |
| `DueDate` | Date only | ใช่ | **ต้องเป็น Date only** เพื่อเลี่ยงบั๊กวันที่เลื่อนข้ามวันจากโซนเวลา |
| `Priority` | Choice: `Low`, `Normal`, `High` | ใช่ | ค่าเริ่มต้น `Normal` แสดงผลเป็น ต่ำ/ปกติ/สูง |
| `Status` | Choice (ดูตารางด้านล่าง) | ใช่ | ค่าเริ่มต้น `New` |
| `Details` | Multiple lines (Plain text) | ไม่ | ห้ามเปิด Rich text เพื่อลดความเสี่ยงและความซับซ้อน |
| `IsOpen` | Yes/No | ใช่ | Flow เป็นคนตั้งค่า `true` ตอนสร้าง และ `false` ตอนปิดงาน ใช้กรองรายการเพื่อให้ Delegation ทำงานได้ |
| `AckedAt` | Date and time | ไม่ | เวลารับทราบ |
| `DoneAt` | Date and time | ไม่ | เวลาที่พนักงานกดเสร็จ |
| `ClosedAt` | Date and time | ไม่ | เวลาที่ CEO ปิดงาน |
| `OverdueNotified` | Yes/No | ใช่ | ค่าเริ่มต้น `false` กันการเตือนซ้ำ |
| `NoAckNotified` | Yes/No | ใช่ | ค่าเริ่มต้น `false` กันการเตือนซ้ำกรณีไม่กดรับทราบ |
| `Source` | Choice: `App`, `LINE` | ใช่ | ช่องทางที่สร้าง Ticket |
| `PermsSet` | Yes/No | ใช่ | Flow ตั้งเป็น `true` หลังตั้งสิทธิ์และแจ้งเตือนเสร็จ ใช้กันทำซ้ำ |

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
| `New`, `Acknowledged` | `InProgress` | ผู้รับผิดชอบ | `start` (ถ้ามาจาก `New` ให้ตั้ง `AckedAt` ด้วย) |
| `New`, `Acknowledged`, `InProgress` | `WaitingCEO` | ผู้รับผิดชอบ | `wait` |
| `WaitingCEO` | `InProgress` | CEO | `reply` |
| `InProgress` | `Done` | ผู้รับผิดชอบ | `done` |
| `Done` | `Closed` | CEO | `close` |
| `Done` | `InProgress` | CEO | `reopen` |
| ทุกสถานะที่ยังไม่ `Closed` | `Closed` | CEO | `cancel` |
| ทุกสถานะที่ยังไม่ `Closed` | (ไม่เปลี่ยน) | CEO หรือผู้รับผิดชอบ | `comment` |

การเปลี่ยนสถานะที่ไม่อยู่ในตาราง **ต้องถูก Flow ปฏิเสธ** (ดู [03-flows.md](03-flows.md))

## List: `TicketHistory` (บันทึกเหตุการณ์ แก้ย้อนหลังไม่ได้)
| คอลัมน์ | ชนิด | หมายเหตุ |
|---|---|---|
| `Title` | Single line text | ตั้งเป็น `T-<TicketID>` |
| `TicketID` | Number | ID ของ Ticket |
| `Action` | Choice: `create`, `ack`, `start`, `wait`, `reply`, `done`, `reopen`, `close`, `cancel`, `comment`, `due_change` | |
| `FromStatus` | Single line text | |
| `ToStatus` | Single line text | |
| `Comment` | Multiple lines (Plain text) | |
| `ActorEmail` | Single line text | อีเมลที่ Flow ตรวจสอบเอง **ไม่รับค่าที่แอปส่งมาตรง ๆ** |

เฉพาะ Flow เท่านั้นที่เขียนได้ ผู้ใช้ทั่วไปไม่มีสิทธิ์เขียนหรือแก้ไข สิทธิ์รายการตั้งเหมือน Ticket ที่เกี่ยวข้อง

## List: `Config`
| `Title` (key) | `Value` | ตัวอย่าง |
|---|---|---|
| `CEO_EMAIL` | อีเมลของ CEO | |
| `OWNER_EMAIL` | อีเมลผู้ดูแลหลัก | ใช้ส่งแจ้งเตือนเมื่อ Flow ล้มเหลว |
| `BACKUP_EMAIL` | อีเมลผู้ดูแลสำรอง | |
| `NOACK_HOURS` | 24 | เตือนถ้าไม่รับทราบภายในกี่ชั่วโมง |

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
