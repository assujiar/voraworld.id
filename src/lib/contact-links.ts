/** Let Google Maps choose the visitor's location; VORA never reads or stores their coordinates. */
export function officeDirectionsUrl(address: string): string {
  const url = new URL('https://www.google.com/maps/dir/')
  url.searchParams.set('api', '1')
  url.searchParams.set('destination', address.trim())
  return url.toString()
}
