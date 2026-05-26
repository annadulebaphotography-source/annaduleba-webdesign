import { db, doc, firebaseProjectId, getDoc } from "./firebase.js?v=firestore-longpoll-1";

const PAGE_ALIASES = {
  "": "home",
  "index": "home",
  "index.html": "home",
  "home": "home",
  "angebot": "angebot",
  "angebot.html": "angebot",
  "ueber-mich": "uber-mich",
  "ueber-mich.html": "uber-mich",
  "uber-mich": "uber-mich",
  "worum": "worum",
  "worum.html": "worum",
  "kontakt": "kontakt",
  "kontakt.html": "kontakt",
  "galerie": "galerie",
  "galerie.html": "galerie"
};

function inferPageId() {
  const fromBody = document.body?.dataset.page || "";
  const fileName = window.location.pathname.split("/").filter(Boolean).pop() || "index.html";
  return PAGE_ALIASES[fromBody] || PAGE_ALIASES[fileName] || fromBody || "home";
}

function ensureAutoCmsKeys() {
  const editableSelector = [
    "main h1",
    "main h2",
    "main h3",
    "main p",
    "main summary",
    "main a.btn"
  ].join(", ");

  [...document.querySelectorAll(editableSelector)].forEach((el, index) => {
    if (el.dataset.cms || el.dataset.cmsImage || el.closest("[data-no-cms]")) return;
    const base = el.tagName.toLowerCase().replace(/[^a-z0-9]/g, "");
    el.dataset.cms = `auto_${base}_${String(index + 1).padStart(3, "0")}`;
  });
}

function openImageDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("annaDulebaCmsImages", 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("images");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readStoredImage(key) {
  if (!key?.startsWith("idb:")) return key;
  const id = key.slice(4);
  const db = await openImageDb();
  return new Promise((resolve) => {
    const request = db.transaction("images", "readonly").objectStore("images").get(id);
    request.onsuccess = () => resolve(request.result || "");
    request.onerror = () => resolve("");
  });
}

function applyValue(el, value) {
  if (typeof value !== "string" || value === "") return;
  if (el.dataset.cmsImage !== undefined) {
    el.dataset.imageUrl = value;
    el.style.backgroundImage = `url("${value}")`;
    const img = el.matches("img") ? el : el.querySelector("img");
    if (img) img.src = value;
    return;
  }
  if (el.matches("input, textarea")) el.value = value;
  else el.textContent = value;
}

function applyImagePosition(el, value) {
  if (typeof value !== "string" || el.dataset.cmsImage === undefined) return;
  el.dataset.imagePosition = value;
  el.style.backgroundPosition = value;
}

function readFallbackContent() {
  return [...document.querySelectorAll("[data-cms], [data-cms-image]")].reduce((acc, el) => {
    const key = el.dataset.cms || el.dataset.cmsImage;
    if (!key) return acc;
    if (el.dataset.cmsImage !== undefined) {
      acc[key] = el.dataset.imageUrl || "";
      acc[`${key}Position`] = el.dataset.imagePosition || el.style.backgroundPosition || "50% 50%";
    } else {
      acc[key] = el.matches("input, textarea") ? el.value.trim() : el.textContent.trim();
    }
    return acc;
  }, {});
}

function readLocalContent() {
  try {
    return JSON.parse(window.localStorage.getItem(`cmsLocal:${firebaseProjectId}:${currentPageId}`) || "{}");
  } catch {
    return {};
  }
}

function pruneEmptyValues(data) {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => typeof value !== "string" || value !== "")
  );
}

async function resolveLocalContent(localData) {
  const resolved = {};

  for (const [key, value] of Object.entries(localData)) {
    if (typeof value !== "string" || value === "") continue;

    if (value.startsWith("idb:")) {
      const storedImage = await readStoredImage(value);
      if (!storedImage) continue;
      resolved[key] = storedImage;
    } else {
      if (value.startsWith("blob:") || value.startsWith("data:image/")) continue;
      resolved[key] = value;
    }
  }

  return resolved;
}

async function applyContentToNodes(nodes, data) {
  for (const el of nodes) {
    const key = el.dataset.cms || el.dataset.cmsImage;
    const rawValue = data[key];
    const value = el.dataset.cmsImage !== undefined ? await readStoredImage(rawValue) : rawValue;
    applyValue(el, value);
    if (el.dataset.cmsImage !== undefined) {
      if (typeof rawValue === "string" && rawValue && !rawValue.startsWith("blob:") && !rawValue.startsWith("data:image/")) {
        el.dataset.savedImageReference = rawValue;
      }
      applyImagePosition(el, data[`${key}Position`]);
    }
  }
}

function withTimeout(promise, timeoutMs, label) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(`${label} dauert zu lange.`)), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => window.clearTimeout(timeoutId));
}

export const currentPageId = inferPageId();
export const pageRef = doc(db, "pages", currentPageId);
export let currentPageData = {};

export async function loadPageContent() {
  ensureAutoCmsKeys();
  const editableNodes = document.querySelectorAll("[data-cms], [data-cms-image]");
  if (!editableNodes.length) return {};

  const fallbackData = pruneEmptyValues(readFallbackContent());
  const localData = await resolveLocalContent(readLocalContent());
  currentPageData = { ...fallbackData, ...localData };
  await applyContentToNodes(editableNodes, currentPageData);
  document.dispatchEvent(new CustomEvent("cms:local-content-loaded", { detail: currentPageData }));

  try {
    const snap = await withTimeout(getDoc(pageRef), 5000, "Firestore-Laden");
    if (!snap.exists()) {
      document.dispatchEvent(new CustomEvent("cms:content-loaded", { detail: currentPageData }));
      return currentPageData;
    }

    currentPageData = { ...fallbackData, ...(snap.data() || {}), ...localData };
    await applyContentToNodes(editableNodes, currentPageData);
    document.dispatchEvent(new CustomEvent("cms:content-loaded", { detail: currentPageData }));
    return currentPageData;
  } catch (error) {
    console.error("Firestore content load failed:", error);
    document.dispatchEvent(new CustomEvent("cms:content-error", { detail: error }));
    return currentPageData;
  }
}

document.addEventListener("DOMContentLoaded", loadPageContent);
