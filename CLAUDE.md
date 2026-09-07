# CLAUDE.md — MEGGA Real Estate

> Source de vérité pour Claude Code. Lis-le avant de coder.
>
> **🧠 CERVEAU SYSTÈME — à consulter AVANT toute tâche non triviale :**
> Une cartographie vivante de TOUS les rouages (archi, KYC, WhatsApp, matching, pipeline,
> copilote IA, marketplace, intégrations, signatures…) existe et doit être utilisée.
> 1. Carte lisible (point d'entrée) : [docs/system-map.md](docs/system-map.md)
> 2. Mémoire sémantique locale (0 API) :
>    `CLAUDE_FLOW_DISABLE_BRIDGE=1 npx ruflo@3.10.46 memory search -q "<phrase topique>" -n megga`
>    (⚠ le flag ET la version épinglée sont nécessaires — sans eux la recherche répond
>    « no results » sur un cerveau plein. ⚠ Interroger par une PHRASE, jamais par un mot-clé :
>    un mot seul passe sous le plancher de score et rend « no results » lui aussi, flag correct
>    ou non ; cf. « Maintenir le cerveau » de docs/system-map.md)
> 3. Source de la mémoire : [.claude-flow/knowledge/megga-memory.seed.json](.claude-flow/knowledge/megga-memory.seed.json)
>
> **APRÈS avoir livré une feature / un changement d'archi :** mettre le cerveau à jour
> (sinon il se périme). Routine : éditer le seed JSON (+ `docs/system-map.md` si besoin),
> puis `npm run ruflo:seed`. Détails : section « Maintenir le cerveau » de docs/system-map.md.
>
> **ET CE DOCUMENT SE PÉRIME AUSSI — il est le seul dont l'erreur se propage par la main
> de ses lecteurs.** Le 16 août 2026, sur les sept règles visuelles du §3, **une seule
> était encore vraie** ; les six autres décrivaient une direction supprimée six jours
> plus tôt, et un agent les recopiait sur chaque surface neuve. `npm run lint:claude-md`
> remesure **41 prétentions chiffrées** — 30 d'ici, 11 de `docs/system-map.md` — contre le code ET contre la production (chiffre du 04.09.2026 ; le « 18 » écrit ici datait du jour de naissance de la porte, et rien ne le gardait). ⚠ Sans `SUPABASE_ACCESS_TOKEN` la porte n'en mesure que **24** et le DIT : les 17 autres ne se lisent que d'un serveur et tournent dans `migration-drift.yml`. À lancer après toute PR de
> DA, de jetons, de police ou d'archi. Mode d'emploi (et surtout : quel écart se corrige
> dans le doc, lequel dans le code) : skill `claude-md-freshness`.
>
> **Docs détaillés (externalisés pour économiser des tokens) :**
> - 🧠 Carte système / rouages : [docs/system-map.md](docs/system-map.md)
> - Schéma DB complet : [docs/schema.md](docs/schema.md)
> - Pages et routes réelles (inventaire, pas spec) : [docs/pages.md](docs/pages.md)
> - Modules IA (specs Gregory) : [docs/ai-modules.md](docs/ai-modules.md)
> - Design system patterns (Sugar v2 CRM) : [docs/design-system.md](docs/design-system.md)
> - Design system Property X (Marketplace — ⚠ ARCHIVÉ, marketplace désactivée) : [docs/design-system-propertyx.md](docs/design-system-propertyx.md)
> - Roadmap sprints : [docs/roadmap.md](docs/roadmap.md)
> - Changelog : [docs/CHANGELOG.md](docs/CHANGELOG.md)
> - Langue des e-mails, ce qui reste : [docs/email-i18n-handoff.md](docs/email-i18n-handoff.md)
>
> **🎨 Vestiges Property X (marketplace désactivée — pivot CRM-first) :**
> Le design system Property X, ses 11 pages `/design-system/*` et le catalogue `figma-catalog.ts`
> (ainsi que le skill `figma-to-section`) ont été **retirés** avec la marketplace. Il ne subsiste
> que le **système d'icônes** utilisé par tout le CRM — `MEIcon`, `PxIconFont`, `PxSocialIcon`,
> `PxWhatsAppButton` — et les **tokens `PX.*`** ([src/components/propertyx/tokens.ts](src/components/propertyx/tokens.ts)).
> Utiliser ces tokens pour tout ce qui touche à l'iconographie ; ne pas réintroduire d'atomes Px
> de présentation (PxButton, PxBadge, PxInput…). Seule route DS survivante : `/design-system/megga-x`
> (MeggaX, port de la vitrine — voir [src/components/megga-x/](src/components/megga-x)).

---

## 1. PROJET

**Nom :** MEGGA Real Estate — SaaS immobilier AI-native, compliance-first
**Marché :** Suisse (26 cantons, 4 langues)
**Client :** Gregory Lyonnet, agent immobilier à Genève
**Développeur :** Julien (frontend — Claude Code gère le backend)

**Vision :** Compliance-First Transaction OS — CRM transactionnel verticalisé + pipeline LAB/KYC + copilote IA métier. La marketplace publique est désactivée depuis le pivot CRM-first (juin 2026) ; son backend Flatfox reste branché pour le matching CRM (voir §8).

**5 objectifs (Document Maître) :** Toute fonctionnalité doit servir au moins 1 :
1. Réduire le temps administratif
2. Réduire le risque LAB/KYC
3. Accélérer le closing
4. Augmenter la transparence client
5. Remplacer un outil fragmenté

**Positionnement :** System of record + workflow engine + rules engine + AI copilot. L'IA est compliance-enabling, PAS compliance-replacing. Validation humaine obligatoire.

---

## 2. STACK TECHNIQUE

```
Frontend :     React 18+ / TypeScript / Vite / Tailwind CSS 3
UI Kit :       shadcn/ui + Radix UI
State :        React Query (TanStack Query)
Routing :      React Router v6
Forms :        React Hook Form + Zod
Drag & Drop :  HTML5 natif (pipeline Kanban) · dnd-kit (réordonnancement photos ListingForm)
Maps :         Mapbox GL JS (react-map-gl)
Icons :        Lucide React
Charts :       Recharts
i18n :         react-i18next (FR/DE/EN/IT)

Backend :      Supabase Pro (eayczugyrvmtqnnmvjod, eu-west-1)
               PostgreSQL 17.6 / Edge Functions (Deno) / Auth / Storage / Realtime / pg_cron
               (⛔ `pgvector` retiré le 04.09.2026 : jamais installée — `pg_extension` en rend
               douze, aucune n'est `vector`. La version est mesurée, pas « 15+ » : prod 17.6,
               local et CI 17.)
IA :           DeepSeek (deepseek-chat) pour TOUT le texte via Edge Functions — décision coût
               Vision/OCR/PDF : Gemini (Google) — DeepSeek n'a pas de vision. AUCUN Claude/Anthropic.
Email :        Resend (megga.ch DKIM/SPF)
Payments :     Stripe
Hosting :      Cloudflare Pages — 2 projets : megga-real-estate (megga.ch vitrine),
               megga-app (app.megga.ch CRM, console super-admin comprise)
CI/CD :        GitHub Actions → Cloudflare Pages + Supabase Edge Functions auto-deploy

Marketplace :  DÉSACTIVÉE (pivot CRM-first juin 2026) — /acheter /louer → vitrine megga.ch
               Backend conservé : market_listings ~253k (dont ~35k flatfox actives) + flatfox-sync
               (pg_cron 04:00 UTC)
               sert uniquement le matching CRM, aucun affichage public dans cette app
```

### Commandes

```bash
npm run dev          # Dev server localhost:5173
npm run build        # Build production (tsc + vite)
npm run lint         # ESLint
```

---

## 3. DESIGN SYSTEM

> Patterns détaillés (composants, exemples TSX) : voir [docs/design-system.md](docs/design-system.md)

**🎨 DIRECTION UNIQUE = MEGGA X (depuis le 10 août 2026, [PR #1194](https://github.com/megga/megga-real-estate/pull/1194)).**
**Sugar est SUPPRIMÉE** — il n'y a plus de choix, plus de préférence `megga.da`,
plus de hook `useCrmDa`, plus d'attribut `<html data-crm-da>`, plus de blocs CSS
`[data-crm-da="…"]` ni d'alias `--crm-sugar-*`. Tout ce qui parle de Sugar Pure,
de Graphite ou d'une direction alternative dans ce document ou dans le cerveau
décrit désormais le PASSÉ.

Mécanique, à connaître avant de toucher au style :
1. **Couleurs** — `crmPalette(dark)` rend `mxCrmPalette(dark)`. Le nom a
   survécu à la direction qu'il servait (33 points de construction et le type
   `CrmPalette`) ; le renommer est un geste lexical à part.
2. **Police et grammaire** — variables CSS déclarées dans le `:root` de
   [globals.css](src/styles/globals.css). Elles étaient une surcharge posée sur
   un sélecteur de direction ; la direction retirée, elles SONT l'échelle.
3. **Grammaire tokenisée** — rayons, espacements et tailles de texte ne sont pas
   des littéraux : ~4200 valeurs en variables CSS sur 161 fichiers, échelle
   normalisée à 13 barreaux de texte. **Écrire un littéral de rayon/espacement/
   taille dans un composant est une régression.**
4. **L'élément ACTIF porte l'accent `#424bfb`** (décision Julien, 10 août 2026).
   Remplace la règle Sugar Pure « l'accent EST l'encre », qui peignait l'actif en
   encre inversée — donc en non-couleur. ⚠ Exception : la pastille d'avatar est
   déjà l'accent, son état ouvert garde `sp.ink` pour contraster.

**Où vit quoi** — la distinction compte pour ne pas créer une seconde échelle :
[megga-x-crm/tokens.ts](src/components/megga-x-crm/tokens.ts) ne porte que la
**couleur** (ce qui alimente `mxCrmPalette()`) ; la **grammaire et la police**
sont des variables CSS, parce qu'elles doivent pouvoir basculer sur un conteneur.
[megga-x-crm-tokens.spec.ts](tests/unit/megga-x-crm-tokens.spec.ts) verrouille les
deux : les couleurs contre les variables de la vitrine, et le bloc CSS lui-même —
chaque rayon et chaque espacement doit être un barreau réel de la feuille.

⚠ Le **texte** s'en écarte volontairement sur **11 et 13 px**, absents de la
vitrine (ses tailles sautent 10 → 12 → 14). Le CRM a besoin de ces demi-pas. Le
test fige cet écart au lieu de l'interdire : en ajouter un demande de l'écrire,
donc d'en décider.

Les deux routes de décision (`/design-system/da-compare`, `/design-system/pipeline-mx`)
ont été retirées le 9 août 2026, la direction étant tranchée.

**Direction :** Minimal, transparent, professionnel (Linear/Notion style). Dark/light mode sur dashboard agent.

**⚠ « Sugar Pure » — HISTORIQUE.** Sa grammaire (ombre douce sans bordure,
accent noir unique, pilules à fond plein) a régi Pipeline, modale Nouveau deal et
fiche deal V4 de juillet 2026 au 10 août 2026. Ces surfaces sont passées à
MEGGA X. Ce qui SUBSISTE d'elle : les teintes d'étape `CRM_STAGE_HUE` et les
dérivations `crmMix`, gardées parce qu'elles **encodent une information** (l'étape
du deal), pas parce qu'elles décorent.

**🌒 Sombre — échelle MEGGA X.** L'échelle « Graphite » (`#12161C`→`#21242F`,
5 paliers) ne peint PLUS le CRM : ses 110 appels à `crmStep` ont été repris, et
`crmStep`, le choix de teinte (Graphite / Noir pur), `useDarkTone` et
`megga.darkTone` sont supprimés. Le **mode** sombre est conservé.

Correspondance appliquée, **par rôle et non par numéro** — Graphite *montait* ses
sous-surfaces, MEGGA X les *creuse* :

| Rôle | Token | Valeur |
|---|---|---|
| canvas | `sp.pageBg` | `#030303` |
| cadre bento, rail, top nav | `sp.frameBg` | `#050505` |
| carte, colonne, ligne | `sp.cardBg` | `#090909` |
| sous-carte **creusée** | `sp.cardSubBg` | `#050505` |
| survol, **élevée** | `sp.focusSurface` | `#181818` |
| flottante (modale, popover) | `sp.solidBg` | `#090909` |

1. **La séparation vient de la BORDURE**, pas de l'écart de luminance —
   `sp.shadow` vaut `'none'` en sombre, comme la vitrine. Écart mesuré
   canvas↔carte : 1,078:1 (Graphite) → **1,036:1** (MEGGA X).
2. ⛔ **Un élément posé sur une surface TEINTÉE reste un VOILE translucide**, pas
   un palier opaque. La migration Graphite avait converti mécaniquement les
   pastilles « + » des colonnes du pipeline en S3 opaque : des blocs gris au
   milieu de colonnes colorées.
3. ⛔ **L'accent `#424bfb` ne passe pas l'AA en TEXTE sur sombre** (3,44:1). En
   aplat il tient (5,78:1, c'est l'encre blanche qui porte). Pour une encre
   teintée sur sombre : `MXC_SYSTEM.blue300` (#8dc1ff, 10,6:1).
4. ⛔ **Les couleurs de système de la vitrine sont PÂLES** — réglées pour un
   canvas `#030303`. Sous encre blanche : 1,7:1. Sous `n100` : 11–19:1. Un
   remplissage pâle prend TOUJOURS l'encre sombre.

Garde-fous : [megga-x-crm-tokens.spec.ts](tests/unit/megga-x-crm-tokens.spec.ts)
(couleurs = barreaux réels de la vitrine, seuils AA, aucune police en dur, aucun
lecteur de `CrmTheme.primary`) et
[graphite-scale.spec.ts](tests/unit/graphite-scale.spec.ts) (aucune palette
d'écran n'est restée sur Graphite).

**Règles visuelles clés :**

> ⚠ **SEPT RÈGLES REMESURÉES LE 16 AOÛT 2026, UNE SEULE ÉTAIT ENCORE VRAIE.** Les
> six autres décrivaient Sugar Pure, pas MEGGA X — et une règle fausse ici coûte
> plus qu'un écart dans le code : c'est ce qu'un agent lit AVANT d'écrire, donc
> elle se recopie sur chaque surface neuve. Chaque correction porte son chiffre et
> sa méthode ; un chiffre sans date se périme sans prévenir.

- Bentos : `rounded-xl border border-theme-border`. ⚠ **« PAS d'ombres » ÉTAIT FAUX
  EN CLAIR, et un test EXIGE le contraire.** Mesuré : **740 `boxShadow` en style en
  ligne sur 188 fichiers** (contre 6 classes `shadow-*`), et
  [megga-x-crm-tokens.spec.ts:311](tests/unit/megga-x-crm-tokens.spec.ts) exige que
  `SET_PALETTE.shadow` CONTIENNE `MXC_CARD_SHADOW` — une valeur confrontée ligne 106
  à la feuille de la vitrine, donc **l'ombre de carte vient de la direction
  elle-même**. La règle vraie est celle du mode : `MXC_CARD_SHADOW` en clair,
  `shadow: 'none'` en sombre (ligne 316 l'interdit explicitement), parce que MEGGA X
  y sépare par la BORDURE. Ce qui reste proscrit, ce sont les ombres de Tailwind
  (`shadow-card`, `shadow-sm`), qui ne suivent aucun thème.
- Boutons : ⚠ **CETTE RÈGLE DÉCRIT SUGAR PURE, corrigée le 15 août 2026.** Elle
  disait « style ghost — JAMAIS `bg-accent text-white` », ce qui CONTREDIT la
  décision du 10 août écrite quatre points plus haut. Remesuré le 5 septembre 2026
  par `npm run lint:claude-md` : **127 sites peignent une affordance en accent**
  (120 `background: *.accent`, 7 `bg-accent`) dans 82 fichiers, contre **11** au
  ghost canonique. ⚠ Le 17 août ce point disait 113 / 106 / 70 : la hausse n'est
  pas une dérive de la règle mais deux chantiers de septembre — la refonte du
  chrome du CRM (barre latérale + barre d'onglets, PR #1279) et la messagerie
  (PR #1276), qui peignent l'un et l'autre leurs affordances primaires en accent,
  comme la règle vive le prescrit. ⚠ Deux des trois chiffres du 17 août avaient
  bougé pour des raisons opposées.
  `bg-accent` tombe de 18 à 7 **sans qu'une ligne ait été retirée** : la mesure
  borne désormais l'identifiant, et `bg-accent-solid` — l'autre jeton, créé le 15
  août trois lignes plus bas — cessait d'être compté comme un emploi du premier.
  Le « 36 fichiers », lui, n'est reproductible par AUCUNE règle essayée (`.tsx`
  seuls, commentaires blanchis ou non, bornée ou non) ; 70 est la valeur de la
  règle désormais écrite dans le registre, et c'est elle qui fait foi. La règle vive
  est celle du point 4 — **l'affordance PRIMAIRE porte l'accent**, le ghost est
  le SECONDAIRE. ✅ **UN SEUL ACCENT depuis le 15 août 2026.** La rampe
  Tailwind portait un second bleu (`#2563EB`) que rien ne rattachait à MEGGA X ;
  elle adopte l'accent de marque. ⚠ Mais **deux JETONS, un par rôle**, parce
  qu'aucune valeur unique ne tient les deux en sombre :
  `--color-accent-solid` = `#424bfb` dans les deux thèmes (l'APLAT, 5,78:1 sous
  blanc) ; `--color-accent` = `#424bfb` en clair et **`#8dc1ff`** en sombre
  (l'ENCRE et les filets — l'accent y rend 2,95:1, sous l'AA ET sous le seuil des
  filets, donc l'anneau de focus tomberait avec). `#8dc1ff` est
  `MXC_SYSTEM.blue300`, le barreau déjà nommé pour ce cas. Gardé par
  [accent-ramp.spec.ts](tests/unit/accent-ramp.spec.ts)
- Badges : ⚠ **RÈGLE INVERSÉE, et une garde exige l'inverse.** Elle disait « texte
  coloré sans fond (`text-red-500`, pas `bg-red-100 text-red-800`) ». Mesuré :
  **25 des 27 fichiers de badge/pilule/puce posent un fond**, et
  [contacts-contraste.spec.ts:250](tests/unit/contacts-contraste.spec.ts) assère
  qu'une pilule porte bien `background:`. L'idiome vivant est **l'aplat sous une
  encre lisible** — c'est d'ailleurs ce que gardent les dix specs de contraste. Ce
  qui reste proscrit est la palette Tailwind BRUTE (`bg-red-100 text-red-800`) :
  ni jeton de thème, ni jeton sémantique, elle ne bougera pas si la direction bouge.
- Modals : `createPortal(document.body)`. ⚠ **« TOUJOURS … avec `z-[100]` » n'est
  vrai ni pour l'un ni pour l'autre.** Mesuré : **33 des 36 fichiers de
  modale/panneau/dialogue** appellent `createPortal` — la règle tient à trois près —
  mais le z-index est un **désordre assumé nulle part** : **175 sites `zIndex`
  portant 44 valeurs DISTINCTES**, dont seulement **10** valent 100. Aucune garde ne
  le mesure. Poser `z-[100]` sans regarder ses voisins est donc un coup de dé, pas
  une convention : lire l'empilement local d'abord.
- **Steppers : l'étape courante porte l'ACCENT, et la progression se lit dans la
  GÉOMÉTRIE.** ⛔ La règle précédente disait « monochrome (numéros + underline) » :
  mesuré le 16 août 2026, **aucun stepper du dépôt n'a jamais utilisé
  d'underline**, et l'accent a remplacé le monochrome le 10 août. Elle décrivait
  Sugar Pure, pas MEGGA X. Trois idiomes coexistent, chacun justifié par le NOMBRE
  d'étapes — ne pas en inventer un quatrième :
  - **barre segmentée** quand les étapes n'ont pas de nom utile (`WizardShell`,
    7 étapes : segments de 4 px, `i <= etape ? accent : line`) ;
  - **pilules à libellé** quand elles en ont un et qu'on peut revenir en arrière
    (`KwStepper`, 3 étapes : actif = pilule d'accent, fait = coche verte, à venir
    = sourdine) ;
  - **barre segmentée, encore** quand l'étape est une DONNÉE et non une position
    dans un formulaire. ⛔ **CE POINT DISAIT « `dealStepper`, 8 CERCLES » : IL N'Y A
    AUCUN CERCLE.** Mesuré le 16 août 2026 sur les deux seuls consommateurs —
    `DealDetailPage:100` et `MobileDealDetailScreen:179` rendent tous deux
    `CRM_STAGE_ORDER.map(...)` en `flex: 1, height: 4` : une **barre de 8 segments**,
    la même forme que `WizardShell`. Le « 8 » était juste (8 colonnes UI pour 14
    stades DB), la forme non.
    ⚠ Et les deux segments ne se peignent pas pareil : le mobile met l'étape
    courante en `accent`, le bureau la peint en `ink` — donc **le bureau n'applique
    pas la règle du 10 août** (« l'élément ACTIF porte l'accent »). Écart réel, non
    tranché.
  - **cercles numérotés** — l'idiome que ce point ne nommait pas. `KycStepper`
    (alias `SgStepper`, [primitives.tsx:341](src/components/crm-dossiers/primitives.tsx))
    rend des pastilles de 32 px reliées par un trait de 2 px, portant `✓` si l'étape
    est faite et **son rang sinon**. Unique consommateur hors primitives :
    `ImportLeadPage:302`.
  ⚠ **Pas de numéro de rang** : trois étapes alignées SONT 1, 2, 3, et l'accent dit
  déjà laquelle est courante. Ce qui reste marqué est ce que la position ne dit
  pas — « fait », par une coche. La règle annonçait **deux** exceptions ; il y en a
  **trois**, et la troisième n'est pas une exception mais un OUBLI D'INVENTAIRE :
  `IdentityShell` (onboarding KYB) suit la nav `.mx-stepper` de la VITRINE, dont
  le numéro fait partie ; le wizard mobile affiche un compteur `n / N`, qui n'est
  pas un rang mais une distance restante sur un écran sans place pour les
  libellés ; et **`KycStepper` affiche bel et bien le rang** (`{done ? '✓' : i + 1}`),
  sans motif écrit. Il porte pourtant DÉJÀ la coche que la règle prescrit — le
  numéro y est donc redondant avec la position, exactement ce que la règle vise.
  À trancher : le retirer, ou l'inscrire comme troisième exception.
- Scrollbars : `.scrollbar-hide` sur modals et pipeline
- Notifications sidebar : pas de dot rouge par défaut (système Messages retiré du CRM agent)

**Thème CSS Variables :**
```
Dark mode :   Page #1C1C1C | Cards #2A2A2A | Borders #383838 | Text #ECECEF | Muted #8E8E96
Tokens :      bg-theme-page, bg-theme-card, bg-theme-section, bg-theme-sidebar, bg-theme-hover, bg-theme-active
              text-theme-primary, text-theme-secondary, text-theme-tertiary, text-theme-muted
              border-theme-border, border-theme-border-subtle
```

**JAMAIS utiliser** : `bg-white`, `text-gray-900`, `border-gray-200` (cassent le dark mode), `shadow-card`, `shadow-sm`

> ⚠ **ET LA CLAUSE QUI GARDE `bg-white` NE LIT QUE LES CLASSES.** Mesuré le 16 août
> 2026 : **6** occurrences de `bg-white` en `className` — que le cliquet compte et
> plafonne — contre **17 fonds blancs écrits en STYLE EN LIGNE**
> (`background: '#fff'`), qui lui sont invisibles. Le même défaut, dans l'autre
> langage. Une partie est légitime (encre blanche sur aplat, papier A4 du rapport
> KYC) ; la garde de valeur est [couleur-barreaux.spec.ts](tests/unit/couleur-barreaux.spec.ts).

**Typo :** ⚠ **`--crm-font` vaut `"Inter Tight"`** (globals.css `:root`), pas DM Sans —
cette ligne annonçait la police de **Sugar**, supprimée le 10 août 2026. Mesuré le
15 août : DM Sans ne survit qu'en **repli** (`admin-console.css`, `index.html`) et
dans deux fichiers de jetons archivés (`propertyx`, `auth-bento`). `index.html`
charge quatre familles — Inter Tight, Manrope, DM Sans, Plus Jakarta Sans — dont
une seule habille le CRM. Échelle : les 13 barreaux `--crm-text-*` (11 → 38 px),
pas des noms de taille Tailwind.

**🌐 LA FACE PUBLIQUE — ce que le CLIENT voit** (portée le 15 août 2026). Quatre
surfaces sans compte : `/kyc/:token`, `/rendez-vous/:token`, `/reception/:token`,
`/accept-invite/:token`. Elles suivent MEGGA X, avec **trois écarts assumés** :

1. **Manrope**, pas Inter Tight — décision Julien. ⚠ Cette ligne disait « c'est,
   avec le dégradé bleuté, **la seule chose qui distingue ces écrans du CRM** » :
   **FAUX, et corrigé le 15 août 2026 avec le chiffre.** `MOBILE_FONT` vaut
   Manrope et alimente **58 emplois dans 24 fichiers** du CRM mobile (remesuré le
   17 août 2026 : +24 emplois pour UN fichier de plus en deux jours — la police
   se densifie dans les écrans qui la portaient déjà, elle ne s'étend pas) ; NEUF
   fichiers du CRM de BUREAU l'écrivaient aussi (Analytics, « Aujourd'hui », la
   recherche, deux pages agent). Mesuré à l'écran sur « Aujourd'hui » : **29
   éléments rendaient en Inter Tight et 26 en Manrope** — deux polices se
   partageaient le même écran, presque à parts égales.

   ✅ **LA FRONTIÈRE EST DÉSORMAIS UNE RÈGLE, pas un constat** (décision Julien,
   option (b) du plan « 100 % ») : **Inter Tight (`var(--crm-font)`) est la
   police de l'agent au BUREAU ; Manrope est celle du MOBILE et de tout ce que
   voit un CLIENT.** Le bureau est revenu au jeton — 15 sites, 8 fichiers.
   Gardée dans les deux sens par [polices-domaines.spec.ts](tests/unit/polices-domaines.spec.ts).

   ⚠ TROIS POLICES RESTENT HORS RÈGLE PARCE QU'ELLES ENCODENT, nommées dans la
   garde : `ui-monospace` (une suite lue caractère par caractère),
   `Caveat, cursive` (la SIGNATURE du rapport KYC — en Inter Tight ce n'est plus
   une signature), `'Cormorant Garamond'` (la police que l'AGENT CHOISIT pour sa
   galerie — une donnée saisie, pas un choix de direction).
2. **Mono-thème.** Zéro `dark` / `prefers-color-scheme` / `matchMedia` sur les six
   fichiers ; les deux gardes le DISENT et rougiront le jour où ça change.
3. `inkSoft` / `soft` = `#3A3D44`, hors échelle par **mesure** (n400 est à 1,16:1
   de n100 en clair — un doublon, pas un cran). Même valeur qu'Analytics.

Deux objets de jetons, deux specs : `MLK` (kyc-magic-link, 2 surfaces) et `RC`
(réception acheteur). ⛔ Le cliquet de grammaire **ne lisait pas du tout** ce
dossier avant ce chantier, et sa clause « aucun élément cliquable peint en encre »
y est **aveugle par le nom** — elle cherche `…ink`, le jeton s'appelait `black`.
La règle est donc gardée dans `mlk-contraste.spec.ts`, testée sur la **valeur**.
Cf. `megga/face-publique-meggax` et `megga/gardes-vacuites` n° 45-47.

⚠ **« Elles suivent MEGGA X » ÉTAIT FAUX POUR `/accept-invite/:token`** — elle
n'importait AUCUN jeton et portait 23 couleurs de palette Tailwind brute. C'est
vrai depuis le 15 août 2026 : elle est portée, et **deux autres pages clientes
l'ont rejointe** — `/visit/:id/edit` et `/visit/:id/feedback`, que cette section
ne comptait pas parce qu'elles ne prennent pas leur jeton dans le chemin mais
dans la QUERY. La face publique fait donc **SIX** surfaces sans compte, pas
quatre.

⛔ **DEUX ENCRES SÉMANTIQUES ÉTAIENT SOUS L'AA sur ces pages**, et c'est mesuré,
pas préféré : `text-red-500` rendait **3,76:1** sur carte blanche et
`text-emerald-600` **3,77:1**. Elles passent par `MLK_STATUT` — la famille qui
ENCODE, tenue SÉPARÉE de `MLK` parce que la direction ne la gouverne pas :
`#B91C1C` (6,47:1) et `#047857` (5,48:1). ⚠ L'ambre, lui, a été *baissé* de 7,09
à 5,02:1 pour prendre la valeur que trois autres surfaces portent déjà — une
encre d'alerte qui diffère d'un écran à l'autre coûte plus que deux points de
contraste. Les étoiles de notation restent hors seuil **par écrit** : aucune
teinte dorée n'atteint 3:1 sur blanc sans virer au brun, et c'est la POSITION de
la coupure dans une rangée de cinq qui porte l'information.

🧪 **Banc : `/dev/public` monte les SIX surfaces**, trois états chacune. ⚠ Les
deux visites ne se branchent pas comme les autres — elles lisent une RPC
(`get_visit_by_token`, la lecture directe de `visits` ayant été retirée en
juillet 2026) et prennent leur jeton dans la QUERY. Une route de banc en
`visite/:token` les monterait sans jeton : elles rendraient « lien invalide », et
on corrigerait la fixture au lieu de la route.

---

## 4. PATTERNS DE CODE

### Convention de nommage
```
Composants : PascalCase (ListingCard.tsx) | Hooks : use* (useListings.ts)
Types : PascalCase | SQL : snake_case | Edge Functions : kebab-case
```

### Structure des dossiers (où va quoi) — 3 runtimes séparés

Le code vit dans **3 runtimes distincts** ; un fichier ne « déménage » pas librement de l'un à l'autre.

| Dossier | Runtime | Contenu autorisé |
|---|---|---|
| `src/` | Navigateur (bundle Vite, **TS only**) | Code d'app **importé et rendu**, rien d'autre |
| `scripts/` | Node (`node scripts/*.mjs`, brut, **aucun loader TS**) | **Exécutables** seuls ; helpers partagés → `scripts/_shared/`, fixtures de données → `scripts/_data/` |
| `supabase/functions/` | Deno (edge) | Edge functions ; code partagé → `_shared/` |
| `scripts/realadvisor-agencies/` | **Python** (venv `uv`, hors CI) | ⚠ Seule exception à la règle Node, et elle est contrainte : franchir le challenge Cloudflare de RealAdvisor exige un navigateur furtif **headful** (Camoufox), et rien d'équivalent ne passe côté Node — mesuré, cf. le README du dossier. Ne pas « corriger » en portant vers `.mjs` sans avoir prouvé qu'un client Node passe. **Le dossier est une unité autonome : ses helpers Python y restent** (`ra_parse.py`) au lieu d'aller dans `scripts/_shared/`, qui est le dossier des helpers **Node** — y mêler deux runtimes nuirait plus à la lisibilité que la co-location. |

- ⛔ **JAMAIS de helper ni de donnée de script dans `src/`** : c'est le bundle navigateur, et un script Node ne peut importer ni un `.ts` ni l'arbre frontend. Un helper de script va dans `scripts/_shared/`, pas dans `src/lib/`.
- `src/lib/` et `src/hooks/` sont **PLATS volontairement** — ne PAS les réorganiser en sous-dossiers thématiques (churn massif d'imports + conflits de merge ; le plat est idiomatique, l'alias `@/` suffit). `src/components/` est foldered par thème.
- Pas de dossier vide (`.gitkeep` orphelin), pas de code mort (0 fichier non-joignable depuis `main.tsx`, 0 export mort — `npm run lint:deadcode`).
- **Avant tout déplacement/renommage** : `git mv` (préserve l'historique) + greper TOUS les usages (imports relatifs ET `@/`, docs, skills, workflows CI), corriger les chemins, puis `npm run build`.

### Documentation du code

- En-tête `/** */` par fichier (rôle, route si page, comportements non-évidents) + docstring concise par unité **exportée** (composant/hook/TSDoc lib) + commentaires **« pourquoi »** là où la logique n'est pas évidente.
- ⛔ PAS de glose ligne-à-ligne, PAS de docstring sur chaque helper trivial, PAS de commentaire qui répète le code. Le commentaire dit le **pourquoi**, pas le **quoi** ; match la densité existante.

### Pattern composant
```tsx
import { cn } from '@/lib/utils';
interface Props { listing: Listing; className?: string }
export default function ListingCard({ listing, className }: Props) {
  return <div className={cn('rounded-xl border border-theme-border', className)}>{...}</div>
}
```

### Pattern hook Supabase
```tsx
export function useListings(filters?: Filters) {
  return useQuery({
    queryKey: ['listings', filters],
    queryFn: async () => {
      const { data, error } = await supabase.from('listings').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}
```

### Pattern Supabase Realtime (IMPORTANT — bug A1 audit)
```tsx
// TOUJOURS utiliser useId() pour le channel name — sinon crash au re-mount
const channelId = useId()
useEffect(() => {
  const channel = supabase.channel(`nom-${channelId}`).on('postgres_changes', {...}).subscribe()
  return () => { supabase.removeChannel(channel) }
}, [channelId])
```

---

## 5. RÈGLES ABSOLUES

### DO ✅
- TypeScript strict (pas de `any`)
- RLS activé sur CHAQUE table Supabase — **une seule exception**, `spatial_ref_sys` (table de PostGIS, non modifiable, écart accepté et gardé : toute AUTRE table sans RLS fait rougir la porte)
- `cn()` pour classes conditionnelles
- Prix : `CHF 720'000` (apostrophe suisse) — utiliser `formatCHF()` (type-defensive, accepte string/null)
- Labels UI en français par défaut
- Composants shadcn/ui quand ils existent
- États loading, empty, error pour chaque liste/page
- Responsive mobile-first (md: lg:)
- Human-in-the-loop : validation KYC, envoi message/document
- Audit trail : `activity_events` pour toute action (y compris IA avec `actor_id = 'ai'`)
- Scores IA affichés comme "estimation" (icône sparkle/ai)
- Timeline unifiée par contact
- `scripts/` = exécutables seuls (helpers → `scripts/_shared/`, données → `scripts/_data/`)
- Documenter le **pourquoi** : en-tête `/** */` par fichier + docstring par export
- `git mv` + corriger tous les imports (relatifs ET `@/`) avant `npm run build`

### DON'T ❌
- `any` en TypeScript
- Données hardcodées (tout vient de Supabase)
- localStorage pour données sensibles
- Validation KYC auto sans action humaine
- Envoi auto au client sans validation agent
- Couleurs hardcodées (`bg-white`, `text-gray-*`) → tokens thème
- ⚠ ~~`bg-accent` plein sur boutons → style ghost~~ — **périmé**, voir §3 : c'est l'inverse depuis le 10 août 2026 (127 sites contre 11, mesuré le 05.09.2026)
- Ombres sur bentos
- Modals inline → toujours `createPortal`
- UPPERCASE dans les titres → capitalize — ✅ **la SEULE des sept règles visuelles
  qui soit encore vraie ET gardée** (16 août 2026). Mesuré : 20 `textTransform:
  'uppercase'` vivants, tous dans `kyc-report` (papier A4, exempté par écrit) et
  `pages/dev` (bancs absents du bundle). Zéro sur une surface agent.
- Dots rouges sidebar
- Next.js / Vercel → React+Vite / Cloudflare Pages
- `console.log` en production
- Mentionner "Lovable", "Claude", "ChatGPT" dans l'interface
- IA présentée comme "automatique" ou "garantie" → "assistance"
- Fonctionnalité hors les 5 objectifs du Document Maître
- Helper ou donnée de script dans `src/` (mauvais runtime — va dans `scripts/_shared/` ou `_data/`)
- Réorganiser `src/lib/` ou `src/hooks/` en sous-dossiers (churn d'imports + conflits de merge)
- Commenter chaque ligne / docstring-er chaque helper trivial (bruit qui se périme)
- Laisser un dossier vide (`.gitkeep` orphelin) ou du code mort

---

## 6. MONNAIE ET LOCALISATION

```
Devise :     CHF (apostrophe : CHF 720'000)
Surface :    120 m²
Date :       16.03.2026 (DD.MM.YYYY) ou relatif
Langues :    FR (défaut), DE, EN, IT — react-i18next, 12 namespaces
Cantons :    GE VD VS NE FR BE JU BS BL AG SO ZH LU ZG SZ NW OW UR GL SH TG AR AI SG GR TI
```

---

## 7. PERFORMANCE & BASE DE DONNÉES

> Section ajoutée le 16 avril 2026 après des incidents de statement timeout sur 33K+ rows.

### Règles Supabase (statement timeout = 3-8s sur Pro)

| Règle | Pourquoi | Exemple |
|---|---|---|
| **JAMAIS `count: 'exact'`** sur tables > 5K rows | Cause un sequential scan complet → timeout | Utiliser `count: 'estimated'` ou pas de count |
| **JAMAIS `ORDER BY` sans partial index** sur le WHERE exact | PostgreSQL fait un sort en mémoire sur toute la table → timeout | Créer un partial index couvrant WHERE + ORDER BY |
| **JAMAIS `.in('status', [...])` quand `.eq()` suffit** | `IN` ne match pas les partial indexes | `.eq('status', 'active')` au lieu de `.in('status', ['active', 'price_reduced'])` |
| **JAMAIS SELECT colonnes lourdes en liste** | `description` (2KB/row × 33K = 66MB), `photos` (array d'URLs) | Charger `description` uniquement sur la page détail |
| **Toujours un partial index pour les filtres fréquents** | Réduit le scan de 33K rows à <1K | `CREATE INDEX ... WHERE transaction_type='rent' AND status='active' AND quality_score >= 50` |

### Index existants (market_listings)
```sql
idx_ml_rent_active_created ON market_listings (created_at DESC)
  WHERE transaction_type = 'rent' AND status = 'active' AND quality_score >= 50
idx_market_listings_tx_type_status ON market_listings (transaction_type, status, quality_score, created_at DESC)
```

### Supabase Realtime — pattern obligatoire
```tsx
// TOUJOURS useId() pour channel name — sinon crash au re-mount (StrictMode/navigation)
const channelId = useId()
const channel = supabase.channel(`nom-${channelId}`)
```
Fichiers concernés — ⛔ **remesuré le 04.09.2026, la liste précédente était fausse aux deux tiers** : elle nommait `useAdminNotifications.ts` et `useMessaging.ts`, qui **n'existent plus dans `src/`**. Les abonnements vivants sont désormais **six** (05.09.2026) : `useAdminLiveFeed.ts`, `useAgentNotifications.ts`, `useVisitDetail.ts`, `useContactSentMatches.ts`, `useRealtimeHealth.ts` et `useMailRealtime.ts` (messagerie, sur `mail_threads`) — tous en `useId()`. ⚠ Un fichier nommé ici qui n'existe pas est pire qu'une absence de liste : il donne l'illusion d'un inventaire, et personne ne rouvre un inventaire.

### Formatters type-defensive
`formatCHF(amount)` et `formatRent(amount)` acceptent `number | string | null | undefined`. Retournent `'CHF —'` pour les valeurs invalides. Ne JAMAIS appeler `.toFixed()` directement sur une valeur de formulaire.

### pg_cron actifs

**52 jobs actifs** au 5 septembre 2026 (relevés dans `cron.job`) — cette section n'en listait que 2,
et a annoncé successivement 41 jobs (chiffre du 29 juillet, alors que neuf étaient nés sans que le
compte bouge) puis 50 (17 août). ⚠ **Le 52ᵉ est `mail-sync-2min`, arrivé avec le merge de la messagerie le 04.09.2026** — et son arrivée était ANNONCÉE : le corps de la PR #1274 prévenait que « le jour du merge, le §7 passera de 51 à 52 jobs pg_cron » et que l'écart, 2 % pour une tolérance de 20 %, laisserait `lint:claude-md` **vert sur une prose périmée**. C'est exactement ce qui s'est produit pendant vingt-quatre heures : une prédiction écrite ne remplace pas une porte. Le passage de 50 à 51 était, lui, net de trois gestes du 3 septembre :
`visit-reminder-hourly` RETIRÉ (il lisait deux GUC inexistants et n'a jamais envoyé un rappel ;
son doublon `visit-reminders-j1` couvrait déjà une fenêtre plus large), et deux jobs d'hygiène
ajoutés — `pg-net-response-vacuum-hourly` (`50 * * * *`, empêche `net._http_response` de reprendre
le gigaoctet par mois qu'un VACUUM FULL vient de rendre) et `cron-job-run-details-retention`
(`55 3 * * *`, 30 jours ; sans elle `get_cron_health` expirait 22 fois sur 24 et l'alerting des
crons était aveugle).
C'est le régime de péremption propre aux prétentions de base de données — elles ne se lisent dans
aucun fichier, donc aucun diff ne les dément, et même une relecture attentive du dépôt les laisse
passer. Inventaire complet dans le cerveau : `megga/pg-cron`. Les plus structurants :

| Job | Schedule | Cible |
|---|---|---|
| `flatfox-sync-daily` | `0 4 * * *` | flatfox-sync (location) |
| `realadvisor-fresh-daily` | `30 3 * * *` | realadvisor-sync (vente, national) |
| `realadvisor-rolling-daily` | `0 22 * * *` | realadvisor-sync (1 bucket de cantons/nuit) |
| `realadvisor-probe-fire` / `-collect` | `0 * * * *` / `10 * * * *` | RPC pg_net (détection de disparition) |
| `realadvisor-probe-sweep` | `30 1 * * *` | RPC (retrait des absents confirmés) |
| `realadvisor-revive-fire` / `-collect` | `30 2 * * *` / `45 2 * * *` | RPC (résurrection) |
| `realadvisor-health-daily` | `0 9 * * *` | RPC `realadvisor_health_check` |
| `platform-metrics-hourly` | `15 * * * *` | admin-monitoring |

⚠ Identifier un job par son **jobname**, jamais par son `jobid` : il change à chaque recréation.

Les dix jobs de ce tableau sont vérifiés par NOM ET PAR HORAIRE contre la production
(`migration-drift.yml`, cf. skill `claude-md-freshness`) : un horaire déplacé sans que ce
tableau suive fait rougir la porte. Les deux index ci-dessus le sont aussi, par existence.

---

## 8. ÉTAT D'IMPLÉMENTATION (mise à jour : 14 juin 2026 — pivot CRM-first)

### Vue d'ensemble

MVP Compliance-First Transaction OS en production sur `main` (Cloudflare Pages). **Pivot CRM-first (juin 2026)** : `app.megga.ch` = CRM agent seul ; la vitrine et la marketplace publique vivent hors de cette app.

**Marketplace publique : DÉSACTIVÉE (pivot CRM-first) :**
- `/acheter` + `/louer` (+ `/buy` `/rent` `/propriete`) → `MarketplaceDisabledRedirect` vers la vitrine `megga.ch`
- Backend conservé intact : `market_listings` (~130k Flatfox, ~123k RealAdvisor, ~91k actives — **remesuré le 03.09.2026**), `flatfox-sync` (pg_cron), `matching-engine` — au service du matching CRM, pas d'un affichage public
  ⚠ **Le +32k de RealAdvisor en 17 jours n'est PAS de la collecte, c'est de la rétention subie** — ne pas le lire comme une croissance du catalogue. Le sweep de retrait est plafonné à un POURCENTAGE du vivier qu'il régule (3 % du live), donc plus on sur-détient, plus on a le droit de retirer, mais moins vite que l'arriéré ne grossit : 16 nuits `capped` d'affilée du 19.08 au 03.09. Mesuré le 03.09 : notre live valait 53 047 contre **41 369 annonces que RealAdvisor déclare** (somme des 26 cantons = total_count national, à l'unité près) — ~11 700 biens de trop, soit **un bien sur quatre servi au matching qui n'est plus en vente**. Plafond porté à 6 % le 03.09 (`app_config.realadvisor_sweep_cap_pct`), à remettre à 3 % une fois le live redescendu. Un gate empirique `id_in` sur 360 candidats donne 1,1 % de faux absents : la détection est saine, c'est le drainage qui était trop lent.
  ⚠ Le point annonçait « ~117k Flatfox, ~91k RealAdvisor » (17.08), et avant cela « ~90k Flatfox, ~50k active », faux DEUX fois — le 90k désignait en réalité RealAdvisor. La prétention nomme désormais la source dans sa requête.
- Atomes Px + onboarding gardés ; pages SPA marketplace + Property X retirées (PR #601/#602)

**CRM agent :** la plupart des ~18 surfaces agent connectées Supabase (le « 11/14 » était périmé) — Contacts, Pipeline v2 Sugar Pure (14 stades DB → 8 colonnes UI ; kanban teinté/liste/timeline, bento de signature, nextAction = reminders), Matching, Mes biens (pager galerie + à-suivre · wizard « Créer un bien » Sugar v2 7 étapes · fiche V4), KYC (dilisense), ContactDetail, ListingForm, ActionBoard, Dashboard, cockpit Aujourd'hui, Analytics. ⛔ **« Chat » a été retiré de cette liste le 04.09.2026 : la surface n'existait pas.** Mesuré alors — aucune route, aucune page, aucun hook ; le namespace i18n `messages` était déclaré (`src/i18n/index.ts:29`) et consommé par **personne**. Le §3 disait déjà l'inverse de cette liste — « système Messages retiré du CRM agent » — donc **deux affirmations se contredisaient dans le même document**. ✅ **La 9ᵉ surface est arrivée depuis, et ce n'est pas ce « Chat »** : c'est la **Messagerie**, une SECTION de la barre latérale (groupe « Mon jour », aux côtés du cockpit et de l'agenda) sur `/dashboard/messagerie`, adossée aux 9 tables `mail_*` ; le namespace `messages` compte **22 lecteurs** dans `src/` au 05.09.2026 contre zéro la veille. Elle est **sur `main` depuis le 05.09.2026** ([PR #1276](https://github.com/megga/megga-real-estate/pull/1276), fusion `6277baad`) et **servie** — vérifié en balayant les **247 chunks** d'`app.megga.ch` : `MessageriePage-*.js`, `MobileMessagerieScreen-*.js`, `useMailAccounts-*.js` et `oauthPopup-*.js` y sont, et `/dashboard/messagerie` apparaît dans 7 chunks (la table de navigation est inlinée par page). ⛔ **Ne pas balayer avec un motif qui s'arrête à la barre oblique** : les imports paresseux s'écrivent `"assets/Foo-hash.js"`, et un motif `[A-Za-z0-9._-]+\.js` n'en rend que **37** sur 247 — assez pour conclure à tort que le déploiement a échoué. Voir le point Messagerie ci-dessous, qui distingue le socle, l'écran et la preuve.

**Chrome du CRM de bureau : DEUX pièces depuis le 4 septembre 2026.** Le §8 les ignorait entièrement —
mesuré le 05.09.2026, `CLAUDE.md` ne contenait **0** occurrence de `CrmWorkspace`, `CrmTabsBar` ou
`crm_open_tabs`, alors que les deux pièces sont en production. (1) La **barre latérale** `CrmSidebar`
porte les *destinations* ; elle a remplacé le duo top-nav + rail d'icônes le 4 septembre au matin
(commit `050357df`). (2) La **bande d'onglets** `CrmTabsBar` porte les *contextes ouverts* — deux fiches
contact côte à côte — livrée le même jour (commit `00b3fbd3`). ⚠ Les deux pièces ont voyagé dans **une
seule** PR, [#1277](https://github.com/megga/megga-real-estate/pull/1277) : il n'existe pas de PR séparée
pour la barre latérale. Backend de la bande : table `crm_open_tabs` + RPC
`crm_tabs_save` / `crm_tabs_resolve_labels` / `crm_tab_badges`, plafond client 24 (CHECK serveur à 32,
volontairement plus haut pour qu'un dépassement transitoire n'annule pas l'écriture en silence).

⛔ **Les 22 surfaces montent `<CrmWorkspace>`, JAMAIS `<CrmSidebar>`** — mesuré le 07.09.2026
(`grep -rl '<CrmWorkspace' src/`, hors le composant lui-même et hors les trois bancs `/dev`) ;
le point annonçait 20, il en comptait déjà 21. `grep -rl '<CrmSidebar' src/` ne rend, lui, qu'**un**
fichier — `CrmWorkspace.tsx` lui-même. Une surface qui
court-circuite la coquille perd la bande d'onglets **et** la variable `--crm-tabs-h`, sans qu'aucune
porte ne rougisse. ⛔ **QUATRE ROUTES D'ONGLET LE FAISAIENT**, mesuré le 07.09.2026 : basculer sur
l'une d'elles faisait disparaître la bande ET la barre latérale, sans autre sortie que son propre lien
de retour. `VisitDetailPage` (`/dashboard/visits/:id`) est corrigée — c'est une FICHE, `visit` est l'un
des cinq genres de `crmTabRecordRef`, et les trois autres fiches portaient déjà la coquille. Les trois
restantes gardent leur choix : `visits/new`, `transactions/:id/offre/:kind` et `import-lead` sont des
modales de plein écran (`position: fixed`, une croix pour sortir), pas des fiches. ⚠ Cette variable n'est pas décorative : `ListingWizardPage.tsx:42` calcule
`height: calc(100vh - 64px - var(--crm-tabs-h, 0px))`, et sans son troisième terme la page débordait de
48 px, le pied du wizard passant sous le pli. Il en est aujourd'hui le **seul** lecteur.

⚠ **L'état d'écran se range dans l'onglet, plus dans un `useState`** : `useTabScopedState` est un
remplaçant direct de `useState` dont la clé est portée par l'onglet actif — c'est ce qui fait qu'une
position de pager ou un filtre survit à un aller-retour entre deux onglets. La pile est miroitée en
**`sessionStorage`** (`megga.crm.tabs`), jamais en `localStorage` : elle porte des **noms de clients**.

**Réseau inter-agences : ❌ RETIRÉ (hors périmètre v1).** L'ancien prototype `NetworkSugarV2Page` (données d'exemple, aucun backend, jamais routé) a été supprimé lors du nettoyage code mort ; les routes `/dashboard/network` et `/dashboard/reseau` redirigent vers `/dashboard`. Le module réel (partage de biens inter-agences + RLS cross-agence + modèles PDF) reste à construire plus tard.

**MEGGA AI :** Edge Function ai-copilot (DeepSeek deepseek-chat — appel api.deepseek.com direct), streaming, score engine. **Inférence texte = DeepSeek partout** ; **vision/OCR/PDF = Gemini** (photo-vision, extract-property-pdf via `_shared/vision.ts`). **AUCUN Claude/Anthropic** (retiré ; kyc-screening = Dilisense déterministe seul).

**Portail vendeur : ❌ RETIRÉ (26 juillet 2026).** Il n'avait jamais servi — `seller_portals` comptait 0 ligne depuis sa création, aucun lien personnel n'a jamais été émis, et l'UI de création avait déjà disparu de la fiche contact. Retiré en entier : routes (`/portal*` et `/portail*` redirigent vers la vitrine), pages, `components/seller-portal/`, hooks, section « Portails vendeurs » de la console admin, drapeau de plan `sellerPortal`, edge `seller-portal-action`, et les tables `seller_portals` / `seller_preferences` (migration `20260726180000`).

**Messagerie (e-mail) : ✅ LOT 1 EN PRODUCTION depuis le 04.09.2026.** ⛔ **Ce paragraphe a affirmé l'inverse pendant vingt-quatre heures, et ses quatre mesures étaient inversées.** Il donnait la [PR #1274](https://github.com/megga/megga-real-estate/pull/1274) pour « OUVERTE au 04.09.2026 » et la production pour vide — « 0 table `mail_%`, 0 fonction `mail_%`, 0 job cron `mail%` » — alors qu'elle a été **mergée ce jour-là à 08:55 UTC** (`26187ba7`). Remesuré en production le 05.09.2026 : **9 tables `mail_%`, 11 fonctions `mail_%`, 1 job cron `mail%`** (`mail-sync-2min`). La prétention n'était pas vague, elle était fausse sur chacun de ses chiffres — et aucune porte ne la mesurait.

**Lot 1 (backend) — MERGÉ ET EN PRODUCTION** ([PR #1274](https://github.com/megga/megga-real-estate/pull/1274), types régénérés par [#1275](https://github.com/megga/megga-real-estate/pull/1275)). Mesuré en prod le 05.09.2026 : **9 tables `mail_%`, 11 fonctions `mail_%`, le cron `mail-sync-2min` (`*/2 * * * *`) actif**, `mail_threads` publiée en Realtime avec `replica identity full`. Deux migrations : `20260904074500_mail_module.sql` (les 9 tables et 11 fonctions, RLS sur les 9, `purge_activity_events_retention` étendue à la catégorie `messaging`, 25 comptes par tick) et `20260904074600_mail_sync_failures.sql` (échecs consécutifs, `status='error'` au 5ᵉ). Côté code : **9 modules purs** dans `supabase/functions/_shared/mail/` — dont **6 seulement portent des specs**, soit **103 tests** ; `sync.ts`, `guard.ts` et `types.ts` ne sont exercés que par les specs backend — et **5 edge functions** (`mail-oauth`, `mail-sync`, `mail-actions`, `mail-send`, `mail-attachment`).

**Lot 2 (l'écran) — MERGÉ ET EN PRODUCTION** le 05.09.2026 ([PR #1276](https://github.com/megga/megga-real-estate/pull/1276), fusion `6277baad`, les cinq workflows de `main` verts dont « Deploy React app to app.megga.ch »), 15 tâches sur 15 plus les **15 correctifs de revue**.

⚠ **La PR a passé deux heures SANS AUCUNE CI, et ça ne se voyait pas.** `main` avait bougé sous elle (refonte du chrome, [#1279](https://github.com/megga/megga-real-estate/pull/1279)) : `mergeable=CONFLICTING` ⇒ GitHub ne calcule plus la réf de fusion ⇒ **il ne crée AUCUN run `pull_request`** — et comme les quatre workflows ne se déclenchent que sur `push: [main]` et `pull_request: [main]`, la PR n'avait plus de checks du tout. Mesuré : `actions/runs?head_sha=…` rendait **0** pour trois commits d'affilée, dont un commit VIDE poussé exprès. ⛔ **Une PR en conflit ne rougit pas : elle DISPARAÎT de la CI**, ce qui se lit comme « en attente ». L'oracle est `gh pr view --json mergeable`, jamais la liste des checks.

⚠ Le port qui a suivi : `CrmTopNav` et `CrmIconRail` n'existaient plus, la messagerie monte désormais `CrmWorkspace` et devient une **section de la barre latérale** (groupe « Mon jour »), ses onze `case` de navigation retirés — exactement les `switch` recopiés que `crmSidebarNav.ts` a été écrit pour supprimer.

Chiffres du lot : Contre `main` au 05.09.2026, APRÈS la fusion du chrome de septembre : **95 fichiers, 52 créations, +8085 / −602 lignes**. ⚠ Le point annonçait « 137 fichiers, 79 créations, ~26 000 lignes » : ce n'est pas le lot qui a maigri, c'est sa BASE DE COMPARAISON qui a bougé. La refonte du chrome (PR #1279) a supprimé les vingt et un `switch` de navigation où le lot ajoutait une ligne chacun, et les captures de référence régénérées comptaient pour le reste. Un diff de PR n'est pas une taille, c'est un écart — il change quand la branche d'en face change. Trois routes neuves — `/dashboard/messagerie` (bureau **et** mobile via `ResponsiveRoute`), `/oauth/mail/callback`, `/dev/messagerie`. **22 composants** dans `src/components/crm/messagerie/` + 4 modules purs dans `src/lib/mail/`, **11 hooks** `useMail*`, **258 clés** dans le namespace i18n `messages` (⚠ déclaré depuis longtemps et consommé par PERSONNE jusqu'ici — c'est ce lot qui lui donne enfin un lecteur), **5 specs unitaires** neuves.

⛔ **ZÉRO BOÎTE, ET C'EST MESURÉ, PAS SUPPOSÉ.** En prod le 05.09.2026 : `mail_accounts` **0 ligne**, `mail_threads` **0**, `mail_messages` **0**. Un cron qui tourne toutes les deux minutes sur zéro compte ne prouve rien d'autre que sa propre planification.

⛔ **Les jetons ne sont JAMAIS en colonne.** Ils vivent dans Supabase Vault, atteints par quatre ponts `SECURITY DEFINER` à `search_path` vide (`mail_secret_store` / `_read` / `_update` / `_delete`), révoqués de `public`/`anon`/`authenticated` et accordés au seul `service_role` ; `mail_accounts.vault_secret_id` n'est qu'un pointeur. L'OAuth est un **code + PKCE en pop-up, hors GoTrue** — Supabase Auth ne sait pas détenir un jeton fournisseur pour un usage serveur. ⚠ **L'URI de redirection ne dérive PAS de `MEGGA_APP_URL`** : `redirectUriFor` la bâtit sur l'origine de l'APPELANT, une fois celle-ci trouvée dans la liste blanche `MAIL_OAUTH_ORIGINS` (`_shared/mail/guard.ts`). La rendre pilotable par un réglage casserait la connexion de toutes les boîtes (`redirect_uri_mismatch`), l'URI devant correspondre **caractère pour caractère** à celle enregistrée chez Google et chez Microsoft — exemption inscrite dans `tests/unit/app-url-unique.spec.ts`.

⛔ **CE QUI N'EST PAS ÉPROUVÉ, et qu'aucune CI verte ne dira jamais.** **Aucun appel réel à Google ni à Microsoft n'a jamais eu lieu, dans aucun des deux lots** : tous les tests d'adaptateur injectent un faux `fetch` — ils éprouvent la construction des requêtes et le décodage des réponses, pas le fournisseur. Le code de bout en bout existe désormais des deux côtés ; ce qui manque est **entièrement hors du dépôt**, et Julien seul peut le poser :

1. **Google** — l'URI `https://app.megga.ch/oauth/mail/callback` n'est PAS dans les *Authorized redirect URIs* du client OAuth : le consentement ne s'affiche pas, Google rend `Erreur 400 : redirect_uri_mismatch`. L'**API Gmail n'est pas activée**. Le scope **`gmail.modify` n'est pas déclaré** en Data Access — il est **RESTRICTED**, donc plus strict que les deux scopes Calendar déjà en attente (voir « Se connecter avec Google » plus bas) : écran « application non validée » et plafond de 100 utilisateurs tant qu'il ne l'est pas.
2. **Microsoft** — `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` restent absents du projet Supabase, donc `provider:'outlook'` répond **`503 provider_not_configured` par conception**, ce qui est le bon échec : bruyant et lisible à l'écran.
3. L'inscription **Entra ID** elle-même (§6 du plan maître).

⚠ **L'épreuve de bout en bout du maître §7.4 n'a donc PAS été jouée**, et la case reste décochée dans le plan du lot 2, avec le mode d'emploi littéral écrit dessous. Ne pas la cocher sur la foi d'un banc vert : `/dev/messagerie` rend des **fixtures**, pas du courrier. Plans : [maître](docs/superpowers/plans/2026-09-03-messagerie-crm.md) (D1-D16, §6 les gestes hors dépôt, §7.4 l'épreuve), [lot 1](docs/superpowers/plans/2026-09-03-messagerie-crm-lot1-backend.md), [lot 2](docs/superpowers/plans/2026-09-03-messagerie-crm-lot2-front.md).

**Super-Admin :** **surface du CRM** montée sous `/dashboard/admin/*` (`App.tsx` → `AdminConsoleRoute` → `AdminConsoleRoutes` → `AdminShell` + 19 pages lazy — ⚠ ce point annonçait 17 ; `docs/system-map.md` disait 19, et c'est LUI qui avait raison, mesuré le 17.08.2026). L'application autonome `admin.megga.ch` a été retirée le 28.07.2026 : plus de `build:admin`, plus de projet Pages dédié, plus de passage de session par fragment d'URL. Accent violet réservé au repère de contexte du rail ; nav groupée en 5 sections ; chrome et atomes dans `src/components/admin/kit/`.

Accès : `AdminConsoleRoute` → `useSuperAdminGate` (UX seule) ; le mur réel est en base (`is_super_admin()` = rôle **ET** e-mail allowlisté, lu dans `auth.users`) et sur les edges (`_shared/require-super-admin.ts`). ⚠️ Aucun contrôle AAL2 : le 2FA a été retiré (#873). Entrée par le dropdown profil Sugar et ⌘K (`src/lib/adminEntry.ts`) ; chaque entrée est journalisée (`admin_console_entered`) et l'impersonation reste audit-first (`admin_log_impersonation`, bloquante) via `?impersonate=<id>`.

⚠️ Les cibles de navigation de la console DOIVENT être préfixées par `ADMIN_CONSOLE_PATH` — une cible nue tombe sur le 404 du CRM, voire sur une redirection publique. Garde-fous : `tests/unit/admin-console-paths.spec.ts` et `tests/unit/redirects-guard.spec.ts` (ce dernier interdit toute règle de bord qui expulserait `/dashboard/*` vers un autre hôte : c'est ce qui avait rendu la console injoignable).

**Intégrations :** Resend, Stripe, Google/Outlook Calendar (OAuth), virtual staging (Gemini), Flatfox sync. ⚠ **Resend est le sortant TRANSACTIONNEL de la plateforme** — confirmations, alertes, invitations — il n'a jamais lu une boîte. La lecture et l'envoi depuis la boîte de l'agent passent par **l'API Gmail et Microsoft Graph**, inscrites ici le 05.09.2026 — la PR #1274 ayant été mergée la veille, ce paragraphe demandait lui-même de les ajouter « le jour du merge ». ⚠ **Inscrites ne veut pas dire éprouvées** : aucun appel réel n'a jamais été fait à Google ni à Microsoft (tous les tests d'adaptateur injectent un faux `fetch`), `MICROSOFT_CLIENT_ID` / `_SECRET` restent absents du projet, et — c'était le troisième motif jusqu'au 05.09.2026 — la route `/oauth/mail/callback` a été **déployée avec le lot 2**. Il ne reste donc plus AUCUN blocage dans le dépôt : **aucune boîte ne peut être connectée pour trois raisons entièrement HORS dépôt**, listées au point Messagerie (URI de redirection Google + API Gmail + scope `gmail.modify` déclaré ; inscription Entra ID ; les deux secrets Microsoft).

### Secrets Supabase
```
DEEPSEEK_API_KEY, GEMINI_API_KEY, RESEND_API_KEY, DILISENSE_API_KEY,
MEGGA_MAGIC_LINK_HMAC_SECRET,
MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET (⛔ ABSENTS du projet — relevé le 16.08.2026,
  NON re-mesuré depuis ; DEUX lecteurs désormais, voir ci-dessous),
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET (✅ posés le 16.08.2026 — voir ci-dessous),
GOOGLE_WORKSPACE_SA_KEY (✅ posé le 09.08.2026 — voir ci-dessous),
STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_IDENTITY_FLOW_ID (⛔ PLUS AUCUN LECTEUR
  depuis le 17.08.2026 — voir ci-dessous ; à supprimer),
MAPBOX_TOKEN,
UID_REGISTER_API_URL, UID_REGISTER_API_CREDENTIAL
```

> ⛔ **`STRIPE_IDENTITY_FLOW_ID` A ÉTÉ DÉBRANCHÉ LE 17.08.2026 : le flux Stripe COÛTAIT
> le retour du dirigeant dans le wizard.** Il portait (décision du 03.08.2026) passeport
> + carte d'identité, selfie exigé, capture en direct, ni numéro de pièce ni e-mail ni
> téléphone — `vf_1U0PPiRNzm4ajaDa63xeKeL3`, « KYB dirigeant agence ».
>
> **`verification_flow` et `return_url` ne se combinent pas, et Stripe ne le dit nulle
> part** : ni la référence de l'API (qui donne `return_url` comme un paramètre ordinaire),
> ni le guide des flux (qui ne le mentionne pas). Mesuré sur la session
> `vs_1U5Y6HRNzm4ajaDaoMv1BMNI` (journal d'API Stripe, `req_WZUCE21ewpBdBS`) : le corps
> POST portait `return_url=https://app.megga.ch/dashboard/identite?verification=done`, la
> réponse **200 OK ne portait aucun champ `return_url`**. Paramètre accepté, jeté en
> silence.
>
> Effet : le dirigeant photographie sa pièce, tombe sur l'écran « Vous pouvez à présent
> fermer cet onglet » de Stripe, et **n'arrive jamais** sur `IdentityVerificationReturnScreen`
> ni sur l'étape « Rendez-vous ». Le parcours s'arrête au milieu alors que TOUT a marché
> (webhook passé, personne `verified`) — panne muette, aucun rouge nulle part. Le seul
> retour restant était « précédent » deux fois.
>
> ⚠ Le flux ne portait **aucun réglage d'URL de retour** à mettre à la place (relevé dans
> sa page du tableau de bord le 17.08) : il n'existait pas de correctif côté Stripe. Les
> quatre options sont donc reposées en clair dans `kyb-identity-verify`, à l'identique —
> ce qui ramène au passage les contrôles de conformité sous relecture de code. Gardé par
> [kyb-identity-return-url.spec.ts](tests/unit/kyb-identity-return-url.spec.ts).
>
> ⛔ **`MEGGA_APP_URL` doit rester ABSENTE — ne pas « réparer » son absence.** Constaté le
> 03.08.2026 : elle n'est posée nulle part, et c'est la bonne configuration. Son repli en
> dur, `https://app.megga.ch`, est la valeur qui sert réellement les quatre parcours
> publics — mesuré, `/kyc/…`, `/kyc-report/…`, `/accept-invite/…` et
> `/visite/…/modifier` rendent **200 sur `app.megga.ch` et 401 sur `megga.ch`** (la
> vitrine est protégée par mot de passe et ne connaît aucune de ces routes).
>
> La poser n'ajoute donc aucune capacité, seulement deux façons de casser les liens : une
> faute de frappe, ou le plan archivé
> `docs/superpowers/plans/2026-06-02-whatsapp-kyc-report-pdf.md` qui donne
> `MEGGA_APP_URL=https://megga.ch` en exemple. La suivre remplacerait une panne visible par
> une panne qui ressemble à un site vivant.
>
> À poser UNIQUEMENT le jour où l'app changerait de domaine — et alors sur le domaine de
> l'APP, avec le schéma, sans chemin (le segment `/kyc` appartient à la route, pas au
> réglage). Lecteurs : `_shared/app-url.ts` — qui porte les quatre constructeurs
> (`kycMagicLinkUrl`, `visitManageUrl`, `teamInviteAcceptUrl`, `kycReportRenderUrl`) — et
> `appointment-book`, seule fonction à garder sa propre lecture (elle accepte en plus un
> repli `APP_URL`, et fige la valeur dans une `const` de module).

> ✅ **`MEGGA_MAGIC_LINK_HMAC_SECRET` EST configuré** (mesuré le 03.08.2026) — il manquait
> simplement à cet inventaire. Il signe les jetons publics du lien magique KYC ET des liens
> de réception acheteur (`_shared/magic-link-token.ts`, ≥ 32 caractères exigés à la
> signature). Sans lui, les deux parcours échouent **fermé** — `verifyMagicLinkToken` rend
> `no_secret` et tout lien est refusé — donc son absence casse la fonctionnalité sans ouvrir
> de faille.
>
> Méthode, réutilisable pour tout secret d'edge : interroger la fonction déployée avec un
> faux jeton de syntaxe valide et lire le motif. Le secret est vérifié AVANT la signature,
> donc `no_secret` ⇒ absent, `invalid_signature` ⇒ présent. ⚠ Cet oracle disparaît avec la
> PR #1114, qui réduit le motif rendu aux appelants anonymes à `expired`/`invalid` — il
> renseignait un tiers sur la configuration du déploiement.

> 🗓 **`GOOGLE_WORKSPACE_SA_KEY` — l'agenda des appels d'accueil (15.08.2026).**
> ⚠ Le NOM vient de la prod : Julien l'avait posé ainsi le 09.08, avant le code — et la
> valeur d'un secret ne se relit pas depuis le dashboard, donc c'est le code qui s'est
> aligné (un nom désaccordé échoue comme un secret absent : `degraded`, silencieux).
> Contenu : le fichier de clé JSON **entier** du compte de service
> `megga-onboarding-calendar@tribal-dispatch-504619-c1.iam.gserviceaccount.com`
> (projet Google « My First Project » du compte **hello@megga.ai**, API Calendar déjà
> activée). Lu par `_shared/google-service-account.ts`, qui signe une assertion RS256 et
> **usurpe** la boîte déclarée dans `onboarding_hosts.calendar_email`.
>
> ⚠ L'usurpation n'est pas un luxe : un compte de service qui écrit dans un agenda
> simplement PARTAGÉ avec lui **ne peut pas créer de lien Google Meet** (Google exige un
> utilisateur organisateur). C'est possible ici parce que **`megga.ai` EST un Workspace**
> — mesuré le 15.08 : MX `smtp.google.com`, SPF `_spf.google.com` (par contraste
> `megga.ch` est chez privateemail). `calendars/primary` désigne alors l'agenda de la
> boîte usurpée.
>
> ⛔ **Sans la délégation à l'échelle du domaine, le secret ne sert à rien** : le jeton
> est refusé en `unauthorized_client`. À accorder dans la console d'administration
> Workspace (Sécurité › Contrôle des API › Délégation), au client OAuth
> **`118071255987425211651`**, scope **`https://www.googleapis.com/auth/calendar`** et lui
> seul. Cette page exige une ré-authentification par mot de passe même sur une session
> ouverte : elle ne peut pas être configurée par un agent.
>
> Bascule hôte par hôte, sans déploiement : `calendar_email` renseignée ⇒ compte de
> service ; NULL ⇒ voie OAuth personnelle historique (inchangée, Outlook comprise).
> ⚠ Un hôte dont la boîte est déclarée mais le jeton indisponible est **écarté de la
> grille** (`degraded`), jamais traité comme libre — donc « aucun créneau » est le symptôme
> attendu tant que la délégation manque.

> ✅ **`MAPBOX_TOKEN` est configuré et FONCTIONNE** (posé et mesuré le 16.08.2026 —
> [issue #1061](https://github.com/megga/megga-real-estate/issues/1061) close). Il est distinct de
> `VITE_MAPBOX_TOKEN` : le connecteur de géocodage KYB tourne dans une Edge Function, côté serveur,
> et lui faut le jeton dans les secrets Supabase, pas dans le build.
>
> ⛔ **LES DEUX JETONS NE PEUVENT PAS PORTER LA MÊME VALEUR.** L'Edge Function appelle Mapbox
> **sans referrer** : un jeton restreint par URL y échoue en 403, alors qu'il marche dans le
> navigateur. `MAPBOX_TOKEN` doit donc être SANS restriction, et `VITE_MAPBOX_TOKEN` — lisible par
> quiconque dans le bundle public — doit être restreint à `app.megga.ch`.
>
> ⚠ **Le code appelle Geocoding v6, jamais v5.** Mapbox a classé `geocoding/v5/mapbox.places`
> *legacy* : un compte créé aujourd'hui reçoit `403 {"message":"Forbidden"}`. Trois appels sont
> concernés (`_shared/kyb-sources.ts`, `src/lib/mapbox.ts`, `Step2Address.tsx`) et la forme de la
> réponse diffère — détails dans le cerveau, `megga/mapbox-geocoding-v6`.
>
> Effet mesuré une fois posé : `address_geocode` rend `match`, et `verification_score` cesse d'être
> `NULL` (1.000 sur les deux dossiers de test, contre 13 dossiers à `NULL` depuis toujours). ⚠ Ce
> score ne repose encore que sur UN check scorable : `vat_lookup` attend le registre UID et
> `domain_whois_age` réclame un site web déclaré.

### Secrets GitHub Actions
```
VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_MAPBOX_TOKEN (✅ posé le 16.08.2026),
CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, SUPABASE_ACCESS_TOKEN
```

> ✅ **`VITE_MAPBOX_TOKEN` est posé et présent dans le bundle** (16.08.2026). Vérifié en balayant
> les **263 chunks** réellement servis par `app.megga.ch` : le jeton (`pk.eyJ…`) est dans
> `ListingFormPage-*.js` et `WizardShell-*.js`, aux côtés de `search/geocode/v6/forward`.
>
> ⛔ **NE PAS CHERCHER LE JETON DANS `index-*.js`** : ce fichier ne contient pas une ligne de
> Mapbox, le code étant découpé en morceaux chargés à la demande. C'est ce raccourci qui a fait
> conclure deux fois à tort que le secret était vide. Un jeton absent du bundle se prouve en
> balayant les chunks, jamais l'index seul.
>
> ⚠ La valeur est figée **au build** : la poser exige un redéploiement pour prendre effet.

### Supabase
- **Project ref** : eayczugyrvmtqnnmvjod | **Region** : eu-west-1 | **Plan** : Pro
- **Anon key** : hardcodée dans `src/lib/supabase.ts` (sécurité via RLS, pas par obscurité)

### « Se connecter avec Google » — le client OAuth (migré le 16.08.2026)

Le fournisseur Google de Supabase Auth tournait sur un client appartenant à un **ancien
compte Google** (`178156637080-1d7r3cmb…`). Il vit désormais sur **hello@megga.ai**, projet
**« My First Project » (`tribal-dispatch-504619-c1`)** — le même que le compte de service
`megga-onboarding-calendar`, mais ce sont **deux mécaniques distinctes** : le compte de
service sert l'agenda d'accueil (`GOOGLE_WORKSPACE_SA_KEY`), le client OAuth sert la
connexion des agents. Changer l'un ne touche pas l'autre.

```
Client ID   833483825712-vh715spjupqcl86qffv3hvffsaqk0g8e.apps.googleusercontent.com
Consentement  External · In production (publié le 16.08) · app « MEGGA » (relevé 17.08 ;
              ce document a annoncé « GET MEGGA » pendant un jour)
Scopes déclarés  userinfo.email, userinfo.profile, openid  (tous NON sensibles)
```

⚠ **L'URI de redirection est `https://api.megga.ch/auth/v1/callback`, PAS l'URL `.supabase.co`.**
Le projet a un domaine personnalisé, et c'est cette URL-là que le panneau du fournisseur donne
à enregistrer. `supabase.co` a été **délibérément écarté** des URI du client : Google inscrit
d'office le domaine de chaque URI comme domaine autorisé du consentement, et `supabase.co`
n'appartient pas à MEGGA — un domaine non possédé gênerait une soumission en vérification.

⛔ **Google ne réaffiche PLUS un secret client après sa création** (« Viewing and downloading
client secrets is no longer available »). Il n'est lisible qu'une fois, dans la boîte « OAuth
client created » ; la page de détail n'en montre que les 4 derniers caractères. Le seul endroit
où la valeur reste récupérable est le **bouton « Reveal » du panneau Google de Supabase**. Le
perdre oblige à générer un nouveau secret.

✅ **`GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET` sont posés** (16.08.2026, 17:03 UTC). Ils
manquaient encore le matin même, et ce document l'a affirmé pendant quelques heures — c'est corrigé.
Trois chemins les lisent pour **rafraîchir** un jeton Google :
[google-calendar-sync/index.ts:43](supabase/functions/google-calendar-sync/index.ts),
[_shared/booking-oauth.ts:63](supabase/functions/_shared/booking-oauth.ts),
[_shared/host-freebusy.ts:110](supabase/functions/_shared/host-freebusy.ts).
⚠ Google exige les identifiants **du client qui a émis le refresh token** : ce sont donc ceux du
client ci-dessus. Si le client change, ces deux secrets doivent changer avec lui.

⛔ **POSÉS N'EST PAS ÉPROUVÉ.** `google_calendar_tokens` compte toujours **0 ligne** : la liaison
Google Calendar n'a jamais tourné de bout en bout, et poser les secrets ne le démontre pas. ⚠ Son
mode d'échec est **silencieux** — `host-freebusy` passe `sync_enabled = false` sur échec de refresh,
donc un agent qui connecte son agenda le verrait se déconnecter seul ~1 h plus tard, sans erreur.
La seule preuve est un agenda réellement connecté, revu une heure après.

**Éprouver une valeur de secret sans la lire.** La colonne « Digest SHA256 » du tableau des secrets
est le `sha256` de la valeur **brute** : `printf '%s' "<valeur>" | shasum -a 256` doit rendre le même
digest — vérifié sur `GOOGLE_CLIENT_ID` (`43032e97…`). Ça détecte au passage l'espace ou le saut de
ligne collé par mégarde, qu'aucune UI ne montre. Pour éprouver le **COUPLE** id + secret sans rien
déployer, appeler `https://oauth2.googleapis.com/token` en `grant_type=refresh_token` avec un jeton
volontairement faux : `invalid_grant` ⇒ le couple est valide (seul le jeton est rejeté),
`invalid_client` ⇒ le secret ne correspond pas au client. Même oracle que `no_secret` vs
`invalid_signature` pour `MEGGA_MAGIC_LINK_HMAC_SECRET`.

⚠ **AUCUN scope Calendar n'est déclaré dans Data Access** — vérifié dans la console le
17.08.2026 : « Your sensitive scopes » → **No rows to display**. Conséquence : la **connexion**
est propre pour tout le monde (scopes non sensibles seulement, ni plafond ni avertissement),
mais la liaison Calendar demande un scope sensible non approuvé — cet écran-là affiche
« Google n'a pas validé cette application » et consomme le plafond de 100 utilisateurs.

⛔ **LE VERIFICATION CENTER NE LIT QUE LES SCOPES DÉCLARÉS, jamais ceux réellement demandés.**
Ses deux cartes sont au vert et l'une des deux ment : « Branding status : ✅ verified » (c'est
la validation accordée le 17.08 au matin — automatique, quelques minutes) et « Data access
status : ⓘ **Verification is not required since your app is not requesting any sensitive or
restricted scopes** », alors que le CRM demande bel et bien un scope sensible. Une console au
vert ne prouve donc RIEN sur ce que l'app demande. ⚠ Ne pas confondre les deux validations :
le **branding** (nom + logo) est automatique ; la **data access** prend *jusqu'à 10 jours* et
exige la déclaration du scope, une justification écrite par scope + pourquoi un scope plus
étroit ne suffit pas, et une **vidéo** du consentement et de l'usage. Ordre imposé : branding
d'abord.

✅ **Le CRM demande DEUX scopes étroits depuis le 17.08.2026** (décision Julien), au lieu du
scope complet `…/auth/calendar` qui annonçait « supprimer définitivement tous les agendas » :
`calendar.events` (**sensible** — les 5 appels de `google-calendar-sync` et les 3 de
`booking-calendar-write`, tous sur `/calendars/primary/events`) et `calendar.freebusy`
(**NON sensible** — le `freeBusy.query` de `booking-freebusy` qui alimente les créneaux
proposés au client). ⛔ `calendar.events` **n'autorise PAS** `freeBusy.query` : le second scope
n'est pas un confort, sans lui `appointment-slots` propose des créneaux déjà pris. Un seul des
deux étant sensible, un seul passe la vérification.

⚠ La sensibilité d'un scope se lit dans le **sélecteur de la console** (Data Access → « Add or
remove scopes » → filtre « Google Calendar API »), à l'icône cadenas — les pages de doc Google
ne la portent pas. Relevé sur les 17 scopes Calendar : non sensibles = `calendar.freebusy`,
`calendar.events.freebusy`, `calendar.app.created`, `calendar.calendarlist.readonly`,
`calendar.events.public.readonly`, `calendar.settings.readonly` ; tous les autres sont
sensibles, `calendar.events` compris.

⚠ **Sans rapport avec `CALENDAR_SCOPE` de `_shared/google-service-account.ts`**, resté au scope
complet : il passe par la délégation à l'échelle du domaine Workspace, que l'écran de
consentement ne gouverne pas.

⚠ **L'ancien client reste actif sur l'ancien compte, et hello@megga.ai n'y a AUCUN accès**
(`resourcemanager.projects.get`, `oauthconfig.verification.get`, `iam.serviceAccounts.list`
manquants). Il ne peut être supprimé que depuis l'ancien compte.

⛔ **`MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` restent ABSENTS du projet** (relevé du
16.08.2026, toujours vrai après la pose des secrets Google). La voie OAuth Outlook est donc dans
l'état qu'avait la voie Google avant ce jour-là : `booking-oauth.ts:64` lit ces deux variables pour
rafraîchir un jeton Microsoft et tourne avec `client_id: ''`. Même mode d'échec silencieux.

⚠ **Ils ont un SECOND lecteur depuis la PR #1274** — sur branche, pas en production :
`_shared/mail/guard.ts::providerConfigFromEnv` les lit pour la messagerie, aux côtés des deux
secrets Google. Le mode d'échec y est en revanche **bruyant** : un `clientId` vide fait
court-circuiter `mail-oauth start` en 503 `provider_not_configured`, visible à l'écran. C'est
d'ailleurs pourquoi `supabase/config.toml` pose deux `clientId` de test **pour le runtime local
seul** (`test-only-local…`) — sans valeur non vide, la construction de l'URL d'autorisation, le
défi PKCE et l'insertion dans `mail_oauth_states` n'étaient exercés par RIEN, et un scope erroné
serait parti au vert. Aucun appel n'est fait vers Google ou Microsoft avec.

⛔ **Poser les deux secrets ne suffira PAS à connecter une boîte Outlook.** Il faut d'abord
l'inscription **Entra ID** (App registrations → « MEGGA », comptes organisationnels ET personnels ;
permissions **déléguées** Microsoft Graph `Mail.ReadWrite`, `Mail.Send`, `User.Read`,
`offline_access` ; URI de redirection `https://app.megga.ch/oauth/mail/callback`). Et cette inscription
sert DEUX mécaniques qui se configurent à DEUX endroits : le fournisseur **Azure de Supabase
Auth** pour le `linkIdentity` du calendrier Outlook (`useOutlookCalendar.ts:121`), et les deux
secrets Supabase pour le rafraîchissement côté edge (`booking-oauth.ts`) comme pour la
messagerie. Poser l'un ne pose pas l'autre — c'est le couple de secrets, et lui seul, qui
explique le `client_id: ''` du paragraphe ci-dessus.

**Vérifier la bascule sans se connecter** — l'oracle est côté serveur, pas dans l'UI du dashboard :
```bash
curl -s -o /dev/null -w '%{redirect_url}' \
  'https://api.megga.ch/auth/v1/authorize?provider=google&redirect_to=https%3A%2F%2Fapp.megga.ch%2Fauth%2Fcallback'
```
Lire le `client_id` de la redirection, puis suivre cette URL : une page « Sign in - Google Accounts »
**sans** `redirect_uri_mismatch` / `invalid_client` / `unauthorized_client` prouve que le client et
l'URI sont acceptés par Google.

### Prochaines priorités

**✅ Résolu le 16.08.2026 — [issue #1061](https://github.com/megga/megga-real-estate/issues/1061), jeton Mapbox.**
Les deux secrets sont posés, le code est passé en Geocoding v6, et le KYB calcule enfin des
scores (`1.000` sur les deux dossiers de test, contre 13 dossiers à `NULL` depuis toujours).
Ce qui reste de cet épisode est écrit plus haut, dans les deux encadrés des secrets.

**🟠 Reste à faire, par ordre d'effet :**
1. **Soumettre la vérification data access** (jusqu'à 10 jours). ✅ Fait le 17.08.2026 : les
   deux scopes sont déclarés dans Data Access et la justification écrite est enregistrée ; le
   Verification Center dit désormais « Your app's data access is not verified. Verification is
   required because your app requests sensitive or restricted scopes. » ⛔ Deux choses bloquent
   encore, aucune dans le dépôt : (a) **la vidéo de démonstration**, seul champ que le
   formulaire de Google déclare manquant — elle désactive le bouton Confirm ; (b)
   **`https://megga.ch/` répond 401** (portail de la vitrine), donc la page d'accueil déclarée
   est inaccessible au relecteur. `/privacy` et `/terms` sont bien à 200 — mesuré. Le
   formulaire ne détecte pas le 401 ; la revue humaine, si.
2. **Deux jetons Mapbox distincts.** Le même est aujourd'hui posé aux deux endroits, donc le
   jeton du navigateur est **sans restriction et lisible par tous** dans le bundle public.
   Dupliquer, et restreindre la copie navigateur à `app.megga.ch`.
3. **Registre UID** (`UID_REGISTER_API_URL` / `_CREDENTIAL`) : sans lui `vat_lookup` reste
   `unavailable` et le score suisse ne repose que sur UN check.
4. **`Step2Address.tsx` invente des adresses** quand le géocodage échoue : son `catch` retombe
   sur `mockSuggestions` sans rien dire à l'écran. Décider ce que l'utilisateur doit voir.

---

> ⚠ Liste pré-pivot (avril 2026), conservée pour mémoire. Depuis le pivot CRM-first (juin 2026), les points marketplace publique (`/louer`, « Mes lieux », carte des prix) sont gelés ; le focus actuel est le CRM agent.

1. **Audit perf /louer** — Lighthouse, lazy images, virtualisation liste, Supercluster en worker
2. **"Mes lieux" multi-POI** — travail+école+sport sur la carte, trajet vers chaque bien
3. **Carte des prix temporelle** — overlay prix/m² avec slider 12 mois
4. **i18n** — finir migration 3 pages marketing (ServicesPage, EstimationsPage, VendrePage)
5. **Onboarding interactif** — checklist 5 étapes dans le dashboard agent
