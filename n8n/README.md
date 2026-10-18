# บอท LINE "DF สั่งงาน" (n8n)

ไฟล์ [`ceo-line-bot.json`](ceo-line-bot.json) คือ Workflow สำหรับ Import เข้า n8n ประกอบด้วย 3 ส่วน
| Trigger | ทำอะไร |
|---|---|
| **LINE Webhook** (`POST /webhook/ceo-line-bot`) | รับข้อความจาก CEO → ถามผู้รับผิดชอบ → ถามวันส่ง → สร้าง Ticket ใน SharePoint, คำสั่ง "สรุป", ปิดงาน/ส่งกลับจาก LINE |
| **Weekdays 07:00** | สรุปเช้าส่งเข้า LINE ของ CEO (ข้ามวันหยุดใน List `Holidays`) |
| **Friday 17:00** | สรุปรายคนประจำสัปดาห์ |

การออกแบบบทสนทนาและความปลอดภัยอยู่ที่ [../docs/06-line-bot.md](../docs/06-line-bot.md)

> ⚠️ ทดสอบด้วย Mock ของ LINE และ SharePoint แล้ว (`node --test n8n/test/*.test.js`) แต่**ยังไม่เคยรันกับ n8n, LINE และ SharePoint จริง** ทดสอบตามขั้นตอนด้านล่างก่อนให้ CEO ใช้

## สิ่งที่ต้องมีก่อน
1. Site `CEO-Tickets` พร้อม List `Tickets`, `TicketHistory`, `Employees`, `Config`, `Holidays` และ Library `TicketFiles` ตาม [../docs/01-data-model.md](../docs/01-data-model.md) (ชื่อ List และชื่อคอลัมน์ภายในต้องตรงทุกตัวอักษร)
2. App Registration `DF-CEO-Bot-n8n` ที่ Global Admin ตั้งให้ ([../docs/06-line-bot.md](../docs/06-line-bot.md))
3. LINE Official Account ใหม่ เปิด Messaging API แล้ว
4. Flow `OnLineEvent` ใน Power Automate ([../docs/03-flows.md](../docs/03-flows.md)) มิฉะนั้นงานจาก LINE จะไม่ถูกตั้งสิทธิ์และพนักงานจะไม่ได้แจ้งเตือน

## ค่าตั้ง (Secrets)
Workflow อ่านค่าเหล่านี้จาก **n8n Variables** (`$vars`) ก่อน ถ้าไม่มีจะอ่านจาก environment variable (`$env`)

| ชื่อ | ค่า |
|---|---|
| `LINE_CHANNEL_SECRET` | LINE Developers → Channel → Basic settings → Channel secret |
| `LINE_CHANNEL_ACCESS_TOKEN` | Messaging API → Channel access token (long-lived) |
| `MS_TENANT_ID` | Tenant ID จาก Global Admin |
| `MS_CLIENT_ID` | Application (client) ID ของ `DF-CEO-Bot-n8n` |
| `MS_CLIENT_SECRET` | Client secret (Global Admin กรอกเอง ห้ามส่งทางแชต) |
| `SP_HOSTNAME` | `digitalfocusth.sharepoint.com` |
| `SP_SITE_PATH` | `/sites/CEO-Tickets` |

- **บนโน้ตบุ๊ก (Docker):** ใส่ในไฟล์ `.env` ของ n8n แล้วตั้ง `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` เพื่อให้ Code node อ่าน `$env` ได้ ห้าม Commit ไฟล์ `.env`
- **n8n Cloud:** ใช้เมนู **Variables** ⚠️ ตรวจว่าแพ็กเกจที่ซื้อมีฟีเจอร์ Variables ถ้าไม่มี ต้องหาวิธีอื่นก่อนย้ายขึ้น Cloud (ห้ามพิมพ์ค่าลับลงในโค้ดของ Workflow เพราะจะติดไปกับไฟล์ Export)
- ค่าของ Variables มองเห็นได้โดยทุกคนที่มีสิทธิ์ใน n8n instance นั้น ให้จำกัดผู้ใช้ n8n ไว้ที่ผู้พัฒนาและคุณ Suchada

## ติดตั้งบนโน้ตบุ๊ก (ช่วงพัฒนาและทดลอง)
1. ตั้งเครื่องไม่ให้ Sleep เมื่อเสียบสายชาร์จ และเปิด BitLocker
2. เปิด n8n แล้ว **Workflows → Import from File** เลือก `ceo-line-bot.json`
3. ตั้ง Timezone ของ Workflow เป็น `Asia/Bangkok` (ตั้งไว้ในไฟล์แล้ว ตรวจใน Settings ของ Workflow)
4. เปิด Cloudflare Tunnel ชี้ไปที่ n8n แล้วได้ URL สาธารณะแบบ HTTPS เช่น `https://xxx.trycloudflare.com` ⚠️ ถ้าใช้ Quick Tunnel URL จะเปลี่ยนทุกครั้งที่รันใหม่ ให้ใช้ Named Tunnel ถ้าต้องการ URL คงที่
5. ตั้ง `WEBHOOK_URL` ของ n8n เป็น URL ของ Tunnel แล้วรีสตาร์ต n8n
6. **Activate** Workflow (งานร่างและการกันข้อความซ้ำทำงานเฉพาะเมื่อ Workflow เปิดใช้งาน ไม่ใช่ตอนกด Test)
7. LINE Developers → Messaging API → Webhook URL = `<URL ของ Tunnel>/webhook/ceo-line-bot` → **Verify** → เปิด **Use webhook**
8. LINE Official Account Manager → ปิด Auto-reply และ Greeting message และตั้งค่าบัญชีไม่ให้ค้นหาเจอ

## หา LINE user ID ของ CEO
1. เว้น `CEO_LINE_USER_ID` ใน List `Config` ว่างไว้
2. ให้ CEO แอด OA แล้วส่งข้อความใดก็ได้ บอทจะตอบ LINE user ID กลับไป (โหมดตั้งค่า)
3. นำค่า `U...` ใส่ใน `Config` → `CEO_LINE_USER_ID` (บอทจำค่าตั้งไว้ไม่เกิน 5 นาที)
4. **ห้ามปล่อยให้อยู่ในโหมดตั้งค่า** เพราะระหว่างนั้นบอทตอบทุกคนที่แอด

## ทดสอบก่อนให้ CEO ใช้
| # | ทำ | ผลที่ต้องได้ |
|---|---|---|
| 1 | ส่งข้อความจากบัญชีที่ไม่ใช่ CEO | บอทไม่ตอบ ใน Executions เห็น `not-ceo` |
| 2 | CEO ส่ง "ทดสอบสั่งงาน" → แตะคน → แตะ "พรุ่งนี้" | ได้ `✅ ... T-<ID>` และเห็นรายการใน List `Tickets` วันที่ถูกต้อง |
| 3 | รอไม่เกิน 5 นาที | Flow `OnLineEvent` ตั้งสิทธิ์ พนักงานได้รับแจ้งเตือน `PermsSet = true` |
| 4 | ส่งข้อความ แล้วส่งรูป 2 รูป แล้วสร้างงาน | รูปอยู่ใน `TicketFiles/T-<ID>` |
| 5 | แตะปุ่ม "พรุ่งนี้" ของงานเดิมซ้ำ | `งานนี้สร้างแล้ว: T-<ID>` ไม่มี Ticket ซ้ำ |
| 6 | ส่ง "สรุป" | ตัวเลขตรงกับ List `Tickets` |
| 7 | ตั้งงานหนึ่งเป็น `Done` แล้วกด [✅ รอปิด] → [✅ ปิด T-x] | งานเป็น `Closed` และพนักงานได้แจ้งเตือน (ทดสอบข้อ 11 ของต้นแบบไปด้วย) |
| 8 | กดคำสั่ง **Execute step** ที่ node `Daily summary` | CEO ได้สรุปใน LINE |
| 9 | ปิด n8n แล้วส่งข้อความ | ไม่มีคำตอบภายใน 10 วินาที (CEO ต้องรู้ว่าให้สั่งผ่าน Power Apps แทน) |

## แก้ไขโค้ด
แก้ที่ `src/` แล้วรัน
```bash
node n8n/build.js                 # สร้าง ceo-line-bot.json ใหม่
node --test n8n/test/*.test.js    # ทดสอบ
```
อย่าแก้โค้ดใน n8n โดยตรง เพราะจะไม่ตรงกับ Repo ถ้าจำเป็นต้องแก้ด่วน ให้คัดลอกกลับมาที่ `src/` ทันที

| ไฟล์ | หน้าที่ |
|---|---|
| `src/lib.js` | Logic ทั้งหมด: ตรวจลายเซ็น, บทสนทนา, Graph, LINE, สรุป |
| `src/glue.js` | อ่านค่าลับและสร้าง Context ใน Code node |
| `src/entry-*.js` | จุดเริ่มของแต่ละ Code node |
| `build.js` | ประกอบไฟล์ Workflow |
| `test/bot.test.js` | ทดสอบด้วย Mock |

## ข้อจำกัดที่รู้อยู่
- n8n ต้องส่ง Raw body ให้ Code node (`options.rawBody` ของ Webhook node) เพื่อตรวจลายเซ็น ถ้า n8n เวอร์ชันที่ใช้ไม่ส่ง Raw body บอทจะปฏิเสธทุกข้อความ (`bad-signature`) ซึ่งปลอดภัยไว้ก่อน แต่ต้องแก้ ⚠️ ตรวจในการทดสอบข้อ 2
- ข้อความ (Execution data) ที่สำเร็จไม่ถูกเก็บใน n8n (`saveDataSuccessExecution: none`) เพื่อไม่ให้คำสั่งลับของ CEO ค้างอยู่ ถ้าต้องดูเพื่อแก้ปัญหา ให้เปิดชั่วคราวใน Settings ของ Workflow
- ตั้ง **Error Workflow** ใน n8n ให้ส่งอีเมลหาผู้ดูแลเมื่อ Workflow ล้มเหลว
