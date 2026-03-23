import { useRef, useState, useEffect, useCallback } from 'react'

interface CodeEditorProps {
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  placeholder?: string
  minHeight?: number
  language?: 'shell' | 'args'
}

const FONT = 'Consolas, "Courier New", "SF Mono", Menlo, monospace'

const SHELL_KEYWORDS = /\b(if|then|else|elif|fi|for|do|done|while|case|esac|in|function|return|exit|echo|cd|export|source|eval|exec|set|unset|local|readonly|declare|shift|trap|wait|true|false)\b/g
const SHELL_FLAG = /(^|\s)(--?\w[\w-]*)/g
const SHELL_VAR = /(\$\{[^}]+\}|\$[A-Za-z_]\w*)/g
const SHELL_STRING = /("[^"]*"|'[^']*')/g
const SHELL_COMMENT = /(#.*$)/gm
const SHELL_NUMBER = /\b(\d+\.?\d*)\b/g

function highlightShell(text: string): string {
  const tokens: Array<{ start: number; end: number; html: string }> = []

  function collect(regex: RegExp, className: string, group = 0) {
    regex.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = regex.exec(text)) !== null) {
      const idx = m.index + (group > 0 ? m[0].indexOf(m[group]) : 0)
      tokens.push({ start: idx, end: idx + m[group].length, html: `<span class="ce-${className}">${esc(m[group])}</span>` })
    }
  }

  collect(SHELL_COMMENT, 'comment')
  collect(SHELL_STRING, 'string')
  collect(SHELL_VAR, 'var')
  collect(SHELL_KEYWORDS, 'keyword')
  collect(SHELL_FLAG, 'flag', 2)
  collect(SHELL_NUMBER, 'number')

  tokens.sort((a, b) => a.start - b.start)

  const merged: typeof tokens = []
  for (const t of tokens) {
    if (merged.length > 0 && t.start < merged[merged.length - 1].end) continue
    merged.push(t)
  }

  let result = ''
  let pos = 0
  for (const t of merged) {
    if (t.start > pos) result += esc(text.slice(pos, t.start))
    result += t.html
    pos = t.end
  }
  if (pos < text.length) result += esc(text.slice(pos))
  return result
}

function highlightArgs(text: string): string {
  return text.split('\n').map(line => {
    const tokens: Array<{ start: number; end: number; html: string }> = []

    function collect(regex: RegExp, className: string, group = 0) {
      regex.lastIndex = 0
      let m: RegExpExecArray | null
      while ((m = regex.exec(line)) !== null) {
        const idx = m.index + (group > 0 ? m[0].indexOf(m[group]) : 0)
        tokens.push({ start: idx, end: idx + m[group].length, html: `<span class="ce-${className}">${esc(m[group])}</span>` })
      }
    }

    collect(SHELL_VAR, 'var')
    collect(SHELL_FLAG, 'flag', 2)
    collect(SHELL_STRING, 'string')
    collect(SHELL_NUMBER, 'number')

    tokens.sort((a, b) => a.start - b.start)
    const merged: typeof tokens = []
    for (const t of tokens) {
      if (merged.length > 0 && t.start < merged[merged.length - 1].end) continue
      merged.push(t)
    }

    let result = ''
    let pos = 0
    for (const t of merged) {
      if (t.start > pos) result += esc(line.slice(pos, t.start))
      result += t.html
      pos = t.end
    }
    if (pos < line.length) result += esc(line.slice(pos))
    return result
  }).join('\n')
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export default function CodeEditor({ value, onChange, onBlur, placeholder, minHeight = 80, language = 'shell' }: CodeEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const highlightRef = useRef<HTMLDivElement>(null)
  const lineNumRef = useRef<HTMLDivElement>(null)
  const [lineCount, setLineCount] = useState(1)
  const [focused, setFocused] = useState(false)

  const syncScroll = useCallback(() => {
    if (textareaRef.current && highlightRef.current && lineNumRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft
      lineNumRef.current.scrollTop = textareaRef.current.scrollTop
    }
  }, [])

  useEffect(() => {
    const lines = value.split('\n').length
    setLineCount(Math.max(lines, 1))
  }, [value])

  const highlighted = value
    ? (language === 'args' ? highlightArgs(value) : highlightShell(value))
    : ''

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      const ta = textareaRef.current!
      const start = ta.selectionStart
      const end = ta.selectionEnd
      const newVal = value.slice(0, start) + '  ' + value.slice(end)
      onChange(newVal)
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 2
      })
    }
  }

  return (
    <div
      style={{
        position: 'relative',
        border: `1px solid ${focused ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 6,
        overflow: 'hidden',
        background: 'var(--bg-primary)',
        transition: 'border-color 0.15s',
        minHeight,
      }}
    >
      <style>{`
        .ce-keyword { color: #c678dd; font-weight: 600; }
        .ce-flag { color: #61afef; }
        .ce-var { color: #e5c07b; }
        .ce-string { color: #98c379; }
        .ce-comment { color: #5c6370; font-style: italic; }
        .ce-number { color: #d19a66; }
        [data-theme="light"] .ce-keyword { color: #a626a4; }
        [data-theme="light"] .ce-flag { color: #4078f2; }
        [data-theme="light"] .ce-var { color: #c18401; }
        [data-theme="light"] .ce-string { color: #50a14f; }
        [data-theme="light"] .ce-comment { color: #a0a1a7; }
        [data-theme="light"] .ce-number { color: #986801; }
      `}</style>

      <style>{`
        .ce-textarea::placeholder {
          color: var(--text-muted);
          opacity: 0.4;
        }
      `}</style>

      <div style={{ display: 'flex', height: '100%', minHeight }}>
        <div
          ref={lineNumRef}
          style={{
            width: 32,
            flexShrink: 0,
            padding: '8px 0',
            textAlign: 'right',
            fontSize: 10,
            fontFamily: FONT,
            lineHeight: '20px',
            color: 'var(--text-muted)',
            background: 'var(--bg-secondary)',
            borderRight: '1px solid var(--border)',
            userSelect: 'none',
            overflow: 'hidden',
          }}
        >
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i} style={{ paddingRight: 6, height: 20 }}>{i + 1}</div>
          ))}
        </div>

        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <div
            ref={highlightRef}
            aria-hidden
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              padding: '8px 10px',
              fontSize: 12,
              fontFamily: FONT,
              lineHeight: '20px',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              color: 'var(--text-primary)',
              overflow: 'hidden',
              pointerEvents: 'none',
            }}
            dangerouslySetInnerHTML={{ __html: highlighted + '\n' }}
          />

          <textarea
            ref={textareaRef}
            className="ce-textarea"
            value={value}
            onChange={e => onChange(e.target.value)}
            onBlur={() => { setFocused(false); onBlur?.() }}
            onFocus={() => setFocused(true)}
            onScroll={syncScroll}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            spellCheck={false}
            style={{
              position: 'relative',
              width: '100%',
              minHeight: minHeight - 2,
              padding: '8px 10px',
              fontSize: 12,
              fontFamily: FONT,
              lineHeight: '20px',
              background: 'transparent',
              color: 'transparent',
              caretColor: 'var(--text-primary)',
              border: 'none',
              outline: 'none',
              resize: 'vertical',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              boxSizing: 'border-box',
            }}
          />
        </div>
      </div>
    </div>
  )
}
