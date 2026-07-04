export interface CachedModule {
  mtimeMs: number;
  exports: Record<string, unknown>;
}

export interface LoadResult {
  exports: Record<string, unknown>;
  fromCache: boolean;
}

export interface FsReader {
  stat(path: string): Promise<{ mtimeMs: number }>;
  read(path: string): Promise<string>;
}
