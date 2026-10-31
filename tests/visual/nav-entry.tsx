import { createRoot } from 'react-dom/client'
import { NavProgress } from '@/components/feedback/NavProgress'

/** The page-to-page progress bar, mounted alone in a plain page with a few links, to press them for real. */
createRoot(document.getElementById('root')!).render(<NavProgress />)
