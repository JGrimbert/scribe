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

  it('porte le fond et la découpe sur la feuille interne (la page reste nue)', () => {
    const [passage] = fragmentEntries([frag], '')
    expect(passage.text).toContain('class="frag-sheet"')
    expect(passage.text).toContain('background:#fff')
    expect(passage.text).toContain('clip-path:polygon(')
  })

  it('laisse l’ombre au BLOC : le clip-path de la feuille la taillerait avec le papier', () => {
    const [passage, source] = fragmentEntries([frag], '')
    expect(passage.style).toContain('drop-shadow')
    expect(passage.style).not.toContain('clip-path')
    expect(source.style).toContain('drop-shadow')
  })

  it('porte la variante haut-plat en data.toppath', () => {
    const [passage] = fragmentEntries([frag], '')
    expect(passage.data.toppath.startsWith('polygon(0.00% 0px')).toBe(true)
  })

  it('décale les graines pour que la seconde page ne répète pas la première', () => {
    const [a] = fragmentEntries([frag], '', 0)
    const [b] = fragmentEntries([frag], '', 5)
    expect(a.text).not.toBe(b.text)
  })
})

describe('fragmentPages', () => {
  const frags = (n) => Array.from({ length: n }, (_, i) => ({ phrase: `Passage ${i}.`, titre: `T${i}`, path: '' }))

  it('rend UNE page de folio par lambeau, statut en tête de la première', () => {
    const pages = fragmentPages(frags(3), '', { status: '3 résultats' })
    expect(pages).toHaveLength(3)
    expect(pages.every((p) => p.kind === 'content')).toBe(true)
    // Page 1 : statut + (passage + source) ; pages suivantes : (passage + source) seuls.
    expect(pages[0].entries[0].styleName).toBe('frag-status')
    expect(pages[0].entries[0].text).toContain('>3 résultats<')
    expect(pages[0].entries).toHaveLength(1 + 2)
    expect(pages[1].entries).toHaveLength(2)
    expect(pages[2].entries).toHaveLength(2)
  })

  it('rend le statut sur une page à lui seul sans résultat', () => {
    const pages = fragmentPages([], '', { status: 'Aucun résultat' })
    expect(pages).toHaveLength(1)
    expect(pages[0].entries).toHaveLength(1)
    expect(pages[0].entries[0].text).toContain('>Aucun résultat<')
  })

  it('porte les chiffres du document en rangée de tête du lambeau de statut', () => {
    const stats = [{ label: 'mots', value: '1 234' }, { label: 'phrases', value: null, empty: true }]
    const [page] = fragmentPages([], '', { status: 'Résultats : 0', stats })
    const { text } = page.entries[0]
    expect(text).toContain('1 234')
    expect(text).toContain('mots')
    // Chiffre manquant (analyse lexicale pas encore chargée) : cadratin, pas de vide.
    expect(text).toContain('—')
    // Le compte reste la DERNIÈRE rangée.
    expect(text.indexOf('mots')).toBeLessThan(text.indexOf('Résultats : 0'))
  })

  it('sans statut, ne coule que les lambeaux', () => {
    const [page] = fragmentPages(frags(1), '')
    expect(page.entries).toHaveLength(2)
  })

  it('ne coule QUE la tranche reçue : la pagination est faite en amont', () => {
    const pages = fragmentPages(frags(50).slice(6, 12), '', { status: 'Résultats : 50' })
    // Une page par passage de la tranche (6), pas les 50.
    expect(pages).toHaveLength(6)
    // Le compte annoncé reste le total, pas celui de la tranche.
    expect(pages[0].entries[0].text).toContain('>Résultats : 50<')
  })

  it('décale les déchirures de la tranche par son offset', () => {
    const [p0] = fragmentPages(frags(12).slice(0, 6), '')
    const [p1] = fragmentPages(frags(12).slice(6, 12), '', { offset: 6 })
    expect(p1.entries[0].text).not.toBe(p0.entries[0].text)
  })
})
