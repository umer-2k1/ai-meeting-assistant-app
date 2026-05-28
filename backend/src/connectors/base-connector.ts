/**
 * Base Connector Interface
 * 
 * Abstract class that all integration connectors must extend.
 * Provides standard methods for connection management, authentication, and status.
 */

import type { IntegrationProvider } from '@prisma/client';

export interface ConnectorConfig {
  userId: string;
  provider: IntegrationProvider;
  accessToken?: string | null;
  refreshToken?: string | null;
  tokenExpiry?: Date | null;
  scopes?: string[];
  metadata?: Record<string, unknown>;
}

export interface ConnectorStatus {
  connected: boolean;
  provider: IntegrationProvider;
  email?: string;
  lastSync?: Date;
  error?: string;
}

export interface TokenRefreshResult {
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
}

/**
 * Abstract base class for all connectors
 */
export abstract class BaseConnector {
  protected config: ConnectorConfig;
  
  constructor(config: ConnectorConfig) {
    this.config = config;
  }
  
  /**
   * Get the provider type for this connector
   */
  abstract getProvider(): IntegrationProvider;
  
  /**
   * Check if the connector is properly configured and tokens are valid
   */
  abstract isConnected(): Promise<boolean>;
  
  /**
   * Get the current status of the connector
   */
  abstract getStatus(): Promise<ConnectorStatus>;
  
  /**
   * Refresh the access token using the refresh token
   */
  abstract refreshTokens(): Promise<TokenRefreshResult>;
  
  /**
   * Revoke tokens and disconnect the integration
   */
  abstract disconnect(): Promise<void>;
  
  /**
   * Check if the access token is expired or will expire soon
   */
  protected isTokenExpired(bufferMinutes = 5): boolean {
    if (!this.config.tokenExpiry) {
      return true;
    }
    
    const now = new Date();
    const expiry = new Date(this.config.tokenExpiry);
    const bufferMs = bufferMinutes * 60 * 1000;
    
    return (expiry.getTime() - now.getTime()) < bufferMs;
  }
  
  /**
   * Ensure the access token is valid, refresh if needed
   */
  protected async ensureValidToken(): Promise<void> {
    if (this.isTokenExpired()) {
      const tokens = await this.refreshTokens();
      this.config.accessToken = tokens.accessToken;
      if (tokens.refreshToken) {
        this.config.refreshToken = tokens.refreshToken;
      }
      this.config.tokenExpiry = tokens.expiresAt;
    }
  }
  
  /**
   * Get the current access token, ensuring it's valid
   */
  protected async getAccessToken(): Promise<string> {
    await this.ensureValidToken();
    
    if (!this.config.accessToken) {
      throw new Error(`No access token available for ${this.getProvider()}`);
    }
    
    return this.config.accessToken;
  }
}
