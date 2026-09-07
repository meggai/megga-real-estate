/**
 * Ce que TOUTES les bandes d'onglets doivent voir PAREIL.
 *
 * ⛔ IL Y A PLUSIEURS BANDES MONTÉES À LA FOIS, et c'est par conception :
 * `EcransVivants` garde trois écrans vivants, chaque écran porte son propre
 * chrome (`CrmWorkspace`), donc trois `CrmTabsBar` — une seule visible. Deux
 * valeurs de cette barre ne sont pourtant pas des états d'ÉCRAN mais des états
 * de la BANDE : la largeur mesurée de la piste, et le cadrage de la fenêtre
 * glissante. Les laisser en `useState` dans le composant les rend
 * per-instance, donc divergents — et la divergence se voit à chaque bascule.
 *
 * ── LES DEUX DÉFAUTS QUE CE MODULE RETIRE ────────────────────────────────────
 * Mesurés le 7 septembre 2026 sur `/dev/crm`, 15 onglets ouverts :
 *
 *  1. **La bande tombait à UNE puce le temps d'un commit.** Une barre qui vient
 *     de se monter démarre à `largeur = 0`, donc `vis = 1` : elle rend
 *     « Aujourd'hui  +14 », puis la mesure arrive et elle repasse à neuf puces.
 *     Piste relevée à 1440 px : **1166 → 94 → 1166**. Ce n'est pas un cas de
 *     bord : avec dix à quinze onglets et trois écrans vivants, ONZE bascules
 *     sur quatorze montent un écran neuf, donc une barre neuve.
 *  2. **Le cadrage sautait de six rangs.** Ce `vis = 1` ne fait pas que
 *     clignoter, il POISONNE le cadrage : `crmVisibleWindow(15, 8, 1, 0)` rend
 *     `debut = 8`, que la barre range dans son état ; la vraie largeur arrive
 *     (`vis = 9`), la fenêtre repart de 8 et se borne à 6 — la bande affiche
 *     **6..14** là où elle affichait **0..8** une frame plus tôt, alors que
 *     l'onglet visé (le 8) y était DÉJÀ visible. Les puces glissent sous le
 *     curseur pour rien.
 *
 * Même cause pour les deux — une barre neuve ne sait pas ce que savait celle
 * qu'elle remplace — donc même correctif : la valeur vit ICI, au-dessus des
 * instances, et survit au montage comme au démontage.
 *
 * ⚠ PARTAGER EST LÉGITIME PARCE QUE LA GÉOMÉTRIE EST LA MÊME. Les écrans cachés
 * sont en `visibility: hidden`, jamais `display: none` (cf. `EcranVivant`) :
 * ils gardent leur boîte, leurs bandes occupent la même piste et mesureraient
 * de toute façon la même chose. Ce module ne fait pas coïncider trois valeurs
 * qui pourraient légitimement différer, il cesse d'en fabriquer trois.
 *
 * ⚠ CE N'EST PAS DE L'ÉTAT D'ONGLET. Rien d'ici n'entre dans la tranche `ui`
 * d'un onglet ni ne part au serveur : c'est de la géométrie d'écran, elle se
 * remesure au prochain montage. D'où un module à part plutôt qu'un champ de
 * `CrmTabsState`.
 */

import { useSyncExternalStore } from 'react'

export interface CrmStripView {
  /**
   * Largeur RÉELLEMENT disponible pour les puces — la piste occupée plus la
   * place encore libre à sa droite. `0` tant que rien n'a été mesuré.
   *
   * ⚠ Elle ne dépend PAS du nombre de puces rendues : la piste rétrécit quand
   * l'espace vide grandit, et c'est leur SOMME qu'on garde. Mesuré : 854 + 426
   * avec huit puces, 1206 + 74 avec quinze — 1280 dans les deux cas. C'est ce
   * qui rend la valeur partageable entre des barres qui n'affichent pas le même
   * nombre de puces.
   */
  largeur: number
  /** Premier rang NON ÉPINGLÉ affiché — le cadrage de la fenêtre glissante. */
  debut: number
}

let vue: CrmStripView = { largeur: 0, debut: 0 }

const abonnes = new Set<() => void>()

function emettre(): void {
  for (const notifier of abonnes) notifier()
}

/** L'instantané courant — la même référence tant que rien n'a bougé. */
export function crmStripView(): CrmStripView {
  return vue
}

/**
 * Range la largeur mesurée.
 *
 * ⚠ Court-circuit sur l'égalité, comme le faisait le `setState` qu'il remplace :
 * une largeur stable ne doit provoquer aucun rendu, sans quoi la mesure et le
 * rendu s'entretiennent.
 */
export function setCrmStripLargeur(largeur: number): void {
  if (largeur === vue.largeur) return
  vue = { ...vue, largeur }
  emettre()
}

/**
 * Range le cadrage corrigé par `crmVisibleWindow`.
 *
 * ⚠ Il n'y a PAS de `reset()` exporté, et c'est délibéré : il n'aurait eu qu'un
 * appelant, la suite de tests, et un export que seul un test consomme est un
 * export mort pour `lint:deadcode`. Un module-scope survit d'un cas à l'autre —
 * la suite remet donc les deux valeurs à zéro par ces deux setters, qui sont
 * l'API que le composant emploie de toute façon.
 */
export function setCrmStripDebut(debut: number): void {
  if (debut === vue.debut) return
  vue = { ...vue, debut }
  emettre()
}

function abonner(notifier: () => void): () => void {
  abonnes.add(notifier)
  return () => { abonnes.delete(notifier) }
}

/** La vue partagée, abonnée. Toutes les barres montées lisent la même. */
export function useCrmStripView(): CrmStripView {
  return useSyncExternalStore(abonner, crmStripView, crmStripView)
}
