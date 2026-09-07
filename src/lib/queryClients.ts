/**
 * Le client React Query de l'app — et son JUMEAU d'arrière-plan.
 *
 * ── LE DÉFAUT QU'ILS CORRIGENT ───────────────────────────────────────────────
 * `refetchOnWindowFocus: true` est un défaut GLOBAL, et c'est le bon réglage :
 * l'agent revient sur l'onglet du navigateur après une réunion, ses données
 * doivent être fraîches. Mais « au retour » veut dire « toutes les requêtes
 * MONTÉES se relancent d'un coup », et depuis le 7 septembre 2026 six écrans
 * restent vivants derrière l'onglet affiché au lieu de trois. Le nombre de
 * requêtes qui repartent ensemble au moment précis où l'agent regarde son écran
 * a donc DOUBLÉ — et cinq de ces six écrans, personne ne les regarde.
 *
 * ⚠ C'est une amplification que le passage à six a créée, pas un défaut
 * préexistant. Elle est le pendant assumé des écrans vivants : garder un écran
 * monté, c'est garder ses requêtes montées.
 *
 * ── COMMENT LA GARDE FONCTIONNE, ET POURQUOI ELLE EST SÛRE ───────────────────
 * `query.onFocus()` de query-core fait exactement ceci :
 *
 *     const observer = this.observers.find((x) => x.shouldFetchOnWindowFocus())
 *
 * — la décision est prise PAR OBSERVATEUR, et il suffit qu'UN SEUL la demande
 * pour que la requête se relance. Deux conséquences, toutes deux voulues :
 *   • une donnée que regarde l'écran VISIBLE se rafraîchit, même si cinq écrans
 *     cachés l'observent aussi ;
 *   • une donnée que SEULS des écrans cachés observent attend son tour.
 *
 * Les observateurs d'un écran caché sont créés sous le jumeau que rend
 * {@link clientArrierePlan}, dont le seul écart est `refetchOnWindowFocus:
 * false`. Tout le reste — le CACHE lui-même, celui des mutations, et les autres
 * défauts — est PARTAGÉ : ce sont deux jeux de réglages sur un seul magasin,
 * pas deux magasins.
 *
 * ⛔ LE CACHE DOIT ÊTRE LE MÊME OBJET, sans quoi tout s'effondre en silence :
 * deux caches, ce serait deux copies de chaque donnée, deux requêtes réseau là
 * où il en faut une, et un `setQueryData` d'un écran invisible à l'autre. C'est
 * `queryCache` / `mutationCache` passés au constructeur qui l'assurent — la
 * seule façon supportée de faire varier des défauts sans dupliquer le magasin.
 *
 * ⚠ CE QUE ÇA COÛTE, dit franchement : les deux clients s'abonnent au focus,
 * donc le cache est parcouru deux fois par retour. Le second passage ne relance
 * rien — la requête est déjà en vol et query-core déduplique. C'est du travail
 * en double sur une liste, pas des appels en double.
 *
 * ⚠ ET LE RISQUE RÉSIDUEL, parce qu'il existe. `useBaseQuery` crée son
 * observateur UNE fois, avec le client présent au montage, et ne le recrée pas
 * si le client change de contexte. Ce qui suit le changement, ce sont les
 * OPTIONS : elles sont recalculées à chaque rendu depuis le client du contexte
 * (`client.defaultQueryOptions(options)`) puis posées par `observer.setOptions`.
 * C'est bien elles que lit `shouldFetchOnWindowFocus`, donc la bascule prend.
 * Si un jour elle ne prenait plus, le mode de panne serait doux : un écran qui
 * ne se rafraîchit pas tout seul au retour. Jamais une donnée perdue, jamais un
 * écran cassé.
 */

import { QueryClient, type DefaultOptions } from '@tanstack/react-query'

/**
 * Les défauts de l'app.
 *
 * - `networkMode: 'always'`
 *     Chrome rapporte parfois `navigator.onLine = false` après une veille, une
 *     bascule WiFi↔4G ou un VPN. En mode `'online'`, TanStack met les requêtes
 *     en pause jusqu'au retour du drapeau — qui peut rester coincé, laissant la
 *     page sur des squelettes éternels, sans requête ni erreur en console.
 * - `refetchOnWindowFocus: true`
 *     L'agent réveille son portable ou revient sur l'onglet après un quart
 *     d'heure : Chrome a purgé une partie de l'état en mémoire. Sans ce
 *     rafraîchissement, il regarde des squelettes vides. Combiné au `staleTime`
 *     de 2 min, il ne part que si la donnée est réellement périmée — pas de
 *     tempête quand on alt-tabbe toutes les trente secondes.
 * - `refetchOnReconnect: true` — le pendant réseau du précédent.
 * - `staleTime: 2 min` — accordé à la vitesse à laquelle une annonce bouge.
 * - `retry: 1` avec un repli court — échouer vite fait remonter un état
 *     d'erreur actionnable, plutôt que de tourner indéfiniment.
 */
const DEFAUTS: DefaultOptions = {
  queries: {
    staleTime: 1000 * 60 * 2,
    retry: 1,
    retryDelay: (attempt: number) => Math.min(500 * 2 ** attempt, 4000),
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    networkMode: 'always',
  },
  mutations: {
    networkMode: 'always',
    retry: 0,
  },
}

/** Le client de l'app — celui de l'écran qu'on regarde. */
export const queryClient = new QueryClient({ defaultOptions: DEFAUTS })

/**
 * Les jumeaux d'arrière-plan, un par client hôte.
 *
 * ⛔ UNE `WeakMap`, ET SURTOUT PAS UNE CONSTANTE DE MODULE. Premier jet : un
 * second client exporté en dur, importé par `EcranVivant`. Ça marche dans
 * l'app — et ça ÉCRASE le client de tout hôte qui fournit le sien. Le banc
 * `/dev/crm` en fournit un, réglé exprès (`retry: false`, fixtures) ; un écran
 * caché y serait passé sous les réglages de la production. La règle React est
 * que le fournisseur le plus proche gagne : un composant n'a pas à décider quel
 * magasin l'entoure.
 *
 * Le jumeau se DÉRIVE donc de l'hôte : mêmes caches, mêmes défauts, un seul
 * écart. La `WeakMap` garantit qu'il n'en existe qu'un par hôte — sans quoi
 * chaque rendu en fabriquerait un, et chacun s'abonnerait au focus.
 */
const jumeaux = new WeakMap<QueryClient, QueryClient>()

/**
 * Le client des écrans VIVANTS MAIS CACHÉS — même magasin que l'hôte, un seul
 * écart : `refetchOnWindowFocus: false`.
 *
 * ⚠ Un écran caché ne se rafraîchit pas au retour sur la page ; il se
 * rafraîchira quand il redeviendra visible et repassera sous le client hôte, ou
 * au premier `invalidateQueries` venu d'ailleurs — le cache est commun, donc une
 * écriture faite n'importe où lui parvient.
 */
export function clientArrierePlan(hote: QueryClient): QueryClient {
  const connu = jumeaux.get(hote)
  if (connu) return connu
  const defauts = hote.getDefaultOptions()
  const jumeau = new QueryClient({
    queryCache: hote.getQueryCache(),
    mutationCache: hote.getMutationCache(),
    defaultOptions: {
      ...defauts,
      queries: { ...defauts.queries, refetchOnWindowFocus: false },
    },
  })
  jumeaux.set(hote, jumeau)
  return jumeau
}
