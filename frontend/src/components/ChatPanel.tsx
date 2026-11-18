import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import {
  ArrowUp,
  Check,
  ChevronDown,
  Copy,
  RotateCcw,
  Sparkles,
  Square,
  TerminalSquare,
  Trash2,
  UploadCloud,
  Zap,
} from 'lucide-react'
import { api, sourceLabel, type Source } from '../api'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  sources?: Source[]
  prompt?: string
  ms?: number
  error?: boolean
  pending?: boolean // waiting for the first token
  streaming?: boolean // tokens are arriving
  stopped?: boolean // the user stopped generation
  question?: string // the question an assistant message answers (for retry)
}

interface Props {
  projectId: string
  ready: boolean
  hasFiles: boolean
  messages: ChatMessage[]
  setMessages: (update: (m: ChatMessage[]) => ChatMessage[]) => void
  onPrepare: (action: 'upload' | 'prepare') => void
}

const SUGGESTIONS = [
  'Summarize the main points of these documents.',
  'What are the key definitions or terms?',
  'List any important dates, figures or deadlines.',
]

const TOP_K = [3, 5, 8]

export function ChatPanel({ projectId, ready, hasFiles, messages, setMessages, onPrepare }: Props) {
  const [input, setInput] = useState('')
  const [topK, setTopK] = useState(5)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const busy = messages.some((m) => m.pending || m.streaming)
  const last = messages[messages.length - 1]

  // Stop generating when the panel unmounts (e.g. switching project)
  useEffect(() => () => abortRef.current?.abort(), [])

  // Follow the answer as it streams, unless the user scrolled up to read something
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 160
    if (nearBottom || last?.pending) el.scrollTo({ top: el.scrollHeight, behavior: last?.streaming ? 'auto' : 'smooth' })
  }, [messages.length, last?.pending, last?.text, last?.streaming])

  // Auto-grow the composer up to a max height
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`
  }, [input])

  const ask = async (question: string, replaceId?: string) => {
    const q = question.trim()
    if (!q || busy || !ready) return
    const id = crypto.randomUUID()
    const pending: ChatMessage = { id, role: 'assistant', text: '', pending: true, question: q }

    setMessages((m) =>
      replaceId
        ? m.map((x) => (x.id === replaceId ? pending : x))
        : [...m, { id: crypto.randomUUID(), role: 'user', text: q }, pending],
    )
    setInput('')

    const update = (patch: (x: ChatMessage) => Partial<ChatMessage>) =>
      setMessages((m) => m.map((x) => (x.id === id ? { ...x, ...patch(x) } : x)))

    const controller = new AbortController()
    abortRef.current = controller
    const started = performance.now()
    try {
      await api.answerStream(
        projectId,
        q,
        topK,
        {
          onSources: (sources, prompt) => update(() => ({ sources, prompt })),
          onToken: (piece) => update((x) => ({ pending: false, streaming: true, text: x.text + piece })),
        },
        controller.signal,
      )
      update(() => ({ pending: false, streaming: false, ms: performance.now() - started }))
    } catch (e) {
      if (controller.signal.aborted) {
        update(() => ({ pending: false, streaming: false, stopped: true, ms: performance.now() - started }))
      } else {
        // Keep any partial answer visible; the error replaces it only if nothing arrived
        update((x) =>
          x.text
            ? { pending: false, streaming: false, stopped: true }
            : { pending: false, streaming: false, error: true, text: (e as Error).message },
        )
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null
    }
  }

  const stop = () => abortRef.current?.abort()

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      ask(input)
    }
  }

  return (
    <section className="chat" aria-label="Chat">
      <div className="chat-scroll" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="chat-empty">
            <div className="chat-empty-icon">
              <Sparkles size={20} />
            </div>
            <h2>{ready ? 'What would you like to know?' : 'Prepare your documents first'}</h2>
            <p>
              {ready
                ? 'Answers are generated only from passages retrieved from this project, with the sources shown below each answer.'
                : hasFiles
                  ? 'Your files are uploaded. Process and index them to start asking questions.'
                  : 'Upload PDF or text files, then process and index them to start asking questions.'}
            </p>
            {ready ? (
              <div className="suggestions">
                {SUGGESTIONS.map((s) => (
                  <button key={s} className="suggestion" onClick={() => ask(s)}>
                    {s}
                  </button>
                ))}
              </div>
            ) : (
              <button className="btn btn-primary" onClick={() => onPrepare(hasFiles ? 'prepare' : 'upload')}>
                {hasFiles ? <Zap size={15} /> : <UploadCloud size={15} />}
                {hasFiles ? 'Process & index' : 'Upload documents'}
              </button>
            )}
          </div>
        ) : (
          <div className="thread">
            {messages.map((m) =>
              m.role === 'user' ? (
                <div key={m.id} className="msg msg-user">
                  <p>{m.text}</p>
                </div>
              ) : (
                <AssistantMessage key={m.id} message={m} onRetry={() => m.question && ask(m.question, m.id)} />
              ),
            )}
          </div>
        )}
      </div>

      <div className="composer-wrap">
        {messages.length > 0 && !busy && (
          <button className="clear-chat" onClick={() => setMessages(() => [])}>
            <Trash2 size={13} /> Clear conversation
          </button>
        )}
        <div className={`composer ${!ready ? 'is-disabled' : ''}`}>
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={ready ? 'Ask a question about your documents…' : 'Index your documents to start asking'}
            disabled={!ready}
            aria-label="Question"
          />
          <div className="composer-bar">
            <label className="topk" title="How many passages to retrieve for each answer">
              <span>Passages</span>
              <select value={topK} onChange={(e) => setTopK(Number(e.target.value))} disabled={!ready}>
                {TOP_K.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </label>
            <span className="composer-hint">
              <kbd>Enter</kbd> to send · <kbd>Shift</kbd>+<kbd>Enter</kbd> new line
            </span>
            {busy ? (
              <button className="send-btn is-stop" onClick={stop} aria-label="Stop generating" title="Stop">
                <Square size={12} fill="currentColor" strokeWidth={0} />
              </button>
            ) : (
              <button
                className="send-btn"
                onClick={() => ask(input)}
                disabled={!ready || !input.trim()}
                aria-label="Send question"
              >
                <ArrowUp size={17} strokeWidth={2.4} />
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function AssistantMessage({ message: m, onRetry }: { message: ChatMessage; onRetry: () => void }) {
  const [openSource, setOpenSource] = useState<number | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [copied, setCopied] = useState(false)

  if (m.pending) return <PendingAnswer passages={m.sources?.length} />

  if (m.error) {
    return (
      <div className="msg msg-assistant">
        <div className="msg-avatar is-error">!</div>
        <div className="msg-body">
          <p className="msg-error">{m.text}</p>
          <button className="btn btn-ghost btn-sm" onClick={onRetry}>
            <RotateCcw size={13} /> Try again
          </button>
        </div>
      </div>
    )
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(m.text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="msg msg-assistant">
      <div className="msg-avatar">
        <Sparkles size={14} />
      </div>
      <div className="msg-body">
        <div className="answer">
          {m.text}
          {m.streaming && <span className="caret" aria-hidden />}
        </div>
        {m.stopped && <div className="stopped-note">Stopped</div>}

        {m.sources && m.sources.length > 0 && (
          <div className="sources">
            <div className="sources-label">Sources</div>
            <div className="source-chips">
              {m.sources.map((s, i) => (
                <button
                  key={i}
                  className={`source-chip ${openSource === i ? 'is-open' : ''}`}
                  onClick={() => setOpenSource(openSource === i ? null : i)}
                  aria-expanded={openSource === i}
                >
                  <span className="source-num">{i + 1}</span>
                  <span className="source-name">{sourceLabel(s.metadata)}</span>
                  <span className="source-score">{Math.round(s.score * 100)}%</span>
                </button>
              ))}
            </div>
            {openSource !== null && m.sources[openSource] && (
              <blockquote className="source-card">
                <div className="source-card-head">
                  <span>
                    Passage {openSource + 1} · {sourceLabel(m.sources[openSource].metadata)}
                  </span>
                  <span className="score-bar" aria-label={`Relevance ${Math.round(m.sources[openSource].score * 100)}%`}>
                    <span style={{ width: `${Math.max(0, Math.min(1, m.sources[openSource].score)) * 100}%` }} />
                  </span>
                </div>
                <p>{m.sources[openSource].text}</p>
              </blockquote>
            )}
          </div>
        )}

        <div className="msg-actions" hidden={m.streaming}>
          <button className="icon-btn" onClick={copy} title="Copy answer" aria-label="Copy answer">
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
          <button className="icon-btn" onClick={onRetry} title="Regenerate" aria-label="Regenerate answer">
            <RotateCcw size={14} />
          </button>
          {m.prompt && (
            <button
              className={`btn btn-ghost btn-xs ${showPrompt ? 'is-on' : ''}`}
              onClick={() => setShowPrompt((s) => !s)}
              aria-expanded={showPrompt}
            >
              <TerminalSquare size={13} /> Prompt <ChevronDown size={12} className="chev" />
            </button>
          )}
          {m.ms !== undefined && <span className="msg-meta">{(m.ms / 1000).toFixed(1)}s</span>}
        </div>
        {showPrompt && <pre className="prompt-view">{m.prompt}</pre>}
      </div>
    </div>
  )
}

// Shown until the first token arrives: retrieval, then the model reading the passages
// (and loading into memory on the first question after a while — that can take ~20s on CPU).
function PendingAnswer({ passages }: { passages?: number }) {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [])
  const stage =
    passages === undefined
      ? 'Searching your documents'
      : seconds < 12
        ? `Reading ${passages} passage${passages === 1 ? '' : 's'}`
        : 'Loading the model — the first answer takes longer'

  return (
    <div className="msg msg-assistant" aria-busy="true">
      <div className="msg-avatar is-thinking">
        <Sparkles size={14} />
      </div>
      <div className="msg-body">
        <div className="thinking">
          <span className="thinking-label">{stage}…</span>
          <span className="msg-meta">{seconds}s</span>
        </div>
        <div className="skeleton">
          <span style={{ width: '92%' }} />
          <span style={{ width: '78%' }} />
          <span style={{ width: '54%' }} />
        </div>
      </div>
    </div>
  )
}
