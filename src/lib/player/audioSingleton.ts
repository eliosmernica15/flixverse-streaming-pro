/**
 * AudioContext Singleton
 *
 * Manages a single AudioContext instance with reference counting
 * to properly handle autoplay policies and resource cleanup.
 */

type GainNodeRef = {
  node: GainNode;
  id: symbol;
};

class AudioContextManager {
  private context: AudioContext | null = null;
  private refCount = 0;
  private gainNodes = new Map<symbol, GainNodeRef>();
  private suspendedByPolicy = false;

  /**
   * Get or create the shared AudioContext
   */
  getContext(): AudioContext {
    if (!this.context) {
      const AudioContextConstructor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.context = new AudioContextConstructor();

      // Handle autoplay policy: context starts suspended
      if (this.context.state === 'suspended') {
        this.suspendedByPolicy = true;
      }

      // Auto-resume on user interaction
      const resumeHandler = () => {
        if (this.context?.state === 'suspended') {
          this.context.resume();
        }
        document.removeEventListener('click', resumeHandler);
        document.removeEventListener('keydown', resumeHandler);
      };
      document.addEventListener('click', resumeHandler, { once: true });
      document.addEventListener('keydown', resumeHandler, { once: true });
    }

    this.refCount++;
    return this.context;
  }

  /**
   * Release a reference to the AudioContext
   * Closes context when no consumers remain
   */
  closeContext(): void {
    this.refCount = Math.max(0, this.refCount - 1);

    if (this.refCount === 0 && this.context) {
      // Detach all gain nodes before closing
      this.gainNodes.forEach(({ node }) => {
        try {
          node.disconnect();
        } catch {
          // Node may already be disconnected
        }
      });
      this.gainNodes.clear();

      this.context.close();
      this.context = null;
      this.suspendedByPolicy = false;
    }
  }

  /**
   * Attach a gain node to the context's destination
   * Returns a unique ID for later detachment
   */
  attachGainNode(gainNode: GainNode): symbol {
    const ctx = this.getContext();
    const id = Symbol('gainNode');

    gainNode.connect(ctx.destination);
    this.gainNodes.set(id, { node: gainNode, id });

    return id;
  }

  /**
   * Detach a previously attached gain node
   */
  detachGainNode(id: symbol): void {
    const ref = this.gainNodes.get(id);
    if (ref) {
      try {
        ref.node.disconnect();
      } catch {
        // Node may already be disconnected
      }
      this.gainNodes.delete(id);
    }
  }

  /**
   * Check if context is suspended due to autoplay policy
   */
  isSuspendedByPolicy(): boolean {
    return this.suspendedByPolicy && this.context?.state === 'suspended';
  }

  /**
   * Manually resume context (call on user interaction)
   */
  async resumeContext(): Promise<void> {
    if (this.context?.state === 'suspended') {
      await this.context.resume();
      this.suspendedByPolicy = false;
    }
  }

  /**
   * Get current reference count (for debugging)
   */
  getRefCount(): number {
    return this.refCount;
  }

  /**
   * Get current context state (for debugging)
   */
  getState(): AudioContextState | null {
    return this.context?.state ?? null;
  }
}

// Export default singleton instance
export const audioContext = new AudioContextManager();

// Named exports for advanced usage
export { AudioContextManager };
export type { GainNodeRef };