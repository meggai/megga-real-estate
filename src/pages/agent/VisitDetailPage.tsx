// MEGGA CRM — Fiche Visite (desktop)
// Port pixel-près de crm-screen-visite-sugar.jsx (handoff Sprint 2).
//
// Layout :
//   - Header (retour calendrier + ref + actions)
//   - Hero (titre + visiteur + adresse + date)
//   - Grid : panneau bon + rapport (gauche) | iPhone compagnon (droite)
//
// Sync Realtime : tout update push du mobile arrive ici via useVisitRealtime.
// Route : /dashboard/visits/:id
//
// ⛔ ELLE NE PORTAIT AUCUN CHROME jusqu'au 7 septembre 2026, et c'était visible :
// `/dashboard/visits/:id` ouvre un onglet comme toute autre fiche (`visit` est
// l'un des cinq genres de `crmTabRecordRef`, et `crm_tabs_resolve_labels` sait
// en résoudre le libellé), mais l'écran rendait sa propre page pleine largeur.
// Basculer sur cet onglet faisait donc DISPARAÎTRE la bande d'onglets ET la
// barre latérale — plus aucun moyen d'en ressortir autrement que par le lien
// « retour au calendrier ». Les trois autres fiches (contact, bien, deal)
// montaient déjà `CrmWorkspace` ; celle-ci avait été oubliée.
//
// ⚠ Les trois routes qui restent SANS chrome le sont par choix et gardent ce
// choix : `visits/new`, `transactions/:id/offre/:kind` et `import-lead` sont des
// modales de plein écran (`position: fixed`, une croix pour sortir), pas des
// fiches.

import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { dossierPalette, DOSSIER_KEYFRAMES } from '@/components/crm-dossiers/tokens'
import { CRM_DARK_KEY, readCrmDark } from '@/lib/crmDark'
import { crmPalette } from '@/components/crm/tokens'
import CrmWorkspace from '@/components/crm/CrmWorkspace'
import { CrmIcon } from '@/components/crm-dossiers/icons'
import {
  CrmBlackPill,
  CrmGhostPill,
} from '@/components/crm-dossiers/primitives'
import {
  VdEyebrow,
  VdCard,
  VdBonPanel,
  VdRapportPanel,
} from '@/components/crm-dossiers/visite-detail/VdShared'
import {
  useVisitDetail,
  useVisitRealtime,
  useSignVisitBon,
} from '@/hooks/useVisitDetail'
import { supabase } from '@/lib/supabase'

function vdDateLong(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-CH', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

export default function VisitDetailPage() {
  const { t } = useTranslation('calendar')
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: visit, isLoading, isError, error } = useVisitDetail(id)
  const { mutate: signBon } = useSignVisitBon()
  useVisitRealtime(id)
  /**
   * ⚠ `readCrmDark()` + état local, et non `useCrmDark()` : la barre latérale de
   * cette page BASCULE désormais le thème (`setDark` lui est passé), et le hook
   * est en lecture seule. Deux sources — l'état local pour `sp`, le hook pour
   * `S` — divergeraient au clic. Même idiome qu'`AuditPage` et `CalendarPage`.
   */
  const [dark, setDark] = useState<boolean>(readCrmDark)
  useEffect(() => {
    if (typeof window !== 'undefined') window.localStorage.setItem(CRM_DARK_KEY, dark ? '1' : '0')
  }, [dark])
  const S = useMemo(() => dossierPalette(dark), [dark])
  const sp = useMemo(() => crmPalette(dark), [dark])

  /**
   * La coquille — barre latérale, bande d'onglets, puis le contenu.
   *
   * ⚠ Régime de hauteur `minHeight`, pas `height: 100vh` : cette fiche défile
   * (le bon et le rapport s'empilent). C'est celui d'`AuditPage`, l'autre des
   * deux régimes que `CrmWorkspace` accepte — voir son en-tête.
   */
  const coquille = (contenu: ReactNode) => (
    <div
      data-screen-label="Fiche Visite"
      style={{
        width: '100%',
        minHeight: '100vh',
        background: S.bgGradient,
        color: S.ink,
        fontFamily: S.font,
      }}
    >
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <CrmWorkspace active="calendar" sp={sp} dark={dark} setDark={setDark}>
          {contenu}
        </CrmWorkspace>
      </div>
    </div>
  )

  if (isLoading) {
    return coquille(
      <main style={{ flex: 1, minWidth: 0, display: 'grid', placeItems: 'center', color: S.muted }}>
        {t('visitDetail.loading')}
      </main>,
    )
  }
  if (isError) {
    return coquille(
      <main style={{
        flex: 1, minWidth: 0, display: 'grid', placeItems: 'center',
        color: S.errDarker, padding: 40, textAlign: 'center',
      }}>
        {t('visitDetail.loadError', {
          message: error?.message ?? t('visitDetail.unknownError'),
        })}
      </main>,
    )
  }
  if (!visit) {
    return coquille(
      <main style={{ flex: 1, minWidth: 0, display: 'grid', placeItems: 'center', color: S.muted }}>
        {t('visitDetail.notFound')}
      </main>,
    )
  }

  const isDone = visit.kind === 'done'

  return coquille(
    <>
      <style>{DOSSIER_KEYFRAMES}</style>
      <style>{`
        @keyframes vdPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
      `}</style>

      <main style={{ flex: 1, minWidth: 0, padding: '28px 40px 80px' }}>
        {/* Header */}
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            marginBottom: 32,
            flexWrap: 'wrap',
          }}
        >
          <CrmGhostPill
            icon={<CrmIcon name="arrowL" size={15} stroke={S.inkSoft} />}
            onClick={() => navigate('/dashboard/calendar')}
          >
            {t('visitDetail.backToCalendar')}
          </CrmGhostPill>
          <span
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              whiteSpace: 'nowrap',
              fontSize: 'var(--crm-text-sm)',
              color: S.muted,
              letterSpacing: 0.3,
            }}
          >
            {visit.id.slice(0, 8).toUpperCase()}
          </span>
          <div style={{ flex: 1 }} />
          {/* "Modifier" icon button removed — no inline-edit page exists.
              Drag-drop on the calendar handles reschedule today. Inline
              edition is a separate chip. */}
          <CrmBlackPill
            icon={
              <CrmIcon
                name={isDone ? 'check' : 'pen'}
                size={14}
                stroke="#fff"
                sw={2}
              />
            }
            onClick={async () => {
              // Real lifecycle transition based on current status:
              //   planned   → confirmed   (agent confirms attendance)
              //   confirmed → done        (agent reports visit happened)
              //   done      → no action (display-only label)
              if (isDone) return
              const nextStatus = visit.status === 'confirmed' ? 'done' : 'confirmed'
              const { error: updErr } = await supabase
                .from('visits')
                .update({
                  status: nextStatus,
                  ...(nextStatus === 'done' ? { completed_at: new Date().toISOString() } : {}),
                })
                .eq('id', visit.id)
              if (updErr) {
                 
                window.alert(t('visitDetail.statusUpdateError', { message: updErr.message }))
              }
            }}
          >
            {isDone
              ? t('visitDetail.cta.visitDone')
              : visit.status === 'confirmed'
                ? t('visitDetail.cta.markDone')
                : t('visitDetail.cta.confirm')}
          </CrmBlackPill>
        </header>

        {/* Hero */}
        <VdCard padding={32} style={{ marginBottom: 24 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 24,
            }}
          >
            <div style={{ flex: 1, minWidth: 280 }}>
              <VdEyebrow>
                {t('visitDetail.eyebrow.prefix')} ·{' '}
                {isDone
                  ? t('visitDetail.eyebrow.done')
                  : t('visitDetail.eyebrow.planned')}
              </VdEyebrow>
              <h1
                style={{
                  margin: '12px 0 10px',
                  fontSize: 'var(--crm-text-8xl)',
                  fontWeight: 600,
                  color: S.ink,
                  letterSpacing: -0.8,
                  lineHeight: 1.15,
                }}
              >
                {visit.property?.title ?? t('visitDetail.propertyFallback')}
                <span style={{ color: S.muted, fontWeight: 500 }}>
                  {' '}
                  {t('visitDetail.withContact', {
                    name: visit.contact
                      ? `${visit.contact.first_name} ${visit.contact.last_name}`
                      : '—',
                  })}
                </span>
              </h1>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  flexWrap: 'wrap',
                  color: S.muted,
                  fontSize: 'var(--crm-text-lg)',
                  fontWeight: 500,
                }}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 7,
                  }}
                >
                  <CrmIcon name="cal" size={14} stroke={S.muted} />
                  {vdDateLong(visit.scheduled_at)}
                </span>
                <span>·</span>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 7,
                  }}
                >
                  <CrmIcon name="clock" size={14} stroke={S.muted} />
                  {new Date(visit.scheduled_at).toLocaleTimeString('fr-CH', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}{' '}
                  ({visit.duration_minutes} min)
                </span>
                {visit.property?.address && (
                  <>
                    <span>·</span>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 7,
                      }}
                    >
                      <CrmIcon name="pin" size={14} stroke={S.muted} />
                      {visit.property.address}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </VdCard>

        {/* Grid panels + mobile */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 360px',
            gap: 28,
            alignItems: 'flex-start',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 24,
              minWidth: 0,
            }}
          >
            <VdBonPanel
              visit={visit}
              onSign={() => {
                if (!visit.bon) return
                signBon({ visitId: visit.id, bon: visit.bon })
              }}
            />
            <VdRapportPanel visit={visit} />
          </div>
          {/* VdMobileCompanion preview removed — the component held mostly
              non-functional UI (sentiment cards, mic, photo, signature
              with no persistence). Real on-site visit capture is a
              separate sprint. */}
        </div>
      </main>
    </>,
  )
}
