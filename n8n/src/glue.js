// ===== n8n glue: secrets and context for the Code node =====
function getSetting(name) {
  let value;
  try {
    if (typeof $vars !== 'undefined' && $vars) value = $vars[name];
  } catch (e) {
    // Variables not available on this n8n plan
  }
  if (!value) {
    try {
      if (typeof $env !== 'undefined' && $env) value = $env[name];
    } catch (e) {
      // env access blocked
    }
  }
  if (!value) throw new Error(`ไม่พบค่าตั้ง ${name} (ตั้งใน n8n Variables หรือ environment variable)`);
  return value;
}

function makeContext(self) {
  return {
    http: (opts) => self.helpers.httpRequest(opts),
    setting: getSetting,
    store: $getWorkflowStaticData('global'),
    now: () => new Date(),
  };
}
