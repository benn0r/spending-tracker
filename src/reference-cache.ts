import type { CategoryReference, Reference, References } from './types.ts';

export const emptyReferences: References = { accounts: [], categories: [], tags: [] };

type UnknownRecord = Record<string, unknown>;
const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

function parseReference(value: unknown): Reference | null {
  return isRecord(value) && isNonEmptyString(value.id) && isNonEmptyString(value.name)
    ? { id: value.id, name: value.name }
    : null;
}

function parseCategoryReference(value: unknown): CategoryReference | null {
  const reference = parseReference(value);
  if (!reference || !isRecord(value)) return null;
  if (value.icon !== undefined && typeof value.icon !== 'string') return null;
  if (
    value.iconId !== undefined &&
    value.iconId !== null &&
    (!Number.isInteger(value.iconId) || (value.iconId as number) < 1)
  )
    return null;
  if (value.color !== undefined && typeof value.color !== 'string') return null;
  if (
    value.sortOrder !== undefined &&
    value.sortOrder !== null &&
    (!Number.isInteger(value.sortOrder) || (value.sortOrder as number) < 1)
  )
    return null;
  return {
    ...reference,
    ...(value.icon === undefined ? {} : { icon: value.icon }),
    ...(value.iconId === undefined ? {} : { iconId: value.iconId as number | null }),
    ...(value.color === undefined ? {} : { color: value.color }),
    ...(value.sortOrder === undefined ? {} : { sortOrder: value.sortOrder as number | null }),
  };
}

export function sortCategoryReferences(categories: CategoryReference[]): CategoryReference[] {
  return [...categories].sort(
    (left, right) =>
      (left.sortOrder ?? Number.MAX_SAFE_INTEGER) - (right.sortOrder ?? Number.MAX_SAFE_INTEGER) ||
      left.name.localeCompare(right.name),
  );
}

const hasUniqueIds = (items: Reference[]) =>
  new Set(items.map(({ id }) => id)).size === items.length;

export function parseReferenceCache(value: string | null): References | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (
      !isRecord(parsed) ||
      !Array.isArray(parsed.accounts) ||
      !Array.isArray(parsed.categories) ||
      !Array.isArray(parsed.tags)
    )
      return null;
    const accounts = parsed.accounts.map(parseReference);
    const categories = parsed.categories.map(parseCategoryReference);
    const tags = parsed.tags.map(parseReference);
    if (
      accounts.some((item) => item === null) ||
      categories.some((item) => item === null) ||
      tags.some((item) => item === null)
    )
      return null;
    const references: References = {
      accounts: accounts as Reference[],
      categories: sortCategoryReferences(categories as CategoryReference[]),
      tags: tags as Reference[],
    };
    return hasUniqueIds(references.accounts) &&
      hasUniqueIds(references.categories) &&
      hasUniqueIds(references.tags)
      ? references
      : null;
  } catch {
    return null;
  }
}
