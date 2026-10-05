import { AsyncLocalStorage } from "node:async_hooks";
import { IdentityError } from "./identity.error.js";
const requestSignals = new AsyncLocalStorage<AbortSignal>();

export function runIdentityRequest<T>(signal: AbortSignal | undefined, work: () => T): T {
  return signal ? requestSignals.run(signal, work) : work();
}

export function checkIdentityRequest() {
  if (requestSignals.getStore()?.aborted)
    throw new IdentityError(408, "The request expired. Try again.");
}
