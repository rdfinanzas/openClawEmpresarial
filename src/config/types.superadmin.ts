/**
 * Superadmin configuration types for OpenClaw
 * 
 * Defines the structure for superadmin authentication and access control.
 */

/** Configuration for superadmin panel and access */
export type SuperadminConfig = {
  /** Whether superadmin features are enabled */
  enabled?: boolean;
  
  /** Telegram User ID of the superadmin for receiving verification codes */
  telegramUserId?: number;
  
  /** Admin panel settings */
  panel?: {
    /** Whether the admin panel is enabled */
    enabled?: boolean;
    /** Port for the admin panel (defaults to gateway port) */
    port?: number;
    /** Host to bind the admin panel to */
    host?: string;
    /** Session timeout in minutes */
    sessionTimeoutMinutes?: number;
  };
  
  /** Telegram-based 2FA settings */
  telegram?: {
    /** Telegram bot token for sending verification codes */
    botToken?: string;
    /** Superadmin Telegram user ID (alternative to top-level telegramUserId) */
    adminChatId?: string;
    /** Verification code expiry in minutes */
    codeExpiryMinutes?: number;
  };
  
  /** Credentials for admin login (hashed password) */
  credentials?: {
    /** Bcrypt hashed password */
    passwordHash?: string;
    /** Username for admin login */
    username?: string;
  };
  
  /** Root authorization settings for critical operations */
  rootAuth?: {
    /** Whether root authorization is required for critical operations */
    enabled?: boolean;
    /** Operations requiring root authorization */
    criticalOperations?: string[];
    /** Request expiry in minutes */
    requestExpiryMinutes?: number;
  };
  
  /** Monitoring and alerts */
  monitoring?: {
    /** Enable Telegram alerts for system issues */
    telegramAlerts?: boolean;
    /** Alert cooldown in minutes */
    alertCooldownMinutes?: number;
  };
};
