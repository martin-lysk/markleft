import { expect, test, type Page } from "@playwright/test";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";

import { serializeFile } from "../src/file/serialize";
import { openExample } from "./helpers";

declare global {
  interface Window {
    __testWrites?: string[];
    __pickerOptions?: unknown[];
    __pickerCalls?: number;
    __directoryPickerCalls?: number;
    __directoryHasFile?: boolean;
    __clipboardText?: string;
    __writtenPath?: string;
    __directoryFileContents?: string;
    __pickerMode?: "ok" | "cancel" | "error";
    __mockFileContents?: string;
    __mockFileLastModified?: number;
    __triggerFileChange?: () => void;
  }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "__testWrites", { value: [], writable: true });
    Object.defineProperty(window, "__pickerOptions", { value: [], writable: true });
    Object.defineProperty(window, "__pickerCalls", { value: 0, writable: true });
    Object.defineProperty(window, "__pickerMode", { value: "ok", writable: true });
    Object.defineProperty(window, "showDirectoryPicker", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(window, "showSaveFilePicker", {
      configurable: true,
      value: async (options: unknown) => {
        await Promise.resolve();
        window.__pickerCalls = (window.__pickerCalls ?? 0) + 1;
        window.__pickerOptions?.push(options);
        if (window.__pickerMode === "cancel") {
          throw new DOMException("cancelled", "AbortError");
        }
        if (window.__pickerMode === "error") {
          throw new Error("write denied");
        }
        return {
          name: "example.md.html",
          queryPermission: async () => {
            await Promise.resolve();
            return "granted";
          },
          requestPermission: async () => {
            await Promise.resolve();
            return "granted";
          },
          createWritable: async () => {
            await Promise.resolve();
            return {
              write: async (value: string) => {
                await Promise.resolve();
                window.__testWrites?.push(value);
              },
              close: async () => {
                await Promise.resolve();
              },
            };
          },
        };
      },
    });
  });
});

async function installDirectoryPickerMock(page: Page, fileContents = ""): Promise<void> {
  await page.addInitScript((contents) => {
    Object.defineProperty(window, "__directoryPickerCalls", { value: 0, writable: true });
    Object.defineProperty(window, "__directoryHasFile", { value: true, writable: true });
    Object.defineProperty(window, "__directoryFileContents", { value: contents, writable: true });
    Object.defineProperty(window, "__clipboardText", { value: "", writable: true });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          await Promise.resolve();
          window.__clipboardText = value;
        },
      },
    });
    Object.defineProperty(window, "showDirectoryPicker", {
      configurable: true,
      value: async () => {
        await Promise.resolve();
        window.__directoryPickerCalls = (window.__directoryPickerCalls ?? 0) + 1;
        return {
          name: "rendered-md",
          queryPermission: async () => {
            await Promise.resolve();
            return "granted";
          },
          requestPermission: async () => {
            await Promise.resolve();
            return "granted";
          },
          getDirectoryHandle: async () => {
            await Promise.resolve();
            throw new DOMException("missing", "NotFoundError");
          },
          getFileHandle: async (name: string) => {
            await Promise.resolve();
            if (!window.__directoryHasFile || name !== "example.md.html") {
              throw new DOMException("missing", "NotFoundError");
            }
            return {
              name,
              queryPermission: async () => {
                await Promise.resolve();
                return "granted";
              },
              requestPermission: async () => {
                await Promise.resolve();
                return "granted";
              },
              getFile: async () => {
                await Promise.resolve();
                return {
                  lastModified: 1,
                  text: async () => {
                    await Promise.resolve();
                    return window.__directoryFileContents ?? "";
                  },
                };
              },
              createWritable: async () => {
                await Promise.resolve();
                return {
                  write: async (value: string) => {
                    await Promise.resolve();
                    window.__testWrites?.push(value);
                  },
                  close: async () => {
                    await Promise.resolve();
                  },
                };
              },
            };
          },
        };
      },
    });
  }, fileContents);
}

async function switchToMarkdownMode(page: Page): Promise<void> {
  await page.locator("[data-mode-trigger]").click();
  await page.getByTestId("mode-markdown").click();
}

async function markdownFromSerializedPath(path: string): Promise<string> {
  const contents = await readFile(path, "utf8");
  const marker = '<script src="local-md.js"></script><textarea>';
  const loaderIndex = contents.indexOf(marker);
  if (loaderIndex === -1) return contents;
  const normalizedPrelude = contents.slice(0, loaderIndex).replace(/\r\n?/g, "\n").trimStart();
  let prelude = "";
  if (normalizedPrelude.startsWith("---\n")) {
    const lines = normalizedPrelude.split("\n");
    const closingIndex = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
    if (closingIndex !== -1) prelude = `${lines.slice(0, closingIndex + 1).join("\n")}\n\n`;
  }
  const body = contents.slice(loaderIndex + marker.length).replace(/^\n/, "");
  return `${prelude}${body}`;
}

test("saves exact serialized content and reuses a retained handle", async ({ page }) => {
  await openExample(page);
  const frontmatter = await page.getByTestId("frontmatter-source").inputValue();

  await switchToMarkdownMode(page);
  await page.getByTestId("markdown-editor").fill("# Saved\n\nCurrent Markdown\n");
  await expect(page.getByTestId("unsaved-toast")).toBeVisible();
  await page.keyboard.press(process.platform === "darwin" ? "Meta+S" : "Control+S");
  await expect(page.getByTestId("save-status")).toHaveText("Saved");
  await expect(page.getByTestId("unsaved-toast")).toBeHidden();
  await expect(page.getByTestId("llm-prompt")).toBeVisible();
  await expect(page.getByTestId("show-llm-prompt")).toBeVisible();
  await expect(page.getByTestId("llm-prompt-text")).toContainText(
    "local-md comments use reserved footnote ids",
  );
  await expect(page.getByTestId("llm-prompt-text")).toContainText(
    "This is an edit task, not a read-only review",
  );
  await expect(page.getByTestId("llm-prompt-text")).toContainText(
    "Finish only after the suggestion definitions have been written",
  );
  await expect(page.getByTestId("llm-prompt-text")).toContainText(
    "Treat every local-md annotation reference as review metadata, never as replacement content",
  );
  await expect(page.getByTestId("llm-prompt-text")).toContainText(
    "do not copy those anchors into the proposed replacement Markdown",
  );
  await expect(page.getByTestId("llm-prompt-text")).toContainText(
    "only through one final reference-only paragraph",
  );
  await expect(page.getByTestId("llm-prompt-text")).toContainText(
    "ensure each one is addressed by at least one suggestion",
  );
  await expect(page.getByTestId("llm-prompt-text")).not.toContainText("Legacy [^suggest-block-*");
  await page.getByTestId("show-llm-prompt").click();
  await expect(page.getByTestId("llm-prompt-text")).toBeVisible();
  await page.getByTestId("save").click();

  const result = await page.evaluate(() => ({
    writes: window.__testWrites ?? [],
    options: window.__pickerOptions ?? [],
    pickerCalls: window.__pickerCalls ?? 0,
  }));

  expect(result.pickerCalls).toBe(1);
  expect(result.options[0]).toEqual({ suggestedName: "example.md.html" });
  expect(result.writes).toHaveLength(2);
  expect(result.writes[0]).toBe(`---
${frontmatter}
---

# Saved

Current Markdown
`);
});

test("saves through a selected parent folder when no file handle is retained", async ({ page }) => {
  await installDirectoryPickerMock(page, await markdownFromSerializedPath("example.md.html"));
  await openExample(page);

  await switchToMarkdownMode(page);
  await page.getByTestId("markdown-editor").fill("# Folder Save\n\nResolved by parent folder.\n");
  await page.getByTestId("save").click();
  await expect(page.getByTestId("save-status")).toHaveText("Saved");

  const result = await page.evaluate(() => ({
    directoryPickerCalls: window.__directoryPickerCalls ?? 0,
    filePickerCalls: window.__pickerCalls ?? 0,
    writes: window.__testWrites ?? [],
  }));

  expect(result.directoryPickerCalls).toBe(1);
  expect(result.filePickerCalls).toBe(0);
  expect(result.writes[0]).toContain("# Folder Save");
});

test("shows a folder action on load when the current file is not resolved", async ({ page }) => {
  await installDirectoryPickerMock(page, await markdownFromSerializedPath("example.md.html"));
  await openExample(page);

  await expect(page.getByTestId("choose-folder")).toBeVisible();
  await expect(page.getByTestId("save-status")).toHaveText("Choose folder");

  await page.getByTestId("choose-folder").click();
  await expect(page.getByTestId("save-status")).toHaveText("Ready");
  await expect(page.getByTestId("choose-folder")).toBeHidden();
  const result = await page.evaluate(() => ({
    clipboardText: window.__clipboardText ?? "",
    directoryPickerCalls: window.__directoryPickerCalls ?? 0,
  }));
  expect(result.clipboardText).toBe(process.cwd());
  expect(result.directoryPickerCalls).toBe(1);
});

test("reports when the selected parent folder does not contain the current file", async ({
  page,
}) => {
  await installDirectoryPickerMock(page, await markdownFromSerializedPath("example.md.html"));
  await openExample(page);
  page.on("dialog", (dialog) => dialog.accept());
  await page.evaluate(() => {
    window.__directoryHasFile = false;
  });

  await page.getByTestId("save").click();
  await expect(page.getByTestId("save-status")).toHaveText("File not in folder");

  const result = await page.evaluate(() => ({
    directoryPickerCalls: window.__directoryPickerCalls ?? 0,
    filePickerCalls: window.__pickerCalls ?? 0,
    writes: window.__testWrites ?? [],
  }));

  expect(result.directoryPickerCalls).toBe(1);
  expect(result.filePickerCalls).toBe(0);
  expect(result.writes).toHaveLength(0);
});

test("uses original content hash so a root README does not shadow a nested readme", async ({
  page,
}, testInfo) => {
  const savedPath = testInfo.outputPath(
    "martin-lysk",
    "blog",
    "26-03-24-tale-file-part1",
    "readme.md.html",
  );
  const bundlePath = testInfo.outputPath(
    "martin-lysk",
    "blog",
    "26-03-24-tale-file-part1",
    "local-md.js",
  );
  await mkdir(dirname(savedPath), { recursive: true });
  await writeFile(
    savedPath,
    serializeFile("# Nested Readme\n\nOriginal nested content.\n"),
    "utf8",
  );
  await copyFile("local-md.js", bundlePath);

  await page.addInitScript(() => {
    Object.defineProperty(window, "__writtenPath", { value: "", writable: true });
    Object.defineProperty(window, "showDirectoryPicker", {
      configurable: true,
      value: async () => {
        await Promise.resolve();
        const makeFileHandle = (path: string, text: string) => ({
          name: path.split("/").at(-1),
          queryPermission: async () => {
            await Promise.resolve();
            return "granted";
          },
          requestPermission: async () => {
            await Promise.resolve();
            return "granted";
          },
          getFile: async () => {
            await Promise.resolve();
            return {
              lastModified: 1,
              text: async () => {
                await Promise.resolve();
                return text;
              },
            };
          },
          createWritable: async () => {
            await Promise.resolve();
            return {
              write: async (value: string) => {
                await Promise.resolve();
                window.__writtenPath = path;
                window.__testWrites?.push(value);
              },
              close: async () => {
                await Promise.resolve();
              },
            };
          },
        });
        const nestedFile = makeFileHandle(
          "blog/26-03-24-tale-file-part1/readme.md.html",
          "# Nested Readme\n\nOriginal nested content.\n",
        );
        const rootFile = makeFileHandle("README.md.html", "# Different root readme\n");
        const nestedFolder = {
          name: "26-03-24-tale-file-part1",
          queryPermission: async () => {
            await Promise.resolve();
            return "granted";
          },
          requestPermission: async () => {
            await Promise.resolve();
            return "granted";
          },
          getDirectoryHandle: async () => {
            await Promise.resolve();
            throw new DOMException("missing", "NotFoundError");
          },
          getFileHandle: async (name: string) => {
            await Promise.resolve();
            if (name === "readme.md.html") return nestedFile;
            throw new DOMException("missing", "NotFoundError");
          },
        };
        const blogFolder = {
          name: "blog",
          queryPermission: async () => {
            await Promise.resolve();
            return "granted";
          },
          requestPermission: async () => {
            await Promise.resolve();
            return "granted";
          },
          getDirectoryHandle: async (name: string) => {
            await Promise.resolve();
            if (name === "26-03-24-tale-file-part1") return nestedFolder;
            throw new DOMException("missing", "NotFoundError");
          },
          getFileHandle: async () => {
            await Promise.resolve();
            throw new DOMException("missing", "NotFoundError");
          },
        };
        return {
          name: "martin-lysk",
          queryPermission: async () => {
            await Promise.resolve();
            return "granted";
          },
          requestPermission: async () => {
            await Promise.resolve();
            return "granted";
          },
          getDirectoryHandle: async (name: string) => {
            await Promise.resolve();
            if (name === "blog") return blogFolder;
            throw new DOMException("missing", "NotFoundError");
          },
          getFileHandle: async (name: string) => {
            await Promise.resolve();
            if (name.toLowerCase() === "readme.md.html") return rootFile;
            throw new DOMException("missing", "NotFoundError");
          },
        };
      },
    });
  });

  await page.goto(pathToFileURL(savedPath).href);
  await expect(page.getByTestId("rendered-editor")).toBeVisible();
  await switchToMarkdownMode(page);
  await page.getByTestId("markdown-editor").fill("# Nested Readme\n\nChanged nested content.\n");
  await page.getByTestId("save").click();
  await expect(page.getByTestId("save-status")).toHaveText("Saved");

  expect(await page.evaluate(() => window.__writtenPath)).toBe(
    "blog/26-03-24-tale-file-part1/readme.md.html",
  );
});

test("reloads a clean document when the retained file handle changes", async ({ page }) => {
  await page.addInitScript(() => {
    let observerCallback: (() => void) | null = null;
    window.__mockFileContents = "";
    window.__mockFileLastModified = 1;
    window.__triggerFileChange = () => observerCallback?.();
    Object.defineProperty(window, "FileSystemObserver", {
      configurable: true,
      value: class {
        constructor(callback: () => void) {
          observerCallback = callback;
        }
        async observe() {
          await Promise.resolve();
        }
        disconnect() {
          observerCallback = null;
        }
      },
    });
    Object.defineProperty(window, "showSaveFilePicker", {
      configurable: true,
      value: async () => {
        await Promise.resolve();
        return {
          name: "example.md.html",
          queryPermission: async () => {
            await Promise.resolve();
            return "granted";
          },
          requestPermission: async () => {
            await Promise.resolve();
            return "granted";
          },
          getFile: async () => {
            await Promise.resolve();
            return {
              lastModified: window.__mockFileLastModified ?? 0,
              text: async () => {
                await Promise.resolve();
                return window.__mockFileContents ?? "";
              },
            };
          },
          createWritable: async () => {
            await Promise.resolve();
            return {
              write: async (value: string) => {
                await Promise.resolve();
                window.__mockFileContents = value;
                window.__mockFileLastModified = (window.__mockFileLastModified ?? 0) + 1;
                window.__testWrites?.push(value);
              },
              close: async () => {
                await Promise.resolve();
              },
            };
          },
        };
      },
    });
  });
  await openExample(page);

  await switchToMarkdownMode(page);
  await page.getByTestId("markdown-editor").fill("# Original\n");
  await page.getByTestId("save").click();
  await expect(page.getByTestId("save-status")).toHaveText("Saved");

  await page.evaluate((contents) => {
    window.__mockFileContents = contents;
    window.__mockFileLastModified = (window.__mockFileLastModified ?? 0) + 1;
    window.__triggerFileChange?.();
  }, serializeFile("# External\n\nReloaded content\n"));

  await expect(page.getByTestId("markdown-editor")).toHaveValue("# External\n\nReloaded content\n");
  await expect(page.getByTestId("save-status")).toHaveText("Reloaded");
});

test("saves open comment editor text before writing the file", async ({ page }) => {
  await openExample(page);

  await switchToMarkdownMode(page);
  await page.getByTestId("markdown-editor").fill("# Comment save\n\nThis line needs feedback.\n");
  await page.getByTestId("markdown-editor").evaluate((textarea: HTMLTextAreaElement) => {
    const start = textarea.value.indexOf("feedback");
    textarea.setSelectionRange(start, start + "feedback".length);
  });
  await page.getByTestId("add-comment").click();
  await page.getByTestId("comment-input").fill("Saved from the open sidebar editor");

  await page.getByTestId("save").click();
  await expect(page.getByTestId("save-status")).toHaveText("Saved");

  const [saved] = await page.evaluate(() => window.__testWrites ?? []);
  expect(saved).toContain("Saved from the open sidebar editor");
  expect(saved).toContain("[^range-prev-8-chars-");
});

test("saves the current rendered document even before background sync finishes", async ({
  page,
}) => {
  await openExample(page);

  await page.getByRole("heading", { name: "Local Markdown Demo" }).evaluate((heading) => {
    heading.textContent = "Saved Live Heading";
    heading.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText" }));
  });
  await page.getByTestId("save").click();
  await expect(page.getByTestId("save-status")).toHaveText("Saved");

  const [saved] = await page.evaluate(() => window.__testWrites ?? []);
  expect(saved).toContain("# Saved Live Heading");
});

test("Save As always repicks and cancelled selection leaves document modified", async ({
  page,
}) => {
  await openExample(page);

  await switchToMarkdownMode(page);
  await page.getByTestId("markdown-editor").fill("# Modified\n");
  await page.getByTestId("save-as").click();
  await page.getByTestId("save-as").click();
  let calls = await page.evaluate(() => window.__pickerCalls ?? 0);
  expect(calls).toBe(2);

  await page.evaluate(() => {
    window.__pickerMode = "cancel";
  });
  await page.getByTestId("markdown-editor").fill("# Still Modified\n");
  await page.getByTestId("save-as").click();
  await expect(page.getByTestId("save-status")).toHaveText("Modified");
  calls = await page.evaluate(() => window.__pickerCalls ?? 0);
  expect(calls).toBe(3);
});

test("write errors are reported", async ({ page }) => {
  await openExample(page);

  await page.evaluate(() => {
    window.__pickerMode = "error";
  });
  await page.getByTestId("save").click();
  await expect(page.getByTestId("save-status")).toHaveText("Save failed");
});
