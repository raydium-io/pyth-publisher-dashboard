import {
  getPythProgramKeyForCluster, parsePriceData, parseProductData, PriceData, Product, PythCluster, PythConnection,
} from "@pythnetwork/client";
import { AccountInfo, Connection, Context, KeyedAccountInfo, PublicKey } from "@solana/web3.js";
import { diff } from "deep-object-diff";
import _ from "lodash";
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

import {
  AlertMessage, AssetType, ClusterRecord, ClusterStatus, ProductAndPublisherKey, ProductInfo, ProductKey, PublishDetail,
  PublisherConfig, PublisherKey, UptimeInfo,
} from "@/type";
import {
  formatPythPrice, formatPythPriceData, formatPythProduct, getMultipleAccountsInfoWithCustomFlags,
  getProductAndPublisherKey, getPythProductAccountPubkeys, isPublicKey,
} from "@/utils";
import WorkFlow from "@/utils/flow";
import { logger } from "@/utils/logger";

type State = {
  clusters: PythCluster[];
  // solanaConnections: ClusterRecord<Connection>;
  pythConnectionsMap: ClusterRecord<PythConnection>;

  clustersStatusMap: ClusterRecord<ClusterStatus>;
  setClusterDisconnected: (cluster: PythCluster) => void;
  setInitializationDescription: (cluster: PythCluster, description: string) => void;
  setInitializationError: (cluster: PythCluster, description: string, title?: string) => void;
  cleanInitializationError: (cluster: PythCluster) => void;
  setInitializationFinished: (cluster: PythCluster) => void;

  publishersConfigMap: ClusterRecord<Record<PublisherKey, PublisherConfig>>;
  setPublisherSelected: (cluster: PythCluster, publisher: string, selected: boolean) => void;
  setPublisherPermittedCount: (cluster: PythCluster, publisher: string, count: number) => void;

  assetTypesMap: ClusterRecord<Record<AssetType, boolean>>;
  setAssetSelected: (cluster: PythCluster, asset: string, selected: boolean) => void;

  errors: ClusterRecord<AlertMessage[]>;
  setClusterError: (cluster: PythCluster, msg: AlertMessage) => void;

  warns: ClusterRecord<AlertMessage[]>;
  setClusterWarn: (cluster: PythCluster, msg: AlertMessage) => void;

  productsMap: ClusterRecord<Record<ProductKey, ProductInfo>>;
  setProductsMap: (cluster: PythCluster, productsMap: Record<ProductKey, ProductInfo>) => void;
  setProduct: (cluster: PythCluster, productKey: ProductKey, productInfo: ProductInfo) => void;

  // only store permitted products keys for index
  publishingProductKeys: ClusterRecord<ProductKey[]>;
  setPublishingProductKeys: (cluster: PythCluster, keys: ProductKey[]) => void;

  publishDetailsMap: ClusterRecord<Record<ProductAndPublisherKey, PublishDetail>>;
  setPublishDetailsMap: (
    cluster: PythCluster,
    publishDetailsMap: Record<ProductAndPublisherKey, PublishDetail>,
  ) => void;
  setPublishDetail: (cluster: PythCluster, key: ProductAndPublisherKey, publishDetail: PublishDetail) => void;

  uptimeMap: ClusterRecord<Record<ProductAndPublisherKey, UptimeInfo[]>>;
  setUptime: (cluster: PythCluster, key: ProductAndPublisherKey, uptimeInfo: UptimeInfo[]) => void;

  connect: (cluster: PythCluster) => Promise<void>;
};

const clusters: PythCluster[] = [];
const solanaConnectionsMap: ClusterRecord<Connection> = {};
const pythConnectionsMap: ClusterRecord<PythConnection> = {};
const clustersStatusMap: ClusterRecord<ClusterStatus> = {};
const publishersConfigMap: ClusterRecord<Record<PublisherKey, PublisherConfig>> = {};
const assetTypesMap: ClusterRecord<Record<AssetType, boolean>> = {};

for (const cluster of [
  "mainnet-beta",
  "devnet",
  "testnet",
  "pythnet",
  "pythtest-conformance",
  "pythtest-crosschain",
  "localnet",
] as PythCluster[]) {
  const envKey = cluster.toUpperCase().replace(/-/g, "_");
  const rpcEnvValue = _.get(import.meta.env, `VITE_${envKey}_RPC`);
  const publishersEnvValue = _.get(import.meta.env, `VITE_${envKey}_PUBLISHERS`);

  if (publishersEnvValue && rpcEnvValue) {
    const publisherKeys = publishersEnvValue.split(",").filter((key: string) => isPublicKey(key));

    if (publisherKeys.length) {
      clusters.push(cluster);

      const connection = new Connection(rpcEnvValue);
      solanaConnectionsMap[cluster] = connection;

      const pythProgramKey = getPythProgramKeyForCluster(cluster);
      pythConnectionsMap[cluster] = new PythConnection(connection, pythProgramKey);
      clustersStatusMap[cluster] = { connected: false, initializing: true, failed: false };

      _.uniq(publisherKeys).forEach((publisherKey) =>
        _.set(publishersConfigMap, `${cluster}.${publisherKey}`, { selected: true, permittedCount: 0 }),
      );

      assetTypesMap[cluster] = { Crypto: true, Equity: true, FX: true, Metal: true, Rates: true };
    }
  }
}

export const useStore = create<State>()(
  devtools(
    immer((set, get) => ({
      clusters,
      // solanaConnectionsMap,
      pythConnectionsMap,

      clustersStatusMap,
      setClusterDisconnected: (cluster) =>
        set(
          (state) => {
            state.clustersStatusMap = _.set(state.clustersStatusMap, `${cluster}.connected`, false);
          },
          false,
          "setClusterDisconnected",
        ),
      setInitializationDescription: (cluster, description) =>
        set(
          (state) => {
            state.clustersStatusMap = _.set(state.clustersStatusMap, `${cluster}.description`, description);
          },
          false,
          "setInitializationDescription",
        ),
      setInitializationError: (cluster, description, title) =>
        set(
          (state) => {
            state.clustersStatusMap = _.set(state.clustersStatusMap, cluster, {
              ..._.get(state.clustersStatusMap, cluster, {}),
              failed: true,
              description,
              title,
            });
          },
          false,
          "setInitializationError",
        ),
      cleanInitializationError: (cluster) =>
        set(
          (state) => {
            state.clustersStatusMap = _.set(state.clustersStatusMap, cluster, {
              ..._.get(state.clustersStatusMap, cluster, {}),
              failed: false,
              description: null,
              title: null,
            });
          },
          false,
          "cleanInitializationError",
        ),
      setInitializationFinished: (cluster) =>
        set(
          (state) => {
            state.clustersStatusMap = _.set(state.clustersStatusMap, cluster, {
              connected: true,
              initializing: false,
              failed: false,
              description: null,
              title: null,
            });
          },
          false,
          "setInitializationFinished",
        ),

      publishersConfigMap,
      setPublisherSelected: (cluster, publisher, selected) =>
        set(
          (state) => {
            state.publishersConfigMap = _.set(state.publishersConfigMap, `${cluster}.${publisher}.selected`, selected);
          },
          false,
          "setPublisherSelected",
        ),
      setPublisherPermittedCount: (cluster, publisher, count) =>
        set(
          (state) => {
            state.publishersConfigMap = _.set(
              state.publishersConfigMap,
              `${cluster}.${publisher}.permittedCount`,
              count,
            );
          },
          false,
          "setPublisherPermittedCount",
        ),

      assetTypesMap,
      setAssetSelected: (cluster, asset, selected) =>
        set(
          (state) => {
            state.assetTypesMap = _.set(state.assetTypesMap, `${cluster}.${asset}`, selected);
          },
          false,
          "setAssetSelected",
        ),

      errors: {},
      setClusterError: (cluster, alert) =>
        set(
          (state) => {
            state.errors = _.set(state.errors, cluster, [..._.get(state.errors, cluster, []), alert]);
          },
          false,
          "setClusterError",
        ),

      warns: {},
      setClusterWarn: (cluster, alert) =>
        set(
          (state) => {
            state.warns = _.set(state.warns, cluster, [..._.get(state.warns, cluster, []), alert]);
          },
          false,
          "setClusterWarn",
        ),

      productsMap: {},
      setProductsMap: (cluster, productsMap) =>
        set(
          (state) => {
            state.productsMap = _.set(state.productsMap, cluster, productsMap);
          },
          false,
          "setProductsMap",
        ),
      setProduct: (cluster, productKey, productInfo) =>
        set(
          (state) => {
            state.productsMap = _.set(state.productsMap, `${cluster}.${productKey}`, productInfo);
          },
          false,
          "setProduct",
        ),

      publishingProductKeys: {},
      setPublishingProductKeys: (cluster, keys) =>
        set(
          (state) => {
            state.publishingProductKeys = _.set(state.publishingProductKeys, cluster, keys);
          },
          false,
          "setPublishingProductKeys",
        ),

      publishDetailsMap: {},
      setPublishDetailsMap: (cluster, publishDetailsMap) =>
        set(
          (state) => {
            state.publishDetailsMap = _.set(state.publishDetailsMap, cluster, publishDetailsMap);
          },
          false,
          "setPublishDetailsMap",
        ),
      setPublishDetail: (cluster, key, publishDetail) =>
        set(
          (state) => {
            state.publishDetailsMap = _.set(state.publishDetailsMap, `${cluster}.${key}`, publishDetail);
          },
          false,
          "setPublishDetail",
        ),

      uptimeMap: {},
      setUptime: (cluster, key, uptimeInfo) =>
        set(
          (state) => {
            state.uptimeMap = _.set(state.uptimeMap, `${cluster}.${key}`, uptimeInfo);
          },
          false,
          "setUptime",
        ),

      connect: async (cluster) => {
        const pythConn = _.get(get().pythConnectionsMap, cluster);
        if (!pythConn) return;

        const setInitializationDescription = (description: string) => {
          // debug output
          logger.debug("initializing", `<${cluster}>`, description);
          return get().setInitializationDescription(cluster, description);
        };
        const setInitializationError = (description: string, title?: string) =>
          get().setInitializationError(cluster, description, title);
        const cleanInitializationError = () => get().cleanInitializationError(cluster);
        const setInitializationFinished = () => get().setInitializationFinished(cluster);

        const getPublishersConfigMap = () => _.get(get().publishersConfigMap, cluster);
        const setPublisherPermittedCount = (publisher: string, count: number) =>
          get().setPublisherPermittedCount(cluster, publisher, count);

        const getProductsMap = () => _.get(get().productsMap, cluster);
        const setProductsMap = (productsMap: Record<ProductKey, ProductInfo>) =>
          get().setProductsMap(cluster, productsMap);
        const setProduct = (productKey: ProductKey, productInfo: ProductInfo) =>
          get().setProduct(cluster, productKey, productInfo);

        const getPublishingProductKeys = () => _.get(get().publishingProductKeys, cluster, []) as ProductKey[];
        const setPublishingProductKeys = (keys: ProductKey[]) => get().setPublishingProductKeys(cluster, keys);

        const getPublishDetailsMap = () => _.get(get().publishDetailsMap, cluster);
        const setPublishDetailsMap = (publishDetailsMap: Record<ProductAndPublisherKey, PublishDetail>) =>
          get().setPublishDetailsMap(cluster, publishDetailsMap);
        const setPublishDetail = (key: ProductAndPublisherKey, publishDetail: PublishDetail) =>
          get().setPublishDetail(cluster, key, publishDetail);

        // callback
        const handlePrice = (priceData: PriceData, { source, context }: { source?: string; context?: Context }) => {
          const { priceComponents, productAccountKey, exponent } = priceData;

          const productKey = productAccountKey.toBase58();

          if (!getPublishingProductKeys().includes(productKey)) return;

          const publisherKeys = _.keys(getPublishersConfigMap());

          priceComponents.forEach(({ publisher, latest, aggregate }) => {
            const publisherKey = publisher.toBase58();

            // TODO remove?
            if (!publisherKeys.includes(publisherKey)) return;

            const productAndPublisherKey = getProductAndPublisherKey(productKey, publisherKey);
            let oldValue = _.get(getPublishDetailsMap(), productAndPublisherKey);

            const productBaseInfo = _.get(productsMap, productKey);
            const publishPriceInfo = formatPythPrice(latest, exponent, publisherKey);
            const productPriceInfo = formatPythPriceData(priceData);

            if (!oldValue)
              oldValue = {
                ...productBaseInfo,
                ...publishPriceInfo,
                ...productPriceInfo,
              };

            let newValue = _.cloneDeep(oldValue);
            newValue = {
              ...newValue,
              ...publishPriceInfo,
              ...productPriceInfo,
            };

            if (oldValue.publishSlot === newValue.publishSlot) return;

            // handle slot override if subscribed to multiple sources
            // if (publishPriceInfo.publishSlot > newValue.publishSlot) newValue = { ...newValue, ...publishPriceInfo };

            const result = diff(oldValue, newValue);
            if (!_.isEmpty(result)) {
              setPublishDetail(productAndPublisherKey, newValue);

              // if (newValue.base === "RAY") console.log(`${source} diff:`, result, context);
            }
          });
        };

        const onPythPrice = (product: Product, priceData: PriceData) => {
          handlePrice(priceData, { source: "onPythPrice" });
        };
        const onProgramAccountChange = ({ accountId, accountInfo }: KeyedAccountInfo, context: Context) => {
          const priceData = parsePriceData(accountInfo.data);

          handlePrice(priceData, { source: "onProgramAccountChange", context });
        };
        const onAccountChange = (accountInfo: AccountInfo<Buffer>, context: Context) => {
          const priceData = parsePriceData(accountInfo.data);

          handlePrice(priceData, { source: "onAccountChange", context });
        };

        const flow = WorkFlow.create();
        cleanInitializationError();

        // index for product base info
        const productsMap: Record<ProductKey, ProductInfo> = {};
        const publishingProductKeys: ProductKey[] = [];
        const publishDetailsMap: Record<ProductAndPublisherKey, PublishDetail> = {};

        flow.add(() => {
          setInitializationDescription("Fetching product pubkeys...");

          return getPythProductAccountPubkeys(cluster, pythConn.connection);
        }, "Fetch products pubkeys");

        flow.add((productPubkeys: PublicKey[]) => {
          setInitializationDescription(`Fetched product pubkeys, total: ${productPubkeys.length}`);
          setInitializationDescription("Fetching product accounts data...");

          return getMultipleAccountsInfoWithCustomFlags(
            pythConn.connection,
            productPubkeys.map((pubkey) => ({ pubkey })),
          );
        }, "Fetch product accounts data");

        flow.add((productAccountsInfo: { accountInfo: AccountInfo<Buffer> | null; pubkey: PublicKey }[]) => {
          setInitializationDescription(`Fetched product accounts data, total: ${productAccountsInfo.length}`);
          setInitializationDescription("Fetching price accounts data...");

          const priceAccountKeys: { pubkey: PublicKey }[] = _.compact(
            productAccountsInfo.map(({ accountInfo, pubkey: productPubkey }) => {
              if (accountInfo) {
                const productData = parseProductData(accountInfo.data);
                const { product, priceAccountKey } = productData;
                const productKey = productPubkey.toBase58();

                productsMap[productKey] = formatPythProduct(product, productKey);

                if (priceAccountKey) return { pubkey: priceAccountKey };
              }
            }),
          );
          return getMultipleAccountsInfoWithCustomFlags(pythConn.connection, priceAccountKeys);
        }, "Fetch price accounts data");

        flow.add((priceAccountsInfo: { accountInfo: AccountInfo<Buffer> | null; pubkey: PublicKey }[]) => {
          setInitializationDescription(`Fetched price accounts data, total: ${priceAccountsInfo.length}`);

          priceAccountsInfo.forEach(({ accountInfo }) => {
            if (accountInfo) {
              const priceData = parsePriceData(accountInfo.data);
              const { priceComponents, productAccountKey, exponent } = priceData;

              const productKey = productAccountKey.toBase58();

              priceComponents.forEach(({ publisher, latest }) => {
                const publisherKey = publisher.toBase58();

                // TODO remove?
                if (!_.keys(getPublishersConfigMap()).includes(publisherKey)) return;

                publishingProductKeys.push(productKey);
                _.set(publishDetailsMap, getProductAndPublisherKey(productKey, publisherKey), {
                  ..._.get(productsMap, productKey),
                  ...formatPythPrice(latest, exponent, publisherKey),
                  ...formatPythPriceData(priceData),
                });
              });
            }
          }, "Fetch price accounts data");

          // set data
          setProductsMap(productsMap);
          setPublishingProductKeys(_.uniq(publishingProductKeys));
          setPublishDetailsMap(publishDetailsMap);

          _.keys(getPublishersConfigMap()).forEach((publisherKey) => {
            let permittedCount = 0;

            _.values(publishDetailsMap).forEach(({ publisherAccount }) => {
              if (publisherAccount === publisherKey) permittedCount++;
            });

            setInitializationDescription(`Updated publisher ${publisherKey} permissions, total: ${permittedCount}`);
            setPublisherPermittedCount(publisherKey, permittedCount);
          });

          setInitializationDescription(`Filtered products, total ${_.keys(publishDetailsMap).length}`);
        });

        flow.add(() => {
          setInitializationDescription("Starting Pyth...");

          pythConn.start();
        }, "Starting Pyth");

        flow.add(() => {
          setInitializationDescription("Subscribe Pyth onPriceChange...");

          // pythConn.onPriceChange(onPythPrice);

          // product account 512 bytes
          // price account  3312 bytes
          //   pythConn.connection.onProgramAccountChange(
          //     getPythProgramKeyForCluster(cluster),
          //     onProgramAccountChange,
          //     "confirmed",
          //     [{ dataSize: 3312 }],
          //   );

          _.values(publishDetailsMap).forEach(({ priceAccount }) => {
            pythConn.connection.onAccountChange(new PublicKey(priceAccount), onAccountChange, "confirmed");
          });
        }, "Subscribe Pyth onPriceChange");

        await flow.execute({
          // next: (result, index) => console.log("task:", index, result),
          error: (message, title) => setInitializationError(message, title),
          complete: () => setInitializationFinished(),
        });
      },
    })),
  ),
);
