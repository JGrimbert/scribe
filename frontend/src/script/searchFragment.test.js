import { describe, it, expect } from 'vitest'
import { fragmentHtml, tornPolygon, fragmentEntries, fragmentSpread } from './searchFragment'

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

  it('décale les graines pour que la seconde page ne répète pas la première', () => {
    const [a] = fragmentEntries([frag], '', 0)
    const [b] = fragmentEntries([frag], '', 5)
    expect(a.style).not.toBe(b.style)
  })
})

describe('fragmentSpread', () => {
  const frags = (n) => Array.from({ length: n }, (_, i) => ({ phrase: `Passage ${i}.`, titre: `T${i}`, path: '' }))

  it('coule les lambeaux en deux pages, le surplus impair à gauche', () => {
    const [gauche, droite] = fragmentSpread(frags(3), '')
    expect(gauche.entries).toHaveLength(4) // 2 lambeaux × (passage + source)
    expect(droite.entries).toHaveLength(2)
  })

  it('rend toujours deux pages, même sans résultat', () => {
    const spread = fragmentSpread([], '')
    expect(spread).toHaveLength(2)
    expect(spread.every((p) => p.entries.length === 0)).toBe(true)
  })
})
