import { cn } from "@/lib/utils";
import WhatsAppIcon from "./whatsapp-icon";

const WaCrmLogo = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
  <svg
    width="48"
    height="48"
    viewBox="0 0 48 48"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={cn(className)}
    {...props}
  >
    <g clipPath="url(#clip0_105_2)">
      <path d="M24 48C37.2548 48 48 37.2548 48 24C48 10.7452 37.2548 0 24 0C10.7452 0 0 10.7452 0 24C0 37.2548 10.7452 48 24 48Z" fill="hsl(var(--primary))"/>
      <g transform="translate(12, 12) scale(0.5)">
        <WhatsAppIcon className="text-primary-foreground" />
      </g>
    </g>
    <defs>
      <clipPath id="clip0_105_2">
        <rect width="48" height="48" fill="white"/>
      </clipPath>
    </defs>
  </svg>
);

export default WaCrmLogo;
