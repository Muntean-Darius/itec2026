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
      "editor.background":                    "#0E1117",
      "editor.foreground":                    "#E6EDF3",
      "editorGutter.background":              "#0E1117",
      "editor.lineHighlightBackground":       "#161B22",
      "editor.lineHighlightBorder":           "#00000000",
      "editor.selectionBackground":           "#1C2333CC",
      "editor.inactiveSelectionBackground":   "#1C233366",
      "editor.wordHighlightBackground":       "#1C233366",
      "editor.wordHighlightStrongBackground": "#1C2333AA",
      "editorCursor.foreground":              "#00D9C0",
      "editorCursor.background":              "#0E1117",
      "editorLineNumber.foreground":          "#484F58",
      "editorLineNumber.activeForeground":    "#8B949E",
      "editorIndentGuide.background1":        "#1C2333",
      "editorIndentGuide.activeBackground1":  "#2A2D3A",
      "editorBracketMatch.background":        "#1C233360",
      "editorBracketMatch.border":            "#00D9C050",
      "scrollbarSlider.background":           "#1C233350",
      "scrollbarSlider.hoverBackground":      "#2A2D3A80",
      "scrollbarSlider.activeBackground":     "#2A2D3AB0",
      "editorWidget.background":              "#161B22",
      "editorWidget.border":                  "#2A2D3A",
      "editorHoverWidget.background":         "#161B22",
      "editorHoverWidget.border":             "#2A2D3A",
      "editorSuggestWidget.background":       "#161B22",
      "editorSuggestWidget.border":           "#2A2D3A",
      "editorSuggestWidget.selectedBackground":"#1C2333",
      "editorSuggestWidget.highlightForeground":"#00D9C0",
      "editorSuggestWidget.focusHighlightForeground":"#00D9C0",
      "editor.findMatchBackground":           "#00D9C030",
      "editor.findMatchHighlightBackground":  "#00D9C018",
      "editor.findMatchBorder":               "#00D9C060",
      "editorError.foreground":               "#F87171",
      "editorWarning.foreground":             "#FCD34D",
      "editorInfo.foreground":                "#60A5FA",
      "peekView.border":                      "#00D9C040",
      "peekViewEditor.background":            "#161B22",
      "peekViewEditor.matchHighlightBackground":"#00D9C020",
      "peekViewResult.background":            "#0E1117",
      "peekViewResult.matchHighlightBackground":"#00D9C020",
      "peekViewResult.selectionBackground":   "#1C2333",
      "peekViewTitle.background":             "#161B22",
      "editorOverviewRuler.border":           "#00000000",
      "minimap.background":                   "#0E1117",
      "minimapSlider.background":             "#1C233350",
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
