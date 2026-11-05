// ===== Entry: LINE webhook =====
const item = $input.first();
let raw = null;
try {
  raw = await this.helpers.getBinaryDataBuffer(0, 'data');
} catch (e) {
  if (item.binary && item.binary.data && item.binary.data.data) raw = Buffer.from(item.binary.data.data, 'base64');
}
const headers = (item.json && item.json.headers) || {};
const result = await handleWebhook(makeContext(this), raw, headers);
return [{ json: result }];
