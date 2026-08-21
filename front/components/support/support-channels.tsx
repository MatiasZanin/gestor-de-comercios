import { Mail, MessageCircle } from "lucide-react";

const channels = [
  {
    name: "WhatsApp",
    value: "+54 11 3359-3078",
    href: "https://wa.me/5491133593078",
    icon: MessageCircle,
    className: "bg-emerald-100 text-emerald-700",
  },
  {
    name: "Mail",
    value: "clientes@gestionystock.com",
    href: "mailto:clientes@gestionystock.com",
    icon: Mail,
    className: "bg-sky-100 text-sky-700",
  },
];

export function SupportChannels() {
  return (
    <div className="space-y-4">
      {channels.map((channel) => (
        <a
          key={channel.name}
          href={channel.href}
          target={channel.name === "WhatsApp" ? "_blank" : undefined}
          rel={channel.name === "WhatsApp" ? "noreferrer" : undefined}
          className="group flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 transition hover:border-emerald-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          <span
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${channel.className}`}
          >
            <channel.icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-gray-900">
              {channel.name}
            </span>
            <span className="block break-all text-sm text-gray-600 group-hover:text-emerald-700">
              {channel.value}
            </span>
          </span>
        </a>
      ))}
    </div>
  );
}
