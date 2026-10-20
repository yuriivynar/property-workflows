# 0001. Тести правил бази на PGlite

- Статус: прийнято
- Дата: 2026-10-20
- AC: AC-RUN-01, AC-RUN-02, AC-RUN-03, AC-RUN-04, AC-RUN-05, AC-RUN-06, AC-RUN-07, AC-RUN-08, AC-RUN-09, AC-TASK-01,
  AC-TASK-02, AC-TASK-03, AC-TASK-04, AC-TASK-05, AC-TASK-06, AC-TASK-07, AC-TASK-08, AC-TASK-09

## Контекст

Більшість правил зрізу виконує база, а не сторінка: хто може запускати шаблон і бути виконавцем, копія шаблону на
момент запуску, межі назви випадку, видимість запусків (RLS). Ці правила треба довести тестами з AC ID у `npm test`.
Docker на машині розробника не потрібен і не використовується (локальний `supabase start` недоступний), а міграції на
одноразовій базі CI лише застосовує (`db-check`), не перевіряючи поведінки.

## Рішення

- `@electric-sql/pglite@0.5.8` (devDependency) — справжній Postgres у WASM усередині Vitest.
- `tests/db/supabase-pglite.ts` — емуляція ролей Supabase (`anon`, `authenticated`, `service_role`, `auth.uid()`),
  застосування всіх `supabase/migrations/*.sql` і `supabase/seed.sql` у тому порядку, що й `db push`, користувачі з
  `supabase/demo-users.json`. Файл узято з демо-репозиторію курсу й скорочено, джерело — у шапці файлу й в описі PR:
  https://github.com/koldovsky/2026-quitcode-06-leave-portal-demo/blob/5a5fc27bbeac6d18c5d50603fd9a293434816257/tests/db/supabase-pglite.ts
- Кожен екземпляр PGlite закривається в `afterAll`: інакше паралельний `npm test` на машині з малою пам'яттю падав з
  out-of-memory (знахідка `/opsx:verify`).
- Тести `tests/db/*.test.ts` (`run-launch.test.ts` — AC-RUN-*, `run-progress.test.ts` — AC-TASK-*) викликають функції так, як їх викликає server action (`select public.launch_run(…)` від
  імені користувача), і перевіряють результат запитом в обхід RLS (`asService`).

## Розглянуті варіанти

- Лише доменні функції TypeScript — не перевіряють RLS, GRANT і функції бази, тобто саме те, що захищає дані від
  прямого запиту з публічним ключем.
- Тести проти хмарної бази — одна база для проду й preview, тести змінювали б дані й залежали б від мережі й секретів.
- `supabase start` у Docker — недоступний локально; у CI додав би кілька хвилин до кожного прогону.

## Наслідки

- Правила бази перевіряються за секунди без мережі; та сама міграція потім іде в `db-check` і `db-deploy`.
- Межа емуляції: Auth, PostgREST і JWT спрощені; вхід і налаштування хмарного проєкту перевіряємо вручну на preview.
- PGlite має одне з'єднання, тож справжні гонки двох транзакцій тут не відтворити (див. `design.md` плану,
  блокування рядка запуску).
