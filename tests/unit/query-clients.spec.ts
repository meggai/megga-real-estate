/**
 * Les deux clients React Query — le magasin est UN, les réglages sont DEUX.
 *
 * Depuis le 7 septembre 2026, un écran vivant mais CACHÉ rend ses requêtes sous
 * `queryClientCache`, dont le seul écart est `refetchOnWindowFocus: false` : au
 * retour sur la page, six écrans vivants ne relancent plus tout d'un coup.
 *
 * ⚠ Ce fichier n'éprouve PAS le comportement React (quel client se trouve dans
 * le contexte de quel écran) : ça se joue dans `EcranVivant`, et le dépôt n'a
 * pas d'outillage de rendu de hooks. Il éprouve les deux invariants dont la
 * violation serait SILENCIEUSE et coûteuse — le magasin commun, et la
 * non-divergence des autres réglages.
 */

import { describe, it, expect } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { clientArrierePlan, queryClient } from '@/lib/queryClients'

const queryClientCache = clientArrierePlan(queryClient)

describe('queryClients — un seul magasin', () => {
  it('⛔ les deux clients partagent le MÊME cache de requêtes', () => {
    // Deux caches, ce serait deux copies de chaque donnée, deux appels réseau là
    // où il en faut un, et un `setQueryData` invisible d'un écran à l'autre —
    // le tout sans une erreur nulle part.
    expect(queryClientCache.getQueryCache()).toBe(queryClient.getQueryCache())
  })

  it('⛔ et le même cache de mutations', () => {
    expect(queryClientCache.getMutationCache()).toBe(queryClient.getMutationCache())
  })

  it('ce sont bien deux clients distincts', () => {
    expect(queryClientCache).not.toBe(queryClient)
  })

  it('une donnée écrite par l’un est lue par l’autre', () => {
    queryClient.setQueryData(['epreuve-partage'], { n: 1 })
    expect(queryClientCache.getQueryData(['epreuve-partage'])).toEqual({ n: 1 })
    queryClientCache.setQueryData(['epreuve-partage'], { n: 2 })
    expect(queryClient.getQueryData(['epreuve-partage'])).toEqual({ n: 2 })
    queryClient.removeQueries({ queryKey: ['epreuve-partage'] })
  })
})

describe('queryClients — un seul écart de réglage', () => {
  it('l’écran regardé se rafraîchit au retour, l’écran caché non', () => {
    expect(queryClient.getDefaultOptions().queries?.refetchOnWindowFocus).toBe(true)
    expect(queryClientCache.getDefaultOptions().queries?.refetchOnWindowFocus).toBe(false)
  })

  it('⛔ TOUT LE RESTE est identique — c’est la garde contre la dérive', () => {
    // Le mode de panne qu'on vise : quelqu'un règle `staleTime` ou `retry` sur
    // un seul des deux, et les écrans cachés se mettent à vivre selon d'autres
    // lois que ceux qu'on regarde. Rien ne le signalerait à l'écran.
    const visible = { ...queryClient.getDefaultOptions().queries } as Record<string, unknown>
    const cache = { ...queryClientCache.getDefaultOptions().queries } as Record<string, unknown>
    delete visible.refetchOnWindowFocus
    delete cache.refetchOnWindowFocus
    expect(cache).toEqual(visible)
  })

  it('les défauts de MUTATION ne divergent pas non plus', () => {
    expect(queryClientCache.getDefaultOptions().mutations)
      .toEqual(queryClient.getDefaultOptions().mutations)
  })

  it('les réglages qui protègent d’un `navigator.onLine` coincé sont sur les deux', () => {
    // `networkMode: 'always'` : Chrome rapporte parfois « hors ligne » après une
    // veille ou une bascule WiFi↔4G, et le drapeau peut rester coincé — les
    // requêtes resteraient en pause, sur des squelettes éternels, sans erreur.
    for (const c of [queryClient, queryClientCache]) {
      expect(c.getDefaultOptions().queries?.networkMode).toBe('always')
      expect(c.getDefaultOptions().mutations?.networkMode).toBe('always')
    }
  })
})

describe('clientArrierePlan — dérivé de l’hôte, jamais imposé', () => {
  it('⛔ respecte les réglages de l’HÔTE, il ne les remplace pas', () => {
    // Le défaut visé : un second client exporté en dur écraserait celui du banc
    // `/dev/crm` (retry désactivé, fixtures) — un écran caché y serait passé
    // sous les réglages de la production, sans qu'une ligne le dise.
    const hote = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 42 } } })
    const jumeau = clientArrierePlan(hote)
    expect(jumeau.getDefaultOptions().queries?.retry).toBe(false)
    expect(jumeau.getDefaultOptions().queries?.staleTime).toBe(42)
    expect(jumeau.getDefaultOptions().queries?.refetchOnWindowFocus).toBe(false)
    expect(jumeau.getQueryCache()).toBe(hote.getQueryCache())
  })

  it('⚠ un seul jumeau par hôte — sinon chaque rendu s’abonnerait au focus', () => {
    const hote = new QueryClient()
    expect(clientArrierePlan(hote)).toBe(clientArrierePlan(hote))
  })

  it('deux hôtes différents ont deux jumeaux différents', () => {
    expect(clientArrierePlan(new QueryClient())).not.toBe(clientArrierePlan(new QueryClient()))
  })
})
