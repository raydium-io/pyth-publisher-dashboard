import { useEffect, useRef } from "react";
import {
  getPythProgramKeyForCluster, parseMappingData, Price, PriceData, Product, PythCluster,
} from "@pythnetwork/client";
import { AccountInfo, Commitment, Connection, PublicKey } from "@solana/web3.js";
import BigNumber from "bignumber.js";
import { Buffer } from "buffer";
import _ from "lodash";

import { logger } from "./logger";

import { ProductInfo, ProductKey, ProductPriceInfo, PublisherKey, PublisherPriceInfo } from "@/type";

export const usePrevious = <T>(state: T): T | undefined => {
  const ref = useRef<T>();

  useEffect(() => {
    ref.current = state;
  }, [state]);

  return ref.current;
};

export const useInterval = (callback: any, delay?: number | null) => {
  const savedCallback = useRef<any>(() => {});

  useEffect(() => {
    savedCallback.current = callback;
  });

  useEffect(() => {
    if (delay !== null) {
      const interval = setInterval(() => savedCallback.current(), delay || 0);
      return () => clearInterval(interval);
    }

    return undefined;
  }, [delay]);
};

export const sleep = async (ms: number) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export const getTimestamp = () => {
  return parseInt(String(new Date().getTime() / 1000));
};

export const calcInterval = (cronMinutes = 10) => {
  const seconds = 60 * cronMinutes;

  const interval = seconds - (parseInt(String(new Date().getTime() / 1000)) % seconds);

  return interval * 1000;
};

export const endlessRetry = async <T>(
  name: string,
  call: () => Promise<T>,
  config?: { sleepSeconds: number; maxRetry: number },
): Promise<T> => {
  const { sleepSeconds = 10, maxRetry = 3 } = config || {};

  let count = 0;

  let result: T | undefined;
  let error;

  while (result === undefined && count <= maxRetry) {
    try {
      result = await call();
    } catch (err) {
      logger.debug("endlessRetry", `${name} failed: ${String(err)}, retrying...`);
      await sleep(1000 * sleepSeconds);
    }

    count++;
  }

  if (result) return result;

  throw error;
};

type PublicKeyish = PublicKey | string;

export const isPublicKey = (publicKey: PublicKeyish) => {
  if (publicKey instanceof PublicKey) {
    return true;
  }

  if (typeof publicKey === "string") {
    try {
      new PublicKey(publicKey);
      return true;
    } catch {}
  }

  return false;
};

export const getProductAndPublisherKey = (productKey: ProductKey, publisherKey: PublisherKey) =>
  `${productKey}_${publisherKey}`;

export const shortAddress = (address: string) => {
  return address.slice(0, 5) + "..." + address.slice(-5);
};

export const getQuoteSymbol = (quoteCurrency: string) => {
  switch (quoteCurrency) {
    case "USD":
      return "$";
    case "BTC":
      return "₿";
    case "ETH":
      return "Ξ";
    case "SOL":
      return "◎";

    default:
      return "";
  }
};

export const PYTH_LINK = {
  productPage: (hyphenatedSymbol: string, cluster: PythCluster) => {
    const clusterName = cluster.startsWith("pyth") ? cluster : `solana-${cluster}`;

    return `https://pyth.network/price-feeds/${hyphenatedSymbol}?cluster=${clusterName}`;
  },
  publisherPage: (hyphenatedSymbol: string, cluster: PythCluster, publisherKey: PublisherKey) => {
    const clusterName = cluster.startsWith("pyth") ? cluster : `solana-${cluster}`;

    return `https://pyth.network/metrics?price-feed=${hyphenatedSymbol}&cluster=${clusterName}&publisher=${publisherKey}`;
  },
};

export const findProgramAddress = (seeds: Array<Buffer | Uint8Array>, programId: PublicKey) => {
  const [publicKey, nonce] = PublicKey.findProgramAddressSync(seeds, programId);
  return { publicKey, nonce };
};

export const getPythPermissionsPubkey = (cluster: PythCluster) => {
  const programId = getPythProgramKeyForCluster(cluster);

  const { publicKey } = findProgramAddress([Buffer.from("permissions", "utf-8")], programId);

  return publicKey;
};

export const getPythMappingAccountForCluster = (cluster: PythCluster) => {
  // https://github.com/pyth-network/pyth-agent/blob/main/scripts/init_key_store.sh
  // https://github.com/pyth-network/pyth-client-js/blob/main/src/cluster.ts

  if (["mainnet-beta", "pythnet"].includes(cluster))
    return new PublicKey("AHtgzX45WTKfkPG53L6WYhGEXwQkN1BVknET3sVsLL8J");
  if (["devnet", "pythtest-crosschain"].includes(cluster))
    return new PublicKey("BmA9Z6FjioHJPpjT39QazZyhDRUdZy2ezwx4GiDdE2u2");
  if (["testnet", "pythtest-conformance"].includes(cluster))
    return new PublicKey("AFmdnt9ng1uVxqCmqwQJDAYC5cKTkw8gJKSM5PnzuF6z");
  if (["localnet"].includes(cluster)) return new PublicKey("BTJKZngp3vzeJiRmmT9PitQH4H29dhQZ1GNhxFfDi4kw");

  throw new Error(`Invalid Solana cluster name: ${cluster}`);
};

export const getPythProductAccountPubkeys = async (cluster: PythCluster, connection: Connection) => {
  const productAccountKeys: PublicKey[] = [];
  let mappingAccount: PublicKey | null = getPythMappingAccountForCluster(cluster);

  while (mappingAccount !== null) {
    const accountInfo = await connection.getAccountInfo(mappingAccount);

    if (accountInfo) {
      const mappingData = parseMappingData(accountInfo.data);

      productAccountKeys.push(...mappingData.productAccountKeys);
      mappingAccount = mappingData.nextMappingAccount;
    } else throw new Error(`${cluster} mapping account ${mappingAccount.toBase58()} not found`);
  }

  return productAccountKeys;
};

/*
 * format product base info
 */
export const formatPythProduct = (product: Product, productAccount: string): ProductInfo => {
  return {
    assetType: product.asset_type,
    base: product.base,
    description: product.description,
    genericSymbol: product.generic_symbol,
    priceAccount: product.price_account,
    quoteCurrency: product.quote_currency,
    symbol: product.symbol,
    productAccount,
  };
};

/*
 * format product price info
 */
export const formatPythPriceData = (priceData: PriceData): ProductPriceInfo => {
  const { status, aggregate, exponent, validSlot, timestamp } = priceData;

  return {
    productStatus: status,
    productPrice: formatBigNumber(aggregate.priceComponent, exponent),
    productConfidence: formatBigNumber(aggregate.confidenceComponent, exponent),
    validSlot: Number(validSlot),
    timestamp: Number(timestamp),
  };
};

export const formatBigNumber = (price: bigint, exponent: number) => {
  // priceComponent * 1e-8
  return BigNumber(price.toString()).times(BigNumber(10).pow(exponent)).toFixed();
};

/*
 * format publisher price info
 */
export const formatPythPrice = (price: Price, exponent: number, publisherAccount: string): PublisherPriceInfo => {
  const { priceComponent, confidenceComponent, status, publishSlot } = price;

  return {
    publishPrice: formatBigNumber(priceComponent, exponent),
    publishConfidence: formatBigNumber(confidenceComponent, exponent),
    publishStatus: status,
    publishSlot,
    publisherAccount,
  };
};

interface MultipleAccountsJsonRpcResponse {
  jsonrpc: string;
  id: string;
  error?: {
    code: number;
    message: string;
  };
  result: {
    context: { slot: number };
    value: { data: Array<string>; executable: boolean; lamports: number; owner: string; rentEpoch: number }[];
  };
}
interface GetMultipleAccountsInfoConfig {
  batchRequest?: boolean;
  commitment?: Commitment;
}
export const getMultipleAccountsInfo = async (
  connection: Connection,
  publicKeys: PublicKey[],
  config?: GetMultipleAccountsInfoConfig,
): Promise<(AccountInfo<Buffer> | null)[]> => {
  const { batchRequest, commitment } = {
    // default
    ...{ batchRequest: false },
    // custom
    ...config,
  };

  const chunkedKeys = _.chunk(publicKeys, 100);
  let results: (AccountInfo<Buffer> | null)[][] = new Array(chunkedKeys.length).fill([]);

  if (batchRequest) {
    const batch = chunkedKeys.map((keys) => {
      const args = connection._buildArgs([keys.map((key) => key.toBase58())], commitment, "base64");
      return {
        methodName: "getMultipleAccounts",
        args,
      };
    });
    const _batch = _.chunk(batch, 10);

    const unsafeResponse: MultipleAccountsJsonRpcResponse[] = await (
      await Promise.all(
        _batch.map(async (i) => {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          return await connection._rpcBatchRequest(i);
        }),
      )
    ).flat();
    results = unsafeResponse.map((unsafeRes: MultipleAccountsJsonRpcResponse) => {
      if (unsafeRes.error) {
        throw new Error("failed to get info for multiple accounts");
      }

      return unsafeRes.result.value.map((accountInfo) => {
        if (accountInfo) {
          const { data, executable, lamports, owner, rentEpoch } = accountInfo;

          if (data.length !== 2 && data[1] !== "base64") {
            throw new Error("info must be base64 encoded");
          }

          return {
            data: Buffer.from(data[0], "base64"),
            executable,
            lamports,
            owner: new PublicKey(owner),
            rentEpoch,
          };
        } else {
          return null;
        }
      });
    });
  } else {
    try {
      results = (await Promise.all(
        chunkedKeys.map((keys) => connection.getMultipleAccountsInfo(keys, commitment)),
      )) as (AccountInfo<Buffer> | null)[][];
    } catch (error) {
      throw new Error(`failed to get info for multiple accounts: ${error}`);
    }
  }

  return results.flat();
};

export const getMultipleAccountsInfoWithCustomFlags = async <T extends { pubkey: PublicKey }>(
  connection: Connection,
  publicKeysWithCustomFlag: T[],
  config?: GetMultipleAccountsInfoConfig,
): Promise<({ accountInfo: AccountInfo<Buffer> | null } & T)[]> => {
  const multipleAccountsInfo = await getMultipleAccountsInfo(
    connection,
    publicKeysWithCustomFlag.map((o) => o.pubkey),
    config,
  );

  return publicKeysWithCustomFlag.map((o, idx) => ({ ...o, accountInfo: multipleAccountsInfo[idx] }));
};
