import Ionicons from '@expo/vector-icons/Ionicons';
import type { ApiTransaction, CategoryReference } from '../../types';
import { colors } from '../../theme';

export type CategoryVisual = {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
};

const fallbackColors = ['#77409A', '#3C91C9', '#B87545', '#D84E8D', '#25836B'];

export function categoryVisual(category: CategoryReference, index: number): CategoryVisual {
  const icon = category.icon as keyof typeof Ionicons.glyphMap | undefined;
  return {
    icon: icon && icon in Ionicons.glyphMap ? icon : 'pricetag',
    color: /^#[0-9a-fA-F]{6}$/.test(category.color ?? '')
      ? (category.color as string)
      : (fallbackColors[index % fallbackColors.length] ?? colors.accent),
  };
}

export function transactionIcon(transaction: ApiTransaction): keyof typeof Ionicons.glyphMap {
  if (transaction.isSplit) return 'git-branch-outline';
  if (transaction.amount > 0) return 'wallet-outline';
  const category = transaction.category.toLowerCase();
  if (category.includes('food') || category.includes('grocer')) return 'basket-outline';
  if (category.includes('transport')) return 'train-outline';
  if (category.includes('home')) return 'home-outline';
  return 'receipt-outline';
}
