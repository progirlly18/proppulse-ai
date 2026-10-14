import { CalendarCheck, Mail, MapPin, MessageCircle, Phone, Users, type LucideIcon } from "lucide-react";
import type { Channel } from "@/lib/schemas";

export const CHANNEL_META: Record<Channel, { label: string; icon: LucideIcon }> = {
  call: { label: "Call", icon: Phone },
  whatsapp: { label: "WhatsApp", icon: MessageCircle },
  email: { label: "Email", icon: Mail },
  site_visit: { label: "Site visit", icon: MapPin },
  meeting: { label: "Meeting", icon: Users },
};

export function ChannelIcon({ channel, className }: { channel: Channel; className?: string }) {
  const Icon = CHANNEL_META[channel]?.icon ?? CalendarCheck;
  return <Icon className={className} aria-label={CHANNEL_META[channel]?.label} />;
}
