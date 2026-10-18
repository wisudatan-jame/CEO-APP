// Builds ceo-line-bot.json (importable n8n workflow) from src/*.js
// Usage: node n8n/build.js
const fs = require('fs');
const path = require('path');

const src = (f) => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8');
const shared = `${src('glue.js')}\n${src('lib.js')}`;
const code = (entry) => `${shared}\n${src(entry)}`;

// Fixed IDs keep re-imports and diffs stable.
const nodes = [
  {
    parameters: { httpMethod: 'POST', path: 'ceo-line-bot', responseMode: 'onReceived', options: { rawBody: true } },
    id: '5b0f2a1e-0c1d-4e57-9a2b-1f0e6c3d9a01',
    name: 'LINE Webhook',
    type: 'n8n-nodes-base.webhook',
    typeVersion: 2,
    position: [0, 0],
    webhookId: 'b7c4e0d2-6f4a-4f1e-8d3c-2a9e5b7f1c02',
  },
  {
    parameters: { jsCode: code('entry-webhook.js') },
    id: '5b0f2a1e-0c1d-4e57-9a2b-1f0e6c3d9a03',
    name: 'Handle LINE events',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [260, 0],
  },
  {
    parameters: { rule: { interval: [{ field: 'cronExpression', expression: '0 7 * * 1-5' }] } },
    id: '5b0f2a1e-0c1d-4e57-9a2b-1f0e6c3d9a04',
    name: 'Weekdays 07:00',
    type: 'n8n-nodes-base.scheduleTrigger',
    typeVersion: 1.2,
    position: [0, 220],
  },
  {
    parameters: { jsCode: code('entry-daily.js') },
    id: '5b0f2a1e-0c1d-4e57-9a2b-1f0e6c3d9a05',
    name: 'Daily summary',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [260, 220],
  },
  {
    parameters: { rule: { interval: [{ field: 'cronExpression', expression: '0 17 * * 5' }] } },
    id: '5b0f2a1e-0c1d-4e57-9a2b-1f0e6c3d9a06',
    name: 'Friday 17:00',
    type: 'n8n-nodes-base.scheduleTrigger',
    typeVersion: 1.2,
    position: [0, 440],
  },
  {
    parameters: { jsCode: code('entry-weekly.js') },
    id: '5b0f2a1e-0c1d-4e57-9a2b-1f0e6c3d9a07',
    name: 'Weekly summary',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [260, 440],
  },
  {
    parameters: { httpMethod: 'POST', path: 'ceo-sp-hook', responseMode: 'responseNode', options: {} },
    id: '5b0f2a1e-0c1d-4e57-9a2b-1f0e6c3d9a08',
    name: 'SharePoint Webhook',
    type: 'n8n-nodes-base.webhook',
    typeVersion: 2,
    position: [0, 660],
    webhookId: 'b7c4e0d2-6f4a-4f1e-8d3c-2a9e5b7f1c09',
  },
  {
    parameters: { jsCode: code('entry-sharepoint.js') },
    id: '5b0f2a1e-0c1d-4e57-9a2b-1f0e6c3d9a10',
    name: 'Check SharePoint call',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [260, 660],
  },
  {
    // SharePoint needs the validation token echoed as text within 5 seconds, and 200 for notifications.
    parameters: { respondWith: 'text', responseBody: '={{ $json.respond }}', options: { responseCode: 200 } },
    id: '5b0f2a1e-0c1d-4e57-9a2b-1f0e6c3d9a11',
    name: 'Respond to SharePoint',
    type: 'n8n-nodes-base.respondToWebhook',
    typeVersion: 1.1,
    position: [520, 660],
  },
  {
    parameters: { jsCode: code('entry-notify.js') },
    id: '5b0f2a1e-0c1d-4e57-9a2b-1f0e6c3d9a12',
    name: 'Notify CEO of staff updates',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [780, 660],
  },
];

const link = (to) => ({ main: [[{ node: to, type: 'main', index: 0 }]] });
const workflow = {
  name: 'CEO LINE Bot',
  nodes,
  connections: {
    'LINE Webhook': link('Handle LINE events'),
    'Weekdays 07:00': link('Daily summary'),
    'Friday 17:00': link('Weekly summary'),
    'SharePoint Webhook': link('Check SharePoint call'),
    'Check SharePoint call': link('Respond to SharePoint'),
    'Respond to SharePoint': link('Notify CEO of staff updates'),
  },
  settings: { executionOrder: 'v1', timezone: 'Asia/Bangkok', saveDataErrorExecution: 'all', saveDataSuccessExecution: 'none' },
  pinData: {},
  active: false,
};

const out = path.join(__dirname, 'ceo-line-bot.json');
fs.writeFileSync(out, JSON.stringify(workflow, null, 2) + '\n');
console.log(`wrote ${path.relative(process.cwd(), out)}`);
