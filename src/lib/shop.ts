// The shop's placeholder content (the web page's, HANDOFF 6.61 / 6.121): there are no products here — no brand, price
// or shop link is kept — so every picture is an empty tile and every name says what would be there. The person chose
// "layout as Cosmos, placeholder content"; real products are not to be made up or imported without asking.
import { create } from 'zustand';

export const SHOP_TABS = [
  { key: 'womens', label: '女装' },
  { key: 'mens', label: '男装' },
  { key: 'home', label: '家居' },
  { key: 'sale', label: '特卖' },
  { key: 'brands', label: '品牌' },
] as const;
export type ShopTab = (typeof SHOP_TABS)[number]['key'];

export const SHOP_PLACEHOLDER_BRANDS = ['品牌 A', '品牌 B', '品牌 C', '品牌 D', '品牌 E', '品牌 F'];
export type PlaceholderProduct = { i: number; sale: boolean; brand: string; name: string; price: string; originalPrice: string | null };
export const placeholderProduct = (i: number, sale = false): PlaceholderProduct => ({
  i, sale, brand: SHOP_PLACEHOLDER_BRANDS[i % SHOP_PLACEHOLDER_BRANDS.length], name: '商品名称',
  price: sale ? '¥ 特价' : '¥ 价格', originalPrice: sale ? '¥ 原价' : null,
});

// ShopBrandsPage's A–Z index
export const BRAND_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
export const PLACEHOLDER_BRAND_INDEX = BRAND_LETTERS.flatMap((l) => [`${l} 品牌一`, `${l} 品牌二`]);

// a placeholder masonry's tile shapes (width / height), the web page's PLACEHOLDER_RATIOS
export const PLACEHOLDER_RATIOS = [0.8, 0.75, 1, 0.8, 0.7, 0.9, 0.8, 1, 0.75, 0.85];

// BrandFilterRail / BrandFilterSheet. The filters are kept per place: the shop's departments share one, each brand
// page starts afresh. Near Cosmos: with placeholder products they change nothing but the rail and the sheet; the price
// bounds (0–2000, steps of 50) are made up (Cosmos works them out from the products, getPriceSliderStep).
export const SHOP_PRICE_BOUNDS = { min: 0, max: 2000 };
export const SHOP_PRICE_STEP = 50;
export const SHOP_SORTS = [['latest', '最新'], ['priceAsc', '价格从低到高'], ['priceDesc', '价格从高到低']] as const;
export const SHOP_GENDERS = [['menswear', '男装'], ['womenswear', '女装']] as const;
export type ShopSort = (typeof SHOP_SORTS)[number][0];
export type ShopGender = (typeof SHOP_GENDERS)[number][0];
export type PriceRange = { min: number; max: number };
export type ShopFilter = { sort: ShopSort; gender: ShopGender | null; price: PriceRange | null; onSale: boolean; inStock: boolean };
export type FilterContext = 'shop' | 'brand';
export type FilterLocks = { onSale: boolean; gender: boolean }; // onSale: set and kept set (特卖); gender: offered (a brand)

export const freshShopFilter = (): ShopFilter => ({ sort: 'latest', gender: null, price: null, onSale: false, inStock: false });

// brandPage.priceUnder and the like
export function priceRangeLabel({ min, max }: PriceRange) {
  if (min <= SHOP_PRICE_BOUNDS.min) return `低于¥${max}`;
  return max >= SHOP_PRICE_BOUNDS.max ? `¥${min}+` : `¥${min}–¥${max}`;
}

type FilterState = {
  filters: Record<FilterContext, ShopFilter>;
  saleTab: boolean; // the shop's 特卖 is on screen: 促销中 is set and stays set there
  sheet: { ctx: FilterContext; view: 'hub' | 'sort' | 'gender' | 'price'; direct: boolean };
  set: (ctx: FilterContext, patch: Partial<ShopFilter>) => void;
  resetBrand: () => void;
};
export const useShopFilterStore = create<FilterState>((set) => ({
  filters: { shop: freshShopFilter(), brand: freshShopFilter() },
  saleTab: false,
  sheet: { ctx: 'shop', view: 'hub', direct: false },
  set: (ctx, patch) => set((s) => ({ filters: { ...s.filters, [ctx]: { ...s.filters[ctx], ...patch } } })),
  resetBrand: () => set((s) => ({ filters: { ...s.filters, brand: freshShopFilter() } })),
}));

export const filterLocks = (ctx: FilterContext, saleTab: boolean): FilterLocks => ({ onSale: ctx === 'shop' && saleTab, gender: ctx === 'brand' });
