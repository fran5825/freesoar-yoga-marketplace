import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";

import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [Google],
  session: {
    strategy: "database",
  },
  // member-flow-redesign 票 05：Google 取消或失敗時回到本站登入頁，不停在 Auth.js 內建的英文頁面。
  // 取消（OAuthCallbackError 等）屬於 signIn 類錯誤、其他屬於 error 類，兩種都要指定。
  pages: {
    signIn: "/sign-in",
    error: "/sign-in",
  },
});
