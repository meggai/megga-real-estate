/**
 * Layout des pages CRM Sugar v2 (route parente des surfaces agent). Volontairement
 * dépouillé : ni sidebar, ni breadcrumb, ni bottom bar — les pages Sugar portent
 * leur propre chrome. Fournit thème + contexte copilote, la bannière
 * d'impersonation, le « push » du contenu quand le panneau MEGGA AI est ouvert,
 * et le gate identité légale (étape 2 KYB) qui redirige vers /dashboard/identite
 * tant que le dirigeant n'a pas soumis l'identité de son agence.
 *
 * Ne porte PLUS le bandeau du garde LAB depuis le 04.08.2026 : il est monté dans
 * IdentityShell, dans la coquille MEGGA X (cf. son en-tête).
 */
import { useState, useEffect, useMemo, memo, Suspense } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Routes, Navigate, useLocation } from 'react-router-dom'
import { ThemeProvider } from '@/hooks/useTheme'
import { CopilotContextProvider } from '@/hooks/useCopilotContext'
import { useAiPanel } from '@/hooks/useAiPanel'
import { COPILOT_WIDTH } from '@/components/ai-copilot/panel/aiPanel'
import { crmPalette } from '@/components/crm/tokens'
import ImpersonateBanner from '@/components/admin/ImpersonateBanner'
import BootSplash from '@/components/layout/BootSplash'
import SmartPageLoader from '@/components/skeletons/SmartPageLoader'
import { EcranActifProvider } from '@/hooks/useEcranActif'
import OnboardingCallBanner from '@/components/layout/OnboardingCallBanner'
import CrmSearchHost from '@/components/crm/search/CrmSearchHost'
import { CrmTabsProvider } from '@/components/crm/CrmTabsProvider'
import { useIdentityGate, shouldRedirectToIdentityGate, shouldHoldForIdentityGate, IDENTITY_GATE_ROUTE } from '@/hooks/useIdentityGate'
import { readCrmDark } from '@/lib/crmDark'
import { useCrmTabsOptionnel } from '@/hooks/useCrmTabs'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { crmEcransVivants, crmTabHref, type CrmTab } from '@/lib/crmTabs'
import { QueryClientProvider, useQueryClient } from '@tanstack/react-query'
import { clientArrierePlan } from '@/lib/queryClients'

/** Lit la préférence de thème sombre Sugar (fallback : préférence système). */
// Mode sombre Sugar (même clé localStorage que les pages). Réactif : `storage`
// (cross-onglet) + relecture courte tant que le panneau est ouvert (le fond de
// la gouttière du push doit suivre le thème Sugar, pas le thème app `data-theme`).

/**
 * AgentLayout — barebones wrapper for Sugar v2 CRM pages.
 *
 * Unlike AgentLayout, it does NOT render a sidebar, breadcrumb, mobile header
 * or bottom tab bar. The Sugar pages provide their own chrome
 * (CrmSidebar — one collapsible left column carrying pages, tools and account).
 *
 * Kept utilities:
 *  - ThemeProvider (so toggling clair/sombre stays in sync with the rest of
 *    the app's CSS variables, even though Sugar uses its own tokens)
 *  - CopilotContextProvider (kept for cross-page MEGGA AI context)
 *  - Push du contenu quand le panneau MEGGA AI est ouvert (le panneau lui-même
 *    est monté dans App.tsx, au-dessus de <Routes>, pour persister à la nav)
 *  - ImpersonateBanner (super-admin must always see they are impersonating)
 *  - Identity gate (useIdentityGate) — swaps <Outlet/> for a <Navigate> to
 *    /dashboard/identite while status === 'required'. Never redirects on an
 *    unresolved ('loading') status, and never redirects the identity route
 *    to itself (shouldRedirectToIdentityGate) — see the P0 incident notes on
 *    the gate call below.
 */

/**
 * Combien d'écrans restent VIVANTS derrière l'onglet affiché.
 *
 * ⛔ POURQUOI PAS TOUS. Un écran vivant garde ses abonnements Realtime, ses
 * requêtes et ses minuteries : vingt-quatre onglets vivants, c'est vingt-quatre
 * fois ça, et le plafond de la pile est justement de 24.
 *
 * ── DE TROIS À SIX (7 septembre 2026, décision Julien) ───────────────────────
 * Trois couvrait le geste dominant — l'aller-retour entre deux onglets, plus un
 * pour le détour. Ça ne couvre PAS le régime réel : Julien travaille à dix ou
 * quinze onglets ouverts, et à quatorze onglets **seuls 2 des 13 autres sont
 * vivants**. ~85 % des bascules RECONSTRUISAIENT donc l'écran — état local perdu
 * (`useTabScopedState` ne porte que 14 des ~38 positions d'écran), requêtes
 * rejouées, chrome remonté. Le mécanisme d'écrans vivants ne servait qu'une
 * bascule sur sept. À six, cinq des treize sont vivants : la part des bascules
 * qui reconstruisent tombe de ~85 % à ~62 %, et l'aller-retour dans un groupe de
 * travail de cinq ou six onglets — le geste réel — cesse d'en payer une seule.
 *
 * ⚠ ET LA HAUSSE A ÉTÉ PAYÉE, PAS SEULEMENT DÉCIDÉE. Doubler le nombre d'écrans
 * vivants doublait mécaniquement ce que cette JSDoc donne comme motif de ne pas
 * les garder tous. Deux choses l'en empêchent, et sans elles six serait un mauvais
 * réglage :
 *   • le chrome est per-page, donc six écrans = six bandes d'onglets, et la
 *     cloche de chacune ouvrait son propre canal Realtime sur `activity_events`.
 *     Seule la bande de l'écran VISIBLE s'abonne désormais
 *     (`useAgentNotifications(30, ecranActif)`) : un canal, quel que soit ce
 *     nombre. La lecture, elle, était déjà partagée par React Query.
 *   • `EcranVivant` est sous `memo` avec des props primitives : une bascule rend
 *     deux arbres d'écran — celui qui part, celui qui arrive — et non plus tous
 *     les vivants. Le coût d'une bascule ne suit donc plus ce nombre.
 * Ce qui reste linéaire est la MÉMOIRE (le DOM des écrans gardés) et les requêtes
 * propres à chaque écran, qui auraient de toute façon été jouées à sa visite.
 *
 * ⚠ UN sur mobile. Le CRM mobile n'a pas de bande d'onglets (sa pilule à cinq
 * destinations en tient lieu) : garder des écrans vivants n'y sert personne et
 * coûte la mémoire d'un téléphone.
 */
const VIVANTS_MAX = 6

/**
 * L'emplacement d'un onglet, en PRIMITIVES.
 *
 * ⚠ Ni `state` ni `key` ici, contrairement à la version qui fabriquait l'objet
 * de localisation complet : ce sont des props d'`EcranVivant`, qui les compare
 * une à une (`memo`), et `key` est de surcroît réservé par React — l'étaler
 * dans du JSX écrase la clé de liste au lieu d'être passé. L'écran recompose
 * l'objet lui-même, avec `state: null` et sa propre identité d'onglet.
 */
function localisationDe(tb: CrmTab): { pathname: string; search: string; hash: string } {
  const [pathname, q] = crmTabHref(tb).split('?')
  return { pathname, search: q ? `?${q}` : '', hash: '' }
}

/**
 * Un écran d'onglet — visible, ou vivant mais retiré de la vue.
 *
 * ⚠ `visibility: hidden` et NON `display: none`, et c'est mesuré, pas
 * stylistique : un écran en `display: none` n'a plus de boîte, donc toutes les
 * mesures qu'il prend valent zéro. La bande d'onglets et les six pagers du CRM
 * se dimensionnent au `ResizeObserver` — ils reviendraient à un créneau, puis se
 * recorrigeraient une frame après l'affichage. C'est très exactement le
 * clignotement qu'on cherche à retirer. En `visibility: hidden` la mise en page
 * continue, les mesures restent justes, et rien n'est peint.
 *
 * ⚠ ET `visibility: hidden` SUFFIT à sortir l'écran du clavier et du curseur —
 * vérifié plutôt que supposé : `focus()` sur un bouton d'un écran caché laisse
 * `document.activeElement` sur `<body>`. `inert` avait été posé en ceinture ; il
 * a été retiré parce que React 18 ne le rend pas (l'attribut n'apparaissait pas
 * dans le DOM), et qu'un garde-fou qui ne s'applique pas est pire qu'aucun : il
 * se lit comme une protection. `aria-hidden` couvre l'arbre d'accessibilité.
 */
const EcranVivant = memo(function EcranVivant({ actif, id, pathname, search, hash, routes }: {
  actif: boolean
  id: string
  pathname: string
  search: string
  hash: string
  routes: ReactNode
}) {
  /**
   * ⛔ L'OBJET DE LOCALISATION DOIT GARDER SON IDENTITÉ D'UN RENDU À L'AUTRE.
   *
   * `localisationDe` fabrique un objet neuf à chaque rendu, et `<Routes location=…>`
   * s'en sert pour re-matcher : sans mémoïsation, chaque rendu du parent relance
   * le calcul de route de TROIS écrans. Ce n'est pas ce qui cassait l'état (voir
   * l'ordre de rendu ci-dessous), mais c'est du travail rendu pour rien à chaque
   * frappe au clavier de l'écran actif.
   *
   * ⛔ ET C'EST POURQUOI LES PROPS SONT DES PRIMITIVES, pas l'objet lui-même —
   * corrigé le 7 septembre 2026. `memo` compare les props une à une : un objet
   * de localisation refabriqué à chaque rendu du parent échoue la comparaison,
   * donc la mémoïsation ne mordait sur RIEN. Or une bascule d'onglet rend le
   * parent, donc rendait les TROIS arbres d'écran en entier — deux d'entre eux
   * pour arriver au même DOM, derrière un `visibility: hidden` que personne ne
   * regarde. Avec des primitives, un écran caché dont rien n'a bougé n'est plus
   * rendu du tout : la bascule ne rend que l'écran qui part et celui qui arrive.
   */
  const loc = useMemo(
    () => ({ pathname, search, hash, state: null, key: id }),
    [pathname, search, hash, id],
  )
  // ⚠ Le jumeau se DÉRIVE du client de l'hôte, il n'est pas importé en dur : le
  // banc `/dev/crm` fournit le sien, et un composant n'a pas à décider quel
  // magasin l'entoure. Voir `clientArrierePlan`.
  const hote = useQueryClient()
  const clientCache = useMemo(() => clientArrierePlan(hote), [hote])
  const style: CSSProperties = actif
    ? { position: 'relative' }
    : { position: 'absolute', inset: 0, visibility: 'hidden', pointerEvents: 'none', overflow: 'hidden' }
  return (
    <div
      data-onglet={id}
      aria-hidden={actif ? undefined : true}
      style={style}
    >
      {/* ⛔ UNE FRONTIÈRE SUSPENSE PAR ÉCRAN, et c'est la pièce sans laquelle tout
          le reste ne sert à rien. Mesuré le 7 septembre 2026 : les trois écrans
          partageaient celle d'`App.tsx`. Ouvrir un onglet sur un écran dont le
          chunk n'était pas encore chargé le faisait SUSPENDRE — et React masque
          alors TOUS les enfants de la frontière, en DÉTRUISANT leurs effets, puis
          les recrée à la levée. L'état survivait, mais les effets d'initialisation
          repassaient : le mini-mois du calendrier, réglé sur Octobre, était
          RÉÉCRIT à Septembre par son propre effet de resynchronisation. Un écran
          vivant dont les effets se rejouent n'est pas vivant.

          Chacun la sienne : un chunk qui arrive ne concerne que son écran.
          ⚠ Fallback `null` quand l'écran est caché — y peindre un squelette
          invisible n'apporte rien et ferait clignoter la mise en page au moment
          où il redevient visible. */}
      {/* ⚠ Les écrans cachés déclarent qu'ils ne sont PAS regardés : leur chrome
          (bande d'onglets, barre latérale) cesse alors d'écouter le clavier.
          Sans ça, une frappe `Alt+1` partait trois fois — une par écran vivant —
          et poussait trois entrées d'historique pour un seul geste. */}
      {/* ⛔ UN CLIENT REACT QUERY PAR ÉTAT DE VISIBILITÉ, et c'est la garde
          demandée par Julien le 7 septembre 2026. `refetchOnWindowFocus` est un
          défaut global : au retour sur la page, TOUTES les requêtes montées
          repartent — soit, depuis ce chantier, celles de SIX écrans au lieu de
          trois, dont cinq que personne ne regarde.

          `query.onFocus()` décide PAR OBSERVATEUR (`observers.find(x =>
          x.shouldFetchOnWindowFocus())`) : il suffit qu'un seul le demande. Une
          donnée que regarde l'écran visible se rafraîchit donc normalement, même
          si des écrans cachés l'observent aussi ; une donnée que SEULS des
          écrans cachés observent attend d'être regardée.

          ⚠ Les deux clients partagent le MÊME cache — deux jeux de réglages sur
          un seul magasin, jamais deux magasins. Le pourquoi, le coût et le
          risque résiduel sont écrits dans `src/lib/queryClients.ts`. */}
      <QueryClientProvider client={actif ? hote : clientCache}>
      <EcranActifProvider value={actif}>
      <Suspense fallback={actif ? <SmartPageLoader /> : null}>
        {/* ⚠ `location` sur `<Routes>` ne fait pas que choisir la route : React
            Router enveloppe le sous-arbre dans un contexte de localisation à cette
            valeur (`useRoutes`, branche `locationArg`). Un écran caché lit donc SA
            propre URL — ce dont dépend `useTabScopedState`, qui en tire sa portée.
            Sans ça, les trois écrans vivants partageraient la tranche de l'actif. */}
        <Routes location={loc}>{routes}</Routes>
      </Suspense>
      </EcranActifProvider>
      </QueryClientProvider>
    </div>
  )
})

/**
 * Les écrans des onglets — trois vivants au plus, un seul visible.
 *
 * ⛔ CE QU'IL Y AVAIT AVANT : `<Outlet />`. Un seul écran, celui de l'URL
 * courante, DÉTRUIT à chaque bascule d'onglet. Mesuré le 7 septembre 2026 :
 * Calendrier réglé sur Octobre, un autre onglet, retour — Septembre. Et ce n'est
 * pas le calendrier : `useTabScopedState` ne porte que 14 des ~38 positions
 * d'écran du CRM de bureau, les ~24 autres vivent en `useState` local et
 * meurent avec le composant.
 *
 * ⚠ LA PILE NE CONTIENT QUE DES ONGLETS DÉJÀ ACTIVÉS, et cette propriété n'est
 * pas décorative : elle sort du fait qu'on n'y entre que par un changement
 * d'actif. Un chemin persisté d'une vieille session qui pointerait vers une
 * route de REDIRECTION (`<Navigate>`) ne sera donc jamais monté en arrière-plan
 * — où il ferait sauter toute l'application. Il ne se montera qu'au clic, en
 * tant qu'écran actif, où rediriger est le comportement voulu.
 *
 * ⚠ L'écran ACTIF est rendu sur la localisation RÉELLE, pas sur celle stockée
 * dans son onglet : la pile suit la navigation avec un rendu de retard
 * (`appliquerNavigation`), et rendre l'ancien chemin pendant cette frame
 * afficherait l'écran précédent.
 */
function EcransVivants({ routes }: { routes: ReactNode }) {
  const api = useCrmTabsOptionnel()
  const location = useLocation()
  const isMobile = useIsMobile()
  const max = isMobile ? 1 : VIVANTS_MAX

  const tabs = api?.tabs
  const actifId = tabs && api ? tabs[api.active]?.id : undefined

  /**
   * La pile de récence — l'actif en tête.
   *
   * ⚠ Ajustée PENDANT LE RENDU et non dans un effet, sur le motif documenté par
   * React (« adjusting state when a prop changes ») : React relance le rendu
   * sans commiter l'intermédiaire, donc l'ensemble vivant est juste dès la
   * première frame de la bascule. Dans un effet, il aurait fallu une frame de
   * plus — celle où l'écran neuf n'est pas encore dans l'ensemble.
   */
  const [recents, setRecents] = useState<string[]>([])
  const [vuActif, setVuActif] = useState<string | undefined>(undefined)
  if (actifId && actifId !== vuActif) {
    setVuActif(actifId)
    setRecents((p) => [actifId, ...p.filter((x) => x !== actifId)].slice(0, VIVANTS_MAX))
  }

  // ⚠ La règle vit dans `crmEcransVivants` (fonction pure, éprouvée) : la
  // récence décide de l'appartenance, l'ordre de la PILE décide du rendu.
  const vivants = useMemo(
    () => crmEcransVivants(tabs ?? [], actifId, recents, max),
    [tabs, actifId, recents, max],
  )

  // Hors fournisseur d'onglets (bancs `/dev/*` de premier niveau, console) : un
  // seul écran, sur l'URL courante. Rien à garder vivant, rien à empiler.
  if (!vivants.length) return <Routes location={location}>{routes}</Routes>

  return (
    <div style={{ position: 'relative', minHeight: '100%' }}>
      {vivants.map((tb) => {
        const actif = tb.id === actifId
        return (
          <EcranVivant
            key={tb.id}
            id={tb.id}
            actif={actif}
            {...(actif
              ? { pathname: location.pathname, search: location.search, hash: location.hash }
              : localisationDe(tb))}
            routes={routes}
          />
        )
      })}
    </div>
  )
}

function AgentLayoutInner({ routes }: { routes: ReactNode }) {
  const { isOpen } = useAiPanel()
  const { status: identityGateStatus } = useIdentityGate()
  const location = useLocation()
  const [dark, setDark] = useState(readCrmDark)
  useEffect(() => {
    const sync = () => setDark(readCrmDark())
    // Relecture IMMÉDIATE à chaque passage : ce layout ne se remonte plus à la
    // navigation (les routes ne sont plus keyées par pathname), donc la valeur
    // lue au montage peut dater de plusieurs écrans — une bascule clair/sombre
    // faite depuis la barre latérale d'une page n'est pas notifiée dans le même onglet
    // (`storage` ne concerne que les autres). Sans ça, la gouttière du push
    // s'ouvrirait à l'ancienne teinte.
    sync()
    window.addEventListener('storage', sync)
    let id: number | undefined
    if (isOpen) id = window.setInterval(sync, 400)
    return () => { window.removeEventListener('storage', sync); if (id) window.clearInterval(id) }
  }, [isOpen])
  // Fond Sugar de la page courante → peint la gouttière réservée par le push
  // (sinon elle laisserait voir le fond `body` blanc, dépareillé en mode sombre).
  const pageBg = crmPalette(dark).pageBg

  // Gate identité légale (étape 2 KYB) : tant que useIdentityGate() n'a pas
  // positivement résolu l'état à 'required', on NE redirige PAS — garde-fou 1
  // de l'incident P0 c830f9a9 (« boucle onboarding »). shouldRedirectToIdentityGate
  // refuse en plus de rediriger /dashboard/identite vers elle-même (garde-fou 2) :
  // sans ce second garde-fou, la page qui doit justement lever le statut 'required'
  // ne pourrait jamais se monter.
  const mustRedirectToIdentity = shouldRedirectToIdentityGate(identityGateStatus, location.pathname)
  // …et tant que le statut n'est pas résolu, on ne rend PAS le CRM non plus :
  // sans ça, le tableau de bord s'affichait une fraction de seconde avant que la
  // lecture agence ne réponde 'required' et ne renvoie sur le wizard d'identité.
  // On prolonge l'écran d'arrivée — le même que celui de ProtectedRoute, donc la
  // bascule ne se voit pas — plutôt que d'ouvrir une porte qu'on va refermer.
  //
  // UNE SEULE FOIS, et c'est essentiel : retenir l'écran remplace l'<Outlet/>,
  // donc DÉMONTE la page et son état. Un retour à 'loading' après coup ferait
  // repartir le wizard d'identité de zéro en pleine saisie (cf. le JSDoc de
  // shouldHoldForIdentityGate). Une fois le gate résolu, on ne retient plus rien.
  const [gateResolvedOnce, setGateResolvedOnce] = useState(false)
  useEffect(() => {
    if (identityGateStatus !== 'loading') setGateResolvedOnce(true)
  }, [identityGateStatus])
  const holdForIdentity = shouldHoldForIdentityGate(identityGateStatus, gateResolvedOnce)

  return (
    // flex column pleine hauteur (correctif revue, point mineur) : les bandeaux
    // (Impersonate/LabGuard) et la zone de contenu se PARTAGENT 100vh au lieu de
    // s'empiler chacun leur propre ancrage minimal indépendant — un bandeau (qui a
    // sa propre hauteur) suivi d'une zone de contenu qui réclamait ELLE AUSSI
    // min-height:100vh dépassait la fenêtre et produisait un ascenseur de page
    // parasite sur un écran par ailleurs court (KycLabGuard bloqué, cf. son
    // en-tête). flex:'1 1 auto' sur la zone de contenu lui donne une hauteur
    // DÉFINIE (règle flexbox : un flex-item résout une taille définie même quand
    // son conteneur n'a qu'un min-height) — c'est ce qui permet à
    // KycBlockedScreen/LoadingScreen d'utiliser min-h-full plutôt que min-h-screen
    // et de s'ajuster sous un bandeau au lieu de l'ignorer. Comportement inchangé
    // en l'absence de bandeau (cas courant) : un seul enfant flexible occupe toute
    // la hauteur, comme avant.
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <ImpersonateBanner />
      {/* LabGuardBanner ne s'empile PLUS ici (04.08.2026) : il est monté dans
          IdentityShell, dans la coquille MEGGA X. Deux raisons, détaillées dans son
          en-tête — la garde d'identité ne le laissait de toute façon lire que sur
          l'entonnoir, et empilé au-dessus d'une coquille qui réclame `100dvh` il en
          faisait déborder le pied d'actions. */}
      {/* Le panneau MEGGA AI « pousse » le contenu de travail vers la gauche
          quand il est ouvert (COPILOT_WIDTH = panneau + gouttières). */}
      <div
        style={{
          transition: 'padding-right .42s cubic-bezier(.2,.8,.2,1)',
          paddingRight: isOpen ? COPILOT_WIDTH : 0,
          background: pageBg,
          flex: '1 1 auto',
        }}
      >
        {/* ⚠ Le bandeau d'accueil est DANS la zone poussée, pas au-dessus.
            Il l'était jusqu'au 4 septembre 2026, ce qui ne coûtait rien tant que
            le panneau démarrait 90 px plus bas (il dégageait la barre du haut).
            La barre du haut partie, le panneau remonte à 16 px du bord et
            recouvre la seule action du bandeau — « Rejoindre » / « Réserver »,
            calée à droite. Le pousser avec le contenu la fait glisser à gauche
            du dock. ⛔ Ne pas « corriger » en montant son z-index : un bandeau
            pleine largeur qui peint PAR-DESSUS le dock est pire que le
            chevauchement qu'il règle. Le bandeau d'usurpation, lui, reste au-
            dessus : il est `sticky z-[90]` et le panneau le compense déjà. */}
        <OnboardingCallBanner />
        {holdForIdentity
          ? <BootSplash />
          : mustRedirectToIdentity
            ? <Navigate to={IDENTITY_GATE_ROUTE} replace />
            : <EcransVivants routes={routes} />}
      </div>
      <CrmSearchHost />
      {/* Le panneau MEGGA AI est monté dans App.tsx (au-dessus de <Routes>)
          pour persister à la navigation ; ici on ne fait que « pousser » le contenu. */}
    </div>
  )
}

/** Enrobe le layout interne des providers thème + contexte copilote. */
export default function AgentLayout({ routes }: { routes: ReactNode }) {
  return (
    <ThemeProvider>
      <CopilotContextProvider>
        {/* ⚠ Le FOURNISSEUR d'onglets est hissé ici, la BARRE ne l'est pas — et
            l'asymétrie est délibérée. Ce layout ne se remonte plus à la
            navigation (les routes ne sont plus keyées par `pathname`) : c'est le
            seul endroit d'où une pile d'onglets peut survivre à un clic. La
            barre, elle, reste montée par chaque surface, comme la barre
            latérale — la hisser la poserait sur la console super-admin, sur
            `IdentityShell` et sur quatre routes qui n'en veulent pas, et la
            retirerait des bancs `/dev/*`. Un fournisseur ne peint rien : le
            poser sur une route sans barre ne coûte rien, et `crmTabsEligible`
            l'empêche d'ouvrir un onglet pour ces routes-là. */}
        <CrmTabsProvider>
          <AgentLayoutInner routes={routes} />
        </CrmTabsProvider>
      </CopilotContextProvider>
    </ThemeProvider>
  )
}
