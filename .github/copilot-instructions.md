# Copilot instructions — danske-padelmodities

Read this before changing code. It captures the conventions this Angular + Firebase
padel app follows so changes stay consistent. Keep edits minimal and in-style.

## Stack

- **Angular** standalone components (no NgModules), signal-based reactivity.
- **Firebase Realtime Database** via the `firebase/database` modular SDK.
- **RxJS** only for the `watch*` streams that bridge Firebase `onValue` to the UI.
- **TypeScript** in strict mode.

## TypeScript style

- Use `Array<T>` / `ReadonlyArray<T>`, never `T[]`.
- No `any`. No non-null assertions (`!`) — narrow with a local `const` + guard, or use `?? fallback`.
- `const` by default; `let` only when the variable is reassigned.
- `import type { ... }` for type-only imports; `export type` for type-only re-exports.
- Give public functions/methods explicit return types.

## Angular style

- Inject dependencies with `inject()`, not constructor params.
- Mark injected dependencies `readonly`.
- **Private fields** use the `#` prefix (`readonly #service = inject(...)`).
  **Private methods** stay `private` (the `#` rule is for fields only).
- State is signals: `signal()`, `computed()`, `effect()`. Expose `readonly` signals; mutate via `.set()` / `.update()`.
- Public members referenced from a template must stay accessible (don't make them `#`).

### Two `#` exceptions (will not compile otherwise)

- `viewChild()` / `viewChildren()` fields must be `private readonly`, not `#` (`TS: Cannot use "viewChild" on a class member that is declared as ES private`).
- A `static` field on a class with a decorator (`@Component`, `@Directive`) must be `private static readonly`, not `static #field` (TS18036).

## Data layer

- Get the DB with `inject(FIREBASE_DB)` (the token in `src/app/core/firebase.ts`). Never call `getDatabase()` elsewhere.
- Real-time reads return an `Observable` from a `watch*` method and are consumed with `takeUntilDestroyed(this.#destroyRef)`.
- Writes are `async` methods using `ref` / `set` / `update` / `push` / `remove`.
- `push(...).key` / `ref.key` can be `null` — coalesce (`?? ""`) instead of asserting.
- Tournament scheduling/scoring logic lives in `src/app/services/tournament-engine.ts` as **pure functions**. Keep it side-effect free and Firebase-free; services call into it.

## User-facing text

- All strings go through `I18nService.t('some.key', params)` — never hardcode Danish/English in components.
- Errors thrown for the UI use i18n keys as the message (e.g. `throw new Error('err.roundNotFound')`), which callers pass to `t()`.

## Project layout

- `pages/` — routed feature components. `components/` — shared UI. `services/` — state + Firebase + engine.
- `models/padel.model.ts` — shared types and format helpers (`isTeamFormat`, `isDynamicFormat`, `isTwoPhase`, etc.). Reuse these instead of re-deriving format logic.

## When editing

- Match the existing quote/format style already in the file.
- Don't add comments that restate the code; a comment should explain *why*, in one line.
- Don't create docs/markdown to describe your change unless asked.
