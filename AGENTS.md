# AGENTS.md

## Quick commands
- Install dependencies: `npm ci`
- Dev server: `npm start` (Angular dev server at `http://localhost:4200`)
- Build check: `npm run build` (uses production config by default)
- Dev build/watch: `npm run watch` (forces development config)
- Unit tests one-shot: `npm run test -- --watch=false`

## Verified test status
- `npm run test -- --watch=false` currently fails before running tests because multiple scaffold specs import missing symbols/files (for example `src/app/app.spec.ts`, `src/app/core/models/*.spec.ts`, `src/app/modules/policy/diagram-editor/diagram-editor.spec.ts`).
- `ng test --include ...` still compiles all spec files in this repo, so focused runs fail until broken specs are fixed.
- For non-test changes, `npm run build` is the reliable verification command.

## Runtime wiring (source of truth)
- App bootstrap is `src/main.ts` -> `src/app/app.component.ts` + providers in `src/app/app.config.ts`.
- Routing is wired through `AppRoutingModule` in `src/app/app-routing-module.ts` (imported in `app.config.ts`).
- HTTP interceptor is registered via `provideHttpClient(withInterceptors([jwtInterceptor]))` in `app.config.ts` — uses the **functional** interceptor at `src/app/core/interceptors/jwt-interceptor.ts`. The legacy class-based `jwt.interceptor.ts` is no longer registered.
- `src/app/app.routes.ts` and `src/app/modules/task/task.routes.ts` exist but are not used by runtime routing.

## Project map
- `src/app/core`: API wrapper (`api.service.ts`), auth (`auth.service.ts`), websocket, guards, interceptors.
- `src/app/modules`: feature areas (`auth`, `dashboard`, `policy`, `task`, `workflow`, `organization`, `analysis`).
- `src/app/shared/components/dynamic-form/dynamic-form.component.ts`: shared dynamic task form used by task detail flow.

## BPMN editor extensions
Location: `src/app/modules/policy/diagram-editor/bpmn-extensions/`

| File | Role |
|------|------|
| `index.ts` | Barrel — exports `customModule` and `customModdleDescriptor` |
| `custom-moddle.json` | Moddle extension defining `custom:forkJoinType` attribute on `bpmn:ParallelGateway` |
| `custom-palette.provider.ts` | Adds Fork/Join gateway entries to the bpmn-js palette |
| `custom-context-pad.provider.ts` | Context-pad actions to convert/toggle Fork ↔ Join on ParallelGateways |
| `custom-rules.ts` | Connection rules: enforces Fork (max 1 incoming) / Join (max 1 outgoing) constraints; **explicitly allows cross-lane connections** (returns `true` at priority 3000 when source and target have different parents) |

Wired in `DiagramEditorComponent` via:
```typescript
this.modeler = new BpmnModeler({
  additionalModules: [customModule],
  moddleExtensions: { custom: customModdleDescriptor }
});
```

## API contract (frontend perspective)
- Base URL: `environment.apiUrl` = `http://localhost:8080`
- **Users endpoint is `/users` — NOT `/api/users`**. Always call `GET /users` (optionally `?role=ROLE`).
- **Departments endpoint: `GET /api/departments`** (lista todos), `GET /api/departments/{id}/users`.
- Analytics endpoints in active use: `GET /api/analytics/department-load`, `GET /api/analytics/users/{userId}/performance`.

## Repo-specific gotchas
- There are parallel scaffold files with similar names (for example `*.ts` vs `*.component.ts`, `auth-guard.ts` vs `auth.guard.ts`, `jwt-interceptor.ts` vs `jwt.interceptor.ts`). Always follow imports from entrypoints before editing.
- Most active UI is inline (`template`/`styles` in TypeScript), so editing sibling `.html/.scss` files often has no effect.
- Keep leading `/` in `ApiService` paths; URLs are built as ``${environment.apiUrl}${path}``.
- Keep the `window.global` polyfill in `src/index.html`; it supports `sockjs-client` usage in websocket code.
- BPMN editor depends on `angular.json` asset/style wiring for `bpmn-js` and `bpmn-js-properties-panel`; preserve those entries when changing build config.
- **JWT token key**: `AuthService.login()` saves to `localStorage` key `'jwt'`. `getToken()` checks `'jwt'` first. Do not introduce a different key or change the lookup order.

## Rules — never break these

### HTTP / API
- **Paginated Spring responses**: `GET /users`, `GET /api/departments`, and other list endpoints may return a Spring `Page` object `{ content: [...], totalElements: N }` instead of a plain array. Always normalize through `OrganizationService.toArray()` (or equivalent) — never call `.filter()` directly on the raw response.
- **User endpoint path**: Call `GET /users` (no `/api/` prefix). For role filtering use server-side query params: `GET /users?role=CLIENT`, `GET /users?role=FUNCIONARIO`. Do not filter locally in JS after fetching all users.
- **Token storage**: Token is saved as `localStorage.setItem('jwt', ...)`. `getToken()` priority order: `localStorage('jwt')` → `sessionStorage('token')` → `localStorage('token')` (legacy fallback). Do not reorder.

### Change detection in list components
- Components that load data via HTTP in `ngOnInit()` must call `this.cdr.detectChanges()` at the end of every `next:` and `error:` subscriber branch. This prevents UI freeze when the observable emits outside Angular's zone (caused by the `pipe(map(...))` chain in services or the functional interceptor).
- Inject `ChangeDetectorRef` in the constructor — do not rely solely on zone-based automatic detection for these components.

### BPMN extensions
- Do not modify `custom-moddle.json` attribute names; they are persisted in saved BPMN XML.
- The `custom:forkJoinType` attribute must be written via `bpmnFactory.create(...)` or `modeling.updateProperties(...)` — never via direct property assignment — to ensure undo/redo support and moddle serialization.
- Cross-lane connections are intentionally **allowed** by `custom-rules.ts` at priority 3000. Do not tighten this rule or remove it.

### Flow Assistant (DiagramEditorComponent)
- `saveDraft()` calls `this.modeler.saveXML({ format: true })` explicitly — do not revert to the old `exportDiagramJson()` helper.
- Decision flow builder (`buildDecision`) supports: SI branch → activity or end; NO branch → activity, end, or loop-back to gateway. Maintain this 3-option contract.

### Real-time collaboration sync (DiagramEditorComponent ↔ WebSocket)
Location: `src/app/modules/policy/diagram-editor/diagram-editor.component.ts` + `src/app/core/services/websocket.service.ts`.

**Connection layer is DONE — do not touch it.** The WebSocket handshake, JWT auth (token via SockJS query param + STOMP `connectHeaders`), and the dynamic subscription to `/topic/policy/{policyId}` already work (confirmed by console logs `📡 Suscrito dinámicamente al canal` and `✅ Escucha colaborativa activa`). Bugs in this feature are almost always in **visual mapping / rendering of the inbound stream**, not in the connection. Do not reconfigure `WebSocketService.connect()`, the `wsUrl`, or the topic path.

**Inbound message contract.** Messages on `/topic/policy/{policyId}` are `CollaborativeMessage` with `action: 'ELEMENT_LOCK' | 'ELEMENT_DRAG' | 'ELEMENT_UNLOCK' | 'ELEMENT_COMMIT'`, plus `sender`, `elementId`, optional `geometry { x, y, width?, height? }`, and optional `bpmnXml` (only on `ELEMENT_COMMIT`). The sender identity field is `sender`; read it resiliently as `sender ?? userId` since the backend may relay either.

The `.subscribe()` callback in `setupLiveCollaboration()` MUST follow this exact order — never reorder or skip steps:

1. **Echo filter FIRST.** `const senderId = payload.sender ?? payload.userId; if (!payload || senderId === this.currentUser) return;` — ignore your own messages to avoid infinite re-broadcast/flicker loops. `this.currentUser` comes from `AuthService.getCurrentUser()`.
2. **Local-drag lock.** If `modeler.get('dragging').isActive()`, `return` early — never mutate the canvas while the local user is mid-drag (prevents DOM collisions).
3. **Dispatch inside `ngZone.run(() => { ... })`.** WebSocket callbacks fire outside Angular's zone. ALL canvas mutations, component-variable updates, and overlay injection MUST run inside `this.ngZone.run(...)`, and the block MUST end with `this.cdr.detectChanges()`. This is the Golden Rule — without it the second user's screen does not repaint.
4. Inside the zone, a `switch (payload.action)` routes to the `applyRemote*` handlers below.

**Handler rules (per action):**
- `ELEMENT_DRAG` → `applyRemoteDrag`: **do NOT move the node immediately on each message.** Remote drags arrive ~30/s with network jitter; applying each one directly causes jerky "teleporting". Instead store the latest position as a *target* in `remoteDragTargets` (last message wins) and run a single `requestAnimationFrame` loop (`startRemoteDragLoop` → `stepRemoteDragAnimation`) that LERPs each element toward its target at 60fps, snapping + dropping it from the set within `REMOTE_DRAG_SNAP_PX`. The loop runs via `ngZone.runOutsideAngular` (no change detection per frame) and stops itself when no targets remain. The actual repositioning still uses `modeling.moveElements([element], { x: stepDx, y: stepDy })` (real model coords + connection redraw), wrapped in `isApplyingRemoteDrag`. **Do NOT** hand-write `gfx.setAttribute('transform', ...)` — overwriting the SVG transform breaks bpmn-js absolute positioning. **Do NOT** call `moveElements` straight from the WebSocket callback — that reintroduces the jitter. `applyRemoteCommit` and `ngOnDestroy` MUST call `cancelRemoteDragAnimation()` so the authoritative `importXML` doesn't fight the in-flight interpolation.
- `ELEMENT_LOCK` / `ELEMENT_UNLOCK` → `applyRemoteLock` / `applyRemoteUnlock`: add/remove a visual overlay (red pulsing border + 🔒 username label) via the `overlays` service, tracked in the `remoteLockedElements` map. Unlock removes the overlay by its stored `overlayId`.
- `ELEMENT_COMMIT` → `applyRemoteCommit`: call `dismissLocalInteractions()` (closes contextPad, cleans appendPreview, cancels directEditing, closes popupMenu), then `await modeler.importXML(bpmnXml)`. Do NOT call `zoom('fit-viewport')` (preserve the user's viewport). **Do NOT** call any "reset transforms" helper after `importXML` — `moveElements` leaves no stray manual transforms, and stripping `transform` from freshly rendered graphics teleports every shape to the origin.

**Anti-loop guards (the load-bearing invariant).** Any programmatic mutation that hits the local `commandStack` must be wrapped so `setupCommandStackGuard` ignores it and does NOT re-broadcast / auto-save:
- Set `this.isApplyingRemoteDrag = true` around `modeling.moveElements(...)` in `applyRemoteDrag`.
- Set `this.isImportingCommit = true` around `importXML(...)` in `applyRemoteCommit` (reset in `finally`).
- `shouldIgnoreCommandStackChange()` already short-circuits on `isImportingCommit`, `isLocalDragging`, `isApplyingRemoteDrag`, transient/preview/dragging/directEditing states, non-`execute` command types, and non-structural command ids. Keep these checks intact when editing the guard.

**Immediate structural sync — create/delete must NOT wait for the debounce.** A node created from the palette stays in "limbo" until committed; if a remote `ELEMENT_DRAG` arrives before the structural commit it is dropped (orphan). To prevent this:
- `setupStructuralSyncListeners()` listens to the `commandStack.{shape,connection}.{create,delete}.executed` events (constant `STRUCTURAL_SYNC_EVENTS`) and fires `emitImmediateStructuralCommit()`. These fire only for modeling commands — **never** during `importXML` (the importer bypasses the commandStack) — so they cannot echo a remote commit.
- `emitImmediateStructuralCommit()` exports XML and emits `ELEMENT_COMMIT` on the next tick (`setTimeout(..., 0)`) to coalesce bursts (e.g. Flow Assistant creating fork + tasks + join) into one commit, and **cancels the pending `commandStackCommitTimer`** so the debounced path never double-emits. It bails on `isImportingCommit` / `isApplyingRemoteDrag`. Do NOT route create/delete through the 175 ms debounce — it lets the element sit uncommitted while the user starts dragging.
- The immediate commit uses the sentinel `elementId = '__structural_change__'`; keep it valid in `isValidElementId`.

**Viewbox isolation — pan/zoom is local-only and must NEVER emit XML.** `canvas.viewbox.changed` / `canvas.viewbox.changing` are camera state per session. Do NOT add listeners for them in `setupStructuralSyncListeners()` or anywhere that emits `ELEMENT_COMMIT`/auto-save. Viewbox changes don't pass through the commandStack, and `canvas.*` command ids are already vetoed in `IGNORED_COMMAND_PREFIXES`. Emitting XML on pan/zoom causes catastrophic overwrites of other users' data — never reintroduce it.

**Orphan `ELEMENT_DRAG` handling.** In `applyRemoteDrag`, if `elementRegistry.get(elementId)` returns nothing (element created remotely but not yet materialized locally), call `handleOrphanRemoteDrag(elementId)` and `return`. That handler does NOT mutate the canvas — it safely ignores the geometry delta (logging at most once per `ORPHAN_DRAG_LOG_THROTTLE_MS` via `console.info`) and relies on the imminent immediate `ELEMENT_COMMIT` to rebuild the tree with the node already positioned. Do NOT attempt to create a placeholder shape or otherwise touch the model for an orphan drag — that corrupts the canvas.

## Tooling conventions
- Package manager is npm (`packageManager: npm@11.9.0`).
- Formatting: 2 spaces, single quotes, Prettier `printWidth: 100`.
- No lint script is configured.