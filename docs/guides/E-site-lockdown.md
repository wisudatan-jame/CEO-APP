# คู่มือ จ: ล็อกสิทธิ์ Site `CEO-Tickets`

ใช้เวลาประมาณ 20 นาที (ส่วนที่ 1 ผู้พัฒนาทำเอง · ส่วนที่ 2 ต้องใช้ SharePoint Admin หรือ Global Admin)

เป้าหมาย
- พนักงานกดลิงก์ใน Teams แล้วเปิดงานได้ แต่เห็น**เฉพาะงานของตัวเอง** (Flow `OnLineEvent` ตั้งสิทธิ์รายงานให้แล้ว)
- เพิ่มคนเข้า Site ได้เฉพาะ**ผู้ดูแล** = Site Owners: CEO, ผู้พัฒนา, คุณ Suchada
- แชร์ให้ทั้งบริษัท (Everyone / People in your organization) ได้เฉพาะผู้ดูแล และต้องตั้งใจทำผ่าน Advanced permissions เท่านั้น ห้ามเกิดจากการกดแชร์ลิงก์

> CEO ต้องเป็น Owner เพราะ Owner เห็นทุกงาน ถ้าเอาออก CEO จะดูงานในแอปไม่ได้ ส่วนผู้ที่เปลี่ยนสิทธิ์จริงคือผู้พัฒนาและคุณ Suchada
> Global Admin และ SharePoint Admin ของ Tenant เปลี่ยนสิทธิ์ได้เสมอ ข้อนี้ปิดไม่ได้

## ส่วนที่ 1: เจ้าของ Site ทำเอง
เปิด `https://digitalfocusth.sharepoint.com/sites/CEO-Tickets`

### 1.1 ให้แชร์ได้เฉพาะ Owner
1. ⚙️ (มุมขวาบน) → **Site permissions**
2. หัวข้อ **Site sharing** → **Change how members can share**
3. **Sharing permissions:** เลือก **Only site owners can share files, folders, and the site**
4. **Access requests:** ปิด **Allow access requests** (พนักงานที่เปิดงานคนอื่นจะเห็น Access denied โดยไม่มีปุ่มขอสิทธิ์ ป้องกัน Owner กดอนุมัติโดยไม่ตั้งใจ)
5. **Save**

### 1.2 ตรวจกลุ่มและรายชื่อ
⚙️ → Site permissions → **Advanced permissions settings**
- [ ] **CEO-Tickets Owners:** มีแค่ CEO, ผู้พัฒนา, คุณ Suchada
- [ ] **CEO-Tickets Members** และ **CEO-Tickets Visitors:** ว่าง
- [ ] ไม่มีแถว `Everyone`, `Everyone except external users`, `All Users` หรือชื่อพนักงานรายคน
- [ ] ไม่มีข้อความ "Some items of this site may have different permissions" ที่ชี้ไปยัง List `Config` หรือ `Employees` (ถ้ามี ให้กดดูว่าใครได้สิทธิ์ แล้วลบออก)

### 1.3 ห้ามสมาชิกแก้รายชื่อกลุ่มเอง
ในหน้า Advanced permissions คลิกชื่อกลุ่มทีละกลุ่ม (Owners, Members, Visitors) → **Settings** → **Group Settings**
- **Who can edit the membership of the group?** = **Group Owner**
- **Allow requests to join/leave this group?** = **No**
- กลุ่ม Members และ Visitors: ช่อง **Group owner** ต้องเป็น `CEO-Tickets Owners`

## ส่วนที่ 2: SharePoint Admin / Global Admin ทำ
### 2.1 ตั้งค่าการแชร์ของ Site
1. **https://admin.microsoft.com** → **Show all** → **SharePoint** (SharePoint admin center)
2. **Sites** → **Active sites** → คลิก `CEO-Tickets` → แท็บ **Settings**
3. **External file sharing:** **Only people in your organization**
4. **Default sharing link type:** ยกเลิก "Same as organization-level setting" → เลือก **Specific people**
5. **Default link permission:** **View**
6. **Save**

### 2.2 ปิดลิงก์ "ทุกคนในบริษัท" ของ Site นี้ (แนะนำ)
ลิงก์แบบ People in your organization ใครได้ลิงก์ก็เปิดได้ทั้งบริษัท จึงปิดทิ้งสำหรับ Site นี้ (Site อื่นไม่กระทบ)
1. ติดตั้ง SharePoint Online Management Shell ใน **Windows PowerShell 5.1** (ไม่ใช่ PowerShell 7) แบบ Run as administrator
   ```powershell
   Install-Module -Name Microsoft.Online.SharePoint.PowerShell -Scope CurrentUser
   ```
2. รัน (ล็อกอินด้วยบัญชี Admin)
   ```powershell
   Connect-SPOService -Url https://digitalfocusth-admin.sharepoint.com
   Set-SPOSite -Identity https://digitalfocusth.sharepoint.com/sites/CEO-Tickets -DisableCompanyWideSharingLinks Disabled
   Get-SPOSite -Identity https://digitalfocusth.sharepoint.com/sites/CEO-Tickets | Select SharingCapability, DisableCompanyWideSharingLinks, DefaultSharingLinkType
   ```
   ผลที่ต้องได้: `SharingCapability = Disabled` · `DisableCompanyWideSharingLinks = Disabled` · `DefaultSharingLinkType = Direct`

**ไม่ต้อง**ซ่อนกลุ่ม Everyone ระดับ Tenant (`Set-SPOTenant -ShowEveryoneClaim`) เพราะกระทบทุก Site ของบริษัท ข้อ 1.1 ทำให้คนที่ไม่ใช่ Owner แชร์ไม่ได้อยู่แล้ว

## ทดสอบ
| # | ทำ | ผลที่ต้องได้ |
|---|---|---|
| L1 | พนักงาน A กดลิงก์งานของตัวเองใน Teams | เห็นงาน (อ่านอย่างเดียว) |
| L2 | A แก้เลข `ID=` ในลิงก์เป็นงานของ B | Access denied และไม่มีปุ่มขอสิทธิ์ |
| L3 | A เปิดหน้าแรกของ Site | Access denied |
| L4 | A เปิด `.../Lists/Tickets/AllItems.aspx` | เห็นเฉพาะงานของตัวเอง ไม่มีปุ่ม Share |
| L5 | A เปิด `.../Lists/Config/AllItems.aspx` | Access denied |
| L6 | Owner กด Share ที่งานใดก็ได้ | ไม่มีตัวเลือก "People in Digital Focus" มีแค่ "Specific people" |

## ดูแลต่อเนื่อง
ทุกเดือนทำข้อ 1.2 ซ้ำ (อยู่ในตาราง [../05-handover.md](../05-handover.md))
