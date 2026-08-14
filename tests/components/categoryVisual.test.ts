import { categoryVisual, transactionIcon } from '../../src/features/categories/categoryVisual';
import { colors } from '../../src/theme';
import type { ApiTransaction } from '../../src/types';

jest.mock('@expo/vector-icons/Ionicons', () =>
  Object.assign(() => null, {
    glyphMap: {
      'basket-outline': 1,
      'cart-outline': 2,
      'git-branch-outline': 2,
      'home-outline': 3,
      pricetag: 4,
      'pricetag-outline': 4,
      'receipt-outline': 5,
      'train-outline': 6,
      'wallet-outline': 7,
    },
  }),
);

function transaction(overrides: Partial<ApiTransaction> = {}): ApiTransaction {
  return {
    id: 'fantasy-transaction',
    date: '2026-08-12',
    amount: -10,
    account: 'Moonlight Wallet',
    category: 'Arcane Supplies',
    payee: 'Comet Market',
    isSplit: false,
    ...overrides,
  };
}

describe('category visuals', () => {
  it('keeps supported server visuals and falls back for invalid values', () => {
    expect(
      categoryVisual(
        {
          id: 'server-groceries',
          name: 'Server Groceries',
          icon: 'pricetag',
          iconId: 2,
          color: '#BD774B',
        },
        0,
      ),
    ).toEqual({ icon: 'cart-outline', color: '#BD774B' });

    expect(
      categoryVisual(
        {
          id: 'groceries',
          name: 'Enchanted Groceries',
          icon: 'basket-outline',
          color: '#aBcDeF',
        },
        0,
      ),
    ).toEqual({ icon: 'basket-outline', color: '#aBcDeF' });

    expect(
      categoryVisual(
        { id: 'unknown', name: 'Unknown Magic', icon: 'not-a-real-icon', color: 'purple' },
        6,
      ),
    ).toEqual({ icon: 'pricetag-outline', color: '#3C91C9' });
    expect(categoryVisual({ id: 'missing', name: 'Missing Visuals' }, 5)).toEqual({
      icon: 'pricetag-outline',
      color: '#77409A',
    });
    expect(categoryVisual({ id: 'negative', name: 'Negative Index' }, -1).color).toBe(
      colors.accent,
    );
  });

  it.each([
    ['split transactions', transaction({ isSplit: true, amount: 10 }), 'git-branch-outline'],
    ['income', transaction({ amount: 10 }), 'wallet-outline'],
    ['food categories', transaction({ category: 'Food' }), 'basket-outline'],
    ['grocery categories', transaction({ category: 'Moon Groceries' }), 'basket-outline'],
    ['transport categories', transaction({ category: 'Public Transport' }), 'train-outline'],
    ['home categories', transaction({ category: 'Home' }), 'home-outline'],
    ['other expenses', transaction(), 'receipt-outline'],
  ])('chooses an icon for %s', (_label, item, expected) => {
    expect(transactionIcon(item)).toBe(expected);
  });
});
