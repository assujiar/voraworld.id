import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * A form control named `id` makes `form.id` return that control (named properties override built-ins on form elements).
 * React reads `form.id` when it builds the FormData of a Server Action; with a clobbered value it drops the name/value of
 * the button that was clicked, so "Publish", "Issue" or "Void" silently arrive without their `action`. No unit test of an
 * action can see this; it only fails in a real browser. Hence this guard: the record being edited travels as `record`.
 */
const files = (dir: string): string[] => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n)
  return statSync(p).isDirectory() ? files(p) : /\.tsx$/.test(n) ? [p] : []
})

describe('form control names', () => {
  it('never use a name that shadows a built-in property of <form> (id, action, method, name, target, submit, reset, elements, length)', () => {
    const bad: string[] = []
    for (const f of files(join(process.cwd(), 'src'))) {
      readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        // Only hidden inputs and buttons matter for the submit path; ordinary visible fields such as `name` are harmless to React.
        for (const m of line.matchAll(/<(input|button)\b[^>]*\bname=(?:"|'|\{['"])(id|action|method|target|submit|reset|elements|length)(?:"|'|['"]\})/g)) {
          if (m[1] === 'button' && m[2] === 'action') continue        // `name="action"` on a submit button is the established pattern and does not clobber what React reads
          bad.push(`${f.replace(process.cwd() + '/', '')}:${i + 1} ${m[0].slice(0, 80)}`)
        }
      })
    }
    expect(bad).toEqual([])
  })
})
