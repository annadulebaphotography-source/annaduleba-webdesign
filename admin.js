import {
  auth,
  updateDoc,
  setDoc,
  onAuthStateChanged
} from "./firebase.js?v=firestore-longpoll-1";
import { firebaseProjectId } from "./firebase.js?v=firestore-longpoll-1";
import { currentPageId, pageRef } from "./content.js?v=local-first-3";

const CLOUDINARY_CLOUD_NAME = "dqmda8upo";
const CLOUDINARY_UPLOAD_PRESET = "anna_cms_unsigned";

const ADMIN_EMAILS = [
  "annadulebaphotography@gmail.com",
  "studio@annaduleba-webdesign.de"
];

function isAdmin(user) {
  if (!user?.email) return false;
  return ADMIN_EMAILS.map((email) => email.toLowerCase()).includes(user.email.toLowerCase());
}

let activeUser = null;
let editing = false;
let saveTimer = null;
let unauthorizedNoticeShown = false;
let imageDragState = null;
let suppressImageClick = false;

function withTimeout(promise, timeoutMs, label) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(new Error(`${label} dauert zu lange. Lokale Kopie wurde behalten.`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => window.clearTimeout(timeoutId));
}

function logCmsStep(step, payload = {}) {
  console.info(`[CMS] ${step}`, {
    projectId: firebaseProjectId,
    pageId: currentPageId,
    ...payload
  });
}

function logCmsError(step, error, payload = {}) {
  console.error(`[CMS] ${step} failed`, {
    projectId: firebaseProjectId,
    pageId: currentPageId,
    code: error?.code || "",
    message: error?.message || String(error),
    error,
    ...payload
  });
}

function cmsNodes() {
  return [...document.querySelectorAll("[data-cms]")];
}

function imageNodes() {
  return [...document.querySelectorAll("[data-cms-image]")];
}

function allEditableNodes() {
  return [...cmsNodes(), ...imageNodes()];
}

function localCacheKey() {
  return `cmsLocal:${firebaseProjectId}:${currentPageId}`;
}

function readLocalCache() {
  try {
    return JSON.parse(window.localStorage.getItem(localCacheKey()) || "{}");
  } catch {
    return {};
  }
}

function cleanCacheForStorage(cache) {
  return Object.fromEntries(
    Object.entries(cache).filter(([, value]) => {
      if (typeof value !== "string") return true;
      if (value.startsWith("blob:")) return false;
      if (value.startsWith("data:image/")) return false;
      return true;
    })
  );
}

function writeLocalCache(update) {
  const nextCache = { ...cleanCacheForStorage(readLocalCache()), ...update };
  try {
    window.localStorage.setItem(localCacheKey(), JSON.stringify(nextCache));
    return true;
  } catch (error) {
    console.warn("Local CMS cache could not be written:", error);
    try {
      const compactUpdate = Object.fromEntries(
        Object.entries(update).filter(([key, value]) => key.endsWith("Position") || !String(value).startsWith("data:image/"))
      );
      window.localStorage.setItem(localCacheKey(), JSON.stringify({ ...cleanCacheForStorage(readLocalCache()), ...compactUpdate }));
      return true;
    } catch (fallbackError) {
      console.warn("Compact local CMS cache could not be written:", fallbackError);
      return false;
    }
  }
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

async function storeLocalImage(key, dataUrl) {
  const id = `${currentPageId}:${key}`;
  try {
    const db = await openImageDb();
    await new Promise((resolve, reject) => {
      const request = db.transaction("images", "readwrite").objectStore("images").put(dataUrl, id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    return `idb:${id}`;
  } catch (error) {
    console.warn("IndexedDB image cache failed:", error);
    return dataUrl;
  }
}

async function rememberLocalImage(target, dataUrl) {
  const key = target.dataset.cmsImage;
  const positionKey = `${key}Position`;
  const position = target.dataset.imagePosition || "50% 50%";
  const storedReference = await storeLocalImage(key, dataUrl);
  rememberImageReference(target, storedReference);
  writeLocalCache({ [key]: storedReference, [positionKey]: position });
  return storedReference;
}

async function persistPatch(update) {
  const savedLocally = writeLocalCache(update);
  logCmsStep("Firestore save start", { keys: Object.keys(update), savedLocally });
  try {
    await withTimeout(setDoc(pageRef, update, { merge: true }), 9000, "Firestore-Speichern");
    logCmsStep("Firestore save success", { keys: Object.keys(update) });
    return { online: true, local: savedLocally };
  } catch (error) {
    logCmsError("Firestore save", error, { keys: Object.keys(update), savedLocally });
    return { online: false, local: savedLocally };
  }
}

function ensureLoginButton() {
  if (activeUser || document.querySelector(".cms-adminbar")) return;
  const isLocalPreview = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  const showLogin =
    isLocalPreview ||
    new URLSearchParams(window.location.search).has("admin") ||
    window.localStorage.getItem("showCmsLogin") === "1";

  if (!showLogin || document.querySelector(".cms-login")) return;
  window.localStorage.setItem("showCmsLogin", "1");

  const panel = document.createElement("div");
  panel.className = "cms-login";
  panel.innerHTML = `
    <button type="button" class="cms-login__toggle" aria-expanded="false">Admin</button>
    <div class="cms-login__body">
      <strong>Admin</strong>
      <button type="button" class="cms-login__google">Mit Google anmelden</button>
      <form class="cms-login__form">
        <input name="email" type="email" placeholder="E-Mail" autocomplete="username" required>
        <input name="password" type="password" placeholder="Passwort" autocomplete="current-password" required>
        <button type="submit">Einloggen</button>
      </form>
    </div>
  `;

  const toggle = panel.querySelector(".cms-login__toggle");
  toggle.addEventListener("click", () => {
    const isOpen = panel.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  });
  panel.querySelector(".cms-login__google").addEventListener("click", () => window.loginGoogle?.());
  panel.querySelector(".cms-login__form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    window.loginEmail?.(form.email.value.trim(), form.password.value);
  });

  document.body.appendChild(panel);
}

function ensureToolbar() {
  let bar = document.querySelector(".cms-adminbar");
  if (bar) return bar;

  bar = document.createElement("div");
  bar.className = "cms-adminbar";
  bar.innerHTML = `
    <span class="cms-adminbar__status">Admin mode</span>
    <button type="button" class="cms-adminbar__edit">Bearbeiten</button>
    <button type="button" class="cms-adminbar__save" hidden>Speichern</button>
    <button type="button" class="cms-adminbar__cancel" hidden>Fertig</button>
    <button type="button" class="cms-adminbar__logout">Logout</button>
  `;
  document.body.appendChild(bar);

  bar.querySelector(".cms-adminbar__edit").addEventListener("click", () => setEditing(true));
  bar.querySelector(".cms-adminbar__cancel").addEventListener("click", () => setEditing(false));
  bar.querySelector(".cms-adminbar__save").addEventListener("click", saveContent);
  bar.querySelector(".cms-adminbar__logout").addEventListener("click", () => window.logoutGoogle?.());
  return bar;
}

function setToolbarState() {
  const bar = ensureToolbar();
  bar.classList.toggle("is-editing", editing);
  bar.querySelector(".cms-adminbar__edit").hidden = editing;
  bar.querySelector(".cms-adminbar__save").hidden = !editing;
  bar.querySelector(".cms-adminbar__cancel").hidden = !editing;
}

function makeEditable(el) {
  if (el.dataset.cmsImage !== undefined) {
    el.classList.toggle("cms-editable-image", editing);
    return;
  }
  if (el.matches("input, textarea")) el.readOnly = !editing;
  else el.contentEditable = editing ? "true" : "false";
  el.classList.toggle("cms-editable", editing);
}

function setEditing(nextState) {
  editing = nextState;
  allEditableNodes().forEach(makeEditable);
  document.body.classList.toggle("cms-editing", editing);
  setToolbarState();
}

function collectContent() {
  const data = cmsNodes().reduce((acc, el) => {
    const key = el.dataset.cms;
    if (!key) return acc;
    acc[key] = el.matches("input, textarea") ? el.value.trim() : el.textContent.trim();
    return acc;
  }, {});

  imageNodes().forEach((el) => {
    const key = el.dataset.cmsImage;
    if (!key) return;
    const imageReference = el.dataset.savedImageReference || el.dataset.imageUrl || "";
    if (imageReference && !imageReference.startsWith("blob:") && !imageReference.startsWith("data:image/")) {
      data[key] = imageReference;
    }
    data[`${key}Position`] = el.dataset.imagePosition || el.style.backgroundPosition || "50% 50%";
  });

  return data;
}

function applyImageToElement(target, url) {
  target.dataset.imageUrl = url;
  target.style.backgroundImage = `url("${url}")`;
  if (!target.dataset.imagePosition) {
    target.dataset.imagePosition = "50% 50%";
    target.style.backgroundPosition = "50% 50%";
  }
  const img = target.matches("img") ? target : target.querySelector("img");
  if (img) img.src = url;
}

function rememberImageReference(target, reference) {
  if (!target?.dataset?.cmsImage || typeof reference !== "string" || reference === "" || reference.startsWith("blob:")) return;
  target.dataset.savedImageReference = reference;
}

function readPosition(target) {
  const value = target.dataset.imagePosition || target.style.backgroundPosition || "50% 50%";
  const [x = "50%", y = "50%"] = value.split(" ");
  return {
    x: Number.parseFloat(x) || 50,
    y: Number.parseFloat(y) || 50
  };
}

function setImagePosition(target, x, y) {
  const nextX = Math.max(0, Math.min(100, x));
  const nextY = Math.max(0, Math.min(100, y));
  const value = `${nextX.toFixed(1)}% ${nextY.toFixed(1)}%`;
  target.dataset.imagePosition = value;
  target.style.backgroundPosition = value;
}

async function prepareImageForUpload(file) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Bitte eine Bilddatei auswaehlen.");
  }

  const image = new Image();
  const previewUrl = URL.createObjectURL(file);

  try {
    image.src = previewUrl;
    await image.decode();

    const maxSide = 1100;
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { alpha: true });
    ctx.drawImage(image, 0, 0, width, height);

    const type = "image/jpeg";
    const quality = 0.72;
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, type, quality));
    if (!blob) throw new Error("Bild konnte nicht verarbeitet werden.");

    const baseName = file.name.replace(/\.[^.]+$/, "") || "bild";
    const dataUrl = canvas.toDataURL(type, quality);
    return {
      file: new File([blob], `${baseName}.jpg`, { type }),
      dataUrl
    };
  } finally {
    URL.revokeObjectURL(previewUrl);
  }
}

async function uploadImageToCloudinary(file, key) {
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
    throw new Error("Cloudinary Upload ist noch nicht konfiguriert.");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
    method: "POST",
    body: formData
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result?.error?.message || `Cloudinary Upload fehlgeschlagen (${response.status})`);
  }

  return result.secure_url;
}

async function saveContent() {
  if (!activeUser) return;
  const bar = ensureToolbar();
  const status = bar.querySelector(".cms-adminbar__status");
  const saveButton = bar.querySelector(".cms-adminbar__save");

  try {
    saveButton.disabled = true;
    status.textContent = "Speichert...";
    const data = collectContent();
    writeLocalCache(data);
    try {
      await withTimeout(updateDoc(pageRef, data), 9000, "Firestore-Speichern");
    } catch (error) {
      if (error?.code !== "not-found") throw error;
      await withTimeout(setDoc(pageRef, data, { merge: true }), 9000, "Firestore-Speichern");
    }
    status.textContent = "Gespeichert";
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => { status.textContent = "Admin mode"; }, 1800);
  } catch (error) {
    console.warn("Firestore content save failed, local copy was kept:", error);
    status.textContent = "Lokal gespeichert";
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => { status.textContent = "Admin mode"; }, 2200);
  } finally {
    saveButton.disabled = false;
  }
}

function enableAdmin(user) {
  activeUser = user;
  document.body.classList.add("cms-admin");
  document.querySelector(".cms-login")?.remove();
  ensureToolbar();
  setEditing(false);
}

function disableAdmin() {
  activeUser = null;
  editing = false;
  document.body.classList.remove("cms-admin", "cms-editing");
  allEditableNodes().forEach(makeEditable);
  document.querySelector(".cms-adminbar")?.remove();
  ensureLoginButton();
}

onAuthStateChanged(auth, async (user) => {
  if (isAdmin(user)) {
    unauthorizedNoticeShown = false;
    enableAdmin(user);
    return;
  }

  disableAdmin();

  if (user) {
    await window.logoutGoogle?.();
    if (!unauthorizedNoticeShown) {
      unauthorizedNoticeShown = true;
      alert("Dieses Konto ist nicht als Admin freigegeben. Bitte mit studio@annaduleba-webdesign.de anmelden.");
    }
  }
});

document.addEventListener("DOMContentLoaded", ensureLoginButton);

document.addEventListener("keydown", (event) => {
  if (event.ctrlKey && event.altKey && event.key.toLowerCase() === "a") {
    window.localStorage.setItem("showCmsLogin", "1");
    ensureLoginButton();
  }
});

document.addEventListener("click", (event) => {
  if (!editing) return;
  const editableLink = event.target.closest("a[data-cms]");
  if (editableLink) event.preventDefault();
}, true);

document.addEventListener("click", async (event) => {
  if (!editing || !activeUser) return;
  const target = event.target.closest("[data-cms-image]");
  if (!target) return;

  event.preventDefault();
  if (suppressImageClick) {
    suppressImageClick = false;
    return;
  }
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";

  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return;

    const bar = ensureToolbar();
    const status = bar.querySelector(".cms-adminbar__status");
    const localPreviewUrl = URL.createObjectURL(file);
    applyImageToElement(target, localPreviewUrl);
    status.textContent = "Bild wird vorbereitet...";

    try {
      const prepared = await prepareImageForUpload(file);
      status.textContent = "Bild wird hochgeladen...";
      const uploadFile = prepared.file;
      logCmsStep("Cloudinary upload start", {
        key: target.dataset.cmsImage,
        cloudName: CLOUDINARY_CLOUD_NAME,
        uploadPreset: CLOUDINARY_UPLOAD_PRESET,
        fileName: uploadFile.name,
        fileType: uploadFile.type,
        fileSize: uploadFile.size
      });
      const url = await uploadImageToCloudinary(uploadFile, target.dataset.cmsImage);
      logCmsStep("Cloudinary upload success", { key: target.dataset.cmsImage, url });
      const positionKey = `${target.dataset.cmsImage}Position`;
      const position = target.dataset.imagePosition || "50% 50%";
      applyImageToElement(target, url);
      rememberImageReference(target, url);
      writeLocalCache({ [target.dataset.cmsImage]: url, [positionKey]: position });
      const saveResult = await persistPatch({ [target.dataset.cmsImage]: url, [positionKey]: position });
      status.textContent = saveResult.online ? "Bild gespeichert" : "Bild lokal gespeichert";
    } catch (error) {
      logCmsError("Image upload flow", error, { key: target.dataset.cmsImage });
      try {
        const prepared = await prepareImageForUpload(file);
        applyImageToElement(target, prepared.dataUrl);
        await rememberLocalImage(target, prepared.dataUrl);
        status.textContent = "Bild lokal gespeichert";
      } catch (fallbackError) {
        logCmsError("Image fallback save", fallbackError, { key: target.dataset.cmsImage });
        status.textContent = "Bild konnte nicht gespeichert werden";
        alert(`Bild-Upload nicht moeglich: ${error?.code || error?.message || "Firebase Storage pruefen"}`);
      }
    } finally {
      URL.revokeObjectURL(localPreviewUrl);
    }
  });

  input.click();
});

document.addEventListener("pointerdown", (event) => {
  if (!editing || !activeUser) return;
  const target = event.target.closest("[data-cms-image]");
  if (!target || !target.dataset.imageUrl) return;
  if (event.target.closest("button, a, input, textarea")) return;

  const position = readPosition(target);
  imageDragState = {
    target,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    initialX: position.x,
    initialY: position.y,
    moved: false
  };
  target.setPointerCapture?.(event.pointerId);
}, true);

document.addEventListener("pointermove", (event) => {
  if (!imageDragState || imageDragState.pointerId !== event.pointerId) return;
  const state = imageDragState;
  const rect = state.target.getBoundingClientRect();
  const dx = ((event.clientX - state.startX) / Math.max(1, rect.width)) * 100;
  const dy = ((event.clientY - state.startY) / Math.max(1, rect.height)) * 100;

  if (Math.abs(event.clientX - state.startX) + Math.abs(event.clientY - state.startY) > 4) {
    state.moved = true;
    suppressImageClick = true;
  }

  setImagePosition(state.target, state.initialX + dx, state.initialY + dy);
  ensureToolbar().querySelector(".cms-adminbar__status").textContent = "Bildposition geaendert";
  event.preventDefault();
}, true);

document.addEventListener("pointerup", async (event) => {
  if (!imageDragState || imageDragState.pointerId !== event.pointerId) return;
  const state = imageDragState;
  imageDragState = null;

  if (!state.moved) return;
  const key = `${state.target.dataset.cmsImage}Position`;
  const value = state.target.dataset.imagePosition || "50% 50%";
  writeLocalCache({ [key]: value });

  const saveResult = await persistPatch({ [key]: value });
  ensureToolbar().querySelector(".cms-adminbar__status").textContent = saveResult.online
    ? "Bildposition gespeichert"
    : "Bildposition lokal gespeichert";
}, true);

// Prevent link navigation while editing editable button labels.
document.addEventListener("input", (event) => {
  if (!editing || !event.target.closest("[data-cms]")) return;
  ensureToolbar().querySelector(".cms-adminbar__status").textContent = "Ungespeicherte Aenderungen";
});
