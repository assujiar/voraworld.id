import { createRoot } from 'react-dom/client'
import { VerifyView } from '@/components/verify/VerifyView'
import type { VerifyModel } from '@/server/trust/verification-view'

/** Draws the verification page in the browser from a model in the page, so that the buttons and the file check can be exercised for real. */
const w = window as unknown as { __MODEL__: VerifyModel }
createRoot(document.getElementById('root')!).render(<VerifyView model={w.__MODEL__} token="AbCdEfGhIjKlMnOpQrStUvWxYz0123456789" origin="https://voraworld.id" viewedAt={new Date('2026-10-31T04:42:00Z')} />)
