import { ActionError } from '../errors'
import { HttpError } from '../http'

/** What the Data API reports about a failed request. */
export interface ApiError { code?: string; message: string; details?: string | null; hint?: string | null }

/**
 * Business rules raised inside the database (the RPC functions) use SQLSTATE `VR` + the status they stand for, for example `VR409` for
 * "already confirmed". They come back as ActionError, so a form shows the message and a route answers with the status.
 */
const BUSINESS = /^VR(\d{3})$/

export function failure(error: ApiError): Error {
  const m = BUSINESS.exec(error.code ?? '')
  if (m) return new ActionError(error.message, Number(m[1]))
  const e = new Error(error.message || 'The database request failed') as Error & { code?: string; details?: string | null; hint?: string | null }
  e.code = error.code
  e.details = error.details
  e.hint = error.hint
  return e
}

export const notFound = (what: string) => new HttpError(404, `${what} not found`)
