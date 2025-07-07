import { Injectable } from '@nestjs/common';
import { customRateLimits } from './throttler.config';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

@Injectable()
export class WebSocketThrottler {
  private connectionAttempts = new Map<string, RateLimitEntry>();
  private messageRates = new Map<string, RateLimitEntry>();
  private userConnections = new Map<string, number>();

  /**
   * Check if a connection attempt is allowed
   */
  async checkConnectionLimit(ip: string): Promise<boolean> {
    const now = Date.now();
    const limit = customRateLimits.websocket.connection;
    const key = `conn:${ip}`;

    return this.checkLimit(this.connectionAttempts, key, limit.limit, limit.ttl, now);
  }

  /**
   * Check if a message is allowed
   */
  async checkMessageLimit(userId: string): Promise<boolean> {
    const now = Date.now();
    const limit = customRateLimits.websocket.message;
    const key = `msg:${userId}`;

    return this.checkLimit(this.messageRates, key, limit.limit, limit.ttl, now);
  }

  /**
   * Check if user can establish another connection
   */
  async checkUserConnectionLimit(userId: string): Promise<boolean> {
    const currentConnections = this.userConnections.get(userId) || 0;
    return currentConnections < 5; // Max 5 connections per user
  }

  /**
   * Track a new connection
   */
  async addConnection(userId: string): Promise<void> {
    const current = this.userConnections.get(userId) || 0;
    this.userConnections.set(userId, current + 1);
  }

  /**
   * Remove a connection
   */
  async removeConnection(userId: string): Promise<void> {
    const current = this.userConnections.get(userId) || 0;
    if (current > 0) {
      this.userConnections.set(userId, current - 1);
    }
  }

  /**
   * Generic rate limit checker
   */
  private checkLimit(
    store: Map<string, RateLimitEntry>,
    key: string,
    limit: number,
    ttl: number,
    now: number
  ): boolean {
    const entry = store.get(key);

    if (!entry || now > entry.resetTime) {
      // First request or window expired
      store.set(key, {
        count: 1,
        resetTime: now + ttl
      });
      return true;
    }

    if (entry.count >= limit) {
      return false;
    }

    entry.count++;
    return true;
  }

  /**
   * Clean up expired entries (call periodically)
   */
  async cleanup(): Promise<void> {
    const now = Date.now();

    for (const [key, entry] of this.connectionAttempts.entries()) {
      if (now > entry.resetTime) {
        this.connectionAttempts.delete(key);
      }
    }

    for (const [key, entry] of this.messageRates.entries()) {
      if (now > entry.resetTime) {
        this.messageRates.delete(key);
      }
    }

    // Remove users with 0 connections
    for (const [userId, count] of this.userConnections.entries()) {
      if (count === 0) {
        this.userConnections.delete(userId);
      }
    }
  }

  /**
   * Get current stats
   */
  getStats() {
    return {
      connectionAttempts: this.connectionAttempts.size,
      messageRates: this.messageRates.size,
      userConnections: this.userConnections.size,
      totalConnections: Array.from(this.userConnections.values()).reduce((a, b) => a + b, 0)
    };
  }
} 