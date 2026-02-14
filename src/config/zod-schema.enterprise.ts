/**
 * OpenClaw Enterprise - Zod Schemas
 *
 * Esquemas de validación para configuración empresarial
 */

import { z } from "zod";

/**
 * Schema para configuración de personalidad empresarial
 */
export const EnterprisePersonalitySchema = z
  .object({
    businessName: z.string(),
    businessType: z.enum(["retail", "services", "consulting", "healthcare", "education", "other"]),
    businessDescription: z.string(),
    sales: z
      .object({
        name: z.string(),
        tone: z.enum(["professional", "friendly", "casual", "luxury"]),
        expertise: z.array(z.string()),
        restrictions: z.array(z.string()),
        customInstructions: z.string().optional(),
      })
      .strict(),
    admin: z
      .object({
        name: z.string(),
        capabilities: z.array(z.string()),
        escalationTriggers: z.array(z.string()),
        customInstructions: z.string().optional(),
      })
      .strict(),
  })
  .strict();

/**
 * Schema para configuración de una API empresarial
 */
export const EnterpriseApiConfigSchema = z
  .object({
    endpoint: z.string(),
    method: z.string().optional(),
    auth: z.enum(["bearer_token", "api_key", "basic", "none"]).optional(),
    headers: z.record(z.string(), z.string()).optional(),
  })
  .strict();

/**
 * Schema para configuración del modo empresarial
 */
export const EnterpriseConfigSchema = z
  .object({
    apiBaseUrl: z.string().optional(),
    apis: z.record(z.string(), EnterpriseApiConfigSchema).optional(),
    personality: EnterprisePersonalitySchema.optional(),
    salesSystemPrompt: z.string().optional(),
    adminSystemPrompt: z.string().optional(),
    features: z
      .object({
        dualPersonality: z.boolean().optional(),
        escalationEnabled: z.boolean().optional(),
        securityAlerts: z.boolean().optional(),
        stockAlerts: z.boolean().optional(),
        autoReorder: z.boolean().optional(),
      })
      .strict()
      .optional(),
    escalation: z
      .object({
        adminSessionKey: z.string().optional(),
        timeoutSeconds: z.number().int().positive().optional(),
        waitingMessage: z.string().optional(),
      })
      .strict()
      .optional(),
    security: z
      .object({
        alertKeywords: z.array(z.string()).optional(),
        detectedAttempts: z
          .array(
            z
              .object({
                timestamp: z.string(),
                channel: z.string(),
                userId: z.string(),
                attempt: z.string(),
                blocked: z.boolean(),
              })
              .strict()
          )
          .optional(),
      })
      .strict()
      .optional(),
    stockManagement: z
      .object({
        criticalThreshold: z.number().int().positive().optional(),
        alertChannel: z.string().optional(),
        checkInterval: z.string().optional(),
        suppliers: z
          .record(
            z.string(),
            z
              .object({
                phone: z.string(),
                products: z.array(z.string()),
                whatsappAccount: z.string().optional(),
                contactName: z.string().optional(),
                email: z.string().optional(),
              })
              .strict()
          )
          .optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .optional();
