import { describe, it, expect } from 'vitest'
import { fragmentHtml, tornPolygon, fragmentEntries, fragmentPages } from './searchFragment'

describe('fragmentHtml', () => {
  it('borne le passage de […] et appuie la saisie', () => {
    const html = fragmentHtml('Une phrase avec lumière dedans.', 'lumière')
    expect(html).toBe(
      '<span class="frag-ell">[…]</span>Une phrase avec <strong>lumière</strong> dedans.<span class="frag-ell">[…]</span>',
    )
  })

  it('trouve le mot sans égard aux accents ni à la casse, et rend le texte D’ORIGINE', () => {
    const html = fragmentHtml('La LUMIÈRE diurne.', 'lumiere')
    expect(html).toContain('<strong>LUMIÈRE</strong>')
  })

  it('marque toutes les occurrences', () => {
    const html = fragmentHtml('nuit et nuit encore', 'nuit')
    expect(html.match(/<strong>/g)).toHaveLength(2)
  })

  it('échappe le texte : un chevron du corpus ne doit pas devenir une balise', () => {
    expect(fragmentHtml('a < b & c', '')).toContain('a &lt; b &amp; c')
  })

  it('sans saisie, rend la phrase entière sans emphase', () => {
    const html = fragmentHtml('Rien à marquer.', '')
    expect(html).not.toContain('<strong>')
    expect(html).toContain('Rien à marquer.')
  })
})

describe('tornPolygon', () => {
  it('est déterministe : une même graine redonne la même déchirure', () => {
    expect(tornPolygon(3)).toBe(tornPolygon(3))
  })

  it('donne des découpes différentes à deux lambeaux voisins', () => {
    expect(tornPolygon(0)).not.toBe(tornPolygon(1))
  })

  it('mêle les unités : X en %, Y en px (dent de hauteur constante)', () => {
    const p = tornPolygon(0)
    expect(p.startsWith('polygon(')).toBe(true)
    expect(p).toMatch(/0\.00% [\d.]+px/)
    expect(p).toContain('calc(100% - ')
  })

  it('flatTop aplatit le haut mais garde le MÊME bas seedé', () => {
    const flat = tornPolygon(4, { flatTop: true })
    expect(flat.startsWith('polygon(0.00% 0px')).toBe(true)
    // Le bas (points en calc(100% - …)) est identique à la version déchirée : la
    // graine consomme les mêmes tirages, seul le haut change.
    const bottom = (p) => p.slice(p.indexOf('calc(100% -'))
    expect(bottom(flat)).toBe(bottom(tornPolygon(4)))
  })
})

describe('fragmentEntries', () => {
  const frag = { phrase: 'Un passage.', titre: 'Le Blaireau', path: 'La Lisière' }

  it('rend deux entrées par lambeau : le passage puis sa source', () => {
    const entries = fragmentEntries([frag], 'passage')
    expect(entries).toHaveLength(2)
    expect(entries[1].text).toBe('La Lisière › Le Blaireau')
  })

  it('porte le fond et la découpe en style inline (la page reste nue)', () => {
    const [passage] = fragmentEntries([frag], '')
    expect(passage.style).toContain('background:#fff')
    expect(passage.style).toContain('clip-path:polygon(')
  })

  it('porte la variante haut-plat en data.toppath', () => {
    const [passage] = fragmentEntries([frag], '')
    expect(passage.data.toppath.startsWith('polygon(0.00% 0px')).toBe(true)
  })

  it('décale les graines pour que la seconde page ne répète pas la première', () => {
    const [a] = fragmentEntries([frag], '', 0)
    const [b] = fragmentEntries([frag], '', 5)
    expect(a.style).not.toBe(b.style)
  })
})

describe('fragmentPages', () => {
  const frags = (n) => Array.from({ length: n }, (_, i) => ({ phrase: `Passage ${i}.`, titre: `T${i}`, path: '' }))

  it('coule tout en UNE page de contenu, statut en tête', () => {
    const [page] = fragmentPages(frags(3), '', { status: '3 résultats' })
    expect(page.kind).toBe('content')
    expect(page.entries[0].styleName).toBe('frag-status')
    expect(page.entries[0].text).toBe('3 résultats')
    // 1 statut + 3 lambeaux × (passage + source)
    expect(page.entries).toHaveLength(1 + 3 * 2)
  })

  it('rend le statut même sans résultat', () => {
    const [page] = fragmentPages([], '', { status: 'Aucun résultat' })
    expect(page.entries).toHaveLength(1)
    expect(page.entries[0].text).toBe('Aucun résultat')
  })

  it('sans statut, ne coule que les lambeaux', () => {
    const [page] = fragmentPages(frags(1), '')
    expect(page.entries).toHaveLength(2)
  })
})
