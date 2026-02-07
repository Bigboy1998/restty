export type PtyMessage =
  | { type: "input"; data: string }
  | { type: "resize"; cols: number; rows: number };

export type PtyStatusMessage = { type: "status"; shell?: string };
export type PtyErrorMessage = { type: "error"; message?: string; errors?: string[] };
export type PtyExitMessage = { type: "exit"; code?: number };

export type PtyServerMessage = PtyStatusMessage | PtyErrorMessage | PtyExitMessage;

export type PtyConnectionState = {
  socket: WebSocket | null;
  connected: boolean;
  url: string;
  decoder: TextDecoder | null;
};

export type PtyCallbacks = {
  onConnect?: () => void;
  onDisconnect?: () => void;
  onData?: (data: string) => void;
  onStatus?: (shell: string) => void;
  onError?: (message: string, errors?: string[]) => void;
  onExit?: (code: number) => void;
};
