// ===== Entry: SharePoint webhook on TicketHistory (validation + staff updates -> CEO) =====
const item = $input.first().json;
const ctx = makeContext(this);
const check = checkSharePointCall(ctx, item.query || {}, item.body || {});
return [{ json: check }];
