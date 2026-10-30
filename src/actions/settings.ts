'use server'
import { ActionError, adminRun } from '@/server/action'
import { recordAudit } from '@/server/audit'
import { cleanPath } from '@/server/cms'
import { insert, one, update } from '@/server/data'
import { publicBaseUrl } from '@/server/env'
import { afterResponse } from '@/server/after'
import { int, rawStr, str } from '@/server/http'
import { saveMailConfig } from '@/server/mail/config'
import { dispatch, retryJob } from '@/server/mail/outbox'
import { cleanEmailHtml } from '@/server/mail/sanitize-email'
import { previewTemplate } from '@/server/mail/preview'
import { saveSettings } from '@/server/settings'
import { send } from '@/server/mail/transport'
import { getMailConfig } from '@/server/mail/config'
import { SETTING_KEYS } from '@/server/setting-fields'

export async function saveSettingsAction(form: FormData) {
  return adminRun(form, async ({ user }) => {
    await saveSettings(SETTING_KEYS, Object.fromEntries(SETTING_KEYS.map((k) => [k, rawStr(form, k)])))
    await recordAudit(user.id, 'publish', 'settings', 0, SETTING_KEYS.join(','))
    return { to: '/admin/settings', notice: 'Public settings published' }
  })
}

export async function addCoverageAction(form: FormData) {
  return adminRun(form, async ({ user }) => {
    const region = str(form, 'region', 160)
    if (!region) throw new ActionError('Region is required')
    const active = form.get('active') === '1'
    const [row] = await insert('coverage', { region, mode: str(form, 'mode', 100), active, verified_at: active ? new Date() : null })
    await recordAudit(user.id, 'create', 'coverage', row.id as number)
    return { to: '/admin/coverage', notice: 'Coverage saved' }
  })
}

export async function toggleCoverageAction(form: FormData) {
  return adminRun(form, async ({ user }) => {
    const id = int(form, 'record')
    const row = await one('coverage', (f) => f.eq('id', id), 'id,active')
    if (!row) throw new ActionError('Not found', 404)
    await update('coverage', { active: !row.active, verified_at: row.active ? null : new Date() }, (f) => f.eq('id', id))
    await recordAudit(user.id, 'toggle', 'coverage', id)
    return { to: '/admin/coverage', notice: 'Coverage updated' }
  })
}

export async function addRedirectAction(form: FormData) {
  return adminRun(form, async ({ user }) => {
    const oldPath = cleanPath(str(form, 'old_path', 400))
    const newPath = cleanPath(str(form, 'new_path', 400))
    if (oldPath === newPath) throw new ActionError('Redirect loop')
    try {
      const [row] = await insert('seo_redirects', { old_path: oldPath, new_path: newPath, status: 301 })
      await recordAudit(user.id, 'create', 'redirect', row.id as number)
    } catch (e) {
      if ((e as { code?: string }).code === '23505') throw new ActionError('Redirect already defined', 409)
      throw e
    }
    return { to: '/admin/seo', notice: 'Redirect created' }
  })
}

export async function saveMailConfigAction(form: FormData) {
  return adminRun(form, async ({ user }) => {
    try {
      {
        await saveMailConfig({
          host: str(form, 'host'), port: str(form, 'port'), security: str(form, 'security'), username: str(form, 'username'), password: rawStr(form, 'password', 1000),
          fromEmail: str(form, 'from_email'), fromName: str(form, 'from_name'), replyTo: str(form, 'reply_to'), adminEmail: str(form, 'admin_email'), enabled: form.get('enabled') === '1',
        })
        await recordAudit(user.id, 'update', 'mail-config', 1, 'SMTP settings updated (password never logged)')
      }
    } catch (e) {
      if (e instanceof Error && !(e instanceof ActionError)) throw new ActionError(e.message)
      throw e
    }
    return { to: '/admin/mail', notice: 'SMTP configuration saved' }
  })
}

export async function setMailRuleAction(form: FormData) {
  return adminRun(form, async ({ user }) => {
    const key = str(form, 'key', 60)
    const enabled = form.get('enabled') === '1'
    const [row] = await update('email_rules', { enabled }, (f) => f.eq('key', key))
    if (!row) throw new ActionError('Not found', 404)
    await recordAudit(user.id, 'email-rule', 'mail', 0, `${key}: ${enabled}`)
    return { to: '/admin/mail', notice: 'Email rule saved' }
  })
}

export async function saveMailTemplateAction(form: FormData) {
  return adminRun(form, async ({ user }) => {
    const key = str(form, 'key', 60)
    const subject = str(form, 'subject', 250).replace(/[\r\n\x00-\x1f]+/g, ' ')
    const body = str(form, 'html', 20000)
    if (!subject || !body) throw new ActionError('Subject and body required')
    const [row] = await update('email_templates', { subject, html: cleanEmailHtml(body, true), updated_at: new Date() }, (f) => f.eq('key', key))
    if (!row) throw new ActionError('Not found', 404)
    await recordAudit(user.id, 'email-template', 'mail', 0, key)
    return { to: '/admin/mail', notice: 'Email template saved' }
  })
}

/** Sends the template as it is written in the form (not as it was last saved) to the administrator address, with sample values and a subject that says so. */
export async function testTemplateMailAction(form: FormData) {
  return adminRun(form, async ({ user }) => {
    const conf = await getMailConfig()
    if (!conf?.enabled || !conf.host) throw new ActionError('Save and enable the SMTP configuration first', 409)
    const subject = str(form, 'subject', 250).replace(/[\r\n\x00-\x1f]+/g, ' ')
    const body = str(form, 'html', 20000)
    if (!subject || !body) throw new ActionError('Subject and body required')
    const preview = previewTemplate(subject, body)
    try {
      await send(conf, conf.adminEmail ?? '', `[Contoh] ${preview.subject}`.slice(0, 250), preview.html)
      await recordAudit(user.id, 'smtp-test', 'mail-config', 1, 'template ' + str(form, 'key', 60))
      return { to: '/admin/mail', notice: `Contoh email dikirim ke ${conf.adminEmail}: diterima server SMTP. Isinya memakai data contoh.` }
    } catch (e) {
      const detail = `${e instanceof Error ? e.name : 'Error'}: ${e instanceof Error ? e.message : e}`.replace(/\s+/g, ' ').slice(0, 200)
      return { to: '/admin/mail', notice: 'Contoh email gagal dikirim - ' + detail }
    }
  })
}

export async function dispatchMailAction(form: FormData) {
  return adminRun(form, async () => {
    const r = await dispatch(publicBaseUrl(), 10)
    return { to: '/admin/mail', notice: `Mail: ${r.sent} sent, ${r.failed} failed; check outbox` }
  })
}

export async function retryMailJobAction(form: FormData) {
  return adminRun(form, async ({ user }) => {
    try { await retryJob(user.id, int(form, 'record')) } catch (e) {
      const status = (e as { status?: number }).status
      if (status) throw new ActionError((e as Error).message, status)
      throw e
    }
    const r = await dispatch(publicBaseUrl(), 10)
    return { to: '/admin/mail', notice: `Message re-queued: ${r.sent} sent, ${r.failed} failed` }
  })
}

export async function testMailAction(form: FormData) {
  return adminRun(form, async ({ user }) => {
    const conf = await getMailConfig()
    if (!conf?.enabled || !conf.host) throw new ActionError('Save and enable the SMTP configuration first', 409)
    try {
      await send(conf, conf.adminEmail ?? '', 'VORA SMTP test', `<p>This is a test message from the VORA admin portal (${new Date().toISOString().slice(0, 19)} UTC). If you can read it, outgoing email works.</p>`)
      await recordAudit(user.id, 'smtp-test', 'mail-config', 1, 'ok')
      return { to: '/admin/mail', notice: `Test email sent to ${conf.adminEmail}` }
    } catch (e) {
      const detail = `${e instanceof Error ? e.name : 'Error'}: ${e instanceof Error ? e.message : e}`.replace(/\s+/g, ' ').slice(0, 200)
      await recordAudit(user.id, 'smtp-test', 'mail-config', 1, 'failed: ' + detail)
      return { to: '/admin/mail', notice: 'SMTP test failed - ' + detail }
    }
  })
}

void afterResponse
