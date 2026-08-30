export interface TagInfo {
  tag: string
  slug: string
  count: number
}

export function normalizeTagName(tag: string): string {
  const normalized = tag.trim().replace(/\s+/g, ' ')

  if (!normalized) {
    throw new Error('Tag must not be empty')
  }

  return normalized
}

export function normalizeTags(tags: string[]): string[] {
  const output: string[] = []
  const seen = new Set<string>()

  for (const tag of tags) {
    const normalized = normalizeTagName(tag)

    if (seen.has(normalized))
      continue

    seen.add(normalized)
    output.push(normalized)
  }

  return output
}

export function getTagSlug(tag: string): string {
  const normalized = normalizeTagName(tag)
  const slug = normalized
    .normalize('NFKD')
    .replace(/\p{Mark}+/gu, '')
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '')

  if (!slug) {
    throw new Error(`Cannot generate a slug for tag "${tag}"`)
  }

  return slug
}

export function getPostsByTag<T extends { data: { tags: string[] } }>(data: T[], tag: string) {
  const normalizedTag = normalizeTagName(tag)

  return data.filter(post => post.data.tags?.some(postTag => normalizeTagName(postTag) === normalizedTag))
}

export function getTags<T extends { id: string, data: { tags: string[] } }>(data: T[]): TagInfo[] {
  const output = new Map<string, TagInfo>()
  const sourceBySlug = new Map<string, string>()

  for (const post of data) {
    for (const rawTag of post.data.tags ?? []) {
      const tag = normalizeTagName(rawTag)
      const slug = getTagSlug(tag)
      const existingTag = output.get(slug)

      if (existingTag) {
        if (existingTag.tag !== tag) {
          const firstSource = sourceBySlug.get(slug)

          throw new Error(
            `Tag slug conflict: "${existingTag.tag}" and "${tag}" both resolve to "${slug}". First seen in "${firstSource}", again in "${post.id}".`,
          )
        }

        existingTag.count++
        continue
      }

      output.set(slug, {
        tag,
        slug,
        count: 1,
      })
      sourceBySlug.set(slug, post.id)
    }
  }

  return Array.from(output.values()).sort((a, b) => a.tag.localeCompare(b.tag))
}
