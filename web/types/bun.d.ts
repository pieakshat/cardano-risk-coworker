declare const Bun: {
  file(path: string): { exists(): Promise<boolean>; json<T = unknown>(): Promise<T> };
};

interface ImportMeta {
  dir: string;
}
