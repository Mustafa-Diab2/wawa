# 🔧 Worker Service - WhatsApp Connection Manager

## worker-service/package.json

```json
{
  "name": "whatsapp-worker",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/worker.ts",
    "start": "tsx src/worker.ts",
    "build": "tsc"
  },
  "dependencies": {
    "@whiskeysockets/baileys": "^6.7.8",
    "@supabase/supabase-js": "^2.45.0",
    "pino": "^9.4.0",
    "qrcode": "^1.5.3",
    "dotenv": "^16.4.0"
  },
  "devDependencies": {
    "@types/node": "^20",
    "tsx": "^4.19.0",
    "typescript": "^5"
  }
}
```

## worker-service/src/lib/supabaseAdmin.ts

```typescript
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import path from 'path';

// Load env from parent directory
config({ path: path.join(__dirname, '../../../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials');
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});
```

## worker-service/src/qr-manager.ts

```typescript
/**
 * QR Code Manager
 * - Auto-regenerates QR code every X seconds
 * - Tracks QR expiry time
 * - Prevents duplicate QR updates
 */

import { supabaseAdmin } from './lib/supabaseAdmin';

interface QRState {
  lastQR: string | null;
  lastGenerated: Date | null;
  scanCount: number;
}

export class QRManager {
  private qrStates: Map<string, QRState> = new Map();
  private refreshInterval: number;
  private expiryTime: number;

  constructor(
    refreshInterval: number = 5000,  // 5 seconds
    expiryTime: number = 300000      // 5 minutes
  ) {
    this.refreshInterval = refreshInterval;
    this.expiryTime = expiryTime;
  }

  /**
   * Check if QR should be updated
   */
  shouldUpdateQR(sessionId: string, newQR: string): boolean {
    const state = this.qrStates.get(sessionId);

    // First QR - always update
    if (!state || !state.lastQR) {
      return true;
    }

    // QR changed - update
    if (state.lastQR !== newQR) {
      return true;
    }

    // QR expired - regenerate
    if (state.lastGenerated) {
      const elapsed = Date.now() - state.lastGenerated.getTime();
      if (elapsed > this.expiryTime) {
        return true;
      }
    }

    // Same QR within refresh interval - skip
    return false;
  }

  /**
   * Update QR in database
   */
  async updateQR(sessionId: string, qr: string): Promise<boolean> {
    if (!this.shouldUpdateQR(sessionId, qr)) {
      return false; // Skip update
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.expiryTime);

    try {
      const state = this.qrStates.get(sessionId) || {
        lastQR: null,
        lastGenerated: null,
        scanCount: 0
      };

      const { error } = await supabaseAdmin
        .from('whatsapp_sessions')
        .update({
          qr: qr,
          qr_generated_at: now.toISOString(),
          qr_expires_at: expiresAt.toISOString(),
          is_ready: false,
          updated_at: now.toISOString()
        })
        .eq('id', sessionId);

      if (error) {
        console.error(`[QRManager] Error updating QR for ${sessionId}:`, error);
        return false;
      }

      // Update local state
      this.qrStates.set(sessionId, {
        lastQR: qr,
        lastGenerated: now,
        scanCount: state.scanCount
      });

      console.log(`✅ [QRManager] QR updated for session ${sessionId} (expires in ${this.expiryTime / 1000}s)`);
      return true;
    } catch (error) {
      console.error(`[QRManager] Exception updating QR:`, error);
      return false;
    }
  }

  /**
   * Mark QR as scanned
   */
  incrementScanCount(sessionId: string) {
    const state = this.qrStates.get(sessionId);
    if (state) {
      state.scanCount++;
      this.qrStates.set(sessionId, state);
    }
  }

  /**
   * Clear QR on connection
   */
  async clearQR(sessionId: string) {
    try {
      await supabaseAdmin
        .from('whatsapp_sessions')
        .update({
          qr: null,
          qr_generated_at: null,
          qr_expires_at: null,
          is_ready: true,
          is_connected: true,
          last_connected_at: new Date().toISOString()
        })
        .eq('id', sessionId);

      this.qrStates.delete(sessionId);
      console.log(`✅ [QRManager] QR cleared for connected session ${sessionId}`);
    } catch (error) {
      console.error(`[QRManager] Error clearing QR:`, error);
    }
  }

  /**
   * Check and expire old QRs
   */
  async expireOldQRs() {
    try {
      const { data: sessions } = await supabaseAdmin
        .from('whatsapp_sessions')
        .select('id, qr_expires_at')
        .not('qr', 'is', null)
        .lt('qr_expires_at', new Date().toISOString());

      if (sessions && sessions.length > 0) {
        for (const session of sessions) {
          await supabaseAdmin
            .from('whatsapp_sessions')
            .update({
              qr: null,
              qr_generated_at: null,
              qr_expires_at: null
            })
            .eq('id', session.id);

          this.qrStates.delete(session.id);
        }

        console.log(`🧹 [QRManager] Expired ${sessions.length} old QR codes`);
      }
    } catch (error) {
      console.error(`[QRManager] Error expiring old QRs:`, error);
    }
  }
}
```

## worker-service/src/session-manager.ts

```typescript
/**
 * Session Manager
 * - Handles session persistence
 * - Manages authentication state
 * - Prevents duplicate sessions
 */

import { supabaseAdmin } from './lib/supabaseAdmin';

export class SessionManager {
  private activeSessions: Map<string, any> = new Map();

  /**
   * Register active session
   */
  register(sessionId: string, socket: any) {
    if (this.activeSessions.has(sessionId)) {
      console.warn(`[SessionManager] Session ${sessionId} already registered`);
      return false;
    }

    this.activeSessions.set(sessionId, socket);
    console.log(`✅ [SessionManager] Registered session ${sessionId}`);
    return true;
  }

  /**
   * Unregister session
   */
  unregister(sessionId: string) {
    this.activeSessions.delete(sessionId);
    console.log(`🗑️ [SessionManager] Unregistered session ${sessionId}`);
  }

  /**
   * Check if session is active
   */
  isActive(sessionId: string): boolean {
    return this.activeSessions.has(sessionId);
  }

  /**
   * Get session socket
   */
  getSocket(sessionId: string): any | null {
    return this.activeSessions.get(sessionId) || null;
  }

  /**
   * Get all active session IDs
   */
  getActiveSessions(): string[] {
    return Array.from(this.activeSessions.keys());
  }

  /**
   * Update session status in database
   */
  async updateStatus(sessionId: string, status: {
    isReady?: boolean;
    isConnected?: boolean;
    phoneNumber?: string;
    deviceName?: string;
  }) {
    try {
      const updates: any = {
        updated_at: new Date().toISOString()
      };

      if (status.isReady !== undefined) updates.is_ready = status.isReady;
      if (status.isConnected !== undefined) updates.is_connected = status.isConnected;
      if (status.phoneNumber) updates.phone_number = status.phoneNumber;
      if (status.deviceName) updates.device_name = status.deviceName;

      await supabaseAdmin
        .from('whatsapp_sessions')
        .update(updates)
        .eq('id', sessionId);

      console.log(`✅ [SessionManager] Updated status for ${sessionId}`);
    } catch (error) {
      console.error(`[SessionManager] Error updating status:`, error);
    }
  }

  /**
   * Clean up disconnected sessions
   */
  async cleanupDisconnected(sessionId: string, reason?: string) {
    try {
      await supabaseAdmin
        .from('whatsapp_sessions')
        .update({
          is_ready: false,
          is_connected: false,
          last_disconnected_at: new Date().toISOString(),
          disconnect_reason: reason || 'unknown',
          qr: null
        })
        .eq('id', sessionId);

      this.unregister(sessionId);
      console.log(`🧹 [SessionManager] Cleaned up session ${sessionId}: ${reason}`);
    } catch (error) {
      console.error(`[SessionManager] Error cleaning up:`, error);
    }
  }
}
```

---

سأكمل في الملف التالي...
