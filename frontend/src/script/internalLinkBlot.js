// Format Quill custom pour un lien interne (vers un autre nœud du document),
// distinct du blot 'link' natif de Quill qui sanitize/rejette les schémas
// non-http (cf. plan "liens internes"). Même marque HTML que celle produite
// à l'import ODT (odt-parser.ts, resolveInternalLinks) : <a href="internal:{id}"
// class="lien-interne">, pour partager rendu/style/clic-navigation.
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
