/**
 * Gestion de la communication WebSocket avec le backend
 */

export class WebSocketManager {
    constructor(url = `ws://${window.location.host}/ws`) {
        this.url = url;
        this.socket = null;
        this.isConnected = false;
        this.shouldReconnect = true;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 2000;
        
        // Callbacks
        this.onMessage = null;
        this.onConnect = null;
        this.onDisconnect = null;
        this.onError = null;
        
        // Throttling pour éviter de surcharger le serveur
        this.lastSendTime = 0;
        this.minSendInterval = 16; // ~60fps max
        this.pendingData = null;
        this.sendTimeout = null;
    }
    
    connect() {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            return Promise.resolve();
        }
        this.shouldReconnect = true;
        
        return new Promise((resolve, reject) => {
            try {
                this.socket = new WebSocket(this.url);
                
                this.socket.onopen = () => {
                    console.log('🔌 WebSocket connecté');
                    this.isConnected = true;
                    this.reconnectAttempts = 0;
                    
                    if (this.onConnect) this.onConnect();
                    resolve();
                };
                
                this.socket.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        if (this.onMessage) this.onMessage(data);
                    } catch (e) {
                        console.error('Erreur parsing message:', e);
                    }
                };
                
                this.socket.onclose = (event) => {
                    console.log('🔌 WebSocket déconnecté', event.code, event.reason);
                    this.isConnected = false;
                    
                    if (this.onDisconnect) this.onDisconnect();
                    
                    // Tentative de reconnexion
                    if (this.shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
                        this.reconnectAttempts++;
                        console.log(`Reconnexion dans ${this.reconnectDelay}ms (tentative ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
                        setTimeout(() => this.connect(), this.reconnectDelay);
                    }
                };
                
                this.socket.onerror = (error) => {
                    console.error('❌ Erreur WebSocket:', error);
                    if (this.onError) this.onError(error);
                    reject(error);
                };
                
            } catch (e) {
                reject(e);
            }
        });
    }
    
    send(data) {
        if (!this.isConnected || !this.socket) {
            return false;
        }
        
        const now = performance.now();
        const elapsed = now - this.lastSendTime;
        
        // Throttle: on ne renvoie pas plus vite que minSendInterval
        if (elapsed < this.minSendInterval) {
            // Stocker les données pour envoi différé
            this.pendingData = data;
            
            if (!this.sendTimeout) {
                this.sendTimeout = setTimeout(() => {
                    if (this.pendingData && this.isConnected) {
                        this.socket.send(JSON.stringify(this.pendingData));
                        this.lastSendTime = performance.now();
                    }
                    this.sendTimeout = null;
                    this.pendingData = null;
                }, this.minSendInterval - elapsed);
            }
            
            return true;
        }
        
        // Envoi immédiat
        this.socket.send(JSON.stringify(data));
        this.lastSendTime = now;
        return true;
    }
    
    disconnect() {
        this.shouldReconnect = false;
        if (this.sendTimeout) {
            clearTimeout(this.sendTimeout);
            this.sendTimeout = null;
            this.pendingData = null;
        }
        if (this.socket) {
            this.socket.close();
            this.socket = null;
            this.isConnected = false;
        }
    }
}
