/**
 * ProviderRouter — selects providers by priority, pool, and health state.
 *
 * Spec Section 16:   Three-layer AI Gateway architecture
 * Spec Section 20.2: Provider Health States
 * Decision D11:      DEMO pool vs PIPELINE pool isolation
 *
 * Responsibilities:
 *   - Maintain per-pool ordered lists of provider adapters
 *   - Track per-provider health state
 *   - Select the highest-priority non-DISABLED provider for a pool
 *
 * Out of scope (P3.5): retry loop across providers, circuit-breaker transitions.
 */

import type { AIPool, AIProvider, ProviderHealthState, ProviderAdapter } from './types.js';

// ---------------------------------------------------------------------------
// Provider Entry (internal bookkeeping record)
// ---------------------------------------------------------------------------

export interface ProviderEntry {
  id?: string;
  adapter: ProviderAdapter;
  provider: AIProvider;
  healthState: ProviderHealthState;
  /** Lower number = higher priority (selected first) */
  priority: number;
}

// ---------------------------------------------------------------------------
// ProviderRouter
// ---------------------------------------------------------------------------

export class ProviderRouter {
  private readonly pools = new Map<AIPool, ProviderEntry[]>();
  private readonly roundRobinCounters = new Map<string, number>();

  // -------------------------------------------------------------------------
  // Registration
  // -------------------------------------------------------------------------

  /**
   * Register an adapter in a specific pool with a numeric priority and optional unique instance ID.
   * If an entry with the same instance ID (or adapter name if id is omitted) exists, it is replaced.
   * Providers are sorted by priority ascending (lower = selected first).
   */
  registerAdapter(pool: AIPool, adapter: ProviderAdapter, priority: number, id?: string): void {
    if (!this.pools.has(pool)) {
      this.pools.set(pool, []);
    }

    const entries = this.pools.get(pool)!;

    // Replace any existing entry matching this id or adapter.name
    const targetKey = id || adapter.name;
    const existingIdx = entries.findIndex((e) =>
      e.id ? e.id === targetKey : e.provider === targetKey
    );
    if (existingIdx !== -1) {
      entries.splice(existingIdx, 1);
    }

    entries.push({
      id: id || undefined,
      adapter,
      provider: adapter.name,
      healthState: 'HEALTHY',
      priority,
    });

    // Re-sort by priority ascending
    entries.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Update the priority of an existing provider in a pool and re-sort.
   */
  setPriority(pool: AIPool, providerOrId: string | AIProvider, priority: number): void {
    const entries = this.pools.get(pool);
    if (!entries) return;

    const entry = entries.find(
      (e) => (e.id && e.id === providerOrId) || e.provider === providerOrId
    );
    if (entry) {
      entry.priority = priority;
      entries.sort((a, b) => a.priority - b.priority);
    }
  }

  /**
   * Remove an adapter from a pool by instance ID or provider code. Returns true if removed.
   */
  removeAdapter(pool: AIPool, providerOrId: string | AIProvider): boolean {
    const entries = this.pools.get(pool);
    if (!entries) return false;

    const index = entries.findIndex(
      (e) => (e.id && e.id === providerOrId) || e.provider === providerOrId
    );
    if (index !== -1) {
      entries.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Get the adapter instance for a given pool and provider instance ID or provider code.
   */
  getAdapter(pool: AIPool, providerOrId: string | AIProvider): ProviderAdapter | undefined {
    const entries = this.pools.get(pool);
    if (!entries) return undefined;

    return entries.find(
      (e) => (e.id && e.id === providerOrId) || e.provider === providerOrId
    )?.adapter;
  }

  // -------------------------------------------------------------------------
  // Health State Management
  // -------------------------------------------------------------------------

  /**
   * Update the health state of a provider in a pool.
   * Matches by instance ID if present, otherwise by provider code.
   */
  setHealthState(pool: AIPool, providerOrId: string | AIProvider, state: ProviderHealthState): void {
    const entries = this.pools.get(pool);
    if (!entries) return;

    const entry = entries.find(
      (e) => (e.id && e.id === providerOrId) || e.provider === providerOrId
    );
    if (entry) {
      entry.healthState = state;
    }
  }

  /**
   * Get the current health state of a provider in a pool.
   */
  getHealthState(pool: AIPool, providerOrId: string | AIProvider): ProviderHealthState | undefined {
    const entries = this.pools.get(pool);
    if (!entries) return undefined;

    return entries.find(
      (e) => (e.id && e.id === providerOrId) || e.provider === providerOrId
    )?.healthState;
  }

  // -------------------------------------------------------------------------
  // Provider Selection
  // -------------------------------------------------------------------------

  /**
   * Helper: check if provider health state is currently operational (not in active circuit-breaker cooldown).
   */
  private isOperationalState(state: ProviderHealthState): boolean {
    return state === 'HEALTHY' || state === 'DEGRADED';
  }

  /**
   * Select the highest-priority operational provider whose health state is NOT `DISABLED`.
   * Prioritizes HEALTHY/DEGRADED over RATE_LIMITED/TEMPORARILY_FAILED.
   * If `preferredProvider` is specified and active, it is prioritized.
   * Returns null if the pool is empty or all providers are DISABLED.
   */
  selectProvider(pool: AIPool, preferredProvider?: AIProvider): ProviderEntry | null {
    const available = this.getAvailableProviders(pool, preferredProvider);
    return available[0] ?? null;
  }

  /**
   * Get all non-DISABLED providers in priority order for a pool with round-robin load distribution.
   *
   * Tiers & Routing:
   *   1. Excludes DISABLED providers.
   *   2. Tiers operational providers (HEALTHY / DEGRADED) ahead of cooldown providers (RATE_LIMITED / TEMPORARILY_FAILED).
   *   3. Within each operational priority tier, applies round-robin rotation so multiple keys/providers
   *      share incoming traffic equally, preventing single-key overload and quota rate limits (RPM/TPM).
   *   4. If preferredProvider is specified, matching preferred providers are moved to the front.
   *   5. Cooldown providers are appended at the end as emergency fallbacks.
   */
  getAvailableProviders(pool: AIPool, preferredProvider?: AIProvider): readonly ProviderEntry[] {
    const entries = this.pools.get(pool);
    if (!entries || entries.length === 0) return [];

    const nonDisabled = entries.filter((e) => e.healthState !== 'DISABLED');
    if (nonDisabled.length <= 1 && !preferredProvider) return nonDisabled;

    const operational = nonDisabled.filter((e) => this.isOperationalState(e.healthState));
    const inCooldown = nonDisabled.filter((e) => !this.isOperationalState(e.healthState));

    // Sort cooldown providers strictly by priority ascending
    inCooldown.sort((a, b) => a.priority - b.priority);

    // Group operational providers by priority tier
    const tiers = new Map<number, ProviderEntry[]>();
    for (const entry of operational) {
      const list = tiers.get(entry.priority) ?? [];
      list.push(entry);
      tiers.set(entry.priority, list);
    }

    const sortedPriorities = Array.from(tiers.keys()).sort((a, b) => a - b);
    const rotatedOperational: ProviderEntry[] = [];

    for (const priority of sortedPriorities) {
      const tierEntries = tiers.get(priority)!;
      if (tierEntries.length <= 1) {
        rotatedOperational.push(...tierEntries);
      } else {
        const counterKey = `${pool}:${priority}`;
        const count = this.roundRobinCounters.get(counterKey) ?? 0;
        this.roundRobinCounters.set(counterKey, (count + 1) % 1000000);

        const offset = count % tierEntries.length;
        rotatedOperational.push(
          ...tierEntries.slice(offset),
          ...tierEntries.slice(0, offset)
        );
      }
    }

    // If preferredProvider is specified, prioritize matching providers within the list
    if (preferredProvider) {
      const preferred = rotatedOperational.filter((e) => e.provider === preferredProvider);
      const others = rotatedOperational.filter((e) => e.provider !== preferredProvider);
      return [...preferred, ...others, ...inCooldown];
    }

    return [...rotatedOperational, ...inCooldown];
  }

  /**
   * Get all registered providers (including DISABLED) in priority order for a pool.
   */
  getAllProviders(pool: AIPool): readonly ProviderEntry[] {
    return this.pools.get(pool) ?? [];
  }
}
