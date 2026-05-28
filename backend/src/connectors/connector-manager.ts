/**
 * Connector Manager
 * 
 * Factory pattern to manage and instantiate connectors.
 * Handles connector caching, token refresh, and lifecycle.
 */

import type { IntegrationProvider } from '@prisma/client';
import type { BaseConnector, ConnectorConfig } from './base-connector.js';
import prisma from '../lib/prisma.js';

export class ConnectorManager {
  private static connectorCache = new Map<string, BaseConnector>();
  
  /**
   * Get a connector instance for a user and provider
   * Returns cached instance if available, otherwise creates new one
   */
  static async getConnector(
    userId: string,
    provider: IntegrationProvider
  ): Promise<BaseConnector> {
    const cacheKey = `${userId}:${provider}`;
    
    // Check cache first
    const cached = this.connectorCache.get(cacheKey);
    if (cached) {
      return cached;
    }
    
    // Fetch integration from database
    const integration = await prisma.integration.findUnique({
      where: {
        userId_provider: {
          userId,
          provider,
        },
      },
    });
    
    if (!integration || !integration.isActive) {
      throw new Error(`Integration ${provider} not found or inactive for user ${userId}`);
    }
    
    // Create connector config
    const config: ConnectorConfig = {
      userId,
      provider,
      accessToken: integration.accessToken,
      refreshToken: integration.refreshToken,
      tokenExpiry: integration.tokenExpiry,
      scopes: integration.scopes,
      metadata: integration.metadata as Record<string, unknown> | undefined,
    };
    
    // Instantiate the appropriate connector
    const connector = await this.createConnector(provider, config);
    
    // Cache the connector
    this.connectorCache.set(cacheKey, connector);
    
    return connector;
  }
  
  /**
   * Create a new connector instance based on provider type
   */
  private static async createConnector(
    provider: IntegrationProvider,
    config: ConnectorConfig
  ): Promise<BaseConnector> {
    switch (provider) {
      case 'GOOGLE_CALENDAR': {
        const { GoogleCalendarConnector } = await import('./google/calendar.js');
        return new GoogleCalendarConnector(config);
      }
      case 'GMAIL': {
        const { GmailConnector } = await import('./google/gmail.js');
        return new GmailConnector(config);
      }
      case 'SLACK':
        throw new Error('Slack connector not yet implemented');
      case 'MICROSOFT':
        throw new Error('Microsoft connector not yet implemented');
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }
  
  /**
   * Save updated tokens back to the database
   */
  static async updateTokens(
    userId: string,
    provider: IntegrationProvider,
    accessToken: string,
    refreshToken: string | undefined,
    expiresAt: Date
  ): Promise<void> {
    await prisma.integration.update({
      where: {
        userId_provider: {
          userId,
          provider,
        },
      },
      data: {
        accessToken,
        refreshToken: refreshToken ?? undefined,
        tokenExpiry: expiresAt,
        lastSyncAt: new Date(),
      },
    });
    
    // Invalidate cache to force refresh on next access
    const cacheKey = `${userId}:${provider}`;
    this.connectorCache.delete(cacheKey);
  }
  
  /**
   * Mark an integration as disconnected
   */
  static async disconnectIntegration(
    userId: string,
    provider: IntegrationProvider
  ): Promise<void> {
    await prisma.integration.update({
      where: {
        userId_provider: {
          userId,
          provider,
        },
      },
      data: {
        isActive: false,
        accessToken: null,
        refreshToken: null,
        tokenExpiry: null,
      },
    });
    
    // Remove from cache
    const cacheKey = `${userId}:${provider}`;
    this.connectorCache.delete(cacheKey);
  }
  
  /**
   * Clear all cached connectors (useful for testing or logout)
   */
  static clearCache(userId?: string): void {
    if (userId) {
      // Clear only for specific user
      for (const key of this.connectorCache.keys()) {
        if (key.startsWith(`${userId}:`)) {
          this.connectorCache.delete(key);
        }
      }
    } else {
      // Clear all
      this.connectorCache.clear();
    }
  }
  
  /**
   * Check if a user has a specific integration connected
   */
  static async isConnected(
    userId: string,
    provider: IntegrationProvider
  ): Promise<boolean> {
    const integration = await prisma.integration.findUnique({
      where: {
        userId_provider: {
          userId,
          provider,
        },
      },
    });
    
    return integration?.isActive ?? false;
  }
  
  /**
   * Get all active integrations for a user
   */
  static async getUserIntegrations(userId: string) {
    return await prisma.integration.findMany({
      where: {
        userId,
        isActive: true,
      },
    });
  }
}
