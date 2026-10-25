// ===== n8n glue: secrets and context for the Code node =====
// Where secrets are read from, first match wins:
//   1. n8n Variables ($vars)                  — n8n Cloud Pro and higher
//   2. the "Settings" node of this workflow   — n8n Cloud Starter (no Variables); the node is never run
//   3. environment variables ($env)           — self-hosted, e.g. the laptop set-up in n8n/local
const SETTINGS_NODE = 'Settings';

function settingFromNode(name) {
  try {
    if (typeof $ !== 'function') return undefined;
    const params = $(SETTINGS_NODE).params;
    const list = (params && params.assignments && params.assignments.assignments) || [];
    const hit = list.find((a) => a && a.name === name);
    return hit && hit.value ? String(hit.value).trim() : undefined;
  } catch (e) {
    return undefined; // no Settings node in this workflow
  }
}

function getSetting(name) {
  let value;
  try {
    if (typeof $vars !== 'undefined' && $vars) value = $vars[name];
  } catch (e) {
    // Variables not available on this n8n plan
  }
  if (!value) value = settingFromNode(name);
  if (!value) {
    try {
      if (typeof $env !== 'undefined' && $env) value = $env[name];
    } catch (e) {
      // env access blocked
    }
  }
  if (!value) throw new Error(`ไม่พบค่าตั้ง ${name} (ใส่ในโหนด Settings ของ Workflow, n8n Variables หรือ environment variable)`);
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
