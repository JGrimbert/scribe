import { computed, reactive, ref, watch } from 'vue'
import { groupByZone, hasZones, UNZONED, ZONES } from '../script/zones'
import { emptyRuleSet } from '../script/typology'
import { useStructureShapes } from './useStructureShapes'

// Zone de l'inventaire → profondeur des règles (0/1/2). Seules les zones de
// chapitrage en ont une ; liminaire, partie finale et « non situés » n'ont ni
// modèles ni règles (ce ne sont pas des nœuds de l'arbre).
const DEPTH_BY_ZONE = { 'depth-0': 0, 'depth-1': 1, 'depth-2+': 2 }

/**
 * L'état de configuration d'un document : typologie des styles, surlignages,
 * règles d'éligibilité, modèles de structure. Extrait de l'ancienne
 * `StylesView` pour que `ConfigView` orchestre plusieurs sections sans porter
 * toute la mécanique de chargement/enregistrement.
 *
 * Les suggestions pré-remplissent le formulaire mais ne sont persistées qu'au
 * `save` : ce que l'utilisateur voit est une proposition, pas une décision.
 */
export function useTypologyConfig() {
  const loading = ref(true)
  const loadError = ref(null)
  const saveError = ref(null)
  const saving = ref(false)
  const saved = ref(false)
  const settled = ref(false)
  const inventory = ref({ styles: [], highlights: [] })

  const styles = reactive({})
  const highlights = reactive({})
  // `default` + un jeu optionnel par profondeur. byDepth vide = cas nominal.
  const rules = reactive({ default: emptyRuleSet(), byDepth: {} })
  // Tagging des pages liminaires, keyé par `page.key` (cf. script/liminaire) :
  // { [key]: { type, side } }. Décision utilisateur, séparée des entrées (qu'un
  // reparse régénère) — persistée à part (colonne `liminaireConfig`), branchée
  // au save/load à l'étape suivante.
  const liminaireConfig = reactive({})

  // Les modèles se recomposent contre `styles` (la typologie EN COURS
  // d'édition) : changer un rôle recompose les motifs dans le même tick.
  const { groups: shapeGroups, error: shapesError, load: loadShapes } = useStructureShapes(styles)

  const zoned = computed(() => hasZones(inventory.value.styles))

  const stylesByZone = computed(() => new Map(groupByZone(inventory.value.styles).map((s) => [s.zone.key, s.styles])))

  // Une section par typologie, dans l'ordre de lecture. Chaque section porte ce
  // qu'il faut pour se rendre seule : ses styles, son groupe de modèles (nul
  // hors chapitrage), et la profondeur de ses règles. « Non situés » n'en est
  // PAS : ses styles (paragraphes vides) vivent en bas, avec les surlignages.
  const sections = computed(() => {
    if (!inventory.value.styles.length) return []

    // Document antérieur à la ventilation par zone : pas de split possible, on
    // retombe sur une section plate unique.
    if (!zoned.value) {
      return [
        {
          zone: { key: 'all', label: 'Tous les styles', hint: 'Réimportez le document pour situer les styles dans le livre', color: 'var(--c-border)' },
          styles: inventory.value.styles,
          shapeGroup: null,
          depthKey: null,
        },
      ]
    }

    const shapeByZone = new Map(shapeGroups.value.map((g) => [g.zone.key, g]))

    return ZONES.map((zone) => ({
      zone,
      styles: stylesByZone.value.get(zone.key) ?? [],
      shapeGroup: shapeByZone.get(zone.key) ?? null,
      depthKey: DEPTH_BY_ZONE[zone.key] ?? null,
    }))
      // Le liminaire est toujours rendu — c'est lui qui héberge la reprise des
      // bornes, même sans style propre. Les autres n'apparaissent que s'ils ont
      // quelque chose à montrer.
      .filter((s) => s.zone.key === 'liminaire' || s.styles.length || s.shapeGroup)
  })

  // Les styles « non situés » (filets, ornements : paragraphes vides jamais
  // promus en nœuds). Rendus à part, près des surlignages — ni modèles ni
  // règles ne les concernent.
  const unzonedStyles = computed(() => (zoned.value ? stylesByZone.value.get(UNZONED.key) ?? [] : []))

  // Cocher part d'une COPIE du défaut, pas d'un jeu vide : on règle par écart au
  // défaut, et partir de rien ferait passer le niveau pour « sans exigence » le
  // temps de tout recocher.
  function toggleDepth(key) {
    if (rules.byDepth[key]) delete rules.byDepth[key]
    else rules.byDepth[key] = { ...rules.default, requiresRoles: [...rules.default.requiresRoles] }
  }

  async function load(id) {
    loading.value = true
    loadError.value = null

    // À part, sans await : les modèles sont un complément, leur échec ne doit
    // pas masquer la typologie.
    loadShapes(id)

    try {
      const [typoRes, rulesRes, limRes] = await Promise.all([
        fetch(`/api/documents/${id}/typology`),
        fetch(`/api/documents/${id}/rules`),
        fetch(`/api/documents/${id}/liminaire-config`),
      ])
      if (!typoRes.ok) throw new Error(`HTTP ${typoRes.status}`)
      if (!rulesRes.ok) throw new Error(`HTTP ${rulesRes.status}`)
      if (!limRes.ok) throw new Error(`HTTP ${limRes.status}`)

      const data = await typoRes.json()
      inventory.value = data.inventory
      settled.value = data.settled
      Object.assign(styles, data.suggested.styles, data.typology?.styles ?? {})
      Object.assign(highlights, data.suggested.highlights, data.typology?.highlights ?? {})

      const loaded = await rulesRes.json()
      rules.default = loaded.default
      rules.byDepth = loaded.byDepth ?? {}

      // Remplacé, pas fusionné : un rechargement (après recalibrage) doit
      // repartir de la config en base, pas empiler sur des clés de pages qui
      // n'existent peut-être plus.
      for (const k of Object.keys(liminaireConfig)) delete liminaireConfig[k]
      Object.assign(liminaireConfig, await limRes.json())
    } catch (e) {
      loadError.value = `Impossible de charger la configuration : ${e.message}`
    } finally {
      loading.value = false
    }
  }

  async function save(id) {
    saving.value = true
    saveError.value = null
    saved.value = false
    try {
      // Désérialisé en profondeur : `rules` est un proxy réactif imbriqué, un
      // spread de surface enverrait des proxies dans le JSON.
      const [typoBody] = await Promise.all([
        put(id, 'typology', { styles: { ...styles }, highlights: { ...highlights } }),
        put(id, 'rules', JSON.parse(JSON.stringify(rules))),
        // `liminaireConfig` est un proxy réactif imbriqué : désérialisé en
        // profondeur comme `rules`. Le backend normalise (jette 'auto'/vides).
        put(id, 'liminaire-config', JSON.parse(JSON.stringify(liminaireConfig))),
      ])
      settled.value = typoBody.settled
      saved.value = true
    } catch (e) {
      saveError.value = `Enregistrement impossible : ${e.message}`
    } finally {
      saving.value = false
    }
  }

  async function put(id, path, payload) {
    const res = await fetch(`/api/documents/${id}/${path}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const body = await res.json()
    if (!res.ok) {
      throw new Error(Array.isArray(body.message) ? body.message.join(', ') : body.message ?? `HTTP ${res.status}`)
    }
    return body
  }

  // Toute modification efface l'accusé d'enregistrement : sinon il resterait
  // affiché au-dessus de changements qui, eux, ne le sont pas.
  watch([styles, highlights, rules, liminaireConfig], () => { saved.value = false })

  return {
    loading, loadError, saveError, saving, saved, settled,
    inventory, styles, highlights, rules, liminaireConfig, zoned,
    sections, unzonedStyles, shapeGroups, shapesError,
    load, save, toggleDepth,
  }
}
