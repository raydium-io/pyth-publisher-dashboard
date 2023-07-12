import { useCallback } from "react";
import { PythCluster } from "@pythnetwork/client";
import { Result, Space, Tabs } from "antd";
import _ from "lodash";

import { Dashboard } from "@/components/dashboard";
import { Center, StatusDot } from "@/components/ui";
import { useStore } from "@/store";
import { ClusterStatus } from "@/type";

const App = () => {
  const clusters = useStore((state) => state.clusters);

  const clustersStatusMap = useStore((state) => state.clustersStatusMap);
  const getStatus = useCallback(
    (cluster: PythCluster) => _.get(clustersStatusMap, cluster) as ClusterStatus,
    [clustersStatusMap],
  );

  if (!clusters.length)
    return (
      <Center>
        <Result
          status="warning"
          title="There are no clusters being set"
          subTitle="Please follow the instructions in the README to set up the clusters and publishers you want to monitoring"
        />
      </Center>
    );

  return (
    <Tabs
      type="card"
      style={{ flex: 1 }}
      items={clusters.map((cluster) => ({
        label: (
          <Space size={4}>
            <StatusDot connected={getStatus(cluster).connected} />
            {cluster}
          </Space>
        ),
        key: cluster,
        children: <Dashboard cluster={cluster} />,
      }))}
    />
  );
};

export default App;
