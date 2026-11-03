import type { VisualAsset } from './visual-assets'

/** The overview, company story and service directory have different visual roles. */
export const serviceArt: Record<'home' | 'about' | 'directory', Record<string, VisualAsset>> = {
  home: {
    'international-freight-forwarding': 'global-cargo',
    'customs-brokerage': 'documents',
    '3pl-warehousing': 'racking',
    'domestic-distribution': 'delivery-tracking',
    'project-cargo': 'n02-heavy-lift',
  },
  about: {
    'international-freight-forwarding': 'global-cargo',
    'customs-brokerage': 'n01-customs-clearance',
    '3pl-warehousing': 'warehouse-routing',
    'domestic-distribution': 'shipment-app',
    'project-cargo': 'n02-heavy-lift',
  },
  directory: {
    'international-freight-forwarding': 'network-globe',
    'customs-brokerage': 'documents',
    '3pl-warehousing': 'rack-handling',
    'domestic-distribution': 'route-schedule',
    'project-cargo': 'n02-heavy-lift',
  },
}
