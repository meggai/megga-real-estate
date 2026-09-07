/**
 * Host de la recherche immersive — le VOILE, celui qui se pose par-dessus l'écran.
 *
 * Monté une seule fois dans `AgentLayout`. Il s'ouvre par ⌘/Ctrl+K, ou par
 * l'événement `megga:open-search`. Le composant lourd (et ses requêtes) n'est
 * monté que lorsqu'il est ouvert.
 *
 * ── ⌘K NE L'OUVRE PLUS SUR LE BUREAU (7 septembre 2026, décision Julien) ─────
 * « Comme on ouvre un onglet, on a déjà la recherche » : la page d'onglet neuf
 * rend `CrmSearch` DANS son corps, champ focalisé, depuis la refonte du même
 * jour. Un voile flottant par-dessus faisait un second chemin vers la même
 * chose — et c'est précisément le pop-up dont cette refonte devait sortir. ⌘K
 * ouvre donc un onglet neuf, et la recherche y est.
 *
 * ⛔ MAIS LE VOILE RESTE, ET IL N'EST PAS VESTIGIAL — LE CRM MOBILE N'A PAS
 * D'ONGLETS. Sa pilule à cinq destinations tient lieu de barre, il n'y a ni
 * bande d'onglets ni page « Nouvel onglet » : y couper le voile retirerait la
 * recherche du téléphone, `MmMatchingScreen` compris, qui l'appelle par
 * l'événement. La bascule est donc sur `useIsMobile()`, pas sur une suppression.
 *
 * ⚠ Et l'ÉVÉNEMENT ouvre toujours le voile, sur les deux surfaces : il n'a plus
 * qu'un émetteur, l'écran Matching mobile. Un appelant qui demande explicitement
 * la palette doit l'obtenir — c'est le raccourci global, et lui seul, qui change
 * de destination.
 */

import { useEffect, useRef, useState } from 'react'
import CrmSearch from './CrmSearch'
import { OPEN_SEARCH_EVENT, paletteEnPlaceMontee } from './openSearch'
import { useCrmTabsOptionnel } from '@/hooks/useCrmTabs'
import { useIsMobile } from '@/hooks/useMediaQuery'

export default function CrmSearchHost() {
  const [open, setOpen] = useState(false)
  const tabs = useCrmTabsOptionnel()
  const isMobile = useIsMobile()
  /**
   * ⚠ Par une ref, et non par les dépendances de l'effet : l'écouteur clavier
   * est global et ne doit pas se ré-attacher à chaque rendu du fournisseur
   * d'onglets. La ref est réécrite APRÈS chaque rendu — écrire une ref PENDANT
   * le rendu est refusé par `react-hooks/refs`, et c'est l'idiome que
   * `CrmTabsBar` emploie déjà pour ses gestes de glisser.
   */
  const ouvrirOnglet = useRef<(() => void) | null>(null)
  useEffect(() => {
    ouvrirOnglet.current = !isMobile && tabs ? tabs.ouvrirNouvel : null
  })
  // Amorce venue de l'émetteur (aujourd'hui : le champ du nouvel onglet).
  // ⚠ Elle n'a de sens qu'à l'OUVERTURE : `CrmSearch` est démonté quand la
  // palette est fermée, donc il relit cette valeur à chaque montage — c'est
  // exactement ce qu'on veut, et c'est ce qui évite de la remettre à zéro à la
  // fermeture (personne ne la lit plus).
  const [amorce, setAmorce] = useState('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        // ⚠ Une palette est déjà rendue DANS la page (page d'accueil d'onglet) :
        // ni voile ni onglet neuf — elle se charge de reprendre le focus. Ce
        // test passe AVANT le reste, sinon ⌘K sur un onglet neuf en ouvrirait
        // un second pour arriver à la recherche qui est déjà sous les yeux.
        if (paletteEnPlaceMontee()) return
        // Bureau : la recherche est dans la page d'onglet neuf, ⌘K y mène.
        if (ouvrirOnglet.current) { ouvrirOnglet.current(); return }
        // Mobile (ou hors fournisseur d'onglets) : le voile, comme avant.
        // ⚠ L'amorce est REMISE À ZÉRO ici, sans quoi un ⌘K rouvrirait la
        // palette pré-remplie avec ce que l'agent avait tapé dans un nouvel
        // onglet une heure plus tôt. Le raccourci global n'amorce rien.
        setAmorce('')
        setOpen(prev => !prev)
      }
    }
    const onOpen = (e: Event) => {
      const q = (e as CustomEvent<{ query?: string }>).detail?.query
      setAmorce(typeof q === 'string' ? q : '')
      setOpen(true)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener(OPEN_SEARCH_EVENT, onOpen)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener(OPEN_SEARCH_EVENT, onOpen)
    }
  }, [])

  if (!open) return null
  return <CrmSearch open={open} amorce={amorce} onClose={() => setOpen(false)} />
}
