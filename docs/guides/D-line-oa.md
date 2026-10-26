# คู่มือ ง: ตั้งค่า LINE Official Account "DF สั่งงาน"

ใช้เวลาประมาณ 30 นาที ทำได้ก่อน Global Admin ตั้งสิทธิ์เสร็จ
ผลลัพธ์: OA สำหรับ CEO สั่งงานเท่านั้น เปิด Messaging API แล้ว ได้ค่า `LINE_CHANNEL_SECRET` และ `LINE_CHANNEL_ACCESS_TOKEN` สำหรับ n8n

> ⚠️ หน้าจอของ LINE เปลี่ยนบ่อย ถ้าชื่อเมนูต่างจากคู่มือ ให้หาเมนูที่มีความหมายเดียวกัน
> **ห้ามใช้ OA การตลาดที่ลูกค้าแอดอยู่** สร้าง OA ใหม่แยกเฉพาะงานนี้

## 1. บัญชีที่ใช้สร้าง
- ล็อกอินด้วย **LINE Business ID แบบอีเมลบริษัท** (เช่น `wisuda@digitalfocus.co.th`) ดีกว่าบัญชี LINE ส่วนตัว เพราะโอนความเป็นเจ้าของได้เมื่อเปลี่ยนคนดูแล
- เปิด **การยืนยันตัวตน 2 ขั้น** ของบัญชีนี้ เพราะคนที่ล็อกอินได้คือคนที่ควบคุมบอทของ CEO ได้

## 2. สร้าง OA
1. เปิด **https://manager.line.biz** → **Create a LINE Official Account / สร้างบัญชี**
2. ชื่อบัญชี: `DF สั่งงาน` · หมวดหมู่: ธุรกิจ/บริการที่ใกล้เคียง · ประเทศ: ไทย
3. ไม่ต้องขอ Verified badge (ใช้แบบไม่ยืนยันได้ เพราะมีผู้ใช้คนเดียวคือ CEO)

## 3. ตั้งค่าการตอบกลับ (สำคัญ: กันข้อความชนกับบอท)
OA Manager → **Settings / ตั้งค่า** → **Response settings / การตอบกลับ**
| รายการ | ตั้งเป็น |
|---|---|
| **Webhooks** | **เปิด** |
| **Chat / แชต** (ให้แอดมินตอบเอง) | **ปิด** |
| **Greeting message / ข้อความทักทาย** | **ปิด** (บอทส่งวิธีใช้ให้เองเมื่อ CEO แอด) |
| **Auto-response / ตอบกลับอัตโนมัติ** | **ปิด** |

## 4. ไม่ให้คนนอกหาเจอ
OA Manager → Settings → **Account settings / ตั้งค่าบัญชี**
- **แสดงในผลการค้นหา:** ปิด
- **อนุญาตให้เข้าร่วมกลุ่มและห้องแชต:** ปิด (บอทรับเฉพาะแชต 1:1 กับ CEO)

บอทตอบเฉพาะ LINE user ID ของ CEO อยู่แล้ว ข้อนี้คือการลดคนแปลกหน้าที่จะแอดเข้ามาตั้งแต่ต้น

## 5. เปิด Messaging API
1. OA Manager → Settings → **Messaging API** → **Enable Messaging API / ใช้ Messaging API**
2. เลือกหรือสร้าง **Provider** ชื่อ `Digital Focus` (Provider เดียวกันใช้กับบอทอื่นของบริษัทในอนาคตได้)
3. ยืนยัน

## 6. เอาค่ามาใส่ n8n
เปิด **https://developers.line.biz/console** → Provider `Digital Focus` → Channel `DF สั่งงาน`
| ค่า | อยู่ที่ | ใส่ใน n8n Variables |
|---|---|---|
| Channel secret | แท็บ **Basic settings** | `LINE_CHANNEL_SECRET` |
| Channel access token (long-lived) | แท็บ **Messaging API** → ล่างสุด → **Issue** | `LINE_CHANNEL_ACCESS_TOKEN` |

- **คัดลอกจากหน้าเว็บไปวางใน n8n โดยตรง** ห้ามส่งทางแชต อีเมล หรือจดในไฟล์ที่ Commit ลง Git
- ถ้าค่าใดหลุด: กด **Reissue** ที่หน้าเดียวกัน แล้วใส่ค่าใหม่ใน n8n (ค่าเก่าใช้ไม่ได้ทันที)

ในแท็บ **Messaging API** ตั้งเพิ่ม:
- **Allow bot to join group chats:** Disabled
- **Auto-reply messages / Greeting messages:** Disabled (ลิงก์จะพากลับไปหน้า OA Manager ข้อ 3)

## 7. ตั้ง Webhook (ทำหลัง n8n รันพร้อม Tunnel แล้ว)
แท็บ **Messaging API** → **Webhook settings**
1. **Webhook URL:** `<URL ของ n8n>/webhook/ceo-line-bot` (ดู [../../n8n/README.md](../../n8n/README.md))
2. กด **Verify** → ต้องขึ้น **Success** (n8n ต้อง Publish Workflow แล้ว)
3. เปิด **Use webhook**
4. **Webhook redelivery:** เปิดได้ (บอทกันข้อความซ้ำไว้แล้ว)

เมื่อย้าย n8n ไป n8n Cloud ต้องกลับมาเปลี่ยน Webhook URL ที่นี่

## 8. ผู้ดูแล OA
OA Manager → Settings → **Permissions / สิทธิ์การใช้งาน**
- เพิ่ม **คุณ Suchada** เป็น Admin (ผู้ดูแลสำรอง)
- อย่าเพิ่มคนอื่น ผู้ดูแล OA อ่านข้อความแชตกับ CEO ได้ (ถ้าเปิดโหมด Chat)

## 9. ให้ CEO แอดเพื่อน
1. OA Manager → **Home** → **Add friends / เพิ่มเพื่อน** → QR code หรือลิงก์
2. ส่ง QR ให้ CEO **โดยตรง** (อย่าโพสต์ในกลุ่ม)
3. ทำตาม [../../n8n/README.md](../../n8n/README.md) หัวข้อ "หา LINE user ID ของ CEO"

## 10. โควตาข้อความ ⚠️
- **Reply** (ตอบทันทีหลัง CEO ส่งหรือกดปุ่ม) ไม่นับโควตา บอทใช้แบบนี้เป็นหลัก
- **Push** (บอทส่งเอง) นับโควตา: สรุปเช้า ~22 ครั้ง/เดือน, สรุปวันศุกร์ ~4, แจ้งเตือนเมื่อพนักงานถาม/ทำเสร็จ/เขียนความเห็น (ขึ้นกับการใช้งาน อาจหลักร้อย)
- **ตรวจโควตาฟรีของแพ็กเกจปัจจุบัน**ที่ OA Manager → **Settings → Plan / แพ็กเกจ** และดูการใช้จริงหลังสัปดาห์ทดลองที่ **Insight → Messages** ถ้าใกล้เต็ม ต้องอัปเกรดแพ็กเกจ มิฉะนั้นแจ้งเตือนถึง CEO จะหยุดส่งกลางเดือน

## 11. (ไม่บังคับ) Rich menu ให้ CEO
OA Manager → **Rich menus** → สร้างเมนู 2 ปุ่มที่ **ส่งข้อความ**:
- `📋 สรุป` → ข้อความ `สรุป`
- `❓ วิธีใช้` → ข้อความ `วิธีใช้`

CEO ไม่ต้องจำคำสั่ง บอทเข้าใจทั้งสองคำอยู่แล้ว

## ตรวจขั้นสุดท้าย
- [ ] Webhooks เปิด · Chat, Greeting, Auto-response ปิด
- [ ] ค้นหาไม่เจอ · เข้ากลุ่มไม่ได้
- [ ] Channel secret และ Access token อยู่ใน n8n Variables เท่านั้น
- [ ] Webhook Verify = Success · Use webhook เปิด
- [ ] คุณ Suchada เป็น Admin
- [ ] ตรวจโควตาข้อความของแพ็กเกจแล้ว
