import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { sql } from './helpers/db'
import { documentsBucketRules } from './helpers/bucket-rules'

const migration = readFileSync(join(process.cwd(), 'migrations', '0027_documents_bucket_evidence_types.sql'), 'utf8')
const bucket = async () => (await sql`select id, public, file_size_limit, allowed_mime_types from storage.buckets where id = 'vora-documents'`)[0]

describe('migration 0027: the private documents bucket accepts proof-of-delivery evidence', () => {
  it('does nothing, and does not fail, on a database without the Supabase storage schema', async () => {
    await expect(sql.unsafe(migration)).resolves.toBeDefined()
  })

  it('adds PNG and JPEG to a bucket that only allowed PDF, keeps it private and keeps its size limit, and can be run again', async () => {
    await sql.unsafe(`create schema if not exists storage;
      create table storage.buckets (id text primary key, name text not null, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
      insert into storage.buckets values ('vora-documents', 'vora-documents', false, 10485760, ARRAY['application/pdf']), ('vora-media', 'vora-media', true, 7000000, ARRAY['image/png'])`)
    await sql.unsafe(migration)
    expect(await bucket()).toMatchObject({ public: false, fileSizeLimit: 10485760, allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png'] })
    await sql.unsafe(migration)
    expect((await bucket()).allowedMimeTypes).toEqual(['application/pdf', 'image/jpeg', 'image/png'])
    expect((await sql`select public, allowed_mime_types from storage.buckets where id = 'vora-media'`)[0]).toMatchObject({ public: true, allowedMimeTypes: ['image/png'] })   // the other bucket is untouched
  })

  it('keeps types somebody added, makes a public documents bucket private, and leaves an unrestricted bucket unrestricted', async () => {
    await sql`update storage.buckets set public = true, allowed_mime_types = ARRAY['application/pdf', 'text/plain'] where id = 'vora-documents'`
    await sql.unsafe(migration)
    expect(await bucket()).toMatchObject({ public: false, allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png', 'text/plain'] })
    await sql`update storage.buckets set public = true, allowed_mime_types = NULL where id = 'vora-documents'`
    await sql.unsafe(migration)
    expect(await bucket()).toMatchObject({ public: false, allowedMimeTypes: null })
  })

  it('creates the bucket, private, when it is missing', async () => {
    await sql`delete from storage.buckets where id = 'vora-documents'`
    await sql.unsafe(migration)
    expect(await bucket()).toMatchObject({ public: false, allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png'] })
  })

  it('is what the application relies on: the rules the tests read from the migrations allow every type it uploads', () => {
    const rules = documentsBucketRules()
    expect(rules.isPublic).toBe(false)
    for (const type of ['application/pdf', 'image/png', 'image/jpeg']) expect(rules.allowed).toContain(type)
    expect(rules.allowed).not.toContain('image/gif')
  })
})
