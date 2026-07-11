import { describe, it, expect } from 'vitest'
import { createRegistry } from './registry.js'
import { renderTexteEntry } from './fragment.js'

function paragraph(text) {
    return { type: 'paragraph', text }
}

function list(ordered, texts) {
    return { type: 'list', ordered, items: texts.map((text) => ({ text, depth: 0 })) }
}

function makeArticle(entries) {
    return { texte: [...entries] }
}

// Reproduit la forme des blocs telle que construite par buildBlocks() dans
// paginate.js, sans dépendre de Paged.js.
function makeBlocks(article) {
    return article.texte.map((entry, index) => ({
        id: `art__texte__${index}`,
        type: entry.type === 'list' ? 'list' : 'paragraph',
        path: { kind: 'texte', index },
        ownerId: 'art',
        html: renderTexteEntry(entry),
    }))
}

function makeTitreBlock() {
    return { id: 'art__titre', type: 'title', path: { kind: 'titre' }, ownerId: 'art', html: '<h3>Titre</h3>' }
}

function registryFor(article, blocks) {
    return createRegistry(new Map([['art', article]]), blocks, null)
}

describe('registry mergeNext / mergePrev', () => {
    it('fusionne le paragraphe courant avec le suivant et renvoie la position du curseur', () => {
        const article = makeArticle([paragraph('Premier paragraphe.'), paragraph('Deuxième paragraphe.'), paragraph('Troisième paragraphe.')])
        const blocks = makeBlocks(article)
        const registry = registryFor(article, blocks)

        const result = registry.get('art__texte__0').mergeNext()

        expect(article.texte).toEqual([
            paragraph('Premier paragraphe. Deuxième paragraphe.'),
            paragraph('Troisième paragraphe.'),
        ])
        expect(result).toEqual({ index: 0, cursor: 'Premier paragraphe.'.length })
    })

    it('fusionne le paragraphe courant avec le précédent et renvoie la position du curseur', () => {
        const article = makeArticle([paragraph('Premier paragraphe.'), paragraph('Deuxième paragraphe.'), paragraph('Troisième paragraphe.')])
        const blocks = makeBlocks(article)
        const registry = registryFor(article, blocks)

        const result = registry.get('art__texte__2').mergePrev()

        expect(article.texte).toEqual([
            paragraph('Premier paragraphe.'),
            paragraph('Deuxième paragraphe. Troisième paragraphe.'),
        ])
        expect(result).toEqual({ index: 1, cursor: 'Deuxième paragraphe.'.length })
    })

    it('ne fait rien quand on merge-next depuis le dernier paragraphe', () => {
        const article = makeArticle([paragraph('Seul paragraphe.')])
        const blocks = makeBlocks(article)
        const registry = registryFor(article, blocks)

        const result = registry.get('art__texte__0').mergeNext()

        expect(result).toBeFalsy()
        expect(article.texte).toEqual([paragraph('Seul paragraphe.')])
    })

    it('ne fait rien quand on merge-prev depuis le premier paragraphe', () => {
        const article = makeArticle([paragraph('Seul paragraphe.')])
        const blocks = makeBlocks(article)
        const registry = registryFor(article, blocks)

        const result = registry.get('art__texte__0').mergePrev()

        expect(result).toBeFalsy()
        expect(article.texte).toEqual([paragraph('Seul paragraphe.')])
    })

    it('ignore les blocs qui ne sont pas de type texte (ex: titre)', () => {
        const article = { texte: [paragraph('Un paragraphe.')], titre: 'Titre' }
        const blocks = [makeTitreBlock(), ...makeBlocks(article)]
        const registry = registryFor(article, blocks)

        expect(registry.get('art__titre').mergeNext()).toBeFalsy()
        expect(registry.get('art__titre').mergePrev()).toBeFalsy()
        expect(article.texte).toEqual([paragraph('Un paragraphe.')])
    })

    it('nettoie les espaces superflus à la jonction', () => {
        const article = makeArticle([paragraph('Premier.   '), paragraph('   Deuxième.')])
        const blocks = makeBlocks(article)
        const registry = registryFor(article, blocks)

        registry.get('art__texte__0').mergeNext()

        expect(article.texte).toEqual([paragraph('Premier. Deuxième.')])
    })

    it('fusionne deux listes adjacentes de même type (items concaténés, pas de perte de <li>)', () => {
        const article = makeArticle([list(false, ['Un']), list(false, ['Deux', 'Trois'])])
        const blocks = makeBlocks(article)
        const registry = registryFor(article, blocks)

        const result = registry.get('art__texte__0').mergeNext()

        expect(article.texte).toEqual([list(false, ['Un', 'Deux', 'Trois'])])
        expect(result).toEqual({ index: 0, cursor: 'Un'.length })
    })

    it('ne fusionne pas une liste numérotée avec une liste à puces (ordered différent)', () => {
        const article = makeArticle([list(true, ['Un']), list(false, ['Deux'])])
        const blocks = makeBlocks(article)
        const registry = registryFor(article, blocks)

        const result = registry.get('art__texte__0').mergeNext()

        expect(result).toBeFalsy()
        expect(article.texte).toEqual([list(true, ['Un']), list(false, ['Deux'])])
    })

    it('ne fusionne pas un paragraphe avec une liste adjacente (no-op sûr, types incompatibles)', () => {
        const article = makeArticle([paragraph('Un paragraphe.'), list(false, ['Un item'])])
        const blocks = makeBlocks(article)
        const registry = registryFor(article, blocks)

        expect(registry.get('art__texte__0').mergeNext()).toBeFalsy()
        expect(registry.get('art__texte__1').mergePrev()).toBeFalsy()
        expect(article.texte).toEqual([paragraph('Un paragraphe.'), list(false, ['Un item'])])
    })
})

describe('registry setHtml (kind texte)', () => {
    it('fractionne un paragraphe en plusieurs entrées quand le HTML contient plusieurs <p>', () => {
        const article = makeArticle([paragraph('Bonjour le monde.')])
        const blocks = makeBlocks(article)
        const registry = registryFor(article, blocks)

        registry.get('art__texte__0').setHtml('<p>Bonjour</p><p> le monde.</p>')

        expect(article.texte).toEqual([paragraph('Bonjour'), paragraph(' le monde.')])
    })

    it('reconnaît une liste éditée dans Quill (<ul>) et la stocke comme une seule entrée liste', () => {
        const article = makeArticle([paragraph('Un paragraphe.')])
        const blocks = makeBlocks(article)
        const registry = registryFor(article, blocks)

        registry.get('art__texte__0').setHtml('<ul><li>Un</li><li>Deux</li></ul>')

        expect(article.texte).toEqual([{ type: 'list', ordered: false, items: [{ text: 'Un', depth: 0 }, { text: 'Deux', depth: 0 }] }])
    })
})

describe('registry deleteRange', () => {
    it('supprime une sélection à l\'intérieur d\'un seul paragraphe', () => {
        const article = makeArticle([paragraph('Bonjour le monde.')])
        const blocks = makeBlocks(article)
        const registry = registryFor(article, blocks)

        // "Bonjour [le monde]." -> sélection = "le monde"
        const result = registry.get('art__texte__0').deleteRange(8, 0, 16)

        expect(article.texte).toEqual([paragraph('Bonjour .')])
        expect(result).toEqual({ index: 0, cursor: 8 })
    })

    it('insère le caractère tapé au point de jonction (remplacement atomique)', () => {
        const article = makeArticle([paragraph('Bonjour le monde.')])
        const blocks = makeBlocks(article)
        const registry = registryFor(article, blocks)

        const result = registry.get('art__texte__0').deleteRange(8, 0, 16, { insertText: 'X' })

        expect(article.texte).toEqual([paragraph('Bonjour X.')])
        expect(result).toEqual({ index: 0, cursor: 9 })
    })

    it('fusionne les restes de deux paragraphes adjacents', () => {
        const article = makeArticle([paragraph('Premier paragraphe.'), paragraph('Deuxième paragraphe.')])
        const blocks = makeBlocks(article)
        const registry = registryFor(article, blocks)

        // sélection depuis "Premier " jusqu'à "paragraphe." (fin du 2e)
        const result = registry.get('art__texte__0').deleteRange('Premier '.length, 1, 'Deuxième '.length)

        expect(article.texte).toEqual([paragraph('Premier paragraphe.')])
        expect(result).toEqual({ index: 0, cursor: 'Premier '.length })
    })

    it('fusionne à travers 3 paragraphes : ceux du milieu disparaissent intégralement', () => {
        const article = makeArticle([paragraph('Un.'), paragraph('Deux.'), paragraph('Trois.'), paragraph('Quatre.')])
        const blocks = makeBlocks(article)
        const registry = registryFor(article, blocks)

        // sélection depuis juste après "Un" (le "." est inclus dans la sélection) jusqu'à après "Q"
        const result = registry.get('art__texte__0').deleteRange('Un'.length, 3, 'Q'.length)

        expect(article.texte).toEqual([paragraph('Unuatre.')])
        expect(result).toEqual({ index: 0, cursor: 'Un'.length })
    })

    it('conserve deux paragraphes distincts quand keepSplit est vrai (touche Entrée)', () => {
        const article = makeArticle([paragraph('Premier paragraphe.'), paragraph('Deuxième paragraphe.')])
        const blocks = makeBlocks(article)
        const registry = registryFor(article, blocks)

        const result = registry.get('art__texte__0').deleteRange('Premier '.length, 1, 'Deuxième '.length, { keepSplit: true })

        expect(article.texte).toEqual([paragraph('Premier '), paragraph('paragraphe.')])
        expect(result).toEqual({ index: 1, cursor: 0 })
    })

    it('ignore les blocs qui ne sont pas de type texte (ex: titre)', () => {
        const article = { texte: [paragraph('Un paragraphe.')], titre: 'Titre' }
        const blocks = [makeTitreBlock(), ...makeBlocks(article)]
        const registry = registryFor(article, blocks)

        expect(registry.get('art__titre').deleteRange(0, 0, 1)).toBeFalsy()
        expect(article.texte).toEqual([paragraph('Un paragraphe.')])
    })

    it('garde deux entrées distinctes plutôt que fusionner un paragraphe et une liste (types incompatibles)', () => {
        const article = makeArticle([paragraph('Un paragraphe.'), list(false, ['Un item'])])
        const blocks = makeBlocks(article)
        const registry = registryFor(article, blocks)

        // Sélection vide, pile à la frontière entre les deux entrées.
        const result = registry.get('art__texte__0').deleteRange('Un paragraphe.'.length, 1, 0)

        expect(article.texte).toEqual([paragraph('Un paragraphe.'), list(false, ['Un item'])])
        expect(result).toEqual({ index: 1, cursor: 0 })
    })
})

describe("régression : scinder un paragraphe (Entrée) puis le refusionner (Backspace) restaure l'état initial", () => {
    it('round-trip split puis merge-prev', () => {
        const article = makeArticle([paragraph('Bonjour le monde.')])

        // 1) Entrée au milieu du paragraphe : Quill produit deux <p>,
        //    ce qui se traduit par un split de article.texte (cf. applyEdit).
        let blocks = makeBlocks(article)
        let registry = registryFor(article, blocks)
        registry.get('art__texte__0').setHtml('<p>Bonjour</p><p> le monde.</p>')

        expect(article.texte).toEqual([paragraph('Bonjour'), paragraph(' le monde.')])

        // 2) refresh() reconstruirait les blocs à partir du nouvel état :
        blocks = makeBlocks(article)
        registry = registryFor(article, blocks)

        // 3) Backspace en tout début du nouveau (second) paragraphe.
        const result = registry.get('art__texte__1').mergePrev()

        expect(article.texte).toEqual([paragraph('Bonjour le monde.')])
        // Le curseur doit revenir exactement à la jonction (fin de "Bonjour").
        expect(result).toEqual({ index: 0, cursor: 'Bonjour'.length })
    })
})
