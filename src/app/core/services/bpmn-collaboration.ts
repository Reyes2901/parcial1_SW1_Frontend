import { Injectable } from '@angular/core';

interface RemoteDragState {
  shape: any;       // El objeto interno de bpmn-js
  gfx: SVGElement;  // El nodo SVG real en el DOM
  currentX: number; // Posición fluida actual
  currentY: number;
  targetX: number;  // Posición objetivo enviada por el WebSocket
  targetY: number;
}

@Injectable({
  providedIn: 'root',
})
export class BpmnCollaborationService {
  private activeDrags = new Map<string, RemoteDragState>();
  private animationFrameId: number | null = null;
  
  // Factor de interpolación (0.15 = balance óptimo entre suavidad y respuesta)
  private readonly LERP_FACTOR = 0.15; 

  constructor() {}

  /**
   * 1. Al recibir: ELEMENT_LOCK
   */
  public handleRemoteLock(elementId: string, modeler: any): void {
    const elementRegistry = modeler.get('elementRegistry');
    const canvas = modeler.get('canvas');
    
    const shape = elementRegistry.get(elementId);
    if (!shape) return;

    const gfx = canvas.getGraphics(shape) as SVGElement;
    
    this.activeDrags.set(elementId, {
      shape,
      gfx,
      currentX: shape.x,
      currentY: shape.y,
      targetX: shape.x,
      targetY: shape.y
    });

    // Feedback visual opcional: Opacar elemento bloqueado por otro usuario
    gfx.style.opacity = '0.6';
    gfx.style.transition = 'opacity 0.2s ease';

    if (!this.animationFrameId) {
      this.startAnimationLoop();
    }
  }

  /**
   * 2. Al recibir: ELEMENT_DRAG
   */
  public handleRemoteDrag(elementId: string, newX: number, newY: number): void {
    const drag = this.activeDrags.get(elementId);
    if (drag) {
      drag.targetX = newX;
      drag.targetY = newY;
    }
  }

  /**
   * 3. Al recibir: ELEMENT_COMMIT o desbloqueo con persistencia
   */
  public handleRemoteCommit(elementId: string, modeler: any, finalX: number, finalY: number): void {
    const drag = this.activeDrags.get(elementId);
    if (!drag) return;

    this.activeDrags.delete(elementId);
    if (this.activeDrags.size === 0 && this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // Limpiar transformaciones de la GPU y restablecer opacidad
    drag.gfx.style.opacity = '1';
    drag.gfx.removeAttribute('transform'); 

    // Aplicar cambio definitivo en bpmn-js
    const modeling = modeler.get('modeling');
    const deltaX = finalX - drag.shape.x;
    const deltaY = finalY - drag.shape.y;

    if (deltaX !== 0 || deltaY !== 0) {
      modeling.moveShape(drag.shape, { x: deltaX, y: deltaY });
    }
  }

  /**
   * Bucle a 60 FPS delegando el renderizado a la GPU
   */
  private startAnimationLoop(): void {
    const loop = () => {
      this.activeDrags.forEach((drag) => {
        drag.currentX += (drag.targetX - drag.currentX) * this.LERP_FACTOR;
        drag.currentY += (drag.targetY - drag.currentY) * this.LERP_FACTOR;

        const dx = drag.currentX - drag.shape.x;
        const dy = drag.currentY - drag.shape.y;

        drag.gfx.setAttribute('transform', `translate(${dx}, ${dy})`);
      });

      if (this.activeDrags.size > 0) {
        this.animationFrameId = requestAnimationFrame(loop);
      } else {
        this.animationFrameId = null;
      }
    };
    this.animationFrameId = requestAnimationFrame(loop);
  }
}