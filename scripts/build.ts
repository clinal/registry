import { readFile, readdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { parse } from 'yaml'

type Artifact = { platform: string; architecture: string; url: string; hash: string }
type Version = { version: string; artifacts: Artifact[] }
type Bundle = { name: string; description: string; versions: Version[] }

const bundlesDir = resolve('bundles')
const outputPath = resolve('registry.json')
const hashPattern = /^sha256:[a-f0-9]{64}$/

function assertString(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} must be a non-empty string`)
}

function validate(input: unknown, file: string): Bundle {
  if (!input || typeof input !== 'object') throw new Error(`${file} must contain an object`)
  const bundle = input as Record<string, unknown>
  assertString(bundle.name, `${file}: name`)
  assertString(bundle.description, `${file}: description`)
  if (!Array.isArray(bundle.versions) || bundle.versions.length === 0) {
    throw new Error(`${file}: versions must be a non-empty array`)
  }

  const seen = new Set<string>()
  const versions = bundle.versions.map((input, index): Version => {
    if (!input || typeof input !== 'object') throw new Error(`${file}: versions[${index}] must be an object`)
    const version = input as Record<string, unknown>
    assertString(version.version, `${file}: versions[${index}].version`)
    if (seen.has(version.version)) throw new Error(`${file}: duplicate version ${version.version}`)
    seen.add(version.version)
    if (!Array.isArray(version.artifacts) || version.artifacts.length === 0) {
      throw new Error(`${file}: versions[${index}].artifacts must be a non-empty array`)
    }
    const targets = new Set<string>()
    const artifacts = version.artifacts.map((input, artifactIndex): Artifact => {
      if (!input || typeof input !== 'object') {
        throw new Error(`${file}: versions[${index}].artifacts[${artifactIndex}] must be an object`)
      }
      const artifact = input as Record<string, unknown>
      const prefix = `${file}: versions[${index}].artifacts[${artifactIndex}]`
      assertString(artifact.platform, `${prefix}.platform`)
      assertString(artifact.architecture, `${prefix}.architecture`)
      assertString(artifact.url, `${prefix}.url`)
      assertString(artifact.hash, `${prefix}.hash`)
      const target = `${artifact.platform}/${artifact.architecture}`
      if (targets.has(target)) throw new Error(`${file}: duplicate target ${target} for version ${version.version}`)
      targets.add(target)
      if (!URL.canParse(artifact.url) || new URL(artifact.url).protocol !== 'https:') {
        throw new Error(`${prefix}.url must be an HTTPS URL`)
      }
      if (!hashPattern.test(artifact.hash)) {
        throw new Error(`${prefix}.hash must be sha256:<64 lowercase hex characters>`)
      }
      return {
        platform: artifact.platform,
        architecture: artifact.architecture,
        url: artifact.url,
        hash: artifact.hash,
      }
    })
    return { version: version.version, artifacts }
  })

  return { name: bundle.name, description: bundle.description, versions }
}

const files = (await readdir(bundlesDir)).filter((file) => /\.ya?ml$/.test(file)).sort()
if (files.length === 0) throw new Error('bundles must contain at least one YAML file')

const bundles = await Promise.all(files.map(async (file) => validate(parse(await readFile(resolve(bundlesDir, file), 'utf8')), file)))
const names = new Set<string>()
for (const bundle of bundles) {
  if (names.has(bundle.name)) throw new Error(`duplicate bundle name: ${bundle.name}`)
  names.add(bundle.name)
}

const registry = `${JSON.stringify({ schemaVersion: 1, bundles }, null, 2)}\n`
if (process.argv.includes('--check')) {
  const current = await readFile(outputPath, 'utf8').catch(() => '')
  if (current !== registry) throw new Error('registry.json is not up to date; run npm run build')
} else {
  await writeFile(outputPath, registry)
}
