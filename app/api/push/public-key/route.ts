import { NextResponse } from "next/server";

export async function GET() {
  const publicKey =
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
    "BGttiMzrlDrz9C2oMk2GIbB53GgHUAkWLgAGdZqGPfMtny-pJa8Unxa0VX8_VkSKBXuBD-Z0OOdm_nUO365UF6c";

  return NextResponse.json({ publicKey });
}
