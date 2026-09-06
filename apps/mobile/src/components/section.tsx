import { Text, TextClassContext } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react-native";
import React from "react";
import { TouchableOpacity, View, type ViewProps } from "react-native";
import { Icon } from "./ui/icon";

function Section({
  className,
  ...props
}: ViewProps & React.RefAttributes<View>) {
  return (
    <TextClassContext.Provider value="text-card-foreground">
      <View className={cn("gap-2", className)} {...props} />
    </TextClassContext.Provider>
  );
}

function SectionHeader({
  className,
  ...props
}: ViewProps & React.RefAttributes<View>) {
  return <View className={cn("flex flex-col gap-1.5", className)} {...props} />;
}

function SectionTitle({
  className,
  ...props
}: React.ComponentProps<typeof Text> & React.RefAttributes<Text>) {
  return (
    <Text
      role="heading"
      aria-level={3}
      className={cn("font-semibold leading-none", className)}
      {...props}
    />
  );
}

function SectionDescription({
  className,
  ...props
}: React.ComponentProps<typeof Text> & React.RefAttributes<Text>) {
  return (
    <Text
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

// The section tells each row whether it is the last one, so a row keeps its
// place through a wrapper like `Link asChild` or `DialogTrigger asChild`.
const IsLastItemContext = React.createContext(false);

function SectionContent({
  className,
  children,
  ...props
}: ViewProps & React.RefAttributes<View>) {
  // `toArray` drops the null and the false that a conditional row leaves, so
  // the last entry is the last row that shows.
  const items = React.Children.toArray(children);

  return (
    <View
      className={cn(
        "bg-card border-border flex flex-col rounded-xl border shadow-sm shadow-black/5 overflow-hidden",
        className,
      )}
      {...props}
    >
      {items.map((child, index) => (
        <IsLastItemContext.Provider
          key={React.isValidElement(child) ? child.key : index}
          value={index === items.length - 1}
        >
          {child}
        </IsLastItemContext.Provider>
      ))}
    </View>
  );
}

function SectionItem({
  className,
  onPress,
  ...viewProps
}: ViewProps &
  React.RefAttributes<View> & {
    onPress?: () => void;
  }) {
  const isLast = React.useContext(IsLastItemContext);

  const content = (
    <View
      className={cn(
        "flex-row gap-3 h-11 px-3 items-center",
        !isLast && "border-b border-border",
        className,
      )}
      {...viewProps}
    />
  );

  if (onPress != null) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

function SectionItemTitle({
  className,
  ...props
}: React.ComponentProps<typeof Text> & React.RefAttributes<Text>) {
  return (
    <Text
      role="heading"
      aria-level={3}
      className={cn("font-semibold", className)}
      {...props}
    />
  );
}

function SectionItemContent({
  className,
  textClassName,
  children,
  ...props
}: ViewProps & React.RefAttributes<View> & { textClassName?: string }) {
  if (children === undefined) {
    return (
      <View className={cn("ml-auto", className)}>
        <Icon as={ChevronRight} />
      </View>
    );
  }

  if (typeof children === "string") {
    return (
      <View
        className={cn("ml-auto flex-row gap-1 items-center", className)}
        {...props}
      >
        <Text className={cn("text-muted-foreground", textClassName)}>
          {children}
        </Text>
        <Icon as={ChevronRight} />
      </View>
    );
  }

  return (
    <View className={cn("ml-auto", className)} {...props}>
      {children}
    </View>
  );
}

export {
  Section,
  SectionContent,
  SectionDescription,
  SectionHeader,
  SectionItem,
  SectionItemContent,
  SectionItemTitle,
  SectionTitle,
};
