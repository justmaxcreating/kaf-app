export type DrinkCategory = 'bier' | 'schnaps' | 'sonstiges';
export type DrinkUnit = 'flasche' | 'kiste';
export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
export type UserRole = 'bar' | 'lager' | 'admin';

export interface Drink {
  id: string;
  name: string;
  category: DrinkCategory;
  units: DrinkUnit[];
  bottlesPerCrate: number;
  inventory: number;
  minStock: number;
}

export interface Order {
  id: string;
  drinkId: string;
  drinkName: string;
  category: DrinkCategory;
  quantity: number;
  unit: DrinkUnit;
  bottleCount: number;
  status: OrderStatus;
  createdBy: string;
  cancelledBy?: string;
  note: string;
  batchId?: string;
  batchNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CartItem {
  drinkId: string;
  drinkName: string;
  category: DrinkCategory;
  quantity: number;
  unit: DrinkUnit;
  bottleCount: number;
  note: string;
}

export interface ConnectedUser {
  id: string;
  name: string;
  role: UserRole;
}

export const CATEGORY_LABELS: Record<DrinkCategory, string> = {
  bier: 'Bier',
  schnaps: 'Schnaps',
  sonstiges: 'Sonstiges',
};

export const CATEGORY_ICONS: Record<DrinkCategory, string> = {
  bier: '🍺',
  schnaps: '🥃',
  sonstiges: '🥂',
};

export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Offen',
  preparing: 'Wird vorbereitet',
  ready: 'Abholbereit',
  delivered: 'Erledigt',
  cancelled: 'Storniert',
};

export const STATUS_COLORS: Record<OrderStatus, string> = {
  pending: 'warning',
  preparing: 'info',
  ready: 'success',
  delivered: 'text-tertiary',
  cancelled: 'danger',
};

export const UNIT_LABELS: Record<DrinkUnit, string> = {
  flasche: 'Flasche',
  kiste: 'Kiste',
};

export const UNIT_LABELS_PLURAL: Record<DrinkUnit, string> = {
  flasche: 'Flaschen',
  kiste: 'Kisten',
};
