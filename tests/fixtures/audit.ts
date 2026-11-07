export interface ResourceSnapshot {
  listeners: number;
  mutationObservers: number;
  resizeObservers: number;
}

/** Instrument native resources without replacing their behavior or their callbacks. */
export function installResourceAudit(): { snapshot(): ResourceSnapshot } {
  const add = EventTarget.prototype.addEventListener;
  const remove = EventTarget.prototype.removeEventListener;
  interface Registration {
    target: EventTarget;
    type: string;
    callback: EventListenerOrEventListenerObject;
    capture: boolean;
  }
  const registrations: Registration[] = [];
  const capture = (
    options: boolean | AddEventListenerOptions | EventListenerOptions | undefined,
  ) => (typeof options === 'boolean' ? options : (options?.capture ?? false));
  EventTarget.prototype.addEventListener = function (type, callback, options) {
    if (
      callback &&
      !registrations.some(
        (item) =>
          item.target === this &&
          item.type === type &&
          item.callback === callback &&
          item.capture === capture(options),
      )
    )
      registrations.push({ target: this, type, callback, capture: capture(options) });
    add.call(this, type, callback, options);
  };
  EventTarget.prototype.removeEventListener = function (type, callback, options) {
    const index = registrations.findIndex(
      (item) =>
        item.target === this &&
        item.type === type &&
        item.callback === callback &&
        item.capture === capture(options),
    );
    if (index >= 0) registrations.splice(index, 1);
    remove.call(this, type, callback, options);
  };
  const mutationObservers = new Set<MutationObserver>();
  const resizeObservers = new Set<ResizeObserver>();
  const NativeMutationObserver = window.MutationObserver;
  const NativeResizeObserver = window.ResizeObserver;
  window.MutationObserver = class extends NativeMutationObserver {
    override observe(target: Node, options?: MutationObserverInit): void {
      super.observe(target, options);
      mutationObservers.add(this);
    }
    override disconnect(): void {
      super.disconnect();
      mutationObservers.delete(this);
    }
  };
  window.ResizeObserver = class extends NativeResizeObserver {
    override observe(target: Element, options?: ResizeObserverOptions): void {
      super.observe(target, options);
      resizeObservers.add(this);
    }
    override disconnect(): void {
      super.disconnect();
      resizeObservers.delete(this);
    }
  };
  return {
    snapshot: () => ({
      // Detached controls are collectible; listeners on live globals must be explicitly removed.
      listeners: registrations.filter(
        (item) => !(item.target instanceof Node) || item.target.isConnected,
      ).length,
      mutationObservers: mutationObservers.size,
      resizeObservers: resizeObservers.size,
    }),
  };
}
