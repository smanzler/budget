import React from "react";
import { ScrollViewProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BodyScrollView } from "./ui/body-scroll-view";
import RefetchControl from "./refetch-control";

type Props = {
  refetch?: () => Promise<unknown>;
  isEmpty?: boolean;
  empty?: React.ReactNode;
  isLoading?: boolean;
  loading?: React.ReactNode;
};

export const RefetchScroll = ({
  refetch,
  isEmpty,
  empty,
  isLoading,
  loading,
  ...props
}: ScrollViewProps & Props) => {
  const renderBody = (bodyProps: ScrollViewProps) => (
    <BodyScrollView
      {...bodyProps}
      refreshControl={
        refetch ? <RefetchControl refetch={refetch} /> : undefined
      }
    />
  );

  const withSafe = (children: React.ReactNode) => (
    <SafeAreaView style={{ flex: 1 }} edges={["bottom"]}>
      {renderBody({ contentContainerClassName: "grow", children })}
    </SafeAreaView>
  );

  if (isLoading) return withSafe(loading);
  if (isEmpty) return withSafe(empty);

  return renderBody(props);
};
