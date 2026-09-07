/**
 * Le MODÈLE des onglets du CRM — les invariants que la référence de design pose
 * en capitales, éprouvés un par un.
 *
 * ⚠ Ce fichier ne teste QUE `src/lib/crmTabs.ts` : des fonctions pures, sans
 * React ni réseau. Les mécanismes qui vivent dans le composant (le seuil de 4 px
 * du glisser, le portage des menus, la fenêtre de silence après un glisser) ne
 * s'éprouvent qu'à l'écran et ne sont pas ici — dire le contraire ferait une
 * suite verte qui ne mesure pas ce qu'elle prétend.
 */

import { describe, it, expect } from 'vitest'
import {
  CRM_TABS_CAP, crmApplyCap, crmApplyLabels, crmChipMaxWidth, crmChipMinWidth, crmCloseOthers,
  crmEcransVivants, CRM_FERMES_CAP, crmPushFerme, crmTabLibelle,
  crmCloseTab, crmDragBounds, crmDuplicateTab, crmMakeTab, crmMoveTab, crmPinnedCount,
  crmResolveActive, crmTabFallbackPath, crmTabRecordRef, crmTabRefs,
  crmTogglePin, crmVisibleWindow, type CrmTab,
} from '@/lib/crmTabs'
import { CRM_NEW_TAB_PATH } from '@/components/crm/crmSidebarNav'

/** Fabrique lisible — l'id est explicite, c'est lui qu'on suit dans les tests. */
function tab(id: string, path = '/dashboard', extra: Partial<CrmTab> = {}): CrmTab {
  return { id, path, search: '', section: null, ...extra }
}

describe('crmTabs — identité et repères', () => {
  it('deux onglets créés dans la même milliseconde ont des id DIFFÉRENTS', () => {
    // ⛔ La maquette identifie par `Date.now()` seul. Deux créations dans le même
    // tick (une duplication au clavier, un rétablissement de pile) porteraient
    // alors le même id, et l'actif se retrouverait sur le premier des deux.
    const a = crmMakeTab('/dashboard', '', 1_700_000_000_000)
    const b = crmMakeTab('/dashboard', '', 1_700_000_000_000)
    expect(a.id).not.toBe(b.id)
  })

  it("retrouve l'actif par son id, jamais par son rang", () => {
    const tabs = [tab('a'), tab('b'), tab('c')]
    expect(crmResolveActive(tabs, 'c')).toBe(2)
    // Le même id après un déplacement : le rang change, l'onglet non.
    const bouge = crmMoveTab(tabs, 2, 0)
    expect(crmResolveActive(bouge, 'c')).toBe(0)
  })

  it("retombe sur l'onglet VISÉ quand l'actif a disparu, puis sur 0", () => {
    const tabs = [tab('a'), tab('b')]
    expect(crmResolveActive(tabs, 'disparu', 'b')).toBe(1)
    expect(crmResolveActive(tabs, 'disparu', 'aussi-disparu')).toBe(0)
  })
})

describe('crmTabs — épinglage', () => {
  it('épingler REPOSITIONNE en fin de bloc épinglé', () => {
    const tabs = [tab('a', '/x', { pinned: true }), tab('b'), tab('c')]
    const apres = crmTogglePin(tabs, 2)
    expect(apres.map((t) => t.id)).toEqual(['a', 'c', 'b'])
    expect(apres[1].pinned).toBe(true)
    expect(crmPinnedCount(apres)).toBe(2)
  })

  it('détacher renvoie en FIN de barre', () => {
    const tabs = [tab('a', '/x', { pinned: true }), tab('b', '/y', { pinned: true }), tab('c')]
    const apres = crmTogglePin(tabs, 0)
    expect(apres.map((t) => t.id)).toEqual(['b', 'c', 'a'])
    expect(apres[2].pinned).toBe(false)
  })

  it('⛔ une puce épinglée ne se déplace PAS parmi les détachées', () => {
    // Les épinglés sont le PRÉFIXE de la pile : un glisser qui traverse la
    // frontière ferait de l'épinglage un attribut sans position, donc un bloc
    // épinglé qui n'est plus un bloc.
    const tabs = [tab('a', '/x', { pinned: true }), tab('b'), tab('c')]
    expect(crmMoveTab(tabs, 0, 2)).toBe(tabs) // refusé, même référence
    expect(crmMoveTab(tabs, 1, 0)).toBe(tabs) // refusé dans l'autre sens
  })
})

describe('crmTabs — duplication', () => {
  it("copie la tranche, prend une identité neuve, n'est jamais épinglée", () => {
    const tabs = [tab('a', '/dashboard/contacts/42', { pinned: true, ui: { pager: 1 } })]
    const apres = crmDuplicateTab(tabs, 0, 1_700_000_000_000)
    expect(apres).toHaveLength(2)
    expect(apres[1].id).not.toBe('a')
    expect(apres[1].pinned).toBe(false)
    expect(apres[1].path).toBe('/dashboard/contacts/42')
    expect(apres[1].ui).toEqual({ pager: 1 })
  })

  it('⚠ la tranche est COPIÉE, pas partagée — les deux onglets divergent', () => {
    const tabs = [tab('a', '/x', { ui: { filtre: 'tous' } })]
    const apres = crmDuplicateTab(tabs, 0, 1)
    expect(apres[1].ui).not.toBe(apres[0].ui)
  })

  it('la copie ne se glisse jamais AVANT la fin du bloc épinglé', () => {
    const tabs = [tab('a', '/x', { pinned: true }), tab('b', '/y', { pinned: true }), tab('c')]
    // On duplique le PREMIER épinglé : la copie est détachée, elle doit sortir du bloc.
    const apres = crmDuplicateTab(tabs, 0, 1)
    expect(apres.findIndex((t) => !t.pinned && t.id !== 'c')).toBeGreaterThanOrEqual(2)
  })
})

describe('crmTabs — fermeture', () => {
  it('⛔ le DERNIER onglet ne se ferme jamais', () => {
    expect(crmCloseTab([tab('a')], 0)).toBeNull()
  })

  it('« fermer les autres » garde la puce visée ET les épinglées', () => {
    const tabs = [tab('a', '/x', { pinned: true }), tab('b'), tab('c'), tab('d')]
    expect(crmCloseOthers(tabs, 2).map((t) => t.id)).toEqual(['a', 'c'])
  })
})

describe('crmTabs — débordement', () => {
  it("l'onglet actif est TOUJOURS visible, même hors fenêtre", () => {
    // 9 onglets, 6 créneaux, l'actif est le 8e : la bande défile jusqu'à lui.
    const { visibles, caches } = crmVisibleWindow(9, 7, 6)
    expect(visibles).toHaveLength(6)
    expect(visibles).toContain(7)
    expect(caches).not.toContain(7)
    expect(visibles.length + caches.length).toBe(9)
  })

  it('⛔ la fenêtre est CONTIGUË — plus de rang téléporté dans le dernier créneau', () => {
    // Le défaut mesuré à l'écran le 7 septembre 2026 : à 20 onglets et 9 créneaux,
    // la bande affichait `0,1,2,3,4,5,6,7,19`. La puce 19 se donnait pour la
    // voisine de la 7, et les rangs 8 à 18 n'étaient atteignables que par le menu.
    const { visibles } = crmVisibleWindow(20, 19, 9)
    expect(visibles).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19])
    for (let k = 1; k < visibles.length; k += 1) {
      expect(visibles[k]).toBe(visibles[k - 1] + 1)
    }
  })

  it('la bande se déplace du MINIMUM — elle ne se recentre pas à chaque clic', () => {
    // Cadrée sur [2,7], l'actif passe au rang 8 : un seul cran, pas un recentrage.
    expect(crmVisibleWindow(20, 8, 6, 2).debut).toBe(3)
    // Et vers la gauche, symétriquement : l'actif passe au rang 1.
    expect(crmVisibleWindow(20, 1, 6, 2).debut).toBe(1)
    // L'actif DANS la fenêtre ne la bouge pas d'un pixel.
    expect(crmVisibleWindow(20, 4, 6, 2).debut).toBe(2)
  })

  it('les ÉPINGLÉES ne défilent pas — une épingle qu’un défilement emporte n’épingle rien', () => {
    // 2 épinglées, 6 créneaux : elles gardent les deux premiers, les 4 autres défilent.
    const { visibles } = crmVisibleWindow(20, 19, 6, 0, 2)
    expect(visibles.slice(0, 2)).toEqual([0, 1])
    expect(visibles.slice(2)).toEqual([16, 17, 18, 19])
  })

  it('⚠ le créneau EMPRUNTÉ subsiste pour le seul cas insoluble : plus d’épingles que de créneaux', () => {
    // 8 épinglées, 6 créneaux, l'actif au rang 12. Le handoff exige que l'actif
    // soit visible ; 8 épingles et 1 actif ne tiennent pas dans 6 créneaux.
    const { visibles } = crmVisibleWindow(15, 12, 6, 0, 8)
    expect(visibles).toEqual([0, 1, 2, 3, 4, 12])
  })

  it('sans débordement, tout est visible et rien n’est caché', () => {
    const { visibles, caches } = crmVisibleWindow(4, 2, 6)
    expect(visibles).toEqual([0, 1, 2, 3])
    expect(caches).toEqual([])
  })

  it('la puce se resserre avec le nombre d’onglets, et cède 30 px au dock', () => {
    expect(crmChipMaxWidth(3, false)).toBe(240)
    expect(crmChipMaxWidth(5, false)).toBe(170)
    expect(crmChipMaxWidth(9, false)).toBe(128)
    expect(crmChipMaxWidth(3, true)).toBe(210)
  })

  it('⛔ le PLANCHER se resserre aussi — sinon la bande plafonne à huit puces', () => {
    // C'est lui qui décidait du plafond : figé à 100, il ne laissait tenir que 8
    // puces sur 1440, et le reste passait au menu alors que la place existait.
    expect(crmChipMinWidth(3)).toBe(100)
    expect(crmChipMinWidth(8)).toBe(100)
    expect(crmChipMinWidth(9)).toBe(76)
    expect(crmChipMinWidth(14)).toBe(76)
    expect(crmChipMinWidth(15)).toBe(60)
    expect(crmChipMinWidth(24)).toBe(60)
    // Il ne descend jamais sous 60 : en dessous, deux fiches de contact
    // deviennent indiscernables et la puce ne sert plus à rien.
    expect(crmChipMinWidth(999)).toBeGreaterThanOrEqual(60)
  })
})

describe('crmTabs — routes d’enregistrement', () => {
  it('reconnaît les cinq genres résolus par le serveur', () => {
    expect(crmTabRecordRef('/dashboard/contacts/abc')).toEqual({ kind: 'contact', id: 'abc' })
    expect(crmTabRecordRef('/dashboard/listings/xyz')).toEqual({ kind: 'property', id: 'xyz' })
    expect(crmTabRecordRef('/dashboard/transactions/d1')).toEqual({ kind: 'deal', id: 'd1' })
    expect(crmTabRecordRef('/dashboard/kyc/k1')).toEqual({ kind: 'kyc', id: 'k1' })
    expect(crmTabRecordRef('/dashboard/visits/v1')).toEqual({ kind: 'visit', id: 'v1' })
  })

  it('⚠ `listings/:id/edit` est lu comme un BIEN, pas comme un id « edit »', () => {
    // L'ordre des motifs porte cette garantie : le plus spécifique d'abord.
    expect(crmTabRecordRef('/dashboard/listings/xyz/edit')).toEqual({ kind: 'property', id: 'xyz' })
  })

  it('⛔ « new » n’est pas un identifiant', () => {
    // Sinon l'onglet « Nouveau contact » ressortirait en `missing` au premier
    // chargement et retomberait sur la liste, en pleine saisie.
    expect(crmTabRecordRef('/dashboard/contacts/new')).toBeNull()
    expect(crmTabRecordRef('/dashboard/listings/new')).toBeNull()
  })

  it('une liste n’est pas une fiche', () => {
    expect(crmTabRecordRef('/dashboard/contacts')).toBeNull()
    expect(crmTabRecordRef('/dashboard')).toBeNull()
  })

  it('chaque fiche connaît la liste sur laquelle elle retombe', () => {
    expect(crmTabFallbackPath('/dashboard/contacts/abc')).toBe('/dashboard/contacts')
    expect(crmTabFallbackPath('/dashboard/transactions/d1')).toBe('/dashboard/pipeline')
    expect(crmTabFallbackPath('/dashboard/visits/v1')).toBe('/dashboard/calendar')
  })

  it('dédoublonne les références envoyées au serveur', () => {
    // La résolution serveur est bornée à 24 entrées : douze duplications d'une
    // même fiche satureraient la borne et affameraient les autres onglets.
    const tabs = [
      tab('a', '/dashboard/contacts/42'),
      tab('b', '/dashboard/contacts/42'),
      tab('c', '/dashboard/listings/7'),
      tab('d', '/dashboard'),
    ]
    expect(crmTabRefs(tabs)).toEqual([
      { kind: 'contact', id: '42' },
      { kind: 'property', id: '7' },
    ])
  })
})

describe('crmTabs — verdict du serveur sur les libellés', () => {
  it('pose le libellé résolu', () => {
    const tabs = [tab('a', '/dashboard/contacts/42')]
    expect(crmApplyLabels(tabs, { 42: 'Marie Dupont' }, [])[0].label).toBe('Marie Dupont')
  })

  it('⛔ un enregistrement DISPARU retombe sur sa liste — il ne ferme pas l’onglet', () => {
    // Fermer effacerait un onglet que l'agent avait gardé ouvert, sans qu'il
    // sache pourquoi. Le handoff tranche : la vue liste, jamais un écran d'erreur.
    const tabs = [tab('a', '/dashboard/contacts/42', { label: 'Marie Dupont' })]
    const apres = crmApplyLabels(tabs, {}, ['42'])
    expect(apres).toHaveLength(1)
    expect(apres[0].path).toBe('/dashboard/contacts')
    expect(apres[0].label).toBeUndefined()
  })

  it('ne touche pas aux onglets qui ne visent aucun enregistrement', () => {
    const tabs = [tab('a', '/dashboard/pipeline')]
    expect(crmApplyLabels(tabs, { 42: 'X' }, ['99'])[0]).toBe(tabs[0])
  })
})

describe('crmTabs — plafond', () => {
  it('ferme les plus anciens NON épinglés au-delà du plafond', () => {
    const tabs = Array.from({ length: CRM_TABS_CAP + 3 }, (_, i) => tab(`t${i}`))
    const apres = crmApplyCap(tabs, `t${CRM_TABS_CAP + 2}`)
    expect(apres).toHaveLength(CRM_TABS_CAP)
    // Les trois plus anciens sont partis, l'actif est resté.
    expect(apres.find((t) => t.id === 't0')).toBeUndefined()
    expect(apres.find((t) => t.id === `t${CRM_TABS_CAP + 2}`)).toBeDefined()
  })

  it('⚠ ne trahit JAMAIS une épingle, quitte à dépasser le plafond', () => {
    // Le CHECK serveur est à 24 aussi : ce cas ne peut donc pas casser l'écriture.
    const tabs = Array.from({ length: CRM_TABS_CAP + 2 }, (_, i) => tab(`t${i}`, '/x', { pinned: true }))
    expect(crmApplyCap(tabs, 't0')).toHaveLength(CRM_TABS_CAP + 2)
  })

  it('sous le plafond, rend la MÊME référence (aucun rendu inutile)', () => {
    const tabs = [tab('a'), tab('b')]
    expect(crmApplyCap(tabs, 'a')).toBe(tabs)
  })
})

describe('crmTabs — bornes du glisser à grand nombre', () => {
  const jamaisEpingle = () => false

  it('⛔ NE LAISSE PAS DÉPOSER sur le créneau EMPRUNTÉ par l’actif', () => {
    // 15 onglets, actif au rang 12 : la barre montre [0,1,2,3,4,12]. Le dernier
    // créneau n'est pas « la position 6 », c'est un siège emprunté. Sans cette borne,
    // tirer d'UN cran (créneau 4 → 5) déplaçait la puce de HUIT rangs (4 → 12) et la
    // faisait sortir du champ visible — mesuré le 4 septembre 2026.
    const rangs = [0, 1, 2, 3, 4, 12]
    expect(crmDragBounds(rangs, 4, jamaisEpingle)).toEqual({ lo: 0, hi: 4 })
    // Et depuis le siège emprunté lui-même, il n'y a nulle part où aller.
    expect(crmDragBounds(rangs, 5, jamaisEpingle)).toEqual({ lo: 5, hi: 5 })
  })

  it('laisse tout le champ quand la fenêtre est contiguë', () => {
    expect(crmDragBounds([0, 1, 2, 3, 4, 5], 2, jamaisEpingle)).toEqual({ lo: 0, hi: 5 })
  })

  it('⚠ s’arrête à la frontière du bloc épinglé', () => {
    // Rangs 0-1 épinglés, 2-5 non : une puce détachée ne remonte pas dans le bloc.
    const epingle = (rang: number) => rang < 2
    expect(crmDragBounds([0, 1, 2, 3, 4, 5], 3, epingle)).toEqual({ lo: 2, hi: 5 })
    expect(crmDragBounds([0, 1, 2, 3, 4, 5], 0, epingle)).toEqual({ lo: 0, hi: 1 })
  })
})

describe('crmTabs — le régime à GRAND NOMBRE', () => {
  it('mémorise la pile ENTIÈRE, pas la fenêtre visible', () => {
    // La question posée par Julien : « si on ouvre une quinzaine d'onglets, il faut
    // que tout ça soit mémorisé aussi ». `crmVisibleWindow` ne sert QU'À l'affichage :
    // elle rend des INDEX, jamais une pile tronquée.
    const { visibles, caches } = crmVisibleWindow(15, 14, 6)
    expect(visibles).toHaveLength(6)
    expect(caches).toHaveLength(9)
    // Aucun index n'est perdu entre les deux : la pile reste entière.
    expect([...visibles, ...caches].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 15 }, (_, i) => i),
    )
  })

  it('⚠ au-delà de six ÉPINGLÉS, certains passent au menu — limite assumée', () => {
    // Avec 8 épinglés et 6 créneaux, les épinglés 5-7 tombent dans le « +N ». Ce n'est
    // pas un défaut réparable : le handoff impose que l'ACTIF soit toujours visible, et
    // 8 épingles + 1 actif ne tiennent pas dans 6 créneaux. Les épinglés gardent la
    // priorité (ils sont le préfixe) ; au-delà de la capacité, quelque chose doit céder.
    const { visibles, caches } = crmVisibleWindow(15, 12, 6, 0, 8)
    expect(visibles).toEqual([0, 1, 2, 3, 4, 12])
    expect(caches.filter((i) => i < 8)).toEqual([5, 6, 7])
  })
})

describe('crmTabs — les écrans qui restent VIVANTS', () => {
  const pile = [tab('a'), tab('b'), tab('c'), tab('d'), tab('e')]

  it("l'actif en est TOUJOURS, même absent de la récence", () => {
    expect(crmEcransVivants(pile, 'd', [], 3).map((t) => t.id)).toEqual(['d'])
  })

  it('la récence décide de qui reste, dans la limite du plafond', () => {
    const ids = crmEcransVivants(pile, 'a', ['c', 'e', 'b'], 3).map((t) => t.id)
    // gardés : a (actif) + c + e — b tombe, il est le quatrième par récence.
    expect(ids).toContain('a')
    expect(ids).toContain('c')
    expect(ids).toContain('e')
    expect(ids).not.toContain('b')
  })

  it("⛔ mais l'ORDRE DE RENDU est celui de la PILE, jamais celui de la récence", () => {
    // Le défaut mesuré le 7 septembre 2026 : trier par récence remettait l'actif
    // en tête à chaque bascule, donc réordonnait les enfants — 560 éléments
    // détachés puis réinsérés par clic, et les effets du sous-arbre rejoués.
    const ids = crmEcransVivants(pile, 'e', ['c', 'a'], 3).map((t) => t.id)  // ORDRE
    expect(ids).toEqual(['a', 'c', 'e'])
  })

  it("l'ordre ne bouge pas quand l'actif change au sein du même ensemble", () => {
    const avant = crmEcransVivants(pile, 'a', ['b', 'c'], 3).map((t) => t.id)
    const apres = crmEcransVivants(pile, 'c', ['a', 'b'], 3).map((t) => t.id)
    expect(avant).toEqual(apres)
  })

  it('un plafond de 1 (mobile) ne garde que l’actif', () => {
    expect(crmEcransVivants(pile, 'b', ['a', 'c'], 1).map((t) => t.id)).toEqual(['b'])
  })

  it('sans actif, aucun écran — il n’y a rien à garder vivant', () => {
    expect(crmEcransVivants(pile, undefined, ['a', 'b'], 3)).toEqual([])
  })

  /**
   * ⛔ CE QUE COÛTE UN PLAFOND TROP BAS, compté au lieu d'être supposé.
   *
   * Le plafond est passé de 3 à 6 le 7 septembre 2026 (décision Julien), sur ce
   * calcul-ci : Julien travaille à dix ou quinze onglets ouverts, et fait des
   * allers-retours dans un GROUPE DE TRAVAIL — cinq ou six onglets, pas deux.
   * Un plafond de 3 ne peut pas garder un groupe de 6 : chaque onglet qu'on
   * rouvre a déjà été évincé, et l'écran est reconstruit (état local perdu,
   * requêtes rejouées). La simulation ci-dessous rejoue le geste et compte les
   * reconstructions — c'est un oracle reproductible, là où la mesure à l'écran
   * dépend d'un volet d'aperçu et d'un ordonnanceur.
   */
  function reconstructions(idsGroupe: string[], tours: number, max: number): number {
    const tabsGroupe = idsGroupe.map((id) => tab(id))
    let recents: string[] = []
    let vivants = new Set<string>()
    let n = 0
    for (let k = 0; k < idsGroupe.length * tours; k++) {
      const actif = idsGroupe[k % idsGroupe.length]
      if (!vivants.has(actif)) n += 1
      // Même règle que `EcransVivants` : la récence décide de l'appartenance.
      recents = [actif, ...recents.filter((x) => x !== actif)].slice(0, max)
      vivants = new Set(crmEcransVivants(tabsGroupe, actif, recents, max).map((t) => t.id))
    }
    return n
  }

  it('⛔ un plafond de 3 ne garde AUCUN groupe de travail de six', () => {
    const groupe = ['a', 'b', 'c', 'd', 'e', 'f']
    // 24 bascules : l'onglet visé a toujours été évincé entre-temps.
    expect(reconstructions(groupe, 4, 3)).toBe(24)
  })

  it('✅ un plafond de 6 ne paie que le PREMIER passage', () => {
    const groupe = ['a', 'b', 'c', 'd', 'e', 'f']
    // 6 sur 24 : le tour de chauffe, puis plus rien — 100 % → 25 %.
    expect(reconstructions(groupe, 4, 6)).toBe(6)
  })

  it('⚠ et il ne promet rien au-delà de son propre nombre', () => {
    // Sept onglets en rotation dans six créneaux : on revient toujours sur le
    // seul qui vient d'être évincé. Le plafond déplace la limite, il ne
    // l'efface pas — c'est pourquoi 24 onglets vivants restent exclus.
    const sept = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
    expect(reconstructions(sept, 4, 6)).toBe(28)
  })
})

describe('crmTabs — la pile des onglets FERMÉS', () => {
  it('empile le plus récent en TÊTE — c’est lui que ⇧-Alt-T rouvre', () => {
    const p1 = crmPushFerme([], tab('a', '/dashboard/contacts/1'))
    const p2 = crmPushFerme(p1, tab('b', '/dashboard/listings/2'))
    expect(p2.map((t) => t.id)).toEqual(['b', 'a'])
  })

  it('⚠ dédoublonne par EMPLACEMENT, pas par id', () => {
    // L'id est neuf à chaque ouverture : fermer trois fois la même fiche
    // remplirait sinon trois des dix places avec le même endroit.
    const p = ['x', 'y', 'z'].reduce(
      (acc, id) => crmPushFerme(acc, tab(id, '/dashboard/contacts/1')),
      [] as CrmTab[],
    )
    expect(p).toHaveLength(1)
    expect(p[0].id).toBe('z')
  })

  it('le `search` fait partie de l’emplacement — deux vues d’un même écran cohabitent', () => {
    const a = crmPushFerme([], tab('a', '/dashboard/settings', { search: '?tab=profil' }))
    const b = crmPushFerme(a, tab('b', '/dashboard/settings', { search: '?tab=securite' }))
    expect(b).toHaveLength(2)
  })

  it('ne dépasse jamais son plafond', () => {
    let p: CrmTab[] = []
    for (let i = 0; i < CRM_FERMES_CAP + 5; i += 1) p = crmPushFerme(p, tab(`t${i}`, `/dashboard/contacts/${i}`))
    expect(p).toHaveLength(CRM_FERMES_CAP)
    // Et ce sont les plus RÉCENTS qui restent.
    expect(p[0].id).toBe(`t${CRM_FERMES_CAP + 4}`)
  })
})

describe('crmTabs — le libellé affiché', () => {
  const tr = (cle: string) => cle

  it('le nom résolu par le serveur gagne sur tout le reste', () => {
    expect(crmTabLibelle(tab('a', '/dashboard/contacts/1', { label: 'Marie Dupont', section: 'contacts' }), tr))
      .toBe('Marie Dupont')
  })

  it('sinon la clé i18n de la SECTION — celle de la barre latérale, pas une copie', () => {
    expect(crmTabLibelle(tab('a', '/dashboard/listings', { section: 'biens' }), tr)).toBe('nav.listings')
    expect(crmTabLibelle(tab('b', '/dashboard/journey', { section: 'parcours' }), tr)).toBe('nav.journey')
  })

  it('la page d’accueil d’onglet a son nom à elle, jamais le repli', () => {
    expect(crmTabLibelle(tab('a', CRM_NEW_TAB_PATH), tr)).toBe('tabs.new')
  })

  it('et un chemin qu’on ne sait pas nommer retombe sur le repli', () => {
    expect(crmTabLibelle(tab('a', '/dashboard/inconnu'), tr)).toBe('tabs.untitled')
  })
})
