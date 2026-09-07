/**
 * Récupération des échecs de chargement de chunk — bundle périmé OU cache empoisonné.
 *
 * Deux modes de panne partagent le même symptôme (« Failed to fetch dynamically
 * imported module ») mais n'ont pas le même remède :
 *
 *   1. Bundle périmé : l'index.html en mémoire référence des chunks renommés par
 *      un redéploiement. Un rechargement suffit (index.html est servi en
 *      max-age=0, la nouvelle version arrive).
 *   2. Cache empoisonné : pendant la bascule d'un déploiement Cloudflare Pages,
 *      un chunk pas encore propagé est servi par le fallback SPA — index.html,
 *      statut 200, ET les en-têtes de cache des assets (max-age=14400). Le
 *      navigateur met ce HTML en cache POUR L'URL DU .js pendant 4 heures : tout
 *      rechargement NORMAL réutilise l'entrée « fraîche » et l'app est morte pour
 *      ce navigateur-là, et lui seul. Incident du 03.08.2026 : le premier compte
 *      créé après le déploiement de 20:49:50 a atterri sur « Une erreur est
 *      survenue » à chaque visite de /dashboard/identite — le chunk
 *      useAgencyIdentity servait du HTML depuis le cache disque, alors que la
 *      production était saine pour tout le monde d'autre.
 *
 * Le remède commun : re-télécharger l'entrée fautive et ses dépendances statiques
 * avec `cache: 'reload'` (qui CONTOURNE et REMPLACE l'entrée de cache), puis
 * recharger la page avec un cache-buster. C'est purgeChunkCache + l'orchestration
 * dans ErrorBoundary ; StaleBundleDetector garde son rôle pour les échecs hors
 * rendu React (rejets non gérés).
 *
 * ⚠ Un échec de chunk d'une ROUTE lazy ne devient jamais un rejet non géré : il
 * est relancé pendant le rendu à travers Suspense et capté par ErrorBoundary —
 * StaleBundleDetector ne le voit pas. C'est pour ça que la récupération vit ici,
 * consommée par la frontière d'erreur, et pas seulement dans le détecteur.
 */

/**
 * Messages qui signent un échec de chargement de chunk. Les quatre premiers
 * viennent de StaleBundleDetector (Chrome, Firefox, Safari, webpack) ; les deux
 * derniers sont la variante MIME de Chrome quand la réponse pour une URL .js est
 * du HTML — précisément le mode « cache empoisonné » ci-dessus.
 */
export const STALE_CHUNK_PATTERNS = [
  'Failed to fetch dynamically imported module',
  'Importing a module script failed',
  'ChunkLoadError',
  'error loading dynamically imported module',
  'Expected a JavaScript module script',
  'Expected a JavaScript-or-Wasm module script',
]

/** true si `reason` (Error ou chaîne) correspond à un échec de chunk connu. */
export function isStaleChunkError(reason: unknown): boolean {
  if (!reason) return false
  const msg = reason instanceof Error ? reason.message : String(reason)
  return STALE_CHUNK_PATTERNS.some((p) => msg.includes(p))
}

/**
 * URL du chunk fautif, extraite du message d'erreur. Chrome et Firefox la
 * donnent (« …module: https://…/assets/X.js ») ; Safari non (« Importing a
 * module script failed. ») — null dans ce cas, la récupération se limite alors
 * au rechargement cache-busté.
 */
export function extractChunkUrl(reason: unknown): string | null {
  if (!reason) return null
  const msg = reason instanceof Error ? reason.message : String(reason)
  const match = msg.match(/https?:\/\/[^\s'")]+\.js|\/[^\s'")]*assets\/[^\s'")]+\.js/)
  return match ? match[0] : null
}

/**
 * Spécificateurs d'import statiques ou dynamiques relatifs (`./X.js`) d'un chunk
 * minifié Vite/rolldown : `from"./X.js"`, `import"./X.js"`, `import("./X.js")`.
 * Ce sont eux qui échouent « au nom de » l'entrée : le navigateur rapporte
 * l'échec sur le module IMPORTÉ dynamiquement même quand c'est une de ses
 * dépendances statiques qui a reçu du HTML.
 */
export function parseStaticDeps(source: string): string[] {
  const out = new Set<string>()
  for (const m of source.matchAll(/(?:from|import)\s*\(?\s*"(\.\/[^"]+\.js)"\s*\)?/g)) {
    out.add(m[1])
  }
  return [...out]
}

/** Résout `./X.js` contre le dossier de l'entrée (les chunks Vite sont co-localisés). */
function resolveDep(entryUrl: string, dep: string): string {
  const dir = entryUrl.slice(0, entryUrl.lastIndexOf('/') + 1)
  return dir + dep.replace(/^\.\//, '')
}

/**
 * Borne du parcours : le graphe d'une page lourde reste bien en dessous, et une
 * boucle accidentelle ne doit jamais transformer la récupération en tempête de
 * requêtes.
 */
const MAX_PURGED_CHUNKS = 40

/**
 * Re-télécharge l'entrée et ses dépendances (largeur d'abord, ensemble visité,
 * borné) avec `cache: 'reload'` — chaque fetch remplace l'éventuelle entrée de
 * cache empoisonnée par la vraie réponse du réseau. Une réponse non-JS (HTML du
 * fallback : cas « bundle périmé », le fichier n'existe plus) est purgée mais
 * pas parcourue. Rend le nombre d'URL purgées ; ne lève jamais.
 */
export async function purgeChunkCache(
  entryUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<number> {
  const seen = new Set<string>()
  const queue = [entryUrl]
  let purged = 0
  while (queue.length > 0 && seen.size < MAX_PURGED_CHUNKS) {
    const url = queue.shift() as string
    if (seen.has(url)) continue
    seen.add(url)
    let source: string
    try {
      const res = await fetchImpl(url, { cache: 'reload' })
      purged += 1
      const type = res.headers.get('content-type') ?? ''
      if (!res.ok || !type.includes('javascript')) continue
      source = await res.text()
    } catch {
      continue
    }
    for (const dep of parseStaticDeps(source)) {
      queue.push(resolveDep(url, dep))
    }
  }
  return purged
}

/**
 * Une seule tentative automatique par session : si la récupération échoue, on
 * retombe sur l'écran d'erreur au lieu de boucler recharge sur recharge.
 * sessionStorage et non localStorage : une session neuve a le droit de retenter.
 */
const RECOVERY_FLAG = 'megga-chunk-recovery-attempted'

type FlagStorage = Pick<Storage, 'getItem' | 'setItem'>

function defaultStorage(): FlagStorage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage
  } catch {
    return null
  }
}

/** true si aucune récupération n'a encore été tentée dans cette session. */
export function shouldAttemptChunkRecovery(storage: FlagStorage | null = defaultStorage()): boolean {
  try {
    return storage?.getItem(RECOVERY_FLAG) !== 'true'
  } catch {
    // Stockage indisponible (navigation privée stricte) : tenter quand même —
    // au pire l'utilisateur voit l'écran d'erreur après un rechargement de trop.
    return true
  }
}

export function markChunkRecoveryAttempted(storage: FlagStorage | null = defaultStorage()): void {
  try {
    storage?.setItem(RECOVERY_FLAG, 'true')
  } catch {
    /* noop */
  }
}

/**
 * URL de rechargement avec cache-buster `_v` — même geste que
 * StaleBundleDetector : force une révalidation d'index.html quel que soit
 * l'intermédiaire, sans toucher au chemin (les routes SPA ignorent la query).
 */
export function cacheBustedReloadUrl(href: string, now: number): string {
  const url = new URL(href)
  url.searchParams.set('_v', String(now))
  return url.toString()
}

/**
 * Combien de fois on retente un import dynamique avant d'abandonner, et l'attente
 * entre deux essais.
 *
 * ⛔ POURQUOI RETENTER, ET POURQUOI ÇA MANQUAIT. `React.lazy` MÉMORISE la promesse
 * de sa fabrique : un import qui échoue UNE fois échoue pour toujours, jusqu'au
 * rechargement de la page. Un raté réseau d'une demi-seconde — le Wi-Fi qui se
 * réveille, la 4G qui reprend, un onglet que Chrome vient de dégeler — condamne
 * donc la route pour de bon, et la seule issue restante est celle qu'on voit :
 * l'écran d'erreur, puis un rechargement.
 *
 * Retour de Julien (7 septembre 2026) : « quand je n'ai pas été un petit moment
 * sur le CRM, puis je reviens et je change d'onglet — écran blanc, je dois
 * recharger ». Quelques minutes d'absence : ni le jeton (une heure) ni le
 * déchargement d'onglet ne sont en cause à cette échelle ; la fenêtre où le
 * réseau n'est pas encore revenu, si. Et depuis que six écrans restent vivants,
 * une bascule sur deux monte un écran neuf, donc tire un chunk.
 *
 * ⚠ 350 puis 900 ms : assez pour laisser une pile réseau se rétablir, assez court
 * pour que trois essais ratés restent sous la seconde et demie — au-delà,
 * l'attente coûterait plus que l'écran d'erreur qu'elle évite.
 */
const REPRISES = 2
const ATTENTES_MS = [350, 900]

/**
 * Un import dynamique qui se retente avant de renoncer.
 *
 * ⛔ L'ERREUR FINALE EST CELLE DU PREMIER ESSAI, telle quelle. C'est elle que
 * {@link isStaleChunkError} reconnaît et sur laquelle `ErrorBoundary` déclenche
 * la purge de cache puis le rechargement : la réécrire ou l'envelopper ferait
 * tomber la récupération du bundle périmé, qui reste le bon remède quand le
 * fichier n'existe VRAIMENT plus. Retenter ne remplace pas cette voie, il lui
 * retire les cas où il n'y avait rien à réparer.
 *
 * ⚠ AUCUN CACHE-BUSTER SUR LA REPRISE, et c'est délibéré : changer l'URL du
 * module en ferait une SECONDE instance pour le navigateur. Deux copies d'un même
 * module, c'est deux états qui divergent en silence — le prix est bien plus élevé
 * que l'échec qu'on cherche à contourner. La purge cache-bustée existe pour ça,
 * et elle passe par un `fetch`, pas par un `import`.
 */
export function importAvecReprise<T>(fabrique: () => Promise<T>): Promise<T> {
  return (async () => {
    let premiere: unknown
    for (let essai = 0; essai <= REPRISES; essai += 1) {
      try {
        return await fabrique()
      } catch (e) {
        if (essai === 0) premiere = e
        if (essai === REPRISES) throw premiere
        await new Promise((r) => setTimeout(r, ATTENTES_MS[essai]))
      }
    }
    // Inatteignable : la boucle rend ou relance.
    throw premiere
  })()
}
