import { AdminSidebar } from '@/components/admin/AdminSidebar'
import { logout } from '@/actions/auth'
import { requirePageUser } from '@/server/page-auth'

export default async function Shell({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser()
  return (
    <div className="admin-layout">
      <AdminSidebar>
        <h5>ACCOUNT</h5>
        <a href="/en">View public site ↗</a>
        <form action={logout} style={{ margin: 0 }}><button className="logout-button" type="submit">Log out</button></form>
        <p className="mini" style={{ color: '#9faeb7', padding: 12 }}>{user.email} · {user.role}</p>
      </AdminSidebar>
      <main className="admin-main">{children}</main>
    </div>
  )
}
