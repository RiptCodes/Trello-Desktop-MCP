// Live test of the fork's three new tools against the REAL Trello API.
//
//   npm run build
//   node scripts/live-test.mjs
//
// Needs TRELLO_API_KEY and TRELLO_TOKEN in the environment (it never prints them).
// It makes a throwaway board, runs each tool, reads the card back to prove the
// changes landed, then deletes the board, even if a step fails.

import { writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  handleTrelloAddAttachment,
  handleTrelloCreateChecklist,
  handleTrelloAddChecklistItem
} from '../dist/tools/attachments-checklists.js';

const apiKey = process.env.TRELLO_API_KEY;
const token = process.env.TRELLO_TOKEN;
if (!apiKey || !token) {
  console.error('Set TRELLO_API_KEY and TRELLO_TOKEN first.');
  process.exit(1);
}
const creds = { apiKey, token };

/** Call Trello directly (only for setup, read-back and clean-up). */
async function trello(method, path, params = {}) {
  const url = new URL(`https://api.trello.com/1${path}`);
  for (const [k, v] of Object.entries({ ...params, key: apiKey, token })) url.searchParams.set(k, v);
  const res = await fetch(url, { method });
  if (!res.ok) throw new Error(`${method} ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

/** Run a tool handler and stop if it reported an error. */
async function run(label, promise) {
  const out = await promise;
  if (out.isError) throw new Error(`${label}: ${out.content[0].text}`);
  console.log(`ok  ${label}`);
  return JSON.parse(out.content[0].text);
}

function check(label, condition) {
  if (!condition) throw new Error(`check failed: ${label}`);
  console.log(`ok  ${label}`);
}

// A real 1x1 PNG, so Trello treats the upload as an image.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);

const dir = await mkdtemp(join(tmpdir(), 'trello-live-'));
const board = await trello('POST', '/boards', { name: 'MCP live test (safe to delete)', defaultLists: 'true' });
console.log(`made throwaway board ${board.id}`);

let failed = false;
try {
  const [list] = await trello('GET', `/boards/${board.id}/lists`);
  const card = await trello('POST', '/cards', { idList: list.id, name: 'Throwaway card' });

  // 1. Upload a file and make it the cover, then attach a link.
  const png = join(dir, 'desktop-1440.png');
  await writeFile(png, PNG);
  await run('upload a PNG as the cover', handleTrelloAddAttachment({ ...creds, cardId: card.id, filePath: png, setCover: true }));
  await run('attach a URL', handleTrelloAddAttachment({ ...creds, cardId: card.id, url: 'https://luciusweb.com', name: 'Lucius' }));

  // 2. A checklist with two items, then 3. one more item.
  const made = await run('create a checklist with 2 items', handleTrelloCreateChecklist({ ...creds, cardId: card.id, name: 'Next steps', items: ['First', 'Second'] }));
  await run('add a third item, ticked', handleTrelloAddChecklistItem({ ...creds, checklistId: made.checklist.id, name: 'Third', checked: true }));

  // Read the card back from Trello and check everything is really there.
  const back = await trello('GET', `/cards/${card.id}`, { attachments: 'true', checklists: 'all', fields: 'name,idAttachmentCover' });
  check('card has 2 attachments', back.attachments.length === 2);
  check('the PNG is a real upload', back.attachments.some((a) => a.isUpload && a.name === 'desktop-1440.png'));
  check('the PNG is the cover', back.attachments.some((a) => a.id === back.idAttachmentCover && a.isUpload));
  check('checklist items are First, Second, Third', back.checklists[0].checkItems.map((i) => i.name).join() === 'First,Second,Third');
  check('Third is ticked', back.checklists[0].checkItems.find((i) => i.name === 'Third').state === 'complete');
  // Note: a card's email address comes back null from the API (Trello only makes
  // it when someone opens "Email to this card" in the website), so we don't use it.
} catch (error) {
  failed = true;
  console.error(`FAIL ${error.message}`);
} finally {
  await trello('DELETE', `/boards/${board.id}`);
  await rm(dir, { recursive: true, force: true });
  console.log('deleted the throwaway board');
}
process.exit(failed ? 1 : 0);
