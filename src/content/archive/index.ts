import { y2023 } from './y2023'
import { y2024 } from './y2024'
import { y2025 } from './y2025'
import { y2026 } from './y2026'
import type { ArchiveDraft } from './types'

export const ALL: ArchiveDraft[] = [...y2023, ...y2024, ...y2025, ...y2026]
export { SOURCES } from './sources'
export { renderBody, bodyWords } from './render'
export type { ArchiveDraft, LangDraft, Section, SourceRef } from './types'
