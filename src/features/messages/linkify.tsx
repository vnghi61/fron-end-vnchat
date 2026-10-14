import { Fragment, type ReactNode } from "react";

// Nội dung tin là text thuần → React tự escape. Chỉ biến URL http(s) thành link (mở tab mới, noopener) và tô đậm
// "@Tên" của người được nhắc. Không bao giờ dùng dangerouslySetInnerHTML.

const URL_RE = /\bhttps?:\/\/[^\s<>"')\]]+[^\s<>"')\].,;:!?]/gi;

export function renderRichText(text: string, mentionNames: string[], linkClass: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_RE)) {
    const start = match.index ?? 0;
    if (start > last) out.push(...renderMentions(text.slice(last, start), mentionNames, out.length));
    const url = match[0];
    out.push(
      <a key={`u${start}`} href={url} target="_blank" rel="noopener noreferrer" className={linkClass}>
        {url}
      </a>,
    );
    last = start + url.length;
  }
  if (last < text.length) out.push(...renderMentions(text.slice(last), mentionNames, out.length));
  return out;
}

function renderMentions(chunk: string, names: string[], keyBase: number): ReactNode[] {
  const valid = names.filter(Boolean).sort((a, b) => b.length - a.length);
  if (!valid.length) return [<Fragment key={`t${keyBase}`}>{chunk}</Fragment>];
  const escaped = valid.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(`@(${escaped.join("|")})`, "g");
  const parts: ReactNode[] = [];
  let last = 0;
  for (const m of chunk.matchAll(re)) {
    const start = m.index ?? 0;
    if (start > last) parts.push(<Fragment key={`t${keyBase}-${last}`}>{chunk.slice(last, start)}</Fragment>);
    parts.push(
      <strong key={`m${keyBase}-${start}`} className="font-semibold">
        {m[0]}
      </strong>,
    );
    last = start + m[0].length;
  }
  if (last < chunk.length) parts.push(<Fragment key={`t${keyBase}-${last}`}>{chunk.slice(last)}</Fragment>);
  return parts;
}
