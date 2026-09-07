/**
 * CrmTabsBar — la barre d'onglets du CRM, en tête de la zone de travail.
 *
 * Port de la référence de design « Onglets » (maquette ERP dentaire) sur les
 * jetons MEGGA X. Six mécanismes, tous ici : la puce, la bascule, le glisser pour
 * réordonner, le clic droit, le débordement « +N », les badges.
 *
 * ── CE QU'ELLE N'EST PAS ─────────────────────────────────────────────────────
 * Ce n'est pas une navigation par onglets. La barre latérale porte les dix
 * destinations ; ici chaque puce est un CONTEXTE OUVERT — deux fiches contact
 * côte à côte, chacune avec sa position d'écran. Le modèle vit dans
 * `src/lib/crmTabs.ts`, l'état dans `useCrmTabs`.
 *
 * ── TROIS ÉCARTS ASSUMÉS À LA MAQUETTE, CHACUN MESURÉ ────────────────────────
 * 1. **Géométrie arrondie aux barreaux.** La maquette demande 6 px et 14 px de
 *    padding, un rayon de ligne à 11 px, un texte à 12,5 px. Le cliquet de
 *    grammaire n'accorde à la zone `src/components/crm` que DEUX littéraux de
 *    rayon/espacement au total, et ils sont déjà pris par `LiquidGlassRail`.
 *    Tout passe donc par `var(--crm-space-*)` / `var(--crm-radius-*)`, arrondi au
 *    barreau — exactement ce que la barre latérale a fait de ses 28/22/26/14/11.
 *    Le texte descend à `--crm-text-sm` (12 px) : ajouter un 14ᵉ barreau de taille
 *    est refusé par une prétention de sévérité « dure ».
 * 2. **Badge à 11 px / 600, pas 10 px / 700.** La graisse ≥ 700 et les tailles
 *    hors échelle sont refusées par le même cliquet. `--crm-text-xs` est le
 *    barreau du badge dans tout le CRM.
 * 3. **Pas d'ombre.** La maquette n'en pose pas non plus ; en clair, la puce
 *    active se détache par son APLAT d'accent, en sombre par sa bordure.
 *
 * ── ET UN ÉCART QUI N'EN EST PAS UN : L'ACCENT ───────────────────────────────
 * La maquette peint la puce active en « posée sur un fond » (blanc sur gris).
 * MEGGA X peint l'élément ACTIF en accent (décision Julien du 10 août 2026), et
 * la table de report du handoff le dit aussi pour le badge. La puce active est
 * donc un aplat `sp.accent` sous encre `sp.accentInk` — 5,78:1, mesuré.
 * ⛔ Jamais un LIBELLÉ en accent sur fond sombre : l'accent y rend 3,44:1, sous
 * l'AA. C'est l'aplat qui porte, pas l'encre.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import type { CrmPalette } from './tokens'
import { MXC_SYSTEM, encreSur } from '@/components/megga-x-crm/tokens'
import { useCrmTabs, useCrmTabBadges } from '@/hooks/useCrmTabs'
import { crmChipMaxWidth, crmChipMinWidth, crmDragBounds, crmPinnedCount, crmTabLibelle, crmVisibleWindow, type CrmTab } from '@/lib/crmTabs'
import { setCrmStripDebut, setCrmStripLargeur, useCrmStripView } from '@/lib/crmStripView'
import { useAiPanel } from '@/hooks/useAiPanel'
import { useEcranActif } from '@/hooks/useEcranActif'
import { useAgentNotifications } from '@/hooks/useAgentNotifications'
import CrmNotificationsPopover from './notifications/CrmNotificationsPopover'
import { useCrmSidebarCollapsed } from '@/lib/crmSidebar'

/**
 * Hauteur d'une puce. Une HAUTEUR n'est pas un espacement : aucun barreau ne la couvre.
 *
 * ⚠ 30, et NON les 36 de la maquette (retour de Julien, 4 septembre 2026 : « encore plus
 * fin, que le pager soit un peu plus haut »). La bande prenait 48 px au cadre bento, soit
 * 7 % de sa hauteur à 1280x720 — cher pour du chrome. Les six pixels sont repris ICI et
 * pas sur les gouttières : ce sont elles qui portent l'alignement de la première puce sur
 * le haut de la carte latérale, et le décalage se verrait bien plus qu'une puce d'un cran
 * plus basse.
 *
 * ⛔ Plancher mesuré, ne pas descendre sous 28 : la puce loge une croix ronde (20), un
 * badge (16) et un libellé de 12 px. À 28 la croix n'a plus que 4 px de respiration,
 * au-dessous elle touche le bord de la pilule.
 */
const H_PUCE = 30
/** Pastille « +N » et bouton « + » — un cran sous la puce, comme la maquette. */
const H_PASTILLE = 26
/** Rond de la croix, et de son homologue dans le menu de débordement. */
const D_CROIX = 20

/**
 * Largeur PLANCHER d'une puce, pour décider combien il en tient.
 *
 * ⛔ LE NOMBRE DE PUCES ÉTAIT FIGÉ À SIX (quatre dock ouvert), quelle que soit la
 * largeur de l'écran. Mesuré le 4 septembre 2026 à 1280 px : la bande s'arrêtait à
 * x=1015 pour un cadre allant à 1256 — 241 px vides, un quart de la largeur. À
 * 1920 px il en serait resté ~880, soit plus de la moitié, avec des onglets cachés
 * derrière « +N » pendant que la place existait. Une barre d'onglets aveugle à sa
 * propre largeur.
 *
 * ⛔ 100 px ÉTAIT UNE CONSTANTE, et c'est ce qui plafonnait la bande à huit
 * puces sur 1440 : au-delà, les onglets ne rétrécissaient pas, ils passaient au
 * menu « +N ». Le plancher vit désormais dans `crmChipMinWidth(nTabs)` — trois
 * paliers, 100 / 76 / 60 — parce qu'il DÉPEND du nombre d'onglets et qu'il
 * s'éprouve comme une fonction pure. Voir sa JSDoc pour le calage des paliers.
 */
/** Gouttière entre deux puces — `--crm-space-2xs`, lue ici pour le calcul. */
const TAB_GAP = 4

/**
 * En dessous de cette largeur RENDUE, la croix ne s'affiche plus que sur la puce
 * active et sous le curseur.
 *
 * ⛔ SANS CETTE RÈGLE, RESSERRER LES PUCES NE SERT À RIEN. Mesuré à l'écran le
 * 7 septembre 2026, 20 onglets : les puces tombent à ~60 px, dont 12 de
 * gouttière gauche, 4 de droite, 16 de croix et 8 d'écart — il reste **20 px de
 * libellé**, soit une lettre et des points de suspension. « N… » pour vingt
 * onglets : la bande est pleine et ne dit plus rien.
 *
 * Croix retirée, le même libellé dispose de 44 px : « Calen… » se distingue de
 * « Contac… », ce qui est exactement le service qu'on attend d'une puce. C'est
 * aussi ce que fait un navigateur, et pour la même raison.
 *
 * 96 et non 100 : le palier haut de `crmChipMinWidth` vaut 100, et un seuil
 * posé À la valeur du palier basculerait sur une égalité — donc sur un arrondi
 * de mesure.
 */
const SEUIL_CROIX = 96

/** Strate d'empilement — lue sur les voisins, pas copiée d'une convention. */
// La barre latérale est à 75, le dock MEGGA AI à 70, le bandeau d'usurpation à 90.
// La barre d'onglets vit DANS le flux, sous la barre latérale : 60 la met au-dessus
// du contenu sans jamais couvrir une popover de la barre latérale (9000) ni le
// bandeau. Ses deux menus, eux, sont PORTÉS et montent à 9000 — voir plus bas.
const Z_BARRE = 60
const Z_MENU = 9000

/** Durée de la sonde qui suit une transition de largeur (le pli de la barre dure 250 ms). */
const SONDE_MS = 400

/**
 * Largeur réellement disponible pour les puces.
 *
 * ⛔ SANS `ResizeObserver`, ET C'EST MESURÉ, PAS PRÉFÉRÉ. Le dépôt l'avait déjà écrit
 * pour `useSideAnchor` — « zéro livraison en 500 ms » — et j'ai quand même compté sur
 * lui pour les changements ultérieurs. Remesuré ici le 4 septembre 2026, sur la piste
 * réellement rendue : **zéro rappel**, ni initial ni après un changement de largeur.
 * Un observateur qui n'observe rien est pire qu'aucun observateur : la barre restait
 * bloquée à huit puces sur un écran de 1600 px qui en tenait onze, sans un signe.
 *
 * On remesure donc sur les SIGNAUX qui font vraiment bouger la largeur :
 *   • le montage ;
 *   • le redimensionnement de la fenêtre ;
 *   • le RETOUR SUR LA PAGE, après qu'elle a été en arrière-plan ;
 *   • l'ouverture du dock MEGGA AI et le repli de la barre latérale, qui sont des
 *     ÉTATS que ce composant connaît déjà — on n'a pas besoin de les observer, il
 *     suffit d'en dépendre ;
 *   • le nombre d'onglets, qui refait couler les puces.
 *
 * ⛔ LE RETOUR EST UN SIGNAL DEPUIS QUE LA LARGEUR EST PARTAGÉE, et c'est une
 * dette que ce chantier a lui-même créée. Tant que chaque barre gardait sa
 * mesure en `useState`, une valeur périmée mourait avec son composant : la barre
 * suivante repartait de zéro et remesurait. Elle vit maintenant dans
 * `crmStripView`, au-dessus des instances — donc une mesure fausse SURVIT aux
 * montages, et rien ne la révoque.
 *
 * Or une page en arrière-plan est précisément là où une mesure devient fausse
 * sans que personne ne le voie : le navigateur y gèle le rendu, et un
 * `resize` — fenêtre réarrangée, écran débranché, zoom changé — s'y traite sur
 * une mise en page qui n'est plus rafraîchie. Au retour, aucun montage n'est
 * garanti (basculer entre deux onglets DÉJÀ vivants n'en monte aucun) : sans ce
 * signal, la bande resterait cadrée sur la largeur d'avant l'absence.
 *
 * ⛔ `useLayoutEffect`, ET LA MESURE EST SYNCHRONE — c'est ce point-là qui a changé
 * le 7 septembre 2026. Elle passait par `queueMicrotask`, choisi parce qu'il tire
 * toujours là où rAF est gelé (volet masqué, onglet d'arrière-plan). Il tire bien,
 * mais l'écriture qui en sort est ordonnancée par React dans une TÂCHE suivante :
 * la frame déjà rendue — celle où `largeur` vaut encore 0, donc `vis` vaut 1 — peut
 * être PEINTE avant la correction. Mesuré à l'écran, piste : 1166 → 94 → 1166 px.
 * Une mesure faite dans un effet de mise en page tombe avant la peinture, et React
 * y vide les mises à jour de façon synchrone : l'état intermédiaire n'existe plus.
 *
 * ⚠ La sonde rAF BORNÉE reste, et elle reste en rAF : le pli de la barre latérale
 * dure 250 ms, donc la largeur finale n'est pas celle de l'instant du clic. C'est un
 * suivi d'animation, pas la mesure d'ouverture — la geler avec le rendu est sans
 * conséquence, puisque rien n'est peint pendant ce temps-là. Bornée à
 * {@link SONDE_MS}, jamais continue.
 *
 * ⚠ La largeur est rangée dans `crmStripView`, PAS dans un `useState` : trois barres
 * sont montées à la fois et une barre neuve doit hériter de ce qu'a mesuré celle
 * qu'elle remplace, sans quoi elle repart de zéro à chaque bascule. L'écriture
 * court-circuite sur l'égalité — une largeur stable ne provoque aucun rendu.
 */
function useLargeurPuces(
  piste: React.RefObject<HTMLDivElement | null>,
  vide: React.RefObject<HTMLDivElement | null>,
  signaux: unknown[],
): number {
  const { largeur } = useCrmStripView()
  useLayoutEffect(() => {
    const p = piste.current
    if (!p) return
    const mesurer = () => {
      // Place OCCUPÉE par les puces + place ENCORE LIBRE : c'est ce dont la piste
      // pourrait disposer si elle en avait besoin.
      setCrmStripLargeur(Math.round(
        p.getBoundingClientRect().width + (vide.current?.getBoundingClientRect().width ?? 0),
      ))
    }
    mesurer()

    let brut = 0
    const debut = performance.now()
    const sonde = () => {
      mesurer()
      if (performance.now() - debut < SONDE_MS) brut = requestAnimationFrame(sonde)
    }
    brut = requestAnimationFrame(sonde)

    window.addEventListener('resize', mesurer)

    // ⚠ La sonde rAF est RELANCÉE au retour, pas seulement la mesure : le
    // navigateur rend sa première frame après le retour, et une mise en page
    // qu'il n'entretenait plus peut se stabiliser sur quelques frames. C'est le
    // même motif que le pli de la barre latérale — d'où la même sonde bornée.
    const auRetour = () => {
      if (document.visibilityState !== 'visible') return
      mesurer()
      cancelAnimationFrame(brut)
      const t0 = performance.now()
      const encore = () => {
        mesurer()
        if (performance.now() - t0 < SONDE_MS) brut = requestAnimationFrame(encore)
      }
      brut = requestAnimationFrame(encore)
    }
    document.addEventListener('visibilitychange', auRetour)

    return () => {
      cancelAnimationFrame(brut)
      window.removeEventListener('resize', mesurer)
      document.removeEventListener('visibilitychange', auRetour)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [piste, vide, ...signaux])
  return largeur
}

interface Props {
  sp: CrmPalette
  /** Thème courant et son écriture — pour la bascule clair/sombre ancrée à droite. */
  dark: boolean
  setDark: (v: boolean) => void
  /**
   * Compteurs par section. Omis, la barre les lit ELLE-MÊME (`crm_tab_badges`).
   *
   * ⚠ Le badge n'est PAS une donnée d'onglet : deux onglets sur la même section
   * portent le même compte, et il suit la donnée, pas la pile. Le prop n'existe
   * que pour les bancs, qui n'ont pas de base derrière eux.
   */
  badges?: Record<string, { n: number; urgent?: boolean }>
}

// ─── La puce ────────────────────────────────────────────────────────────────

interface PuceProps {
  tb: CrmTab
  i: number
  actif: boolean
  fermable: boolean
  /** La puce est-elle assez large pour porter sa croix en permanence ? */
  croixPermanente: boolean
  maxW: number
  sp: CrmPalette
  badge?: { n: number; urgent?: boolean }
  libelle: string
}

function styleDePuce(actif: boolean, maxW: number, sp: CrmPalette): CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)',
    height: H_PUCE, maxWidth: maxW,
    // Asymétrique, comme la maquette : la croix comble la marge de droite.
    padding: '0 var(--crm-space-xs) 0 var(--crm-space-lg)',
    borderRadius: 'var(--crm-radius-pill)',
    cursor: 'pointer', fontSize: 'var(--crm-text-sm)', fontWeight: 500,
    whiteSpace: 'nowrap', flexShrink: 1, minWidth: 0,
    border: `1px solid ${actif ? 'transparent' : 'transparent'}`,
    background: actif ? sp.accent : 'transparent',
    color: actif ? sp.accentInk : sp.sub,
    // ⚠ `fontFamily: inherit` et jamais un nom de police : Inter Tight est la
    // police du bureau agent, et `polices-domaines.spec.ts` refuse qu'un fichier
    // de bureau nomme une famille.
    fontFamily: 'inherit',
    transition: 'background-color .18s ease, color .18s ease',
  }
}

function Puce({ tb, i, actif, fermable, croixPermanente, maxW, sp, badge, libelle }: PuceProps) {
  const { t } = useTranslation('common')
  const [survol, setSurvol] = useState(false)
  const [survolCroix, setSurvolCroix] = useState(false)

  const style = styleDePuce(actif, maxW, sp)
  if (!actif && survol) style.background = sp.focusSurface

  return (
    <div
      data-tabi={i}
      role="tab"
      aria-selected={actif}
      tabIndex={actif ? 0 : -1}
      title={libelle}
      onMouseEnter={() => setSurvol(true)}
      onMouseLeave={() => setSurvol(false)}
      style={style}
    >
      {tb.pinned && (
        <MEIcon name="pin" size={11} style={{ opacity: 0.65 }} />
      )}
      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {libelle}
      </span>
      {badge && badge.n > 0 && (
        <Badge n={badge.n} urgent={badge.urgent} actif={actif} sp={sp} />
      )}
      {/* ⚠ Sur une puce étroite, la croix ne se montre que si la puce est ACTIVE
          ou sous le curseur — sans quoi elle mange le libellé (voir SEUIL_CROIX).
          Le libellé se resserre au survol, comme dans un navigateur. */}
      {fermable && (croixPermanente || actif || survol) && (
        <span
          data-tabc={i}
          role="button"
          aria-label={t('tabs.close')}
          onMouseEnter={() => setSurvolCroix(true)}
          onMouseLeave={() => setSurvolCroix(false)}
          style={{
            width: D_CROIX, height: D_CROIX, borderRadius: 'var(--crm-radius-pill)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            // Sur une puce active peinte en accent, le survol de la croix
            // s'ÉCLAIRCIT au lieu de s'assombrir : un gris de survol sur un aplat
            // d'accent fait une tache sale.
            background: survolCroix ? (actif ? 'rgba(255,255,255,0.22)' : sp.cardSubBg) : 'transparent',
            color: actif ? sp.accentInk : sp.soft,
          }}
        >
          <MEIcon name="close" size={10} strokeWidth={2.2} />
        </span>
      )}
    </div>
  )
}

/**
 * Badge de puce.
 *
 * ⚠ Il S'INVERSE sur la puce active — c'est l'idiome déjà posé sur la cloche de
 * la barre latérale. Un badge d'accent sur un aplat d'accent serait invisible.
 */
function Badge({ n, urgent, actif, sp }: { n: number; urgent?: boolean; actif: boolean; sp: CrmPalette }) {
  const { t } = useTranslation('common')
  // ⛔ CE TERNAIRE ÉTAIT MORT jusqu'au 4 septembre 2026 : il peignait l'urgence avec
  // `sp.focusBg`/`sp.focusInk`, or `mxCrmPalette` les définit comme `C.accent`/`C.n1000` —
  // c'est-à-dire EXACTEMENT la paire d'accent de la branche ordinaire. Les deux variantes
  // rendaient donc le même badge, et la « variante rouge » du handoff n'existait pas.
  //
  // ⚠ `MXC_SYSTEM.red400` est un barreau DÉRIVÉ, pas un littéral : le cliquet des couleurs
  // (zone `src/components/crm` plafonnée au chiffre EXACT de ses hex) ne le compte pas.
  // Et il est PÂLE, réglé pour un aplat : `encreSur` lui pose donc l'encre sombre, comme
  // la règle des couleurs de système l'exige. Un blanc dessus rendrait 1,9:1.
  const fond = actif ? sp.accentInk : urgent ? MXC_SYSTEM.red400 : sp.accent
  const encre = actif ? sp.accent : urgent ? encreSur(MXC_SYSTEM.red400) : sp.accentInk
  return (
    <span
      title={urgent ? t('tabs.badgeUrgent') : t('tabs.badgeCount')}
      style={{
        fontSize: 'var(--crm-text-xs)', fontWeight: 600,
        minWidth: 17, height: 16, padding: '0 var(--crm-space-2xs)',
        borderRadius: 'var(--crm-radius-pill)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        boxSizing: 'border-box', flexShrink: 0,
        background: fond, color: encre,
      }}
    >
      {n > 99 ? '99+' : n}
    </span>
  )
}

// ─── La barre ───────────────────────────────────────────────────────────────

export function CrmTabsBar({ sp, dark, setDark, badges: override }: Props) {
  const { t } = useTranslation('common')
  const api = useCrmTabs()
  const serveur = useCrmTabBadges()
  const badges = override ?? serveur
  const ai = useAiPanel()
  const dockOuvert = !!(ai.enabled && ai.isOpen)
  // ⚠ Le repli de la barre latérale rend 180 px à la colonne : c'est un SIGNAL de
  // remesure, pas une information d'affichage — la barre d'onglets n'en fait rien d'autre.
  const [barreRepliee] = useCrmSidebarCollapsed()
  const ecranActif = useEcranActif()
  // ⚠ Les notifications montent ICI depuis le 7 septembre 2026 (Julien) : elles
  // occupaient une ligne pleine du pied de la barre latérale, pour un indicateur
  // qui n'a besoin que d'un glyphe. Le quart droit de la bande est déjà la grappe
  // des commandes d'état (✦ et le thème) — la cloche y est chez elle, et la
  // latérale récupère une ligne.
  // ⚠ Le second argument est la contrepartie des écrans vivants : six bandes sont
  // montées, une seule est regardée, et seule celle-là ouvre le canal Realtime.
  // La lecture, elle, est partagée par React Query — voir le hook.
  const { items: notifs, unreadCount, markRead, markAllRead } = useAgentNotifications(30, ecranActif)
  const [notifOuvert, setNotifOuvert] = useState(false)
  const notifAncre = useRef<HTMLDivElement | null>(null)
  // Clic dehors et Échap ferment la popover — elle vivait dans la barre latérale,
  // son couple d'écouteurs la suit ici.
  useEffect(() => {
    if (!notifOuvert) return
    const onDown = (e: MouseEvent) => {
      if (notifAncre.current && !notifAncre.current.contains(e.target as Node)) setNotifOuvert(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setNotifOuvert(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [notifOuvert])

  const barreRef = useRef<HTMLDivElement | null>(null)
  /** La piste des puces, et l'espace encore libre à sa droite. */
  const pistRef = useRef<HTMLDivElement | null>(null)
  const videRef = useRef<HTMLDivElement | null>(null)
  // ⚠ Le menu de débordement s'aligne sur la PASTILLE « +N », pas sur la barre :
  // ancré à la barre il s'ouvrait à gauche de l'écran, à des centaines de pixels
  // du bouton qui l'ouvre (vu à l'écran le 4 septembre 2026).
  const plusRef = useRef<HTMLButtonElement | null>(null)
  const [menuPlus, setMenuPlus] = useState(false)
  const [survolPlus, setSurvolPlus] = useState(false)
  const [ctx, setCtx] = useState<{ i: number; x: number; y: number } | null>(null)

  const { tabs, active } = api
  const nTabs = tabs.length
  const largeur = useLargeurPuces(pistRef, videRef, [dockOuvert, barreRepliee, nTabs])
  /**
   * Combien de puces tiennent réellement.
   *
   * ⚠ Le cas du dock MEGGA AI ne demande plus de constante à part : le dock
   * comprime la colonne, donc la piste mesure moins, donc il tient moins de puces.
   * La mesure subsume la règle « quatre quand l'assistant est ouvert », et elle est
   * plus juste — elle vaut aussi pour la barre latérale repliée et pour un 1920.
   *
   * ⚠ Plancher à 1 tant que la mesure n'est pas revenue (première frame) : rendre
   * zéro puce ferait clignoter la barre à chaque montage.
   */
  // ⚠ Le plancher n'est PLUS une constante : il se resserre avec le nombre
  // d'onglets (`crmChipMinWidth`). C'est ce qui fait tenir ~17 puces là où le
  // `CHIP_MIN` figé à 100 en plafonnait 8 — au-delà, les onglets ne
  // rétrécissaient pas, ils disparaissaient dans le menu.
  const minW = crmChipMinWidth(nTabs)
  const vis = Math.max(1, Math.floor((largeur + TAB_GAP) / (minW + TAB_GAP)) || 1)
  // ⚠ Le maximum ne peut pas passer sous le minimum : à grand nombre, c'est le
  // plancher qui commande, et une puce de 128 px large de 60 minimum n'aurait
  // aucun sens.
  const maxW = Math.max(minW, crmChipMaxWidth(nTabs, dockOuvert))
  const nPin = crmPinnedCount(tabs)

  /**
   * Cadrage de la bande — le premier rang non épinglé affiché.
   *
   * ⛔ IL DOIT ÊTRE UN ÉTAT, et c'est tout l'intérêt du défilement minimal :
   * sans mémoire du cadrage précédent, `crmVisibleWindow` se recentrerait à
   * chaque bascule et les puces sauteraient sous le curseur. On le lit au rendu
   * et on ne le RANGE qu'ensuite — la fenêtre rendue est déjà la corrigée, donc
   * aucun clignotement.
   *
   * ⛔ ET IL EST PARTAGÉ, PAS LOCAL — corrigé le 7 septembre 2026. Un état local
   * donnait à chacune des trois barres montées SON cadrage : la bande qui
   * s'affiche n'est alors pas celle qu'on regardait. Mesuré, 15 onglets sur
   * 820 px : la bande passait de `0..8` à `6..14` sur un clic qui visait le
   * rang 8 — déjà visible. Six rangs de glissement pour rien, et l'onglet qu'on
   * venait de quitter poussé hors champ. Le cadrage décrit la BANDE, il n'a
   * jamais été une position d'écran.
   */
  const { debut } = useCrmStripView()
  const { visibles, caches, debut: debutCorrige } = useMemo(
    () => crmVisibleWindow(nTabs, active, vis, debut, nPin),
    [nTabs, active, vis, debut, nPin],
  )
  useEffect(() => {
    // ⛔ Tant que rien n'est mesuré, on NE RANGE RIEN. `vis` vaut alors 1 (son
    // plancher), et le cadrage que `crmVisibleWindow` en tire est celui d'une
    // bande à une seule puce : le ranger le lèguerait à la vraie largeur, qui
    // repartirait de là. C'est exactement ce qui déplaçait la bande de six rangs.
    if (!largeur) return
    if (debutCorrige !== debut) setCrmStripDebut(debutCorrige)
  }, [debutCorrige, debut, largeur])

  /**
   * Largeur RÉELLEMENT rendue d'une puce — celle qui décide du sort de la croix.
   *
   * ⚠ Ni `maxW` ni `minW` ne conviennent : `maxW` reste à 128 alors que les
   * puces sont écrasées à 60 par le flex, et `minW` ne suit que le nombre
   * d'onglets — sur un 1920 avec dix onglets les puces sont larges, et leur
   * retirer la croix serait absurde. Ce qu'on veut est ce que l'agent voit :
   * la piste divisée par le nombre de puces, plafonné par `maxW`.
   */
  const largeurPuce = Math.min(
    maxW,
    Math.floor((largeur + TAB_GAP) / Math.max(1, visibles.length)) - TAB_GAP,
  )
  const croixPermanente = largeurPuce >= SEUIL_CROIX

  // ⚠ La règle vit dans `crmTabLibelle` (src/lib/crmTabs.ts) : la palette de
  // recherche en a besoin à son tour, et la table `SECTION_LABEL` qui vivait ici
  // redisait déjà ce que porte `CRM_SIDEBAR_SECTIONS.labelKey`.
  const libelleDe = useCallback((tb: CrmTab): string => crmTabLibelle(tb, t), [t])

  // ── Délégation : UN onClick et UN onPointerDown pour toute la barre ────────
  const onClic = useCallback((e: React.MouseEvent) => {
    // Un glisser qui vient de se terminer ne doit pas se conclure en bascule.
    if (Date.now() - supRef.current < 250) return
    const cible = e.target as HTMLElement
    const croix = cible.closest('[data-tabc]')
    if (croix) {
      e.stopPropagation()
      api.fermer(Number((croix as HTMLElement).dataset.tabc))
      return
    }
    const puce = cible.closest('[data-tabi]')
    if (!puce) return
    setMenuPlus(false)
    api.selectionner(Number((puce as HTMLElement).dataset.tabi))
  }, [api])

  // ── Clic droit ────────────────────────────────────────────────────────────
  // Position RELATIVE à la barre (rect de la puce − rect de la barre), pas
  // `clientX/clientY` : le menu s'aligne sur le bord gauche de la puce et reste
  // juste même si la barre se décale (ouverture du dock, repli de la latérale).
  const onCtx = useCallback((e: React.MouseEvent) => {
    const puce = (e.target as HTMLElement).closest('[data-tabi]')
    if (!puce) return
    e.preventDefault()
    const r = puce.getBoundingClientRect()
    setCtx({ i: Number((puce as HTMLElement).dataset.tabi), x: Math.round(r.left), y: Math.round(r.bottom + 8) })
    setMenuPlus(false)
  }, [])

  // ── Glisser pour réordonner (modèle Chrome) ───────────────────────────────
  const dragRef = useRef<{
    el: HTMLElement; puces: HTMLElement[]; idx: number[]; from: number; target: number
    lo: number; hi: number; rects: DOMRect[]; startX: number; bouge: boolean; dx: number
  } | null>(null)
  const supRef = useRef(0)

  const nettoyer = useCallback(() => {
    const d = dragRef.current
    if (!d) return
    d.puces.forEach((c) => { c.style.removeProperty('transform') })
    d.el.style.removeProperty('position')
    d.el.style.removeProperty('z-index')
    document.body.style.removeProperty('user-select')
    document.body.style.removeProperty('cursor')
  }, [])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return
    const cible = e.target as HTMLElement
    if (cible.closest('[data-tabc]')) return
    const el = cible.closest('[data-tabi]') as HTMLElement | null
    if (!el?.parentElement) return
    const puces = Array.from(el.parentElement.querySelectorAll('[data-tabi]')) as HTMLElement[]
    if (puces.length < 2) return

    const idx = puces.map((c) => Number(c.dataset.tabi))
    const from = puces.indexOf(el)

    /**
     * Bornes du glisser : le bloc CONTIGU de rangs réels qui entoure la puce tirée,
     * et de même épinglage.
     *
     * ⛔ LA FENÊTRE VISIBLE N'EST PAS TOUJOURS CONTIGUË, et c'est ce qui rendait le
     * glisser faux au-delà de six onglets. Quand l'actif est hors fenêtre, il EMPRUNTE
     * le dernier créneau : à 15 onglets avec l'actif au rang 12, la barre montre les
     * rangs [0,1,2,3,4,12]. Tirer la puce du créneau 4 vers le créneau 5 — UN cran à
     * l'écran — la déplaçait alors du rang 4 au rang 12 : huit rangs franchis, et la
     * puce SORTAIT du champ visible à l'arrivée. Mesuré le 4 septembre 2026.
     *
     * Le dernier créneau n'est pas « la position 6 de la pile », c'est un siège
     * emprunté. On ne peut donc pas y déposer quoi que ce soit : le glisser se limite
     * aux créneaux dont les rangs réels se suivent. On réordonne ce qu'on voit, et rien
     * ne se téléporte.
     */
    const { lo, hi } = crmDragBounds(idx, from, (rang) => !!tabs[rang]?.pinned)
    // Rien à réordonner : la puce est seule dans son bloc contigu.
    if (lo === hi) return

    dragRef.current = {
      el, puces, idx, from, target: from,
      lo, hi,
      // ⚠ Les rects sont mesurés UNE fois et servent de référence pour tout le
      // geste. Les relire pendant le glisser lirait un layout déjà déformé par
      // les transforms qu'on vient de poser, et les puces se mettraient à osciller.
      rects: puces.map((c) => c.getBoundingClientRect()),
      startX: e.clientX, bouge: false, dx: 0,
    }
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabs])

  const onPointerMove = useCallback((e: PointerEvent) => {
    const d = dragRef.current
    if (!d) return
    const dx = e.clientX - d.startX
    if (!d.bouge) {
      // Seuil : en deçà, c'est un clic. Sans lui, un clic un peu appuyé
      // réordonnerait la barre au lieu de changer d'onglet.
      if (Math.abs(dx) < 4) return
      d.bouge = true
      d.el.style.position = 'relative'
      d.el.style.zIndex = '6'
      document.body.style.userSelect = 'none'
      document.body.style.cursor = 'grabbing'
    }
    d.dx = dx
    d.el.style.transform = `translateX(${dx}px) scale(1.025)`

    const centre = d.rects[d.from].left + d.rects[d.from].width / 2 + dx
    let target = d.from
    for (let k = d.lo; k <= d.hi; k++) {
      if (k === d.from) continue
      const milieu = d.rects[k].left + d.rects[k].width / 2
      if (k < d.from && centre < milieu) target = Math.min(target, k)
      if (k > d.from && centre > milieu) target = Math.max(target, k)
    }
    if (target === d.target) return
    d.target = target

    // Les voisines cèdent la place : on recalcule les positions d'arrivée en
    // réinsérant l'index tiré à la place visée.
    const ordre = d.puces.map((_, k) => k)
    ordre.splice(target, 0, ordre.splice(d.from, 1)[0])
    let x = d.rects[0].left
    const gauche: Record<number, number> = {}
    ordre.forEach((k) => { gauche[k] = x; x += d.rects[k].width + 4 })
    d.puces.forEach((c, k) => {
      if (k === d.from) return
      c.style.transform = `translateX(${gauche[k] - d.rects[k].left}px)`
    })
  }, [])

  const onPointerUp = useCallback(() => {
    const d = dragRef.current
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
    window.removeEventListener('pointercancel', onPointerUp)
    if (!d) return
    if (!d.bouge) { dragRef.current = null; nettoyer(); return }
    // Fenêtre de silence : le `click` qui suit ce `pointerup` ne doit pas basculer.
    supRef.current = Date.now()
    const from = d.idx[d.from]
    const to = d.idx[d.target]
    nettoyer()
    dragRef.current = null
    // ⚠ La maquette pose TROIS filets ici (onComplete du ressort, un rAF, un
    // setTimeout) parce que son runtime ne transmet pas les rappels de setState.
    // En React standard le rendu suit l'état : un seul chemin suffit, et poser
    // les trois ferait trois validations du même déplacement.
    if (from !== to) api.deplacer(from, to)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, nettoyer])

  /**
   * Retrait des écouteurs AU DÉMONTAGE, et au démontage seulement.
   *
   * ⛔ AVEC `[onPointerMove, onPointerUp]` EN DÉPENDANCES, CET EFFET TUAIT LE GLISSER
   * EN COURS. `onPointerUp` se referme sur `api`, dont l'identité change à chaque
   * changement d'état — et un glisser EN produit (le survol d'une puce, une sauvegarde
   * qui revient). Le nettoyage partait alors au milieu du geste, retirait les écouteurs,
   * et la puce restait collée au curseur sans que rien ne valide le déplacement.
   *
   * ⚠ Les handlers passent donc par des refs, et l'effet n'a plus AUCUNE dépendance :
   * il ne peut plus partir qu'au démontage réel.
   */
  const moveRef = useRef(onPointerMove)
  const upRef = useRef(onPointerUp)
  useEffect(() => { moveRef.current = onPointerMove; upRef.current = onPointerUp })
  useEffect(() => () => {
    window.removeEventListener('pointermove', moveRef.current)
    window.removeEventListener('pointerup', upRef.current)
    window.removeEventListener('pointercancel', upRef.current)
  }, [])

  // ── Clavier ───────────────────────────────────────────────────────────────
  // ⛔ Ni Ctrl+W ni Ctrl+1..9 : le navigateur se les réserve et ne les rend pas
  // annulables. Les lier ici fermerait l'onglet du NAVIGATEUR en croyant fermer
  // celui du CRM. Alt est libre, dans les deux systèmes.
  useEffect(() => {
    // ⛔ Un écran vivant mais CACHÉ n'écoute pas le clavier. Trois écrans vivants,
    // c'est trois bandes montées : sans cette sortie, une frappe déclenchait trois
    // fois le raccourci et poussait trois entrées d'historique (mesuré).
    if (!ecranActif) return
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey) return
      // ⚠ `Alt+Maj+T` et non `⇧⌘T` : le raccourci du NAVIGATEUR, qui rouvre son
      // propre onglet, n'est pas annulable — le lier ici ferait les deux à la
      // fois. Alt reste le modificateur libre, comme pour les chiffres.
      if ((e.key === 'T' || e.key === 't') && e.shiftKey) {
        e.preventDefault(); api.rouvrirFerme(); return
      }
      if (e.key >= '1' && e.key <= '9') {
        const i = Number(e.key) - 1
        if (i < tabs.length) { e.preventDefault(); api.selectionner(i) }
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault()
        const pas = e.key === 'ArrowRight' ? 1 : -1
        api.selectionner((active + pas + tabs.length) % tabs.length)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [api, active, tabs.length, ecranActif])

  // Fermer les menus à l'Échap.
  useEffect(() => {
    if (!ecranActif) return
    if (!ctx && !menuPlus) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setCtx(null); setMenuPlus(false) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ctx, menuPlus, ecranActif])

  if (!nTabs) return <div style={{ height: H_PUCE }} aria-hidden />

  const ctxTab = ctx ? tabs[ctx.i] : null

  return (
    <div
      ref={barreRef}
      style={{
        display: 'flex', alignItems: 'center', gap: 'var(--crm-space-2xs)',
        minWidth: 0, position: 'relative', zIndex: Z_BARRE,
        height: H_PUCE, fontFamily: 'inherit',
      }}
    >
      {/* ⚠ `role="tablist"` est ICI, sur les seules puces — et non sur la barre
          entière comme au premier jet. Un `tablist` ne doit contenir que des
          `tab` ; y ranger « +N », « + » et les deux commandes de droite les
          faisait annoncer comme des onglets par un lecteur d'écran. */}
      <div
        ref={pistRef}
        role="tablist"
        aria-label={t('tabs.bar')}
        onClick={onClic}
        onPointerDown={onPointerDown}
        onContextMenu={onCtx}
        style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-2xs)', minWidth: 0 }}
      >
        {visibles.map((i) => (
          <Puce
            key={tabs[i].id}
            tb={tabs[i]} i={i}
            actif={i === active}
            // Une puce épinglée perd sa croix : elle ne se ferme qu'après
            // détachement, par le menu. C'est le sens de l'épingle.
            fermable={nTabs > 1 && !tabs[i].pinned}
            croixPermanente={croixPermanente}
            maxW={maxW} sp={sp}
            badge={tabs[i].section ? badges?.[tabs[i].section] : undefined}
            libelle={libelleDe(tabs[i])}
          />
        ))}
      </div>

      {caches.length > 0 && (
        <button
          ref={plusRef}
          type="button"
          onClick={() => { setMenuPlus((v) => !v); setCtx(null) }}
          onMouseEnter={() => setSurvolPlus(true)}
          onMouseLeave={() => setSurvolPlus(false)}
          title={t('tabs.more')}
          aria-haspopup="menu"
          aria-expanded={menuPlus}
          style={{
            height: H_PASTILLE, padding: '0 var(--crm-space-lg)',
            borderRadius: 'var(--crm-radius-pill)',
            background: sp.cardBg,
            // La maquette fait foncer la BORDURE au survol, pas le fond : la pastille
            // porte déjà un fond, l'assombrir la ferait passer pour un état actif.
            border: `1px solid ${survolPlus ? sp.soft : sp.cardBorder}`,
            display: 'flex', alignItems: 'center', flexShrink: 0,
            transition: 'border-color .18s ease',
            fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: sp.sub,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          {`+${caches.length}`}
        </button>
      )}

      {/* ⚠ ÉCART ASSUMÉ À LA MAQUETTE (décision Julien, 5 septembre 2026). Elle
          demande un « rond de 30 px, SANS FOND au repos » — juste tant que « + » est
          la dernière chose de la barre. Il est désormais coincé entre la pastille
          « +N » et les deux commandes du quart droit, toutes cerclées : seul nu, il
          se lisait comme un glyphe décoratif au milieu de boutons.
          Il passe donc par `CommandeRonde`, le MÊME composant que ✦ et le thème —
          recopier le style aurait laissé les quatre commandes diverger au premier
          ajustement. */}
      <CommandeRonde
        sp={sp}
        icone="plus"
        actif={false}
        libelle={t('tabs.new')}
        onClick={() => api.ouvrirNouvel()}
      />

      {/* ── Le quart droit ────────────────────────────────────────────────────
          Mesuré le 4 septembre 2026 : la bande laissait 241 px vides à 1280 px
          (25 % du cadre) et en laisserait ~880 à 1920 — la barre s'arrête aux
          trois quarts. Deux commandes viennent l'occuper, et elles sont
          DÉPLACÉES, pas dupliquées : deux déclencheurs pour un même état sont
          une gêne, pas un confort.

          ⚠ ✦ MEGGA AI GAGNE À ÊTRE ICI : le panneau s'ouvre par la droite, donc
          un déclencheur ancré à droite dit d'où vient la chose. Il portait un
          état actif dans la barre latérale — il le garde. */}
      {/* ⚠ L'espaceur n'est pas décoratif : sa largeur EST la place encore libre, et
          c'est elle qu'on additionne à celle de la piste pour savoir combien de puces
          il tiendrait. Il garde au passage « + » collé à la dernière puce — dans un
          navigateur, c'est là que la main le cherche. */}
      <div ref={videRef} style={{ flex: 1, minWidth: 'var(--crm-space-lg)' }} aria-hidden />
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-2xs)', flexShrink: 0 }}>
        {/* ⚠ `position: relative` sur l'ancre, et pas sur la grappe : la popover
            s'ouvre en `below-right`, elle se cale donc sur le bord droit de SA
            commande — pas sur celui du groupe, qui la décalerait du thème. */}
        <div ref={notifAncre} style={{ position: 'relative' }}>
          <CommandeRonde
            sp={sp}
            icone="bell"
            actif={notifOuvert}
            libelle={unreadCount > 0
              ? `${t('nav.notifications')} · ${t('notifications.unreadCount', { count: unreadCount })}`
              : t('nav.notifications')}
            haspopup="dialog"
            expanded={notifOuvert}
            badge={unreadCount}
            onClick={() => setNotifOuvert((o) => !o)}
          />
          {notifOuvert && (
            <CrmNotificationsPopover
              sp={sp}
              dark={dark}
              items={notifs}
              onItemClick={(n) => { markRead(n.id); setNotifOuvert(false) }}
              onMarkAll={() => markAllRead()}
              onSeeAll={() => setNotifOuvert(false)}
              onMute={() => setNotifOuvert(false)}
            />
          )}
        </div>
        {ai.enabled && (
          <CommandeRonde
            sp={sp}
            icone="sparkle"
            actif={ai.isOpen}
            libelle={t('nav.aiAgent')}
            haspopup="dialog"
            expanded={ai.isOpen}
            onClick={() => (ai.isOpen ? ai.close() : ai.open())}
          />
        )}
        <CommandeRonde
          sp={sp}
          icone={dark ? 'moon' : 'sun'}
          actif={false}
          // Le nom dit ce que le clic FERA, pas l'état courant : un bouton
          // annoncé « Sombre » alors qu'on y est déjà se lit comme un état.
          libelle={dark ? t('nav.light') : t('nav.dark')}
          onClick={() => setDark(!dark)}
        />
      </div>

      {/* ── Menu de débordement ──────────────────────────────────────────────
          PORTÉ dans document.body, comme la popover des notifications : un
          ancêtre qui porterait un `backdrop-filter` deviendrait bloc conteneur de
          tout `position:fixed` descendant et garerait le menu hors écran. Le
          défaut a déjà été payé sur le menu « ⋯ » d'une notification. */}
      {menuPlus && caches.length > 0 && createPortal(
        <>
          <div onClick={() => setMenuPlus(false)} style={{ position: 'fixed', inset: 0, zIndex: Z_MENU - 1 }} />
          <MenuDebordement
            caches={caches} tabs={tabs} sp={sp} libelleDe={libelleDe} badges={badges}
            ancre={plusRef.current}
            onChoisir={(i) => { setMenuPlus(false); api.selectionner(i) }}
            onFermer={(i) => { setMenuPlus(false); api.fermer(i) }}
          />
        </>,
        document.body,
      )}

      {/* ── Menu contextuel (clic droit) ─────────────────────────────────── */}
      {ctxTab && createPortal(
        <>
          <div onClick={() => setCtx(null)} style={{ position: 'fixed', inset: 0, zIndex: Z_MENU - 1 }} />
          <div
            role="menu"
            style={{
              position: 'fixed', left: ctx!.x, top: ctx!.y, zIndex: Z_MENU, width: 224,
              background: sp.solidBg, border: `1px solid ${sp.solidBorder}`,
              borderRadius: 'var(--crm-radius-xl)', padding: 'var(--crm-space-xs)',
              display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xs)',
              boxShadow: sp.solidShadow, fontFamily: 'inherit',
            }}
          >
            <div style={{
              fontSize: 'var(--crm-text-xs)', color: sp.soft, fontWeight: 600,
              padding: 'var(--crm-space-xs) var(--crm-space-lg) var(--crm-space-2xs)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {libelleDe(ctxTab)}
            </div>
            <LigneMenu
              icone="pin" sp={sp}
              libelle={ctxTab.pinned ? t('tabs.unpin') : t('tabs.pin')}
              onClick={() => { api.basculerEpingle(ctx!.i); setCtx(null) }}
            />
            <LigneMenu
              icone="copy" sp={sp} libelle={t('tabs.duplicate')}
              onClick={() => { api.dupliquer(ctx!.i); setCtx(null) }}
            />
            {nTabs > 1 && (
              <LigneMenu
                icone="close" sp={sp} libelle={t('tabs.closeOthers')}
                onClick={() => { api.fermerAutres(ctx!.i); setCtx(null) }}
              />
            )}
            {nTabs > 1 && !ctxTab.pinned && (
              <LigneMenu
                icone="close" sp={sp} libelle={t('tabs.closeThis')}
                onClick={() => { const i = ctx!.i; setCtx(null); api.fermer(i) }}
              />
            )}
            {/* ⚠ Rendue seulement quand il y a quelque chose à rouvrir : une
                ligne grisée en permanence apprend le geste sans jamais le rendre,
                et occupe une place dans un menu de quatre. */}
            {api.fermes.length > 0 && (
              <LigneMenu
                // ⚠ `refresh` faute d'`undo` dans `MEIcon` : la flèche circulaire est
                // le glyphe le plus proche du geste, et en inventer un ici ferait
                // diverger le jeu d'icônes du CRM pour une seule ligne de menu.
                icone="refresh" sp={sp}
                libelle={t('tabs.reopen', { nom: libelleDe(api.fermes[0]) })}
                onClick={() => { setCtx(null); api.rouvrirFerme() }}
              />
            )}
          </div>
        </>,
        document.body,
      )}
    </div>
  )
}

/**
 * Commande ronde du quart droit — même diamètre que la pastille « +N », pour que
 * les trois se lisent comme une seule famille.
 */
function CommandeRonde({ sp, icone, actif, libelle, onClick, haspopup, expanded, badge = 0 }: {
  sp: CrmPalette
  icone: 'sparkle' | 'sun' | 'moon' | 'plus' | 'bell'
  actif: boolean
  libelle: string
  onClick: () => void
  haspopup?: 'dialog'
  expanded?: boolean
  /** Compteur non lu, posé en pastille sur le coin. `0` n'en rend aucune. */
  badge?: number
}) {
  const [survol, setSurvol] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setSurvol(true)}
      onMouseLeave={() => setSurvol(false)}
      title={libelle}
      aria-label={libelle}
      aria-pressed={haspopup ? undefined : actif}
      aria-haspopup={haspopup}
      aria-expanded={haspopup ? expanded : undefined}
      style={{
        width: H_PASTILLE, height: H_PASTILLE, flexShrink: 0,
        // ⚠ `border-box` : la bordure d'un pixel doit se prendre SUR les 26, sinon
        // les deux commandes grandissent de 2 px et se désalignent de la pastille
        // « +N », qui est leur voisine immédiate.
        boxSizing: 'border-box',
        borderRadius: 'var(--crm-radius-pill)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', fontFamily: 'inherit',
        // ⚠ CERCLE VISIBLE AU REPOS (demande de Julien, 4 septembre 2026) : au
        // premier jet ces deux-là étaient des glyphes nus, et rien ne disait qu'on
        // pouvait cliquer. Elles prennent l'habillage de la pastille « +N » — fond
        // de carte, filet d'un pixel — pour que les trois commandes de droite se
        // lisent comme une seule famille.
        //
        // Actif = aplat d'accent, comme la puce active : c'est la règle du 10 août
        // 2026, l'élément ACTIF porte l'accent. Le filet disparaît alors dans
        // l'aplat plutôt que de le cerner d'un liseré plus clair.
        background: actif ? sp.accent : survol ? sp.focusSurface : sp.cardBg,
        border: `1px solid ${actif ? sp.accent : survol ? sp.soft : sp.cardBorder}`,
        color: actif ? sp.accentInk : survol ? sp.ink : sp.sub,
        transition: 'background-color .18s ease, border-color .18s ease, color .18s ease',
        // ⚠ Ancre de la pastille de compteur. Sans elle, le compteur se calerait
        // sur la grappe entière et flotterait entre deux commandes.
        position: 'relative',
      }}
    >
      <MEIcon name={icone} size={15} strokeWidth={1.7} />
      {/* ⚠ LE COMPTEUR, PAS UN POINT. La barre latérale montrait le NOMBRE de non
          lus ; le réduire à un point en déménageant aurait retiré une information
          au passage. Au-delà de neuf, « 9+ » — deux chiffres ne tiennent pas sur
          une commande de 26 px sans déborder du cercle.
          ⚠ Rouge sémantique et non l'accent : c'est un état à traiter, pas
          l'élément actif. Même encre que la pastille qu'il remplace. */}
      {badge > 0 && (
        <span
          aria-hidden
          style={{
            position: 'absolute', top: -3, right: -3,
            minWidth: 15, height: 15, padding: '0 var(--crm-space-2xs)',
            boxSizing: 'border-box',
            borderRadius: 'var(--crm-radius-pill)',
            background: '#E53935', color: '#ffffff',
            border: `1.5px solid ${sp.frameBg}`,
            fontSize: 'var(--crm-text-xs)', fontWeight: 600, lineHeight: 1,
            display: 'grid', placeItems: 'center',
            fontVariantNumeric: 'tabular-nums',
          }}
        >{badge > 9 ? '9+' : badge}</span>
      )}
    </button>
  )
}

/** Une ligne de menu — même géométrie pour le clic droit et le débordement. */
function LigneMenu({ icone, libelle, onClick, sp }: {
  icone: 'pin' | 'copy' | 'close' | 'refresh'; libelle: string; onClick: () => void; sp: CrmPalette
}) {
  const [survol, setSurvol] = useState(false)
  return (
    <button
      type="button" role="menuitem" onClick={onClick}
      onMouseEnter={() => setSurvol(true)} onMouseLeave={() => setSurvol(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)',
        padding: 'var(--crm-space-sm) var(--crm-space-lg)',
        borderRadius: 'var(--crm-radius-lg)', border: 0, width: '100%',
        background: survol ? sp.focusSurface : 'transparent',
        color: sp.ink, fontSize: 'var(--crm-text-sm)', fontWeight: 500,
        textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
      }}
    >
      <MEIcon name={icone} size={13} strokeWidth={1.8} color={sp.sub} />
      {libelle}
    </button>
  )
}

/** Le menu « +N » — même famille que le menu contextuel, un cran plus large. */
function MenuDebordement({ caches, tabs, sp, libelleDe, ancre, badges, onChoisir, onFermer }: {
  caches: number[]; tabs: CrmTab[]; sp: CrmPalette
  libelleDe: (t: CrmTab) => string
  ancre: HTMLElement | null
  badges?: Record<string, { n: number; urgent?: boolean }>
  onChoisir: (i: number) => void; onFermer: (i: number) => void
}) {
  const { t } = useTranslation('common')
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)

  // ⛔ Ni ResizeObserver ni rAF pour la mesure initiale : le premier ne livre pas
  // sa notification de départ sur ces éléments, le second est GELÉ quand le rendu
  // l'est (onglet d'arrière-plan, volet d'aperçu masqué) — les deux laissaient des
  // popovers garées hors écran, défaut mesuré le 4 septembre 2026. `queueMicrotask`
  // mesure après le montage, toujours.
  useEffect(() => {
    if (!ancre) return
    queueMicrotask(() => {
      const r = ancre.getBoundingClientRect()
      setPos({ x: Math.round(r.left), y: Math.round(r.bottom + 8) })
    })
  }, [ancre])

  if (!pos) return null
  return (
    <div
      role="menu"
      style={{
        position: 'fixed', left: pos.x, top: pos.y, zIndex: Z_MENU, width: 270,
        background: sp.solidBg, border: `1px solid ${sp.solidBorder}`,
        borderRadius: 'var(--crm-radius-xl)', padding: 'var(--crm-space-xs)',
        display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xs)',
        boxShadow: sp.solidShadow, fontFamily: 'inherit',
        maxHeight: '60vh', overflowY: 'auto',
      }}
      className="scrollbar-hide"
    >
      {caches.map((i) => (
        <LigneDebordement
          key={tabs[i].id} sp={sp} libelle={libelleDe(tabs[i])}
          fermable={tabs.length > 1 && !tabs[i].pinned}
          badge={tabs[i].section ? badges?.[tabs[i].section] : undefined}
          onClick={() => onChoisir(i)} onFermer={() => onFermer(i)}
          labelFermer={t('tabs.close')}
        />
      ))}
    </div>
  )
}

function LigneDebordement({ libelle, fermable, badge, onClick, onFermer, sp, labelFermer }: {
  libelle: string; fermable: boolean; onClick: () => void; onFermer: () => void
  badge?: { n: number; urgent?: boolean }
  sp: CrmPalette; labelFermer: string
}) {
  const [survol, setSurvol] = useState(false)
  return (
    <div
      role="menuitem" tabIndex={0} onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
      onMouseEnter={() => setSurvol(true)} onMouseLeave={() => setSurvol(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)',
        padding: 'var(--crm-space-sm) var(--crm-space-lg)',
        borderRadius: 'var(--crm-radius-lg)', cursor: 'pointer',
        fontSize: 'var(--crm-text-sm)', color: sp.ink,
        background: survol ? sp.focusSurface : 'transparent',
      }}
    >
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {libelle}
      </span>
      {badge && badge.n > 0 && <Badge n={badge.n} urgent={badge.urgent} actif={false} sp={sp} />}
      {fermable && (
        <span
          role="button" aria-label={labelFermer}
          onClick={(e) => { e.stopPropagation(); onFermer() }}
          style={{
            width: 20, height: 20, borderRadius: 'var(--crm-radius-pill)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: sp.soft, flexShrink: 0,
          }}
        >
          <MEIcon name="close" size={9} strokeWidth={2.2} />
        </span>
      )}
    </div>
  )
}

/**
 * Clé i18n du libellé d'une section — la même table que la barre latérale.
 * ⚠ Les deux chromes doivent nommer une section À L'IDENTIQUE : lire « Biens »
 * dans la colonne et « Annonces » sur la puce ferait douter que ce soit le même
 * écran.
 */
export default CrmTabsBar
