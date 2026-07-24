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
  // Styles AJOUTÉS à la main (bouton « + » du tableau), absents du .odt : chacun
  // { name, role, zoneKey, afterName }. Le rôle vit AUSSI dans `styles` (pour que
  // rôle/exigé/succession les visent sans cas particulier) ; cette liste porte
  // leur PLACE (zone + ancre), que la map nom→rôle ne sait pas dire. Persistée
  // dans le payload typologie (`declaredStyles`), cf. backend typology.ts.
  const declaredStyles = reactive([])
  // `default` + un jeu optionnel par profondeur. byDepth vide = cas nominal.
  const rules = reactive({ default: emptyRuleSet(), byDepth: {} })
  // Tagging des pages liminaires, keyé par `page.key` (cf. script/liminaire) :
  // { [key]: { type, side } }. Décision utilisateur, séparée des entrées (qu'un
  // reparse régénère) — persistée à part (colonne `liminaireConfig`), branchée
  // au save/load à l'étape suivante.
  const liminaireConfig = reactive({})
  // Réglages typographiques généraux (césure…), persistés à part
  // (`GET/PUT /documents/:id/style-defaults`). Appliqués par la couche Folio
  // au-dessus des styles du .odt. Muté en place comme `rules`/`liminaireConfig`.
  const styleDefaults = reactive({ hyphenation: { global: false } })
  // Surcharges d'apparence PAR STYLE (police, corps, césure…), éditées dans le
  // panneau de style, persistées à part (`GET/PUT /documents/:id/style-overrides`).
  // `styleOverrides` = map éditable { [style]: Partial<StyleVisual> } (mutée en
  // place) ; `styleBase` = les valeurs .odt d'origine (lecture seule, placeholders
  // du panneau et point de retour).
  const styleOverrides = reactive({})
  const styleBase = ref({})

  // Les modèles se recomposent contre `styles` (la typologie EN COURS
  // d'édition) : changer un rôle recompose les motifs dans le même tick.
  const { groups: shapeGroups, error: shapesError, load: loadShapes } = useStructureShapes(styles, rules)

  // Apparence EFFECTIVE = valeurs .odt + surcharges Scribe EN COURS d'édition
  // (mergées, comme le backend le fait au rendu). Alimente l'aperçu FolioView de la
  // config → le feedback des retouches est immédiat, avant même l'enregistrement.
  // Nouvel objet à chaque édition (spread) → l'aperçu détecte le changement.
  const effectiveVisuals = computed(() => {
    const base = styleBase.value || {}
    const out = {}
    for (const name of new Set([...Object.keys(base), ...Object.keys(styleOverrides)])) {
      out[name] = { ...base[name], ...styleOverrides[name] }
    }
    return out
  })

  const zoned = computed(() => hasZones(inventory.value.styles))

  // Les styles de l'inventaire, ventilés par zone, PUIS les styles déclarés
  // insérés à leur place (après leur ancre, ou en tête si `afterName` nul ; en
  // fin si l'ancre a disparu). Arrays clonées : on ne mute pas la mémo de
  // groupByZone. Les items déclarés portent `declared: true` (le tableau les
  // marque et permet de les retirer).
  const stylesByZone = computed(() => {
    const map = new Map(groupByZone(inventory.value.styles).map((s) => [s.zone.key, [...s.styles]]))
    for (const d of declaredStyles) {
      let arr = map.get(d.zoneKey)
      if (!arr) { arr = []; map.set(d.zoneKey, arr) }
      const item = { name: d.name, headings: 0, sample: '', declared: true }
      const at = d.afterName == null ? -1 : arr.findIndex((s) => s.name === d.afterName)
      if (at === -1 && d.afterName != null) arr.push(item)
      else arr.splice(at + 1, 0, item)
    }
    return map
  })

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
    else rules.byDepth[key] = cloneDefault()
  }

  // Un jeu de niveau démarre en COPIE du défaut : `byDepth` remplace `default`
  // (il ne le complète pas, cf. rules.ts), donc un jeu vide ferait perdre
  // minChars/annotations à ce niveau. Tableaux clonés (proxy réactif imbriqué).
  function cloneDefault() {
    const d = rules.default
    return {
      minChars: d.minChars,
      forbidAnnotations: d.forbidAnnotations,
      requiresRoles: [...d.requiresRoles],
      requiresTable: d.requiresTable,
      requiresStyles: [...(d.requiresStyles ?? [])],
      requiresAdjacency: (d.requiresAdjacency ?? []).map((p) => [...p]),
    }
  }

  // Le niveau n'a plus de toggle « règles propres » explicite : marquer un style
  // « exigé » ou poser une succession MATÉRIALISE son jeu au vol (copie du
  // défaut), et le supprime dès qu'il n'a plus d'écart au défaut — sinon un jeu
  // fantôme étiquetterait le dashboard par niveau sans raison.
  function ensureDepth(key) {
    if (!rules.byDepth[key]) rules.byDepth[key] = cloneDefault()
    return rules.byDepth[key]
  }

  // Purge un jeu de niveau redevenu identique au défaut. Le seul écart éditable
  // ici étant les deux nouveaux tableaux (les autres champs sont copiés du défaut
  // et non modifiables au niveau), « identique » ⟺ les deux tableaux vides.
  function pruneDepth(key) {
    const set = rules.byDepth[key]
    if (set && set.requiresStyles.length === 0 && set.requiresAdjacency.length === 0) delete rules.byDepth[key]
  }

  // Case « exigé » d'une ligne : bascule le style nommé dans le jeu du niveau.
  function toggleRequireStyle(key, styleName) {
    const arr = ensureDepth(key).requiresStyles
    const i = arr.indexOf(styleName)
    if (i === -1) arr.push(styleName)
    else arr.splice(i, 1)
    pruneDepth(key)
  }

  // Puce de succession entre deux lignes : bascule la paire ordonnée [a, b].
  function toggleAdjacency(key, a, b) {
    const arr = ensureDepth(key).requiresAdjacency
    const i = arr.findIndex((p) => p[0] === a && p[1] === b)
    if (i === -1) arr.push([a, b])
    else arr.splice(i, 1)
    pruneDepth(key)
  }

  // Ajoute un style déclaré (bouton « + ») : sa place dans `declaredStyles`, son
  // rôle AUSSI dans la map `styles` pour qu'il se comporte comme les autres
  // lignes. Refus silencieux d'un nom en collision (inventaire ou déjà déclaré) :
  // deux styles homonymes casseraient l'unicité que suppose la map.
  function addDeclaredStyle({ name, role, zoneKey, afterName }) {
    const trimmed = (name ?? '').trim()
    if (!trimmed) return false
    if (trimmed in styles || declaredStyles.some((d) => d.name === trimmed)) return false
    declaredStyles.push({ name: trimmed, role, zoneKey, afterName: afterName ?? null })
    styles[trimmed] = role
    return true
  }

  // Retire un style déclaré : la ligne, son rôle, et toute règle qui le visait
  // (exigé/succession, défaut comme par niveau) — sinon une règle orpheline
  // pointerait un style qui n'existe plus.
  function removeDeclaredStyle(name) {
    const i = declaredStyles.findIndex((d) => d.name === name)
    if (i === -1) return
    declaredStyles.splice(i, 1)
    delete styles[name]

    const strip = (set) => {
      set.requiresStyles = set.requiresStyles.filter((s) => s !== name)
      set.requiresAdjacency = set.requiresAdjacency.filter((p) => p[0] !== name && p[1] !== name)
    }
    strip(rules.default)
    for (const key of Object.keys(rules.byDepth)) {
      strip(rules.byDepth[key])
      pruneDepth(Number(key))
    }
  }

  async function load(id) {
    loading.value = true
    loadError.value = null

    // À part, sans await : les modèles sont un complément, leur échec ne doit
    // pas masquer la typologie.
    loadShapes(id)

    try {
      const [typoRes, rulesRes, limRes, defaultsRes, overridesRes] = await Promise.all([
        fetch(`/api/documents/${id}/typology`),
        fetch(`/api/documents/${id}/rules`),
        fetch(`/api/documents/${id}/liminaire-config`),
        fetch(`/api/documents/${id}/style-defaults`),
        fetch(`/api/documents/${id}/style-overrides`),
      ])
      if (!typoRes.ok) throw new Error(`HTTP ${typoRes.status}`)
      if (!rulesRes.ok) throw new Error(`HTTP ${rulesRes.status}`)
      if (!limRes.ok) throw new Error(`HTTP ${limRes.status}`)
      if (!defaultsRes.ok) throw new Error(`HTTP ${defaultsRes.status}`)
      if (!overridesRes.ok) throw new Error(`HTTP ${overridesRes.status}`)

      const data = await typoRes.json()
      inventory.value = data.inventory
      settled.value = data.settled
      Object.assign(styles, data.suggested.styles, data.typology?.styles ?? {})
      Object.assign(highlights, data.suggested.highlights, data.typology?.highlights ?? {})
      // Remplacé, pas fusionné (comme liminaireConfig) : la place des styles
      // déclarés repart de la base. Leur rôle est déjà dans `styles` ci-dessus.
      declaredStyles.splice(0, declaredStyles.length, ...(data.typology?.declaredStyles ?? []))

      const loaded = await rulesRes.json()
      rules.default = loaded.default
      rules.byDepth = loaded.byDepth ?? {}

      // Remplacé, pas fusionné : un rechargement (après recalibrage) doit
      // repartir de la config en base, pas empiler sur des clés de pages qui
      // n'existent peut-être plus.
      for (const k of Object.keys(liminaireConfig)) delete liminaireConfig[k]
      Object.assign(liminaireConfig, await limRes.json())

      // Normalisé côté backend (toujours la forme complète) : on l'écrase tel quel.
      const defaults = await defaultsRes.json()
      styleDefaults.hyphenation.global = defaults.hyphenation.global

      // Remplacé, pas fusionné (comme liminaireConfig) : un rechargement repart de
      // la base. `base` (valeurs .odt) est en lecture seule.
      const { overrides, base } = await overridesRes.json()
      for (const k of Object.keys(styleOverrides)) delete styleOverrides[k]
      Object.assign(styleOverrides, overrides)
      styleBase.value = base
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
        put(id, 'typology', { styles: { ...styles }, highlights: { ...highlights }, declaredStyles: JSON.parse(JSON.stringify(declaredStyles)) }),
        put(id, 'rules', JSON.parse(JSON.stringify(rules))),
        // `liminaireConfig` est un proxy réactif imbriqué : désérialisé en
        // profondeur comme `rules`. Le backend normalise (jette 'auto'/vides).
        put(id, 'liminaire-config', JSON.parse(JSON.stringify(liminaireConfig))),
        put(id, 'style-defaults', JSON.parse(JSON.stringify(styleDefaults))),
        put(id, 'style-overrides', JSON.parse(JSON.stringify(styleOverrides))),
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
  watch([styles, highlights, declaredStyles, rules, liminaireConfig, styleDefaults, styleOverrides], () => { saved.value = false })

  return {
    loading, loadError, saveError, saving, saved, settled,
    inventory, styles, highlights, rules, liminaireConfig, styleDefaults, zoned,
    styleOverrides, styleBase, effectiveVisuals,
    sections, unzonedStyles, shapeGroups, shapesError,
    declaredStyles, addDeclaredStyle, removeDeclaredStyle,
    load, save, toggleDepth, toggleRequireStyle, toggleAdjacency,
  }
}
