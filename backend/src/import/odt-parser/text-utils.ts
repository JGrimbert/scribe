import { Stats } from './types'

const DIACRITICS_RE = new RegExp('[\\u0300-\\u036f]', 'g')

export function slugify(str: string): string {
  return str
    .normalize('NFD')
    .replace(DIACRITICS_RE, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

export function makeUniqueSlug(text: string, usedSlugs: Set<string>, fallbackPrefix: string): string {
  const base = slugify(text) || fallbackPrefix
  let slug = base
  let i = 2
  while (usedSlugs.has(slug)) {
    slug = `${base}-${i}`
    i++
  }
  usedSlugs.add(slug)
  return slug
}

export function extractRomain(titre: string): string | null {
  const match = titre.match(/\b(M{0,4}(?:CM|CD|D?C{0,3})(?:XC|XL|L?X{0,3})(?:IX|IV|V?I{0,3}))\b/i)
  return match ? match[1].toUpperCase() : null
}

export function computeStats(text: string): Stats {
  const mots = text.trim().split(/\s+/).filter(Boolean).length
  const caracteres = text.replace(/\s/g, '').length
  const paragraphes = text.split(/\n\n+/).filter((p) => p.trim()).length
  const status: Stats['status'] = mots === 0 ? 'vide' : mots < 50 ? 'ébauche' : mots < 200 ? 'partiel' : 'rédigé'
  return { mots, caracteres, paragraphes, status }
}
