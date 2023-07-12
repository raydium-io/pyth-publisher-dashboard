import "antd/dist/reset.css";
import "./index.css";

import ReactDOM from "react-dom/client";
import { ConfigProvider, Layout, Typography } from "antd";

import App from "@/App";

const { Header, Content } = Layout;
const { Title } = Typography;

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <ConfigProvider
    theme={{
      token: { fontFamily: `'Roboto Mono', monospace`, colorPrimary: "#805ad5", lineHeight: 1 },
      components: {
        Layout: { colorBgHeader: "white", colorBgBody: "white" },
        Result: { fontSizeHeading3: 20 },
      },
    }}
  >
    <Layout style={{ minHeight: "100dvh" }}>
      <Header style={{ display: "flex", alignItems: "center", borderBottom: "1px solid var(--colors-gray-200)" }}>
        <Title level={4} style={{ margin: 0 }}>
          Pyth Publisher Dashboard
        </Title>
      </Header>

      <Content style={{ display: "flex", flexDirection: "column", padding: "var(--space-4)" }}>
        <App />
      </Content>
    </Layout>
  </ConfigProvider>,
);
