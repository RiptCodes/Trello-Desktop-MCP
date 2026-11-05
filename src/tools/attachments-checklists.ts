// Tools added in the RiptCodes fork: upload attachments and build checklists.
//
// Each tool has two halves, like every other tool in this server:
//   1. a `Tool` object: the name, description and input schema Claude sees
//   2. a `handle...` function: checks the input with zod, calls Trello, and
//      returns the result as text (or an error marked `isError: true`)

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { stat } from 'node:fs/promises';
import { TrelloClient } from '../trello/client.js';
import { formatValidationError } from '../utils/validation.js';

// Trello's upload limit on free workspaces is 10 MB per file.
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

// ---------------------------------------------------------------------------
// Input checks (zod). Credentials are injected by index.ts from env vars.
// ---------------------------------------------------------------------------

const trelloId = z.string().regex(/^[a-f0-9]{24}$/i, 'Must be a valid 24-character Trello ID');
const credentials = {
  apiKey: z.string().min(1, 'API key is required'),
  token: z.string().min(1, 'Token is required')
};
const position = z.union([z.number().min(0), z.enum(['top', 'bottom'])]);

const addAttachmentSchema = z.object({
  ...credentials,
  cardId: trelloId,
  filePath: z.string().min(1).optional(),
  url: z.string().url().optional(),
  name: z.string().min(1).max(256).optional(),
  setCover: z.boolean().optional()
}).refine(
  (args) => Boolean(args.filePath) !== Boolean(args.url),
  { message: 'Give exactly one of filePath (a local file) or url (a web link)' }
);

const createChecklistSchema = z.object({
  ...credentials,
  cardId: trelloId,
  name: z.string().min(1).max(16384),
  pos: position.optional(),
  items: z.array(z.string().min(1).max(16384)).max(100).optional()
});

const addChecklistItemSchema = z.object({
  ...credentials,
  checklistId: trelloId,
  name: z.string().min(1).max(16384),
  checked: z.boolean().optional(),
  pos: position.optional()
});

// ---------------------------------------------------------------------------
// Small helpers shared by the three handlers
// ---------------------------------------------------------------------------

function ok(result: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
}

function fail(action: string, error: unknown) {
  const message = error instanceof z.ZodError
    ? formatValidationError(error)
    : error instanceof Error
      ? error.message
      : typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message: unknown }).message) // TrelloError objects
        : 'Unknown error occurred';
  return { content: [{ type: 'text' as const, text: `Error ${action}: ${message}` }], isError: true };
}

/** Copy only the keys that have a value, so optional fields stay out of requests. */
type Defined<T> = { [K in keyof T]?: Exclude<T[K], undefined> };
function defined<T extends Record<string, unknown>>(obj: T): Defined<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Defined<T>;
}

const credentialProps = {
  apiKey: { type: 'string', description: 'Trello API key (provided automatically from your config)' },
  token: { type: 'string', description: 'Trello API token (provided automatically from your config)' }
};
const positionProp = {
  oneOf: [{ type: 'number', minimum: 0 }, { type: 'string', enum: ['top', 'bottom'] }],
  description: 'Position: "top", "bottom", or a number'
};

// ---------------------------------------------------------------------------
// 1. trello_add_attachment
// ---------------------------------------------------------------------------

export const trelloAddAttachmentTool: Tool = {
  name: 'trello_add_attachment',
  description: 'Attach something to a Trello card: either upload a local file (such as a PNG screenshot) with filePath, or attach a web link with url. Set setCover to true to show an image as the card cover.',
  inputSchema: {
    type: 'object',
    properties: {
      ...credentialProps,
      cardId: { type: 'string', description: 'ID of the card', pattern: '^[a-f0-9]{24}$' },
      filePath: { type: 'string', description: 'Absolute path of a local file to upload (max 10 MB). Use this OR url.' },
      url: { type: 'string', description: 'A web link to attach. Use this OR filePath.' },
      name: { type: 'string', description: 'Optional name shown on the card (defaults to the file name or URL)' },
      setCover: { type: 'boolean', description: 'Make this image the card cover' }
    },
    required: ['apiKey', 'token', 'cardId']
  }
};

export async function handleTrelloAddAttachment(args: unknown) {
  try {
    const { apiKey, token, cardId, filePath, url, name, setCover } = addAttachmentSchema.parse(args);
    const client = new TrelloClient({ apiKey, token });
    const options = defined({ name, setCover });

    let response;
    if (filePath) {
      // Check the file before uploading, so the error is clear.
      const info = await stat(filePath).catch(() => null);
      if (!info || !info.isFile()) throw new Error(`File not found: ${filePath}`);
      if (info.size > MAX_UPLOAD_BYTES) throw new Error(`File is ${info.size} bytes; Trello's limit is 10 MB`);
      response = await client.uploadAttachment(cardId, filePath, options);
    } else {
      response = await client.attachUrl(cardId, url as string, options);
    }

    const a = response.data;
    return ok({
      summary: `Attached "${a.name}" to card ${cardId}`,
      attachment: { id: a.id, name: a.name, url: a.url, mimeType: a.mimeType, bytes: a.bytes, isUpload: a.isUpload },
      rateLimit: response.rateLimit
    });
  } catch (error) {
    return fail('adding attachment', error);
  }
}

// ---------------------------------------------------------------------------
// 2. trello_create_checklist (optionally with its items in one call)
// ---------------------------------------------------------------------------

export const trelloCreateChecklistTool: Tool = {
  name: 'trello_create_checklist',
  description: 'Create a checklist on a Trello card. Optionally pass items (a list of strings) to add them in the same call, in order.',
  inputSchema: {
    type: 'object',
    properties: {
      ...credentialProps,
      cardId: { type: 'string', description: 'ID of the card', pattern: '^[a-f0-9]{24}$' },
      name: { type: 'string', description: 'Checklist title, e.g. "Next steps"' },
      pos: positionProp,
      items: { type: 'array', items: { type: 'string' }, description: 'Optional items to add, in order' }
    },
    required: ['apiKey', 'token', 'cardId', 'name']
  }
};

export async function handleTrelloCreateChecklist(args: unknown) {
  try {
    const { apiKey, token, cardId, name, pos, items = [] } = createChecklistSchema.parse(args);
    const client = new TrelloClient({ apiKey, token });

    const checklist = (await client.createChecklist(cardId, name, pos)).data;

    // Add items one at a time with pos "bottom", so they keep the given order.
    const added = [];
    for (const item of items) {
      const response = await client.addChecklistItem(checklist.id, item, { pos: 'bottom' });
      added.push({ id: response.data.id, name: response.data.name });
    }

    return ok({
      summary: `Created checklist "${checklist.name}" on card ${cardId} with ${added.length} item(s)`,
      checklist: { id: checklist.id, name: checklist.name, idCard: checklist.idCard },
      items: added
    });
  } catch (error) {
    return fail('creating checklist', error);
  }
}

// ---------------------------------------------------------------------------
// 3. trello_add_checklist_item
// ---------------------------------------------------------------------------

export const trelloAddChecklistItemTool: Tool = {
  name: 'trello_add_checklist_item',
  description: 'Add one item to an existing Trello checklist (get checklist IDs from trello_get_card_checklists or trello_create_checklist).',
  inputSchema: {
    type: 'object',
    properties: {
      ...credentialProps,
      checklistId: { type: 'string', description: 'ID of the checklist', pattern: '^[a-f0-9]{24}$' },
      name: { type: 'string', description: 'Text of the item' },
      checked: { type: 'boolean', description: 'Tick it straight away (default false)' },
      pos: positionProp
    },
    required: ['apiKey', 'token', 'checklistId', 'name']
  }
};

export async function handleTrelloAddChecklistItem(args: unknown) {
  try {
    const { apiKey, token, checklistId, name, checked, pos } = addChecklistItemSchema.parse(args);
    const client = new TrelloClient({ apiKey, token });

    const response = await client.addChecklistItem(checklistId, name, defined({ checked, pos }));
    const item = response.data;

    return ok({
      summary: `Added "${item.name}" to checklist ${checklistId}`,
      item: { id: item.id, name: item.name, state: item.state, idChecklist: item.idChecklist },
      rateLimit: response.rateLimit
    });
  } catch (error) {
    return fail('adding checklist item', error);
  }
}
