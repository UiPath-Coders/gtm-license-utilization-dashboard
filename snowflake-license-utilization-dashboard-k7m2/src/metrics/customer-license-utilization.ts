import type { MetricFn } from '@/lib/metric-contract'

const ENTITY_ID = 'bab8b763-1687-f111-b338-6045bddc3060'

export const fetchData: MetricFn = async (sdk) => {
  const { Entities } = await import('@uipath/uipath-typescript/entities')
  const { fetchAll } = await import('@/lib/paginate')
  const entities = new Entities(sdk)
  const records = await fetchAll(cursor => entities.queryRecordsById(ENTITY_ID, {
    pageSize: 200,
    cursor,
    selectedFields: ['CustomerName', 'LicenseCode', 'SubsidiaryId', 'ProductCode', 'Consumable', 'PurchasedUnits', 'ConsumedUnits', 'AvailableUnits', 'UtilizationPercent', 'IsCurrent'],
    sortOptions: [
      { fieldName: 'CustomerName', isDescending: false },
      { fieldName: 'ProductCode', isDescending: false }
    ]
  }))
  return records.filter(record => record.IsCurrent !== false).map(record => ({
    customerName: String(record.CustomerName ?? ''),
    licenseCode: String(record.LicenseCode ?? ''),
    subsidiaryId: String(record.SubsidiaryId ?? ''),
    category: String(record.Consumable ?? record.ProductCode ?? ''),
    productCode: String(record.ProductCode ?? ''),
    purchased: Number(record.PurchasedUnits ?? 0),
    consumedAllocated: Number(record.ConsumedUnits ?? 0),
    available: Number(record.AvailableUnits ?? 0),
    utilizationPercent: Number(record.UtilizationPercent ?? 0)
  }))
}
