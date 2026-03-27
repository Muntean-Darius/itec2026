"use client"

import Editor, { type BeforeMount, type OnMount, type Monaco } from "@monaco-editor/react"

// Maps display language names → Monaco language IDs
export const LANG_MAP: Record<string, string> = {
  Python:     "python",
  JavaScript: "javascript",
  TypeScript: "typescript",
  Go:         "go",
  Rust:       "rust",
  "C++":      "cpp",
  Java:       "java",
}

const DEFAULT_SNIPPETS: Record<string, string> = {
  python:
    "# Start coding\n\ndef main():\n    print(\"Hello, iTECify!\")\n\nmain()\n",
  javascript:
    "// Start coding\n\nconsole.log(\"Hello, iTECify!\");\n",
  typescript:
    "// Start coding\n\nconst greet = (name: string): string => `Hello, ${name}!`;\nconsole.log(greet(\"iTECify\"));\n",
  go:
    "package main\n\nimport \"fmt\"\n\nfunc main() {\n\tfmt.Println(\"Hello, iTECify!\")\n}\n",
  rust:
    "fn main() {\n    println!(\"Hello, iTECify!\");\n}\n",
  cpp:
    "#include <iostream>\n\nint main() {\n    std::cout << \"Hello, iTECify!\" << std::endl;\n    return 0;\n}\n",
  java:
    "public class Main {\n    public static void main(String[] args) {\n        System.out.println(\"Hello, iTECify!\");\n    }\n}\n",
}

const beforeMount: BeforeMount = (monaco) => {
  monaco.editor.defineTheme("itecify-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment",               foreground: "484F58", fontStyle: "italic" },
      { token: "comment.line",          foreground: "484F58", fontStyle: "italic" },
      { token: "comment.block",         foreground: "484F58", fontStyle: "italic" },
      { token: "keyword",               foreground: "A78BFA" },
      { token: "keyword.control",       foreground: "A78BFA" },
      { token: "keyword.operator",      foreground: "00D9C0" },
      { token: "string",                foreground: "4ADE80" },
      { token: "string.escape",         foreground: "FB923C" },
      { token: "number",                foreground: "FB923C" },
      { token: "number.float",          foreground: "FB923C" },
      { token: "type",                  foreground: "60A5FA" },
      { token: "type.identifier",       foreground: "60A5FA" },
      { token: "entity.name.function",  foreground: "00D9C0" },
      { token: "support.function",      foreground: "00D9C0" },
      { token: "variable",              foreground: "E6EDF3" },
      { token: "variable.parameter",    foreground: "E6EDF3" },
      { token: "operator",              foreground: "00D9C0" },
      { token: "delimiter",             foreground: "8B949E" },
      { token: "delimiter.bracket",     foreground: "8B949E" },
      { token: "tag",                   foreground: "60A5FA" },
      { token: "attribute.name",        foreground: "A78BFA" },
      { token: "attribute.value",       foreground: "4ADE80" },
    ],
    colors: {
      "editor.background":                    "#0C1929",
      "editor.foreground":                    "#E4EEFF",
      "editorGutter.background":              "#0C1929",
      "editor.lineHighlightBackground":       "#0F2035",
      "editor.lineHighlightBorder":           "#00000000",
      "editor.selectionBackground":           "#162840CC",
      "editor.inactiveSelectionBackground":   "#16284066",
      "editor.wordHighlightBackground":       "#16284066",
      "editor.wordHighlightStrongBackground": "#1628409A",
      "editorCursor.foreground":              "#4F86F7",
      "editorCursor.background":              "#0C1929",
      "editorLineNumber.foreground":          "#3E5578",
      "editorLineNumber.activeForeground":    "#7A9BC4",
      "editorIndentGuide.background1":        "#162840",
      "editorIndentGuide.activeBackground1":  "#1A3050",
      "editorBracketMatch.background":        "#4F86F720",
      "editorBracketMatch.border":            "#4F86F750",
      "scrollbarSlider.background":           "#16284050",
      "scrollbarSlider.hoverBackground":      "#1A305080",
      "scrollbarSlider.activeBackground":     "#1A3050B0",
      "editorWidget.background":              "#0F2035",
      "editorWidget.border":                  "#1A3050",
      "editorHoverWidget.background":         "#0F2035",
      "editorHoverWidget.border":             "#1A3050",
      "editorSuggestWidget.background":       "#0F2035",
      "editorSuggestWidget.border":           "#1A3050",
      "editorSuggestWidget.selectedBackground":"#162840",
      "editorSuggestWidget.highlightForeground":"#4F86F7",
      "editorSuggestWidget.focusHighlightForeground":"#4F86F7",
      "editor.findMatchBackground":           "#4F86F730",
      "editor.findMatchHighlightBackground":  "#4F86F718",
      "editor.findMatchBorder":               "#4F86F760",
      "editorError.foreground":               "#C23B3B",
      "editorWarning.foreground":             "#C9AA2A",
      "editorInfo.foreground":                "#4F86F7",
      "peekView.border":                      "#4F86F740",
      "peekViewEditor.background":            "#0F2035",
      "peekViewEditor.matchHighlightBackground":"#4F86F720",
      "peekViewResult.background":            "#0C1929",
      "peekViewResult.matchHighlightBackground":"#4F86F720",
      "peekViewResult.selectionBackground":   "#162840",
      "peekViewTitle.background":             "#0F2035",
      "editorOverviewRuler.border":           "#00000000",
      "minimap.background":                   "#0C1929",
      "minimapSlider.background":             "#16284050",
    },
  })
}

export type MonacoEditor = Monaco["editor"]["IStandaloneCodeEditor"]

export interface CodeEditorProps {
  language?: string
  value?: string
  defaultValue?: string
  onChange?: (value: string | undefined) => void
  onMount?: (editor: MonacoEditor, monaco: Monaco) => void
  readOnly?: boolean
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
      defaultValue={defaultValue ?? DEFAULT_SNIPPETS[lang] ?? ""}
      theme="itecify-dark"
      beforeMount={beforeMount}
      onMount={handleMount}
      onChange={onChange}
      loading={
        <div className="flex h-full w-full items-center justify-center bg-background">
          <span className="text-xs text-text-dim font-mono animate-pulse">Loading editor…</span>
        </div>
      }
      options={{
        fontSize:              13,
        fontFamily:            "'JetBrains Mono', monospace",
        fontLigatures:         true,
        lineHeight:            22,
        letterSpacing:         0.3,
        minimap:               { enabled: false },
        scrollBeyondLastLine:  false,
        padding:               { top: 16, bottom: 16 },
        lineNumbers:           "on",
        lineNumbersMinChars:   3,
        glyphMargin:           true,
        folding:               true,
        renderLineHighlight:   "all",
        renderWhitespace:      "selection",
        cursorBlinking:        "smooth",
        cursorSmoothCaretAnimation: "on",
        cursorStyle:           "line",
        cursorWidth:           2,
        smoothScrolling:       true,
        overviewRulerBorder:   false,
        hideCursorInOverviewRuler: true,
        overviewRulerLanes:    0,
        wordWrap:              "off",
        automaticLayout:       true,
        tabSize:               4,
        insertSpaces:          true,
        readOnly,
        fixedOverflowWidgets:  true,
        accessibilitySupport:  "off",
        bracketPairColorization: { enabled: true },
        guides: {
          bracketPairs:        true,
          indentation:         true,
        },
        suggest: {
          showKeywords:        true,
          showSnippets:        true,
        },
        quickSuggestions: {
          other:               true,
          comments:            false,
          strings:             false,
        },
      }}
    />
  )
}
