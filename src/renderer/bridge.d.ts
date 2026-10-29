import type { ClientBridge } from '../shared/types';

declare global {
  interface Window {
    vyscsh: ClientBridge;
  }
}
export {};
