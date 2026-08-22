import type { ApiTransaction, DraftTransaction, EntryMode, References } from '../../types';

export function prepareTransactionEdit(
  transaction: ApiTransaction,
  references: References,
): { draft: DraftTransaction; mode: EntryMode } {
  const categoryId = (name: string) =>
    references.categories.find((candidate) => candidate.name === name)?.id ?? '';
  const tagIds = (names: string[] = []) =>
    names.flatMap((name) => {
      const tag = references.tags.find((candidate) => candidate.name === name);
      return tag ? [tag.id] : [];
    });
  const sharedChildren = transaction.expenseSplitId
    ? (transaction.children ?? []).filter(
        ({ category }) => category !== transaction.sharedExpenseCategory,
      )
    : (transaction.children ?? []);
  const mode: EntryMode = sharedChildren.length > 1 ? 'split' : 'transaction';
  const splitCount = transaction.expenseSplitCount ?? 1;
  const targetCents = Math.round(Math.abs(transaction.amount) * 100);
  let allocatedCents = 0;
  const splits = sharedChildren.map((child, index) => {
    const cents = transaction.expenseSplitId
      ? index === sharedChildren.length - 1
        ? targetCents - allocatedCents
        : Math.round(Math.abs(child.amount) * 100 * splitCount)
      : Math.round(Math.abs(child.amount) * 100);
    allocatedCents += cents;
    return {
      category: categoryId(child.category),
      amount: String(cents / 100),
      tags: tagIds(child.tags),
    };
  });
  const primary = sharedChildren[0];
  return {
    mode,
    draft: {
      account: references.accounts.find(({ name }) => name === transaction.account)?.id ?? '',
      category: categoryId(primary?.category ?? transaction.category),
      date: transaction.date,
      amount: String(Math.abs(transaction.amount)),
      tags: tagIds(primary?.tags ?? transaction.tags),
      comment: transaction.notes ?? '',
      splits:
        mode === 'split'
          ? splits
          : [
              { category: '', amount: '', tags: [] },
              { category: '', amount: '', tags: [] },
            ],
    },
  };
}
