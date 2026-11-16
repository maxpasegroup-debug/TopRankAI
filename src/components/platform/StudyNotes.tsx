import type { ReactNode } from "react";

/**
 * A small, dependency-free renderer for the structured notes we store. It
 * supports headings, paragraphs, bullet/numbered lists, blockquotes, simple
 * tables and inline bold/`code`/math spans. Content is rendered as React text,
 * never as raw HTML, so imported or AI-authored text cannot inject markup.
 */
export function StudyNotes({ content }: { content: string }) {
  const lines = content.replace(/\r/g, "").split("\n");
  const blocks: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();
    if (!trimmed) {
      index += 1;
      continue;
    }

    if (trimmed.startsWith("|")) {
      const table: string[][] = [];
      let cursor = index;
      while (cursor < lines.length && lines[cursor].trim().startsWith("|")) {
        const cells = lines[cursor].trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
        if (!cells.every((cell) => /^:?-{2,}:?$/.test(cell))) table.push(cells);
        cursor += 1;
      }
      if (table.length) {
        const [head, ...body] = table;
        blocks.push(
          <div className="tp-table-wrap" key={`table-${index}`}>
            <table className="tp-table">
              <thead>
                <tr>{head.map((cell, cellIndex) => <th key={cellIndex}>{inline(cell)}</th>)}</tr>
              </thead>
              <tbody>
                {body.map((row, rowIndex) => (
                  <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{inline(cell)}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>,
        );
      }
      index = cursor;
      continue;
    }

    if (/^#{1,3}\s/.test(trimmed)) {
      const level = trimmed.match(/^#+/)?.[0].length ?? 2;
      const text = trimmed.replace(/^#+\s*/, "");
      blocks.push(
        level <= 2 ? (
          <h3 className="tp-notes-h" key={`h-${index}`}>{inline(text)}</h3>
        ) : (
          <h4 className="tp-notes-sub" key={`h-${index}`}>{inline(text)}</h4>
        ),
      );
      index += 1;
      continue;
    }

    if (trimmed === "---") {
      blocks.push(<hr className="tp-divider" key={`hr-${index}`} />);
      index += 1;
      continue;
    }

    const image = trimmed.match(/^!\[([^\]]*)\]\((https:\/\/[^\s)]+)\)$/);
    if (image) {
      blocks.push(
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="tp-notes-image"
          key={`img-${index}`}
          src={image[2]}
          alt={image[1] || "Study diagram"}
          loading="lazy"
          decoding="async"
        />,
      );
      index += 1;
      continue;
    }

    if (trimmed.startsWith("> ")) {
      blocks.push(
        <div className="tp-notes-callout" key={`quote-${index}`}>{inline(trimmed.slice(2))}</div>,
      );
      index += 1;
      continue;
    }

    if (/^[-*]\s/.test(trimmed)) {
      const items: string[] = [];
      let cursor = index;
      while (cursor < lines.length && /^[-*]\s/.test(lines[cursor].trim())) {
        items.push(lines[cursor].trim().replace(/^[-*]\s*/, ""));
        cursor += 1;
      }
      blocks.push(
        <ul className="tp-notes-list" key={`ul-${index}`}>
          {items.map((item, itemIndex) => <li key={itemIndex}>{inline(item)}</li>)}
        </ul>,
      );
      index = cursor;
      continue;
    }

    if (/^\d+[.)]\s/.test(trimmed)) {
      const items: string[] = [];
      let cursor = index;
      while (cursor < lines.length && /^\d+[.)]\s/.test(lines[cursor].trim())) {
        items.push(lines[cursor].trim().replace(/^\d+[.)]\s*/, ""));
        cursor += 1;
      }
      blocks.push(
        <ol className="tp-notes-list" key={`ol-${index}`}>
          {items.map((item, itemIndex) => <li key={itemIndex}>{inline(item)}</li>)}
        </ol>,
      );
      index = cursor;
      continue;
    }

    blocks.push(<p className="tp-notes-p" key={`p-${index}`}>{inline(trimmed)}</p>);
    index += 1;
  }

  return <div className="tp-notes">{blocks}</div>;
}

function inline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\$[^$]+\$)/g).filter(Boolean);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code className="tp-notes-code" key={index}>{part.slice(1, -1)}</code>;
    }
    if (part.startsWith("$") && part.endsWith("$")) {
      return <span className="tp-notes-math" key={index}>{part.slice(1, -1)}</span>;
    }
    return <span key={index}>{part}</span>;
  });
}
