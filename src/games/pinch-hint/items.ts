import content from './content.json';

export interface PinchItem {
  id: string;
  name: string;
  icon: string;
}

export const PINCH_ITEMS: readonly PinchItem[] = content.items;

export function findPinchItem(id: string): PinchItem | undefined {
  return PINCH_ITEMS.find((item) => item.id === id);
}
