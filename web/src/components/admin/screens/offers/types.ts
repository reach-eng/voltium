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
