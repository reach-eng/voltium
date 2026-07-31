/**
 * R3 split (OfferManagement) — types.
 *
 * Offer + Coupon + their form shapes were inlined inside
 * OfferManagement.tsx. Extracted so the data hook, the offer
 * card, the coupon row, and the two form dialogs can all share
 * the same view of an offer / coupon row.
 */

export interface Offer {
  id: string;
  title: string;
  description: string;
  icon: string | null;
  validFrom: string;
  validUntil: string;
  isActive: boolean;
  isSponsored: boolean;
}

export interface Coupon {
  id: string;
  code: string;
  description: string;
  discountType: string;
  discountValue: number;
  minAmount: number | null;
  maxUses: number | null;
  currentUses: number;
  validFrom: string;
  validUntil: string;
  isActive: boolean;
}

export interface OfferForm {
  title: string;
  description: string;
  validFrom: string;
  validUntil: string;
  isSponsored: boolean;
}

export interface CouponForm {
  code: string;
  description: string;
  discountType: string;
  discountValue: string;
  minAmount: string;
  maxUses: string;
  validFrom: string;
  validUntil: string;
}

export const EMPTY_OFFER_FORM: OfferForm = {
  title: '',
  description: '',
  validFrom: '',
  validUntil: '',
  isSponsored: false,
};

export const EMPTY_COUPON_FORM: CouponForm = {
  code: '',
  description: '',
  discountType: 'PERCENTAGE',
  discountValue: '',
  minAmount: '',
  maxUses: '',
  validFrom: '',
  validUntil: '',
};

export type OfferStatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

export type DeleteTargetType = 'offer' | 'coupon';

export interface DeleteTarget {
  type: DeleteTargetType;
  id: string;
}
