/**
 * Administer VORA admin accounts from a trusted machine. There is deliberately no web page or HTTP endpoint for this.
 *
 *   npm run users -- create EMAIL                 # new account; asks for the password twice (hidden)
 *   npm run users -- reset-password EMAIL         # ends that account's existing sessions at once
 *   npm run users -- deactivate EMAIL             # also ends its sessions; `activate` reverses it
 *   npm run users -- list
 *
 * The portal has ONE role, `admin`, with access to every menu, so there is no role option.
 * For automation add --password-stdin and pipe the password in:  printf '%s' "$PASSWORD" | npm run users -- create EMAIL --password-stdin
 * DATABASE_URL must point at the database (Supabase: the session pooler on port 5432, or the direct connection).
 */
import { createInterface } from 'node:readline'
import type { Sql } from 'postgres'
import { MIN_PASSWORD_LENGTH } from '../src/server/auth/password'
import { connectionUrl, openSql } from './lib/migrations'
import { UserCommandError, createAdmin, listUsers, resetPassword, setActive } from './lib/users'

export interface Io {
  /** Asks for a secret without echoing it. */
  readSecret(prompt: string): Promise<string>
  /** Reads the first line of standard input (for --password-stdin). */
  readLine(): Promise<string>
  out(line: string): void
  interactive: boolean
}

const USAGE = `Usage:
  users create EMAIL [--password-stdin]
  users reset-password EMAIL [--password-stdin]
  users deactivate EMAIL
  users activate EMAIL
  users list

There is one role, admin; it can open every menu. Passwords need at least ${MIN_PASSWORD_LENGTH} characters.`

async function password(args: string[], io: Io): Promise<string> {
  if (args.includes('--password-stdin')) return (await io.readLine()).replace(/\r?\n$/, '')
  if (!io.interactive) throw new UserCommandError('Not a terminal: pass --password-stdin and pipe the password in')
  const first = await io.readSecret(`New password (min ${MIN_PASSWORD_LENGTH} characters): `)
  if (first !== (await io.readSecret('Repeat password: '))) throw new UserCommandError('Passwords do not match')
  return first
}

/** Returns the process exit code. Never prints a password or a hash. */
export async function run(argv: string[], sql: Sql, io: Io): Promise<number> {
  const [command, ...rest] = argv
  const flags = rest.filter((a) => a.startsWith('--'))
  const positional = rest.filter((a) => !a.startsWith('--'))
  try {
    const unknown = flags.filter((f) => f !== '--password-stdin')
    if (unknown.length) throw new UserCommandError(`Unknown option ${unknown[0]}. The portal has one role (admin); there is no role option`)
    if (command === 'list') {
      for (const u of await listUsers(sql)) io.out(`${String(u.id).padStart(4)}  ${u.email.padEnd(40)} ${u.role.padEnd(8)} ${u.active ? 'active' : 'DISABLED'}`)
      return 0
    }
    if (!['create', 'reset-password', 'deactivate', 'activate'].includes(command ?? '')) throw new UserCommandError(USAGE)
    if (positional.length !== 1) throw new UserCommandError('Exactly one email address is required')
    const email = positional[0]
    if (command === 'create') {
      const u = await createAdmin(sql, email, await password(rest, io))
      io.out(`Admin account created for ${u.email}. No credentials are printed.`)
    } else if (command === 'reset-password') {
      await resetPassword(sql, email, await password(rest, io))
      io.out('Password reset. Every existing session of this account is now invalid.')
    } else {
      await setActive(sql, email, command === 'activate')
      io.out(command === 'activate' ? 'Account activated.' : 'Account deactivated. Its sessions are no longer valid.')
    }
    return 0
  } catch (e) {
    if (e instanceof UserCommandError) { io.out(e.message); return 2 }
    throw e
  }
}

function terminalIo(): Io {
  const stdinLines = () => new Promise<string>((resolve) => {
    const rl = createInterface({ input: process.stdin, terminal: false })
    rl.once('line', (l) => { rl.close(); resolve(l) })
    rl.once('close', () => resolve(''))
  })
  const readSecret = (prompt: string) => new Promise<string>((resolve, reject) => {
    const stdin = process.stdin
    process.stdout.write(prompt)
    let value = ''
    stdin.setRawMode(true); stdin.resume(); stdin.setEncoding('utf8')
    const onData = (ch: string) => {
      for (const c of ch) {
        if (c === '\u0003') { stdin.setRawMode(false); stdin.pause(); stdin.off('data', onData); return reject(new UserCommandError('Cancelled')) }
        if (c === '\r' || c === '\n') { stdin.setRawMode(false); stdin.pause(); stdin.off('data', onData); process.stdout.write('\n'); return resolve(value) }
        if (c === '\u007f' || c === '\b') value = value.slice(0, -1)
        else value += c
      }
    }
    stdin.on('data', onData)
  })
  return { readSecret, readLine: stdinLines, out: (l) => console.log(l), interactive: Boolean(process.stdin.isTTY) }
}

if (process.argv[1]?.endsWith('manage-users.ts')) {
  const sql = openSql(connectionUrl())
  run(process.argv.slice(2), sql, terminalIo())
    .then((code) => sql.end({ timeout: 5 }).then(() => process.exit(code)))
    .catch(async (e) => { console.error(e instanceof Error ? e.message : e); await sql.end({ timeout: 5 }); process.exit(1) })
}
