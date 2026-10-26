# Дизайн-система: Property workflows

- **Джерело:** AI-чат: Claude Code (Claude Opus 5.5) за шаблоном `materials/DESIGN.template.md` курсу; промпт і рішення
  розробника (акцент, радіус, щільність) — в описі PR дизайн-системи. Контраст пораховано скриптом за формулою WCAG 2.x
  з OKLCH (таблиця в розділі 2).
- **Вхід від PM:** розділ «Вигляд і тон» у `requirements/product.md` (знімок 2026-10-25) і вимога «Use one design
  system across the application» (`requirements/19-use-one-design-system.md`, AC-DSYS-01…04).
- **Код:** токени — `src/app/globals.css`; компоненти — `src/components/ui/` (shadcn/ui); перевірка — `npm run check:design`

## 1. Огляд

Внутрішній застосунок агенції з управління нерухомістю: менеджер і адміністратор запускають процеси за шаблонами й
стежать за прогресом. Працюють переважно за робочим столом, але списки мають читатися й на телефоні. Тон — **спокійний,
діловий, точний**: без жартів, знаків оклику, звинувачень («You made a mistake») і жаргону. Щільність важливіша за
простір: менеджер переглядає багато запусків одразу. Мова інтерфейсу — англійська; тексти з AC PM — дослівно.

- Одна головна дія на екран (Launch, Save) — лише вона `primary`; акцентний колір більше ніде не вживаємо.
- Статус завжди видно **словом** поруч із кольором: «to do», «in progress», «done», «completed», «Unpublished changes».
- Лише токени: жодних hex, `bg-[#…]`, сирих палітр (`zinc-500`, `bg-white`) і кольорів в inline style.

## 2. Кольори

Семантичні токени з іменами shadcn/ui плюс статуси домену. Значення — OKLCH. У сторінках — лише утиліти з колонки
«Клас». Темна тема — за системою (`@media (prefers-color-scheme: dark)`); PM виніс темну тему за межі приймання
(`requirements/19-use-one-design-system.md`, «Поза межами»), але ті самі слова й кольори за змістом діють і в ній.

Акцент — фіолетовий (hue 292): він не збігається з жодним кольором статусу (синій, зелений, жовтий, червоний), тож
головну дію не сплутати зі статусом.

| Токен | Для чого | Світла | Темна | Клас |
|---|---|---|---|---|
| `background` / `foreground` | тло сторінки й основний текст | `oklch(0.985 0.002 285)` / `oklch(0.21 0.01 285)` | `oklch(0.17 0.01 285)` / `oklch(0.96 0.003 285)` | `bg-background`, `text-foreground` |
| `card` / `card-foreground` | картки, панелі, таблиці | `oklch(1 0 0)` / `oklch(0.21 0.01 285)` | `oklch(0.21 0.012 285)` / `oklch(0.96 0.003 285)` | `bg-card`, `text-card-foreground` |
| `popover` / `popover-foreground` | меню, діалоги, випадні списки | як `card` | як `card` | `bg-popover`, `text-popover-foreground` |
| `primary` / `primary-foreground` | **одна** головна дія екрана (Launch, Save) | `oklch(0.49 0.2 292)` / `oklch(0.985 0.002 285)` | `oklch(0.72 0.15 292)` / `oklch(0.17 0.02 292)` | `bg-primary`, `text-primary-foreground` |
| `secondary` / `secondary-foreground` | другорядна дія | `oklch(0.955 0.006 285)` / `oklch(0.25 0.01 285)` | `oklch(0.27 0.012 285)` / `oklch(0.96 0.003 285)` | `bg-secondary`, `text-secondary-foreground` |
| `muted` / `muted-foreground` | приглушене тло; підписи, допоміжний текст | `oklch(0.955 0.006 285)` / `oklch(0.47 0.015 285)` | `oklch(0.27 0.012 285)` / `oklch(0.73 0.012 285)` | `bg-muted`, `text-muted-foreground` |
| `accent` / `accent-foreground` | наведення, вибраний рядок | `oklch(0.95 0.012 292)` / `oklch(0.21 0.01 285)` | `oklch(0.29 0.03 292)` / `oklch(0.96 0.003 285)` | `bg-accent`, `text-accent-foreground` |
| `destructive` / `destructive-foreground` | небезпечна чи незворотна дія; текст помилки | `oklch(0.52 0.2 27)` / `oklch(0.985 0.002 285)` | `oklch(0.7 0.17 25)` / `oklch(0.17 0.01 285)` | `bg-destructive`, `text-destructive`, `text-destructive-foreground` |
| `border` | розділювачі, межі карток і таблиць | `oklch(0.9 0.006 285)` | `oklch(0.32 0.012 285)` | `border-border` |
| `input` | межа поля вводу | `oklch(0.62 0.015 285)` | `oklch(0.52 0.015 285)` | `border-input` |
| `ring` | кільце фокусу | `oklch(0.49 0.2 292)` | `oklch(0.72 0.15 292)` | `ring-ring` |
| `status-todo` / `-foreground` | задача «to do» — нейтральний сірий | `oklch(0.94 0.005 285)` / `oklch(0.37 0.01 285)` | `oklch(0.3 0.01 285)` / `oklch(0.86 0.01 285)` | `bg-status-todo`, `text-status-todo-foreground` |
| `status-in-progress` / `-foreground` | запуск «in progress» — синій | `oklch(0.93 0.045 250)` / `oklch(0.42 0.14 255)` | `oklch(0.3 0.07 255)` / `oklch(0.86 0.08 250)` | `bg-status-in-progress`, `text-status-in-progress-foreground` |
| `status-done` / `-foreground` | задача «done», запуск «completed» — зелений | `oklch(0.93 0.05 150)` / `oklch(0.4 0.11 150)` | `oklch(0.3 0.06 150)` / `oklch(0.86 0.09 150)` | `bg-status-done`, `text-status-done-foreground` |
| `status-unpublished` / `-foreground` | «Unpublished changes» — теплий жовтий | `oklch(0.94 0.07 85)` / `oklch(0.42 0.09 70)` | `oklch(0.32 0.06 80)` / `oklch(0.89 0.1 90)` | `bg-status-unpublished`, `text-status-unpublished-foreground` |

Помилки — `destructive` (червоний), як у «Вигляд і тон».

### Контраст

Пораховано за WCAG 2.x (OKLCH → sRGB → відносна яскравість). Текст ≥ 4.5:1, межі полів і фокус ≥ 3:1.

| Пара | Світла | Темна | Норма |
|---|---|---|---|
| `foreground` на `background` | 17.0 | 17.0 | ≥ 4.5 |
| `muted-foreground` на `background` | 6.6 | 8.0 | ≥ 4.5 |
| `muted-foreground` на `card` | 6.8 | 7.4 | ≥ 4.5 |
| `muted-foreground` на `muted` | 6.0 | 6.3 | ≥ 4.5 |
| `primary-foreground` на `primary` | 6.6 | 7.4 | ≥ 4.5 |
| `secondary-foreground` на `secondary` | 14.0 | 13.4 | ≥ 4.5 |
| `accent-foreground` на `accent` | 15.3 | 12.7 | ≥ 4.5 |
| `destructive` на `card` | 6.1 | 6.2 | ≥ 4.5 |
| `destructive-foreground` на `destructive` | 5.9 | 6.6 | ≥ 4.5 |
| `status-todo-foreground` на `status-todo` | 8.8 | 8.9 | ≥ 4.5 |
| `status-in-progress-foreground` на `status-in-progress` | 7.0 | 8.9 | ≥ 4.5 |
| `status-done-foreground` на `status-done` | 7.3 | 9.0 | ≥ 4.5 |
| `status-unpublished-foreground` на `status-unpublished` | 7.2 | 9.2 | ≥ 4.5 |
| `input` на `card` | 3.7 | 3.2 | ≥ 3 |
| `input` на `background` | 3.5 | 3.5 | ≥ 3 |
| `ring` на `background` | 6.6 | 7.4 | ≥ 3 |
| `ring` на `card` | 6.9 | 6.8 | ≥ 3 |

## 3. Типографіка

Шрифт — Geist (`next/font`, `--font-sans`). «Small grey text» PM не годиться: допоміжний текст не менший за `text-sm`
і лише `text-muted-foreground` (контраст ≥ 6:1). Числа прогресу й дати — `tabular-nums`. Дати й час — за Києвом,
`DD.MM.YYYY HH:MM`.

| Роль | Клас | Де |
|---|---|---|
| Заголовок сторінки | `text-2xl font-semibold` | один на сторінку |
| Заголовок розділу | `text-base font-semibold` | секції запуску й шаблону |
| Основний текст | `text-sm` | таблиці, форми, списки задач |
| Підпис, допоміжний текст | `text-sm text-muted-foreground` | назва шаблону під назвою випадку, мітки полів деталей |

## 4. Відступи й радіуси

- Ширина контенту — `max-w-3xl mx-auto px-4`, вертикальний ритм сторінки — `py-10`, між блоками — `gap-6`, усередині
  форми — `gap-4`, між міткою й полем — `gap-2`.
- **Таблиці щільні:** рядок `py-2` (≈ 36 px), текст `text-sm`. На вузькому екрані першими йдуть назва випадку, статус
  і прогрес; другорядні колонки (Template) переходять під назву випадку (`hidden sm:table-cell` + підпис у першій
  колонці).
- Радіус — `--radius: 0.375rem` (малий, діловий); похідні `rounded-sm`/`rounded-md`/`rounded-lg` — з `@theme inline`.

## 5. Компоненти й варіанти

Лише з `@/components/ui`. Нові компоненти — `npx shadcn@4.22.1 add <назва>`; власні кольори в компонентах не
вигадуємо — лише токени.

| Компонент | Варіанти | Правило |
|---|---|---|
| `Button` | `default`, `secondary`, `outline`, `ghost`, `destructive`, `link` | `default` (primary) — **одна** головна дія на екран; текст кнопки починається з дієслова («Launch», «Save»); `destructive` — лише з підтвердженням «This cannot be undone» |
| `Input` + `Label` | — | у кожного поля `Label` з `htmlFor`; placeholder — не замість підпису |
| `Select` | — | вибір шаблону й виконавця; з `Label` |
| `Card` | — | панель деталей запуску, форма входу |
| `Table` | — | списки запусків і шаблонів; щільні рядки (розділ 4) |
| `Badge` / `StatusBadge` | статуси домену | статус — **завжди з текстом**; колір і слово бере з однієї мапи статусів, щоб на всіх сторінках вони були однакові (AC-DSYS-01) |
| `Dialog` | — | підтвердження незворотної дії: назва задачі + «This cannot be undone» |
| `Alert` | `default`, `destructive` | помилка над формою; текст — дослівно з AC; введене лишається у формі |

## 6. Стани

| Стан | Як виглядає | Приклад тексту |
|---|---|---|
| Порожній список | `text-muted-foreground` + посилання на наступну дію; **без порожньої таблиці** | «No runs yet. Launch a template to start one.» + «Launch a template» (AC-DSYS-04) |
| Помилка дії | `Alert variant="destructive"` над формою; введене лишається | «Enter a case name» (AC-RUN-03), «A template needs at least one required task» (AC-EDITOR-04) |
| Відмова в доступі | той самий макет сторінки, повідомлення й посилання назад, без даних | «Not enough rights» + «Back to templates» (AC-DSYS-02, AC-EDITOR-07) |
| Не знайдено | той самий макет, без даних | «Run not found» (AC-TASK-10) |
| Не увійшов | сторінка входу в тому самому макеті | (AC-DSYS-03, AC-EDITOR-09) |
| Незбережені зміни | `StatusBadge` «Unpublished changes» (теплий жовтий) | «Unpublished changes» (AC-EDITOR-01) |
| Успіх | короткий текст біля дії, без спливаючих вікон | «Version 2 saved» |
| Вимкнена дія | `disabled` + пояснення поруч словами | — |
| Завантаження | кнопка `disabled` під час відправлення, текст дії не змінюємо | — |

## 7. Доступність — мінімум

- Label у кожного поля; помилка поля пов'язана з полем (`aria-describedby`).
- Видимий фокус: `ring` на кожному інтерактивному елементі; Tab проходить форму по порядку; усе працює з клавіатури.
- Контраст — таблиця в розділі 2.
- Статус ніколи не лише кольором — поруч завжди текст.
- Іконки — лише з текстовим підписом.
- Спершу семантичний HTML (`<button>`, `<table>`, `<label>`); `aria-*` — там, де HTML бракує, а не замість нього.

## 8. Do / Don't

| ✅ Робимо | ❌ Не робимо |
|---|---|
| `bg-primary text-primary-foreground` | `bg-zinc-900 text-white`, `bg-[#0f6b6e]`, `style={{ color: "#…" }}` |
| компонент `Button` з потрібним варіантом | власний `<button className="…">` у сторінці |
| `StatusBadge status="in progress"` | статус кольором без слова; різні слова для одного статусу на різних сторінках |
| новий токен через розділ 9 | новий колір «лише для цієї сторінки» |
| тексти повідомлень дослівно з AC | «Oops!», знаки оклику, «You made a mistake» |
| повідомлення на сторінці, на тому самому місці | спливаючі вікна для звичайної інформації; яскраві градієнти; декоративна анімація |

## 9. Як додати токен

1. Опишіть токен у таблиці розділу 2: для чого, значення в обох темах, контраст.
2. `src/app/globals.css`: `--<назва>` у `:root` і в `@media (prefers-color-scheme: dark)`.
3. `--color-<назва>: var(--<назва>);` у `@theme inline` → з'являються класи `bg-<назва>`, `text-<назва>`, `border-<назва>`.
4. `npm run check:design` і знімок сторінки у світлій і темній темі.

## 10. Перевірка

- `npm run check:design` — жодного hex, довільного кольору, сирої палітри чи кольору в inline style поза
  `src/components/ui` і `globals.css`. CI: `.github/workflows/architecture.yml`, job «Дизайн-система: лише токени».
- Виняток — коментар `design-ok: <причина>` у тому самому рядку; кожен виняток — з реальною причиною.
- Візуально: знімки ключових сторінок у світлій і темній темі (`docs/img/ws7-before-*`, `docs/img/ws7-after-*`),
  Tab по формі, контраст.
