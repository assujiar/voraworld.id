import { AdminPage, type Notices } from '@/components/admin/AdminPage'
import { InvoiceForm } from '@/components/admin/InvoiceForm'
import { sql } from '@/server/db'
import { today } from '@/server/dates'

export default async function NewInvoice({ searchParams }: { searchParams: Promise<Notices> }) {
  const customers = (await sql`select id, name, currency, terms_days from customers order by name limit 500`).map((c) => ({ id: c.id as number, name: c.name as string, currency: c.currency as string, termsDays: c.termsDays as number }))
  const banks = (await sql`select id, bank_name, account_number, currency, is_default from bank_accounts where active order by currency, is_default desc, position`).map((b) => ({
    id: b.id as number, label: `${b.bankName} · ${b.accountNumber} · ${b.currency}`, currency: b.currency as string, isDefault: b.isDefault as boolean,
  }))
  return <AdminPage heading="Create invoice" sp={await searchParams}><InvoiceForm customers={customers} banks={banks} today={today()} /></AdminPage>
}
