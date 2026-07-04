import { VS_EXPORT_CONFLICT, VS_EXPORT_NOT_FOUND, VS_USER_SCRIPT_ERROR } from '~/shared/constants';

import type { ModuleLoader } from '../loader';
import type { ExportEntry, ExportRegistry } from '../registry';

export type VsProxy = Record<string, unknown>;

async function loadExportValue(loader: ModuleLoader, entry: ExportEntry): Promise<unknown> {
  const { exports } = await loader.loadModule(entry.distPath);
  return exports[entry.exportName];
}

function isClassConstructor(value: unknown): boolean {
  if (typeof value !== 'function') {
    return false;
  }
  const source = Function.prototype.toString.call(value);
  return source.startsWith('class ') || source.startsWith('class{');
}

function propertyKey(prop: string | symbol): string | undefined {
  return typeof prop === 'string' ? prop : undefined;
}

function createExportProxy(entry: ExportEntry, loader: ModuleLoader): unknown {
  const loadTarget = async (): Promise<unknown> => {
    try {
      return await loadExportValue(loader, entry);
    } catch (error) {
      throw new Error(`${VS_USER_SCRIPT_ERROR}: ${String(error)}`);
    }
  };

  return new Proxy(
    (...args: unknown[]) => {
      void args;
    },
    {
      get(_target, prop) {
        if (prop === 'then') {
          return undefined;
        }

        const key = propertyKey(prop);
        if (!key) {
          return undefined;
        }

        return async (...args: unknown[]) => {
          const target = await loadTarget();
          if (isClassConstructor(target)) {
            const member = (target as Record<string, unknown>)[key];
            if (typeof member !== 'function') {
              throw new Error(
                `${VS_EXPORT_NOT_FOUND}: vs.${entry.exportName}.${key} is not a static method`,
              );
            }
            return member.apply(target, args);
          }

          if (typeof target !== 'function') {
            throw new Error(
              `${VS_EXPORT_NOT_FOUND}: vs.${entry.exportName}.${key} is not callable`,
            );
          }
          const member = (target as unknown as Record<string, unknown>)[key];
          if (typeof member !== 'function') {
            throw new Error(
              `${VS_EXPORT_NOT_FOUND}: vs.${entry.exportName}.${key} is not a function`,
            );
          }
          return member.apply(target, args);
        };
      },
      apply(_target, _thisArg, args) {
        return (async () => {
          const target = await loadTarget();
          if (isClassConstructor(target)) {
            throw new Error(
              `${VS_EXPORT_NOT_FOUND}: vs.${entry.exportName}(...) is a class export — call a static method instead, e.g. await vs.${entry.exportName}.print(...)`,
            );
          }
          if (typeof target !== 'function') {
            throw new Error(`${VS_EXPORT_NOT_FOUND}: ${entry.exportName} is not a function export`);
          }
          return (target as (...fnArgs: unknown[]) => unknown)(...args);
        })();
      },
    },
  );
}

/**
 * Lazy `window.vs` root proxy.
 */
export function createVsProxy(registry: ExportRegistry, loader: ModuleLoader): VsProxy {
  return new Proxy({} as VsProxy, {
    get(_target, prop) {
      if (prop === 'then') {
        return undefined;
      }

      const exportName = String(prop);
      if (registry.hasConflict(exportName)) {
        throw new Error(`${VS_EXPORT_CONFLICT}: vs.${exportName}`);
      }

      const entry = registry.getEntry(exportName);
      if (!entry) {
        throw new Error(`${VS_EXPORT_NOT_FOUND}: vs.${exportName}`);
      }

      return createExportProxy(entry, loader);
    },
  });
}
