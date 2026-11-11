# Дизайн-система: Property workflows

- **Джерело:** спершу AI-чат (Claude Code за шаблоном `materials/DESIGN.template.md` курсу), потім оновлення WS9:
  прототип у Claude Design (приватне полотно з артбордами для екранів, телефону й обох тем), п'ять палітр і їхній
  контраст — окремий розрахунок за формулою WCAG 2.x з OKLCH; обрано «Lagoon» (ADR 0007). Далі UI v2: рецензія
  окремого субагента, полотно Claude Design «Property workflows UI v2», три палітри поруч — обрано «Graphite & Teal»,
  бічна панель, меню «Theme» у правому верхньому куті, вхід без кольорової шапки (ADR 0008).
- **Вхід від PM:** розділ «Вигляд і тон» у `requirements/product.md` (знімок 2026-11-01) і вимога «Use one design
  system across the application» (`requirements/19-use-one-design-system.md`, AC-DSYS-01…08).
- **Код:** токени — `src/app/globals.css`; компоненти — `src/components/ui/` (shadcn/ui); перевірка — `npm run check:design`

## 1. Огляд

Внутрішній застосунок агенції з управління нерухомістю: менеджер і адміністратор запускають процеси за шаблонами й
стежать за прогресом, вендор працює лише зі своїми задачами. Працюють переважно за робочим столом, але списки й задачі
мають зручно читатися й на телефоні. Тон — **спокійний, діловий, точний**: без жартів, знаків оклику, звинувачень
(«You made a mistake») і жаргону. Вигляд — **спокійний, з одним акцентом**: нейтральна графітова оболонка (бічна панель),
світле тло, заокруглені картки, короткі ефекти наведення; колір мають лише головна дія й статуси (ADR 0008). Щільність важливіша за простір: менеджер переглядає багато запусків
одразу. Мова інтерфейсу — англійська; тексти з AC PM — дослівно.

- Одна головна дія на екран (Launch, Save) — лише вона `primary`; акцентний колір більше ніде не вживаємо (кільце
  фокусу й поточний пункт навігації — нейтральні).
- Статус завжди видно **словом** поруч із кольором: «to do», «in progress», «done», «completed», «Unpublished changes».
- Лише токени: жодних hex, `bg-[#…]`, сирих палітр (`zinc-500`, `bg-white`) і кольорів в inline style.
- Рух короткий і лише за змістом (поява сторінки, наведення, «вистрибування» done); `prefers-reduced-motion` вимикає його.

## 2. Кольори

Семантичні токени з іменами shadcn/ui плюс токени шапки, прогресу й статусів домену. Значення — OKLCH. У сторінках —
лише утиліти з колонки «Клас». Тема — за вибором «Theme» у спільному макеті: System (типово, за пристроєм), Light або
Dark. Вибір запам'ятовується на пристрої в cookie `theme`, а `data-theme` на `<html>` ставить сервер (ADR 0004;
AC-DSYS-05, AC-DSYS-06). Темні значення — у двох однакових блоках `globals.css`: системна темна тема (якщо не обрано
Light) і обрана Dark. Статуси в обох темах мають ті самі слова й кольори за змістом, контраст ≥ 4.5 (AC-DSYS-07).

Палітра **Graphite & Teal** (ADR 0008): нейтральна графітова оболонка (hue 230, хрома ≤ 0.015) — тло, картки, бічна
панель; колір мають лише головна дія (бірюзова, hue 200 / 198) і статуси, тож статуси «звучать» найчистіше. Акцент
відстоїть від статусів — синього (250°), зеленого (150°), жовтого (85°), червоного (27°) — щонайменше на 45°, тож
головну дію не сплутати зі статусом.

| Токен | Для чого | Світла | Темна | Клас |
|---|---|---|---|---|
| `background` / `foreground` | тло сторінки й основний текст | `oklch(0.975 0.004 230)` / `oklch(0.21 0.015 230)` | `oklch(0.18 0.008 230)` / `oklch(0.95 0.005 230)` | `bg-background`, `text-foreground` |
| `card` / `card-foreground` | картки, панелі, таблиці, поля | `oklch(1 0 0)` / `oklch(0.21 0.015 230)` | `oklch(0.225 0.01 230)` / `oklch(0.95 0.005 230)` | `bg-card`, `text-card-foreground` |
| `popover` / `popover-foreground` | меню, випадні списки | як `card` | як `card` | `bg-popover`, `text-popover-foreground` |
| `primary` / `primary-hover` / `primary-foreground` | **одна** головна дія екрана (Launch, Save) | `oklch(0.5 0.085 200)` / `oklch(0.44 0.08 200)` / `oklch(0.985 0.008 200)` | `oklch(0.78 0.12 198)` / `oklch(0.83 0.12 198)` / `oklch(0.2 0.03 200)` | `bg-primary`, `hover:bg-primary-hover`, `text-primary-foreground` |
| `secondary` / `muted` | приглушене тло, заголовок таблиці | `oklch(0.955 0.005 230)` | `oklch(0.16 0.008 230)` | `bg-secondary`, `bg-muted` |
| `muted-foreground` | підписи, допоміжний текст | `oklch(0.45 0.015 230)` | `oklch(0.76 0.012 230)` | `text-muted-foreground` |
| `accent` / `glow` | наведення на рядок і кнопку / м'яка підсвітка | `oklch(0.945 0.006 230)` / `oklch(0.96 0.005 230)` | `oklch(0.27 0.012 230)` / `oklch(0.25 0.02 230)` | `bg-accent`, `bg-glow`, `ring-glow` |
| `destructive` / `-foreground` | небезпечна чи незворотна дія; текст помилки | `oklch(0.5 0.2 27)` / `oklch(0.99 0.004 27)` | `oklch(0.72 0.17 25)` / `oklch(0.17 0.03 27)` | `bg-destructive`, `text-destructive`, `text-destructive-foreground` |
| `destructive-surface` / `-border` | тло й межа повідомлення про помилку | `oklch(0.95 0.023 27)` / `oklch(0.8 0.1 27)` | `oklch(0.3 0.085 27)` / `oklch(0.46 0.13 27)` | `bg-destructive-surface`, `border-destructive-border` |
| `border` | розділювачі, межі карток і таблиць | `oklch(0.91 0.006 230)` | `oklch(0.32 0.012 230)` | `border-border` |
| `input` | межа поля вводу | `oklch(0.62 0.012 230)` | `oklch(0.58 0.015 230)` | `border-input` |
| `ring` | кільце фокусу (нейтральне, колір тексту) | `oklch(0.21 0.015 230)` | `oklch(0.95 0.005 230)` | `ring-ring` |
| `hero`, `hero-hover`, `hero-foreground`, `hero-muted`, `hero-border` | графітова оболонка: бічна панель, верхня смуга телефону, панель входу | `oklch(0.25 0.012 230)`, `oklch(0.31 0.014 230)`, `oklch(0.97 0.005 230)`, `oklch(0.8 0.012 230)`, `oklch(0.37 0.014 230)` | `oklch(0.155 0.008 230)`, `oklch(0.21 0.01 230)`, `oklch(0.97 0.005 230)`, `oklch(0.8 0.012 230)`, `oklch(0.27 0.012 230)` | `bg-hero`, `text-hero-foreground`, `text-hero-muted`, `border-hero-border` |
| `hero-progress`, `hero-done` | кільце на панелі входу | `oklch(0.915 0.041 250)`, `oklch(0.915 0.08 150)` | `oklch(0.87 0.066 250)`, `oklch(0.87 0.11 150)` | (лише CSS `auth-*`) |
| `fill-progress` / `fill-done` | заповнення смужки прогресу | `oklch(0.54 0.162 252)` / `oklch(0.5 0.138 150)` | `oklch(0.72 0.15 250)` / `oklch(0.74 0.17 150)` | `bg-fill-progress`, `bg-fill-done` |
| `shade` | колір тіней карток і кнопок | `oklch(0.2 0.02 230 / 0.08)` | `oklch(0.05 0.01 230 / 0.55)` | `shadow-card`, `shadow-press` |
| `status-todo` / `-foreground` | задача «to do» — нейтральний сірий | `oklch(0.93 0.008 255)` / `oklch(0.36 0.015 255)` | `oklch(0.33 0.012 255)` / `oklch(0.88 0.012 255)` | `bg-status-todo`, `text-status-todo-foreground` |
| `status-in-progress` / `-foreground` | запуск «in progress» — синій | `oklch(0.915 0.041 250)` / `oklch(0.38 0.126 255)` | `oklch(0.33 0.09 250)` / `oklch(0.87 0.066 250)` | `bg-status-in-progress`, `text-status-in-progress-foreground` |
| `status-done` / `-foreground` | задача «done», запуск «completed» — зелений | `oklch(0.915 0.08 150)` / `oklch(0.37 0.1 150)` | `oklch(0.32 0.075 150)` / `oklch(0.87 0.11 150)` | `bg-status-done`, `text-status-done-foreground` |
| `status-unpublished` / `-foreground` | «Unpublished changes» — теплий жовтий | `oklch(0.94 0.075 90)` / `oklch(0.4 0.086 70)` | `oklch(0.34 0.069 85)` / `oklch(0.9 0.12 90)` | `bg-status-unpublished`, `text-status-unpublished-foreground` |

Помилки — `destructive` (червоний), як у «Вигляд і тон».

### Контраст

Виміряно за WCAG 2.x (OKLCH → sRGB → відносна яскравість; значення в межах гами sRGB). Текст ≥ 4.5:1, основний ≥ 7:1,
межі полів і фокус ≥ 3:1. Темні значення статусів додатково перевіряє `tests/design/status-dark-contrast.test.ts`.

| Пара | Світла | Темна | Норма |
|---|---|---|---|
| `foreground` на `background` | 16.5 | 16.3 | ≥ 7 |
| `foreground` на `card` | 17.7 | 14.8 | ≥ 7 |
| `muted-foreground` на `background` | 6.9 | 8.8 | ≥ 4.5 |
| `muted-foreground` на `card` | 7.4 | 8.0 | ≥ 4.5 |
| `muted-foreground` на `muted` | 6.5 | 9.1 | ≥ 4.5 |
| `muted-foreground` на `accent` | 6.3 | 7.0 | ≥ 4.5 |
| `primary-foreground` на `primary` | 5.5 | 9.4 | ≥ 4.5 |
| `primary-foreground` на `primary-hover` | 7.1 | 11.1 | ≥ 4.5 |
| `primary` на `card` | 5.8 | 8.9 | ≥ 3 |
| `destructive` на `card` | 6.7 | 6.4 | ≥ 4.5 |
| `destructive` на `destructive-surface` | 5.7 | 5.3 | ≥ 4.5 |
| `destructive-foreground` на `destructive` | 6.5 | 7.2 | ≥ 4.5 |
| `status-todo-foreground` на `status-todo` | 8.8 | 8.5 | ≥ 4.5 |
| `status-in-progress-foreground` на `status-in-progress` | 7.9 | 8.3 | ≥ 4.5 |
| `status-done-foreground` на `status-done` | 8.0 | 8.6 | ≥ 4.5 |
| `status-unpublished-foreground` на `status-unpublished` | 7.9 | 8.8 | ≥ 4.5 |
| `fill-progress` на `border` | 3.9 | 5.1 | ≥ 3 |
| `fill-done` на `border` | 4.3 | 5.9 | ≥ 3 |
| `input` на `card` | 3.6 | 4.0 | ≥ 3 |
| `hero-foreground` на `hero` | 14.7 | 17.9 | ≥ 7 |
| `hero-muted` на `hero` | 8.6 | 10.5 | ≥ 4.5 |
| `hero-foreground` на `hero-hover` | 12.0 | 16.2 | ≥ 4.5 |
| `hero-muted` на `hero-hover` | 7.0 | 9.5 | ≥ 4.5 |
| `hero-progress` на `hero` | 12.4 | 13.2 | ≥ 3 |
| `hero-done` на `hero` | 12.8 | 13.7 | ≥ 3 |
| `foreground` на `accent` | 15.1 | 13.0 | ≥ 4.5 |

## 3. Типографіка

Шрифт — IBM Plex Sans (`next/font/google`, 400/500/600, `--font-plex-sans`). «Small grey text» PM не годиться:
допоміжний текст не менший за `text-sm` і лише `text-muted-foreground` (контраст ≥ 6:1). Числа прогресу й дати —
`tabular-nums`. Дати й час — за Києвом, `DD.MM.YYYY HH:MM`. Бейдж статусу — 13 px, слово завжди поруч із кольором.

| Роль | Клас | Де |
|---|---|---|
| Заголовок сторінки | `text-2xl font-semibold` | один на сторінку |
| Заголовок розділу | `text-base font-semibold` | секції запуску й шаблону |
| Основний текст | `text-sm` | таблиці, форми, списки задач |
| Підпис, допоміжний текст | `text-sm text-muted-foreground` | назва шаблону під назвою випадку, мітки полів деталей |

## 4. Відступи й радіуси

- Ширина контенту — `max-w-5xl mx-auto px-4 sm:px-6`, вертикальний ритм сторінки — `py-6 sm:py-10`, між блоками —
  `gap-6`, усередині форми — `gap-4`, між міткою й полем — `gap-2`. Сторінка входу — сітка: панель ліворуч (від `lg`),
  картка форми праворуч.
- **Таблиці щільні:** рядок `py-2.5` (≈ 40 px), текст `text-sm`; заголовок — на тлі `muted`, `font-semibold`. На
  телефоні заголовок ховається, рядок — картка (сітка з двох колонок): назва (з шаблоном під нею) і статус зверху,
  прогрес на всю ширину нижче; колонка Template ховається (`hidden sm:table-cell` + підпис у першій клітинці).
- **Цілі дотику ≥ 44 px на телефоні:** кнопки й поля `h-11 sm:h-10`, малі кнопки `h-11 sm:h-8`, позначки вибору
  «Theme» ≈ 44 px, нижні вкладки навігації — 56 px. Основна кнопка на телефоні — на всю ширину.
- Радіус — `--radius: 0.625rem` (10 px): контроли `rounded-lg`, картки й таблиці `rounded-xl` (14 px), бейджі й позначки
  теми — `rounded-full`. Тіні — `shadow-card` (картки), `shadow-press` (головна кнопка).

## 5. Компоненти й варіанти

Лише з `@/components/ui`. Нові компоненти — `npx shadcn@4.22.1 add <назва>`; власні кольори в компонентах не
вигадуємо — лише токени.

| Компонент | Варіанти | Правило |
|---|---|---|
| `Button` | `default`, `secondary`, `outline`, `ghost`, `destructive`, `link` | `default` (primary) — **одна** головна дія на екран; текст кнопки починається з дієслова («Launch», «Save»); `destructive` — суцільна червона, лише з підтвердженням «This cannot be undone»; другорядні дії в рядках (Move up, Remove) — `ghost` `sm`; наведення піднімає кнопку на 1 px |
| `Input` + `Label` | — | у кожного поля `Label` з `htmlFor`; placeholder — не замість підпису; фокус — межа кольору тексту й підсвітка `ring-glow` |
| `NativeSelect` | — | вибір шаблону й виконавця в серверних формах (нативний `<select>` працює без JavaScript); з `Label`. Клієнтського `Select` (Base UI) поки немає: знадобиться — `npx shadcn@4.22.1 add select`, лише в клієнтських компонентах |
| `TextLink` | — | текстові посилання («Back to runs», назва випадку в таблиці): колір `foreground`, приглушене підкреслення — **не** `primary` |
| `Card` | — | панель деталей запуску, форма входу, секції редактора |
| `Table` | — | списки запусків і шаблонів; контейнер — картка з тінню; щільні рядки (розділ 4) |
| `StatusBadge` | статуси домену | статус — **завжди з текстом**; колір і слово бере з однієї мапи статусів (`src/components/ui/status-badge.tsx`) (AC-DSYS-01); «пігулка» з крапкою; done/completed «вистрибує» один раз |
| `ProgressBar` | — | смужка поряд із текстом «N of M done» (текст лишається); синя, поки йде, зелена, коли все виконано; для читачів екрана прихована |
| Підтвердження на місці | — | незворотна дія підтверджується в тому самому рядку, без спливаючого вікна: назва задачі чи розділу + «This cannot be undone», кнопка `destructive` і «Cancel» (`mark-done-button.tsx`, `remove-section-button.tsx`) |
| `Alert` | `default`, `destructive` | помилка над формою на тлі `destructive-surface`; текст — дослівно з AC; введене лишається у формі |
| `PageShell` + `MainNav` | — | спільний макет у `src/app/layout.tsx` (ADR 0008): увійшов — від `lg` графітова бічна панель (логотип, навігація Templates · Runs · Profile з іконкою й словом, поточний — фон і `aria-current`, внизу email і роль), на телефоні — графітова смуга з логотипом і «Theme» та нижні вкладки; один `<nav aria-label="Main">`, пункти за роллю (`navItems`, AC-VENDOR-13). Вхід — той самий макет без навігації: великий логотип і «Theme» на тлі сторінки (AC-DSYS-02, AC-DSYS-03) |
| `ThemeSwitch` | System · Light · Dark | меню в правому верхньому куті кожної сторінки (ADR 0008): закрите показує «Theme» і поточне значення (AC-DSYS-05/06), відкрите — три нативні радіокнопки з іконкою, словом і галочкою; `<details>`/`<summary>`, Escape і клік поза меню закривають; на графітовій смузі телефону напис «Theme» прихований візуально |
| `BrandMark` | `page`, `hero` | логотип: плитка зі «сходинками» і зеленою крапкою («done»); сходинки прокреслюються один раз, при наведенні чи фокусі посилання крапка стрибає сходинками вгору (CSS `brand-*`, вимикається `prefers-reduced-motion`) |
| `Notice` | — | відмова чи «не знайдено»: повідомлення заголовком + `TextLink` назад, жодних даних («Not enough rights», «Template not found», «Run not found») |
| `EmptyState` | — | порожній список: малюнок-сходинки (декоративний), повідомлення `text-muted-foreground` + посилання на наступну дію, без порожньої таблиці (AC-DSYS-04) |
| `Skeleton` | — | заглушка в `loading.tsx` на час завантаження сторінки: форма майбутнього вмісту, без видимих слів; `<main aria-busy>` разом із прихованим `role="status"` «Loading…» поруч (не всередині `main`: окрема live-region озвучується надійніше) |
| `AuthHero` | — | декоративна панель входу: кільце процесу заповнюється «to do» → «in progress» → «completed»; слова задає CSS, у тексті сторінки їх немає; від `lg`; рух можна зупинити кнопкою «Pause animation» (WCAG 2.2.2) |

## 6. Стани

| Стан | Як виглядає | Приклад тексту |
|---|---|---|
| Порожній список | малюнок, `text-muted-foreground` + посилання на наступну дію; **без порожньої таблиці** | «No runs yet. Launch a template to start one.» + «Launch a template» (AC-DSYS-04) |
| Помилка дії | `Alert variant="destructive"` над формою; введене лишається | «Enter a case name» (AC-RUN-03), «A template needs at least one required task» (AC-EDITOR-04) |
| Відмова в доступі | той самий макет сторінки, повідомлення й посилання назад, без даних | «Not enough rights» + «Back to templates» (AC-DSYS-02, AC-EDITOR-07) |
| Не знайдено | той самий макет, без даних | «Run not found» (AC-TASK-10) |
| Не увійшов | сторінка входу в тому самому макеті | (AC-DSYS-03, AC-EDITOR-09) |
| Незбережені зміни | `StatusBadge` «Unpublished changes» (теплий жовтий); у редакторі рядок із «Save» липне до верху | «Unpublished changes» (AC-EDITOR-01) |
| Успіх | короткий текст біля дії, без спливаючих вікон | «Version 2 saved» |
| Вимкнена дія | `disabled` + пояснення поруч словами | — |
| Завантаження (відправлення) | кнопка `disabled`, текст дії не змінюємо | — |
| Завантаження (сторінка) | `loading.tsx` із `Skeleton` для запусків, форми запуску й шаблонів, `aria-busy`, без видимих слів | — |
| Зміна назви | кнопка «Rename» з'являється, лише поки поле у фокусі; Enter теж зберігає | — |

## 7. Доступність — мінімум

- Label у кожного поля; помилка поля пов'язана з полем (`aria-describedby`).
- Видимий фокус: нейтральне кільце `ring` (колір тексту, 2 px із відступом) на кожному інтерактивному елементі; Tab
  проходить форму по порядку; усе працює з клавіатури; вибір «Theme» — радіокнопки (стрілки).
- Контраст — таблиця в розділі 2.
- Статус ніколи не лише кольором — поруч завжди текст.
- Іконки й малюнки — декоративні (`aria-hidden`) або з текстовим підписом.
- Спершу семантичний HTML (`<button>`, `<table>`, `<label>`); `aria-*` — там, де HTML бракує, а не замість нього.
- `prefers-reduced-motion`: анімації й переходи вимкнено, кільце входу стоїть заповненим.

## 8. Do / Don't

| ✅ Робимо | ❌ Не робимо |
|---|---|
| `bg-primary text-primary-foreground` | `bg-zinc-900 text-white`, `bg-[#0f6b6e]`, `style={{ color: "#…" }}` |
| компонент `Button` з потрібним варіантом | власний `<button className="…">` у сторінці |
| `StatusBadge status="in progress"` | статус кольором без слова; різні слова для одного статусу на різних сторінках |
| посилання — `TextLink` (колір тексту), акцент — лише головна дія | `text-primary` на посиланнях чи в навігації: головна дія губиться |
| новий токен через розділ 9 | новий колір «лише для цієї сторінки» |
| тексти повідомлень дослівно з AC | «Oops!», знаки оклику, «You made a mistake» |
| повідомлення на сторінці, на тому самому місці | спливаючі вікна для звичайної інформації; різнокольорові градієнти; декоративна анімація поза входом |

## 9. Як додати токен

1. Опишіть токен у таблиці розділу 2: для чого, значення в обох темах, контраст.
2. `src/app/globals.css`: `--<назва>` у `:root` і в обох темних блоках — `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) }`
   і `:root[data-theme="dark"]` (однакові значення; ADR 0004; буквальні `oklch(L C H)`, без `light-dark()`).
3. `--color-<назва>: var(--<назва>);` у `@theme inline` → з'являються класи `bg-<назва>`, `text-<назва>`, `border-<назва>`.
4. `npm run check:design` і знімок сторінки у світлій і темній темі.

## 10. Перевірка

- `npm run check:design` — жодного hex, довільного кольору, сирої палітри чи кольору в inline style поза
  `src/components/ui` і `globals.css`. CI: `.github/workflows/architecture.yml`, job «Дизайн-система: лише токени».
- Виняток — коментар `design-ok: <причина>` у тому самому рядку; кожен виняток — з реальною причиною.
- Візуально: знімки ключових сторінок у світлій і темній темі на 390 і 1280 px (зберігаємо в `docs/img/`), Tab по
  формі, контраст.
- Вибір теми (ADR 0004, ADR 0007): знімки в трьох режимах — `docs/img/ws8-theme-system-dark-device.png` (System на
  темному пристрої), `docs/img/ws8-theme-light-on-dark-device.png` (Light переважає темний пристрій),
  `docs/img/ws8-theme-dark-on-light-device.png` (Dark переважає світлий пристрій) — зроблені до оновлення вигляду.
