import { Button, type ButtonProps } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { cn, goBack } from "@/lib/utils";
import { ArrowLeft } from "lucide-react-native";

type BackButtonProps = Omit<ButtonProps, "children">;

const BackButton = ({
  className,
  onPress = goBack,
  ...props
}: BackButtonProps) => (
  <Button
    className={cn("rounded-full", className)}
    variant="outline"
    size="icon"
    onPress={onPress}
    {...props}
  >
    <Icon as={ArrowLeft} />
  </Button>
);

export { BackButton };
