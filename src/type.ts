import { PriceStatus, PythCluster } from "@pythnetwork/client";

export type ClusterRecord<T> = { [key in PythCluster]?: T };

export type PublisherKey = string & {};
export type ProductKey = string & {};
export type PriceKey = string & {};
export type ProductAndPublisherKey = string & {};

export interface PublisherConfig {
  selected: boolean;
  permittedCount: number;
}

export interface AlertMessage {
  title: string;
  message: string;
}

export interface ClusterStatus {
  connected: boolean;
  initializing: boolean;
  failed: boolean;
  title?: string;
  description?: string;
}

// export interface PublishDetail {
//   price: string;
//   confidence: string;
//   status: PriceStatus;
//   publishSlot: number;
// }

// asset_type: "Crypto"
// base: "RAY"
// description: "RAYDIUM / US DOLLAR"
// generic_symbol: "RAYUSD"
// price_account: "JDpdv9VibnayNDd2k7JaJW39fdeQT2fT4BmfUpfVj76j"
// quote_currency: "USD"
// symbol: "Crypto.RAY/USD"
export type AssetType = "Crypto" | "Equity" | "FX" | "Metal" | "Rates";

// export interface PythProduct {
//   asset_type: string;
//   base: string;
//   description: string;
//   generic_symbol: string;
//   price_account: string;
//   quote_currency: string;
//   symbol: string;
// }
export interface ProductInfo {
  // from Product
  assetType: string;
  base: string;
  description: string;
  genericSymbol: string;
  priceAccount: string;
  quoteCurrency: string;
  symbol: string;
  productAccount: string;
}

export interface PublisherPriceInfo {
  // publisher price info
  publishPrice: string;
  publishConfidence: string;
  publishStatus: PriceStatus;
  publishSlot: number;
  publisherAccount: string;
}

export interface ProductPriceInfo {
  // product price info
  productStatus: PriceStatus;
  productPrice: string;
  productConfidence: string;
  validSlot: number;
  timestamp: number;
}

export type PublishDetail = ProductInfo & PublisherPriceInfo & ProductPriceInfo;

export interface UptimeInfo {
  timestamp: string;
  aggregateSlotCount: number;
  publisherSlotCount: number;
  slotHitRate: number;
}

// type ReadableRecord<KeyName, K extends string | number | symbol, V> = { [key in K]: V };
