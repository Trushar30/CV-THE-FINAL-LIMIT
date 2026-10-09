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

  // -------------------------------------------------------------------------
  // Registration
  // -------------------------------------------------------------------------

  /**
   * Register an adapter in a specific pool with a numeric priority.
   * If the same provider is already registered in the pool, it is replaced.
   * Providers are sorted by priority ascending (lower = selected first).
   */
  registerAdapter(pool: AIPool, adapter: ProviderAdapter, priority: number): void {
    if (!this.pools.has(pool)) {
      this.pools.set(pool, []);
    }

    const entries = this.pools.get(pool)!;

    // Replace any existing entry for the same provider
    const existingIdx = entries.findIndex((e) => e.provider === adapter.name);
    if (existingIdx !== -1) {
      entries.splice(existingIdx, 1);
    }

    entries.push({
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
  setPriority(pool: AIPool, provider: AIProvider, priority: number): void {
    const entries = this.pools.get(pool);
    if (!entries) return;

    const entry = entries.find((e) => e.provider === provider);
    if (entry) {
      entry.priority = priority;
      entries.sort((a, b) => a.priority - b.priority);
    }
  }

  /**
   * Remove an adapter from a pool. Returns true if removed.
   */
  removeAdapter(pool: AIPool, provider: AIProvider): boolean {
    const entries = this.pools.get(pool);
    if (!entries) return false;

    const index = entries.findIndex((e) => e.provider === provider);
    if (index !== -1) {
      entries.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Get the adapter instance for a given pool and provider.
   */
  getAdapter(pool: AIPool, provider: AIProvider): ProviderAdapter | undefined {
    const entries = this.pools.get(pool);
    if (!entries) return undefined;

    return entries.find((e) => e.provider === provider)?.adapter;
  }

  // -------------------------------------------------------------------------
  // Health State Management
  // -------------------------------------------------------------------------

  /**
   * Update the health state of a provider in a pool.
   * No-op if the pool or provider does not exist.
   */
  setHealthState(pool: AIPool, provider: AIProvider, state: ProviderHealthState): void {
    const entries = this.pools.get(pool);
    if (!entries) return;

    const entry = entries.find((e) => e.provider === provider);
    if (entry) {
      entry.healthState = state;
    }
  }

  /**
   * Get the current health state of a provider in a pool.
   * Returns undefined if the pool or provider does not exist.
   */
  getHealthState(pool: AIPool, provider: AIProvider): ProviderHealthState | undefined {
    const entries = this.pools.get(pool);
    if (!entries) return undefined;

    return entries.find((e) => e.provider === provider)?.healthState;
  }

  // -------------------------------------------------------------------------
  // Provider Selection
  // -------------------------------------------------------------------------

  /**
   * Select the highest-priority provider whose health state is NOT `DISABLED`.
   * If `preferredProvider` is specified and active, it is prioritized.
   * Returns null if the pool is empty or all providers are DISABLED.
   */
  selectProvider(pool: AIPool, preferredProvider?: AIProvider): ProviderEntry | null {
    const entries = this.pools.get(pool);
    if (!entries || entries.length === 0) return null;

    if (preferredProvider) {
      const preferred = entries.find(
        (e) => e.provider === preferredProvider && e.healthState !== 'DISABLED'
      );
      if (preferred) {
        return preferred;
      }
    }

    for (const entry of entries) {
      if (entry.healthState !== 'DISABLED') {
        return entry;
      }
    }

    return null;
  }

  /**
   * Get all non-DISABLED providers in priority order for a pool.
   */
  getAvailableProviders(pool: AIPool): readonly ProviderEntry[] {
    const entries = this.pools.get(pool);
    if (!entries) return [];

    return entries.filter((e) => e.healthState !== 'DISABLED');
  }

  /**
   * Get all registered providers (including DISABLED) in priority order for a pool.
   */
  getAllProviders(pool: AIPool): readonly ProviderEntry[] {
    return this.pools.get(pool) ?? [];
  }
}
