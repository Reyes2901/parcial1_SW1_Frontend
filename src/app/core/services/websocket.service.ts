import { Injectable } from '@angular/core';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { BehaviorSubject, Subject, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class WebSocketService {
  private client!: Client;
  private connected$ = new BehaviorSubject<boolean>(false);

  // Subjects públicos — los componentes se suscriben a estos
  taskNotifications$ = new Subject<any>();
  instanceUpdates$ = new Subject<any>();
  bottleneckAlerts$ = new Subject<any>();

  constructor(private auth: AuthService) {}

  connect(): void {
    if (!this.auth.getToken()) {
      console.log('⏭ WebSocket no conectado (sin token)');
      return;  
    }
    if (this.client?.connected) return;

    this.client = new Client({
      webSocketFactory: () => new SockJS(`${environment.wsUrl}`),

      connectHeaders: {
        Authorization: `Bearer ${this.auth.getToken()}`
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

  private subscribeToChannels(): void {
    // Canal privado: nuevas tareas del funcionario
    this.client.subscribe('/user/queue/tasks', msg => {
      this.taskNotifications$.next(JSON.parse(msg.body));
    });

    // Canal privado: estado del trámite del cliente
    this.client.subscribe('/user/queue/instance-status', msg => {
      this.instanceUpdates$.next(JSON.parse(msg.body));
    });

    // Broadcast: alertas de cuellos de botella para el admin
    this.client.subscribe('/topic/admin/bottlenecks', msg => {
      this.bottleneckAlerts$.next(JSON.parse(msg.body));
    });

    // Broadcast: trámites completados para el admin
    this.client.subscribe('/topic/admin/completed', msg => {
      this.instanceUpdates$.next(JSON.parse(msg.body));
    });

    console.log('📡 Suscrito a canales WebSocket');
  }

  isConnected(): Observable<boolean> {
    return this.connected$.asObservable();
  }
}