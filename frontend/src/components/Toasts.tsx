import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'

export interface Toast {
  id: string
  kind: 'success' | 'error' | 'info'
  text: string
}

const ICONS = { success: CheckCircle2, error: AlertCircle, info: Info }

export function Toasts({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => {
        const Icon = ICONS[t.kind]
        return (
          <div key={t.id} className={`toast toast-${t.kind}`}>
            <Icon size={16} />
            <span>{t.text}</span>
            <button className="icon-btn" onClick={() => onDismiss(t.id)} aria-label="Dismiss">
              <X size={14} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
