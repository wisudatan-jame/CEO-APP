// ===== Entry: push staff updates (wait / done / comment) to the CEO in LINE =====
const check = $input.first().json;
if (!check.process) return [{ json: { skipped: check.respond ? 'validation' : 'not-a-valid-notification' } }];
return [{ json: await notifyCeoOfStaffUpdates(makeContext(this)) }];
