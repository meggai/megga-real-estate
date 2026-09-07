/**
 * CrmSidebar — la coquille de navigation du CRM de bureau.
 *
 * Remplace les DEUX pièces de chrome d'avant : la barre du haut (`CrmTopNav`,
 * logo + 7 onglets + cluster d'actions à droite) et le rail de verre de 128 px
 * (`CrmIconRail`, outils transverses). Tout ce qu'elles portaient vit ici, dans
 * une seule colonne repliable — pages, outils, compte.
 *
 * Format (repris de la référence de design, reporté sur les jetons MEGGA X) :
 * carte flottante détachée du bord, 264 px ouverte / 84 px repliée, la
 * transition portée par la LARGEUR de l'`<aside>` et par elle seule — jamais par
 * ses enfants, qui apparaissent et disparaissent d'un coup. Quatre blocs dans
 * l'ordre : pastille de repli · identité de l'agence · nav · pied.
 *
 * Trois écarts assumés à la référence, chacun pour une raison mesurée :
 *
 * 1. **Pas de sélecteur de site.** La maquette bascule entre plusieurs cabinets.
 *    Le schéma ne le permet pas : `profiles.agency_id` est une colonne scalaire,
 *    il n'existe aucune table d'appartenance, et `get_my_agency_id()` — dont
 *    dépend chaque politique RLS — rend UN uuid. La ligne d'une seconde agence
 *    est littéralement illisible. Le bloc est donc une IDENTITÉ (logo, nom,
 *    ville) qui mène aux Réglages, pas un menu déroulant qui mentirait.
 * 2. **Rayons et espacements arrondis aux barreaux.** 28 → 24, 14 → 16, 22 → 20,
 *    26 → 24, 11 → 8. L'échelle est vérifiée contre la feuille de la vitrine
 *    (`megga-x-crm-tokens.spec.ts` fige le NOMBRE de barreaux et la liste des
 *    écarts) : ajouter un 28e rayon coûte un amendement écrit à trois assertions,
 *    pour un pixel et demi.
 * 3. **Ni micro-capitale ni interlettrage positif** sur la ligne de ville, que la
 *    maquette pose à `0.14em`. La grammaire MEGGA X les proscrit.
 *
 * ⚠ La barre est montée PAR PAGE, comme l'était le rail — pas hissée dans
 * `AgentLayout`. Hisser l'aurait posée sur la console super-admin (qui a son
 * propre chrome), sur `IdentityShell` (coquille MEGGA X plein écran) et sur
 * quatre autres routes qui n'en veulent pas, tout en la RETIRANT des bancs
 * `/dev/*`, qui sont des routes de premier niveau. D'où le repli persistant :
 * sans lui, replier la barre ne durerait que le temps d'un écran.
 */

import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { CrmPalette } from './tokens'
import { RailIcon } from './LiquidGlassRail'
import { CRM_SIDEBAR_GROUPS, crmSidebarActiveFor, crmSidebarRouteOf, type CrmSidebarSectionId } from './crmSidebarNav'
import { useCrmSidebarCollapsed } from '@/lib/crmSidebar'
import { useIsMobile, useMediaQuery } from '@/hooks/useMediaQuery'
import { useAuth } from '@/hooks/useAuth'
import { useAgencySettings } from '@/hooks/useAgencySettings'
import { useAgencyObjective } from '@/hooks/useAgencyObjective'
import { useAiPanel } from '@/hooks/useAiPanel'
import { openHelpFor } from '@/lib/help-articles'
import { RelanceSession } from './today/RelanceSession'
import CrmProfileDropdown from './profile/CrmProfileDropdown'
import { formatCHF } from '@/lib/utils'

/** Largeurs de la carte. Ni l'une ni l'autre n'est une valeur d'échelle : la
 *  grammaire tokenise les rayons, espacements et tailles de texte — pas les
 *  dimensions d'un conteneur. */
const W_OPEN = 264
const W_COLLAPSED = 84

/**
 * Taille du glyphe d'une ligne.
 *
 * ⚠ 20, PAS PLUS, et la borne est mesurée : la hauteur d'une ligne dépliée est
 * portée par la boîte de ligne du libellé — 14 px × 1,5 de la préflight
 * Tailwind = 21 px. Un glyphe de 20 se loge dessous sans rien pousser ; à 22 il
 * prend la main et la ligne grandit de 2 px, seize fois, ce qui repousse la
 * liste sous le pli. Le repli, lui, a toute la place (84 px).
 */
const ICON = 20

// ─── Ligne de navigation ───────────────────────────────────────────────────
// Un bouton, deux formes : rangée à gauche quand la barre est ouverte, glyphe
// centré quand elle est repliée. Le libellé ne se comprime PAS — il disparaît.
// `overflow: hidden` sur le bouton : pendant les 250 ms de glissade, un libellé
// encore monté dans une barre déjà étroite déborderait sinon sur la marge.
//
// ⛔ GLYPHE STATIQUE (`RailIcon`), pas le tracé animé du rail. Décision Julien du
// 4 septembre 2026 : seize lignes qui se redessinent et rebondissent au passage
// du curseur font grouiller la colonne. Le seul mouvement qui reste sur une
// ligne est sa couleur de fond, en .18s. Le rejeu par nonce part avec — donc
// aussi le re-rendu que chaque survol provoquait.

interface RowProps {
  icon: string
  label: string
  active?: boolean
  collapsed: boolean
  onClick: () => void
  sp: CrmPalette
  /** Pastille de droite (compteur de notifications). */
  trail?: ReactNode
  /** Point rouge de la forme repliée, quand `trail` n'a plus de place. */
  dot?: boolean
  /**
   * Nom accessible, quand le libellé seul ment. ⚠ `aria-label` REMPLACE le
   * contenu du bouton dans le calcul du nom : sans ce passe-plat, la pastille
   * « 3 » de la cloche était muette pour un lecteur d'écran — et invisible tout
   * court barre repliée, où la pastille n'est pas rendue.
   */
  ariaLabel?: string
  /** Ces deux-là pour les lignes qui OUVRENT quelque chose au lieu de router. */
  expanded?: boolean
  haspopup?: 'dialog' | 'menu'
}

function SidebarRow({
  icon, label, active = false, collapsed, onClick, sp, trail, dot,
  ariaLabel, expanded, haspopup,
}: RowProps) {
  const [hover, setHover] = useState(false)

  const bg = active ? sp.accent : hover ? sp.focusSurface : 'transparent'
  const ink = active ? sp.accentInk : hover ? sp.ink : sp.sub

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={label}
      aria-label={ariaLabel ?? label}
      aria-current={active && !haspopup ? 'page' : undefined}
      aria-expanded={haspopup ? expanded : undefined}
      aria-haspopup={haspopup}
      style={{
        position: 'relative',
        display: 'flex', alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'flex-start',
        gap: 'var(--crm-space-lg)',
        width: '100%', overflow: 'hidden',
        padding: collapsed
          ? 'var(--crm-space-md) 0'
          : 'var(--crm-space-md) var(--crm-space-2xl)',
        borderRadius: 'var(--crm-radius-xl)', border: 0,
        background: bg, color: ink,
        fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)',
        fontWeight: active ? 600 : 500,
        textAlign: 'left', cursor: 'pointer',
        transition: 'background-color .18s ease, color .18s ease',
      }}
    >
      <span style={{ display: 'grid', placeItems: 'center', flexShrink: 0 }}>
        <RailIcon name={icon} size={ICON} />
      </span>
      {!collapsed && (
        <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {label}
        </span>
      )}
      {!collapsed && trail}
      {collapsed && dot && (
        <span aria-hidden style={{
          position: 'absolute', top: 6, right: 14,
          width: 8, height: 8, borderRadius: 'var(--crm-radius-pill)',
          background: '#E53935', border: `2px solid ${sp.frameBg}`,
        }} />
      )}
    </button>
  )
}

// ─── Sur-titre de groupe ───────────────────────────────────────────────────
// ⛔ La référence de design disait « aucune séparation visuelle entre les
// groupes, seul l'ordre les signale ». À dix entrées, l'ordre seul ne signale
// plus rien (retour de Julien, 4 septembre 2026). Même idiome que la console
// super-admin, qui groupe déjà sa nav en cinq sections libellées : 12 px / 600 /
// `sp.sub`, sans capitale ni filet.
//
// ⚠ Repliée, la barre n'a pas 84 px pour un mot : le sur-titre cède la place à
// un FILET. Sans lui, dix-sept glyphes s'alignent sans respiration et la colonne
// redevient la liste indifférenciée qu'on vient de découper.
//
// ⛔ LES SUR-TITRES SONT RETIRÉS DEPUIS LE 7 SEPTEMBRE 2026 (Julien : « enlève
// les catégories »). Le découpage en groupes SURVIT — il ordonne la liste, il
// nomme les groupes pour un lecteur d'écran (`role="group"` + `aria-label`), et
// c'est lui que rend la grille de la page d'onglet neuf. Ce qui part est le mot
// affiché, rien d'autre : on revient à ce que la référence de design prescrivait
// avant le 4 septembre — « aucune séparation visuelle entre les groupes, seul
// l'ordre les signale ».
//
// ⚠ ET LE FILET DU MODE REPLIÉ RESTE. Ce n'est pas une catégorie — c'est un
// trait, dans une colonne où aucun mot n'est affiché de toute façon. Le retirer
// coûterait la seule respiration de dix-sept glyphes empilés, sans rien rendre
// à personne.

function GroupLabel({ collapsed, first = false, sp }: {
  collapsed: boolean; first?: boolean; sp: CrmPalette
}) {
  if (collapsed) {
    // ⚠ Rien au-dessus du PREMIER groupe : un filet juste sous le bloc d'agence
    // ne sépare rien — il redouble la bordure de la carte et se lit comme une
    // erreur. Les filets ne servent qu'entre deux groupes.
    if (first) return null
    return (
      <div aria-hidden style={{
        height: 1, background: sp.frameBorder,
        margin: 'var(--crm-space-sm) var(--crm-space-lg) var(--crm-space-xs)',
      }} />
    )
  }
  // Dépliée : plus rien. Le groupe reste un groupe pour l'ordre et pour
  // l'accessibilité, il n'a simplement plus de titre visible.
  return null
}

// ─── Encart de synthèse — l'objectif de la période ─────────────────────────
// La maquette pose une métrique dentaire (occupation des fauteuils) ; la FORME
// se reprend telle quelle avec la seule grandeur du CRM qui ait un numérateur ET
// un dénominateur : les commissions réalisées contre l'objectif saisi.
//
// ⚠ Règle d'honnêteté déjà encodée côté Analytics : objectif NON saisi ⇒ pas de
// jauge (elle n'aurait rien à mesurer), un renvoi vers le cockpit à la place —
// vers ANALYTICS, seule surface de bureau où l'objectif se saisit ; les Réglages
// n'ont aucun champ pour lui.

function ObjectiveCard({ sp, collapsed, onGoSettings }: {
  sp: CrmPalette; collapsed: boolean; onGoSettings: () => void
}) {
  const { t } = useTranslation('dashboard')
  const { data } = useAgencyObjective('month', 'me')

  if (!data) return null

  if (!data.targetIsSet) {
    // Replié, une invitation ne tient pas : on ne montre rien plutôt qu'un
    // anneau vide qui se lirait comme « objectif atteint à 0 % ».
    if (collapsed) return null
    return (
      <button
        type="button"
        onClick={onGoSettings}
        style={{
          background: sp.cardBg, border: `1px solid ${sp.cardBorder}`,
          borderRadius: 'var(--crm-radius-4xl)',
          padding: 'var(--crm-space-lg) var(--crm-space-2xl)',
          color: sp.sub, fontFamily: 'inherit', fontSize: 'var(--crm-text-xs)',
          fontWeight: 500, textAlign: 'left', cursor: 'pointer', width: '100%',
          boxShadow: sp.shadow,
        }}
      >
        {t('analytics.hero.targetUnsetHint')}
      </button>
    )
  }

  // ⚠ DEUX pourcentages, et c'est voulu. `pct` est la valeur ANNONCÉE, tirée du
  // ratio brut : un agent à 118 % de son objectif doit lire 118, pas 100 —
  // sinon le chiffre contredit les deux montants imprimés deux lignes plus bas.
  // `jauge` est la GÉOMÉTRIE, bornée : une barre ne dépasse pas son rail, et un
  // anneau conique au-delà de 360° repart à zéro, ce qui se lirait « 0 % ».
  const pct = data.target > 0 ? Math.round((data.realized / data.target) * 100) : 0
  const jauge = Math.round(data.realizedFrac * 100)

  if (collapsed) {
    return (
      <div
        title={`${t('analytics.hero.objectiveLabel')} · ${pct}%`}
        style={{
          alignSelf: 'center', width: 46, height: 46,
          borderRadius: 'var(--crm-radius-pill)',
          background: `conic-gradient(${sp.accent} ${jauge * 3.6}deg, ${sp.focusSurface} 0)`,
          display: 'grid', placeItems: 'center', flexShrink: 0,
        }}
      >
        <div style={{
          width: 36, height: 36, borderRadius: 'var(--crm-radius-pill)',
          background: sp.frameBg, display: 'grid', placeItems: 'center',
          fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: sp.ink,
        }}>{pct}</div>
      </div>
    )
  }

  return (
    <div style={{
      background: sp.cardBg, border: `1px solid ${sp.cardBorder}`,
      borderRadius: 'var(--crm-radius-4xl)',
      padding: 'var(--crm-space-lg) var(--crm-space-2xl)',
      boxShadow: sp.shadow,
    }}>
      <div style={{
        fontSize: 'var(--crm-text-xs)', color: sp.sub, fontWeight: 500,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {t('analytics.hero.objectiveLabel')} · {t('analytics.period.month.label')}
      </div>
      <div style={{
        display: 'flex', alignItems: 'baseline', gap: 'var(--crm-space-2xs)',
        marginTop: 'var(--crm-space-2xs)',
      }}>
        <span style={{
          fontSize: 'var(--crm-text-4xl)', fontWeight: 500, color: sp.ink,
          letterSpacing: -0.4, fontVariantNumeric: 'tabular-nums',
        }}>{pct}</span>
        <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 500, color: sp.ink }}>%</span>
      </div>
      <div style={{
        height: 5, borderRadius: 'var(--crm-radius-pill)', background: sp.focusSurface,
        marginTop: 'var(--crm-space-sm)', overflow: 'hidden',
      }}>
        <div style={{
          width: `${jauge}%`, height: '100%',
          borderRadius: 'var(--crm-radius-pill)', background: sp.accent,
          transition: 'width .4s ease',
        }} />
      </div>
      <div style={{
        fontSize: 'var(--crm-text-xs)', color: sp.sub, marginTop: 'var(--crm-space-sm)',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {formatCHF(data.realized)} / {formatCHF(data.target)}
      </div>
    </div>
  )
}

// ─── La barre ──────────────────────────────────────────────────────────────

export interface CrmSidebarProps {
  /**
   * Section allumée. Omise, elle se DÉDUIT de la route — c'est le mode normal.
   * Elle reste acceptée pour les surfaces dont le chemin ne dit pas l'écran
   * (les bancs `/dev/*`), et parce que le catalogue d'aide lit ces littéraux
   * pour savoir quelles clés d'article sont émises par une surface.
   */
  active?: string
  /** Clé d'aide de l'écran, quand elle ne se déduit pas de la section. */
  helpKey?: string
  sp: CrmPalette
  dark: boolean
  setDark: (v: boolean) => void
  /**
   * Geste « créer » propre à l'écran. Absent, la ligne n'est pas rendue — un
   * bouton qui ne fait rien doit disparaître, pas rester gris.
   */
  onCmd?: () => void
}

export function CrmSidebar({ active, helpKey, sp, dark, setDark, onCmd }: CrmSidebarProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation('common')
  const { signOut, profile, user } = useAuth()
  // ⚠ `agencySaved`, pas `agency` : le second est le tampon d'édition des
  // Réglages, vide au premier rendu. La barre se remonte à chaque navigation —
  // le lire ferait clignoter « Agence non définie » sur une agence parfaitement
  // définie, et déjà en cache.
  const { agencySaved: agency, isLoading: agencyLoading } = useAgencySettings()
  const ai = useAiPanel()
  const isMobile = useIsMobile()

  const [stored, setStored] = useCrmSidebarCollapsed()
  // ⚠ Le dock MEGGA AI comprime le contenu de 404 px (`COPILOT_WIDTH`), et cette
  // compression S'AJOUTE aux 276 px de la barre. Mesuré à 1280 px, dock ouvert,
  // barre ouverte : il reste 600 px de travail — moins que les 300 px d'aside
  // des Réglages plus leur colonne, et moins que les 296 px du calendrier plus
  // sa grille. La barre se replie donc d'elle-même tant que le dock est ouvert
  // sur un écran étroit ; le RÉGLAGE de l'agent n'est pas touché (`stored` reste
  // ce qu'il était), la barre le retrouve en fermant le dock.
  const serre = useMediaQuery('(max-width: 1439px)')
  // Sous 768 px la barre est TOUJOURS repliée : trois routes du CRM
  // (`/dashboard/audit`, `market/:externalId`, `listings/:id/edit`) n'ont pas de
  // variante mobile et rendent cette coquille telle quelle sur un téléphone —
  // 264 px y prendraient 70 % de la largeur.
  const collapsed = isMobile || (ai.enabled && ai.isOpen && serre) || stored

  const [relanceOpen, setRelanceOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  // ⚠ On mémorise l'URL QUI A ÉCHOUÉ, pas un booléen « cassée ». Un booléen
  // demanderait un effet pour le réarmer quand l'agence remplace son logo — et
  // un `setState` dans un effet est précisément ce que la règle `react-hooks`
  // du dépôt refuse. Comparer l'URL courante à celle qui a échoué se dérive du
  // rendu, sans effet ni re-rendu en cascade.
  const [brokenLogo, setBrokenLogo] = useState<string | null>(null)
  const [brokenAvatar, setBrokenAvatar] = useState<string | null>(null)
  const profileAnchorRef = useRef<HTMLDivElement>(null)


  // Fermeture de la popover du compte : clic dehors et Échap.
  // ⚠ Elle en gardait DEUX, celle des notifications comprise. Cette dernière est
  // partie dans la bande d'onglets le 7 septembre 2026, et son couple d'écouteurs
  // avec elle : laisser ici un `notifOpen` qui ne s'ouvre plus aurait fait un
  // état mort que rien ne signale.
  useEffect(() => {
    if (!profileOpen) return
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (profileAnchorRef.current && !profileAnchorRef.current.contains(target)) setProfileOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setProfileOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [profileOpen])

  const activeId = active ?? crmSidebarActiveFor(location.pathname) ?? undefined

  // Tant que la lecture n'a pas répondu, on n'affirme RIEN : une chaîne vide
  // laisse la place, « Agence non définie » serait un mensonge de 300 ms.
  const agencyName = agency?.name?.trim() || (agencyLoading ? '' : t('profile.noAgency'))
  const agencyCity = agency?.city?.trim() || ''
  const agencyLogo = agency?.logoUrl?.trim() || ''
  const agencyInitials = (agency?.name?.trim() || (agencyLoading ? '' : 'MG'))
    .split(/\s+/).map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()

  const displayName = profile?.full_name?.trim() || user?.email?.split('@')[0] || t('profile.defaultName')
  const displayInitials = displayName
    .split(/\s+/).map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '??'
  const avatarUrl = profile?.avatar_url?.trim() || ''

  /**
   * ⛔ LA BARRE NE NAVIGUE PAS DEPUIS UN BANC `/dev/*`, et ce n'est pas un
   * confort. Un banc se visite SANS session ; une cible `/dashboard/*` y fait
   * faire à `ProtectedRoute` un `window.location.replace('https://megga.ch/login')`
   * — on croit cliquer dans localhost, on atterrit en production, et le banc
   * existe précisément pour éviter ça. Le rail d'avant recevait un `onNavigate`
   * neutralisé de chaque banc ; la barre routant elle-même, la règle vit ici,
   * en UN endroit qui couvre aussi les bancs à venir. `/dev/*` est bien la
   * frontière des bancs — `dev-bancs-frontiere.spec.ts` la garde.
   *
   * ⚠ Ne concerne QUE les cibles de la barre. Les outils (recherche, relances)
   * agissent sur place et marchent sur un banc, comme avec le rail.
   */
  const enBanc = location.pathname.startsWith('/dev/')
  const goto = (id: CrmSidebarSectionId) => {
    if (enBanc) return
    const route = crmSidebarRouteOf(id)
    if (route) navigate(route)
  }

  // Outils transverses. Les PAGES sont au-dessus ; aucune ligne n'est reprise
  // dans les deux groupes.
  //
  // ⛔ « RECHERCHER » N'EST PLUS ICI (7 septembre 2026, Julien : « on n'a plus
  // vraiment besoin, comme on ouvre un onglet on a déjà la recherche »). La page
  // d'onglet neuf rend `CrmSearch` dans son corps, champ focalisé ; ⌘K y mène,
  // et le « + » de la bande aussi. Une loupe qui ouvre un voile par-dessus
  // l'écran faisait un second chemin vers la même chose — celui-là même dont la
  // refonte du champ devait sortir.
  //
  // ⚠ La ligne « Créer » (`onCmd`), elle, reste : elle n'est rendue que lorsque
  // l'écran fournit réellement un geste de création.
  const tools: { id: string; icon: string; label: string; action: () => void }[] = [
    ...(onCmd ? [{ id: 'add', icon: 'plus', label: t('actions.create'), action: onCmd }] : []),
    { id: 'relances', icon: 'phone', label: t('nav.callbacksToday'), action: () => setRelanceOpen(true) },
    { id: 'import', icon: 'download', label: t('nav.importLeads'), action: () => { if (!enBanc) navigate('/dashboard/import-lead') } },
    // ⚠ `openHelpFor()` SANS ARGUMENT, et c'est tout le sujet : sans clé, il
    // ouvre l'onglet Aide — les 18 articles, la recherche, Fin. La ligne « Aide
    // sur cet écran » du menu de compte, elle, passe une clé et saute à UN
    // article. Six articles publiés n'ont aucun écran et ne sont atteignables
    // que par cette recherche : garder les deux entrées n'est pas un doublon.
    { id: 'help', icon: 'help', label: t('nav.helpCenter'), action: () => openHelpFor() },
  ]

  const listStyle: CSSProperties = {
    display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xs)',
  }

  return (
    <>
      <aside
        aria-label={t('nav.mainNav')}
        style={{
          position: 'sticky', top: 'var(--crm-space-lg)',
          // ⚠ 75, la valeur que portait la barre du haut, et pour la même
          // raison : `position:sticky` crée un contexte d'empilement, donc les
          // deux popovers (z 9000) sont PLAFONNÉES par celui de l'`<aside>`.
          // À 10, elles passaient sous le panneau MEGGA AI (z 70). En dessous
          // des deux plein-écran qui doivent, eux, couvrir la barre.
          zIndex: 75,
          width: collapsed ? W_COLLAPSED : W_OPEN, flexShrink: 0,
          // ⛔ LA HAUTEUR SE DÉRIVE DES MÊMES BARREAUX QUE LES GOUTTIÈRES DU
          // `<main>`, elle ne se recalcule pas à la main. Elle valait
          // `calc(100vh - 34px)` — 12 en haut + 22 en bas, accordés au doigt sur
          // le `paddingBottom` de l'époque. Sept surfaces fermaient bien à 22,
          // mais cinq autres (les pagers, les Réglages, le Calendrier) fermaient
          // déjà à `--crm-space-6xl` : sur celles-là, la carte dépassait le cadre
          // de 2 px. Une gouttière écrite à trois endroits finit toujours par
          // diverger ; écrite en `calc` sur les jetons, elle suit.
          // ⚠ ET DEPUIS LE 7 SEPTEMBRE 2026, ELLE DÉFALQUE AUSSI LA BANDE. Celle-ci
          // est passée pleine largeur AU-DESSUS de la carte : sans ce terme, la
          // carte faisait 864 px là où le contenu en faisait 834 — trente pixels
          // d'écart entre deux cartes censées border le même cadre (mesuré).
          // `--crm-chrome-top` vaut 42 avec la bande, 12 sans (mobile, bancs), et
          // c'est le MÊME jeton que lit le dock MEGGA AI.
          // ⛔ UN `calc` CONTRE `100vh`, ET PAS UN `alignSelf: stretch`. Essayé,
          // mesuré, retiré : la rangée qui l'accueille n'a pas de hauteur DÉFINIE
          // (elle est `flex: 1` dans une colonne qui n'en a pas non plus), donc
          // `stretch` lui donnait celle du CONTENU — la carte est passée à 114 px
          // et la page s'est mise à défiler jusqu'à 1132. Une hauteur qui se
          // dérive demande une hauteur définie quelque part ; ici il n'y en a pas.
          height: 'calc(100vh - var(--crm-chrome-top, var(--crm-space-lg)) - var(--crm-space-6xl))',
          // ⚠ La marge haute REVIENT, et elle vaut le `padding-top` du `<main>` :
          // c'est ce qui met la carte latérale et le cadre bento sur la MÊME
          // ligne. Sans elle, la carte commençait à 42 et le cadre à 54.
          margin: 'var(--crm-space-lg) 0 0 var(--crm-space-lg)',
          background: sp.frameBg,
          border: `1px solid ${sp.frameBorder}`,
          borderRadius: 'var(--crm-radius-6xl)',
          boxShadow: sp.shadow,
          padding: 'var(--crm-space-4xl) var(--crm-space-2xl)',
          display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4xl)',
          // ⚠ La transition porte sur la LARGEUR de la carte, et sur elle
          // seule. Animer aussi les enfants ferait glisser dix lignes et un
          // libellé chacune : la barre paraîtrait molle au lieu de nette.
          transition: 'width .25s ease',
          fontFamily: 'var(--crm-font), system-ui, sans-serif',
        }}
      >
        {/* ── 1. Pastille de repli — à cheval sur la bordure droite ────────── */}
        {!isMobile && !(ai.enabled && ai.isOpen && serre) && (
          <button
            type="button"
            onClick={() => setStored(!stored)}
            title={collapsed ? t('nav.expandSidebar') : t('nav.collapseSidebar')}
            aria-label={collapsed ? t('nav.expandSidebar') : t('nav.collapseSidebar')}
            aria-expanded={!collapsed}
            style={{
              // ⚠ 34 depuis le retrait du wordmark, pas 26 : la pastille se
              // cale sur le CENTRE du logo d'agence, qui a remonté avec lui.
              // 20 (padding de la carte) + 8 (padding du bouton) + 20 (demi-logo)
              // − 14 (demi-pastille) = 34. Mesuré à l'écran après coup.
              position: 'absolute', top: 34, right: -14,
              width: 28, height: 28, padding: 0,
              borderRadius: 'var(--crm-radius-pill)',
              background: sp.cardBg, border: `1px solid ${sp.frameBorder}`,
              color: sp.sub, display: 'grid', placeItems: 'center',
              cursor: 'pointer', zIndex: 5, boxShadow: sp.shadow,
              transition: 'background-color .18s ease, color .18s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = sp.focusSurface; e.currentTarget.style.color = sp.ink }}
            onMouseLeave={e => { e.currentTarget.style.background = sp.cardBg; e.currentTarget.style.color = sp.sub }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d={collapsed ? 'M10 6l6 6-6 6' : 'M14 6l-6 6 6 6'} />
            </svg>
          </button>
        )}

        {/* ── 2. Identité de l'agence ──────────────────────────────────────
               ⛔ PAS de wordmark MEGGA au-dessus (retiré le 5 septembre 2026,
               décision Julien). Il y était depuis que la barre du haut, qui le
               portait, a disparu — mais deux marques empilées en 264 px, dont
               une que l'agent ne clique jamais, coûtaient 38 px de hauteur au
               seul bloc qui l'intéresse : le sien. La marque du produit vit
               dans l'onglet du navigateur et sur l'écran de connexion ; le haut
               de la barre appartient à l'agence. Le mobile, lui, garde
               `MeggaWordmark` sur ses huit écrans. */}
        <div>
          <button
            type="button"
            onClick={() => goto('settings')}
            title={agencyCity ? `${agencyName} · ${agencyCity}` : agencyName}
            style={{
              display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)',
              justifyContent: collapsed ? 'center' : 'flex-start',
              padding: 'var(--crm-space-sm)', borderRadius: 'var(--crm-radius-4xl)',
              border: 0, background: 'transparent', width: '100%', overflow: 'hidden',
              cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
              transition: 'background-color .18s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = sp.focusSurface }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            <span style={{
              width: 40, height: 40, flexShrink: 0, overflow: 'hidden',
              borderRadius: 'var(--crm-radius-pill)',
              background: sp.cardSubBg, border: `1px solid ${sp.frameBorder}`,
              display: 'grid', placeItems: 'center',
            }}>
              {/* ⚠ Un vrai <img> et non un background-image : une URL morte doit
                  retomber sur les initiales, ce qu'un fond ne sait pas faire. */}
              {agencyLogo && brokenLogo !== agencyLogo ? (
                <img
                  src={agencyLogo} alt="" loading="lazy"
                  onError={() => setBrokenLogo(agencyLogo)}
                  style={{ width: 24, height: 24, objectFit: 'contain' }}
                />
              ) : (
                <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: sp.ink }}>
                  {agencyInitials}
                </span>
              )}
            </span>
            {!collapsed && (
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{
                  display: 'block', fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: sp.ink,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{agencyName}</span>
                {agencyCity && (
                  <span style={{
                    display: 'block', fontSize: 'var(--crm-text-xs)', color: sp.sub,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>{agencyCity}</span>
                )}
              </span>
            )}
          </button>
        </div>

        {/* ── 3. Nav : quatre groupes de pages, puis les outils ───────────── */}
        {/* ⛔ PAS de `scrollbar-hide` ici. Seize lignes ne tiennent pas sous
            ~900 px de hauteur utile : mesuré, à 800 px « Importer des leads »,
            « Megga, Agent IA » et « Notifications » passent sous un pli — et
            masquer la barre de défilement retirait le SEUL indice qu'il y a
            quelque chose en dessous. Le dégradé de bas double l'indice là où le
            système peint des barres en survol (macOS). */}
        <div
          style={{
            flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden',
            display: 'flex', flexDirection: 'column',
            maskImage: 'linear-gradient(to bottom, #000 calc(100% - 18px), transparent)',
            WebkitMaskImage: 'linear-gradient(to bottom, #000 calc(100% - 18px), transparent)',
          }}
        >
          <nav aria-label={t('nav.mainNav')} style={{ display: 'flex', flexDirection: 'column' }}>
            {CRM_SIDEBAR_GROUPS.map((g, i) => (
              <div key={g.labelKey} role="group" aria-label={t(g.labelKey)}>
                <GroupLabel collapsed={collapsed} first={i === 0} sp={sp} />
                <div style={listStyle}>
                  {g.items.map(s => (
                    <SidebarRow
                      key={s.id}
                      icon={s.icon}
                      label={t(s.labelKey)}
                      active={activeId === s.id}
                      collapsed={collapsed}
                      onClick={() => goto(s.id)}
                      sp={sp}
                    />
                  ))}
                </div>
              </div>
            ))}
          </nav>

          <div role="group" aria-label={t('nav.sectionTools')}>
            <GroupLabel collapsed={collapsed} sp={sp} />
            <div style={listStyle}>
            {tools.map(it => (
              <SidebarRow
                key={it.id}
                icon={it.icon}
                label={it.label}
                collapsed={collapsed}
                onClick={it.action}
                sp={sp}
              />
            ))}

            {/* ⚠ MEGGA AI N'EST PLUS ICI (4 septembre 2026) : ✦ a migré dans le
                quart droit de la barre d'onglets. Le panneau s'ouvre PAR LA DROITE,
                donc un déclencheur ancré à droite dit d'où vient la chose — et la
                bande d'onglets laissait 241 px vides à 1280 px, ~880 à 1920.
                Déplacé, jamais dupliqué : deux boutons pour un même panneau, chacun
                portant l'état « ouvert », se contredisent dès qu'on en regarde un
                seul. */}
            </div>
          </div>
        </div>

        {/* ── 4. Pied : encart de synthèse + compte ────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-lg)' }}>
          {/* ⛔ LES NOTIFICATIONS NE SONT PLUS ICI (7 septembre 2026, Julien :
              « qu'elles soient en haut à droite, pour gagner un peu de place dans
              la sidebar »). Elles occupaient une LIGNE PLEINE du pied — glyphe,
              libellé, compteur — pour un indicateur qui n'a besoin que d'un
              glyphe et d'un chiffre. Elles rejoignent le quart droit de la bande
              d'onglets, avec ✦ et le thème : la grappe des commandes d'ÉTAT, par
              opposition aux DESTINATIONS que porte cette carte.

              ⚠ La popover suit, et elle y gagne : elle s'ancrait à une ligne qui
              pouvait défiler sous ~900 px de haut, elle s'ancre désormais à une
              commande qui ne défile jamais. C'était d'ailleurs le motif qui
              l'avait fait descendre dans le pied ; la bande le sert mieux. */}

          {/* ⚠ Vers ANALYTICS, pas les Réglages : l'objectif se saisit dans
              l'AxGate du cockpit, il n'existe aucun champ « objectif » dans les
              Réglages. Envoyer l'agent là-bas lui ferait chercher en vain. */}
          <ObjectiveCard sp={sp} collapsed={collapsed} onGoSettings={() => goto('dashboard')} />

          <div ref={profileAnchorRef} style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setProfileOpen(o => !o)}
              aria-haspopup="menu"
              aria-expanded={profileOpen}
              title={displayName}
              style={{
                display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)',
                justifyContent: collapsed ? 'center' : 'flex-start',
                width: '100%', overflow: 'hidden',
                padding: 'var(--crm-space-sm)', borderRadius: 'var(--crm-radius-4xl)',
                border: 0, background: profileOpen ? sp.focusSurface : 'transparent',
                cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                transition: 'background-color .18s ease',
              }}
            >
              <span style={{
                width: 36, height: 36, flexShrink: 0, overflow: 'hidden',
                borderRadius: 'var(--crm-radius-pill)',
                background: sp.accent, color: sp.accentInk,
                display: 'grid', placeItems: 'center',
                fontSize: 'var(--crm-text-md)', fontWeight: 600,
              }}>
                {avatarUrl && brokenAvatar !== avatarUrl ? (
                  <img
                    src={avatarUrl} alt="" loading="lazy"
                    onError={() => setBrokenAvatar(avatarUrl)}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : displayInitials}
              </span>
              {/* ⚠ Le NOM seul. La deuxième ligne portait le rôle (« Agent »,
                  « Manager »…) — retirée le 5 septembre 2026, décision Julien,
                  en même temps que le sous-titre du menu de compte qu'elle
                  redoublait. Un agent connaît son rôle ; l'afficher deux fois
                  sous son propre nom ne lui apprend rien et vole une ligne au
                  pied de la barre. */}
              {!collapsed && (
                <span style={{
                  flex: 1, minWidth: 0,
                  fontSize: 'var(--crm-text-md)', fontWeight: 600, color: sp.ink,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{displayName}</span>
              )}
            </button>
            {profileOpen && (
              <CrmProfileDropdown
                sp={sp}
                dark={dark}
                setDark={setDark}
                placement="side"
                onClose={() => setProfileOpen(false)}
                onSettings={() => goto('settings')}
                onKyc={() => goto('kyc')}
                onAgencyPublic={() => window.open('/agencies', '_blank', 'noopener,noreferrer')}
                onHelp={() => openHelpFor(helpKey ?? activeId)}
                onLogout={async () => { await signOut(); navigate('/login') }}
              />
            )}
          </div>
        </div>
      </aside>

      {/* Session de relance — la barre en hérite du rail : elle en portait
          l'état ET le montage, et c'était l'UNIQUE porte d'entrée de bureau. */}
      {relanceOpen && <RelanceSession onClose={() => setRelanceOpen(false)} />}
    </>
  )
}
