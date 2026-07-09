import { describe, it, expect } from 'vitest'
import { extractParagraphs, createFragmentApi } from './fragment.js'

describe('extractParagraphs', () => {
    it("découpe un HTML en paragraphes d'après les balises <p>", () => {
        expect(extractParagraphs('<p>Un</p><p>Deux</p>')).toEqual(['Un', 'Deux'])
    })

    it("renvoie le HTML entier comme unique paragraphe s'il n'y a pas de <p>", () => {
        expect(extractParagraphs('texte brut')).toEqual(['texte brut'])
    })
})

describe('createFragmentApi setFragment', () => {
    function makeFragment(blockId, ordinal, html) {
        return { fragId: `${blockId}::${ordinal}`, blockId, ordinal, html }
    }

    it('recolle sans séparateur les fragments issus de la pagination (même bloc, plusieurs pages)', () => {
        const blockId = 'art__texte__0'
        const frag0 = makeFragment(blockId, 0, '<p>Début du paragra</p>')
        const frag1 = makeFragment(blockId, 1, '<p>phe, suite après saut de page.</p>')

        const fragmentMap = new Map([
            [frag0.fragId, frag0],
            [frag1.fragId, frag1],
        ])
        const blockFragments = new Map([[blockId, [frag0.fragId, frag1.fragId]]])

        let savedHtml = null
        const blockRegistry = new Map([[blockId, { setHtml: (html) => { savedHtml = html } }]])

        const api = createFragmentApi(blockRegistry, fragmentMap, blockFragments)

        // On édite le second fragment (celui qui vit après le saut de page).
        api.setFragment(frag1.fragId, '<p>phe, suite après saut de page, modifiée.</p>')

        expect(savedHtml).toBe(
            '<p>Début du paragraphe, suite après saut de page, modifiée.</p>'
        )
    })

    it("crée un nouveau paragraphe quand l'édition introduit plusieurs <p> (cas Entrée)", () => {
        const blockId = 'art__texte__0'
        const frag0 = makeFragment(blockId, 0, '<p>Bonjour le monde.</p>')

        const fragmentMap = new Map([[frag0.fragId, frag0]])
        const blockFragments = new Map([[blockId, [frag0.fragId]]])

        let savedHtml = null
        const blockRegistry = new Map([[blockId, { setHtml: (html) => { savedHtml = html } }]])

        const api = createFragmentApi(blockRegistry, fragmentMap, blockFragments)

        api.setFragment(frag0.fragId, '<p>Bonjour</p><p> le monde.</p>')

        expect(savedHtml).toBe('<p>Bonjour</p><p> le monde.</p>')
    })

    it('getBlockId retrouve le bloc propriétaire à partir d\'un fragId', () => {
        const blockId = 'art__texte__0'
        const frag0 = makeFragment(blockId, 0, '<p>Contenu</p>')
        const fragmentMap = new Map([[frag0.fragId, frag0]])
        const blockFragments = new Map([[blockId, [frag0.fragId]]])

        const api = createFragmentApi(new Map(), fragmentMap, blockFragments)

        expect(api.getBlockId(frag0.fragId)).toBe(blockId)
        expect(api.getBlockId('inconnu::0')).toBeNull()
    })
})

describe('createFragmentApi locateIndex', () => {
    function makeFragment(blockId, ordinal, html) {
        return { fragId: `${blockId}::${ordinal}`, blockId, ordinal, html }
    }

    // Régression : rouvrir l'éditeur après un split/merge ne doit pas
    // toujours retomber sur le premier fragment de pagination (::0) quand le
    // paragraphe est réparti sur plusieurs pages, sous peine d'activer la
    // mauvaise page (cf. bug signalé après le refactor en composables).
    it('résout le fragment de pagination qui contient réellement un index donné', () => {
        const blockId = 'art__texte__0'
        // "Début du paragra" (17 caractères) + "phe, suite après saut de page." (31 caractères)
        const frag0 = makeFragment(blockId, 0, '<p>Début du paragra</p>')
        const frag1 = makeFragment(blockId, 1, '<p>phe, suite après saut de page.</p>')

        const fragmentMap = new Map([
            [frag0.fragId, frag0],
            [frag1.fragId, frag1],
        ])
        const blockFragments = new Map([[blockId, [frag0.fragId, frag1.fragId]]])

        const api = createFragmentApi(new Map(), fragmentMap, blockFragments)

        // Index tombant dans le premier fragment.
        expect(api.locateIndex(blockId, 5)).toEqual({ fragId: frag0.fragId, index: 5 })

        // Index tombant après la coupure de page : doit résoudre le SECOND
        // fragment avec un index relatif à ce fragment, pas au paragraphe entier.
        const globalIndex = 'Début du paragra'.length + 10
        expect(api.locateIndex(blockId, globalIndex)).toEqual({ fragId: frag1.fragId, index: 10 })

        // Index au-delà de la fin : reste sur le dernier fragment (clamp).
        expect(api.locateIndex(blockId, 9999)).toEqual({
            fragId: frag1.fragId,
            index: 9999 - 'Début du paragra'.length,
        })
    })

    it("retombe sur le fragment unique quand le paragraphe ne franchit pas de saut de page", () => {
        const blockId = 'art__texte__0'
        const frag0 = makeFragment(blockId, 0, '<p>Court paragraphe.</p>')
        const fragmentMap = new Map([[frag0.fragId, frag0]])
        const blockFragments = new Map([[blockId, [frag0.fragId]]])

        const api = createFragmentApi(new Map(), fragmentMap, blockFragments)

        expect(api.locateIndex(blockId, 0)).toEqual({ fragId: frag0.fragId, index: 0 })
        expect(api.locateIndex(blockId, 6)).toEqual({ fragId: frag0.fragId, index: 6 })
    })
})

describe('createFragmentApi globalIndex', () => {
    function makeFragment(blockId, ordinal, html) {
        return { fragId: `${blockId}::${ordinal}`, blockId, ordinal, html }
    }

    // Inverse de locateIndex : nécessaire pour résoudre une sélection dont un
    // bord tombe dans un fragment de pagination qui n'est pas le premier du bloc.
    it("convertit un index local du second fragment en index global du paragraphe", () => {
        const blockId = 'art__texte__0'
        const frag0 = makeFragment(blockId, 0, '<p>Début du paragra</p>')
        const frag1 = makeFragment(blockId, 1, '<p>phe, suite après saut de page.</p>')

        const fragmentMap = new Map([
            [frag0.fragId, frag0],
            [frag1.fragId, frag1],
        ])
        const blockFragments = new Map([[blockId, [frag0.fragId, frag1.fragId]]])

        const api = createFragmentApi(new Map(), fragmentMap, blockFragments)

        expect(api.globalIndex(frag0.fragId, 5)).toEqual({ blockId, index: 5 })
        expect(api.globalIndex(frag1.fragId, 10)).toEqual({
            blockId,
            index: 'Début du paragra'.length + 10,
        })
    })

    it('renvoie null pour un fragId inconnu', () => {
        const api = createFragmentApi(new Map(), new Map(), new Map())
        expect(api.globalIndex('inconnu::0', 0)).toBeNull()
    })
})

describe('createFragmentApi getFragmentPosition', () => {
    function makeFragment(blockId, ordinal, html) {
        return { fragId: `${blockId}::${ordinal}`, blockId, ordinal, html }
    }

    // Régression : atteindre la fin du PREMIER fragment d'un paragraphe étalé
    // sur 2 pages n'est qu'une coupure de page interne, pas la vraie fin du
    // paragraphe. Fusionner à cet endroit-là fusionnait à tort avec le
    // paragraphe suivant et le faisait disparaître ("perte du fragment
    // suivant"). getFragmentPosition() permet de distinguer les deux cas.
    it("identifie le premier et le dernier fragment d'un bloc étalé sur plusieurs pages", () => {
        const blockId = 'art__texte__0'
        const frag0 = makeFragment(blockId, 0, '<p>Début</p>')
        const frag1 = makeFragment(blockId, 1, '<p> suite</p>')
        const frag2 = makeFragment(blockId, 2, '<p> fin.</p>')

        const fragmentMap = new Map([
            [frag0.fragId, frag0],
            [frag1.fragId, frag1],
            [frag2.fragId, frag2],
        ])
        const blockFragments = new Map([[blockId, [frag0.fragId, frag1.fragId, frag2.fragId]]])

        const api = createFragmentApi(new Map(), fragmentMap, blockFragments)

        expect(api.getFragmentPosition(frag0.fragId)).toEqual({ ordinal: 0, total: 3 })
        expect(api.getFragmentPosition(frag1.fragId)).toEqual({ ordinal: 1, total: 3 })
        expect(api.getFragmentPosition(frag2.fragId)).toEqual({ ordinal: 2, total: 3 })
    })

    it("ordinal 0 et total 1 pour un paragraphe tenant dans un seul fragment", () => {
        const blockId = 'art__texte__0'
        const frag0 = makeFragment(blockId, 0, '<p>Court paragraphe.</p>')
        const fragmentMap = new Map([[frag0.fragId, frag0]])
        const blockFragments = new Map([[blockId, [frag0.fragId]]])

        const api = createFragmentApi(new Map(), fragmentMap, blockFragments)

        expect(api.getFragmentPosition(frag0.fragId)).toEqual({ ordinal: 0, total: 1 })
    })

    it('renvoie null pour un fragId inconnu', () => {
        const api = createFragmentApi(new Map(), new Map(), new Map())
        expect(api.getFragmentPosition('inconnu::0')).toBeNull()
    })
})
