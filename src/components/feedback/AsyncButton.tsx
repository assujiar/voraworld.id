'use client'
import { createContext, useContext, useEffect, useRef, useState, type ButtonHTMLAttributes, type MouseEvent, type ReactNode } from 'react'
import { useScope } from './scope'
import { busyLabel, confirmFor, textOf, uploadLabel, type ActionKey, type ConfirmSpec } from './busy-labels'

/** A form that navigates with a transition (see StepForm) tells its buttons that the next screen is loading. */
export const StepPending = createContext<boolean>(false)

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** What to say while the server works. Defaults to the table in busy-labels.ts, chosen from the button's own text. */
  busy?: string
  /** A stable key from the action map in busy-labels.ts; wins over the text rules. */
  action?: ActionKey
  /** `false` turns off the question some actions ask first (void, delete, confirm funds). */
  confirm?: false | Partial<ConfirmSpec>
  children?: ReactNode
}

/**
 * The one submit button of the portal. It shows what is really happening: the form's own action state (see scope.tsx) is the only source of "pending", so
 * the button never claims to be working when the form is idle, and never claims success (the result is the notice that arrives with the next screen).
 * - While pending the button keeps its place, ignores a second click and says what it is doing, after a short delay so that instant actions do not flash.
 * - When a file is chosen in the form the label names the upload and a bar without a number is shown: a form post cannot report real progress, so none is invented.
 * - Destructive and financial actions ask first in a dialog with its own title and button, then submit the very same form.
 */
export function AsyncButton({ children, busy, action, confirm, className = 'button', onClick, disabled, ...rest }: Props) {
  const scope = useScope()
  const stepPending = useContext(StepPending)
  const ref = useRef<HTMLButtonElement>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const width = useRef(0)
  const [uploading, setUploading] = useState(false)
  const [shown, setShown] = useState(false)
  const pressed = scope.submitter
  const mine = scope.pending && (pressed ? pressed.name === rest.name && pressed.value === String(rest.value ?? '') : !rest.name)
  const pending = mine || stepPending || Boolean(scope.upload)
  const text = textOf(children)
  const spec = confirm === false ? undefined : { ...confirmFor(text), ...confirm } as ConfirmSpec | undefined
  const hasSpec = confirm !== false && Boolean(confirmFor(text) || confirm)

  useEffect(() => {
    if (!pending) { setShown(false); return }
    const timer = setTimeout(() => setShown(true), 140)                  // an action that finishes at once never shows a loader
    return () => clearTimeout(timer)
  }, [pending])

  const click = (e: MouseEvent<HTMLButtonElement>) => {
    onClick?.(e)
    if (e.defaultPrevented || pending) return
    const form = ref.current?.form
    width.current = ref.current?.offsetWidth ?? 0
    setUploading(Boolean(form && [...form.querySelectorAll<HTMLInputElement>('input[type=file]')].some((i) => i.files && i.files.length > 0)))
    if (hasSpec && spec?.title && (rest.type ?? 'submit') === 'submit') {
      e.preventDefault()
      if (form && !form.reportValidity()) return                          // the browser's own checks come first
      dialog.current?.showModal()
    }
  }
  const proceed = () => {
    dialog.current?.close()
    const button = ref.current
    button?.form?.requestSubmit(button)                                      // submits exactly as the click would have, with this button's name and value
  }

  const up = scope.upload
  const sentLabel = up ? `${bytes(up.sent)} dari ${bytes(up.total)}` : ''
  const percent = up && up.total ? Math.min(100, Math.floor((up.sent / up.total) * 100)) : 0
  const label = up ? (up.done ? 'Memeriksa dan menyimpan dokumen…' : `Mengunggah ${up.file} · ${percent}% (${sentLabel})`) : busy ?? (uploading ? uploadLabel(text, action) : busyLabel(text, action))
  const showBusy = pending && shown
  return (
    <>
      <button {...rest} ref={ref} className={`${className}${showBusy ? ' is-busy' : ''}`} disabled={disabled || scope.pending || stepPending} aria-busy={pending || undefined}
        aria-disabled={pending || undefined} onClick={click} style={{ ...rest.style, ...(showBusy && width.current ? { minWidth: width.current } : null) }}>
        {showBusy ? <><span className="spin" aria-hidden="true" /><span>{label}</span></> : children}
        {showBusy && up && !up.done ? <span className="bar-sent" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><span style={{ width: `${percent}%` }} /></span> : null}
        {showBusy && (up?.done || (!up && uploading)) ? <span className="bar-wait" role="progressbar" aria-label={label} /> : null}
      </button>
      <span className="sr-only" role="status" aria-live="polite">{showBusy ? label : ''}</span>
      {hasSpec && spec?.title ? (
        <dialog ref={dialog} className="confirm-dialog" aria-labelledby={`${rest.name ?? 'c'}-t`} onClick={(e) => { if (e.target === dialog.current) dialog.current?.close() }}>
          <h4 id={`${rest.name ?? 'c'}-t`}>{spec.title}</h4>
          <p>{spec.body}</p>
          <div className="inline-actions">
            <button type="button" className="button-outline" onClick={() => dialog.current?.close()}>Kembali</button>
            <button type="button" className={spec.danger ? 'button button-red confirm-yes' : 'button confirm-yes'} onClick={proceed}>{spec.action}</button>
          </div>
        </dialog>
      ) : null}
    </>
  )
}

/** 1.2 MB, 340 KB: the size of what has been sent, for the upload line. */
function bytes(n: number): string {
  if (n >= 1048576) return `${(n / 1048576).toFixed(1)} MB`
  if (n >= 1024) return `${Math.round(n / 1024)} KB`
  return `${n} B`
}
