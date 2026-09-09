#!/usr/bin/env node
// scripts/security-audit.mjs
//
// Weekly security audit for MEGGA Real Estate.
// Strategy: static analysis on local migrations + edge functions (the repo is
// source of truth), combined with lightweight runtime probes against the
// production Supabase REST endpoint.
//
// Required env vars:
//   SUPABASE_URL                — e.g. https://eayczugyrvmtqnnmvjod.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY   — used for runtime probes (read-only)
//   RESEND_API_KEY              — only required if anomalies are found
//
// Exit: 0 if clean, 1 if any anomaly detected.
import fs from 'node:fs'
import path from 'node:path'

const REPO_ROOT = process.cwd()
const MIGRATIONS_DIR = path.join(REPO_ROOT, 'supabase/migrations')
const FUNCTIONS_DIR = path.join(REPO_ROOT, 'supabase/functions')

const CRITICAL_TABLES = [
  'agent_profiles',
  'agency_profiles',
  'support_tickets',
  'kyc_cases',
  'transactions',
  'contacts',
  'properties',
]

const CRITICAL_EDGE_FUNCTIONS = [
  'weekly-report',
  'admin-stripe-metrics',
  'admin-monitoring',
]

const anomalies = []
const notes = []

// ── Helpers ────────────────────────────────────────────────────────────────

function readAllMigrations() {
  if (!fs.existsSync(MIGRATIONS_DIR)) throw new Error(`Migrations dir not found: ${MIGRATIONS_DIR}`)
  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort()
  return files.map((f) => ({
    file: f,
    content: fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8'),
  }))
}

// Strip SQL comments (-- line, /* block */) to avoid false positives in regex.
function stripSqlComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/--[^\n]*/g, '')
}

// Regex fragment for a (optionally schema-qualified, optionally quoted) object
// name. Matches plain `table`, `public.table`, `"table"`, and the form used by
// `supabase db dump` in the baseline: `"public"."table"`. Without this, the
// dumped baseline (which quotes every identifier) reads as "RLS not enabled".
function qualifiedName(name) {
  // (?:"public"\.|public\.)?  then  "name" | name
  return `(?:(?:"public"|public)\\s*\\.\\s*)?"?${name}"?`
}

/**
 * Blanchit les commentaires JS/TS (// ... et une paire slash-etoile), en preservant
 * les sauts de ligne pour ne pas decaler les numeros de ligne. Meme role que
 * stripSqlComments : un motif ne doit jamais matcher la prose qui raconte le code.
 * Approximation assumee : une sequence ressemblant a un commentaire DANS une chaine
 * serait blanchie aussi. Sans consequence ici -- on ne cherche que la PRESENCE d'une
 * garde, et blanchir de trop ne peut que faire crier la porte, jamais la taire.
 */
function stripJsComments(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(m.length - p1.length))
}

// ── Check 1: RLS enabled on critical tables ────────────────────────────────

function checkRlsEnabled(migrations) {
  const combinedSql = migrations.map((m) => stripSqlComments(m.content)).join('\n')

  for (const table of CRITICAL_TABLES) {
    // Match: ALTER TABLE [public.]table ENABLE ROW LEVEL SECURITY;
    // Accepts plain, schema-qualified and quoted identifiers (incl. the
    // "public"."table" form emitted by supabase db dump in the baseline).
    const tbl = qualifiedName(table)
    const enableRe = new RegExp(
      `ALTER\\s+TABLE\\s+(?:ONLY\\s+)?${tbl}[^;]*ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY`,
      'i',
    )
    const forceRe = new RegExp(
      `ALTER\\s+TABLE\\s+(?:ONLY\\s+)?${tbl}[^;]*FORCE\\s+ROW\\s+LEVEL\\s+SECURITY`,
      'i',
    )
    const disableRe = new RegExp(
      `ALTER\\s+TABLE\\s+(?:ONLY\\s+)?${tbl}[^;]*DISABLE\\s+ROW\\s+LEVEL\\s+SECURITY`,
      'i',
    )

    const enabled = enableRe.test(combinedSql) || forceRe.test(combinedSql)
    const disabled = disableRe.test(combinedSql)

    if (!enabled) {
      anomalies.push(`RLS not enabled on table "${table}" (no ENABLE/FORCE ROW LEVEL SECURITY found in migrations)`)
    } else if (disabled && !combinedSql.match(new RegExp(`DISABLE ROW LEVEL SECURITY[\\s\\S]*${table}[\\s\\S]*ENABLE ROW LEVEL SECURITY`, 'i'))) {
      anomalies.push(`RLS was DISABLED on table "${table}" after being enabled — check migration order`)
    }
  }
}

// ── Check 2: is_super_admin() exists and is SECURITY DEFINER ───────────────

function checkSuperAdminFunction(migrations) {
  const combinedSql = migrations.map((m) => stripSqlComments(m.content)).join('\n')

  // Find CREATE OR REPLACE FUNCTION ... is_super_admin ...
  // Accepts the quoted "public"."is_super_admin" form from the baseline dump.
  const fn = qualifiedName('is_super_admin')
  const fnRegex = new RegExp(
    `CREATE\\s+(?:OR\\s+REPLACE\\s+)?FUNCTION\\s+${fn}\\s*\\([^)]*\\)[\\s\\S]*?(?=\\$\\$|LANGUAGE|;)`,
    'gi',
  )
  const matches = combinedSql.match(fnRegex)

  if (!matches || matches.length === 0) {
    anomalies.push('Function is_super_admin() is not defined in any migration')
    return
  }

  // Check at least one definition includes SECURITY DEFINER.
  // We scan the full surrounding function block (up to the next $$ END or ;).
  const fullFnRegex = new RegExp(
    `CREATE\\s+(?:OR\\s+REPLACE\\s+)?FUNCTION\\s+${fn}\\s*\\([^)]*\\)[\\s\\S]*?\\$\\$[\\s\\S]*?\\$\\$[^;]*;`,
    'gi',
  )
  const fullBlocks = combinedSql.match(fullFnRegex) || []

  const hasSecurityDefiner = fullBlocks.some((block) => /SECURITY\s+DEFINER/i.test(block))

  if (!hasSecurityDefiner) {
    anomalies.push('Function is_super_admin() exists but is not SECURITY DEFINER')
  }
}

/**
 * Policies `USING (true)` DELIBEREES. Une entree ici n'est pas un laissez-passer :
 * elle porte l'invariant qui la rend sure, et l'exemption TOMBE si l'invariant
 * tombe. Sans ca on n'aurait pas repare la porte, on l'aurait baillonnee -- et une
 * garde qu'on fait taire par liste est exactement ce qui l'a rendue illisible
 * pendant huit semaines.
 */
const PERMISSIVE_POLICY_EXEMPTIONS = [
  {
    policy: 'read_agency_profiles',
    table: 'agency_profiles',
    raison:
      "L'annuaire d'agences est lisible par tout compte connecte, c'est voulu (jointure de " +
      'Matching Recherche). La confidentialite ne repose PAS sur le predicat de la policy ' +
      'mais sur des privileges de COLONNE : la migration 20260729130000 revoque le SELECT de ' +
      'TABLE a `authenticated` puis le re-grante colonne par colonne en excluant `claim_token`, ' +
      "le jeton qui permet de revendiquer un profil d'agence. Verifie en production le " +
      '03.09.2026 : `authenticated` lit 31 colonnes sur 32, `claim_token` exclu.',
    // ATTENTION, piege de mesure a ne pas refaire : has_table_privilege('authenticated',
    // 'public.agency_profiles','SELECT') rend FALSE ici, ce qui donne a croire que la policy
    // est inerte. Elle ne l'est pas : cette fonction ne voit que le privilege de TABLE, pas
    // les privileges de COLONNE qui portent reellement la lecture.
    invariant: '`claim_token` reste hors du GRANT de colonnes accorde a `authenticated`',
    tientEncore: (allSql) =>
      !/GRANT\s+SELECT\s*\([^)]*\bclaim_token\b[^)]*\)\s+ON\s+(?:public\.)?"?agency_profiles"?\s+TO\s+[^;]*\bauthenticated\b/i.test(allSql),
  },
]

// ── Check 3: No USING (true) on critical tables for authenticated ──────────
//
// If a permissive policy is created in an early migration but dropped by name
// in a later one, we consider it not active. This mirrors the reality of our
// 2026-04-10 RLS security audit which dropped several such policies.

function policyDroppedLater(policyName, tableName, currentFile, allMigrations) {
  for (const m of allMigrations) {
    if (m.file <= currentFile) continue
    const sql = stripSqlComments(m.content)
    // Match DROP POLICY "name" ON [public.]table  or  DROP POLICY IF EXISTS ...
    const re = new RegExp(
      `DROP\\s+POLICY\\s+(?:IF\\s+EXISTS\\s+)?"?${policyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"?\\s+ON\\s+(?:public\\.)?${tableName}\\b`,
      'i',
    )
    if (re.test(sql)) return m.file
  }
  return null
}

function checkPermissivePolicies(migrations) {
  for (const m of migrations) {
    const sql = stripSqlComments(m.content)
    const policyBlocks = []
    const createPolicyRe = /CREATE\s+POLICY\b[\s\S]*?(?=;)/gi
    let match
    while ((match = createPolicyRe.exec(sql)) !== null) {
      policyBlocks.push({ text: match[0] + ';', offset: match.index })
    }

    for (const block of policyBlocks) {
      const text = block.text
      const tableMatch = text.match(/\bON\s+(?:public\.)?(\w+)\b/i)
      if (!tableMatch) continue
      const tableName = tableMatch[1]
      if (!CRITICAL_TABLES.includes(tableName)) continue

      const toAuthenticated = /\bTO\s+(?:authenticated|public)\b/i.test(text)
      if (!toAuthenticated) continue

      const usingTrue = /\bUSING\s*\(\s*true\s*\)/i.test(text)
      if (!usingTrue) continue

      const policyNameMatch = text.match(/CREATE\s+POLICY\s+"?([^"\s]+)"?/i)
      const policyName = policyNameMatch ? policyNameMatch[1].replace(/"/g, '') : '<unknown>'

      const exemption = PERMISSIVE_POLICY_EXEMPTIONS.find(
        (e) => e.policy === policyName && e.table === tableName,
      )
      if (exemption) {
        const combinedSql = migrations.map((x) => stripSqlComments(x.content)).join('\n')
        if (exemption.tientEncore(combinedSql)) {
          notes.push(
            `Policy "${policyName}" on "${tableName}" is USING (true) BY DESIGN -- ${exemption.raison}`,
          )
          continue
        }
        // L'invariant est tombe : l'exemption ne vaut plus, et on le DIT en toutes lettres
        // plutot que de laisser la liste couvrir un changement qu'elle n'avait pas prevu.
        anomalies.push(
          `Policy "${policyName}" on "${tableName}" was exempted, but its invariant no longer holds: ${exemption.invariant}`,
        )
        continue
      }

      const droppedIn = policyDroppedLater(policyName, tableName, m.file, migrations)
      if (droppedIn) {
        notes.push(
          `Policy "${policyName}" on "${tableName}" was USING (true) in ${m.file} but dropped later in ${droppedIn} — OK`,
        )
        continue
      }

      anomalies.push(
        `Policy "${policyName}" in ${m.file} uses USING (true) on critical table "${tableName}" for authenticated/public and is still active`,
      )
    }
  }
}

// ── Check 4: Edge Functions have super_admin guard ─────────────────────────

function checkEdgeFunctionGuards() {
  for (const fnName of CRITICAL_EDGE_FUNCTIONS) {
    const indexPath = path.join(FUNCTIONS_DIR, fnName, 'index.ts')
    if (!fs.existsSync(indexPath)) {
      anomalies.push(`Edge Function "${fnName}/index.ts" is missing`)
      continue
    }
    // Les COMMENTAIRES sont blanchis avant l'analyse. Sans ca, une fonction qui se
    // contente de PARLER de is_super_admin() dans un commentaire passe la garde --
    // c'est le defaut symetrique de celui corrige ci-dessous : un motif qui attrape
    // la prose au lieu du code.
    const code = stripJsComments(fs.readFileSync(indexPath, 'utf8'))

    // Look for typical super_admin guard:
    //   profile?.role !== 'super_admin' → throw
    //   or role === 'super_admin' with return/throw on false
    //   or calls to is_super_admin() RPC
    //   or the shared guard requireSuperAdmin() from _shared/require-super-admin.ts
    //
    // requireSuperAdmin MANQUAIT, et c'est ce qui a rendu cette porte rouge huit
    // semaines d'affilee (13.07 -> 31.08.2026) sur deux faux positifs :
    // admin-monitoring et admin-stripe-metrics portent une garde REELLE (role +
    // allowlist e-mail, 401/403), simplement deportee dans _shared/. Une porte rouge
    // pour de mauvaises raisons cesse d'etre lue, et le jour ou une vraie anomalie
    // s'ajoute elle est la quatrieme ligne d'un rapport qu'on ignore.
    //
    // On exige l'APPEL requireSuperAdmin( , pas l'import : importer un symbole sans
    // jamais l'appeler ne garde rien.
    // Ne PAS elargir aux autres gardes de _shared (requireAgentAuth, isServiceSecret...) :
    // ces trois fonctions sont des endpoints d'administration, un agent authentifie
    // n'est pas un super-admin.
    const hasGuard =
      /\brequireSuperAdmin\s*\(/.test(code) ||
      /role\s*[!=]==?\s*['"`]super_admin['"`]/.test(code) ||
      /['"`]super_admin['"`]\s*[!=]==?\s*.*role/.test(code) ||
      /rpc\(\s*['"`]is_super_admin['"`]/.test(code) ||
      /is_super_admin\s*\(/.test(code)

    if (!hasGuard) {
      anomalies.push(`Edge Function "${fnName}" has no super_admin guard detected in index.ts`)
    }
  }
}

// ── Runtime probe (optional sanity check) ──────────────────────────────────

async function runtimeProbe() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    notes.push('Runtime probe skipped — SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set')
    return
  }

  let networkErrors = 0
  const httpErrors = []

  for (const table of CRITICAL_TABLES) {
    try {
      const res = await fetch(`${url}/rest/v1/${table}?select=id&limit=0`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      })
      if (!res.ok && res.status !== 206) {
        httpErrors.push(`HTTP ${res.status} on /rest/v1/${table}`)
      }
    } catch (err) {
      networkErrors++
    }
  }

  // If every probe failed with a network error, treat as infra issue (note, not anomaly).
  if (networkErrors === CRITICAL_TABLES.length) {
    notes.push(`Runtime probe skipped — network unreachable (${networkErrors}/${CRITICAL_TABLES.length} fetch failures)`)
    return
  }
  // Partial failures are suspicious — flag individually.
  if (networkErrors > 0) {
    anomalies.push(`Runtime: ${networkErrors}/${CRITICAL_TABLES.length} table probes failed with network error`)
  }
  for (const e of httpErrors) {
    anomalies.push(`Runtime: ${e} with service role — table missing or unreachable`)
  }
}

// ── Email notification ─────────────────────────────────────────────────────

/**
 * Eprouve le canal d'alerte AVANT d'en avoir besoin.
 *
 * Pourquoi : la cle Resend des GitHub Actions repond 401 depuis au moins le
 * 27.07.2026, et personne ne l'a su parce que l'echec d'envoi n'etait qu'un
 * console.error au milieu d'un run deja rouge. Un canal d'alerte ne se decouvre
 * pas mort le jour ou on s'en sert : c'est le jour ou l'alerte compte.
 *
 * Ne fait PAS echouer l'audit a lui seul -- la cle ne se regenere pas depuis la CI,
 * et rendre la porte rouge en permanence pour une chose que seul un humain peut
 * corriger reproduirait exactement le defaut qu'on repare ici. On emet une
 * annotation GitHub Actions, qui remonte dans le resume du run meme au vert.
 */
async function checkAlertChannel() {
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    notes.push("Canal d'alerte : RESEND_API_KEY absente -- aucune anomalie ne pourrait etre envoyee")
    console.log('::warning title=Canal alerte::RESEND_API_KEY absente : le rapport ne peut etre envoye a personne')
    return false
  }
  try {
    // Endpoint le moins couteux qui exige une cle valide. On ne lit que le STATUT.
    const res = await fetch('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${resendKey}` },
    })
    if (res.status === 401 || res.status === 403) {
      notes.push(`Canal d'alerte : cle Resend REFUSEE (HTTP ${res.status}) -- a regenerer`)
      console.log(`::warning title=Canal alerte mort::La cle Resend est refusee (HTTP ${res.status}). Les anomalies de securite ne sont envoyees a PERSONNE. Regenerer la cle chez Resend et remplacer le secret GitHub RESEND_API_KEY.`)
      return false
    }
    if (!res.ok) {
      notes.push(`Canal d'alerte : reponse inattendue de Resend (HTTP ${res.status})`)
      return false
    }
    notes.push("Canal d'alerte : cle Resend acceptee")
    return true
  } catch (err) {
    notes.push(`Canal d'alerte : injoignable (${String(err).slice(0, 120)})`)
    return false
  }
}

async function sendEmail(anomalies) {
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    console.warn('RESEND_API_KEY not set — skipping email notification')
    return
  }

  const html = `
    <h2 style="color:#dc2626">[MEGGA Security] ${anomalies.length} anomalies detected</h2>
    <p>The weekly security audit has detected the following issues:</p>
    <ul>${anomalies.map((a) => `<li><code>${a.replace(/</g, '&lt;')}</code></li>`).join('')}</ul>
    <hr>
    <p style="color:#6b7280;font-size:12px">
      Generated by scripts/security-audit.mjs — GitHub Actions workflow security-audit.yml
    </p>
  `

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'noreply@getmegga.com',
        to: ['noreply@getmegga.com'],
        subject: `[MEGGA Security] ${anomalies.length} anomalies detected`,
        html,
      }),
    })
    if (!res.ok) {
      console.error('Resend error:', res.status, await res.text())
    } else {
      console.log('✉  Email sent to noreply@getmegga.com')
    }
  } catch (err) {
    console.error('Failed to send email:', err.message)
  }
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('MEGGA — weekly security audit')
  console.log('---')

  const migrations = readAllMigrations()
  console.log(`Loaded ${migrations.length} migration files`)

  checkRlsEnabled(migrations)
  checkSuperAdminFunction(migrations)
  checkPermissivePolicies(migrations)
  checkEdgeFunctionGuards()
  await runtimeProbe()
  const canalVivant = await checkAlertChannel()

  if (notes.length) {
    console.log('\nNotes:')
    notes.forEach((n) => console.log(`  • ${n}`))
  }

  if (anomalies.length === 0) {
    console.log('\n✓ Security audit passed — all checks OK.')
    process.exit(0)
  }

  console.error(`\n✗ ${anomalies.length} anomalies detected:`)
  anomalies.forEach((a) => console.error(`  - ${a}`))

  await sendEmail(anomalies)
  if (!canalVivant) {
    // Les anomalies existent ET ne sont parties nulle part : c'est la combinaison
    // dangereuse, et elle doit etre le DERNIER mot du journal, pas une ligne perdue
    // au milieu. Le run echouait deja ; ce qui manquait, c'est de le dire.
    console.error(
      "\n⛔ LES ANOMALIES CI-DESSUS N'ONT ETE ENVOYEES A PERSONNE : le canal d'alerte est mort.\n" +
      '   Ce run est visible dans Actions, mais aucun e-mail n\'est parti. Regenerer la cle\n' +
      '   Resend et remplacer le secret GitHub RESEND_API_KEY.',
    )
    console.log('::error title=Alerte non delivree::Anomalies detectees mais non envoyees : canal Resend mort')
  }
  process.exit(1)
}

main().catch((err) => {
  console.error('Security audit script crashed:', err)
  process.exit(1)
})
