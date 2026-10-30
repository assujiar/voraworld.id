import { AdminPage, type Notices } from '@/components/admin/AdminPage'
import { InvoiceForm } from '@/components/admin/InvoiceForm'
import { many } from '@/server/data'
import { today } from '@/server/dates'

export default async function NewInvoice({ searchParams }: { searchParams: Promise<Notices> }) {
  const customers = (await many('customers', (q) => q.order('name'), 'id,name,currency,terms_days', 500)).map((c) => ({ id: c.id as number, name: c.name as string, currency: c.currency as string, termsDays: c.termsDays as number }))
  const banks = (await many('bank_accounts', (q) => q.eq('active', true).order('currency').order('is_default', { ascending: false }).order('position'), 'id,bank_name,account_number,currency,is_default')).map((b) => ({
    id: b.id as number, label: `${b.bankName} · ${b.accountNumber} · ${b.currency}`, currency: b.currency as string, isDefault: b.isDefault as boolean,
  }))
  return <AdminPage heading="Create invoice" sp={await searchParams}><InvoiceForm customers={customers} banks={banks} today={today()} /></AdminPage>
}
