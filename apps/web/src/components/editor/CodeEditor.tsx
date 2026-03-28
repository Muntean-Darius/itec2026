"use client"

import Editor, { type BeforeMount, type OnMount, type Monaco } from "@monaco-editor/react"

export type MonacoEditor = Parameters<OnMount>[0]

export interface CodeEditorProps {
  language?: string
  value?: string
  defaultValue?: string
  onChange?: (value: string | undefined) => void
  onMount?: (editor: MonacoEditor, monaco: Monaco) => void
  readOnly?: boolean
}

/**
 * Language display name → Monaco language ID.
 */
export const LANG_MAP: Record<string, string> = {
  Python:     "python",
  JavaScript: "javascript",
  TypeScript: "typescript",
  Go:         "go",
  Rust:       "rust",
  "C++":      "cpp",
  Java:       "java",
}

/**
 * Custom Monaco theme matching the iTECify design system.
 * All colors use the HSL palette from globals.css.
 */
const defineTheme: BeforeMount = (monaco) => {
  monaco.editor.defineTheme("itecify", {
    base: "vs-dark",
    inherit: true,
    rules: [
      // Comments — muted, italic
      { token: "comment",          foreground: "505870", fontStyle: "italic" },
      { token: "comment.line",     foreground: "505870", fontStyle: "italic" },
      { token: "comment.block",    foreground: "505870", fontStyle: "italic" },

      // Keywords — soft purple (brand-adjacent)
      { token: "keyword",          foreground: "A78BFA" },
      { token: "keyword.control",  foreground: "A78BFA" },
      { token: "keyword.operator", foreground: "34D399" },

      // Strings — green
      { token: "string",           foreground: "6EE7B7" },
      { token: "string.escape",    foreground: "FDBA74" },

      // Numbers — peach
      { token: "number",           foreground: "FDBA74" },
      { token: "number.float",     foreground: "FDBA74" },

      // Types — light blue
      { token: "type",             foreground: "7DD3FC" },
      { token: "type.identifier",  foreground: "7DD3FC" },

      // Functions — teal (AI accent)
      { token: "entity.name.function", foreground: "2DD4BF" },
      { token: "support.function",     foreground: "2DD4BF" },

      // Variables — foreground
      { token: "variable",           foreground: "D9DDE8" },
      { token: "variable.parameter", foreground: "D9DDE8" },

      // Operators & delimiters
      { token: "operator",            foreground: "34D399" },
      { token: "delimiter",           foreground: "6B7280" },
      { token: "delimiter.bracket",   foreground: "6B7280" },

      // HTML/JSX
      { token: "tag",              foreground: "7DD3FC" },
      { token: "attribute.name",   foreground: "A78BFA" },
      { token: "attribute.value",  foreground: "6EE7B7" },
    ],
    colors: {
      // Editor backgrounds
      "editor.background":                    "#10131a",
      "editor.foreground":                    "#d9dde8",
      "editorGutter.background":              "#10131a",

      // Line highlight — subtle surface lift
      "editor.lineHighlightBackground":       "#181c26",
      "editor.lineHighlightBorder":           "#00000000",

      // Selection — brand tint
      "editor.selectionBackground":           "#6366f125",
      "editor.inactiveSelectionBackground":   "#6366f112",
      "editor.wordHighlightBackground":       "#6366f112",
      "editor.wordHighlightStrongBackground": "#6366f120",

      // Cursor — brand color
      "editorCursor.foreground":              "#6366f1",
      "editorCursor.background":              "#10131a",

      // Line numbers
      "editorLineNumber.foreground":          "#3a3f52",
      "editorLineNumber.activeForeground":    "#7a8094",

      // Indent guides
      "editorIndentGuide.background1":        "#1e2130",
      "editorIndentGuide.activeBackground1":  "#2a2e40",

      // Bracket matching
      "editorBracketMatch.background":        "#6366f118",
      "editorBracketMatch.border":            "#6366f140",

      // Scrollbar
      "scrollbarSlider.background":           "#1e213050",
      "scrollbarSlider.hoverBackground":      "#2a2e4070",
      "scrollbarSlider.activeBackground":     "#2a2e4090",

      // Widgets (autocomplete, hover)
      "editorWidget.background":              "#181c26",
      "editorWidget.border":                  "#252836",
      "editorHoverWidget.background":         "#181c26",
      "editorHoverWidget.border":             "#252836",
      "editorSuggestWidget.background":       "#181c26",
      "editorSuggestWidget.border":           "#252836",
      "editorSuggestWidget.selectedBackground": "#252836",
      "editorSuggestWidget.highlightForeground": "#6366f1",
      "editorSuggestWidget.focusHighlightForeground": "#6366f1",

      // Find
      "editor.findMatchBackground":           "#6366f128",
      "editor.findMatchHighlightBackground":  "#6366f114",
      "editor.findMatchBorder":               "#6366f150",

      // Diagnostics
      "editorError.foreground":               "#c0392b",
      "editorWarning.foreground":             "#d4a017",
      "editorInfo.foreground":                "#6366f1",

      // Overview ruler
      "editorOverviewRuler.border":           "#00000000",

      // Minimap
      "minimap.background":                   "#10131a",
      "minimapSlider.background":             "#1e213050",
    },
  })
}

export function CodeEditor({
  language = "Python",
  value,
  defaultValue,
  onChange,
  onMount,
  readOnly = false,
}: CodeEditorProps) {
  const lang = LANG_MAP[language] ?? language.toLowerCase()

  const handleMount: OnMount = (editor, monaco) => {
    onMount?.(editor, monaco)
  }

  return (
    <Editor
      height="100%"
      language={lang}
      value={value}
      defaultValue={defaultValue ?? ""}
      theme="itecify"
      beforeMount={defineTheme}
      onMount={handleMount}
      onChange={onChange}
      loading={
        <div className="flex h-full w-full items-center justify-center bg-background">
          <div className="flex items-center gap-2 text-sm text-text-tertiary">
            <span className="size-4 border-2 border-text-tertiary/30 border-t-text-tertiary rounded-full animate-spin" />
            Loading editor…
          </div>
        </div>
      }
      options={{
        fontSize:                13,
        fontFamily:              "'JetBrains Mono', 'Fira Code', monospace",
        fontLigatures:           true,
        lineHeight:              22,
        letterSpacing:           0.3,
        minimap:                 { enabled: false },
        scrollBeyondLastLine:    false,
        padding:                 { top: 16, bottom: 16 },
        lineNumbers:             "on",
        lineNumbersMinChars:     3,
        glyphMargin:             true,
        folding:                 true,
        renderLineHighlight:     "all",
        renderWhitespace:        "selection",
        cursorBlinking:          "smooth",
        cursorSmoothCaretAnimation: "on",
        cursorStyle:             "line",
        cursorWidth:             2,
        smoothScrolling:         true,
        overviewRulerBorder:     false,
        hideCursorInOverviewRuler: true,
        overviewRulerLanes:      0,
        wordWrap:                "off",
        automaticLayout:         true,
        tabSize:                 4,
        insertSpaces:            true,
        readOnly,
        fixedOverflowWidgets:    true,
        accessibilitySupport:    "off",
        bracketPairColorization: { enabled: true },
        guides: {
          bracketPairs:          true,
          indentation:           true,
        },
        suggest: {
          showKeywords:          true,
          showSnippets:          true,
        },
        quickSuggestions: {
          other:                 true,
          comments:              false,
          strings:               false,
        },
      }}
    />
  )
}
