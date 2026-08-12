(function () {
  var version = "v6";
  var loaderUrl = "file:///Users/martinlysk/Documents/rendered-md/local-md.js";
  var noMarkdownSource = /* __MARKLEFT_NO_MARKDOWN_SOURCE__ */ "";
  var loadingScript = document.currentScript;
  if (loadingScript && loadingScript.src) {
    var loadingScriptUrl = new URL(loadingScript.src);
    loaderUrl = new URL("local-md.js" + loadingScriptUrl.search, loadingScriptUrl.href).href;
  }

  console.info("[local-md:bookmarklet] " + version + " hash loader");

  function hexByte(byte) {
    return byte.toString(16).slice(-2).padStart(2, "0");
  }

  function hashText(text) {
    if (window.crypto && window.crypto.subtle) {
      return window.crypto.subtle
        .digest("SHA-256", new TextEncoder().encode(text))
        .then(function (digest) {
          var bytes = new Uint8Array(digest);
          var hex = "";
          for (var index = 0; index < bytes.length; index += 1) hex += hexByte(bytes[index]);
          return hex;
        });
    }

    var hash = 2166136261;
    for (var index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return Promise.resolve("fnv1a:" + (hash >>> 0).toString(16).padStart(8, "0"));
  }

  function escapeTextarea(text) {
    return text.replace(/<\/textarea/gi, "<\\/textarea");
  }

  function escapeAttribute(text) {
    return text.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  }

  function readPreludeFrontmatter() {
    var script = document.querySelector(
      "#local-md-loader,script[src$='local-md.js'],script[src*='local-md.js']",
    );
    if (!script || !script.parentNode) return "";

    var text = "";
    var nodes = Array.prototype.slice.call(script.parentNode.childNodes);
    for (var index = 0; index < nodes.length; index += 1) {
      var node = nodes[index];
      if (node === script) break;
      if (node.nodeType === Node.TEXT_NODE) text += node.textContent || "";
    }

    var normalized = text.replace(/\r\n?/g, "\n").trimStart();
    if (!normalized.startsWith("---\n")) return "";

    var lines = normalized.split("\n");
    var end = -1;
    for (var lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
      if (lines[lineIndex].trim() === "---") {
        end = lineIndex;
        break;
      }
    }
    return end < 0 ? "" : lines.slice(0, end + 1).join("\n") + "\n\n";
  }

  function pageText() {
    var firstChild = document.body && document.body.firstChild;
    if (firstChild && typeof firstChild.innerText === "string") {
      return {
        technique: "body.firstChild.innerText",
        text: firstChild.innerText,
      };
    }

    var root = document.body || document.documentElement || document;
    return {
      technique:
        root === document.body
          ? "body.textContent"
          : root === document.documentElement
            ? "documentElement.textContent"
            : "document.textContent",
      text: root && root.textContent ? root.textContent : "",
    };
  }

  function isMarkdownDocument() {
    return /\.(?:md|markdown|mdown|mkdn)(?:\.html)?$/i.test(window.location.pathname);
  }

  function currentSource() {
    var bootstrap = document.querySelector(
      "textarea[data-testid='bootstrap-source'],body>textarea:first-of-type",
    );
    if (bootstrap && typeof bootstrap.value === "string") {
      return {
        kind: "bootstrap",
        technique: bootstrap.matches("textarea[data-testid='bootstrap-source']")
          ? "textarea[data-testid='bootstrap-source'].value"
          : "body>textarea:first-of-type.value",
        text: (readPreludeFrontmatter() + bootstrap.value.replace(/^\n/, "")).replace(
          /\r\n?/g,
          "\n",
        ),
      };
    }

    if (window.__localMdDebug && typeof window.__localMdDebug.getMarkdown === "function") {
      return {
        kind: "debug",
        technique: "window.__localMdDebug.getMarkdown()",
        text: String(window.__localMdDebug.getMarkdown()).replace(/\r\n?/g, "\n"),
      };
    }

    if (!isMarkdownDocument() && noMarkdownSource) {
      return {
        kind: "no-markdown-guide",
        technique: "bundled no-markdown.md",
        text: noMarkdownSource,
      };
    }

    var pageSource = pageText();
    return {
      kind: "page",
      technique: pageSource.technique,
      text: pageSource.text.replace(/\r\n?/g, "\n"),
    };
  }

  function frontmatterMatch(text) {
    return text.match(/^---\n[\s\S]*?\n---\n?/);
  }

  function loadLocalMd(sourceHash, sourceLength) {
    window.__localMdSourceIdentity = { hash: sourceHash, length: sourceLength };

    var script = document.createElement("script");
    script.id = "local-md-loader";
    script.dataset.sourceHash = sourceHash;
    script.dataset.sourceLength = String(sourceLength);
    script.src = loaderUrl;
    var readyTimer;
    var showLoadError = function () {
      var spinner = document.querySelector(".local-md-loading-spinner");
      var copy = document.querySelector(".local-md-loading-copy");
      if (spinner) spinner.style.display = "none";
      if (copy) {
        copy.innerHTML =
          'Couldn\'t finish opening Markleft. Check your connection, then <a href="https://github.com/martin-lysk/markleft" target="_blank" rel="noopener">check for updates or file an issue</a>.';
      }
    };
    var markReady = function () {
      window.clearTimeout(readyTimer);
      window.removeEventListener("markleft:ready", markReady);
    };
    window.addEventListener("markleft:ready", markReady);
    script.onerror = function () {
      window.clearTimeout(readyTimer);
      showLoadError();
    };
    (document.body || document.documentElement).appendChild(script);
    readyTimer = window.setTimeout(showLoadError, 15000);
  }

  function wrapSource(source) {
    return hashText(source.text).then(function (sourceHash) {
      var sourceLength = source.text.length;
      console.info("[local-md:bookmarklet] source", {
        kind: source.kind,
        technique: source.technique || source.kind,
        length: sourceLength,
        hash: sourceHash,
        preview: source.text.slice(0, 80),
      });

      var sourceHashAttribute = escapeAttribute(sourceHash);
      var meta =
        '<meta name="local-md-source" data-source-hash="' +
        sourceHashAttribute +
        '" data-source-length="' +
        sourceLength +
        '" data-source-kind="' +
        escapeAttribute(source.kind) +
        '">';
      var textarea = '<textarea data-testid="bootstrap-source">';
      var textareaClose = "</textarea>";
      var loadingScreen =
        "<style>" +
        'body{margin:0;min-height:100vh;background:#ebe8dc;color:#141414;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}' +
        ".local-md-loading{min-height:100vh;display:grid;place-items:center;padding:24px}" +
        ".local-md-loading-card{display:grid;justify-items:center;gap:14px;max-width:340px;text-align:center;padding:34px;border:1px solid #cfc6b7;border-radius:12px;background:#fffefa;box-shadow:0 10px 28px rgb(20 20 20 / 8%)}" +
        ".local-md-loading-spinner{width:32px;height:32px;border:3px solid #e3dccf;border-top-color:#3b4b59;border-radius:50%;animation:local-md-loading-spin .75s linear infinite}" +
        ".local-md-loading-title{font-weight:700;font-size:18px}.local-md-loading-copy{color:#686256;font-size:14px;line-height:1.45}.local-md-loading-copy a{color:#3b4b59;font-weight:700}" +
        'textarea[data-testid="bootstrap-source"]{display:none}' +
        "@keyframes local-md-loading-spin{to{transform:rotate(360deg)}}" +
        "</style>" +
        '<main class="local-md-loading" role="status" aria-live="polite"><section class="local-md-loading-card"><span class="local-md-loading-spinner" aria-hidden="true"></span><strong class="local-md-loading-title">Opening Markleft</strong><span class="local-md-loading-copy">Preparing your local Markdown editor…</span></section></main>';
      var frontmatter = frontmatterMatch(source.text);
      var markdown = source.text;

      if (frontmatter) {
        markdown = source.text.slice(frontmatter[0].length);
        return {
          hash: sourceHash,
          length: sourceLength,
          html:
            frontmatter[0] +
            "\n" +
            meta +
            loadingScreen +
            textarea +
            escapeTextarea(markdown) +
            textareaClose,
        };
      }
      return {
        hash: sourceHash,
        length: sourceLength,
        html: meta + loadingScreen + textarea + escapeTextarea(markdown) + textareaClose,
      };
    });
  }

  wrapSource(currentSource())
    .then(function (wrapped) {
      document.open();
      document.write(wrapped.html);
      document.close();
      loadLocalMd(wrapped.hash, wrapped.length);
    })
    .catch(function (error) {
      console.error("[local-md:bookmarklet] failed", error);
    });
})();
