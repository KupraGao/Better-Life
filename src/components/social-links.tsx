import { Icon } from "@/components/icon";
import { socialLinks } from "@/content/public-pages";

export function SocialLinks() {
  return (
    <div className="info-follow">
      {socialLinks.map((item) => (
        <a
          key={item.name}
          className="social-link"
          href={item.href}
          {...(item.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        >
          <Icon name={item.icon} size={18} />
          <span>{item.name}</span>
        </a>
      ))}
    </div>
  );
}
