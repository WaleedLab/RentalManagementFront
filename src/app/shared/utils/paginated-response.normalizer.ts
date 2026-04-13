import { PaginatedAggregatorResponse } from '../../core/interfaces';

function pick<T>(source: Record<string, unknown>, ...keys: string[]): T | undefined {
  for (const key of keys) {
    if (key in source && source[key] !== undefined && source[key] !== null) {
      return source[key] as T;
    }
  }
  return undefined;
}

function readArrayProp(obj: Record<string, unknown>, keys: string[]): unknown[] | undefined {
  for (const key of keys) {
    if (key in obj && Array.isArray(obj[key])) {
      return obj[key] as unknown[];
    }
  }
  return undefined;
}

/**
 * Many backends wrap lists differently (items, Data as array, nested data.items, etc.).
 */
function extractItemsArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) {
    return raw;
  }

  const source = (raw ?? {}) as Record<string, unknown>;
  const top = readArrayProp(source, ['items', 'Items', 'values', 'Values', 'records', 'Records', 'list', 'List']);
  if (top) {
    return top;
  }

  const dataVal = source['data'] ?? source['Data'];
  if (Array.isArray(dataVal)) {
    return dataVal;
  }

  if (dataVal && typeof dataVal === 'object' && !Array.isArray(dataVal)) {
    const nested = readArrayProp(dataVal as Record<string, unknown>, [
      'items',
      'Items',
      'data',
      'Data',
      'records',
      'Records',
      'list',
      'List',
    ]);
    if (nested) {
      return nested;
    }
  }

  return [];
}

export function normalizePaginatedResponse<T>(
  raw: unknown,
  mapItem: (item: unknown) => T = item => item as T,
): PaginatedAggregatorResponse<T> {
  const source = (raw ?? {}) as Record<string, unknown>;
  const itemsRaw = extractItemsArray(raw) as unknown[];

  const dataVal = source['data'] ?? source['Data'];
  const metaSource =
    dataVal && typeof dataVal === 'object' && !Array.isArray(dataVal)
      ? (dataVal as Record<string, unknown>)
      : source;

  return {
    items: itemsRaw.map(mapItem),
    totalCount: Number(
      pick(metaSource, 'totalCount', 'TotalCount', 'count', 'Count') ??
        pick(source, 'totalCount', 'TotalCount', 'count', 'Count') ??
        itemsRaw.length,
    ),
    pageNumber: Number(
      pick(metaSource, 'pageNumber', 'PageNumber') ?? pick(source, 'pageNumber', 'PageNumber') ?? 1,
    ),
    pageSize: Number(
      pick(metaSource, 'pageSize', 'PageSize') ??
        pick(source, 'pageSize', 'PageSize') ??
        (itemsRaw.length > 0 ? itemsRaw.length : 20),
    ),
    totalPages: Number(
      pick(metaSource, 'totalPages', 'TotalPages') ?? pick(source, 'totalPages', 'TotalPages') ?? 1,
    ),
  };
}
