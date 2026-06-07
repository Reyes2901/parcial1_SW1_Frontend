---
name: init-frontend
description: Establishes strict rendering and synchronization rules for the collaborative BPMN/Canvas diagram editor by updating the root AGENTS.md. Use when the user runs /init-frontend or asks to set or enforce the frontend collaborative-diagram WebSocket synchronization guidelines.
disable-model-invocation: true
---

# init-frontend — Reglas de sincronización del diagramador colaborativo

## Propósito
Establecer (o actualizar) en el `AGENTS.md` de la raíz del repositorio las directrices estrictas de renderizado y sincronización del diagramador visual colaborativo (Angular + WebSockets + bpmn-js), para que cualquier agente que trabaje en este repo las respete.

## Instrucciones
1. Abre el archivo `AGENTS.md` en la raíz del repositorio.
2. Inserta el bloque de "Contenido a pegar" de abajo **textualmente** (mismas palabras, mismo orden, sin parafrasear, sin suavizar y sin añadir encabezados extra).
3. Idempotencia: si ya existe una sección `## 🔄 Reglas de Sincronización del Diagramador Colaborativo (Angular + WebSockets)`, reemplázala por este bloque en lugar de duplicarla.
4. Conserva intacto el resto del contenido de `AGENTS.md`; solo agrega o reemplaza esta sección.
5. No reconfigures la capa de conexión del WebSocket (handshake, JWT, suscripción a `/topic/policy/{policyId}`): estas reglas son exclusivamente de mapeo visual y renderizado.
6. Tras editar, no se requiere build; `AGENTS.md` es documentación.

## Contenido a pegar (textual)

## 🔄 Reglas de Sincronización del Diagramador Colaborativo (Angular + WebSockets)

### 1. Gestión del Flujo de Datos Entrantes (`.subscribe()`)
Al recibir cualquier mensaje asíncronas desde el canal dinámico `/topic/policy/{policyId}`, el agente debe implementar obligatoriamente las siguientes capas de control:

- **Filtro de Eco (Anti-Jitter):** Validar inmediatamente si el `userId` o `username` del emisor del payload coincide con el usuario logueado en la sesión actual de Angular. Si son iguales, usar un `return;` para ignorar el mensaje. Esto evita loops infinitos y vibración del cursor al arrastrar elementos.
- **Mapeo por Eventos:** Estructurar el procesamiento mediante un `switch-case` basado en el tipo de acción: `ELEMENT_LOCK`, `ELEMENT_DRAG`, `ELEMENT_UNLOCK`, y `ELEMENT_COMMIT`.

### 2. Manipulación del Canvas (bpmn-js / Mecanismo Visual)
- **Movimiento Térmico:** Para eventos `ELEMENT_DRAG`, recuperar el nodo directamente desde el registro de elementos del canvas (`elementRegistry.get(elementoId)`) y mutar sus coordenadas en caliente utilizando las utilidades de modelado de la librería visual (`modeling.moveElements` o equivalente), asegurando que el redibujado sea fluido.
- **Bloqueos:** Para `ELEMENT_LOCK` y `ELEMENT_UNLOCK`, inyectar o remover Overlays visuales (candados CSS, opacidad o deshabilitación selectiva de interacción) sobre el ID específico del nodo.

### 3. Ciclo de Vida de Angular y Detección de Cambios (`NgZone`)
- **Regla Crítica Inquebrantable:** Debido a que las actualizaciones de WebSockets se resuelven fuera del ciclo de vida estándar de Angular, toda mutación del lienzo, inyección de capas o actualización de estados dentro del `.subscribe()` **DEBE** ejecutarse dentro del contexto de ejecución de `NgZone`:
  ```typescript
  this.ngZone.run(() => {
      // El procesamiento visual y actualización de variables va aquí de forma obligatoria
  });
  ```
