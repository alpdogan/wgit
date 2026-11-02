import * as vscode from 'vscode';

export interface Log {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  show(): void;
  dispose(): void;
}

export function createOutputLogger(): Log {
  const channel = vscode.window.createOutputChannel('WGit');
  const write = (level: string, message: string): void => {
    const stamp = new Date().toISOString();
    for (const line of message.split('\n')) {
      channel.appendLine(`${stamp} ${level} ${line}`);
    }
  };
  return {
    info: (message) => write('INFO', message),
    warn: (message) => write('WARN', message),
    error: (message) => write('ERROR', message),
    show: () => channel.show(true),
    dispose: () => channel.dispose(),
  };
}
