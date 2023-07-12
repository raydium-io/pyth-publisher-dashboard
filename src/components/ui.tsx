import { useEffect, useState } from "react";
import styled from "@emotion/styled";
import { Tooltip as AntTooltip, TooltipProps, Typography } from "antd";
import BigNumber from "bignumber.js";

import { usePrevious } from "@/utils";

const { Text: AntText } = Typography;

export const Center = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  flex: 1;
  margin-bottom: var(--space-16);
`;

interface StatusDotProps {
  connected: boolean;
}
export const StatusDot = styled.div<StatusDotProps>`
  position: relative;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: ${(props) => (props.connected ? "#48BB78" : "#F56565")};

  &::before {
    position: absolute;
    right: 0;
    content: "";
    width: 100%;
    height: 100%;
    background: inherit;
    border-radius: inherit;
    animation: wave 2s ease-out infinite;
  }

  @keyframes wave {
    50%,
    75% {
      transform: scale(2);
    }
    80%,
    100% {
      opacity: 0;
    }
  }
`;

export const Tooltip = (props: TooltipProps) => (
  <AntTooltip
    overlayStyle={{ maxWidth: "unset" }}
    overlayInnerStyle={{ minHeight: "unset" }}
    color="var(--colors-gray-200)"
    placement="right"
    mouseEnterDelay={0}
    {...props}
  />
);

interface TextProps {
  fontSize?: "md" | "sm" | "xs";
  color?: string;
}
export const Text = styled(AntText)<TextProps>`
  ${({ fontSize }) => fontSize && `font-size: var(--fontSizes-${fontSize});`}
  ${({ color }) => color && `color: ${color};`}
`;

const defaultStyles = { backgroundColor: "transparent", animation: "" };

export const DynamicNumber = ({
  num,
  prefix = "",
  ...props
}: TextProps & { num?: string | number; prefix?: string }) => {
  const prevNum = usePrevious(num);
  const [styles, setStyles] = useState(defaultStyles);

  useEffect(() => {
    if (!num || !prevNum) return;
    if (num === prevNum) return;

    // console.log("prevNum", num, prevNum);

    if (BigNumber(num).gt(prevNum)) {
      setStyles(defaultStyles);
      setStyles({
        backgroundColor: "var(--colors-green-200)",
        animation: "green-to-transparent 0.3s 1 alternate forwards",
      });
      return;
    }

    if (BigNumber(num).lt(prevNum)) {
      setStyles(defaultStyles);
      setStyles({
        backgroundColor: "var(--colors-red-200)",
        animation: "red-to-transparent 0.3s 1 alternate forwards",
      });
    }
  }, [num]);

  return (
    <Text style={styles} {...props}>
      {prefix}
      {num}
    </Text>
  );
};
