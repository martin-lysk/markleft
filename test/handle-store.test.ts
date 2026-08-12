import { handleStorageKey } from "../src/file/handle-store";

test("keys remembered handles by file URL path", () => {
  const location = new URL("file:///Users/martinlysk/Documents/rendered-md/example.md.html");

  expect(handleStorageKey(location as unknown as Location)).toBe(
    "file:/Users/martinlysk/Documents/rendered-md/example.md.html",
  );
});

test("uses the suggested filename for non-file URLs", () => {
  const location = new URL("https://example.com/path/doc.md.html");

  expect(handleStorageKey(location as unknown as Location)).toBe("name:example.md.html");
});

