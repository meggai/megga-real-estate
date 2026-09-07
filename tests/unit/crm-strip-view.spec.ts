/**
 * La vue PARTAGÉE de la bande d'onglets, et le défaut qu'elle retire.
 *
 * Trois barres sont montées en même temps (un `CrmWorkspace` par écran vivant),
 * une seule visible. Ce fichier éprouve les deux valeurs qui ne sont pas des
 * états d'écran mais des états de la bande — la largeur mesurée et le cadrage —
 * et la SÉQUENCE qui les faisait diverger d'une barre à l'autre.
 *
 * ⚠ Ce fichier ne monte aucun composant : le store est du JavaScript nu, et la
 * séquence se rejoue sur `crmVisibleWindow`, qui est pure. Le clignotement
 * lui-même (une frame peinte à une puce) ne s'observe qu'à l'écran et n'est
 * donc pas ici — il est mesuré dans `/dev/crm`, pas assené par un test vert.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  crmStripView, setCrmStripDebut, setCrmStripLargeur,
} from '@/lib/crmStripView'
import { crmVisibleWindow } from '@/lib/crmTabs'

describe('crmStripView — une seule vue pour toutes les bandes montées', () => {
  // ⚠ Le store est un module-scope : il survit d'un cas à l'autre, et sans cette
  // remise à zéro un cas qui pose une largeur la lègue au suivant, qui passerait
  // alors pour la mauvaise raison. Par les setters, et non par un `reset()`
  // exporté : un export que seul un test consomme est mort pour `lint:deadcode`.
  beforeEach(() => { setCrmStripLargeur(0); setCrmStripDebut(0) })

  it('démarre à zéro : rien n’a encore été mesuré', () => {
    expect(crmStripView()).toEqual({ largeur: 0, debut: 0 })
  })

  it('une barre neuve hérite de ce qu’a mesuré celle qu’elle remplace', () => {
    // La barre de l'écran qu'on quitte a mesuré sa piste…
    setCrmStripLargeur(1280)
    setCrmStripDebut(6)
    // …celle de l'écran qui arrive lit la MÊME chose, avant d'avoir rien mesuré.
    expect(crmStripView()).toEqual({ largeur: 1280, debut: 6 })
  })

  it('une écriture identique ne change pas l’instantané — donc ne rend rien', () => {
    setCrmStripLargeur(1280)
    const avant = crmStripView()
    setCrmStripLargeur(1280)
    // Même RÉFÉRENCE : `useSyncExternalStore` compare par identité, un objet
    // neuf à valeur égale rendrait les trois barres à chaque mesure stable.
    expect(crmStripView()).toBe(avant)
  })

  it('une écriture différente rend un instantané neuf', () => {
    setCrmStripLargeur(1280)
    const avant = crmStripView()
    setCrmStripLargeur(1100)
    expect(crmStripView()).not.toBe(avant)
    expect(crmStripView().largeur).toBe(1100)
  })

  it('les deux valeurs sont indépendantes — poser l’une garde l’autre', () => {
    setCrmStripLargeur(1280)
    setCrmStripDebut(6)
    setCrmStripLargeur(1100)
    expect(crmStripView()).toEqual({ largeur: 1100, debut: 6 })
  })
})

describe('cadrage — la séquence qui déplaçait la bande de six rangs', () => {
  /**
   * ⛔ LE DÉFAUT, REJOUÉ SUR LES CHIFFRES MESURÉS. 15 onglets, 820 px, l'actif
   * au rang 8, neuf créneaux. La barre qui vient de se monter n'a pas encore
   * mesuré sa piste : `largeur` vaut 0, donc `vis` retombe sur son plancher, 1.
   */
  const TOTAL = 15
  const ACTIF = 8
  const VIS_MESURE = 9
  const VIS_NON_MESURE = 1

  it('une barre NON mesurée réclame un cadrage qui n’a de sens qu’à une puce', () => {
    const provisoire = crmVisibleWindow(TOTAL, ACTIF, VIS_NON_MESURE, 0, 0)
    expect(provisoire.visibles).toEqual([ACTIF])
    // C'est ce 8 qui empoisonnait tout : il est juste POUR UNE PUCE, et faux
    // pour la bande réelle.
    expect(provisoire.debut).toBe(8)
  })

  it('RANGER ce cadrage déplace la bande alors que l’actif y était déjà', () => {
    const provisoire = crmVisibleWindow(TOTAL, ACTIF, VIS_NON_MESURE, 0, 0)
    const empoisonne = crmVisibleWindow(TOTAL, ACTIF, VIS_MESURE, provisoire.debut, 0)
    // 6..14 — exactement ce qu'on relevait à l'écran, pour un clic sur le rang 8.
    expect(empoisonne.visibles).toEqual([6, 7, 8, 9, 10, 11, 12, 13, 14])
  })

  it('le cadrage PARTAGÉ, lui, ne bouge pas : l’actif est déjà dans la fenêtre', () => {
    // Le cadrage que portait la barre de l'écran qu'on quitte.
    const sain = crmVisibleWindow(TOTAL, ACTIF, VIS_MESURE, 0, 0)
    expect(sain.visibles).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8])
    expect(sain.debut).toBe(0)
  })

  it('le défilement minimal reste intact quand l’actif sort VRAIMENT du champ', () => {
    // Rien de tout ceci ne doit figer la bande : viser le rang 12 depuis un
    // cadrage à 0 la fait bien glisser — du minimum, et pas d'un rang de plus.
    const glisse = crmVisibleWindow(TOTAL, 12, VIS_MESURE, 0, 0)
    expect(glisse.debut).toBe(4)
    expect(glisse.visibles).toEqual([4, 5, 6, 7, 8, 9, 10, 11, 12])
  })
})
