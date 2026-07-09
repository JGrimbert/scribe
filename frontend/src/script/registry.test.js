import { describe, it, expect } from 'vitest'
import { createRegistry } from './registry.js'

function makeArticle(paragraphs) {
    return { texte: [...paragraphs] }
}

// Reproduit la forme des blocs telle que construite par buildBlock() dans
// paginate.js, sans dépendre de Paged.js.
function makeBlocks(article) {
    return article.texte.map((p, index) => ({
        id: `art__texte__${index}`,
        type: 'paragraph',
        path: { kind: 'texte', index },
        html: `<p>${p}</p>`,
    }))
}

function makeTitreBlock() {
    return { id: 'art__titre', type: 'title', path: { kind: 'titre' }, html: '<h3>Titre</h3>' }
}

describe('registry mergeNext / mergePrev', () => {
    it('fusionne le paragraphe courant avec le suivant et renvoie la position du curseur', () => {
        const article = makeArticle(['Premier paragraphe.', 'Deuxième paragraphe.', 'Troisième paragraphe.'])
        const blocks = makeBlocks(article)
        const registry = createRegistry(article, blocks, null)

        const result = registry.get('art__texte__0').mergeNext()

        expect(article.texte).toEqual([
            'Premier paragraphe. Deuxième paragraphe.',
            'Troisième paragraphe.',
        ])
        expect(result).toEqual({ index: 0, cursor: 'Premier paragraphe.'.length })
    })

    it('fusionne le paragraphe courant avec le précédent et renvoie la position du curseur', () => {
        const article = makeArticle(['Premier paragraphe.', 'Deuxième paragraphe.', 'Troisième paragraphe.'])
        const blocks = makeBlocks(article)
        const registry = createRegistry(article, blocks, null)

        const result = registry.get('art__texte__2').mergePrev()

        expect(article.texte).toEqual([
            'Premier paragraphe.',
            'Deuxième paragraphe. Troisième paragraphe.',
        ])
        expect(result).toEqual({ index: 1, cursor: 'Deuxième paragraphe.'.length })
    })

    it('ne fait rien quand on merge-next depuis le dernier paragraphe', () => {
        const article = makeArticle(['Seul paragraphe.'])
        const blocks = makeBlocks(article)
        const registry = createRegistry(article, blocks, null)

        const result = registry.get('art__texte__0').mergeNext()

        expect(result).toBeFalsy()
        expect(article.texte).toEqual(['Seul paragraphe.'])
    })

    it('ne fait rien quand on merge-prev depuis le premier paragraphe', () => {
        const article = makeArticle(['Seul paragraphe.'])
        const blocks = makeBlocks(article)
        const registry = createRegistry(article, blocks, null)

        const result = registry.get('art__texte__0').mergePrev()

        expect(result).toBeFalsy()
        expect(article.texte).toEqual(['Seul paragraphe.'])
    })

    it('ignore les blocs qui ne sont pas de type texte (ex: titre)', () => {
        const article = { texte: ['Un paragraphe.'], titre: 'Titre' }
        const blocks = [makeTitreBlock(), ...makeBlocks(article)]
        const registry = createRegistry(article, blocks, null)

        expect(registry.get('art__titre').mergeNext()).toBeFalsy()
        expect(registry.get('art__titre').mergePrev()).toBeFalsy()
        expect(article.texte).toEqual(['Un paragraphe.'])
    })

    it('nettoie les espaces superflus à la jonction', () => {
        const article = makeArticle(['Premier.   ', '   Deuxième.'])
        const blocks = makeBlocks(article)
        const registry = createRegistry(article, blocks, null)

        registry.get('art__texte__0').mergeNext()

        expect(article.texte).toEqual(['Premier. Deuxième.'])
    })
})

describe('registry setHtml (kind texte)', () => {
    it('fractionne un paragraphe en plusieurs entrées quand le HTML contient plusieurs <p>', () => {
        const article = makeArticle(['Bonjour le monde.'])
        const blocks = makeBlocks(article)
        const registry = createRegistry(article, blocks, null)

        registry.get('art__texte__0').setHtml('<p>Bonjour</p><p> le monde.</p>')

        expect(article.texte).toEqual(['Bonjour', ' le monde.'])
    })
})

describe('registry deleteRange', () => {
    it('supprime une sélection à l\'intérieur d\'un seul paragraphe', () => {
        const article = makeArticle(['Bonjour le monde.'])
        const blocks = makeBlocks(article)
        const registry = createRegistry(article, blocks, null)

        // "Bonjour [le monde]." -> sélection = "le monde"
        const result = registry.get('art__texte__0').deleteRange(8, 0, 16)

        expect(article.texte).toEqual(['Bonjour .'])
        expect(result).toEqual({ index: 0, cursor: 8 })
    })

    it('insère le caractère tapé au point de jonction (remplacement atomique)', () => {
        const article = makeArticle(['Bonjour le monde.'])
        const blocks = makeBlocks(article)
        const registry = createRegistry(article, blocks, null)

        const result = registry.get('art__texte__0').deleteRange(8, 0, 16, { insertText: 'X' })

        expect(article.texte).toEqual(['Bonjour X.'])
        expect(result).toEqual({ index: 0, cursor: 9 })
    })

    it('fusionne les restes de deux paragraphes adjacents', () => {
        const article = makeArticle(['Premier paragraphe.', 'Deuxième paragraphe.'])
        const blocks = makeBlocks(article)
        const registry = createRegistry(article, blocks, null)

        // sélection depuis "Premier " jusqu'à "paragraphe." (fin du 2e)
        const result = registry.get('art__texte__0').deleteRange('Premier '.length, 1, 'Deuxième '.length)

        expect(article.texte).toEqual(['Premier paragraphe.'])
        expect(result).toEqual({ index: 0, cursor: 'Premier '.length })
    })

    it('fusionne à travers 3 paragraphes : ceux du milieu disparaissent intégralement', () => {
        const article = makeArticle(['Un.', 'Deux.', 'Trois.', 'Quatre.'])
        const blocks = makeBlocks(article)
        const registry = createRegistry(article, blocks, null)

        // sélection depuis juste après "Un" (le "." est inclus dans la sélection) jusqu'à après "Q"
        const result = registry.get('art__texte__0').deleteRange('Un'.length, 3, 'Q'.length)

        expect(article.texte).toEqual(['Unuatre.'])
        expect(result).toEqual({ index: 0, cursor: 'Un'.length })
    })

    it('conserve deux paragraphes distincts quand keepSplit est vrai (touche Entrée)', () => {
        const article = makeArticle(['Premier paragraphe.', 'Deuxième paragraphe.'])
        const blocks = makeBlocks(article)
        const registry = createRegistry(article, blocks, null)

        const result = registry.get('art__texte__0').deleteRange('Premier '.length, 1, 'Deuxième '.length, { keepSplit: true })

        expect(article.texte).toEqual(['Premier ', 'paragraphe.'])
        expect(result).toEqual({ index: 1, cursor: 0 })
    })

    it('ignore les blocs qui ne sont pas de type texte (ex: titre)', () => {
        const article = { texte: ['Un paragraphe.'], titre: 'Titre' }
        const blocks = [makeTitreBlock(), ...makeBlocks(article)]
        const registry = createRegistry(article, blocks, null)

        expect(registry.get('art__titre').deleteRange(0, 0, 1)).toBeFalsy()
        expect(article.texte).toEqual(['Un paragraphe.'])
    })
})

describe("régression : scinder un paragraphe (Entrée) puis le refusionner (Backspace) restaure l'état initial", () => {
    it('round-trip split puis merge-prev', () => {
        const article = makeArticle(['Bonjour le monde.'])

        // 1) Entrée au milieu du paragraphe : Quill produit deux <p>,
        //    ce qui se traduit par un split de article.texte (cf. applyEdit).
        let blocks = makeBlocks(article)
        let registry = createRegistry(article, blocks, null)
        registry.get('art__texte__0').setHtml('<p>Bonjour</p><p> le monde.</p>')

        expect(article.texte).toEqual(['Bonjour', ' le monde.'])

        // 2) refresh() reconstruirait les blocs à partir du nouvel état :
        blocks = makeBlocks(article)
        registry = createRegistry(article, blocks, null)

        // 3) Backspace en tout début du nouveau (second) paragraphe.
        const result = registry.get('art__texte__1').mergePrev()

        expect(article.texte).toEqual(['Bonjour le monde.'])
        // Le curseur doit revenir exactement à la jonction (fin de "Bonjour").
        expect(result).toEqual({ index: 0, cursor: 'Bonjour'.length })
    })
})
