// Client-side WebSocket client for Live Interactive Classroom

export interface LiveMessage {
  type: string;
  payload?: any;
  message?: string;
}

export type MessageHandler = (msg: LiveMessage) => void;

export class LiveSocketClient {
  private ws: WebSocket | null = null;
  private handlers: Set<MessageHandler> = new Set();
  private reconnectTimeout: any = null;
  private isExplicitlyClosed = false;
  private pingInterval: any = null;

  public connect(): Promise<boolean> {
    this.isExplicitlyClosed = false;

    return new Promise((resolve) => {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        const wsUrl = `${protocol}//${host}/ws`;

        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          console.log('Connected to Live WebSocket server');
          // Clear any pending reconnect
          if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
          }
          // Periodic ping to keep alive
          this.pingInterval = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
              this.ws.send(JSON.stringify({ type: 'PING' }));
            }
          }, 20000);

          resolve(true);
        };

        this.ws.onmessage = (event) => {
          try {
            const data: LiveMessage = JSON.parse(event.data);
            this.handlers.forEach((handler) => handler(data));
          } catch (e) {
            console.error('Error parsing live WS message:', e);
          }
        };

        this.ws.onclose = () => {
          if (this.pingInterval) clearInterval(this.pingInterval);
          if (!this.isExplicitlyClosed) {
            console.log('WS disconnected, attempting reconnect in 2s...');
            this.reconnectTimeout = setTimeout(() => {
              this.connect();
            }, 2000);
          }
          resolve(false);
        };

        this.ws.onerror = (err) => {
          console.error('Live WS error:', err);
          resolve(false);
        };
      } catch (err) {
        console.error('Failed to initiate WS connection:', err);
        resolve(false);
      }
    });
  }

  public send(type: string, payload?: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }));
    } else {
      console.warn('Cannot send message, WS not open. Trying to reconnect...');
      this.connect().then(() => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type, payload }));
        }
      });
    }
  }

  public subscribe(handler: MessageHandler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  public close() {
    this.isExplicitlyClosed = true;
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    if (this.pingInterval) clearInterval(this.pingInterval);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

export const liveSocket = new LiveSocketClient();
