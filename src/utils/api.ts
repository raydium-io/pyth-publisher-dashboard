import { PythCluster } from "@pythnetwork/client";
import Axios from "axios";

import { PublisherKey, UptimeInfo } from "@/type";

export const pythApi = Axios.create({
  baseURL: "https://web-api.pyth.network",
});
pythApi.interceptors.response.use((response) => response.data);

export type UptimeResponse = Array<{
  timestamp: string;
  aggregate_slot_count: number;
  publisher_slot_count: number;
  slot_hit_rate: number;
}>;

export const fetchUptime = async ({
  symbol,
  cluster,
  publisher,
}: {
  symbol: string;
  cluster: PythCluster;
  publisher: PublisherKey;
}): Promise<UptimeInfo[]> => {
  const data = await pythApi.get<any, UptimeResponse>("/metrics/uptime", {
    params: { symbol, range: "24H", cluster, publisher },
  });

  return data.map(({ timestamp, aggregate_slot_count, publisher_slot_count, slot_hit_rate }) => ({
    timestamp,
    aggregateSlotCount: aggregate_slot_count,
    publisherSlotCount: publisher_slot_count,
    slotHitRate: slot_hit_rate,
  }));
};
