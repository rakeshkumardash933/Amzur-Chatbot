import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Bot, CheckCircle2, Clock3, Loader2, Send, ShieldAlert, Sparkles, Ticket } from 'lucide-react'

import { useAuth } from '@/contexts/AuthContext'
import api from '@/lib/api'

type TicketPriority = 'low' | 'medium' | 'high' | 'critical'

interface TicketFormState {
  requester_name: string
  requester_email: string
  subject: string
  description: string
  category: string
  priority: TicketPriority
  department: string
}

interface TicketWorkflowResponse {
  success: boolean
  message: string
  ticket_id?: string | null
  category?: string | null
  priority?: string | null
  workflow_state?: string | null
  workflow_response?: Record<string, unknown> | null
  sent_payload?: Record<string, unknown> | null
}

const PRESETS: Array<Pick<TicketFormState, 'subject' | 'description' | 'category' | 'priority' | 'department'>> = [
  {
    subject: 'Production login failures for finance users',
    description:
      'Several finance team members are unable to access the application after password resets. They receive repeated authentication errors and cannot continue their work.',
    category: 'authentication',
    priority: 'critical',
    department: 'Finance',
  },
  {
    subject: 'Invoice export is running slowly',
    description:
      'The invoice export flow still completes, but it takes more than 10 minutes for large batches. Please investigate performance and alerting.',
    category: 'performance',
    priority: 'high',
    department: 'Operations',
  },
  {
    subject: 'Question about dashboard filters',
    description:
      'A support agent would like clarification on the available filter combinations in the new reporting dashboard.',
    category: 'how-to',
    priority: 'low',
    department: 'Support',
  },
]

const INITIAL_FORM: TicketFormState = {
  requester_name: '',
  requester_email: '',
  subject: '',
  description: '',
  category: 'general',
  priority: 'medium',
  department: '',
}

const WORKFLOW_STEPS = [
  'Webhook receives the ticket',
  'n8n classifies priority and category',
  'High-priority issues trigger Gmail alerts',
  'Ticket data is persisted in Supabase',
]

export const SupportTicketPage = () => {
  const navigate = useNavigate()
  const { logout, user } = useAuth()
  const [form, setForm] = useState<TicketFormState>(() => ({
    ...INITIAL_FORM,
    requester_name: user?.name ?? '',
    requester_email: user?.email ?? '',
  }))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<TicketWorkflowResponse | null>(null)

  const summary = useMemo(
    () => [
      { label: 'Automation', value: 'n8n workflow' },
      { label: 'Alerts', value: 'Gmail for high priority' },
      { label: 'Audit log', value: 'Supabase persistence' },
    ],
    []
  )

  const updateField = <K extends keyof TicketFormState>(field: K, value: TicketFormState[K]) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const applyPreset = (preset: (typeof PRESETS)[number]) => {
    setForm((current) => ({
      ...current,
      ...preset,
    }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setResult(null)

    const payload = {
      ...form,
      department: form.department.trim() || null,
      metadata: {
        portal: 'frontend',
        workflow: 'support-ticket-automation',
      },
    }

    setIsSubmitting(true)
    try {
      const response = await api.post<TicketWorkflowResponse>('/tickets/submit', payload)
      setResult(response.data)
    } catch (submissionError) {
      const message =
        submissionError instanceof Error
          ? submissionError.message
          : 'Unable to submit the ticket workflow request.'
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const isReady = Boolean(
    form.requester_name.trim() &&
    form.requester_email.trim() &&
    form.subject.trim() &&
    form.description.trim()
  )

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 right-0 h-96 w-96 rounded-full bg-rose-500/20 blur-3xl" />
        <div className="absolute top-1/3 left-0 h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 md:px-6 py-4 md:py-6 space-y-4">
        <header className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-4 md:p-6 flex flex-wrap items-center justify-between gap-3 shadow-2xl shadow-black/20">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-orange-500 text-white shadow-lg shadow-rose-500/30">
              <Ticket className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-rose-300">
                <Sparkles className="h-3.5 w-3.5" />
                Support automation
              </div>
              <h1 className="text-xl md:text-3xl font-semibold">AI-Powered Ticket Intake</h1>
              <p className="text-sm text-slate-300 mt-1">
                Submit a ticket once and let n8n triage it, alert the right people, and store the audit trail.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 hover:bg-white/10"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Chat
            </button>
            <button
              onClick={() => navigate('/database')}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 hover:bg-white/10"
            >
              DB Chat
            </button>
            <button
              onClick={() => navigate('/sheets')}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 hover:bg-white/10"
            >
              Sheet Agent
            </button>
            <button
              onClick={handleLogout}
              className="rounded-xl bg-white text-slate-950 px-3 py-2 text-sm font-medium hover:opacity-90"
            >
              Logout
            </button>
          </div>
        </header>

        {error && (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        )}

        {result?.success && (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            {result.message}
          </div>
        )}

        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr] items-start">
          <section className="space-y-4">
            <div className="rounded-3xl border border-white/10 bg-slate-900/80 backdrop-blur-xl p-5 md:p-6 shadow-2xl shadow-black/20">
              <div className="flex items-center gap-2 text-sm text-slate-300 mb-4">
                <ShieldAlert className="h-4 w-4 text-rose-300" />
                Ticket payload
              </div>

              <form onSubmit={handleSubmit}>
                <div className="grid gap-3 sm:grid-cols-2 mb-5">
                  <label className="space-y-2">
                    <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Requester name</span>
                    <input
                      value={form.requester_name}
                      onChange={(event) => updateField('requester_name', event.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm outline-none transition focus:border-rose-400/70 focus:ring-2 focus:ring-rose-400/20"
                      placeholder="Jane Doe"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Requester email</span>
                    <input
                      type="email"
                      value={form.requester_email}
                      onChange={(event) => updateField('requester_email', event.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm outline-none transition focus:border-rose-400/70 focus:ring-2 focus:ring-rose-400/20"
                      placeholder="jane@company.com"
                    />
                  </label>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 mb-5">
                  <label className="space-y-2">
                    <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Subject</span>
                    <input
                      value={form.subject}
                      onChange={(event) => updateField('subject', event.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm outline-none transition focus:border-rose-400/70 focus:ring-2 focus:ring-rose-400/20"
                      placeholder="Production outage for sales portal"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Department</span>
                    <input
                      value={form.department}
                      onChange={(event) => updateField('department', event.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm outline-none transition focus:border-rose-400/70 focus:ring-2 focus:ring-rose-400/20"
                      placeholder="Operations"
                    />
                  </label>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 mb-5">
                  <label className="space-y-2">
                    <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Category</span>
                    <input
                      value={form.category}
                      onChange={(event) => updateField('category', event.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm outline-none transition focus:border-rose-400/70 focus:ring-2 focus:ring-rose-400/20"
                      placeholder="authentication"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Priority</span>
                    <select
                      value={form.priority}
                      onChange={(event) => updateField('priority', event.target.value as TicketPriority)}
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm outline-none transition focus:border-rose-400/70 focus:ring-2 focus:ring-rose-400/20"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </label>
                </div>

                <label className="space-y-2 block mb-5">
                  <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Description</span>
                  <textarea
                    value={form.description}
                    onChange={(event) => updateField('description', event.target.value)}
                    rows={8}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm outline-none transition focus:border-rose-400/70 focus:ring-2 focus:ring-rose-400/20 resize-y"
                    placeholder="Describe the issue, its impact, and any relevant context."
                  />
                </label>

                <div className="flex flex-wrap gap-2 mb-5">
                  {PRESETS.map((preset) => (
                    <button
                      key={preset.subject}
                      type="button"
                      onClick={() => applyPreset(preset)}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/10"
                    >
                      Load example: {preset.priority}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => navigate('/game')}
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 hover:bg-white/10"
                  >
                    AI Game
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/research')}
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 hover:bg-white/10"
                  >
                    Research
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !isReady}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-orange-500 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-rose-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Send to n8n
                  </button>
                </div>
              </form>
            </div>

            {result && (
              <div className="rounded-3xl border border-white/10 bg-slate-900/80 backdrop-blur-xl p-5 md:p-6 shadow-2xl shadow-black/20">
                <div className="flex items-center gap-2 text-emerald-300 mb-3">
                  <CheckCircle2 className="h-4 w-4" />
                  Workflow response
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Ticket ID</p>
                    <p className="mt-2 text-sm text-white">{result.ticket_id || 'Pending workflow output'}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">State</p>
                    <p className="mt-2 text-sm text-white">{result.workflow_state || 'Submitted'}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Priority</p>
                    <p className="mt-2 text-sm text-white">{result.priority || form.priority}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Category</p>
                    <p className="mt-2 text-sm text-white">{result.category || form.category}</p>
                  </div>
                </div>

                {result.sent_payload && (
                  <div className="mt-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-2">Payload sent to n8n</p>
                    <pre className="overflow-auto rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-xs text-slate-300 max-h-64">
                      {JSON.stringify(result.sent_payload, null, 2)}
                    </pre>
                  </div>
                )}

                {result.workflow_response && (
                  <div className="mt-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-2">N8n response</p>
                    <pre className="overflow-auto rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-xs text-slate-300 max-h-64">
                      {JSON.stringify(result.workflow_response, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </section>

          <aside className="space-y-4">
            <div className="rounded-3xl border border-white/10 bg-slate-900/80 backdrop-blur-xl p-5 md:p-6 shadow-2xl shadow-black/20">
              <div className="flex items-center gap-2 text-sm text-slate-200 mb-4">
                <Bot className="h-4 w-4 text-cyan-300" />
                Workflow overview
              </div>
              <div className="space-y-3">
                {WORKFLOW_STEPS.map((step, index) => (
                  <div key={step} className="flex items-start gap-3 rounded-2xl border border-white/5 bg-white/5 p-3">
                    <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white">
                      {index + 1}
                    </div>
                    <div>
                      <p className="text-sm text-white">{step}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/90 to-slate-800/90 p-5 md:p-6 shadow-2xl shadow-black/20">
              <div className="flex items-center gap-2 text-sm text-slate-200 mb-4">
                <Clock3 className="h-4 w-4 text-amber-300" />
                Submission hints
              </div>
              <div className="space-y-3 text-sm text-slate-300">
                {summary.map((item) => (
                  <div key={item.label} className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/5 px-4 py-3">
                    <span className="text-slate-400">{item.label}</span>
                    <span className="text-white">{item.value}</span>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs leading-6 text-slate-500">
                Your backend should point to the production n8n webhook URL via <span className="text-slate-300">N8N_TICKET_WEBHOOK_URL</span>.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

export default SupportTicketPage