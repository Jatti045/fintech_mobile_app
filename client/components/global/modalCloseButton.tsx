import { useTheme } from "@/hooks/useRedux";
import { Feather } from "@expo/vector-icons";
import { TouchableOpacity } from "react-native";

function ModalCloseButton({
  setOpenSheet,
}: {
  setOpenSheet: (open: boolean) => void;
}) {
  const { THEME } = useTheme();
  return (
    <TouchableOpacity
      onPress={() => setOpenSheet(false)}
      className="rounded-full p-2 items-center justify-center"
      style={{
        position: "absolute",
        backgroundColor: THEME.surface,
        right: 16,
        zIndex: 1000,
        elevation: 10,
      }}
    >
      <Feather name="x" size={24} color={THEME.textPrimary} />
    </TouchableOpacity>
  );
}

export default ModalCloseButton;
