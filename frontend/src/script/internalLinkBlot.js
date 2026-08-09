// Format Quill custom pour un lien interne, distinct du blot 'link' natif (qui rejette
// les schémas non-http). Même marque HTML que l'import ODT (resolveInternalLinks) :
// <a href="internal:{id}" class="lien-interne">.
export function registerInternalLinkBlot(Quill) {
  const Inline = Quill.import('blots/inline')

  class InternalLink extends Inline {
    static create(value) {
      const node = super.create()
      node.setAttribute('href', `internal:${value.id}`)
      node.setAttribute('class', 'lien-interne')
      return node
    }

    static formats(node) {
      const href = node.getAttribute('href') || ''
      return href.startsWith('internal:') ? { id: href.slice('internal:'.length) } : undefined
    }
  }
  InternalLink.blotName = 'internalLink'
  InternalLink.tagName = 'a'

  Quill.register(InternalLink, true)
}
