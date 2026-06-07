import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

@Injectable({
    providedIn: 'root'
})
export class PolicySyncService {
    private stompClient!: Client;
    private autosaveSubject = new Subject<{ id: string, xml: string }>();

    constructor(private http: HttpClient) {
        this.initAutosavePipeline();
    }

    /**
     * Conecta al WebSocket usando SockJS de forma compatible con arquitecturas modernas
     */
    public connectToPolicy(policyId: string, onRemoteChange: (xml: string) => void) {
        console.log('🔌 Intentando conectar al WebSocket en:', environment.wsUrl);

        this.stompClient = new Client({
            webSocketFactory: () => new SockJS(environment.wsUrl),
            connectHeaders: {
                Authorization: `Bearer ${localStorage.getItem('token')}`
            },
            debug: (str) => console.log('STOMP: ' + str),
            reconnectDelay: 5000,
            heartbeatIncoming: 4000,
            heartbeatOutgoing: 4000
        });

        this.stompClient.onConnect = (frame) => {
            console.log('✅ Conectado exitosamente al WebSocket de Colaboración');

            // Suscribirse al canal de la política específica
            this.stompClient.subscribe(`/topic/policy/${policyId}`, (message) => {
                if (message.body) {
                    const payload = JSON.parse(message.body);
                    onRemoteChange(payload.bpmnXml);
                }
            });
        };

        this.stompClient.onStompError = (frame) => {
            console.error('❌ Error en Broker STOMP:', frame.headers['message']);
        };

        this.stompClient.activate();
    }

    /**
     * Envía los cambios de Front a Front inmediatamente por WS y programa el guardado en DB
     */
    public sendLiveMovement(policyId: string, bpmnXml: string) {
        if (this.stompClient && this.stompClient.connected) {
            // Envío Front-to-Front instantáneo (No toca la base de datos)
            this.stompClient.publish({
                destination: `/app/policy/collaborate/${policyId}`,
                body: JSON.stringify({ bpmnXml })
            });
        }

        // Enviamos al pipeline de RxJS para que cuente los 3 segundos de inactividad
        this.autosaveSubject.next({ id: policyId, xml: bpmnXml });
    }

    /**
     * Pipeline inteligente: Espera 3 segundos de silencio absoluto antes de enviar a MongoDB
     */
    private initAutosavePipeline() {
        this.autosaveSubject.pipe(
            debounceTime(3000) // 👈 AQUÍ SE HACE LA MAGIA DE LOS 3 SEGUNDOS
        ).subscribe({
            next: (data) => {
                console.log('%c⏳ 3 segundos de inactividad. Guardando cambios en MongoDB...', 'color: #00ff00; font-weight: bold;');

                this.http.put(`${environment.apiUrl}/api/policies/${data.id}`, { bpmnXml: data.xml })
                    .subscribe({
                        next: () => console.log('💾 Cambios persistidos con éxito en la Base de Datos.'),
                        error: (err) => console.error('❌ Error al guardar en Base de Datos:', err)
                    });
            }
        });
    }

    public disconnect() {
        if (this.stompClient) {
            this.stompClient.deactivate();
            console.log('🔌 WebSocket desconectado.');
        }
    }
}