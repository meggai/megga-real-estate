// MEGGA — Centre de notifications agent (réel).
// Remplace le mock SUGAR_NOTIFS : dérive les notifications des `activity_events`
// non-utilisateur (système/IA) de l'agence — « ce que le système a fait que vous
// devez savoir » : décisions vendeur, screening KYC, relances IA, etc.
//
// - RLS : `events_select` scope déjà à l'agence (agency_id = get_my_agency_id()).
// - Filtre `actor_kind <> 'user'` → couvert par l'index partiel
//   idx_activity_events_actor_kind (agency_id, actor_kind, created_at DESC).
// - Realtime : pattern useId() obligatoire (cf. useAdminLiveFeed) — sinon crash au re-mount.
// - État « non lu » : activity_events est immuable (audit nLPD) → on suit un
//   last-seen + un set d'ids lus en localStorage (le point rouge, pas l'audit).
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { CrmNotif, NotifKind, NotifPriority, NotifGroup } from '@/components/crm/notifications/data'

const LAST_SEEN_KEY = 'megga-agent-notif-lastseen'
const READ_IDS_KEY = 'megga-agent-notif-read'

interface RawEvent {
  id: string
  action: string
  entity_type: string | null
  entity_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  category: string | null
  severity: string | null
  object_label: string | null
}

/** Classe une action/catégorie d'événement en `NotifKind` (kyc, visite, offre…). */
function toKind(action: string, category: string | null): NotifKind {
  const a = (action || '').toLowerCase()
  if (/kyc|screening|pep|sanction/.test(a) || category === 'kyc') return 'kyc'
  if (/visit|visite/.test(a)) return 'visite'
  if (/offer|offre/.test(a)) return 'offre'
  if (/mandate|mandat|sign|compromis/.test(a)) return 'mandat'
  if (/document|\bdoc\b/.test(a) || category === 'doc') return 'doc'
  if (/team|invite|member|équipe|equipe/.test(a)) return 'team'
  if (/prospect|lead/.test(a)) return 'ai'
  if (/\bai\b|copilot|relance/.test(a) || category === 'ai') return 'ai'
  if (category === 'deal') return 'offre'
  return 'system'
}

/** Mappe la sévérité de l'événement en priorité d'affichage (high / med / low). */
function toPriority(severity: string | null): NotifPriority {
  if (severity === 'critical' || severity === 'error') return 'high'
  if (severity === 'warning' || severity === 'warn') return 'med'
  return 'low'
}

/** Range un horodatage ISO dans le bucket temporel : aujourd'hui / hier / plus ancien. */
function toGroup(iso: string): NotifGroup {
  const t = new Date(iso).getTime()
  const now = new Date()
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  if (t >= startToday) return 'today'
  if (t >= startToday - 86_400_000) return 'yesterday'
  return 'older'
}

/** Libellé relatif français (« Il y a 3 min ») depuis un ISO. */
function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return "À l'instant"
  if (m < 60) return `Il y a ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `Il y a ${h} h`
  return `Il y a ${Math.floor(h / 24)} j`
}

const ACTION_TITLES: Record<string, string> = {
  seller_offer_decision: 'Décision du vendeur sur une offre',
  whatsapp_inbound_lead_created: 'Nouveau prospect WhatsApp',
}

/** Titre lisible d'un événement : label serveur, sinon mapping connu, sinon action humanisée. */
function titleFor(ev: RawEvent): string {
  if (ev.object_label) return ev.object_label
  if (ACTION_TITLES[ev.action]) return ACTION_TITLES[ev.action]
  return ev.action.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
}

// Navigation deep-link non câblée (onNavigate = écran top-level) → clic = marquer lu.
// `ctaTo` vide ⇒ pas de navigation hasardeuse. Polish ultérieur possible.
function ctaFor(): { cta: string; ctaTo: string } {
  return { cta: '', ctaTo: '' }
}

/** Set des ids marqués lus, restauré depuis localStorage (le point rouge, pas l'audit). */
function loadReadIds(): Set<string> {
  try {
    const raw = localStorage.getItem(READ_IDS_KEY)
    return new Set<string>(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set<string>()
  }
}

/** Timestamp last-seen restauré depuis localStorage (0 si absent). */
function loadLastSeen(): number {
  try {
    return Number(localStorage.getItem(LAST_SEEN_KEY)) || 0
  } catch {
    return 0
  }
}

export interface AgentNotifications {
  items: CrmNotif[]
  unreadCount: number
  isLoading: boolean
  markRead: (id: string) => void
  markAllRead: () => void
}

/**
 * Centre de notifications agent : dérive des `CrmNotif` depuis les
 * `activity_events` non-utilisateur, avec compteur non-lu (last-seen + set
 * localStorage) et rafraîchissement Realtime. `limit` borne la lecture.
 *
 * ⛔ `abonne` N'EST PAS UN CONFORT — il est la contrepartie des écrans vivants.
 * La cloche vit dans la bande d'onglets, et la bande est rendue par CHAQUE écran
 * (le chrome est per-page par conception). Six écrans vivants, c'est donc six
 * instances de ce hook. La REQUÊTE, elle, ne coûte qu'une fois : React Query la
 * déduplique sur `['agent-notifications', limit]`. Le CANAL Realtime, non — il
 * porte un `useId()`, donc six abonnements distincts sur le même INSERT, et six
 * invalidations identiques à chaque écriture d'`activity_events`.
 *
 * Un seul écran est visible à la fois : seule sa bande s'abonne. Les cinq autres
 * lisent le cache partagé, qu'elles verront rafraîchi comme les autres — et
 * quand l'une d'elles devient visible, elle s'abonne à son tour et sa première
 * lecture vient du même cache, sans requête.
 */
export function useAgentNotifications(limit = 30, abonne = true): AgentNotifications {
  const queryClient = useQueryClient()
  const channelId = useId()
  const [readIds, setReadIds] = useState<Set<string>>(() => loadReadIds())
  const [lastSeen, setLastSeen] = useState<number>(() => loadLastSeen())

  const query = useQuery({
    queryKey: ['agent-notifications', limit],
    queryFn: async (): Promise<RawEvent[]> => {
      const { data, error } = await supabase
        .from('activity_events')
        .select('id, action, entity_type, entity_id, metadata, created_at, category, severity, object_label')
        .neq('actor_kind', 'user')
        .order('created_at', { ascending: false })
        .limit(limit)
      if (error) throw error
      return (data ?? []) as RawEvent[]
    },
    staleTime: 30_000,
  })

  // Realtime — nouvelle notif instantanée (RLS scope déjà à l'agence).
  useEffect(() => {
    if (!abonne) return
    const channel = supabase
      .channel(`agent-notifs-${channelId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_events' }, () => {
        queryClient.invalidateQueries({ queryKey: ['agent-notifications'] })
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient, channelId, abonne])

  const items = useMemo<CrmNotif[]>(() => {
    return (query.data ?? []).map((ev) => {
      const read = readIds.has(ev.id) || new Date(ev.created_at).getTime() <= lastSeen
      const { cta, ctaTo } = ctaFor()
      return {
        id: ev.id,
        kind: toKind(ev.action, ev.category),
        priority: toPriority(ev.severity),
        read,
        title: titleFor(ev),
        body: '',
        time: relTime(ev.created_at),
        group: toGroup(ev.created_at),
        cta,
        ctaTo,
      }
    })
  }, [query.data, readIds, lastSeen])

  const unreadCount = useMemo(() => items.filter((n) => !n.read).length, [items])

  const markRead = useCallback((id: string) => {
    setReadIds((prev) => {
      const next = new Set(prev)
      next.add(id)
      try {
        localStorage.setItem(READ_IDS_KEY, JSON.stringify([...next]))
      } catch {
        /* no-op */
      }
      return next
    })
  }, [])

  // Tout marquer lu = avancer le last-seen à maintenant + purger le set (audit immuable).
  const markAllRead = useCallback(() => {
    const now = Date.now()
    setLastSeen(now)
    setReadIds(new Set<string>())
    try {
      localStorage.setItem(LAST_SEEN_KEY, String(now))
      localStorage.removeItem(READ_IDS_KEY)
    } catch {
      /* no-op */
    }
  }, [])

  return { items, unreadCount, isLoading: query.isLoading, markRead, markAllRead }
}
