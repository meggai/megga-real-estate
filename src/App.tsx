/**
 * Racine de l'app CRM (app.megga.ch) : providers globaux (React Query, Auth,
 * Toast, panneau IA) + table de routage complète.
 *
 * Presque toutes les pages sont en lazy() — seuls les shells/guards restent
 * statiques — pour garder le main bundle minimal. La marketplace publique est
 * désactivée (pivot CRM-first) : ses routes redirigent vers la vitrine megga.ch.
 * Route racine « / » → /dashboard.
 */
import { lazy, Suspense } from 'react'
import { importAvecReprise } from '@/lib/staleChunkRecovery'
import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom'
import ResponsiveRoute from '@/components/crm-mobile/shell/ResponsiveRoute'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/queryClients'
import { AuthProvider } from '@/hooks/useAuth'
import { AiPanelProvider } from '@/hooks/useAiPanel'

// ═══════════════════════════════════════════════════════════════════════════
// Static imports — STRICT minimum loaded with the main bundle (~boot shell).
// Tout le reste est lazy() pour réduire le payload initial sur /louer /acheter
// /home et les routes publiques à fort trafic SEO.
//
// Avant cette optimisation : ~30 components publics étaient eager, dont les
// 11 pages DesignSystem (depuis retirées) + TodayPage (dashboard agent) — résultat : 153 KB
// JS inutilisé sur /louer d'après Lighthouse, FCP/LCP à 4.6s. Convertir tout
// le reste en lazy() ramène le main bundle à ~50 KB.
// ═══════════════════════════════════════════════════════════════════════════

// Shells/guards qui wrappent toutes les routes — doivent être disponibles
// avant le premier render pour éviter un flash de chargement.
import StaleBundleDetector from '@/components/layout/StaleBundleDetector'
import ErrorBoundary from '@/components/layout/ErrorBoundary'
import ProtectedRoute from '@/components/layout/ProtectedRoute'
import { ToastProvider } from '@/components/ui/Toast'
import AdminConsoleRoute from '@/components/admin/AdminConsoleRoute'
import ByParam from '@/components/layout/ByParam'
import ImpersonationHandoff from '@/components/admin/ImpersonationHandoff'
import SmartPageLoader from '@/components/skeletons/SmartPageLoader'

// Lazy-loaded public pages
// Property X storefront pages were removed — megga.ch now serves the static
// MEGGA vitrine (sites/megga-vitrine), overlaid at the deploy root by the npm
// postbuild hook. Only the Property X icon
// system remains under src/components/propertyx/ (MEIcon/PxIconFont/
// PxSocialIcon/PxWhatsAppButton + PX.* tokens), used across the CRM.

// Sprint 4.7.C — Parcours client KYC Magic Link (public, sans compte MEGGA)
const KycPublicPage = lazy(() => importAvecReprise(() => import('@/pages/public/KycPublicPage')))
const AppointmentManagePage = lazy(() => importAvecReprise(() => import('@/pages/public/AppointmentManagePage')))
// Réception acheteur — page publique par token (boucle de match, refonte juil. 2026)
const BuyerReceptionPage = lazy(() => importAvecReprise(() => import('@/pages/public/BuyerReceptionPage')))
// Sprint 4.7.D — Rendu PDF tokenisé pour Cloudflare Browser Rendering (rapport KYC WhatsApp)
const KycReportRenderPage = lazy(() => importAvecReprise(() => import('@/pages/public/KycReportRenderPage')))

// Auth — lazy car secondary path.
// Le MODAL DE CONNEXION est désormais servi par la vitrine (megga.ch/login,
// câblé Supabase). L'app ne garde que la TUYAUTERIE du flux : /auth/callback
// (retour OAuth/e-mail) et /auth/forgot-password/reset (cible des e-mails de
// réinitialisation envoyés par la vitrine). Les écrans de login/signup internes
// (ancienne direction) redirigent vers la vitrine — voir VitrineLoginRedirect.
const AuthCallbackPage = lazy(() => importAvecReprise(() => import('@/pages/public/AuthCallbackPage')))
const AuthSetNewPasswordPage = lazy(() =>
  import('@/pages/public/AuthBentoPage').then((m) => ({ default: m.AuthSetNewPasswordPage })),
)

// Layout shells agent — lazy car ils ne wrappent que les routes dashboard
const AgentLayout = lazy(() => importAvecReprise(() => import('@/components/layout/AgentLayout')))
// Étape 5 KYB, tâche 4 — garde LAB plein sur les routes kyc/* (layout-route, aucun path propre).
const KycLabGuard = lazy(() => importAvecReprise(() => import('@/components/layout/KycLabGuard')))

// CRM mobile (responsive < 768px) — branché par écran via ResponsiveRoute
const MobileMorePage = lazy(() => importAvecReprise(() => import('@/components/crm-mobile/more/MobileMorePage')))
const MobileTodayPage = lazy(() => importAvecReprise(() => import('@/components/crm-mobile/today/MobileTodayPage')))
const MobilePipelinePage = lazy(() => importAvecReprise(() => import('@/components/crm-mobile/pipeline/MobilePipelinePage')))
const MobileDealDetailPage = lazy(() => importAvecReprise(() => import('@/components/crm-mobile/deal/MobileDealDetailPage')))
const MobileMatchingPage = lazy(() => importAvecReprise(() => import('@/components/crm-mobile/matching/MobileMatchingPage')))
const MobileAgendaPage = lazy(() => importAvecReprise(() => import('@/components/crm-mobile/agenda/MobileAgendaPage')))
const MobileBiensPage = lazy(() => importAvecReprise(() => import('@/components/crm-mobile/biens/MobileBiensPage')))
const MobileBienVitrinePage = lazy(() => importAvecReprise(() => import('@/components/crm-mobile/bien/MobileBienVitrinePage')))
const MobileWizardPage = lazy(() => importAvecReprise(() => import('@/components/crm-mobile/wizard/MobileWizardPage')))
const MobileContactsListPage = lazy(() => importAvecReprise(() => import('@/components/crm-mobile/contacts/MobileContactsListPage')))
const MobileNewContactPage = lazy(() => importAvecReprise(() => import('@/components/crm-mobile/contacts/MobileNewContactPage')))
const MobileContactDetailPage = lazy(() => importAvecReprise(() => import('@/components/crm-mobile/contacts/MobileContactDetailPage')))
const MobileAnalyticsPage = lazy(() => importAvecReprise(() => import('@/components/crm-mobile/analytics/MobileAnalyticsPage')))
const MobileJourneyPage = lazy(() => importAvecReprise(() => import('@/components/crm-mobile/journey/MobileJourneyPage')))
const MobileKycListPage = lazy(() => importAvecReprise(() => import('@/components/crm-mobile/kyc/MobileKycListPage')))
const MobileKycDetailPage = lazy(() => importAvecReprise(() => import('@/components/crm-mobile/kyc/MobileKycDetailPage')))
const MobileSettingsPage = lazy(() => importAvecReprise(() => import('@/components/crm-mobile/settings/MobileSettingsPage')))

// Auth widgets — montés tardivement, peuvent être lazy
const FavoritesLoginPrompt = lazy(() => importAvecReprise(() => import('@/components/auth/FavoritesLoginPrompt')))
// Intercom Messenger — support unique (boote globalement, anonyme puis identifié)
const IntercomMessenger = lazy(() => importAvecReprise(() => import('@/components/IntercomMessenger')))

// Secondary public pages conservées dans l'app CRM.
// Marketplace publique + ancien site marketing (About, Contact, Sell, Estimates,
// Services, Publish, Privacy, Agents, Agencies, Blog) + direction Property X :
// EXTRAITS du repo (2026-06-08) et archivés hors GitHub. Ces URLs redirigent
// désormais vers la nouvelle vitrine (MarketplaceDisabledRedirect → megga.ch).
const ResetPasswordPage = lazy(() => importAvecReprise(() => import('@/pages/public/ResetPasswordPage')))
const NotFoundPage = lazy(() => importAvecReprise(() => import('@/pages/public/NotFoundPage')))
const PrivacyPage = lazy(() => importAvecReprise(() => import('@/pages/public/PrivacyPage')))
const VisitManagePage = lazy(() => importAvecReprise(() => import('@/pages/public/VisitManagePage')))
const VisitFeedbackPage = lazy(() => importAvecReprise(() => import('@/pages/public/VisitFeedbackPage')))
const TodayPage = lazy(() => importAvecReprise(() => import('@/pages/agent/TodayPage')))

// Lazy-loaded agent pages
const AnalyticsPage = lazy(() => importAvecReprise(() => import('@/pages/agent/AnalyticsPage')))
const ContactDetailPage = lazy(() => importAvecReprise(() => import('@/pages/agent/ContactDetailPage')))
const PipelinePage = lazy(() => importAvecReprise(() => import('@/pages/agent/PipelinePage')))
const ContactsPage = lazy(() => importAvecReprise(() => import('@/pages/agent/ContactsPage')))
const ListingsPage = lazy(() => importAvecReprise(() => import('@/pages/agent/ListingsPage')))
// Sprint 2 — Sugar v3 (port pixel-près handoff Bien + Deal + Visite)
const ListingDetailPage = lazy(() => importAvecReprise(() => import('@/pages/agent/ListingDetailPage')))
const DealDetailPage = lazy(() => importAvecReprise(() => import('@/pages/agent/DealDetailPage')))
const OfferPage = lazy(() => importAvecReprise(() => import('@/pages/agent/OfferPage')))
const VisitNewPage = lazy(() => importAvecReprise(() => import('@/pages/agent/VisitNewPage')))
const VisitDetailPage = lazy(() => importAvecReprise(() => import('@/pages/agent/VisitDetailPage')))
// VisitCompanionPage removed — the mobile companion view contained only
// non-functional UI (mic recording / photo capture / signature / sentiment
// cards with no persistence). The route + page were removed; real on-site
// visit capture is a separate sprint.
// Sprint 3 — Import Lead IA (Sugar plein écran 2 étapes, extraction Claude)
const ImportLeadPage = lazy(() => importAvecReprise(() => import('@/pages/agent/ImportLeadPage')))
const MatchingPage = lazy(() => importAvecReprise(() => import('@/pages/agent/MatchingPage')))
const JourneyPage = lazy(() => importAvecReprise(() => import('@/pages/agent/JourneyPage')))
const NewTabPage = lazy(() => importAvecReprise(() => import('@/pages/agent/NewTabPage')))
const DashboardNotFoundPage = lazy(() => importAvecReprise(() => import('@/pages/agent/DashboardNotFoundPage')))
const CalendarPage = lazy(() => importAvecReprise(() => import('@/pages/agent/CalendarPage')))
// Messagerie (boîte mail intégrée) — l'écran, son mobile minimal (D16) et le
// retour d'autorisation de la pop-up OAuth.
const MessageriePage = lazy(() => importAvecReprise(() => import('@/pages/agent/MessageriePage')))
const MobileMessagerieScreen = lazy(() => importAvecReprise(() => import('@/components/crm-mobile/messagerie/MobileMessagerieScreen')))
const MailOAuthCallbackPage = lazy(() => importAvecReprise(() => import('@/pages/agent/MailOAuthCallbackPage')))
const SettingsPage = lazy(() => importAvecReprise(() => import('@/pages/agent/SettingsPage')))
const ListingFormPage = lazy(() => importAvecReprise(() => import('@/pages/agent/ListingFormPage')))
const ListingWizardPage = lazy(() => importAvecReprise(() => import('@/pages/agent/ListingWizardPage')))
const KycPage = lazy(() => importAvecReprise(() => import('@/pages/agent/KycPage')))
// Refonte KYC (handoff) — onboarding « Première ouverture » (empty-state).
const KycOnboardingPage = lazy(() => importAvecReprise(() => import('@/pages/agent/KycOnboardingPage')))
// Sprint 4.4 — Export PDF dossier KYC (route print-friendly, hors layout agent)
const KycExportPage = lazy(() => importAvecReprise(() => import('@/pages/agent/KycExportPage')))
// Étape 2 KYB — gate identité légale (/dashboard/identite). Desktop : coquille
// du wizard (IdentityPage, tâche 3 le remplit). Mobile : invitation à
// terminer sur ordinateur (IdentityMobileNotice), hors périmètre v1.
const IdentityPage = lazy(() => importAvecReprise(() => import('@/pages/agent/IdentityPage')))
const IdentityMobileNotice = lazy(() => importAvecReprise(() => import('@/pages/agent/IdentityMobileNotice')))
// Étape 3 KYB — suite immédiate du wizard d'identité : réserver l'appel d'accueil
// avec l'équipe MEGGA. Écran passable, jamais bloquant.
const OnboardingCallPage = lazy(() => importAvecReprise(() => import('@/pages/agent/OnboardingCallPage')))
const OnboardingCallManagePage = lazy(() => importAvecReprise(() => import('@/pages/public/OnboardingCallManagePage')))
const AuditPage = lazy(() => importAvecReprise(() => import('@/pages/agent/AuditPage')))
const MeggaXStyleGuidePage = lazy(() => importAvecReprise(() => import('@/pages/dev/MeggaXStyleGuidePage')))
// ⛔ LES SEPT BANCS RESTANTS PASSENT AU TERNAIRE (15 août 2026). Mesuré au lot 3a :
// ils avaient un chunk dans `dist/assets/` et une route déclarée — donc joignables
// sur app.megga.ch, dont `/dev/sentry-test`, qui DÉCLENCHE des erreurs Sentry. Un
// banc de développement livré n'est pas seulement du poids mort : c'est une surface
// que personne ne teste, ouverte à qui connaît l'URL.
//
// ⚠ `import.meta.env.DEV` est remplacé par `false` au build : la branche d'import
// disparaît et Vite n'émet aucun chunk. Le ternaire N'EST PAS décoratif — le
// remplacer par un `lazy()` nu suffirait à tout renvoyer en production, et c'est
// exactement ce que `dev-bancs-frontiere.spec.ts` refuse.
//
// ⚠ `/design-system/megga-x` N'EST PAS DANS CE LOT : ce n'est pas un banc mais la
// seule route de design system survivante (CLAUDE.md §3), et elle est servie
// délibérément.
const SentryTestPage = import.meta.env.DEV
  ? lazy(() => importAvecReprise(() => import('@/pages/dev/SentryTestPage')))
  : () => null
const MatchingShowcasePage = import.meta.env.DEV
  ? lazy(() => importAvecReprise(() => import('@/pages/dev/MatchingShowcasePage')))
  : () => null
const MobileShowcasePage = import.meta.env.DEV
  ? lazy(() => importAvecReprise(() => import('@/pages/dev/MobileShowcasePage')))
  : () => null
const BiensShowcasePage = import.meta.env.DEV
  ? lazy(() => importAvecReprise(() => import('@/pages/dev/BiensShowcasePage')))
  : () => null
const ContactsShowcasePage = import.meta.env.DEV
  ? lazy(() => importAvecReprise(() => import('@/pages/dev/ContactsShowcasePage')))
  : () => null
const PipelineShowcasePage = import.meta.env.DEV
  ? lazy(() => importAvecReprise(() => import('@/pages/dev/PipelineShowcasePage')))
  : () => null
const ModalesShowcasePage = import.meta.env.DEV
  ? lazy(() => importAvecReprise(() => import('@/pages/dev/ModalesShowcasePage')))
  : () => null
// Banc de la Messagerie — même ternaire, même raison que les sept gelés le
// 15 août 2026 : un `lazy()` nu émettrait un chunk et servirait le banc sur
// app.megga.ch (`dev-bancs-frontiere.spec.ts` le mesure).
const MessagerieShowcasePage = import.meta.env.DEV
  ? lazy(() => importAvecReprise(() => import('@/pages/dev/MessagerieShowcasePage')))
  : () => null
// ⛔ CONDITIONNÉ AU MODE DEV, comme `/dev/crm`, et pour la MÊME raison : ce banc
// appelle `installerBanc()`, qui remplace `window.fetch` pour TOUTE la session.
// Dans un bundle déployé, une visite à `/dev/public` détournerait silencieusement
// la couche de données de l'application entière. Les autres bancs ne montrent que
// des maquettes ; celui-ci monte les écrans RÉELS avec un intercepteur.
const PublicShowcasePage = import.meta.env.DEV
  ? lazy(() => importAvecReprise(() => import('@/pages/dev/PublicShowcasePage')))
  : () => null
// Aperçu du parcours d'onboarding — DEV seulement (cf. sa route plus bas, et son
// en-tête pour les trois murs qui rendent ce parcours autrement inatteignable).
// Le ternaire n'est pas décoratif : `import.meta.env.DEV` est remplacé par `false`
// au build, l'import dynamique tombe dans une branche morte, et le chunk cesse
// d'être émis. Un `lazy()` inconditionnel, lui, produisait bien un
// `OnboardingPreviewPage-*.js` dans dist/ — jamais chargé, mais livré.
const OnboardingPreviewPage = import.meta.env.DEV
  ? lazy(() => importAvecReprise(() => import('@/pages/dev/OnboardingPreviewPage')))
  : () => null
// Banc de la console super-admin — DEV seulement, même ternaire et même raison.
// ⚠ Il s'écarte des autres bancs (`/dev/pipeline`, `/dev/biens`), qui sont
// permanents : ceux-là montrent l'écran d'un agent, celui-ci monte le chrome de
// la PLATEFORME — badge « ADMIN », MRR, registre des agences, journal de
// sécurité. Le servir publiquement inviterait la question « est-ce réel ? » et
// donnerait la carte de la surface super-admin à un visiteur.
const AdminShowcasePage = import.meta.env.DEV
  ? lazy(() => importAvecReprise(() => import('@/pages/dev/AdminShowcasePage')))
  : () => null
// Banc du CRM agent — DEV seulement, même ternaire. Il monte les dix surfaces
// `/dashboard` qu'il reste à porter en MEGGA X, et il SÈME une session dans le
// stockage pour lever les trois murs (ProtectedRoute, gate d'identité de la
// coquille, KycLabGuard). Semer une session n'a aucune excuse dans un bundle
// déployé — c'est ce qui décide le gel, avant même les écrans de conformité.
const CrmShowcasePage = import.meta.env.DEV
  ? lazy(() => importAvecReprise(() => import('@/pages/dev/CrmShowcasePage')))
  : () => null
// MEGGA AI — panneau docké monté AU-DESSUS de <Routes>, hors de l'arbre de routage
// pour survivre au remount de navigation : le panneau + la conversation
// persistent d'une page à l'autre (suivi de contexte, chantier 5).
const CopilotPanel = lazy(() => importAvecReprise(() => import('@/components/ai-copilot/panel/CopilotPanel')))
const ExternalListingDetailPage = lazy(() => importAvecReprise(() => import('@/pages/agent/ExternalListingDetailPage')))

const AcceptInvitePage = lazy(() => importAvecReprise(() => import('@/pages/public/AcceptInvitePage')))
// Compte ACHETEUR retiré (pivot CRM-first) — page + composants archivés hors
// repo le 2026-06-08. /account → /dashboard. market_listings ne sert plus que
// le Matching agent.

// Centre d'aide : plus de page SPA — tout `/help/*` redirige vers Intercom
// (cf. HelpCenterRedirect plus bas).
// Les pages super-admin ne sont plus dans ce bundle : elles vivent dans
// la console super-admin, montée sous /dashboard/admin. Voir src/lib/adminEntry.ts.


// `PageLoader` (the generic centered spinner) replaced by `<SmartPageLoader>`
// which picks a route-specific skeleton matching the page being loaded.
// SmartPageLoader uses useLocation, so it must live inside <BrowserRouter>.

// Defensive defaults for a reliable UX after long idles / sleep / wake:
//
// ⛔ LES DEUX CLIENTS VIVENT DANS `src/lib/queryClients.ts` DEPUIS LE 07.09.2026,
// et le déménagement n'est pas cosmétique : il en fallait un SECOND, partageant
// le même cache, pour que les écrans vivants mais CACHÉS ne relancent pas toutes
// leurs requêtes au retour sur la page. Les défauts, leur justification et le
// risque résiduel de la bascule sont écrits là-bas.

/**
 * `<AppRoutes>` rend la table de routage TELLE QUELLE : aucune clé sur
 * `<Routes>`, aucun `<AnimatePresence>` au-dessus.
 *
 * Les deux y ont été un temps — l'`AnimatePresence` pour interpoler des
 * `layoutId` d'une route à l'autre (carte marketplace → hero de bien, ligne de
 * bien → overlay). Ces composants ont été retirés avec la marketplace et la
 * refonte Sugar ; les `layoutId` survivants sont tous INTRA-arbre (carte de deal
 * du pipeline, photo galerie ↔ ligne galerie, indicateur d'onglet mobile) et
 * n'ont donc besoin de rien à ce niveau.
 *
 * Ce qui restait, en revanche, coûtait cher : `key={location.pathname}`
 * détruisait et recréait TOUT l'arbre protégé à chaque changement de page
 * (ProtectedRoute, sa frontière Suspense, le layout, le ThemeProvider, le
 * contexte copilote, la page). Une frontière Suspense neuve oblige React à
 * commiter son fallback même en transition — d'où un écran de chargement plein
 * cadre entre deux pages CRM, malgré `v7_startTransition`. Sans la clé, la
 * frontière est PRÉSERVÉE d'une route sœur à l'autre : React garde la page
 * précédente à l'écran pendant le téléchargement du chunk, et l'écran de
 * chargement disparaît.
 *
 * Les transitions de page (fondu/glissement) ont été retirées à part, sur retour
 * d'usage : Linear / Notion / Vercel / Stripe changent de route instantanément.
 * Les animations locales (Sheet, Toast, taps, voile de langue…) portent leur
 * propre `AnimatePresence` et ne dépendent pas de ce niveau.
 */

// Param-preserving redirects — <Navigate> doesn't interpolate :id, so wrap
// useParams + Navigate when a legacy FR route needs to keep its dynamic segment.
function VisitModifyRedirect() {
  const { id } = useParams()
  return <Navigate to={`/visit/${id}/edit`} replace />
}
function VisitFeedbackRedirect() {
  const { id } = useParams()
  return <Navigate to={`/visit/${id}/feedback`} replace />
}
// Portail vendeur RETIRÉ (2026-07-26). La fonctionnalité n'a jamais servi : la
// table `seller_portals` comptait 0 ligne depuis sa création, aucun lien personnel
// n'a donc jamais été envoyé, et l'UI de création avait déjà disparu de la fiche
// contact. Les URLs `/portal*` et `/portail*` redirigent vers la vitrine plutôt
// que de rendre un 404, comme les routes marketplace du pivot CRM-first.
// Redirection externe (autre domaine) → window.location, pas <Navigate>.
function SellerPortalRemovedRedirect() {
  if (typeof window !== 'undefined') window.location.replace(VITRINE_URL)
  return null
}
// Centre d'aide : le corpus vit dans Intercom (18 articles FR+EN, maintenus via
// `scripts/intercom-content.mjs`). Les 12 pages SPA `/help/*` étaient un second
// corpus figé, hérité de l'ancien site public — retirées le 2026-07-20 : elles se
// périmaient en silence et rendaient le chrome vitrine dans l'app CRM.
// Toutes les anciennes URLs (`/help/*`, `/aide/*`) atterrissent sur le vrai centre.
const HELP_CENTER_URL = 'https://intercom.help/megga/fr'
function HelpCenterRedirect() {
  if (typeof window !== 'undefined') window.location.replace(HELP_CENTER_URL)
  return null
}
function DashboardVisitRedirect() {
  const { id } = useParams()
  return <Navigate to={`/dashboard/visits/${id}`} replace />
}
function DashboardMarketRedirect() {
  const { externalId } = useParams()
  return <Navigate to={`/dashboard/market/${externalId}`} replace />
}
// Pivot CRM-first (juin 2026): la marketplace PUBLIQUE est désactivée. Les routes
// d'affichage des annonces (/buy /rent /propriete/:id /search /listing/:id…)
// redirigent vers la vitrine megga.ch. market_listings + le cron Flatfox + le
// matching (edge matching-engine, include_market) restent INTACTS — seul
// l'affichage public est coupé. Réversible : restaurer les <Route> d'origine.
// Redirection externe (autre domaine) → window.location, pas <Navigate>.
const VITRINE_URL = 'https://megga.ch'
function MarketplaceDisabledRedirect() {
  if (typeof window !== 'undefined') window.location.replace(VITRINE_URL)
  return null
}
// Le modèle de connexion vit sur la vitrine (megga.ch/login, câblé Supabase).
// Les écrans de login/signup internes (ancienne direction) y redirigent. La
// tuyauterie (/auth/callback, /auth/forgot-password/reset) reste dans l'app.
const VITRINE_LOGIN_URL = 'https://megga.ch/login'
function VitrineLoginRedirect() {
  if (typeof window !== 'undefined') window.location.replace(VITRINE_LOGIN_URL)
  return null
}

/**
 * La table de routes du CRM de bureau — HISSÉE hors du `<Routes>` global.
 *
 * ⛔ POURQUOI ELLE N'EST PLUS ENFANT DE `/dashboard`. Un onglet du CRM ne doit
 * plus DÉTRUIRE son écran quand on en change : mesuré le 7 septembre 2026,
 * partir du Calendrier réglé sur Octobre et y revenir rendait Septembre — le
 * composant avait été démonté et reconstruit, et avec lui les ~24 positions
 * d'écran que `useTabScopedState` ne porte pas.
 *
 * Garder trois écrans vivants demande de rendre PLUSIEURS emplacements en même
 * temps, chacun sur SA localisation. C'est ce que fait `<Routes location=…>`, et
 * il lui faut une table réutilisable — d'où cette constante, passée à
 * `AgentLayout` et rendue une fois par onglet vivant (voir `EcransVivants`).
 *
 * ⚠ Le parent est donc passé en `/dashboard/*` : sans le splat, une table de
 * routes DESCENDANTE ne peut rien matcher sous lui. Même mécanique que la
 * console super-admin (`admin/*`), qui monte déjà son propre `<Routes>`.
 *
 * ⚠ C'est un FRAGMENT, pas un tableau : `createRoutesFromChildren` traverse les
 * fragments, et le garder en JSX évite de réécrire quarante routes en objets —
 * donc d'en perdre une au passage.
 */
const ROUTES_TABLEAU_DE_BORD = (
  <>
  <Route index element={<ResponsiveRoute desktop={<TodayPage />} mobile={<MobileTodayPage />} />} />
  {/* La console vit DANS le CRM depuis juillet 2026 : plus d'onglet,
      plus de passage de session par fragment, et l'URL redevient
      rechargeable et partageable. Le splat `*` est requis — la
      console monte son propre <Routes> relatif dessous.

      Sous la coquille Sugar, qui ne rend aucun chrome : la
      console porte le sien. */}
  <Route path="admin/*" element={<AdminConsoleRoute />} />
  <Route path="pipeline" element={<ResponsiveRoute desktop={<PipelinePage />} mobile={<MobilePipelinePage />} />} />
  {/* Contacts — mobile (< 768px) : liste (P8). */}
  <Route path="contacts" element={<ResponsiveRoute desktop={<ContactsPage />} mobile={<MobileContactsListPage />} />} />
  {/* Création contact — mobile only (desktop : modale dans le pager). */}
  <Route path="contacts/new" element={<ResponsiveRoute desktop={<Navigate to="/dashboard/contacts" replace />} mobile={<MobileNewContactPage />} />} />
  {/* Import de contacts — porté sous Sugar (chrome auto-porté). */}
  {/* Portées depuis AgentLayout : elles épousent le pager Sugar. */}
  <Route path="market/:externalId" element={<ByParam><ExternalListingDetailPage /></ByParam>} />
  <Route path="marche/:externalId" element={<DashboardMarketRedirect />} />
  <Route path="listings/new" element={<ResponsiveRoute desktop={<ListingWizardPage />} mobile={<MobileWizardPage />} />} />
  <Route path="listings/:id/edit" element={<ByParam><ListingFormPage /></ByParam>} />
  {/* Fiche contact — pager 2 pages (refonte Claude Design juil. 2026).
      Sous AgentLayout (chrome Sugar auto-porté) pour cohérence
      liste↔fiche. Mobile (< 768px) : fiche détail P8/2. */}
  <Route path="contacts/:id" element={<ByParam><ResponsiveRoute desktop={<ContactDetailPage />} mobile={<MobileContactDetailPage />} /></ByParam>} />
  {/* Mes biens — mobile (< 768px) : galerie portefeuille (P7). */}
  <Route path="listings" element={<ResponsiveRoute desktop={<ListingsPage />} mobile={<MobileBiensPage />} />} />
  {/* Sprint 2 — Fiche Bien Sugar Pure (édition inline + AuditEvent).
      Mobile (< 768px) : fiche lecture seule (P7). */}
  <Route path="listings/:id" element={<ByParam><ResponsiveRoute desktop={<ListingDetailPage />} mobile={<MobileBienVitrinePage />} /></ByParam>} />
  {/* Sprint 2 — Fiche Deal Sugar Pure (stepper 8 + bannière KYC + offres) */}
  <Route path="transactions/:id" element={<ByParam><ResponsiveRoute desktop={<DealDetailPage />} mobile={<MobileDealDetailPage />} /></ByParam>} />
  {/* Sprint 2 — Modal Offre / Contre-offre (Sugar plein écran 3 étapes) */}
  <Route path="transactions/:id/offre/:kind" element={<ByParam><OfferPage /></ByParam>} />
  {/* Sprint 2 — Modal Planifier Visite (Sugar plein écran 3 étapes) */}
  <Route path="visits/new" element={<VisitNewPage />} />
  {/* Sprint 2 — Fiche Visite (bon + rapport) */}
  <Route path="visits/:id" element={<ByParam><VisitDetailPage /></ByParam>} />
  {/* Legacy FR */}
  <Route path="visites/nouveau" element={<Navigate to="/dashboard/visits/new" replace />} />
  <Route path="visites/:id" element={<DashboardVisitRedirect />} />
  {/* Sprint 3 — Import Lead IA (?text=...&returnTo=...) */}
  <Route path="import-lead" element={<ImportLeadPage />} />
  {/* Matching — pager vertical (refonte Claude Design juil. 2026) :
      page 0 = atelier triptyque « par score » · page 1 = recherche
      hybride du marché (vente + location). Deep-links portés par
      l'atelier : ?annonce=p:<id>|m:<id> · ?contact=<id>.
      Mobile (< 768px) : inbox acheteurs + focus. */}
  <Route path="matching" element={<ResponsiveRoute desktop={<MatchingPage />} mobile={<MobileMatchingPage />} />} />
  {/* Parcours — mobile (< 768px) : dossiers en vue panoramique (P9). */}
  <Route path="journey" element={<ResponsiveRoute desktop={<JourneyPage />} mobile={<MobileJourneyPage />} />} />
  <Route path="parcours" element={<Navigate to="/dashboard/journey" replace />} />
  {/* Agenda — mobile (< 768px) : jour liste + time-block (P6). */}
  <Route path="calendar" element={<ResponsiveRoute desktop={<CalendarPage />} mobile={<MobileAgendaPage />} />} />
  {/* Nouvel onglet — la page d'accueil d'un onglet neuf : un champ qui
      relaie vers ⌘K, et les destinations. Aucune donnée, aucune requête.
      ⚠ Bureau SEULEMENT, et volontairement : le CRM mobile n'a pas
      d'onglets (sa pilule à cinq destinations en tient lieu), donc la
      page n'y a pas d'appelant. Un mobile qui reçoit ce lien — pile
      restaurée d'une session de bureau — repart sur le cockpit. */}
  <Route path="nouvel-onglet" element={<ResponsiveRoute desktop={<NewTabPage />} mobile={<Navigate to="/dashboard" replace />} />} />
  {/* Messagerie — bento 296px | 1fr. Mobile (< 768px) : lecture seule (D16). */}
  <Route path="messagerie" element={<ResponsiveRoute desktop={<MessageriePage />} mobile={<MobileMessagerieScreen />} />} />
  {/* Réglages — mobile (< 768px) : hub de réglages (P9). */}
  <Route path="settings" element={<ResponsiveRoute desktop={<SettingsPage />} mobile={<MobileSettingsPage />} />} />
  {/* Sprint 1 — Sugar v3 (port pixel-près handoff KYC + LBA) */}
  {/* Étape 5 KYB, tâche 4 — garde LAB plein : KycLabGuard (layout-route, aucun
      path propre) remplace ces trois routes par un écran de blocage tant que
      agencies.verification_status n'est ni auto_validated ni validated.
      Regroupées sous un seul <Route> parent pour ne monter le garde qu'une fois. */}
  <Route element={<KycLabGuard />}>
    {/* KYC — pager 2 pages (Dossiers · Vigie). Mobile (< 768px) : liste (P9). */}
    <Route path="kyc" element={<ResponsiveRoute desktop={<KycPage />} mobile={<MobileKycListPage />} />} />
    {/* Onboarding « Première ouverture » (desktop) — refonte KYC. */}
    <Route
      path="kyc/bienvenue"
      element={<ResponsiveRoute desktop={<KycOnboardingPage />} mobile={<Navigate to="/dashboard/kyc" replace />} />}
    />
    {/* Détail dossier KYC — fiche en overlay (desktop) ; mobile : 4 onglets (P9). */}
    <Route path="kyc/:dossierId" element={<ByParam><ResponsiveRoute desktop={<KycPage />} mobile={<MobileKycDetailPage />} /></ByParam>} />
  </Route>
  {/* Étape 2 KYB — gate identité légale (useIdentityGate redirige ici depuis
      AgentLayout tant que agencies.identity_submitted_at est nul).
      Mobile (< 768px) : la saisie se termine sur ordinateur uniquement. */}
  <Route path="identite" element={<ResponsiveRoute desktop={<IdentityPage />} mobile={<IdentityMobileNotice />} />} />
  {/* Étape 3 KYB — réservation de l'appel d'accueil, à la sortie du wizard. */}
  <Route path="rendez-vous-accueil" element={<OnboardingCallPage />} />
  {/* Réseau inter-agences — hors périmètre v1 (route neutralisée ; NetworkSugarV2Page retirée) */}
  <Route path="network" element={<Navigate to="/dashboard" replace />} />
  <Route path="reseau" element={<Navigate to="/dashboard" replace />} />
  {/* Onboarding post-login supprimé (juil. 2026) — anciens liens/onglets ouverts → dashboard */}
  <Route path="onboarding" element={<Navigate to="/dashboard" replace />} />
  <Route path="premier-jour" element={<Navigate to="/dashboard" replace />} />
  {/* Sprint 1 — Journal d'audit nLPD (livrable #4) */}
  <Route path="audit" element={<AuditPage />} />
  {/* ⛔ La page « Julien » a été supprimée le 17 août 2026 : le copilote
      n'a plus qu'une surface, le dock MEGGA AI. La route REDIRIGE au lieu
      de disparaître — elle a été partagée en signet et le ⌘K y pointait
      encore hier. Même geste que /dashboard/network et le portail vendeur.
      Sa capacité propre (reprise d'une conversation persistée) est portée
      dans le dock, pas perdue : `useAiPanel.openConversation`. */}
  <Route path="julien" element={<Navigate to="/dashboard" replace />} />
  {/* Sprint 4 — Dashboard Analytics Sugar v4 (Cockpit / Entonnoir / Objectif) */}
  {/* Analytics — mobile (< 768px) : cockpit commission (P9). */}
  <Route path="analytics" element={<ResponsiveRoute desktop={<AnalyticsPage />} mobile={<MobileAnalyticsPage />} />} />
  {/* Hub « Plus » mobile-only — desktop redirige vers Réglages */}
  <Route
    path="more"
    element={
      <ResponsiveRoute
        desktop={<Navigate to="/dashboard/settings" replace />}
        mobile={<MobileMorePage />}
      />
    }
  />
    {/* ⛔ LE FILET, ET IL N'EST PAS FACULTATIF. Tant que `/dashboard` portait ses
        enfants, un chemin inconnu sous lui ne matchait AUCUNE route et retombait
        sur le `*` de premier niveau, donc sur `NotFoundPage`. Le splat
        `/dashboard/*` capture désormais tout : sans ce filet, cette table ne
        matche rien et rend `null` — un corps VIDE, pas une erreur.

        Mesuré par la suite Playwright sur `/dashboard/visits/:id/companion`
        (route retirée en juillet 2026, encore couverte par
        `crm-agent-params-coverage.spec.ts`) : « body too small (0 chars) ». Un
        écran blanc ne rougit nulle part ailleurs — c'est ce test-là qui l'a vu.

        ⛔ ET IL REND LE 404 *DU CRM*, PAS CELUI DE L'APPLICATION. Premier jet :
        `NotFoundPage`, qui se peint plein cadre — sans barre latérale, sans bande
        d'onglets. Retour de Julien : « ça me sort de la zone de contexte ». Il a
        raison, et ça coûte plus qu'un cadre : la pile d'onglets est toujours
        ouverte derrière, mais invisible, donc injoignable autrement que par le
        bouton « précédent ». Une adresse fausse ne doit pas coûter le plan de
        travail.

        ⚠ Conséquence assumée : une URL inconnue sous `/dashboard` prend
        maintenant un onglet (elle est `crmTabsEligible`), là où elle n'en prenait
        aucun — le fournisseur n'était pas monté. L'onglet porte le libellé de
        repli et se ferme comme un autre ; l'alternative, rediriger en silence
        vers le cockpit, effacerait la faute de frappe au lieu de la montrer. */}
    <Route path="*" element={<DashboardNotFoundPage />} />
  </>
)

function AppRoutes() {
  return (
    <Routes>
              {/* Public storefront (home, about, properties, contact, FAQ,
                  blog, agents, property single, design-system…) is served by
                  the static MEGGA vitrine (sites/megga-vitrine) on megga.ch.
                  This React app is deployed separately on app.megga.ch, where
                  "/" lands on the dashboard (which bounces to login if needed). */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              {/* Marketplace publique DÉSACTIVÉE (pivot CRM-first juin 2026) →
                  vitrine megga.ch. market_listings + cron Flatfox + matching
                  (edge matching-engine) intacts ; l'écran marché INTERNE du CRM
                  (/dashboard/market/:externalId) reste actif. */}
              <Route path="/search" element={<MarketplaceDisabledRedirect />} />
              {/* Marketplace property detail — the Property X art direction
                  (PxSingleProperty* sections), data-connected via useListingDetail.
                  The whole marketplace (cards, preview modal/panel, favourites,
                  saved searches, "similar listings" carousels, lightbox share link,
                  SEO canonical) points at /propriete/:id. A bare /propriete (no id)
                  isn't a real property, so it redirects to the search. */}
              <Route path="/propriete/:id" element={<MarketplaceDisabledRedirect />} />
              <Route path="/propriete" element={<MarketplaceDisabledRedirect />} />
              {/* Legacy /listing/:id (back-compat) → vitrine (marketplace désactivée). */}
              <Route path="/listing/:id" element={<MarketplaceDisabledRedirect />} />
              {/* Legacy /login + /register → redirect to the new bento auth.
                  Old code/CTA still works; the new modal owns the experience. */}
              {/* Connexion = vitrine (megga.ch/login). Tous les écrans de login /
                  inscription internes (ancienne direction) y redirigent. */}
              <Route path="/login" element={<VitrineLoginRedirect />} />
              <Route path="/register" element={<VitrineLoginRedirect />} />
              <Route path="/auth/callback" element={<AuthCallbackPage />} />
              <Route path="/auth/login" element={<VitrineLoginRedirect />} />
              <Route path="/auth/login/link-sent" element={<VitrineLoginRedirect />} />
              <Route path="/auth/login/error" element={<VitrineLoginRedirect />} />
              <Route path="/auth/signup" element={<VitrineLoginRedirect />} />
              <Route path="/auth/signup/verify-email" element={<VitrineLoginRedirect />} />
              <Route path="/auth/forgot-password" element={<VitrineLoginRedirect />} />
              <Route path="/auth/forgot-password/sent" element={<VitrineLoginRedirect />} />
              {/* TUYAUTERIE conservée : cible des e-mails de réinitialisation
                  envoyés par la vitrine (megga-auth.js → /auth/forgot-password/reset). */}
              <Route path="/auth/forgot-password/reset" element={<AuthSetNewPasswordPage />} />
              {/* Legacy FR auth routes → vitrine (sauf redefinir = tuyauterie reset). */}
              <Route path="/auth/connexion" element={<VitrineLoginRedirect />} />
              <Route path="/auth/connexion/lien-envoye" element={<VitrineLoginRedirect />} />
              <Route path="/auth/connexion/erreur" element={<VitrineLoginRedirect />} />
              <Route path="/auth/inscription" element={<VitrineLoginRedirect />} />
              <Route path="/auth/inscription/email-verifier" element={<VitrineLoginRedirect />} />
              <Route path="/auth/mot-de-passe-oublie" element={<VitrineLoginRedirect />} />
              <Route path="/auth/mot-de-passe-oublie/envoye" element={<VitrineLoginRedirect />} />
              <Route path="/auth/mot-de-passe-oublie/redefinir" element={<Navigate to="/auth/forgot-password/reset" replace />} />
              {/* Sprint 4.7.C — Parcours client KYC self-service via lien magique */}
              <Route path="/kyc/:token" element={<KycPublicPage />} />
              {/* Réception acheteur — sélection de biens transmise par lien privé (boucle de match) */}
              <Route path="/reception/:token" element={<BuyerReceptionPage />} />
              {/* Gestion par le client de son RDV de vérification KYC (jeton k='appt').
                  Le jeton porte déjà l'id du rendez-vous : pas d'id dans l'URL. */}
              <Route path="/rendez-vous/:token" element={<AppointmentManagePage />} />
              {/* Sprint 4.7.D — Rendu PDF tokenisé (Cloudflare Browser Rendering → WhatsApp) */}
              <Route path="/kyc-report/:token" element={<KycReportRenderPage />} />
              {/* Marketplace publique désactivée → vitrine. (SearchPage/RentPage
                  conservés en lazy import pour réactivation Sprint 7.) */}
              <Route path="/search-legacy" element={<MarketplaceDisabledRedirect />} />
              <Route path="/rent-legacy" element={<MarketplaceDisabledRedirect />} />
              <Route path="/buy" element={<MarketplaceDisabledRedirect />} />
              <Route path="/rent" element={<MarketplaceDisabledRedirect />} />
              <Route path="/acheter" element={<MarketplaceDisabledRedirect />} />
              <Route path="/louer" element={<MarketplaceDisabledRedirect />} />
              {/* Ancien site marketing (Property X) extrait et archivé hors GitHub
                  (2026-06-08). Ces URLs redirigent vers la nouvelle vitrine. */}
              <Route path="/about" element={<MarketplaceDisabledRedirect />} />
              <Route path="/contact" element={<MarketplaceDisabledRedirect />} />
              <Route path="/sell" element={<MarketplaceDisabledRedirect />} />
              <Route path="/estimates" element={<MarketplaceDisabledRedirect />} />
              <Route path="/estimate" element={<MarketplaceDisabledRedirect />} />
              <Route path="/services" element={<MarketplaceDisabledRedirect />} />
              <Route path="/publish" element={<MarketplaceDisabledRedirect />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/visit/:id/edit" element={<VisitManagePage />} />
              <Route path="/visit/:id/feedback" element={<VisitFeedbackPage />} />
              {/* Lien personnel de l'appel d'accueil : le jeton est la capability,
                  aucune session requise (cf. get_onboarding_call_by_token).

                  ⚠ `/rendez-vous-accueil/` et NON `/rendez-vous/` : ce dernier est déjà
                  pris, plus haut dans ce même fichier, par AppointmentManagePage (RDV de
                  vérification KYC, jeton émis par appointment-book). React Router retient
                  la PREMIÈRE route qui matche — cette page-ci était donc injoignable
                  depuis sa création, et chaque lien « replanifier ou annuler » des e-mails
                  d'appel d'accueil atterrissait sur l'écran KYC, qui interrogeait sa
                  propre RPC avec un jeton qu'elle ne connaît pas. Constaté le 04.08.2026
                  en essayant d'ouvrir la page.

                  Les trois edge functions qui construisent ce lien (onboarding-call-book,
                  -manage, -reminder) ont été alignées dans le même changement : le chemin
                  vit à quatre endroits, il doit bouger aux quatre. */}
              <Route path="/rendez-vous-accueil/:token" element={<OnboardingCallManagePage />} />
              <Route path="/agents" element={<MarketplaceDisabledRedirect />} />
              <Route path="/agents/:slug" element={<MarketplaceDisabledRedirect />} />
              <Route path="/agencies" element={<MarketplaceDisabledRedirect />} />
              <Route path="/accept-invite/:token" element={<AcceptInvitePage />} />

              {/* Legacy FR routes — 301 redirects preserve bookmarks + external links. */}
              <Route path="/acheter-legacy" element={<Navigate to="/search-legacy" replace />} />
              <Route path="/louer-legacy" element={<Navigate to="/rent-legacy" replace />} />
              <Route path="/vendre" element={<Navigate to="/sell" replace />} />
              <Route path="/estimations" element={<Navigate to="/estimates" replace />} />
              <Route path="/estimer" element={<Navigate to="/estimate" replace />} />
              <Route path="/publier" element={<Navigate to="/publish" replace />} />
              <Route path="/visite/:id/modifier" element={<VisitModifyRedirect />} />
              <Route path="/visite/:id/feedback" element={<VisitFeedbackRedirect />} />
              <Route path="/agences" element={<Navigate to="/agencies" replace />} />

              {/* Compte ACHETEUR (favoris, recherches sauvegardées, messagerie) —
                  DÉSACTIVÉ. Focus 100% CRM : market_listings ne sert plus que le
                  Matching. /account + /compte → /dashboard (les agents ont déjà
                  leur espace ; plus aucune surface acheteur). Réversible. */}
              <Route path="/account" element={<Navigate to="/dashboard" replace />} />
              <Route path="/compte" element={<Navigate to="/dashboard" replace />} />

              {/* Centre d'aide → Intercom. Le catch-all `*` couvre les anciens
                  sous-chemins (start, glossary, :category/:slug…) ; idem pour /aide. */}
              <Route path="/help" element={<HelpCenterRedirect />} />
              <Route path="/help/*" element={<HelpCenterRedirect />} />
              <Route path="/aide" element={<HelpCenterRedirect />} />
              <Route path="/aide/*" element={<HelpCenterRedirect />} />

              {/* Portail vendeur RETIRÉ — toutes ses URLs partent vers la vitrine.
                  Deux splats suffisent là où il y avait 13 routes. */}
              <Route path="/portal" element={<SellerPortalRemovedRedirect />} />
              <Route path="/portal/*" element={<SellerPortalRemovedRedirect />} />
              <Route path="/portail" element={<SellerPortalRemovedRedirect />} />
              <Route path="/portail/*" element={<SellerPortalRemovedRedirect />} />

              {/* Dev showcase routes (no auth) */}
              <Route path="/design-system/megga-x" element={<MeggaXStyleGuidePage />} />
              {/* Matching — QA visuelle du PAGER entier (chrome, 2 pages, bascule
                  de thème, états d'exception). Mocks du handoff, zéro écriture.
                  Le chemin garde son nom d'origine : il est cité tel quel dans le
                  cerveau comme le banc où s'éprouvent les modales de l'atelier. */}
              <Route path="/dev/matching-atelier" element={<MatchingShowcasePage />} />
              <Route path="/dev/sentry-test" element={<SentryTestPage />} />
              <Route path="/dev/mobile" element={<MobileShowcasePage />} />
              {/* Mes biens sans session : ProtectedRoute renvoie sinon vers la PRODUCTION. */}
              <Route path="/dev/biens" element={<BiensShowcasePage />} />
              {/* Contacts — même raison, même idiome (liste, fiche, premier lancement). */}
              <Route path="/dev/contacts" element={<ContactsShowcasePage />} />
              {/* Pipeline — la page RÉELLE par le slot `banc` : 3 vues, 8 colonnes,
                  états d'exception, modales, bascule de thème. Une seule vue à la
                  fois : `DealCard` porte un `layoutId` GLOBAL, et deux vues
                  montées ensemble videraient les colonnes jumelles. */}
              <Route path="/dev/pipeline" element={<PipelineShowcasePage />} />
              {/* Modales qu'aucun geste n'ouvre sans session : elles ne seraient
                  JAMAIS rendues hors production, donc jamais éprouvées. */}
              <Route path="/dev/modales" element={<ModalesShowcasePage />} />
              {/* Messagerie — l'écran réel sur fixtures : boîte pleine, boîte
                  vide, aucune boîte. Sans session, la vraie route renverrait
                  vers la production (ProtectedRoute). */}
              <Route path="/dev/messagerie" element={<MessagerieShowcasePage />} />
              {/* La FACE PUBLIQUE — les trois surfaces qu'un client ouvre sans
                  compte. ⚠ `/*` : le banc porte des routes IMBRIQUÉES, qui sont
                  ce qui donne aux pages le `:token` qu'elles lisent. Sans jeton
                  valide, `KycPublicPage` rend `null` — une page blanche. */}
              <Route path="/dev/public/*" element={<PublicShowcasePage />} />
              {/* Onboarding — la SEULE de ces routes à être conditionnée au mode dev.
                  Les autres ne montrent que des maquettes ; celle-ci monte les écrans
                  réels avec l'écriture entre étapes neutralisée (IdentityShellPreview),
                  ce qui n'a aucune raison d'exister dans un bundle déployé. */}
              {import.meta.env.DEV && (
                <Route path="/dev/onboarding" element={<OnboardingPreviewPage />} />
              )}
              {/* ⚠ `/dev/admin` n'est PAS ici : le banc de la console porte son
                  propre routeur, et React Router refuse un <Router> dans un
                  <Router>. Il est branché plus bas, dans `App()`, AVANT
                  <BrowserRouter>. */}


              {/* Messagerie — retour d'autorisation de la pop-up OAuth. Hors du
                  layout : la fenêtre ne vit que le temps de relayer `{code, state}`
                  à son opener. Protégée, car le repli sans opener échange le code
                  lui-même et a besoin de la session. */}
              <Route
                path="/oauth/mail/callback"
                element={
                  <ProtectedRoute>
                    <MailOAuthCallbackPage />
                  </ProtectedRoute>
                }
              />

              {/* Sprint 4.4 — Export PDF dossier KYC (protected, no layout — print-friendly) */}
              <Route
                path="/dashboard/kyc/:dossierId/export"
                element={
                  <ProtectedRoute>
                    <KycExportPage />
                  </ProtectedRoute>
                }
              />

              {/* Tier 3 — Sugar v2 Today screen (no traditional sidebar chrome) */}
              {/* ⚠ SPLAT, et la table est passée en prop : les écrans sont rendus
                  par `AgentLayout`, qui en garde trois vivants au lieu d'en
                  détruire un à chaque bascule d'onglet. Voir
                  `ROUTES_TABLEAU_DE_BORD` plus haut. */}
              <Route
                path="/dashboard/*"
                element={
                  <ProtectedRoute>
                    <AgentLayout routes={ROUTES_TABLEAU_DE_BORD} />
                  </ProtectedRoute>
                }
              />

              {/* 404 */}
              <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

// Rend le panneau MEGGA AI uniquement sur les routes CRM (/dashboard). Monté
// HORS de <Routes> → stable à la navigation (le panneau et
// sa conversation ne se ferment plus quand on change de page). Lazy + Suspense
// null car le panneau est invisible tant qu'il n'est pas ouvert.
function CopilotPanelHost() {
  const { pathname } = useLocation()
  if (!pathname.startsWith('/dashboard')) return null
  return (
    <Suspense fallback={null}>
      <CopilotPanel />
    </Suspense>
  )
}

/**
 * Le banc de la console remplace TOUT l'arbre de routage, il ne s'y insère pas.
 *
 * ⛔ Ce n'est pas un raccourci : React Router v6 LÈVE sur un `<Router>` rendu
 * dans un `<Router>` (« You should never have more than one in your app »), et
 * c'est précisément un second routeur — en mémoire — qui donne au banc son point
 * d'interception unique de la navigation. Il doit donc vivre AVANT
 * `<BrowserRouter>`, pas dans une route.
 *
 * Les providers gardés sont ceux dont le périmètre admin a besoin, mesurés :
 * `QueryClientProvider` (38 hooks React Query), `AuthProvider` (`AdminShell`
 * lit le profil) et `ToastProvider` (12 fichiers appellent `useToast` — sans
 * lui, la moitié des pages lèvent au montage).
 */
function BancConsoleAdmin() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <ErrorBoundary>
            <Suspense fallback={null}>
              <AdminShowcasePage />
            </Suspense>
          </ErrorBoundary>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}

/**
 * Le banc du CRM agent — un simple montage LAZY, et c'est délibéré.
 *
 * ⛔ IL NE POSE PAS LES PROVIDERS, contrairement au banc de la console. Le banc
 * doit SEMER une session avant qu'`AuthProvider` appelle `getSession()` ; s'il
 * les posait ici, l'effet du provider partirait pendant que le chunk de la page
 * charge encore, trouverait un stockage vide, poserait `profile: null` et n'y
 * reviendrait jamais — `useIdentityGate` resterait sur `loading` et la coquille
 * retiendrait l'écran sur `BootSplash` POUR TOUJOURS. Symptôme traître : le
 * jeton EST dans le stockage quand on regarde, c'est l'ORDRE qui est faux.
 *
 * ⛔ ET IL NE FAUT PAS NON PLUS IMPORTER LE SEMIS ICI pour l'appeler avant : un
 * import statique depuis `App.tsx` fait entrer l'identité de démonstration dans
 * le BUNDLE DÉPLOYÉ. Mesuré — « Agence MEGGA · démonstration » et son UUID se
 * sont retrouvés dans `index-*.js`, le minifieur retenant l'objet parce que son
 * `.id` est lu. La branche gelée en DEV ne suffit pas à faire disparaître ce
 * qu'un import statique amarre.
 *
 * Le banc monte donc SES providers lui-même, derrière l'import lazy.
 */
function BancCrmAgent() {
  return (
    <ErrorBoundary>
      <Suspense fallback={null}>
        <CrmShowcasePage />
      </Suspense>
    </ErrorBoundary>
  )
}

/** Point d'entrée : empile les providers globaux autour des routes et des widgets globaux (cookies, Intercom, panneau IA). */
export default function App() {
  // `import.meta.env.DEV` est remplacé par `false` au build : la branche entière
  // — et le chunk du banc — disparaissent du bundle déployé.
  if (import.meta.env.DEV && window.location.pathname.startsWith('/dev/admin')) {
    return <BancConsoleAdmin />
  }
  // ⚠ Conditionné au mode dev pour DEUX raisons, chacune suffisante : le banc
  // SÈME une session dans le stockage, et il monte des écrans de conformité
  // (KYC) et de facturation. Voir l'en-tête de `CrmShowcasePage`.
  if (import.meta.env.DEV && window.location.pathname.startsWith('/dev/crm')) {
    return <BancCrmAgent />
  }
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <StaleBundleDetector />
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ToastProvider>
            {/* Aucun voile de bascule de langue ici, et c'est délibéré (3 août 2026).
                `<LanguageChangeOverlay>` occupait cette place : 350 ms de verre dépoli
                plein écran par `languageChanged`. Or l'événement partait DEUX fois par
                choix — les sélecteurs appelaient `changeLanguage()` avant que le bundle
                existe —, soit ~1 s de veille opaque mesurée pour 60 ms de travail réel,
                avec un passage par le français au milieu. Le voile masquait ce défaut ;
                `switchLanguage()` (src/i18n/index.ts) le supprime à la source, en
                chargeant avant de basculer. Ce qui reste à couvrir est le seul
                téléchargement, et se couvre là où il se voit : un squelette DANS la
                surface concernée, jamais un voile sur toute l'application. */}
            <AiPanelProvider>
              <ErrorBoundary>
                <Suspense fallback={<SmartPageLoader />}>
                  <AppRoutes />
                </Suspense>
              </ErrorBoundary>
              {/* Panneau MEGGA AI — stable au-dessus de <Routes> (persiste à la nav). */}
              <CopilotPanelHost />
              {/* Reprise d'une impersonation ouverte depuis la console admin. */}
              <ImpersonationHandoff />
            </AiPanelProvider>
            {/* Widgets globaux : lazy avec fallback null car invisibles par défaut. */}
            <Suspense fallback={null}>
              <FavoritesLoginPrompt />
              <IntercomMessenger />
            </Suspense>
          </ToastProvider>
        </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  )
}
