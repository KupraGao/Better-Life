const contentSecurityPolicy = (nodeEnv: string | undefined) =>
  [
    "default-src 'self'",
    // React's development runtime evaluates diagnostic stacks. Production never receives this token.
    nodeEnv === "development"
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
      : "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data: https:",
    "font-src 'self'",
    "connect-src 'self'",
    "media-src 'self'",
    "worker-src 'self'",
    "frame-src 'self' https://www.youtube-nocookie.com https://player.vimeo.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(nodeEnv === "production" ? ["upgrade-insecure-requests"] : []),
  ].join("; ");

/** Single CSP used by next.config and the root redirect. */
export function securityHeaders(nodeEnv = process.env.NODE_ENV) {
  return [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Frame-Options", value: "DENY" },
    {
      key: "Permissions-Policy",
      value: [
        "accelerometer=()",
        "autoplay=(self \"https://www.youtube-nocookie.com\" \"https://player.vimeo.com\")",
        "bluetooth=()",
        "browsing-topics=()",
        "camera=()",
        "display-capture=()",
        "encrypted-media=(self \"https://www.youtube-nocookie.com\" \"https://player.vimeo.com\")",
        "fullscreen=(self \"https://www.youtube-nocookie.com\" \"https://player.vimeo.com\")",
        "geolocation=()",
        "gyroscope=()",
        "hid=()",
        "interest-cohort=()",
        "magnetometer=()",
        "microphone=()",
        "midi=()",
        "payment=()",
        "picture-in-picture=(self \"https://www.youtube-nocookie.com\" \"https://player.vimeo.com\")",
        "serial=()",
        "usb=()",
      ].join(", "),
    },
    { key: "Content-Security-Policy", value: contentSecurityPolicy(nodeEnv) },
  ];
}
