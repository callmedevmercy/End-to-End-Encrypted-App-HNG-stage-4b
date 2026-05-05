class WebSocketClient {
  constructor() {
    this.ws = null;
    this.listeners = new Map();
    this.reconnectTimer = null;
  }

  connect(token) {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const url = `wss://whisperbox.koyeb.app/ws?token=${token}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.emit('connected');
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('WS Receive:', data);
        
        // Assuming data format: { type: 'message.receive', data: { ... } }
        // or { event: 'message.receive', payload: { ... } }
        const eventType = data.type || data.event;
        const payload = data.data || data.payload || data;
        
        if (eventType === 'message.receive' || payload.id) {
           this.emit('message.receive', payload);
        } else {
           this.emit(eventType, payload);
        }
      } catch (err) {
        console.error('Failed to parse WS message', err);
      }
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      this.emit('disconnected');
      // Auto reconnect
      if (sessionStorage.getItem('access_token')) {
        this.reconnectTimer = setTimeout(() => this.connect(sessionStorage.getItem('access_token')), 3000);
      }
    };

    this.ws.onerror = (err) => {
      console.error('WebSocket error', err);
    };
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  send(event, payload) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      // Trying the most common framing structures
      this.ws.send(JSON.stringify({ type: event, event: event, payload, data: payload }));
    } else {
      console.warn('WebSocket not connected, cannot send event', event);
    }
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event).filter(cb => cb !== callback);
      this.listeners.set(event, callbacks);
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(cb => cb(data));
    }
  }
}

export const wsClient = new WebSocketClient();
