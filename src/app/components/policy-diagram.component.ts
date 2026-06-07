import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { PolicySyncService } from '../services/policy-sync.service';
import { BpmnCollaborationService } from '../core/services/bpmn-collaboration'; // <-- Importamos tu nuevo servicio
import BpmnModeler from 'bpmn-js/lib/Modeler';

@Component({
    selector: 'app-policy-diagram',
    template: `<div id="canvas" style="width: 100%; height: 100vh;"></div>`,
    styles: [`#canvas { background-color: #f8f9fa; }`]
})
export class PolicyDiagramComponent implements OnInit, OnDestroy {
    private bpmnModeler!: BpmnModeler;
    private policyId!: string;
    private isImporting = false; // Evita bucles infinitos de retransmisión

    constructor(
        private route: ActivatedRoute,
        private syncService: PolicySyncService,
        private collaborationService: BpmnCollaborationService // <-- Inyectamos el servicio de animación
    ) { }

    ngOnInit() {
        // Capturar el ID de la política desde la URL de Angular
        this.policyId = this.route.snapshot.paramMap.get('id')!;

        // Inicializar el modelador de BPMN en el div #canvas
        this.bpmnModeler = new BpmnModeler({ container: '#canvas' });

        // 1. Conectarse al WebSocket y escuchar payloads dinámicos
        this.syncService.connectToPolicy(this.policyId, (response: any) => {
            
            // CASO A: Es un evento de arrastre en tiempo real (Granular y rápido)
            if (response && response.type) {
                switch (response.type) {
                    case 'ELEMENT_LOCK':
                        this.collaborationService.handleRemoteLock(response.elementId, this.bpmnModeler);
                        break;
                    case 'ELEMENT_DRAG':
                        this.collaborationService.handleRemoteDrag(response.elementId, response.x, response.y);
                        break;
                    case 'ELEMENT_COMMIT':
                        this.collaborationService.handleRemoteCommit(response.elementId, this.bpmnModeler, response.x, response.y);
                        break;
                }
                return; // Cortamos ejecución para no procesar el importXML pesado
            }

            // CASO B: El payload es un string XML plano o estructura completa de inicialización
            const remoteXml = typeof response === 'string' ? response : response?.xml;
            
            if (remoteXml) {
                console.log('📥 Cambio estructural recibido desde otro diseñador. Actualizando lienzo...');
                this.isImporting = true;

                this.bpmnModeler.importXML(remoteXml).then(() => {
                    this.isImporting = false;
                }).catch(err => {
                    console.error('Error al renderizar el XML remoto:', err);
                    this.isImporting = false;
                });
            }
        });

        // 2. Escuchar tus propias acciones locales para subirlas al servidor
        this.bpmnModeler.on('commandStack.changed', () => {
            if (this.isImporting) return; // Si el cambio viene del WebSocket, no lo re-enviamos

            this.bpmnModeler.saveXML({ format: true }).then(({ xml }) => {
                if (xml) {
                    // Transmitir inmediatamente al otro frente (vía WS)
                    this.syncService.sendLiveMovement(this.policyId, xml);
                }
            });
        });
    }

    ngOnDestroy() {
        this.syncService.disconnect();
    }
}