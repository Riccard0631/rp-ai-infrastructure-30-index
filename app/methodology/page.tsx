import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import type { ReactNode } from "react";

function inlineCode(text: string): ReactNode[] {
  return text.split(/(`[^`]+`)/g).map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={`${part}-${index}`}>{part.slice(1, -1)}</code>;
    }
    return part;
  });
}

function renderMarkdown(markdown: string): ReactNode[] {
  const lines = markdown.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let listItems: string[] = [];
  let paragraph: string[] = [];
  let codeLines: string[] = [];
  let inCode = false;

  const flushList = () => {
    if (listItems.length > 0) {
      blocks.push(
        <ul key={`list-${blocks.length}`}>
          {listItems.map((item) => (
            <li key={item}>{inlineCode(item)}</li>
          ))}
        </ul>
      );
      listItems = [];
    }
  };

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push(<p key={`paragraph-${blocks.length}`}>{inlineCode(paragraph.join(" "))}</p>);
      paragraph = [];
    }
  };

  for (const line of lines) {
    if (line.startsWith("```")) {
      flushParagraph();
      flushList();
      if (inCode) {
        blocks.push(
          <pre key={`code-${blocks.length}`}>
            <code>{codeLines.join("\n")}</code>
          </pre>
        );
        codeLines = [];
      }
      inCode = !inCode;
      continue;
    }

    if (inCode) {
      codeLines.push(line);
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }

    if (line.startsWith("# ")) {
      flushParagraph();
      flushList();
      blocks.push(<h1 key={`h1-${blocks.length}`}>{inlineCode(line.slice(2))}</h1>);
      continue;
    }

    if (line.startsWith("## ")) {
      flushParagraph();
      flushList();
      blocks.push(<h2 key={`h2-${blocks.length}`}>{inlineCode(line.slice(3))}</h2>);
      continue;
    }

    if (line.startsWith("- ")) {
      flushParagraph();
      listItems.push(line.slice(2));
      continue;
    }

    paragraph.push(line.trim());
  }

  flushParagraph();
  flushList();
  return blocks;
}

export default function MethodologyPage() {
  const methodologyPath = path.join(process.cwd(), "methodology.md");
  const markdown = fs.readFileSync(methodologyPath, "utf-8");

  return (
    <main className="shell methodology-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand-lockup">
            <span className="ticker-chip">RPAI30</span>
            <span>Methodology</span>
          </div>
          <nav aria-label="Primary navigation">
            <Link href="/">Dashboard</Link>
            <a href="/api/components">Components API</a>
          </nav>
        </div>
      </header>
      <article className="methodology-doc">{renderMarkdown(markdown)}</article>
    </main>
  );
}
