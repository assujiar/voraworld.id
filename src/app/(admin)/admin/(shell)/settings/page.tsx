import { saveSettingsAction } from '@/actions/settings'
import { AdminPage, Back, type Notices } from '@/components/admin/AdminPage'
import { SETTING_FIELDS, WIDE_SETTINGS } from '@/server/setting-fields'
import { settingMap } from '@/server/settings'
import { AsyncButton } from '@/components/feedback/AsyncButton'
import { PendingForm } from '@/components/feedback/scope'

export default async function Settings({ searchParams }: { searchParams: Promise<Notices> }) {
  const settings = await settingMap()
  return (
    <AdminPage heading="Site settings" sp={await searchParams}>
      <div className="admin-panel">
        <p className="note">Published values are used immediately on public pages and documents. Brand identity tokens and the approved logo are locked in code.</p>
        <PendingForm action={saveSettingsAction}><Back to="/admin/settings" />
          <div className="admin-form-grid">
            {SETTING_FIELDS.map(([key, label]) => (
              <div className={`field ${WIDE_SETTINGS.includes(key) ? 'wide' : ''}`} key={key}>
                <label>{label}</label>
                {WIDE_SETTINGS.includes(key) ? <textarea name={key} defaultValue={settings[key] ?? ''} /> : <input name={key} defaultValue={settings[key] ?? ''} />}
              </div>
            ))}
          </div>
          <AsyncButton className="button">Save &amp; publish settings</AsyncButton>
        </PendingForm>
      </div>
    </AdminPage>
  )
}
