/**
 * Sous-arbre de routes de la console super-admin.
 *
 * Monté par le CRM sous `/dashboard/admin/*`.
 *
 * Les cibles de navigation du rail sont préfixées par `ADMIN_CONSOLE_PATH`
 * (cf. `AdminShell`) et NON relatives : sous un splat, le relatif dépend d'un
 * drapeau de routeur que le CRM n'active pas.
 *
 * Ce composant ne porte NI routeur NI providers : ils appartiennent à l'hôte,
 * `AdminThemeProvider` compris (posé par `AdminConsoleRoute`).
 */
import { lazy, Suspense } from 'react'
import { importAvecReprise } from '@/lib/staleChunkRecovery'
import { Routes, Route, Navigate } from 'react-router-dom'
import AdminShell from '@/components/admin/AdminShell'
import ByParam from '@/components/layout/ByParam'

const AdminDashboardPage = lazy(() => importAvecReprise(() => import('@/pages/admin/AdminDashboardPage')))
const AdminAgenciesPage = lazy(() => importAvecReprise(() => import('@/pages/admin/AdminAgenciesPage')))
const AdminAgencyDetailPage = lazy(() => importAvecReprise(() => import('@/pages/admin/AdminAgencyDetailPage')))
const AdminUsersPage = lazy(() => importAvecReprise(() => import('@/pages/admin/AdminUsersPage')))
const AdminEndUsersPage = lazy(() => importAvecReprise(() => import('@/pages/admin/AdminEndUsersPage')))
const AdminMonitoringPage = lazy(() => importAvecReprise(() => import('@/pages/admin/AdminMonitoringPage')))
const AdminModerationPage = lazy(() => importAvecReprise(() => import('@/pages/admin/AdminModerationPage')))
const AdminCompliancePage = lazy(() => importAvecReprise(() => import('@/pages/admin/AdminCompliancePage')))
const AdminKybReviewPage = lazy(() => importAvecReprise(() => import('@/pages/admin/AdminKybReviewPage')))
const AdminOnboardingCallsPage = lazy(() => importAvecReprise(() => import('@/pages/admin/AdminOnboardingCallsPage')))
const AdminCommunicationPage = lazy(() => importAvecReprise(() => import('@/pages/admin/AdminCommunicationPage')))
const AdminFeatureFlagsPage = lazy(() => importAvecReprise(() => import('@/pages/admin/AdminFeatureFlagsPage')))
const AdminPlansPage = lazy(() => importAvecReprise(() => import('@/pages/admin/AdminPlansPage')))
const AdminLiveFeedPage = lazy(() => importAvecReprise(() => import('@/pages/admin/AdminLiveFeedPage')))
const AdminSecurityAuditPage = lazy(() => importAvecReprise(() => import('@/pages/admin/AdminSecurityAuditPage')))
const AdminNpsPage = lazy(() => importAvecReprise(() => import('@/pages/admin/AdminNpsPage')))
const AdminAutonomyPage = lazy(() => importAvecReprise(() => import('@/pages/admin/AdminAutonomyPage')))
const AdminToolUsagePage = lazy(() => importAvecReprise(() => import('@/pages/admin/AdminToolUsagePage')))
const AdminLearningPage = lazy(() => importAvecReprise(() => import('@/pages/admin/AdminLearningPage')))

/** Repli de chargement des chunks — neutre, aux couleurs de la console. */
function ChunkFallback() {
  return (
    <div className="p-6">
      <div className="h-6 w-40 rounded bg-theme-hover animate-pulse" />
    </div>
  )
}

export default function AdminConsoleRoutes() {
  return (
    <Suspense fallback={<ChunkFallback />}>
        <Routes>
          <Route element={<AdminShell />}>
            <Route index element={<AdminDashboardPage />} />
            <Route path="agencies" element={<AdminAgenciesPage />} />
            {/* `ByParam` comme les 9 feuilles `:id` du CRM : sans lui, passer
                d'une agence à l'autre gardait le MÊME élément monté, donc le
                message de confirmation de la précédente (« Agence suspendue »)
                restait affiché sur la suivante. */}
            <Route path="agencies/:id" element={<ByParam><AdminAgencyDetailPage /></ByParam>} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="end-users" element={<AdminEndUsersPage />} />
            <Route path="monitoring" element={<AdminMonitoringPage />} />
            <Route path="moderation" element={<AdminModerationPage />} />
            {/* La page a longtemps porté le nom du module marketplace, retiré
                depuis : elle modère les biens des agences. L'ancien chemin
                survit pour les favoris et les liens déjà partagés. */}
            <Route path="marketplace" element={<Navigate to="../moderation" replace />} />
            <Route path="compliance" element={<AdminCompliancePage />} />
            {/* File de revue KYB (étape 5 du chantier d'onboarding agence). La
                route vivait dans `AdminApp.tsx`, l'application autonome retirée
                le 28.07 — remontée ici au merge, sans quoi l'entrée de rail
                `nav.adminKybReview` d'`AdminShell` tomberait sur le 404 du CRM et
                les quatre décisions humaines de conformité seraient injoignables. */}
            <Route path="kyb-review" element={<AdminKybReviewPage />} />
            <Route path="onboarding-calls" element={<AdminOnboardingCallsPage />} />
            <Route path="changelog" element={<AdminCommunicationPage />} />
            <Route path="feature-flags" element={<AdminFeatureFlagsPage />} />
            <Route path="plans" element={<AdminPlansPage />} />
            <Route path="live" element={<AdminLiveFeedPage />} />
            <Route path="security" element={<AdminSecurityAuditPage />} />
            <Route path="nps" element={<AdminNpsPage />} />
            <Route path="autonomy" element={<AdminAutonomyPage />} />
            <Route path="tool-usage" element={<AdminToolUsagePage />} />
            <Route path="learning" element={<AdminLearningPage />} />
            {/* Inconnu → accueil de la console, relatif au point de montage. */}
            <Route path="*" element={<Navigate to="." replace />} />
          </Route>
        </Routes>
    </Suspense>
  )
}
