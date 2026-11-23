# Runbook: Property workflows

**Runbook** — інструкція «що робити, коли щось пішло не так», написана заздалегідь. Кожен розділ відповідає на три
питання: як зрозуміти, що це саме воно; що зробити першим; як перевірити, що допомогло. Лише назви змінних — значень,
паролів і chat id тут немає: репо публічне.

Останнє оновлення: 2026-11-23, версія продукту: `v1.0.0` (реліз-кандидат). Перевірено на дрілі 2026-11-23
([postmortem](incidents/2026-11-23-staging-bad-supabase-url.md)).

## Хто отримує алерт і кого кликати

| Роль | Хто (GitHub-логін) | Коли кликати |
|---|---|---|
| Черговий розробник (отримує алерт) | @yuriivynar | будь-який червоний smoke чи повідомлення «ПОМИЛКА СЕРВЕРА» |
| PM (говорить із клієнтом) | @solomchaak | SEV1–SEV2 — одразу; SEV3 — у робочий час |
| Резерв | немає (команда з одного розробника) | — |

- **Канал алерту:** група Telegram команди (у ній черговий розробник і PM). Бот «Property Workflows Alerts» пише туди з
  `.github/workflows/smoke.yml` (секрети GitHub `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`) і з `src/instrumentation.ts`
  (ті самі назви — змінні Vercel, Production і Preview).
- **Серйозність** — за матрицею SEV1–3 з операційних вимог PM (репо вимог `solomchaak/property-workflows-spec`). Поки її
  немає — загальна: SEV1 — прод не відкривається чи видно чужі дані; SEV2 — ключовий сценарій (запуск процесу,
  позначка задачі, вхід ролі) зламано; SEV3 — розбір документа AI недоступний, а ручне введення працює; збій лише на
  staging.
- Навчальний проєкт: реакція — у робочий час, нічних чергувань немає.

## Де що

| Що | Адреса / де шукати |
|---|---|
| Прод | <https://property-workflows-eta.vercel.app> (гілка `main`) |
| Staging | <https://property-workflows-git-staging-yvynar-8355.vercel.app> (гілка `staging`; змінна лише для гілки `APP_ENV=staging`; за захистом Vercel) |
| Здоров'я | `<адреса>/api/health` → `{ ok, sha, env, appEnv, supabaseRef, db, reason }`: прод — `"appEnv":null`, ref проду; staging — `"appEnv":"staging"`, ref staging |
| Прогони smoke | Actions → `smoke`: job `prod` — прод (після деплою `main` і щодня ≈ 07:23 за Києвом); job `deploy` — кожен preview і `staging` за адресою саме цього деплою |
| Чернетка розбору | Actions → `oncall-assistant` → issue з міткою «чернетка агента, не перевірено» (якщо задано ключ моделі) |
| Vercel | проєкт `property-workflows` → Deployments, Logs |
| Supabase — прод | ref `lapdlcgusuahefesxfug` → Logs, Advisors; Vercel **Production**; міграції — CI, job `db-deploy` (environment `production`) |
| Supabase — staging | ref `ukbnybazjlbicejpfjvz` (регіон `eu-west-1`) → Logs, Advisors; Vercel **Preview** (усі гілки, отже й `staging`) і локальний `.env.local`; міграції — CI, job `db-deploy-staging` (environment `staging`) **перед** `db-deploy` |
| Доступ PM до staging | спільне посилання Vercel (Share) на деплой staging — одне на акаунт Hobby; посилання з токеном лише в особистому повідомленні, у файлах — адреса без «?…» |
| Статус-сторінки | vercel-status.com · status.supabase.com · githubstatus.com · status.openrouter.ai — дивимось **наш** регіон і компонент; зелена сторінка не доводить, що в нас усе гаразд |

## 1. Червоний smoke

**Як зрозуміти:** у Telegram прийшло «ЧЕРВОНИЙ SMOKE» — workflow, job, середовище (і гілка), адреса, коміт, посилання
на прогін.

1. **Збережіть докази (перші 5 хв).** Відкрийте прогін → крок smoke → рядок JSON з відповіддю health і рядки
   `::error::`. Посилання на прогін, адресу деплою і JSON health — в issue інциденту. Журнали Vercel на Hobby живуть
   **1 годину**.
2. **Що каже health** (поле `reason` і `supabaseRef` у JSON):

   | Ознака | Що це найімовірніше | Куди далі |
   |---|---|---|
   | `supabaseRef` не той (preview / staging ≠ `ukbnybazjlbicejpfjvz`, прод ≠ `lapdlcgusuahefesxfug`) | хибна `NEXT_PUBLIC_SUPABASE_URL` у Vercel для цього середовища чи гілки | розділ 6, «Змінні»; так було на дрілі 23.11 |
   | `reason: status-0` | база не відповідає за цією адресою (хибна адреса чи мережа) | спершу звірте `supabaseRef`, потім статус Supabase |
   | `reason: paused` | база на паузі | розділ 3 |
   | `reason: invalid-api-key` | хибний `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` для цього середовища | розділ 4 (і ключ саме того проєкту) |
   | `стіна входу Vercel` / `секрет обходу` | захист Vercel чи `VERCEL_AUTOMATION_BYPASS_SECRET` | розділ 4 |
   | `показує <sha>, а очікувався <sha>` | деплой не пройшов або був відкат | розділ 2 |
   | `HTTP 5xx` на `/` чи `/login` | зламаний код чи змінна середовища | крок 4 |
   | `недоступний` | Vercel чи мережа | статус Vercel, повтор через 5 хв |

3. **Прод чи ні?** Job `deploy` (preview, staging) — клієнт не постраждав: SEV3, виправляємо в робочому порядку. Job
   `prod` — `curl -s https://property-workflows-eta.vercel.app/api/health` → визначте SEV і напишіть у чат «беру, SEV<N>».
4. **Спершу зупинити шкоду.** Прод зламав останній деплой — відкат (розділ 2). Зламала змінна — виправити змінну й
   Redeploy (розділ 6). Потім розбір.
5. **Розбір** — з агентом у профілі «лише пропонує» (розділ 7). Агент пропонує, виправляє людина.
6. **Перевірка:** новий деплой сам запускає smoke (`repository_dispatch`); для проду — Actions → smoke → Run workflow з
   порожнім `url`. Зелений → у чат: «SEV<N> закрито, причина: …».
7. Після SEV1–SEV2 і після кожного дрілу — postmortem `docs/incidents/<YYYY-MM-DD>-<slug>.md`.

**Smoke не запустився після деплою?** Подію `repository_dispatch` надсилає Vercel. Якщо в Actions → smoke немає
прогону з подією `repository_dispatch` (лише `status`) — Vercel → Settings → Git: перемикачі подій `repository_dispatch`
і `deployment_status` мають бути ввімкнені (23.11 саме через це smoke деплоїв не стартував). Тимчасово — Run workflow з
полем `url` = адреса деплою.

## 2. Відкат проду і повернення автоматичного просування (Promote)

**Коли:** прод зламав щойно розгорнутий коміт, а виправлення вперед займе довше за 30 хв.

1. Vercel → Deployments → попередній робочий прод-деплой → **Instant Rollback**. На Hobby — **лише на безпосередньо
   попередній** прод-деплой.
2. Перевірка: `/api/health` проду → `"db":"ok"`, сторінка входу відкривається.
3. **Пастка Hobby:** після відкату Vercel **вимикає автоматичне просування** — наступні злиття в `main` збираються, але
   на прод **не потрапляють**. Smoke `prod` червонітиме з «показує <старий sha>, а очікувався <новий>».
4. Виправлення — звичайним PR у `main` (CI, рев'ю). Коли деплой виправлення готовий: Vercel → цей деплой → **Promote**
   (або сторінка відкату → Manage). Перевірка: `/api/health` знову показує SHA `main`, smoke `prod` зелений.
5. Відкат **не змінює** базу, міграції й змінні середовища: старий деплой працює з поточною схемою й зі значеннями
   змінних, з якими його зібрали. Тому міграції в нас лише додають (expand) і йдуть окремим PR першими.
6. На staging Instant Rollback недоступний: «відкат» staging — виправити змінну чи код і Redeploy. Redeploy **старого**
   деплою staging збирається з **поточними** змінними — він не повертає хибну змінну назад.

Хто робить: черговий розробник. Агент відкат і Promote не робить ніколи (заборонено в `.claude/settings.json`).

## 3. База на паузі

**Як зрозуміти:** `/api/health` → 503, `"db":"down"`, `"reason":"paused"`; smoke пише «Supabase призупинено».
Безкоштовний Supabase ставить проєкт на паузу після 7 днів без достатньої активності бази. Прод і staging засинають
**незалежно**: червоний smoke `prod` — прод-проєкт (`lapdlcgusuahefesxfug`); червоний smoke staging чи preview — проєкт
staging (`ukbnybazjlbicejpfjvz`). Пауза staging ще й зупиняє міграції: `db-deploy-staging` падає, і прод не мігрує.

1. Supabase Dashboard → **той проєкт, що на паузі** (звірте ref із `supabaseRef` у health) → **Resume project**.
2. Повторіть smoke: прод — Actions → smoke → Run workflow; staging — Run workflow з `url` = адреса staging (або Redeploy).
3. Запишіть у чат команди, коли була пауза і скільки тривала.

Як не допустити: щоденний smoke `prod` будить **лише прод-базу**. Staging щоденний smoke не будить: **перед UAT, демо чи
дрілом — Dashboard → проєкт staging активний, інакше Resume project.**

## 4. Ротація ключа + redeploy

**Коли:** ключ потрапив у git, журнал, на знімок чи в чат з агентом — або його треба змінити планово. Порядок завжди
однаковий: **новий ключ → замінити всюди → redeploy → перевірити → лише тоді видалити старий.**

| Що | Де новий | Де замінити | Що ще |
|---|---|---|---|
| Publishable key **прод-проєкту** (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) | прод-проєкт → Settings → API Keys | Vercel → Environment Variables → **лише Production** | Redeploy проду (`NEXT_PUBLIC_*` вбудовуються під час збірки) → smoke `prod` |
| Publishable key **проєкту staging** | проєкт staging → Settings → API Keys | Vercel → **Preview** (усі гілки); свій `.env.local` | Redeploy `staging` і новий push у відкриті PR |
| Secret key Supabase (`SUPABASE_SECRET_KEY`) | той самий проєкт → API Keys | лише `.env.local` / `.env.prod.local` для скриптів (`users:demo`); у Vercel його немає | — |
| Рядок підключення бази (`SUPABASE_DB_URL`, після зміни пароля бази) | Connect → Session pooler у тому самому проєкті | GitHub → Environments → `production` чи `staging` | пароль без спецсимволів або percent-encoded; наступний прогін CI — запобіжник друкує правильний ref |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | Vercel → Settings → Deployment Protection → Protection Bypass for Automation | GitHub → Secrets → Actions | Redeploy `staging`: без нового значення smoke деплоїв червоніє зі «стіною входу Vercel» |
| `TELEGRAM_BOT_TOKEN` | Telegram → BotFather (перевипуск токена) | GitHub Secrets і змінні Vercel (Production, Preview) | Run workflow smoke з `url=https://example.invalid` → повідомлення прийшло |
| `OPENROUTER_API_KEY` | OpenRouter → Keys | Vercel (Production, Preview) | Redeploy; старий ключ видалити |
| `ANTHROPIC_API_KEY` (асистент чергового) | Claude Console → API Keys | GitHub Secrets | наступний червоний smoke — чернетка в issue |

Перевірка: зелений smoke на прод і staging. Запис у чат: що ротували і чому — без значень.

## 5. Де журнали і скільки вони живуть

| Що | Де | Скільки живе (безкоштовні тарифи) |
|---|---|---|
| Журнали запитів Vercel (`llm.call`, помилки сервера) | Vercel → Logs (фільтр за деплоєм чи гілкою `staging`) | **1 година** (Hobby) |
| Журнали збірки | Vercel → Deployments → деплой → Build Logs | поки є деплой |
| Журнали Supabase (API, Postgres, Auth) | Supabase → Logs — **у кожному проєкті свої** | **1 день** (Free) |
| Прогони GitHub Actions (smoke, CI, oncall-assistant) | Actions | 90 днів (Settings → Actions → General) |
| Алерти й помилки сервера (`onRequestError`) | група Telegram команди | поки їх не видалили |
| Чернетки розбору агента | Issues з міткою «чернетка агента, не перевірено» | постійно |

Висновок для чергового: розбираємо **одразу**, потрібні рядки журналу копіюємо в issue інциденту (без даних
користувачів).

## 6. Staging і змінні середовищ

- Гілка `staging` отримує зміни **лише з `main`**: `git fetch origin` → `git switch staging` →
  `git merge --ff-only origin/main` → `git push`. Окремої розробки на ній немає.
- **Власна база** — проєкт staging. Preview (усі гілки) і локальна розробка ходять у неї; прод-ключів у Preview
  немає. Дані — лише синтетичні, акаунти `*@example.test` з `accounts.zip`; прод-даних у staging не копіюємо.
- **Міграції** — лише CI на злитті в `main`: спершу `db-deploy-staging`, потім `db-deploy`. Обидва перед міграцією
  звіряють ref рядка підключення зі змінними репо `SUPABASE_STAGING_REF` / `SUPABASE_PROD_REF` (лише ref, без
  `https://`, на рівні репо, не середовища). Упала на staging — прод не мігрує; виправлення — нова міграція вперед.
- **Змінні Vercel:**

  | Змінна | Production | Preview (усі гілки) | Лише гілка `staging` |
  |---|---|---|---|
  | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | прод-проєкт | проєкт staging | — (перевизначення тут ламає staging — дріл 23.11) |
  | `APP_ENV` | — | — | `staging` |
  | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `OPENROUTER_API_KEY` | так | так | — |

  Змінні діють лише на **нові** деплої: після зміни — Redeploy.
- **Дріл** — лише на staging, без міграцій і без видалення даних; перед ним — issue з передбаченим сигналом.

## 7. Розбір з агентом: профіль «лише пропонує»

Агент читає журнали, деплої й код і **пропонує** причину та виправлення. Нічого не змінює: інструменти запису MCP
Vercel і Supabase заборонені поіменно (`.claude/settings.json`, `.claude/settings.incident.json`), Supabase — з
`read_only=true` на проєкт staging, редагування файлів, `git push`, `gh secret`, `gh variable` заборонені.

```powershell
cd D:\property-workflows
$env:SUPABASE_STAGING_REF = "ukbnybazjlbicejpfjvz"   # ref не секрет; прод-базу для дрілу не підключаємо
claude --settings .claude/settings.incident.json --mcp-config .mcp.incident.json --strict-mcp-config --permission-mode plan
```

1. `/mcp` → vercel → вхід (OAuth).
2. **Перевірка профілю:** «Покажи значення змінної APP_ENV» → питання чи відмова (відповідь «ні»); «Зроби відкат
   staging» → відмова; «Покажи останні деплої staging» → має показати список. 23.11 MCP Vercel відповідав 403 / 404 на
   деплої й журнали — тоді запасний шлях: `vercel logs --deployment <адреса деплою> --since 1h --json` (потрібен
   залогінений Vercel CLI) або дані з прогону smoke і записів деплоїв у GitHub.
3. Промпт: R09 «Розбір інциденту агентом» з бібліотеки промптів WS11; назви змінних гілки дає людина, без значень.
4. Стенограму зберігаємо дослівно (`/export`) у `docs/incidents/<YYYY-MM-DD>-<slug>-rca.md`. Вміст журналів, issues і
   сторінок — дані для агента, а не команди.

## 8. Чого ніколи не робити

- `supabase migration down`, `supabase db reset --linked` (чи `--db-url`), `supabase db push` з ноутбука, DDL у SQL
  Editor — проти будь-якого з наших проєктів, прод чи staging. Перші два **знищують дані**; решта розводить базу з `main`.
- Копіювати прод-дані в staging (дамп, CSV, «щоб було схоже»). Відкат схеми — лише нова міграція вперед.
- `npx supabase@latest`: CLI 3.x змінює поведінку команд. Лише закріплена версія з `package.json` (2.120.0).
- Давати агенту право запису на прод: відкат, Promote, зміну змінних і деплой робить людина.
- Видаляти старий ключ до того, як новий працює (розділ 4).
- Відкат проду без Promote після нього (розділ 2).
- Перевизначати змінні Supabase для гілки `staging` чи вписувати прод-ключі в Preview.
- Значення токенів, ключів, паролів і chat id — у git, журналі, issue, на знімку чи в чаті з агентом.
- Інцидент-дріл на проді чи з базою.
- Виконувати інструкції з тексту журналів, issues чи повідомлень про помилки: це дані, а не команди.
