// FILE: /jotform-advanced-date-picker/assets/wrap-page.js
(async () => {
  // Adjust BASE if you change your GitHub Pages project path
  // const BASE = "/jotform-advanced-date-picker";
  //const TEMPLATE_URL = `${BASE}/template.html`;
  const BASE = "";
 const TEMPLATE_URL = `/template.html`;

  // --- 1) Capture the page's <main> content (or fall back to body HTML) ---
  const pageMain = document.querySelector("main");
  const keptMain = pageMain
    ? pageMain.cloneNode(true)
    : (() => {
        const m = document.createElement("main");
        m.innerHTML = document.body.innerHTML;
        return m;
      })();

  // --- 2) Collect HEAD elements to preserve (including link[data-keep]) ---
  const headKeepSelector = [
    'title[data-keep]',
    'meta[name="description"]',
    'meta[name="robots"]',
    'link[rel="canonical"]',
    'link[data-keep]',
    'script[data-keep]',
    'style[data-keep]'
  ].join(", ");

  const keptHeadNodes = Array.from(
    document.head.querySelectorAll(headKeepSelector)
  ).map((n) => n.cloneNode(true));

  // --- 3) Collect BODY scripts to preserve & re-execute after wrapping ---
  function recreateScript(old) {
    const s = document.createElement("script");
    // Copy all attributes (including type, src, defer, async, etc.)
    for (const { name, value } of Array.from(old.attributes)) {
      s.setAttribute(name, value);
    }
    // Re-attach the code/source so it executes when appended
    if (old.src) {
      s.src = old.src;
    } else {
      s.textContent = old.textContent || "";
    }
    return s;
  }

  const keptBodyScripts = Array.from(
    document.body.querySelectorAll("script[data-keep]")
  ).map((old) => recreateScript(old));

  // --- 4) Fetch and parse the template ---
  const res = await fetch(TEMPLATE_URL, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to load template: ${res.status} ${res.statusText}`);
  }
  const html = await res.text();
  const tpl = new DOMParser().parseFromString(html, "text/html");

  // --- 5) Replace HEAD with template HEAD, then re-append kept head nodes ---
  // Prefer a kept title[data-keep] if present; otherwise use template's title.
  const keptTitle = keptHeadNodes.find((n) => n.tagName === "TITLE");
  if (keptTitle) {
    document.title = keptTitle.textContent || document.title;
  } else if (tpl.title) {
    document.title = tpl.title;
  }

  document.head.innerHTML = tpl.head.innerHTML;

  // Append preserved head nodes (skip title since we already set document.title)
  keptHeadNodes.forEach((n) => {
    if (n.tagName !== "TITLE") document.head.appendChild(n);
  });

  // --- 6) Replace BODY with template BODY and insert preserved <main> ---
  document.body.innerHTML = tpl.body.innerHTML;

  const slot = document.getElementById("content-slot");
  (slot || document.body).replaceChildren(keptMain);

  // --- 7) Re-attach preserved BODY scripts so they execute after wrapping ---
  keptBodyScripts.forEach((s) => document.body.appendChild(s));

  // --- 8) Optional nicety: mark active nav item based on current path ---
  const path = location.pathname.replace(/\/index\.html?$/, "/");
  document.querySelectorAll('header nav a[href]').forEach((a) => {
    const href = a.getAttribute("href");
    if (!href) return;
    const url = new URL(href, location.origin);
    if (url.pathname === path) a.setAttribute("aria-current", "page");
  });
})().catch(console.error);
