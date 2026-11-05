// Unit tests for the three tools added in the RiptCodes fork.
// `fetch` is replaced with a fake, so these never call the real Trello API.
// Each test checks two things: what we SENT to Trello, and what the tool RETURNED.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  handleTrelloAddAttachment,
  handleTrelloCreateChecklist,
  handleTrelloAddChecklistItem
} from '../src/tools/attachments-checklists.js';

const CARD = 'a'.repeat(24);
const CHECKLIST = 'b'.repeat(24);
const creds = { apiKey: 'test-key', token: 'test-token' };

// The fake fetch answers each call with the next body in `replies`.
let replies: unknown[];
const fetchMock = vi.fn(async () => {
  const body = replies.shift() ?? {};
  return new Response(JSON.stringify(body), { status: 200 });
});

/** The URL and options of the Nth fetch call. */
function call(n: number): { url: URL; init: RequestInit } {
  const [url, init] = fetchMock.mock.calls[n] as unknown as [string, RequestInit];
  return { url: new URL(url), init };
}

/** The JSON a tool returned (tools return their result as text). */
function resultOf(response: { content: { text: string }[] }) {
  return JSON.parse(response.content[0]!.text);
}

let tempDir: string;

beforeEach(async () => {
  replies = [];
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
  tempDir = await mkdtemp(join(tmpdir(), 'trello-test-'));
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await rm(tempDir, { recursive: true, force: true });
});

describe('trello_add_attachment', () => {
  it('uploads a local file as multipart form data', async () => {
    const file = join(tempDir, 'desktop.png');
    await writeFile(file, Buffer.from([137, 80, 78, 71])); // the first bytes of a PNG
    replies = [{ id: 'att1', name: 'Desktop 1440', isUpload: true, bytes: 4 }];

    const response = await handleTrelloAddAttachment({ ...creds, cardId: CARD, filePath: file, name: 'Desktop 1440', setCover: true });

    expect(response.isError).toBeUndefined();
    const { url, init } = call(0);
    expect(init.method).toBe('POST');
    expect(url.pathname).toBe(`/1/cards/${CARD}/attachments`);
    expect(url.searchParams.get('key')).toBe('test-key');

    // The body must be FormData holding the file, and there must be NO JSON
    // Content-Type header (fetch adds the multipart one itself).
    const form = init.body as FormData;
    expect(form).toBeInstanceOf(FormData);
    expect((form.get('file') as File).name).toBe('desktop.png');
    expect((form.get('file') as File).size).toBe(4);
    expect(form.get('name')).toBe('Desktop 1440');
    expect(form.get('setCover')).toBe('true');
    expect(new Headers(init.headers).get('content-type')).toBeNull();

    expect(resultOf(response).attachment.id).toBe('att1');
  });

  it('attaches a web link as JSON', async () => {
    replies = [{ id: 'att2', name: 'Mockup', url: 'https://example.framer.app' }];

    await handleTrelloAddAttachment({ ...creds, cardId: CARD, url: 'https://example.framer.app', name: 'Mockup' });

    const { init } = call(0);
    expect(JSON.parse(init.body as string)).toEqual({ url: 'https://example.framer.app', name: 'Mockup' });
  });

  it('refuses when both or neither of filePath and url are given', async () => {
    const both = await handleTrelloAddAttachment({ ...creds, cardId: CARD, filePath: 'x.png', url: 'https://a.b' });
    const neither = await handleTrelloAddAttachment({ ...creds, cardId: CARD });

    expect(both.isError).toBe(true);
    expect(neither.isError).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('gives a clear error for a missing file, without calling Trello', async () => {
    const response = await handleTrelloAddAttachment({ ...creds, cardId: CARD, filePath: join(tempDir, 'nope.png') });

    expect(response.isError).toBe(true);
    expect(response.content[0]!.text).toContain('File not found');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('trello_create_checklist', () => {
  it('creates the checklist, then adds the items in order at the bottom', async () => {
    replies = [
      { id: CHECKLIST, name: 'Next steps', idCard: CARD },
      { id: 'i1', name: 'Send first email' },
      { id: 'i2', name: 'Follow up in 5 days' }
    ];

    const response = await handleTrelloCreateChecklist({ ...creds, cardId: CARD, name: 'Next steps', items: ['Send first email', 'Follow up in 5 days'] });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(call(0).url.pathname).toBe(`/1/cards/${CARD}/checklists`);
    expect(JSON.parse(call(0).init.body as string)).toEqual({ name: 'Next steps' });
    expect(call(1).url.pathname).toBe(`/1/checklists/${CHECKLIST}/checkItems`);
    expect(JSON.parse(call(1).init.body as string)).toEqual({ name: 'Send first email', pos: 'bottom' });
    expect(JSON.parse(call(2).init.body as string).name).toBe('Follow up in 5 days');

    const result = resultOf(response);
    expect(result.checklist.id).toBe(CHECKLIST);
    expect(result.items.map((i: { name: string }) => i.name)).toEqual(['Send first email', 'Follow up in 5 days']);
  });

  it('works with no items', async () => {
    replies = [{ id: CHECKLIST, name: 'Empty', idCard: CARD }];

    await handleTrelloCreateChecklist({ ...creds, cardId: CARD, name: 'Empty' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('trello_add_checklist_item', () => {
  it('adds one item, sending only the options that were given', async () => {
    replies = [{ id: 'i3', name: 'Book a call', state: 'complete', idChecklist: CHECKLIST }];

    const response = await handleTrelloAddChecklistItem({ ...creds, checklistId: CHECKLIST, name: 'Book a call', checked: true });

    const { url, init } = call(0);
    expect(url.pathname).toBe(`/1/checklists/${CHECKLIST}/checkItems`);
    expect(JSON.parse(init.body as string)).toEqual({ name: 'Book a call', checked: true });
    expect(resultOf(response).item.state).toBe('complete');
  });

  it('rejects a bad checklist ID without calling Trello', async () => {
    const response = await handleTrelloAddChecklistItem({ ...creds, checklistId: 'not-an-id', name: 'x' });

    expect(response.isError).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
