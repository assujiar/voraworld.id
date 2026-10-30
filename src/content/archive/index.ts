import { y2023 } from './y2023'
import type { ArchiveDraft } from './types'

export const ALL: ArchiveDraft[] = [...y2023]
export { SOURCES } from './sources'
export { renderBody, bodyWords } from './render'
export type { ArchiveDraft, LangDraft, Section, SourceRef } from './types'
