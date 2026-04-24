import { Injectable } from '@angular/core';
import { Client, Message } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { BehaviorSubject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TaskInstance } from '../models/instance.model';

@Injectable({ providedIn: 'root' })
export class WebSocketService {
  private client!: Client;
  private taskSubject = new BehaviorSubject<TaskInstance | null>(null);
  private instanceSubject = new BehaviorSubject<any>(null);
  
  public taskNotifications$ = this.taskSubject.asObservable();
  public instanceUpdates$ = this.instanceSubject.asObservable();

  connect(): void {
    const token = localStorage.getItem('token');
    
    this.client = new Client({
      webSocketFactory: () => new SockJS(environment.wsUrl),
      connectHeaders: { Authorization: `Bearer ${token}` },
      debug: (msg) => console.log('[WebSocket]', msg),
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000
    });

    this.client.onConnect = () => {
      console.log('✅ WebSocket conectado');
      
      // Suscribirse a nuevas tareas
      this.client.subscribe('/user/queue/tasks', (message: Message) => {
        const task = JSON.parse(message.body);
        this.taskSubject.next(task);
      });

      // Suscribirse a actualizaciones de instancia
      this.client.subscribe('/user/queue/instance-status', (message: Message) => {
        const update = JSON.parse(message.body);
        this.instanceSubject.next(update);
      });
    };

    this.client.onStompError = (frame) => {
      console.error('❌ Error STOMP:', frame.headers['message']);
    };

    this.client.activate();
  }

  disconnect(): void {
    if (this.client) {
      this.client.deactivate();
    }
  }
}