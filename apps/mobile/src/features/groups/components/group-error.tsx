import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Icon } from "@/components/ui/icon";
import { TriangleAlert } from "lucide-react-native";

type GroupErrorProps = {
  message?: string;
};

export function GroupError({ message }: GroupErrorProps) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon as={TriangleAlert} />
        </EmptyMedia>
        <EmptyTitle>Can&apos;t open this group</EmptyTitle>
        <EmptyDescription>{message}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
