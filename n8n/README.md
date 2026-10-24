# บอท LINE "DF สั่งงาน" (n8n)

ไฟล์ [`ceo-line-bot.json`](ceo-line-bot.json) คือ Workflow สำหรับ Import เข้า n8n ประกอบด้วย 3 ส่วน
| Trigger | ทำอะไร |
|---|---|
| **LINE Webhook** (`POST /webhook/ceo-line-bot`) | รับข้อความจาก CEO → ถามผู้รับผิดชอบ → ถามวันส่ง → สร้าง Ticket ใน SharePoint, คำสั่ง "สรุป", ปิดงาน/ส่งกลับจาก LINE |
| **Weekdays 07:00** | สรุปเช้าส่งเข้า LINE ของ CEO (ข้ามวันหยุดใน List `Holidays`) |
| **Friday 17:00** | สรุปรายคนประจำสัปดาห์ |
| **SharePoint Webhook** (`POST /webhook/ceo-sp-hook`) | SharePoint เรียกเมื่อ `TicketHistory` เปลี่ยน → ส่งเรื่องที่พนักงานถาม/ทำเสร็จ/เขียนความเห็นเข้า LINE ของ CEO |

การออกแบบบทสนทนาและความปลอดภัยอยู่ที่ [../docs/06-line-bot.md](../docs/06-line-bot.md)

> ⚠️ ทดสอบด้วย Mock ของ LINE และ SharePoint แล้ว (`node --test n8n/test/*.test.js`) แต่**ยังไม่เคยรันกับ n8n, LINE และ SharePoint จริง** ทดสอบตามขั้นตอนด้านล่างก่อนให้ CEO ใช้

## สิ่งที่ต้องมีก่อน
1. Site `CEO-Tickets` พร้อม List `Tickets`, `TicketHistory`, `Employees`, `Config`, `Holidays` และ Library `TicketFiles` ตาม [../docs/01-data-model.md](../docs/01-data-model.md) (ชื่อ List และชื่อคอลัมน์ภายในต้องตรงทุกตัวอักษร)
2. App Registration `DGF-CEO-Bot-n8n` ที่ Global Admin ตั้งให้ ([../docs/06-line-bot.md](../docs/06-line-bot.md))
3. LINE Official Account ใหม่ เปิด Messaging API แล้ว
4. Flow `OnLineEvent` ใน Power Automate ([../docs/03-flows.md](../docs/03-flows.md)) มิฉะนั้นงานจาก LINE จะไม่ถูกตั้งสิทธิ์และพนักงานจะไม่ได้แจ้งเตือน

## ค่าตั้ง (Secrets)
Workflow อ่านค่าเหล่านี้จาก **n8n Variables** (`$vars`) ก่อน ถ้าไม่มีจะอ่านจาก environment variable (`$env`)

| ชื่อ | ค่า |
|---|---|
| `LINE_CHANNEL_SECRET` | LINE Developers → Channel → Basic settings → Channel secret |
| `LINE_CHANNEL_ACCESS_TOKEN` | Messaging API → Channel access token (long-lived) |
| `MS_TENANT_ID` | Tenant ID จาก Global Admin |
| `MS_CLIENT_ID` | Application (client) ID ของ `DGF-CEO-Bot-n8n` |
| `MS_CLIENT_SECRET` | Client secret (Global Admin กรอกเอง ห้ามส่งทางแชต) |
| `SP_HOSTNAME` | `digitalfocusth.sharepoint.com` |
| `SP_SITE_PATH` | `/sites/CEO-Tickets` |
| `SP_WEBHOOK_CLIENT_STATE` | ข้อความสุ่มยาว 32 ตัวอักษรขึ้นไปที่คุณตั้งเอง ใช้ยืนยันว่าการเรียกมาจาก SharePoint จริง (ใช้ค่าเดียวกันตอนรัน `setup/create-webhook.js`) |

- **บนโน้ตบุ๊ก (Docker):** ใส่ในไฟล์ `.env` ของ n8n แล้วตั้ง `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` เพื่อให้ Code node อ่าน `$env` ได้ ห้าม Commit ไฟล์ `.env`
- **n8n Cloud:** ใช้เมนู **Variables** ⚠️ ตรวจว่าแพ็กเกจที่ซื้อมีฟีเจอร์ Variables ถ้าไม่มี ต้องหาวิธีอื่นก่อนย้ายขึ้น Cloud (ห้ามพิมพ์ค่าลับลงในโค้ดของ Workflow เพราะจะติดไปกับไฟล์ Export)
- ค่าของ Variables มองเห็นได้โดยทุกคนที่มีสิทธิ์ใน n8n instance นั้น ให้จำกัดผู้ใช้ n8n ไว้ที่ผู้พัฒนาและคุณ Suchada

## ติดตั้งบนโน้ตบุ๊ก Windows (ช่วงพัฒนาและทดลอง)
ใช้ npm (เบากว่า Docker) เพราะใช้งานจริงจะย้ายไป n8n Cloud · ใช้เวลาประมาณ 30 นาที
> ⚠️ ขั้นตอนนี้เขียนตามวิธีติดตั้ง n8n ที่ทราบ แต่ยังไม่เคยทดสอบบนเครื่องของบริษัท ถ้าคำสั่งใดขึ้น Error ให้ส่งข้อความมาดู

### ทางลัด: สคริปต์ติดตั้งอัตโนมัติ
วางไฟล์ทั้งหมดใน [`local/`](local/) ไว้ในโฟลเดอร์เดียวกัน (เช่น `C:\n8n-ceo`) แล้วเปิด PowerShell ในโฟลเดอร์นั้น
1. ครั้งเดียว: `powershell -ExecutionPolicy Bypass -File .\install-n8n.ps1` → ติดตั้ง Node.js, n8n, cloudflared, สร้าง `.env` (สุ่ม `SP_WEBHOOK_CLIENT_STATE` ให้) และตั้งเครื่องไม่ให้ Sleep เมื่อเสียบสายชาร์จ แล้วเปิด Notepad ให้กรอกค่า LINE / Microsoft
2. ทุกครั้งที่ใช้งาน: `powershell -ExecutionPolicy Bypass -File .\start-all.ps1` → เปิด Tunnel เขียน URL ลง `.env` ให้เอง แล้วเปิด n8n และบอกว่า URL เปลี่ยนหรือไม่ (ถ้าเปลี่ยน ต้องแก้ Webhook ใน LINE และรัน `setup/create-webhook.js` ใหม่)

ขั้นตอนด้านล่าง (ก–ข) คือสิ่งที่สคริปต์ทำ ใช้เมื่อสคริปต์ขึ้น Error และต้องทำเอง

### ก. เตรียมเครื่อง (ครั้งเดียว)
1. ตั้งเครื่อง**ไม่ให้ Sleep เมื่อเสียบสายชาร์จ** (Settings → System → Power) และเปิด **BitLocker**
2. ติดตั้ง **Node.js รุ่น LTS** จาก https://nodejs.org (ตัวติดตั้ง .msi) → เปิด PowerShell ใหม่ → `node -v` ต้องแสดงเลขเวอร์ชัน ⚠️ ใช้รุ่นที่ n8n รองรับ ตรวจที่ https://docs.n8n.io ถ้าติดตั้งแล้ว n8n ฟ้องเรื่องเวอร์ชัน
3. ติดตั้ง n8n: `npm install -g n8n` (ใช้เวลาหลายนาที)
   - ถ้า PowerShell ขึ้นว่า "running scripts is disabled": `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` แล้วลองใหม่
4. ติดตั้ง Cloudflare Tunnel: `winget install --id Cloudflare.cloudflared` → เปิด PowerShell ใหม่ → `cloudflared --version`

### ข. ทุกครั้งที่เริ่มใช้งาน
1. **หน้าต่าง PowerShell ที่ 1 (Tunnel):** `cloudflared tunnel --url http://localhost:5678` → จด URL `https://....trycloudflare.com` แล้ว**เปิดทิ้งไว้**
   - URL นี้**เปลี่ยนทุกครั้ง**ที่เปิดใหม่ ต้องแก้ `WEBHOOK_URL` ใน `.env`, Webhook URL ใน LINE และรัน `setup/create-webhook.js` ใหม่ (ถ้าต้องการ URL คงที่ ใช้ Named Tunnel ซึ่งต้องมีโดเมนใน Cloudflare)
2. ครั้งแรก: คัดลอก [`local/.env.example`](local/.env.example) เป็น `local/.env` แล้วกรอกค่า (ดูตาราง "ค่าตั้ง" ด้านบน) **ห้าม Commit ไฟล์ `.env`** (อยู่ใน `.gitignore` แล้ว)
3. **หน้าต่าง PowerShell ที่ 2 (n8n):** ไปที่โฟลเดอร์ `n8n/local` แล้วรัน
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\start-n8n.ps1
   ```
   สคริปต์โหลดค่าจาก `.env` ตั้ง `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` (ให้บอทอ่านค่าลับได้) และ Timezone เป็นเวลาไทย แล้วแสดง URL ของ Webhook ทั้งสองตัว
4. เปิด http://localhost:5678 → ครั้งแรกสร้างบัญชีเจ้าของ n8n (เก็บในเครื่องนี้)

### ค. นำบอทเข้า n8n (ครั้งแรก)
1. **Workflows → Import from File** → `ceo-line-bot.json`
2. Settings ของ Workflow: Timezone `Asia/Bangkok` (ตั้งไว้ในไฟล์แล้ว)
3. **Publish** (n8n 2.x ใช้ปุ่ม Publish มุมขวาบนแทน Active และบันทึกอัตโนมัติ ไม่มีปุ่ม Save · งานร่างและการกันข้อความซ้ำทำงานเฉพาะหลัง Publish ไม่ใช่ตอนกด Execute workflow)
4. LINE Developers → Messaging API → Webhook URL = `<URL ของ Tunnel>/webhook/ceo-line-bot` → **Verify** → เปิด **Use webhook** (ดู [../docs/guides/D-line-oa.md](../docs/guides/D-line-oa.md))
5. ส่งข้อความหา OA แล้วดู n8n → **Executions**: มี Execution ใหม่ = ต่อกันแล้ว · ผล `bad-signature` = `LINE_CHANNEL_SECRET` ผิด · Error `403/accessDenied` = รอ Global Admin ให้สิทธิ์ SharePoint (ติดตั้งถูกแล้ว)

## SharePoint webhook (ให้ CEO ได้แจ้งเตือนเมื่อพนักงานอัปเดต)
ทำหลังจาก Workflow เปิดใช้งาน (Publish) แล้ว เพราะ SharePoint จะเรียก URL ยืนยันทันทีตอนสร้าง
1. เปิด Site `CEO-Tickets` ด้วยบัญชี Owner → F12 → Console
2. วางเนื้อหาไฟล์ [`../setup/create-webhook.js`](../setup/create-webhook.js) → Enter
3. ใส่ URL `<URL ของ n8n>/webhook/ceo-sp-hook` และค่า `SP_WEBHOOK_CLIENT_STATE`
4. ต้องเห็น `สร้าง webhook ... หมดอายุ ...` และ `เสร็จแล้ว` ถ้าเห็น Error ว่ายืนยัน URL ไม่ผ่าน ให้ตรวจว่า Workflow ถูก Publish แล้ว และ URL ถูกต้อง
5. **รันซ้ำทุก 5 เดือน** หรือเมื่อเปลี่ยน URL ของ n8n (เช่น ตอนย้ายจากโน้ตบุ๊กไป n8n Cloud) สคริปต์ลบของเดิมแล้วสร้างใหม่ให้

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
| 4 | (ก) ส่งข้อความ → รอ "สั่งใคร?" → ส่งรูป 2 รูป → สร้างงาน (ข) ส่งรูปก่อน → รอ "📎 รับรูปแล้ว" → ส่งข้อความ → สร้างงาน | ทั้งสองแบบ รูปอยู่ใน `TicketFiles/T-<ID>` และ `HasFiles = Yes` |
| 4a | ที่ "สั่งใคร?" พูด "สั่ง<ชื่อเล่น>" / "<ชื่อเล่น><แผนก>" / ชื่อที่ไม่มีในรายชื่อ | ไปถาม "ส่งเมื่อไร?" ทันที / เหมือนกัน / "ไม่พบชื่อ" พร้อมปุ่ม (บอทต้องไม่เงียบ) |
| 4b | ที่ "ส่งเมื่อไร?" พูด "ศุกร์นี้" | สร้างงาน วันส่งเป็นวันศุกร์ที่ถูกต้อง |
| 5 | ~~แตะปุ่ม "พรุ่งนี้" ของงานเดิมซ้ำ~~ | ทดสอบด้วยมือไม่ได้ เพราะ LINE ซ่อนปุ่ม Quick reply ทันทีที่แตะ ส่วนกันซ้ำมีไว้สำหรับกรณี LINE ส่ง Webhook ซ้ำ ซึ่งทดสอบไว้ใน `test/bot.test.js` แล้ว |
| 6 | ส่ง "สรุป" | ตัวเลขตรงกับ List `Tickets`: "เปิดอยู่" = จำนวนรายการ `IsOpen = Yes` · "สั่งสัปดาห์นี้" = รายการที่ `Created` ตั้งแต่วันจันทร์ (เพิ่มคอลัมน์ **Created** ในมุมมองก่อน: หัวคอลัมน์ใดก็ได้ → Column settings → Show/hide columns) |
| 7 | ตั้งงานหนึ่งเป็น `Done` แล้วกด [✅ รอปิด] → [✅ ปิด T-x] | งานเป็น `Closed` และพนักงานได้แจ้งเตือน (ทดสอบข้อ 11 ของต้นแบบไปด้วย) |
| 8 | กดคำสั่ง **Execute step** ที่ node `Daily summary` | CEO ได้สรุปใน LINE |
| 9 | ปิด n8n แล้วส่งข้อความ | ไม่มีคำตอบภายใน 10 วินาที (CEO ต้องรู้ว่าให้สั่งผ่าน Power Apps แทน) |
| 10 | พนักงานทดสอบกด "ถาม CEO" พร้อมคำถามในแอป | CEO ได้ข้อความ ⏳ ใน LINE ภายในไม่กี่วินาที แตะ [💬 ตอบ] → ส่งคำตอบ → งานกลับเป็น "กำลังทำ" และพนักงานได้ Teams |
| 11 | พนักงานกด "ทำเสร็จแล้ว" | CEO ได้ข้อความ ✅ พร้อมปุ่มปิดงาน/ส่งกลับ |

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
| `../setup/create-webhook.js` | สคริปต์สร้าง/ต่ออายุ SharePoint webhook (รันใน Console ของเบราว์เซอร์) |
| `build.js` | ประกอบไฟล์ Workflow |
| `test/bot.test.js` | ทดสอบด้วย Mock |

## ข้อจำกัดที่รู้อยู่
- n8n ต้องส่ง Raw body ให้ Code node (`options.rawBody` ของ Webhook node) เพื่อตรวจลายเซ็น ถ้า n8n เวอร์ชันที่ใช้ไม่ส่ง Raw body บอทจะปฏิเสธทุกข้อความ (`bad-signature`) ซึ่งปลอดภัยไว้ก่อน แต่ต้องแก้ ⚠️ ตรวจในการทดสอบข้อ 2
- ข้อความ (Execution data) ที่สำเร็จไม่ถูกเก็บใน n8n (`saveDataSuccessExecution: none`) เพื่อไม่ให้คำสั่งลับของ CEO ค้างอยู่ ถ้าต้องดูเพื่อแก้ปัญหา ให้เปิดชั่วคราวใน Settings ของ Workflow
- ตั้ง **Error Workflow** ใน n8n ให้ส่งอีเมลหาผู้ดูแลเมื่อ Workflow ล้มเหลว
