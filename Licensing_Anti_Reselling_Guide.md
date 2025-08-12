# Licensing & Anti-Reselling Implementation Guide for Papra

## Table of Contents
1. [Overview](#overview)
2. [Licensing Strategies](#licensing-strategies)
3. [Implementation Details](#implementation-details)
4. [Database Schema](#database-schema)
5. [Security Features](#security-features)
6. [Deployment Guide](#deployment-guide)
7. [Monitoring & Analytics](#monitoring--analytics)

---

## Overview

This guide provides comprehensive strategies to implement licensing and prevent reselling in Papra, ensuring guaranteed payments and user control.

### **Key Objectives**
- ✅ Prevent software reselling
- ✅ Guarantee payment collection
- ✅ Control feature access
- ✅ Monitor usage patterns
- ✅ Protect against tampering

---

## Licensing Strategies

### **1. Hardware-Based Licensing (Most Secure)**

Hardware fingerprinting binds licenses to specific machines, making reselling extremely difficult.

#### **Benefits:**
- Prevents license sharing across devices
- Hardware changes require re-activation
- Difficult to bypass or modify

#### **Implementation:**
```typescript
// apps/papra-server/src/modules/licensing/hardware-license.service.ts
export class HardwareLicenseService {
  async generateHardwareFingerprint(): Promise<string> {
    const os = require('os');
    const crypto = require('crypto');
    
    const hardwareInfo = {
      cpu: os.cpus()[0].model,
      memory: os.totalmem(),
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      macAddress: this.getMacAddress(),
      diskSerial: await this.getDiskSerial()
    };
    
    const fingerprint = crypto
      .createHash('sha256')
      .update(JSON.stringify(hardwareInfo))
      .digest('hex');
    
    return fingerprint;
  }

  async validateLicense(licenseKey: string, hardwareFingerprint: string): Promise<boolean> {
    const license = await this.getLicenseFromDatabase(licenseKey);
    
    if (!license) return false;
    
    if (license.hardwareFingerprint !== hardwareFingerprint) {
      await this.logLicenseViolation(licenseKey, hardwareFingerprint);
      return false;
    }
    
    return license.isValid && license.expiryDate > new Date();
  }
}
```

### **2. Online Activation & Validation**

Requires internet connection for initial activation and periodic validation.

#### **Benefits:**
- Real-time license control
- Immediate revocation capability
- Usage analytics and monitoring

#### **Implementation:**
```typescript
// apps/papra-server/src/modules/licensing/online-license.service.ts
export class OnlineLicenseService {
  private readonly activationServer = 'https://your-license-server.com';
  
  async activateLicense(licenseKey: string, hardwareFingerprint: string): Promise<LicenseActivationResult> {
    try {
      const response = await fetch(`${this.activationServer}/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          licenseKey,
          hardwareFingerprint,
          timestamp: Date.now(),
          version: process.env.APP_VERSION
        })
      });
      
      if (!response.ok) {
        throw new Error('Activation failed');
      }
      
      const result = await response.json();
      await this.storeLocalActivation(result);
      return result;
    } catch (error) {
      return await this.fallbackOfflineValidation(licenseKey);
    }
  }

  async validateLicenseOnline(licenseKey: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.activationServer}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseKey, timestamp: Date.now() })
      });
      
      const result = await response.json();
      return result.isValid;
    } catch (error) {
      return await this.getCachedValidation(licenseKey);
    }
  }
}
```

### **3. Feature-Based Licensing**

Granular control over which features users can access based on their license tier.

#### **Benefits:**
- Flexible pricing tiers
- Upselling opportunities
- Usage-based billing

#### **Implementation:**
```typescript
// apps/papra-server/src/modules/licensing/feature-license.service.ts
export class FeatureLicenseService {
  async checkFeatureAccess(userId: string, feature: string): Promise<boolean> {
    const userLicense = await this.getUserLicense(userId);
    
    if (!userLicense) return false;
    
    const featureLimits = userLicense.features[feature];
    if (!featureLimits) return false;
    
    const currentUsage = await this.getFeatureUsage(userId, feature);
    return currentUsage < featureLimits.limit;
  }

  async enforceFeatureLimits(userId: string, feature: string): Promise<void> {
    const hasAccess = await this.checkFeatureAccess(userId, feature);
    
    if (!hasAccess) {
      throw new Error(`Feature '${feature}' not available in your license`);
    }
    
    await this.incrementFeatureUsage(userId, feature);
  }
}
```

### **4. Subscription-Based Licensing**

Recurring billing with automatic renewal and usage tracking.

#### **Benefits:**
- Predictable revenue stream
- Automatic payment collection
- Easy license management

#### **Implementation:**
```typescript
// apps/papra-server/src/modules/licensing/subscription.service.ts
export class SubscriptionLicenseService {
  async validateSubscription(userId: string): Promise<SubscriptionStatus> {
    const subscription = await this.getUserSubscription(userId);
    
    if (!subscription) {
      return { isValid: false, reason: 'No active subscription' };
    }
    
    if (subscription.status === 'cancelled') {
      return { isValid: false, reason: 'Subscription cancelled' };
    }
    
    if (subscription.currentPeriodEnd < new Date()) {
      return { isValid: false, reason: 'Subscription expired' };
    }
    
    const usage = await this.getCurrentUsage(userId);
    const limits = subscription.plan.limits;
    
    if (usage.documents > limits.maxDocuments) {
      return { isValid: false, reason: 'Document limit exceeded' };
    }
    
    return { isValid: true, subscription };
  }

  async handleSubscriptionRenewal(userId: string): Promise<void> {
    const paymentResult = await this.processRenewalPayment(userId);
    
    if (paymentResult.success) {
      await this.extendSubscription(userId, paymentResult.period);
    } else {
      await this.suspendAccount(userId);
    }
  }
}
```

---

## Implementation Details

### **License Enforcement Middleware**

```typescript
// apps/papra-server/src/middleware/license-enforcement.middleware.ts
export function licenseEnforcementMiddleware() {
  return async (c: Context, next: Next) => {
    const userId = c.get('userId');
    
    if (!userId) {
      return c.json({ error: 'Authentication required' }, 401);
    }
    
    // Check license validity
    const licenseValid = await licenseService.validateLicense(userId);
    
    if (!licenseValid) {
      return c.json({ 
        error: 'License invalid or expired',
        code: 'LICENSE_INVALID',
        contact: 'support@yourcompany.com'
      }, 403);
    }
    
    // Check feature access for specific endpoints
    const feature = getFeatureFromEndpoint(c.req.path);
    if (feature) {
      const hasAccess = await featureLicenseService.checkFeatureAccess(userId, feature);
      if (!hasAccess) {
        return c.json({ 
          error: 'Feature not available in your license',
          code: 'FEATURE_NOT_AVAILABLE'
        }, 403);
      }
    }
    
    await next();
  };
}
```

### **Feature Usage Tracking**

```typescript
// apps/papra-server/src/modules/licensing/usage-tracker.service.ts
export class UsageTrackerService {
  async trackFeatureUsage(userId: string, feature: string, metadata?: any): Promise<void> {
    await this.db.insert(usageLogsTable).values({
      id: generateId(),
      userId,
      feature,
      timestamp: new Date(),
      metadata: metadata ? JSON.stringify(metadata) : null,
      ipAddress: this.getClientIP(),
      userAgent: this.getUserAgent()
    });
  }

  async getFeatureUsage(userId: string, feature: string, period: string = 'month'): Promise<number> {
    const startDate = this.getPeriodStartDate(period);
    
    const result = await this.db
      .select({ count: sql`count(*)` })
      .from(usageLogsTable)
      .where(
        and(
          eq(usageLogsTable.userId, userId),
          eq(usageLogsTable.feature, feature),
          gte(usageLogsTable.timestamp, startDate)
        )
      );
    
    return result[0]?.count || 0;
  }
}
```

---

## Database Schema

### **Core Licensing Tables**

```sql
-- License plans and pricing
CREATE TABLE license_plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  billing_cycle TEXT NOT NULL, -- 'monthly', 'yearly', 'one-time'
  features JSON NOT NULL,
  max_users INTEGER DEFAULT 1,
  max_documents INTEGER,
  max_storage_gb INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User licenses
CREATE TABLE licenses (
  id TEXT PRIMARY KEY,
  license_key TEXT UNIQUE NOT NULL,
  user_id TEXT REFERENCES users(id),
  plan_id TEXT REFERENCES license_plans(id),
  hardware_fingerprint TEXT NOT NULL,
  license_type TEXT NOT NULL, -- 'perpetual', 'subscription', 'trial'
  is_valid BOOLEAN DEFAULT true,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME,
  max_users INTEGER DEFAULT 1,
  max_documents INTEGER,
  features JSON
);

-- User subscriptions
CREATE TABLE user_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  plan_id TEXT REFERENCES license_plans(id),
  status TEXT NOT NULL, -- 'active', 'cancelled', 'suspended', 'expired'
  current_period_start DATETIME NOT NULL,
  current_period_end DATETIME NOT NULL,
  cancel_at_period_end BOOLEAN DEFAULT false,
  stripe_subscription_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- License activations
CREATE TABLE license_activations (
  id TEXT PRIMARY KEY,
  license_key TEXT REFERENCES licenses(license_key),
  hardware_fingerprint TEXT NOT NULL,
  activation_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_validation DATETIME,
  validation_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true
);

-- Usage tracking
CREATE TABLE usage_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  feature TEXT NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  metadata TEXT, -- JSON string
  ip_address TEXT,
  user_agent TEXT
);

-- License violations
CREATE TABLE license_violations (
  id TEXT PRIMARY KEY,
  license_key TEXT REFERENCES licenses(license_key),
  violation_type TEXT NOT NULL, -- 'hardware_mismatch', 'tampering', 'overuse'
  details TEXT, -- JSON string
  ip_address TEXT,
  user_agent TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### **Indexes for Performance**

```sql
-- Performance optimization indexes
CREATE INDEX idx_licenses_user_id ON licenses(user_id);
CREATE INDEX idx_licenses_hardware_fingerprint ON licenses(hardware_fingerprint);
CREATE INDEX idx_licenses_expires_at ON licenses(expires_at);
CREATE INDEX idx_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON user_subscriptions(status);
CREATE INDEX idx_subscriptions_period_end ON user_subscriptions(current_period_end);
CREATE INDEX idx_usage_logs_user_feature ON usage_logs(user_id, feature);
CREATE INDEX idx_usage_logs_timestamp ON usage_logs(timestamp);
CREATE INDEX idx_violations_license_key ON license_violations(license_key);
CREATE INDEX idx_violations_timestamp ON license_violations(timestamp);
```

---

## Security Features

### **Anti-Tampering Protection**

```typescript
// apps/papra-server/src/modules/licensing/anti-tamper.service.ts
export class AntiTamperService {
  private readonly licenseChecksum: string;
  
  constructor() {
    this.licenseChecksum = this.generateChecksum();
  }

  async validateSystemIntegrity(): Promise<boolean> {
    // Check if license files have been tampered with
    const currentChecksum = this.generateChecksum();
    
    if (currentChecksum !== this.licenseChecksum) {
      await this.logTamperingAttempt();
      return false;
    }
    
    // Check for debugging tools
    if (this.detectDebugger()) {
      await this.logDebuggerDetection();
      return false;
    }
    
    return true;
  }

  private detectDebugger(): boolean {
    const startTime = performance.now();
    debugger;
    const endTime = performance.now();
    return (endTime - startTime) > 100; // Suspicious timing
  }

  private generateChecksum(): string {
    // Generate checksum of critical license files
    const fs = require('fs');
    const crypto = require('crypto');
    
    const licenseFiles = [
      './license.key',
      './config/license.json',
      './.env'
    ];
    
    let content = '';
    for (const file of licenseFiles) {
      if (fs.existsSync(file)) {
        content += fs.readFileSync(file, 'utf8');
      }
    }
    
    return crypto.createHash('sha256').update(content).digest('hex');
  }
}
```

### **Rate Limiting & Abuse Prevention**

```typescript
// apps/papra-server/src/modules/licensing/rate-limiter.service.ts
export class RateLimiterService {
  private readonly redis = new Redis();
  
  async checkRateLimit(userId: string, action: string): Promise<boolean> {
    const key = `rate_limit:${userId}:${action}`;
    const limit = this.getActionLimit(action);
    
    const current = await this.redis.incr(key);
    
    if (current === 1) {
      await this.redis.expire(key, 3600); // 1 hour window
    }
    
    return current <= limit;
  }

  private getActionLimit(action: string): number {
    const limits = {
      'license_validation': 10, // 10 validations per hour
      'feature_access': 100,    // 100 feature accesses per hour
      'document_upload': 50     // 50 uploads per hour
    };
    
    return limits[action] || 100;
  }
}
```

---

## Deployment Guide

### **Environment Configuration**

```bash
# .env
# Licensing Configuration
LICENSE_SERVER_URL=https://your-license-server.com
LICENSE_SERVER_API_KEY=your_api_key_here
LICENSE_VALIDATION_INTERVAL=3600
LICENSE_OFFLINE_GRACE_PERIOD=86400

# Hardware Fingerprinting
ENABLE_HARDWARE_FINGERPRINTING=true
HARDWARE_FINGERPRINT_SALT=your_salt_here

# Anti-Tampering
ENABLE_ANTI_TAMPERING=true
LICENSE_CHECKSUM_SALT=your_checksum_salt

# Rate Limiting
REDIS_URL=redis://localhost:6379
RATE_LIMIT_ENABLED=true

# Payment Processing
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### **Docker Configuration**

```dockerfile
# docker/Dockerfile
FROM node:22-slim AS base

# Install security tools
RUN apt-get update && apt-get install -y \
    openssl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy license enforcement files
COPY src/modules/licensing ./src/modules/licensing
COPY license.key ./license.key

# Set secure permissions
RUN chmod 600 ./license.key

# ... rest of Dockerfile
```

---

## Monitoring & Analytics

### **License Dashboard**

```typescript
// apps/papra-server/src/modules/licensing/license-dashboard.service.ts
export class LicenseDashboardService {
  async getLicenseMetrics(): Promise<LicenseMetrics> {
    const [
      totalLicenses,
      activeLicenses,
      expiredLicenses,
      violations,
      revenue
    ] = await Promise.all([
      this.getTotalLicenses(),
      this.getActiveLicenses(),
      this.getExpiredLicenses(),
      this.getViolations(),
      this.getRevenue()
    ]);
    
    return {
      totalLicenses,
      activeLicenses,
      expiredLicenses,
      violations,
      revenue,
      activationRate: (activeLicenses / totalLicenses) * 100
    };
  }

  async getViolationAlerts(): Promise<ViolationAlert[]> {
    const violations = await this.db
      .select()
      .from(licenseViolationsTable)
      .where(gte(licenseViolationsTable.timestamp, subDays(new Date(), 7)))
      .orderBy(desc(licenseViolationsTable.timestamp));
    
    return violations.map(violation => ({
      id: violation.id,
      type: violation.violationType,
      severity: this.calculateViolationSeverity(violation),
      timestamp: violation.timestamp,
      details: violation.details
    }));
  }
}
```

### **Usage Analytics**

```typescript
// apps/papra-server/src/modules/licensing/usage-analytics.service.ts
export class UsageAnalyticsService {
  async getUserUsageReport(userId: string, period: string = 'month'): Promise<UsageReport> {
    const startDate = this.getPeriodStartDate(period);
    
    const usage = await this.db
      .select({
        feature: usageLogsTable.feature,
        count: sql`count(*)`,
        lastUsed: sql`max(timestamp)`
      })
      .from(usageLogsTable)
      .where(
        and(
          eq(usageLogsTable.userId, userId),
          gte(usageLogsTable.timestamp, startDate)
        )
      )
      .groupBy(usageLogsTable.feature);
    
    return {
      userId,
      period,
      features: usage.map(u => ({
        name: u.feature,
        usageCount: Number(u.count),
        lastUsed: u.lastUsed
      })),
      totalUsage: usage.reduce((sum, u) => sum + Number(u.count), 0)
    };
  }
}
```

---

## Implementation Checklist

### **Week 1: Foundation**
- [ ] Set up licensing database schema
- [ ] Implement hardware fingerprinting
- [ ] Create basic license validation

### **Week 2: Online Activation**
- [ ] Build license server
- [ ] Implement online activation
- [ ] Add offline fallback

### **Week 3: Feature Control**
- [ ] Implement feature-based licensing
- [ ] Add usage tracking
- [ ] Create feature limits

### **Week 4: Security**
- [ ] Add anti-tampering protection
- [ ] Implement rate limiting
- [ ] Add violation detection

### **Week 5: Payment Integration**
- [ ] Integrate with payment processor
- [ ] Implement subscription management
- [ ] Add billing automation

### **Week 6: Monitoring**
- [ ] Build analytics dashboard
- [ ] Add alerting system
- [ ] Performance optimization

---

## Benefits Summary

✅ **Prevents Reselling** - Hardware-bound licenses  
✅ **Guaranteed Payments** - Subscription-based billing  
✅ **Feature Control** - Granular access management  
✅ **Anti-Tampering** - System integrity protection  
✅ **Usage Tracking** - Monitor and limit usage  
✅ **Revenue Protection** - Multiple payment streams  
✅ **Scalable** - Easy to add new features/plans  

This comprehensive licensing system will protect your software from reselling while ensuring reliable revenue collection and maintaining user satisfaction through fair usage policies.