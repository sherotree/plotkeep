import { parseSpreadsheet, type ParsedTable } from './csv'

export type SampleId = 'invoices' | 'hours' | 'skus' | 'traffic'

export type Sample = {
  id: SampleId
  label: string
  blurb: string
  csv: string
}

export const SAMPLES: Sample[] = [
  {
    id: 'invoices',
    label: 'Freelance invoices',
    blurb: 'Six months of invoice totals. Typical desk copy.',
    csv: `month,invoiced,collected,overdue
Jan,4200,3900,280
Feb,3100,3100,0
Mar,5600,4800,620
Apr,4400,4100,190
May,6100,5400,450
Jun,3900,3600,240`,
  },
  {
    id: 'hours',
    label: 'Hours by client',
    blurb: 'A week of billable time. Mix chart, not a trend.',
    csv: `client,hours,rate
Northwind,18.5,95
Birch Studio,12,110
Harbor CPA,9.5,85
Personal,4,0
Kite Co-op,7.25,90`,
  },
  {
    id: 'skus',
    label: 'Cafe SKUs',
    blurb: 'Saturday tickets at a three-item counter.',
    csv: `item,tickets,revenue
Drip,64,192
Pour-over,28,168
Cortado,41,205
Pastry,33,132
Retail beans,9,162`,
  },
  {
    id: 'traffic',
    label: 'Site visits',
    blurb: 'Weekly sessions vs sign-ups. Two numeric series.',
    csv: `week,sessions,signups
W1,820,18
W2,910,21
W3,740,12
W4,1280,34
W5,1175,29
W6,990,22
W7,1410,41
W8,1330,36`,
  },
]

export function loadSample(id: SampleId): ParsedTable {
  const sample = SAMPLES.find((item) => item.id === id)
  if (!sample) throw new Error(`Unknown sample: ${id}`)
  return parseSpreadsheet(sample.csv)
}

export function sampleCsv(id: SampleId): string {
  const sample = SAMPLES.find((item) => item.id === id)
  if (!sample) throw new Error(`Unknown sample: ${id}`)
  return sample.csv
}
