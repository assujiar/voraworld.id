/** Rule-based shipment escalation. No AI can suppress these server-generated actions. */
export type CargoRisk = 'charcoal' | 'activated_carbon' | 'dangerous_goods' | 'temperature_controlled' | 'oversized_heavy' | 'restricted' | 'special_handling'
export type AgentAction = { type: 'request_quote'; href: string; label: string; reason: CargoRisk }
export type RiskAssessment = { category: CargoRisk; guidance: string } | null

const risks: Array<{ category: CargoRisk; pattern: RegExp; guidance: string }> = [
  { category: 'charcoal', pattern: /\b(charcoal|briquettes?|coconut.?shell.?charcoal|arang|briket|briket arang)\b/i,
    guidance: 'Charcoal and many charcoal briquettes shipped by sea need DG classification review. Under mandatory IMDG Code Amendment 42-24 (2026), charcoal of animal/vegetable origin is generally UN 1361, Class 4.2 with SP978 conditions. Distinguish it from activated carbon UN 1362 and its SP979 conditions. Request SDS, production process/date, packaging and origin/destination. Do not assert carrier acceptance. ALWAYS guide to Request a Quote for assessment.' },
  { category: 'activated_carbon', pattern: /\b(activated.?carbon|karbon aktif|arang aktif|carbon activated)\b/i,
    guidance: 'Activated carbon is not automatically identical to charcoal UN 1361. Under IMDG 42-24, UN 1362 CARBON, ACTIVATED with SP979 may have specific exemption pathways depending on manufacturing and test evidence. Ask for production process, SDS, relevant classification/test evidence, packing and routing; do not automatically say non-DG or Class 4.2. Direct this shipment to Request a Quote for classification and carrier acceptance.' },
  { category: 'dangerous_goods', pattern: /\b(dangerous.?goods|hazmat|hazardous|dg|dg cargo|dg shipment|class [1-9]\b|un\s?\d{4}\b|bahan berbahaya|barang berbahaya|b3|lithium|li.?ion|battery|baterai|chemical|bahan kimia|flammable|mudah terbakar|explosive|aerosol|gas cylinder|dry ice|solvent|cat industri|pesticide)\b/i,
    guidance: 'DG classification requires substance identity, UN number, proper shipping name, hazard class, packing group where applicable, SDS (not definitive alone), packaging, quantities and transport mode. IMDG applies to sea, IATA DGR/ICAO TI to air; actual acceptance is carrier-specific. No definitive booking, exemption, packing, or clearance promise. Guide to Request a Quote with SDS and packaging details.' },
  { category: 'temperature_controlled', pattern: /\b(reefer|refrigerated|temperature controlled|temperature.?sensitive|cold chain|frozen|chilled|chiller|cooling|pendingin|beku|suhu|temperature|buah segar|ikan segar|vaccine|vaksin|frozen food|fresh produce|perishable)\b/i,
    guidance: 'Reefer/cold-chain cargo needs commodity, setpoint in degrees C, acceptable temperature range, quantity, packaging, ventilation/humidity needs, required logger, plug/power requirements, shelf life and contingency. Equipment availability and transport feasibility need vendor check. Guide to Request a Quote.' },
  { category: 'oversized_heavy', pattern: /\b(oog|out.?of.?gauge|oversized|over.?dimension|over.?weight|heavy.?lift|break.?bulk|project cargo|flat.?rack|open.?top|lowbed|modular trailer|transformer|turbin|turbine|generator besar|excavator|alat berat|berat (?:puluhan|ratusan) ton|(?:[3-9]\d|[1-9]\d{2,})\s?(?:ton|tonnes|mt)|crane|crawler crane|rigging|lashing plan|route survey|center of gravity|co.?g)\b/i,
    guidance: 'OOG, heavy-lift and breakbulk require per-piece dimensions, gross weights, lifting points, CoG, packing drawings, stowage/securing constraints, route and port assessment, equipment and vessel feasibility. Do not claim confirmed capacity or routing. Guide to Request a Quote with drawings and readiness date.' },
  { category: 'restricted', pattern: /\b(lartas|restricted cargo|restricted goods|izin ekspor|izin impor|persetujuan impor|persetujuan ekspor|permit|import licence|export licence|produk bekas|used machinery|barang bekas|limbah|waste shipment|sanctioned|embargo|quarantine|karantina|phytosanitary|cosmetic|kosmetik|medical device|alat kesehatan)\b/i,
    guidance: 'Regulated/restricted shipments require HS classification and live permit checks via Indonesia INSW/INTR, CEISA and relevant national authorities, and destination rules. Never identify a definitive permit from a broad commodity name, assert approval, or guarantee clearance. Guide to Request a Quote with HS code where known, specifications and destination.' },
  { category: 'special_handling', pattern: /\b(special handling|fragile cargo|high value|high-value|oversize|abnormal load|uncrated|sensitive equipment|shock sensitive|shock.?logger|white glove|kargo khusus|penanganan khusus|barang pecah belah)\b/i,
    guidance: 'Special-handling cargo needs detailed packing, dimensions, weights, handling constraints, insurance and equipment/vendor review. Never imply capability or rate is confirmed. Guide to Request a Quote.' },
]

/** Includes recent user messages so follow-ups such as "Surabaya, December" retain cargo risk. */
export function assessCargoRisk(turns: ReadonlyArray<{ role: string; content: string }>): RiskAssessment {
  const combined = turns.filter((t) => t.role === 'user').slice(-10).map((t) => t.content).join(' ').slice(-4500)
  for (const risk of risks) if (risk.pattern.test(combined)) return { category: risk.category, guidance: risk.guidance }
  return null
}

export function agentActions(risk: RiskAssessment, locale: 'id' | 'en'): AgentAction[] {
  if (!risk) return []
  return [{ type: 'request_quote', href: `/${locale}/request-quote`, label: locale === 'id' ? 'Request Quote untuk Shipment Ini' : 'Request a Quote for This Shipment', reason: risk.category }]
}

export function cargoSafetyInstructions(risk: RiskAssessment, locale: 'id' | 'en'): string {
  if (!risk) return ''
  return `MANDATORY CARGO SAFETY / COMMERCIAL HANDOFF (${risk.category})\n${risk.guidance}\nAnswer in ${locale === 'id' ? 'natural Indonesian' : 'natural English'}. Explain the relevant shipping caution briefly and request the most useful missing shipment detail. Explicitly suggest the Request a Quote action. The interface independently displays a clickable quotation button, so do not print raw URLs or Markdown links. Never say a DG/restricted/special cargo can be handled or booked without review.`
}
