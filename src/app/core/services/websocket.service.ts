import { Injectable } from '@angular/core';
import { Client, StompSubscription } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { BehaviorSubject, Subject, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class WebSocketService {
  private client!: Client;
  private connected$ = new BehaviorSubject<boolean>(false);

  taskNotifications$ = new Subject<any>();
  instanceUpdates$ = new Subject<any>();
  bottleneckAlerts$ = new Subject<any>();

  constructor(private auth: AuthService) { }

  connect(): void {
    const token = this.auth.getToken();

    if (!token) {
      console.log('⏭ WebSocket no conectado (sin token)');
      return;
    }
    if (this.client?.connected) return;

    this.client = new Client({
      // ✅ 1. PASAR EL TOKEN POR QUERY PARAM: Resuelve la autenticación a nivel HTTP Handshake
      webSocketFactory: () => new SockJS(`${environment.wsUrl}?token=${token}`),

      connectHeaders: {
        Authorization: `Bearer ${token}`
      },
      onConnect: () => {
        console.log('✅ WebSocket conectado');
        this.connected$.next(true);
        this.subscribeToChannels();
      },
      onDisconnect: () => {
        console.log('🔌 WebSocket desconectado');
        this.connected$.next(false);
      },
      onStompError: (frame) => {
        console.error('❌ STOMP error:', frame.headers['message']);
      },
      reconnectDelay: 5000
    });

    this.client.activate();
  }

  disconnect(): void {
    this.client?.deactivate();
  }

  subscribeToTopic(topic: string, callback: (payload: any) => void): StompSubscription | null {
    if (this.client && this.client.connected) {
      const subscription = this.client.subscribe(topic, (msg) => {
        callback(JSON.parse(msg.body));
      });
      console.log(`📡 Suscrito dinámicamente al canal: ${topic}`);
      return subscription;
    }
    console.warn(`⚠️ No se pudo suscribir a ${topic}: WebSocket aún sin conexión activa.`);
    return null;
  }

  // ✅ 2. AGREGAR CABECERAS A LOS MENSAJES EN VIVO
  sendLiveChange(destination: string, payload: any): void {
    if (this.client && this.client.connected) {
      this.client.publish({
        destination: destination,
        headers: { Authorization: `Bearer ${this.auth.getToken()}` }, // <-- Requerido por el interceptor de Spring
        body: JSON.stringify(payload)
      });
    }
  }

  // ✅ 3. AGREGAR CABECERAS AL ENVÍO SEGURO GENERAL
  send(destination: string, payload: any): void {
    if (this.client && this.client.connected) {
      this.client.publish({
        destination,
        headers: { Authorization: `Bearer ${this.auth.getToken()}` }, // <-- Requerido por el interceptor de Spring
        body: JSON.stringify(payload)
      });
    } else {
      console.error('❌ Error: Intento de enviar mensaje STOMP sin conexión activa.');
    }
  }

  private subscribeToChannels(): void {
    this.client.subscribe('/user/queue/tasks', msg => {
      this.taskNotifications$.next(JSON.parse(msg.body));
    });

    this.client.subscribe('/user/queue/instance-status', msg => {
      this.instanceUpdates$.next(JSON.parse(msg.body));
    });

    this.client.subscribe('/topic/admin/bottlenecks', msg => {
      this.bottleneckAlerts$.next(JSON.parse(msg.body));
    });

    this.client.subscribe('/topic/admin/completed', msg => {
      this.instanceUpdates$.next(JSON.parse(msg.body));
    });

    console.log('📡 Suscrito a canales WebSocket fijos');
  }

  isConnected(): Observable<boolean> {
    return this.connected$.asObservable();
  }
}