import { AntDesign, FontAwesome5, FontAwesome6 } from "@expo/vector-icons";
import { withUniwind } from "uniwind";

/**
 * Shared `withUniwind`-wrapped third-party components, so `className` support
 * is defined once per component instead of being redeclared at each call site.
 */

const colorFromClassName = {
  color: {
    fromClassName: "className" as const,
    styleProperty: "color" as const,
  },
};

export const StyledAntDesign = withUniwind(AntDesign, colorFromClassName);
export const StyledFontAwesome5 = withUniwind(FontAwesome5, colorFromClassName);
export const StyledFontAwesome6 = withUniwind(FontAwesome6, colorFromClassName);
