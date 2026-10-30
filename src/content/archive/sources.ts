import type { SourceRef } from './types'

/**
 * Primary sources the drafts cite. `accessed` is the day the page was read while the drafts were written (2026-10-30); a source that could not be
 * reached that day carries null and is listed for a recheck before publication. An archive period never makes a current page evidence of what applied then.
 */
export const SOURCES: Record<string, SourceRef> = {
  S1: { id: 'S1', title: 'ICC, Incoterms® 2020', url: 'https://iccwbo.org/business-solutions/incoterms-rules/incoterms-2020/', accessed: '2026-10-30' },
  S2: { id: 'S2', title: 'IMO, MSC.1/Circ.1475, Guidelines regarding the verified gross mass of a container carrying cargo (9 June 2014)', url: 'https://wwwcdn.imo.org/localresources/en/OurWork/Safety/Documents/MSC.1%20Circ.1475.pdf', accessed: '2026-10-30' },
  S3: { id: 'S3', title: 'IMO/ILO/UNECE, Code of Practice for Packing of Cargo Transport Units (CTU Code)', url: 'https://www.imo.org/en/ourwork/safety/pages/ctu-code.aspx', accessed: '2026-10-30' },
  S4: { id: 'S4', title: 'IATA, European Air Cargo Programme (EACP) Handbook, Edition 23, section on chargeable weight', url: 'https://www.iata.org/contentassets/e9cb5a72b88f4f68a5cfc572a50b60c9/eacph-en-final.pdf', accessed: '2026-10-30' },
  S5: { id: 'S5', title: 'World Customs Organization, Harmonized System Convention', url: 'https://www.wcoomd.org/en/topics/nomenclature/instrument-and-tools/hs_convention.aspx?p=1', accessed: null },
  S6: { id: 'S6', title: 'DJBC, Impor Untuk Dipakai', url: 'https://www.beacukai.go.id/impor-untuk-dipakai', accessed: '2026-10-30' },
  S7: { id: 'S7', title: 'GS1, Logistic Label Guideline, release 1.3 (July 2019)', url: 'https://ref.gs1.org/guidelines/logistic-label/', accessed: '2026-10-30' },
  S8: { id: 'S8', title: 'FIATA, Documents and Resources', url: 'https://fiata.org/resources/', accessed: '2026-10-30' },
  S9: { id: 'S9', title: 'IMO, Code of Safe Practice for Cargo Stowage and Securing (CSS Code)', url: 'https://www.imo.org/en/ourwork/safety/pages/css-code.aspx', accessed: '2026-10-30' },
  S10: { id: 'S10', title: 'Maersk, Terms for Detention and Demurrage (one carrier’s terms, not universal)', url: 'https://terms.maersk.com/dnd', accessed: '2026-10-30' },
  S11: { id: 'S11', title: 'GS1, What is the GS1 Traceability Standard?', url: 'https://support.gs1.org/support/solutions/articles/43000734535-what-is-the-gs1-traceability-standard-', accessed: '2026-10-30' },
  S12: { id: 'S12', title: 'IATA, Dangerous Goods Regulations (DGR)', url: 'https://www.iata.org/dgr/', accessed: '2026-10-30' },
}
