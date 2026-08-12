import { markdownBlockRanges, type MarkdownBlockKind } from "./blocks";

export interface RoundtripReportContext {
  location?: string;
  mode?: string;
  reviewDiffMode?: string;
  activeCommentId?: string | null;
  selection?: {
    text: string;
    start: number | null;
    end: number | null;
  };
}

export interface RoundtripReportCase {
  name: string;
  description: string;
  markdown: string;
  blocks: Array<{
    kind: MarkdownBlockKind;
    markdown: string;
  }>;
  editorContext: RoundtripReportContext;
  createdAt: string;
}

export function createRoundtripReportCase(input: {
  markdown: string;
  description: string;
  context?: RoundtripReportContext;
  createdAt?: Date;
}): RoundtripReportCase {
  const description = input.description.trim() || "Roundtrip regression report";
  return {
    name: reportNameFromDescription(description),
    description,
    markdown: input.markdown.replace(/\r\n?/g, "\n"),
    blocks: markdownBlockRanges(input.markdown, { includeHtmlComments: true }).map((block) => ({
      kind: block.kind,
      markdown: block.markdown,
    })),
    editorContext: input.context ?? {},
    createdAt: (input.createdAt ?? new Date()).toISOString(),
  };
}

export function reportFileName(report: Pick<RoundtripReportCase, "name" | "createdAt">): string {
  const date = report.createdAt.slice(0, 10);
  const slug = report.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "roundtrip-report";
  return `${date}-${slug}.roundtrip-case.json`;
}

function reportNameFromDescription(description: string): string {
  const firstLine = description.split(/\r?\n/, 1)[0]?.trim() ?? "";
  return firstLine.slice(0, 80) || "Roundtrip regression report";
}
