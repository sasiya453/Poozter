import { useEffect, useRef, useState, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface EmojiData {
  id: string;
  url: string;
  fallback: string;
}



// ─── Constants ────────────────────────────────────────────────────────────────
const DEFAULT_PACKS = [
  "NewsEmoji",
  "Udif7rr7_by_fStikBot",
  "OutlineEmoji",
  "FinanceEmoji",
  "FlameEmoji",
  "PremiumIcons",
];

const SUN_SVG = (
  <>
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </>
);

const MOON_SVG = <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getLuminance(hex: string): number {
  if (!hex || !hex.startsWith("#")) return 255;
  const c = hex.substring(1);
  const rgb = parseInt(c, 16);
  return (
    0.2126 * ((rgb >> 16) & 0xff) +
    0.7152 * ((rgb >> 8) & 0xff) +
    0.0722 * (rgb & 0xff)
  );
}

/** Extract the FIRST unicode scalar value (handles surrogate pairs & multi-codepoint seqs) */
function firstCodepoint(str: string): string {
  if (!str) return "😀";
  // Use spread to correctly split by Unicode code points
  const points = [...str];
  // Return only the first emoji/codepoint as the canonical fallback
  return points[0] ?? "😀";
}

/** Parse editor innerHTML into Telegram HTML */
function parseNodeToTgHtml(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? "";
  }
  const el = node as HTMLElement;
  const inner = Array.from(el.childNodes).map(parseNodeToTgHtml).join("");

  switch (el.nodeName) {
    case "B":
    case "STRONG":
      return `<b>${inner}</b>`;
    case "I":
    case "EM":
      return `<i>${inner}</i>`;
    case "U":
      return `<u>${inner}</u>`;
    case "S":
    case "STRIKE":
    case "DEL":
      return `<s>${inner}</s>`;
    case "A": {
      const href = (el as HTMLAnchorElement).href;
      return `<a href="${href}">${inner}</a>`;
    }
    case "CODE":
      return `<code>${inner}</code>`;
    case "PRE":
      return `<pre>${inner}</pre>`;
    case "BLOCKQUOTE":
      return `<blockquote>${inner}</blockquote>`;
    case "SPAN":
      if (el.classList.contains("tg-spoiler"))
        return `<tg-spoiler>${inner}</tg-spoiler>`;
      return inner;
    case "IMG": {
      const id = el.getAttribute("data-tg-id");
      // Use only the stored single-codepoint fallback
      const fallback = el.getAttribute("data-tg-fallback") ?? "😀";
      return id ? `<tg-emoji emoji-id="${id}">${fallback}</tg-emoji>` : "";
    }
    case "DIV":
    case "P":
      return `\n${inner}`;
    case "BR":
      return "\n";
    default:
      return inner;
  }
}

function buildTgHtml(editorEl: HTMLElement): string {
  const clone = editorEl.cloneNode(true) as HTMLElement;
  return Array.from(clone.childNodes)
    .map(parseNodeToTgHtml)
    .join("")
    .replace(/^\n+/, "")
    .trimEnd();
}

/** Count characters (emojis count as 1) */
function countChars(editorEl: HTMLElement): number {
  const clone = editorEl.cloneNode(true) as HTMLElement;
  // Replace each tg-emoji img with a single placeholder char
  clone.querySelectorAll("img[data-tg-id]").forEach((img) => {
    img.replaceWith("X");
  });
  return (clone.textContent ?? "").length;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function IconSvg({
  children,
  size = 18,
}: {
  children: React.ReactNode;
  size?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: size, height: size }}
    >
      {children}
    </svg>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ message }: { message: string }) {
  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        left: "50%",
        transform: "translateX(-50%)",
        background: "var(--text-1)",
        color: "var(--surface)",
        padding: "10px 18px",
        borderRadius: 100,
        fontSize: 13,
        fontWeight: 600,
        zIndex: 9999,
        pointerEvents: "none",
        whiteSpace: "nowrap",
        boxShadow: "var(--shadow-lg)",
        animation: "toastIn 0.3s cubic-bezier(0.34,1.56,0.64,1) both",
      }}
    >
      {message}
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function Modal({
  open,
  onClose,
  title,
  subtitle,
  icon,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-overlay active visible"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal-content">
        <div className="modal-header">
          <h3>
            {icon}
            {title}
          </h3>
          <button className="close-modal-btn" onClick={onClose}>
            <IconSvg size={14}>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </IconSvg>
          </button>
        </div>
        {subtitle && <p className="modal-subtitle">{subtitle}</p>}
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  // ── Theme ──
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved = localStorage.getItem("poozter_theme");
    if (saved === "light" || saved === "dark") return saved;
    const tgBg = (window as any).Telegram?.WebApp?.themeParams?.bg_color;
    if (tgBg) return getLuminance(tgBg) < 128 ? "dark" : "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("poozter_theme", theme);
  }, [theme]);

  // ── TG User ──
  const tgUser = (window as any).Telegram?.WebApp?.initDataUnsafe?.user;
  const userName = tgUser
    ? ((tgUser.first_name ?? "") + " " + (tgUser.last_name ?? "")).trim()
    : "Creator";
  const userInitial = (tgUser?.first_name ?? "U").substring(0, 1).toUpperCase();
  const photoUrl: string | null = tgUser?.photo_url ?? null;
  const hours = new Date().getHours();
  const greeting =
    hours < 12 ? "Good morning," : hours < 18 ? "Good afternoon," : "Good evening,";

  // ── Toast ──
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((msg: string, duration = 2200) => {
    setToastMsg(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), duration);
  }, []);

  // ── Editor ──
  const editorRef = useRef<HTMLDivElement>(null);
  const [charCount, setCharCount] = useState(0);
  const [saveState, setSaveState] = useState<"saved" | "saving">("saved");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedSelRef = useRef<Range | null>(null);

  // ── Copy state ──
  const [copySuccess, setCopySuccess] = useState(false);

  // ── Packs ──
  const [savedPacks, setSavedPacksState] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem("tg_saved_packs");
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : [...DEFAULT_PACKS];
    } catch {
      return [...DEFAULT_PACKS];
    }
  });

  const [recentEmojis, setRecentEmojisState] = useState<EmojiData[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("tg_recent_emojis") ?? "[]") ?? [];
    } catch {
      return [];
    }
  });


  // activeTab: "recent" | packName
  const [activeTab, setActiveTab] = useState<string>("recent");
  // packData: map packName -> sticker list
  const [packDataMap, setPackDataMap] = useState<
    Record<string, { ok: boolean; stickers?: any[]; error?: string }>
  >({});

  // ── Modals ──
  const [addPackOpen, setAddPackOpen] = useState(false);
  const [addLinkOpen, setAddLinkOpen] = useState(false);
  const [packInputVal, setPackInputVal] = useState("");
  const [linkInputVal, setLinkInputVal] = useState("");
  const packInputRef = useRef<HTMLInputElement>(null);
  const linkInputRef = useRef<HTMLInputElement>(null);

  // ── Confirm dialog state (replaces browser confirm) ──
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    message: string;
    onYes: () => void;
  }>({ open: false, message: "", onYes: () => {} });

  function showConfirm(message: string, onYes: () => void) {
    const tgApp = (window as any).Telegram?.WebApp;
    if (tgApp?.showConfirm) {
      tgApp.showConfirm(message, (agreed: boolean) => {
        if (agreed) onYes();
      });
    } else {
      setConfirmState({ open: true, message, onYes });
    }
  }

  // ── Init ──
  useEffect(() => {
    const tgApp = (window as any).Telegram?.WebApp;
    if (tgApp) {
      tgApp.ready();
      tgApp.expand();
    }

    // Load draft
    const draft = localStorage.getItem("poozter_draft");
    if (draft && editorRef.current) {
      editorRef.current.innerHTML = draft;
      updateCounter();
    }
  }, []);

  // Persist packs
  useEffect(() => {
    localStorage.setItem("tg_saved_packs", JSON.stringify(savedPacks));
  }, [savedPacks]);

  useEffect(() => {
    localStorage.setItem("tg_recent_emojis", JSON.stringify(recentEmojis));
  }, [recentEmojis]);

  // ── Counter & Save ──
  function updateCounter() {
    if (!editorRef.current) return;
    setCharCount(countChars(editorRef.current));
  }

  function handleEditorChange() {
    updateCounter();
    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (editorRef.current) {
        localStorage.setItem("poozter_draft", editorRef.current.innerHTML);
      }
      setSaveState("saved");
    }, 800);
  }

  // ── Format commands ──
  function execCmd(cmd: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value ?? undefined);
    handleEditorChange();
  }

  function toggleCustomFormat(formatType: "blockquote" | "code" | "tg-spoiler") {
    const ed = editorRef.current;
    if (!ed) return;
    ed.focus();
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;

    // Walk up from anchor to see if we're inside this format already
    let node: Node | null = sel.anchorNode;
    while (node && node !== ed) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        const match =
          (formatType === "tg-spoiler" && el.classList?.contains("tg-spoiler")) ||
          (formatType === "code" && el.tagName === "CODE") ||
          (formatType === "blockquote" && el.tagName === "BLOCKQUOTE");
        if (match) {
          // Unwrap
          const parent = el.parentNode!;
          while (el.firstChild) parent.insertBefore(el.firstChild, el);
          parent.removeChild(el);
          handleEditorChange();
          return;
        }
      }
      node = node.parentNode;
    }

    const range = sel.getRangeAt(0);
    let wrapper: HTMLElement;
    if (formatType === "tg-spoiler") {
      wrapper = document.createElement("span");
      wrapper.className = "tg-spoiler";
    } else {
      wrapper = document.createElement(formatType);
    }

    try {
      range.surroundContents(wrapper);
      handleEditorChange();
    } catch {
      const txt = range.toString();
      if (txt) {
        const tag = wrapper.tagName.toLowerCase();
        const cls = wrapper.className ? ` class="${wrapper.className}"` : "";
        document.execCommand("insertHTML", false, `<${tag}${cls}>${txt}</${tag}>`);
        handleEditorChange();
      }
    }
  }

  function removeCustomFormats() {
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) {
      document.execCommand("insertText", false, sel.toString());
    }
  }

  function insertDate() {
    document.execCommand("insertText", false, new Date().toLocaleString());
    editorRef.current?.focus();
    handleEditorChange();
  }

  // ── Clear text ──
  function clearText() {
    showConfirm("Clear all editor content?", () => {
      if (editorRef.current) {
        editorRef.current.innerHTML = "";
        handleEditorChange();
        showToast("🗑️ Editor cleared");
      }
    });
  }

  // ── Undo / Redo ──
  function undo() {
    editorRef.current?.focus();
    document.execCommand("undo");
    handleEditorChange();
  }
  function redo() {
    editorRef.current?.focus();
    document.execCommand("redo");
    handleEditorChange();
  }

  // ── Link ──
  function openLinkModal() {
    editorRef.current?.focus();
    const sel = window.getSelection();
    if (sel && sel.rangeCount) savedSelRef.current = sel.getRangeAt(0).cloneRange();
    setLinkInputVal("");
    setAddLinkOpen(true);
    setTimeout(() => linkInputRef.current?.focus(), 80);
  }

  function confirmInsertLink() {
    const url = linkInputVal.trim();
    setAddLinkOpen(false);
    if (url) {
      setTimeout(() => {
        const ed = editorRef.current;
        if (!ed) return;
        ed.focus();
        const sel = window.getSelection();
        if (sel) {
          sel.removeAllRanges();
          if (savedSelRef.current) sel.addRange(savedSelRef.current);
        }
        document.execCommand("createLink", false, url);
        handleEditorChange();
      }, 100);
    }
  }

  // ── Copy HTML ──
  async function copyAndGenerateHTML() {
    const ed = editorRef.current;
    if (!ed) return;
    const html = buildTgHtml(ed);
    if (!html) {
      showToast("⚠️ Editor is empty!");
      return;
    }
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(html);
      } else {
        const ta = document.createElement("textarea");
        ta.value = html;
        ta.style.cssText = "position:fixed;opacity:0;top:0;left:0;";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopySuccess(true);
      showToast("✅ HTML copied to clipboard");
      setTimeout(() => setCopySuccess(false), 2200);
    } catch {
      showToast("❌ Copy failed");
    }
  }

  // ── Keyboard shortcuts ──
  function handleEditorKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const ctrl = e.ctrlKey || e.metaKey;
    if (!ctrl) return;
    const key = e.key.toLowerCase();
    if (e.shiftKey) {
      if (key === "x") { e.preventDefault(); execCmd("strikeThrough"); }
      else if (key === ">" || e.key === ".") { e.preventDefault(); toggleCustomFormat("blockquote"); }
      else if (key === "m") { e.preventDefault(); toggleCustomFormat("code"); }
      else if (key === "p") { e.preventDefault(); toggleCustomFormat("tg-spoiler"); }
      else if (key === "d") { e.preventDefault(); insertDate(); }
      else if (key === "n") { e.preventDefault(); execCmd("removeFormat"); removeCustomFormats(); }
      else if (key === "z") { e.preventDefault(); redo(); }
    } else {
      if (key === "b") { e.preventDefault(); execCmd("bold"); }
      else if (key === "i") { e.preventDefault(); execCmd("italic"); }
      else if (key === "u") { e.preventDefault(); execCmd("underline"); }
      else if (key === "k") { e.preventDefault(); openLinkModal(); }
      else if (key === "z") { e.preventDefault(); undo(); }
      else if (key === "y") { e.preventDefault(); redo(); }
    }
  }

  // ── Paste handler — strips unwanted HTML, keeps structure ──
  function handlePaste(e: React.ClipboardEvent<HTMLDivElement>) {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    if (text) {
      document.execCommand("insertText", false, text);
      handleEditorChange();
    }
  }

  // ── Emoji / Pack system ──
  function addToRecent(emojiData: EmojiData) {
    setRecentEmojisState((prev) => {
      const next = [emojiData, ...prev.filter((e) => e.id !== emojiData.id)].slice(0, 32);
      return next;
    });
  }

  function insertEmoji(emojiData: EmojiData) {
    const ed = editorRef.current;
    if (!ed) return;
    ed.focus();
    // Use a single fallback codepoint so the <tg-emoji> tag has exactly one char
    const singleFallback = firstCodepoint(emojiData.fallback);
    document.execCommand(
      "insertHTML",
      false,
      `<img src="${emojiData.url}" alt="${singleFallback}" data-tg-id="${emojiData.id}" data-tg-fallback="${singleFallback}" style="width:24px;height:24px;vertical-align:middle;margin:0 1px;border-radius:4px;">`
    );
    addToRecent({ ...emojiData, fallback: singleFallback });
    handleEditorChange();
  }

  async function loadPackData(packName: string) {
    setActiveTab(packName);
    if (packDataMap[packName]) return; // already loaded

    setPackDataMap((prev) => ({ ...prev, [packName]: { ok: false } }));

    try {
      const res = await fetch(`/api/getPack?name=${encodeURIComponent(packName)}`);
      const data = await res.json();

      if (!data.ok) {
        setPackDataMap((prev) => ({
          ...prev,
          [packName]: { ok: false, error: data.description ?? "Unknown error" },
        }));
        return;
      }

      setPackDataMap((prev) => ({
        ...prev,
        [packName]: { ok: true, stickers: data.result.stickers },
      }));
    } catch {
      setPackDataMap((prev) => ({
        ...prev,
        [packName]: { ok: false, error: "Network error. Check connection." },
      }));
    }
  }

  function handleTabClick(tab: string) {
    if (tab === "recent") {
      setActiveTab("recent");
    } else {
      loadPackData(tab);
    }
  }

  // ── Add pack ──
  function addNewPack() {
    const input = packInputVal.trim();
    if (!input) { showToast("⚠️ Enter a pack name or link"); return; }
    // Extract slug from t.me/addemoji/XXX or t.me/XXX
    const packName = input.split("/").pop()?.trim() ?? "";
    if (!packName) { showToast("⚠️ Invalid pack name"); return; }
    setSavedPacksState((prev) => {
      if (prev.includes(packName)) return prev;
      return [...prev, packName];
    });
    setAddPackOpen(false);
    setPackInputVal("");
    setTimeout(() => loadPackData(packName), 100);
  }

  // ── Remove pack ──
  function removePack(packName: string) {
    showConfirm(`Remove "${packName}" pack?`, () => {
      setSavedPacksState((prev) => prev.filter((p) => p !== packName));
      setPackDataMap((prev) => {
        const next = { ...prev };
        delete next[packName];
        return next;
      });
      if (activeTab === packName) setActiveTab("recent");
      setTimeout(() => editorRef.current?.focus(), 100);
    });
  }

  // ── Clear all data ──
  function clearAllData() {
    showConfirm("Remove all custom packs and recent emojis?", () => {
      setSavedPacksState([]);
      setRecentEmojisState([]);
      setPackDataMap({});
      setActiveTab("recent");
      localStorage.removeItem("tg_recent_emojis");
      showToast("🗑️ All data cleared");
      setTimeout(() => editorRef.current?.focus(), 100);
    });
  }

  // ── View pack in Telegram ──
  function viewPackInTelegram(packName: string) {
    const url = `https://t.me/addemoji/${packName}`;
    const tgApp = (window as any).Telegram?.WebApp;
    if (tgApp?.openTelegramLink) tgApp.openTelegramLink(url);
    else window.open(url, "_blank");
  }

  // ── Paste from clipboard ──
  async function pasteFromClipboard(setter: (v: string) => void) {
    try {
      const text = await navigator.clipboard.readText();
      setter(text);
    } catch {
      showToast("⚠️ Clipboard access denied — paste manually");
    }
  }

  // ── Emoji grid item renderer ──
  function renderStickerItem(sticker: any, _packName: string) {
    let fileId = sticker.file_id;
    let isVideo = sticker.is_video;

    // Animated stickers: fall back to thumbnail (static image)
    if (sticker.is_animated && sticker.thumbnail) {
      fileId = sticker.thumbnail.file_id;
      isVideo = false;
    }

    const src = `/api/image?file_id=${encodeURIComponent(fileId)}`;
    // Use only the FIRST codepoint of the emoji field to avoid double-emoji bug
    const fallback = firstCodepoint(sticker.emoji ?? "😀");
    const emojiData: EmojiData = {
      id: sticker.custom_emoji_id ?? sticker.file_unique_id ?? fileId,
      url: src,
      fallback,
    };

    if (isVideo) {
      return (
        <video
          key={fileId}
          src={src}
          className="emoji-item"
          title={fallback}
          autoPlay
          loop
          muted
          playsInline
          onClick={() => insertEmoji(emojiData)}
        />
      );
    }
    return (
      <img
        key={fileId}
        src={src}
        className="emoji-item"
        alt={fallback}
        title={fallback}
        onClick={() => insertEmoji(emojiData)}
      />
    );
  }

  // ── Counter display ──
  const limit = charCount <= 1024 ? 1024 : 4096;
  const counterClass =
    charCount > 4096
      ? "char-counter danger"
      : charCount > 1024
      ? "char-counter warning"
      : "char-counter";
  const counterLabel =
    charCount > 4096
      ? "(Exceeded)"
      : charCount > 1024
      ? "(Text Only)"
      : "(Media)";

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        :root {
          --bg: #eef1f7;
          --surface: #ffffff;
          --surface-raised: #f8faff;
          --surface-float: rgba(255,255,255,0.85);
          --text-1: #0d1117;
          --text-2: #4a5568;
          --text-3: #9aa5b4;
          --accent: #3b82f6;
          --accent-2: #6366f1;
          --accent-glow: rgba(59,130,246,0.2);
          --accent-hover: #2563eb;
          --border: rgba(0,0,0,0.07);
          --border-strong: rgba(0,0,0,0.13);
          --toolbar-btn: rgba(0,0,0,0.04);
          --toolbar-hover: rgba(59,130,246,0.1);
          --spoiler-bg: #dde3ee;
          --danger: #ef4444;
          --danger-bg: rgba(239,68,68,0.08);
          --success: #22c55e;
          --warning: #f59e0b;
          --shadow-sm: 0 1px 3px rgba(0,0,0,0.06),0 1px 2px rgba(0,0,0,0.04);
          --shadow-md: 0 4px 16px rgba(0,0,0,0.07),0 2px 6px rgba(0,0,0,0.04);
          --shadow-lg: 0 20px 40px rgba(0,0,0,0.1),0 8px 16px rgba(0,0,0,0.06);
          --radius-sm: 8px;
          --radius-md: 12px;
          --radius-lg: 18px;
          --radius-xl: 24px;
          --modal-overlay: rgba(10,15,30,0.45);
          --transition: 0.2s cubic-bezier(0.4,0,0.2,1);
        }
        [data-theme="dark"] {
          --bg: #0b0f18;
          --surface: #131929;
          --surface-raised: #1a2235;
          --surface-float: rgba(19,25,41,0.92);
          --text-1: #f0f4ff;
          --text-2: #7c8fa8;
          --text-3: #3d5066;
          --accent: #4f8ef7;
          --accent-2: #7c7cf7;
          --accent-glow: rgba(79,142,247,0.18);
          --accent-hover: #3b7ef4;
          --border: rgba(255,255,255,0.06);
          --border-strong: rgba(255,255,255,0.12);
          --toolbar-btn: rgba(255,255,255,0.04);
          --toolbar-hover: rgba(79,142,247,0.12);
          --spoiler-bg: #1f2d44;
          --danger: #f87171;
          --danger-bg: rgba(248,113,113,0.1);
          --success: #4ade80;
          --warning: #fbbf24;
          --shadow-sm: 0 1px 3px rgba(0,0,0,0.3),0 1px 2px rgba(0,0,0,0.2);
          --shadow-md: 0 4px 16px rgba(0,0,0,0.35),0 2px 6px rgba(0,0,0,0.2);
          --shadow-lg: 0 20px 60px rgba(0,0,0,0.5),0 8px 24px rgba(0,0,0,0.3);
          --modal-overlay: rgba(0,0,0,0.7);
        }
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body,#root{height:100%;overflow:hidden}
        body{
          font-family:'DM Sans',-apple-system,BlinkMacSystemFont,sans-serif;
          background:var(--bg);color:var(--text-1);
          display:flex;justify-content:center;
          transition:background var(--transition),color var(--transition);
        }
        body::before{
          content:'';position:fixed;inset:0;
          background:radial-gradient(ellipse 80% 50% at 20% 10%,var(--accent-glow) 0%,transparent 60%),
                      radial-gradient(ellipse 60% 40% at 80% 90%,rgba(99,102,241,0.06) 0%,transparent 60%);
          pointer-events:none;z-index:0;
        }
        button,input{font-family:inherit;}
        #root{width:100%;display:flex;justify-content:center;}

        .main-wrapper{
          display:flex;gap:20px;width:100%;max-width:1240px;
          padding:20px;height:100%;position:relative;z-index:1;
        }
        .left-column{flex:1;display:flex;flex-direction:column;gap:14px;min-width:0;}

        /* Header */
        .top-header-card{
          background:var(--surface);border-radius:var(--radius-lg);
          padding:14px 20px;display:flex;justify-content:space-between;
          align-items:center;border:1px solid var(--border);
          box-shadow:var(--shadow-md);
          transition:background var(--transition),border-color var(--transition);
          animation:slideDown 0.4s cubic-bezier(0.34,1.56,0.64,1) both;
          flex-shrink:0;
        }
        @keyframes slideDown{from{opacity:0;transform:translateY(-12px)}to{opacity:1;transform:translateY(0)}}
        .header-user-info{display:flex;align-items:center;gap:14px;overflow:hidden;}
        .user-avatar-wrapper{position:relative;flex-shrink:0;}
        .user-avatar{width:44px;height:44px;border-radius:50%;object-fit:cover;border:2px solid var(--accent-glow);box-shadow:0 0 0 2px var(--accent-glow);transition:transform var(--transition);}
        .user-avatar:hover{transform:scale(1.05);}
        .user-avatar-placeholder{width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--accent-2));color:#fff;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;text-transform:uppercase;box-shadow:0 4px 12px var(--accent-glow);flex-shrink:0;}
        .status-dot{position:absolute;bottom:1px;right:1px;width:10px;height:10px;background:var(--success);border-radius:50%;border:2px solid var(--surface);animation:pulse-dot 2s ease infinite;}
        @keyframes pulse-dot{0%,100%{box-shadow:0 0 0 0 rgba(34,197,94,0.4)}50%{box-shadow:0 0 0 4px rgba(34,197,94,0)}}
        .header-text-block{display:flex;flex-direction:column;overflow:hidden;gap:1px;}
        .app-title{font-size:10px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:1.2px;opacity:0.8;}
        .greeting-line{font-size:15px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .greeting-text{color:var(--text-2);font-weight:400;margin-right:4px;}
        .user-name-text{color:var(--text-1);}
        .header-actions{display:flex;align-items:center;gap:10px;flex-shrink:0;}
        .icon-btn{background:var(--toolbar-btn);border:1px solid var(--border);color:var(--text-2);cursor:pointer;display:flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:var(--radius-sm);transition:all var(--transition);position:relative;overflow:hidden;}
        .icon-btn:hover{color:var(--accent);border-color:var(--accent);transform:translateY(-1px);box-shadow:0 4px 12px var(--accent-glow);}
        .icon-btn svg{width:18px;height:18px;position:relative;z-index:1;}
        .btn-copy-html{background:linear-gradient(135deg,var(--accent),var(--accent-2));color:white;border:none;padding:0 18px;height:38px;border-radius:var(--radius-sm);cursor:pointer;font-weight:600;font-size:13.5px;transition:all var(--transition);display:flex;align-items:center;gap:8px;box-shadow:0 4px 12px var(--accent-glow);position:relative;overflow:hidden;letter-spacing:0.2px;}
        .btn-copy-html:hover{transform:translateY(-1px);box-shadow:0 6px 20px var(--accent-glow);}
        .btn-copy-html.success{background:linear-gradient(135deg,var(--success),#16a34a);box-shadow:0 4px 12px rgba(34,197,94,0.3);}
        .btn-copy-html svg{width:16px;height:16px;}

        /* Editor */
        .editor-container{
          flex:1;background:var(--surface);border-radius:var(--radius-lg);
          box-shadow:var(--shadow-md);display:flex;flex-direction:column;
          overflow:hidden;border:1px solid var(--border);
          transition:background var(--transition),border-color var(--transition),box-shadow var(--transition);
          animation:slideUp 0.4s cubic-bezier(0.34,1.56,0.64,1) 0.05s both;
          min-height:0;
        }
        .editor-container:focus-within{border-color:var(--accent);box-shadow:var(--shadow-md),0 0 0 3px var(--accent-glow);}
        @keyframes slideUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        .toolbar{display:flex;gap:4px;padding:10px 16px;flex-wrap:wrap;background:var(--surface-raised);border-bottom:1px solid var(--border);align-items:center;transition:background var(--transition);flex-shrink:0;}
        .toolbar-btn{width:34px;height:34px;border:1px solid transparent;background:transparent;cursor:pointer;border-radius:var(--radius-sm);color:var(--text-2);display:flex;align-items:center;justify-content:center;transition:all var(--transition);position:relative;}
        .toolbar-btn:hover{background:var(--toolbar-hover);color:var(--accent);border-color:var(--border);transform:translateY(-1px);}
        .toolbar-btn:active{transform:translateY(0) scale(0.95);}
        .toolbar-btn svg{width:17px;height:17px;}
        .toolbar-btn.danger:hover{color:var(--danger);background:var(--danger-bg);border-color:var(--danger);}
        .toolbar-divider{width:1px;height:22px;background:var(--border-strong);margin:0 4px;border-radius:2px;}
        .toolbar-btn[title]:hover::after{content:attr(title);position:absolute;bottom:calc(100% + 6px);left:50%;transform:translateX(-50%);background:var(--text-1);color:var(--surface);font-size:11px;font-weight:500;padding:4px 8px;border-radius:6px;white-space:nowrap;pointer-events:none;z-index:100;letter-spacing:0.2px;box-shadow:var(--shadow-sm);}

        .editor{flex:1;padding:20px 24px;outline:none;font-size:15px;line-height:1.7;overflow-y:auto;color:var(--text-1);font-weight:400;transition:color var(--transition);min-height:0;}
        .editor img{width:24px;height:24px;vertical-align:middle;margin:0 1px;border-radius:4px;transition:transform var(--transition);}
        .editor img:hover{transform:scale(1.3);}
        .editor[data-placeholder]:empty:before{content:attr(data-placeholder);color:var(--text-3);pointer-events:none;display:block;font-style:italic;}
        .tg-spoiler{background:var(--spoiler-bg);color:transparent;border-radius:4px;padding:1px 4px;cursor:pointer;transition:all var(--transition);user-select:none;}
        .tg-spoiler:hover{color:var(--text-1);}
        .editor blockquote{border-left:3px solid var(--accent);padding:8px 14px;margin:10px 0;color:var(--text-2);font-style:italic;background:var(--accent-glow);border-radius:0 var(--radius-sm) var(--radius-sm) 0;}
        .editor code{font-family:'JetBrains Mono',monospace;background:var(--toolbar-btn);padding:2px 7px;border-radius:5px;color:var(--accent);font-size:0.875em;border:1px solid var(--border);}
        .editor a{color:var(--accent);}

        .editor-footer{display:flex;justify-content:space-between;align-items:center;padding:8px 16px;background:var(--surface-raised);border-top:1px solid var(--border);font-size:11px;font-weight:600;color:var(--text-3);transition:background var(--transition);flex-shrink:0;}
        .save-status{display:flex;align-items:center;gap:5px;transition:color var(--transition);}
        .char-counter{display:flex;align-items:center;gap:5px;transition:color var(--transition);}
        .char-counter.warning{color:var(--warning);}
        .char-counter.danger{color:var(--danger);}

        ::-webkit-scrollbar{width:5px;height:5px;}
        ::-webkit-scrollbar-track{background:transparent;}
        ::-webkit-scrollbar-thumb{background:var(--border-strong);border-radius:10px;}
        ::-webkit-scrollbar-thumb:hover{background:var(--text-3);}

        /* Emoji picker */
        .emoji-picker-wrapper{width:370px;background:var(--surface);border-radius:var(--radius-lg);display:flex;flex-direction:column;overflow:hidden;box-shadow:var(--shadow-md);flex-shrink:0;border:1px solid var(--border);transition:background var(--transition),border-color var(--transition);animation:slideLeft 0.4s cubic-bezier(0.34,1.56,0.64,1) 0.1s both;}
        @keyframes slideLeft{from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:translateX(0)}}
        .picker-header{padding:14px 18px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;background:var(--surface-raised);flex-shrink:0;}
        .picker-header-title{font-size:14px;font-weight:700;color:var(--text-1);display:flex;align-items:center;gap:8px;}
        .picker-header-title svg{width:16px;height:16px;color:var(--accent);}
        .header-btn-group{display:flex;gap:8px;align-items:center;}
        .btn-add-pack{background:linear-gradient(135deg,var(--accent),var(--accent-2));color:white;border:none;padding:6px 12px;border-radius:var(--radius-sm);font-weight:600;font-size:12px;cursor:pointer;transition:all var(--transition);display:flex;align-items:center;gap:5px;box-shadow:0 2px 8px var(--accent-glow);letter-spacing:0.2px;}
        .btn-add-pack:hover{transform:translateY(-1px);box-shadow:0 4px 12px var(--accent-glow);}
        .btn-add-pack svg{width:13px;height:13px;}
        .clear-btn{font-size:12px;font-weight:600;cursor:pointer;color:var(--text-3);background:transparent;border:1px solid var(--border);padding:5px 10px;border-radius:var(--radius-sm);transition:all var(--transition);display:flex;align-items:center;gap:4px;}
        .clear-btn:hover{color:var(--danger);border-color:var(--danger);background:var(--danger-bg);}
        .clear-btn svg{width:12px;height:12px;}

        .picker-body{flex:1;overflow-y:auto;padding:14px 16px;scroll-behavior:smooth;min-height:0;}
        .pack-section{margin-bottom:20px;animation:fadeInUp 0.3s ease both;}
        @keyframes fadeInUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        .pack-title-bar{display:flex;justify-content:space-between;align-items:center;position:sticky;top:-14px;background:var(--surface);padding:8px 0;z-index:2;margin-bottom:10px;}
        .pack-title-bar::before{content:'';position:absolute;top:-14px;left:-16px;right:-16px;height:14px;background:var(--surface);}
        .pack-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--text-3);}
        .pack-actions{display:flex;gap:6px;}
        .view-pack-btn,.remove-pack-btn{font-size:11px;font-weight:600;padding:4px 9px;border-radius:6px;cursor:pointer;transition:all var(--transition);border:none;display:flex;align-items:center;gap:4px;}
        .view-pack-btn{color:var(--accent);background:var(--toolbar-hover);}
        .view-pack-btn:hover{background:rgba(59,130,246,0.2);}
        .view-pack-btn svg{width:11px;height:11px;}
        .remove-pack-btn{color:var(--text-3);background:transparent;}
        .remove-pack-btn:hover{color:var(--danger);background:var(--danger-bg);}
        .remove-pack-btn svg{width:11px;height:11px;}
        .emoji-grid{display:grid;grid-template-columns:repeat(8,1fr);gap:5px;}
        .emoji-item{width:100%;aspect-ratio:1;cursor:pointer;object-fit:contain;border-radius:var(--radius-sm);transition:all 0.15s cubic-bezier(0.34,1.56,0.64,1);display:flex;justify-content:center;align-items:center;padding:4px;border:1px solid transparent;}
        .emoji-item:hover{transform:scale(1.2);background:var(--toolbar-hover);border-color:var(--border);box-shadow:0 4px 12px rgba(0,0,0,0.1);z-index:2;position:relative;}
        .emoji-item:active{transform:scale(0.95);}

        .picker-tabs{display:flex;overflow-x:auto;background:var(--surface-raised);padding:10px 14px;gap:8px;align-items:center;border-top:1px solid var(--border);flex-shrink:0;}
        .picker-tabs::-webkit-scrollbar{display:none;}
        .pack-tab{width:36px;height:36px;border-radius:var(--radius-sm);cursor:pointer;opacity:0.5;transition:all var(--transition);display:flex;justify-content:center;align-items:center;background:var(--surface);border:1.5px solid transparent;font-size:12px;font-weight:700;color:var(--text-2);flex-shrink:0;letter-spacing:0.3px;}
        .pack-tab:hover{opacity:0.85;transform:translateY(-2px);box-shadow:var(--shadow-sm);}
        .pack-tab.active{opacity:1;border-color:var(--accent);color:var(--accent);background:var(--toolbar-hover);box-shadow:0 2px 8px var(--accent-glow);}
        .recent-tab{font-size:17px;}

        .status-text{color:var(--text-3);font-size:13px;text-align:center;margin-top:40px;line-height:1.6;}
        .status-text svg{display:block;margin:0 auto 10px;width:36px;height:36px;opacity:0.3;}

        .skeleton{background:linear-gradient(90deg,var(--border) 25%,var(--toolbar-btn) 50%,var(--border) 75%);background-size:200% 100%;animation:shimmer 1.4s infinite;border-radius:var(--radius-sm);}
        @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}

        /* Modals */
        .modal-overlay{position:fixed;inset:0;background:var(--modal-overlay);z-index:1000;display:none;justify-content:center;align-items:center;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);opacity:0;transition:opacity 0.2s ease;}
        .modal-overlay.active{display:flex;}
        .modal-overlay.visible{opacity:1;}
        .modal-content{background:var(--surface);padding:0;border-radius:var(--radius-xl);width:90%;max-width:380px;box-shadow:var(--shadow-lg);border:1px solid var(--border-strong);transform:scale(0.94) translateY(10px);transition:transform 0.25s cubic-bezier(0.34,1.56,0.64,1);overflow:hidden;}
        .modal-overlay.visible .modal-content{transform:scale(1) translateY(0);}
        .modal-header{padding:20px 22px 0;display:flex;justify-content:space-between;align-items:center;}
        .modal-header h3{font-size:17px;font-weight:700;color:var(--text-1);display:flex;align-items:center;gap:8px;}
        .modal-header h3 svg{width:18px;height:18px;color:var(--accent);}
        .modal-subtitle{font-size:12.5px;color:var(--text-2);padding:6px 22px 0;}
        .close-modal-btn{background:var(--toolbar-btn);border:1px solid var(--border);width:30px;height:30px;border-radius:8px;color:var(--text-2);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all var(--transition);}
        .close-modal-btn:hover{color:var(--text-1);border-color:var(--border-strong);}
        .close-modal-btn svg{width:14px;height:14px;}
        .modal-body{padding:18px 22px 22px;}
        .input-group{display:flex;gap:8px;margin-bottom:14px;}
        .pack-input{flex:1;padding:11px 14px;border-radius:var(--radius-sm);border:1.5px solid var(--border-strong);background:var(--surface-raised);color:var(--text-1);outline:none;font-size:14px;font-family:inherit;transition:all var(--transition);}
        .pack-input::placeholder{color:var(--text-3);}
        .pack-input:focus{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-glow);}
        .paste-btn{background:var(--toolbar-btn);border:1.5px solid var(--border-strong);border-radius:var(--radius-sm);padding:0 13px;cursor:pointer;color:var(--text-2);transition:all var(--transition);display:flex;align-items:center;font-size:16px;}
        .paste-btn:hover{background:var(--toolbar-hover);color:var(--accent);border-color:var(--accent);}
        .btn-full{width:100%;padding:12px;background:linear-gradient(135deg,var(--accent),var(--accent-2));color:#fff;border:none;border-radius:var(--radius-sm);cursor:pointer;font-weight:700;font-size:14px;font-family:inherit;transition:all var(--transition);box-shadow:0 4px 12px var(--accent-glow);letter-spacing:0.2px;}
        .btn-full:hover{transform:translateY(-1px);box-shadow:0 6px 18px var(--accent-glow);}
        .btn-full:active{transform:translateY(0);}
        .btn-danger-full{width:100%;padding:12px;background:var(--danger);color:#fff;border:none;border-radius:var(--radius-sm);cursor:pointer;font-weight:700;font-size:14px;font-family:inherit;transition:all var(--transition);letter-spacing:0.2px;margin-top:8px;}
        .btn-danger-full:hover{transform:translateY(-1px);opacity:0.9;}
        .btn-secondary-full{width:100%;padding:11px;background:var(--toolbar-btn);color:var(--text-2);border:1px solid var(--border-strong);border-radius:var(--radius-sm);cursor:pointer;font-weight:600;font-size:14px;font-family:inherit;transition:all var(--transition);}
        .btn-secondary-full:hover{color:var(--text-1);background:var(--toolbar-hover);}

        /* Toast */
        @keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(20px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}

        /* Confirm dialog */
        .confirm-btns{display:flex;gap:10px;margin-top:4px;}
        .confirm-btns button{flex:1;}

        /* Responsive */
        @media(max-width:768px){
          .main-wrapper{flex-direction:column;padding:0;gap:0;height:100vh;height:100dvh;}
          body::before{display:none;}
          .left-column{flex:0 0 auto;gap:0;}
          .top-header-card{border-radius:0;border:none;border-bottom:1px solid var(--border);padding:10px 16px;box-shadow:none;animation:none;}
          .user-avatar,.user-avatar-placeholder{width:38px;height:38px;font-size:15px;}
          .app-title{display:none;}
          .greeting-line{font-size:14px;}
          .btn-copy-html .btn-label{display:none;}
          .btn-copy-html{padding:0 12px;min-width:38px;}
          .editor-container{flex:0 0 38vh;border-radius:0;border:none;border-bottom:1px solid var(--border);box-shadow:none;animation:none;}
          .toolbar{padding:6px 12px;gap:2px;overflow-x:auto;flex-wrap:nowrap;}
          .toolbar::-webkit-scrollbar{display:none;}
          .toolbar-btn{width:32px;height:32px;flex-shrink:0;}
          .toolbar-btn[title]:hover::after{display:none;}
          .emoji-picker-wrapper{width:100%;flex:1;border-radius:0;border:none;box-shadow:none;animation:none;}
          .emoji-grid{grid-template-columns:repeat(7,1fr);gap:4px;}
        }
        @media(max-width:380px){.emoji-grid{grid-template-columns:repeat(6,1fr);}}
      `}</style>

      <div className="main-wrapper">
        {/* ── Left Column ── */}
        <div className="left-column">
          {/* Header */}
          <div className="top-header-card">
            <div className="header-user-info">
              <div className="user-avatar-wrapper">
                {photoUrl ? (
                  <img src={photoUrl} alt="Avatar" className="user-avatar" />
                ) : (
                  <div className="user-avatar-placeholder">{userInitial}</div>
                )}
                <div className="status-dot" />
              </div>
              <div className="header-text-block">
                <span className="app-title">Poozter Editor</span>
                <div className="greeting-line">
                  <span className="greeting-text">{greeting}</span>
                  <span className="user-name-text">{userName}</span>
                </div>
              </div>
            </div>
            <div className="header-actions">
              <button className="icon-btn" onClick={() => setTheme(t => t === "dark" ? "light" : "dark")} title="Toggle Theme">
                <IconSvg>{theme === "dark" ? SUN_SVG : MOON_SVG}</IconSvg>
              </button>
              <button
                className={`btn-copy-html${copySuccess ? " success" : ""}`}
                onClick={copyAndGenerateHTML}
              >
                {copySuccess ? (
                  <>
                    <IconSvg size={16}><polyline points="20 6 9 17 4 12" /></IconSvg>
                    <span className="btn-label">Copied!</span>
                  </>
                ) : (
                  <>
                    <IconSvg size={16}>
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </IconSvg>
                    <span className="btn-label">Copy HTML</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Editor */}
          <div className="editor-container">
            <div className="toolbar">
              {/* Undo / Redo */}
              <button className="toolbar-btn" onClick={undo} title="Undo (Ctrl+Z)">
                <IconSvg><polyline points="9 14 4 9 9 4" /><path d="M20 20v-7a4 4 0 0 0-4-4H4" /></IconSvg>
              </button>
              <button className="toolbar-btn" onClick={redo} title="Redo (Ctrl+Y)">
                <IconSvg><polyline points="15 14 20 9 15 4" /><path d="M4 20v-7a4 4 0 0 1 4-4h12" /></IconSvg>
              </button>

              <div className="toolbar-divider" />

              {/* Text styles */}
              <button className="toolbar-btn" onClick={() => execCmd("bold")} title="Bold (Ctrl+B)">
                <IconSvg>
                  <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
                  <path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
                </IconSvg>
              </button>
              <button className="toolbar-btn" onClick={() => execCmd("italic")} title="Italic (Ctrl+I)">
                <IconSvg>
                  <line x1="19" y1="4" x2="10" y2="4" />
                  <line x1="14" y1="20" x2="5" y2="20" />
                  <line x1="15" y1="4" x2="9" y2="20" />
                </IconSvg>
              </button>
              <button className="toolbar-btn" onClick={() => execCmd("underline")} title="Underline (Ctrl+U)">
                <IconSvg>
                  <path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3" />
                  <line x1="4" y1="21" x2="20" y2="21" />
                </IconSvg>
              </button>
              <button className="toolbar-btn" onClick={() => execCmd("strikeThrough")} title="Strikethrough (Ctrl+Shift+X)">
                <IconSvg>
                  <path d="M16 4H9a3 3 0 0 0-2.83 4" />
                  <path d="M14 12a4 4 0 0 1 0 8H6" />
                  <line x1="4" y1="12" x2="20" y2="12" />
                </IconSvg>
              </button>

              <div className="toolbar-divider" />

              {/* Formats */}
              <button className="toolbar-btn" onClick={() => toggleCustomFormat("blockquote")} title="Blockquote (Ctrl+Shift+.)">
                <IconSvg>
                  <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z" />
                  <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z" />
                </IconSvg>
              </button>
              <button className="toolbar-btn" onClick={() => toggleCustomFormat("code")} title="Monospace (Ctrl+Shift+M)">
                <IconSvg>
                  <polyline points="16 18 22 12 16 6" />
                  <polyline points="8 6 2 12 8 18" />
                </IconSvg>
              </button>
              <button className="toolbar-btn" onClick={() => toggleCustomFormat("tg-spoiler")} title="Spoiler (Ctrl+Shift+P)">
                <IconSvg>
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </IconSvg>
              </button>

              <div className="toolbar-divider" />

              {/* Utilities */}
              <button className="toolbar-btn" onClick={openLinkModal} title="Insert Link (Ctrl+K)">
                <IconSvg>
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </IconSvg>
              </button>
              <button className="toolbar-btn" onClick={insertDate} title="Insert Date (Ctrl+Shift+D)">
                <IconSvg>
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </IconSvg>
              </button>
              <button
                className="toolbar-btn"
                onClick={() => { execCmd("removeFormat"); removeCustomFormats(); }}
                title="Clear Format (Ctrl+Shift+N)"
              >
                <IconSvg>
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  <line x1="2" y1="2" x2="22" y2="22" />
                </IconSvg>
              </button>

              <div className="toolbar-divider" />

              {/* Clear text */}
              <button className="toolbar-btn danger" onClick={clearText} title="Clear Editor Text">
                <IconSvg>
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6" />
                  <path d="M14 11v6" />
                </IconSvg>
              </button>
            </div>

            <div
              ref={editorRef}
              className="editor"
              contentEditable
              suppressContentEditableWarning
              data-placeholder="Type your message here…"
              onInput={handleEditorChange}
              onKeyDown={handleEditorKeyDown}
              onPaste={handlePaste}
            />

            <div className="editor-footer">
              <div className="save-status" style={{ color: saveState === "saved" ? "var(--success)" : "var(--text-3)" }}>
                {saveState === "saved" ? (
                  <>
                    <IconSvg size={12}>
                      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                      <polyline points="17 21 17 13 7 13 7 21" />
                      <polyline points="7 3 7 8 15 8" />
                    </IconSvg>
                    Saved
                  </>
                ) : (
                  <>
                    <IconSvg size={12}>
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </IconSvg>
                    Saving…
                  </>
                )}
              </div>
              <div className={counterClass}>
                {charCount} / {limit}{" "}
                <span style={{ fontSize: 10, opacity: 0.6 }}>{counterLabel}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Emoji Picker ── */}
        <div className="emoji-picker-wrapper">
          <div className="picker-header">
            <div className="picker-header-title">
              <IconSvg size={16}>
                <circle cx="12" cy="12" r="10" />
                <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                <line x1="9" y1="9" x2="9.01" y2="9" />
                <line x1="15" y1="9" x2="15.01" y2="9" />
              </IconSvg>
              Stickers & Emoji
            </div>
            <div className="header-btn-group">
              <button className="btn-add-pack" onClick={() => { setPackInputVal(""); setAddPackOpen(true); setTimeout(() => packInputRef.current?.focus(), 80); }}>
                <IconSvg size={13}>
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </IconSvg>
                Add Pack
              </button>
              <button className="clear-btn" onClick={clearAllData} title="Clear all packs & history">
                <IconSvg size={12}>
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6" />
                  <path d="M14 11v6" />
                </IconSvg>
                Clear
              </button>
            </div>
          </div>

          <div className="picker-body" id="pickerBody">
            {/* Recent */}
            {activeTab === "recent" && (
              <div className="pack-section">
                <div className="pack-title-bar">
                  <div className="pack-title">Recently Used</div>
                </div>
                <div className="emoji-grid">
                  {recentEmojis.length === 0 ? (
                    <span style={{ color: "var(--text-3)", fontSize: 13, gridColumn: "span 8" }}>
                      No recent emojis yet.
                    </span>
                  ) : (
                    recentEmojis.map((item) => (
                      <img
                        key={item.id}
                        src={item.url}
                        className="emoji-item"
                        alt={item.fallback}
                        title={item.fallback}
                        onClick={() => insertEmoji(item)}
                      />
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Pack sections — only render active pack */}
            {activeTab !== "recent" && savedPacks.includes(activeTab) && (
              <div className="pack-section" key={activeTab}>
                <div className="pack-title-bar">
                  <div className="pack-title">{activeTab}</div>
                  <div className="pack-actions">
                    <button className="view-pack-btn" onClick={() => viewPackInTelegram(activeTab)}>
                      <IconSvg size={11}>
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </IconSvg>
                      View
                    </button>
                    <button className="remove-pack-btn" onClick={() => removePack(activeTab)}>
                      <IconSvg size={11}>
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </IconSvg>
                      Remove
                    </button>
                  </div>
                </div>
                <div className="emoji-grid">
                  {!packDataMap[activeTab] ? (
                    // Loading skeletons
                    Array.from({ length: 24 }).map((_, i) => (
                      <div
                        key={i}
                        className="emoji-item skeleton"
                        style={{ animationDelay: `${i * 0.04}s` }}
                      />
                    ))
                  ) : !packDataMap[activeTab].ok ? (
                    <span style={{ color: "var(--danger)", fontSize: 13, gridColumn: "span 8" }}>
                      {packDataMap[activeTab].error ?? "Failed to load pack."}
                    </span>
                  ) : (
                    (packDataMap[activeTab].stickers ?? []).map((sticker: any) =>
                      renderStickerItem(sticker, activeTab)
                    )
                  )}
                </div>
              </div>
            )}

            {/* Empty state */}
            {savedPacks.length === 0 && recentEmojis.length === 0 && (
              <div className="status-text">
                <IconSvg size={36}>
                  <circle cx="12" cy="12" r="10" />
                  <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                  <line x1="9" y1="9" x2="9.01" y2="9" />
                  <line x1="15" y1="9" x2="15.01" y2="9" />
                </IconSvg>
                No packs added yet.<br />Tap <strong>Add Pack</strong> to get started.
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="picker-tabs">
            <div
              className={`pack-tab recent-tab${activeTab === "recent" ? " active" : ""}`}
              title="Recently Used"
              onClick={() => handleTabClick("recent")}
            >
              🕒
            </div>
            {savedPacks.map((packName) => (
              <div
                key={packName}
                className={`pack-tab${activeTab === packName ? " active" : ""}`}
                title={packName}
                onClick={() => handleTabClick(packName)}
              >
                {packName.substring(0, 2).toUpperCase()}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Add Pack Modal ── */}
      <Modal
        open={addPackOpen}
        onClose={() => setAddPackOpen(false)}
        title="Add Emoji Pack"
        subtitle="Enter a pack name or paste a t.me link"
        icon={
          <IconSvg size={18}>
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="12" y1="8" x2="12" y2="16" />
            <line x1="8" y1="12" x2="16" y2="12" />
          </IconSvg>
        }
      >
        <div className="input-group">
          <input
            ref={packInputRef}
            className="pack-input"
            type="text"
            placeholder="e.g. NewsEmoji or t.me/addemoji/…"
            value={packInputVal}
            onChange={(e) => setPackInputVal(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addNewPack()}
          />
          <button
            className="paste-btn"
            title="Paste"
            onClick={() => pasteFromClipboard(setPackInputVal)}
          >
            <IconSvg size={16}>
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
            </IconSvg>
          </button>
        </div>
        <button className="btn-full" onClick={addNewPack}>Add Pack</button>
      </Modal>

      {/* ── Insert Link Modal ── */}
      <Modal
        open={addLinkOpen}
        onClose={() => setAddLinkOpen(false)}
        title="Insert Link"
        subtitle="Enter the URL for your selected text"
        icon={
          <IconSvg size={18}>
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </IconSvg>
        }
      >
        <div className="input-group">
          <input
            ref={linkInputRef}
            className="pack-input"
            type="url"
            placeholder="https://..."
            value={linkInputVal}
            onChange={(e) => setLinkInputVal(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && confirmInsertLink()}
          />
          <button
            className="paste-btn"
            title="Paste"
            onClick={() => pasteFromClipboard(setLinkInputVal)}
          >
            <IconSvg size={16}>
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
            </IconSvg>
          </button>
        </div>
        <button className="btn-full" onClick={confirmInsertLink}>Insert Link</button>
      </Modal>

      {/* ── Confirm Modal (replaces browser confirm) ── */}
      <Modal
        open={confirmState.open}
        onClose={() => setConfirmState((s) => ({ ...s, open: false }))}
        title="Confirm"
        icon={
          <IconSvg size={18}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </IconSvg>
        }
      >
        <p style={{ color: "var(--text-2)", fontSize: 14, marginBottom: 16, lineHeight: 1.5 }}>
          {confirmState.message}
        </p>
        <div className="confirm-btns">
          <button
            className="btn-secondary-full"
            onClick={() => setConfirmState((s) => ({ ...s, open: false }))}
          >
            Cancel
          </button>
          <button
            className="btn-danger-full"
            style={{ marginTop: 0 }}
            onClick={() => {
              setConfirmState((s) => ({ ...s, open: false }));
              confirmState.onYes();
            }}
          >
            Confirm
          </button>
        </div>
      </Modal>

      {/* ── Toast ── */}
      {toastMsg && <Toast message={toastMsg} />}
    </>
  );
}
