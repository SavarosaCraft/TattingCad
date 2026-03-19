# TattingCAD — Localization Guide

## Overview

TattingCAD uses a two-part localization system:

| Part | File | Purpose |
|------|------|---------|
| Language manifest | `languages.json` | Declares which languages exist and their display names |
| UI strings | `translations_[lang].json` | One file per language — flat key:value pairs |
| Help content | `tatting-help_[lang].html` | Full help document, translated separately |

---

## Language Codes

Use standard [BCP 47](https://en.wikipedia.org/wiki/IETF_language_tag) two-letter codes (ISO 639-1):

| Code | Language |
|------|----------|
| `en` | English (built-in fallback, always present) |
| `hu` | Hungarian / Magyar |

To add a new language, use its two-letter code consistently in both files and the app registration step below.

---

## File Naming

### Language manifest
```
languages.json             ← {"en": "English", "hu": "Magyar", ...}
```
Adding a language here is the only registration step needed — the app reads this at startup.

### UI strings
One file per language, flat key:value pairs:
```
translations_en.json       ← English (source of truth)
translations_hu.json       ← Hungarian
translations_de.json       ← German (future)
```

### Help document
One file per language:
```
tatting-help.html          ← English (default, fallback)
tatting-help_hu.html       ← Hungarian
tatting-help_de.html       ← German (future)
tatting-help_fr.html       ← French (future)
```

**Rule:** English (`en`) always uses the base filename `tatting-help.html` with no suffix. Every other language appends `_[code]`. If a translated help file is missing or fails to load, the app automatically falls back to `tatting-help.html`.

---

## Adding a New Language

### Step 1 — Add the language to `languages.json`

This is the **only registration step needed** — the app reads this at startup and populates the language picker automatically. No code changes required.

```json
{
  "en": "English",
  "hu": "Magyar",
  "de": "Deutsch"
}
```

### Step 2 — Create `translations_[code].json`

Copy `translations_en.json` to `translations_de.json` (for example) and replace the English values with translated ones. The file is a flat key:value object — no nesting, no metadata:

```json
{
  "disclaimerTitle": "⚠️ Testversion",
  "disclaimerContinue": "Ich verstehe – Weiter",
  ...
}
```

Every key with an empty string `""` needs a translation. Keys not translated will fall back to English automatically.

**Do not translate notation terms** — `ds`, `p`, `jp`, `ss`, `rds`, `lp`, `sp`, `be`, `r:`, `c:` are universal tatting notation and must remain as-is in all languages.

### Step 3 — Translate the help document

Copy `tatting-help.html` to `tatting-help_[code].html` and translate its content. The file must live in the same directory as the main app files (next to `tatting-help.html`).

```
tatting-help.html          ← do not modify (English source)
tatting-help_de.html       ← your translated copy
```

---

## How the System Works at Runtime

### UI strings (`translations.json`)

The app loads `languages.json` at startup to discover which languages exist. It then fetches all `translations_[code].json` files **in parallel**. Each file is merged into the runtime translation table — external files win over the built-in English. This means you can ship updated translations without recompiling the app.

The `t(key)` function resolves in this priority order:

```
1. External translations.json  →  current language
2. Hardcoded TRANSLATIONS      →  current language
3. External translations.json  →  English fallback
4. Hardcoded TRANSLATIONS      →  English fallback
5. The key name itself         →  last resort (shows raw key)
```

### Help document

The help modal and the "Open in browser" button both compute the URL:

```
language === 'en'  →  ./tatting-help.html
language === 'hu'  →  ./tatting-help_hu.html   (falls back to English if missing)
```

The iframe has an `onError` handler: if the localised file fails to load (404 or network error), it automatically reloads with the English file. This means it is safe to ship a language without a translated help file — English will show instead.

---

## Translation File Structure (`translations.json`)

```json
{
  "_meta": { "version": "1.1", "note": "..." },
  "_languages": { "en": "English", "hu": "Magyar" },
  "en": {
    "_comment_section": "Section description (not translated)",
    "keyName": "English text"
  },
  "hu": {
    "keyName": "Magyar szöveg"
  }
}
```

Keys starting with `_` are metadata/comments and are ignored by the app.

---

## Key Naming Conventions

Keys follow a `sectionName` + `specificThing` pattern:

| Prefix | Section |
|--------|---------|
| `disclaimer` | Startup disclaimer modal |
| `menu` | Top toolbar menu buttons |
| `file` | File menu items |
| `view` | View menu items |
| `arrange` | Arrange menu items |
| `options` | Options menu items |
| `tool` | Left toolbar tool buttons |
| `mode` | Active mode banners (realistic/picotJoin/beading) |
| `prop` | Single-element property bar |
| `multi` | Multi-select property bar |
| `save` / `new` / `load` / `remove` | Dialog windows |
| `notes` | Notes drawer |
| `color` | Color picker panel |
| `bead` | Bead library panel |
| `thread` | Thread properties panel |
| `info` | Bottom info bar |
| `help` | Help modal |
| `join` | Picot join tip popup |
| `picot` | Picot join mode action buttons |

---

## What Is NOT Translated

- **Tatting notation symbols:** `ds`, `p`, `jp`, `ss`, `rds`, `lp`, `sp`, `be`, `r:`, `c:` — these are the international language of tatting
- **Bead size codes:** `Y`, `Z`, `V` — internal identifiers
- **Color hex values:** `#FFFFFF`, etc.
- **Keyboard shortcuts:** `Ctrl+S`, `Ctrl+Z` — platform conventions
- **DMC thread names and IDs** — these come from an external catalogue
- **The `tatting-theme.json` file** — indicator colours, not text

---

## Releasing a New Translation

1. Add the language code and name to `languages.json`
2. Create `translations_[code].json` with all keys translated (copy from `translations_en.json`)
3. Create `tatting-help_[code].html` with translated help content
4. Place all files in the `resources/` folder of the project
5. Build — the Tauri bundle config already includes all `resources/*.json` and `resources/*.html`
