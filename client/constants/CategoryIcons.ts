import { Feather } from "@expo/vector-icons";

export type BudgetIcon = {
  id: string;
  name: keyof typeof Feather.glyphMap;
  label: string;
};

export type IconCategory =
  | "food"
  | "transport"
  | "home"
  | "shopping"
  | "entertainment"
  | "finance"
  | "health"
  | "travel"
  | "tech"
  | "personal"
  | "education"
  | "pets"
  | "social"
  | "kids"
  | "charity"
  | "other";

export const ICONS: BudgetIcon[] = [
  // ── Food & Dining ──────────────────────────────────────────────────────
  { id: "coffee", name: "coffee", label: "Coffee" },
  { id: "shopping-cart", name: "shopping-cart", label: "Groceries" },
  { id: "shopping-bag", name: "shopping-bag", label: "Shopping Bag" },
  { id: "box", name: "box", label: "Takeout" },
  { id: "gift", name: "gift", label: "Gifts" },
  { id: "package", name: "package", label: "Delivery" },
  { id: "aperture", name: "aperture", label: "Dining Out" },
  { id: "disc", name: "disc", label: "Plate" },

  // ── Transportation ─────────────────────────────────────────────────────
  { id: "truck", name: "truck", label: "Car / Vehicle" },
  { id: "navigation", name: "navigation", label: "Navigation" },
  { id: "navigation-2", name: "navigation-2", label: "Directions" },
  { id: "map", name: "map", label: "Map" },
  { id: "map-pin", name: "map-pin", label: "Location" },
  { id: "compass", name: "compass", label: "Compass" },
  { id: "anchor", name: "anchor", label: "Anchor / Harbour" },
  { id: "send", name: "send", label: "Commute" },
  { id: "wind", name: "wind", label: "Wind / Fuel" },

  // ── Home & Utilities ───────────────────────────────────────────────────
  { id: "home", name: "home", label: "Home" },
  { id: "zap", name: "zap", label: "Electricity" },
  { id: "zap-off", name: "zap-off", label: "Power Off" },
  { id: "wifi", name: "wifi", label: "Internet" },
  { id: "wifi-off", name: "wifi-off", label: "No Internet" },
  { id: "droplet", name: "droplet", label: "Water" },
  { id: "tool", name: "tool", label: "Maintenance" },
  { id: "settings", name: "settings", label: "Settings" },
  { id: "sliders", name: "sliders", label: "Controls" },
  { id: "thermometer", name: "thermometer", label: "Temperature" },
  { id: "cloud", name: "cloud", label: "Cloud" },
  { id: "cloud-rain", name: "cloud-rain", label: "Rain / Weather" },
  { id: "cloud-snow", name: "cloud-snow", label: "Snow / Heating" },
  { id: "umbrella", name: "umbrella", label: "Insurance" },
  { id: "trash-2", name: "trash-2", label: "Waste" },
  { id: "layout", name: "layout", label: "Furniture" },
  { id: "grid", name: "grid", label: "Floor Plan" },

  // ── Finance & Bills ────────────────────────────────────────────────────
  { id: "credit-card", name: "credit-card", label: "Credit Card" },
  { id: "dollar-sign", name: "dollar-sign", label: "Money" },
  { id: "trending-up", name: "trending-up", label: "Investments" },
  { id: "trending-down", name: "trending-down", label: "Expenses" },
  { id: "save", name: "save", label: "Savings" },
  { id: "percent", name: "percent", label: "Interest / Tax" },
  { id: "bar-chart", name: "bar-chart", label: "Reports" },
  { id: "bar-chart-2", name: "bar-chart-2", label: "Analytics" },
  { id: "pie-chart", name: "pie-chart", label: "Budget Chart" },
  { id: "database", name: "database", label: "Vault / Storage" },
  { id: "file-text", name: "file-text", label: "Invoice" },
  { id: "file", name: "file", label: "Receipt" },
  { id: "inbox", name: "inbox", label: "Bills" },
  { id: "layers", name: "layers", label: "Subscriptions" },
  { id: "repeat", name: "repeat", label: "Recurring" },
  { id: "refresh-cw", name: "refresh-cw", label: "Refund" },

  // ── Shopping ───────────────────────────────────────────────────────────
  { id: "tag", name: "tag", label: "Sale / Tag" },
  { id: "scissors-shopping", name: "scissors", label: "Coupons" },
  { id: "award", name: "award", label: "Rewards" },
  { id: "target", name: "target", label: "Deals" },
  { id: "pocket", name: "pocket", label: "Pocket Money" },
  { id: "loader", name: "loader", label: "Processing" },

  // ── Entertainment ──────────────────────────────────────────────────────
  { id: "film", name: "film", label: "Movies" },
  { id: "music", name: "music", label: "Music" },
  { id: "headphones", name: "headphones", label: "Audio" },
  { id: "play", name: "play", label: "Games" },
  { id: "play-circle", name: "play-circle", label: "Streaming" },
  { id: "tv", name: "tv", label: "TV" },
  { id: "speaker", name: "speaker", label: "Speaker" },
  { id: "volume-2", name: "volume-2", label: "Sound" },
  { id: "radio", name: "radio", label: "Radio / Podcast" },
  { id: "mic", name: "mic", label: "Microphone" },
  { id: "camera", name: "camera", label: "Camera" },
  { id: "video", name: "video", label: "Video" },
  { id: "image", name: "image", label: "Photos" },
  { id: "cast", name: "cast", label: "Cast / Stream" },
  { id: "youtube", name: "youtube", label: "YouTube" },
  { id: "twitch", name: "twitch", label: "Twitch" },

  // ── Health & Fitness ───────────────────────────────────────────────────
  { id: "heart", name: "heart", label: "Health" },
  { id: "activity", name: "activity", label: "Fitness" },
  { id: "smile", name: "smile", label: "Wellbeing" },
  { id: "frown", name: "frown", label: "Mental Health" },
  { id: "meh", name: "meh", label: "Mood" },
  { id: "eye", name: "eye", label: "Eye Care" },
  { id: "shield", name: "shield", label: "Protection" },
  { id: "plus-circle", name: "plus-circle", label: "Pharmacy" },
  { id: "crosshair", name: "crosshair", label: "Focus" },

  // ── Travel ─────────────────────────────────────────────────────────────
  { id: "briefcase", name: "briefcase", label: "Travel / Work" },
  { id: "airplay", name: "airplay", label: "Flights" },
  { id: "sun", name: "sun", label: "Vacation" },
  { id: "sunrise", name: "sunrise", label: "Sunrise Trip" },
  { id: "sunset", name: "sunset", label: "Sunset Trip" },
  { id: "moon", name: "moon", label: "Overnight" },
  { id: "globe", name: "globe", label: "International" },
  { id: "feather", name: "feather", label: "Light Travel" },

  // ── Education & Work ───────────────────────────────────────────────────
  { id: "book", name: "book", label: "Books" },
  { id: "book-open", name: "book-open", label: "Reading" },
  { id: "bookmark", name: "bookmark", label: "Bookmarks" },
  { id: "edit", name: "edit", label: "Writing" },
  { id: "edit-2", name: "edit-2", label: "Notes" },
  { id: "edit-3", name: "edit-3", label: "Journaling" },
  { id: "clipboard", name: "clipboard", label: "Tasks" },
  { id: "calendar", name: "calendar", label: "Calendar" },
  { id: "clock", name: "clock", label: "Time" },
  { id: "file-plus", name: "file-plus", label: "New Document" },
  { id: "folder", name: "folder", label: "Folder" },
  { id: "printer", name: "printer", label: "Printing" },
  { id: "paperclip", name: "paperclip", label: "Attachments" },
  { id: "pen-tool", name: "pen-tool", label: "Design" },
  { id: "type", name: "type", label: "Typography" },
  { id: "search", name: "search", label: "Research" },

  // ── Technology ─────────────────────────────────────────────────────────
  { id: "smartphone", name: "smartphone", label: "Phone" },
  { id: "tablet", name: "tablet", label: "Tablet" },
  { id: "cpu", name: "cpu", label: "Hardware" },
  { id: "monitor", name: "monitor", label: "Monitor" },
  { id: "hard-drive", name: "hard-drive", label: "Storage" },
  { id: "server", name: "server", label: "Server / Hosting" },
  { id: "bluetooth", name: "bluetooth", label: "Bluetooth" },
  { id: "battery", name: "battery", label: "Battery" },
  { id: "battery-charging", name: "battery-charging", label: "Charging" },
  { id: "power", name: "power", label: "Power" },
  { id: "terminal", name: "terminal", label: "Developer" },
  { id: "code", name: "code", label: "Coding" },
  { id: "download", name: "download", label: "Downloads" },
  { id: "upload", name: "upload", label: "Uploads" },
  { id: "link", name: "link", label: "Links" },
  { id: "rss", name: "rss", label: "RSS / Feed" },
  { id: "share-2", name: "share-2", label: "Share" },

  // ── Social & Communication ─────────────────────────────────────────────
  { id: "phone", name: "phone", label: "Phone Call" },
  { id: "phone-call", name: "phone-call", label: "Calling" },
  { id: "message-square", name: "message-square", label: "Messages" },
  { id: "message-circle", name: "message-circle", label: "Chat" },
  { id: "mail", name: "mail", label: "Email" },
  { id: "at-sign", name: "at-sign", label: "Email / Social" },
  { id: "instagram", name: "instagram", label: "Instagram" },
  { id: "twitter", name: "twitter", label: "Twitter" },
  { id: "facebook", name: "facebook", label: "Facebook" },
  { id: "github", name: "github", label: "GitHub" },
  { id: "linkedin", name: "linkedin", label: "LinkedIn" },

  // ── Personal & Lifestyle ───────────────────────────────────────────────
  { id: "user", name: "user", label: "Personal" },
  { id: "users", name: "users", label: "Family" },
  { id: "user-plus", name: "user-plus", label: "Friends" },
  { id: "user-check", name: "user-check", label: "Verified" },
  { id: "lock", name: "lock", label: "Security" },
  { id: "unlock", name: "unlock", label: "Unlock" },
  { id: "key", name: "key", label: "Keys" },
  { id: "watch", name: "watch", label: "Watch" },
  { id: "scissors-personal", name: "scissors", label: "Haircut" },
  { id: "life-buoy", name: "life-buoy", label: "Support" },
  { id: "hash", name: "hash", label: "Number / Tag" },

  // ── Kids & Pets ────────────────────────────────────────────────────────
  { id: "feather-pets", name: "feather", label: "Pets" },
  { id: "hexagon", name: "hexagon", label: "Toys" },
  { id: "star-kids", name: "star", label: "Favorites" },
  { id: "circle", name: "circle", label: "Playful" },
  { id: "square", name: "square", label: "Blocks" },
  { id: "triangle", name: "triangle", label: "Shapes" },

  // ── Charity & Giving ───────────────────────────────────────────────────
  { id: "gift-charity", name: "gift", label: "Donation" },
  { id: "heart-charity", name: "heart", label: "Charity" },
  { id: "globe-charity", name: "globe", label: "Causes" },
  { id: "thumbs-up", name: "thumbs-up", label: "Support" },

  // ── Miscellaneous ──────────────────────────────────────────────────────
  { id: "bell", name: "bell", label: "Alerts" },
  { id: "bell-off", name: "bell-off", label: "Silent" },
  { id: "flag", name: "flag", label: "Goals" },
  { id: "archive", name: "archive", label: "Archive" },
  { id: "trash", name: "trash", label: "Trash" },
  { id: "check-circle", name: "check-circle", label: "Done" },
  { id: "x-circle", name: "x-circle", label: "Cancel" },
  { id: "alert-circle", name: "alert-circle", label: "Alert" },
  { id: "alert-triangle", name: "alert-triangle", label: "Warning" },
  { id: "info", name: "info", label: "Info" },
  { id: "help-circle", name: "help-circle", label: "Help" },
  { id: "minus-circle", name: "minus-circle", label: "Remove" },
  { id: "slash", name: "slash", label: "Blocked" },
  { id: "rotate-cw", name: "rotate-cw", label: "Sync" },
  { id: "maximize-2", name: "maximize-2", label: "Expand" },
  { id: "minimize-2", name: "minimize-2", label: "Minimize" },
  { id: "move", name: "move", label: "Move" },
  { id: "command", name: "command", label: "Command" },
  { id: "more-horizontal", name: "more-horizontal", label: "More" },
  { id: "more-vertical", name: "more-vertical", label: "Options" },
];
