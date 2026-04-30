Bundled font assets used by WinSSH's integrated font registry.

This directory currently keeps documentation only. Selectable UI and terminal fonts are loaded from `@fontsource/*` packages declared in `package.json`.

The previous bundled `NotoSans*` and `SymbolsNerdFontMono` assets were removed. Until a replacement CJK or symbol font is added to the integrated registry, missing glyphs fall through to the browser's generic `sans-serif` or `monospace` fallback.
