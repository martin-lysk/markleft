import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

const source = readFileSync(new URL("../src/pwa-service-worker.js", import.meta.url), "utf8");

interface FetchEvent {
  request: { method: string; url: string; mode: string };
  respondWith: (response: Promise<Response>) => void;
  waitUntil: (work: Promise<void>) => void;
}

function worker(fetchResponse: () => Promise<Response>) {
  let onFetch: (event: FetchEvent) => void = () => {
    throw new Error("Missing fetch listener");
  };
  const cache = {
    put: vi.fn<(request: unknown, response: Response) => Promise<void>>(() => Promise.resolve()),
  };
  const caches = {
    open: vi.fn(() => Promise.resolve(cache)),
    match: vi.fn<() => Promise<Response | undefined>>(() => Promise.resolve(undefined)),
  };
  const warn = vi.fn();
  runInNewContext(source, {
    __MARKLEFT_PWA_BUILD__: "test",
    URL,
    fetch: fetchResponse,
    caches,
    console: { warn },
    self: {
      location: { origin: "https://markleft.md" },
      addEventListener: (type: string, listener: (event: FetchEvent) => void) => {
        if (type === "fetch") onFetch = listener;
      },
    },
  });
  const dispatch = () => {
    let response: Promise<Response> | undefined;
    const background: Promise<void>[] = [];
    onFetch({
      request: { method: "GET", url: "https://markleft.md/pwa.js?v=test", mode: "cors" },
      respondWith: (value) => {
        response = value;
      },
      waitUntil: (value) => {
        background.push(value);
      },
    });
    if (!response) throw new Error("Missing response");
    return { response, background };
  };
  return { cache, caches, warn, dispatch };
}

describe("PWA service worker", () => {
  it("caches a separate response even when opening the cache is slower than the browser", async () => {
    const harness = worker(() => Promise.resolve(new Response("application shell")));
    let releaseCache!: () => void;
    const cacheReady = new Promise<void>((resolve) => {
      releaseCache = resolve;
    });
    harness.caches.open.mockImplementation(async () => {
      await cacheReady;
      return harness.cache;
    });
    const event = harness.dispatch();
    const response = await event.response;
    expect(await response.text()).toBe("application shell");
    expect(event.background).toHaveLength(1);
    releaseCache();
    await Promise.all(event.background);
    expect(harness.cache.put).toHaveBeenCalledOnce();
    const cachedResponse = harness.cache.put.mock.calls[0]![1];
    expect(cachedResponse).not.toBe(response);
    expect(await cachedResponse.clone().text()).toBe("application shell");
  });

  it("handles cache write failures without losing the network response", async () => {
    const harness = worker(() => Promise.resolve(new Response("application shell")));
    harness.cache.put.mockRejectedValue(new Error("Storage full"));
    const event = harness.dispatch();
    expect(await (await event.response).text()).toBe("application shell");
    await Promise.all(event.background);
    expect(harness.warn).toHaveBeenCalledOnce();
  });

  it("serves the cached shell when the network fails", async () => {
    const harness = worker(() => Promise.reject(new Error("Offline")));
    harness.caches.match.mockResolvedValue(new Response("offline shell"));
    const event = harness.dispatch();
    expect(await (await event.response).text()).toBe("offline shell");
    expect(harness.cache.put).not.toHaveBeenCalled();
  });
});
