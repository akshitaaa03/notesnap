(() => {
  const dropZone     = document.getElementById("dropZone");
  const fileInput    = document.getElementById("fileInput");
  const previewArea  = document.getElementById("previewArea");
  const previewImg   = document.getElementById("previewImg");
  const previewMeta  = document.getElementById("previewMeta");
  const analyzeBtn   = document.getElementById("analyzeBtn");
  const clearBtn     = document.getElementById("clearBtn");

  const resultsPlaceholder = document.getElementById("resultsPlaceholder");
  const resultsContent     = document.getElementById("resultsContent");
  const loadingOverlay     = document.getElementById("loadingOverlay");
  const loaderText         = document.getElementById("loaderText");

  const statsRow       = document.getElementById("statsRow");
  const formattedOutput= document.getElementById("formattedOutput");
  const plainOutput    = document.getElementById("plainOutput");
  const rawOutput      = document.getElementById("rawOutput");

  const copyBtn     = document.getElementById("copyFormatted");
  const downloadBtn = document.getElementById("downloadJson");
  const toast       = document.getElementById("toast");
  const tabs        = document.querySelectorAll(".tab");

  let currentFile = null;
  let currentResult = null;

  // ─── Drag & Drop ───────────────────────────────────
  dropZone.addEventListener("dragover", e => {
    e.preventDefault();
    dropZone.classList.add("dragover");
  });

  dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));

  dropZone.addEventListener("drop", e => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) loadFile(file);
  });

  dropZone.addEventListener("click", e => {
    if (e.target !== fileInput && !e.target.closest("label")) fileInput.click();
  });

  fileInput.addEventListener("change", () => {
    if (fileInput.files[0]) loadFile(fileInput.files[0]);
  });

  // ─── Load file into preview ────────────────────────
  function loadFile(file) {
    currentFile = file;
    const url = URL.createObjectURL(file);
    previewImg.src = url;

    const kb = (file.size / 1024).toFixed(1);
    const ext = file.name.split(".").pop().toUpperCase();
    previewMeta.textContent = `${file.name} · ${ext} · ${kb} KB`;

    dropZone.classList.add("hidden");
    previewArea.classList.remove("hidden");

    // Reset results
    resultsContent.classList.add("hidden");
    resultsPlaceholder.classList.remove("hidden");
    currentResult = null;
  }

  // ─── Clear ─────────────────────────────────────────
  clearBtn.addEventListener("click", () => {
    currentFile = null;
    currentResult = null;
    previewImg.src = "";
    fileInput.value = "";
    previewArea.classList.add("hidden");
    dropZone.classList.remove("hidden");
    resultsContent.classList.add("hidden");
    resultsPlaceholder.classList.remove("hidden");
  });

  // ─── Analyze ───────────────────────────────────────
  analyzeBtn.addEventListener("click", async () => {
    if (!currentFile) return;

    const loaderMessages = [
      "Reading handwriting...",
      "Detecting text regions...",
      "Structuring your notes...",
      "Formatting output..."
    ];
    let msgIdx = 0;
    loaderText.textContent = loaderMessages[0];

    loadingOverlay.classList.remove("hidden");
    resultsPlaceholder.classList.add("hidden");
    resultsContent.classList.add("hidden");
    analyzeBtn.disabled = true;

    const interval = setInterval(() => {
      msgIdx = (msgIdx + 1) % loaderMessages.length;
      loaderText.textContent = loaderMessages[msgIdx];
    }, 1800);

    try {
      const formData = new FormData();
      formData.append("image", currentFile);

      const res = await fetch("/analyze", { method: "POST", body: formData });
      const data = await res.json();

      clearInterval(interval);
      loadingOverlay.classList.add("hidden");
      analyzeBtn.disabled = false;

      if (!res.ok || data.error) {
        showToast("Error: " + (data.error || "Unknown error"), true);
        resultsPlaceholder.classList.remove("hidden");
        return;
      }

      currentResult = data;
      renderResults(data);

    } catch (err) {
      clearInterval(interval);
      loadingOverlay.classList.add("hidden");
      analyzeBtn.disabled = false;
      showToast("Request failed: " + err.message, true);
      resultsPlaceholder.classList.remove("hidden");
    }
  });

  // ─── Render Results ────────────────────────────────
  function renderResults(data) {
    // Stats
    const confPct = Math.round((data.avg_confidence || 0) * 100);
    const confColor = confPct >= 75 ? "#3a7d44" : confPct >= 50 ? "#9e7c2e" : "#c4421a";
    statsRow.innerHTML = `
      <div class="stat">
        <span class="stat-value">${data.word_count}</span>
        <span class="stat-label">Words</span>
      </div>
      <div class="stat">
        <span class="stat-value">${data.line_count}</span>
        <span class="stat-label">Lines</span>
      </div>
      <div class="stat">
        <span class="stat-value" style="color:${confColor}">${confPct}%</span>
        <span class="stat-label">Confidence</span>
      </div>
      <div class="stat">
        <span class="stat-value">${data.sections ? data.sections.length : 0}</span>
        <span class="stat-label">Sections</span>
      </div>
    `;

    // Formatted tab — render markdown-ish text
    const html = markdownLite(data.formatted_text || data.plain_text || "No text detected.");
    formattedOutput.innerHTML = html;

    // Plain tab
    plainOutput.textContent = data.plain_text || "";

    // Raw breakdown
    rawOutput.innerHTML = "";
    if (data.raw_lines && data.raw_lines.length > 0) {
      data.raw_lines.forEach(line => {
        const conf = line.confidence;
        const pct = Math.round(conf * 100);
        const cls = conf >= 0.75 ? "conf-high" : conf >= 0.5 ? "conf-mid" : "conf-low";
        const barColor = conf >= 0.75 ? "#3a7d44" : conf >= 0.5 ? "#9e7c2e" : "#c4421a";

        const div = document.createElement("div");
        div.className = "raw-line";
        div.innerHTML = `
          <span class="raw-text">${escapeHtml(line.text)}</span>
          <div class="conf-bar-wrap">
            <div class="conf-bar" style="width:${pct}%;background:${barColor}"></div>
          </div>
          <span class="conf-badge ${cls}">${pct}%</span>
        `;
        rawOutput.appendChild(div);
      });
    } else {
      rawOutput.innerHTML = `<p style="color:var(--ink-faint);font-size:.85rem">No word-level data available.</p>`;
    }

    // Show first tab
    showTab("formatted");
    resultsPlaceholder.classList.add("hidden");
    resultsContent.classList.remove("hidden");
  }

  // Simple markdown renderer (## headings only)
  function markdownLite(text) {
    if (!text) return "";
    return text
      .split("\n")
      .map(line => {
        if (line.startsWith("## ")) {
          return `<h2>${escapeHtml(line.slice(3))}</h2>`;
        }
        if (line.trim() === "") return "<br/>";
        return `<span>${escapeHtml(line)}</span>`;
      })
      .join("\n");
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // ─── Tabs ──────────────────────────────────────────
  tabs.forEach(tab => {
    tab.addEventListener("click", () => showTab(tab.dataset.tab));
  });

  function showTab(name) {
    tabs.forEach(t => t.classList.toggle("active", t.dataset.tab === name));
    document.querySelectorAll(".tab-content").forEach(c => {
      c.classList.toggle("hidden", c.id !== `tab-${name}`);
    });
  }

  // ─── Copy ──────────────────────────────────────────
  copyBtn.addEventListener("click", async () => {
    if (!currentResult) return;
    try {
      await navigator.clipboard.writeText(currentResult.formatted_text || currentResult.plain_text || "");
      showToast("Copied to clipboard!");
    } catch {
      showToast("Copy failed — try manually selecting text.");
    }
  });

  // ─── Download JSON ─────────────────────────────────
  downloadBtn.addEventListener("click", () => {
    if (!currentResult) return;
    const blob = new Blob([JSON.stringify(currentResult, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "handnote_ocr_result.json";
    a.click();
    URL.revokeObjectURL(url);
    showToast("JSON downloaded!");
  });

  // ─── Toast ─────────────────────────────────────────
  let toastTimer = null;
  function showToast(msg, isError = false) {
    toast.textContent = msg;
    toast.style.background = isError ? "#c4421a" : "#1a1714";
    toast.classList.remove("hidden");
    requestAnimationFrame(() => toast.classList.add("visible"));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove("visible");
      setTimeout(() => toast.classList.add("hidden"), 280);
    }, 3000);
  }
})();
