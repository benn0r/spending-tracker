import Ionicons from '@expo/vector-icons/Ionicons';
import type { ApiTransaction, CategoryReference } from '../../types';
import { colors } from '../../theme';

export type CategoryVisual = {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
};

const fallbackColors = ['#77409A', '#3C91C9', '#B87545', '#D84E8D', '#25836B'];

export const serverCategoryIcons: Readonly<
  Partial<Record<number, keyof typeof Ionicons.glyphMap>>
> = {
  1: 'card-outline',
  2: 'cart-outline',
  3: 'fast-food-outline',
  4: 'restaurant-outline',
  5: 'cafe-outline',
  6: 'beer-outline',
  7: 'wine-outline',
  8: 'car-outline',
  9: 'bus-outline',
  10: 'train-outline',
  11: 'airplane-outline',
  12: 'home-outline',
  13: 'flash-outline',
  14: 'water-outline',
  15: 'wifi-outline',
  16: 'phone-portrait-outline',
  17: 'medical-outline',
  18: 'fitness-outline',
  19: 'school-outline',
  20: 'book-outline',
  21: 'shirt-outline',
  22: 'bag-handle-outline',
  23: 'gift-outline',
  24: 'game-controller-outline',
  25: 'musical-notes-outline',
  26: 'film-outline',
  27: 'ticket-outline',
  28: 'paw-outline',
  29: 'happy-outline',
  30: 'people-outline',
  31: 'person-outline',
  32: 'heart-outline',
  33: 'star-outline',
  34: 'cash-outline',
  35: 'wallet-outline',
  36: 'business-outline',
  37: 'hammer-outline',
  38: 'construct-outline',
  39: 'cut-outline',
  40: 'color-palette-outline',
  41: 'camera-outline',
  42: 'laptop-outline',
  43: 'hardware-chip-outline',
  44: 'cloud-outline',
  45: 'globe-outline',
  46: 'leaf-outline',
  49: 'bicycle-outline',
  50: 'boat-outline',
  51: 'bed-outline',
  52: 'umbrella-outline',
  53: 'sunny-outline',
  54: 'moon-outline',
  55: 'sparkles-outline',
  56: 'shield-checkmark-outline',
  57: 'pricetag-outline',
  58: 'ellipsis-horizontal-circle-outline',
};

export function categoryVisual(category: CategoryReference, index: number): CategoryVisual {
  const configuredIcon = category.iconId ? serverCategoryIcons[category.iconId] : undefined;
  const legacyIcon = category.icon as keyof typeof Ionicons.glyphMap | undefined;
  return {
    icon:
      configuredIcon ??
      (legacyIcon && legacyIcon in Ionicons.glyphMap ? legacyIcon : 'pricetag-outline'),
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
