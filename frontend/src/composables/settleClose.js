import { nextTick } from 'vue'

// À attendre entre `closeEditor()` et la réouverture de l'éditeur après un
// split/merge. Rouvrir peut retomber sur exactement le même fragId qu'avant
// fermeture (ex: mergeNext garde le paragraphe courant au même index). Enchaîner
// fermeture puis réouverture dans le même tick synchrone ne déclenche PAS de
// remount Vue réel : le <QuillBlock> (v-if="editorVisible", :key="editingId") n'est
// ni démonté ni remonté, donc son mountQuill() — qui ne s'exécute qu'au montage —
// ne relit jamais le nouveau contenu fusionné : Quill reste affiché avec son texte
// pré-fusion. Ce nextTick force Vue à vraiment démonter avant qu'on ne rouvre,
// garantissant un montage frais avec le contenu à jour. Ne pas supprimer cet await
// en pensant que c'est un no-op.
export function settleClose() {
  return nextTick()
}
