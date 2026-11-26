import { ChatMessage, ConversationThread } from '../types/chat';

function escapeXml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function triggerTextDownload(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function slugifyFilename(raw: string, fallback = 'folio-export'): string {
  const clean = (raw || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  return clean || fallback;
}

export function messageToXml(m: ChatMessage): string {
  const body = m.censored ? '[Censored]' : m.text || m.error || '';
  const attrs = [
    `id="${escapeXml(m.id)}"`,
    `role="${escapeXml(m.role)}"`,
    `createdAt="${new Date(m.createdAt).toISOString()}"`,
    m.modelId ? `model="${escapeXml(m.modelId)}"` : '',
    typeof m.durationMs === 'number' ? `durationMs="${m.durationMs}"` : '',
    m.pinned ? `pinned="true"` : '',
  ]
    .filter(Boolean)
    .join(' ');

  const lines = [`  <message ${attrs}>`];
  if (m.thoughts) {
    lines.push(`    <thoughts>${escapeXml(m.thoughts)}</thoughts>`);
  }
  lines.push(`    <body>${escapeXml(body)}</body>`);
  if (m.attachments && m.attachments.length > 0) {
    lines.push('    <attachments>');
    for (const att of m.attachments) {
      lines.push(
        `      <attachment name="${escapeXml(att.name)}" mimeType="${escapeXml(att.mimeType)}" size="${att.size}" />`
      );
    }
    lines.push('    </attachments>');
  }
  lines.push('  </message>');
  return lines.join('\n');
}

export function exportMessageAsJson(m: ChatMessage) {
  const payload = {
    schema: 'folio.message/v1',
    exportedAt: new Date().toISOString(),
    message: {
      id: m.id,
      role: m.role,
      modelId: m.modelId,
      createdAt: new Date(m.createdAt).toISOString(),
      durationMs: m.durationMs,
      pinned: Boolean(m.pinned),
      text: m.censored ? '[Censored]' : m.text,
      thoughts: m.thoughts,
      attachments: m.attachments?.map((a) => ({
        name: a.name,
        mimeType: a.mimeType,
        size: a.size,
      })),
    },
  };
  triggerTextDownload(
    JSON.stringify(payload, null, 2),
    `folio-message-${m.id.slice(0, 8)}.json`,
    'application/json;charset=utf-8'
  );
}

export function exportMessageAsXml(m: ChatMessage) {
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<folioExport schema="folio.message/v1" version="4.1-zero">',
    messageToXml(m),
    '</folioExport>',
  ].join('\n');
  triggerTextDownload(
    xml,
    `folio-message-${m.id.slice(0, 8)}.xml`,
    'application/xml;charset=utf-8'
  );
}

export function exportThreadAsMarkdown(thread: ConversationThread) {
  if (!thread || thread.messages.length === 0) return;
  const lines = [
    `# ${thread.title}`,
    '',
    ...thread.messages.flatMap((m) => {
      const speaker =
        m.role === 'user'
          ? 'User'
          : m.triModelLabel
          ? `Folio (${m.triModelLabel})`
          : 'Folio';
      const time = new Date(m.createdAt).toLocaleString();
      const dur = typeof m.durationMs === 'number' ? ` · ${(m.durationMs / 1000).toFixed(2)}s` : '';
      const body = m.censored ? '[Censored]' : m.text || m.error || '';
      return [`## ${speaker} (${time}${dur})`, '', body, ''];
    }),
  ];
  triggerTextDownload(
    lines.join('\n'),
    `${slugifyFilename(thread.title, 'conversation')}.md`,
    'text/markdown;charset=utf-8'
  );
}

export function exportThreadAsJson(thread: ConversationThread) {
  if (!thread || thread.messages.length === 0) return;
  const payload = {
    schema: 'folio.thread/v1',
    version: '4.1-zero',
    exportedAt: new Date().toISOString(),
    thread: {
      id: thread.id,
      title: thread.title,
      modelId: thread.modelId,
      groupName: thread.groupName,
      incognito: Boolean(thread.incognito),
      createdAt: new Date(thread.createdAt).toISOString(),
      updatedAt: new Date(thread.updatedAt).toISOString(),
      messages: thread.messages.map((m) => ({
        id: m.id,
        role: m.role,
        modelId: m.modelId,
        triModelLabel: m.triModelLabel,
        createdAt: new Date(m.createdAt).toISOString(),
        durationMs: m.durationMs,
        text: m.censored ? '[Censored]' : m.text || m.error || '',
        thoughts: m.thoughts,
        attachments: m.attachments?.map((a) => ({
          name: a.name,
          mimeType: a.mimeType,
          size: a.size,
        })),
      })),
    },
  };
  triggerTextDownload(
    JSON.stringify(payload, null, 2),
    `${slugifyFilename(thread.title, 'conversation')}.json`,
    'application/json;charset=utf-8'
  );
}

export function exportThreadAsXml(thread: ConversationThread) {
  if (!thread || thread.messages.length === 0) return;
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<folioThread id="${escapeXml(thread.id)}" title="${escapeXml(thread.title)}" model="${escapeXml(thread.modelId)}" version="4.1-zero" exportedAt="${new Date().toISOString()}">`,
    ...thread.messages.map(messageToXml),
    '</folioThread>',
  ].join('\n');
  triggerTextDownload(
    xml,
    `${slugifyFilename(thread.title, 'conversation')}.xml`,
    'application/xml;charset=utf-8'
  );
}
