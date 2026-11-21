import { useState, type FormEvent } from 'react'
import { ArrowRight, Layers, MessageSquareText, UploadCloud } from 'lucide-react'
import { PROJECT_NAME, type Health } from './Sidebar'

interface Props {
  health: Health
  healthError: string
  onCreate: (id: string) => void
}

const STEPS = [
  { icon: UploadCloud, title: 'Upload', text: 'Drop in PDFs or text files. They stay on your machine.' },
  { icon: Layers, title: 'Index', text: 'Files are split into passages and embedded with a local model.' },
  { icon: MessageSquareText, title: 'Ask', text: 'Get answers grounded in your passages, with every source shown.' },
]

export function Home({ health, healthError, onCreate }: Props) {
  const [name, setName] = useState('')
  const valid = PROJECT_NAME.test(name)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (valid) onCreate(name)
  }

  return (
    <main className="workspace home">
      <div className="home-inner">
        <section className="home-hero">
          <span className="home-kicker">
            <span className="kicker-dot" /> Private, local retrieval-augmented Q&amp;A
          </span>
          <h1>
            Ask your documents <em>anything.</em>
          </h1>
          <p className="home-lede">
            Turn a folder of PDFs into something you can talk to. Every answer cites the exact passages it came
            from, and nothing ever leaves your computer.
          </p>

          <form className="home-create" onSubmit={submit}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name your first project, e.g. thesis2026"
              aria-label="Project name"
              aria-invalid={name.length > 0 && !valid}
            />
            <button type="submit" className="btn btn-primary btn-lg" disabled={!valid}>
              Create project <ArrowRight size={16} />
            </button>
          </form>
          <p className={`field-hint ${name && !valid ? 'is-error' : ''}`}>
            {name && !valid ? 'Letters and digits only, no spaces.' : 'Letters and digits only.'}
          </p>

          {health === 'offline' && (
            <p className="callout callout-warn">
              {healthError || 'The backend is not reachable.'} Start the API with{' '}
              <code>uvicorn main:app --port 5000</code> from <code>src/</code>.
            </p>
          )}

          <ul className="home-tags">
            <li>Ollama</li>
            <li>Qdrant</li>
            <li>MongoDB</li>
            <li>No paid APIs</li>
          </ul>
        </section>

        <div className="home-visual" aria-hidden>
          <div className="hv-doc hv-doc-back" />
          <div className="hv-doc">
            <span className="hv-doc-name">annual-report.pdf</span>
            <span className="hv-line" style={{ width: '88%' }} />
            <span className="hv-line" style={{ width: '72%' }} />
            <span className="hv-line hv-mark" style={{ width: '94%' }} />
            <span className="hv-line hv-mark" style={{ width: '60%' }} />
            <span className="hv-line" style={{ width: '80%' }} />
            <span className="hv-line" style={{ width: '45%' }} />
          </div>
          <div className="hv-chat">
            <div className="hv-q">What was the revenue growth?</div>
            <div className="hv-a">
              <span className="hv-a-mark" />
              <div>
                Revenue grew <b>18%</b> year over year, driven mainly by the services segment.
                <span className="hv-cite">1</span>
              </div>
            </div>
            <div className="hv-source">
              <span className="hv-cite">1</span> annual-report.pdf <span className="hv-score">92%</span>
            </div>
          </div>
        </div>
      </div>

      <ol className="home-steps">
        {STEPS.map(({ icon: Icon, title, text }, i) => (
          <li key={title}>
            <span className="home-step-icon">
              <Icon size={18} />
            </span>
            <div>
              <span className="home-step-num">0{i + 1}</span>
              <strong>{title}</strong>
              <p>{text}</p>
            </div>
          </li>
        ))}
      </ol>
    </main>
  )
}
