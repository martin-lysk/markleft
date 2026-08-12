import { expect, test } from "@playwright/test";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";

import { failOnUnexpectedBrowserOutput, openExample } from "./helpers";

function legacyWrappedFile(markdown: string): string {
  return `<script src="local-md.js"></script><textarea>${markdown}`;
}

test("loads directly from file URL with the external bundle and EOF textarea", async ({ page }) => {
  const requests = await openExample(page);

  await expect(page.getByTestId("mode-rendered")).toBeVisible();
  await expect(page.getByTestId("mode-markdown")).toBeVisible();
  await expect(page.getByTestId("save")).toBeVisible();
  await expect(page.getByTestId("frontmatter-source")).toHaveValue(/title: Local Markdown Demo/);

  const source = await page.getByTestId("markdown-editor").inputValue();
  expect(source).toContain("# Local Markdown Demo");
  expect(source).not.toMatch(/<\/textarea/i);
  expect(requests.some((url) => url.endsWith("/local-md.js"))).toBe(true);
});

test("loads a legacy wrapped file with the plain serialized textarea", async ({ page }, testInfo) => {
  const savedPath = testInfo.outputPath("saved", "saved.md.html");
  const bundlePath = testInfo.outputPath("saved", "local-md.js");
  await mkdir(dirname(savedPath), { recursive: true });
  await writeFile(savedPath, legacyWrappedFile("# Saved File\n\nThis reopened correctly.\n"), "utf8");
  await copyFile("local-md.js", bundlePath);

  await page.goto(pathToFileURL(savedPath).href);

  await expect(page.getByRole("heading", { name: "Saved File" })).toBeVisible();
  await page.getByTestId("mode-markdown").click();
  await expect(page.getByTestId("markdown-editor")).toHaveValue(
    "# Saved File\n\nThis reopened correctly.\n",
  );
});

test("renders blog frontmatter as a document header", async ({ page }, testInfo) => {
  const savedPath = testInfo.outputPath("blog", "blog.md.html");
  const bundlePath = testInfo.outputPath("blog", "local-md.js");
  await mkdir(dirname(savedPath), { recursive: true });
  await writeFile(
    savedPath,
    legacyWrappedFile(`---
slug: sqlite-on-git-part-2
tags: [git, zlib, compression, Z_FULL_FLUSH]
date: 2026-04-06
image: https://example.com/behind-the-curtain.png
authors: [martin-lysk]
---

# Markleft

Status: Draft specification Version: 0.1
`),
    "utf8",
  );
  await copyFile("local-md.js", bundlePath);

  await page.goto(pathToFileURL(savedPath).href);

  const header = page.getByTestId("frontmatter-header");
  await expect(header).toBeVisible();
  await expect(header).toContainText("sqlite-on-git-part-2");
  await expect(header).toContainText("git");
  await expect(header).toContainText("zlib");
  await expect(header).toContainText("compression");
  await expect(header).toContainText("06-04-2026");
  await expect(header).toContainText("Martin Lysk");
  await expect(header.locator(".local-md-frontmatter-image")).toHaveAttribute(
    "style",
    /https:\/\/example\.com\/behind-the-curtain\.png/,
  );
  await expect(page.getByRole("heading", { name: "Markleft" })).toBeVisible();
});

test("loads the GFM AI feedback sample with sibling SVG content", async ({ page }) => {
  failOnUnexpectedBrowserOutput(page);
  await page.goto(pathToFileURL(`${process.cwd()}/gfm-ai-feedback-test.md.html`).href);

  await expect(page.getByRole("heading", { name: "GFM AI Feedback Test" })).toBeVisible();
  await expect(page.locator('img[src="gfm-ai-feedback-diagram.svg"]')).toBeVisible();
  await expect(page.locator(".local-md-mermaid svg")).toBeVisible();
  await expect(page.locator("pre > code.language-mermaid")).toHaveCount(0);
  await page.getByTestId("mode-markdown").click();
  await expect(page.getByTestId("frontmatter-source")).toHaveValue(/title: GFM AI Feedback Test/);
  await expect(page.getByTestId("markdown-editor")).toHaveValue(/```\s*mermaid/);
  await expect(page.getByTestId("markdown-editor")).toHaveValue(/flowchart LR/);
  await expect(page.getByTestId("markdown-editor")).toHaveValue(/!\[AI feedback flow diagram\]\(gfm-ai-feedback-diagram\.svg\)/);
});
