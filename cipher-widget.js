/* =====================================================================
   CIPHER + Policy Decoder \u2014 chat button for ClaimDecoded.com
   Fill in the three links below, then add to index.html right above </body>:
     <script src="cipher-widget.js" defer></script>
   ===================================================================== */
(function () {
  "use strict";

  var CONFIG = {
    workerUrl: "https://cipher.deonjr.workers.dev",
    callUrl: "https://calendly.com/deonjr-claimdecoded/new-meeting",
    inspectionUrl: "https://tally.so/r/GxBYO2",
    phone: "469-238-3587"
  };

  if (window.__cipherLoaded) return;
  window.__cipherLoaded = true;

  var MAX_FILES = 6;
  var MAX_TOTAL_BYTES = 4 * 1024 * 1024; // matches the Worker's ~4 MB cap
  var FILE_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
  var GREETING =
    "I'm CIPHER. Ask me about deductibles, depreciation, building codes, or how claims work.\n" +
    "Heads up: I share general education only. I can't tell you whether something is covered or what a carrier will pay \u2014 " +
    "only your policy and your carrier decide that. For your house or your policy, book a call or an inspection.";
  var DISCLAIMER = "General education only \u2014 not legal advice or a coverage decision. Your policy and carrier decide coverage.";

  var history = []; // {role, content}
  var busy = false;

  // ---------- styles (inside shadow DOM so the site's CSS can't clash) ----------
  var CSS = [
    ":host{all:initial}",
    "*{box-sizing:border-box;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,'Courier New',monospace}",
    ".fab{position:fixed;right:20px;bottom:20px;z-index:2147483000;display:flex;align-items:center;gap:8px;",
    "background:#00ff66;color:#000;border:0;border-radius:999px;padding:14px 18px;font-size:15px;font-weight:700;",
    "cursor:pointer;box-shadow:0 6px 24px rgba(0,255,102,.35)}",
    ".fab:hover{background:#33ff85}",
    ".fab svg{width:20px;height:20px}",
    ".panel{position:fixed;right:20px;bottom:84px;z-index:2147483001;width:380px;max-width:calc(100vw - 32px);",
    "height:580px;max-height:calc(100vh - 110px);background:#050805;color:#d6ffe2;border:1px solid #00ff66;",
    "border-radius:14px;display:none;flex-direction:column;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,.6)}",
    ".panel.open{display:flex}",
    ".head{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid #0f3d1f;background:#000}",
    ".title{color:#00ff66;font-weight:700;font-size:15px;letter-spacing:.08em}",
    ".sub{color:#7fbf95;font-size:11px;margin-top:2px}",
    ".x{background:none;border:0;color:#7fbf95;font-size:22px;cursor:pointer;line-height:1;padding:4px 8px}",
    ".tabs{display:flex;border-bottom:1px solid #0f3d1f}",
    ".tab{flex:1;background:#000;color:#7fbf95;border:0;padding:10px;font-size:13px;cursor:pointer;border-bottom:2px solid transparent}",
    ".tab.on{color:#00ff66;border-bottom-color:#00ff66}",
    ".view{flex:1;display:none;flex-direction:column;min-height:0}",
    ".view.on{display:flex}",
    ".log{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px}",
    ".msg{max-width:90%;padding:10px 12px;border-radius:10px;font-size:13.5px;line-height:1.5;white-space:normal;word-wrap:break-word}",
    ".bot{background:#0b1a10;border:1px solid #0f3d1f;align-self:flex-start}",
    ".me{background:#00ff66;color:#000;align-self:flex-end}",
    ".err{background:#1a0b0b;border:1px solid #5a1f1f;color:#ffcfcf;align-self:flex-start}",
    ".msg a{color:#00ff66}",
    ".me a{color:#000}",
    ".msg ul{margin:6px 0;padding-left:18px}",
    ".msg p{margin:0 0 6px}",
    ".msg p:last-child{margin-bottom:0}",
    ".dots::after{content:'...';animation:d 1.2s steps(4) infinite}",
    "@keyframes d{0%{content:''}25%{content:'.'}50%{content:'..'}75%{content:'...'}}",
    ".row{display:flex;gap:8px;padding:10px;border-top:1px solid #0f3d1f;background:#000}",
    "textarea{flex:1;resize:none;background:#050805;color:#d6ffe2;border:1px solid #0f3d1f;border-radius:8px;",
    "padding:9px 10px;font-size:16px;height:44px;max-height:110px;outline:none}",
    "textarea:focus{border-color:#00ff66}",
    ".btn{background:#00ff66;color:#000;border:0;border-radius:8px;padding:0 14px;font-weight:700;font-size:13px;cursor:pointer;min-height:44px}",
    ".btn:disabled{opacity:.5;cursor:default}",
    ".ghost{background:transparent;color:#00ff66;border:1px solid #00ff66}",
    ".cta{display:flex;gap:8px;padding:8px 10px 0;background:#000}",
    ".cta a{flex:1;text-align:center;text-decoration:none;font-size:12px;padding:8px 6px;border-radius:8px;border:1px solid #00ff66;color:#00ff66}",
    ".cta a:first-child{background:#00ff66;color:#000;font-weight:700}",
    ".foot{font-size:10.5px;color:#5f8f6f;padding:6px 10px 10px;background:#000;text-align:center}",
    ".dec{flex:1;overflow-y:auto;padding:14px;font-size:13px;line-height:1.5}",
    ".dec label{display:block;color:#7fbf95;font-size:12px;margin:10px 0 4px}",
    ".dec select{width:100%;background:#050805;color:#d6ffe2;border:1px solid #0f3d1f;border-radius:8px;padding:9px;font-size:16px}",
    ".drop{border:1px dashed #00ff66;border-radius:10px;padding:16px;text-align:center;color:#7fbf95;cursor:pointer;margin-top:4px}",
    ".drop:hover{background:#0b1a10}",
    ".files{list-style:none;padding:0;margin:8px 0 0}",
    ".files li{display:flex;justify-content:space-between;gap:8px;font-size:12px;padding:4px 0;border-bottom:1px solid #0f3d1f}",
    ".files button{background:none;border:0;color:#ff8f8f;cursor:pointer;font-size:12px}",
    ".note{font-size:11.5px;color:#7fbf95;margin:8px 0 0}",
    ".go{width:100%;margin-top:12px}",
    ".result{margin-top:14px}",
    ".disc{display:block;margin-top:8px;padding-top:6px;border-top:1px solid #0f3d1f;font-size:10.5px;color:#5f8f6f;font-style:italic}",
    "@media (max-width:480px){.panel{right:8px;left:8px;width:auto;max-width:none;bottom:76px;height:calc(100vh - 96px);max-height:none}",
    ".fab{right:12px;bottom:12px}}"
  ].join("");

  // ---------- helpers ----------
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // Tiny, safe markdown: escapes first, then **bold**, "- " bullets, and links.
  function render(text) {
    var lines = esc(text).split(/\n/);
    var html = "", inList = false;
    lines.forEach(function (line) {
      var t = line.trim();
      var bullet = /^[-\u2022*]\s+/.test(t);
      if (bullet && !inList) { html += "<ul>"; inList = true; }
      if (!bullet && inList) { html += "</ul>"; inList = false; }
      if (!t) return;
      t = t.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      t = t.replace(/(https?:\/\/[^\s<)]+[^\s<).,;:])/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
      t = t.replace(/(^|[\s(])((?:www\.)?claimdecoded\.com)(?![\w\/.-]*<\/a>)/gi,
        '$1<a href="https://claimdecoded.com" target="_blank" rel="noopener">$2</a>');
      if (bullet) html += "<li>" + t.replace(/^[-\u2022*]\s+/, "") + "</li>";
      else html += "<p>" + t + "</p>";
    });
    if (inList) html += "</ul>";
    return html;
  }

  function post(path, payload) {
    return fetch(CONFIG.workerUrl.replace(/\/+$/, "") + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (data) {
        if (!r.ok || data.error) throw new Error(data.error || "Something went wrong. Try again.");
        return data.reply || "";
      });
    }).catch(function (e) {
      if (e && e.message && e.message !== "Failed to fetch") throw e;
      throw new Error("CIPHER is offline right now. Book a call at claimdecoded.com or call/text " + CONFIG.phone + ".");
    });
  }

  function readAsBase64(file) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () { resolve(String(fr.result).split(",")[1]); };
      fr.onerror = function () { reject(new Error("Couldn't read " + file.name)); };
      fr.readAsDataURL(file);
    });
  }

  // Shrink big phone photos so uploads stay under the size cap.
  function prepImage(file) {
    return new Promise(function (resolve) {
      if (file.size < 900 * 1024) return resolve(readAsBase64(file).then(function (d) { return { type: file.type, data: d }; }));
      var img = new Image();
      var url = URL.createObjectURL(file);
      img.onload = function () {
        var max = 1800, w = img.naturalWidth, h = img.naturalHeight;
        var scale = Math.min(1, max / Math.max(w, h));
        var c = document.createElement("canvas");
        c.width = Math.round(w * scale); c.height = Math.round(h * scale);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve({ type: "image/jpeg", data: c.toDataURL("image/jpeg", 0.85).split(",")[1] });
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        resolve(readAsBase64(file).then(function (d) { return { type: file.type, data: d }; }));
      };
      img.src = url;
    });
  }

  // ---------- build UI ----------
  function build() {
    var host = document.createElement("div");
    host.id = "cipher-widget";
    document.body.appendChild(host);
    var root = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;

    root.innerHTML =
      "<style>" + CSS + "</style>" +
      '<button class="fab" aria-label="Open CIPHER chat">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' +
      "<span>Ask CIPHER</span></button>" +
      '<div class="panel" role="dialog" aria-label="CIPHER">' +
      '<div class="head"><div><div class="title">CIPHER</div><div class="sub">Claim Decoded \u00b7 general info, not coverage decisions</div></div>' +
      '<button class="x" aria-label="Close">\u00d7</button></div>' +
      '<div class="tabs"><button class="tab on" data-v="chat">Ask CIPHER</button><button class="tab" data-v="dec">Decode my policy</button></div>' +

      '<div class="view on" data-v="chat">' +
      '<div class="log" aria-live="polite"></div>' +
      '<div class="row"><textarea rows="1" placeholder="Ask about deductibles, codes, claims..." aria-label="Your question"></textarea>' +
      '<button class="btn send">Send</button></div></div>' +

      '<div class="view" data-v="dec"><div class="dec">' +
      "<div>Upload your declarations page (and any endorsement pages). You'll get a plain-English breakdown of your coverages, limits, deductibles, and endorsements.</div>" +
      '<label for="cst">Your state</label>' +
      '<select id="cst"><option value="TX">Texas</option><option value="WV">West Virginia</option><option value="">Other</option></select>' +
      '<label>Your pages (PDF, JPG, PNG, WEBP \u00b7 up to ' + MAX_FILES + ")</label>" +
      '<div class="drop" tabindex="0" role="button">Tap to choose files or drop them here</div>' +
      '<input type="file" multiple accept="application/pdf,image/jpeg,image/png,image/webp" hidden>' +
      '<ul class="files"></ul>' +
      '<p class="note">This explains what your pages say in plain English. It is not a coverage decision or legal advice \u2014 your carrier and policy decide what is covered. Confirm anything important with your agent.</p>' +
      '<p class="note">Cover or crop out policy numbers and your address if you can. Files are sent to be read once and are not saved.</p>' +
      '<button class="btn go" disabled>Decode my policy</button>' +
      '<div class="result"></div>' +
      "</div></div>" +

      '<div class="cta"><a target="_blank" rel="noopener" href="' + esc(CONFIG.callUrl) + '">Book a call</a>' +
      '<a target="_blank" rel="noopener" href="' + esc(CONFIG.inspectionUrl) + '">Request inspection</a></div>' +
      '<div class="foot">Claim Decoded inspects, estimates, and documents \u2014 we don\'t negotiate claims. Call/text ' + esc(CONFIG.phone) + "</div>" +
      "</div>";

    var $ = function (s) { return root.querySelector(s); };
    var fab = $(".fab"), panel = $(".panel"), log = $(".log"), ta = $("textarea"), send = $(".send");
    var drop = $(".drop"), input = $("input[type=file]"), list = $(".files"), go = $(".go"), result = $(".result"), st = $("#cst");
    var picked = [];

    function addMsg(cls, html) {
      var d = document.createElement("div");
      d.className = "msg " + cls;
      d.innerHTML = html;
      log.appendChild(d);
      log.scrollTop = log.scrollHeight;
      return d;
    }

    function open() {
      panel.classList.add("open");
      if (!log.childElementCount) addMsg("bot", render(GREETING));
      setTimeout(function () { ta.focus(); }, 50);
    }
    fab.addEventListener("click", function () { panel.classList.contains("open") ? panel.classList.remove("open") : open(); });
    $(".x").addEventListener("click", function () { panel.classList.remove("open"); });

    root.querySelectorAll(".tab").forEach(function (t) {
      t.addEventListener("click", function () {
        var v = t.getAttribute("data-v");
        root.querySelectorAll(".tab").forEach(function (x) { x.classList.toggle("on", x === t); });
        root.querySelectorAll(".view").forEach(function (x) { x.classList.toggle("on", x.getAttribute("data-v") === v); });
      });
    });

    // ---- chat ----
    function ask() {
      var q = ta.value.trim();
      if (!q || busy) return;
      busy = true; send.disabled = true;
      ta.value = "";
      addMsg("me", esc(q));
      history.push({ role: "user", content: q });
      var wait = addMsg("bot", '<span class="dots">Decoding</span>');
      post("/chat", { messages: history.slice(-16) })
        .then(function (reply) {
          wait.innerHTML = render(reply) + '<span class="disc">' + esc(DISCLAIMER) + "</span>";
          history.push({ role: "assistant", content: reply });
        })
        .catch(function (e) {
          wait.className = "msg err";
          wait.innerHTML = render(e.message);
          history.pop(); // let them re-ask
        })
        .then(function () { busy = false; send.disabled = false; log.scrollTop = log.scrollHeight; });
    }
    send.addEventListener("click", ask);
    ta.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(); }
    });

    // ---- decoder ----
    function drawFiles() {
      list.innerHTML = "";
      picked.forEach(function (f, i) {
        var li = document.createElement("li");
        li.innerHTML = "<span>" + esc(f.name) + "</span>";
        var b = document.createElement("button");
        b.textContent = "remove";
        b.addEventListener("click", function () { picked.splice(i, 1); drawFiles(); });
        li.appendChild(b);
        list.appendChild(li);
      });
      go.disabled = !picked.length;
    }
    function addFiles(fl) {
      var bad = [];
      Array.prototype.forEach.call(fl, function (f) {
        if (FILE_TYPES.indexOf(f.type) === -1) { bad.push(f.name); return; }
        if (picked.length < MAX_FILES) picked.push(f);
      });
      result.innerHTML = bad.length
        ? '<div class="msg err">' + esc("These won't work here (PDF, JPG, PNG, or WEBP only \u2014 iPhone HEIC photos need to be screenshotted or exported as JPG): " + bad.join(", ")) + "</div>"
        : "";
      drawFiles();
    }
    drop.addEventListener("click", function () { input.click(); });
    drop.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); } });
    input.addEventListener("change", function () { addFiles(input.files); input.value = ""; });
    drop.addEventListener("dragover", function (e) { e.preventDefault(); });
    drop.addEventListener("drop", function (e) { e.preventDefault(); addFiles(e.dataTransfer.files); });

    go.addEventListener("click", function () {
      if (!picked.length || busy) return;
      busy = true; go.disabled = true;
      result.innerHTML = '<div class="msg bot"><span class="dots">Reading your pages</span></div>';
      Promise.all(picked.map(function (f) {
        return f.type === "application/pdf"
          ? readAsBase64(f).then(function (d) { return { type: f.type, data: d }; })
          : prepImage(f);
      }))
        .then(function (files) {
          var total = files.reduce(function (n, f) { return n + f.data.length * 0.75; }, 0);
          if (total > MAX_TOTAL_BYTES) throw new Error("That upload is too large. Try just the declarations page and endorsement pages, or smaller photos.");
          return post("/decode", { files: files, state: st.value });
        })
        .then(function (reply) { result.innerHTML = '<div class="msg bot" style="max-width:100%">' + render(reply) + '<span class="disc">' + esc(DISCLAIMER) + "</span></div>"; })
        .catch(function (e) { result.innerHTML = '<div class="msg err">' + render(e.message) + "</div>"; })
        .then(function () { busy = false; go.disabled = !picked.length; });
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
  else build();
})();
