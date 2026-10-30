import { fmt } from '@/components/admin/AdminPage'
import type { MailLine } from '@/server/mail/history'

const LABEL: Record<string, string> = { queued: 'Queued', sending: 'Sending', sent: 'Sent', retry: 'Failed, will retry', failed: 'Failed (retries used up)' }

/** What happened to the emails of a document. A failed email changes nothing about the document or its payment. */
export function MailHistory({ lines }: { lines: MailLine[] }) {
  return (
    <div className="admin-panel"><h4>Emails</h4>
      {lines.length ? (
        <table><thead><tr><th>Queued</th><th>To</th><th>Attachments</th><th>Status</th><th>Detail</th></tr></thead><tbody>
          {lines.map((l) => (
            <tr key={l.id}>
              <td>{fmt(l.createdAt)}</td><td>{l.recipient}</td><td>{l.attachments} PDF{l.attachments > 1 ? 's' : ''}</td>
              <td><span className="status">{LABEL[l.status] ?? l.status}</span></td>
              <td className="mini">{l.sentAt ? `sent ${fmt(l.sentAt)}` : l.error || `${l.attempts} attempt(s)`}</td>
            </tr>
          ))}
        </tbody></table>
      ) : <p className="note">No email has been queued for this document yet.</p>}
      <p className="mini muted">SMTP and the matching email rule must be on. Failed emails are retried automatically and from SMTP &amp; Email Rules.</p>
    </div>
  )
}
