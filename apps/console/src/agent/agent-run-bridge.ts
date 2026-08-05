/**
 * Agent Run Bridge - Global event bus for agent → canvas run requests.
 * Supports pending replay: if a request is sent before a listener is registered,
 * it's queued and replayed when the listener subscribes.
 *
 * This solves the race condition where the agent sends a run request before the
 * canvas / panel is mounted.
 */

export interface RunRequest {
  id: string;
  type: 'runWorkflow' | 'runNode';
  nodeId?: string;
  inputs?: Record<string, any>;
  timestamp: number;
}

export interface RunResponse {
  requestId: string;
  success: boolean;
  result?: any;
  error?: string;
}

type RequestHandler = (request: RunRequest) => void;
type ResponseHandler = (response: RunResponse) => void;

class AgentRunBridge {
  private requestHandler: RequestHandler | null = null;
  private pendingRequests: RunRequest[] = [];
  private responseHandlers = new Map<string, ResponseHandler>();

  /** Register as the single listener (canvas side). Pending requests are replayed. */
  onRequest(handler: RequestHandler): void {
    this.requestHandler = handler;
    // Replay pending requests
    if (this.pendingRequests.length > 0) {
      const pending = this.pendingRequests.splice(0);
      for (const req of pending) {
        handler(req);
      }
    }
  }

  /** Clear the listener (canvas unmounts). */
  offRequest(): void {
    this.requestHandler = null;
  }

  /** Send a run request (agent side). Returns a promise that resolves when the canvas responds. */
  send(request: RunRequest): Promise<RunResponse> {
    return new Promise((resolve) => {
      this.responseHandlers.set(request.id, resolve);
      if (this.requestHandler) {
        this.requestHandler(request);
      } else {
        // Queue for replay
        this.pendingRequests.push(request);
      }
    });
  }

  /** Respond to a request (canvas side). */
  respond(response: RunResponse): void {
    const handler = this.responseHandlers.get(response.requestId);
    if (handler) {
      handler(response);
      this.responseHandlers.delete(response.requestId);
    }
  }

  /** Check if a listener is registered. */
  hasListener(): boolean {
    return this.requestHandler !== null;
  }
}

export const agentRunBridge = new AgentRunBridge();
