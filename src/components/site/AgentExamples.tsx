'use client'
import { AGENT_PREFILL_EVENT } from '@/content/vora-agent-page'

/** Example questions on the VORA Agent page: choosing one puts it in the chat input; the visitor still sends it. */
export function AgentExamples({ examples }: { examples: string[] }) {
  return (
    <ul className="vora-agent-examples">
      {examples.map((text) => (
        <li key={text}>
          <button type="button" onClick={() => window.dispatchEvent(new CustomEvent(AGENT_PREFILL_EVENT, { detail: { text } }))}>
            {text}<span aria-hidden="true">↗</span>
          </button>
        </li>
      ))}
    </ul>
  )
}
