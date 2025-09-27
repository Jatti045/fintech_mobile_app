import { Ionicons } from "@expo/vector-icons";

export function capitalizeFirst(text: string): string {
  if (!text) return "";
  const textToString = text.toString();
  return (
    textToString.charAt(0).toUpperCase() + textToString.slice(1).toLowerCase()
  );
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();

  // Remove time for accurate day difference
  const dateOnly = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );
  const nowOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const diffMs = nowOnly.getTime() - dateOnly.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;

  // Past 1 week: show formatted date
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function getCategoryIcon(
  category: string,
  color?: string,
  size?: number
) {
  switch (category.toString().toUpperCase()) {
    case "FOOD":
      return (
        <Ionicons
          name="fast-food"
          size={size || 24}
          color={color || "#FF4D6D"}
        />
      );
    case "TRANSPORT":
      return (
        <Ionicons name="car" size={size || 24} color={color || "#FF4D6D"} />
      );
    case "ENTERTAINMENT":
      return (
        <Ionicons name="film" size={size || 24} color={color || "#FF4D6D"} />
      );
    case "RENT":
      return (
        <Ionicons name="home" size={size || 24} color={color || "#FF4D6D"} />
      );
    case "OTHER":
      return (
        <Ionicons
          name="help-circle"
          size={size || 24}
          color={color || "#FF4D6D"}
        />
      );
    default:
      return (
        <Ionicons
          name="help-circle"
          size={size || 24}
          color={color || "#FF4D6D"}
        />
      );
  }
}
