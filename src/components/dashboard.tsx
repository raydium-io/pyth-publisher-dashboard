import { useCallback, useEffect } from "react";
import { CloseCircleFilled, ExclamationCircleOutlined, LoadingOutlined } from "@ant-design/icons";
import { PythCluster } from "@pythnetwork/client";
import { Button, Checkbox, Col, Result, Row, Space, Spin, Table, Typography } from "antd";
import type { ColumnsType } from "antd/es/table/interface";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import updateLocale from "dayjs/plugin/updateLocale";
import _ from "lodash";
import { Bar, BarChart, Rectangle, Tooltip as ReTooltip, TooltipProps as ReTooltipProps, XAxis } from "recharts";
import { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";

import { Center, DynamicNumber, Text, Tooltip } from "@/components/ui";
import { StatusTexts } from "@/constant";
import { useStore } from "@/store";
import { ClusterStatus, PublishDetail, UptimeInfo } from "@/type";
import { getQuoteSymbol, PYTH_LINK, shortAddress } from "@/utils";
import { fetchUptime } from "@/utils/api";

dayjs.extend(relativeTime);
dayjs.extend(updateLocale);
dayjs.updateLocale("en", {
  // https://day.js.org/docs/en/display/from-now
  relativeTime: {
    ...dayjs.Ls.en.relativeTime,
    s: "%ds",
    ss: "%ds",
  },
});

const { Link } = Typography;

export const DashboardCheckbox = ({ cluster }: { cluster: PythCluster }) => {
  const publishersConfigMap = useStore((state) => state.publishersConfigMap);
  const getPublishers = useCallback(() => _.get(publishersConfigMap, cluster), [cluster, publishersConfigMap]);
  const setPublisherSelected = useStore((state) => state.setPublisherSelected);

  const assetTypesMap = useStore((state) => state.assetTypesMap);
  const getAssetTypes = useCallback(() => _.get(assetTypesMap, cluster), [cluster, assetTypesMap]);
  const setAssetSelected = useStore((state) => state.setAssetSelected);

  return (
    <Row>
      <Col span={12}>
        <Space direction="vertical">
          <Text>Publishers:</Text>
          {_.entries(getPublishers()).map(([publisher, { selected, permittedCount }]) => (
            <Checkbox
              key={publisher}
              checked={selected}
              onChange={(event) => setPublisherSelected(cluster, publisher, event.target.checked)}
            >
              {publisher} ({permittedCount})
            </Checkbox>
          ))}
        </Space>
      </Col>
      <Col span={12}>
        <Space direction="vertical">
          <Text>Asset Types:</Text>
          <Space>
            {_.entries(getAssetTypes()).map(([assetType, selected]) => (
              <Checkbox
                key={assetType}
                checked={selected}
                onChange={(event) => setAssetSelected(cluster, assetType, event.target.checked)}
              >
                {assetType}
              </Checkbox>
            ))}
          </Space>
        </Space>
      </Col>
    </Row>
  );
};

// https://github.com/recharts/recharts/issues/280
const ColourfulBar = (props: UptimeInfo) => {
  let color = "";

  if (props.slotHitRate > 0.95) color = "green";
  else if (props.slotHitRate > 0.8) color = "orange";
  else color = "red";

  return <Rectangle {...props} fill={`var(--colors-${color}-300)`} />;
};

const CustomTooltip = ({ active, payload, label }: ReTooltipProps<ValueType, NameType>) => {
  if (active && payload && payload.length) {
    return (
      <Space
        direction="vertical"
        style={{
          whiteSpace: "nowrap",
          backgroundColor: "var(--colors-gray-200)",
          padding: "var(--space-2)",
        }}
      >
        <Text fontSize="xs">{dayjs(label).format("MM-DD HH:mm:ss Z")}</Text>
        <Text fontSize="sm">{((payload[0].value as number) * 100).toFixed(2)}%</Text>
      </Space>
    );
  }

  return null;
};

export const PublisherUptime = ({ cluster, publishDetail }: { cluster: PythCluster; publishDetail: PublishDetail }) => {
  const uptimeMap = useStore((state) => state.uptimeMap);
  const getUptime = useCallback(
    () =>
      _.get(
        uptimeMap,
        `${cluster}.${publishDetail.productAccount}_${publishDetail.publisherAccount}`,
        [],
      ) as UptimeInfo[],
    [cluster, uptimeMap],
  );
  const setUptime = useStore((state) => state.setUptime);

  useEffect(() => {
    if (!getUptime().length) fetch();
  }, []);

  const fetch = async () => {
    const uptime = await fetchUptime({
      symbol: publishDetail.symbol,
      cluster: cluster,
      publisher: publishDetail.publisherAccount,
    });
    setUptime(cluster, `${publishDetail.productAccount}_${publishDetail.publisherAccount}`, uptime);
  };

  if (!getUptime().length) return <Spin indicator={<LoadingOutlined style={{ fontSize: 20 }} spin />} />;

  return (
    <BarChart width={150} height={40} data={getUptime()}>
      <XAxis dataKey="timestamp" hide />
      <ReTooltip content={<CustomTooltip />} wrapperStyle={{ zIndex: 99 }} position={{ y: 40 }} />
      <Bar name="Hit Rate" dataKey="slotHitRate" shape={ColourfulBar} />
    </BarChart>
  );
};

export const DashboardTable = ({ cluster }: { cluster: PythCluster }) => {
  const publishersConfigMap = useStore((state) => state.publishersConfigMap);
  const getPublishers = useCallback(() => _.get(publishersConfigMap, cluster), [cluster, publishersConfigMap]);
  const getSelectedPublishers = useCallback(
    () => _.keys(_.pickBy(_.get(publishersConfigMap, cluster), ({ selected }, publisher) => selected)),
    [cluster, publishersConfigMap],
  );

  const assetTypesMap = useStore((state) => state.assetTypesMap);
  const getAssetTypes = useCallback(() => _.get(assetTypesMap, cluster), [cluster, assetTypesMap]);
  const getSelectedAssetTypes = useCallback(
    () => _.keys(_.pickBy(_.get(assetTypesMap, cluster), (selected, publisher) => selected)),
    [cluster, assetTypesMap],
  );

  const publishDetailsMap = useStore((state) => state.publishDetailsMap);
  const getPublishDetails = useCallback(() => _.get(publishDetailsMap, cluster, {}), [cluster, publishDetailsMap]);

  const columns: ColumnsType<PublishDetail> = [
    {
      title: "Product",
      key: "product",
      render: ($, record) => (
        <Tooltip
          title={
            <Space size={4}>
              <Space direction="vertical" size={2}>
                <Text fontSize="xs">Product status:</Text>
                <Text fontSize="xs">Product account:</Text>
                <Text fontSize="xs">Price account:</Text>
                <Text fontSize="xs">Product summary:</Text>
              </Space>
              <Space direction="vertical" size={2}>
                <Text fontSize="xs">{StatusTexts[record.productStatus]}</Text>
                <Text fontSize="xs">{record.productAccount}</Text>
                <Text fontSize="xs">{record.priceAccount}</Text>
                <Link
                  href={PYTH_LINK.productPage(record.symbol.replace(/[\\.\\/]/g, "-").toLowerCase(), cluster)}
                  target="_blank"
                >
                  <Text fontSize="xs" underline>
                    View on Pyth
                  </Text>
                </Link>
              </Space>
            </Space>
          }
        >
          <Space direction="vertical" size={2} style={{ cursor: "pointer" }}>
            <Text fontSize="md">
              {record.base}/{record.quoteCurrency}
              {record.productStatus !== 1 && (
                <ExclamationCircleOutlined
                  style={{ marginLeft: "var(--space-1)", color: "var(--colors-orange-300)" }}
                />
              )}
            </Text>
            <Text fontSize="xs" color="var(--colors-gray-500)">
              {record.assetType}
            </Text>
          </Space>
        </Tooltip>
      ),
      shouldCellUpdate: (record, prevRecord) => false,
      defaultSortOrder: "ascend",
      sorter: (a, b) => a.genericSymbol.localeCompare(b.genericSymbol),
      // !tricky if selected publishers, onFilter will not be called
      filteredValue: getSelectedAssetTypes().length ? getSelectedAssetTypes() : ["null"],
      onFilter: (value: string | number | boolean, record) => {
        // console.log("onFilter", value);
        return value === record.assetType;
      },
    },
    {
      title: "Publisher",
      key: "publisher",
      dataIndex: "publisherAccount",
      render: ($, record) => (
        <Tooltip
          title={
            <Space size={4}>
              <Space direction="vertical" size={2}>
                <Text fontSize="xs">Publisher account:</Text>
                <Text fontSize="xs">Publisher metrics:</Text>
              </Space>
              <Space direction="vertical" size={2}>
                <Text fontSize="xs">{record.publisherAccount}</Text>
                <Link
                  href={PYTH_LINK.publisherPage(
                    record.symbol.replace(/[\\.\\/]/g, "-").toLowerCase(),
                    cluster,
                    record.publisherAccount,
                  )}
                  target="_blank"
                >
                  <Text fontSize="xs" underline>
                    View on Pyth
                  </Text>
                </Link>
              </Space>
            </Space>
          }
        >
          <Text fontSize="sm" style={{ cursor: "pointer" }}>
            {shortAddress(record.publisherAccount)}
          </Text>
        </Tooltip>
      ),
      shouldCellUpdate: (record, prevRecord) => false,
      sorter: (a, b) => a.publisherAccount.localeCompare(b.publisherAccount),
      // !tricky if selected publishers, onFilter will not be called
      filteredValue: getSelectedPublishers().length ? getSelectedPublishers() : ["null"],
      onFilter: (value: string | number | boolean, record) => {
        // console.log("onFilter", value);
        return value === record.publisherAccount;
      },
    },
    {
      title: "Last Updated",
      key: "updated",
      render: ($, record) => <Text fontSize="sm">{dayjs(record.timestamp * 1000).fromNow()}</Text>,
      // shouldCellUpdate: (record, prevRecord) => record.timestamp !== prevRecord.timestamp,
    },
    {
      title: "Slot",
      key: "slot",
      render: ($, record) => (
        <Space size={4}>
          <Space direction="vertical" size={2}>
            <Text fontSize="sm">Publish:</Text>
            <Text fontSize="xs" color="var(--colors-gray-500)">
              Valid:
            </Text>
          </Space>
          <Space direction="vertical" size={2}>
            <Text fontSize="sm">{record.publishSlot}</Text>
            <Text fontSize="xs" color="var(--colors-gray-500)">
              {record.validSlot}
            </Text>
          </Space>
        </Space>
      ),
      shouldCellUpdate: (record, prevRecord) =>
        record.publishSlot !== prevRecord.publishSlot || record.validSlot !== prevRecord.validSlot,
    },
    {
      title: "Price",
      key: "price",
      render: ($, record) => (
        <Space size={4}>
          <Space direction="vertical" size={2}>
            <Text fontSize="sm">Publisher:</Text>
            <Text fontSize="xs" color="var(--colors-gray-500)">
              Product:
            </Text>
          </Space>
          <Space direction="vertical" size={2}>
            <DynamicNumber fontSize="sm" prefix={getQuoteSymbol(record.quoteCurrency)} num={record.price} />
            <DynamicNumber
              fontSize="xs"
              color="var(--colors-gray-500)"
              prefix={getQuoteSymbol(record.quoteCurrency)}
              num={record.productPrice}
            />
          </Space>
        </Space>
      ),
      shouldCellUpdate: (record, prevRecord) =>
        record.price !== prevRecord.price || record.productPrice !== prevRecord.productPrice,
    },
    {
      title: "Confidence",
      key: "confidence",
      render: ($, record) => (
        <Space size={4}>
          <Space direction="vertical" size={2}>
            <Text fontSize="sm">Publisher:</Text>
            <Text fontSize="xs" color="var(--colors-gray-500)">
              Product:
            </Text>
          </Space>
          <Space direction="vertical" size={2}>
            <DynamicNumber fontSize="sm" prefix={`${getQuoteSymbol(record.quoteCurrency)}±`} num={record.confidence} />
            <DynamicNumber
              fontSize="xs"
              color="var(--colors-gray-500)"
              prefix={`${getQuoteSymbol(record.quoteCurrency)}±`}
              num={record.productConfidence}
            />
          </Space>
        </Space>
      ),
      shouldCellUpdate: (record, prevRecord) =>
        record.confidence !== prevRecord.confidence || record.productConfidence !== prevRecord.productConfidence,
    },
    {
      title: "Uptime",
      key: "uptime",
      render: ($, record) => <PublisherUptime cluster={cluster} publishDetail={record} />,
      shouldCellUpdate: (record, prevRecord) => false,
    },
  ];

  return (
    <Table
      columns={columns}
      dataSource={_.values(getPublishDetails())}
      rowKey={(record) => `${record.productAccount}_${record.publisherAccount}`}
      bordered
      pagination={false}
      showSorterTooltip={false}
      rowClassName={(record) => {
        if (record.price === "0") return "bg-error";
        return "";
      }}
    />
  );
};

export const Dashboard = ({ cluster }: { cluster: PythCluster }) => {
  const connect = useStore((state) => state.connect);

  const clustersStatusMap = useStore((state) => state.clustersStatusMap);
  const getStatus = useCallback(() => _.get(clustersStatusMap, cluster) as ClusterStatus, [cluster, clustersStatusMap]);

  useEffect(() => {
    connect(cluster);

    return () => {
      // disconnect
    };
  }, []);

  if (!getStatus().connected || getStatus().initializing)
    return (
      <Center>
        <Result
          icon={
            getStatus().failed ? (
              <CloseCircleFilled style={{ color: "var(--colors-red-400)" }} />
            ) : (
              <Spin indicator={<LoadingOutlined style={{ fontSize: 60 }} spin />} />
            )
          }
          title={getStatus().title}
          subTitle={getStatus().description}
          extra={
            getStatus().failed && (
              <Button type="primary" onClick={() => connect(cluster)}>
                Retry
              </Button>
            )
          }
        />
      </Center>
    );

  return (
    <Space direction="vertical" size={16}>
      <DashboardCheckbox cluster={cluster} />
      <DashboardTable cluster={cluster} />
    </Space>
  );
};
