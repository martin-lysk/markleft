import { expect, type Page } from "@playwright/test";
import { pathToFileURL } from "node:url";

export const exampleUrl = pathToFileURL(`${process.cwd()}/example.md.html`).href;

export function failOnUnexpectedBrowserOutput(page: Page): void {
  page.on("pageerror", (error) => {
    throw error;
  });
  page.on("console", (message) => {
    if (message.type() === "info" && message.text() === "local-md development build") return;
    if (message.type() === "info" && message.text().startsWith("[local-md:file]")) return;
    if (message.type() === "debug") return;
    throw new Error(`Unexpected console ${message.type()}: ${message.text()}`);
  });
}

export async function openExample(page: Page): Promise<string[]> {
  failOnUnexpectedBrowserOutput(page);
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.goto(exampleUrl);
  await expect(page.getByTestId("rendered-editor")).toBeVisible();
  expect(requests.every((url) => url.startsWith("file://"))).toBe(true);
  return requests;
}
