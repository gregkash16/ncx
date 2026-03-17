"use client";

import { useEffect, useState } from "react";

interface MobileHeaderTitleProps {
  defaultText?: string;
}

export default function MobileHeaderTitle({ defaultText = "NICKELCITYXWING.COM" }: MobileHeaderTitleProps) {
  const [headerText, setHeaderText] = useState(defaultText);

  useEffect(() => {
    // Check for dev impersonation - overrides server-side NCXID
    const params = new URLSearchParams(window.location.search);
    const password = params.get("password");
    const ncxid = params.get("ncxid");

    const devPassword = "testing"; // Must match DEV_IMPERSONATION_PASSWORD

    if (password === devPassword && ncxid) {
      setHeaderText(ncxid.toUpperCase());
    } else {
      // Use the server-side NCXID
      setHeaderText(defaultText);
    }
  }, [defaultText]);

  return <>{headerText}</>;
}
