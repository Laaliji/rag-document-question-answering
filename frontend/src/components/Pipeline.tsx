import { Check } from 'lucide-react'

interface Props {
  files: number
  chunks: number
  indexed: number
}

// Upload → Chunk → Index: a progress track showing where the project is in the RAG pipeline.
export function Pipeline({ files, chunks, indexed }: Props) {
  const stale = indexed > 0 && chunks > 0 && indexed !== chunks
  const steps = [
    { label: 'Uploaded', detail: `${files} file${files === 1 ? '' : 's'}`, done: files > 0 },
    { label: 'Chunked', detail: `${chunks} chunks`, done: chunks > 0 },
    { label: stale ? 'Index outdated' : 'Indexed', detail: `${indexed} vectors`, done: indexed > 0, warn: stale },
  ]
  return (
    <ol className="pipeline" aria-label="Pipeline status">
      {steps.map((s, i) => (
        <li key={s.label} className={`${s.done ? 'is-done' : ''} ${s.warn ? 'is-warn' : ''}`}>
          <span className="pipeline-mark">{s.done && !s.warn ? <Check size={11} strokeWidth={3.2} /> : i + 1}</span>
          <span className="pipeline-text">
            <span>{s.label}</span>
            <small>{s.detail}</small>
          </span>
        </li>
      ))}
    </ol>
  )
}
